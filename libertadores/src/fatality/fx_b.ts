import {
  G, FxCtx, Ph, clamp, seg, lerp, easeOut, easeIn, easeIO, hash, mix, lighten, darken,
  poly, line, path, rect, circ, ell, glow, ring, beam, column, embers, sparks, dust, lightning,
  soldier, rider, condor,
} from './lib';
import { FxLayer, GOLD, crescent, speedLines, cavalryRun } from './fx_a';

function flames(g: G, x: FxCtx, cx: number, n: number, spread: number, hmax: number, k: number, t: number) {
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) / (n / 2);
    const fx = cx + u * spread, hh = hmax * k * (1 - Math.abs(u) * 0.6) * (0.6 + hash(x.seed, i, 151) * 0.6);
    if (hh <= 2) continue;
    const wob = Math.sin(t * 50 + i * 2) * 8;
    poly(g, [fx - 22, x.groundY, fx + wob, x.groundY - hh, fx + 22, x.groundY], 0xe03000, 0.5);
    poly(g, [fx - 13, x.groundY, fx + wob * 0.7, x.groundY - hh * 0.7, fx + 13, x.groundY], 0xff9a20, 0.7);
    poly(g, [fx - 6, x.groundY, fx + wob * 0.3, x.groundY - hh * 0.4, fx + 6, x.groundY], 0xfff0a0, 0.9);
  }
}

/* --------------------------------------------------------------- wall */
const wall: FxLayer = {
  back(g, p, x) {
    const r = easeOut(seg(p.t, 0.1, 0.4)), top = easeOut(seg(p.t, 0.34, 0.55));
    const out = 1 - seg(p.t, 0.78, 0.9);
    if (r <= 0 || out <= 0) return;
    const H = 460 * r, a = 0.55 * out, stone = 0x6a6258;
    glow(g, x.loserX, x.groundY - 200, 360, x.c1, 0.15 * r * out);
    for (const s of [-1, 1]) {
      const sx = x.loserX + s * (175 - 20 * seg(p.t, 0.4, 0.6) * 0 ), w = 120;
      rect(g, sx - w / 2, x.groundY - H, w, H, stone, a);
      rect(g, sx - w / 2, x.groundY - H, 8, H, lighten(stone, 0.5), a * 0.8);
      rect(g, sx - w / 2 - 8, x.groundY - H - 10, w + 16, 16, lighten(stone, 0.2), a);
      for (let j = 0; j < H / 46; j++) {
        line(g, sx - w / 2, x.groundY - j * 46, sx + w / 2, x.groundY - j * 46, 2, 0x1a1612, a * 0.8);
        line(g, sx + ((j % 2) - 0.5) * 40, x.groundY - j * 46, sx + ((j % 2) - 0.5) * 40, x.groundY - j * 46 - 46, 2, 0x1a1612, a * 0.6);
      }
      for (let j = 0; j < 4; j++) line(g, sx - w / 2 + 6, x.groundY - H * (0.2 + j * 0.2), sx + w / 2 - 6, x.groundY - H * (0.2 + j * 0.2) - 10, 3, x.c1, a * 0.9);
    }
    if (top > 0) { // roof slab closing
      const ty = x.groundY - 470 + (1 - top) * -200;
      rect(g, x.loserX - 260, ty, 520, 38, stone, a);
      rect(g, x.loserX - 260, ty, 520, 6, lighten(stone, 0.5), a);
      for (let j = 0; j < 8; j++) line(g, x.loserX - 260 + j * 65, ty, x.loserX - 260 + j * 65, ty + 38, 2, 0x1a1612, a);
    }
  },
  front(g, p, x) {
    // stone rain
    const rk = seg(p.t, 0.4, 0.74);
    if (rk > 0) {
      for (let i = 0; i < 36; i++) {
        const u = (rk * 1.5 - hash(x.seed, i, 161) * 0.5);
        if (u <= 0 || u >= 1) continue;
        const sx = x.loserX + (hash(x.seed, i, 162) - 0.5) * 340, sy = lerp(-60, x.groundY - 20, easeIn(u));
        const s = 8 + hash(x.seed, i, 163) * 14, rot = u * 8 + i;
        const pts: number[] = [];
        for (let k = 0; k < 5; k++) { const a = rot + k * 1.256; pts.push(sx + Math.cos(a) * s * (0.7 + 0.5 * hash(x.seed, i * 5 + k, 164)), sy + Math.sin(a) * s * 0.8); }
        poly(g, pts, 0x7b7266, 0.9); poly(g, pts, 0x2a2620, 0.0);
        line(g, sx, sy - 30, sx, sy - 90, 2, 0xb0a898, 0.3);
      }
    }
    const e = seg(p.t, 0.72, 0.95);
    if (e > 0 && e < 1) {
      for (let i = 0; i < 9; i++) { // cracks
        const sd = (i % 2 ? 1 : -1), len = (120 + hash(x.seed, i, 165) * 380) * easeOut(e);
        const pts = [x.loserX, x.groundY + 4];
        for (let j = 1; j <= 7; j++) pts.push(x.loserX + sd * len * (j / 7), x.groundY + 4 + (hash(x.seed, i * 9 + j, 166) - 0.2) * 28 + j * 3);
        path(g, pts, 6, x.c1, (1 - e) * 0.35); path(g, pts, 2.5, 0xfff0c0, (1 - e) * 0.95);
      }
      ring(g, x.loserX, x.groundY, easeOut(e) * 650, 14 * (1 - e) + 2, lighten(x.c1, 0.3), (1 - e) * 0.9, 0.2);
      dust(g, x.seed + 8, e, 24, x.loserX - 360, x.loserX + 360, x.groundY + 10, 1 - e);
      sparks(g, x.seed + 7, e, 30, x.loserX, x.groundY - 40, 380, 0xffe0a0, 0.9);
    }
  },
};

