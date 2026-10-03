// Procedural projectile / ghost / impact effect renderer (Phaser Graphics only).
import Phaser from 'phaser';
import type { ProjVis, GhostVis } from '../combat/types';

type Gfx = Phaser.GameObjects.Graphics;
interface Pt { x: number; y: number }

const PI = Math.PI;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mixc(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
const lighten = (c: number, t: number) => mixc(c, 0xffffff, t);
const darken = (c: number, t: number) => mixc(c, 0x000000, t);

/* ------------------------------------------------------------ draw state */
let g!: Gfx;
let OX = 0, OY = 0, D = 1, AM = 1;
let PX = 0, PY = 0;
function pt(x: number, y: number): void { PX = OX + D * x; PY = OY + y; }

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
      g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
      idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) {
    const a = scr[idx[0]], b = scr[idx[1]], c = scr[idx[2]];
    g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  }
}
function poly(p: number[], c: number, a = 1, edge = -1, ew = 1.4, ea = 1): void {
  const n = loadPts(p);
  if (n < 3) return;
  g.fillStyle(c, a * AM);
  if (isConvex(n)) g.fillPoints(scr, true, true, n); else earClip(n);
  if (edge >= 0) { g.lineStyle(ew, edge, a * AM * ea); g.strokePoints(scr, true, true, n); }
}
function polyline(p: number[], w: number, c: number, a = 1): void {
  const n = loadPts(p);
  if (n < 2) return;
  g.lineStyle(w, c, a * AM);
  g.strokePoints(scr, false, false, n);
}
function circ(x: number, y: number, r: number, c: number, a = 1): void {
  pt(x, y); g.fillStyle(c, a * AM); g.fillCircle(PX, PY, Math.max(0.3, r));
}
function ring(x: number, y: number, rx: number, ry: number, w: number, c: number, a = 1): void {
  pt(x, y); g.lineStyle(w, c, a * AM); g.strokeEllipse(PX, PY, rx * 2, ry * 2);
}
function line(x1: number, y1: number, x2: number, y2: number, w: number, c: number, a = 1): void {
  pt(x1, y1); const ax = PX, ay = PY; pt(x2, y2);
  g.lineStyle(w, c, a * AM); g.lineBetween(ax, ay, PX, PY);
}
function ellPts(cx: number, cy: number, rx: number, ry: number, n = 12, rot = 0, a0 = 0, a1 = PI * 2): number[] {
  const o: number[] = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    o.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
  }
  if (a1 - a0 >= PI * 2 - 0.001) o.length -= 2;
  return o;
}
function ell(cx: number, cy: number, rx: number, ry: number, c: number, a = 1, rot = 0, edge = -1): void {
  poly(ellPts(cx, cy, rx, ry, 14, rot), c, a, edge);
}
function glow(cx: number, cy: number, rx: number, ry: number, c: number, a = 0.3): void {
  ell(cx, cy, rx * 1.5, ry * 1.5, c, a * 0.35);
  ell(cx, cy, rx * 1.2, ry * 1.2, c, a * 0.55);
  ell(cx, cy, rx, ry, c, a);
}
/** spectral silhouette polygon */
function sp(p: number[], c: number, a = 0.5): void { poly(p, c, a, lighten(c, 0.6), 1.5, 1.6); }
/** limb as thick line with round ends */
function limb(x1: number, y1: number, x2: number, y2: number, w: number, c: number, a = 0.5): void {
  line(x1, y1, x2, y2, w + 2, lighten(c, 0.55), a * 1.3);
  line(x1, y1, x2, y2, w, c, a);
  circ(x1, y1, w / 2, c, a); circ(x2, y2, w / 2, c, a);
}

