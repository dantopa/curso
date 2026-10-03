import {
  G, FxCtx, Ph, clamp, seg, lerp, easeOut, easeIn, easeIO, bump, hash, mix, lighten, darken,
  poly, line, path, rect, circ, ell, glow, ring, beam, column, embers, sparks, dust, snow, lightning,
  soldier, rider, condor, serpentPts, bell, tigerShape,
} from './lib';

export interface FxLayer { back?: (g: G, p: Ph, x: FxCtx) => void; front?: (g: G, p: Ph, x: FxCtx) => void }

export const GOLD = 0xffc94a;

export function crescent(g: G, xe: number, ym: number, hh: number, dir: number, thick: number, color: number, alpha: number, bulge = 0.35) {
  const mk = (th: number) => {
    const pts: number[] = [];
    const N = 10;
    for (let i = 0; i <= N; i++) { const u = -1 + (2 * i) / N; pts.push(xe - dir * hh * bulge * u * u, ym + u * hh); }
    for (let i = N; i >= 0; i--) { const u = -1 + (2 * i) / N; pts.push(xe - dir * (hh * bulge * u * u + th * (1 - u * u)), ym + u * hh); }
    return pts;
  };
  poly(g, mk(thick * 2.2), color, alpha * 0.15);
  poly(g, mk(thick * 1.5), color, alpha * 0.25);
  poly(g, mk(thick), lighten(color, 0.4), alpha * 0.6);
  poly(g, mk(thick * 0.4), 0xffffff, alpha * 0.9);
}

function speedLines(g: G, seed: number, time: number, n: number, w: number, y0: number, y1: number, dir: number, color: number, alpha: number) {
  if (alpha <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const sp = 1.2 + hash(seed, i, 51) * 1.6;
    const len = 80 + hash(seed, i, 52) * 220;
    const x = (((hash(seed, i, 53) + time * sp * dir) % 1) + 1) % 1 * (w + len * 2) - len;
    const y = lerp(y0, y1, hash(seed, i, 54));
    line(g, x, y, x - dir * len, y, 1.5 + hash(seed, i, 55) * 2, color, alpha * (0.3 + hash(seed, i, 56) * 0.5));
  }
}

/* ---------------------------------------------------------------- army */
const army: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.1, 0.4)) * (1 - seg(p.t, 0.9, 1));
    const ty = x.groundY - 90;
    glow(g, x.loserX, ty, 380 * k, GOLD, 0.35 * k);
    for (let row = 2; row >= 0; row--) {
      const s = 1.0 + row * 0.25, y = x.groundY - 10 + row * 22 - 20 * (2 - row);
      for (let i = 0; i < 7; i++) {
        for (const side of [-1, 1]) {
          const d = 150 + i * 62 + row * 28 + (hash(x.seed, i + row * 9, 61) - 0.5) * 20;
          const sx = x.loserX + side * d;
          const adv = (1 - easeOut(seg(p.t, 0.1 + i * 0.02 + row * 0.03, 0.35 + i * 0.02))) * 120;
          const bob = Math.sin(p.t * 40 + i * 2) * (p.m > 0 && p.c === 0 ? 1 : 0);
          soldier(g, sx + side * adv, y + bob, s, -side, mix(GOLD, 0x6a4a10, row * 0.3), 0.55 * k, i % 3 === 0 && row === 0);
        }
      }
    }
  },
  front(g, p, x) {
    const w = seg(p.t, 0.3, 0.8);
    if (w <= 0 || w >= 1) return;
    const xe = x.winnerX + x.facing * easeIn(w) * (x.w * 1.2);
    const a = Math.sin(w * Math.PI);
    for (let i = 0; i < 3; i++) crescent(g, xe - x.facing * i * 55, x.groundY - 190, 230, x.facing, 46 - i * 8, GOLD, a * (1 - i * 0.25));
    embers(g, x.seed + 3, w, 50, xe - x.facing * 100, x.groundY - 150, 120, 300, 120, GOLD, a);
  },
};

