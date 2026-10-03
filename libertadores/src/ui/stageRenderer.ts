import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import type { Ambience, StageDef, StageKind } from '../combat/types';
import {
  BANNERS, BELL, FIRES, GRASS, ISLANDS, LAYER_DEFS, PAINTERS, PORTALS,
  layerPad, mix, paintIsland, rng, css,
} from './stageArt';
import type { LayerDef, LayerName } from './stageArt';
import { blurCanvas } from './depth25d';

type G = Phaser.GameObjects.Graphics;
type Dyn = (g: G, t: number, dt: number) => void;

interface Layer {
  def: LayerDef;
  box: Phaser.GameObjects.Container;
  dyn?: G;
  dynFns: Dyn[];
}
interface Part { x: number; y: number; vx: number; vy: number; s: number; ph: number; life: number; gy: number; k: number }
interface ShaftSpec { layer: LayerName; x: number; y: number; rot: number; sx: number; sy: number; color: number; a: number }

let UID = 0;
const hashStr = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

const SHAFTS: Partial<Record<StageKind, ShaftSpec[]>> = {
  tiwanaku: [
    { layer: 'mid', x: 640, y: 440, rot: 0.0, sx: 5, sy: 1.1, color: 0xffd890, a: 0.22 },
    { layer: 'mid', x: 620, y: 440, rot: 0.35, sx: 3, sy: 1.1, color: 0xffc070, a: 0.16 },
    { layer: 'mid', x: 660, y: 440, rot: -0.35, sx: 3, sy: 1.1, color: 0xffc070, a: 0.16 },
  ],
  citadel: [
    { layer: 'far', x: 700, y: -40, rot: 0.35, sx: 5, sy: 1.3, color: 0xd0f0e0, a: 0.13 },
    { layer: 'far', x: 920, y: -40, rot: 0.3, sx: 3.5, sy: 1.3, color: 0xd0f0e0, a: 0.11 },
    { layer: 'far', x: 1100, y: -40, rot: 0.28, sx: 6, sy: 1.3, color: 0xd0f0e0, a: 0.1 },
  ],
  jungle: [
    { layer: 'far', x: 300, y: -20, rot: -0.2, sx: 4, sy: 1.3, color: 0x90e0c8, a: 0.12 },
    { layer: 'far', x: 420, y: -20, rot: -0.28, sx: 3, sy: 1.3, color: 0x90e0c8, a: 0.1 },
  ],
  battlefield: [
    { layer: 'far', x: 940, y: 200, rot: 0.15, sx: 7, sy: 1.0, color: 0xffa060, a: 0.12 },
    { layer: 'far', x: 800, y: 200, rot: 0.4, sx: 4, sy: 1.0, color: 0xffa060, a: 0.1 },
  ],
  pampa: [
    { layer: 'far', x: 760, y: 440, rot: 0.5, sx: 6, sy: 1.0, color: 0xffb060, a: 0.14 },
    { layer: 'far', x: 760, y: 440, rot: -0.5, sx: 6, sy: 1.0, color: 0xffb060, a: 0.14 },
    { layer: 'far', x: 760, y: 440, rot: 1.0, sx: 5, sy: 1.0, color: 0xff9050, a: 0.1 },
  ],
  dimension: [
    { layer: 'sky', x: 640, y: 210, rot: 0.0, sx: 6, sy: 1.1, color: 0xff80e0, a: 0.14 },
    { layer: 'sky', x: 640, y: 210, rot: 0.6, sx: 4, sy: 1.1, color: 0x80ffe8, a: 0.12 },
    { layer: 'sky', x: 640, y: 210, rot: -0.6, sx: 4, sy: 1.1, color: 0x80ffe8, a: 0.12 },
  ],
  andes: [{ layer: 'far', x: 420, y: 230, rot: 0.25, sx: 6, sy: 1.3, color: 0xffffff, a: 0.12 }],
};
const FOG_ALPHA: Record<StageKind, number> = {
  llanos: 0.22, andes: 0.4, tiwanaku: 0.2, citadel: 0.5, battlefield: 0.4, jungle: 0.4, plaza: 0.25, pampa: 0.14, dimension: 0.28,
};

/** Depth-of-field: blur radius (px) and atmospheric haze baked into each far layer when the 2.5D effects are on. */
const DOF: Partial<Record<LayerName, { blur: number; haze: number }>> = {
  sky: { blur: 5, haze: 0.1 }, far: { blur: 6.5, haze: 0.26 }, mid: { blur: 4, haze: 0.16 }, near: { blur: 1.8, haze: 0.07 },
};

const PART_COUNT: Record<Ambience, number> = { rain: 140, snow: 140, embers: 80, dust: 70, ash: 100, fireflies: 36, none: 0 };

export class StageRenderer {
  readonly stage: StageDef;
  private scene: Phaser.Scene;
  private uid = ++UID;
  private depthBase: number;
  private _overlayDepth = 50;
  private layers: Partial<Record<LayerName, Layer>> = {};
  private texKeys: string[] = [];
  private objs: Phaser.GameObjects.GameObject[] = [];
  private flash: Phaser.GameObjects.Rectangle;
  private light: Phaser.GameObjects.Rectangle;
  private vig: Phaser.GameObjects.Image;
  private overlay: G;
  private parts: Part[] = [];
  private camX = GAME_W / 2;
  private glows: { s: Phaser.GameObjects.Image; base: number; seed: number; fl: number }[] = [];
  private shafts: { s: Phaser.GameObjects.Image; base: number; seed: number }[] = [];
  private fogs: { s: Phaser.GameObjects.Image; sp: number; w: number }[] = [];
  private bobbers: { s: Phaser.GameObjects.Image; y0: number; amp: number; sp: number; ph: number }[] = [];
  private auroras: { s: Phaser.GameObjects.Image; x0: number; ph: number; sp: number }[] = [];
  private R: () => number;
  private bolt: { x: number; y: number }[] = [];
  private boltT = 0;
  private nextBolt = 2500;
  private boltFlash = 0;
  private dead = false;
  private rainLean = -4;
  private soft = false;

