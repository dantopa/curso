// Procedural skeletal fighter renderer (Phaser Graphics only, no textures).
// Pose-driven: every animation produces a Pose (hip, lean, hand/foot targets, weapon angle) and the
// figure is rebuilt each frame with 2-bone IK limbs, layered outlined shapes and period costume.
import Phaser from 'phaser';
import type { FighterView, CharacterDef, AnimName, CharArt, WeaponKind } from '../combat/types';
import { ARENA } from '../combat/types';

export interface DrawOpts {
  alpha?: number;
  flash?: number;
  scale?: number;
  shadow?: boolean;
  tint?: number;
  xOffset?: number;
  yOffset?: number;
  pose?: AnimName;
}

type Gfx = Phaser.GameObjects.Graphics;
interface Pt { x: number; y: number }

/* ------------------------------------------------------------------ math */
const PI = Math.PI;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mixc(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
const lighten = (c: number, t: number) => mixc(c, 0xffffff, t);
const darken = (c: number, t: number) => mixc(c, 0x000000, t);
function wrapA(a: number): number { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }

/* ------------------------------------------------------------ draw state */
let G!: Gfx;
let OX = 0, OY = 0, SC = 1, FC = 1, AL = 1, FL = 0, TN = -1;
let RC = 1, RS = 0, PVX = 0, PVY = -80;
let PX = 0, PY = 0;
let CLK = 0;

function pt(x: number, y: number): void {
  if (RS !== 0) {
    const dx = x - PVX, dy = y - PVY;
    const rx = PVX + dx * RC - dy * RS, ry = PVY + dx * RS + dy * RC;
    PX = OX + FC * rx * SC; PY = OY + ry * SC;
  } else { PX = OX + FC * x * SC; PY = OY + y * SC; }
}
function fc(c: number): number {
  if (TN >= 0) c = mixc(c, TN, 0.45);
  return FL > 0 ? mixc(c, 0xffffff, FL * 0.85) : c;
}
function fill(c: number, a = 1): void { G.fillStyle(fc(c), a * AL); }

const scr: Pt[] = [];
function loadPts(p: number[]): number {
  const n = p.length >> 1;
  for (let i = 0; i < n; i++) {
    pt(p[2 * i], p[2 * i + 1]);
    let q = scr[i];
    if (!q) { q = { x: 0, y: 0 }; scr[i] = q; }
    q.x = PX; q.y = PY;
  }
  return n;
}
function isConvex(n: number): boolean {
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = scr[i], b = scr[(i + 1) % n], c = scr[(i + 2) % n];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cr) < 1e-6) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
function earClip(n: number): void {
  const idx: number[] = [];
  let area = 0;
  for (let i = 0; i < n; i++) { idx.push(i); const a = scr[i], b = scr[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const sgn = area > 0 ? 1 : -1;
  let guard = 0;
  while (idx.length > 3 && guard++ < 200) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const a = scr[ia], b = scr[ib], c = scr[ic];
      const cr = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cr * sgn <= 0) continue;
      let inside = false;
      for (let m = 0; m < idx.length; m++) {
        const im = idx[m];
        if (im === ia || im === ib || im === ic) continue;
        const p = scr[im];
        const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
        const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
        const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) { inside = true; break; }
      }
      if (inside) continue;
      G.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) {
    const a = scr[idx[0]], b = scr[idx[1]], c = scr[idx[2]];
    G.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  }
}
/** fill polygon (local coords, flat array). outline>0 draws a darker edge line. */
function poly(p: number[], c: number, a = 1, outline = 0): void {
  const n = loadPts(p);
  if (n < 3) return;
  fill(c, a);
  if (isConvex(n)) G.fillPoints(scr, true, true, n); else earClip(n);
  if (outline > 0) {
    G.lineStyle(outline * SC, fc(darken(c, 0.62)), a * AL);
    G.strokePoints(scr, true, true, n);
  }
}
function circ(x: number, y: number, r: number, c: number, a = 1): void {
  pt(x, y); fill(c, a); G.fillCircle(PX, PY, Math.max(0.4, r * SC));
}
function line(x1: number, y1: number, x2: number, y2: number, w: number, c: number, a = 1): void {
  pt(x1, y1); const ax = PX, ay = PY; pt(x2, y2);
  G.lineStyle(Math.max(0.6, w * SC), fc(c), a * AL);
  G.lineBetween(ax, ay, PX, PY);
}
function cap(x1: number, y1: number, x2: number, y2: number, w: number, c: number, a = 1): void {
  line(x1, y1, x2, y2, w, c, a); circ(x1, y1, w / 2, c, a); circ(x2, y2, w / 2, c, a);
}
function ellPts(cx: number, cy: number, rx: number, ry: number, n = 12, rot = 0, a0 = 0, a1 = PI * 2): number[] {
  const o: number[] = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    o.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
  }
  if (a1 - a0 >= PI * 2 - 0.001) { o.length -= 2; }
  return o;
}
function ell(cx: number, cy: number, rx: number, ry: number, c: number, a = 1, rot = 0, outline = 0): void {
  poly(ellPts(cx, cy, rx, ry, 12, rot), c, a, outline);
}
function ring(cx: number, cy: number, rx: number, ry: number, w: number, c: number, a = 1, rot = 0): void {
  const n = loadPts(ellPts(cx, cy, rx, ry, 16, rot));
  G.lineStyle(Math.max(0.6, w * SC), fc(c), a * AL);
  G.strokePoints(scr, true, true, n);
}
function polyline(p: number[], w: number, c: number, a = 1): void {
  const n = loadPts(p);
  G.lineStyle(Math.max(0.6, w * SC), fc(c), a * AL);
  G.strokePoints(scr, false, false, n);
}

/* -------------------------------------------------------------------- IK */
let KX = 0, KY = 0, EX = 0, EY = 0;
function ik(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, bx_: number, by_: number): void {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.5;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  if (d < 6) { d = 6; dx = 0; dy = 6; }
  EX = ax + dx; EY = ay + dy;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + dx * a / d, my = ay + dy * a / d;
  const px = -dy / d, py = dx / d;
  const k1x = mx + px * h, k1y = my + py * h;
  const k2x = mx - px * h, k2y = my - py * h;
  if ((k1x - mx) * bx_ + (k1y - my) * by_ >= (k2x - mx) * bx_ + (k2y - my) * by_) { KX = k1x; KY = k1y; } else { KX = k2x; KY = k2y; }
}
function limb3(ax: number, ay: number, kx: number, ky: number, ex: number, ey: number, w1: number, w2: number, c: number, c2: number, hl: boolean): void {
  const d = darken(c, 0.62), d2 = darken(c2, 0.62);
  line(ax, ay, kx, ky, w1 + 3.2, d); line(kx, ky, ex, ey, w2 + 3.2, d2);
  circ(ax, ay, (w1 + 3.2) / 2, d); circ(kx, ky, (Math.max(w1, w2) + 3.2) / 2, d); circ(ex, ey, (w2 + 3.2) / 2, d2);
  line(ax, ay, kx, ky, w1, c); line(kx, ky, ex, ey, w2, c2);
  circ(ax, ay, w1 / 2, c); circ(kx, ky, Math.max(w1, w2) / 2, c); circ(ex, ey, w2 / 2, c2);
  if (hl) {
    const sx = kx - ax, sy = ky - ay, sl = Math.hypot(sx, sy) || 1;
    let nx = -sy / sl, ny = sx / sl;
    if (nx * 0.5 - ny * 0.85 < 0) { nx = -nx; ny = -ny; }
    const o = w1 * 0.26;
    line(ax + nx * o, ay + ny * o, kx + nx * o, ky + ny * o, 2.6, lighten(c, 0.35), 0.55);
  }
}

/* ------------------------------------------------------------------ pose */
interface Pose {
  hx: number; hy: number; lean: number; tilt: number;
  afx: number; afy: number; abx: number; aby: number;
  lfx: number; lfy: number; lbx: number; lby: number;
  rot: number; wa: number; wl: number; glow: number; two: number; kup: number; expr: number;
}
const PK: (keyof Pose)[] = ['hx', 'hy', 'lean', 'tilt', 'afx', 'afy', 'abx', 'aby', 'lfx', 'lfy', 'lbx', 'lby', 'rot', 'wa', 'wl', 'glow', 'two', 'kup', 'expr'];
const DEF: Pose = {
  hx: 0, hy: -80, lean: 0.07, tilt: 0, afx: 26, afy: 30, abx: 8, aby: 34,
  lfx: 21, lfy: 0, lbx: -21, lby: 0, rot: 0, wa: 0.55, wl: 1, glow: 0, two: 1, kup: 0, expr: 0,
};
const mk = (o: Partial<Pose>): Pose => ({ ...DEF, ...o });
function lp(a: Pose, b: Pose, t: number): Pose {
  const r = {} as Pose;
  for (const k of PK) r[k] = a[k] + (b[k] - a[k]) * t;
  return r;
}

const TORSO = 54, THIGH = 42, SHIN = 42, UARM = 32, FARM = 32;
const WLEN: Record<WeaponKind, number> = {
  sabre: 64, curvedSabre: 62, sword: 74, spear: 94, lasso: 40, facon: 30, pistolSword: 70,
  sling: 30, pen: 80, ceremonial: 90, club: 58, fists: 10,
};
const THRUST: WeaponKind[] = ['sword', 'pistolSword', 'spear', 'facon', 'pen', 'ceremonial', 'lasso', 'sling', 'fists'];
const TWOH: WeaponKind[] = ['spear', 'ceremonial'];

function shoulderOf(p: Pose): [number, number] { return [p.hx + Math.sin(p.lean) * TORSO, p.hy - Math.cos(p.lean) * TORSO]; }
function handOf(p: Pose): [number, number] {
  const [sx, sy] = shoulderOf(p);
  let dx = p.afx, dy = p.afy;
  const d = Math.hypot(dx, dy), m = UARM + FARM - 1;
  if (d > m) { dx *= m / d; dy *= m / d; }
  return [sx + dx, sy + dy];
}
function tipOf(p: Pose, w: WeaponKind): [number, number] {
  const [hx, hy] = handOf(p);
  const L = WLEN[w] * (w === 'fists' ? 1 : p.wl);
  return [hx + Math.cos(p.wa) * L, hy - Math.sin(p.wa) * L];
}

interface Trail { w: Pose; h: Pose; prog: number; al: number; kind: number }
let TRL: Trail | null = null;

function atkStage(f: FighterView): [number, number] {
  if (f.phase) return [f.phase === 'startup' ? 0 : f.phase === 'active' ? 1 : 2, clamp(f.phaseT, 0, 1)];
  const u = f.animT > 0 ? f.animT : f.animLen > 0 ? clamp(f.animFrame / f.animLen, 0, 1) : (f.animFrame % 36) / 36;
  if (u < 0.35) return [0, u / 0.35];
  if (u < 0.6) return [1, (u - 0.35) / 0.25];
  return [2, (u - 0.6) / 0.4];
}
function strikeAnim(f: FighterView, rest: Pose, wind: Pose, hit: Pose, kind: number): Pose {
  const [st, t] = atkStage(f);
  if (st === 0) { TRL = { w: wind, h: hit, prog: 0, al: 0, kind }; return lp(rest, wind, ease(t)); }
  if (st === 1) {
    const s = clamp(t * 1.5, 0, 1);
    TRL = { w: wind, h: hit, prog: s, al: 1, kind };
    return lp(wind, hit, ease(s));
  }
  TRL = { w: wind, h: hit, prog: 1, al: 1 - t, kind };
  return lp(hit, rest, ease(t));
}

function restPose(f: FighterView, art: CharArt, bob = true): Pose {
  const b = bob ? Math.sin(f.clock * 0.07) : 0;
  const w = art.weapon;
  const p = mk({ hy: -79 + b * 1.6, lean: 0.07 + b * 0.012, tilt: -0.02, afy: 30 + b * 1.5, wa: 0.55 + b * 0.03 });
  if (w === 'fists') { p.afx = 32; p.afy = 6; p.abx = 22; p.aby = 14; p.wa = 0; p.lean = 0.1; }
  else if (w === 'spear' || w === 'ceremonial') { p.afx = 30; p.afy = 20; p.wa = 1.15; }
  else if (w === 'lasso' || w === 'sling') { p.wa = 0.15; p.afx = 28; p.afy = 26; }
  else if (w === 'pen') { p.wa = 0.9; p.afx = 28; p.afy = 22; }
  else if (w === 'facon') { p.afx = 30; p.afy = 14; p.abx = 24; p.aby = 18; p.wa = 0.6; }
  return p;
}