/* ------------------------------------------------------------- cavalry */
function cavalryRun(g: G, p: Ph, x: FxCtx, a0: number, a1: number, color: number, lanes = 3) {
  const w = seg(p.t, a0, a1);
  if (w <= 0 || w >= 1) return;
  const dir = x.facing;
  const al = Math.sin(w * Math.PI) ** 0.5;
  speedLines(g, x.seed, p.t * 3, 22, x.w, x.groundY - 300, x.groundY, dir, lighten(color, 0.5), 0.8 * al);
  for (let l = 0; l < lanes; l++) {
    for (let i = 0; i < 4; i++) {
      const s = 0.8 + l * 0.18 + hash(x.seed, i + l * 5, 62) * 0.1;
      const start = dir > 0 ? -300 : x.w + 300;
      const end = dir > 0 ? x.w + 300 : -300;
      const u = clamp(w * 1.3 - i * 0.09 - l * 0.05);
      const px = lerp(start, end, u);
      rider(g, px, x.groundY + 4 + (l - 1) * 26 + 20, s, dir, color, 0.55 * al, p.t * 8 + i * 0.3 + l);
      circ(g, px - dir * 70, x.groundY - 30, 0, color, 0);
    }
  }
  dust(g, x.seed + 5, p.t * 2, 18, 0, x.w, x.groundY + 20, 0.9 * al);
}
const cavalry: FxLayer = {
  back(g, p, x) {
    const k = p.env;
    glow(g, x.w * 0.5, x.groundY - 250, 520, x.c2, 0.18 * k);
    // far spectral riders (parallax)
    const w = seg(p.t, 0.2, 0.75);
    if (w > 0 && w < 1) {
      for (let i = 0; i < 6; i++) {
        const u = clamp(w * 1.2 - i * 0.07);
        const px = lerp(x.facing > 0 ? -200 : x.w + 200, x.facing > 0 ? x.w + 200 : -200, u);
        rider(g, px, x.groundY - 20, 0.5, x.facing, mix(x.c1, 0x203050, 0.5), 0.35 * Math.sin(w * Math.PI), p.t * 7 + i);
      }
    }
  },
  front(g, p, x) { cavalryRun(g, p, x, 0.2, 0.76, mix(x.c1, 0xffffff, 0.35)); },
};

/* ------------------------------------------------------------ blizzard */
const blizzard: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0, 0.3)) * (1 - seg(p.t, 0.88, 1));
    rect(g, 0, 0, x.w, x.h, 0xbfdcf5, 0.28 * k);
    glow(g, x.w / 2, x.groundY - 200, 600, 0xdff3ff, 0.25 * k);
    snow(g, x.seed, p.t * 1.2, 60, x.w, x.h, 0.5, 0.5 * k, 0xcfe6fa);
  },
  front(g, p, x) {
    const k = easeOut(seg(p.t, 0, 0.3)) * (1 - seg(p.t, 0.9, 1));
    snow(g, x.seed + 9, p.t * 1.8, 110, x.w, x.h, 1.0, 0.85 * k);
    const ap = easeOut(seg(p.t, 0.28, 0.45));
    const hx = x.loserX - x.facing * 240 + x.facing * easeOut(seg(p.t, 0.28, 0.5)) * 40;
    if (ap > 0 && p.t < 0.8) {
      glow(g, hx, x.groundY - 90, 150 * ap, 0xbfe4ff, 0.3 * ap);
      rider(g, hx, x.groundY + 6, 1.55, x.facing, 0x05070c, ap * 0.95 * (1 - seg(p.t, 0.7, 0.8)), p.t * 3, true);
      circ(g, hx + x.facing * 120, x.groundY - 140, 4, 0xaee6ff, ap);
    }
    cavalryRun(g, p, x, 0.5, 0.78, 0xa8d8ff, 2);
    // ice crystals
    const sh = seg(p.t, 0.74, 0.95);
    const ci = easeOut(seg(p.t, 0.4, 0.7));
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * 6.283 + hash(x.seed, i, 71);
      const r = (60 + hash(x.seed, i, 72) * 40) * ci + sh * (200 + hash(x.seed, i, 73) * 300);
      const cx = x.loserX + Math.cos(ang) * r, cy = x.groundY - 90 + Math.sin(ang) * r * 0.9 - sh * 60;
      const s = (10 + hash(x.seed, i, 74) * 18) * (1 - sh * 0.7);
      const a = ci * (1 - sh) * 0.8;
      poly(g, [cx, cy - s * 2, cx + s, cy, cx, cy + s * 2, cx - s, cy], 0xcfeeff, a);
      poly(g, [cx, cy - s * 2, cx + s * 0.4, cy, cx, cy + s * 0.5], 0xffffff, a);
    }
  },
};