/* ============================================================ silhouettes */
/** marching soldier, feet at (x,y), height ~118*s */
function soldierShape(x: number, y: number, s: number, t: number, c: number, c2: number, a: number): void {
  const sw = Math.sin(t), lift = Math.max(0, Math.cos(t)) * 8;
  const bob = Math.abs(Math.sin(t)) * 2;
  const Y = y - bob * s;
  // legs
  limb(x, Y - 48 * s, x + sw * 12 * s, y - lift * s * 0.2 - 2 * s, 9 * s, c, a);
  limb(x, Y - 48 * s, x - sw * 12 * s, y - Math.max(0, -Math.cos(t)) * 8 * s - 2 * s, 9 * s, c, a);
  // musket (behind arm)
  limb(x - 18 * s, Y - 60 * s, x + 40 * s, Y - 80 * s, 3.4 * s, c2, a);
  poly([x + 40 * s, Y - 80 * s, x + 66 * s, Y - 87 * s, x + 40 * s, Y - 77 * s], lighten(c, 0.8), a * 1.4);
  // torso
  sp([x - 10 * s, Y - 46 * s, x - 9 * s, Y - 88 * s, x + 9 * s, Y - 88 * s, x + 10 * s, Y - 46 * s], c, a);
  line(x - 8 * s, Y - 86 * s, x + 8 * s, Y - 52 * s, 2.2 * s, lighten(c, 0.8), a * 0.9);
  line(x + 8 * s, Y - 86 * s, x - 8 * s, Y - 52 * s, 2.2 * s, lighten(c, 0.8), a * 0.9);
  // arm
  limb(x + 5 * s, Y - 84 * s, x + 20 * s, Y - 68 * s, 6 * s, c, a);
  // head + shako
  circ(x + 1 * s, Y - 96 * s, 8 * s, c, a); circ(x + 1 * s, Y - 96 * s, 8 * s, lighten(c, 0.5), a * 0.4);
  sp([x - 7 * s, Y - 101 * s, x - 8 * s, Y - 122 * s, x + 8 * s, Y - 122 * s, x + 8 * s, Y - 101 * s], c, a);
  circ(x + 1 * s, Y - 125 * s, 3.4 * s, c2, a * 1.2);
}
/** galloping horse, hooves at y, facing +x. returns saddle point via out array */
const SAD = [0, 0];
function horseShape(x: number, y: number, s: number, t: number, c: number, c2: number, a: number): void {
  const by = y - Math.abs(Math.sin(t)) * 4 * s;
  const ph = (o: number) => t + o;
  const legPts = (hx: number, hy: number, p: number): [number, number, number, number] => {
    const ang = Math.sin(p) * 0.85;
    const kx = hx + Math.sin(ang) * 26 * s, ky = hy + Math.cos(ang) * 26 * s;
    const a2 = ang * 0.4 - 0.75 * Math.max(0, Math.cos(p));
    return [kx, ky, kx + Math.sin(a2) * 26 * s, Math.min(y, ky + Math.cos(a2) * 26 * s)];
  };
  const legs: [number, number, number][] = [[-26, -50, 3.2], [-22, -50, 3.8], [24, -52, 0.4], [28, -52, 0.0]];
  for (let i = 0; i < 4; i++) {
    const [lx, ly, o] = legs[i];
    const hx = x + lx * s, hy = by + ly * s;
    const [kx, ky, fx, fy] = legPts(hx, hy, ph(o));
    const dim = i % 2 === 0 ? 0.8 : 1;
    limb(hx, hy, kx, ky, 8 * s, c, a * dim); limb(kx, ky, fx, fy, 5.5 * s, c, a * dim);
    circ(fx, fy, 3.4 * s, lighten(c, 0.4), a * dim);
  }
  // tail
  const tw = Math.sin(t * 1.3) * 6 * s;
  poly([x - 36 * s, by - 68 * s, x - 70 * s, by - 52 * s + tw, x - 78 * s, by - 34 * s + tw, x - 58 * s, by - 46 * s, x - 38 * s, by - 56 * s], c2, a * 0.9, lighten(c, 0.5), 1.2);
  // body
  sp(ellPts(x, by - 62 * s, 40 * s, 18 * s, 14), c, a);
  // neck + head
  sp([x + 24 * s, by - 72 * s, x + 50 * s, by - 100 * s, x + 62 * s, by - 94 * s, x + 40 * s, by - 56 * s], c, a);
  sp(ellPts(x + 62 * s, by - 92 * s, 15 * s, 6.5 * s, 10, 0.5), c, a);
  poly([x + 52 * s, by - 100 * s, x + 54 * s, by - 110 * s, x + 58 * s, by - 100 * s], c, a * 1.1);
  // mane
  poly([x + 28 * s, by - 76 * s, x + 50 * s, by - 106 * s, x + 44 * s, by - 90 * s + tw * 0.3, x + 24 * s, by - 66 * s], c2, a, -1);
  SAD[0] = x + 4 * s; SAD[1] = by - 78 * s;
}
function riderShape(x: number, y: number, s: number, t: number, c: number, c2: number, a: number, gaucho: boolean): void {
  horseShape(x, y, s, t, c, c2, a);
  const sx = SAD[0], sy = SAD[1];
  const lean = 6 * s;
  // leg
  limb(sx, sy + 2 * s, sx + 10 * s, sy + 26 * s, 8 * s, c, a);
  // torso
  sp([sx - 8 * s, sy + 2 * s, sx - 8 * s + lean, sy - 36 * s, sx + 9 * s + lean, sy - 36 * s, sx + 9 * s, sy + 2 * s], c, a);
  if (gaucho) {
    // poncho flowing back
    const fl = Math.sin(t * 1.5) * 5 * s;
    sp([sx - 8 * s + lean, sy - 36 * s, sx + 12 * s + lean, sy - 34 * s, sx + 14 * s, sy - 2 * s, sx - 34 * s, sy + 2 * s + fl, sx - 30 * s, sy - 18 * s], c2, a * 0.9);
    line(sx - 24 * s, sy - 16 * s, sx + 12 * s, sy - 18 * s, 2.5 * s, lighten(c, 0.7), a);
  }
  circ(sx + 4 * s + lean, sy - 46 * s, 8 * s, c, a); circ(sx + 4 * s + lean, sy - 46 * s, 8 * s, lighten(c, 0.5), a * 0.4);
  if (gaucho) {
    ell(sx + 4 * s + lean, sy - 53 * s, 17 * s, 3.4 * s, c2, a * 1.1, 0, lighten(c, 0.5));
    poly([sx - 4 * s + lean, sy - 53 * s, sx - 3 * s + lean, sy - 62 * s, sx + 11 * s + lean, sy - 62 * s, sx + 12 * s + lean, sy - 53 * s], c2, a * 1.1);
    // facon raised
    limb(sx + 6 * s, sy - 30 * s, sx + 28 * s, sy - 44 * s, 5.4 * s, c, a);
    line(sx + 28 * s, sy - 44 * s, sx + 56 * s, sy - 56 * s, 3 * s, lighten(c, 0.9), a * 1.3);
  } else {
    sp([sx - 3 * s + lean, sy - 53 * s, sx - 4 * s + lean, sy - 70 * s, sx + 12 * s + lean, sy - 70 * s, sx + 12 * s + lean, sy - 53 * s], c, a);
    circ(sx + 4 * s + lean, sy - 73 * s, 3 * s, c2, a * 1.2);
    limb(sx + 6 * s, sy - 30 * s, sx + 24 * s, sy - 52 * s, 5.4 * s, c, a);
    line(sx + 24 * s, sy - 52 * s, sx + 60 * s, sy - 82 * s, 3.4 * s, lighten(c, 0.9), a * 1.3);
    line(sx + 24 * s, sy - 52 * s, sx + 60 * s, sy - 82 * s, 1.2 * s, 0xffffff, a * 1.4);
  }
}
function warriorShape(x: number, y: number, s: number, t: number, c: number, c2: number, a: number): void {
  const sw = Math.sin(t);
  const Y = y - Math.abs(sw) * 3 * s;
  limb(x, Y - 46 * s, x + sw * 22 * s, y - Math.max(0, Math.cos(t)) * 14 * s - 2 * s, 9 * s, c, a);
  limb(x, Y - 46 * s, x - sw * 22 * s, y - Math.max(0, -Math.cos(t)) * 14 * s - 2 * s, 9 * s, c, a);
  // spear
  limb(x - 24 * s, Y - 68 * s, x + 70 * s, Y - 88 * s, 3 * s, c2, a);
  poly([x + 70 * s, Y - 88 * s, x + 90 * s, Y - 94 * s, x + 72 * s, Y - 82 * s], lighten(c, 0.85), a * 1.4);
  // torso leaning
  sp([x - 9 * s, Y - 44 * s, x - 6 * s, Y - 86 * s, x + 14 * s, Y - 84 * s, x + 10 * s, Y - 44 * s], c, a);
  poly([x - 10 * s, Y - 44 * s, x + 11 * s, Y - 44 * s, x + 8 * s, Y - 30 * s, x - 8 * s, Y - 30 * s], c2, a);
  limb(x + 8 * s, Y - 80 * s, x + 24 * s, Y - 72 * s, 6 * s, c, a);
  limb(x + 4 * s, Y - 80 * s, x - 12 * s, Y - 70 * s, 6 * s, c, a * 0.8);
  // head + feather headdress
  const hx = x + 10 * s, hy = Y - 96 * s;
  for (let i = 0; i < 7; i++) {
    const ang = -2.9 + i * 0.34 + Math.sin(t * 1.3 + i) * 0.05, L = 30 * s - Math.abs(i - 3) * 2 * s;
    const tx = hx + Math.cos(ang) * L, ty = hy - 2 * s + Math.sin(ang) * L;
    const nx = -Math.sin(ang) * 3.4 * s, ny = Math.cos(ang) * 3.4 * s;
    poly([hx - nx * 0.4, hy - ny * 0.4, tx, ty, hx + nx * 0.4 + nx, hy + ny * 0.4 + ny], i % 2 ? c2 : lighten(c2, 0.4), a * 1.1, lighten(c, 0.6), 1);
  }
  circ(hx, hy, 8.4 * s, c, a); circ(hx, hy, 8.4 * s, lighten(c, 0.5), a * 0.4);
  line(hx - 8 * s, hy - 3 * s, hx + 8 * s, hy - 3 * s, 3 * s, c2, a * 1.2);
}
function condorShape(x: number, y: number, s: number, t: number, c: number, c2: number, a: number, tilt = 0): void {
  const fl = Math.sin(t * 0.35);
  const cr = Math.cos(tilt), sr = Math.sin(tilt);
  const R = (px: number, py: number): [number, number] => [x + (px * cr - py * sr) * s, y + (px * sr + py * cr) * s];
  const P = (arr: number[]): number[] => { const o: number[] = []; for (let i = 0; i < arr.length; i += 2) { const [a1, b1] = R(arr[i], arr[i + 1]); o.push(a1, b1); } return o; };
  const wing = (dim: number, off: number): void => {
    const base = -1.75 + fl * 0.85 + off;
    const sh = R(6, -3);
    for (let i = 0; i < 7; i++) {
      const ang = base - 0.1 + i * 0.2 - fl * 0.12 * i * 0.3;
      const L = (74 - Math.abs(i - 3) * 3 + (i === 0 ? -14 : 0)) * s;
      const tx = sh[0] + Math.cos(ang) * L - 16 * s * (i / 6), ty = sh[1] + Math.sin(ang) * L;
      const nx = -Math.sin(ang) * 6 * s, ny = Math.cos(ang) * 6 * s;
      poly([sh[0] - nx * 0.3, sh[1] - ny * 0.3, tx - nx * 0.5, ty - ny * 0.5, tx + nx, ty + ny, sh[0] + nx, sh[1] + ny], i % 2 ? darken(c, 0.2) : c, a * dim, lighten(c, 0.55), 1.2);
    }
    const mid = base + 0.55;
    poly([sh[0], sh[1], sh[0] + Math.cos(base) * 32 * s, sh[1] + Math.sin(base) * 32 * s, sh[0] + Math.cos(mid + 0.5) * 30 * s - 10 * s, sh[1] + Math.sin(mid + 0.5) * 30 * s, sh[0] - 8 * s, sh[1] + 6 * s], lighten(c, 0.15), a * dim, lighten(c, 0.55), 1.2);
  };
  wing(0.7, 0.28);
  // tail fan
  for (let i = 0; i < 3; i++) { const q = P([-24, 0 + i * 3, -52, -6 + i * 8, -50, -1 + i * 8, -22, 3 + i * 2]); poly(q, darken(c, 0.15), a, lighten(c, 0.5), 1.1); }
  // body
  poly(P(ellPts(0, 0, 28, 10, 12)), c, a, lighten(c, 0.6), 1.5);
  // neck ruff + head + beak
  const ruff = R(26, -3);
  circ(ruff[0], ruff[1], 7 * s, c2, a * 1.1);
  const hd = R(33, -6);
  circ(hd[0], hd[1], 6 * s, lighten(c, 0.3), a * 1.05);
  poly(P([37, -9, 47, -5, 43, -1, 37, -3]), lighten(c2, 0.2), a * 1.2, lighten(c, 0.7), 1);
  circ(hd[0] + 2 * s, hd[1] - 1 * s, 1.4 * s, 0xffffff, a * 1.4);
  wing(1, 0);
}
function tigerShape(x: number, y: number, s: number, t: number, c: number, c2: number, a: number): void {
  const by = y - Math.abs(Math.sin(t)) * 5 * s;
  const leg = (hx: number, hy: number, p: number, w: number): void => {
    const ang = Math.sin(p) * 0.95;
    const kx = hx + Math.sin(ang) * 18 * s, ky = hy + Math.cos(ang) * 18 * s;
    const a2 = ang * 0.5 - 0.7 * Math.max(0, Math.cos(p));
    const fx = kx + Math.sin(a2) * 18 * s, fy = Math.min(y - 2 * s, ky + Math.cos(a2) * 18 * s);
    limb(hx, hy, kx, ky, w * s, c, a); limb(kx, ky, fx, fy, (w - 2) * s, c, a);
    circ(fx + 2 * s, fy, 4.4 * s, lighten(c, 0.25), a);
  };
  leg(-28 * s + x, by - 38 * s, t + 3.1, 9); leg(-24 * s + x, by - 38 * s, t + 3.7, 9);
  leg(24 * s + x, by - 40 * s, t, 8); leg(28 * s + x, by - 40 * s, t + 0.6, 8);
  // tail
  const tw = Math.sin(t * 1.4) * 5 * s;
  polyline([x - 38 * s, by - 46 * s, x - 56 * s, by - 56 * s + tw, x - 66 * s, by - 76 * s + tw, x - 62 * s, by - 90 * s], 6 * s, c, a);
  sp(ellPts(x, by - 46 * s, 42 * s, 17 * s, 14, -0.05), c, a);
  for (let i = 0; i < 6; i++) {
    const sx = x - 26 * s + i * 11 * s;
    poly([sx, by - 62 * s, sx + 4 * s, by - 60 * s, sx + 2 * s, by - 40 * s + (i % 2) * 6 * s, sx - 2 * s, by - 42 * s], c2, a * 1.05);
  }
  // head
  sp(ellPts(x + 46 * s, by - 56 * s, 13 * s, 12 * s, 12), c, a);
  poly([x + 38 * s, by - 66 * s, x + 40 * s, by - 76 * s, x + 46 * s, by - 67 * s], c, a * 1.1, lighten(c, 0.6), 1);
  poly([x + 48 * s, by - 67 * s, x + 53 * s, by - 76 * s, x + 56 * s, by - 64 * s], c, a * 1.1, lighten(c, 0.6), 1);
  ell(x + 56 * s, by - 52 * s, 6 * s, 4.4 * s, lighten(c, 0.5), a);
  poly([x + 56 * s, by - 50 * s, x + 59 * s, by - 44 * s, x + 54 * s, by - 48 * s], 0xffffff, a * 1.3);
  circ(x + 51 * s, by - 58 * s, 1.8 * s, 0xffffff, a * 1.5);
  line(x + 42 * s, by - 62 * s, x + 46 * s, by - 56 * s, 2 * s, c2, a * 1.1);
}

