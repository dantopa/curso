"""Build San Martin's anims pack from the ChatGPT animation sheet frames (frames/*.png from split.py)."""
import json, shutil
from pathlib import Path
from PIL import Image
import numpy as np
meta = json.load(open('frames/meta.json'))
DST = Path('/home/user/curso/libertadores/public/assets/fighters/sanmartin')
if (DST / 'anims').exists(): shutil.rmtree(DST / 'anims')
(DST / 'anims').mkdir(parents=True)
CW, CH, AX, AY = 1000, 440, 500, 430
idle_h = float(np.median([m['h'] for m in meta['idle']]))
S, A, R = 'startup', 'active', 'recovery'
# clip -> list of (region, frame, ticks, phase)
CLIPS = {
 'idle':        ([('idle', i, 8, None) for i in range(7)], True),
 'walk_fwd':    ([('walk_fwd', i, 7, None) for i in range(5)], True),
 'walk_back':   ([('walk_back', i, 8, None) for i in range(4)], True),
 'crouch':      ([('crouch', 0, 3, None), ('crouch', 1, 3, None), ('crouch', 2, 4, None)], False),
 'crouch_block':([('crouch', 2, 6, None)], False),
 'block':       ([('atk_sable', 0, 6, None)], False),
 'jump':        ([('jump', i, 6, None) for i in range(3)], False),
 'light':       ([('estocada', 0, 4, S), ('estocada', 1, 5, A), ('estocada', 2, 8, R)], False),
 'heavy':       ([('atk_sable', 0, 6, S), ('atk_sable', 1, 4, A), ('atk_sable', 2, 4, A), ('atk_sable', 3, 10, R)], False),
 'crouch_heavy':([('ascendente', 0, 5, S), ('ascendente', 1, 5, S), ('ascendente', 2, 4, A), ('ascendente', 3, 10, R)], False),
 'special_cast':([('vendaval', 0, 8, S), ('vendaval', 1, 6, A), ('vendaval', 2, 6, A), ('vendaval', 3, 8, R)], False),
 'rush':        ([('carga', 0, 6, S), ('carga', 1, 6, A), ('carga', 2, 6, A), ('carga', 3, 8, R)], False),
 'counter':     ([('atk_sable', 0, 6, S), ('estocada', 1, 6, A), ('estocada', 2, 8, R)], False),
 'hit_high':    ([('dano_caida', 0, 5, None), ('dano_caida', 1, 8, None)], False),
 'knockdown':   ([('dano_caida', 1, 4, None), ('dano_caida', 4, 8, None), ('dano_caida', 5, 8, None), ('dano_caida', 6, 12, None)], False),
 'getup':       ([('dano_caida', 3, 8, None), ('dano_caida', 2, 8, None)], False),
 'dazed':       ([('dano_caida', 2, 30, None)], True),
 'dead':        ([('dano_caida', 6, 60, None)], False),
 'win':         ([('victoria', i, 10, None) for i in range(5)], False),
}
pack = {'canvas': [CW, CH], 'anchor': [AX, AY], 'standHeight': round(idle_h), 'anims': {}}
cache = {}
for clip, (frames, loop) in CLIPS.items():
    (DST / 'anims' / clip).mkdir(parents=True, exist_ok=True)
    files, durs, phases = [], [], []
    for k, (reg, i, ticks, ph) in enumerate(frames):
        m = meta[reg][i]
        fr = Image.open(f'frames/{reg}_{i:02d}.png').convert('RGBA')
        lying = m['h'] < 0.62 * idle_h and m['w'] > m['h']
        ax = m['w'] / 2 if lying else m['footx']
        can = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        x, y = int(round(AX - ax)), AY - fr.height
        if y < 0: fr = fr.crop((0, -y, fr.width, fr.height)); y = 0
        can.alpha_composite(fr, (max(0, x), y)) if x >= 0 else can.alpha_composite(fr.crop((-x, 0, fr.width, fr.height)), (0, y))
        rel = f'anims/{clip}/{k:02d}.webp'
        can.save(DST / rel, 'WEBP', quality=90, method=6)
        files.append(rel); durs.append(ticks); phases.append(ph)
    d = {'frames': files, 'durations': durs, 'loop': loop}
    if any(phases): d['phases'] = phases
    pack['anims'][clip] = d
json.dump(pack, open(DST / 'anims.json', 'w'), indent=1)
# keep the static fallback consistent with the new style: idle.png = first idle frame on the legacy 768x1024 canvas
fr = Image.open('frames/idle_00.png').convert('RGBA')
sc = 980 / fr.height; fr = fr.resize((int(fr.width * sc), 980), Image.LANCZOS)
can = Image.new('RGBA', (768, 1024), (0, 0, 0, 0)); can.alpha_composite(fr, ((768 - fr.width) // 2, 1024 - 980))
can.save(DST / 'idle.png')
print('clips', len(pack['anims']), 'standHeight', pack['standHeight'])