/* ------------------------------------------------------------- condor */
const condorFx: FxLayer = {
  back(g, p, x) {
    const d = easeOut(seg(p.t, 0.1, 0.55));
    const y = lerp(-260, 150, d) - seg(p.t, 0.78, 1) * 200;
    const flap = p.t * 2.2;
    const a = 0.8 * (1 - seg(p.t, 0.9, 1));
    glow(g, x.loserX, y, 420, GOLD, 0.2 * d * a);
    condor(g, x.loserX, y, 1.9, flap, 0x4a3818, a);
    condor(g, x.loserX, y - 6, 1.9, flap, mix(0x4a3a18, GOLD, 0.5), a * 0.35, false);
  },
  front(g, p, x) {
    for (let i = 0; i < 5; i++) {
      const w = seg(p.t, 0.45 + i * 0.07, 0.8 + i * 0.03);
      if (w <= 0 || w >= 1) continue;
      ring(g, x.loserX, x.groundY + 4, w * 600, 10 * (1 - w) + 2, GOLD, (1 - w) * 0.9, 0.22);
      ring(g, x.loserX, x.groundY + 4, w * 600 - 8, 3, 0xffffff, (1 - w) * 0.6, 0.22);
    }
    // falling feathers
    const fk = seg(p.t, 0.3, 0.9);
    for (let i = 0; i < 24; i++) {
      const u = (fk * 1.2 + hash(x.seed, i, 81)) % 1;
      const fx = x.loserX + (hash(x.seed, i, 82) - 0.5) * 700 + Math.sin(u * 8 + i) * 30;
      const fy = u * x.groundY;
      poly(g, [fx, fy, fx + 5, fy + 14, fx, fy + 30, fx - 5, fy + 14], mix(GOLD, 0xffffff, 0.3), 0.6 * fk * (1 - fk * 0.3));
    }
  },
};

/* --------------------------------------------------------------- bell */
const bellFx: FxLayer = {
  back(g, p, x) {
    const d = easeOut(seg(p.t, 0.02, 0.2));
    const y = lerp(-420, -20, d);
    const sw = Math.sin(seg(p.t, 0.2, 0.75) * Math.PI * 5) * 0.28 * (1 - seg(p.t, 0.7, 0.85)) * (p.t > 0.2 ? 1 : 0);
    glow(g, x.loserX, y + 260, 300, 0xd9a441, 0.25 * d);
    bell(g, x.loserX, y, 1.15, sw, 0x8a5a1c, 0.88 * (1 - seg(p.t, 0.9, 1)));
    // concentric sound rings from mouth
    for (let i = 0; i < 5; i++) {
      const w = seg(p.t, 0.25 + i * 0.1, 0.45 + i * 0.1 + 0.15);
      if (w <= 0 || w >= 1) continue;
      for (let j = 0; j < 3; j++) ring(g, x.loserX, y + 300, w * 520 - j * 28, 5 - j, mix(0xffe7a0, 0xffffff, j / 2), (1 - w) * (0.7 - j * 0.15), 0.8);
    }
  },
  front(g, p, x) {
    const w = seg(p.t, 0.7, 0.95);
    if (w <= 0) return;
    for (let i = 0; i < 18; i++) {
      const fx = x.loserX + (i - 8.5) * 26 + (hash(x.seed, i, 91) - 0.5) * 20;
      const hh = (120 + hash(x.seed, i, 92) * 180) * easeOut(w) * (1 - seg(w, 0.6, 1)) * (1 - Math.abs(i - 8.5) / 12);
      if (hh <= 0) continue;
      const wob = Math.sin(p.t * 40 + i) * 8;
      poly(g, [fx - 22, x.groundY, fx + wob, x.groundY - hh, fx + 22, x.groundY], 0xff5a14, 0.55);
      poly(g, [fx - 13, x.groundY, fx + wob * 0.6, x.groundY - hh * 0.7, fx + 13, x.groundY], 0xffb030, 0.7);
      poly(g, [fx - 6, x.groundY, fx + wob * 0.3, x.groundY - hh * 0.4, fx + 6, x.groundY], 0xfff2b0, 0.9);
    }
  },
};