/* ------------------------------------------------------------ citadel */
const citadel: FxLayer = {
  back(g, p, x) {
    const r = easeOut(seg(p.t, 0.08, 0.5)) * (1 - seg(p.t, 0.86, 1)), off = (1 - easeOut(seg(p.t, 0.08, 0.5))) * 420;
    if (r <= 0) return;
    const cx = x.w * 0.5, base = x.groundY + 4 + off, a = 0.9 * r;
    const stone = 0x6e6556;
    glow(g, cx, base - 280, 560, 0xffb050, 0.18 * r);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const wBot = 1000 - i * 160, wTop = wBot - 60, y1 = base - i * 62, y0 = y1 - 62;
      poly(g, [cx - wBot / 2, y1, cx + wBot / 2, y1, cx + wTop / 2, y0, cx - wTop / 2, y0], darken(stone, i * 0.08), a);
      rect(g, cx - wTop / 2, y0, wTop, 5, lighten(stone, 0.45), a);
      for (let j = 0; j < wTop / 56; j++) line(g, cx - wTop / 2 + j * 56 + (i % 2) * 28, y0, cx - wTop / 2 + j * 56 + (i % 2) * 28, y1, 2, 0x1e1a14, a * 0.7);
      line(g, cx - wBot / 2, y0 + 32, cx + wBot / 2, y0 + 32, 2, 0x1e1a14, a * 0.6);
      if (i % 2 === 0) for (let j = -2; j <= 2; j++) { // trapezoid doorways
        const dx = cx + j * 150 * (1 - i * 0.12);
        poly(g, [dx - 24, y1, dx + 24, y1, dx + 15, y0 + 14, dx - 15, y0 + 14], 0x0a0806, a);
        poly(g, [dx - 24, y1, dx + 24, y1, dx + 15, y0 + 14, dx - 15, y0 + 14], 0xffa040, 0);
      }
    }
    const top = base - tiers * 62;
    poly(g, [cx - 230, top, cx + 230, top, cx + 180, top - 70, cx - 180, top - 70], darken(stone, 0.2), a);
    poly(g, [cx - 28, top, cx + 28, top, cx + 18, top - 58, cx - 18, top - 58], 0x0a0806, a);
    // fire condor carrying
    const cp = seg(p.t, 0.4, 0.78);
    if (cp > 0) {
      const cy = lerp(x.groundY - 40, x.groundY - 90 - 430, easeIn(seg(p.t, 0.55, 0.78))) - 70;
      const ca = 0.75 * Math.min(1, cp * 4) * (1 - seg(p.t, 0.78, 0.9));
      glow(g, x.loserX, cy, 360, 0xff7a10, 0.28 * ca);
      condor(g, x.loserX, cy, 1.5, p.t * 2.4, 0xc83a08, ca);
      condor(g, x.loserX, cy - 4, 1.45, p.t * 2.4, 0xffb030, ca * 0.45, false);
    }
  },
  front(g, p, x) {
    const ex = seg(p.t, 0.7, 0.95);
    if (ex <= 0 || ex >= 1) return;
    const sx = x.loserX, sy = x.groundY - 90 - 430 * easeIn(seg(p.t, 0.55, 0.78));
    glow(g, sx, Math.max(sy, 80), 100 + easeOut(ex) * 480, 0xffd060, 0.7 * (1 - ex));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.283 + p.t * 2, R = easeOut(ex) * 560;
      beam(g, sx + Math.cos(a) * 40, Math.max(sy, 80) + Math.sin(a) * 40, sx + Math.cos(a) * R, Math.max(sy, 80) + Math.sin(a) * R, 3 + (i % 2) * 3, 0xffc040, (1 - ex) * 0.85);
    }
    ring(g, sx, Math.max(sy, 80), easeOut(ex) * 620, 12, 0xffffff, (1 - ex) * 0.9);
  },
};

