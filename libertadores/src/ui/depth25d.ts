import Phaser from 'phaser';
import { ARENA, GAME_H, GAME_W } from '../combat/types';
import type { FighterView, StageKind } from '../combat/types';
import { FIRES, mix, rng, css } from './stageArt';
import type { LayerName } from './stageArt';
import type { StageRenderer } from './stageRenderer';
import type { FighterVisual } from './fighterVisual';

/* ----------------------------------------------------------------------------------------------
 * "2.5D" visual package: light pools, fighter lighting, out-of-focus foreground + bokeh embers and
 * a light film grade. Everything here is plain Graphics / canvas textures, so it behaves the same in
 * Canvas and WebGL (WebGL additionally blurs the animated bits of the distant stage layers).
 * ---------------------------------------------------------------------------------------------- */

/** Gaussian-ish blur of a canvas (ctx.filter when available, down/up-scale otherwise). Edges are extended so they do not fade. */
export function blurCanvas(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const w = src.width, h = src.height, m = Math.ceil(px * 3);
  const mk = (cw: number, ch: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, cw); c.height = Math.max(1, ch); return c; };
  const tmp = mk(w + 2 * m, h + 2 * m), tc = tmp.getContext('2d');
  const out = mk(w, h), oc = out.getContext('2d');
  if (!tc || !oc) return src;
  tc.drawImage(src, m, m);
  tc.drawImage(src, 0, 0, 1, h, 0, m, m, h); tc.drawImage(src, w - 1, 0, 1, h, w + m, m, m, h);
  tc.drawImage(tmp, 0, m, w + 2 * m, 1, 0, 0, w + 2 * m, m); tc.drawImage(tmp, 0, h + m - 1, w + 2 * m, 1, 0, h + m, w + 2 * m, m);
  if (typeof (oc as { filter?: string }).filter === 'string') {
    oc.filter = `blur(${px}px)`; oc.drawImage(tmp, -m, -m); oc.filter = 'none';
  } else {
    const f = Math.max(2, Math.round(px * 1.1)), sw = Math.ceil((w + 2 * m) / f), sh = Math.ceil((h + 2 * m) / f);
    const sm = mk(sw, sh), sc = sm.getContext('2d');
    if (!sc) return src;
    sc.imageSmoothingQuality = 'high'; sc.drawImage(tmp, 0, 0, sw, sh);
    oc.imageSmoothingQuality = 'high'; oc.drawImage(sm, 0, 0, sw, sh, -m, -m, sw * f, sh * f);
  }
  return out;
}

interface LightSpec { layer: LayerName; x: number; y: number; s: number; color: number; floor: number }
interface Light { spec: LightSpec; sx: number; sy: number; seed: number; k: number; on: boolean }

/** Extra light sources for stages whose fires do not already give a good key light. */
const EXTRA_LIGHTS: Partial<Record<StageKind, LightSpec[]>> = {
  llanos: [{ layer: 'far', x: 900, y: 400, s: 2.4, color: 0xff9650, floor: 0.7 }, { layer: 'far', x: 260, y: 400, s: 1.6, color: 0xff8060, floor: 0.5 }],
  andes: [{ layer: 'far', x: 420, y: 230, s: 2.4, color: 0xcfe4ff, floor: 0.7 }, { layer: 'far', x: 1000, y: 260, s: 1.6, color: 0xb8d4ff, floor: 0.5 }],
  tiwanaku: [{ layer: 'mid', x: 640, y: 380, s: 2.4, color: 0xffd890, floor: 0.7 }],
  pampa: [{ layer: 'far', x: 760, y: 420, s: 2.6, color: 0xffa860, floor: 0.7 }, { layer: 'far', x: 200, y: 420, s: 1.6, color: 0xff9060, floor: 0.5 }],
  dimension: [{ layer: 'mid', x: 190, y: 400, s: 2.2, color: 0x40ffd0, floor: 0.7 }, { layer: 'far', x: 1100, y: 330, s: 2.2, color: 0xff9040, floor: 0.7 }],
  citadel: [{ layer: 'far', x: 800, y: 80, s: 1.8, color: 0xd0f0e0, floor: 0.5 }],
  jungle: [{ layer: 'far', x: 360, y: 20, s: 1.6, color: 0x90e0c8, floor: 0.5 }],
  battlefield: [{ layer: 'far', x: 940, y: 300, s: 1.8, color: 0xffa060, floor: 0.5 }],
};
const FLOOR_W: Record<string, number> = { near: 1, mid: 0.8, far: 0.6, sky: 0.4 };
const MAX_LIGHTS = 6;
const BOKEH_N = 14;
const FG_K = 1.7; // foreground parallax factor relative to the world (p = 1)
const FG_PAD = 320, FG_H = 270;

