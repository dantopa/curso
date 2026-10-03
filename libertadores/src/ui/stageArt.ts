// Canvas-2D painters for the static stage layers (baked once into textures by StageRenderer).
// All painters draw in WORLD coordinates (x: 0..1280 visible at neutral camera, y: 0..720).
import type { StageDef, StageKind } from '../combat/types';

export type Ctx = CanvasRenderingContext2D;
export type LayerName = 'sky' | 'far' | 'mid' | 'near' | 'floor' | 'fg';

export interface LayerDef { name: LayerName; p: number; y0: number; y1: number }
export const LAYER_DEFS: LayerDef[] = [
  { name: 'sky', p: 0.03, y0: 0, y1: 720 },
  { name: 'far', p: 0.15, y0: 0, y1: 720 },
  { name: 'mid', p: 0.4, y0: 0, y1: 720 },
  { name: 'near', p: 0.7, y0: 0, y1: 720 },
  { name: 'floor', p: 1, y0: 580, y1: 720 },
  { name: 'fg', p: 1.3, y0: 440, y1: 720 },
];
export const layerPad = (p: number): number => Math.ceil(620 * p) + 60;

/* ------------------------------------------------------------ dynamic specs */
export interface FireSpot { layer: LayerName; x: number; y: number; s: number; glow: number; flame?: boolean }
export interface BannerSpot { layer: LayerName; x: number; y: number; len: number; h: number; c1: number; c2: number }
export interface GrassSpec { layer: LayerName; y: number; c1: number; c2: number; hMin: number; hMax: number; n: number; x0: number; x1: number }
export const FIRES: Partial<Record<StageKind, FireSpot[]>> = {
  citadel: [
    { layer: 'near', x: 170, y: 560, s: 0.8, glow: 0xffb050, flame: true },
    { layer: 'near', x: 1110, y: 560, s: 0.8, glow: 0xffb050, flame: true },
    { layer: 'mid', x: 520, y: 432, s: 0.45, glow: 0xffc060, flame: true },
    { layer: 'mid', x: 900, y: 432, s: 0.45, glow: 0xffc060, flame: true },
  ],
  battlefield: [
    { layer: 'far', x: 210, y: 466, s: 1.2, glow: 0xff7020, flame: true },
    { layer: 'far', x: 1010, y: 468, s: 1.6, glow: 0xff6010, flame: true },
    { layer: 'mid', x: 640, y: 555, s: 0.7, glow: 0xff8030, flame: true },
  ],
  jungle: [
    { layer: 'far', x: 260, y: 470, s: 2.2, glow: 0xff5010, flame: true },
    { layer: 'far', x: 880, y: 468, s: 2.8, glow: 0xff4a10, flame: true },
    { layer: 'mid', x: 1000, y: 540, s: 1.5, glow: 0xff6020, flame: true },
    { layer: 'mid', x: 1030, y: 520, s: 1.1, glow: 0xffa030, flame: true },
    { layer: 'near', x: 140, y: 600, s: 0.6, glow: 0xff7020, flame: true },
  ],
  plaza: [
    { layer: 'near', x: 230, y: 470, s: 0.9, glow: 0xffa040, flame: true },
    { layer: 'near', x: 1060, y: 470, s: 0.9, glow: 0xffa040, flame: true },
    { layer: 'mid', x: 330, y: 535, s: 0.5, glow: 0xffa040, flame: true },
    { layer: 'mid', x: 600, y: 560, s: 0.5, glow: 0xffa040, flame: true },
    { layer: 'mid', x: 1200, y: 535, s: 0.5, glow: 0xffa040, flame: true },
  ],
  tiwanaku: [
    { layer: 'near', x: 80, y: 548, s: 0.55, glow: 0xffb060, flame: true },
  ],
};
export const BANNERS: Partial<Record<StageKind, BannerSpot[]>> = {
  battlefield: [
    { layer: 'mid', x: 330, y: 330, len: 78, h: 44, c1: 0xb02a2a, c2: 0xe8c040 },
    { layer: 'mid', x: 880, y: 340, len: 70, h: 40, c1: 0x2a4a9a, c2: 0xf0f0e0 },
    { layer: 'near', x: 1180, y: 400, len: 90, h: 52, c1: 0x7a1a1a, c2: 0xd8b040 },
  ],
  plaza: [{ layer: 'near', x: 600, y: 340, len: 96, h: 60, c1: 0x2a6a4a, c2: 0xd0b050 }],
  andes: [{ layer: 'mid', x: 760, y: 392, len: 40, h: 22, c1: 0xb02a2a, c2: 0xf0f0f0 }],
  llanos: [{ layer: 'mid', x: 120, y: 390, len: 56, h: 30, c1: 0xd8b020, c2: 0x2040a0 }],
  pampa: [{ layer: 'mid', x: 260, y: 440, len: 50, h: 28, c1: 0x80b0e0, c2: 0xf0f0f0 }],
};
export const GRASS: Partial<Record<StageKind, GrassSpec[]>> = {
  llanos: [{ layer: 'near', y: 612, c1: 0x0c180a, c2: 0x34561e, hMin: 24, hMax: 62, n: 110, x0: -400, x1: 1680 }],
  pampa: [{ layer: 'near', y: 614, c1: 0x3a2410, c2: 0xb08a40, hMin: 40, hMax: 100, n: 70, x0: -400, x1: 1680 }],
  jungle: [{ layer: 'near', y: 614, c1: 0x04100a, c2: 0x1c4a2a, hMin: 30, hMax: 70, n: 60, x0: -400, x1: 1680 }],
};
export const BELL = { x: 775, y: 252 }; // plaza belfry (mid layer)
export const PORTALS = [
  { x: 190, y: 400, r: 62, c1: 0x40ffd0, c2: 0xff40c0, layer: 'mid' as LayerName },
  { x: 1100, y: 330, r: 48, c1: 0xff9040, c2: 0x6040ff, layer: 'far' as LayerName },
  { x: 650, y: 470, r: 38, c1: 0xc0a0ff, c2: 0x40ffd0, layer: 'far' as LayerName },
];
export interface IslandSpec { layer: LayerName; x: number; y: number; w: number; h: number; variant: number; bob: number; speed: number; alpha: number }
export const ISLANDS: IslandSpec[] = [
  { layer: 'far', x: 330, y: 230, w: 170, h: 130, variant: 0, bob: 6, speed: 0.0007, alpha: 0.55 },
  { layer: 'far', x: 930, y: 190, w: 200, h: 140, variant: 1, bob: 8, speed: 0.0006, alpha: 0.55 },
  { layer: 'mid', x: 130, y: 250, w: 300, h: 230, variant: 2, bob: 10, speed: 0.0009, alpha: 1 },
  { layer: 'mid', x: 1000, y: 300, w: 330, h: 250, variant: 3, bob: 12, speed: 0.0008, alpha: 1 },
  { layer: 'mid', x: 560, y: 120, w: 190, h: 140, variant: 0, bob: 7, speed: 0.001, alpha: 0.9 },
  { layer: 'near', x: 640, y: 420, w: 120, h: 80, variant: 1, bob: 9, speed: 0.0012, alpha: 0.95 },
];