/* ---------------------------------------------------------------- sun */
const sun: FxLayer = {
  back(g, p, x) {
    const r = easeOut(seg(p.t, 0.14, 0.55)) * (1 - seg(p.t, 0.88, 1));
    if (r <= 0) return;
    const cx = (x.winnerX + x.loserX) / 2, cy = lerp(x.groundY + 260, 270, easeOut(seg(p.t, 0.14, 0.55)));
    glow(g, cx, cy, 560 * r, x.c1, 0.3 * r);
    const R = 150;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * 6.283 + p.t * 0.9, L = 320 + (i % 2) * 120;
      poly(g, [cx + Math.cos(a - 0.05) * R, cy + Math.sin(a - 0.05) * R, cx + Math.cos(a) * (R + L * r), cy + Math.sin(a) * (R + L * r), cx + Math.cos(a + 0.05) * R, cy + Math.sin(a + 0.05) * R], i % 2 ? x.c2 : x.c1, 0.3 * r);
    }
    circ(g, cx, cy, R * 1.25, x.c1, 0.35 * r);
    circ(g, cx, cy, R, mix(x.c2, 0xffffff, 0.6), 0.95 * r);
    circ(g, cx, cy, R * 0.7, 0xffffff, 0.9 * r);
    ring(g, cx, cy, R * 1.1, 4, 0xffffff, 0.7 * r);
    ring(g, cx, cy, R * 0.55, 3, x.c1, 0.5 * r);
  },
  front(g, p, x) {
    // sword in ground
    const sw = easeIn(seg(p.t, 0.05, 0.2)) * (1 - seg(p.t, 0.9, 1));
    const sx = x.winnerX + x.facing * 70;
    if (sw > 0) {
      const top = x.groundY - 150 * (1 - 0) + (1 - sw) * -200;
      line(g, sx, top + 40, sx, x.groundY + 10, 8, 0xdfe6f0, 0.95);
      line(g, sx, top + 40, sx, x.groundY + 10, 3, 0xffffff, 0.9);
      line(g, sx - 28, top + 38, sx + 28, top + 38, 8, 0xc8a040, 0.95);
      rect(g, sx - 4, top, 8, 38, 0x5a3a1a, 0.95);
      circ(g, sx, top - 4, 7, 0xc8a040, 0.95);
      ring(g, sx, x.groundY + 8, easeOut(seg(p.t, 0.17, 0.35)) * 160, 4, x.c2, (1 - seg(p.t, 0.17, 0.35)) * 0.8, 0.2);
    }
    const w = seg(p.t, 0.35, 0.82);
    if (w > 0 && w < 1) {
      const xe = lerp(x.winnerX + x.facing * 60, x.loserX + x.facing * 40, easeIO(Math.min(1, w * 1.2)));
      const a = Math.min(1, w * 5) * (w > 0.85 ? 1 - seg(w, 0.85, 1) : 1);
      crescent(g, xe, x.groundY - 190, 240, x.facing, 60, mix(x.c1, x.c2, 0.4), a * 0.9);
      embers(g, x.seed + 2, w, 40, xe, x.groundY - 120, 180, 280, 160, x.c2, a);
    }
    if (p.c > 0) glow(g, x.loserX, x.groundY - 110, 60 + easeOut(p.c) * 380, x.c2, 0.6 * (1 - p.c));
  },
};

