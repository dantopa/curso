#!/usr/bin/env python3
"""Pose-guided, identity-consistent frame generator (CPU, SDXL-Turbo + OpenPose ControlNet + IP-Adapter).

Usage:
  /home/user/artenv/bin/python render.py --poses <dir of NN.png|NN.json> --out <dir> --seed 7 --steps 5 \
      [--ref idle.png] [--strength 0.7] [--cn-scale 0.9] [--ip-scale 0.7] [--matte auto|isnet|human]

Input poses: OpenPose skeleton images (black bg, standard colours, any square size; resized to 768) or
JSON with 18 COCO-OpenPose keypoints: [[x,y],...] or {"keypoints": [...]}; coordinates in 768x768 pixels
(or normalised 0..1). Missing keypoints: null.
Output: <out>/NN.png (1024x1024 RGBA, ankle-midpoint at x=512, ground at y=1000, same scale for every frame),
<out>/strip.png (contact sheet), <out>/anim.gif (preview), <out>/raw/NN.png (unmatted 768 generations).

Pipeline: SDXL-Turbo (bf16) + xinsir/controlnet-openpose-sdxl-1.0 + IP-Adapter plus (ViT-H) from the idle
reference.  Prompt embeds and IP-image embeds are computed once, then text encoders / CLIP image encoder are
freed so the whole thing fits in ~10 GB.  Same prompt + same seed for every frame (less flicker).
"""
import argparse, glob, json, os, sys, time
from pathlib import Path

os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DEFAULT_REF = ROOT / "public/assets/fighters/sanmartin/idle.png"
GEN = 768          # generation / skeleton resolution
CANVAS = 1024      # output canvas
CHAR_H = 820       # px of full figure (hat to boots) in a standing idle on the output canvas
GROUND_Y = 1000
CENTER_X = 512
FIG_OVER_NOSE = 1.205   # full figure height (hat..boot sole) / (nose..ankle) measured on the idle painting
FOOT_OFF = 0.0625       # boot sole below ankle keypoint, in units of (nose..ankle)

# ---------------------------------------------------------------- OpenPose drawing
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
         (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0),
          (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255),
          (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]


def draw_openpose(kps, size=GEN):
    """kps: list of 18 (x,y) pixel coords or None. Returns RGB PIL image, standard OpenPose style."""
    import cv2
    img = np.zeros((size, size, 3), np.uint8)
    sw = max(2, int(round(4 * size / 512)))
    for (a, b), col in zip(LIMBS, COLORS):
        if kps[a] is None or kps[b] is None:
            continue
        (x1, y1), (x2, y2) = kps[a], kps[b]
        m = ((x1 + x2) / 2, (y1 + y2) / 2)
        length = float(np.hypot(x1 - x2, y1 - y2))
        ang = np.degrees(np.arctan2(y1 - y2, x1 - x2))
        poly = cv2.ellipse2Poly((int(m[0]), int(m[1])), (int(length / 2), sw), int(ang), 0, 360, 1)
        cv2.fillConvexPoly(img, poly, tuple(int(c * 0.6) for c in col))
    for k, col in zip(kps, COLORS):
        if k is None:
            continue
        cv2.circle(img, (int(k[0]), int(k[1])), sw, col, thickness=-1)
    return Image.fromarray(img)


def read_keypoints_from_image(pil):
    """Rough recovery of the skeleton keypoints from a standard OpenPose image by locating the joint
    circles (pure palette colours).  Used only to compute the anchor (ankles, sword wrist)."""
    a = np.array(pil.convert("RGB").resize((GEN, GEN), Image.NEAREST)).astype(int)
    kps = []
    for col in COLORS:
        d = np.abs(a - np.array(col)).sum(-1)
        ys, xs = np.nonzero(d < 24)
        kps.append(None if len(xs) < 6 else (float(xs.mean()), float(ys.mean())))
    return kps


def load_pose(path):
    """-> (skeleton PIL 768x768 RGB, keypoints list or None)"""
    path = str(path)
    if path.endswith(".json"):
        d = json.load(open(path))
        raw = d["keypoints"] if isinstance(d, dict) else d
        kps = []
        for k in raw[:18]:
            if k is None or (len(k) >= 3 and k[2] is not None and k[2] <= 0):
                kps.append(None); continue
            x, y = float(k[0]), float(k[1])
            if max(abs(x), abs(y)) <= 1.5:
                x, y = x * GEN, y * GEN
            kps.append((x, y))
        kps += [None] * (18 - len(kps))
        return draw_openpose(kps), kps
    im = Image.open(path).convert("RGB")
    if im.size != (GEN, GEN):
        im = im.resize((GEN, GEN), Image.LANCZOS)
    return im, read_keypoints_from_image(im)