/** Out-of-focus dark foreground shapes for the bottom corners, by stage kind. */
function paintForeground(ctx: CanvasRenderingContext2D, kind: StageKind, col: number, top: number, R: () => number): void {
  const W = GAME_W + FG_PAD * 2;
  const grad = ctx.createLinearGradient(0, 0, 0, FG_H);
  grad.addColorStop(0, css(top, 0.95)); grad.addColorStop(1, css(col, 1));
  ctx.fillStyle = grad;
  const clusters = [{ x0: FG_PAD + 40, x1: FG_PAD + 520, dir: 1 }, { x0: FG_PAD + GAME_W - 520, x1: FG_PAD + GAME_W - 40, dir: -1 }];
  const taper = (cl: { x0: number; x1: number; dir: number }, x: number) => { // tall near the outer edge, low toward the centre
    const u = cl.dir === 1 ? (x - cl.x0) / (cl.x1 - cl.x0) : (cl.x1 - x) / (cl.x1 - cl.x0);
    return 0.22 + 0.78 * Math.exp(-(((u - 0.22) / 0.4) ** 2));
  };
  for (const cl of clusters) {
    switch (kind) {
      case 'llanos': case 'pampa': case 'jungle': {
        const n = 46, big = kind === 'jungle';
        for (let i = 0; i < n; i++) {
          const x = cl.x0 + R() * (cl.x1 - cl.x0), h = (60 + R() * 150) * taper(cl, x), w = (big ? 16 : 7) + R() * 8, lean = (R() - 0.5) * 60 + cl.dir * -12;
          ctx.beginPath(); ctx.moveTo(x - w, FG_H + 4); ctx.quadraticCurveTo(x - w * 0.3 + lean * 0.3, FG_H - h * 0.55, x + lean, FG_H - h);
          ctx.quadraticCurveTo(x + w * 0.3 + lean * 0.3, FG_H - h * 0.5, x + w, FG_H + 4); ctx.closePath(); ctx.fill();
        }
        if (big) for (let i = 0; i < 4; i++) {
          const x = cl.x0 + R() * (cl.x1 - cl.x0), h = (90 + R() * 80) * taper(cl, x);
          ctx.save(); ctx.translate(x, FG_H); ctx.rotate((R() - 0.5) * 1.1 + (cl.dir === 1 ? 0.3 : -0.3));
          ctx.beginPath(); ctx.ellipse(0, -h * 0.5, 22 + R() * 14, h * 0.5, 0, 0, 6.3); ctx.fill(); ctx.restore();
        }
        break;
      }
      case 'plaza': {
        const o = cl.dir === 1 ? cl.x0 : cl.x1, d = cl.dir; // o: outer edge, d: direction toward the screen centre
        if (d === 1) { // heavy post + sandbags
          ctx.fillRect(o + 90, FG_H - 262, 46, 280);
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(o + 110 + i * 78, FG_H - 28 - (i % 2) * 26, 54, 34, 0, 0, 6.3); ctx.fill(); }
        } else { // barrels and a crate
          for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(o - 90 - i * 120, FG_H - 70 + i * 24, 52, 100 - i * 30, 0, 0, 6.3); ctx.fill(); }
          ctx.fillRect(o - 400, FG_H - 70, 150, 90);
        }
        break;
      }
      case 'dimension': {
        const n = 7;
        for (let i = 0; i < n; i++) {
          const x = cl.x0 + R() * (cl.x1 - cl.x0), h = (70 + R() * 150) * taper(cl, x), w = 20 + R() * 26, lean = (R() - 0.5) * 40;
          ctx.beginPath(); ctx.moveTo(x - w, FG_H + 4); ctx.lineTo(x - w * 0.3 + lean, FG_H - h * 0.8); ctx.lineTo(x + lean * 1.4, FG_H - h); ctx.lineTo(x + w * 0.5 + lean, FG_H - h * 0.7); ctx.lineTo(x + w, FG_H + 4); ctx.closePath(); ctx.fill();
        }
        break;
      }
      default: { // rocks / boulders (andes, tiwanaku, citadel, battlefield)
        const n = 6;
        for (let i = 0; i < n; i++) {
          const x = cl.x0 + R() * (cl.x1 - cl.x0), h = (50 + R() * 130) * taper(cl, x), w = 50 + R() * 90;
          ctx.beginPath(); ctx.moveTo(x - w, FG_H + 6);
          const pts = 7;
          for (let k = 0; k <= pts; k++) { const a = Math.PI + (k / pts) * Math.PI, rr = 0.8 + R() * 0.3; ctx.lineTo(x + Math.cos(a) * w * rr, FG_H + Math.sin(a) * h * rr); }
          ctx.lineTo(x + w, FG_H + 6); ctx.closePath(); ctx.fill();
        }
      }
    }
  }
  void W;
}