function strikeSet(k: string, w: WeaponKind): [Pose, Pose] {
  const th = THRUST.includes(w);
  const fist = w === 'fists';
  switch (k) {
    case 'light':
      if (th) return [
        mk({ hy: -80, lean: 0.0, afx: -2, afy: 20, abx: 2, aby: 30, wa: fist ? 0 : 0.12, lfx: 14, lbx: -26 }),
        mk({ hy: -72, lean: 0.28, afx: 64, afy: 2, abx: -12, aby: 28, wa: 0, lfx: 44, lbx: -32, wl: w === 'lasso' ? 2.2 : 1, two: 1 }),
      ];
      return [
        mk({ lean: -0.1, afx: -8, afy: -34, abx: -4, aby: 20, wa: 2.0, lfx: 14, lbx: -26 }),
        mk({ hy: -74, lean: 0.24, afx: 52, afy: 14, abx: -14, aby: 26, wa: -0.5, lfx: 42, lbx: -30 }),
      ];
    case 'heavy':
      return [
        mk({ hy: -82, lean: -0.22, afx: -14, afy: -52, abx: -8, aby: -40, wa: fist ? 2.0 : 2.1, lfx: 12, lbx: -30, tilt: -0.1, wl: w === 'lasso' ? 1.4 : 1 }),
        mk({ hy: -64, lean: 0.42, afx: 46, afy: 34, abx: 30, aby: 40, wa: -1.1, lfx: 50, lbx: -36, tilt: 0.1, wl: w === 'lasso' ? 2.2 : 1 }),
      ];
    case 'cLight':
      return [
        mk({ hy: -48, lean: 0.25, afx: -4, afy: 36, abx: 6, aby: 36, wa: 0.6, lfx: 30, lbx: -26, tilt: 0.1 }),
        mk({ hy: -46, lean: 0.4, afx: 62, afy: 44, abx: -8, aby: 46, wa: -0.05, lfx: 38, lbx: -34, tilt: 0.1, wl: w === 'lasso' ? 2 : 1 }),
      ];
    case 'cHeavy':
      return [
        mk({ hy: -46, lean: 0.3, afx: 8, afy: 56, abx: 2, aby: 50, wa: -0.8, lfx: 30, lbx: -28, tilt: 0.1 }),
        mk({ hy: -68, lean: -0.12, afx: 36, afy: -56, abx: 20, aby: -30, wa: 1.3, lfx: 30, lbx: -22, tilt: -0.15 }),
      ];
    case 'airL':
      return [
        mk({ hy: -74, lean: 0.0, afx: -4, afy: 10, wa: 0.4, lfx: 16, lfy: -18, lbx: -16, lby: -10 }),
        mk({ hy: -76, lean: 0.2, afx: 58, afy: 6, wa: -0.1, lfx: 30, lfy: -22, lbx: -14, lby: -12 }),
      ];
    case 'airH':
      return [
        mk({ hy: -76, lean: -0.2, afx: -8, afy: -44, wa: 2.1, lfx: 14, lfy: -20, lbx: -12, lby: -12 }),
        mk({ hy: -72, lean: 0.38, afx: 44, afy: 36, wa: -1.0, lfx: 26, lfy: -22, lbx: -18, lby: -10 }),
      ];
    default: // 'slash' special: huge wide sweep
      return [
        mk({ hy: -78, lean: -0.3, afx: -16, afy: -22, abx: -10, aby: -10, wa: 2.2, lfx: 10, lbx: -32, tilt: -0.1 }),
        mk({ hy: -66, lean: 0.46, afx: 62, afy: 24, abx: 22, aby: 30, wa: -0.7, lfx: 54, lbx: -38, tilt: 0.1, wl: w === 'lasso' ? 2 : 1.1 }),
      ];
  }
}

const LYING = mk({ hx: 16, hy: -15, lean: -1.5, tilt: 0.1, afx: 28, afy: 6, abx: 12, aby: 14, lfx: 64, lfy: 0, lbx: 52, lby: 0, wa: 0, kup: 1, two: 0, expr: 1 });

function poseFor(f: FighterView, anim: AnimName, art: CharArt): Pose {
  TRL = null;
  const w = art.weapon;
  const clk = f.clock;
  const rest = restPose(f, art);
  const u = f.animT > 0 ? f.animT : f.animLen > 0 ? clamp(f.animFrame / f.animLen, 0, 1) : 0;
  const fr = f.animFrame;
  switch (anim) {
    case 'idle': return rest;
    case 'walkF': case 'walkB': {
      const fwd = anim === 'walkF';
      const ph = (fwd ? 1 : -0.85) * clk * 0.24;
      const s = Math.sin(ph), c = Math.cos(ph);
      const p = mk({
        hy: -80 + Math.abs(s) * 3.2, lean: fwd ? 0.13 : -0.02, tilt: fwd ? 0 : -0.04,
        lfx: 8 + s * 28, lfy: -Math.max(0, c) * 13, lbx: -8 - s * 28, lby: -Math.max(0, -c) * 13,
        afx: rest.afx + (fwd ? -s * 3 : 0), afy: rest.afy - (fwd ? 0 : 10), abx: rest.abx - s * 8, aby: rest.aby - (fwd ? 0 : 12),
        wa: fwd ? rest.wa : rest.wa + 0.3,
      });
      if (w === 'fists') { p.afx = 32; p.afy = 6; p.abx = 22; p.aby = 14; p.wa = 0; }
      return p;
    }
    case 'crouch': case 'crouchBlock': {
      const p = mk({ hy: -46, lean: 0.2, tilt: 0.05, afx: rest.afx - 2, afy: 22, abx: 10, aby: 26, lfx: 32, lbx: -28, wa: 0.4 });
      if (anim === 'crouchBlock') { p.afx = 28; p.afy = -16; p.abx = 22; p.aby = -8; p.wa = 1.45; p.lean = 0.12; p.two = 0; }
      return p;
    }
    case 'jumpUp': return mk({ hy: -76, lean: 0.04, afx: 30, afy: -2, abx: 6, aby: 6, lfx: 20, lfy: -22, lbx: -12, lby: -9, wa: 1.0, kup: 0 });
    case 'jumpDown': return mk({ hy: -82, lean: 0.0, afx: 34, afy: -16, abx: -12, aby: -18, lfx: 14, lfy: 0, lbx: -12, lby: -8, wa: 1.0 });
    case 'dash': return mk({ hy: -70, lean: 0.38, afx: 34, afy: 10, abx: -26, aby: 18, lfx: 46, lfy: -3, lbx: -42, lby: -14, wa: -0.05 });
    case 'backdash': return mk({ hy: -74, lean: -0.28, tilt: -0.1, afx: 22, afy: 4, abx: 12, aby: 10, lfx: 30, lfy: -14, lbx: -34, lby: 0, wa: 0.9, two: 0 });
    case 'lightA': { const [a, b] = strikeSet('light', w); return strikeAnim(f, rest, a, b, 1); }
    case 'heavyA': { const [a, b] = strikeSet('heavy', w); return strikeAnim(f, rest, a, b, 1); }
    case 'crouchLight': { const [a, b] = strikeSet('cLight', w); return strikeAnim(f, mk({ hy: -48, lean: 0.25, afx: 20, afy: 30, abx: 8, aby: 34, lfx: 30, lbx: -26 }), a, b, 1); }
    case 'crouchHeavy': { const [a, b] = strikeSet('cHeavy', w); return strikeAnim(f, mk({ hy: -48, lean: 0.25, afx: 20, afy: 30, abx: 8, aby: 34, lfx: 30, lbx: -26 }), a, b, 1); }
    case 'airLight': { const [a, b] = strikeSet('airL', w); return strikeAnim(f, mk({ hy: -76, lean: 0.04, afx: 30, afy: -2, abx: 6, aby: 6, lfx: 20, lfy: -22, lbx: -12, lby: -9 }), a, b, 1); }
    case 'airHeavy': { const [a, b] = strikeSet('airH', w); return strikeAnim(f, mk({ hy: -76, lean: 0.04, afx: 30, afy: -2, abx: 6, aby: 6, lfx: 20, lfy: -22, lbx: -12, lby: -9 }), a, b, 1); }
    case 'slash': { const [a, b] = strikeSet('slash', w); return strikeAnim(f, rest, a, b, 2); }
    case 'block': {
      const sh = f.animFrame < 6 ? (1 - f.animFrame / 6) * 2 : 0;
      return mk({ hx: -sh, hy: -76, lean: -0.05, tilt: 0.04, afx: 28, afy: -16, abx: 24, aby: -4, lfx: 22, lbx: -24, wa: 1.45, two: 0 });
    }
    case 'hit': {
      const t = u > 0 ? u : clamp(fr / 14, 0, 1);
      const sh = Math.sin(fr * 2.4) * 3 * (1 - t);
      return mk({ hx: -5 + sh, hy: -77, lean: -0.3, tilt: -0.42, afx: 8, afy: -4, abx: -8, aby: 14, lfx: 24, lbx: -26, wa: 1.2, two: 0, expr: 1 });
    }
    case 'launched': {
      const rr = -clamp(1.0 + f.vy * 0.045, 0.35, 1.55);
      const s = Math.sin(clk * 0.35), c = Math.cos(clk * 0.35);
      return mk({ hy: -80, lean: -0.1, tilt: -0.3, rot: rr, afx: 10 + s * 18, afy: -30 + c * 14, abx: -10 - s * 14, aby: -20 + c * 12, lfx: 22 + c * 12, lfy: -16 + s * 8, lbx: -10 - c * 10, lby: -6 + s * 8, wa: 1.0 + s * 0.4, two: 0, expr: 1 });
    }
    case 'knockdown': {
      const g = ease(fr / 9);
      const air = mk({ hy: -60, lean: -0.5, tilt: -0.3, rot: -1.0, afx: 10, afy: -20, abx: -8, aby: -10, lfx: 20, lfy: -14, lbx: -6, lby: -4, two: 0, expr: 1 });
      return lp(air, LYING, g);
    }
    case 'dead': return mk({ ...LYING, hy: -15, tilt: 0.25, afx: 22, afy: 22, abx: -2, aby: 22, lfx: 66, lbx: 56, wa: -0.1 });
    case 'getup': {
      const crouch = mk({ hx: 6, hy: -46, lean: 0.5, tilt: 0.15, afx: 30, afy: 40, abx: 20, aby: 42, lfx: 30, lbx: -22, two: 0 });
      return u < 0.5 ? lp(LYING, crouch, ease(u / 0.5)) : lp(crouch, rest, ease((u - 0.5) / 0.5));
    }
    case 'throw': {
      const [st, t] = atkStage(f);
      const reach = mk({ hy: -76, lean: 0.22, afx: 52, afy: -2, abx: 46, aby: 8, lfx: 34, lbx: -30, wa: 2.4, two: 0 });
      const toss = mk({ hy: -82, lean: -0.2, tilt: -0.08, afx: 26, afy: -62, abx: 22, aby: -56, lfx: 22, lbx: -26, wa: 2.4, two: 0 });
      if (st === 0) return lp(rest, reach, ease(t));
      if (st === 1) return lp(reach, toss, ease(t));
      return lp(toss, rest, ease(t));
    }
    case 'thrown': {
      const rr = -clamp(1.0 + f.vy * 0.05, 0.4, 1.7) + Math.sin(fr * 0.2) * 0.1;
      return mk({ hy: -80, lean: -0.35, tilt: -0.3, rot: rr, afx: -2, afy: 42, abx: -10, aby: 42, lfx: 8, lfy: -4, lbx: -8, lby: -10, wa: -0.6, two: 0, expr: 1 });
    }
    case 'cast': {
      const [st, t] = atkStage(f);
      const g = st === 0 ? ease(t) : st === 1 ? 1 : 1 - ease(t);
      const p = mk({ hy: -77, lean: -0.04, tilt: -0.08, afx: 44, afy: -22, abx: 40, aby: -10, lfx: 28, lbx: -28, wa: 0.9, two: 0, glow: g });
      return lp(rest, p, g);
    }
    case 'rush': return mk({ hy: -66, lean: 0.52, afx: 60, afy: 8, abx: -30, aby: 18, lfx: 52, lfy: -2, lbx: -46, lby: -8, wa: -0.03, glow: 0.5, wl: w === 'lasso' ? 2 : 1 });
    case 'counter': {
      const p = mk({ hy: -70, lean: -0.1, tilt: 0.04, afx: 26, afy: -18, abx: 22, aby: -6, lfx: 26, lbx: -28, wa: 1.3, two: 0, glow: 1 });
      p.hy += Math.sin(clk * 0.3) * 1;
      return p;
    }
    case 'evade': {
      const sw = Math.sin(clk * 0.22);
      return mk({ hy: -52, lean: 0.35 + sw * 0.25, tilt: 0.1, afx: 30, afy: 24, abx: 0, aby: 28, lfx: 36, lbx: -30, wa: 0.3, glow: 0.4 });
    }
    case 'aerial': {
      return mk({ hy: -90, lean: 0.55, tilt: 0.05, rot: 0.55, afx: 40, afy: 28, abx: 22, aby: 26, lfx: -2, lfy: -22, lbx: -30, lby: -38, wa: -0.9, glow: 0.5, two: 1 });
    }
    case 'intro': {
      const t = f.animLen > 0 ? u : clamp(fr / 90, 0, 1);
      const fold = mk({ hy: -80, lean: 0.02, tilt: -0.1, afx: 16, afy: 14, abx: 8, aby: 12, lfx: 24, lbx: -24, wa: -1.2, two: 0 });
      const salute = mk({ hy: -81, lean: -0.03, tilt: -0.08, afx: 20, afy: -18, abx: 6, aby: 12, lfx: 22, lbx: -22, wa: 1.5 });
      return t < 0.5 ? fold : lp(fold, salute, ease((t - 0.5) / 0.3));
    }
    case 'win': {
      const s = Math.sin(clk * 0.1);
      const p = mk({ hy: -82 + s, lean: -0.08, tilt: -0.12, afx: 22, afy: -50 + s * 2, abx: 14, aby: -30, lfx: 24, lbx: -24, wa: 1.3 + s * 0.08, two: 1 });
      if (w === 'fists') { p.wa = 0; p.afx = 18; p.abx = 6; p.aby = -48; }
      else if (w === 'spear' || w === 'ceremonial') { p.wa = 1.55; p.afx = 14; p.afy = -44; }
      else if (w === 'pen') { p.wa = 1.2 + Math.sin(clk * 0.3) * 0.5; }
      else if (w === 'lasso') { p.wa = 1.5; p.wl = 1.6; }
      else if (w === 'sling') { p.wa = 1.5; p.wl = 1.5; }
      else if (w === 'facon') { p.abx = 16; p.aby = -46; p.two = 0; }
      return p;
    }
    case 'dazed': {
      const sw = Math.sin(clk * 0.12);
      return mk({ hx: 4 + sw * 2, hy: -40, lean: 0.38 + sw * 0.03, tilt: 0.55, afx: 22, afy: 60, abx: 12, aby: 54, lfx: 28, lbx: -32, lby: 0, wa: -0.3, two: 0, expr: 1 });
    }
    case 'buff': {
      const t = f.animLen > 0 ? u : clamp(fr / 30, 0, 1);
      const sh = Math.sin(fr * 1.7) * 1.2 * (1 - t);
      return mk({ hx: sh, hy: -74, lean: 0, tilt: -0.18, afx: 12, afy: 22, abx: -2, aby: 24, lfx: 26, lbx: -26, wa: 1.3, glow: 1, two: 0, expr: 2 });
    }
  }
  return rest;
}