/* ----------------------------------------------------------------- helpers */
export const css = (c: number, a = 1): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
export const mix = (a: number, b: number, t: number): number => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
};
export const shade = (c: number, f: number): number => {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (cl((c >> 16) & 255) << 16) | (cl((c >> 8) & 255) << 8) | cl(c & 255);
};
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise1(seed: number): (x: number) => number {
  const R = rng(seed);
  const tab: number[] = [];
  for (let i = 0; i < 256; i++) tab.push(R());
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const a = tab[((i % 256) + 256) % 256], b = tab[(((i + 1) % 256) + 256) % 256];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}
function fbm(n: (x: number) => number, x: number, o = 4): number {
  let v = 0, a = 0.5, f = 1, t = 0;
  for (let i = 0; i < o; i++) { v += a * n(x * f + i * 17.3); t += a; a *= 0.5; f *= 2.03; }
  return v / t;
}
interface Ridge { y: (x: number) => number }
function makeRidge(seed: number, base: number, amp: number, freq: number, peaky = false): Ridge {
  const n = noise1(seed);
  return {
    y: (x) => {
      let v = fbm(n, x * freq, 5);
      if (peaky) v = Math.pow(1 - Math.abs(2 * v - 1), 1.25);
      else v = (v - 0.25) * 1.6;
      return base - amp * v;
    },
  };
}
const X0 = -1300, XW = 3900;
function ridgePath(c: Ctx, r: Ridge, step = 5, bottom = 740): void {
  c.beginPath();
  c.moveTo(X0, bottom);
  for (let x = X0; x <= X0 + XW; x += step) c.lineTo(x, r.y(x));
  c.lineTo(X0 + XW, bottom);
  c.closePath();
}
function vgrad(c: Ctx, y0: number, y1: number, stops: [number, string][], x = X0, w = XW): void {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(x, y0, w, y1 - y0);
}
export function blob(c: Ctx, x: number, y: number, rx: number, ry: number, col: number, a: number, a2 = 0): void {
  c.save();
  c.translate(x, y);
  c.scale(1, Math.max(0.02, ry / rx));
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, css(col, a));
  g.addColorStop(0.5, css(col, a * 0.45 + a2 * 0.55));
  g.addColorStop(1, css(col, a2));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function skyBase(c: Ctx, top: number, bot: number, mid?: number, h = 640): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(top));
  if (mid !== undefined) g.addColorStop(0.55, css(mid));
  g.addColorStop(1, css(bot));
  c.fillStyle = g;
  c.fillRect(X0, -60, XW, 780);
}
function stars(c: Ctx, R: () => number, n: number, ymax: number, a = 0.8): void {
  for (let i = 0; i < n; i++) {
    const x = -300 + R() * 1900, y = R() * ymax;
    const s = R() < 0.1 ? 1.8 : R() < 0.4 ? 1.2 : 0.8;
    c.fillStyle = css(R() < 0.2 ? 0xffd8b0 : R() < 0.3 ? 0xb0c8ff : 0xffffff, a * (0.35 + R() * 0.65) * (1 - y / (ymax * 1.4)));
    c.fillRect(x, y, s, s);
  }
}
function fogBand(c: Ctx, y: number, h: number, col: number, a: number): void {
  vgrad(c, y - h, y + h, [[0, css(col, 0)], [0.5, css(col, a)], [1, css(col, 0)]]);
}
function groundFill(c: Ctx, y0: number, c0: number, c1: number): void {
  vgrad(c, y0, 725, [[0, css(c0)], [1, css(c1)]]);
}
function soldier(c: Ctx, x: number, y: number, h: number, col: number, rifle = true, hat = true): void {
  c.fillStyle = css(col);
  c.strokeStyle = css(col);
  c.lineWidth = Math.max(1, h * 0.09);
  c.beginPath(); c.arc(x, y - h * 0.86, h * 0.1, 0, 6.3); c.fill();
  if (hat) c.fillRect(x - h * 0.1, y - h * 1.02, h * 0.2, h * 0.14);
  c.fillRect(x - h * 0.12, y - h * 0.76, h * 0.24, h * 0.42);
  c.beginPath();
  c.moveTo(x - h * 0.06, y - h * 0.34); c.lineTo(x - h * 0.1, y);
  c.moveTo(x + h * 0.06, y - h * 0.34); c.lineTo(x + h * 0.1, y);
  c.stroke();
  if (rifle) { c.beginPath(); c.moveTo(x + h * 0.16, y - h * 0.3); c.lineTo(x + h * 0.2, y - h * 1.15); c.stroke(); }
}
function rider(c: Ctx, x: number, y: number, s: number, col: number, lance = true): void {
  c.fillStyle = css(col);
  c.strokeStyle = css(col);
  c.lineWidth = 2 * s;
  c.beginPath(); c.ellipse(x, y - 18 * s, 22 * s, 8 * s, 0, 0, 6.3); c.fill();
  c.beginPath(); c.moveTo(x + 16 * s, y - 22 * s); c.lineTo(x + 26 * s, y - 36 * s); c.lineTo(x + 34 * s, y - 33 * s); c.lineTo(x + 24 * s, y - 18 * s); c.fill();
  c.beginPath();
  c.moveTo(x - 14 * s, y - 14 * s); c.lineTo(x - 18 * s, y);
  c.moveTo(x - 8 * s, y - 14 * s); c.lineTo(x - 8 * s, y);
  c.moveTo(x + 12 * s, y - 14 * s); c.lineTo(x + 16 * s, y);
  c.moveTo(x + 18 * s, y - 14 * s); c.lineTo(x + 24 * s, y - 3 * s);
  c.stroke();
  c.fillRect(x - 3 * s, y - 40 * s, 6 * s, 18 * s);
  c.beginPath(); c.arc(x, y - 44 * s, 4 * s, 0, 6.3); c.fill();
  if (lance) { c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(x - 20 * s, y - 14 * s); c.lineTo(x + 36 * s, y - 70 * s); c.stroke(); }
}
function palm(c: Ctx, x: number, y: number, h: number, lean: number, col: number, R: () => number): void {
  c.strokeStyle = css(col);
  c.lineCap = 'round';
  c.lineWidth = Math.max(2, h * 0.04);
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.2, y - h * 0.5, x + lean, y - h); c.stroke();
  const cx = x + lean, cy = y - h;
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI + (i / 10) * Math.PI + (R() - 0.5) * 0.2;
    const L = h * (0.32 + R() * 0.12);
    const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.55 + L * 0.32;
    c.lineWidth = Math.max(1.5, h * 0.018);
    c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(cx + Math.cos(a) * L * 0.55, cy + Math.sin(a) * L * 0.8 - L * 0.1, ex, ey); c.stroke();
    c.lineWidth = 1;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const px = cx + (ex - cx) * t, py = cy + (ey - cy) * t - Math.sin(t * Math.PI) * L * 0.1;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + (Math.cos(a) > 0 ? 3 : -3), py + L * 0.14 * (1 - t * 0.4)); c.stroke();
    }
  }
  c.lineCap = 'butt';
}
function masonry(c: Ctx, x: number, y: number, w: number, h: number, base: number, R: () => number, rowH = 14, cw = 34): void {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let yy = y; yy < y + h; yy += rowH) {
    let xx = x - R() * cw;
    while (xx < x + w) {
      const bw = cw * (0.6 + R() * 0.8);
      c.fillStyle = css(shade(base, 0.78 + R() * 0.4));
      c.fillRect(xx + 1, yy + 1, bw - 2, rowH - 2);
      c.fillStyle = css(0xffffff, 0.07); c.fillRect(xx + 1, yy + 1, bw - 2, 2);
      c.fillStyle = css(0x000000, 0.28); c.fillRect(xx + 1, yy + rowH - 3, bw - 2, 2);
      xx += bw;
    }
  }
  c.restore();
}
function lightRim(c: Ctx, x: number, y: number, w: number, h: number, col: number, a: number): void {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, css(col, a)); g.addColorStop(0.35, css(col, 0)); g.addColorStop(1, css(0x000000, a * 0.8));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function persp(c: Ctx, col: string, vy: number, nR: number, nH: number, lw = 1, spacing = 120): void {
  c.strokeStyle = col; c.lineWidth = lw;
  for (let i = 0; i < nH; i++) {
    const y = 612 + 108 * Math.pow(i / nH, 1.7);
    c.beginPath(); c.moveTo(X0, y); c.lineTo(X0 + XW, y); c.stroke();
  }
  for (let k = -nR; k <= nR; k++) {
    const xb = 640 + k * spacing;
    const xt = 640 + (xb - 640) * (590 - vy) / (722 - vy);
    c.beginPath(); c.moveTo(xt, 590); c.lineTo(xb, 722); c.stroke();
  }
}
function floorFeather(c: Ctx, col: number): void {
  vgrad(c, 580, 616, [[0, css(col, 0)], [1, css(col, 1)]]);
}
function floorShade(c: Ctx, edgeDark = 0.5): void {
  // darken to the bottom + sides for depth
  vgrad(c, 610, 722, [[0, css(0, 0)], [1, css(0, edgeDark * 0.7)]]);
  const g = c.createLinearGradient(0, 0, 1280, 0);
  g.addColorStop(0, css(0, edgeDark * 0.7)); g.addColorStop(0.18, css(0, 0)); g.addColorStop(0.82, css(0, 0)); g.addColorStop(1, css(0, edgeDark * 0.7));
  c.fillStyle = g; c.fillRect(0, 590, 1280, 132);
}
function rimLine(c: Ctx, col: number, a: number): void {
  vgrad(c, 606, 616, [[0, css(col, 0)], [0.55, css(col, a)], [1, css(col, 0)]]);
}
function lampPost(c: Ctx, x: number, y: number, h: number, col: number): void {
  c.fillStyle = css(col);
  c.fillRect(x - 3, y - h, 6, h);
  c.fillRect(x - 8, y - h - 6, 16, 6);
  c.fillRect(x - 10, y - 4, 20, 4);
}
function bush(c: Ctx, x: number, y: number, w: number, h: number, col: number, R: () => number): void {
  c.fillStyle = css(col);
  for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(x + (R() - 0.5) * w, y - h * (0.2 + R() * 0.3), w * (0.25 + R() * 0.2), h * (0.35 + R() * 0.3), 0, 0, 6.3); c.fill(); }
}
function leaf(c: Ctx, x: number, y: number, len: number, ang: number, wd: number, col: number, rim?: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = css(col);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -wd, len, 0); c.quadraticCurveTo(len * 0.5, wd * 0.7, 0, 0); c.fill();
  if (rim !== undefined) { c.strokeStyle = css(rim, 0.5); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -wd, len, 0); c.stroke(); }
  c.strokeStyle = css(0, 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.95, 0); c.stroke();
  c.restore();
}
function crackNet(c: Ctx, R: () => number, col: string, n: number): void {
  c.strokeStyle = col; c.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = R() * 1280, y = 614 + R() * 100;
    c.beginPath(); c.moveTo(x, y);
    const k = 3 + Math.floor(R() * 5);
    for (let j = 0; j < k; j++) { x += (R() - 0.5) * 60; y += (R() - 0.3) * 14; c.lineTo(x, y); }
    c.stroke();
  }
}

/* ------------------------------------------------------------------- stages */
type Painter = (c: Ctx, st: StageDef, R: () => number) => void;
type PaintSet = Partial<Record<LayerName, Painter>>;

/* ---------- LLANOS ---------- */
const llanos: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x090a14, 0xb4603a, mix(st.sky[0], 0x40303c, 0.5));
    for (let i = 0; i < 28; i++) blob(c, -200 + R() * 1700, 20 + R() * 320, 170 + R() * 170, 40 + R() * 50, 0x07080f, 0.5);
    blob(c, 880, 480, 620, 170, 0xff9a50, 0.6);
    blob(c, 880, 488, 300, 50, 0xffe0a0, 0.6);
    for (let i = 0; i < 16; i++) blob(c, -100 + R() * 1500, 280 + R() * 190, 220 + R() * 200, 22 + R() * 30, mix(0x6a3040, 0xc06a40, R()), 0.4);
    for (let i = 0; i < 4; i++) blob(c, 300 + R() * 800, 395 + R() * 55, 320, 5 + R() * 4, 0xffb070, 0.45);
  },
  far(c, st, R) {
    groundFill(c, 468, mix(st.ground, 0xa05a40, 0.35), mix(st.ground, 0x0a1006, 0.4));
    const r = makeRidge(11, 478, 26, 0.004);
    ridgePath(c, r); c.fillStyle = css(mix(st.ground, 0x2a2438, 0.5)); c.fill();
    // rain curtains
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 280 + R() * 100;
      c.save(); c.transform(1, 0, -0.25, 1, 0, 0);
      const g = c.createLinearGradient(0, 120, 0, 480);
      g.addColorStop(0, css(0x8a90a8, 0)); g.addColorStop(0.7, css(0x8a90a8, 0.09)); g.addColorStop(1, css(0xc0a090, 0.05));
      c.fillStyle = g; c.fillRect(x + 150, 120, 60 + R() * 120, 360); c.restore();
    }
    for (let i = 0; i < 7; i++) rider(c, 170 + i * 52, 477 + (i % 2) * 3, 0.42, 0x15101a, true);
    for (let i = 0; i < 5; i++) rider(c, 980 + i * 50, 477 + (i % 2) * 3, 0.4, 0x15101a, true);
    fogBand(c, 478, 40, 0x8a6a70, 0.35);
  },
  mid(c, st, R) {
    const dk = 0x0c1208;
    // rancho
    c.fillStyle = css(0x1a1410); c.fillRect(760, 520, 120, 40);
    c.beginPath(); c.moveTo(745, 522); c.lineTo(820, 482); c.lineTo(895, 522); c.fill();
    c.fillStyle = css(0xffb060, 0.8); c.fillRect(790, 534, 14, 16);
    blob(c, 797, 542, 40, 30, 0xffa040, 0.35);
    // fence
    c.strokeStyle = css(dk, 0.9); c.lineWidth = 3;
    for (let x = 560; x < 1200; x += 34) { c.beginPath(); c.moveTo(x, 568); c.lineTo(x, 538); c.stroke(); }
    c.lineWidth = 2; c.beginPath(); c.moveTo(560, 548); c.lineTo(1200, 548); c.moveTo(560, 558); c.lineTo(1200, 558); c.stroke();
    // flag pole at 120
    c.fillStyle = css(0x120c08); c.fillRect(118, 390, 4, 170);
    palm(c, 330, 566, 210, 30, dk, R); palm(c, 420, 566, 150, -26, dk, R);
    palm(c, 1050, 566, 190, -24, dk, R); palm(c, 1160, 566, 230, 28, dk, R);
    for (let i = 0; i < 16; i++) bush(c, -50 + i * 100 + R() * 50, 570, 80, 26 + R() * 14, mix(dk, 0x20301a, R() * 0.5), R);
    fogBand(c, 560, 36, 0x8a7080, 0.28);
  },
  near(c, st, R) {
    // saman trees
    const trunk = (x: number, s: number) => {
      c.fillStyle = css(0x0a0806);
      c.beginPath(); c.moveTo(x - 20 * s, 612); c.quadraticCurveTo(x - 4 * s, 520, x - 14 * s, 430); c.lineTo(x + 14 * s, 430); c.quadraticCurveTo(x + 6 * s, 520, x + 22 * s, 612); c.fill();
      for (const d of [-1, 1]) { c.strokeStyle = css(0x0a0806); c.lineWidth = 10 * s; c.beginPath(); c.moveTo(x, 440 * 1); c.quadraticCurveTo(x + d * 80 * s, 430, x + d * 150 * s, 400); c.stroke(); }
      for (let i = 0; i < 22; i++) blob(c, x + (R() - 0.5) * 380 * s, 400 - R() * 90 * s + Math.abs((R() - 0.5)) * 60, 90 * s, 36 * s, i % 3 ? 0x0a1008 : 0x141c0e, 0.97);
      c.strokeStyle = css(0xffa050, 0.18); c.lineWidth = 2; c.beginPath(); c.arc(x + 130 * s, 405, 60 * s, 3.5, 5.4); c.stroke();
    };
    trunk(1210, 1); trunk(30, 0.8);
    fogBand(c, 612, 30, 0x70606a, 0.22);
  },
  floor(c, st, R) {
    floorFeather(c, mix(st.ground, 0x0a1004, 0.2));
    vgrad(c, 610, 722, [[0, css(mix(st.ground, 0x3a3020, 0.25))], [0.5, css(mix(st.ground, 0x060a04, 0.3))], [1, css(0x040602)]]);
    for (let i = 0; i < 16; i++) {
      const y = 620 + R() * 90, w = 60 + R() * 110 * (y - 600) / 100;
      const x = R() * 1280;
      c.save(); c.translate(x, y); c.scale(1, 0.16);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, w);
      g.addColorStop(0, css(0xd0804a, 0.6)); g.addColorStop(0.7, css(0x503038, 0.55)); g.addColorStop(1, css(0x000000, 0.1));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, w, 0, 6.3); c.fill(); c.restore();
    }
    persp(c, css(0x000000, 0.18), 400, 12, 7, 1, 130);
    for (let i = 0; i < 700; i++) {
      const y = 612 + Math.pow(R(), 0.8) * 108, x = R() * 1280, h = 4 + (y - 610) * 0.28 * R() + 2;
      c.strokeStyle = css(mix(0x1a3010, 0x4a7a2a, R()), 0.5 + R() * 0.4); c.lineWidth = 1 + (y - 610) / 60;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 6, y - h); c.stroke();
    }
    floorShade(c, 0.55); rimLine(c, 0xffa050, 0.22);
  },
  fg(c, st, R) {
    for (let i = 0; i < 60; i++) {
      const x = -500 + R() * 2300, y = 722, h = 20 + R() * 45;
      c.strokeStyle = css(mix(0x050a04, 0x1a2e10, R()), 1); c.lineWidth = 3 + R() * 3;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (R() - 0.5) * 30, y - h * 0.6, x + (R() - 0.5) * 60, y - h); c.stroke();
    }
  },
};