/* ================================================================= glyphs */
const GLYPHS: Record<string, number[][]> = {
  A: [[0, 1, 0.5, 0, 1, 1], [0.2, 0.66, 0.8, 0.66]],
  B: [[0, 1, 0, 0, 0.7, 0, 0.9, 0.2, 0.7, 0.48, 0, 0.5], [0.7, 0.5, 1, 0.74, 0.7, 1, 0, 1]],
  R: [[0, 1, 0, 0, 0.75, 0, 0.95, 0.22, 0.75, 0.48, 0, 0.5], [0.45, 0.5, 1, 1]],
  E: [[1, 0, 0, 0, 0, 1, 1, 1], [0, 0.5, 0.75, 0.5]],
  L: [[0, 0, 0, 1, 1, 1]],
  I: [[0.2, 0, 0.8, 0], [0.5, 0, 0.5, 1], [0.2, 1, 0.8, 1]],
  T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  D: [[0, 0, 0, 1, 0.55, 1, 1, 0.7, 1, 0.3, 0.55, 0, 0, 0]],
  O: [[0.3, 0, 0.7, 0, 1, 0.3, 1, 0.7, 0.7, 1, 0.3, 1, 0, 0.7, 0, 0.3, 0.3, 0]],
};
const GLYPH_KEYS = Object.keys(GLYPHS);

function drawGlyph(key: string, cx: number, cy: number, lh: number, c: number, a: number, wmul = 1): void {
  const lw = lh * 0.7;
  const strokes = GLYPHS[key];
  for (let pass = 0; pass < 3; pass++) {
    const wd = pass === 0 ? lh * 0.2 : pass === 1 ? lh * 0.09 : lh * 0.035;
    const col = pass === 0 ? c : pass === 1 ? lighten(c, 0.35) : 0xffffff;
    const al = pass === 0 ? 0.28 : pass === 1 ? 0.95 : 1;
    for (const st of strokes) {
      const pts: number[] = [];
      for (let i = 0; i < st.length; i += 2) pts.push(cx + (st[i] - 0.5) * lw * wmul, cy + (st[i + 1] - 0.5) * lh);
      polyline(pts, wd, col, al * a);
    }
  }
}

