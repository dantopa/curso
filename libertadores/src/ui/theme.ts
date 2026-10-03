import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';

export const COLORS = {
  gold: 0xd4a73c, goldLight: 0xf3d98a, goldDark: 0x7a5a1c, bg: 0x0a0806, panel: 0x14100c, panel2: 0x1d1610,
  red: 0xa32222, redDark: 0x4a0f0f, white: 0xf5ecd7, dim: 0x8a7a5a, green: 0x4adf8a, blue: 0x6ec6ff,
};
export const CSS = { gold: '#d4a73c', goldLight: '#f3d98a', white: '#f5ecd7', dim: '#8a7a5a', red: '#e0483a', dark: '#0a0806', green: '#7adf9a' };
export const FONT_TITLE = "Cinzel, 'Trajan Pro', Georgia, 'Times New Roman', serif";
export const FONT_BODY = "Oswald, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";

export interface TxtOpts {
  title?: boolean; origin?: [number, number]; stroke?: string; strokeW?: number;
  align?: 'left' | 'center' | 'right'; wrap?: number; bold?: boolean; shadow?: boolean; depth?: number; alpha?: number;
}
export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 24, color = CSS.white, o: TxtOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, s, {
    fontFamily: o.title ? FONT_TITLE : FONT_BODY,
    fontSize: `${size}px`,
    color,
    fontStyle: o.bold || o.title ? 'bold' : 'normal',
    align: o.align ?? 'left',
    stroke: o.stroke ?? '#000000',
    strokeThickness: o.strokeW ?? Math.max(0, Math.round(size / 9)),
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
  });
  t.setOrigin(...(o.origin ?? [0, 0]));
  t.setResolution(2);
  if (o.shadow) t.setShadow(0, 3, '#000000', 6, true, true);
  if (o.depth !== undefined) t.setDepth(o.depth);
  if (o.alpha !== undefined) t.setAlpha(o.alpha);
  return t;
}

export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: { alpha?: number; border?: number; fill?: number } = {}): void {
  g.fillStyle(o.fill ?? COLORS.panel, o.alpha ?? 0.88);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, o.border ?? COLORS.goldDark, 1);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, COLORS.gold, 0.35);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 5);
}

export type NavKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export function navFrom(e: KeyboardEvent): NavKey | null {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': return 'up';
    case 'ArrowDown': case 'KeyS': return 'down';
    case 'ArrowLeft': case 'KeyA': return 'left';
    case 'ArrowRight': case 'KeyD': return 'right';
    case 'Enter': case 'Space': case 'KeyJ': case 'Numpad1': return 'confirm';
    case 'Escape': case 'Backspace': case 'KeyU': case 'KeyP': return 'back';
    default: return null;
  }
}

/** Subscribes a scene to menu navigation keys; auto-cleans on shutdown. */
export function onNav(scene: Phaser.Scene, cb: (k: NavKey, e: KeyboardEvent) => void): void {
  const handler = (e: KeyboardEvent) => {
    const k = navFrom(e);
    if (k) { AudioManager.get().unlock(); cb(k, e); }
  };
  const kb = scene.input.keyboard;
  kb?.on('keydown', handler);
  scene.events.once('shutdown', () => kb?.off('keydown', handler));
}

export interface MenuItem {
  label: string | (() => string);
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  value?: () => string;
  enabled?: () => boolean;
}

/** Vertical menu with keyboard + pointer support. */
export class MenuList {
  index = 0;
  private texts: Phaser.GameObjects.Text[] = [];
  private g: Phaser.GameObjects.Graphics;
  private audio = AudioManager.get();
  active = true;
  constructor(
    private scene: Phaser.Scene, private x: number, private y: number, private items: MenuItem[],
    private o: { size?: number; gap?: number; width?: number; center?: boolean; depth?: number } = {},
  ) {
    const size = o.size ?? 30, gap = o.gap ?? size + 18;
    this.g = scene.add.graphics().setDepth((o.depth ?? 10) - 1);
    items.forEach((it, i) => {
      const t = txt(scene, x, y + i * gap, '', size, CSS.white, { title: true, origin: [o.center ? 0.5 : 0, 0.5], depth: o.depth ?? 10 });
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { if (this.active && this.isEnabled(i)) { this.setIndex(i); } });
      t.on('pointerdown', () => { if (this.active) { this.setIndex(i); this.confirm(); } });
      this.texts.push(t);
    });
    this.index = Math.max(0, items.findIndex((_, i) => this.isEnabled(i)));
    this.refresh();
    onNav(scene, (k) => {
      if (!this.active) return;
      if (k === 'up') this.move(-1);
      else if (k === 'down') this.move(1);
      else if (k === 'left') this.adjust(-1);
      else if (k === 'right') this.adjust(1);
      else if (k === 'confirm') this.confirm();
    });
  }
  private isEnabled(i: number): boolean { return this.items[i].enabled ? this.items[i].enabled!() : true; }
  private setIndex(i: number): void {
    if (i !== this.index) { this.index = i; this.audio.sfx('menuMove'); this.refresh(); }
  }
  private move(d: number): void {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.index + d * k + n * 4) % n;
      if (this.isEnabled(i)) { this.index = i; break; }
    }
    this.audio.sfx('menuMove');
    this.refresh();
  }
  private adjust(d: number): void {
    const it = this.items[this.index];
    const fn = d < 0 ? it.onLeft : it.onRight;
    if (fn) { fn(); this.audio.sfx('menuMove'); this.refresh(); }
  }
  private confirm(): void {
    const it = this.items[this.index];
    if (!this.isEnabled(this.index)) { this.audio.sfx('error'); return; }
    if (it.onSelect) { this.audio.sfx('menuSelect'); it.onSelect(); }
    else if (it.onRight) this.adjust(1);
    this.refresh();
  }
  refresh(): void {
    const size = this.o.size ?? 30, gap = this.o.gap ?? size + 18, w = this.o.width ?? 460;
    this.g.clear();
    this.items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const en = this.isEnabled(i);
      const sel = i === this.index;
      const val = it.value ? `   ◄ ${it.value()} ►` : '';
      const t = this.texts[i];
      t.setText(label + val);
      t.setColor(!en ? '#554a38' : sel ? CSS.goldLight : CSS.white);
      t.setScale(sel ? 1.05 : 1);
      if (sel) {
        const cy = this.y + i * gap;
        const left = this.o.center ? this.x - w / 2 : this.x - 24;
        this.g.fillStyle(COLORS.gold, 0.14);
        this.g.fillRoundedRect(left, cy - size * 0.75, w, size * 1.5, 6);
        this.g.fillStyle(COLORS.gold, 0.9);
        this.g.fillTriangle(left + 8, cy - 9, left + 8, cy + 9, left + 22, cy);
        this.g.lineStyle(1, COLORS.gold, 0.6);
        this.g.strokeRoundedRect(left, cy - size * 0.75, w, size * 1.5, 6);
      }
    });
  }
  destroy(): void { this.g.destroy(); this.texts.forEach((t) => t.destroy()); }
}