/* ---------- ANDES ---------- */
function snowCaps(c: Ctx, r: Ridge, seed: number, depth: number, x0: number, x1: number, col: number, a = 1): void {
  const n = noise1(seed);
  c.beginPath();
  for (let x = x0; x <= x1; x += 4) c.lineTo(x, r.y(x));
  for (let x = x1; x >= x0; x -= 4) {
    const yy = r.y(x) + depth * (0.25 + fbm(n, x * 0.03, 3) * 1.1) + ((x / 4) % 2 ? 3 : -3);
    c.lineTo(x, yy);
  }
  c.closePath(); c.fillStyle = css(col, a); c.fill();
}
const andes: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x1e2c4c, 0xd0dcea, 0x7d93b8);
    blob(c, 420, 250, 360, 150, 0xffffff, 0.6);
    for (let i = 0; i < 18; i++) blob(c, -150 + R() * 1600, 80 + R() * 300, 200 + R() * 160, 18 + R() * 28, mix(0xdde6f4, 0x5a6c90, R()), 0.35);
    blob(c, 420, 250, 70, 70, 0xffffff, 0.95);
  },
  far(c, st, R) {
    const r1 = makeRidge(21, 420, 300, 0.0032, true);
    ridgePath(c, r1); c.fillStyle = css(0x7d90b4); c.fill();
    c.save(); ridgePath(c, r1); c.clip();
    snowCaps(c, r1, 5, 70, X0, X0 + XW, 0xf0f6ff);
    const g = c.createLinearGradient(0, 0, 1700, 0); g.addColorStop(0, css(0xffffff, 0.15)); g.addColorStop(1, css(0x101a38, 0.5));
    c.fillStyle = g; c.fillRect(X0, 0, XW, 740);
    c.strokeStyle = css(0x23304f, 0.35); c.lineWidth = 2;
    for (let i = 0; i < 70; i++) { const x = -300 + R() * 1900; c.beginPath(); c.moveTo(x, r1.y(x) + 6); c.lineTo(x + (R() - 0.3) * 50, r1.y(x) + 60 + R() * 90); c.stroke(); }
    c.restore();
    fogBand(c, 470, 90, 0xdbe6f6, 0.55);
    const r2 = makeRidge(33, 500, 210, 0.005, true);
    ridgePath(c, r2); c.fillStyle = css(0x4a5d82); c.fill();
    c.save(); ridgePath(c, r2); c.clip();
    snowCaps(c, r2, 8, 70, X0, X0 + XW, 0xdfeaf8, 0.95);
    const g2 = c.createLinearGradient(0, 0, 1400, 0); g2.addColorStop(0, css(0xffffff, 0.1)); g2.addColorStop(1, css(0x0a1228, 0.55));
    c.fillStyle = g2; c.fillRect(X0, 0, XW, 740);
    c.restore();
    groundFill(c, 560, 0x3a4a68, 0xc4d2e4);
    fogBand(c, 540, 60, 0xc8d6ea, 0.5);
  },
  mid(c, st, R) {
    const r = makeRidge(47, 540, 150, 0.006, true);
    ridgePath(c, r); c.fillStyle = css(0x2c323f); c.fill();
    c.save(); ridgePath(c, r); c.clip();
    snowCaps(c, r, 3, 34, X0, X0 + XW, 0xcfdcee, 0.9);
    const g = c.createLinearGradient(0, 0, 1280, 0); g.addColorStop(0, css(0xffffff, 0.12)); g.addColorStop(1, css(0x000000, 0.4));
    c.fillStyle = g; c.fillRect(X0, 0, XW, 740); c.restore();
    // army column along the slope
    for (let x = 80; x < 1000; x += 17) {
      const y = r.y(x) + 7;
      const k = ((x / 17) | 0) % 9;
      if (k === 4) { c.fillStyle = css(0x0c0e14); c.fillRect(x - 7, y - 11, 14, 6); c.fillRect(x - 3, y - 15, 10, 4); c.fillRect(x + 6, y - 14, 10, 2); c.beginPath(); c.arc(x - 6, y - 3, 3, 0, 6.3); c.fill(); }
      else if (k === 7) { c.fillStyle = css(0x0c0e14); c.fillRect(x - 6, y - 12, 12, 7); c.fillRect(x + 4, y - 17, 4, 7); c.fillRect(x - 6, y - 5, 2, 5); c.fillRect(x + 3, y - 5, 2, 5); }
      else soldier(c, x, y, 14 + (k % 3), 0x0c0e14, true, true);
    }
    c.fillStyle = css(0x0c0e14); c.fillRect(759, 372, 3, 36);
    blob(c, 640, 560, 600, 40, 0xdfe8f6, 0.4);
  },
  near(c, st, R) {
    const rock = (x: number, w: number, h: number, flip: number) => {
      c.fillStyle = css(0x14181f);
      c.beginPath(); c.moveTo(x - w * flip, 640); c.lineTo(x - w * 0.5 * flip, 640 - h * 0.45);
      c.lineTo(x - w * 0.3 * flip, 640 - h * 0.55); c.lineTo(x - w * 0.1 * flip, 640 - h);
      c.lineTo(x + w * 0.25 * flip, 640 - h * 0.7); c.lineTo(x + w * 0.35 * flip, 640 - h * 0.78); c.lineTo(x + w * 0.5 * flip, 640); c.fill();
      c.fillStyle = css(0xdde8f8, 0.85);
      c.beginPath(); c.moveTo(x - w * 0.1 * flip, 640 - h); c.lineTo(x + w * 0.25 * flip, 640 - h * 0.7); c.lineTo(x + w * 0.1 * flip, 640 - h * 0.66); c.lineTo(x - w * 0.18 * flip, 640 - h * 0.78); c.fill();
    };
    rock(-30, 280, 330, 1); rock(60, 160, 200, -1); rock(1300, 300, 360, -1); rock(1210, 170, 190, 1);
    for (let i = 0; i < 9; i++) blob(c, -100 + R() * 1500, 620, 160 + R() * 100, 20 + R() * 12, 0xe8f0fa, 0.9);
  },
  floor(c, st, R) {
    floorFeather(c, 0xdfe8f2);
    vgrad(c, 610, 722, [[0, css(0xe4ecf6)], [0.6, css(0xb4c6de)], [1, css(0x7b90b6)]]);
    for (let i = 0; i < 22; i++) blob(c, R() * 1280, 618 + R() * 100, 80 + R() * 120, 8 + R() * 12, 0x5a74a8, 0.3);
    persp(c, css(0x4a6090, 0.12), 400, 12, 6, 1, 130);
    c.strokeStyle = css(0x4a6090, 0.25);
    for (let i = 0; i < 26; i++) { const x = R() * 1280, y = 622 + R() * 90; c.lineWidth = 1; c.beginPath(); c.arc(x, y + 30, 40 + R() * 40, 4.5, 5.1); c.stroke(); }
    for (let i = 0; i < 14; i++) {
      const x = 80 + R() * 1120, y = 640 + R() * 66;
      c.fillStyle = css(0x4a5a80, 0.35); c.beginPath(); c.ellipse(x, y, 7, 3, 0.2, 0, 6.3); c.fill(); c.beginPath(); c.ellipse(x + 14, y + 5, 7, 3, 0.2, 0, 6.3); c.fill();
    }
    c.strokeStyle = css(0x3a5080, 0.3);
    for (let i = 0; i < 6; i++) { let x = R() * 1280, y = 640 + R() * 60; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (R() - 0.5) * 60; y += (R() - 0.3) * 12; c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 80; i++) { c.fillStyle = css(0xffffff, 0.3 + R() * 0.6); c.fillRect(R() * 1280, 614 + R() * 106, 1.4, 1.4); }
    floorShade(c, 0.4); rimLine(c, 0xffffff, 0.35);
  },
};