/* ================================================================ vis fns */
function visWave(w: number, h: number, c: number, c2: number, age: number): void {
  const pulse = 1 + 0.05 * Math.sin(age * 0.5);
  for (let i = 0; i < 6; i++) {
    const y = (i - 2.5) * h * 0.17, L = w * (0.7 + 0.25 * ((age * 0.7 + i * 2.3) % 4) / 4);
    line(-w * 0.1, y, -w * 0.1 - L, y * 1.15, 3 - Math.abs(i - 2.5) * 0.5, c2, 0.4);
  }
  const cres = (k: number, col: number, a: number): void => {
    const o: number[] = [], inn: number[] = [];
    const n = 12, W = w * k * pulse, H = h * k;
    for (let i = 0; i <= n; i++) {
      const ang = -1.5 + 3 * (i / n), ca = Math.cos(ang);
      o.push(w * 0.2 + ca * W * 0.55, Math.sin(ang) * H / 2);
      inn.unshift(w * 0.2 + ca * W * 0.15, Math.sin(ang) * H / 2);
    }
    poly(o.concat(inn), col, a);
  };
  cres(1.3, c2, 0.25); cres(1.1, c2, 0.5); cres(0.95, c, 0.95); cres(0.62, lighten(c, 0.7), 0.95);
  for (let i = 0; i < 4; i++) circ(-w * 0.1 - ((age * 3 + i * 17) % 50), (i - 1.5) * h * 0.22, 2, lighten(c, 0.6), 0.7);
}
function visBolt(w: number, h: number, c: number, c2: number, age: number): void {
  const seed = Math.floor(age / 2);
  const rnd = (i: number): number => { const v = Math.sin((seed * 17.31 + i * 91.7)) * 43758.5453; return v - Math.floor(v) - 0.5; };
  const mk = (jit: number, k: number): number[] => {
    const p: number[] = [];
    const n = 9;
    for (let i = 0; i <= n; i++) p.push(-w / 2 + (w * i) / n, i === 0 || i === n ? 0 : rnd(i + k * 13) * h * jit);
    return p;
  };
  const main = mk(0.9, 0);
  glow(w * 0.3, 0, w * 0.18, h * 0.3, c2, 0.4);
  polyline(main, 14, c2, 0.2); polyline(main, 8, c, 0.5); polyline(main, 4, lighten(c, 0.5), 1); polyline(main, 1.8, 0xffffff, 1);
  const br = mk(1.1, 1).map((v, i) => (i % 2 ? v : v * 0.6 - w * 0.1));
  polyline(br, 3, c, 0.6); polyline(br, 1.2, 0xffffff, 0.8);
  circ(w * 0.45, 0, h * 0.2, lighten(c, 0.7), 0.9); circ(w * 0.45, 0, h * 0.1, 0xffffff, 1);
}
function flameTongues(n: number, w: number, h: number, c: number, c2: number, age: number, a: number): void {
  for (let i = 0; i < n; i++) {
    const ph = age * 0.4 + i * 1.7;
    const y0 = (i - (n - 1) / 2) * h * 0.2;
    const L = w * (0.7 + 0.25 * Math.sin(ph)) * (1 - Math.abs(i - (n - 1) / 2) * 0.12);
    const wv = Math.sin(ph * 1.3) * h * 0.1;
    poly([w * 0.05, y0 - h * 0.14, -L * 0.5, y0 - h * 0.12 + wv, -L, y0 + wv * 1.6, -L * 0.5, y0 + h * 0.12 + wv, w * 0.05, y0 + h * 0.14], i % 2 ? c2 : c, a);
  }
}
function visFire(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.min(w, h) * 0.42;
  glow(0, 0, r * 1.4, r * 1.4, c, 0.3);
  flameTongues(5, w * 0.9, h * 0.9, c, mixc(c, 0xff3a00, 0.5), age, 0.75);
  flameTongues(5, w * 0.7, h * 0.7, c2, lighten(c2, 0.2), age + 1.3, 0.8);
  circ(w * 0.05, 0, r, c, 0.95); circ(w * 0.07, 0, r * 0.72, c2, 1); circ(w * 0.1, 0, r * 0.4, 0xffffff, 0.95);
  for (let i = 0; i < 5; i++) { const t = ((age * 0.06 + i / 5) % 1); circ(-w * 0.2 - t * w * 0.6, Math.sin(i * 3 + age * 0.3) * h * 0.4 * t, 2.6 * (1 - t) + 0.5, lighten(c2, 0.4), 0.9 * (1 - t)); }
}
function visLetters(w: number, h: number, c: number, c2: number, age: number, x: number, y: number): void {
  const key = GLYPH_KEYS[(Math.floor(Math.abs(y) * 0.37 + Math.abs(x) * 0.013 + age / 14)) % GLYPH_KEYS.length];
  const lh = Math.min(h * 0.95, w * 1.2);
  glow(0, 0, lh * 0.5, lh * 0.5, c2, 0.18);
  for (let i = 3; i >= 1; i--) drawGlyph(key, -i * lh * 0.28, Math.sin(age * 0.2 + i) * 3, lh * (1 - i * 0.06), c2, 0.25 / i);
  drawGlyph(key, 0, Math.sin(age * 0.2) * 2, lh, c, 1);
  for (let i = 0; i < 6; i++) { const t = ((age * 0.05 + i / 6) % 1); circ(Math.cos(i * 2.2) * lh * 0.5 - t * 18, Math.sin(i * 1.7 + age * 0.1) * lh * 0.5, 1.8 * (1 - t) + 0.4, 0xffffff, 0.9 * (1 - t)); }
}
function featherPoly(cx: number, cy: number, L: number, W: number, c: number, c2: number, a: number): void {
  // leaf-shaped feather along +x from tail (cx,cy) to tip
  const top: number[] = [], bot: number[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const k = i / n, wd = Math.sin(Math.pow(k, 0.7) * PI) * W / 2 * (1 - k * 0.2);
    top.push(cx + L * k, cy - wd); bot.unshift(cx + L * k, cy + wd);
  }
  poly(top.concat(bot), c, a, lighten(c, 0.5), 1.2);
  poly([cx + L * 0.3, cy, cx + L * 0.7, cy - W * 0.3, cx + L * 0.95, cy, cx + L * 0.7, cy + W * 0.15], c2, a * 0.7);
  line(cx - L * 0.08, cy, cx + L * 0.98, cy, 2, darken(c, 0.3), a);
  for (let i = 1; i < 6; i++) { const k = i / 6; line(cx + L * k, cy, cx + L * (k + 0.1), cy - Math.sin(k * PI) * W * 0.45, 1, lighten(c, 0.5), a * 0.6); line(cx + L * k, cy, cx + L * (k + 0.1), cy + Math.sin(k * PI) * W * 0.45, 1, lighten(c, 0.5), a * 0.6); }
}
function visFeather(w: number, h: number, c: number, c2: number, age: number): void {
  glow(w * 0.1, 0, w * 0.4, h * 0.3, c, 0.14);
  for (let i = 2; i >= 1; i--) featherPoly(-w * 0.5 - i * w * 0.28, Math.sin(age * 0.3 + i) * 3, w * 0.7, h * 0.7, c2, c, 0.22);
  featherPoly(-w * 0.55, Math.sin(age * 0.25) * 2, w * 1.15, h * 0.9, c, c2, 0.95);
  circ(w * 0.58, 0, 3, 0xffffff, 0.8);
}
function visStone(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.min(w, h) * 0.5, ang = age * 0.25;
  for (let i = 0; i < 3; i++) line(-r - i * 8, (i - 1) * r * 0.5, -r - 30 - i * 14, (i - 1) * r * 0.5, 2.6, c2, 0.28);
  const pts: number[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) { const a = ang + (i / n) * PI * 2, rr = r * (0.82 + 0.22 * Math.sin(i * 2.7 + 1)); pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
  poly(pts, darken(c, 0.35), 1, darken(c, 0.7), 2);
  const p2: number[] = [];
  for (let i = 0; i < n; i++) { const a = ang + (i / n) * PI * 2, rr = r * (0.7 + 0.2 * Math.sin(i * 2.7 + 1)); p2.push(Math.cos(a) * rr - r * 0.08, Math.sin(a) * rr - r * 0.08); }
  poly(p2, c, 1);
  poly([Math.cos(ang) * r * 0.3 - r * 0.2, Math.sin(ang) * r * 0.3 - r * 0.3, r * 0.1, -r * 0.45, r * 0.2, -r * 0.2, -r * 0.1, -r * 0.1], lighten(c, 0.4), 0.7);
  circ(-r * 0.25, r * 0.15, r * 0.14, darken(c, 0.4), 0.6);
}
function smoke(x: number, y: number, r: number, a: number): void {
  circ(x, y, r, 0xb8b4ae, a * 0.35); circ(x - r * 0.2, y - r * 0.2, r * 0.7, 0xd6d2cc, a * 0.35);
}
function visBullet(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.max(3, Math.min(w, h) * 0.32);
  const L = w * 1.6;
  poly([r, -r * 0.5, -L, -0.4, -L, 0.4, r, r * 0.5], c2, 0.35);
  poly([r, -r * 0.35, -L * 0.6, -0.5, -L * 0.6, 0.5, r, r * 0.35], lighten(c, 0.6), 0.7);
  for (let i = 0; i < 4; i++) smoke(-r * 2 - i * 11 - ((age * 0.8) % 8), Math.sin(i * 2 + age * 0.1) * 3, 4 + i * 1.8, 1 - i * 0.2);
  glow(0, 0, r * 1.6, r * 1.6, c, 0.4);
  circ(0, 0, r, 0x2a2a2e, 1); circ(-r * 0.3, -r * 0.3, r * 0.45, c, 0.9); circ(-r * 0.4, -r * 0.4, r * 0.2, 0xffffff, 0.9);
}
function visSun(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.min(w, h) * 0.34, rot = age * 0.06;
  glow(0, 0, r * 1.9, r * 1.9, c2, 0.28);
  for (let layer = 0; layer < 2; layer++) {
    const n = 14, L = r * (layer ? 1.55 : 2.0), Wd = layer ? 0.16 : 0.1;
    for (let i = 0; i < n; i++) {
      const a = rot * (layer ? -1 : 1) + (i / n) * PI * 2;
      poly([Math.cos(a - Wd) * r * 1.05, Math.sin(a - Wd) * r * 1.05, Math.cos(a) * L, Math.sin(a) * L, Math.cos(a + Wd) * r * 1.05, Math.sin(a + Wd) * r * 1.05], layer ? c : c2, layer ? 0.95 : 0.7);
    }
  }
  circ(0, 0, r * 1.08, darken(c, 0.4), 1); circ(0, 0, r, c, 1); circ(0, 0, r * 0.72, lighten(c, 0.45), 1); circ(0, 0, r * 0.36, 0xffffff, 0.95);
  // face-like inti: two eyes and mouth
  line(-r * 0.4, -r * 0.1, -r * 0.18, -r * 0.1, 2, c2, 0.9); line(r * 0.18, -r * 0.1, r * 0.4, -r * 0.1, 2, c2, 0.9);
}
function visSound(w: number, h: number, c: number, c2: number, age: number): void {
  for (let i = 0; i < 5; i++) {
    const t = ((age * 0.035 + i / 5) % 1);
    const k = 0.25 + t * 0.85;
    const rx = w * 0.6 * k + 6, ry = h * 0.5 * (0.45 + 0.55 * k);
    const a = (1 - t) * 0.95;
    const p = ellPts(-w * 0.3 + w * 0.55 * k, 0, rx, ry, 14, 0, -1.0, 1.0);
    polyline(p, 7 * (1 - t) + 2, c2, a * 0.35); polyline(p, 3.2 * (1 - t) + 1, c, a); polyline(p, 1.2, 0xffffff, a * 0.8);
  }
  circ(-w * 0.3, 0, h * 0.12, 0xffffff, 0.6); circ(-w * 0.3, 0, h * 0.2, c, 0.25);
}
function visLasso(w: number, h: number, c: number, c2: number, age: number): void {
  const rx = (Math.abs(Math.cos(age * 0.3)) * 0.8 + 0.2) * w * 0.5, ry = h * 0.5;
  const rope = c, ropeD = darken(c, 0.5);
  for (let i = 0; i < 3; i++) ring(-w * 0.1 - i * 16, 0, rx * (0.8 - i * 0.12), ry * (0.8 - i * 0.12), 2.4, c2, 0.28 - i * 0.07);
  ring(0, 0, rx, ry, 6.6, ropeD, 1); ring(0, 0, rx, ry, 4, rope, 1); ring(0, 0, rx, ry, 1.4, lighten(rope, 0.6), 0.8);
  polyline([-rx, 0, -w * 0.7, Math.sin(age * 0.2) * h * 0.2, -w * 1.2, Math.sin(age * 0.2 + 1) * h * 0.1], 4, ropeD, 1);
  polyline([-rx, 0, -w * 0.7, Math.sin(age * 0.2) * h * 0.2, -w * 1.2, Math.sin(age * 0.2 + 1) * h * 0.1], 2.4, rope, 1);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + age * 0.15; circ(Math.cos(a) * rx, Math.sin(a) * ry, 2.6, lighten(c, 0.5), 0.9); }
}
function visChain(w: number, h: number, c: number, c2: number, age: number): void {
  const n = Math.max(5, Math.round(w / 15)), step = w / n;
  glow(0, 0, w * 0.5, h * 0.3, c2, 0.1);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + step * (i + 0.5), y = Math.sin(age * 0.3 + i * 0.7) * h * 0.18;
    const rot = i % 2 ? 0 : PI / 2;
    const rx = i % 2 ? step * 0.62 : step * 0.28, ry = i % 2 ? h * 0.2 : h * 0.25;
    void rot;
    ring(x, y, rx, ry, 5.6, darken(c, 0.5), 1); ring(x, y, rx, ry, 3.4, c, 1); ring(x - 1, y - 1, rx, ry, 1.1, lighten(c, 0.6), 0.8);
  }
  circ(w / 2, Math.sin(age * 0.3 + n) * h * 0.18, h * 0.3, darken(c, 0.4), 1); circ(w / 2, Math.sin(age * 0.3 + n) * h * 0.18, h * 0.22, c, 1);
  for (let i = 0; i < 4; i++) circ(-w / 2 - ((age * 3 + i * 11) % 40), Math.sin(i * 2) * h * 0.2, 2, c2, 0.6);
}
function spectral(w: number, h: number, c: number, c2: number, age: number, kind: string): void {
  glow(0, 0, w * 0.5, h * 0.5, c, 0.06);
  const t = age * 0.42;
  switch (kind) {
    case 'soldier': {
      const s = h / 126;
      // a small formation: lead soldier + two ghosted behind
      soldierShape(-w * 0.4, h / 2, s * 0.9, t + 2, c, c2, 0.26);
      soldierShape(-w * 0.1, h / 2, s * 0.95, t + 1, c, c2, 0.38);
      soldierShape(w * 0.12, h / 2, s, t, c, c2, 0.6);
      break;
    }
    case 'rider': { const s = Math.min(w / 150, h / 160); riderShape(-w * 0.1, h / 2, s, age * 0.5, c, c2, 0.6, false); break; }
    case 'gaucho': { const s = Math.min(w / 150, h / 160); riderShape(-w * 0.1, h / 2, s, age * 0.5, c, c2, 0.6, true); break; }
    case 'warrior': { const s = h / 126; warriorShape(-w * 0.1, h / 2, s, t, c, c2, 0.6); break; }
  }
  // dust at feet
  for (let i = 0; i < 4; i++) { const k = ((age * 0.07 + i / 4) % 1); circ(-w * 0.2 - k * w * 0.5, h / 2 - 2 - k * 12, 4 + k * 8, lighten(c, 0.3), 0.2 * (1 - k)); }
}
function visCondor(w: number, h: number, c: number, c2: number, age: number): void {
  const s = Math.min(w / 110, h / 110);
  glow(0, 0, w * 0.4, h * 0.35, c, 0.08);
  condorShape(0, 0, s, age, c, c2, 0.62);
  for (let i = 0; i < 4; i++) { const k = ((age * 0.05 + i / 4) % 1); line(-w * 0.4 - k * 30, (i - 1.5) * h * 0.18, -w * 0.4 - k * 30 - 24, (i - 1.5) * h * 0.18, 2, c, 0.35 * (1 - k)); }
}
function visSnow(w: number, h: number, c: number, c2: number, age: number): void {
  glow(0, 0, w * 0.45, h * 0.45, c2, 0.16);
  // ice shards core
  for (let i = 0; i < 4; i++) {
    const a = age * 0.08 + i * (PI / 2), L = h * 0.38;
    poly([Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a + 0.22) * L * 0.5, Math.sin(a + 0.22) * L * 0.5, Math.cos(a) * L, Math.sin(a) * L, Math.cos(a - 0.22) * L * 0.5, Math.sin(a - 0.22) * L * 0.5], c, 0.85, lighten(c, 0.8), 1.2);
  }
  for (let i = 0; i < 16; i++) {
    const ph = age * (0.03 + (i % 5) * 0.006) + i * 1.3;
    const x = ((i * 53 + age * (1 + (i % 4) * 0.4)) % (w * 1.4)) - w * 0.9;
    const y = Math.sin(ph * 3 + i) * h * 0.46;
    const r = 1.6 + (i % 3);
    circ(x, y, r, 0xffffff, 0.85);
    if (i % 4 === 0) { line(x - r * 2, y, x + r * 2, y, 1, 0xffffff, 0.7); line(x, y - r * 2, x, y + r * 2, 1, 0xffffff, 0.7); }
  }
  circ(0, 0, h * 0.14, 0xffffff, 0.8);
}
function visEagle(w: number, h: number, c: number, c2: number, age: number): void {
  const s = Math.min(w / 100, h / 100);
  glow(0, 0, w * 0.4, h * 0.3, c, 0.14);
  condorShape(0, 0, s * 0.95, age * 1.2, c, c2, 0.95, 0.35);
  for (let i = 0; i < 5; i++) { const k = ((age * 0.07 + i / 5) % 1); line(-w * 0.3 - k * 40, -h * 0.25 - k * 20 + i * 4, -w * 0.3 - k * 40 - 30, -h * 0.25 - k * 20 - 14 + i * 4, 2.4, lighten(c, 0.5), 0.5 * (1 - k)); }
}
function visWall(w: number, h: number, c: number, c2: number, age: number): void {
  const rise = clamp(age / 12, 0, 1), eRise = 1 - Math.pow(1 - rise, 3);
  const rows = Math.max(3, Math.round(h / 28)), rh = h / rows;
  const cols = Math.max(2, Math.round(w / 34)), cw = w / cols;
  const bot = h / 2;
  glow(0, bot - 4, w * 0.6, 10, c2, 0.16);
  for (let r = 0; r < rows; r++) {
    const top = bot - (r + 1) * rh * eRise, bh = rh * eRise;
    for (let k = 0; k <= cols; k++) {
      const off = r % 2 ? cw / 2 : 0;
      let x0 = -w / 2 + k * cw - off;
      let x1 = x0 + cw;
      if (x1 <= -w / 2 || x0 >= w / 2) continue;
      x0 = Math.max(x0, -w / 2); x1 = Math.min(x1, w / 2);
      const shade = ((k * 7 + r * 13) % 5) / 5;
      const base = mixc(c, c2, shade * 0.3);
      poly([x0 + 1, top + 1, x1 - 1, top + 1, x1 - 1, top + bh - 1, x0 + 1, top + bh - 1], base, 1, darken(base, 0.6), 1.6);
      poly([x0 + 2, top + 2, x1 - 2, top + 2, x1 - 2, top + 5, x0 + 2, top + 5], lighten(base, 0.35), 0.7);
    }
  }
  // dust cloud
  for (let i = 0; i < 6; i++) { const k = ((age * 0.05 + i / 6) % 1); circ(-w / 2 + (i / 5) * w, bot - k * 14, 5 + k * 6, 0xc9bfae, 0.4 * (1 - k)); }
  if (rise > 0.1) polyline([-w / 2, bot - h * eRise, w / 2, bot - h * eRise], 2, lighten(c2, 0.5), 0.6);
}
function visTrap(w: number, h: number, c: number, c2: number, age: number): void {
  const bot = h / 2 - 4;
  const pulse = 0.75 + 0.25 * Math.sin(age * 0.15);
  const gw = w * 0.5, gh = Math.min(14, h * 0.2);
  // light pillars
  for (let i = 0; i < 7; i++) {
    const x = -gw * 0.8 + (i / 6) * gw * 1.6, ph = (age * 0.03 + i * 0.37) % 1;
    const hh = h * (0.5 + 0.5 * Math.sin(ph * PI)) * pulse;
    poly([x - 3, bot, x + 3, bot, x + 1, bot - hh, x - 1, bot - hh], c2, 0.25);
  }
  glow(0, bot, gw * 1.05, gh * 1.1, c, 0.3 * pulse);
  ring(0, bot, gw, gh, 3, c, 0.95); ring(0, bot, gw * 0.78, gh * 0.78, 2, c2, 0.8); ring(0, bot, gw * 0.55, gh * 0.55, 1.5, lighten(c, 0.5), 0.8);
  // rotating hexagram (in squashed plane)
  for (let tri = 0; tri < 2; tri++) {
    const p: number[] = [];
    for (let i = 0; i < 3; i++) { const a = age * 0.04 * (tri ? -1 : 1) + tri * PI / 3 + (i / 3) * PI * 2; p.push(Math.cos(a) * gw * 0.78, bot + Math.sin(a) * gh * 0.78); }
    polyline(p.concat(p.slice(0, 2)), 2, lighten(c, 0.4), 0.9);
  }
  for (let i = 0; i < 8; i++) { const a = age * 0.02 + (i / 8) * PI * 2; circ(Math.cos(a) * gw * 0.93, bot + Math.sin(a) * gh * 0.93, 2.2, 0xffffff, 0.9); }
  for (let i = 0; i < 6; i++) { const k = ((age * 0.04 + i / 6) % 1); circ(Math.sin(i * 5.1) * gw * 0.8, bot - k * h * 0.8, 2.2 * (1 - k) + 0.5, lighten(c, 0.5), 0.8 * (1 - k)); }
}
function visBeam(w: number, h: number, c: number, c2: number, age: number): void {
  const th = h * (0.85 + 0.15 * Math.sin(age * 0.8));
  const x0 = -w / 2, x1 = w / 2;
  poly([x0, -th * 0.9, x1, -th * 0.9, x1, th * 0.9, x0, th * 0.9], c2, 0.18);
  poly([x0, -th * 0.65, x1, -th * 0.65, x1, th * 0.65, x0, th * 0.65], c2, 0.35);
  poly([x0, -th * 0.42, x1, -th * 0.42, x1, th * 0.42, x0, th * 0.42], c, 0.85);
  poly([x0, -th * 0.2, x1, -th * 0.2, x1, th * 0.2, x0, th * 0.2], lighten(c, 0.6), 1);
  poly([x0, -th * 0.08, x1, -th * 0.08, x1, th * 0.08, x0, th * 0.08], 0xffffff, 1);
  for (let i = 0; i < 10; i++) { const k = ((age * 0.08 + i / 10) % 1); line(x1 - k * w, Math.sin(i * 7.3) * th * 0.55, x1 - k * w - 22, Math.sin(i * 7.3) * th * 0.55, 2, 0xffffff, 0.7 * (1 - k * 0.5)); }
  glow(x1, 0, th * 0.55, th * 0.55, c, 0.5); circ(x1, 0, th * 0.28, 0xffffff, 0.95);
  glow(x0, 0, th * 0.45, th * 0.45, c, 0.35);
}
function visFlag(w: number, h: number, c: number, c2: number, age: number): void {
  const pw = 4;
  const poleX = -w * 0.5 + 4, topY = -h / 2, botY = h / 2;
  const cols = [c, 0xffffff, c2];
  const fw = w * 0.88, fh = h * 0.58, n = 10;
  glow(0, -h * 0.1, w * 0.5, h * 0.3, c, 0.1);
  for (let b = 0; b < 3; b++) {
    for (let i = 0; i < n; i++) {
      const k0 = i / n, k1 = (i + 1) / n;
      const w0 = Math.sin(age * 0.3 - k0 * 5) * (3 + 6 * k0), w1 = Math.sin(age * 0.3 - k1 * 5) * (3 + 6 * k1);
      const y0 = topY + 3 + (b * fh) / 3, y1 = topY + 3 + ((b + 1) * fh) / 3;
      poly([poleX + pw + fw * k0, y0 + w0, poleX + pw + fw * k1, y0 + w1, poleX + pw + fw * k1, y1 + w1, poleX + pw + fw * k0, y1 + w0], cols[b], 0.95, -1);
    }
  }
  const eT: number[] = [], eB: number[] = [];
  for (let i = 0; i <= n; i++) { const k = i / n; const wv = Math.sin(age * 0.3 - k * 5) * (3 + 6 * k); eT.push(poleX + pw + fw * k, topY + 3 + wv); eB.push(poleX + pw + fw * k, topY + 3 + fh + wv); }
  polyline(eT, 1.6, darken(c, 0.6), 0.9); polyline(eB, 1.6, darken(c, 0.6), 0.9);
  // sun emblem on the white band
  const kk = 0.5, wv = Math.sin(age * 0.3 - kk * 5) * (3 + 6 * kk);
  circ(poleX + pw + fw * kk, topY + 3 + fh / 2 + wv, 4.4, 0xe8b830, 0.95);
  line(poleX, topY - 4, poleX, botY, pw + 2, 0x2a1a0c, 1); line(poleX, topY - 4, poleX, botY, pw, 0x8a6240, 1);
  circ(poleX, topY - 6, 5, 0xe8b830, 1);
}
function spearShape(L: number, th: number, c: number, c2: number, age: number, a: number): void {
  line(-L / 2, 0, L / 2 - 14, 0, th + 2, darken(c2, 0.6), a); line(-L / 2, 0, L / 2 - 14, 0, th, c2, a);
  line(-L / 2, -th * 0.2, L / 2 - 14, -th * 0.2, 1.2, lighten(c2, 0.5), a * 0.7);
  poly([L / 2 - 16, 0, L / 2 - 8, -th * 1.6, L / 2 + 14, 0, L / 2 - 8, th * 1.6], 0xe4eaf0, a, 0x7c8794, 1.3);
  line(L / 2 - 12, 0, L / 2 + 10, 0, 1.2, 0xffffff, a);
  circ(L / 2 - 18, 0, th * 1.2, c, a);
  poly([L / 2 - 18, 0, L / 2 - 36 + Math.sin(age * 0.4) * 3, th * 2.5, L / 2 - 42, th * 1.6, L / 2 - 24, -1], c, a * 0.95, darken(c, 0.5), 1);
  for (let i = 0; i < 3; i++) { const p = -L / 2 + 6 + i * 6; poly([p, 0, p - 8, -th * 1.8 - i, p - 4, 0], i % 2 ? c : lighten(c, 0.3), a * 0.9); }
}
function visSpear(w: number, h: number, c: number, c2: number, age: number): void {
  glow(w * 0.2, 0, w * 0.3, h * 0.5, c, 0.1);
  for (let i = 0; i < 3; i++) line(-w * 0.5 - i * 14, (i - 1) * h * 0.25, -w * 0.5 - 40 - i * 20, (i - 1) * h * 0.25, 2, c2, 0.3);
  spearShape(w, Math.max(3, h * 0.28), c, 0x8a6a42, age, 1);
}
function visDust(w: number, h: number, c: number, c2: number, age: number): void {
  for (let i = 0; i < 12; i++) {
    const k = i / 11;
    const rr = (h * 0.28 + (i % 3) * 5) * (0.7 + 0.6 * Math.sin(k * PI));
    const x = -w / 2 + k * w, y = h / 2 - rr * 0.6 - Math.abs(Math.sin(age * 0.2 + i)) * 6;
    circ(x, y, rr, darken(c, 0.2), 0.3); circ(x + 2, y - 3, rr * 0.78, c, 0.45); circ(x + 4, y - 6, rr * 0.45, lighten(c, 0.35), 0.4);
  }
  for (let i = 0; i < 8; i++) { const a = age * 0.2 + i * 2.1; circ(-w / 2 + (i / 7) * w, h / 2 - 6 - ((age * 2 + i * 9) % 30), 2, c2, 0.7); void a; }
  ell(0, h / 2 - 2, w * 0.5, 6, c2, 0.2);
}
function visBell(w: number, h: number, c: number, c2: number, age: number): void {
  const sw = Math.sin(age * 0.4) * 0.22;
  const bw = Math.min(w, h) * 0.5, bh = bw * 1.3;
  // ring waves
  for (let i = 0; i < 3; i++) { const k = ((age * 0.04 + i / 3) % 1); ring(0, 0, bw * (1 + k * 1.2), bw * (1 + k * 1.2) * 0.9, 3 * (1 - k) + 0.6, c2, 0.5 * (1 - k)); }
  glow(0, 0, bw, bw, c2, 0.15);
  const cr = Math.cos(sw), sr = Math.sin(sw);
  const R = (p: number[]): number[] => { const o: number[] = []; for (let i = 0; i < p.length; i += 2) o.push(p[i] * cr - (p[i + 1] + bh * 0.5) * sr, p[i] * sr + (p[i + 1] + bh * 0.5) * cr - bh * 0.5); return o; };
  line(0, -bh * 0.55, 0, -bh * 0.4, 4, darken(c, 0.5), 1);
  poly(R([-bw * 0.18, -bh * 0.5, bw * 0.18, -bh * 0.5, bw * 0.3, -bh * 0.25, bw * 0.55, bh * 0.1, bw * 0.66, bh * 0.4, bw * 0.78, bh * 0.5, -bw * 0.78, bh * 0.5, -bw * 0.66, bh * 0.4, -bw * 0.55, bh * 0.1, -bw * 0.3, -bh * 0.25]), c, 1, darken(c, 0.55), 2.2);
  poly(R([-bw * 0.1, -bh * 0.45, bw * 0.05, -bh * 0.45, -bw * 0.12, bh * 0.1, -bw * 0.45, bh * 0.4, -bw * 0.5, bh * 0.36, -bw * 0.28, -bh * 0.2]), lighten(c, 0.5), 0.55);
  poly(R([-bw * 0.78, bh * 0.44, bw * 0.78, bh * 0.44, bw * 0.78, bh * 0.52, -bw * 0.78, bh * 0.52]), darken(c, 0.3), 1);
  const cl = R([0, bh * 0.52, 0, bh * 0.52]);
  circ(cl[0] + Math.sin(age * 0.7) * 4, cl[1] + 4, bw * 0.14, darken(c, 0.3), 1);
}
function visShock(w: number, h: number, c: number, c2: number, age: number): void {
  const bot = h / 2;
  const grow = clamp(age / 8, 0.25, 1);
  const W = w * grow, H = h * (0.55 + 0.45 * grow);
  const arch = (k: number, col: number, a: number, th: number): void => {
    const o: number[] = [], inn: number[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const ang = PI + (PI * i) / n;
      o.push(Math.cos(ang) * W * 0.5 * k, bot + Math.sin(ang) * H * k);
      inn.unshift(Math.cos(ang) * (W * 0.5 * k - th * 1.4), bot + Math.sin(ang) * (H * k - th));
    }
    poly(o.concat(inn), col, a);
  };
  arch(1.18, c2, 0.2, 30); arch(1.0, c2, 0.5, 20); arch(0.92, c, 0.95, 12); arch(0.82, lighten(c, 0.7), 0.95, 5);
  // inner fill haze
  poly(ellPts(0, bot, W * 0.4, H * 0.8, 14, 0, PI, PI * 2), c2, 0.1);
  for (let i = 0; i < 12; i++) { const a = PI + (i / 11) * PI; const k = ((age * 0.1 + i * 0.37) % 1); circ(Math.cos(a) * W * 0.5 * (1 - 0.05 * k), bot + Math.sin(a) * H * (1 + k * 0.15), 3 * (1 - k) + 1, 0xd0c6b0, 0.8 * (1 - k)); }
  ell(0, bot - 2, W * 0.55, 6, c, 0.4);
  for (let i = 0; i < 8; i++) { const k = ((age * 0.06 + i / 8) % 1); circ(-W * 0.45 + (i / 7) * W * 0.9, bot - 4 - k * 18, 4 + k * 5, 0xc9bfae, 0.4 * (1 - k)); }
}
function visSerpent(w: number, h: number, c: number, c2: number, age: number): void {
  const n = 22, th = h * 0.34;
  const pts: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = w * 0.5 - k * w;
    pts.push([x, Math.sin(age * 0.35 + k * 8) * h * 0.3 * (0.3 + 0.7 * k)]);
  }
  glow(w * 0.3, 0, w * 0.4, h * 0.4, c2, 0.1);
  for (let i = n; i >= 1; i--) {
    const k = i / n, r = th * (0.55 * (1 - k * 0.85) + 0.18) + th * 0.15 * Math.sin(Math.min(1, k * 3) * PI * 0.5);
    circ(pts[i][0], pts[i][1], r + 1.6, darken(c, 0.6), 1);
  }
  for (let i = n; i >= 1; i--) {
    const k = i / n, r = th * (0.55 * (1 - k * 0.85) + 0.18) + th * 0.15 * Math.sin(Math.min(1, k * 3) * PI * 0.5);
    circ(pts[i][0], pts[i][1], r, i % 2 ? c : darken(c, 0.18), 1);
    if (i % 3 === 0) circ(pts[i][0], pts[i][1] - r * 0.3, r * 0.5, c2, 0.85);
    circ(pts[i][0] - 1, pts[i][1] - r * 0.5, r * 0.25, lighten(c, 0.5), 0.5);
  }
  const hx = pts[0][0], hy = pts[0][1];
  poly([hx - 6, hy - th * 0.5, hx + th * 1.2, hy - th * 0.2, hx + th * 1.4, hy + th * 0.15, hx - 6, hy + th * 0.5], c, 1, darken(c, 0.6), 1.8);
  circ(hx + th * 0.4, hy - th * 0.18, th * 0.12, 0xfff060, 1); circ(hx + th * 0.42, hy - th * 0.18, th * 0.05, 0x201000, 1);
  poly([hx + th * 1.3, hy + th * 0.1, hx + th * 1.0, hy + th * 0.55, hx + th * 1.18, hy + th * 0.1], 0xffffff, 1);
  const tong = Math.sin(age * 0.8) * 3;
  polyline([hx + th * 1.4, hy + th * 0.05, hx + th * 1.9, hy + th * 0.05 + tong, hx + th * 2.2, hy - th * 0.1 + tong], 1.6, 0xe03040, 1);
}
function visTiger(w: number, h: number, c: number, c2: number, age: number): void {
  const s = Math.min(w / 120, h / 95);
  glow(0, 0, w * 0.5, h * 0.4, c, 0.1);
  tigerShape(-w * 0.1, h / 2, s, age * 0.5, c, c2, 0.95);
  for (let i = 0; i < 4; i++) { const k = ((age * 0.06 + i / 4) % 1); line(-w * 0.55 - k * 30, (i - 1.5) * h * 0.2, -w * 0.55 - k * 30 - 22, (i - 1.5) * h * 0.2, 2.2, lighten(c, 0.5), 0.4 * (1 - k)); }
}
function visFist(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.min(w, h) * 0.5;
  glow(0, 0, r * 1.2, r * 1.2, c2, 0.22);
  for (let i = 0; i < 4; i++) line(-r * 0.8 - i * 10, (i - 1.5) * r * 0.4, -r * 2.2 - i * 16, (i - 1.5) * r * 0.4, 3, c2, 0.4);
  const skin = c, dk = darken(c, 0.5);
  // fingers (rounded blocks stacked vertically), pointing forward (+x)
  for (let i = 0; i < 4; i++) {
    const y = -r * 0.72 + i * r * 0.46;
    poly([-r * 0.3, y, r * 0.55, y, r * 0.78, y + r * 0.08, r * 0.78, y + r * 0.38, r * 0.55, y + r * 0.46, -r * 0.3, y + r * 0.46], skin, 1, dk, 2);
    line(r * 0.2, y + 2, r * 0.2, y + r * 0.44, 1.5, dk, 0.7);
    poly([r * 0.0, y + 3, r * 0.5, y + 3, r * 0.6, y + 7, r * 0.0, y + 7], lighten(skin, 0.4), 0.6);
  }
  // thumb
  poly([-r * 0.2, r * 0.5, r * 0.4, r * 0.55, r * 0.5, r * 0.85, -r * 0.1, r * 0.85], skin, 1, dk, 2);
  // wrist cuff
  poly([-r * 0.55, -r * 0.8, -r * 0.3, -r * 0.8, -r * 0.3, r * 0.95, -r * 0.55, r * 0.95], c2, 1, darken(c2, 0.5), 2);
  for (let i = 0; i < 3; i++) { const k = ((age * 0.08 + i / 3) % 1); ring(r * 0.2, 0, r * (1 + k * 0.8), r * (1 + k * 0.8), 3 * (1 - k) + 0.5, 0xffffff, 0.5 * (1 - k)); }
}
function visCrown(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.min(w, h) * 0.5;
  const sx = Math.max(0.12, Math.abs(Math.cos(age * 0.12)));
  glow(0, 0, r * 1.2, r * 1.2, c, 0.22);
  const X = (v: number): number => v * sx;
  const cw = r * 0.95, ch = r * 0.8;
  poly([X(-cw), ch * 0.5, X(cw), ch * 0.5, X(cw * 1.05), -ch * 0.45, X(cw * 0.55), -ch * 0.05, X(0), -ch * 0.7, X(-cw * 0.55), -ch * 0.05, X(-cw * 1.05), -ch * 0.45], c, 1, darken(c, 0.55), 2.4);
  poly([X(-cw), ch * 0.18, X(cw), ch * 0.18, X(cw), ch * 0.5, X(-cw), ch * 0.5], darken(c, 0.2), 1);
  poly([X(-cw * 0.8), -ch * 0.3, X(-cw * 0.3), -ch * 0.2, X(-cw * 0.4), ch * 0.1, X(-cw * 0.9), ch * 0.05], lighten(c, 0.5), 0.5);
  for (const gx of [-cw * 1.05, 0, cw * 1.05]) circ(X(gx), gx === 0 ? -ch * 0.7 : -ch * 0.45, r * 0.12, c2, 1);
  for (let i = -2; i <= 2; i++) { circ(X(i * cw * 0.4), ch * 0.34, r * 0.07, i % 2 ? c2 : 0xffffff, 1); }
  for (let i = 0; i < 5; i++) { const a = age * 0.1 + i * 1.26, k = 1.2; circ(Math.cos(a) * r * k, Math.sin(a) * r * k * 0.8, 2, 0xffffff, 0.7); }
}
function visCannon(w: number, h: number, c: number, c2: number, age: number): void {
  const r = Math.max(5, Math.min(w, h) * 0.42);
  for (let i = 0; i < 6; i++) smoke(-r * 1.6 - i * 13, Math.sin(i * 1.9 + age * 0.1) * 4, 5 + i * 2.6, 1 - i * 0.14);
  flameTongues(3, w * 0.9, h * 0.6, c2, c, age, 0.55);
  glow(0, 0, r * 1.5, r * 1.5, c, 0.3);
  circ(0, 0, r, 0x16161a, 1); circ(0, 0, r - 1.5, 0x34343c, 1); circ(-r * 0.3, -r * 0.3, r * 0.5, 0x5a5a66, 1); circ(-r * 0.38, -r * 0.4, r * 0.2, 0xdde0ee, 0.9);
  line(r * 0.5, -r * 0.7, r * 0.9, -r * 1.3, 2, 0xc8a060, 1);
  circ(r * 0.92, -r * 1.34, 3 + Math.sin(age) * 1.2, 0xfff2a0, 1); circ(r * 0.92, -r * 1.34, 1.6, 0xffffff, 1);
}