/* --------------------------------------------------------------- fist */
export function fistLift(p: Ph) { return easeOut(seg(p.t, 0.2, 0.55)) * 150 - seg(p.t, 0.78, 0.9) * 40; }
const fist: FxLayer = {
  back(g, p, x) {
    // revolutionary banner behind winner
    const bk = easeOut(seg(p.t, 0.05, 0.4)) * (1 - seg(p.t, 0.9, 1));
    const bx = x.winnerX - x.facing * 130, top = x.groundY - 420 * bk - 20;
    line(g, bx, x.groundY, bx, top, 7, 0x5a4020, 0.9 * bk);
    const fl: number[] = [], fl2: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, wy = Math.sin(u * 5 - p.t * 30) * 8 * u;
      fl.push(bx + x.facing * u * 150, top + 6 + wy);
      fl2.push(bx + x.facing * u * 150, top + 6 + 90 + wy);
    }
    poly(g, [...fl, ...fl2.reverse()], x.c1, 0.85 * bk);
    const mid: number[] = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; mid.push(bx + x.facing * u * 150, top + 36 + Math.sin(u * 5 - p.t * 30) * 8 * u); }
    path(g, mid, 20, x.c2, 0.9 * bk);
    glow(g, bx + x.facing * 70, top + 50, 160, x.c1, 0.25 * bk);
    // giant fist
    const r = easeOut(seg(p.t, 0.2, 0.55));
    const out = 1 - seg(p.t, 0.8, 0.95);
    const topY = x.groundY + 360 - r * 400 + seg(p.t, 0.78, 0.9) * 40;
    const fx = x.loserX, a = 0.8 * out, col = 0x4a3a2a;
    if (r > 0) {
      glow(g, fx, topY + 40, 280 * r, GOLD, 0.25 * a);
      rect(g, fx - 80, topY + 120, 160, 700, darken(col, 0.2), a); // forearm
      rect(g, fx - 110, topY, 220, 130, col, a);                    // palm block
      for (let i = 0; i < 4; i++) { // fingers
        ell(g, fx - 82 + i * 55, topY + 10, 54, 76, lighten(col, 0.1), a);
        rect(g, fx - 108 + i * 55, topY + 8, 2, 90, darken(col, 0.4), a);
      }
      poly(g, [fx + 100, topY + 70, fx + 150, topY + 40, fx + 160, topY + 90, fx + 105, topY + 130], lighten(col, 0.05), a); // thumb
      for (let i = 0; i < 4; i++) ring(g, fx - 82 + i * 55, topY + 6, 26, 3, GOLD, a * 0.5);
    }
  },
  front(g, p, x) {
    const r = seg(p.t, 0.2, 0.45);
    if (r > 0 && r < 1) { // ground cracks + debris
      for (let i = 0; i < 6; i++) {
        const sd = (i % 2 ? 1 : -1), len = 80 + hash(x.seed, i, 101) * 160;
        const pts = [x.loserX, x.groundY + 6];
        for (let j = 1; j <= 5; j++) pts.push(x.loserX + sd * len * (j / 5) * r, x.groundY + 6 + (hash(x.seed, i * 7 + j, 102) - 0.3) * 18);
        path(g, pts, 3, 0xffd77a, 0.8 * (1 - r * 0.5));
      }
    }
    for (let i = 0; i < 14; i++) {
      const u = clamp(seg(p.t, 0.2, 0.6) * 1.3 - hash(x.seed, i, 103) * 0.3);
      if (u <= 0) continue;
      const dx = (hash(x.seed, i, 104) - 0.5) * 340 * easeOut(u), dy = -Math.sin(u * Math.PI) * (80 + hash(x.seed, i, 105) * 120);
      poly(g, [x.loserX + dx - 6, x.groundY + dy, x.loserX + dx + 7, x.groundY + dy - 4, x.loserX + dx, x.groundY + dy + 9], 0x6a5a48, 0.8 * (1 - u * 0.5));
    }
  },
};