def sword_wrist(kps):
    """Wrist of the sabre arm = whichever wrist (kp 4 / 7) is further right (character faces right)."""
    c = [i for i in (4, 7) if kps[i] is not None]
    if not c:
        return None
    return max(c, key=lambda i: kps[i][0])


# ---------------------------------------------------------------- reference skeleton (idle) -> scale
def load_ref_skeleton():
    p = HERE / "idle_skeleton.json"
    return json.load(open(p))["keypoints"]


def skel_metrics(kps):
    """(ankle_mid_x, lowest_ankle_y, H) where H = ankle_mid_y - nose_y (standing height reference)."""
    an = [kps[i] for i in (10, 13) if kps[i] is not None]
    if not an or kps[0] is None:
        return None
    ax = sum(k[0] for k in an) / len(an)
    ay = sum(k[1] for k in an) / len(an)
    return ax, max(k[1] for k in an), ay - kps[0][1]


# ---------------------------------------------------------------- pipeline
PROMPT = ("dark cinematic oil painting of Jose de San Martin, Argentine general, full body, side view facing right, "
          "dark wavy hair, thick sideburns, black bicorne hat, dark blue military coat with gold embroidery, "
          "large gold epaulettes, red collar, white trousers, black knee boots, curved sabre in his hand, "
          "plain flat grey background, highly detailed")
NEG = "cropped, close-up, text, watermark, extra limbs, deformed hands, blurry, cartoon, anime, multiple people, scenery"


def grey_ref(path, size=GEN):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (128, 128, 128, 255))
    bg.alpha_composite(im)
    bg = bg.convert("RGB")
    s = max(bg.size)
    sq = Image.new("RGB", (s, s), (128, 128, 128))
    sq.paste(bg, ((s - bg.width) // 2, (s - bg.height) // 2))
    return sq


class Generator:
    def __init__(self, ref, prompt=PROMPT, neg=NEG, ip_scale=0.7, cn_scale=0.9, mode="ip", threads=4):
        import torch
        from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel
        torch.set_num_threads(threads)
        self.torch = torch
        bf = torch.bfloat16
        t0 = time.time()
        cn = ControlNetModel.from_pretrained("xinsir/controlnet-openpose-sdxl-1.0", torch_dtype=bf,
                                             low_cpu_mem_usage=True)
        try:
            pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                "stabilityai/sdxl-turbo", controlnet=cn, torch_dtype=bf, variant="fp16", low_cpu_mem_usage=True)
        except Exception:
            pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                "stabilityai/sdxl-turbo", controlnet=cn, torch_dtype=bf, low_cpu_mem_usage=True)
        pipe.set_progress_bar_config(disable=True)
        self.cn_scale = cn_scale
        with torch.no_grad():
            pe, npe, ppe, nppe = pipe.encode_prompt(prompt, device="cpu", num_images_per_prompt=1,
                                                    do_classifier_free_guidance=False)
        self.pe, self.ppe = pe, ppe
        self.ip_embeds = None
        if mode == "ip":
            from transformers import CLIPVisionModelWithProjection
            enc = CLIPVisionModelWithProjection.from_pretrained(
                "h94/IP-Adapter", subfolder="models/image_encoder", torch_dtype=bf, low_cpu_mem_usage=True)
            pipe.image_encoder = enc
            pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models",
                                 weight_name="ip-adapter-plus_sdxl_vit-h.safetensors", image_encoder_folder=None)
            pipe.set_ip_adapter_scale(ip_scale)
            with torch.no_grad():
                self.ip_embeds = pipe.prepare_ip_adapter_image_embeds(
                    [grey_ref(ref)], None, "cpu", 1, False)
            pipe.image_encoder = None
            del enc
        # free text encoders (their output is cached)
        pipe.text_encoder = None
        pipe.text_encoder_2 = None
        import gc; gc.collect()
        self.pipe = pipe
        self.load_s = time.time() - t0

    def __call__(self, skel, seed, steps=5):
        torch = self.torch
        g = torch.Generator("cpu").manual_seed(seed)
        kw = dict(prompt_embeds=self.pe, pooled_prompt_embeds=self.ppe, image=skel, num_inference_steps=steps,
                  guidance_scale=0.0, controlnet_conditioning_scale=self.cn_scale, generator=g,
                  width=GEN, height=GEN)
        if self.ip_embeds is not None:
            kw["ip_adapter_image_embeds"] = self.ip_embeds
        with torch.no_grad():
            return self.pipe(**kw).images[0]