  constructor(scene: Phaser.Scene, stage: StageDef, depthBase = -100, opts: { soft?: boolean } = {}) {
    this.scene = scene;
    this.soft = !!opts.soft;
    this.stage = stage;
    this.depthBase = depthBase;
    this.R = rng(hashStr(stage.id) ^ 0x9e3779b9);
    this.buildSharedTextures();
    const kind = stage.kind;
    const set = PAINTERS[kind];
    let order = 0;
    for (const def of LAYER_DEFS) {
      const painter = set[def.name];
      if (!painter && def.name !== 'sky') continue;
      const pad = layerPad(def.p);
      const w = GAME_W + pad * 2, h = def.y1 - def.y0;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      if (ctx && painter) {
        ctx.translate(pad, -def.y0);
        try { painter(ctx, stage, rng(hashStr(stage.id) + order * 977 + 13)); } catch { /* keep going with partial art */ }
      } else if (ctx) {
        ctx.fillStyle = css(stage.sky[0]); ctx.fillRect(0, 0, w, h);
      }
      const key = `stg_${this.uid}_${def.name}`;
      const dof = this.soft ? DOF[def.name] : undefined;
      scene.textures.addCanvas(key, dof ? this.softenLayer(cv, dof.blur, dof.haze) : cv);
      this.texKeys.push(key);
      const box = scene.add.container(0, 0);
      box.setScrollFactor(0);
      const img = scene.add.image(-pad, def.y0, key).setOrigin(0, 0).setScrollFactor(0);
      box.add(img);
      box.setDepth(def.name === 'fg' ? this.overlayDepth - 2 : depthBase + order);
      this.objs.push(box);
      this.layers[def.name] = { def, box, dynFns: [] };
      order++;
    }
    this.setupShafts();
    this.setupFog();
    this.setupFires();
    this.setupBanners();
    this.setupGrass();
    this.setupKindExtras();
    this.flash = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0).setScrollFactor(0).setDepth(depthBase + 30).setVisible(false);
    this.light = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0).setScrollFactor(0).setDepth(depthBase + 29).setVisible(false);
    this.vig = scene.add.image(GAME_W / 2, GAME_H / 2, 'stg_vig').setScrollFactor(0).setDepth(this.overlayDepth - 1);
    this.overlay = scene.add.graphics().setScrollFactor(0).setDepth(this.overlayDepth);
    this.objs.push(this.flash, this.light, this.vig, this.overlay);
    this.initParticles();
    this.setCamera(GAME_W / 2, 1);
  }

  /** Blur + haze a painted layer (same result in Canvas and WebGL: it is baked into the texture). */
  private softenLayer(cv: HTMLCanvasElement, blur: number, haze: number): HTMLCanvasElement {
    try {
      const out = blurCanvas(cv, blur);
      const c = out.getContext('2d');
      if (c) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = css(mix(this.stage.fog, 0x0a1020, 0.55), haze);
        c.fillRect(0, 0, out.width, out.height);
      }
      return out;
    } catch { return cv; }
  }

  /** Screen position of a point given in a parallax layer's own coordinates (used to place light pools). */
  layerPoint(name: LayerName, x: number, y: number, out: { x: number; y: number }): boolean {
    const L = this.layers[name];
    if (!L) return false;
    out.x = L.box.x + x * L.box.scaleX; out.y = L.box.y + y * L.box.scaleY;
    return true;
  }

  get overlayDepth(): number { return this._overlayDepth; }
  set overlayDepth(d: number) {
    this._overlayDepth = d;
    this.vig?.setDepth(d - 1);
    this.overlay?.setDepth(d);
    this.layers.fg?.box.setDepth(d - 2);
  }

  /* ------------------------------------------------------------ camera */
  setCamera(camX: number, zoom: number): void {
    if (this.dead) return;
    this.camX = camX;
    const z = Math.max(1, zoom);
    const dx = Math.max(-600, Math.min(600, camX - GAME_W / 2));
    for (const name in this.layers) {
      const L = this.layers[name as LayerName]!;
      const p = L.def.p;
      const s = 1 + (z - 1) * p;
      L.box.setScale(s);
      L.box.setPosition(GAME_W / 2 - (GAME_W / 2 + dx * p) * s, GAME_H / 2 - (GAME_H / 2) * s);
    }
  }

  setFlash(color: number, alpha: number): void {
    if (this.dead) return;
    if (alpha <= 0.004) { this.flash.setVisible(false); return; }
    this.flash.setFillStyle(color, Math.min(1, alpha)).setVisible(true);
  }

  /* ------------------------------------------------------------ build */
  private buildSharedTextures(): void {
    const tx = this.scene.textures;
    const mk = (key: string, w: number, h: number, fn: (c: CanvasRenderingContext2D) => void) => {
      if (tx.exists(key)) return;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d'); if (c) fn(c);
      tx.addCanvas(key, cv);
    };
    mk('stg_glow', 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    });
    mk('stg_fog', 512, 128, (c) => {
      const R = rng(77);
      for (let i = 0; i < 16; i++) {
        const x = 90 + R() * 332, y = 64 + (R() - 0.5) * 36, rx = 70 + R() * 90, ry = 18 + R() * 30;
        c.save(); c.translate(x, y); c.scale(1, ry / rx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 6.3); c.fill(); c.restore();
      }
    });
    mk('stg_shaft', 64, 512, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.1, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(26, 0); c.lineTo(38, 0); c.lineTo(64, 512); c.lineTo(0, 512); c.closePath(); c.fill();
      const m = c.createLinearGradient(0, 0, 64, 0);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.5, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = m; c.globalAlpha = 0.9; c.fillRect(0, 0, 64, 512);
    });
    mk('stg_vig', GAME_W, GAME_H, (c) => {
      const g = c.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.38, GAME_W / 2, GAME_H / 2, GAME_W * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
      c.fillStyle = g; c.fillRect(0, 0, GAME_W, GAME_H);
      const t = c.createLinearGradient(0, 0, 0, GAME_H);
      t.addColorStop(0, 'rgba(0,0,0,0.3)'); t.addColorStop(0.2, 'rgba(0,0,0,0)'); t.addColorStop(0.85, 'rgba(0,0,0,0)'); t.addColorStop(1, 'rgba(0,0,0,0.35)');
      c.fillStyle = t; c.fillRect(0, 0, GAME_W, GAME_H);
    });
  }

  private dynFor(name: LayerName): Layer | undefined {
    const L = this.layers[name];
    if (!L) return undefined;
    if (!L.dyn) {
      L.dyn = this.scene.add.graphics().setScrollFactor(0); L.box.add(L.dyn);
      const dof = this.soft ? DOF[name] : undefined;
      if (dof && dof.blur > 3 && this.scene.game.renderer.type === Phaser.WEBGL) { // WebGL only: soften flames/banners of distant layers
        try { L.dyn.preFX?.addBlur(0, 1, 1, dof.blur * 0.3); } catch { /* FX unavailable */ }
      }
    }
    return L;
  }

  private setupShafts(): void {
    for (const sp of SHAFTS[this.stage.kind] ?? []) {
      const L = this.layers[sp.layer]; if (!L) continue;
      const s = this.scene.add.image(sp.x, sp.y, 'stg_shaft').setOrigin(0.5, 0).setRotation(sp.rot).setScale(sp.sx, sp.sy * 1.4)
        .setTint(sp.color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(sp.a).setScrollFactor(0);
      L.box.add(s);
      this.shafts.push({ s, base: sp.a, seed: this.R() * 6 });
    }
  }

  private setupFog(): void {
    const st = this.stage;
    const a = FOG_ALPHA[st.kind] * 0.55;
    const place = (layer: LayerName, n: number, y0: number, y1: number, sc: number) => {
      const L = this.layers[layer]; if (!L) return;
      for (let i = 0; i < n; i++) {
        const w = 1500 * sc * (0.7 + this.R() * 0.6);
        const s = this.scene.add.image(-300 + this.R() * 1900, y0 + this.R() * (y1 - y0), 'stg_fog').setTint(st.fog).setAlpha(a * (0.6 + this.R() * 0.6)).setScrollFactor(0);
        s.setDisplaySize(w, 128 * sc * (0.7 + this.R() * 0.8));
        L.box.add(s);
        this.fogs.push({ s, sp: (4 + this.R() * 12) * (this.R() < 0.5 ? -1 : 1), w });
      }
    };
    place('far', 3, 440, 520, 0.7);
    place('mid', 4, 500, 580, 0.9);
    place('near', 3, 570, 630, 1.0);
  }

  private setupFires(): void {
    for (const f of FIRES[this.stage.kind] ?? []) {
      const L = this.dynFor(f.layer); if (!L) continue;
      const gl = this.scene.add.image(f.x, f.y - 20 * f.s, 'stg_glow').setTint(f.glow).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0);
      const base = Math.min(0.42, 0.2 + f.s * 0.07);
      gl.setDisplaySize(200 * f.s + 70, 200 * f.s + 70).setAlpha(base);
      L.box.add(gl);
      this.glows.push({ s: gl, base, seed: this.R() * 100, fl: 0.25 });
      if (f.flame) {
        const seed = this.R() * 50;
        L.dynFns.push((g, t) => flame(g, f.x, f.y, f.s, t, seed));
      }
    }
  }

  private setupBanners(): void {
    for (const b of BANNERS[this.stage.kind] ?? []) {
      const L = this.dynFor(b.layer); if (!L) continue;
      const seed = this.R() * 10;
      L.dynFns.push((g, t) => banner(g, b.x, b.y, b.len, b.h, b.c1, b.c2, t, seed));
    }
  }

  private setupGrass(): void {
    for (const gs of GRASS[this.stage.kind] ?? []) {
      const L = this.dynFor(gs.layer); if (!L) continue;
      const blades: { x: number; h: number; ph: number; col: number; w: number }[] = [];
      for (let i = 0; i < gs.n; i++) blades.push({ x: gs.x0 + (i / gs.n) * (gs.x1 - gs.x0) + this.R() * 20, h: gs.hMin + this.R() * (gs.hMax - gs.hMin), ph: this.R() * 6.3, col: mix(gs.c1, gs.c2, this.R()), w: 2 + this.R() * 2.5 });
      L.dynFns.push((g, t) => {
        for (const b of blades) {
          const sw = Math.sin(t * 0.0018 + b.ph + b.x * 0.004) * b.h * 0.22;
          g.lineStyle(b.w, b.col, 1);
          g.beginPath(); g.moveTo(b.x, gs.y); g.lineTo(b.x + sw * 0.35, gs.y - b.h * 0.55); g.lineTo(b.x + sw, gs.y - b.h); g.strokePath();
        }
      });
    }
  }

  private setupKindExtras(): void {
    const kind = this.stage.kind;
    if (kind === 'plaza') {
      const L = this.dynFor('mid');
      if (L) L.dynFns.push((g, t) => {
        const a = Math.sin(t * 0.0022) * 0.3;
        const px = BELL.x, py = BELL.y;
        const P = (x: number, y: number) => ({ x: px + x * Math.cos(a) - y * Math.sin(a), y: py + x * Math.sin(a) + y * Math.cos(a) });
        g.fillStyle(0x7a5a28, 1);
        g.fillPoints([P(-3, 0), P(3, 0), P(5, 10), P(11, 26), P(14, 34), P(-14, 34), P(-11, 26), P(-5, 10)], true);
        g.fillStyle(0xe0b050, 0.8); g.fillPoints([P(-4, 4), P(-2, 4), P(-6, 30), P(-9, 30)], true);
        g.fillStyle(0x201008, 1); const c = P(0, 36); g.fillCircle(c.x, c.y, 2.5);
        const gl = 0.12 + 0.1 * Math.abs(Math.sin(a));
        g.fillStyle(0xffc060, gl); g.fillCircle(px, py + 22, 26);
      });
    }
    if (kind === 'dimension') {
      for (const p of PORTALS) {
        const L = this.dynFor(p.layer); if (!L) continue;
        const gl = this.scene.add.image(p.x, p.y, 'stg_glow').setTint(p.c1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(p.r * 4.2, p.r * 5).setAlpha(0.55).setScrollFactor(0);
        L.box.add(gl);
        this.glows.push({ s: gl, base: 0.5, seed: this.R() * 50, fl: 0.15 });
        const seed = this.R() * 6;
        L.dynFns.push((g, t) => portal(g, p.x, p.y, p.r, p.c1, p.c2, t, seed));
      }
      for (const isl of ISLANDS) {
        const L = this.layers[isl.layer]; if (!L) continue;
        const cv = document.createElement('canvas'); cv.width = isl.w; cv.height = isl.h;
        const c = cv.getContext('2d');
        if (c) paintIsland(c, isl.w, isl.h, isl.variant, rng(hashStr(this.stage.id) + isl.x), isl.variant % 2 ? 0xff40c0 : 0x40ffd0);
        const key = `stg_${this.uid}_isl${this.texKeys.length}`;
        this.scene.textures.addCanvas(key, cv); this.texKeys.push(key);
        const im = this.scene.add.image(isl.x, isl.y, key).setOrigin(0.5, 0).setAlpha(isl.alpha).setScrollFactor(0);
        // insert behind the layer's dynamic graphics
        L.box.addAt(im, 1);
        this.bobbers.push({ s: im, y0: isl.y, amp: isl.bob, sp: isl.speed, ph: this.R() * 6.3 });
      }
      // auroras
      const L = this.layers.far;
      if (L) for (let k = 0; k < 2; k++) {
        const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 300;
        const c = cv.getContext('2d');
        if (c) {
          const R = rng(900 + k);
          const f1 = 0.004 + R() * 0.004, f2 = 0.011 + R() * 0.005, p1 = R() * 6, p2 = R() * 6;
          for (let x = 0; x < 1500; x += 2) {
            const top = 120 + Math.sin(x * f1 + p1) * 60 + Math.sin(x * f2 + p2) * 24;
            const h = 110 + Math.sin(x * 0.007 + p2) * 50;
            const g = c.createLinearGradient(0, top - h, 0, top + 40);
            const c1 = k ? 0xff40d0 : 0x40ffb0, c2 = k ? 0x6040ff : 0x40c0ff;
            g.addColorStop(0, css(c2, 0)); g.addColorStop(0.7, css(mix(c1, c2, 0.3), 0.35)); g.addColorStop(0.92, css(c1, 0.6)); g.addColorStop(1, css(c1, 0));
            c.fillStyle = g; c.fillRect(x, top - h, 2.2, h + 40);
          }
        }
        const key = `stg_${this.uid}_aur${k}`;
        this.scene.textures.addCanvas(key, cv); this.texKeys.push(key);
        const im = this.scene.add.image(640 + (k ? 160 : -120), 70 + k * 70, key).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(1.1, 1).setScrollFactor(0);
        L.box.addAt(im, 1);
        this.auroras.push({ s: im, x0: im.x, ph: k * 2, sp: 0.00025 + k * 0.0001 });
      }
    }
  }

  /* ------------------------------------------------------------ particles */
  private initParticles(): void {
    const n = PART_COUNT[this.stage.ambience];
    for (let i = 0; i < n; i++) { const p: Part = { x: 0, y: 0, vx: 0, vy: 0, s: 1, ph: 0, life: 0, gy: 0, k: 0 }; this.respawn(p, true); this.parts.push(p); }
  }

  private respawn(p: Part, init: boolean): void {
    const R = Math.random;
    const a = this.stage.ambience;
    p.ph = R() * 6.3; p.k = R();
    switch (a) {
      case 'rain':
        p.x = R() * (GAME_W + 200) - 100; p.y = init ? R() * GAME_H : -30 - R() * 60;
        p.vx = this.rainLean * (0.8 + p.k * 0.4); p.vy = 20 + p.k * 14; p.s = 12 + p.k * 16; p.gy = 612 + R() * 106; p.life = 0; break;
      case 'snow':
        p.x = R() * (GAME_W + 300) - 150; p.y = init ? R() * GAME_H : -10 - R() * 40;
        p.vx = 1.2 + R() * 1.6; p.vy = 0.8 + p.k * 2; p.s = 0.9 + p.k * 2.4; break;
      case 'embers':
        p.x = R() * GAME_W; p.y = init ? R() * GAME_H : GAME_H + R() * 40;
        p.vx = (R() - 0.5) * 0.6; p.vy = -(0.6 + R() * 1.6); p.s = 0.8 + R() * 1.8; p.life = init ? R() : 0; break;
      case 'dust':
        p.x = init ? R() * GAME_W : -20; p.y = 140 + R() * 560;
        p.vx = 0.5 + R() * 1.4; p.vy = (R() - 0.5) * 0.3; p.s = 0.8 + R() * 2.2; break;
      case 'ash':
        p.x = R() * (GAME_W + 200) - 100; p.y = init ? R() * GAME_H : -10 - R() * 30;
        p.vx = 0.4 + R() * 1.0; p.vy = 0.5 + R() * 1.1; p.s = 1 + R() * 2.4; break;
      case 'fireflies':
        p.x = R() * GAME_W; p.y = 260 + R() * 380; p.vx = (R() - 0.5) * 0.5; p.vy = (R() - 0.5) * 0.4; p.s = 1.4 + R() * 1.2; break;
      default: break;
    }
  }

  /* ------------------------------------------------------------ update */
  update(timeMs: number, deltaMs: number): void {
    if (this.dead) return;
    const dt = Math.min(3, Math.max(0.2, deltaMs / 16.667));
    const t = timeMs;
    // layer dynamics
    for (const name in this.layers) {
      const L = this.layers[name as LayerName]!;
      if (!L.dyn) continue;
      L.dyn.clear();
      for (const fn of L.dynFns) fn(L.dyn, t, deltaMs);
    }
    // glow flicker
    for (const g of this.glows) {
      const f = 1 + (Math.sin(t * 0.021 + g.seed) * 0.5 + Math.sin(t * 0.047 + g.seed * 2.3) * 0.5 + (Math.random() - 0.5) * 0.4) * g.fl;
      g.s.setAlpha(Math.max(0, g.base * f));
    }
    for (const s of this.shafts) s.s.setAlpha(Math.max(0, s.base * (0.65 + 0.35 * Math.sin(t * 0.0006 + s.seed))));
    for (const f of this.fogs) {
      f.s.x += f.sp * deltaMs / 1000;
      if (f.sp > 0 && f.s.x > 1700 + f.w * 0.5) f.s.x = -400 - f.w * 0.5;
      else if (f.sp < 0 && f.s.x < -400 - f.w * 0.5) f.s.x = 1700 + f.w * 0.5;
    }
    for (const b of this.bobbers) b.s.y = b.y0 + Math.sin(t * b.sp + b.ph) * b.amp;
    for (const a of this.auroras) { a.s.x = a.x0 + Math.sin(t * a.sp + a.ph) * 60; a.s.setAlpha(0.4 + 0.2 * Math.sin(t * 0.0008 + a.ph * 3)); a.s.scaleY = 1 + 0.12 * Math.sin(t * 0.0011 + a.ph); }
    if (this.stage.kind === 'llanos') this.updateLightning(deltaMs);
    this.updateParticles(t, dt);
  }

  private updateLightning(dms: number): void {
    this.nextBolt -= dms;
    if (this.nextBolt <= 0) {
      this.nextBolt = 3000 + Math.random() * 7000;
      this.boltT = 320; this.boltFlash = 1;
      let x = 160 + Math.random() * 960, y = -10;
      this.bolt = [{ x, y }];
      while (y < 330 + Math.random() * 90) { x += (Math.random() - 0.5) * 70; y += 18 + Math.random() * 28; this.bolt.push({ x, y }); }
    }
    const sky = this.layers.sky;
    if (this.boltT > 0) {
      this.boltT -= dms;
      const ph = this.boltT / 320;
      const f = ph > 0.7 ? 1 : ph > 0.55 ? 0.15 : ph > 0.4 ? 0.8 : ph * 1.2;
      this.boltFlash = Math.max(0, f);
      if (sky) {
        const g = this.dynFor('sky')!.dyn!;
        if (!sky.dynFns.length) sky.dynFns.push(() => undefined);
        g.clear();
        if (this.boltFlash > 0.2) {
          g.lineStyle(9, 0xaab8ff, 0.28 * this.boltFlash); g.beginPath();
          this.bolt.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.strokePath();
          g.lineStyle(2.5, 0xffffff, 0.95 * this.boltFlash); g.beginPath();
          this.bolt.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.strokePath();
        }
      }
    } else this.boltFlash = 0;
    const a = this.boltFlash * 0.22;
    if (a > 0.004) this.light.setFillStyle(0xcfd8ff, a).setVisible(true); else this.light.setVisible(false);
    if (sky && this.boltT <= 0 && sky.dyn) sky.dyn.clear();
  }

  private updateParticles(t: number, dt: number): void {
    const g = this.overlay;
    g.clear();
    const a = this.stage.ambience;
    if (a === 'none') return;
    const off = -(this.camX - GAME_W / 2) * 0.35;
    const wrap = GAME_W + 300;
    const accent = this.stage.accent;
    for (const p of this.parts) {
      switch (a) {
        case 'rain': {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y >= p.gy) { // splash
            if (p.life === 0) { p.life = 1; p.vy = 0; p.vx = 0; }
            p.life += 0.22 * dt;
            if (p.life > 2.6) { this.respawn(p, false); break; }
            g.lineStyle(1, 0xb8c4dc, 0.4 * (1 - (p.life - 1) / 1.6));
            g.strokeEllipse(p.x + off, p.gy, 3 + p.life * 5, 1 + p.life * 1.4);
            break;
          }
          const x = this.wrapX(p.x + off, GAME_W + 200);
          g.lineStyle(1 + p.k * 0.8, 0xb4c0d8, 0.18 + p.k * 0.3);
          g.lineBetween(x, p.y, x - p.vx * (p.s / p.vy), p.y - p.s);
          break;
        }
        case 'snow': {
          p.x += (p.vx + Math.sin(t * 0.0012 + p.ph) * 0.8) * dt; p.y += p.vy * dt;
          if (p.y > GAME_H + 6 || p.x > GAME_W + 160) { this.respawn(p, false); if (p.x > GAME_W) p.x = -20; break; }
          const x = this.wrapX(p.x + off, wrap);
          g.fillStyle(0xf0f6ff, 0.35 + p.k * 0.55); g.fillCircle(x, p.y, p.s);
          if (p.s > 2.2) { g.fillStyle(0xffffff, 0.12); g.fillCircle(x, p.y, p.s * 2); }
          break;
        }
        case 'embers': {
          p.x += (p.vx + Math.sin(t * 0.002 + p.ph) * 0.5) * dt; p.y += p.vy * dt; p.life += 0.0035 * dt;
          if (p.y < -10 || p.life > 1) { this.respawn(p, false); break; }
          const fade = Math.sin(Math.min(1, p.life) * Math.PI);
          const x = this.wrapX(p.x + off * 0.6, GAME_W);
          let col = p.k < 0.3 ? 0xffd070 : p.k < 0.75 ? 0xff8030 : 0xff4a18;
          if (this.stage.kind === 'dimension') col = p.k < 0.4 ? 0x40ffd0 : p.k < 0.8 ? 0xff50d0 : 0xe0f0ff;
          const fl = 0.6 + 0.4 * Math.sin(t * 0.03 + p.ph * 5);
          g.fillStyle(col, 0.12 * fade * fl); g.fillCircle(x, p.y, p.s * 3.2);
          g.fillStyle(col, 0.85 * fade * fl); g.fillCircle(x, p.y, p.s);
          break;
        }
        case 'dust': {
          p.x += (p.vx + Math.sin(t * 0.0007 + p.ph) * 0.4) * dt; p.y += (p.vy + Math.sin(t * 0.001 + p.ph) * 0.15) * dt;
          if (p.x > GAME_W + 40) { this.respawn(p, false); p.x = -20; break; }
          const x = this.wrapX(p.x + off * 0.8, wrap);
          const col = this.stage.kind === 'pampa' ? 0xe08050 : mix(0xffd9a0, accent, 0.3);
          g.fillStyle(col, 0.1 + p.k * 0.22); g.fillCircle(x, p.y, p.s * 1.4);
          g.fillStyle(col, 0.03 + p.k * 0.04); g.fillCircle(x, p.y, p.s * 3.2);
          break;
        }
        case 'ash': {
          p.x += (p.vx + Math.sin(t * 0.0013 + p.ph) * 0.6) * dt; p.y += p.vy * dt;
          if (p.y > GAME_H + 6 || p.x > GAME_W + 120) { this.respawn(p, false); break; }
          const x = this.wrapX(p.x + off, wrap);
          if (p.k > 0.93) { g.fillStyle(0xff8030, 0.7 * (0.5 + 0.5 * Math.sin(t * 0.02 + p.ph))); g.fillCircle(x, p.y, p.s * 0.8); }
          else { g.fillStyle(p.k < 0.5 ? 0x7a7068 : 0x3a3430, 0.35 + p.k * 0.4); g.fillRect(x, p.y, p.s * 1.5, p.s * (0.5 + 0.5 * Math.abs(Math.sin(t * 0.004 + p.ph)))); }
          break;
        }
        case 'fireflies': {
          p.vx += (Math.random() - 0.5) * 0.05 * dt; p.vy += (Math.random() - 0.5) * 0.05 * dt;
          p.vx = Math.max(-0.7, Math.min(0.7, p.vx)); p.vy = Math.max(-0.5, Math.min(0.5, p.vy));
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < -20) p.x = GAME_W + 20; else if (p.x > GAME_W + 20) p.x = -20;
          if (p.y < 200) p.vy = Math.abs(p.vy); else if (p.y > 660) p.vy = -Math.abs(p.vy);
          const x = this.wrapX(p.x + off * 0.7, GAME_W + 40);
          const pulse = Math.max(0, Math.sin(t * 0.0025 + p.ph * 3));
          g.fillStyle(0xd8ff70, 0.12 * pulse); g.fillCircle(x, p.y, p.s * 6);
          g.fillStyle(0xe8ffa0, 0.25 + 0.7 * pulse); g.fillCircle(x, p.y, p.s);
          break;
        }
        default: break;
      }
    }
  }

  private wrapX(x: number, span: number): number {
    const lo = -(span - GAME_W) / 2;
    return ((((x - lo) % span) + span) % span) + lo;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of this.objs) { try { o.destroy(); } catch { /* ignore */ } }
    for (const k of this.texKeys) { try { this.scene.textures.remove(k); } catch { /* ignore */ } }
    this.objs = []; this.texKeys = []; this.layers = {}; this.glows = []; this.fogs = []; this.parts = [];
  }

  /* ------------------------------------------------------------ thumbnail */
  static drawThumbnail(g: Phaser.GameObjects.Graphics, stage: StageDef, x: number, y: number, w: number, h: number): void {
    const u = (v: number) => x + v * w;
    const v = (k: number) => y + k * h;
    const horizon = 0.7;
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      g.fillStyle(mix(stage.sky[0], stage.sky[1], t), 1);
      g.fillRect(x, y + (i / bands) * h * horizon, w, (h * horizon) / bands + 1);
    }
    const gc = stage.ground;
    const glow = (cx: number, cy: number, r: number, col: number, al: number) => {
      const rr = Math.min(r * w, cx * w, (1 - cx) * w, cy * h, (1 - cy) * h);
      g.fillStyle(col, al * 0.3); g.fillCircle(u(cx), v(cy), rr);
      g.fillStyle(col, al * 0.5); g.fillCircle(u(cx), v(cy), rr * 0.62);
    };
    const pre: Partial<Record<StageKind, [number, number, number, number]>> = {
      llanos: [0.75, 0.62, 0.12, 0xffa060], tiwanaku: [0.5, 0.55, 0.16, 0xffd890], battlefield: [0.72, 0.55, 0.14, 0xffa060],
      pampa: [0.6, 0.62, 0.22, 0xff9040], andes: [0.35, 0.3, 0.14, 0xffffff], jungle: [0.3, 0.22, 0.07, 0xc8f0e0],
    };
    const ps = pre[stage.kind];
    if (ps) glow(ps[0], ps[1], ps[2], ps[3], 0.9);
    for (let i = 0; i < 6; i++) { g.fillStyle(mix(mix(gc, stage.fog, 0.35), 0x000000, i / 9), 1); g.fillRect(x, v(horizon + (i / 6) * (1 - horizon)), w, h * (1 - horizon) / 6 + 1); }
    const tri = (a: number, b: number, c2: number, d: number, e: number, f: number) => g.fillTriangle(u(a), v(b), u(c2), v(d), u(e), v(f));
    const dark = (c: number, f: number) => mix(c, 0x000000, f);
    const sun = (cx: number, cy: number, r: number, col: number, a = 0.9) => {
      const rr = Math.min(r * w, (1 - cx) * w, cx * w, cy * h);
      g.fillStyle(col, a); g.fillCircle(u(cx), v(cy), rr);
    };
    switch (stage.kind) {
      case 'llanos': {
        sun(0.75, 0.62, 0.05, 0xffa060, 0.6);
        g.fillStyle(0x0a0a14, 0.55); for (let i = 0; i < 5; i++) g.fillEllipse(u(0.1 + i * 0.2), v(0.12 + (i % 2) * 0.08), w * 0.3, h * 0.12);
        for (const px of [0.18, 0.84]) { g.fillStyle(0x0a1008, 1); g.fillRect(u(px) - 1, v(0.4), 2, h * 0.3); for (const d of [-1, 1]) g.fillTriangle(u(px), v(0.4), u(px + d * 0.1), v(0.5), u(px + d * 0.08), v(0.43)); }
        g.lineStyle(1, 0xb0bcd8, 0.5); for (let i = 0; i < 14; i++) { const lx = u(0.04 + i * 0.07), ly = v(0.05 + (i * 37 % 60) / 100); g.lineBetween(lx, ly, lx - 3, ly + h * 0.07); }
        break;
      }
      case 'andes': {
        g.fillStyle(0x6a7ea4, 1); tri(0.05, horizon, 0.3, 0.2, 0.6, horizon); tri(0.4, horizon, 0.7, 0.12, 1.0, horizon);
        g.fillStyle(0xf0f6ff, 1); tri(0.22, 0.34, 0.3, 0.2, 0.38, 0.34); tri(0.6, 0.27, 0.7, 0.12, 0.8, 0.27);
        g.fillStyle(0x2a3248, 0.6); tri(0.3, 0.2, 0.6, horizon, 0.36, horizon); tri(0.7, 0.12, 1.0, horizon, 0.76, horizon);
        g.fillStyle(0xffffff, 0.8); for (let i = 0; i < 16; i++) g.fillCircle(u((i * 0.137) % 1), v((i * 0.211) % 0.9), 1.2);
        break;
      }
      case 'tiwanaku': {
        sun(0.5, 0.52, 0.07, 0xffe0a0, 1);
        g.fillStyle(0x3e2e36, 1); g.fillRect(u(0.34), v(0.3), w * 0.32, h * 0.4);
        g.fillStyle(0xffe0a0, 1); g.fillRect(u(0.45), v(0.46), w * 0.1, h * 0.24);
        g.fillStyle(0x2a1e24, 1); g.fillRect(u(0.34), v(0.3), w * 0.32, h * 0.1);
        for (let i = 0; i < 5; i++) { g.fillStyle(0x36282a, 1); g.fillRect(u(0.04 + i * 0.05), v(0.5 - (i % 2) * 0.05), w * 0.025, h * 0.2); g.fillRect(u(0.74 + i * 0.05), v(0.5 - ((i + 1) % 2) * 0.05), w * 0.025, h * 0.2); }
        break;
      }
      case 'citadel': {
        g.fillStyle(0x2a4642, 1); tri(0.0, horizon, 0.2, 0.15, 0.45, horizon); tri(0.5, horizon, 0.78, 0.2, 1.0, horizon);
        for (let i = 0; i < 5; i++) { g.fillStyle(mix(0x6a665a, 0x2a2a24, i / 7), 1); g.fillRect(u(0.05 + i * 0.03), v(0.38 + i * 0.065), w * (0.9 - i * 0.06), h * 0.065); g.fillStyle(0x3a6a34, 1); g.fillRect(u(0.05 + i * 0.03), v(0.38 + i * 0.065), w * (0.9 - i * 0.06), h * 0.012); }
        g.fillStyle(0x1e1a14, 1); tri(0.56, 0.34, 0.66, 0.24, 0.76, 0.34);
        g.fillStyle(0xd8ff80, 0.8); for (let i = 0; i < 7; i++) g.fillCircle(u(0.1 + i * 0.13), v(0.55 + (i % 3) * 0.1), 1.4);
        g.fillStyle(0xb0d0c8, 0.18); g.fillRect(x, v(0.5), w, h * 0.1);
        break;
      }
      case 'battlefield': {
        sun(0.72, 0.5, 0.05, 0xffa060, 0.8);
        g.fillStyle(0x14100f, 0.8); for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) g.fillCircle(u(0.1 + i * 0.22 + (k % 2) * 0.02), v(0.5 - k * 0.07), w * (0.03 + k * 0.012));
        g.fillStyle(0x120c0e, 1); for (let i = 0; i < 20; i++) g.fillRect(u(0.04 + i * 0.047), v(0.6), 2, h * 0.1);
        g.fillStyle(0xb02a2a, 1); g.fillRect(u(0.5), v(0.3), w * 0.012, h * 0.4); g.fillRect(u(0.5), v(0.3), w * 0.1, h * 0.07);
        glow(0.18, 0.66, 0.06, 0xff7020, 0.9);
        break;
      }
      case 'jungle': {
        sun(0.3, 0.2, 0.025, 0xc8f0e0, 0.8);
        glow(0.7, 0.65, 0.2, 0xff5010, 0.9);
        g.fillStyle(0x050c08, 1); for (let i = 0; i < 7; i++) { g.fillRect(u(0.05 + i * 0.15), v(0.15), w * 0.03, h * 0.6); g.fillEllipse(u(0.065 + i * 0.15), v(0.15), w * 0.2, h * 0.18); }
        g.fillStyle(0xff8030, 1); g.fillTriangle(u(0.66), v(0.7), u(0.7), v(0.5), u(0.74), v(0.7));
        break;
      }
      case 'plaza': {
        g.fillStyle(0xf0ecd8, 1); g.fillCircle(u(0.14), v(0.14), w * 0.035);
        g.fillStyle(0xffffff, 0.8); for (let i = 0; i < 20; i++) g.fillCircle(u((i * 0.173) % 1), v((i * 0.131) % 0.5), 1);
        g.fillStyle(0x4a4048, 1); g.fillRect(u(0.52), v(0.38), w * 0.34, h * 0.32); g.fillRect(u(0.5), v(0.18), w * 0.08, h * 0.52); g.fillRect(u(0.8), v(0.18), w * 0.08, h * 0.52);
        g.fillStyle(0x2a2028, 1); tri(0.49, 0.18, 0.54, 0.06, 0.59, 0.18); tri(0.79, 0.18, 0.84, 0.06, 0.89, 0.18);
        g.fillStyle(0xffb060, 1); g.fillRect(u(0.525), v(0.26), w * 0.03, h * 0.05); g.fillRect(u(0.825), v(0.26), w * 0.03, h * 0.05); g.fillRect(u(0.64), v(0.52), w * 0.1, h * 0.18);
        g.fillStyle(0x07040a, 1); for (let i = 0; i < 14; i++) g.fillRect(u(0.02 + i * 0.033), v(0.64), w * 0.015, h * 0.07);
        glow(0.3, 0.6, 0.1, 0xff9040, 0.8); g.fillStyle(0xffb060, 1); g.fillCircle(u(0.3), v(0.52), 2);
        break;
      }
      case 'pampa': {
        sun(0.6, horizon - 0.02, 0.12, 0xffd070, 0.9);
        g.fillStyle(stage.ground, 1); g.fillRect(x, v(horizon - 0.0), w, 1);
        g.fillStyle(0x5a2030, 1); tri(0.0, horizon, 0.12, 0.5, 0.26, horizon); tri(0.14, horizon, 0.3, 0.46, 0.46, horizon); tri(0.8, horizon, 0.92, 0.52, 1.0, horizon);
        g.fillStyle(0x120808, 1); g.fillRect(u(0.8), v(0.5), w * 0.03, h * 0.2); g.fillEllipse(u(0.815), v(0.46), w * 0.26, h * 0.14); g.fillEllipse(u(0.72), v(0.5), w * 0.12, h * 0.07);
        g.fillStyle(0x120808, 1); for (let i = 0; i < 7; i++) g.fillEllipse(u(0.1 + i * 0.045), v(0.7), w * 0.03, h * 0.025);
        break;
      }
      case 'dimension': {
        glow(0.5, 0.28, 0.16, 0xff70d0, 0.8); g.fillStyle(0x02000a, 1); g.fillCircle(u(0.5), v(0.28), w * 0.07);
        g.lineStyle(2, 0xffd0f8, 0.9); g.strokeCircle(u(0.5), v(0.28), w * 0.07);
        g.fillStyle(0xffffff, 0.8); for (let i = 0; i < 28; i++) g.fillCircle(u((i * 0.1913) % 1), v((i * 0.0917) % 0.68), 0.9);
        g.fillStyle(0x3a2a5c, 1); g.fillEllipse(u(0.2), v(0.48), w * 0.2, h * 0.07); g.fillEllipse(u(0.82), v(0.38), w * 0.16, h * 0.06);
        tri(0.12, 0.49, 0.2, 0.62, 0.28, 0.49); tri(0.75, 0.39, 0.82, 0.5, 0.89, 0.39);
        g.lineStyle(3, 0x40ffd0, 0.9); g.strokeEllipse(u(0.5), v(0.5), w * 0.12, h * 0.26);
        g.lineStyle(2, 0xff40c0, 0.8); g.strokeEllipse(u(0.5), v(0.5), w * 0.08, h * 0.19);
        g.lineStyle(1, 0x40ffd0, 0.4); for (let i = 1; i < 6; i++) g.lineBetween(x, v(horizon + i * 0.045), x + w, v(horizon + i * 0.045));
        break;
      }
    }
    g.fillStyle(stage.fog, 0.22); g.fillRect(x, v(horizon - 0.07), w, h * 0.12);
    g.fillStyle(0x000000, 0.18); g.fillRect(x, y, w, h * 0.06); g.fillRect(x, y + h * 0.9, w, h * 0.1);
  }
}