/* ---------- TIWANAKU ---------- */
function carvedFrieze(c: Ctx, x: number, y: number, w: number, h: number): void {
  c.strokeStyle = css(0x1e1410, 0.65); c.lineWidth = 2;
  // central deity
  const cx = x + w / 2;
  c.beginPath(); c.arc(cx, y + h * 0.28, h * 0.17, 0, 6.3); c.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * h * 0.17, y + h * 0.28 + Math.sin(a) * h * 0.17); c.lineTo(cx + Math.cos(a) * h * 0.3, y + h * 0.28 + Math.sin(a) * h * 0.3); c.stroke(); }
  c.strokeRect(cx - h * 0.1, y + h * 0.5, h * 0.2, h * 0.4);
  c.beginPath(); c.moveTo(cx - h * 0.1, y + h * 0.62); c.lineTo(cx - h * 0.32, y + h * 0.5); c.moveTo(cx + h * 0.1, y + h * 0.62); c.lineTo(cx + h * 0.32, y + h * 0.5); c.stroke();
  // attendants (winged figures) as stepped meanders
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const bx = cx + s * (h * 0.5 + i * h * 0.3);
      c.strokeRect(bx - h * 0.08, y + h * 0.3, h * 0.16, h * 0.55);
      c.beginPath(); c.arc(bx, y + h * 0.2, h * 0.07, 0, 6.3); c.stroke();
      c.beginPath(); c.moveTo(bx - h * 0.08, y + h * 0.55); c.lineTo(bx - h * 0.15, y + h * 0.4); c.moveTo(bx + h * 0.08, y + h * 0.55); c.lineTo(bx + h * 0.15, y + h * 0.4); c.stroke();
    }
  }
  // step meander at bottom
  c.beginPath();
  for (let xx = x + 6; xx < x + w - 10; xx += 16) { c.moveTo(xx, y + h - 6); c.lineTo(xx, y + h - 16); c.lineTo(xx + 8, y + h - 16); c.lineTo(xx + 8, y + h - 10); c.lineTo(xx + 4, y + h - 10); }
  c.stroke();
}
const tiwanaku: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x1c1634, 0xffc888, 0x8a4a72);
    blob(c, 640, 480, 760, 300, 0xff9a50, 0.6);
    blob(c, 640, 480, 360, 160, 0xffd890, 0.7);
    for (let i = 0; i < 12; i++) blob(c, -100 + R() * 1500, 120 + R() * 280, 220 + R() * 160, 12 + R() * 16, mix(0xff9a70, 0x6a3a6a, R()), 0.35);
    stars(c, R, 80, 200, 0.5);
    c.fillStyle = css(0xffe8b0); c.beginPath(); c.arc(640, 472, 64, 0, 6.3); c.fill();
    blob(c, 640, 472, 110, 110, 0xfff0c0, 0.7);
  },
  far(c, st, R) {
    groundFill(c, 470, mix(st.ground, 0xd08a60, 0.4), mix(st.ground, 0x1a1008, 0.4));
    const r = makeRidge(61, 480, 170, 0.0045, true);
    ridgePath(c, r); c.fillStyle = css(0x5a3a5c); c.fill();
    c.save(); ridgePath(c, r); c.clip();
    snowCaps(c, r, 4, 50, X0, X0 + XW, 0xf0b8a0, 0.8);
    vgrad(c, 400, 480, [[0, css(0xffa060, 0)], [1, css(0xffa060, 0.5)]]); c.restore();
    const r2 = makeRidge(62, 490, 60, 0.008);
    ridgePath(c, r2); c.fillStyle = css(0x3a2840); c.fill();
    // Akapana stepped pyramid
    for (let i = 0; i < 5; i++) { c.fillStyle = css(shade(0x4a3038, 1 - i * 0.04)); c.fillRect(980 + i * 20, 462 - i * 12, 210 - i * 40, 12); }
    fogBand(c, 490, 40, 0xe0a070, 0.4);
  },
  mid(c, st, R) {
    const cx = 640;
    // platform
    c.fillStyle = css(0x4a3a30); c.fillRect(cx - 250, 548, 500, 14); c.fillStyle = css(0x3a2c24); c.fillRect(cx - 280, 560, 560, 12);
    // monoliths (Kalasasaya)
    const mono = (x: number, h: number, w: number) => {
      c.fillStyle = css(0x4a3c34); c.beginPath(); c.moveTo(x - w / 2, 552); c.lineTo(x - w * 0.42, 552 - h); c.lineTo(x + w * 0.42, 552 - h + 4); c.lineTo(x + w / 2, 552); c.fill();
      lightRim(c, x - w / 2, 552 - h, w, h, 0xffc080, 0.55);
      c.strokeStyle = css(0, 0.3); c.lineWidth = 1; c.beginPath(); c.moveTo(x - w * 0.1, 552 - h + 8); c.lineTo(x - w * 0.12, 552); c.stroke();
    };
    for (let i = 0; i < 6; i++) { mono(120 + i * 62, 120 + (i % 3) * 22, 30); mono(900 + i * 56, 110 + ((i + 1) % 3) * 25, 30); }
    // Gate of the Sun
    const gw = 300, gh = 270, gx = cx - gw / 2, gy = 552 - gh;
    c.fillStyle = css(0x56463c); c.fillRect(gx, gy, gw, gh);
    masonry(c, gx, gy, gw, gh, 0x4f3f36, R, 18, 40);
    lightRim(c, gx, gy, gw, gh, 0xffc890, 0.7);
    // opening
    const ox = cx - 60, oy = gy + 108, ow = 120, oh = 552 - oy;
    c.save(); c.beginPath(); c.rect(ox, oy, ow, oh); c.clip();
    c.clearRect(ox, oy, ow, oh); c.restore();
    // frieze band above the opening
    c.fillStyle = css(0x3e3028); c.fillRect(gx + 12, gy + 14, gw - 24, 88);
    carvedFrieze(c, gx + 12, gy + 14, gw - 24, 88);
    c.fillStyle = css(0x24190f); c.fillRect(ox - 12, oy - 6, ow + 24, 6);
    // niches
    for (const nx of [gx + 26, gx + gw - 54]) { c.clearRect(nx, oy + 30, 28, 90); c.strokeStyle = css(0x241a12, 0.9); c.lineWidth = 3; c.strokeRect(nx, oy + 30, 28, 90); }
    // crack
    c.strokeStyle = css(0, 0.55); c.lineWidth = 2; c.beginPath(); c.moveTo(gx + gw * 0.7, gy + 6); c.lineTo(gx + gw * 0.72, gy + 60); c.lineTo(gx + gw * 0.69, gy + 100); c.stroke();
    // opening glow backlight bleed
    blob(c, cx, 470, 140, 100, 0xffd890, 0.35);
    fogBand(c, 565, 24, 0xe8a070, 0.4);
  },
  near(c, st, R) {
    // big carved blocks both sides
    const block = (x: number, w: number, h: number) => {
      c.fillStyle = css(0x2a1f1a); c.fillRect(x, 612 - h, w, h);
      masonry(c, x, 612 - h, w, h, 0x3a2c24, R, 22, 50);
      lightRim(c, x, 612 - h, w, h, 0xffb070, 0.6);
      c.strokeStyle = css(0, 0.5); c.lineWidth = 3; c.strokeRect(x + w * 0.2, 612 - h * 0.75, w * 0.6, h * 0.3);
    };
    block(-120, 230, 130); block(60, 130, 78); block(1130, 250, 120); block(1050, 100, 60);
    // standing head statue (Ponce-like) left
    for (const [x, s] of [[1230, 1]] as [number, number][]) {
      c.fillStyle = css(0x241a14); c.fillRect(x - 40 * s, 400, 80 * s, 210);
      c.strokeStyle = css(0xffa860, 0.35); c.lineWidth = 2; c.strokeRect(x - 40 * s, 400, 80 * s, 210);
      c.strokeStyle = css(0xffa860, 0.3); c.strokeRect(x - 26 * s, 430, 52 * s, 36);
    }
    blob(c, 640, 622, 700, 20, 0xe0a070, 0.3);
  },
  floor(c, st, R) {
    floorFeather(c, 0x5a4430);
    vgrad(c, 610, 722, [[0, css(0x7a5e40)], [1, css(0x30221a)]]);
    // flagstones
    for (let r = 0; r < 8; r++) {
      const t0 = Math.pow(r / 8, 1.7), t1 = Math.pow((r + 1) / 8, 1.7);
      const y0 = 612 + 108 * t0, y1 = 612 + 108 * t1;
      let x = -R() * 200 - (r * 37) % 100;
      while (x < 1400) {
        const w = (90 + R() * 130) * (1 + t0 * 1.2);
        c.fillStyle = css(mix(0x6a5038, 0x8a6a48, R()), 0.55); c.fillRect(x + 2, y0 + 1, w - 3, y1 - y0 - 2);
        c.fillStyle = css(0xffe0b0, 0.08); c.fillRect(x + 2, y0 + 1, w - 3, 2);
        c.fillStyle = css(0, 0.3); c.fillRect(x + 2, y1 - 3, w - 3, 2);
        x += w;
      }
    }
    crackNet(c, R, css(0, 0.45), 30);
    for (let i = 0; i < 40; i++) blob(c, R() * 1280, 618 + R() * 100, 40 + R() * 80, 5 + R() * 8, 0xc09060, 0.15);
    floorShade(c, 0.55); rimLine(c, 0xffc080, 0.3);
  },
};

/* ---------- CITADEL ---------- */
const citadel: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x0c1a1e, 0x7a9a90, 0x2a4846);
    blob(c, 930, 190, 380, 220, 0xd8f0e0, 0.4);
    for (let i = 0; i < 14; i++) blob(c, -100 + R() * 1500, 60 + R() * 350, 220 + R() * 160, 16 + R() * 24, 0xb0d0c8, 0.2);
    stars(c, R, 60, 130, 0.5);
    c.fillStyle = css(0xe8f4e8, 0.85); c.beginPath(); c.arc(930, 190, 26, 0, 6.3); c.fill();
  },
  far(c, st, R) {
    groundFill(c, 500, 0x2a4440, 0x14201e);
    const mk = (seed: number, base: number, amp: number, col: number, mist: number) => {
      const r = makeRidge(seed, base, amp, 0.0042, true);
      ridgePath(c, r); c.fillStyle = css(col); c.fill();
      c.save(); ridgePath(c, r); c.clip();
      for (let i = 0; i < 120; i++) { const x = -300 + R() * 1900; c.strokeStyle = css(shade(col, 0.6), 0.5); c.lineWidth = 2 + R() * 2; c.beginPath(); c.moveTo(x, r.y(x) + 4); c.lineTo(x + (R() - 0.5) * 30, r.y(x) + 40 + R() * 120); c.stroke(); }
      vgrad(c, base - amp, base, [[0, css(0x9ec0b6, mist)], [1, css(0x9ec0b6, 0)]]);
      c.restore();
    };
    mk(71, 470, 300, 0x3a5c58, 0.5);
    fogBand(c, 440, 70, 0xb0d0c8, 0.5);
    mk(72, 500, 230, 0x213c38, 0.35);
    fogBand(c, 500, 50, 0xa0c0b8, 0.45);
  },
  mid(c, st, R) {
    const stone = 0x6a665a;
    // terraces rising toward the back
    const tiers = 6;
    for (let k = tiers - 1; k >= 0; k--) {
      const top = 440 + k * 26, h = 26;
      c.fillStyle = css(mix(0x2e5a30, 0x4a7a38, 1 - k / tiers)); c.fillRect(X0, top - 8, XW, 10);
      masonry(c, X0, top, XW, h + 1, shade(stone, 0.95 - k * 0.05), R, 13, 30);
      vgrad(c, top, top + h, [[0, css(0, 0)], [1, css(0, 0.35)]]);
      blob(c, 640, top, 700, 12, 0xb0d0c8, 0.16);
    }
    // staircases
    for (const sx of [380, 880]) {
      for (let k = 0; k < tiers; k++) { const top = 440 + k * 26; for (let s = 0; s < 6; s++) { c.fillStyle = css(shade(0x7a766a, 0.75 + (s % 2) * 0.2)); c.fillRect(sx - 18, top + s * 4, 36, 4); } }
    }
    // Inca house (trapezoid doors, thatched roof)
    const house = (x: number, y: number, w: number, h: number) => {
      masonry(c, x, y - h, w, h, 0x77705e, R, 11, 26);
      c.fillStyle = css(0x2a2418);
      c.beginPath(); c.moveTo(x - 12, y - h + 2); c.lineTo(x + w / 2, y - h - h * 0.8); c.lineTo(x + w + 12, y - h + 2); c.fill();
      for (let i = 0; i < 12; i++) { c.strokeStyle = css(0x5a4a2a, 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(x + w / 2, y - h - h * 0.8); c.lineTo(x - 12 + i * ((w + 24) / 11), y - h + 2); c.stroke(); }
      c.fillStyle = css(0x0a0806);
      c.beginPath(); c.moveTo(x + w / 2 - 12, y); c.lineTo(x + w / 2 - 8, y - h * 0.62); c.lineTo(x + w / 2 + 8, y - h * 0.62); c.lineTo(x + w / 2 + 12, y); c.fill();
      c.fillStyle = css(0xffc060, 0.7); c.fillRect(x + w / 2 - 5, y - h * 0.45, 10, 14);
    };
    house(150, 440, 100, 50); house(1000, 440, 130, 56); house(560, 440, 90, 44);
    // llamas
    for (const lx of [440, 1180]) {
      c.fillStyle = css(0x161410);
      c.beginPath(); c.ellipse(lx, 574, 20, 10, 0, 0, 6.3); c.fill();
      c.fillRect(lx + 12, 548, 6, 24); c.beginPath(); c.ellipse(lx + 18, 546, 6, 4, 0.3, 0, 6.3); c.fill();
      c.fillRect(lx - 14, 576, 3, 14); c.fillRect(lx + 10, 576, 3, 14);
    }
    fogBand(c, 560, 36, 0xa0c0b8, 0.35);
    for (const [x, y] of [[520, 432], [900, 432]]) { c.fillStyle = css(0x120e08); c.fillRect(x - 2, y, 4, 18); }
  },
  near(c, st, R) {
    for (const [x, w, h] of [[-80, 270, 150], [1090, 260, 140]] as [number, number, number][]) {
      masonry(c, x, 612 - h, w, h, 0x4a4a42, R, 22, 46);
      c.fillStyle = css(0x1e3a1e); c.fillRect(x, 612 - h - 8, w, 10);
      for (let i = 0; i < 20; i++) blob(c, x + R() * w, 612 - h - 4, 20, 8, 0x1c3a1c, 0.9);
      vgrad(c, 612 - h, 612, [[0, css(0, 0)], [1, css(0, 0.45)]], x, w);
      lightRim(c, x, 612 - h, w, h, 0xffb860, 0.25);
    }
    c.fillStyle = css(0x120e08); c.fillRect(167, 560, 6, 60); c.fillRect(1107, 560, 6, 60);
    fogBand(c, 612, 34, 0x8aa8a0, 0.3);
  },
  floor(c, st, R) {
    floorFeather(c, 0x4a4a40);
    vgrad(c, 610, 722, [[0, css(0x5e5e50)], [1, css(0x22221c)]]);
    for (let r = 0; r < 7; r++) {
      const t0 = Math.pow(r / 7, 1.7), t1 = Math.pow((r + 1) / 7, 1.7);
      const y0 = 612 + 108 * t0, y1 = 612 + 108 * t1;
      let x = -R() * 100;
      while (x < 1400) {
        const w = (60 + R() * 110) * (1 + t0 * 1.3);
        const sk = (R() - 0.5) * 14;
        c.fillStyle = css(mix(0x585848, 0x7a7a68, R()), 0.7);
        c.beginPath(); c.moveTo(x + 2, y0 + 1); c.lineTo(x + w - 2 + sk, y0 + 1); c.lineTo(x + w - 3, y1 - 1); c.lineTo(x + 3 + sk, y1 - 1); c.fill();
        c.fillStyle = css(0xffffff, 0.07); c.fillRect(x + 3, y0 + 1, w - 6, 2);
        x += w;
      }
    }
    for (let i = 0; i < 30; i++) blob(c, R() * 1280, 618 + R() * 100, 30 + R() * 60, 5 + R() * 7, mix(0x1e4a20, 0x3a6a2a, R()), 0.5);
    for (let i = 0; i < 4; i++) blob(c, 120 + R() * 1040, 630 + R() * 70, 140, 12, 0xffc060, 0.1);
    floorShade(c, 0.55); rimLine(c, 0xb0d8c8, 0.25);
  },
};