/* -------------------------------------------------------------- storm */
const stormFx: FxLayer = {
  back(g, p, x) {
    const k = p.env;
    rect(g, 0, 0, x.w, x.h, 0x4a0808, 0.4 * k);
    for (let i = 0; i < 9; i++) {
      const cx = ((hash(x.seed, i, 171) * (x.w + 600) + p.t * (200 + i * 40) * (i % 2 ? 1 : -1)) % (x.w + 600) + x.w + 600) % (x.w + 600) - 300;
      ell(g, cx, 60 + hash(x.seed, i, 172) * 200, 520, 130, 0x2a0505, 0.5 * k);
      ell(g, cx + 30, 70 + hash(x.seed, i, 172) * 200, 300, 70, 0x7a1010, 0.25 * k);
    }
    const flash = Math.max(0, Math.sin(p.t * 90) * Math.sin(p.t * 37)) ** 6 * k;
    rect(g, 0, 0, x.w, x.h, 0xffb0a0, 0.18 * flash);
    glow(g, x.loserX, x.groundY - 100, 380 * k, 0xff2a20, 0.2 * k);
  },
  front(g, p, x) {
    // dust cloud swallowing the winner
    const dk = bumpv(p.t, 0.08, 0.2, 0.55, 0.7);
    for (let i = 0; i < 14 && dk > 0; i++) {
      const a = hash(x.seed, i, 181) * 6.283, R = hash(x.seed, i, 182) * 100;
      circ(g, x.winnerX + Math.cos(a + p.t * 5) * R, x.groundY - 90 + Math.sin(a + p.t * 5) * R * 0.9, 55 + hash(x.seed, i, 183) * 40, 0x7a5a40, 0.4 * dk);
    }
    // gaucho riders from both sides
    const w = seg(p.t, 0.28, 0.76);
    if (w > 0 && w < 1) {
      const al = Math.sin(w * Math.PI) ** 0.5;
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
          const u = clamp(w * 1.3 - i * 0.1);
          const px = lerp(side < 0 ? -250 : x.w + 250, x.loserX + side * 20, easeIn(u) * 0.4 + u * 0.6);
          rider(g, px, x.groundY + 10 + (i % 3 - 1) * 20, 0.95 + (i % 2) * 0.15, -side, 0x180404, 0.8 * al, p.t * 9 + i * 0.5 + side, true);
          glow(g, px - side * 40, x.groundY - 90, 70, 0xff2a20, 0.2 * al, 3);
        }
      }
      speedLines(g, x.seed + 3, p.t * 3, 20, x.w, x.groundY - 260, x.groundY, 1, 0xff6a50, 0.6 * al);
      speedLines(g, x.seed + 4, p.t * 3, 20, x.w, x.groundY - 260, x.groundY, -1, 0xff6a50, 0.6 * al);
    }
    // swirl
    const sk = seg(p.t, 0.4, 0.9) * (1 - seg(p.t, 0.88, 1));
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * 6.283 * 3 + p.t * 14, R = (60 + (i % 10) * 28) * (0.4 + sk);
      circ(g, x.loserX + Math.cos(a) * R, x.groundY - 100 + Math.sin(a) * R * 0.6 - (i % 10) * 12, 5 + (i % 4) * 3, i % 3 ? 0x8a3a20 : 0xff4030, 0.4 * sk);
    }
    // lightning
    for (let k = 0; k < 4; k++) {
      const ts = 0.5 + k * 0.06, a = Math.max(0, 1 - Math.abs(p.t - ts) / 0.025);
      if (a > 0) lightning(g, x.seed + k * 7, x.loserX + (k - 1.5) * 90, 0, x.groundY - 20, 0xff5040, a, 3, 3);
    }
  },
};
function bumpv(t: number, a: number, b: number, c: number, d: number) { return Math.min(seg(t, a, b), 1 - seg(t, c, d)); }

/* --------------------------------------------------------- revolution */
const revolution: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.05, 0.4)) * (1 - seg(p.t, 0.9, 1));
    rect(g, 0, x.groundY - 260, x.w, 270, 0xff5a10, 0.1 * k);
    glow(g, x.w / 2, x.groundY - 40, 700, 0xff6a20, 0.22 * k);
    for (let row = 1; row >= 0; row--) {
      for (let i = 0; i < 9; i++) {
        for (const side of [-1, 1]) {
          const d = 190 + i * 58 + row * 24;
          const px = x.loserX + side * d;
          if (px < -40 || px > x.w + 40) continue;
          const y = x.groundY - 6 + row * 16;
          const e = easeOut(seg(p.t, 0.08 + i * 0.015, 0.35));
          const col = mix(0x2a0c08, 0xff7a30, 0.18 + row * 0.1);
          if ((i + row) % 3 === 0) rider(g, px, y + 16, 0.62, -side, col, 0.6 * k * e, p.t * 3 + i, true);
          else soldier(g, px, y, 1.15 + row * 0.2, -side, col, 0.65 * k * e, i % 4 === 1);
        }
      }
    }
  },
  front(g, p, x) {
    const w = seg(p.t, 0.28, 0.82);
    if (w <= 0 || w >= 1) return;
    const xe = lerp(-150, x.w + 150, easeIO(w));
    const a = Math.sin(w * Math.PI) ** 0.6;
    const dir = x.facing;
    const xs = dir > 0 ? xe : x.w - xe;
    for (let i = 0; i < 3; i++) crescent(g, xs - dir * i * 60, x.groundY - 190, 250, dir, 50 - i * 8, i === 0 ? 0xffd060 : 0xff6a20, a * (1 - i * 0.25));
    flames(g, x, xs - dir * 30, 14, 260, 300, a, p.t);
    embers(g, x.seed + 5, w, 80, xs - dir * 120, x.groundY - 140, 260, 360, 200, 0xff9a30, a, 3);
  },
};

