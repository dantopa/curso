#!/usr/bin/env python3
"""José de San Martín - fighting-game skeleton animations (OpenPose BODY-18).

Poses are authored with joint ANGLES / foot targets and built through forward
kinematics with FIXED bone lengths (see L), so limbs never stretch.

Space: square, x,y in 0..1, y down, ground y=0.977, character faces RIGHT (+x),
3/4 profile: the near (viewer) side is the RIGHT side of the character (sabre arm).
Angle convention for limbs and sword: degrees measured from "straight down",
positive towards +x (forward):  0=down  90=forward  180=up  -90=backward.
Spine/head 'lean' is measured from straight UP, positive = leaning forward.

usage:  python3 skeletons.py            # build everything (poses/ + previews)
        python3 skeletons.py walk_fwd   # only some animations
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
POSES = os.path.join(HERE, "poses")
PREV = "/tmp/claude-0/pt/skel"
G = 0.977                                   # ground line
L = dict(spine=0.26, head=0.075, ua=0.13, fa=0.12, th=0.20, sh=0.19, blade=0.28, ankle=0.03)
NAMES = ["nose", "neck", "r_shoulder", "r_elbow", "r_wrist", "l_shoulder", "l_elbow", "l_wrist",
         "r_hip", "r_knee", "r_ankle", "l_hip", "l_knee", "l_ankle", "r_eye", "l_eye", "r_ear", "l_ear"]

# ----------------------------------------------------------------------------- kinematics
def dwn(a):                                  # limb direction, angle from straight-down, + = forward
    r = math.radians(a); return np.array([math.sin(r), math.cos(r)])
def upv(l):                                  # direction from straight-up, + = forward (clockwise on screen)
    r = math.radians(l); return np.array([math.sin(r), -math.cos(r)])
def rot(v, deg):                             # rotate clockwise on screen
    r = math.radians(deg); c, s = math.cos(r), math.sin(r)
    return np.array([v[0] * c - v[1] * s, v[0] * s + v[1] * c])

def ik2(a, t, l1, l2, bend=1):
    v = np.array(t, float) - a
    dist = float(np.linalg.norm(v))
    u = v / dist if dist > 1e-9 else np.array([0, 1.0])
    dist = max(min(dist, l1 + l2 - 1e-4), abs(l1 - l2) + 1e-4)
    ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    A = math.acos(max(-1, min(1, ca)))
    k1 = a + rot(u, math.degrees(A)) * l1
    k2 = a + rot(u, -math.degrees(A)) * l1
    k = k1 if ((k1[0] > k2[0]) == (bend > 0)) else k2
    return k, a + u * dist

BASE = dict(cx=0.5, hx=-0.005, hh=0.385, lean=6, hd=None, yaw=0.75, tw=0.5, ht=0.5,
            ra=(25, 80), la=(10, 105), rf=(0.09, 0.0), lf=(-0.09, 0.0), rk=1, lk=1,
            sw=125, sc=14, sl=1.0, coat=-22, up=0.0, hy=None)

MARGIN = dict(ankle=0.03, knee=0.035, hip=0.04, sh=0.04, neck=0.04, head=0.06, wrist=0.02, elbow=0.03)

def build(p):
    p = {**BASE, **p}
    cx = p["cx"]
    lean = p["lean"]
    hd = p["hd"] if p["hd"] is not None else lean * 0.45
    hipx = cx + p["hx"]
    auto = False
    if p["hy"] is not None: hy = p["hy"]
    elif p["hh"] is not None: hy = G - p["hh"]
    else: hy = 0.0; auto = True
    H = np.array([hipx, hy])
    s = upv(lean); f = np.array([-s[1], s[0]])
    neck = H + s * L["spine"]
    base = neck - s * 0.02
    rsh = base - f * 0.055 * p["tw"]; lsh = base + f * 0.055 * p["tw"]
    rh = H - f * 0.035 * p["ht"]; lh = H + f * 0.035 * p["ht"]
    # head
    hc = neck + upv(hd) * L["head"]
    yaw = p["yaw"]
    ax = abs(yaw)
    ns = 0.048 * yaw
    sp = 0.04 - 0.014 * ax
    es = 0.052 * (1 - 0.8 * ax)
    cs = -0.012 * yaw
    def hp(dx, dy): return hc + rot(np.array([dx, dy]), hd)
    nose = hp(ns, 0.012)
    reye = hp(ns * 0.5 - sp / 2, -0.017); leye = hp(ns * 0.5 + sp / 2, -0.017)
    rear = hp(cs - es, -0.004); lear = hp(cs + es, -0.004)
    # arms
    def arm(sh, a):
        e = sh + dwn(a[0]) * L["ua"]; w = e + dwn(a[1]) * L["fa"]; return e, w
    re, rw = arm(rsh, p["ra"]); le, lw = arm(lsh, p["la"])
    # legs
    def leg(hip, ik, ang, bend, lift_ok=True):
        if ik is not None:
            tgt = np.array([cx + ik[0], G - L["ankle"] - ik[1]])
            return ik2(hip, tgt, L["th"], L["sh"], bend)
        k = hip + dwn(ang[0]) * L["th"]; a = k + dwn(ang[1]) * L["sh"]; return k, a
    rl = p.get("rl"); ll = p.get("ll")
    rk_, ra_ = leg(rh, None if rl else p["rf"], rl, p["rk"])
    lk_, la_ = leg(lh, None if ll else p["lf"], ll, p["lk"])
    pts = dict(nose=nose, neck=neck, r_shoulder=rsh, r_elbow=re, r_wrist=rw, l_shoulder=lsh, l_elbow=le, l_wrist=lw,
               r_hip=rh, r_knee=rk_, r_ankle=ra_, l_hip=lh, l_knee=lk_, l_ankle=la_,
               r_eye=reye, l_eye=leye, r_ear=rear, l_ear=lear)
    # sword (hilt at right wrist, curved blade)
    sw = [rw.copy()]; pos = rw.copy(); ang = p["sw"] - p["sc"] / 2; n = 10
    step = L["blade"] * p["sl"] / n
    for i in range(n):
        pos = pos + dwn(ang) * step; sw.append(pos.copy()); ang += p["sc"] / n
    pommel = rw - dwn(p["sw"] - p["sc"] / 2) * 0.03
    out = dict(pts=pts, sword=sw, pommel=pommel, head_c=hc, hip_c=H, coat=p["coat"], hd=hd, yaw=yaw, p=p)
    # ground / lift
    dy = 0.0
    if auto:
        m = [pts["r_ankle"][1] + MARGIN["ankle"], pts["l_ankle"][1] + MARGIN["ankle"], rk_[1] + MARGIN["knee"], lk_[1] + MARGIN["knee"],
             H[1] + MARGIN["hip"], neck[1] + MARGIN["neck"], hc[1] + MARGIN["head"], rw[1] + MARGIN["wrist"], lw[1] + MARGIN["wrist"],
             re[1] + MARGIN["elbow"], le[1] + MARGIN["elbow"], rsh[1] + MARGIN["sh"], lsh[1] + MARGIN["sh"]]
        dy = G - max(m)
    dy -= p["up"]
    if dy:
        for k in out["pts"]: out["pts"][k] = out["pts"][k] + [0, dy]
        out["sword"] = [q + [0, dy] for q in out["sword"]]
        out["pommel"] = out["pommel"] + [0, dy]; out["head_c"] = hc + [0, dy]; out["hip_c"] = H + [0, dy]
    return out

# ----------------------------------------------------------------------------- animation helpers
def S(**kw): return {**BASE, **kw}
def fr(ticks, phase=None, tag=None, **kw): return (S(**kw), ticks, phase, tag)

def smooth(t): return t * t * (3 - 2 * t)

def foot_cycle(u, stride, lift=0.055, stance=0.55):
    u = u % 1.0
    if u < stance: return (stride - 2 * stride * (u / stance), 0.0)
    t = (u - stance) / (1 - stance)
    return (-stride + 2 * stride * smooth(t), lift * math.sin(math.pi * t))

ANIMS = {}

# ---- idle: breathing, sabre low guard
def _idle():
    fs = []
    for k in range(6):
        t = k / 6.0; b = math.sin(2 * math.pi * t); b2 = math.sin(2 * math.pi * t + 1.1)
        fs.append(fr(10, None, hh=0.385 + 0.007 * b, hx=-0.005 + 0.004 * b2, lean=6 + 1.5 * b, hd=8 + 1.2 * b2,
                     ra=(25 + 2.5 * b, 80 - 3 * b), la=(10 + 3 * b2, 105 + 3 * b), sw=125 + 4 * b2, coat=-22 + 4 * b2))
    return dict(loop=True, frames=fs)
ANIMS["idle"] = _idle()

# ---- walks
def _walk(fwd=True):
    fs = []
    for k in range(8):
        u = (k / 8.0) if fwd else (-k / 8.0)
        S_ = 0.11 if fwd else 0.085
        rf = foot_cycle(u, S_, 0.06 if fwd else 0.045)
        lf = foot_cycle(u + 0.5, S_, 0.06 if fwd else 0.045)
        bob = -0.011 * math.cos(4 * math.pi * u)
        sg = math.sin(2 * math.pi * u)
        if fwd:
            fs.append(fr(6, None, hh=0.385 + bob, hx=0.0, lean=9 + 1 * bob * 50, hd=10, rf=rf, lf=lf,
                         ra=(26 + 5 * sg, 80 + 4 * bob * 30), la=(12 - 14 * sg, 108 - 10 * sg), sw=124 + 5 * sg, coat=-30 + 6 * sg))
        else:
            fs.append(fr(7, None, hh=0.39 + bob, hx=-0.015, lean=0 - 0.5 * bob * 50, hd=3, rf=rf, lf=lf,
                         ra=(32 - 3 * sg, 105 - 3 * sg), la=(18 + 8 * sg, 118 + 4 * sg), sw=152 + 3 * sg, coat=-10 + 5 * sg, yaw=0.8))
    return dict(loop=True, frames=fs)
ANIMS["walk_fwd"] = _walk(True)
ANIMS["walk_back"] = _walk(False)

# ---- crouch
ANIMS["crouch"] = dict(loop=False, frames=[
    fr(4, None, hh=0.29, hx=-0.02, lean=14, hd=14, rf=(0.10, 0), lf=(-0.09, 0), ra=(30, 85), la=(15, 108), sw=118, coat=-20),
    fr(4, None, hh=0.215, hx=-0.045, lean=22, hd=18, rf=(0.125, 0), lf=(-0.10, 0), ra=(38, 84), la=(22, 104), sw=108, coat=-12),
])

# ---- jump
ANIMS["jump"] = dict(loop=False, frames=[
    fr(4, None, hh=0.27, hx=-0.04, lean=22, hd=15, rf=(0.09, 0), lf=(-0.09, 0), ra=(-35, -10), la=(-42, -18), sw=-22, sc=14, coat=-10),
    fr(5, None, hh=0.46, hx=0.0, lean=6, hd=4, rf=(0.10, 0.14), lf=(-0.03, 0.12), ra=(70, 100), la=(55, 110), sw=115, sc=12, coat=-5),
    fr(5, None, hh=0.52, hx=0.0, lean=2, hd=0, rf=(0.11, 0.22), lf=(-0.05, 0.19), ra=(90, 115), la=(95, 120), sw=120, sc=12, coat=8),
    fr(5, None, hh=0.47, hx=0.0, lean=3, hd=2, rf=(0.09, 0.07), lf=(-0.07, 0.04), ra=(100, 125), la=(95, 120), sw=130, sc=12, coat=20),
])

# ---- light: quick estocada
ANIMS["light"] = dict(loop=False, frames=[
    fr(4, "startup", hh=0.36, hx=-0.03, lean=2, hd=4, tw=0.6, rf=(0.07, 0), lf=(-0.12, 0), ra=(-40, 85), la=(40, 140), sw=92, sc=12, coat=-20),
    fr(3, "active", cx=0.52, hh=0.34, hx=0.02, lean=18, hd=14, tw=0.5, rf=(0.15, 0), lf=(-0.13, 0), ra=(82, 88), la=(-100, -140), sw=90, sc=12, coat=-45),
    fr(4, "active", cx=0.55, hh=0.30, hx=0.04, lean=26, hd=20, tw=0.45, rf=(0.22, 0), lf=(-0.17, 0), ra=(88, 90), la=(-110, -150), sw=90, sc=12, coat=-65),
    fr(5, "recovery", cx=0.53, hh=0.34, hx=0.02, lean=14, hd=10, rf=(0.18, 0), lf=(-0.14, 0), ra=(60, 85), la=(-50, -90), sw=100, sc=14, coat=-40),
    fr(5, "recovery", cx=0.5, hh=0.37, hx=0.0, lean=8, hd=8, rf=(0.11, 0), lf=(-0.10, 0), ra=(35, 85), la=(10, 110), sw=118, coat=-25),
])

# ---- heavy: big overhead diagonal slash
ANIMS["heavy"] = dict(loop=False, frames=[
    fr(8, "startup", hh=0.37, hx=-0.03, lean=0, hd=4, rf=(0.08, 0), lf=(-0.11, 0), ra=(110, 190), la=(40, 100), sw=250, sc=-14, coat=-15),
    fr(8, "startup", hh=0.355, hx=-0.06, lean=-12, hd=-6, tw=0.55, rf=(0.06, 0.02), lf=(-0.13, 0), ra=(125, 215), la=(75, 120), sw=268, sc=-14, coat=-5),
    fr(4, "active", cx=0.52, hh=0.33, hx=0.0, lean=20, hd=16, rf=(0.17, 0), lf=(-0.13, 0), ra=(115, 100), la=(-50, -100), sw=72, sc=14, coat=-55),
    fr(5, "active", cx=0.55, hh=0.30, hx=0.04, lean=34, hd=26, rf=(0.22, 0), lf=(-0.16, 0), ra=(55, 42), la=(-70, -120), sw=18, sc=14, coat=-70),
    fr(6, "recovery", cx=0.55, hh=0.30, hx=0.04, lean=32, hd=24, rf=(0.22, 0), lf=(-0.16, 0), ra=(50, 40), la=(-60, -100), sw=15, sc=14, coat=-50),
    fr(6, "recovery", cx=0.53, hh=0.34, hx=0.02, lean=20, hd=14, rf=(0.17, 0), lf=(-0.13, 0), ra=(45, 70), la=(-20, -60), sw=60, sc=14, coat=-35),
    fr(6, "recovery", cx=0.5, hh=0.37, hx=0.0, lean=9, hd=8, rf=(0.11, 0), lf=(-0.10, 0), ra=(32, 82), la=(10, 108), sw=118, coat=-24),
])

# ---- crouch_light: low sweep at the shins
_C = dict(hh=0.215, hx=-0.035, rf=(0.115, 0), lf=(-0.10, 0))
ANIMS["crouch_light"] = dict(loop=False, frames=[
    fr(4, "startup", **{**_C, "lean": 24, "hd": 16, "tw": 0.8, "ra": (-45, -20), "la": (30, 100), "sw": -140, "sc": -10, "coat": -10}),
    fr(3, "active", **{**_C, "lean": 36, "hd": 24, "tw": 0.5, "ra": (62, 55), "la": (-30, -70), "sw": 42, "sc": 12, "coat": -25}),
    fr(4, "active", **{**_C, "cx": 0.51, "lean": 40, "hd": 28, "ra": (78, 70), "la": (-40, -80), "sw": 75, "sc": 14, "coat": -35}),
    fr(6, "recovery", **{**_C, "lean": 26, "hd": 18, "ra": (45, 80), "la": (20, 100), "sw": 105, "coat": -15}),
])

# ---- crouch_heavy: rising uppercut slash (launcher)
ANIMS["crouch_heavy"] = dict(loop=False, frames=[
    fr(6, "startup", hh=0.20, hx=-0.055, lean=28, hd=15, tw=0.7, rf=(0.12, 0), lf=(-0.11, 0), ra=(-12, 15), la=(25, 100), sw=-85, sc=-12, sl=0.8, coat=-8),
    fr(5, "startup", hh=0.20, hx=-0.05, lean=32, hd=18, tw=0.85, rf=(0.12, 0), lf=(-0.11, 0), ra=(18, 38), la=(15, 80), sw=40, sc=-12, coat=-12),
    fr(4, "active", hh=0.27, hx=0.0, lean=12, hd=8, rf=(0.14, 0), lf=(-0.10, 0), ra=(78, 98), la=(-30, -60), sw=120, sc=14, coat=-30),
    fr(5, "active", cx=0.51, hh=0.36, hx=0.01, lean=5, hd=0, rf=(0.13, 0), lf=(-0.10, 0.015), ra=(120, 130), la=(-45, -35), sw=130, sc=14, coat=-40),
    fr(8, "recovery", cx=0.5, hh=0.37, hx=0.0, lean=3, hd=2, rf=(0.11, 0), lf=(-0.10, 0), ra=(100, 120), la=(0, 60), sw=135, sc=14, coat=-25),
])

# ---- air_attack: diving slash
ANIMS["air_attack"] = dict(loop=False, frames=[
    fr(5, "startup", hh=0.50, hx=0.0, lean=0, hd=-2, rf=(0.10, 0.24), lf=(-0.05, 0.21), ra=(120, 200), la=(100, 130), sw=255, sc=-14, coat=0),
    fr(6, "active", hh=0.50, hx=0.04, lean=34, hd=26, rf=(0.15, 0.15), lf=(-0.09, 0.26), ra=(102, 75), la=(-40, -80), sw=40, sc=14, coat=-60),
    fr(8, "active", hh=0.45, hx=0.05, lean=40, hd=30, rf=(0.17, 0.06), lf=(-0.07, 0.14), ra=(62, 32), la=(-50, -90), sw=8, sc=14, coat=-70),
])

# ---- block / crouch_block
ANIMS["block"] = dict(loop=False, frames=[
    fr(3, None, hh=0.375, hx=-0.015, lean=5, hd=6, rf=(0.09, 0), lf=(-0.10, 0), ra=(42, 148), la=(25, 135), sw=177, sc=-10, coat=-18),
    fr(6, None, hh=0.35, hx=-0.035, lean=11, hd=10, tw=0.6, rf=(0.10, 0), lf=(-0.12, 0), ra=(48, 155), la=(32, 140), sw=172, sc=-10, coat=-14),
])
ANIMS["crouch_block"] = dict(loop=False, frames=[
    fr(3, None, hh=0.29, hx=-0.03, lean=14, hd=12, rf=(0.10, 0), lf=(-0.09, 0), ra=(48, 95), la=(25, 110), sw=40, sc=8, coat=-18),
    fr(6, None, hh=0.215, hx=-0.045, lean=22, hd=16, rf=(0.125, 0), lf=(-0.10, 0), ra=(52, 68), la=(30, 90), sw=2, sc=6, coat=-12),
])

# ---- hit reactions
ANIMS["hit_high"] = dict(loop=False, frames=[
    fr(4, None, hh=0.39, hx=-0.03, lean=-8, hd=-24, yaw=0.6, rf=(0.09, 0), lf=(-0.10, 0), ra=(12, 32), la=(75, 112), sw=70, sc=14, coat=-10),
    fr(5, None, hh=0.395, hx=-0.06, lean=-16, hd=-36, yaw=0.5, rf=(0.075, 0.01), lf=(-0.13, 0), ra=(-12, 18), la=(105, 145), sw=35, sc=14, coat=5),
    fr(6, None, hh=0.39, hx=-0.04, lean=-7, hd=-12, yaw=0.65, rf=(0.085, 0), lf=(-0.12, 0), ra=(15, 55), la=(60, 110), sw=95, sc=14, coat=-12),
])
ANIMS["hit_body"] = dict(loop=False, frames=[
    fr(4, None, hh=0.37, hx=-0.025, lean=24, hd=14, rf=(0.09, 0), lf=(-0.10, 0), ra=(-5, 70), la=(35, 95), sw=100, sc=14, coat=-25),
    fr(5, None, hh=0.315, hx=-0.06, lean=50, hd=36, yaw=0.6, rf=(0.075, 0), lf=(-0.12, 0), ra=(12, 55), la=(32, 78), sw=38, sc=14, coat=-45),
    fr(6, None, hh=0.34, hx=-0.04, lean=34, hd=22, rf=(0.08, 0), lf=(-0.11, 0), ra=(15, 62), la=(30, 90), sw=50, sc=14, coat=-35),
])

# ---- knockdown / getup
_lieleg = dict(rl=(158, 100), ll=(148, 100))          # right knee up, left leg slightly bent along the ground
ANIMS["knockdown"] = dict(loop=False, frames=[
    fr(4, None, cx=0.52, hy=0.50, hx=0.0, hh=None, lean=-26, hd=-38, yaw=0.5, rl=(38, 12), ll=(28, 2), ra=(62, 100), la=(100, 140), sw=108, sc=14, coat=20),
    fr(5, None, cx=0.54, hy=0.48, hx=0.02, hh=None, lean=-58, hd=-66, yaw=0.4, rl=(72, 38), ll=(58, 18), ra=(125, 160), la=(122, 142), sw=115, sc=14, coat=45),
    fr(5, None, cx=0.56, hy=0.52, hx=0.03, hh=None, lean=-82, hd=-92, yaw=0.3, rl=(125, 60), ll=(140, 80), ra=(-115, -150), la=(-100, -130), sw=170, sc=14, sl=0.6, coat=60),
    fr(5, None, cx=0.58, hh=None, hx=0.03, lean=-90, hd=-92, yaw=0.3, rl=(150, 85), ll=(145, 100), ra=(-95, -120), la=(-100, -80), sw=170, sc=14, sl=0.6, up=0.0, coat=80),
    fr(6, None, cx=0.58, hh=None, hx=0.03, lean=-86, hd=-84, yaw=0.3, rl=(155, 95), ll=(150, 105), ra=(-80, -100), la=(-105, -95), sw=170, sc=14, sl=0.6, up=0.04, coat=80),
    fr(8, None, cx=0.58, hh=None, hx=0.03, lean=-90, hd=-92, yaw=0.3, **_lieleg, ra=(-70, -85), la=(-95, -90), sw=170, sc=14, sl=0.6, coat=85),
])
ANIMS["getup"] = dict(loop=False, frames=[
    fr(8, None, cx=0.58, hh=None, hx=0.03, lean=-90, hd=-92, yaw=0.3, **_lieleg, ra=(-70, -85), la=(-95, -90), sw=170, sc=14, sl=0.6, coat=85),
    fr(8, None, cx=0.55, hh=None, hx=0.0, lean=-28, hd=-12, yaw=0.5, rl=(120, 100), ll=(115, 98), ra=(60, 85), la=(-60, -75), sw=80, sc=14, coat=70),
    fr(8, None, cx=0.5, hh=0.23, hx=0.0, lean=18, hd=8, rf=(0.14, 0), rl=None, ll=(8, -86), lf=None, ra=(40, 85), la=(30, 70), sw=105, sc=14, coat=-20),
    fr(8, None, cx=0.5, hh=0.34, hx=-0.01, lean=12, hd=10, rf=(0.10, 0), lf=(-0.10, 0), ra=(30, 85), la=(15, 108), sw=118, sc=14, coat=-22),
])

# ---- special_cast: Sable Corvo (horizontal power slash)
ANIMS["special_cast"] = dict(loop=False, frames=[
    fr(10, "startup", hh=0.36, hx=-0.045, lean=4, hd=6, tw=0.8, rf=(0.08, 0), lf=(-0.12, 0), ra=(-30, -55), la=(75, 100), sw=-170, sc=-12, sl=0.7, coat=-12),
    fr(10, "startup", hh=0.33, hx=-0.07, lean=9, hd=10, tw=0.9, rf=(0.08, 0), lf=(-0.14, 0), ra=(-38, -62), la=(85, 100), sw=-170, sc=-12, sl=0.7, coat=-8),
    fr(4, "startup", cx=0.52, hh=0.33, hx=-0.01, lean=16, hd=14, tw=0.7, rf=(0.15, 0), lf=(-0.13, 0), ra=(45, 70), la=(-30, -60), sw=60, sc=-10, sl=0.45, coat=-40),
    fr(5, "active", cx=0.52, hh=0.31, hx=0.03, lean=22, hd=18, tw=0.45, rf=(0.18, 0), lf=(-0.15, 0), ra=(86, 88), la=(-70, -110), sw=88, sc=-10, coat=-60),
    fr(6, "active", cx=0.54, hh=0.31, hx=0.04, lean=24, hd=20, tw=0.35, rf=(0.20, 0), lf=(-0.15, 0), ra=(112, 112), la=(-90, -130), sw=112, sc=-10, coat=-70),
    fr(8, "recovery", cx=0.52, hh=0.35, hx=0.01, lean=14, hd=10, rf=(0.14, 0), lf=(-0.12, 0), ra=(55, 85), la=(0, 60), sw=100, sc=12, coat=-35),
])

# ---- rush: Carga de Granaderos
ANIMS["rush"] = dict(loop=False, frames=[
    fr(6, "startup", cx=0.47, hh=0.33, hx=-0.03, lean=24, hd=18, rf=(0.10, 0), lf=(-0.11, 0), ra=(55, 85), la=(-80, -100), sw=95, sc=12, coat=-45),
    fr(5, "active", cx=0.50, hh=0.46, hx=0.0, lean=36, hd=28, rf=(0.21, 0.13), lf=(-0.18, 0.05), ra=(82, 90), la=(-95, -125), sw=90, sc=12, coat=-75),
    fr(8, "active", cx=0.52, hh=0.26, hx=0.05, lean=40, hd=30, rf=(0.22, 0), lf=(-0.14, 0), ra=(88, 88), la=(-100, -135), sw=88, sc=12, coat=-80),
    fr(10, "recovery", cx=0.50, hh=0.31, hx=0.03, lean=28, hd=20, rf=(0.20, 0), lf=(-0.12, 0), ra=(65, 85), la=(-60, -100), sw=100, sc=14, coat=-50),
])

# ---- counter: guard / parry / riposte
ANIMS["counter"] = dict(loop=False, frames=[
    fr(10, "startup", hh=0.385, hx=-0.045, lean=-1, hd=2, rf=(0.08, 0), lf=(-0.11, 0), ra=(35, 120), la=(20, 112), sw=152, sc=12, coat=-12),
    fr(6, "active", tag="parry", hh=0.375, hx=-0.03, lean=6, hd=6, tw=0.6, rf=(0.10, 0), lf=(-0.11, 0), ra=(78, 90), la=(40, 140), sw=132, sc=12, coat=-18),
    fr(8, "active", tag="riposte", cx=0.55, hh=0.30, hx=0.04, lean=24, hd=18, tw=0.45, rf=(0.22, 0), lf=(-0.17, 0), ra=(88, 90), la=(-105, -145), sw=90, sc=12, coat=-62),
])

# ---- throw
ANIMS["throw"] = dict(loop=False, frames=[
    fr(6, "startup", hh=0.36, hx=-0.01, lean=12, hd=10, rf=(0.12, 0), lf=(-0.10, 0), ra=(-30, 50), la=(78, 88), sw=-125, sc=12, coat=-30),
    fr(6, "active", tag="grab", cx=0.51, hh=0.35, hx=0.02, lean=22, hd=15, tw=0.8, rf=(0.15, 0), lf=(-0.11, 0), ra=(-35, 40), la=(95, 108), sw=-120, sc=12, coat=-40),
    fr(10, "active", tag="hoist", cx=0.50, hh=0.37, hx=-0.03, lean=-6, hd=-4, tw=0.8, rf=(0.12, 0), lf=(-0.13, 0), ra=(100, 135), la=(140, 160), sw=125, sc=12, coat=-18),
    fr(10, "recovery", tag="slam", cx=0.53, hh=0.33, hx=0.03, lean=40, hd=28, tw=0.6, rf=(0.17, 0), lf=(-0.11, 0), ra=(70, 120), la=(68, 58), sw=140, sc=12, coat=-50),
])

# ---- turn (pivot, ends facing right)
ANIMS["turn"] = dict(loop=False, frames=[
    fr(4, None, hh=0.39, hx=0.0, lean=3, hd=0, yaw=0.3, tw=0.95, ht=0.85, rf=(0.06, 0), lf=(-0.07, 0), ra=(18, 60), la=(6, 70), sw=60, sc=12, coat=-8),
    fr(4, None, hh=0.40, hx=0.0, lean=0, hd=0, yaw=0.0, tw=1.0, ht=1.0, rf=(0.045, 0), lf=(-0.045, 0), ra=(20, 45), la=(-18, 35), sw=30, sc=12, coat=0),
    fr(5, None, hh=0.385, hx=-0.005, lean=5, hd=6, yaw=0.9, tw=0.6, ht=0.6, rf=(0.09, 0), lf=(-0.09, 0), ra=(25, 82), la=(10, 106), sw=124, sc=14, coat=-20),
])

# ---- win: salute and flourish
ANIMS["win"] = dict(loop=False, frames=[
    fr(10, None, hh=0.41, hx=0.0, lean=0, hd=0, rf=(0.06, 0), lf=(-0.07, 0), ra=(5, 18), la=(0, 10), sw=15, sc=10, coat=-8),
    fr(8, None, hh=0.405, hx=0.0, lean=-2, hd=-4, rf=(0.07, 0), lf=(-0.07, 0), ra=(70, 110), la=(-18, 65), sw=135, sc=12, coat=-20),
    fr(8, None, hh=0.41, hx=-0.01, lean=-5, hd=-12, rf=(0.08, 0), lf=(-0.08, 0), ra=(110, 138), la=(-30, 62), sw=135, sc=12, coat=-55),
    fr(10, None, hh=0.405, hx=-0.01, lean=-8, hd=-14, rf=(0.08, 0), lf=(-0.08, 0), ra=(108, 135), la=(-32, 60), sw=138, sc=12, coat=-85),
    fr(10, None, hh=0.41, hx=-0.01, lean=-6, hd=-12, rf=(0.08, 0), lf=(-0.08, 0), ra=(112, 140), la=(-30, 62), sw=130, sc=12, coat=-60),
    fr(12, None, hh=0.41, hx=-0.01, lean=-5, hd=-10, rf=(0.08, 0), lf=(-0.08, 0), ra=(110, 138), la=(-30, 62), sw=140, sc=12, coat=-40),
])

# ---- dazed (kneeling) / dead
_K = dict(cx=0.5, hh=0.23, hx=0.0, rf=(0.14, 0), ll=(8, -86), lf=None)
ANIMS["dazed"] = dict(loop=True, frames=[
    fr(14, None, **{**_K, "lean": 28, "hd": 42, "yaw": 0.6, "ra": (14, 28), "la": (6, 20), "sw": 62, "sc": 14, "coat": -20}),
    fr(14, None, **{**_K, "lean": 36, "hd": 52, "yaw": 0.6, "ra": (18, 24), "la": (10, 16), "sw": 66, "sc": 14, "coat": -26}),
])
ANIMS["dead"] = dict(loop=False, frames=[
    fr(60, None, cx=0.58, hh=None, hx=0.03, lean=-90, hd=-96, yaw=0.3, rl=(158, 100), ll=(150, 100), ra=(-75, -88), la=(-100, -95), sw=170, sc=14, sl=0.6, coat=88),
])

# ---- intro: salute -> en garde
ANIMS["intro"] = dict(loop=False, frames=[
    fr(14, None, hh=0.41, hx=0.0, lean=0, hd=0, yaw=0.8, rf=(0.05, 0), lf=(-0.06, 0), ra=(10, 42), la=(3, 10), sw=172, sc=10, coat=-6),
    fr(16, None, hh=0.41, hx=0.0, lean=-1, hd=0, yaw=0.85, rf=(0.05, 0), lf=(-0.06, 0), ra=(30, 170), la=(3, 10), sw=178, sc=-10, coat=-6),
    fr(10, None, hh=0.40, hx=0.0, lean=2, hd=3, rf=(0.07, 0), lf=(-0.08, 0), ra=(70, 52), la=(-5, 20), sw=55, sc=14, coat=-14),
    fr(10, None, hh=0.385, hx=-0.005, lean=6, hd=8, rf=(0.09, 0), lf=(-0.09, 0), ra=(25, 80), la=(10, 105), sw=125, sc=14, coat=-22),
])

ATTACKS = {"light", "heavy", "crouch_light", "crouch_heavy", "air_attack", "special_cast", "rush", "counter", "throw"}

# ----------------------------------------------------------------------------- export: OpenPose rendering
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
         (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0),
          (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255),
          (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]

def draw_openpose(kps, size=768):
    """controlnet_aux draw_bodypose clone (cv2.ellipse2Poly sticks, 0.6 dimming, joint circles)."""
    k = size / 512.0
    sw = 4 * k
    canvas = np.zeros((size, size, 3), np.uint8)
    for i, (a, b) in enumerate(LIMBS):
        if kps[a] is None or kps[b] is None: continue
        x0, y0 = kps[a][0] * size, kps[a][1] * size
        x1, y1 = kps[b][0] * size, kps[b][1] * size
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        length = math.hypot(x1 - x0, y1 - y0)
        ang = math.atan2(y1 - y0, x1 - x0)
        t = np.linspace(0, 2 * math.pi, 40, endpoint=False)
        ex, ey = (length / 2) * np.cos(t), sw * np.sin(t)
        px = mx + ex * math.cos(ang) - ey * math.sin(ang); py = my + ex * math.sin(ang) + ey * math.cos(ang)
        im = Image.fromarray(canvas); ImageDraw.Draw(im).polygon(list(zip(px, py)), fill=COLORS[i]); canvas = np.array(im)
    canvas = (canvas * 0.6).astype(np.uint8)
    im = Image.fromarray(canvas); d = ImageDraw.Draw(im)
    for i, p in enumerate(kps):
        if p is None: continue
        x, y = p[0] * size, p[1] * size; r = 4 * k
        d.ellipse([x - r, y - r, x + r, y + r], fill=COLORS[i])
    return im

# ----------------------------------------------------------------------------- export: silhouette preview
def _capsule(d, p, q, w, col, S):
    p = (p[0] * S, p[1] * S); q = (q[0] * S, q[1] * S); r = w * S / 2
    d.line([p, q], fill=col, width=max(1, int(w * S)))
    for c in (p, q): d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=col)

def _ell(c, a, b, ang, n=24):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False); ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    return [(c[0] + a * math.cos(u) * ca - b * math.sin(u) * sa, c[1] + a * math.cos(u) * sa + b * math.sin(u) * ca) for u in t]

def draw_preview(b, S=384, label=None, im=None, ox=0, oy=0):
    own = im is None
    if own: im = Image.new("RGB", (S, S), (128, 128, 132))
    d = ImageDraw.Draw(im)
    def P(q): return (ox + q[0] * S, oy + q[1] * S)
    def cap(p, q, w, col):
        a = P(p); c = P(q); r = w * S / 2
        d.line([a, c], fill=col, width=max(1, int(w * S)))
        for e in (a, c): d.ellipse([e[0] - r, e[1] - r, e[0] + r, e[1] + r], fill=col)
    pt = b["pts"]
    d.line([(ox, oy + G * S), (ox + S, oy + G * S)], fill=(80, 80, 84), width=2)
    NAVY, NAVYD, WHITE, WHD, BOOT, SKIN = (38, 60, 135), (24, 38, 88), (232, 230, 220), (150, 150, 148), (22, 22, 26), (222, 178, 140)
    # far limbs
    cap(pt["l_hip"], pt["l_knee"], 0.05, WHD); cap(pt["l_knee"], pt["l_ankle"], 0.038, WHD)
    cap([pt["l_ankle"][0] * 1, pt["l_ankle"][1] - 0.05], pt["l_ankle"], 0.045, (10, 10, 12))
    d.polygon([P(pt["l_ankle"] + [-0.015, 0.012]), P(pt["l_ankle"] + [0.05, 0.012]), P(pt["l_ankle"] + [0.05, 0.03]), P(pt["l_ankle"] + [-0.015, 0.03])], fill=(10, 10, 12))
    cap(pt["l_shoulder"], pt["l_elbow"], 0.042, NAVYD); cap(pt["l_elbow"], pt["l_wrist"], 0.036, NAVYD)
    d.ellipse([P(pt["l_wrist"])[0] - 0.02 * S, P(pt["l_wrist"])[1] - 0.02 * S, P(pt["l_wrist"])[0] + 0.02 * S, P(pt["l_wrist"])[1] + 0.02 * S], fill=(200, 200, 190))
    # coat skirt (behind torso, over far leg)
    H = b["hip_c"]; ca = b["coat"]
    pr = np.array(pt["r_hip"]); pl = np.array(pt["l_hip"])
    mid = (pr + pl) / 2
    back = mid + dwn(ca) * 0.23; front = mid + dwn(ca * 0.25 + 10) * 0.19
    d.polygon([P(pr + [-0.02, -0.02]), P(pl + [0.03, -0.02]), P(front), P(mid + dwn((ca + ca * 0.25 + 10) / 2) * 0.24), P(back)], fill=NAVYD)
    # torso
    cap(pt["neck"], H, 0.105, NAVY)
    cap((np.array(pt["r_shoulder"]) + np.array(pt["l_shoulder"])) / 2, pt["neck"], 0.1, NAVY)
    sash = (np.array(pt["r_shoulder"]), np.array(pt["l_hip"]))
    d.line([P(sash[0]), P(sash[1])], fill=(170, 30, 40), width=max(2, int(0.018 * S)))
    # near leg
    cap(pt["r_hip"], pt["r_knee"], 0.056, WHITE); cap(pt["r_knee"], pt["r_ankle"], 0.04, WHITE)
    cap(pt["r_knee"] * 0.35 + np.array(pt["r_ankle"]) * 0.65, pt["r_ankle"], 0.046, BOOT)
    d.polygon([P(pt["r_ankle"] + [-0.015, 0.01]), P(pt["r_ankle"] + [0.055, 0.012]), P(pt["r_ankle"] + [0.055, 0.032]), P(pt["r_ankle"] + [-0.015, 0.032])], fill=BOOT)
    # head + hat
    hc = b["head_c"]; hdg = b["hd"]
    d.ellipse([P(hc)[0] - 0.052 * S, P(hc)[1] - 0.056 * S, P(hc)[0] + 0.052 * S, P(hc)[1] + 0.056 * S], fill=SKIN)
    hatc = np.array(hc) + upv(hdg) * 0.04
    hp = [(hatc[0] + 0.078 * math.cos(u) * math.cos(math.radians(hdg)) - 0.026 * math.sin(u) * math.sin(math.radians(hdg)) + 0,
           hatc[1] + 0.078 * math.cos(u) * math.sin(math.radians(hdg)) + 0.026 * math.sin(u) * math.cos(math.radians(hdg))) for u in np.linspace(0, 2 * math.pi, 28, endpoint=False)]
    d.polygon([P(q) for q in hp], fill=(24, 24, 30))
    nz = pt["nose"]; d.ellipse([P(nz)[0] - 0.008 * S, P(nz)[1] - 0.008 * S, P(nz)[0] + 0.008 * S, P(nz)[1] + 0.008 * S], fill=(170, 120, 90))
    for e in ("r_eye", "l_eye"):
        q = P(pt[e]); d.ellipse([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2], fill=(20, 20, 20))
    # near arm
    cap(pt["r_shoulder"], pt["r_elbow"], 0.046, NAVY); cap(pt["r_elbow"], pt["r_wrist"], 0.038, NAVY)
    # sword
    sw = b["sword"]
    pts = [P(b["pommel"])] + [P(q) for q in sw]
    d.line(pts, fill=(60, 60, 66), width=max(3, int(0.016 * S)))
    d.line(pts[1:], fill=(225, 230, 240), width=max(2, int(0.01 * S)))
    wr = P(pt["r_wrist"]); r = 0.021 * S
    d.ellipse([wr[0] - r, wr[1] - r, wr[0] + r, wr[1] + r], fill=(240, 240, 235), outline=(60, 60, 60))
    tip = P(sw[-1]); d.ellipse([tip[0] - 3, tip[1] - 3, tip[0] + 3, tip[1] + 3], fill=(255, 60, 60))
    # skeleton overlay (thin) for anatomy debugging
    if label:
        d.text((ox + 6, oy + 4), label, fill=(255, 255, 255), font=ImageFont.load_default())
    return im

# ----------------------------------------------------------------------------- driver
def kp_list(b): return [[round(float(b["pts"][n][0]), 5), round(float(b["pts"][n][1]), 5)] for n in NAMES]

def anim_shift(built):
    xs = []
    for b in built:
        xs += [q[0] for q in b["pts"].values()] + [b["sword"][-1][0]]
    lo, hi = min(xs), max(xs)
    sh = 0.0
    if hi > 0.975: sh = 0.975 - hi
    if lo + sh < 0.02: sh = 0.02 - lo
    return sh, (lo, hi)

def build_anim(name):
    a = ANIMS[name]
    built = [build(f[0]) for f in a["frames"]]
    sh, rng = anim_shift(built)
    if abs(sh) > 1e-6:
        built = [build({**f[0], "cx": f[0]["cx"] + sh}) for f in a["frames"]]
    return built, sh

def export(names):
    manifest = {}
    if os.path.exists(os.path.join(POSES, "manifest.json")) and set(names) != set(ANIMS):
        manifest = json.load(open(os.path.join(POSES, "manifest.json")))
    os.makedirs(PREV, exist_ok=True)
    for name in names:
        a = ANIMS[name]; built, sh = build_anim(name)
        d = os.path.join(POSES, name); os.makedirs(d, exist_ok=True)
        for fn in os.listdir(d): os.remove(os.path.join(d, fn))
        ents = []
        for i, (b, f) in enumerate(zip(built, a["frames"])):
            ph, tag = f[2], f[3]
            kps = kp_list(b); tip = [round(float(b["sword"][-1][0]), 5), round(float(b["sword"][-1][1]), 5)]
            data = dict(keypoints=kps, sword_tip=tip, sword=[[round(float(q[0]), 5), round(float(q[1]), 5)] for q in b["sword"]],
                        hilt=[round(float(b["pts"]["r_wrist"][0]), 5), round(float(b["pts"]["r_wrist"][1]), 5)],
                        hip=[round(float(b["hip_c"][0]), 5), round(float(b["hip_c"][1]), 5)],
                        coat_angle=b["coat"], ticks=f[1], phase=ph, tag=tag)
            json.dump(data, open(os.path.join(d, "%02d.json" % i), "w"))
            draw_openpose(kps).save(os.path.join(d, "%02d.png" % i))
            am = (np.array(b["pts"]["r_ankle"]) + np.array(b["pts"]["l_ankle"])) / 2
            ents.append(dict(index=i, file="%s/%02d" % (name, i), ticks=f[1], phase=ph, tag=tag, sword_tip=tip,
                             hip=data["hip"], ankle_mid_x=round(float(am[0]), 5), l_wrist=kps[7]))
        manifest[name] = dict(loop=a["loop"], attack=name in ATTACKS, frame_count=len(ents), total_ticks=sum(e["ticks"] for e in ents),
                              shift_x=round(sh, 5), frames=ents)
        render_preview(name, built, a)
        print("%-14s %2d frames  %3d ticks  shift_x=%+.3f" % (name, len(ents), manifest[name]["total_ticks"], sh))
    order = [n for n in ANIMS if n in manifest]
    manifest = {n: manifest[n] for n in order}
    meta = dict(space="normalized square 0..1, y down, ground=0.977, facing +x", ground_y=G, bone_lengths=L, keypoint_order=NAMES,
                tick_hz=60, frame_index_base=0, animations=manifest)
    json.dump(meta, open(os.path.join(POSES, "manifest.json"), "w"), indent=1)

def render_preview(name, built, a):
    S = 320; n = len(built)
    ph_col = {"startup": (255, 220, 80), "active": (255, 90, 90), "recovery": (110, 200, 255)}
    strip = Image.new("RGB", (S * n, S + 0), (128, 128, 132))
    gif = []
    for i, (b, f) in enumerate(zip(built, a["frames"])):
        lab = "%s %02d  %dt %s" % (name, i, f[1], (f[2] or "") + ("/" + f[3] if f[3] else ""))
        fi = draw_preview(b, S, lab)
        if f[2]:
            ImageDraw.Draw(fi).rectangle([0, 0, S - 1, 4], fill=ph_col[f[2]])
        strip.paste(fi, (i * S, 0))
        gif.append(draw_preview(b, 384, lab).convert("P", palette=Image.ADAPTIVE))
    strip.save(os.path.join(PREV, name + ".png"))
    dur = [max(20, int(f[1] * 1000 / 60 * (1 if a["loop"] else 2))) for f in a["frames"]]
    gif[0].save(os.path.join(PREV, name + ".gif"), save_all=True, append_images=gif[1:], duration=dur, loop=0)

def contact_sheet(names):
    S = 176; cols = 8
    rows = len(names)
    sheet = Image.new("RGB", (cols * S + 110, rows * S), (128, 128, 132))
    d = ImageDraw.Draw(sheet)
    for r, name in enumerate(names):
        built, _ = build_anim(name)
        d.text((4, r * S + S // 2), name, fill=(255, 255, 255), font=ImageFont.load_default())
        for i, b in enumerate(built[:cols]):
            draw_preview(b, S, "%d" % i, im=sheet, ox=110 + i * S, oy=r * S)
    sheet.save(os.path.join(PREV, "all.png"))

if __name__ == "__main__":
    names = sys.argv[1:] or list(ANIMS)
    export(names)
    if not sys.argv[1:] or True:
        contact_sheet(list(ANIMS))