/* ------------------------------------------------------------- throne */
const RED = 0xd22b2b, GRN = 0x1f9d55;
const throne: FxLayer = {
  back(g, p, x) {
    const r = easeOut(seg(p.t, 0.12, 0.45)) * (1 - seg(p.t, 0.86, 1));
    const tx = x.loserX + x.facing * 70, base = x.groundY + (1 - r) * 420;
    if (r <= 0) return;
    glow(g, tx, base - 160, 340 * r, GOLD, 0.3 * r);
    const gc = 0xd9a23a, a = 0.9 * r;
    rect(g, tx - 95, base - 120, 190, 120, darken(gc, 0.3), a);               // seat base
    rect(g, tx - 100, base - 135, 200, 22, gc, a);                              // cushion
    poly(g, [tx - 85, base - 135, tx + 85, base - 135, tx + 70, base - 380, tx, base - 420, tx - 70, base - 380], gc, a); // back
    poly(g, [tx - 55, base - 150, tx + 55, base - 150, tx + 45, base - 360, tx, base - 395, tx - 45, base - 360], darken(RED, 0.2), a * 0.9);
    rect(g, tx - 120, base - 190, 28, 70, gc, a); rect(g, tx + 92, base - 190, 28, 70, gc, a); // arms
    for (const sx of [-1, 1]) { circ(g, tx + sx * 70, base - 395, 11, lighten(gc, 0.3), a); }
    ring(g, tx, base - 290, 26, 4, lighten(gc, 0.4), a * 0.8);
  },
  front(g, p, x) {
    const d = easeOut(seg(p.t, 0.3, 0.68));
    const out = 1 - seg(p.t, 0.75, 0.82);
    const cy = lerp(-250, x.groundY - 300, d), a = 0.8 * out;
    if (d > 0 && out > 0) {
      const cx = x.loserX, s = 1.4;
      glow(g, cx, cy, 220, GOLD, 0.3 * a);
      poly(g, [cx - 110 * s, cy + 60 * s, cx - 110 * s, cy - 40 * s, cx - 60 * s, cy + 10 * s, cx - 30 * s, cy - 70 * s, cx, cy - 10 * s, cx + 30 * s, cy - 70 * s, cx + 60 * s, cy + 10 * s, cx + 110 * s, cy - 40 * s, cx + 110 * s, cy + 60 * s], 0xe6b441, a);
      rect(g, cx - 110 * s, cy + 40 * s, 220 * s, 24 * s, 0xb98524, a);
      for (const [dx, col] of [[-80, RED], [0, 0xffffff], [80, GRN]] as [number, number][]) circ(g, cx + dx * s, cy + 52 * s, 8 * s, col, a);
      for (const dx of [-110, -30, 30, 110]) circ(g, cx + dx * s, cy - (dx === -110 || dx === 110 ? 40 : 70) * s, 7 * s, 0xffffff, a);
    }
    // tricolor explosion
    const ex = seg(p.t, 0.7, 0.92);
    if (ex > 0 && ex < 1) {
      const cols = [RED, 0xffffff, GRN];
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * 6.283, R = easeOut(ex) * 520, c = cols[i % 3];
        const a1 = ang - 0.07, a2 = ang + 0.07;
        poly(g, [x.loserX, x.groundY - 100, x.loserX + Math.cos(a1) * R, x.groundY - 100 + Math.sin(a1) * R, x.loserX + Math.cos(a2) * R, x.groundY - 100 + Math.sin(a2) * R], c, 0.55 * (1 - ex));
      }
      for (let i = 0; i < 3; i++) ring(g, x.loserX, x.groundY - 100, easeOut(ex) * (240 + i * 90), 14 - i * 3, cols[i], (1 - ex) * 0.9);
      sparks(g, x.seed + 4, ex, 40, x.loserX, x.groundY - 100, 480, 0xffffff, 0.9);
    }
  },
};

