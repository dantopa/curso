import numpy as np, json
from PIL import Image
from rembg import remove, new_session
im = Image.open('sheet.png').convert('RGB')
sess = new_session('isnet-general-use')
# (name, x0, y0, x1, y1) regions below the title bars
R = [('idle',0,32,640,200),('walk_fwd',640,32,1120,200),('walk_back',1120,32,1536,200),
     ('crouch',0,236,340,400),('jump',340,236,700,400),('atk_sable',690,236,1140,400),('estocada',1140,236,1536,400),
     ('ascendente',0,432,435,598),('vendaval',430,432,900,598),('carga',890,432,1536,598),
     ('agarre',0,630,600,790),('dano_caida',600,630,1536,790),('victoria',0,826,710,1024)]
for name,x0,y0,x1,y1 in R:
    c = im.crop((x0,y0,x1,y1)); c2 = c.resize((c.width*2,c.height*2), Image.LANCZOS)
    out = remove(c2, session=sess)
    out.save(f'reg_{name}.png')
    a = np.asarray(out.getchannel('A'))>128
    print(name, round(a.mean(),3))