/* ================================================================== API */
export function drawProjectile(
  gr: Gfx, vis: ProjVis, x: number, y: number, dir: 1 | -1, w: number, h: number, color: number, color2: number, age: number,
): void {
  g = gr; OX = x; OY = y; D = dir; AM = 1;
  switch (vis) {
    case 'wave': visWave(w, h, color, color2, age); break;
    case 'bolt': visBolt(w, h, color, color2, age); break;
    case 'fire': visFire(w, h, color, color2, age); break;
    case 'letters': visLetters(w, h, color, color2, age, x, y); break;
    case 'feather': visFeather(w, h, color, color2, age); break;
    case 'stone': visStone(w, h, color, color2, age); break;
    case 'bullet': visBullet(w, h, color, color2, age); break;
    case 'sun': visSun(w, h, color, color2, age); break;
    case 'sound': visSound(w, h, color, color2, age); break;
    case 'lasso': visLasso(w, h, color, color2, age); break;
    case 'chain': visChain(w, h, color, color2, age); break;
    case 'soldier': spectral(w, h, color, color2, age, 'soldier'); break;
    case 'rider': spectral(w, h, color, color2, age, 'rider'); break;
    case 'warrior': spectral(w, h, color, color2, age, 'warrior'); break;
    case 'gaucho': spectral(w, h, color, color2, age, 'gaucho'); break;
    case 'condor': visCondor(w, h, color, color2, age); break;
    case 'snow': visSnow(w, h, color, color2, age); break;
    case 'eagle': visEagle(w, h, color, color2, age); break;
    case 'wall': visWall(w, h, color, color2, age); break;
    case 'trap': visTrap(w, h, color, color2, age); break;
    case 'beam': visBeam(w, h, color, color2, age); break;
    case 'flag': visFlag(w, h, color, color2, age); break;
    case 'spear': visSpear(w, h, color, color2, age); break;
    case 'dust': visDust(w, h, color, color2, age); break;
    case 'bell': visBell(w, h, color, color2, age); break;
    case 'shock': visShock(w, h, color, color2, age); break;
    case 'serpent': visSerpent(w, h, color, color2, age); break;
    case 'tiger': visTiger(w, h, color, color2, age); break;
    case 'fist': visFist(w, h, color, color2, age); break;
    case 'crown': visCrown(w, h, color, color2, age); break;
    case 'cannon': visCannon(w, h, color, color2, age); break;
    default: visBolt(w, h, color, color2, age); break;
  }
}