/* ---------------------------------------------------------------- map */
const NA = [-0.55, -0.9, -0.2, -1.0, 0.1, -0.92, 0.38, -0.78, 0.55, -0.55, 0.38, -0.42, 0.28, -0.25, 0.14, -0.1, 0.16, 0.04, 0.0, -0.02, -0.12, -0.12, -0.32, -0.22, -0.46, -0.45, -0.62, -0.7];
const CA = [0.16, 0.04, 0.2, 0.16, 0.3, 0.24, 0.24, 0.3, 0.14, 0.18, 0.08, 0.06];
const SA = [0.3, 0.24, 0.52, 0.3, 0.72, 0.42, 0.66, 0.62, 0.52, 0.82, 0.4, 1.0, 0.33, 0.84, 0.32, 0.62, 0.22, 0.42, 0.2, 0.3];
function mapScale(x: FxCtx) { return { cx: x.w * 0.5 - 40, cy: 230, s: 210 }; }
function mapPt(x: FxCtx, ux: number, uy: number): [number, number] { const m = mapScale(x); return [m.cx + ux * m.s * 1.3, m.cy + uy * m.s * 0.82]; }
const mapFx: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.08, 0.4)) * (1 - seg(p.t, 0.88, 1));
    if (k <= 0) return;
    const m = mapScale(x);
    glow(g, m.cx, m.cy, 440, x.c1, 0.14 * k);
    const prog = seg(p.t, 0.1, 0.4);
    for (const shape of [NA, CA, SA]) {
      const n = shape.length / 2, pts: number[] = [];
      const cnt = Math.max(2, Math.floor(n * prog) + 1);
      for (let i = 0; i < Math.min(cnt, n); i++) { const [px, py] = mapPt(x, shape[i * 2], shape[i * 2 + 1]); pts.push(px, py); }
      if (cnt >= n) poly(g, pts, mix(x.c1, 0x203040, 0.5), 0.25 * k);
      path(g, pts, 9, x.c1, 0.2 * k, cnt >= n);
      path(g, pts, 3.5, lighten(x.c2, 0.5), 0.95 * k, cnt >= n);
    }
    // energy lines spreading then converging on loser
    const sp = seg(p.t, 0.35, 0.58), cv = seg(p.t, 0.52, 0.76);
    for (let i = 0; i < 14; i++) {
      const sh = i < 8 ? NA : SA, idx = Math.floor(hash(x.seed, i, 111) * (sh.length / 2));
      const [px, py] = mapPt(x, sh[idx * 2], sh[idx * 2 + 1]);
      const tx = x.loserX, ty = x.groundY - 100;
      const u = easeIn(cv);
      const hx = lerp(px, tx, easeOut(sp) * 0.3 + u * 0.7), hy = lerp(py, ty, easeOut(sp) * 0.3 + u * 0.7);
      const tailU = Math.max(0, u - 0.25);
      const ex = lerp(px, tx, tailU), ey = lerp(py, ty, tailU);
      if (sp > 0) beam(g, ex, ey, hx, hy, 3, x.c1, (1 - seg(p.t, 0.76, 0.8)) * 0.9);
      circ(g, px, py, 5 * sp, 0xffffff, 0.9 * k);
    }
  },
  front(g, p, x) {
    const cv = seg(p.t, 0.6, 0.78);
    if (cv > 0 && p.t < 0.9) glow(g, x.loserX, x.groundY - 100, 40 + cv * 160, x.c2, 0.5 * (1 - seg(p.t, 0.8, 0.9)));
  },
};

/* ------------------------------------------------------------ serpent */
function serpentDraw(g: G, p: Ph, x: FxCtx, front: boolean) {
  const grow = easeOut(seg(p.t, 0.12, 0.5));
  const burst = seg(p.t, 0.72, 0.95);
  if (grow <= 0) return;
  const N = 56, cy = x.groundY - 100;
  const cc = 0x4fa65a, gold = GOLD;
  for (let i = N - 1; i >= 0; i--) {
    const u = i / (N - 1); // 0 head .. 1 tail
    const vis = grow * 1.25 - u * 0.3;
    if (vis <= 0) continue;
    const ang = u * 12.5 - p.t * 7 + 0.6;
    const R = lerp(500, 105, easeOut(clamp(grow * 1.4 - u * 0.4))) * (1 + Math.sin(u * 7) * 0.05);
    const z = Math.sin(ang);
    if ((z >= 0) !== front) continue;
    let px = x.loserX + Math.cos(ang) * R, py = cy + (u - 0.45) * 300 * grow + z * 26;
    const dirx = hash(x.seed, i, 121) - 0.5, diry = hash(x.seed, i, 122) - 0.5;
    px += dirx * burst * 700; py += diry * burst * 600;
    const r = (30 - u * 18) * (1 - burst * 0.6);
    const a = clamp(vis * 3) * (1 - burst) * (z >= 0 ? 0.85 : 0.5);
    if (burst > 0) {
      glow(g, px, py, r * 2.4, gold, a * 1.3, 3);
      continue;
    }
    circ(g, px, py, r * 1.35, 0x1e3a24, a);
    circ(g, px, py, r, mix(cc, gold, (i % 4 === 0) ? 0.7 : 0.1), a);
    circ(g, px - 3, py - 4, r * 0.5, lighten(cc, 0.35), a * 0.7);
    if (i % 3 === 0) ring(g, px, py, r * 0.7, 2, gold, a * 0.7);
    if (i === 0) { // head
      const hd = Math.cos(ang) > 0 ? -1 : 1;
      poly(g, [px, py - r, px + hd * r * 2.2, py + 4, px, py + r], mix(cc, gold, 0.2), a);
      circ(g, px + hd * r * 0.7, py - r * 0.3, 4, 0xffe14a, a);
      line(g, px + hd * r * 2.2, py + 4, px + hd * r * 3.2, py + 10, 2, 0xff3030, a);
    }
  }
}
const serpent: FxLayer = {
  back(g, p, x) { glow(g, x.loserX, x.groundY - 100, 360 * easeOut(seg(p.t, 0.2, 0.6)), GOLD, 0.12 * p.env); serpentDraw(g, p, x, false); },
  front(g, p, x) {
    serpentDraw(g, p, x, true);
    const b = seg(p.t, 0.72, 0.95);
    if (b > 0 && b < 1) { sparks(g, x.seed + 6, b, 50, x.loserX, x.groundY - 100, 500, GOLD, 0.9); ring(g, x.loserX, x.groundY - 100, b * 520, 8 * (1 - b) + 2, GOLD, 1 - b); }
  },
};