/* --------------------------------------------------------------- head bits */
let HX = 0, HY = 0, HC = 1, HS = 0, HSC = 1;
function hl(dx: number, dy: number, out: number[], i: number): void {
  dx *= HSC; dy *= HSC;
  out[i] = HX + dx * HC - dy * HS; out[i + 1] = HY + dx * HS + dy * HC;
}
const hbuf: number[] = [];
function hpoly(p: number[], c: number, a = 1, outline = 0): void {
  hbuf.length = p.length;
  for (let i = 0; i < p.length; i += 2) hl(p[i], p[i + 1], hbuf, i);
  poly(hbuf, c, a, outline);
}
function hcirc(dx: number, dy: number, r: number, c: number, a = 1): void {
  hl(dx, dy, hbuf, 0); circ(hbuf[0], hbuf[1], r * HSC, c, a);
}
function hline(dx1: number, dy1: number, dx2: number, dy2: number, w: number, c: number, a = 1): void {
  hl(dx1, dy1, hbuf, 0); hl(dx2, dy2, hbuf, 2);
  line(hbuf[0], hbuf[1], hbuf[2], hbuf[3], w * HSC, c, a);
}
function hell(dx: number, dy: number, rx: number, ry: number, c: number, a = 1, rot = 0, outline = 0): void {
  hpoly(ellPts(dx, dy, rx, ry, 12, rot), c, a, outline);
}
function hpolyline(p: number[], w: number, c: number, a = 1): void {
  hbuf.length = p.length;
  for (let i = 0; i < p.length; i += 2) hl(p[i], p[i + 1], hbuf, i);
  polyline(hbuf, w * HSC, c, a);
}

function drawHead(hx: number, hy: number, tilt: number, art: CharArt, expr: number, sway: number): void {
  const p = art.palette;
  HX = hx; HY = hy; HC = Math.cos(tilt); HS = Math.sin(tilt); HSC = art.female ? 0.94 : 1;
  const skin = p.skin, shade = darken(skin, 0.3), dk = darken(skin, 0.62);
  const hair = p.hair, hairD = darken(hair, 0.35), hairL = lighten(hair, 0.28);
  const fem = !!art.female;
  const sw1 = sway * 0.8;

  // --- back hair
  switch (art.hair) {
    case 'long':
      hpoly([-10, -8, -17, 6, -22 + sw1, 32 + Math.abs(sw1) * 0.2, -9 + sw1 * 0.6, 36, -3, 10], hair, 1, 1.5);
      hpoly([-12, 0, -18 + sw1 * 0.5, 14, -20 + sw1, 28], hairD, 0.5);
      break;
    case 'braids':
      for (let b = 0; b < 2; b++) {
        const bx = -12 - b * 3;
        for (let i = 0; i < 6; i++) {
          const k = i / 5;
          hcirc(bx - k * 6 + sw1 * k * 0.6 - b * 3, 5 + i * 6 + b * 3, 3.6 - k * 0.8, i % 2 ? hairD : hair);
        }
        hcirc(bx - 6 + sw1 * 0.6 - b * 3, 36 + b * 3, 2.4, p.accent);
      }
      break;
    case 'bun':
      hcirc(-13, -12, 6.2, hair); hcirc(-13, -12, 6.2, hairD, 0.0); hline(-16, -12, -10, -12, 1.6, p.accent);
      break;
    default: break;
  }
  if (art.hair === 'short' || art.hair === 'slicked') hpoly([-12, -2, -16, 8, -11, 11, -6, 5], hair);

  // --- face
  hcirc(0, 0, 15.9, dk); hcirc(3.5, 6.5, 11.8, dk);
  hcirc(-3, 2, 14.4, shade);
  hcirc(0, 0, 14.5, skin);
  hcirc(3.5, 6, 10.5, skin);
  hcirc(-1, 0, 13, skin);
  hcirc(-8, 5, 6.5, shade, 0.35);          // back-of-face shadow
  hcirc(8, -2, 5, lighten(skin, 0.2), 0.3); // cheek light
  hcirc(-4.5, 1.5, 3.3, shade);            // ear
  hcirc(-4.2, 1.2, 1.6, darken(skin, 0.45));

  // warpaint
  const wp = !!art.decor && art.decor.includes('warpaint');
  if (wp) {
    hline(5, 1, 14, 4, 2.4, p.accent, 0.95); hline(4, 5, 12, 8, 2.2, p.trim, 0.9);
    hline(-1, -14, 1, -8, 2.2, p.accent, 0.95);
  }

  // --- nose / eye / mouth
  hpoly([13, 0, 17, 5, 12.5, 5.5], darken(skin, 0.15), 1, 0);
  if (expr === 1) {
    hline(3.5, -2, 9.5, -1, 2, 0x1a1210); hline(2.5, -6.5, 10, -6, 2, hairD);
  } else {
    hell(6.8, -2, 3.3, 2.5, 0xf6f0e6, 1);
    hcirc(7.8, -2, 1.7, 0x1a120c);
    hcirc(8.3, -2.6, 0.55, 0xffffff);
    hline(3, -6.2, 11, expr === 2 ? -8 : -5.4, 2.1, hairD);
    if (fem) hline(4, -3.8, 10.5, -4.2, 1.2, 0x120c08);
  }
  if (expr === 2) hell(10.5, 8.5, 3, 2.2, 0x3a0c0c, 1);
  else if (expr === 1) hline(7.5, 9, 12, 8.2, 1.4, 0x4a1410);
  else hline(7.5, 8.6, 12.5, 8.2, 1.5, fem ? 0xb03a46 : 0x5a2a22);

  // --- front hair
  const dome = (r: number): number[] => {
    const top = ellPts(0, -0.5, r, r, 9, 0, PI * 0.88, PI * 1.82);
    top.push(7, -8.2, 0, -9.5, -8, -3.5);
    return top;
  };
  switch (art.hair) {
    case 'short': hpoly(dome(16.2), hair, 1, 1.4); hpolyline(ellPts(0, -1, 14, 14, 6, 0, PI * 1.2, PI * 1.7), 1.6, hairL, 0.5); break;
    case 'long': hpoly(dome(16.6), hair, 1, 1.4); hpolyline(ellPts(0, -1, 14, 14, 6, 0, PI * 1.2, PI * 1.7), 1.6, hairL, 0.5); break;
    case 'braids': hpoly(dome(16.2), hair, 1, 1.4); hline(-1, -15, -1, -6, 1, hairD, 0.7); break;
    case 'slicked': hpoly(dome(15.6), hair, 1, 1.2); hpolyline(ellPts(0, -1, 13, 13, 7, 0, PI * 1.15, PI * 1.78), 1.8, hairL, 0.7); break;
    case 'bun': hpoly(dome(16), hair, 1, 1.4); break;
    case 'curly':
      for (let i = 0; i < 9; i++) {
        const a = PI * 0.9 + (PI * 0.95) * (i / 8);
        hcirc(Math.cos(a) * 13.5, -1 + Math.sin(a) * 13, 5 + (i % 2), i % 3 === 0 ? hairD : hair);
      }
      hcirc(-2, -13, 5.5, hair); hcirc(5, -12, 4.5, hairL, 0.5);
      break;
    case 'bald': hcirc(3, -9, 3.6, lighten(skin, 0.35), 0.4); break;
    default: break;
  }

  // --- facial hair
  const fh = art.facial, fhc = fem ? hair : (p.hair === 0xe0e0e0 || p.hair > 0xaaaaaa ? p.hair : hair);
  const fhD = darken(fhc, 0.3);
  if (fh === 'sideburns' || fh === 'fullBeard') hpoly([-6.5, -7, -1.5, -7, -1, 3, -3, 8, -6.5, 4], fhc, 1, 0);
  if (fh === 'moustache' || fh === 'fullBeard' || fh === 'goatee') hpoly([6.5, 4.4, 14.5, 3.6, 17, 6.4, 12, 7.4, 6.5, 6.5], fhc, 1, 1);
  if (fh === 'beard' || fh === 'fullBeard') {
    hpoly([-4, 3, 4, 7, 12, 6, 16, 9, 14, 17, 7, 23, -1, 19, -6, 11], fhc, 1, 1.2);
    hpoly([6, 7.2, 12, 7, 14, 9.5, 8, 11], fhD, 0.5);
  }
  if (fh === 'goatee') hpoly([8, 10, 14, 10, 12, 19, 8, 17], fhc, 1, 1);

  // --- headgear
  const hg = art.headgear;
  const dark = 0x17171c;
  switch (hg) {
    case 'bicorne':
      hpoly([-25, -9, -14, -22, 2, -27, 16, -22, 27, -9, 10, -15, -8, -15], dark, 1, 1.4);
      hpolyline([-25, -9, -14, -22, 2, -27, 16, -22, 27, -9], 1.8, p.accent, 0.95);
      hcirc(21, -13, 4.2, p.accent); hcirc(21, -13, 2.2, p.trim); hline(21, -13, 25, -22, 1.4, p.trim, 0.8);
      break;
    case 'tricorn':
      hpoly([-10, -13, -8, -22, 8, -22, 11, -13], dark, 1, 1.2);
      hpoly([-28, -11, -14, -18, 14, -18, 30, -9, 12, -11, -12, -11], darken(dark, 0.0), 1, 1.4);
      hpolyline([-28, -11, -14, -18, 14, -18, 30, -9], 1.6, p.trim, 0.95);
      hcirc(18, -14, 3.6, p.accent);
      break;
    case 'shako':
      hpoly([-11, -15, -12.5, -38, 12.5, -38, 11, -15], dark, 1, 1.4);
      hpoly([-12, -38, 13, -38, 14, -41, -13, -41], darken(p.primary, 0.1), 1, 1);
      hline(-11.5, -17, 11.5, -17, 2.6, p.trim, 0.9); hline(-12, -36, 12.5, -36, 1.6, p.trim, 0.9);
      hcirc(2, -26, 3.8, p.trim); hcirc(2, -26, 1.8, p.accent);
      hpoly([8, -14, 22, -12.5, 20, -9.5, 8, -11], dark, 1, 1);
      hline(0, -41, 0, -49 + sway * 0.1, 5, p.accent, 1); hcirc(0, -50, 5, p.accent); hcirc(-1, -51, 2, lighten(p.accent, 0.4), 0.8);
      break;
    case 'kepi':
      hpoly([-13.5, -7, -14, -16, -7, -23, 8, -22.5, 14, -16, 13.5, -9], darken(p.primary, 0.12), 1, 1.4);
      hpoly([-14, -9, 14, -9, 14.5, -5.5, -14.5, -5.5], p.trim, 1, 1);
      hpoly([10, -11, 24, -8, 22.5, -5.5, 10, -7], 0x1e1610, 1, 1);
      hcirc(10, -7.5, 2, p.accent);
      break;
    case 'llautu':
      hpoly([-14.5, -11, 14.5, -11, 15.4, -4.5, -15.4, -4.5], p.accent, 1, 1.4);
      hline(-14.5, -8, 15, -8, 1.6, p.trim, 0.95); hline(-14.5, -6, 15, -6, 1, darken(p.accent, 0.4), 0.8);
      for (let i = 0; i < 4; i++) hline(12 + i * 0.9, -5, 12.5 + i * 0.9 + sway * 0.04, 6 + i, 1.3, p.trim, 0.95);
      hpoly([-5, -12, -3, -22, 0, -12], p.secondary, 1, 1);
      break;
    case 'feathers': {
      hpoly([-14.5, -11, 14.5, -11, 15.4, -5, -15.4, -5], p.primary, 1, 1.4);
      hline(-14.5, -8, 15, -8, 1.6, p.trim, 0.95);
      const cols = [p.accent, p.secondary, p.primary, p.trim];
      for (let i = 0; i < 5; i++) {
        const bx = -9 + i * 3, ang = -2.1 - i * 0.16;
        const tx = bx + Math.cos(ang) * 24 + sway * 0.3, ty = -12 + Math.sin(ang) * 24;
        hpoly([bx, -11, bx + 5, -17, tx + 1, ty, bx - 4, -16], cols[i % 4], 1, 1.1);
        hline(bx, -11, tx, ty, 1, darken(cols[i % 4], 0.4), 0.7);
      }
      break;
    }
    case 'gauchoHat':
      hpoly(ellPts(0, -11, 23, 4.6, 14), dark, 1, 1.4);
      hpoly(ellPts(0, -11, 11, 11, 8, 0, PI, PI * 2), dark, 1, 1.2);
      hline(-11, -13, 11, -13, 2.4, p.accent, 0.95);
      hpolyline([-6, -22, 0, -21, 6, -22], 1.2, lighten(dark, 0.3), 0.6);
      hline(10, -9, 8.5, 10, 1.2, p.boots, 0.9);
      break;
    case 'sombrero':
      hpoly(ellPts(0, -12, 35, 7, 16, -0.06), darken(p.secondary, 0.3), 1, 1.5);
      hpolyline(ellPts(0, -12, 34, 6.5, 12, -0.06, 0, PI), 1.8, p.trim, 0.9);
      hpoly([-11, -12, -6, -30, 6, -30, 11, -12], darken(p.secondary, 0.2), 1, 1.4);
      hline(-10, -16, 10, -16, 3, p.accent, 1);
      break;
    case 'bandana':
      hpoly(ellPts(0, -1, 15.8, 15.8, 9, 0, PI * 0.95, PI * 1.84).concat(ellPts(0, -1, 9.5, 9.5, 5, 0, PI * 1.84, PI * 0.95)), p.accent, 1, 1.3);
      hcirc(-15, -4, 3.6, p.accent);
      hpoly([-15, -4, -26 + sway * 0.6, 0, -24 + sway * 0.6, 5], p.accent, 1, 1);
      hpoly([-15, -4, -24 + sway * 0.6, -6, -27 + sway * 0.6, -2], darken(p.accent, 0.2), 1, 1);
      break;
    case 'headband':
      hpoly([-14.8, -9.5, 14.8, -9.5, 15.2, -5.5, -15.2, -5.5], p.accent, 1, 1.2);
      hcirc(-15, -7.5, 3, p.accent);
      hpoly([-15, -7.5, -24 + sway * 0.6, -4, -22 + sway * 0.6, -1], p.accent, 1, 1);
      hpoly([-15, -7.5, -24 + sway * 0.6, -10, -26 + sway * 0.6, -6], darken(p.accent, 0.2), 1, 1);
      break;
    case 'crown':
      hpoly([-12.5, -12, 12.5, -12, 13, -27, 7, -19, 0, -29, -7, -19, -13, -27], p.trim, 1, 1.4);
      hline(-12.5, -14.5, 12.5, -14.5, 2.4, darken(p.trim, 0.25), 0.9);
      hcirc(-13, -27, 2, p.accent); hcirc(0, -29, 2.2, p.accent); hcirc(13, -27, 2, p.accent);
      hcirc(0, -15, 1.8, p.accent);
      break;
    case 'turban':
      hcirc(0, -9, 17.5, darken(p.secondary, 0.12));
      hcirc(0, -10, 16.5, p.secondary);
      hpolyline(ellPts(0, -9, 15, 12, 8, 0, PI * 1.05, PI * 1.9), 1.6, darken(p.secondary, 0.3), 0.8);
      hpolyline(ellPts(0, -4, 16, 10, 8, 0, PI * 1.05, PI * 1.9), 1.6, darken(p.secondary, 0.3), 0.8);
      hpoly([-16, -7, 16, -9, 16.5, -3.5, -16.5, -2], p.primary, 1, 1.1);
      hcirc(10, -10, 3.2, p.accent); hcirc(10, -10, 1.5, p.trim);
      hpoly([9, -12, 8, -24, 12, -14], p.secondary, 1, 1);
      break;
    case 'inkaCrown':
      hpoly([-14.5, -11, 14.5, -11, 15.4, -4.5, -15.4, -4.5], p.accent, 1, 1.4);
      hline(-14.5, -8, 15, -8, 1.6, p.trim, 0.95);
      for (let i = 0; i < 7; i++) {
        const ang = -PI / 2 + (i - 3) * 0.3, L = 26 - Math.abs(i - 3) * 2.2;
        const bx = 1, by = -12;
        const tx = bx + Math.cos(ang) * L, ty = by + Math.sin(ang) * L;
        const nx = -Math.sin(ang) * 2.6, ny = Math.cos(ang) * 2.6;
        hpoly([bx - nx, by - ny, tx, ty, bx + nx, by + ny], i % 2 ? p.trim : lighten(p.trim, 0.25), 1, 1);
      }
      hcirc(1, -13, 4.4, p.primary); hcirc(1, -13, 2.2, p.trim);
      for (let i = 0; i < 3; i++) hline(12 + i, -5, 12.5 + i, 7 + i * 1.2, 1.3, p.trim, 0.95);
      break;
    default: break;
  }
  if (art.decor && art.decor.includes('scarf')) { /* drawn at neck by the figure */ }
}