export class Depth25D {
  private scene: Phaser.Scene;
  private stage: StageRenderer;
  private world: Phaser.GameObjects.Container;
  private floorG: Phaser.GameObjects.Graphics; // light pools on the ground (under fighters)
  private washG: Phaser.GameObjects.Graphics;  // warm light wash on fighters (over them)
  private bokehG: Phaser.GameObjects.Graphics;
  private fg: Phaser.GameObjects.Image;
  private grade: Phaser.GameObjects.Rectangle;
  private vig: Phaser.GameObjects.Image;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private texKeys: string[] = [];
  private lights: Light[] = [];
  private bokeh: { x: number; y: number; r: number; vx: number; vy: number; ph: number; a: number; c: number }[] = [];
  private camX = GAME_W / 2; private zoom = 1;
  private tmp = { x: 0, y: 0 };
  private dead = false;
  private static UID = 0;

  constructor(scene: Phaser.Scene, stage: StageRenderer, world: Phaser.GameObjects.Container) {
    this.scene = scene; this.stage = stage; world.setDepth(world.depth); this.world = world;
    const def = stage.stage, uid = ++Depth25D.UID;
    const R = rng(0x5eed + uid * 31 + def.id.length);

    // lights: painted fires (positions from stageArt) + per-kind extras
    const specs: LightSpec[] = [];
    for (const f of FIRES[def.kind] ?? []) specs.push({ layer: f.layer, x: f.x, y: f.y - 14 * f.s, s: 0.5 + f.s * 0.8, color: f.glow, floor: FLOOR_W[f.layer] ?? 0.6 });
    for (const e of EXTRA_LIGHTS[def.kind] ?? []) specs.push(e);
    for (const sp of specs) this.lights.push({ spec: sp, sx: 0, sy: 0, seed: R() * 50, k: 0, on: false });

    // dark, blurred foreground silhouettes (baked once)
    const cv = document.createElement('canvas'); cv.width = GAME_W + FG_PAD * 2; cv.height = FG_H;
    const c = cv.getContext('2d');
    if (c) paintForeground(c, def.kind, mix(def.ground, 0x04060a, 0.9), mix(def.fog, 0x06080e, 0.8), R);
    const key = `fx25_fg_${uid}`;
    scene.textures.addCanvas(key, c ? blurCanvas(cv, 7) : cv); this.texKeys.push(key);
    this.fg = scene.add.image(GAME_W / 2, GAME_H + 6, key).setOrigin(0.5, 1).setScrollFactor(0).setDepth(52);

    const vk = 'fx25_vig';
    if (!scene.textures.exists(vk)) {
      const v = document.createElement('canvas'); v.width = 256; v.height = 144;
      const vc = v.getContext('2d');
      if (vc) {
        const g = vc.createRadialGradient(128, 72, 40, 128, 72, 150);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
        vc.fillStyle = g; vc.fillRect(0, 0, 256, 144);
      }
      scene.textures.addCanvas(vk, v);
    }
    this.vig = scene.add.image(GAME_W / 2, GAME_H / 2, vk).setDisplaySize(GAME_W, GAME_H).setScrollFactor(0).setDepth(51.5);
    // film grade: a faint cool-navy veil gives the shadows a blue cast and the warm lights pop against it
    this.grade = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a1230, 0.13).setScrollFactor(0).setDepth(51);

    this.floorG = scene.add.graphics().setScrollFactor(0).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.washG = scene.add.graphics().setScrollFactor(0).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
    this.bokehG = scene.add.graphics().setScrollFactor(0).setDepth(52.5).setBlendMode(Phaser.BlendModes.ADD);
    this.objs.push(this.fg, this.vig, this.grade, this.floorG, this.washG, this.bokehG);

