"""Green-screen animation strips (one horizontal row of frames on #00FF00) -> game anims pack.

usage: python strips.py <char_id> <strips_dir> [--config strips.json]
<strips_dir>/<clip>.png  e.g. idle.png, walk_fwd.png, light.png, heavy.png ...
Clip names = game clip names (see docs/ART_PIPELINE.md). Per-clip timing/phases come from CLIPS below
(override with a JSON config). Output: public/assets/fighters/<id>/anims.json + anims/<clip>/NN.webp + idle.png
"""
import json, sys, argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

S, A, R = 'startup', 'active', 'recovery'
# clip: (ticks per frame list or single int, loop, phases or None)
CLIPS = {
    'idle': (8, True, None), 'walk_fwd': (6, True, None), 'walk_back': (7, True, None),
    'crouch': ([3, 3, 4], False, None), 'jump': (6, False, None), 'block': ([3, 4, 4, 6], False, None),
    'crouch_block': (6, False, None),
    'light': ([4, 4, 5, 8], False, [S, A, A, R]),
    'heavy': ([6, 6, 4, 4, 8, 10], False, [S, S, A, A, R, R]),
    'crouch_light': ([4, 4, 6, 6], False, [S, A, R, R]),
    'crouch_heavy': ([5, 5, 4, 8, 8], False, [S, S, A, R, R]),
    'air_attack': ([4, 8, 8], False, [S, A, R]),
    'hit_high': ([4, 6, 8], False, None),
    'knockdown': ([4, 6, 6, 8, 12], False, None),
    'getup': ([8, 8, 8], False, None),
    'special_cast': ([7, 7, 5, 6, 8], False, [S, S, A, R, R]),
    'rush': ([6, 6, 6, 8], False, [S, A, A, R]),
    'throw': ([6, 6, 6, 10], False, [S, A, R, R]),
    'turn': ([2, 2, 2], False, None),
    'win': (10, False, None),
    'dazed': (30, True, None), 'dead': (60, False, None), 'counter': ([6, 6, 8], False, [S, A, R]),
}
# frame counts requested in the ChatGPT prompt (used to split strips whose frames touch each other)
COUNTS = {'idle': 6, 'walk_fwd': 6, 'walk_back': 6, 'crouch': 3, 'jump': 4, 'block': 4, 'crouch_block': 2, 'light': 4,
          'heavy': 6, 'crouch_light': 4, 'crouch_heavy': 5, 'air_attack': 3, 'hit_high': 3, 'knockdown': 5, 'getup': 3,
          'special_cast': 5, 'rush': 4, 'throw': 4, 'turn': 3, 'win': 5}
ap = argparse.ArgumentParser()
ap.add_argument('char'); ap.add_argument('src'); ap.add_argument('--config')
ap.add_argument('--height', type=int, default=420, help='output standing height px (idle)')
a = ap.parse_args()
cfg = json.load(open(a.config)) if a.config else {}

