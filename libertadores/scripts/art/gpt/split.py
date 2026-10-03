import numpy as np, json, os
from PIL import Image, ImageDraw
EXP = {'idle':7,'walk_fwd':5,'walk_back':4,'crouch':4,'jump':3,'atk_sable':4,'estocada':3,'ascendente':4,'vendaval':4,'carga':4,'agarre':4,'dano_caida':7,'victoria':5}
os.makedirs('frames', exist_ok=True)
meta = {}
for name, n in EXP.items():
    im = Image.open(f'reg_{name}.png').convert('RGBA')
    A = np.asarray(im.getchannel('A')).astype(float)
    col = (A > 60).sum(0)
    on = col > 2
    segs = []; i = 0; W = len(col)
    while i < W:
        if on[i]:
            j = i
            while j < W and on[j]: j += 1
            segs.append([i, j]); i = j
        else: i += 1
    segs = [s for s in segs if (A[:, s[0]:s[1]] > 60).sum() > 400] or segs
    # merge tiny segments into neighbours
    changed = True
    while changed and len(segs) > 1:
        changed = False
        widths = [s[1]-s[0] for s in segs]
        k = int(np.argmin(widths))
        if widths[k] < 40:
            if k == 0: segs[1][0] = segs[0][0]; segs.pop(0)
            elif k == len(segs)-1: segs[-2][1] = segs[-1][1]; segs.pop()
            else:
                gl = segs[k][0]-segs[k-1][1]; gr = segs[k+1][0]-segs[k][1]
                if gl <= gr: segs[k-1][1] = segs[k][1]
                else: segs[k+1][0] = segs[k][0]
                segs.pop(k)
            changed = True
    # low-mass segments (detached blade tips) belong to the figure on their LEFT (attacks point right)
    mass = [float((A[:, a:b] > 60).sum()) for a, b in segs]
    med = float(np.median(mass)) if mass else 0
    k = 1
    while k < len(segs):
        if mass[k] < 0.25 * med:
            segs[k-1][1] = segs[k][1]; segs.pop(k); mass[k-1] += mass.pop(k)
        else: k += 1
    while len(segs) > n:   # merge the closest pair
        gaps = [segs[k+1][0]-segs[k][1] for k in range(len(segs)-1)]
        k = int(np.argmin(gaps)); segs[k][1] = segs[k+1][1]; segs.pop(k+1)
    while len(segs) < n:   # split widest at its lowest valley (middle 60%)
        k = int(np.argmax([s[1]-s[0] for s in segs])); s0, s1 = segs[k]
        lo, hi = s0 + int((s1-s0)*0.2), s0 + int((s1-s0)*0.8)
        cut = lo + int(np.argmin(col[lo:hi]))
        segs[k] = [s0, cut]; segs.insert(k+1, [cut, s1])
    # --- blob ownership: small detached pieces (blade tips, effect bits) belong to the body whose right edge is
    # closest on their LEFT (everything points right); compute on a 2x-downsampled mask
    M = (A > 60)[::2, ::2]
    lab = np.zeros(M.shape, np.int32); comps = []
    for y0, x0 in zip(*np.nonzero(M)):
        if lab[y0, x0]: continue
        cid = len(comps) + 1; st = [(y0, x0)]; lab[y0, x0] = cid; pts = []
        while st:
            y, x = st.pop(); pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < M.shape[0] and 0 <= nx < M.shape[1] and M[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = cid; st.append((ny, nx))
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        comps.append({'id': cid, 'n': len(pts), 'x0': min(xs) * 2, 'x1': max(xs) * 2})
    owner_mask = np.zeros(A.shape, np.int32) - 1
    bodies = []
    for si, (s0, s1) in enumerate(segs):
        inside = [c for c in comps if (c['x0'] + c['x1']) / 2 >= s0 and (c['x0'] + c['x1']) / 2 < s1]
        big = max(inside, key=lambda c: c['n']) if inside else None
        bodies.append(big)
    segs_orig = [list(x) for x in segs]
    for c in comps:
        if any(b is not None and b['id'] == c['id'] for b in bodies):
            si = [i for i, b in enumerate(bodies) if b is not None and b['id'] == c['id']][0]
        else:
            left = [(c['x0'] - b['x1'], i) for i, b in enumerate(bodies) if b is not None and b['x1'] <= c['x0'] + 40 + (c['x1'] - c['x0'])]
            overl = [i for i, b in enumerate(bodies) if b is not None and b['x0'] <= (c['x0'] + c['x1']) / 2 <= b['x1']]
            if overl: si = overl[0]
            elif left: si = min(left)[1]
            else: si = int(np.argmin([abs((c['x0'] + c['x1']) / 2 - (s0 + s1) / 2) for s0, s1 in segs]))
        up = np.kron((lab == c['id']).astype(np.uint8), np.ones((2, 2), np.uint8))[:A.shape[0], :A.shape[1]].astype(bool)
        owners = [i for i, b in enumerate(bodies) if b is not None and b['id'] == c['id']]
        if len(owners) > 1 or (c['n'] > 0.5 * max(b['n'] for b in bodies if b) and c['x1'] - c['x0'] > 1.6 * np.median([s1 - s0 for s0, s1 in segs])):
            # one blob spanning several figures (joined by an effect): split it by the column segments
            for i, (s0, s1) in enumerate(segs):
                part = up.copy(); part[:, :s0] = False; part[:, s1:] = False
                owner_mask[part] = i
        else:
            owner_mask[up] = si
    meta[name] = []
    for fi, (s0, s1) in enumerate(segs):
        own = owner_mask == fi
        cols = np.nonzero(own.any(0))[0]
        if len(cols): s0, s1 = int(cols.min()), int(cols.max()) + 1
        keep = own[:, s0:s1]
        sub = A[:, s0:s1] > 60
        rows = np.nonzero(sub.any(1))[0]
        y0, y1 = int(rows.min()), int(rows.max())+1
        fr = im.crop((s0, y0, s1, y1))
        km = keep[y0:y1]
        arr = np.asarray(fr).copy(); arr[..., 3] = np.where(np.kron(np.ones((1,1)), km).astype(bool) | (arr[..., 3] <= 60) & False, arr[..., 3], 0)
        # soften: keep low-alpha fringe pixels adjacent to owned pixels
        fr = Image.fromarray(arr)
        a = np.asarray(fr.getchannel('A')) > 60
        h = a.shape[0]; bot = a[int(h*0.88):]
        xs = np.nonzero(bot.any(0))[0]
        footx = float((xs.min()+xs.max())/2) if len(xs) else fr.width/2
        fr.save(f'frames/{name}_{fi:02d}.png')
        meta[name].append({'w': fr.width, 'h': fr.height, 'footx': footx})
    print(name, len(segs), [m['h'] for m in meta[name]])
json.dump(meta, open('frames/meta.json','w'), indent=1)
# contact sheet
rows = []
for name in EXP:
    fs = [Image.open(f'frames/{name}_{i:02d}.png') for i in range(len(meta[name]))]
    H = 200; row = Image.new('RGB', (sum(int(f.width*H/max(f.height,1))+10 for f in fs)+150, H+10), (0,170,0))
    d = ImageDraw.Draw(row); d.text((5,5), name, fill=(255,255,255)); x = 150
    for f in fs:
        g = f.resize((int(f.width*H/f.height), H)); row.paste(g, (x, 5), g); d.line([(x,0),(x,H+10)], fill=(255,0,0)); x += g.width+10
    rows.append(row)
W = max(r.width for r in rows); out = Image.new('RGB', (W, sum(r.height for r in rows)), (0,0,0)); y = 0
for r in rows: out.paste(r, (0, y)); y += r.height
out.thumbnail((1600, 3000)); out.save('/tmp/claude-0/pt/gpt_frames.png')