/* ----------------------------------------------------------------- weapons */
let WDX = 1, WDY = 0, WNX = 0, WNY = 1, WHX = 0, WHY = 0;
const wb: number[] = [];
function wpt(u: number, v: number, out: number[], i: number): void {
  out[i] = WHX + u * WDX + v * WNX; out[i + 1] = WHY + u * WDY + v * WNY;
}
function wpoly(p: number[], c: number, a = 1, outline = 0): void {
  wb.length = p.length;
  for (let i = 0; i < p.length; i += 2) wpt(p[i], p[i + 1], wb, i);
  poly(wb, c, a, outline);
}
function wline(u1: number, v1: number, u2: number, v2: number, w: number, c: number, a = 1): void {
  wpt(u1, v1, wb, 0); wpt(u2, v2, wb, 2);
  line(wb[0], wb[1], wb[2], wb[3], w, c, a);
}
function wcirc(u: number, v: number, r: number, c: number, a = 1): void {
  wpt(u, v, wb, 0); circ(wb[0], wb[1], r, c, a);
}
const STEEL = 0xdde3ea;
function wblade(u0: number, u1: number, w0: number, w1: number, curve = 0): void {
  const top: number[] = [], bot: number[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const k = i / n, u = lerp(u0, u1, k), w = lerp(w0, w1, k) / 2 * (i === n ? 0.15 : 1);
    const cv = -curve * k * k;
    top.push(u, cv - w); bot.unshift(u, cv + w);
  }
  wpoly(top.concat(bot), STEEL, 1, 1.3);
  const hi: number[] = [];
  for (let i = 0; i <= n - 1; i++) { const k = i / n; hi.push(lerp(u0, u1, k), -curve * k * k - lerp(w0, w1, k) * 0.18); }
  wb.length = hi.length;
  for (let i = 0; i < hi.length; i += 2) wpt(hi[i], hi[i + 1], wb, i);
  polyline(wb, 1.2, 0xffffff, 0.85);
}

function drawWeapon(kind: WeaponKind, hx: number, hy: number, wa: number, art: CharArt, P: Pose, glow: number, back = false): void {
  const p = art.palette;
  WHX = hx; WHY = hy;
  WDX = Math.cos(wa); WDY = -Math.sin(wa); WNX = -WDY; WNY = WDX;
  const wood = 0x7a5232;
  switch (kind) {
    case 'sabre': case 'sword': case 'pistolSword': case 'curvedSabre': {
      const long = kind === 'sword' || kind === 'pistolSword';
      wline(-9, 0, 6, 0, 4.2, p.boots); wcirc(-9, 0, 3, p.trim);
      wline(6, -6, 6, 6, 3, p.trim);
      if (kind === 'sabre' || kind === 'curvedSabre') { wline(6, 6, -5, 8, 2, p.trim); wline(-5, 8, -9, 3, 2, p.trim); }
      if (kind === 'curvedSabre') wblade(7, 62, 6.5, 3.5, 13);
      else wblade(7, long ? 74 : 64, long ? 6 : 5, 3.5, kind === 'sabre' ? 2.5 : 0);
      if (glow > 0) wcirc(long ? 74 : 64, 0, 7 + glow * 3, art.palette.aura, 0.25 * glow);
      break;
    }
    case 'spear': {
      const L = 66;
      wline(-34, 0, L, 0, 6.5, darken(wood, 0.55)); wline(-34, 0, L, 0, 4, wood); wline(-34, -0.8, L, -0.8, 1.2, lighten(wood, 0.35), 0.6);
      wcirc(-34, 0, 3.2, p.trim);
      wpoly([L - 2, -1.8, L + 7, -6.5, L + 28, 0, L + 7, 6.5, L - 2, 1.8], STEEL, 1, 1.3);
      wline(L + 2, 0, L + 24, 0, 1.2, 0xffffff, 0.85);
      wcirc(L - 5, 0, 4.2, p.accent);
      wpoly([L - 5, 1, L - 20 + Math.sin(CLK * 0.2) * 3, 8, L - 26, 5, L - 8, 0], p.accent, 1, 1);
      if (glow > 0) wcirc(L + 20, 0, 8 + glow * 3, p.aura, 0.25 * glow);
      break;
    }
    case 'ceremonial': {
      const L = 80;
      wline(-36, 0, L, 0, 6.5, darken(wood, 0.6)); wline(-36, 0, L, 0, 4.2, 0x5b3a22);
      for (let i = 0; i < 4; i++) wline(8 + i * 18, -2, 11 + i * 18, 2, 1.6, p.trim, 0.9);
      wcirc(L + 6, 0, 10.5, darken(p.trim, 0.5)); wcirc(L + 6, 0, 9, p.trim); wcirc(L + 6, 0, 5.2, p.accent); wcirc(L + 6, 0, 2.2, lighten(p.trim, 0.5));
      const cols = [p.accent, p.secondary, p.primary, p.trim];
      for (let i = 0; i < 4; i++) {
        const sw = Math.sin(CLK * 0.15 + i) * 3;
        wpoly([L - 4 - i * 3, 1, L - 20 - i * 6 + sw, 6 + i * 4, L - 26 - i * 6 + sw, 10 + i * 4, L - 12 - i * 3, 2], cols[i], 1, 1);
      }
      if (glow > 0) wcirc(L + 6, 0, 14 + glow * 3, p.aura, 0.3 * glow);
      break;
    }
    case 'club': {
      wpoly([-8, -3, 28, -5.5, 52, -10, 62, 0, 52, 10, 28, 5.5, -8, 3], darken(wood, 0.5), 1, 0);
      wpoly([-7, -2.2, 28, -4.4, 51, -8.4, 59, 0, 51, 8.4, 28, 4.4, -7, 2.2], wood, 1, 1.3);
      wline(0, -2.2, 54, -6, 1.6, lighten(wood, 0.4), 0.6);
      for (let i = 0; i < 4; i++) { wcirc(34 + i * 7, -2.5 + i, 1.6, p.trim); wcirc(34 + i * 7, 3 - i * 0.5, 1.6, p.trim); }
      wline(-6, -3, -6, 3, 2.4, p.accent);
      if (glow > 0) wcirc(54, 0, 12, p.aura, 0.25 * glow);
      break;
    }
    case 'facon': {
      wline(-7, 0, 4, 0, 4, p.boots); wline(4, -5, 4, 5, 2.6, p.trim);
      wblade(5, 32, 5.5, 3, 1);
      if (glow > 0) wcirc(32, 0, 6, p.aura, 0.25 * glow);
      break;
    }
    case 'lasso': {
      const D = 34 * P.wl, spin = CLK * 0.33;
      const rx = Math.abs(Math.cos(spin)) * 22 + 4, ry = 22;
      const rope = 0xc9a266, ropeD = 0x6b4e24;
      wcirc(0, 0, 6, ropeD); wcirc(0, 0, 4.6, rope);
      wpt(0, 0, wb, 0); wpt(D - rx * 0.7, -2 + Math.sin(CLK * 0.2) * 3, wb, 2); wpt(D - rx, 0, wb, 4);
      polyline(wb.slice(0, 6), 3.4, ropeD); polyline(wb.slice(0, 6), 2, rope);
      // loop as ring in the weapon frame
      const pts: number[] = [];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; pts.push(D + Math.cos(a) * rx, Math.sin(a) * ry); }
      wb.length = pts.length;
      for (let i = 0; i < pts.length; i += 2) wpt(pts[i], pts[i + 1], wb, i);
      const n = loadPts(wb);
      G.lineStyle(4.4 * SC, fc(ropeD), AL); G.strokePoints(scr, true, true, n);
      G.lineStyle(2.4 * SC, fc(rope), AL); G.strokePoints(scr, true, true, n);
      if (glow > 0) { G.lineStyle(7 * SC, fc(p.aura), 0.25 * glow * AL); G.strokePoints(scr, true, true, n); }
      break;
    }
    case 'sling': {
      const a = CLK * 0.5, R = 26 * P.wl;
      const sx = Math.cos(a) * R, sy = Math.sin(a) * R * 0.8 - 6;
      const lea = 0x5a3c22;
      wcirc(0, 0, 4, p.boots);
      wpt(0, 0, wb, 0); wpt(sx * 0.5 - 4, sy * 0.5 - 6, wb, 2); wpt(sx, sy, wb, 4);
      polyline(wb.slice(0, 6), 1.8, lea);
      wcirc(sx, sy, 5.5, lea); wcirc(sx, sy, 3.6, 0x9a9a98); wcirc(sx - 1, sy - 1, 1.2, 0xe6e6e0);
      const pts: number[] = [];
      for (let i = 0; i < 14; i++) { const t = (i / 14) * PI * 2; pts.push(Math.cos(t) * R, Math.sin(t) * R * 0.8 - 6); }
      wb.length = pts.length;
      for (let i = 0; i < pts.length; i += 2) wpt(pts[i], pts[i + 1], wb, i);
      const n = loadPts(wb);
      G.lineStyle(1.6 * SC, fc(0xffffff), 0.22 * AL); G.strokePoints(scr, true, true, n);
      if (glow > 0) wcirc(sx, sy, 10, p.aura, 0.3 * glow);
      break;
    }
    case 'pen': {
      const L = 74, au = p.aura;
      wline(-8, 0, L, 0, 11, au, 0.22);
      wpoly([8, 0, 22, -10, 56, -6.5, L + 2, -0.5], lighten(p.secondary, 0.2), 1, 1.1);
      wpoly([8, 0, 22, 10, 56, 6.5, L + 2, 0.5], darken(p.secondary, 0.08), 1, 1.1);
      wpoly([22, -10, 56, -6.5, 62, -2, 30, -3], au, 0.55, 0);
      wline(-8, 0, L, 0, 3, 0xffffff, 1); wline(-8, 0, 6, 0, 4.4, p.boots);
      wpoly([L, -2, L + 12, 0, L, 2], 0x15131a, 1, 0);
      wcirc(L + 12, 0, 6 + glow * 3, au, 0.45); wcirc(L + 12, 0, 2.8, 0xffffff, 0.95);
      for (let i = 0; i < 4; i++) {
        const t = ((CLK * 0.05 + i * 0.25) % 1);
        wcirc(L + 4 - t * 40, Math.sin(CLK * 0.2 + i * 2) * 8 * t, 2.2 * (1 - t) + 0.6, au, 0.8 * (1 - t));
      }
      break;
    }
    case 'fists': break;
  }
  void back;
}