/* ------------------------------------------------------------------ fx */
function flame(g: G, x: number, y: number, s: number, t: number, seed: number): void {
  const w = 11 * s, h = 40 * s;
  const cols = [0xc02a08, 0xff7a18, 0xffe070];
  const al = [0.75, 0.85, 0.9];
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.3;
    const sway = (Math.sin(t * 0.011 + seed + i) * 4 + Math.sin(t * 0.023 + seed * 2) * 2.5) * s * k;
    const hh = h * k * (0.82 + 0.18 * Math.sin(t * 0.031 + seed * 3 + i * 1.7));
    g.fillStyle(cols[i], al[i]);
    g.fillTriangle(x - w * k, y, x + w * k, y, x + sway, y - hh);
    g.fillEllipse(x, y - w * 0.15 * k, w * 2 * k, w * 1.2 * k);
    if (i === 0) g.fillTriangle(x - w * 0.7, y - h * 0.18, x - w * 0.1 + sway * 0.5, y - h * 0.15, x - w * 0.9 + sway * 1.4, y - hh * 0.62);
  }
}
function banner(g: G, x: number, y: number, len: number, h: number, c1: number, c2: number, t: number, seed: number): void {
  const n = 10;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ x: x + f * len, y: y + Math.sin(t * 0.005 - f * 4.2 + seed) * 7 * f + f * f * 5 });
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1];
    const mid = h / 2;
    g.fillStyle(c1, 1); g.fillPoints([{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: b.x, y: b.y + mid }, { x: a.x, y: a.y + mid }], true);
    g.fillStyle(c2, 1); g.fillPoints([{ x: a.x, y: a.y + mid }, { x: b.x, y: b.y + mid }, { x: b.x, y: b.y + h }, { x: a.x, y: a.y + h }], true);
    const shade = Math.sin(t * 0.005 - (i / n) * 4.2 + seed + 0.8);
    g.fillStyle(shade > 0 ? 0xffffff : 0x000000, Math.abs(shade) * 0.14);
    g.fillPoints([{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: b.x, y: b.y + h }, { x: a.x, y: a.y + h }], true);
  }
}
function portal(g: G, x: number, y: number, r: number, c1: number, c2: number, t: number, seed: number): void {
  const ry = r * 1.25;
  g.fillStyle(0x02000a, 0.9); g.fillEllipse(x, y, r * 1.7, ry * 1.7);
  for (let k = 0; k < 3; k++) {
    const rr = 1 - k * 0.25;
    g.lineStyle(3 - k * 0.6, k % 2 ? c2 : c1, 0.85 - k * 0.15);
    const a0 = t * (0.0016 + k * 0.0009) * (k % 2 ? -1 : 1) + seed + k;
    g.beginPath(); g.arc(x, y, r * rr, a0, a0 + 4.4); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.5); g.beginPath(); g.arc(x, y, r * rr * 0.97, a0 + 1, a0 + 1.9); g.strokePath();
  }
  g.lineStyle(4, c1, 0.9); g.strokeEllipse(x, y, r * 2, ry * 2);
  g.lineStyle(1.5, 0xffffff, 0.7); g.strokeEllipse(x, y, r * 2.06, ry * 2.06);
  for (let i = 0; i < 8; i++) {
    const a = t * 0.002 + i * 0.785 + seed;
    const d = ((t * 0.0006 + i * 0.37) % 1);
    g.fillStyle(i % 2 ? c1 : c2, 0.8 * (1 - d));
    g.fillCircle(x + Math.cos(a) * r * (1.1 - d * 0.6), y + Math.sin(a) * ry * (1.1 - d * 0.6), 2.2 - d);
  }
}