/** Dark animated backdrop for menus: gradient, mountain silhouettes, drifting embers. */
export class MenuBackdrop {
  private g: Phaser.GameObjects.Graphics;
  private dyn: Phaser.GameObjects.Graphics;
  private embers: { x: number; y: number; v: number; s: number; p: number }[] = [];
  constructor(scene: Phaser.Scene, tint = 0xff8a2a) {
    this.g = scene.add.graphics().setDepth(-50);
    const g = this.g;
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x050403), Phaser.Display.Color.ValueToColor(0x2a1408), 100, Math.round(t * 100));
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (GAME_H / steps) * i, GAME_W, GAME_H / steps + 1);
    }
    // moon / sun glow
    for (let r = 220; r > 20; r -= 20) { g.fillStyle(tint, 0.018); g.fillCircle(980, 250, r); }
    g.fillStyle(0xffe0a0, 0.18); g.fillCircle(980, 250, 38);
    // mountains
    const ridge = (y: number, amp: number, color: number, seed: number) => {
      g.fillStyle(color, 1);
      g.beginPath(); g.moveTo(0, GAME_H);
      for (let x = 0; x <= GAME_W; x += 20) {
        g.lineTo(x, y - Math.abs(Math.sin(x * 0.006 + seed) * amp) - Math.sin(x * 0.021 + seed * 2) * amp * 0.25);
      }
      g.lineTo(GAME_W, GAME_H); g.closePath(); g.fillPath();
    };
    ridge(540, 150, 0x160d08, 1); ridge(600, 110, 0x0e0905, 3); ridge(660, 70, 0x070503, 5);
    // vignette
    for (let i = 0; i < 12; i++) { g.lineStyle(40, 0x000000, 0.05 + i * 0.01); g.strokeRect(-20 + i * 6, -20 + i * 6, GAME_W + 40 - i * 12, GAME_H + 40 - i * 12); }
    this.dyn = scene.add.graphics().setDepth(-40);
    for (let i = 0; i < 70; i++) this.embers.push({ x: Math.random() * GAME_W, y: Math.random() * GAME_H, v: 0.3 + Math.random() * 0.9, s: 1 + Math.random() * 2.2, p: Math.random() * 6 });
  }
  update(timeMs: number): void {
    const g = this.dyn; g.clear();
    for (const e of this.embers) {
      e.y -= e.v; e.x += Math.sin(timeMs * 0.001 + e.p) * 0.4;
      if (e.y < -10) { e.y = GAME_H + 10; e.x = Math.random() * GAME_W; }
      g.fillStyle(0xffa040, 0.35 + 0.35 * Math.sin(timeMs * 0.004 + e.p));
      g.fillCircle(e.x, e.y, e.s);
    }
  }
  destroy(): void { this.g.destroy(); this.dyn.destroy(); }
}

export function screenTitle(scene: Phaser.Scene, text: string, sub?: string): void {
  txt(scene, GAME_W / 2, 52, text, 44, CSS.goldLight, { title: true, origin: [0.5, 0.5], shadow: true });
  if (sub) txt(scene, GAME_W / 2, 92, sub, 20, CSS.dim, { origin: [0.5, 0.5] });
  const g = scene.add.graphics();
  g.lineStyle(2, COLORS.gold, 0.7); g.lineBetween(GAME_W / 2 - 280, 112, GAME_W / 2 + 280, 112);
  g.fillStyle(COLORS.gold, 1); g.fillTriangle(GAME_W / 2 - 8, 112, GAME_W / 2 + 8, 112, GAME_W / 2, 104); g.fillTriangle(GAME_W / 2 - 8, 112, GAME_W / 2 + 8, 112, GAME_W / 2, 120);
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 280): void {
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
export function fadeIn(scene: Phaser.Scene, ms = 280): void { scene.cameras.main.fadeIn(ms, 0, 0, 0); }