/* ------------------------------------------------------------ figure parts */
function drawArm(sx: number, sy: number, tx: number, ty: number, art: CharArt, front: boolean, bare: boolean, fist: boolean): void {
  const p = art.palette;
  const shade = front ? 0 : 0.28;
  const sleeve = darken(p.primary, 0.05 + shade);
  const fore = bare ? darken(p.skin, shade) : darken(p.primary, 0.14 + shade);
  const upper = bare ? darken(p.skin, shade) : sleeve;
  ik(sx, sy, tx, ty, UARM, FARM, -0.5, 1);
  const kx = KX, ky = KY, ex = EX, ey = EY;
  const w = art.build === 'heavy' ? 13.5 : art.build === 'slim' ? 9 : 11.5;
  limb3(sx, sy, kx, ky, ex, ey, w, w - 1.5, upper, fore, front);
  if (!bare) {
    // cuff
    const dx = ex - kx, dy = ey - ky, l = Math.hypot(dx, dy) || 1;
    line(ex - dx / l * 9, ey - dy / l * 9, ex - dx / l * 3, ey - dy / l * 3, w - 0.5, art.palette.trim, 0.95);
  } else {
    const dx = ex - kx, dy = ey - ky, l = Math.hypot(dx, dy) || 1;
    line(kx - dx / l * 0 + (sx - kx) * 0.35, ky + (sy - ky) * 0.35, kx - (sx - kx) * 0.0 + (sx - kx) * 0.2, ky + (sy - ky) * 0.2, w + 1, p.accent, 0.95);
  }
  if (art.decor && art.decor.includes('feathers')) {
    const mx = (sx + kx) / 2, my = (sy + ky) / 2;
    for (let i = 0; i < 3; i++) {
      const sw = Math.sin(CLK * 0.2 + i * 1.3) * 3;
      poly([mx, my + i * 4 - 2, mx - 14 + sw, my + 10 + i * 5, mx - 17 + sw, my + 8 + i * 5, mx - 2, my + i * 4 - 4], [p.accent, p.secondary, p.trim][i], 1, 0.9);
    }
  }
  // hand
  if (fist) {
    circ(ex, ey, 8.4, darken(p.accent, 0.5)); circ(ex, ey, 7.4, p.accent);
    line(ex - 5, ey - 1, ex + 5, ey - 1, 1.6, p.trim, 0.9); line(ex - 5, ey + 2.5, ex + 5, ey + 2.5, 1.4, darken(p.accent, 0.3), 0.9);
    circ(ex + 3, ey - 3, 2.4, lighten(p.skin, 0.0), 0.0);
  } else {
    circ(ex, ey, 6.4, darken(p.skin, 0.55)); circ(ex, ey, 5.4, darken(p.skin, shade * 0.8));
    circ(ex + 1.5, ey - 1.5, 2, lighten(p.skin, 0.2), front ? 0.5 : 0);
  }
}

function drawLeg(hx: number, hy: number, tx: number, ty: number, art: CharArt, front: boolean, kup: number): void {
  const p = art.palette;
  const sh = front ? 0 : 0.18;
  const pants = darken(p.secondary, 0.1 + sh);
  const boot = darken(p.boots, sh * 0.6);
  const bw = art.build === 'heavy' ? 17 : art.build === 'slim' ? 12.5 : 15;
  ik(hx, hy, tx, ty - 7, THIGH, SHIN, kup > 0.5 ? 0.3 : 1, kup > 0.5 ? -1 : 0.1);
  const kx = KX, ky = KY, ex = EX, ey = EY;
  limb3(hx, hy, kx, ky, ex, ey, bw, bw - 3, pants, pants, front);
  // boot shaft over lower shin
  const sx = lerp(kx, ex, 0.5), sy = lerp(ky, ey, 0.5);
  line(sx, sy, ex, ey, bw - 1.5, darken(boot, 0.5)); line(sx, sy, ex, ey, bw - 4.5, boot);
  line(sx - (ex - kx) * 0.02, sy, sx + (ex - kx) * 0.02, sy, bw - 1, lighten(boot, 0.3), 0.8);
  // foot
  poly([ex - 6, ey - 5, ex + 7, ey - 5, ex + 12, ey + 1, ex + 20, ey + 6, ex + 20, ey + 8, ex - 7, ey + 8], boot, 1, 1.4);
  line(ex - 7, ey + 7.2, ex + 20, ey + 7.2, 2, darken(boot, 0.5));
  line(ex - 1, ey - 3, ex + 8, ey - 3, 1.6, lighten(boot, 0.35), 0.5);
  if (art.decor && art.decor.includes('spurs')) { poly([ex - 7, ey + 3, ex - 14, ey + 5, ex - 7, ey + 7], p.trim, 1, 0.8); }
}

/* ------------------------------------------------------------ whole figure */
interface FigCtx { vx: number; vy: number; clock: number; anim: AnimName; flashSpec: boolean }

function bodyDims(art: CharArt): { sw: number; hw: number } {
  const sw = art.build === 'heavy' ? 23 : art.build === 'slim' ? 15.5 : 19;
  return { sw: art.female ? Math.min(sw, 15) : sw, hw: art.female ? 16 : sw * 0.88 };
}

function skirtKind(art: CharArt): 'none' | 'tail' | 'skirt' | 'tunic' {
  if (art.female) return 'skirt';
  if (art.cape === 'unku') return 'tunic';
  if (art.cape === 'poncho') return 'none';
  switch (art.weapon) {
    case 'sabre': case 'curvedSabre': case 'sword': case 'pistolSword': case 'pen': return 'tail';
    default: return 'none';
  }
}