/** Spectral entity trailing a rushing fighter. (x,y) = fighter feet; ghosts trail behind (opposite dir). */
export function drawGhost(gr: Gfx, vis: GhostVis, x: number, y: number, dir: 1 | -1, color: number, age: number, alpha = 0.5): void {
  if (vis === 'none') return;
  g = gr; OX = x; OY = y; D = dir; AM = alpha / 0.5;
  const c = color, c2 = lighten(color, 0.45);
  const t = age * 0.5;
  switch (vis) {
    case 'cavalry':
      for (let i = 2; i >= 0; i--) riderShape(-70 - i * 70, 0, 0.78 - i * 0.04, t + i * 1.7, c, c2, 0.42 - i * 0.1, false);
      for (let i = 0; i < 6; i++) { const k = ((age * 0.08 + i / 6) % 1); circ(-60 - k * 200, -3 - k * 8, 6 + k * 10, lighten(c, 0.3), 0.18 * (1 - k)); }
      break;
    case 'gaucho':
      for (let i = 2; i >= 0; i--) riderShape(-70 - i * 70, 0, 0.78 - i * 0.04, t + i * 1.7, c, c2, 0.42 - i * 0.1, true);
      for (let i = 0; i < 6; i++) { const k = ((age * 0.08 + i / 6) % 1); circ(-60 - k * 200, -3 - k * 8, 6 + k * 10, lighten(c, 0.3), 0.18 * (1 - k)); }
      break;
    case 'infantry':
      for (let i = 3; i >= 0; i--) soldierShape(-50 - i * 46, -(i % 2) * 6, 0.9 - i * 0.02, t * 0.9 + i * 1.3, c, c2, 0.5 - i * 0.1);
      break;
    case 'condor':
      condorShape(-40, -150, 1.3, age, c, c2, 0.48);
      condorShape(-120, -190, 0.8, age + 2, c, c2, 0.3);
      for (let i = 0; i < 6; i++) { const k = ((age * 0.06 + i / 6) % 1); line(-60 - k * 90, -150 + (i - 3) * 8, -60 - k * 90 - 26, -150 + (i - 3) * 8, 2, c2, 0.4 * (1 - k)); }
      break;
    case 'spear':
      for (let i = 0; i < 5; i++) {
        const yy = -30 - i * 28, xx = -90 - ((i * 37) % 60) + Math.sin(age * 0.2 + i) * 4;
        OX = x + dir * xx; OY = y + yy; spearShape(130, 5, c, 0x8a6a42, age, 0.55 - i * 0.04);
      }
      OX = x; OY = y;
      break;
    case 'fire':
      for (let i = 0; i < 9; i++) {
        const k = ((age * 0.07 + i / 9) % 1), bx = -30 - k * 150, by = -20 - (i % 4) * 36 - k * 20;
        const r = 20 * (1 - k * 0.6) + 6;
        glow(bx, by, r, r * 1.3, c, 0.3 * (1 - k));
        poly([bx, by - r * 1.8, bx + r * 0.7, by, bx, by + r * 0.5, bx - r * 0.7, by], c2, 0.5 * (1 - k));
        circ(bx, by + r * 0.2, r * 0.45, 0xffffff, 0.4 * (1 - k));
      }
      break;
    case 'tiger':
      tigerShape(-90, 0, 0.95, t, c, c2, 0.45);
      for (let i = 0; i < 4; i++) { const k = ((age * 0.07 + i / 4) % 1); line(-150 - k * 80, -20 - i * 25, -150 - k * 80 - 30, -20 - i * 25, 2, c2, 0.35 * (1 - k)); }
      break;
    case 'sun': {
      const cx = -80, cy = -110, r = 46, rot = age * 0.05;
      glow(cx, cy, r * 1.6, r * 1.6, c, 0.18);
      for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * PI * 2; poly([cx + Math.cos(a - 0.1) * r, cy + Math.sin(a - 0.1) * r, cx + Math.cos(a) * r * (i % 2 ? 1.6 : 1.9), cy + Math.sin(a) * r * (i % 2 ? 1.6 : 1.9), cx + Math.cos(a + 0.1) * r, cy + Math.sin(a + 0.1) * r], c2, 0.45); }
      circ(cx, cy, r, c, 0.5); circ(cx, cy, r * 0.65, c2, 0.55); circ(cx, cy, r * 0.3, 0xffffff, 0.6);
      break;
    }
    case 'wind':
      for (let i = 0; i < 8; i++) {
        const k = ((age * 0.05 + i / 8) % 1), yy = -10 - i * 22;
        const pts: number[] = [];
        for (let j = 0; j <= 10; j++) { const u = j / 10; pts.push(-20 - u * (140 + (i % 3) * 40) - k * 30, yy + Math.sin(u * 7 + age * 0.3 + i) * (6 + u * 8)); }
        polyline(pts, 5, c, 0.2 * (1 - k * 0.4)); polyline(pts, 2, c2, 0.5 * (1 - k * 0.4));
      }
      break;
    default: break;
  }
}

