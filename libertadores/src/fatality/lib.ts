import type Phaser from 'phaser';
import type { AnimName } from '../combat/types';

export type G = Phaser.GameObjects.Graphics;

export interface FxCtx {
  w: number; h: number; groundY: number; winnerX: number; loserX: number;
  facing: 1 | -1; c1: number; c2: number; seed: number;
}
export interface ActorPose {
  dx: number; dy: number; anim: AnimName; alpha: number; dissolve: number;
  shake: number; flip?: boolean; scale?: number; hidden?: boolean;
}

/** Phase helper bundle computed once per frame. */
export interface Ph {
  t: number;
  a: number;  // anticipation 0..1 over 0-0.15
  m: number;  // main 0..1 over 0.15-0.7
  c: number;  // climax 0..1 over 0.7-0.85
  f: number;  // aftermath 0..1 over 0.85-1
  /** overall intensity envelope (fades in, stays, fades during aftermath) */
  env: number;
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeOut = (k: number) => 1 - (1 - k) * (1 - k) * (1 - k);
export const easeIn = (k: number) => k * k * k;
export const easeIO = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const bump = (t: number, a: number, b: number, c: number, d: number) =>
  Math.min(seg(t, a, b), 1 - seg(t, c, d));

export function makePh(t: number): Ph {
  const a = seg(t, 0, 0.15), m = seg(t, 0.15, 0.7), c = seg(t, 0.7, 0.85), f = seg(t, 0.85, 1);
  return { t, a, m, c, f, env: Math.min(seg(t, 0, 0.12), 1 - seg(t, 0.88, 1)) };
}

/** deterministic hash -> [0,1) */
export function hash(seed: number, i: number, k = 0): number {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(i | 0, 668265263) + Math.imul(k | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function mix(c1: number, c2: number, k: number): number {
  const r = Math.round(lerp((c1 >> 16) & 255, (c2 >> 16) & 255, k));
  const g = Math.round(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, k));
  const b = Math.round(lerp(c1 & 255, c2 & 255, k));
  return (r << 16) | (g << 8) | b;
}
export const lighten = (c: number, k: number) => mix(c, 0xffffff, k);
export const darken = (c: number, k: number) => mix(c, 0x000000, k);

export function poly(g: G, pts: number[], color: number, alpha: number) {
  if (alpha <= 0.002 || pts.length < 6) return;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillPath();
}
export function line(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number, alpha: number) {
  if (alpha <= 0.002) return;
  g.lineStyle(w, color, alpha);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokePath();
}
export function path(g: G, pts: number[], w: number, color: number, alpha: number, close = false) {
  if (alpha <= 0.002 || pts.length < 4) return;
  g.lineStyle(w, color, alpha);
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
  g.strokePath();
}
export function rect(g: G, x: number, y: number, w: number, h: number, color: number, alpha: number) {
  if (alpha <= 0.002) return;
  g.fillStyle(color, alpha);
  g.fillRect(x, y, w, h);
}
export function circ(g: G, x: number, y: number, r: number, color: number, alpha: number) {
  if (alpha <= 0.002 || r <= 0) return;
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
}
export function ell(g: G, x: number, y: number, w: number, h: number, color: number, alpha: number) {
  if (alpha <= 0.002) return;
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y, w, h);
}
/** soft additive-looking glow: stacked circles */
export function glow(g: G, x: number, y: number, r: number, color: number, alpha: number, layers = 9) {
  if (alpha <= 0.002 || r <= 0) return;
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1);
    g.fillStyle(i === layers - 1 ? lighten(color, 0.6) : color, alpha * (0.05 + 0.1 * k));
    g.fillCircle(x, y, r * (1 - k * 0.85));
  }
}
export function ring(g: G, x: number, y: number, r: number, w: number, color: number, alpha: number, ry = 1) {
  if (alpha <= 0.002 || r <= 0) return;
  g.lineStyle(w, color, alpha);
  if (ry === 1) g.strokeCircle(x, y, r);
  else g.strokeEllipse(x, y, r * 2, r * 2 * ry);
}
/** thick glowing line */
export function beam(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number, alpha: number) {
  line(g, x1, y1, x2, y2, w * 2.6, color, alpha * 0.18);
  line(g, x1, y1, x2, y2, w * 1.6, color, alpha * 0.35);
  line(g, x1, y1, x2, y2, w, lighten(color, 0.5), alpha * 0.8);
  line(g, x1, y1, x2, y2, w * 0.4, 0xffffff, alpha);
}
/** vertical column of light */
export function column(g: G, x: number, top: number, bot: number, w: number, color: number, alpha: number) {
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    const ww = w * (1 - k * 0.7);
    rect(g, x - ww / 2, top, ww, bot - top, i === 3 ? 0xffffff : lighten(color, k * 0.5), alpha * (0.12 + 0.22 * k));
  }
}