function drawFigure(f: FighterView, art: CharArt, P: Pose, ctx: FigCtx): void {
  const p = art.palette;
  const { sw, hw } = bodyDims(art);
  const lean = P.lean;
  const hip: [number, number] = [P.hx, P.hy];
  const sh: [number, number] = shoulderOf(P);
  const ux = Math.sin(lean), uy = -Math.cos(lean);   // hip -> shoulder
  const nx = Math.cos(lean), ny = Math.sin(lean);     // forward normal
  const fwdV = ctx.vx * FC;
  const trailX = clamp(-fwdV * 2.4, -26, 26) + Math.sin(ctx.clock * 0.1) * 3;
  const trailY = clamp(-ctx.vy * 1.4, -18, 20);
  const wsway = Math.sin(ctx.clock * 0.13) * 3 + clamp(-fwdV * 1.2, -12, 12);
  const sk = skirtKind(art);
  const bare = !!art.decor && (art.decor.includes('warpaint') || art.cape === 'unku');
  const fist = art.weapon === 'fists';
  const dec = art.decor || [];
  const lie = P.kup > 0.5;
  const prim = p.primary, primD = darken(prim, 0.35), primL = lighten(prim, 0.22);

  // ---- cape / banner behind everything
  if (art.cape === 'cape' || art.cape === 'banner') {
    const top0x = sh[0] - nx * sw * 0.85, top0y = sh[1] - ny * sw * 0.85 + 2;
    const top1x = sh[0] + nx * sw * 0.2, top1y = sh[1] + ny * sw * 0.2 + 2;
    const botBackX = hip[0] - 34 + trailX, botFrontX = hip[0] + 4 + trailX * 0.6;
    const botY = hip[1] + (lie ? 8 : 52) + trailY;
    const m = 6;
    if (art.cape === 'cape') {
      const cb = mixc(prim, p.accent, 0.3), capeC = darken(cb, 0.2), capeL = darken(cb, 0.38);
      const tops: number[] = [], bots: number[] = [];
      for (let i = 0; i <= m; i++) {
        const k = i / m;
        tops.push(lerp(top0x, top1x, k), lerp(top0y, top1y, k));
        const wv = Math.sin(ctx.clock * 0.15 + k * 3.2) * 4;
        bots.push(lerp(botBackX, botFrontX, k) + wv, botY + Math.cos(ctx.clock * 0.15 + k * 3) * 2 + k * 4);
      }
      for (let i = 0; i < m; i++) {
        poly([tops[2 * i], tops[2 * i + 1], tops[2 * i + 2], tops[2 * i + 3], bots[2 * i + 2], bots[2 * i + 3], bots[2 * i], bots[2 * i + 1]], i % 2 ? capeL : capeC, 1, 0);
      }
      // outline & hem
      const edge: number[] = [tops[0], tops[1]];
      for (let i = 0; i <= m; i++) edge.push(bots[2 * i], bots[2 * i + 1]);
      edge.push(tops[2 * m], tops[2 * m + 1]);
      polyline(edge, 2, darken(capeC, 0.55), 1);
      const hem: number[] = [];
      for (let i = 0; i <= m; i++) hem.push(bots[2 * i], bots[2 * i + 1] - 1);
      polyline(hem, 3, p.accent, 0.95);
      polyline(hem.map((v, i) => (i % 2 ? v - 4 : v)), 1.2, p.trim, 0.8);
    } else {
      // banner: pole behind back and flag flowing backwards
      const px = hip[0] - 18, pTop = sh[1] - 42, pBot = hip[1] + 24;
      line(px, pBot, px, pTop, 4, darken(0x7a5232, 0.4)); line(px, pBot, px, pTop, 2.4, 0x8a6240);
      circ(px, pTop - 2, 4, p.trim);
      const fl: number[] = [], fb: number[] = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6, wv = Math.sin(ctx.clock * 0.18 - k * 4) * (3 + k * 5);
        fl.push(px - k * (34 + Math.abs(trailX) * 0.5) + (trailX * 0.4) * k, pTop + 4 + wv);
        fb.push(px - k * (34 + Math.abs(trailX) * 0.5) + (trailX * 0.4) * k, pTop + 36 + wv + k * 6);
      }
      for (let i = 0; i < 6; i++) {
        const c = i % 2 ? darken(prim, 0.1) : prim;
        poly([fl[2 * i], fl[2 * i + 1], fl[2 * i + 2], fl[2 * i + 3], fb[2 * i + 2], fb[2 * i + 3], fb[2 * i], fb[2 * i + 1]], c, 1, 0);
        poly([fl[2 * i], (fl[2 * i + 1] + fb[2 * i + 1]) / 2 - 3, fl[2 * i + 2], (fl[2 * i + 3] + fb[2 * i + 3]) / 2 - 3, fb[2 * i + 2], (fl[2 * i + 3] + fb[2 * i + 3]) / 2 + 3, fb[2 * i], (fl[2 * i + 1] + fb[2 * i + 1]) / 2 + 3], p.accent, 1, 0);
      }
      polyline([fl[0], fl[1], fl[12], fl[13], fb[12], fb[13], fb[0], fb[1]], 1.6, darken(prim, 0.6), 1);
    }
  }

  // ---- back leg, back arm
  drawLeg(hip[0] - 3, hip[1], P.lbx, P.lby, art, false, P.kup);
  const bsx = sh[0] - nx * 3, bsy = sh[1] - ny * 3 + 2;
  let fhx = 0, fhy = 0;
  {
    const [hx0, hy0] = handOf(P);
    fhx = hx0; fhy = hy0;
  }
  let bax = bsx + P.abx, bay = bsy + P.aby;
  if (P.two > 0.5 && TWOH.includes(art.weapon)) {
    bax = fhx - Math.cos(P.wa) * 26; bay = fhy + Math.sin(P.wa) * 26;
  }
  drawArm(bsx, bsy, bax, bay, art, false, bare, fist);
  const bhx = EX, bhy = EY;
  if (art.weapon === 'facon') drawWeapon('facon', bhx, bhy, P.wa - 0.5, art, P, 0, true);
  if (art.weapon === 'pistolSword') {
    // flintlock pistol in rear hand
    const a = Math.atan2(-(bhy - bsy), bhx - bsx) + 0.1;
    WHX = bhx; WHY = bhy; WDX = Math.cos(a); WDY = -Math.sin(a); WNX = -WDY; WNY = WDX;
    wpoly([-9, -3, 2, -3.5, 4, 5, -8, 7], 0x6a4528, 1, 1.2);
    wline(0, -2, 22, -2, 4, 0x70747c); wline(0, -3, 22, -3, 1.2, 0xc8ccd4, 0.8);
    wpoly([-2, -5, 3, -5, 2, -1.5], p.trim, 1, 0.8);
    if (ctx.anim === 'lightA' || ctx.anim === 'cast' || ctx.anim === 'slash') {
      wcirc(26, -2, 5 + (ctx.clock % 4), 0xfff2c0, 0.7); wcirc(26, -2, 2.4, 0xffffff, 0.95);
    }
  }

  // ---- front leg
  drawLeg(hip[0] + 3, hip[1], P.lfx, P.lfy, art, true, P.kup);

  // ---- torso
  const tc = sk === 'tunic' ? p.primary : prim;
  const shf = [sh[0] + nx * sw, sh[1] + ny * sw], shb = [sh[0] - nx * sw, sh[1] - ny * sw];
  const waistW = art.female ? sw * 0.62 : sw * 0.86;
  const wcx = hip[0] + ux * 22, wcy = hip[1] + uy * 22;
  const wf = [wcx + nx * waistW, wcy + ny * waistW], wbk = [wcx - nx * waistW, wcy - ny * waistW];
  const hf = [hip[0] + nx * hw * 0.95, hip[1] + ny * hw * 0.95 + 4], hbk = [hip[0] - nx * hw * 0.95, hip[1] - ny * hw * 0.95 + 4];
  const chx = sh[0] + nx * (sw + 2) - ux * 10, chy = sh[1] + ny * (sw + 2) - uy * 10;
  // pelvis blob
  circ(hip[0], hip[1] + 4, hw * 0.95, darken(p.secondary, 0.35)); circ(hip[0], hip[1] + 4, hw * 0.95 - 1.5, darken(p.secondary, 0.1));
  const torso = [shb[0], shb[1], sh[0] + ux * 2, sh[1] + uy * 2 - 0, shf[0], shf[1], chx, chy, wf[0], wf[1], hf[0], hf[1], hbk[0], hbk[1], wbk[0], wbk[1]];
  poly(torso, tc, 1, 2);
  // darker back half + light front rim
  poly([shb[0], shb[1], sh[0], sh[1], wcx, wcy, hip[0], hip[1] + 4, hbk[0], hbk[1], wbk[0], wbk[1]], primD, 0.5, 0);
  polyline([shf[0], shf[1], chx, chy, wf[0], wf[1], hf[0], hf[1]], 2.2, primL, 0.6);
  // collar
  const nkx = sh[0] + ux * 5, nky = sh[1] + uy * 5;
  if (sk !== 'tunic' && art.cape !== 'poncho') {
    poly([shb[0] + nx * 4, shb[1] + ny * 4, nkx - nx * 2, nky - ny * 2, nkx + nx * 8, nky + ny * 8, shf[0] - nx * 5, shf[1] - ny * 5, sh[0] + nx * 4 - ux * 4, sh[1] + ny * 4 - uy * 4], p.secondary, 1, 1.2);
    poly([sh[0] - nx * 2 + ux * 7, sh[1] - ny * 2 + uy * 7, sh[0] + nx * 9 + ux * 3, sh[1] + ny * 9 + uy * 3, sh[0] + nx * 3 - ux * 8, sh[1] + ny * 3 - uy * 8], darken(prim, 0.1), 1, 1);
    line(sh[0] - nx * 2 + ux * 7, sh[1] - ny * 2 + uy * 7, sh[0] + nx * 9 + ux * 3, sh[1] + ny * 9 + uy * 3, 1.6, p.trim, 0.95);
  }
  // front buttons + seam
  const bx0 = lerp(sh[0], wcx, 0.12) + nx * (sw * 0.55), by0 = lerp(sh[1], wcy, 0.12) + ny * (sw * 0.55);
  const bx1 = lerp(sh[0], hip[0], 0.8) + nx * (sw * 0.5), by1 = lerp(sh[1], hip[1], 0.8) + ny * (sw * 0.5);
  if (art.cape !== 'poncho' && sk !== 'tunic') {
    line(bx0, by0, bx1, by1, 1.4, darken(prim, 0.5), 0.8);
    for (let i = 0; i < 4; i++) { const k = i / 3; circ(lerp(bx0, bx1, k) + nx * 1.5, lerp(by0, by1, k) + ny * 1.5, 1.9, p.trim); }
    // trim lapel line
    line(sh[0] + nx * (sw - 3), sh[1] + ny * (sw - 3), lerp(sh[0], hip[0], 0.55) + nx * (sw * 0.7), lerp(sh[1], hip[1], 0.55) + ny * (sw * 0.7), 1.4, p.trim, 0.55);
  }
  // sash decor (diagonal band)
  if (dec.includes('sash')) {
    poly([sh[0] - nx * (sw - 3), sh[1] - ny * (sw - 3), sh[0] - nx * (sw - 3) - ux * 8, sh[1] - ny * (sw - 3) - uy * 8, hf[0], hf[1] - 4, hf[0] - 4, hf[1] - 14], p.accent, 1, 1.1);
    line(sh[0] - nx * (sw - 3) - ux * 4, sh[1] - ny * (sw - 3) - uy * 4, hf[0] - 2, hf[1] - 9, 1.2, p.trim, 0.8);
  }
  // belt
  const beltC = [lerp(hip[0], wcx, 0.5), lerp(hip[1], wcy, 0.5) - 1];
  line(beltC[0] - nx * (hw + 1), beltC[1] - ny * (hw + 1), beltC[0] + nx * (hw + 1), beltC[1] + ny * (hw + 1), 5.5, darken(p.boots, 0.2));
  line(beltC[0] - nx * (hw + 1), beltC[1] - ny * (hw + 1) - 1.4, beltC[0] + nx * (hw + 1), beltC[1] + ny * (hw + 1) - 1.4, 1.1, lighten(p.boots, 0.35), 0.7);
  poly([beltC[0] + nx * 5 - 4, beltC[1] + ny * 5 - 3.5, beltC[0] + nx * 5 + 4, beltC[1] + ny * 5 - 3.5, beltC[0] + nx * 5 + 4, beltC[1] + ny * 5 + 3.5, beltC[0] + nx * 5 - 4, beltC[1] + ny * 5 + 3.5], p.trim, 1, 1);

  // skirts / coat tails
  if (sk === 'tail') {
    const len = 34;
    const sx2 = trailX * 0.35;
    poly([hip[0] - hw * 0.9 - 1, hip[1] - 2, hip[0] + hw * 0.95, hip[1] - 2, hip[0] + hw * 0.95 + 5 + sx2 * 0.6, hip[1] + len, hip[0] + 1 + sx2, hip[1] + len - 6, hip[0] - hw * 0.9 - 6 + sx2, hip[1] + len + 2], darken(prim, 0.08), 1, 1.8);
    line(hip[0] + 1 + sx2, hip[1] + len - 5, hip[0] + hw * 0.95 + 5 + sx2 * 0.6, hip[1] + len - 1, 2.2, p.trim, 0.9);
    line(hip[0] + hw * 0.5, hip[1] - 2, hip[0] + hw * 0.7 + sx2 * 0.3, hip[1] + len - 6, 1.1, primL, 0.45);
  } else if (sk === 'skirt') {
    const len = lie ? 24 : 58;
    const sw2 = trailX * 0.4;
    const wv = Math.sin(ctx.clock * 0.14) * 3;
    poly([hip[0] - hw, hip[1] - 4, hip[0] + hw, hip[1] - 4, hip[0] + hw + 12 + sw2 * 0.6, hip[1] + len, hip[0] + 4 + sw2 + wv, hip[1] + len + 5, hip[0] - hw - 12 + sw2, hip[1] + len - 1], darken(prim, 0.05), 1, 1.8);
    poly([hip[0] - hw + 4, hip[1] - 2, hip[0] + 2, hip[1] - 2, hip[0] + 5 + sw2 + wv, hip[1] + len + 4, hip[0] - hw - 10 + sw2, hip[1] + len - 2], darken(prim, 0.3), 0.55, 0);
    line(hip[0] - hw - 11 + sw2, hip[1] + len - 1, hip[0] + hw + 11 + sw2 * 0.6, hip[1] + len - 1, 3, p.trim, 0.95);
    line(hip[0] + hw * 0.4, hip[1] - 2, hip[0] + hw + 6 + sw2 * 0.5, hip[1] + len - 6, 1.2, primL, 0.45);
  } else if (sk === 'tunic') {
    const len = 30, sx2 = trailX * 0.3;
    poly([hip[0] - hw - 1, hip[1] - 6, hip[0] + hw + 1, hip[1] - 6, hip[0] + hw + 6 + sx2 * 0.5, hip[1] + len, hip[0] - hw - 6 + sx2, hip[1] + len], prim, 1, 1.8);
    // checkered tocapu hem
    const y0 = hip[1] + len - 11, wdt = hw * 2 + 12, n = 7;
    for (let i = 0; i < n; i++) {
      const x0 = hip[0] - hw - 6 + sx2 * 0.8 + (wdt / n) * i;
      poly([x0, y0, x0 + wdt / n, y0, x0 + wdt / n, y0 + 5.5, x0, y0 + 5.5], i % 2 ? p.accent : p.secondary, 1, 0);
      poly([x0, y0 + 5.5, x0 + wdt / n, y0 + 5.5, x0 + wdt / n, y0 + 11, x0, y0 + 11], i % 2 ? p.secondary : p.accent, 1, 0);
    }
    polyline([hip[0] - hw - 6 + sx2, hip[1] + len, hip[0] + hw + 6 + sx2 * 0.5, hip[1] + len], 1.2, darken(prim, 0.6), 1);
    // chest band
    line(beltC[0] - nx * (hw), beltC[1] - ny * hw - 10, beltC[0] + nx * hw, beltC[1] + ny * hw - 10, 4, p.accent, 0.95);
  }

  // armor decor
  if (dec.includes('armor')) {
    poly([shb[0] + nx * 6, shb[1] + ny * 6, shf[0] - nx * 3, shf[1] - ny * 3, chx - nx * 1, chy - ny * 1, wcx + nx * waistW * 0.6, wcy + ny * waistW * 0.6, wcx - nx * waistW * 0.6, wcy - ny * waistW * 0.6], darken(p.secondary, 0.25), 1, 1.6);
    polyline([sh[0], sh[1] - 0, wcx, wcy], 1.4, lighten(p.secondary, 0.4), 0.7);
    for (let i = 0; i < 3; i++) line(sh[0] - nx * (sw * 0.6) + ux * -10 * (i + 1) * 0.5, sh[1] - ny * sw * 0.6 + uy * -10 * (i + 1) * 0.5, sh[0] + nx * sw * 0.6 + ux * -10 * (i + 1) * 0.5, sh[1] + ny * sw * 0.6 + uy * -10 * (i + 1) * 0.5, 1.4, darken(p.secondary, 0.55), 0.8);
    circ(sh[0] + ux * -14, sh[1] + uy * -14, 3.2, p.trim);
  }
  // medals
  if (dec.includes('medals')) {
    const mx = lerp(sh[0], hip[0], 0.3) + nx * (sw * 0.52), my = lerp(sh[1], hip[1], 0.3) + ny * (sw * 0.52);
    for (let i = 0; i < 3; i++) {
      line(mx - nx * 3 + i * ux * -2 + nx * i * 2, my - ny * 3, mx - nx * 3 + nx * i * 2, my + 7, 2, i === 1 ? p.accent : p.secondary, 0.95);
      circ(mx - nx * 3 + nx * i * 2.4, my + 9, 2.8, p.trim); circ(mx - nx * 3 + nx * i * 2.4, my + 9, 1.2, lighten(p.trim, 0.5));
    }
  }
  // poncho
  if (art.cape === 'poncho') {
    const tw = sw + 6, bwid = hw + 22, botY = hip[1] + (lie ? 0 : 6);
    const pcx = (sh[0] + hip[0]) / 2, sw3 = trailX * 0.3;
    const hemF = [pcx + bwid + sw3, botY], hemB = [pcx - bwid + sw3, botY];
    poly([sh[0] - nx * tw, sh[1] - ny * tw + 2, sh[0] + nx * tw, sh[1] + ny * tw + 2, hemF[0], hemF[1], hemB[0], hemB[1]], darken(prim, 0.04), 1, 2);
    for (let i = 0; i < 3; i++) {
      const k = 0.35 + i * 0.22;
      const lx = lerp(sh[0] - nx * tw, hemB[0], k), ly = lerp(sh[1] - ny * tw + 2, hemB[1], k);
      const rx = lerp(sh[0] + nx * tw, hemF[0], k), ry = lerp(sh[1] + ny * tw + 2, hemF[1], k);
      line(lx, ly, rx, ry, 4.2, i === 1 ? p.secondary : p.accent, 0.95);
      line(lx, ly + 4, rx, ry + 4, 1.2, p.trim, 0.8);
    }
    // zigzag fringe
    for (let i = 0; i < 9; i++) {
      const k = i / 8, fx = lerp(hemB[0], hemF[0], k);
      poly([fx - 4, botY, fx + 4, botY, fx + wsway * 0.2, botY + 8 + (i % 2) * 3], p.trim, 1, 0.8);
    }
    // neck slit
    poly([nkx - nx * 7, nky - ny * 7, nkx + nx * 9, nky + ny * 9, nkx + nx * 3 + ux * -13, nky + ny * 3 + uy * -13], darken(prim, 0.6), 1, 0);
    line(sh[0] - nx * tw, sh[1] - ny * tw + 2, sh[0] + nx * tw, sh[1] + ny * tw + 2, 2, primL, 0.5);
  }
  // sash tails
  if (art.cape === 'sash') {
    const sbx = beltC[0] - nx * hw * 0.6, sby = beltC[1];
    const s1 = trailX * 0.6;
    poly([sbx - 4, sby - 3, sbx + 4, sby - 3, sbx + s1 * 0.5 - 4, sby + 26, sbx - 6 + s1, sby + 22 + wsway * 0.2], p.accent, 1, 1.4);
    poly([sbx - 2, sby - 3, sbx + 6, sby - 3, sbx + 12 + s1, sby + 20, sbx + 3 + s1 * 0.6, sby + 28 + wsway * 0.2], darken(p.accent, 0.15), 1, 1.4);
    line(sbx - 5 + s1, sby + 22, sbx + 3 + s1 * 0.6, sby + 28, 2, p.trim, 0.9);
    line(beltC[0] - nx * hw, beltC[1] - ny * hw, beltC[0] + nx * hw, beltC[1] + ny * hw, 6.5, p.accent);
    line(beltC[0] - nx * hw, beltC[1] - ny * hw - 2, beltC[0] + nx * hw, beltC[1] + ny * hw - 2, 1.2, lighten(p.accent, 0.4), 0.6);
  }
  // epaulettes
  if (dec.includes('epaulettes')) {
    for (const s of [-1, 1]) {
      const ex0 = sh[0] + nx * sw * 0.9 * s, ey0 = sh[1] + ny * sw * 0.9 * s;
      poly([ex0 - 6, ey0 - 3, ex0 + 6, ey0 - 3, ex0 + 6, ey0 + 3, ex0 - 6, ey0 + 3], p.trim, 1, 1.2);
      for (let i = 0; i < 4; i++) line(ex0 - 5 + i * 3.3, ey0 + 3, ex0 - 5 + i * 3.3 + wsway * 0.1, ey0 + 11, 1.4, lighten(p.trim, 0.2), 0.95);
      circ(ex0, ey0 - 1, 2, p.accent);
    }
  }
  // scarf
  if (dec.includes('scarf')) {
    poly([sh[0] - nx * (sw * 0.7) + ux * 2, sh[1] - ny * (sw * 0.7) + uy * 2, sh[0] + nx * (sw * 0.6) + ux * 6, sh[1] + ny * (sw * 0.6) + uy * 6, sh[0] + nx * (sw * 0.6) - ux * 2, sh[1] + ny * (sw * 0.6) - uy * 2, sh[0] - nx * (sw * 0.7) - ux * 3, sh[1] - ny * (sw * 0.7) - uy * 3], p.accent, 1, 1.3);
    const sx3 = sh[0] - nx * sw * 0.6, sy3 = sh[1] - ny * sw * 0.6;
    poly([sx3, sy3, sx3 - 10 + trailX * 0.5, sy3 + 8 + Math.sin(ctx.clock * 0.2) * 3, sx3 - 22 + trailX, sy3 + 18, sx3 - 4, sy3 + 4], p.accent, 1, 1.2);
  }
  // unku / poncho shoulders cape for unku (mantle at back handled above by tunic)
  if (art.cape === 'unku') {
    const sx3 = sh[0] - nx * sw * 0.7, sy3 = sh[1] - ny * sw * 0.7;
    const wv = Math.sin(ctx.clock * 0.14) * 3;
    poly([sx3, sy3, sh[0] + nx * 2, sh[1] + ny * 2, hip[0] + trailX * 0.5 + wv + 2, hip[1] + 6, hip[0] - hw - 8 + trailX, hip[1] + 8], p.accent, 0.95, 1.6);
    line(sx3, sy3, hip[0] - hw - 8 + trailX, hip[1] + 8, 2, p.trim, 0.8);
  }

  // ---- neck + head
  const headAng = lean + P.tilt;
  const hcx = sh[0] + Math.sin(headAng) * 20, hcy = sh[1] - Math.cos(headAng) * 20;
  line(sh[0], sh[1], hcx, hcy + 5, 10, darken(p.skin, 0.55)); line(sh[0], sh[1], hcx, hcy + 5, 8, darken(p.skin, 0.2));
  drawHead(hcx, hcy, P.tilt + lean * 0.4, art, P.expr, wsway);

  // ---- front arm + weapon
  const fsx = sh[0] + nx * 3, fsy = sh[1] + ny * 3 + 2;
  drawArm(fsx, fsy, fsx + (fhx - sh[0]) - (fsx - sh[0]) + 0, fsy + (fhy - sh[1]) - 2, art, true, bare, fist);
  const fxh = EX, fyh = EY;
  if (!fist) drawWeapon(art.weapon, fxh, fyh, P.wa, art, P, Math.max(P.glow, ctx.flashSpec ? 1 : 0));
  else if (P.glow > 0.2) circ(fxh, fyh, 12 + P.glow * 3, p.aura, 0.3);
  lastHand[0] = fxh; lastHand[1] = fyh;
  lastHead[0] = hcx; lastHead[1] = hcy;
}
const lastHand = [0, 0];
const lastHead = [0, 0];