/* -------------------------------------------------------------- tiger */
export function clawSlash(g: G, x0: number, y0: number, x1: number, y1: number, prog: number, color: number, alpha: number) {
  if (prog <= 0) return;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let c = -1; c <= 1; c++) {
    const off = c * 26, bow = 34;
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = (i / 10) * prog, b = Math.sin(u * Math.PI) * bow;
      pts.push(x0 + dx * u + nx * (off + b), y0 + dy * u + ny * (off + b));
    }
    path(g, pts, 14, color, alpha * 0.25);
    path(g, pts, 6, lighten(color, 0.5), alpha * 0.8);
    path(g, pts, 2, 0xffffff, alpha);
  }
}
const tiger: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.1, 0.3)) * (1 - seg(p.t, 0.78, 0.9));
    if (k <= 0) return;
    const prog = seg(p.t, 0.15, 0.7);
    const tx = lerp(x.winnerX - x.facing * 100, x.loserX - x.facing * 160, easeIO(prog));
    glow(g, tx, x.groundY - 230, 520, x.c1, 0.16 * k);
    tigerShape(g, tx, x.groundY - 220 + Math.sin(prog * 20) * 6, 2.0, x.facing, mix(x.c1, 0xff7a00, 0.5), 0.3 * k, 0x2a0a00);
    // eyes
    circ(g, tx + x.facing * 370, x.groundY - 320, 9, 0xffee88, 0.8 * k);
  },
  front(g, p, x) {
    const slashes: [number, number, number, number, number][] = [
      [0.3, -1, -1, 1, 1], [0.38, 1, -1, -1, 1], [0.46, -1, 0, 1, 0.5], [0.54, 1, 0.4, -1, -0.4], [0.62, -1, -1, 1, 1],
    ];
    const cy = x.groundY - 130;
    for (const [ts, sx, sy, ex, ey] of slashes) {
      const w = seg(p.t, ts, ts + 0.06), fade = 1 - seg(p.t, ts + 0.06, ts + 0.2);
      if (w <= 0 || fade <= 0) continue;
      clawSlash(g, x.loserX + sx * 190, cy + sy * 190, x.loserX + ex * 190, cy + ey * 190, easeOut(w), mix(x.c1, 0xffa030, 0.5), fade);
    }
    const f = seg(p.t, 0.7, 0.95);
    if (f > 0 && f < 1) {
      for (let i = 0; i < 16; i++) {
        const fx = x.loserX + (i - 7.5) * 30, hh = (150 + hash(x.seed, i, 131) * 220) * Math.sin(f * Math.PI) * (1 - Math.abs(i - 7.5) / 11);
        const wob = Math.sin(p.t * 50 + i * 2) * 10;
        poly(g, [fx - 26, x.groundY, fx + wob, x.groundY - hh, fx + 26, x.groundY], 0xe02a00, 0.55);
        poly(g, [fx - 16, x.groundY, fx + wob * 0.7, x.groundY - hh * 0.72, fx + 16, x.groundY], 0xff8a1a, 0.7);
        poly(g, [fx - 7, x.groundY, fx + wob * 0.3, x.groundY - hh * 0.4, fx + 7, x.groundY], 0xfff0a0, 0.85);
      }
      glow(g, x.loserX, x.groundY - 100, 80 + f * 260, 0xff6a10, 0.5 * (1 - f));
    }
  },
};