/** rising/falling embers. dir: -1 up. Deterministic. */
export function embers(
  g: G, seed: number, k: number, n: number, cx: number, cy: number, spreadX: number, spreadY: number,
  rise: number, color: number, alpha: number, sz = 3,
) {
  if (alpha <= 0.01 || k <= 0) return;
  for (let i = 0; i < n; i++) {
    const d = hash(seed, i, 1), life = clamp(k * 1.4 - d * 0.4);
    if (life <= 0 || life >= 1) continue;
    const x = cx + (hash(seed, i, 2) - 0.5) * spreadX + Math.sin(life * 6 + i) * 14 * life;
    const y = cy + (hash(seed, i, 3) - 0.5) * spreadY - life * rise * (0.5 + hash(seed, i, 4));
    const a = alpha * Math.sin(life * Math.PI);
    const s = sz * (0.5 + hash(seed, i, 5)) * (1 - life * 0.5);
    circ(g, x, y, s * 2.2, color, a * 0.25);
    circ(g, x, y, s, lighten(color, 0.5), a);
  }
}

export function sparks(
  g: G, seed: number, k: number, n: number, cx: number, cy: number, dist: number, color: number, alpha: number,
) {
  if (k <= 0 || k >= 1) return;
  for (let i = 0; i < n; i++) {
    const ang = hash(seed, i, 11) * Math.PI * 2, sp = 0.4 + hash(seed, i, 12);
    const d0 = easeOut(k) * dist * sp, d1 = easeOut(Math.max(0, k - 0.08)) * dist * sp;
    line(g, cx + Math.cos(ang) * d1, cy + Math.sin(ang) * d1, cx + Math.cos(ang) * d0, cy + Math.sin(ang) * d0,
      2, lighten(color, 0.4), alpha * (1 - k));
  }
}

export function dust(g: G, seed: number, k: number, n: number, x0: number, x1: number, y: number, alpha: number, color = 0x8a7a60) {
  if (alpha <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const life = (k * 2 + hash(seed, i, 21)) % 1;
    const x = lerp(x0, x1, hash(seed, i, 22)) + life * 30;
    const yy = y - life * (20 + hash(seed, i, 23) * 40);
    circ(g, x, yy, 8 + life * 22, color, alpha * 0.25 * (1 - life));
  }
}

export function snow(g: G, seed: number, time: number, n: number, w: number, h: number, wind: number, alpha: number, color = 0xeaf6ff) {
  if (alpha <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + hash(seed, i, 31) * 1.4;
    const x0 = hash(seed, i, 32) * (w + 400) - 200;
    const x = (x0 + time * wind * sp * 900) % (w + 400) - 200;
    const y = ((hash(seed, i, 33) + time * sp * 2.2) % 1) * h;
    const L = wind * sp * 14;
    if (hash(seed, i, 34) > 0.55) line(g, x, y, x - L, y - L * 0.25, 1.6, color, alpha * 0.8);
    else circ(g, x, y, 1 + hash(seed, i, 35) * 2, color, alpha);
  }
}

export function lightning(
  g: G, seed: number, x: number, y0: number, y1: number, color: number, alpha: number, branches = 3, w = 3,
) {
  if (alpha <= 0.01) return;
  const pts: number[] = [x, y0];
  const n = 12;
  let cx = x;
  for (let i = 1; i <= n; i++) {
    cx += (hash(seed, i, 41) - 0.5) * 70;
    pts.push(cx, lerp(y0, y1, i / n));
  }
  path(g, pts, w * 4, color, alpha * 0.2);
  path(g, pts, w * 2, color, alpha * 0.5);
  path(g, pts, w, 0xffffff, alpha);
  for (let b = 0; b < branches; b++) {
    const si = 2 + Math.floor(hash(seed, b, 42) * (n - 4));
    const bp: number[] = [pts[si * 2], pts[si * 2 + 1]];
    const dir = hash(seed, b, 43) > 0.5 ? 1 : -1;
    let bx = bp[0], by = bp[1];
    for (let j = 0; j < 5; j++) {
      bx += dir * (14 + hash(seed, b * 9 + j, 44) * 30);
      by += 14 + hash(seed, b * 9 + j, 45) * 26;
      bp.push(bx, by);
    }
    path(g, bp, w * 1.6, color, alpha * 0.4);
    path(g, bp, w * 0.6, 0xffffff, alpha * 0.9);
  }
}