/* ------------------------------------------------------------ effects */
function drawTrail(art: CharArt, t: Trail, cur: Pose): void {
  const aura = art.palette.aura;
  const col = t.kind === 2 ? aura : mixc(aura, 0xffffff, 0.25);
  const [cx, cy] = shoulderOf(t.h);
  const [tw0, tw1] = tipOf(t.w, art.weapon);
  const [th0, th1] = tipOf(t.h, art.weapon);
  const aS = Math.atan2(-(tw1 - cy), tw0 - cx), rS = Math.hypot(tw0 - cx, tw1 - cy);
  const aE0 = Math.atan2(-(th1 - cy), th0 - cx), rE = Math.hypot(th0 - cx, th1 - cy);
  const span = wrapA(aE0 - aS);
  const al = t.al;
  if (Math.abs(span) < 0.4) {
    const [tx, ty] = tipOf(cur, art.weapon);
    const d: [number, number] = [Math.cos(cur.wa), -Math.sin(cur.wa)];
    const len = (60 + 60 * t.prog) * Math.min(1.3, 0.5 + al);
    const nx = -d[1], ny = d[0];
    poly([tx + d[0] * 6, ty + d[1] * 6, tx - d[0] * len + nx * 12, ty - d[1] * len + ny * 12, tx - d[0] * len - nx * 12, ty - d[1] * len - ny * 12], col, 0.5 * al);
    poly([tx + d[0] * 4, ty + d[1] * 4, tx - d[0] * len * 0.75 + nx * 4.5, ty - d[1] * len * 0.75 + ny * 4.5, tx - d[0] * len * 0.75 - nx * 4.5, ty - d[1] * len * 0.75 - ny * 4.5], 0xffffff, 0.85 * al);
    return;
  }
  const n = 9;
  for (let layer = 0; layer < 2; layer++) {
    const inner = layer === 0 ? 0.5 : 0.8;
    const c = layer === 0 ? col : 0xffffff;
    for (let i = 0; i < n; i++) {
      const k0 = (i / n) * t.prog, k1 = ((i + 1) / n) * t.prog;
      const a0 = aS + span * k0, a1 = aS + span * k1;
      const r0 = lerp(rS, rE, k0), r1 = lerp(rS, rE, k1);
      const a = al * (0.08 + 0.62 * ((i + 1) / n) * ((i + 1) / n)) * (layer === 0 ? 0.9 : 1);
      poly([
        cx + Math.cos(a0) * r0, cy - Math.sin(a0) * r0,
        cx + Math.cos(a1) * r1, cy - Math.sin(a1) * r1,
        cx + Math.cos(a1) * r1 * inner, cy - Math.sin(a1) * r1 * inner,
        cx + Math.cos(a0) * r0 * inner, cy - Math.sin(a0) * r0 * inner,
      ], c, a);
    }
  }
}

function auraGlow(cxl: number, cyl: number, color: number, k: number, clk: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(clk * 0.14);
  for (let i = 0; i < 4; i++) {
    const s = 1 + i * 0.2 + pulse * 0.06;
    ell(cxl, cyl, 40 * s, 96 * s, color, 0.08 * k * (1 - i * 0.16));
  }
  for (let i = 0; i < 6; i++) {
    const t = ((clk * 0.018 + i / 6) % 1);
    circ(cxl + Math.sin(i * 2.4 + clk * 0.05) * 32, cyl + 90 - t * 190, 2.8 * (1 - t) + 0.8, color, 0.7 * (1 - t) * k);
  }
}

function drawStar(x: number, y: number, r: number, c: number, a: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, an = -PI / 2 + i * PI / 5; pts.push(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
  poly(pts, c, a, 0);
}

/* =============================================================== exports */
export function drawFighter(g: Gfx, f: FighterView, opts: DrawOpts = {}): void {
  if (f.hidden) return;
  const art = f.char.art;
  const anim = opts.pose ?? f.anim;
  G = g;
  const sc = (opts.scale ?? 1) * art.height;
  SC = sc; FC = f.facing;
  OX = f.x + (opts.xOffset ?? 0); OY = f.y + (opts.yOffset ?? 0);
  AL = opts.alpha ?? 1;
  FL = Math.max(f.hitFlash > 0 ? Math.min(1, f.hitFlash > 1 ? f.hitFlash / 6 : f.hitFlash) : 0, opts.flash ?? 0);
  TN = opts.tint ?? -1;
  CLK = f.clock;
  RC = 1; RS = 0;
  if (anim === 'evade') AL *= 0.38;

  // shadow
  if (opts.shadow !== false) {
    const h = clamp((ARENA.ground - f.y) / 300, 0, 1);
    const prevAl = AL;
    g.fillStyle(0x000000, 0.34 * (1 - h * 0.7) * (opts.alpha ?? 1));
    const w = 120 * sc * (1 - h * 0.35), hh = 16 * sc * (1 - h * 0.35);
    g.fillEllipse(f.x + (opts.xOffset ?? 0), ARENA.ground + 4 + (opts.yOffset ?? 0) * 0, w, hh);
    g.fillStyle(0x000000, 0.2 * (1 - h * 0.7) * (opts.alpha ?? 1));
    g.fillEllipse(f.x + (opts.xOffset ?? 0), ARENA.ground + 4, w * 0.6, hh * 0.6);
    AL = prevAl;
  }

  const P = poseFor(f, anim, art);
  // rotation about the hip for airborne/lying reactions
  if (P.rot !== 0) { RC = Math.cos(P.rot); RS = Math.sin(P.rot); PVX = P.hx; PVY = P.hy; }

  const p = art.palette;
  const bodyCx = P.hx * 0.5 + P.lean * 20, bodyCy = P.hy - 28;
  const buffed = f.buffs.length > 0;
  const shield = f.buffs.includes('shield');

  // back glow
  if (buffed || P.glow > 0.3) {
    RS = 0; RC = 1;
    auraGlow(bodyCx, bodyCy + 10, p.aura, buffed ? 1 : P.glow * 0.8, f.clock);
    if (P.rot !== 0) { RC = Math.cos(P.rot); RS = Math.sin(P.rot); }
  }
  if (anim === 'counter' || anim === 'buff') {
    const sv = RS, cv = RC; RS = 0; RC = 1;
    const k = anim === 'buff' ? 1 - clamp(f.animT, 0, 1) : 1;
    for (let i = 0; i < 3; i++) {
      const t = ((f.clock * 0.04 + i / 3) % 1);
      pt(bodyCx, bodyCy + 20);
      g.lineStyle((3 - t * 2) * sc, fc(p.aura), (1 - t) * 0.7 * k * AL);
      g.strokeEllipse(PX, PY, (50 + t * 90) * sc, (80 + t * 120) * sc);
    }
    RS = sv; RC = cv;
  }

  // speed lines
  if (anim === 'dash' || anim === 'rush' || anim === 'backdash' || (anim === 'aerial')) {
    const sv = RS, cv = RC; RS = 0; RC = 1;
    const dir = anim === 'backdash' ? 1 : -1;
    for (let i = 0; i < 6; i++) {
      const yy = -20 - i * 24 + ((f.clock + i * 7) % 5);
      const len = 50 + ((f.clock * 13 + i * 31) % 50);
      const x0 = (anim === 'backdash' ? 20 : -26) + dir * (14 + (i % 3) * 10);
      line(x0, yy, x0 + dir * len, yy, 2.4 - (i % 3) * 0.5, anim === 'rush' ? p.aura : 0xffffff, 0.35 - (i % 3) * 0.06);
    }
    RS = sv; RC = cv;
  }

  drawFigure(f, art, P, { vx: f.vx, vy: f.vy, clock: f.clock, anim, flashSpec: anim === 'slash' || anim === 'counter' || anim === 'rush' });

  // weapon trail
  if (TRL && TRL.al > 0.03) drawTrail(art, TRL, P);

  // cast orb
  if (anim === 'cast' && P.glow > 0.05) {
    const sv = RS, cv = RC; RS = 0; RC = 1;
    const [hx, hy] = lastHand;
    const pulse = 1 + Math.sin(f.clock * 0.5) * 0.12;
    const r = (10 + P.glow * 16) * pulse;
    // lastHand is in pose-local coords (no rotation for cast)
    circ(hx + 14, hy, r * 1.9, p.aura, 0.12 * P.glow); circ(hx + 14, hy, r * 1.3, p.aura, 0.25 * P.glow);
    circ(hx + 14, hy, r * 0.8, lighten(p.aura, 0.5), 0.6 * P.glow); circ(hx + 14, hy, r * 0.4, 0xffffff, 0.9 * P.glow);
    for (let i = 0; i < 5; i++) {
      const a = f.clock * 0.2 + i * 1.26, rr = r * 1.6;
      circ(hx + 14 + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.7, 2.2, 0xffffff, 0.8 * P.glow);
    }
    RS = sv; RC = cv;
  }
  // block spark arc
  if ((anim === 'block' || anim === 'crouchBlock') && f.animFrame < 12) {
    const sv = RS, cv = RC; RS = 0; RC = 1;
    const k = 1 - f.animFrame / 12;
    const [hx, hy] = lastHand;
    ring(hx + 14, hy - 4, 16 + (1 - k) * 22, 36 + (1 - k) * 14, 3.4 * k + 1, 0xffffff, 0.8 * k, 0);
    ring(hx + 14, hy - 4, 12 + (1 - k) * 22, 30 + (1 - k) * 14, 6 * k, p.aura, 0.4 * k, 0);
    RS = sv; RC = cv;
  }
  // dazed stars
  if (anim === 'dazed') {
    const sv = RS, cv = RC; RS = 0; RC = 1;
    const [hx, hy] = lastHead;
    for (let i = 0; i < 3; i++) {
      const a = f.clock * 0.1 + i * 2.09;
      drawStar(hx + Math.cos(a) * 24, hy - 32 + Math.sin(a) * 7, 6, i % 2 ? 0xfff2a0 : p.trim, 0.95);
    }
    RS = sv; RC = cv;
  }
  // buff burst rings handled above; shield bubble
  if (shield) {
    const sv = RS, cv = RC; RS = 0; RC = 1;
    pt(bodyCx, bodyCy + 6);
    const pulse = 1 + Math.sin(f.clock * 0.12) * 0.02;
    g.fillStyle(fc(p.aura), 0.1 * AL); g.fillEllipse(PX, PY, 120 * sc * pulse, 214 * sc * pulse);
    g.lineStyle(3 * sc, fc(lighten(p.aura, 0.5)), 0.65 * AL); g.strokeEllipse(PX, PY, 120 * sc * pulse, 214 * sc * pulse);
    g.lineStyle(1.5 * sc, 0xffffff, 0.5 * AL);
    g.beginPath(); g.arc(PX, PY, 54 * sc, -2.4, -1.5); g.strokePath();
    RS = sv; RC = cv;
  }
  RS = 0; RC = 1;
}

/* -------------------------------------------------------------- portraits */
export function drawPortraitBackdrop(g: Gfx, char: CharacterDef, x: number, y: number, w: number, h: number): void {
  const aura = char.art.palette.aura;
  const base = darken(mixc(char.art.palette.primary, aura, 0.35), 0.78);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    g.fillStyle(mixc(darken(base, 0.1), 0x050407, ease(k) * 0.85), 1);
    g.fillRect(x, y + (h * i) / n, w, h / n + 1);
  }
  // radial glow behind head
  const cx = x + w * 0.5, cy = y + h * 0.42;
  for (let i = 0; i < 7; i++) {
    const s = 1 - i / 7;
    g.fillStyle(aura, 0.05 + 0.025 * i);
    g.fillEllipse(cx, cy, w * 1.0 * s, h * 0.8 * s);
  }
  // light shafts
  g.fillStyle(lighten(aura, 0.3), 0.07);
  g.fillTriangle(cx - w * 0.05, y, cx - w * 0.5, y + h, cx - w * 0.15, y + h);
  g.fillTriangle(cx + w * 0.1, y, cx + w * 0.55, y + h, cx + w * 0.2, y + h);
  // vignette
  for (let i = 0; i < 6; i++) {
    const a = 0.34 * (1 - i / 6) * (1 - i / 6);
    g.fillStyle(0x000000, a);
    g.fillRect(x, y + i * (h * 0.025), w, h * 0.025 + 1);
    g.fillRect(x, y + h - (i + 1) * (h * 0.04), w, h * 0.04 + 1);
    g.fillRect(x + i * (w * 0.03), y, w * 0.03 + 1, h);
    g.fillRect(x + w - (i + 1) * (w * 0.03), y, w * 0.03 + 1, h);
  }
}