/* ------------------------------------------------------------ balance */
const balance: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.08, 0.35)) * (1 - seg(p.t, 0.88, 1));
    if (k <= 0) return;
    const cx = x.loserX, cy = 120 - (1 - k) * 200, gc = 0xe0b040;
    glow(g, cx, cy, 380, GOLD, 0.2 * k);
    const tilt = Math.sin(seg(p.t, 0.2, 0.55) * Math.PI * 2.2) * 0.12 * (1 - seg(p.t, 0.55, 0.7)) + easeOut(seg(p.t, 0.55, 0.75)) * 0.22 * x.facing;
    const R = 270, ca = Math.cos(tilt), sa = Math.sin(tilt), a = 0.85 * k;
    rect(g, cx - 8, cy, 16, 160, darken(gc, 0.2), a * 0.6);
    line(g, cx - R * ca, cy - R * sa, cx + R * ca, cy + R * sa, 12, gc, a);
    circ(g, cx, cy, 20, lighten(gc, 0.3), a);
    poly(g, [cx - 14, cy - 80, cx + 14, cy - 80, cx + 6, cy, cx - 6, cy], gc, a);
    for (const s of [-1, 1]) {
      const px = cx + s * R * ca, py = cy + s * R * sa, dropY = py + 200;
      line(g, px, py, px - 90, dropY, 3, gc, a);
      line(g, px, py, px + 90, dropY, 3, gc, a);
      ell(g, px, dropY + 6, 200, 30, gc, a);
      ell(g, px, dropY + 2, 180, 18, lighten(gc, 0.45), a * 0.8);
      circ(g, px, py, 10, lighten(gc, 0.4), a);
    }
  },
  front(g, p, x) {
    const b = seg(p.t, 0.58, 0.8);
    if (b > 0) {
      const a = Math.min(1, b * 3) * (1 - seg(p.t, 0.84, 0.92));
      column(g, x.loserX, 0, x.groundY, 180 * (0.4 + b * 0.6), GOLD, a);
      glow(g, x.loserX, x.groundY - 20, 160 * b, 0xffffff, 0.5 * a);
    }
  },
};

/* ------------------------------------------------------------ letters */
function glyph(g: G, x: number, y: number, s: number, seed: number, i: number, color: number, alpha: number) {
  const strokes = 1 + Math.floor(hash(seed, i, 141) * 3);
  for (let st = 0; st < strokes; st++) {
    const pts: number[] = [];
    const ph = hash(seed, i * 5 + st, 142) * 6, fr = 1 + hash(seed, i * 5 + st, 143) * 2;
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      pts.push(x + (u - 0.5) * 26 * s + Math.sin(u * fr * 3 + ph) * 8 * s + st * 5 * s, y + Math.cos(u * 3.3 + ph) * 14 * s - st * 6 * s);
    }
    path(g, pts, 7 * s, color, alpha * 0.2);
    path(g, pts, 2.6 * s, lighten(color, 0.6), alpha);
  }
  if (hash(seed, i, 144) > 0.5) circ(g, x + 10 * s, y - 20 * s, 2.5 * s, 0xffffff, alpha);
}
const letters: FxLayer = {
  back(g, p, x) { glow(g, x.winnerX + x.facing * 120, x.groundY - 220, 380 * easeOut(seg(p.t, 0.1, 0.4)), GOLD, 0.13 * p.env); },
  front(g, p, x) {
    const N = 44;
    const write = seg(p.t, 0.12, 0.55), orbit = seg(p.t, 0.52, 0.78);
    const out = 1 - seg(p.t, 0.84, 0.95);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      if (write < u) continue;
      const row = Math.floor(u * 4), col = (i % 11);
      const hx = x.winnerX + x.facing * (80 + col * 34) + Math.sin(p.t * 6 + i) * 4;
      const hy = x.groundY - 380 + row * 52 + Math.cos(p.t * 5 + i) * 4;
      const ang = u * 12.56 + p.t * (6 + orbit * 14), R = lerp(260, 80 + (i % 5) * 26, orbit);
      const ox = x.loserX + Math.cos(ang) * R, oy = x.groundY - 100 + Math.sin(ang) * R * 0.75 - 40 + (u - 0.5) * 140;
      const e = easeIO(orbit);
      const born = clamp((write - u) * 12);
      glyph(g, lerp(hx, ox, e), lerp(hy, oy, e), 1.1 + e * 0.5, x.seed, i, mix(GOLD, 0xfff2c0, hash(x.seed, i, 145)), born * out);
    }
    if (p.c > 0 && p.c < 1) {
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * 6.283 + p.t * 8;
        beam(g, x.loserX + Math.cos(ang) * 60, x.groundY - 100 + Math.sin(ang) * 60, x.loserX + Math.cos(ang) * (60 + p.c * 500), x.groundY - 100 + Math.sin(ang) * (60 + p.c * 500), 3, GOLD, 1 - p.c);
      }
    }
  },
};

export const LAYERS_A: Record<string, FxLayer> = {
  army, cavalry, blizzard, condor: condorFx, bell: bellFx, fist, throne, map: mapFx, serpent, tiger, balance, letters,
};
export { speedLines, cavalryRun, lightning, serpentPts, snow, bump, easeIn };