/* ------------------------------------------------------------ acrobat */
const HOPS = 6;
export function acroState(t: number, x: FxCtx): { dx: number; dy: number; side: number; hopU: number; idx: number } {
  const m = seg(t, 0.15, 0.7);
  const idx = Math.min(HOPS - 1, Math.floor(m * HOPS));
  const u = m >= 1 ? 1 : m * HOPS - idx;
  const target = (i: number) => (x.loserX - x.winnerX) + (i % 2 ? 1 : -1) * (105 + (i % 3) * 22);
  const prev = idx === 0 ? 0 : target(idx - 1);
  let dx = lerp(prev, target(idx), easeOut(u));
  const dy = -Math.sin(u * Math.PI) * 130 * (m >= 1 ? 0 : 1);
  const ret = easeIO(seg(t, 0.82, 0.95));
  dx = lerp(dx, 0, ret);
  return { dx, dy, side: idx % 2 ? 1 : -1, hopU: u, idx };
}
const acrobat: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.05, 0.3)) * (1 - seg(p.t, 0.88, 1));
    const cx = x.loserX;
    poly(g, [cx - 30, 0, cx + 30, 0, cx + 280, x.groundY, cx - 280, x.groundY], 0xffffff, 0.12 * k);
    poly(g, [cx - 14, 0, cx + 14, 0, cx + 130, x.groundY, cx - 130, x.groundY], 0xffffff, 0.12 * k);
    ell(g, cx, x.groundY + 4, 520, 70, 0xffffff, 0.18 * k);
  },
  front(g, p, x) {
    const cy = x.groundY - 100;
    for (let i = 0; i < HOPS; i++) {
      const ts = 0.15 + ((i + 1) / HOPS) * 0.55 - 0.035;
      const w = seg(p.t, ts, ts + 0.035), fade = 1 - seg(p.t, ts + 0.035, ts + 0.14);
      if (w <= 0 || fade <= 0) continue;
      const s = i % 2 ? 1 : -1, ang = (i * 0.9) - 0.4;
      const ex = x.loserX + s * 190 * Math.cos(ang), ey = cy - 190 * Math.sin(ang) * 0.9;
      const sx2 = x.loserX - s * 190 * Math.cos(ang), sy2 = cy + 190 * Math.sin(ang) * 0.9;
      const hx = lerp(ex, sx2, easeOut(w)), hy = lerp(ey, sy2, easeOut(w));
      beam(g, ex, ey, hx, hy, 5, 0xffffff, fade);
      sparks(g, x.seed + i, w, 8, hx, hy, 70, 0xffffff, fade);
    }
    const e = seg(p.t, 0.72, 0.93);
    if (e > 0 && e < 1) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.283, R = easeOut(e) * 460;
        beam(g, x.loserX + Math.cos(a) * 30, cy + Math.sin(a) * 30, x.loserX + Math.cos(a) * R, cy + Math.sin(a) * R, 4, 0xffffff, (1 - e) * 0.9);
      }
      glow(g, x.loserX, cy, 60 + easeOut(e) * 300, 0xffffff, 0.8 * (1 - e));
    }
  },
};

/* -------------------------------------------------------------- lasso */
export function lassoDrag(t: number, x: FxCtx): number {
  const d = Math.min(Math.abs(x.loserX - x.winnerX) * 0.55, 260);
  return -x.facing * easeIO(seg(t, 0.32, 0.58)) * d * (1 - easeOut(seg(t, 0.82, 0.95)) * 0);
}
const lasso: FxLayer = {
  back(g, p, x) {
    cavalryRunBack(g, p, x);
  },
  front(g, p, x) {
    const throwK = easeOut(seg(p.t, 0.14, 0.32));
    const hx = x.winnerX + x.facing * 34, hy = x.groundY - 120;
    const lx = x.loserX + lassoDrag(p.t, x), ly = x.groundY - 110;
    const rel = 1 - seg(p.t, 0.58, 0.66);
    if (rel > 0 && throwK > 0) {
      const ex = lerp(hx, lx, throwK), ey = lerp(hy, ly, throwK);
      const pts: number[] = [];
      const sag = (1 - seg(p.t, 0.32, 0.5)) * 50 + 14;
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        pts.push(lerp(hx, ex, u), lerp(hy, ey, u) + Math.sin(u * Math.PI) * sag + Math.sin(u * 10 - p.t * 30) * 3 * (1 - throwK));
      }
      path(g, pts, 8, 0xd9b070, 0.2 * rel);
      path(g, pts, 3.5, 0xc89a50, 0.95 * rel);
      path(g, pts, 1.4, 0xf4dca0, rel);
      const lr = lerp(46, 28, seg(p.t, 0.25, 0.4));
      g.lineStyle(5, 0xd9b070, 0.9 * rel); g.strokeEllipse(ex, ey, lr * 2.2, lr * 1.6 + Math.sin(p.t * 20) * 4);
      g.lineStyle(2, 0xffffff, 0.6 * rel); g.strokeEllipse(ex, ey, lr * 2.2, lr * 1.6 + Math.sin(p.t * 20) * 4);
    }
    cavalryRun(g, p, { ...x, facing: x.facing } as FxCtx, 0.52, 0.78, 0xffd9a0, 3);
  },
};
function cavalryRunBack(g: G, p: Ph, x: FxCtx) {
  const w = seg(p.t, 0.52, 0.8);
  glow(g, x.w / 2, x.groundY - 150, 500 * Math.sin(w * Math.PI), 0xffc060, 0.15);
}

