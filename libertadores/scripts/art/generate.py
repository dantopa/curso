#!/usr/bin/env python3
"""Generate painted full-body fighter sprites locally on CPU (SDXL-Turbo / SD-Turbo).

Usage (from anywhere):
  /home/user/artenv/bin/python generate.py --ids bolivar,belgrano --n 3 --steps 2
  /home/user/artenv/bin/python generate.py --all --n 4 --steps 2

Output: /home/user/artwork/<id>/cand_<seed>.png (768x1024 RGBA, feet on bottom edge,
centered) + /home/user/artwork/<id>/sheet.png (contact sheet).
"""
import argparse, json, os, sys, time
from collections import deque
from pathlib import Path

os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
OUT_ROOT = Path("/home/user/artwork")
CW, CH = 768, 1024
FIG_H = 980

STYLE = ("full length wide shot with empty margin around, full body, head to boots, standing in a fighting stance, body turned to the right, "
         "side profile view facing right, plain flat light grey background, "
         "dark cinematic painted illustration, realistic historical oil painting, dramatic rim lighting, "
         "moody, highly detailed costume")
NEGATIVE = ("cropped, close-up, portrait, headshot, cut off feet, cut off head, multiple people, crowd, "
            "text, watermark, signature, logo, frame, border, extra limbs, extra arms, extra legs, "
            "deformed hands, blurry, low quality, cartoon, anime, horse, scenery, landscape, backdrop")


PREFIX = ("dark cinematic oil painting, full body, facing right in profile, fighting stance, "
          "whole figure visible head to boots, plain grey background")


def build_prompt(c):
    # CLIP reads only ~77 tokens: style, framing and facing go FIRST so they are never truncated.
    return f"{PREFIX}: {c['desc']}"


def load_pipe(model, dtype="bf16"):
    import torch
    from diffusers import AutoPipelineForText2Image
    torch.set_num_threads(os.cpu_count() or 4)
    kw = dict(torch_dtype={"bf16": torch.bfloat16, "fp32": torch.float32}[dtype], low_cpu_mem_usage=True)
    try:
        pipe = AutoPipelineForText2Image.from_pretrained(model, variant="fp16", **kw)
    except Exception:
        pipe = AutoPipelineForText2Image.from_pretrained(model, **kw)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def get_matter(name):
    from rembg import new_session, remove
    sess = new_session(name)
    def run(img):
        return remove(img, session=sess, post_process_mask=True)
    return run


def clean_alpha(rgba):
    """Keep the largest connected blob, fill small holes, light edge smoothing."""
    a = np.array(rgba.getchannel("A"))
    mask = a > 96
    # largest connected component (4-neighbour) via downsampled flood fill
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    best, best_n, cur = 0, 0, 0
    for y in range(0, h):
        for x in range(0, w):
            if mask[y, x] and not lab[y, x]:
                cur += 1
                q = deque([(y, x)]); lab[y, x] = cur; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = cur; q.append((ny, nx))
                if n > best_n: best, best_n = cur, n
    keep = lab == best
    # keep detached parts (e.g. a sabre tip) only if they lie within ~30px of the main body
    near = np.array(Image.fromarray((lab == best).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(61))) > 0
    for i in range(1, cur + 1):
        if i != best and (lab == i).sum() > 40 and ((lab == i) & near).any():
            keep |= lab == i
    a2 = np.where(keep, a, 0).astype(np.uint8)
    al = Image.fromarray(a2).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgba.copy(); out.putalpha(al)
    return out