export function drawSpecialFlash(gr: Gfx, x: number, y: number, color: number, t: number): void {
  g = gr; OX = x; OY = y; D = 1; AM = 1;
  t = clamp(t, 0, 1);
  const e = 1 - Math.pow(1 - t, 3), a = 1 - t;
  const R = 24 + 190 * e;
  // inner flash
  circ(0, 0, R * 0.5, lighten(color, 0.7), 0.5 * a * a); circ(0, 0, R * 0.28, 0xffffff, 0.9 * a * a);
  glow(0, 0, R * 0.7, R * 0.7, color, 0.25 * a);
  // rings
  ring(0, 0, R, R, 12 * a + 1, color, 0.8 * a); ring(0, 0, R, R, 4 * a + 0.5, 0xffffff, 0.9 * a);
  const R2 = R * 0.66;
  ring(0, 0, R2, R2 * 0.9, 7 * a + 1, lighten(color, 0.4), 0.55 * a);
  // rays
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * PI * 2 + 0.3, r0 = R * 0.35, r1 = R * (0.8 + 0.4 * ((i * 37) % 5) / 5);
    poly([Math.cos(ang - 0.07) * r0, Math.sin(ang - 0.07) * r0, Math.cos(ang) * r1, Math.sin(ang) * r1, Math.cos(ang + 0.07) * r0, Math.sin(ang + 0.07) * r0], i % 2 ? color : lighten(color, 0.6), 0.7 * a);
  }
  for (let i = 0; i < 12; i++) { const ang = i * 2.4, rr = R * (0.5 + 0.7 * e * ((i * 13) % 7) / 7); circ(Math.cos(ang) * rr, Math.sin(ang) * rr, 3 * a + 0.5, 0xffffff, 0.85 * a); }
}