/* ---------- BATTLEFIELD ---------- */
const battlefield: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x1c181c, 0xe0905a, 0x6a4a50);
    blob(c, 940, 450, 520, 190, 0xff9040, 0.6);
    for (let i = 0; i < 24; i++) blob(c, -150 + R() * 1600, 20 + R() * 380, 200 + R() * 180, 40 + R() * 60, mix(0x1e1a1c, 0x5a4a4a, R()), 0.5);
    c.fillStyle = css(0xffb070, 0.8); c.beginPath(); c.arc(940, 440, 48, 0, 6.3); c.fill();
    blob(c, 940, 440, 140, 140, 0xffa050, 0.5);
    for (let i = 0; i < 4; i++) {
      const x = 100 + R() * 1100;
      for (let k = 0; k < 14; k++) blob(c, x + Math.sin(k * 0.6) * 20, 470 - k * 30, 60 + k * 9, 36 + k * 4, 0x14100f, 0.55);
    }
  },
  far(c, st, R) {
    groundFill(c, 468, mix(st.ground, 0xc07a50, 0.35), mix(st.ground, 0x0a0806, 0.4));
    const r = makeRidge(81, 478, 46, 0.006);
    ridgePath(c, r); c.fillStyle = css(0x2a2024); c.fill();
    // armies in ranks
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 38; i++) {
        const x = 20 + i * 34 + (row * 11) % 17 + R() * 8;
        if ((x > 180 && x < 240) || (x > 980 && x < 1060)) continue;
        soldier(c, x, 480 + row * 4, 15 + row * 1.5, 0x120c0e, true, true);
      }
    for (let i = 0; i < 6; i++) rider(c, 520 + i * 40, 482, 0.4, 0x120c0e, true);
    // standard poles
    for (const x of [300, 640, 1150]) { c.fillStyle = css(0x120c0e); c.fillRect(x, 410, 2, 70); c.fillStyle = css(0x601818); c.fillRect(x + 2, 412, 20, 12); }
    blob(c, 210, 470, 90, 50, 0xff7020, 0.4); blob(c, 1010, 472, 130, 70, 0xff6010, 0.45);
    fogBand(c, 480, 36, 0xa07860, 0.5);
  },
  mid(c, st, R) {
    // cannons
    const cannon = (x: number, y: number, s: number, dir: number) => {
      c.fillStyle = css(0x120e0c);
      c.save(); c.translate(x, y); c.scale(dir * s, s);
      c.beginPath(); c.moveTo(-10, -26); c.lineTo(60, -38); c.lineTo(62, -28); c.lineTo(-10, -18); c.fill();
      c.beginPath(); c.arc(12, -10, 22, 0, 6.3); c.fill();
      c.strokeStyle = css(0x2a201a); c.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * 0.785; c.beginPath(); c.moveTo(12, -10); c.lineTo(12 + Math.cos(a) * 21, -10 + Math.sin(a) * 21); c.stroke(); }
      c.fillRect(-20, -22, 40, 8);
      c.restore();
    };
    cannon(190, 566, 1.1, 1); cannon(1090, 566, 1.1, -1);
    // tents
    for (const x of [520, 770]) { c.fillStyle = css(0x2a2220); c.beginPath(); c.moveTo(x - 60, 568); c.lineTo(x, 506); c.lineTo(x + 60, 568); c.fill(); c.fillStyle = css(0xffa060, 0.12); c.beginPath(); c.moveTo(x, 506); c.lineTo(x + 60, 568); c.lineTo(x + 18, 568); c.fill(); }
    // dead trees
    for (const x of [420, 960]) {
      c.strokeStyle = css(0x0e0a0a); c.lineWidth = 7; c.beginPath(); c.moveTo(x, 575); c.quadraticCurveTo(x + 6, 500, x - 4, 430); c.stroke();
      c.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const yy = 440 + i * 18, d = i % 2 ? 1 : -1; c.beginPath(); c.moveTo(x, yy + 8); c.quadraticCurveTo(x + d * 24, yy - 6, x + d * (30 + R() * 30), yy - 20); c.stroke(); }
    }
    // standard poles (animated banners attach at top)
    for (const [x, y] of [[330, 330], [880, 340]]) { c.fillStyle = css(0x180e0a); c.fillRect(x - 2, y, 4, 238); c.beginPath(); c.arc(x, y - 2, 5, 0, 6.3); c.fill(); }
    // smoke puffs
    for (let i = 0; i < 12; i++) blob(c, R() * 1280, 480 + R() * 100, 120 + R() * 120, 40 + R() * 40, 0x3a2e2c, 0.3);
    // corpses silhouettes
    for (let i = 0; i < 9; i++) { c.fillStyle = css(0x0c0808); const x = 40 + R() * 1200; c.beginPath(); c.ellipse(x, 578 + R() * 6, 12, 3, 0, 0, 6.3); c.fill(); }
  },
  near(c, st, R) {
    // chevaux de frise
    const frise = (x: number, y: number, s: number) => {
      c.strokeStyle = css(0x120c08); c.lineWidth = 6 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 60 * s, y); c.lineTo(x + 60 * s, y); c.stroke();
      c.lineWidth = 4 * s;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 22 * s, y + 4 * s); c.lineTo(x + i * 22 * s - 18 * s, y - 40 * s); c.moveTo(x + i * 22 * s, y + 4 * s); c.lineTo(x + i * 22 * s + 18 * s, y - 40 * s); c.stroke(); }
      c.lineCap = 'butt';
    };
    frise(120, 612, 1.2); frise(1170, 612, 1.3);
    // broken wagon wheel
    c.strokeStyle = css(0x120c08); c.lineWidth = 6; c.beginPath(); c.arc(1010, 570, 44, 0.3, 5.8); c.stroke(); c.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = i * 0.785; c.beginPath(); c.moveTo(1010, 570); c.lineTo(1010 + Math.cos(a) * 42, 570 + Math.sin(a) * 42); c.stroke(); }
    // planted rifles
    for (let i = 0; i < 6; i++) { const x = 180 + i * 18 + R() * 6; c.strokeStyle = css(0x0c0806); c.lineWidth = 3; c.beginPath(); c.moveTo(x, 616); c.lineTo(x + (i % 2 ? 7 : -9), 560); c.stroke(); c.lineWidth = 1; c.beginPath(); c.moveTo(x + (i % 2 ? 7 : -9), 560); c.lineTo(x + (i % 2 ? 9 : -12), 534); c.stroke(); }
    // sandbags
    for (let i = 0; i < 10; i++) { c.fillStyle = css(shade(0x4a3e30, 0.7 + R() * 0.3)); c.beginPath(); c.ellipse(1060 + (i % 5) * 26 + (i > 4 ? 13 : 0), 612 - Math.floor(i / 5) * 14, 16, 8, 0, 0, 6.3); c.fill(); }
    fogBand(c, 612, 30, 0x70564a, 0.3);
  },
  floor(c, st, R) {
    floorFeather(c, mix(st.ground, 0x0a0806, 0.3));
    vgrad(c, 610, 722, [[0, css(0x4a3a2a)], [0.5, css(0x2a2018)], [1, css(0x120c0a)]]);
    for (let i = 0; i < 30; i++) {
      const y = 620 + R() * 90, w = 30 + R() * 80 * (y - 600) / 90;
      c.save(); c.translate(R() * 1280, y); c.scale(1, 0.2);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, w); g.addColorStop(0, css(0x0a0604, 0.7)); g.addColorStop(0.8, css(0x3a2a20, 0.4)); g.addColorStop(1, css(0x6a5040, 0.05));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, w, 0, 6.3); c.fill(); c.restore();
    }
    persp(c, css(0x000000, 0.4), 420, 5, 3, 3, 260);
    for (let i = 0; i < 400; i++) { c.fillStyle = css(mix(0x2a1e16, 0x6a5a48, R()), 0.5); const y = 614 + R() * 106; c.fillRect(R() * 1280, y, 1 + R() * 3, 1 + R() * 2); }
    for (let i = 0; i < 14; i++) { c.fillStyle = css(0x0a0606, 0.7); const x = R() * 1280, y = 625 + R() * 85; c.fillRect(x, y, 14, 2); c.fillRect(x + 12, y - 5, 2, 7); }
    for (let i = 0; i < 5; i++) blob(c, R() * 1280, 640 + R() * 60, 60, 6, 0x6a1a1a, 0.3);
    floorShade(c, 0.6); rimLine(c, 0xff9050, 0.2);
  },
};

