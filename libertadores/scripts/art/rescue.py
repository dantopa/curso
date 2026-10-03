"""Re-matte rejected raw generations with a human-segmentation model (ignores textured floors).
usage: python rescue.py louverture [miranda ...]   -> writes cand_<seed>.png + sheet.png next to rejected_<seed>.png"""
import sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import generate as G

matter = G.get_matter('u2net_human_seg')
for cid in sys.argv[1:]:
    d = Path('/home/user/artwork') / cid
    paths = []
    for raw in sorted(d.glob('rejected_*.png')):
        img = Image.open(raw).convert('RGB')
        cut = G.clean_alpha(matter(img).convert('RGBA'))
        bb = cut.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        ok = bb and bb[1] > 2
        print(cid, raw.name, bb, 'ok' if ok else 'head cut')
        if ok:
            p = d / raw.name.replace('rejected_', 'cand_'); G.place_on_canvas(cut).save(p); paths.append(p)
    if paths: G.contact_sheet(paths, d / 'sheet.png')