# ---------------------------------------------------------------- matting / cleaning
_sessions = {}


def _alpha(img, name):
    from rembg import new_session, remove
    if name not in _sessions:
        _sessions[name] = new_session(name)
    out = remove(img, session=_sessions[name], post_process_mask=False)
    return np.array(out.getchannel("A"))


def _components(mask):
    from scipy import ndimage
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    return lab, n


def matte(img, kps, mode="auto"):
    """returns uint8 alpha (GEN x GEN). auto = human_seg UNION isnet near the sabre wrist, largest blob + sword blob."""
    from scipy import ndimage
    if mode == "isnet":
        a = _alpha(img, "isnet-general-use")
    elif mode == "human":
        a = _alpha(img, "u2net_human_seg")
    else:
        a = _alpha(img, "u2net_human_seg")
        ai = _alpha(img, "isnet-general-use")
        sw = sword_wrist(kps) if kps else None
        if sw is not None:
            H = skel_metrics(kps)[2] if skel_metrics(kps) else 500
            yy, xx = np.mgrid[0:GEN, 0:GEN]
            wx, wy = kps[sw]
            disk = ((xx - wx) ** 2 + (yy - wy) ** 2) < (0.55 * H) ** 2
            # only isnet pixels away from the feet (floor shadows) are admitted
            a = np.where(disk, np.maximum(a, ai), a)
    m = a > 100
    lab, n = _components(m)
    if n == 0:
        return a
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = {int(np.argmax(sizes)) + 1}
    big = lab == (int(np.argmax(sizes)) + 1)
    # sword blobs: detached components close to the sabre wrist (or touching a dilated main blob)
    sw = sword_wrist(kps) if kps else None
    near = ndimage.binary_dilation(big, iterations=14)
    for i in range(1, n + 1):
        if i in keep or sizes[i - 1] < 40:
            continue
        comp = lab == i
        ok = (comp & near).any()
        if not ok and sw is not None:
            ys, xs = np.nonzero(comp)
            d = np.hypot(xs - kps[sw][0], ys - kps[sw][1]).min()
            ok = d < 70
        if ok:
            keep.add(i)
    final = np.isin(lab, list(keep))
    # fill holes inside main body, soften
    final = ndimage.binary_fill_holes(final)
    soft = Image.fromarray((final * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    soft = np.array(soft).astype(np.float32) / 255
    return (soft * 255).astype(np.uint8)


# ---------------------------------------------------------------- colour matching + outline
def to_lab(rgb):
    from skimage import color
    return color.rgb2lab(rgb.astype(np.float32) / 255)


def color_match(rgb, alpha, ref_rgb, ref_alpha, clamp=(0.75, 1.35)):
    """per-channel mean/std match in Lab on masked pixels (rgb, ref_rgb uint8 HxWx3)."""
    from skimage import color
    L, R = to_lab(rgb), to_lab(ref_rgb)
    m, rm = alpha > 128, ref_alpha > 128
    out = L.copy()
    for c in range(3):
        mu, sd = L[..., c][m].mean(), L[..., c][m].std() + 1e-3
        rmu, rsd = R[..., c][rm].mean(), R[..., c][rm].std() + 1e-3
        gain = float(np.clip(rsd / sd, *clamp))
        out[..., c] = (L[..., c] - mu) * gain + rmu
    return (np.clip(color.lab2rgb(out), 0, 1) * 255).astype(np.uint8)


def outline(rgba):
    alpha = rgba.getchannel("A")
    ring = alpha.filter(ImageFilter.MaxFilter(5))
    o = Image.new("RGBA", rgba.size, (12, 8, 6, 0))
    o.putalpha(ring.point(lambda v: int(v * 0.85)))
    return Image.alpha_composite(o, rgba)


def place(rgba768, kps, ref_kps_metrics, fixed_ground=False, fixed_x=False):
    """Scale + translate the 768 RGBA onto the 1024 canvas using skeleton anchors."""
    ax0, gy0, H0 = ref_kps_metrics   # idle: ankle_mid_x, lowest ankle y, H
    s = CHAR_H / (FIG_OVER_NOSE * H0)
    m = skel_metrics(kps)
    ax, ay, _ = m if m else (ax0, gy0, H0)
    if fixed_x:
        ax = ax0
    ground = (gy0 if fixed_ground else ay) + FOOT_OFF * H0
    w = int(round(rgba768.width * s))
    im = rgba768.resize((w, w), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = int(round(CENTER_X - ax * s))
    oy = int(round(GROUND_Y - ground * s))
    canvas.alpha_composite(im, (max(ox, 0), max(oy, 0))) if ox >= 0 and oy >= 0 else _paste_clip(canvas, im, ox, oy)
    return canvas


def _paste_clip(canvas, im, ox, oy):
    tmp = Image.new("RGBA", (CANVAS * 3, CANVAS * 3), (0, 0, 0, 0))
    tmp.alpha_composite(im, (ox + CANVAS, oy + CANVAS)) if ox + CANVAS >= 0 and oy + CANVAS >= 0 else None
    canvas.alpha_composite(tmp.crop((CANVAS, CANVAS, 2 * CANVAS, 2 * CANVAS)))


# ---------------------------------------------------------------- main
def sheets(frames, out):
    n = len(frames)
    t = 256
    cols = min(n, 8)
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (cols * t, rows * t), (70, 74, 82))
    gif = []
    for i, f in enumerate(frames):
        bg = Image.new("RGBA", f.size, (70, 74, 82, 255)); bg.alpha_composite(f)
        sheet.paste(bg.convert("RGB").resize((t, t), Image.LANCZOS), ((i % cols) * t, (i // cols) * t))
        gif.append(bg.convert("RGB").resize((512, 512), Image.LANCZOS))
    sheet.save(out / "strip.png")
    gif[0].save(out / "anim.gif", save_all=True, append_images=gif[1:], duration=110, loop=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--poses", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--steps", type=int, default=5)
    ap.add_argument("--ref", default=str(DEFAULT_REF))
    ap.add_argument("--ref-skeleton", default=None, help="JSON/PNG of the standing idle skeleton used for scale (default idle_skeleton.json)")
    ap.add_argument("--cn-scale", type=float, default=0.9)
    ap.add_argument("--ip-scale", type=float, default=0.7)
    ap.add_argument("--strength", type=float, default=None, help="img2img fallback strength (only with --mode img2img)")
    ap.add_argument("--mode", choices=["ip", "none"], default="ip")
    ap.add_argument("--matte", choices=["auto", "isnet", "human"], default="auto")
    ap.add_argument("--fixed-ground", action="store_true", help="keep ground line of the idle (jump arcs survive)")
    ap.add_argument("--fixed-x", action="store_true")
    ap.add_argument("--no-match", action="store_true")
    ap.add_argument("--prompt", default=PROMPT)
    a = ap.parse_args()

    files = sorted(glob.glob(os.path.join(a.poses, "*.png")) + glob.glob(os.path.join(a.poses, "*.json")))
    files = [f for f in files if Path(f).stem[:2].isdigit() or True]
    out = Path(a.out); (out / "raw").mkdir(parents=True, exist_ok=True)
    if a.ref_skeleton:
        rk = load_pose(a.ref_skeleton)[1]
    else:
        rk = [tuple(k) if k else None for k in load_ref_skeleton()]
    rm = skel_metrics(rk)

    gen = Generator(a.ref, prompt=a.prompt, ip_scale=a.ip_scale, cn_scale=a.cn_scale, mode=a.mode)
    print(f"load {gen.load_s:.0f}s", flush=True)
    ref_img = Image.open(a.ref).convert("RGBA")
    ref_rgb = np.array(ref_img.convert("RGB")); ref_alpha = np.array(ref_img.getchannel("A"))
    frames = []
    for f in files:
        name = Path(f).stem
        skel, kps = load_pose(f)
        t0 = time.time()
        img = gen(skel, a.seed, a.steps)
        tg = time.time() - t0
        img.save(out / "raw" / f"{name}.png")
        al = matte(img, kps, a.matte)
        rgb = np.array(img.convert("RGB"))
        if not a.no_match:
            rgb = color_match(rgb, al, ref_rgb, ref_alpha)
        rgba = Image.fromarray(np.dstack([rgb, al]), "RGBA")
        full = place(rgba, kps, rm, a.fixed_ground, a.fixed_x)
        full = outline(full)
        full.save(out / f"{name}.png")
        frames.append(full)
        print(f"{name}: gen {tg:.1f}s total {time.time() - t0:.1f}s", flush=True)
    sheets(frames, out)
    print("done", out)


if __name__ == "__main__":
    main()