export function drawHitSpark(gr: Gfx, x: number, y: number, strength: 'light' | 'heavy' | 'special', color: number, t: number): void {
  g = gr; OX = x; OY = y; D = 1; AM = 1;
  t = clamp(t, 0, 1);
  const e = 1 - Math.pow(1 - t, 2.4), a = 1 - t;
  const spikes = strength === 'light' ? 7 : strength === 'heavy' ? 9 : 13;
  const base = strength === 'light' ? 46 : strength === 'heavy' ? 78 : 112;
  const R = base * (0.35 + 0.65 * e);
  const rot = strength === 'special' ? t * 0.6 : 0.3;
  // flash disc
  circ(0, 0, R * 0.55, color, 0.4 * a); circ(0, 0, R * 0.34, 0xffffff, 0.9 * a);
  // outer starburst
  const star = (rr: number, inner: number, col: number, al: number): void => {
    const p: number[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const ang = rot + (i / (spikes * 2)) * PI * 2;
      const jitter = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.78 : 1;
      const r = i % 2 === 0 ? rr * jitter * (1 + ((i * 7) % 3) * 0.12) : rr * inner;
      p.push(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    poly(p, col, al);
  };
  star(R * 1.05, 0.28, color, 0.85 * a);
  star(R * 0.72, 0.3, lighten(color, 0.65), 0.95 * a);
  star(R * 0.4, 0.35, 0xffffff, a);
  // shock ring
  ring(0, 0, R * 0.95, R * 0.95, 3.5 * a + 0.5, lighten(color, 0.4), 0.8 * a);
  if (strength !== 'light') ring(0, 0, R * 0.62, R * 0.62, 2 * a + 0.5, 0xffffff, 0.7 * a);
  // sparks flying
  const ns = strength === 'light' ? 5 : strength === 'heavy' ? 8 : 12;
  for (let i = 0; i < ns; i++) {
    const ang = i * 2.399 + 0.5, r0 = R * (0.6 + 0.5 * ((i * 13) % 5) / 5), L = 10 + (i % 3) * 6;
    line(Math.cos(ang) * r0, Math.sin(ang) * r0, Math.cos(ang) * (r0 + L * (1 - t * 0.5)), Math.sin(ang) * (r0 + L * (1 - t * 0.5)), 2 * a + 0.6, i % 2 ? 0xffffff : color, 0.9 * a);
  }
}