/* ---------------------------------------------------------- silhouettes */

export function soldier(g: G, x: number, y: number, s: number, dir: number, color: number, alpha: number, flag = false) {
  // y = feet
  const h = 70 * s;
  rect(g, x - 7 * s, y - h * 0.55, 14 * s, h * 0.55, color, alpha); // legs/coat
  poly(g, [x - 9 * s, y - h * 0.55, x + 9 * s, y - h * 0.55, x + 7 * s, y - h * 0.92, x - 7 * s, y - h * 0.92], color, alpha);
  circ(g, x, y - h * 0.98, 6 * s, color, alpha);
  rect(g, x - 7 * s, y - h * 1.16, 14 * s, 9 * s, color, alpha); // shako
  line(g, x - dir * 8 * s, y - h * 0.3, x + dir * 26 * s, y - h * 1.1, 2.2 * s, color, alpha);
  if (flag) {
    line(g, x - dir * 4 * s, y, x - dir * 4 * s, y - h * 2.0, 2.4 * s, color, alpha);
    poly(g, [x - dir * 4 * s, y - h * 2.0, x - dir * 4 * s + dir * 34 * s, y - h * 1.85, x - dir * 4 * s, y - h * 1.65], color, alpha * 0.9);
  }
}

export function rider(g: G, x: number, y: number, s: number, dir: number, color: number, alpha: number, ph: number, lance = true) {
  // y = hoof baseline; dir = travel direction
  const bob = Math.sin(ph * 6.283) * 4 * s;
  const by = y - 52 * s + bob;
  ell(g, x, by, 74 * s, 30 * s, color, alpha);               // body
  ell(g, x - dir * 26 * s, by - 2 * s, 34 * s, 28 * s, color, alpha); // haunch
  poly(g, [x + dir * 24 * s, by - 6 * s, x + dir * 50 * s, by - 34 * s, x + dir * 62 * s, by - 28 * s, x + dir * 36 * s, by + 8 * s], color, alpha); // neck
  poly(g, [x + dir * 50 * s, by - 34 * s, x + dir * 78 * s, by - 20 * s, x + dir * 74 * s, by - 12 * s, x + dir * 56 * s, by - 24 * s], color, alpha); // head
  for (let i = 0; i < 4; i++) { // gallop legs
    const p = ph * 6.283 + i * 1.6;
    const lx = x + (i < 2 ? dir * 26 : -dir * 26) * s + (i % 2) * dir * 6 * s;
    const sw = Math.sin(p) * 18 * s;
    line(g, lx, by + 8 * s, lx + sw * dir, y - Math.max(0, -Math.cos(p)) * 10 * s, 8 * s, color, alpha);
  }
  line(g, x - dir * 40 * s, by - 6 * s, x - dir * 62 * s, by + 8 * s + bob, 5 * s, color, alpha * 0.8); // tail
  rect(g, x - 6 * s, by - 46 * s, 12 * s, 30 * s, color, alpha); // rider torso
  circ(g, x, by - 52 * s, 7 * s, color, alpha);
  if (lance) line(g, x - dir * 30 * s, by - 20 * s, x + dir * 120 * s, by - 52 * s, 3 * s, color, alpha);
}

export function condor(g: G, x: number, y: number, s: number, flap: number, color: number, alpha: number, head = true) {
  const f = Math.sin(flap * 6.283) * 0.35;
  for (const side of [-1, 1]) {
    const tipY = y - 170 * s * (0.4 + f), tipX = x + side * 340 * s;
    const pts: number[] = [x, y - 20 * s, x + side * 90 * s, y - 80 * s * (1 + f), x + side * 220 * s, lerp(y - 60 * s, tipY, 0.55), tipX, tipY];
    for (let i = 0; i <= 8; i++) { // scalloped trailing edge of feathers
      const k = 1 - i / 8;
      const fx = x + side * lerp(30, 330, k) * s, base = lerp(y + 20 * s, tipY + 30 * s, k);
      pts.push(fx + side * 8 * s, base + (i % 2 ? 40 : 95) * s * (0.5 + k * 0.6));
    }
    poly(g, pts, color, alpha);
    for (let i = 0; i < 8; i++) {
      const k = i / 7;
      const fx = x + side * lerp(60, 320, k) * s, fy = lerp(y - 10 * s, tipY + 10 * s, k);
      line(g, fx, fy, fx + side * 6 * s, fy + (80 + 40 * (1 - k)) * s, 3 * s, lighten(color, 0.3), alpha * 0.6);
    }
  }
  poly(g, [x - 24 * s, y - 24 * s, x + 24 * s, y - 24 * s, x + 16 * s, y + 70 * s, x, y + 120 * s, x - 16 * s, y + 70 * s], color, alpha);
  if (head) {
    ell(g, x, y - 38 * s, 40 * s, 30 * s, 0xf4f4f4, alpha * 0.9);
    circ(g, x, y - 54 * s, 15 * s, color, alpha);
    poly(g, [x - 6 * s, y - 54 * s, x + 6 * s, y - 54 * s, x, y - 34 * s], lighten(color, 0.5), alpha);
  }
}