export function drawPortrait(g: Gfx, char: CharacterDef, cx: number, cy: number, size: number, opts?: { alpha?: number }): void {
  const art = char.art, p = art.palette;
  G = g;
  SC = size / 100; FC = 1; AL = opts?.alpha ?? 1; FL = 0; TN = -1; RC = 1; RS = 0; CLK = 0;
  OX = cx; OY = cy + 155 * SC;
  const { sw } = bodyDims(art);
  const dec = art.decor || [];
  const prim = p.primary, primD = darken(prim, 0.35), primL = lighten(prim, 0.25);
  const bare = dec.includes('warpaint') || art.cape === 'unku';
  const sy = -138, bot = -108;

  // behind: cape / banner / hair mass
  if (art.cape === 'cape') {
    poly([-sw - 9, sy + 2, sw - 2, sy + 2, sw + 4, bot, -sw - 14, bot], darken(prim, 0.45), 1, 1.6);
    line(-sw - 14, bot - 1, sw + 4, bot - 1, 3, p.accent, 0.9);
  } else if (art.cape === 'banner') {
    line(-sw - 8, bot, -sw - 8, sy - 38, 3.4, 0x8a6240);
    poly([-sw - 8, sy - 36, -sw - 28, sy - 30, -sw - 27, sy - 8, -sw - 8, sy - 12], prim, 1, 1.4);
    line(-sw - 8, sy - 23, -sw - 28, sy - 19, 4, p.accent, 0.95);
  }
  if (art.hair === 'long' || art.female) {
    // long hair spills behind shoulders
    if (art.hair === 'long') poly([-17, -150, -24, -128, -sw - 4, bot, -10, bot, -6, -134], p.hair, 1, 1.5);
  }
  // torso/shoulders
  const shw = sw + 3;
  poly([-shw, sy + 8, -shw + 5, sy, -6, sy - 2, 6, sy - 2, shw - 5, sy, shw, sy + 8, shw + 3, bot, -shw - 3, bot], prim, 1, 2);
  poly([-shw, sy + 8, -shw + 5, sy, -6, sy - 2, 0, sy - 2, 0, bot, -shw - 3, bot], primD, 0.45, 0);
  circ(-shw + 3, sy + 4, 8, prim); circ(shw - 3, sy + 4, 8, prim);
  circ(-shw + 3, sy + 4, 8, primD, 0.35);
  // front shoulder rim
  polyline([shw - 4, sy - 0.5, shw, sy + 8, shw + 3, bot], 2, primL, 0.75);
  if (bare && art.cape !== 'unku') { /* nothing */ }
  // collar / shirt
  if (art.cape === 'poncho') {
    poly([-shw - 2, sy + 6, shw + 2, sy + 6, shw + 5, bot, -shw - 5, bot], darken(prim, 0.05), 1, 2);
    for (let i = 0; i < 2; i++) line(-shw - 4, sy + 16 + i * 10, shw + 4, sy + 16 + i * 10, 4, i ? p.secondary : p.accent, 0.95);
    poly([-9, sy - 1, 9, sy - 1, 4, sy + 9, -4, sy + 9], darken(prim, 0.65), 1, 0);
  } else if (art.cape === 'unku') {
    poly([-shw, sy + 6, shw, sy + 6, shw + 3, bot, -shw - 3, bot], prim, 1, 2);
    poly([-9, sy - 1, 9, sy - 1, 5, sy + 8, -5, sy + 8], darken(p.skin, 0.1), 1, 0);
    for (let i = 0; i < 6; i++) {
      const x0 = -shw + (shw * 2 / 6) * i;
      poly([x0, sy + 14, x0 + shw / 3, sy + 14, x0 + shw / 3, sy + 20, x0, sy + 20], i % 2 ? p.accent : p.secondary, 1, 0);
      poly([x0, sy + 20, x0 + shw / 3, sy + 20, x0 + shw / 3, sy + 26, x0, sy + 26], i % 2 ? p.secondary : p.accent, 1, 0);
    }
    poly([-shw - 2, sy + 4, -shw + 12, sy + 2, -shw + 8, sy + 24, -shw - 5, sy + 22], p.accent, 0.95, 1.2);
  } else {
    // shirt V + cravat
    poly([-8, sy - 1, 8, sy - 1, 0, sy + 20], p.secondary, 1, 1);
    poly([-6, sy - 2, 6, sy - 2, 2, sy + 6, -2, sy + 6], lighten(p.secondary, 0.3), 1, 0.8);
    // lapels
    poly([-9, sy - 2, -2, sy + 22, -shw + 3, sy + 24, -shw + 6, sy + 4], darken(prim, 0.1), 1, 1.2);
    poly([9, sy - 2, 2, sy + 22, shw - 3, sy + 24, shw - 6, sy + 4], primL, 0.35, 0);
    polyline([9, sy - 1, 2, sy + 22], 1.6, p.trim, 0.9); polyline([-9, sy - 1, -2, sy + 22], 1.6, p.trim, 0.9);
    // stand collar
    poly([-12, sy - 6, -5, sy - 3, -7, sy + 7, -14, sy + 3], p.secondary, 1, 1.2);
    poly([12, sy - 6, 5, sy - 3, 7, sy + 7, 14, sy + 3], p.secondary, 1, 1.2);
    line(-13, sy - 4, -6, sy - 2, 1.6, p.trim, 0.95); line(13, sy - 4, 6, sy - 2, 1.6, p.trim, 0.95);
    for (let i = 0; i < 3; i++) circ(10 - i * 0.6, sy + 15 + i * 5.5, 2.2, p.trim);
  }
  if (dec.includes('armor')) {
    poly([-shw + 4, sy + 2, shw - 4, sy + 2, shw - 8, bot, -shw + 8, bot], darken(p.secondary, 0.25), 1, 1.6);
    poly([-shw - 4, sy + 2, -shw + 12, sy - 2, -shw + 10, sy + 16, -shw - 5, sy + 14], darken(p.secondary, 0.1), 1, 1.4);
    poly([shw + 4, sy + 2, shw - 12, sy - 2, shw - 10, sy + 16, shw + 5, sy + 14], lighten(p.secondary, 0.1), 1, 1.4);
    circ(0, sy + 18, 4, p.trim);
  }
  if (dec.includes('sash')) {
    poly([-shw + 2, sy + 2, -shw + 12, sy, shw - 2, bot - 8, shw - 12, bot], p.accent, 1, 1.2);
    line(-shw + 7, sy + 1, shw - 7, bot - 4, 1.4, p.trim, 0.8);
  }
  if (art.cape === 'sash' && !dec.includes('sash')) {
    poly([-shw + 2, sy + 4, -shw + 11, sy + 2, shw - 3, bot - 10, shw - 12, bot - 4], p.accent, 0.95, 1.2);
  }
  if (dec.includes('epaulettes')) {
    for (const s of [-1, 1]) {
      const ex0 = s * (shw - 2), ey0 = sy + 1;
      poly([ex0 - 8, ey0 - 3, ex0 + 8, ey0 - 3, ex0 + 8, ey0 + 3, ex0 - 8, ey0 + 3], p.trim, 1, 1.2);
      for (let i = 0; i < 5; i++) line(ex0 - 6 + i * 3, ey0 + 3, ex0 - 6 + i * 3, ey0 + 11, 1.4, lighten(p.trim, 0.2), 0.95);
      circ(ex0, ey0, 2.2, p.accent);
    }
  }
  if (dec.includes('medals')) {
    for (let i = 0; i < 3; i++) {
      const mx = 6 + i * 6;
      line(mx, sy + 14, mx - 1, sy + 24, 2.6, i === 1 ? p.accent : p.secondary, 0.95);
      circ(mx - 1, sy + 26, 3.2, p.trim); circ(mx - 1, sy + 26, 1.4, lighten(p.trim, 0.5));
    }
  }
  if (dec.includes('scarf')) {
    poly([-shw + 2, sy - 2, shw - 2, sy - 2, shw - 4, sy + 9, -shw + 4, sy + 9], p.accent, 1, 1.4);
    poly([4, sy + 6, 14, sy + 6, 10, sy + 26, 2, sy + 22], darken(p.accent, 0.15), 1, 1.2);
  }
  // neck
  poly([-5.5, sy - 14, 5.5, sy - 14, 6.5, sy - 1, -6.5, sy - 1], darken(p.skin, 0.25), 1, 1.2);
  poly([-5.5, sy - 14, 1, sy - 14, 1, sy - 1, -6.5, sy - 1], darken(p.skin, 0.5), 0.4, 0);
  // head
  drawHead(0, -152, -0.04, art, 0, 0);

  // dramatic rim light (from the right) on head + shoulder
  const rim = lighten(p.aura, 0.55);
  const rp = ellPts(0, -152, 14.9 * (art.female ? 0.94 : 1), 14.9 * (art.female ? 0.94 : 1), 10, 0, -PI * 0.42, PI * 0.12);
  polyline(rp, 2.4, rim, 0.85);
  polyline(rp, 5, p.aura, 0.25);
  polyline([shw - 3, sy - 1, shw + 1, sy + 8, shw + 4, bot], 2.6, rim, 0.8);
  for (let i = 0; i < 4; i++) { g.fillStyle(0x000000, 0.12 * AL); pt(-40, bot - i * 3.5); const yy = PY; g.fillRect(OX - 45 * SC, yy, 90 * SC, 3.6 * SC); }
  // cool shadow on the left side
  circ(-9, -148, 12, 0x000000, 0.0);
  polyline([-shw + 2, sy, -shw - 3, sy + 8, -shw - 4, bot], 1.6, darken(p.aura, 0.4), 0.5);
}
