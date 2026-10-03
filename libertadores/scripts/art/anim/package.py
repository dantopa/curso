"""Package rendered San Martin frames into a game anims pack.

Frames come from render.py (1024x1024, rendered with --fixed-ground --fixed-x --ref-skeleton poses/idle/00.json),
so every frame of every animation shares one skeleton->canvas mapping. Each animation was shifted in skeleton space
by `shift_x` (poses/manifest.json) to fit the canvas; we undo that here so the standing root (world x=0.5) always lands
on the anchor and lunges actually travel forward.

usage: python package.py <char_id> <rendered_root> [--scale 0.5]
writes public/assets/fighters/<id>/anims.json + anims/<anim>/NN.webp
"""
import json, sys, argparse
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import render as R

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('char'); ap.add_argument('src')
ap.add_argument('--scale', type=float, default=0.5)
ap.add_argument('--pad', type=int, default=320, help='extra px (full res) on each side for lunges')
a = ap.parse_args()

man = json.load(open(Path(__file__).parent / 'poses' / 'manifest.json'))
anims = man['animations']
_, ref_kps = R.load_pose(str(Path(__file__).parent / 'poses' / 'idle' / '00.json'))
ax0, gy0, H0 = R.skel_metrics(ref_kps)
s = R.CHAR_H / (R.FIG_OVER_NOSE * H0)
ground = gy0 + R.FOOT_OFF * H0
G = R.GEN
W_full = R.CANVAS + 2 * a.pad
k = a.scale
out_dir = ROOT / 'public' / 'assets' / 'fighters' / a.char
(out_dir / 'anims').mkdir(parents=True, exist_ok=True)
pack = {'canvas': [round(W_full * k), round(R.CANVAS * k)], 'anchor': [round((R.CENTER_X + a.pad) * k), round(R.GROUND_Y * k)],
        'standHeight': round(R.CHAR_H * k), 'anims': {}}
for name, adef in anims.items():
    src = Path(a.src) / name
    if not src.exists():
        print('skip (not rendered)', name); continue
    dx = -adef.get('shift_x', 0.0) * G * s           # undo the per-animation skeleton shift
    frames, durs, phases, tips = [], [], [], []
    (out_dir / 'anims' / name).mkdir(parents=True, exist_ok=True)
    ok = True
    for fr in adef['frames']:
        idx = fr['index']; p = src / f'{idx:02d}.png'
        if not p.exists():
            print('missing frame', name, idx); ok = False; break
        im = Image.open(p).convert('RGBA')
        canvas = Image.new('RGBA', (W_full, R.CANVAS), (0, 0, 0, 0))
        canvas.alpha_composite(im, (int(round(a.pad + dx)), 0)) if a.pad + dx >= 0 else canvas.paste(im.crop((int(-(a.pad + dx)), 0, im.width, im.height)), (0, 0))
        canvas = canvas.resize(pack['canvas'], Image.LANCZOS)
        rel = f'anims/{name}/{idx:02d}.webp'
        canvas.save(out_dir / rel, 'WEBP', quality=88, method=6)
        frames.append(rel); durs.append(int(fr['ticks'])); phases.append(fr.get('phase'))
        t = fr.get('sword_tip')
        if t:
            px = (R.CENTER_X + (t[0] * G - ax0) * s + dx + a.pad) * k
            py = (R.GROUND_Y + (t[1] * G - ground) * s) * k
            tips.append([round(px, 1), round(py, 1)])
        else:
            tips.append(None)
    if not ok: continue
    d = {'frames': frames, 'durations': durs, 'loop': bool(adef.get('loop'))}
    if any(phases): d['phases'] = phases
    if all(t is not None for t in tips): d['swordTip'] = tips
    pack['anims'][name] = d
    print('packed', name, len(frames))
json.dump(pack, open(out_dir / 'anims.json', 'w'), indent=1)
print('wrote', out_dir / 'anims.json', 'anims:', len(pack['anims']))