/* -------------------------------------------------------------- eagle */
const eagle: FxLayer = {
  back(g, p, x) {
    const s = seg(p.t, 0.1, 0.62);
    const d = easeIn(seg(p.t, 0.55, 0.74));
    const px = lerp(x.loserX - x.facing * 700, x.loserX, easeOut(s));
    const py = lerp(-200, 170, easeOut(s)) + d * 180;
    const sc = lerp(1.0, 2.0, easeOut(s)) * (1 + d * 0.3);
    const a = 0.55 * Math.min(1, s * 4) * (1 - seg(p.t, 0.78, 0.86));
    if (s <= 0) return;
    glow(g, px, py, 440, x.c1, 0.25 * a * 2);
    condor(g, px, py, sc, p.t * 3, mix(x.c1, 0xe8e8e8, 0.55), a);
    condor(g, px, py, sc, p.t * 3, 0x1a2540, a * 0.35, false);
    poly(g, [px - 6 * sc, py - 52 * sc, px + 6 * sc, py - 52 * sc, px, py - 34 * sc], 0xffcc30, a);
  },
  front(g, p, x) {
    const d = seg(p.t, 0.52, 0.74);
    if (d > 0 && d < 1) {
      for (let i = 0; i < 14; i++) {
        const sx = x.loserX + (i - 6.5) * 34, len = 200 + hash(x.seed, i, 191) * 260;
        const yy = lerp(-100, x.groundY - 40, easeIn(d));
        line(g, sx, yy - len, sx, yy, 3, mix(x.c1, 0xffffff, 0.5), 0.6 * (1 - d * 0.3));
      }
    }
    const e = seg(p.t, 0.72, 0.94);
    if (e > 0 && e < 1) {
      glow(g, x.loserX, x.groundY - 100, 80 + easeOut(e) * 340, x.c1, 0.6 * (1 - e));
      ring(g, x.loserX, x.groundY, easeOut(e) * 600, 10, mix(x.c2, 0xffffff, 0.5), (1 - e), 0.25);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i / 13) * Math.PI, R = easeOut(e) * 420;
        beam(g, x.loserX, x.groundY - 60, x.loserX + Math.cos(a) * R, x.groundY - 60 + Math.sin(a) * R, 3, x.c2, (1 - e) * 0.9);
      }
      sparks(g, x.seed + 8, e, 40, x.loserX, x.groundY - 80, 440, 0xffffff, 0.9);
    }
  },
};

/* --------------------------------------------------------------- oath */
function oathSoldiers(g: G, p: Ph, x: FxCtx, front: boolean) {
  const k = easeOut(seg(p.t, 0.12, 0.4)) * (1 - seg(p.t, 0.86, 1));
  if (k <= 0) return;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.283 + p.t * 1.6, z = Math.sin(a);
    if ((z >= 0) !== front) continue;
    const R = 230 * (0.4 + 0.6 * k);
    const sx = x.loserX + Math.cos(a) * R, sy = x.groundY + z * 34;
    const s = 0.9 + z * 0.15;
    const sw = easeOut(seg(p.t, 0.25 + i * 0.01, 0.4));
    soldier(g, sx, sy, s * 1.3, Math.cos(a) > 0 ? -1 : 1, mix(GOLD, 0x7a5a20, 0.3), 0.6 * k);
    line(g, sx + 4 * s, sy - 60 * s, sx + 4 * s, sy - (60 + 90 * sw) * s, 3, 0xfff0b0, 0.9 * k * sw);
    glow(g, sx + 4 * s, sy - (60 + 90 * sw) * s, 14, GOLD, 0.5 * k * sw, 3);
    const asc = seg(p.t, 0.58, 0.82);
    if (asc > 0) beam(g, sx + 4 * s, sy - 150 * s, sx + 4 * s, sy - 150 * s - easeOut(asc) * 700, 3, GOLD, (1 - seg(p.t, 0.8, 0.9)) * 0.9);
  }
}
const oath: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.1, 0.35)) * (1 - seg(p.t, 0.88, 1));
    column(g, x.loserX, 0, x.groundY, 120 + 80 * Math.sin(p.t * 8) * 0.2, GOLD, 0.7 * k);
    ell(g, x.loserX, x.groundY + 4, 420 * k, 60, GOLD, 0.25 * k);
    oathSoldiers(g, p, x, false);
  },
  front(g, p, x) {
    oathSoldiers(g, p, x, true);
    const k = easeOut(seg(p.t, 0.3, 0.7)) * (1 - seg(p.t, 0.85, 0.95));
    ring(g, x.loserX, x.groundY + 4, 230 * k, 6, 0xffe9a0, 0.8 * k, 0.15);
    embers(g, x.seed + 11, seg(p.t, 0.3, 0.9), 50, x.loserX, x.groundY - 100, 260, 100, 500, GOLD, 1);
  },
};