    const tints = [def.accent, ...specs.map((s) => s.color)];
    for (let i = 0; i < BOKEH_N; i++) {
      this.bokeh.push({
        x: -300 + R() * (GAME_W + 600), y: 330 + R() * 430, r: 7 + R() * R() * 30, vx: (R() - 0.5) * 6, vy: -(4 + R() * 12),
        ph: R() * 6.3, a: 0.05 + R() * 0.09, c: tints[Math.floor(R() * tints.length)],
      });
    }
  }

  setCamera(camX: number, zoom: number): void { this.camX = camX; this.zoom = Math.max(1, zoom); }

  /** Per-frame update. Positions lights in screen space, lights the fighters and animates the foreground. */
  update(t: number, dtMs: number, fighters: readonly FighterView[], vis: readonly FighterVisual[]): void {
    if (this.dead) return;
    const z = this.zoom, wx = this.world.x, wy = this.world.y;
    const floorY = wy + (ARENA.ground + 6) * z;
    const dt = Math.min(0.1, dtMs / 1000);
    // --- lights
    const fl = this.floorG; fl.clear();
    let drawn = 0;
    for (const L of this.lights) {
      L.on = false;
      if (!this.stage.layerPoint(L.spec.layer, L.spec.x, L.spec.y, this.tmp)) continue;
      L.sx = this.tmp.x; L.sy = this.tmp.y;
      if (L.sx < -280 || L.sx > GAME_W + 280) continue;
      L.k = 1 + 0.1 * Math.sin(t * 0.021 + L.seed) + 0.07 * Math.sin(t * 0.047 + L.seed * 2.3) + 0.05 * Math.sin(t * 0.113 + L.seed * 5.1);
      L.on = true;
      if (drawn++ >= MAX_LIGHTS) { L.on = false; continue; }
      const R = (110 + 120 * L.spec.s) * z, I = L.spec.floor * L.k;
      // pool on the floor: stacked ellipses, brightest at the centre
      for (let i = 0; i < 12; i++) {
        const q = 1 - i / 12;
        fl.fillStyle(L.spec.color, 0.03 * I * (0.5 + 0.5 * q * q));
        fl.fillEllipse(L.sx, floorY + 18 * z, R * 2.1 * q + 40, R * 0.42 * q + 10);
      }
      // soft air glow around the source
      for (let i = 0; i < 14; i++) {
        const q = 1 - i / 14;
        fl.fillStyle(L.spec.color, 0.0085 * L.k * (0.4 + 0.6 * q * q) * Math.min(1.4, 0.6 + L.spec.s * 0.3));
        fl.fillCircle(L.sx, L.sy, R * 0.55 * q + 14);
      }
    }
    // --- fighters: pick the dominant light, hand it to the visual, add a faint warm wash
    const wsh = this.washG; wsh.clear();
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      const fsx = wx + f.x * z;
      let best: Light | null = null, bw = 0;
      for (const L of this.lights) {
        if (!L.on) continue;
        const w = L.spec.s * (L.spec.floor + 0.3) * L.k / (1 + Math.abs(L.sx - fsx) / 420);
        if (w > bw) { bw = w; best = L; }
      }
      if (!best) { vis[i].setLight(0, 0, 0); continue; }
      const str = Math.min(1, bw / 1.5);
      vis[i].setLight((best.sx - wx) / z, str, mix(best.spec.color, 0xffffff, 0.25));
      const cy = wy + (f.y - 95) * z, side = best.sx >= fsx ? 1 : -1;
      for (let k = 0; k < 3; k++) {
        wsh.fillStyle(best.spec.color, 0.018 * str * best.k);
        wsh.fillEllipse(fsx + side * 14 * z, cy, (150 - k * 36) * z, (250 - k * 54) * z);
      }
    }
    // --- foreground silhouettes + bokeh (parallax FG_K relative to the world)
    const dx = Math.max(-600, Math.min(600, this.camX - GAME_W / 2));
    const s = 1 + (z - 1) * 1.3;
    this.fg.setScale(s).setPosition(GAME_W / 2 + (-dx * FG_K) * s, GAME_H / 2 + (GAME_H / 2 + 6) * s);
    const bg = this.bokehG; bg.clear();
    for (const b of this.bokeh) {
      b.x += (b.vx + Math.sin(t * 0.0006 + b.ph) * 5) * dt; b.y += b.vy * dt;
      if (b.y < 300) { b.y = GAME_H + 30; b.x = -300 + Math.random() * (GAME_W + 600); }
      const sx = GAME_W / 2 + (b.x - GAME_W / 2 - dx * FG_K) * s, sy = GAME_H / 2 + (b.y - GAME_H / 2) * s;
      if (sx < -80 || sx > GAME_W + 80) continue;
      const r = b.r * s, tw = 0.65 + 0.35 * Math.sin(t * 0.0015 + b.ph * 3), fade = Math.min(1, (sy - 300) / 90);
      bg.fillStyle(b.c, b.a * tw * Math.max(0, fade)); bg.fillCircle(sx, sy, r);
      bg.lineStyle(1.5, b.c, b.a * 1.4 * tw * Math.max(0, fade)); bg.strokeCircle(sx, sy, r);
    }
  }

  destroy(): void {
    this.dead = true;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    for (const k of this.texKeys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
  }
}