/* ---------- JUNGLE ---------- */
const jungle: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x02060a, 0x16301e, 0x08161a);
    blob(c, 340, 140, 300, 200, 0x7ac0b0, 0.3); blob(c, 340, 140, 60, 60, 0xc0f0e0, 0.5);
    c.fillStyle = css(0xd8f8e8, 0.85); c.beginPath(); c.arc(340, 140, 20, 0, 6.3); c.fill();
    stars(c, R, 80, 220, 0.5);
    blob(c, 260, 480, 520, 220, 0xff4a10, 0.5); blob(c, 880, 470, 620, 240, 0xff5a10, 0.55);
    for (let i = 0; i < 10; i++) blob(c, R() * 1280, 100 + R() * 260, 200, 24, 0x0a1a18, 0.5);
  },
  far(c, st, R) {
    groundFill(c, 480, 0x14201a, 0x050a06);
    const mk = (seed: number, base: number, amp: number, col: number) => { const r = makeRidge(seed, base, amp, 0.007, false); ridgePath(c, r); c.fillStyle = css(col); c.fill(); for (let x = -300; x < 1600; x += 12) { c.beginPath(); c.arc(x, r.y(x) + 4, 9 + R() * 8, 0, 6.3); c.fill(); } };
    mk(91, 470, 120, 0x0c1a14); mk(92, 490, 90, 0x07100c);
    for (let i = 0; i < 14; i++) blob(c, 100 + i * 18 + R() * 6, 470, 22, 18 + R() * 10, 0xff7020, 0.4);
    for (let i = 0; i < 24; i++) blob(c, 760 + i * 14 + R() * 6, 472, 26, 20 + R() * 16, 0xff6a20, 0.42);
    fogBand(c, 500, 40, 0x2a5a42, 0.55);
  },
  mid(c, st, R) {
    // thick trunks
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 96 + R() * 40, w = 8 + R() * 16;
      const col = mix(0x050a07, 0x0e1c14, R());
      c.fillStyle = css(col); c.beginPath(); c.moveTo(x - w, 580); c.quadraticCurveTo(x - w * 0.4 + (R() - 0.5) * 30, 380, x - w * 0.6, 150); c.lineTo(x + w * 0.6, 150); c.quadraticCurveTo(x + w * 0.4 + (R() - 0.5) * 30, 380, x + w, 580); c.fill();
      c.strokeStyle = css(0xff7a30, 0.12); c.lineWidth = 2; c.beginPath(); c.moveTo(x + w * 0.5, 560); c.lineTo(x + w * 0.35, 200); c.stroke();
      for (let k = 0; k < 3; k++) { c.strokeStyle = css(0x050a07, 0.9); c.lineWidth = 2; const vx = x + (R() - 0.5) * 80; c.beginPath(); c.moveTo(vx, 120); c.quadraticCurveTo(vx + (R() - 0.5) * 40, 300, vx + (R() - 0.5) * 20, 150 + R() * 300); c.stroke(); }
    }
    // canopy
    for (let i = 0; i < 40; i++) blob(c, -100 + R() * 1480, 80 + R() * 90, 110, 50, mix(0x040a06, 0x0e2216, R()), 0.95);
    for (let i = 0; i < 18; i++) leaf(c, -50 + R() * 1380, 120 + R() * 40, 140 + R() * 80, 1.2 + R() * 0.8, 24, 0x07120c, 0x40a070);
    // burning hut
    c.fillStyle = css(0x0a0806); c.fillRect(950, 520, 100, 50);
    c.beginPath(); c.moveTo(935, 524); c.lineTo(1000, 470); c.lineTo(1065, 524); c.fill();
    blob(c, 1000, 530, 160, 90, 0xff6a20, 0.5);
    for (const x of [90, 1180]) palm(c, x, 580, 220, x < 600 ? 40 : -40, 0x060c08, R);
    for (let i = 0; i < 14; i++) bush(c, R() * 1280, 590, 120, 50, 0x060e08, R);
    // rebels with torches
    for (let i = 0; i < 6; i++) { const x = 700 + i * 26 + R() * 8; soldier(c, x, 572, 26, 0x040806, false, false); c.strokeStyle = css(0x040806); c.lineWidth = 2; c.beginPath(); c.moveTo(x + 4, 556); c.lineTo(x + 12 + (i % 2) * 4, 530); c.stroke(); if (i % 2) { c.fillStyle = css(0xffa040); c.beginPath(); c.arc(x + 14, 527, 3, 0, 6.3); c.fill(); blob(c, x + 14, 527, 26, 26, 0xff8030, 0.5); } }
    fogBand(c, 575, 36, 0x2a5040, 0.5);
  },
  near(c, st, R) {
    for (const x of [-20, 1300]) {
      const d = x < 600 ? 1 : -1;
      for (let i = 0; i < 9; i++) leaf(c, x, 620, 200 + R() * 170, (d > 0 ? -0.2 : -2.95) - (R() * 1.2) * d + 0.3, 32 + R() * 22, mix(0x030804, 0x0a1e12, R()), 0xff7a30);
    }
    for (const [x, w] of [[260, 28], [1040, 34]]) {
      c.fillStyle = css(0x040a06); c.beginPath(); c.moveTo(x - w, 620); c.quadraticCurveTo(x - w * 0.5, 450, x - w * 0.6, -20); c.lineTo(x + w * 0.6, -20); c.quadraticCurveTo(x + w * 0.5, 450, x + w, 620); c.fill();
      c.strokeStyle = css(0xff7a30, 0.16); c.lineWidth = 2; c.beginPath(); c.moveTo(x + w * 0.5, 610); c.lineTo(x + w * 0.4, 10); c.stroke();
    }
    // hanging lianas
    c.strokeStyle = css(0x040a06); c.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const x = R() * 1280; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + (R() - 0.5) * 60, 280, x + (R() - 0.5) * 40, 420 + R() * 120); c.stroke(); }
    fogBand(c, 612, 30, 0x1a3a2a, 0.4);
  },
  floor(c, st, R) {
    floorFeather(c, 0x14200f);
    vgrad(c, 610, 722, [[0, css(0x24301c)], [0.6, css(0x0e150b)], [1, css(0x040604)]]);
    for (let i = 0; i < 260; i++) { c.fillStyle = css(mix(0x0e2010, 0x4a3a18, R()), 0.55); const y = 614 + R() * 106; c.beginPath(); c.ellipse(R() * 1280, y, 3 + R() * 5, 1 + R() * 2.5, R(), 0, 6.3); c.fill(); }
    // roots
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) { let x = R() * 1280, y = 614 + R() * 30; c.strokeStyle = css(0x0a0c06, 0.85); c.lineWidth = 3 + R() * 5; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (R() - 0.4) * 130; y += 10 + R() * 22; c.quadraticCurveTo(x - 30, y - 12, x, y); } c.stroke(); }
    c.lineCap = 'butt';
    for (let i = 0; i < 8; i++) { const y = 630 + R() * 70; c.save(); c.translate(R() * 1280, y); c.scale(1, 0.18); const w = 40 + R() * 90; const g = c.createRadialGradient(0, 0, 0, 0, 0, w); g.addColorStop(0, css(0xff7a30, 0.5)); g.addColorStop(0.7, css(0x1a2418, 0.5)); g.addColorStop(1, css(0, 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, w, 0, 6.3); c.fill(); c.restore(); }
    blob(c, 1000, 640, 360, 24, 0xff6a20, 0.3); blob(c, 260, 630, 300, 16, 0xff5010, 0.25);
    persp(c, css(0, 0.2), 400, 8, 4, 1, 180);
    floorShade(c, 0.6); rimLine(c, 0xff7a30, 0.22);
  },
  fg(c, st, R) {
    for (const x of [-40, 1320]) {
      const d = x < 600 ? 1 : -1;
      for (let i = 0; i < 6; i++) leaf(c, x, 724, 160 + R() * 150, (d > 0 ? -0.5 : -2.64) - (R() - 0.5) * 0.9, 28 + R() * 20, mix(0x020502, 0x061408, R()), 0xff7a30);
    }
  },
};

/* ---------- PLAZA ---------- */
const plaza: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x05060f, 0x4a3050, 0x161232);
    stars(c, R, 160, 340, 0.9);
    blob(c, 190, 130, 240, 180, 0xb0b8ff, 0.3);
    c.fillStyle = css(0xf0ecd8); c.beginPath(); c.arc(190, 130, 30, 0, 6.3); c.fill();
    c.fillStyle = css(0xb0a898, 0.45); for (const [dx, dy, r] of [[-8, -6, 6], [8, 8, 8], [-2, 12, 4]]) { c.beginPath(); c.arc(190 + dx, 130 + dy, r, 0, 6.3); c.fill(); }
    for (let i = 0; i < 9; i++) blob(c, R() * 1400, 60 + R() * 300, 220, 16 + R() * 18, 0x2a2850, 0.3);
    blob(c, 640, 520, 700, 120, 0xff7a40, 0.28);
  },
  far(c, st, R) {
    groundFill(c, 500, 0x1a1428, 0x08060c);
    const r = makeRidge(101, 500, 80, 0.006);
    ridgePath(c, r); c.fillStyle = css(0x0e0a1c); c.fill();
    // distant town
    for (let x = -200; x < 1500; x += 28 + R() * 24) {
      const h = 18 + R() * 40, w = 24 + R() * 20, y = r.y(x) + 18;
      c.fillStyle = css(shade(0x140e22, 0.8 + R() * 0.4)); c.fillRect(x, y - h, w, h + 20);
      c.beginPath(); c.moveTo(x - 2, y - h); c.lineTo(x + w / 2, y - h - 10); c.lineTo(x + w + 2, y - h); c.fill();
      if (R() < 0.6) { c.fillStyle = css(0xffc060, 0.8); c.fillRect(x + 4 + R() * (w - 12), y - h + 8, 3, 4); }
    }
    // small distant church tower
    c.fillStyle = css(0x120c20); c.fillRect(220, 410, 20, 90); c.beginPath(); c.moveTo(216, 410); c.lineTo(230, 384); c.lineTo(244, 410); c.fill();
    fogBand(c, 505, 36, 0x3a3060, 0.4);
  },
  mid(c, st, R) {
    // colonial arcade (left)
    const arcade = (x0: number, x1: number, y: number) => {
      c.fillStyle = css(0x2c2430); c.fillRect(x0, y - 120, x1 - x0, 120);
      masonry(c, x0, y - 120, x1 - x0, 120, 0x3a303a, R, 16, 40);
      c.fillStyle = css(0x4a3a30); c.fillRect(x0 - 6, y - 128, x1 - x0 + 12, 10);
      c.fillStyle = css(0x6a3a2a); for (let x = x0 - 6; x < x1 + 6; x += 14) c.fillRect(x, y - 138, 12, 10);
      const n = Math.floor((x1 - x0) / 80);
      for (let i = 0; i < n; i++) {
        const ax = x0 + 12 + i * 80;
        c.fillStyle = css(0x06040a); c.beginPath(); c.moveTo(ax, y); c.lineTo(ax, y - 60); c.arc(ax + 26, y - 60, 26, Math.PI, 0); c.lineTo(ax + 52, y); c.fill();
        c.fillStyle = css(0xffa850, 0.12 + R() * 0.12); c.fillRect(ax + 8, y - 54, 36, 54);
        c.fillStyle = css(0x4a4048); c.fillRect(ax - 10, y - 120, 10, 120);
      }
    };
    arcade(-200, 450, 565);
    // church
    const base = 565;
    const churchX = 760, w = 340;
    c.fillStyle = css(0x4a4048); c.fillRect(churchX, base - 200, w, 200);
    masonry(c, churchX, base - 200, w, 200, 0x544a52, R, 14, 34);
    // facade pediment
    c.fillStyle = css(0x5a5058); c.beginPath(); c.moveTo(churchX + 90, base - 200); c.lineTo(churchX + w / 2, base - 262); c.lineTo(churchX + w - 90, base - 200); c.fill();
    c.fillStyle = css(0x2a2430); c.beginPath(); c.arc(churchX + w / 2, base - 222, 12, 0, 6.3); c.fill();
    c.strokeStyle = css(0xe8d8b8, 0.8); c.lineWidth = 3; c.beginPath(); c.arc(churchX + w / 2, base - 222, 12, 0, 6.3); c.stroke();
    // door
    c.fillStyle = css(0x08060a); c.beginPath(); c.moveTo(churchX + w / 2 - 34, base); c.lineTo(churchX + w / 2 - 34, base - 90); c.arc(churchX + w / 2, base - 90, 34, Math.PI, 0); c.lineTo(churchX + w / 2 + 34, base); c.fill();
    c.fillStyle = css(0xffb060, 0.5); c.beginPath(); c.moveTo(churchX + w / 2 - 28, base); c.lineTo(churchX + w / 2 - 28, base - 88); c.arc(churchX + w / 2, base - 88, 28, Math.PI, 0); c.lineTo(churchX + w / 2 + 28, base); c.fill();
    c.strokeStyle = css(0x2a2028); c.lineWidth = 3; c.beginPath(); c.moveTo(churchX + w / 2, base); c.lineTo(churchX + w / 2, base - 118); c.stroke();
    // niches + windows
    for (const nx of [churchX + 80, churchX + w - 110]) { c.fillStyle = css(0xffb060, 0.45); c.beginPath(); c.moveTo(nx, base - 100); c.lineTo(nx, base - 140); c.arc(nx + 15, base - 140, 15, Math.PI, 0); c.lineTo(nx + 30, base - 100); c.fill(); c.fillStyle = css(0x120c10); c.fillRect(nx + 11, base - 138, 8, 20); }
    // towers
    const tower = (tx: number, tw: number, th: number, bell: boolean) => {
      c.fillStyle = css(0x4e444c); c.fillRect(tx, base - th, tw, th);
      masonry(c, tx, base - th, tw, th, 0x594e56, R, 14, 30);
      c.fillStyle = css(0x645860); c.fillRect(tx - 4, base - th, tw + 8, 8); c.fillRect(tx - 4, base - th * 0.45, tw + 8, 6);
      // belfry
      const by = base - th - 78;
      c.fillStyle = css(0x4e444c); c.fillRect(tx, by, tw, 78);
      masonry(c, tx, by, tw, 78, 0x594e56, R, 14, 30);
      c.fillStyle = css(0x080508); c.beginPath(); c.moveTo(tx + tw / 2 - 20, by + 76); c.lineTo(tx + tw / 2 - 20, by + 30); c.arc(tx + tw / 2, by + 30, 20, Math.PI, 0); c.lineTo(tx + tw / 2 + 20, by + 76); c.fill();
      if (bell) { c.fillStyle = css(0xffb860, 0.25); c.fillRect(tx + tw / 2 - 18, by + 32, 36, 44); }
      c.fillStyle = css(0x645860); c.fillRect(tx - 5, by - 6, tw + 10, 8);
      // dome / spire
      c.fillStyle = css(0x3a3038); c.beginPath(); c.moveTo(tx - 4, by - 6); c.quadraticCurveTo(tx + tw / 2, by - 78, tx + tw + 4, by - 6); c.fill();
      c.fillStyle = css(0xffa860, 0.2); c.beginPath(); c.moveTo(tx + tw / 2, by - 40); c.quadraticCurveTo(tx + tw, by - 40, tx + tw + 4, by - 6); c.lineTo(tx + tw / 2, by - 6); c.fill();
      c.fillStyle = css(0x120c10); c.fillRect(tx + tw / 2 - 1.5, by - 76, 3, 22); c.fillRect(tx + tw / 2 - 8, by - 68, 16, 3);
    };
    tower(churchX - 30, 90, 250, true); tower(churchX + w - 60, 90, 250, false);
    // torch-lit gradient on facade
    c.save(); c.beginPath(); c.rect(churchX - 30, base - 340, 90, 340); c.rect(churchX + w - 60, base - 340, 90, 340); c.rect(churchX + 60, base - 262, w - 120, 262); c.clip();
    vgrad(c, base - 340, base, [[0, css(0, 0.45)], [0.7, css(0, 0.05)], [1, css(0xff8830, 0.18)]], churchX - 30, w + 60); c.restore();
    // cross on pediment
    c.fillStyle = css(0x120c10); c.fillRect(churchX + w / 2 - 2, base - 292, 4, 30); c.fillRect(churchX + w / 2 - 9, base - 284, 18, 3);
    // crowd silhouettes with torches and raised fists
    for (let i = 0; i < 38; i++) {
      const x = 60 + i * 30 + R() * 14;
      if (x > churchX - 40 && x < churchX + w + 30 && R() < 0.2) continue;
      const h = 30 + R() * 10; soldier(c, x, 580 + (i % 3) * 3, h, 0x050308, false, R() < 0.5);
      c.strokeStyle = css(0x050308); c.lineWidth = 3; c.beginPath(); c.moveTo(x + 4, 580 - h * 0.7); c.lineTo(x + 8, 580 - h * 1.2); c.stroke();
      if (R() < 0.2) { c.strokeStyle = css(0x2a1a10); c.beginPath(); c.moveTo(x - 14, 580); c.lineTo(x - 16, 540); c.stroke(); }
    }
    fogBand(c, 580, 30, 0x3a3050, 0.4);
  },
  near(c, st, R) {
    // lamp posts / torch posts
    for (const x of [230, 1060]) { c.fillStyle = css(0x0c080a); c.fillRect(x - 4, 470, 8, 150); c.fillRect(x - 12, 462, 24, 8); c.fillRect(x - 16, 612, 32, 10); }
    // pole for banner
    c.fillStyle = css(0x0c080a); c.fillRect(598, 336, 5, 290);
    // stone bench / parapets
    for (const [x, w] of [[-60, 220], [1120, 240]]) { c.fillStyle = css(0x1e1820); c.fillRect(x, 580, w, 40); masonry(c, x, 580, w, 40, 0x2c2430, R, 13, 30); vgrad(c, 580, 620, [[0, css(0xff9040, 0.18)], [1, css(0, 0.3)]], x, w); }
    fogBand(c, 612, 30, 0x302850, 0.35);
  },
  floor(c, st, R) {
    floorFeather(c, 0x2a2428);
    vgrad(c, 610, 722, [[0, css(0x4a3e3a)], [1, css(0x14100f)]]);
    for (let r = 0; r < 12; r++) {
      const t0 = Math.pow(r / 12, 1.7), t1 = Math.pow((r + 1) / 12, 1.7);
      const y0 = 612 + 108 * t0, y1 = 612 + 108 * t1;
      let x = -R() * 60 - (r % 2) * 20;
      while (x < 1400) {
        const w = (28 + R() * 20) * (1 + t0 * 1.8);
        c.fillStyle = css(mix(0x342a28, 0x5e4e44, R()), 0.9);
        c.beginPath(); c.roundRect(x + 1.5, y0 + 1, w - 3, y1 - y0 - 2, 5); c.fill();
        c.fillStyle = css(0xffc890, 0.08); c.fillRect(x + 4, y0 + 2, w - 8, 1.5);
        x += w;
      }
    }
    for (const [x, rr] of [[230, 260], [1060, 260], [600, 200], [330, 190], [1200, 190]]) blob(c, x, 650, rr, 36, 0xff9a40, 0.35);
    for (let i = 0; i < 4; i++) { c.save(); c.translate(R() * 1280, 650 + R() * 50); c.scale(1, 0.15); const w = 50 + R() * 70; const g = c.createRadialGradient(0, 0, 0, 0, 0, w); g.addColorStop(0, css(0xffa860, 0.5)); g.addColorStop(1, css(0x101030, 0.1)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, w, 0, 6.3); c.fill(); c.restore(); }
    floorShade(c, 0.6); rimLine(c, 0xffa860, 0.25);
  },
};

