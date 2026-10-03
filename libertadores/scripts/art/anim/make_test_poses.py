#!/usr/bin/env python3
"""Make the idle reference skeleton (idle_skeleton.json, from OpenposeDetector on idle.png) and 3 test poses.
usage: python make_test_poses.py <outdir>"""
import json, sys, copy
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from render import draw_openpose, grey_ref, DEFAULT_REF, GEN

def detect():
    from controlnet_aux import OpenposeDetector
    sq = grey_ref(DEFAULT_REF, 1024)
    det = OpenposeDetector.from_pretrained("lllyasviel/Annotators")
    p = det.detect_poses(np.array(sq))[0].body.keypoints
    return [None if k is None else (k.x * 1024, k.y * 1024) for k in p]

def to_gen(kps):  # idle 1024 square -> 768 frame: figure ~640 px tall, ankle-mid at (340, ~690)
    s, ax, ay = 0.68, 424.0, 941.0
    return [None if k is None else [round((k[0] - ax) * s + 340, 1), round((k[1] - ay) * s + 690, 1)] for k in kps]

if __name__ == "__main__":
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    here = Path(__file__).parent
    f = here / "idle_skeleton.json"
    if f.exists():
        idle = json.load(open(f))["keypoints"]
    else:
        idle = to_gen(detect())
        json.dump({"keypoints": idle, "note": "idle.png skeleton in 768x768 gen space"}, open(f, "w"))
    P = {}
    P["00_idle"] = idle
    t = copy.deepcopy(idle)           # thrust: sabre arm straight forward, wider stance
    sh = t[5]; t[6] = [sh[0] + 95, sh[1] + 4]; t[7] = [sh[0] + 190, sh[1] - 2]
    t[10] = [t[10][0] - 25, t[10][1]]; t[9] = [t[9][0] - 15, t[9][1]]; t[13] = [t[13][0] + 30, t[13][1]]; t[12] = [t[12][0] + 18, t[12][1]]
    P["01_thrust"] = t
    o = copy.deepcopy(idle)           # overhead slash: sabre arm raised above head
    sh = o[5]; o[6] = [sh[0] + 45, sh[1] - 75]; o[7] = [sh[0] + 75, sh[1] - 165]
    P["02_overhead"] = o
    for k, v in P.items():
        json.dump({"keypoints": v}, open(out / f"{k}.json", "w"))
        draw_openpose([tuple(x) if x else None for x in v], GEN).save(out / f"{k}.png")
    print("wrote", list(P))
