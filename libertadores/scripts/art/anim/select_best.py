"""Pick the best candidate per frame among several renders (different seeds).

Heuristics (all on the placed 1024 frames):
 - double hat / floating objects: the silhouette top must not rise far above where the hat should be
   (expected = nose y on the canvas - hat offset measured on idle frames). Only for upright poses.
 - matte failures: alpha area far from the per-animation median is penalised.
 - fragments: number of separate blobs is penalised.
usage: python select_best.py <out_root> <cand_root1> <cand_root2> ...
"""
import sys, json, shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).parent))
import render as R

out_root, cands = Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]]
man = json.load(open(Path(__file__).parent / 'poses' / 'manifest.json'))['animations']
_, ref = R.load_pose(str(Path(__file__).parent / 'poses' / 'idle' / '00.json'))
ax0, gy0, H0 = R.skel_metrics(ref)
s = R.CHAR_H / (R.FIG_OVER_NOSE * H0); ground = gy0 + R.FOOT_OFF * H0

def canvas_y(y01): return R.GROUND_Y + (y01 * R.GEN - ground) * s

def stats(p):
    a = np.asarray(Image.open(p).getchannel('A')) > 100
    ys, xs = np.nonzero(a)
    if len(ys) == 0: return None
    small = a[::8, ::8]
    # count blobs (4-neighbour flood on a coarse grid)
    seen = np.zeros_like(small); blobs = 0
    for y, x in zip(*np.nonzero(small)):
        if seen[y, x]: continue
        blobs += 1; st = [(y, x)]; seen[y, x] = 1
        while st:
            cy, cx = st.pop()
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = cy+dy, cx+dx
                if 0 <= ny < small.shape[0] and 0 <= nx < small.shape[1] and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = 1; st.append((ny, nx))
    return {'top': int(ys.min()), 'area': int(a.sum()), 'blobs': blobs}

# hat offset: idle frames top - nose
offs = []
for c in cands:
    for fr in man['idle']['frames']:
        p = c / 'idle' / f"{fr['index']:02d}.png"
        if p.exists():
            st = stats(p); kp = json.load(open(Path(__file__).parent / 'poses_fix' / 'idle' / f"{fr['index']:02d}.json"))['keypoints']
            offs.append(st['top'] - canvas_y(kp[0][1]))
hat_off = float(np.median(offs)) if offs else -150
print('hat offset px', round(hat_off, 1))
report = {}
for name, adef in man.items():
    picks = []
    rows = []
    areas = [stats(c / name / f"{fr['index']:02d}.png")['area'] for fr in adef['frames'] for c in cands if (c / name / f"{fr['index']:02d}.png").exists()]
    if not areas: continue
    med = float(np.median(areas))
    (out_root / name).mkdir(parents=True, exist_ok=True)
    for fr in adef['frames']:
        i = fr['index']
        kp = json.load(open(Path(__file__).parent / 'poses_fix' / name / f"{i:02d}.json"))['keypoints']
        upright = kp[0] and kp[8] and kp[0][1] < kp[8][1] - 0.12
        best, best_score, row = None, 1e9, []
        for c in cands:
            p = c / name / f"{i:02d}.png"
            if not p.exists(): continue
            st = stats(p)
            if st is None: continue
            sc = 0.0
            if upright:
                exp_top = canvas_y(kp[0][1]) + hat_off
                over = exp_top - st['top']          # >0 = silhouette rises above where the hat should end
                sc += max(0, over - 25) * 4 + abs(st['top'] - exp_top) * 0.3
            sc += abs(st['area'] - med) / med * 120
            sc += (st['blobs'] - 1) * 30
            row.append((p, sc))
            if sc < best_score: best, best_score = p, sc
        shutil.copy(best, out_root / name / f"{i:02d}.png")
        picks.append({'frame': i, 'pick': str(best.parent.parent.name), 'score': round(best_score, 1)})
        rows.append((row, best))
    report[name] = picks
    # review sheet: one row per candidate root, pick outlined
    th = 192
    sheet = Image.new('RGB', (th * len(rows), th * len(cands)), (60, 64, 72)); d = ImageDraw.Draw(sheet)
    for x, (row, best) in enumerate(rows):
        for y, (p, sc) in enumerate(row):
            im = Image.open(p).convert('RGBA').resize((th, th)); sheet.paste(im, (x * th, y * th), im)
            if p == best: d.rectangle([x * th + 1, y * th + 1, x * th + th - 2, y * th + th - 2], outline=(255, 210, 80), width=3)
            d.text((x * th + 4, y * th + 4), f"{sc:.0f}", fill=(255, 255, 255))
    sheet.save(out_root / name / 'review.png')
json.dump(report, open(out_root / 'picks.json', 'w'), indent=1)
print('done', len(report), 'anims')