/* ---------- PAMPA ---------- */
function ombu(c: Ctx, x: number, y: number, s: number, R: () => number, rim: number): void {
  // gnarled swollen base
  c.fillStyle = css(0x120a08);
  c.beginPath(); c.moveTo(x - 90 * s, y);
  c.quadraticCurveTo(x - 60 * s, y - 20 * s, x - 38 * s, y - 70 * s);
  c.quadraticCurveTo(x - 50 * s, y - 130 * s, x - 30 * s, y - 170 * s);
  c.lineTo(x + 30 * s, y - 170 * s);
  c.quadraticCurveTo(x + 52 * s, y - 120 * s, x + 40 * s, y - 70 * s);
  c.quadraticCurveTo(x + 60 * s, y - 20 * s, x + 100 * s, y); c.fill();
  c.lineCap = 'round';
  for (const d of [-1, 1]) for (let i = 0; i < 3; i++) { c.strokeStyle = css(0x120a08); c.lineWidth = (12 - i * 3) * s; c.beginPath(); c.moveTo(x + d * 12 * s, y - 160 * s); c.quadraticCurveTo(x + d * (80 + i * 40) * s, y - (200 + i * 12) * s, x + d * (150 + i * 40) * s, y - (200 - i * 10) * s); c.stroke(); }
  c.lineCap = 'butt';
  for (let i = 0; i < 34; i++) { const a = R() * Math.PI, rr = 40 + R() * 190; blob(c, x + Math.cos(a) * rr * 1.3 * s * (R() < 0.5 ? 1 : -1), y - 200 * s - Math.sin(a) * 90 * s + 10 * s, 90 * s, 40 * s, mix(0x0a0806, 0x1e1608, R()), 0.97); }
  c.strokeStyle = css(rim, 0.5); c.lineWidth = 3; c.beginPath(); c.moveTo(x + 40 * s, y - 80 * s); c.quadraticCurveTo(x + 52 * s, y - 120 * s, x + 30 * s, y - 168 * s); c.stroke();
  c.fillStyle = css(rim, 0.25); for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(x + 120 * s + R() * 160 * s, y - 250 * s + R() * 40 * s, 14 * s, 3.3, 5.7); c.fill(); }
}
const pampa: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x240608, 0xe85a2a, 0x8a1c22);
    blob(c, 760, 475, 700, 280, 0xff8a30, 0.65);
    blob(c, 760, 475, 340, 160, 0xffd070, 0.75);
    for (let i = 0; i < 16; i++) { const y = 120 + R() * 330; blob(c, R() * 1500 - 100, y, 260 + R() * 220, 10 + R() * 16, 0x2a0810, 0.5); blob(c, R() * 1500 - 100, y + 12, 260 + R() * 200, 4 + R() * 6, 0xff9a50, 0.45); }
    c.fillStyle = css(0xffe090); c.beginPath(); c.arc(760, 480, 100, Math.PI, 0); c.fill();
    for (let i = 0; i < 12; i++) { const x = 300 + R() * 300, y = 150 + R() * 70; c.strokeStyle = css(0x180406, 0.85); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 7, y - 4); c.quadraticCurveTo(x - 3, y - 8, x, y); c.quadraticCurveTo(x + 3, y - 8, x + 7, y - 4); c.stroke(); }
  },
  far(c, st, R) {
    groundFill(c, 482, 0x7a3020, 0x1a0e08);
    const r1 = makeRidge(111, 485, 150, 0.0038, true);
    ridgePath(c, r1); c.fillStyle = css(0x6a2a3a); c.fill();
    c.save(); ridgePath(c, r1); c.clip(); vgrad(c, 330, 490, [[0, css(0xff7040, 0)], [1, css(0xff7040, 0.55)]]);
    c.strokeStyle = css(0x2a0a18, 0.4); c.lineWidth = 2; for (let i = 0; i < 60; i++) { const x = -300 + R() * 1900; c.beginPath(); c.moveTo(x, r1.y(x) + 4); c.lineTo(x + (R() - 0.5) * 30, r1.y(x) + 40 + R() * 70); c.stroke(); } c.restore();
    const r2 = makeRidge(112, 492, 60, 0.007);
    ridgePath(c, r2); c.fillStyle = css(0x4a1a24); c.fill();
    fogBand(c, 492, 34, 0xff7a50, 0.4);
  },
  mid(c, st, R) {
    // cattle & gauchos
    for (let i = 0; i < 9; i++) { const x = 90 + i * 34 + R() * 12, y = 560 + (i % 3) * 3; c.fillStyle = css(0x120808); c.beginPath(); c.ellipse(x, y - 12, 15, 8, 0, 0, 6.3); c.fill(); c.fillRect(x - 12, y - 8, 2.5, 10); c.fillRect(x + 8, y - 8, 2.5, 10); c.beginPath(); c.ellipse(x + 17, y - 14, 5, 3.5, 0.4, 0, 6.3); c.fill(); }
    rider(c, 480, 568, 0.7, 0x100606, true); rider(c, 540, 572, 0.65, 0x100606, true);
    // fence (alambrado)
    c.strokeStyle = css(0x1a0c08); c.lineWidth = 3; for (let x = 570; x < 1280; x += 50) { c.beginPath(); c.moveTo(x, 572); c.lineTo(x, 520); c.stroke(); }
    c.lineWidth = 1.2; for (const yy of [528, 540, 552, 564]) { c.beginPath(); c.moveTo(560, yy); c.lineTo(1290, yy); c.stroke(); }
    ombu(c, 1010, 580, 1.15, R, 0xff8a40);
    // thorn shrubs
    for (let i = 0; i < 14; i++) bush(c, R() * 1300, 582, 60, 16 + R() * 10, 0x2a1008, R);
    // tall grass silhouettes distant
    c.strokeStyle = css(0x2a1208, 0.9); c.lineWidth = 1.3; for (let i = 0; i < 320; i++) { const x = R() * 1300, h = 8 + R() * 14; c.beginPath(); c.moveTo(x, 582); c.lineTo(x + (R() - 0.5) * 8, 582 - h); c.stroke(); }
    fogBand(c, 584, 28, 0xd05a3a, 0.35);
  },
  near(c, st, R) {
    // cortaderas
    const tuft = (x: number, h: number) => {
      for (let i = 0; i < 26; i++) { c.strokeStyle = css(mix(0x1a0c06, 0x5a3a18, R()), 0.95); c.lineWidth = 2 + R() * 1.5; c.beginPath(); c.moveTo(x + (R() - 0.5) * 20, 622); c.quadraticCurveTo(x + (R() - 0.5) * 60, 622 - h * 0.6, x + (R() - 0.5) * 120, 622 - h * (0.5 + R() * 0.5)); c.stroke(); }
      for (let i = 0; i < 4; i++) { const px = x + (R() - 0.5) * 90, py = 622 - h * (1.0 + R() * 0.3); c.fillStyle = css(0xffc080, 0.55); c.beginPath(); c.ellipse(px, py, 7, 24, (R() - 0.5), 0, 6.3); c.fill(); c.strokeStyle = css(0x2a1208); c.lineWidth = 2; c.beginPath(); c.moveTo(px, py + 20); c.lineTo(px - 2, 622 - h * 0.6); c.stroke(); }
    };
    tuft(40, 140); tuft(1240, 160); tuft(150, 80);
    // cow skull
    c.fillStyle = css(0xd8c8a8); c.beginPath(); c.ellipse(1060, 606, 14, 7, 0, 0, 6.3); c.fill(); c.strokeStyle = css(0xd8c8a8); c.lineWidth = 3; c.beginPath(); c.moveTo(1048, 602); c.quadraticCurveTo(1036, 590, 1042, 582); c.moveTo(1072, 602); c.quadraticCurveTo(1084, 590, 1078, 582); c.stroke();
    c.fillStyle = css(0x1a0a06); c.beginPath(); c.arc(1055, 606, 2.4, 0, 6.3); c.arc(1065, 606, 2.4, 0, 6.3); c.fill();
  },
  floor(c, st, R) {
    floorFeather(c, 0x4a2a18);
    vgrad(c, 610, 722, [[0, css(0x6a3a22)], [0.55, css(0x3a2012)], [1, css(0x180c06)]]);
    // long shadows
    for (let i = 0; i < 6; i++) { c.save(); c.translate(200 + i * 190 + R() * 60, 640 + R() * 60); c.rotate(-0.04); c.scale(1, 0.12); const w = 100 + R() * 150; const g = c.createRadialGradient(0, 0, 0, 0, 0, w); g.addColorStop(0, css(0, 0.5)); g.addColorStop(1, css(0, 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, w, 0, 6.3); c.fill(); c.restore(); }
    crackNet(c, R, css(0x100502, 0.7), 60);
    // dry grass tufts
    for (let i = 0; i < 160; i++) { const y = 614 + Math.pow(R(), 0.9) * 104, x = R() * 1280, h = 3 + (y - 610) * 0.22 * R() + 2; c.strokeStyle = css(mix(0x6a4a20, 0xc89a50, R()), 0.7); c.lineWidth = 1 + (y - 610) / 70; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + (k - 1) * 3, y - h); c.stroke(); } }
    for (let i = 0; i < 30; i++) { c.fillStyle = css(0x2a1608, 0.7); const y = 616 + R() * 100; c.beginPath(); c.ellipse(R() * 1280, y, 3 + R() * 6, 1.5 + R() * 2, 0, 0, 6.3); c.fill(); }
    blob(c, 640, 622, 700, 24, 0xff7a40, 0.3);
    persp(c, css(0, 0.18), 400, 8, 4, 1, 170);
    floorShade(c, 0.55); rimLine(c, 0xff8a50, 0.3);
  },
  fg(c, st, R) {
    for (const x of [-60, 1340]) for (let i = 0; i < 18; i++) { c.strokeStyle = css(mix(0x180a04, 0x3a2410, R())); c.lineWidth = 3 + R() * 2; c.beginPath(); c.moveTo(x + (R() - 0.5) * 40, 724); c.quadraticCurveTo(x + (R() - 0.5) * 60, 640, x + (R() - 0.5) * 140, 560 + R() * 50); c.stroke(); }
  },
};

