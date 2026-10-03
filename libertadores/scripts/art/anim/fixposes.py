"""Copy poses/ -> poses_fix/ lowering the free (left) arm when it is raised near/above the head:
SDXL reads a hand above the head as 'holding a second hat'. Keeps throw (grab) and win/intro (salutes)."""
import json, shutil
from pathlib import Path
src, dst = Path('poses'), Path('poses_fix')
if dst.exists(): shutil.rmtree(dst)
shutil.copytree(src, dst)
KEEP = {'throw', 'win', 'intro'}
n = 0
for f in dst.glob('*/*.json'):
    if f.parent.name in KEEP: continue
    d = json.load(open(f)); k = d['keypoints']
    neck, lsh, lel, lwr = k[1], k[5], k[6], k[7]
    if not (neck and lsh and lwr): continue
    if lwr[1] < neck[1] + 0.06 or (lel and lel[1] < neck[1]):
        # hang the arm slightly behind the body (character faces +x)
        k[6] = [lsh[0] - 0.035, lsh[1] + 0.12]
        k[7] = [lsh[0] - 0.06, lsh[1] + 0.23]
        json.dump(d, open(f, 'w')); n += 1
        png = f.with_suffix('.png')
        if png.exists(): png.unlink()   # JSON is the source of truth; render.py redraws it
print('lowered free arm in', n, 'frames')