def place_on_canvas(rgba):
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bbox:
        return Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    fig = rgba.crop(bbox)
    s = FIG_H / fig.height
    if fig.width * s > CW - 8:
        s = (CW - 8) / fig.width
    fig = fig.resize((max(1, round(fig.width * s)), max(1, round(fig.height * s))), Image.LANCZOS)
    fig = fig.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    canvas.alpha_composite(fig, ((CW - fig.width) // 2, CH - fig.height))
    return canvas


def contact_sheet(paths, out):
    ims = [Image.open(p).convert("RGBA") for p in paths]
    tw, th = 288, 384
    sheet = Image.new("RGB", (tw * len(ims), th + 20), (70, 70, 80))
    d = ImageDraw.Draw(sheet)
    for i, (im, p) in enumerate(zip(ims, paths)):
        t = im.resize((tw, th), Image.LANCZOS)
        bg = Image.new("RGBA", (tw, th), (70, 110, 90, 255)); bg.alpha_composite(t)
        sheet.paste(bg.convert("RGB"), (i * tw, 0))
        d.text((i * tw + 4, th + 4), Path(p).stem, fill=(255, 255, 255))
    sheet.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="", help="comma separated ids")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--n", type=int, default=3)
    ap.add_argument("--steps", type=int, default=2)
    ap.add_argument("--model", default="stabilityai/sdxl-turbo")
    ap.add_argument("--dtype", default="bf16", help="bf16 (fits 15GB RAM for SDXL) or fp32 (only for sd-turbo)")
    ap.add_argument("--width", type=int, default=512)
    ap.add_argument("--height", type=int, default=768)
    ap.add_argument("--seed0", type=int, default=1000)
    ap.add_argument("--guidance", type=float, default=0.0,
                    help="0.0 for turbo (negative prompt ignored when 0); try 1.2-2.0 to enable negative prompt")
    ap.add_argument("--matter", default="isnet-general-use", help="rembg model: u2net, isnet-general-use, ...")
    ap.add_argument("--keep-rejected", action="store_true", help="save rejected raw generations for debugging")
    ap.add_argument("--spec", default=str(HERE / "characters.json"))
    ap.add_argument("--out", default=str(OUT_ROOT))
    a = ap.parse_args()

    spec = {k: v for k, v in json.load(open(a.spec)).items() if not k.startswith("_")}
    ids = list(spec) if a.all or not a.ids else [s.strip() for s in a.ids.split(",") if s.strip()]
    for i in ids:
        if i not in spec: sys.exit(f"unknown id {i}; known: {', '.join(spec)}")

    import torch
    t0 = time.time(); pipe = load_pipe(a.model, a.dtype); matter = get_matter(a.matter)
    print(f"[load] {time.time()-t0:.1f}s", flush=True)
    neg = NEGATIVE if a.guidance > 1.0 else None

    for cid in ids:
        d = Path(a.out) / cid; d.mkdir(parents=True, exist_ok=True)
        prompt = build_prompt(spec[cid])
        print(f"[{cid}] {prompt}", flush=True)
        paths = []
        seed, made, tries = a.seed0, 0, 0
        while made < a.n and tries < a.n * 8:
            tries += 1
            g = torch.Generator("cpu").manual_seed(seed)
            t1 = time.time()
            img = pipe(prompt=prompt, negative_prompt=neg, num_inference_steps=a.steps,
                       guidance_scale=a.guidance, width=a.width, height=a.height, generator=g).images[0]
            t2 = time.time()
            cut = clean_alpha(matter(img.convert("RGB")).convert("RGBA"))
            bb = cut.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
            cropped = (not bb) or bb[1] <= 1 or bb[3] >= a.height - 1
            print(f"  seed {seed}: gen {t2-t1:.1f}s  matte {time.time()-t2:.1f}s" + ("  REJECTED (touches top/bottom edge = cropped)" if cropped else ""), flush=True)
            if cropped and a.keep_rejected:
                img.save(d / f"rejected_{seed}.png")
            if not cropped:
                img.save(d / f"raw_{seed}.png")
                p = d / f"cand_{seed}.png"; place_on_canvas(cut).save(p); paths.append(p); made += 1
            seed += 1
        if paths:
            contact_sheet(paths, d / "sheet.png")
            print(f"  -> {d/'sheet.png'}", flush=True)
        else:
            print(f"  -> NO usable candidates for {cid} (all cropped); rerun with another --seed0", flush=True)


if __name__ == "__main__":
    main()