/* ---------- DIMENSION ---------- */
export function paintIsland(c: Ctx, w: number, h: number, variant: number, R: () => number, accent: number): void {
  const cx = w / 2, top = h * 0.55;
  // rock body (inverted)
  c.fillStyle = css(0x241a38);
  c.beginPath(); c.moveTo(cx - w * 0.46, top);
  const n = 8;
  for (let i = 0; i <= n; i++) { const t = i / n; const x = cx - w * 0.46 + w * 0.92 * t; const depth = Math.sin(t * Math.PI) * (h * 0.4) * (0.6 + R() * 0.4); c.lineTo(x, top + 4 + depth); if (i < n) c.lineTo(x + w * 0.04, top + 4 + depth * 0.5); }
  c.lineTo(cx + w * 0.46, top); c.closePath(); c.fill();
  c.fillStyle = css(accent, 0.15); c.beginPath(); c.moveTo(cx - w * 0.46, top); c.lineTo(cx + w * 0.46, top); c.lineTo(cx + w * 0.3, top + h * 0.12); c.lineTo(cx - w * 0.3, top + h * 0.12); c.fill();
  c.strokeStyle = css(accent, 0.6); c.lineWidth = 2; c.beginPath(); c.moveTo(cx - w * 0.46, top); c.lineTo(cx + w * 0.46, top); c.stroke();
  const stone = 0x5a4e6a;
  if (variant === 0) { // stepped Inca pyramid
    for (let i = 0; i < 4; i++) { masonry(c, cx - w * (0.32 - i * 0.07), top - (i + 1) * h * 0.1, w * (0.64 - i * 0.14), h * 0.1, shade(stone, 1 - i * 0.05), R, 8, 18); }
    c.fillStyle = css(0x0a0612); c.fillRect(cx - 6, top - h * 0.38, 12, h * 0.1);
  } else if (variant === 1) { // greek-like columns (broken)
    for (let i = 0; i < 5; i++) { const x = cx - w * 0.3 + i * w * 0.15; const hh = h * (0.3 + R() * 0.15) * (i === 3 ? 0.5 : 1); c.fillStyle = css(shade(0x8a7e9a, 0.8 + R() * 0.3)); c.fillRect(x, top - hh, w * 0.05, hh); c.fillRect(x - 3, top - hh - 4, w * 0.05 + 6, 5); }
    c.fillStyle = css(0x6a5e7a); c.fillRect(cx - w * 0.32, top - h * 0.5, w * 0.35, 8);
  } else if (variant === 2) { // colonial church tower + wall
    masonry(c, cx - w * 0.3, top - h * 0.28, w * 0.6, h * 0.28, 0x5a4a5a, R, 9, 22);
    masonry(c, cx - w * 0.08, top - h * 0.75, w * 0.18, h * 0.5, 0x6a5a6a, R, 9, 18);
    c.fillStyle = css(0x2a1e30); c.beginPath(); c.moveTo(cx - w * 0.1, top - h * 0.75); c.lineTo(cx + w * 0.01, top - h * 0.92); c.lineTo(cx + w * 0.12, top - h * 0.75); c.fill();
    c.fillStyle = css(0x0a0612); c.beginPath(); c.arc(cx + w * 0.01, top - h * 0.6, w * 0.035, Math.PI, 0); c.fillRect(cx - w * 0.025, top - h * 0.6, w * 0.07, h * 0.1); c.fill();
    c.fillStyle = css(0xffb860, 0.5); c.fillRect(cx - w * 0.2, top - h * 0.15, 5, 8);
  } else { // Tiwanaku gate + cannon
    c.fillStyle = css(0x66586a); c.fillRect(cx - w * 0.2, top - h * 0.5, w * 0.4, h * 0.5);
    c.clearRect(cx - w * 0.07, top - h * 0.3, w * 0.14, h * 0.3);
    c.strokeStyle = css(0x2a2032, 0.8); c.lineWidth = 1.5; c.strokeRect(cx - w * 0.17, top - h * 0.46, w * 0.34, h * 0.13);
    c.fillStyle = css(0x120c1a); c.beginPath(); c.arc(cx + w * 0.34, top - 14, 12, 0, 6.3); c.fill(); c.fillRect(cx + w * 0.22, top - 26, w * 0.16, 9);
    for (let i = 0; i < 3; i++) { const x = cx - w * 0.4 + i * 14; c.fillStyle = css(0x7a6e8a); c.beginPath(); c.moveTo(x, top); c.lineTo(x + 6, top - 20 - R() * 18); c.lineTo(x + 12, top); c.fill(); }
  }
  // glowing crystals on rim
  for (let i = 0; i < 4; i++) { const x = cx - w * 0.4 + R() * w * 0.8; c.fillStyle = css(accent, 0.85); c.beginPath(); c.moveTo(x, top); c.lineTo(x + 3, top - 10 - R() * 12); c.lineTo(x + 6, top); c.fill(); }
}
const dimension: PaintSet = {
  sky(c, st, R) {
    skyBase(c, 0x040212, 0x2a1048, 0x180a38);
    const neb: [number, number, number, number, number][] = [[260, 200, 0xc030b0, 0.35, 460], [980, 170, 0x2090c0, 0.32, 520], [640, 320, 0x6030d0, 0.4, 600], [1150, 420, 0xff6090, 0.2, 340], [120, 440, 0x30e0c0, 0.2, 380]];
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, col, a, r] of neb) { blob(c, x, y, r, r * 0.45, col, a * 0.7); for (let k = 0; k < 4; k++) blob(c, x + (R() - 0.5) * r, y + (R() - 0.5) * r * 0.4, r * 0.5, r * 0.2, col, a * 0.5); }
    c.restore();
    stars(c, R, 420, 520, 1);
    // black sun with corona
    blob(c, 640, 210, 260, 260, 0xff70d0, 0.5); blob(c, 640, 210, 130, 130, 0xffe0f8, 0.8);
    c.fillStyle = css(0x02000a); c.beginPath(); c.arc(640, 210, 70, 0, 6.3); c.fill();
    c.strokeStyle = css(0xffd0f8, 0.9); c.lineWidth = 3; c.beginPath(); c.arc(640, 210, 71, 0, 6.3); c.stroke();
    c.strokeStyle = css(0x80f0ff, 0.25); c.lineWidth = 1; for (let i = 1; i <= 4; i++) { c.beginPath(); c.ellipse(640, 210, 70 + i * 60, (70 + i * 60) * 0.16, -0.2, 0, 6.3); c.stroke(); }
  },
  far(c, st, R) {
    // far shards / floating particles of rock
    for (let i = 0; i < 26; i++) { const x = R() * 1280, y = 80 + R() * 380, s = 3 + R() * 10; c.fillStyle = css(0x3a2860, 0.55); c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s * 0.4); c.lineTo(x + s * 0.4, y + s); c.fill(); c.fillStyle = css(0x80e0ff, 0.5); c.fillRect(x, y, s * 0.3, 1); }
    // distant mountains in the void
    const r = makeRidge(121, 520, 110, 0.006, true); ridgePath(c, r); c.fillStyle = css(0x180a30, 0.9); c.fill();
    vgrad(c, 480, 540, [[0, css(0x40ffd0, 0)], [1, css(0x40ffd0, 0.15)]]);
    groundFill(c, 520, 0x120a28, 0x080414);
    fogBand(c, 520, 50, 0x6a3aa0, 0.4);
  },
  mid(c, st, R) {
    // crystal spires from the horizon
    for (let i = 0; i < 12; i++) {
      const x = 30 + i * 108 + R() * 50, h = 40 + R() * 90, w = 10 + R() * 14;
      c.fillStyle = css(0x2a1858, 0.95); c.beginPath(); c.moveTo(x - w, 575); c.lineTo(x - w * 0.3, 575 - h); c.lineTo(x + w * 0.4, 575 - h * 0.8); c.lineTo(x + w, 575); c.fill();
      c.fillStyle = css(0x40ffd0, 0.3); c.beginPath(); c.moveTo(x - w * 0.3, 575 - h); c.lineTo(x + w * 0.4, 575 - h * 0.8); c.lineTo(x + w * 0.1, 575); c.lineTo(x - w * 0.5, 575); c.fill();
    }
    fogBand(c, 580, 30, 0x40ffd0, 0.15);
  },
  near(c, st, R) {
    for (const [x, d] of [[40, 1], [1250, -1]] as [number, number][]) {
      for (let i = 0; i < 4; i++) {
        const h = 120 + R() * 180, w = 26 + R() * 24, bx = x + d * i * 40;
        c.fillStyle = css(0x1c1040); c.beginPath(); c.moveTo(bx - w, 625); c.lineTo(bx - w * 0.2 + d * 8, 625 - h); c.lineTo(bx + w * 0.5, 625 - h * 0.85); c.lineTo(bx + w, 625); c.fill();
        c.fillStyle = css(i % 2 ? 0xff40c0 : 0x40ffd0, 0.35); c.beginPath(); c.moveTo(bx - w * 0.2 + d * 8, 625 - h); c.lineTo(bx + w * 0.5, 625 - h * 0.85); c.lineTo(bx + w * 0.2, 625); c.lineTo(bx - w * 0.4, 625); c.fill();
        c.strokeStyle = css(0xc0fff0, 0.7); c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx - w * 0.2 + d * 8, 625 - h); c.lineTo(bx - w, 625); c.stroke();
      }
    }
  },
  floor(c, st, R) {
    floorFeather(c, 0x120a28);
    vgrad(c, 610, 722, [[0, css(0x241448)], [0.5, css(0x140a2c)], [1, css(0x080414)]]);
    blob(c, 640, 650, 900, 50, 0x6a30d0, 0.25);
    // rune circle in perspective
    c.save(); c.translate(640, 665); c.scale(1, 0.12);
    c.strokeStyle = css(0x40ffd0, 0.7); c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 420, 0, 6.3); c.stroke();
    c.strokeStyle = css(0xff40c0, 0.6); c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 330, 0, 6.3); c.stroke();
    c.strokeStyle = css(0x40ffd0, 0.4); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 220, 0, 6.3); c.stroke();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; c.strokeStyle = css(0xc0fff0, 0.55); c.lineWidth = 5; c.beginPath(); c.moveTo(Math.cos(a) * 340, Math.sin(a) * 340); c.lineTo(Math.cos(a) * 410, Math.sin(a) * 410); c.stroke(); }
    c.restore();
    persp(c, css(0x40ffd0, 0.22), 380, 14, 7, 1, 120);
    for (let i = 0; i < 40; i++) { c.fillStyle = css(0xffffff, 0.2 + R() * 0.5); c.fillRect(R() * 1280, 614 + R() * 106, 1.5, 1.5); }
    floorShade(c, 0.5); rimLine(c, 0x40ffd0, 0.55);
  },
};

export const PAINTERS: Record<StageKind, PaintSet> = {
  llanos, andes, tiwanaku, citadel, battlefield, jungle, plaza, pampa, dimension,
};