export function tigerShape(g: G, x: number, y: number, s: number, dir: number, color: number, alpha: number, stripe: number) {
  ell(g, x, y, 260 * s, 110 * s, color, alpha);                     // torso
  ell(g, x - dir * 90 * s, y - 6 * s, 110 * s, 96 * s, color, alpha); // haunch
  ell(g, x + dir * 120 * s, y - 24 * s, 100 * s, 90 * s, color, alpha); // shoulder
  circ(g, x + dir * 176 * s, y - 44 * s, 44 * s, color, alpha);       // head
  poly(g, [x + dir * 160 * s, y - 78 * s, x + dir * 168 * s, y - 108 * s, x + dir * 184 * s, y - 80 * s], color, alpha);
  poly(g, [x + dir * 188 * s, y - 80 * s, x + dir * 200 * s, y - 108 * s, x + dir * 210 * s, y - 74 * s], color, alpha);
  for (const lx of [-120, -70, 80, 130]) { // legs
    const ph = lx * 0.1;
    poly(g, [x + dir * lx * s - 18 * s, y + 30 * s, x + dir * lx * s + 18 * s, y + 30 * s, x + dir * (lx + 10 + Math.sin(ph) * 8) * s + 12 * s, y + 110 * s, x + dir * (lx + 10) * s - 14 * s, y + 110 * s], color, alpha);
  }
  path(g, [x - dir * 130 * s, y - 20 * s, x - dir * 220 * s, y - 50 * s, x - dir * 270 * s, y - 20 * s, x - dir * 300 * s, y - 70 * s], 14 * s, color, alpha); // tail
  for (let i = 0; i < 7; i++) { // stripes
    const sx = x + dir * (-110 + i * 38) * s;
    poly(g, [sx, y - 54 * s, sx + 10 * s, y - 54 * s, sx + 22 * s, y, sx + 4 * s, y + 6 * s], stripe, alpha * 0.8);
  }
  circ(g, x + dir * 188 * s, y - 52 * s, 5 * s, 0xffffff, alpha); // eye
}

export function serpentPts(cx: number, cy: number, len: number, amp: number, k: number, n: number, ph: number, coil = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = cx + (u - 0.5) * len * k + Math.sin(u * 9 + ph) * amp * 0.3;
    const y = cy + Math.sin(u * 9 + ph) * amp * (1 - coil) - u * 0;
    pts.push(x, y);
  }
  return pts;
}

export function bell(g: G, x: number, y: number, s: number, ang: number, color: number, alpha: number) {
  // y = top anchor. bell hangs and swings by ang
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (px: number, py: number): [number, number] => [x + (px * ca - py * sa) * s, y + (px * sa + py * ca) * s];
  const outline = [[-18, 0], [18, 0], [30, 50], [58, 150], [96, 210], [118, 250], [-118, 250], [-96, 210], [-58, 150], [-30, 50]];
  const pts: number[] = [];
  for (const [px, py] of outline) pts.push(...P(px, py));
  poly(g, pts, color, alpha);
  const hi: number[] = [];
  for (const [px, py] of [[-8, 10], [10, 10], [24, 60], [44, 150], [40, 150], [-4, 60]]) hi.push(...P(px, py));
  poly(g, hi, lighten(color, 0.5), alpha * 0.5);
  for (const yy of [170, 200]) { // bands
    const [ax, ay] = P(-96 + (yy - 170) * 0.9, yy), [bx, by] = P(96 - (yy - 170) * 0.9, yy);
    line(g, ax, ay, bx, by, 6 * s, lighten(color, 0.4), alpha * 0.8);
  }
  const [cx, cy] = P(0, 262);
  circ(g, cx, cy, 20 * s, darken(color, 0.2), alpha); // clapper
  const [tx, ty] = P(0, 0);
  line(g, tx, ty, tx, ty - 600, 10, darken(color, 0.4), alpha * 0.8);
}