def key_strip(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    greenness = g - np.maximum(r, b)                          # high on the green screen
    alpha = np.clip((90 - greenness) * 255 / 60, 0, 255)      # soft edge 30..90
    alpha[(g > 200) & (r < 80) & (b < 80)] = 0
    # despill: clamp green to max(r,b) where the pixel is greenish
    g2 = np.where(greenness > 0, np.maximum(r, b) + greenness // 4, g)
    out = np.dstack([r, np.minimum(g, g2), b, alpha]).clip(0, 255).astype(np.uint8)
    rgba = Image.fromarray(out, 'RGBA')
    A_ = np.asarray(rgba.getchannel('A')) > 128
    # drop specks: alpha erosion+dilation
    m = Image.fromarray((A_ * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))
    al = np.minimum(np.asarray(rgba.getchannel('A')), np.asarray(m))
    rgba.putalpha(Image.fromarray(al))
    return rgba

def split(rgba, expect=None):
    A_ = np.asarray(rgba.getchannel('A')) > 100
    col = A_.sum(0); on = col > 2
    if expect:
        # strips are evenly spaced: cut at the emptiest column near each ideal boundary
        xs = np.nonzero(on)[0]; L, Rr = int(xs.min()), int(xs.max()) + 1
        w = (Rr - L) / expect; cuts = [L]
        for k in range(1, expect):
            c = L + w * k; lo, hi = int(c - w * 0.18), int(c + w * 0.18)
            cuts.append(lo + int(np.argmin(col[lo:hi])))
        cuts.append(Rr)
        segs = [[cuts[k], cuts[k + 1]] for k in range(expect)]
        return _frames(rgba, A_, segs)
    segs = []; i = 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]: j += 1
            segs.append([i, j]); i = j
        else: i += 1
    mass = [A_[:, s0:s1].sum() for s0, s1 in segs]
    med = np.median(mass) if mass else 0
    k = 1
    while k < len(segs):                       # detached bits (blade tips) -> figure on their left
        if mass[k] < 0.2 * med: segs[k-1][1] = segs[k][1]; mass[k-1] += mass.pop(k); segs.pop(k)
        else: k += 1
    if segs and mass[0] < 0.2 * med and len(segs) > 1: segs[1][0] = segs[0][0]; segs.pop(0)
    if expect:
        while len(segs) > expect:
            gaps = [segs[k+1][0] - segs[k][1] for k in range(len(segs) - 1)]
            k = int(np.argmin(gaps)); segs[k][1] = segs[k+1][1]; segs.pop(k+1)
    return _frames(rgba, A_, segs)

def _components(mask):
    lab = np.zeros(mask.shape, np.int32); comps = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        cid = len(comps) + 1; st = [(y0, x0)]; lab[y0, x0] = cid; n = 0; xa, xb = x0, x0
        while st:
            y, x = st.pop(); n += 1; xa = min(xa, x); xb = max(xb, x)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cid; st.append((ny, nx))
        comps.append((cid, n, xa, xb))
    return lab, comps

def _frames(rgba, A_, segs):
    # ownership: start from column segments, then pieces of a segment that are NOT connected to its main body and
    # touch its left edge are the previous frame's blade tip / cape -> give them to the previous frame
    f = 2
    small = A_[::f, ::f]
    own = np.zeros(A_.shape, np.int32) - 1
    for k, (s0, s1) in enumerate(segs): own[:, s0:s1] = np.where(A_[:, s0:s1], k, -1)
    for k, (s0, s1) in enumerate(segs):
        sub = small[:, s0 // f:(s1 + f - 1) // f]
        lab, comps = _components(sub)
        if not comps: continue
        main = max(comps, key=lambda c: c[1]); W = sub.shape[1]
        for cid, n, xa, xb in comps:
            if cid == main[0]: continue
            if xa <= 2 and k > 0: to = k - 1                  # previous frame's blade tip
            elif xb >= W - 3 and k < len(segs) - 1: to = k + 1  # next frame's cape edge
            elif n < 0.004 * main[1]: to = -1                   # specks
            else: continue
            m = np.kron((lab == cid).astype(np.uint8), np.ones((f, f), np.uint8)).astype(bool)
            m = m[:A_.shape[0], :s1 - s0] if m.shape[1] >= s1 - s0 else np.pad(m, ((0, 0), (0, s1 - s0 - m.shape[1])))[:A_.shape[0]]
            region = own[:, s0:s1]; region[m & A_[:, s0:s1]] = to
    arr = np.asarray(rgba)
    frames = []
    for k in range(len(segs)):
        mk = own == k
        cols = np.nonzero(mk.any(0))[0]; rows = np.nonzero(mk.any(1))[0]
        x0, x1, y0, y1 = int(cols.min()), int(cols.max()) + 1, int(rows.min()), int(rows.max()) + 1
        piece = arr[y0:y1, x0:x1].copy(); piece[..., 3] = np.where(mk[y0:y1, x0:x1], piece[..., 3], 0)
        fr = Image.fromarray(piece, 'RGBA')
        a2 = np.asarray(fr.getchannel('A')) > 100; h = a2.shape[0]
        xs = np.nonzero(a2[int(h * 0.9):].any(0))[0]
        footx = float((xs.min() + xs.max()) / 2) if len(xs) else fr.width / 2
        frames.append((fr, footx))
    return frames

root = Path(__file__).resolve().parents[2]
dst = root / 'public' / 'assets' / 'fighters' / a.char
src = Path(a.src)
clips = {}
for p in sorted(src.glob('*.png')):
    name = p.stem
    if name not in CLIPS and name not in cfg: print('skip unknown clip', name); continue
    ticks, loop, phases = cfg.get(name, CLIPS[name])
    frames = split(key_strip(p), COUNTS.get(name))
    clips[name] = (frames, ticks, loop, phases)
    print(name, len(frames), 'frames, heights', [f.height for f, _ in frames])
if 'idle' not in clips: sys.exit('idle.png is required (scale reference)')
idle_h = float(np.median([f.height for f, _ in clips['idle'][0]]))
sc = a.height / idle_h
CW, CH = int(a.height * 3.0), int(a.height * 1.35)
AX, AY = CW // 2, CH - 12
import shutil
if (dst / 'anims').exists(): shutil.rmtree(dst / 'anims')
pack = {'canvas': [CW, CH], 'anchor': [AX, AY], 'standHeight': a.height, 'anims': {}}
for name, (frames, ticks, loop, phases) in clips.items():
    (dst / 'anims' / name).mkdir(parents=True, exist_ok=True)
    files, durs = [], []
    n = len(frames)
    tl = ticks if isinstance(ticks, list) else [ticks] * n
    tl = (tl + [tl[-1]] * n)[:n]
    ph = (phases + [phases[-1]] * n)[:n] if phases else None
    for k, (fr, footx) in enumerate(frames):
        fr = fr.resize((max(1, int(fr.width * sc)), max(1, int(fr.height * sc))), Image.LANCZOS)
        lying = fr.height < 0.6 * a.height and fr.width > fr.height
        ax = fr.width / 2 if lying else footx * sc
        can = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        x, y = int(round(AX - ax)), AY - fr.height
        if y < 0: fr = fr.crop((0, -y, fr.width, fr.height)); y = 0
        if x < 0: fr = fr.crop((-x, 0, fr.width, fr.height)); x = 0
        can.alpha_composite(fr, (x, y))
        rel = f'anims/{name}/{k:02d}.webp'
        can.save(dst / rel, 'WEBP', quality=90, method=6)
        files.append(rel); durs.append(int(tl[k]))
    d = {'frames': files, 'durations': durs, 'loop': bool(loop)}
    if ph: d['phases'] = ph
    pack['anims'][name] = d
json.dump(pack, open(dst / 'anims.json', 'w'), indent=1)
fr, _ = clips['idle'][0][0]
s2 = 980 / fr.height; fr = fr.resize((int(fr.width * s2), 980), Image.LANCZOS)
can = Image.new('RGBA', (768, 1024), (0, 0, 0, 0)); can.alpha_composite(fr, ((768 - fr.width) // 2, 44)); can.save(dst / 'idle.png')
print('pack:', list(pack['anims']))