/* ---------------------------------------------------------- lightning */
const lightningFx: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0, 0.2)) * (1 - seg(p.t, 0.9, 1));
    rect(g, 0, 0, x.w, x.h * 0.7, 0x0a0a22, 0.45 * k);
    for (let i = 0; i < 7; i++) {
      const cx = ((hash(x.seed, i, 201) * (x.w + 500) + p.t * 90 * (i % 2 ? 1 : -1)) % (x.w + 500) + x.w + 500) % (x.w + 500) - 250;
      ell(g, cx, 50 + hash(x.seed, i, 202) * 120, 520, 120, 0x15152e, 0.6 * k);
      ell(g, cx, 60 + hash(x.seed, i, 202) * 120, 300, 60, 0x303060, 0.3 * k);
    }
    for (let s = 0; s < 8; s++) {
      const ts = strikeT(s), a = Math.max(0, 1 - Math.abs(p.t - ts) / 0.035);
      rect(g, 0, 0, x.w, x.h, 0xbfd0ff, 0.2 * a);
    }
  },
  front(g, p, x) {
    for (let s = 0; s < 8; s++) {
      const ts = strikeT(s), a = Math.max(0, 1 - Math.abs(p.t - ts) / 0.035);
      if (a <= 0) continue;
      const big = s === 7;
      const bx = big ? x.loserX : x.loserX + (hash(x.seed, s, 203) - 0.5) * 560;
      lightning(g, x.seed + s * 13 + Math.floor(p.t * 60), bx, 0, x.groundY, 0x9fc0ff, a, big ? 5 : 3, big ? 6 : 3.5);
      glow(g, bx, x.groundY, big ? 200 : 80, 0xcfe0ff, 0.5 * a);
    }
    const f = seg(p.t, 0.76, 1);
    if (f > 0) { // electric afterglow arcs
      for (let i = 0; i < 8; i++) {
        const a0 = hash(x.seed, i, 204) * 6.283 + p.t * 5;
        const pts: number[] = [];
        for (let k = 0; k <= 6; k++) { const R = 30 + k * 18; pts.push(x.loserX + Math.cos(a0 + k * 0.2) * R + (hash(x.seed + Math.floor(p.t * 30), i * 7 + k, 205) - 0.5) * 20, x.groundY - 100 + Math.sin(a0 + k * 0.2) * R * 1.0 + (hash(x.seed + Math.floor(p.t * 30), i * 7 + k, 206) - 0.5) * 20); }
        path(g, pts, 2, 0xcfe0ff, (1 - f) * 0.8);
      }
    }
  },
};
function strikeT(s: number) { return s === 7 ? 0.73 : 0.2 + s * 0.07; }

