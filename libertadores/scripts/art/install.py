"""Install chosen candidates as in-game sprites.

usage: python install.py bolivar:1010 belgrano:1007:flip [--src /home/user/artwork]
Writes public/assets/fighters/<id>/idle.png (768x1024, facing right, feet on bottom edge),
applies a light grade to match the game's dark mood and a thin dark outline, then run `npm run art:manifest`.
"""
import sys, argparse
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('picks', nargs='+', help='id:seed[:flip]')
ap.add_argument('--src', default='/home/user/artwork')
ap.add_argument('--pose', default='idle')
a = ap.parse_args()
for pick in a.picks:
    parts = pick.split(':')
    cid, seed, flip = parts[0], parts[1], len(parts) > 2 and parts[2] == 'flip'
    im = Image.open(f'{a.src}/{cid}/cand_{seed}.png').convert('RGBA')
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    rgb, alpha = im.convert('RGB'), im.getchannel('A')
    rgb = ImageEnhance.Color(rgb).enhance(0.9)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.1)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.92)
    body = Image.merge('RGBA', (*rgb.split(), alpha))
    # thin dark outline for readability against busy stages
    ring = alpha.filter(ImageFilter.MaxFilter(5))
    outline = Image.new('RGBA', im.size, (12, 8, 6, 0)); outline.putalpha(ring.point(lambda v: int(v * 0.85)))
    out = Image.alpha_composite(outline, body)
    dst = ROOT / 'public' / 'assets' / 'fighters' / cid
    dst.mkdir(parents=True, exist_ok=True)
    out.save(dst / f'{a.pose}.png', optimize=True)
    print('installed', cid, a.pose, 'from', seed, '(flipped)' if flip else '')