/* --------------------------------------------------------------- tide */
const tide: FxLayer = {
  back(g, p, x) {
    const w = seg(p.t, 0.12, 0.92);
    if (w <= 0) return;
    const dir = x.facing, xe = x.winnerX - dir * 520 + dir * easeIO(w) * (Math.abs(x.loserX - x.winnerX) + 520 + x.w * 0.55);
    const a = 0.55 * (1 - seg(p.t, 0.88, 1));
    const H = 330 * Math.min(1, w * 4);
    const pts: number[] = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(xe - dir * 1200 * (1 - u), x.groundY + 20 - H * (0.1 + 0.9 * Math.pow(u, 2.2)) + Math.sin(u * 14 - p.t * 14) * 8 * u); }
    pts.push(xe + dir * 36, x.groundY - H + 70, xe + dir * 14, x.groundY - H * 0.4);
    poly(g, [...pts, xe, x.groundY + 40, xe - dir * 1200, x.groundY + 40], mix(x.c1, 0x0a2040, 0.4), a);
    poly(g, [...pts.map((v, i) => (i % 2 ? v + 30 : v)), xe, x.groundY + 40, xe - dir * 1200, x.groundY + 40], x.c2, a * 0.25);
  },
  front(g, p, x) {
    const w = seg(p.t, 0.12, 0.92);
    if (w <= 0) return;
    const dir = x.facing, xe = x.winnerX - dir * 520 + dir * easeIO(w) * (Math.abs(x.loserX - x.winnerX) + 520 + x.w * 0.55);
    const a = 0.8 * (1 - seg(p.t, 0.88, 1)) * Math.min(1, w * 6);
    const H = 330 * Math.min(1, w * 4);
    const top = x.groundY - H;
    // crest curl
    const cr: number[] = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, ang = u * 3.6 - 0.4; cr.push(xe - dir * 20 + dir * Math.cos(ang) * 110 * (1 - u * 0.2) - dir * 60, top + 40 - Math.sin(ang) * 80 + u * 20); }
    path(g, cr, 22, x.c1, a * 0.4);
    path(g, cr, 12, lighten(x.c1, 0.4), a * 0.8);
    path(g, cr, 4, 0xffffff, a);
    line(g, xe, top + 60, xe, x.groundY + 10, 40, lighten(x.c1, 0.2), a * 0.3);
    // warriors riding the crest
    for (let i = 0; i < 5; i++) {
      const cx = xe - dir * (50 + i * 80), cy = top + 40 + i * 24 - Math.sin(p.t * 12 + i) * 6;
      rider(g, cx, cy + 60, 0.6, dir, 0x0a1a30, a * 0.85, p.t * 8 + i, true);
      glow(g, cx, cy - 10, 50, x.c2, 0.25 * a, 3);
    }
    for (let i = 0; i < 40; i++) { // spray
      const u = (w * 5 + hash(x.seed, i, 211)) % 1;
      circ(g, xe - dir * (hash(x.seed, i, 212) * 200) + dir * u * 30, top + 40 + hash(x.seed, i, 213) * 140 - u * 80, 2 + hash(x.seed, i, 214) * 4, 0xe8fbff, a * (1 - u) * 0.8);
    }
    if (p.c > 0 && p.c < 1) glow(g, x.loserX, x.groundY - 90, 80 + easeOut(p.c) * 360, x.c2, 0.6 * (1 - p.c));
  },
};

/* -------------------------------------------------------------- volley */
const volley: FxLayer = {
  back(g, p, x) {
    const k = easeOut(seg(p.t, 0.06, 0.3)) * (1 - seg(p.t, 0.9, 1));
    glow(g, x.winnerX - x.facing * 200, x.groundY - 100, 380 * k, GOLD, 0.15 * k);
    for (let row = 1; row >= 0; row--) {
      for (let i = 0; i < 9; i++) {
        const px = x.winnerX - x.facing * (160 + i * 64 + row * 30);
        if (px < -40 || px > x.w + 40) continue;
        const y = x.groundY - 6 + row * 18 - (row ? 0 : 8) - (hash(x.seed, i, 221) - 0.5) * 6;
        soldier(g, px, y, 1.25 + row * 0.2, x.facing, mix(0x3a2a10, GOLD, 0.35 - row * 0.1), 0.6 * k, i % 4 === 2 && row === 0);
      }
    }
  },
  front(g, p, x) {
    const N = 48, ty = x.groundY - 100;
    for (let i = 0; i < N; i++) {
      const row = i % 2, col = Math.floor(i / 2) % 9;
      const mx = x.winnerX - x.facing * (160 + col * 64 + row * 30) + x.facing * 28;
      const my = x.groundY - 6 + row * 18 - 74;
      const ts = 0.3 + (i / N) * 0.38;
      const u = (p.t - ts) / 0.07;
      if (u < -0.15 || u > 1.2) continue;
      if (u < 0.15) glow(g, mx, my, 26 * (1 - Math.abs(u) / 0.2), 0xfff0b0, 0.9, 3); // muzzle flash
      if (u < 0 || u > 1) continue;
      const hx = lerp(mx, x.loserX + (hash(x.seed, i, 222) - 0.5) * 40, easeIn(u) * 0.3 + u * 0.7);
      const hy = lerp(my, ty + (hash(x.seed, i, 223) - 0.5) * 120, easeIn(u) * 0.3 + u * 0.7);
      const tu = Math.max(0, u - 0.2);
      const tx = lerp(mx, x.loserX, tu * 0.7 + easeIn(tu) * 0.3), tyy = lerp(my, ty, tu * 0.7 + easeIn(tu) * 0.3);
      beam(g, tx, tyy, hx, hy, 3, 0xffe080, 1);
    }
    const e = seg(p.t, 0.7, 0.93);
    if (e > 0 && e < 1) {
      glow(g, x.loserX, ty, 80 + easeOut(e) * 380, 0xfff0b0, 0.8 * (1 - e));
      ring(g, x.loserX, ty, easeOut(e) * 520, 12 * (1 - e) + 2, 0xffffff, (1 - e));
      sparks(g, x.seed + 14, e, 50, x.loserX, ty, 480, 0xffe080, 1);
    }
  },
};

export const LAYERS_B: Record<string, FxLayer> = {
  wall, citadel, sun, storm: stormFx, revolution, acrobat, lasso, eagle, oath, lightning: lightningFx, tide, volley,
};
export { easeIn, column, beam };
