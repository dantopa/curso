import Phaser from 'phaser';
import { GAME_H, GAME_W, type CharacterDef } from '../combat/types';
import type { FightSim } from '../combat/sim';
import { COLORS, CSS, FONT_BODY, FONT_TITLE, txt } from './theme';
import { arrows } from '../scenes/SelectScene';

const BAR_W = 500, BAR_H = 28, BAR_Y = 26;
const SLOT_KEYS = ['L', '→L', '↓L', '↑L'];

/** In-fight HUD: health, meter, timer, round pips, special cooldowns, combo and announcements. */
export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private names: Phaser.GameObjects.Text[] = [];
  private timerText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text[] = [];
  private comboSub: Phaser.GameObjects.Text[] = [];
  private announce: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private slotLabels: Phaser.GameObjects.Text[][] = [[], []];
  private ultLabel: Phaser.GameObjects.Text[] = [];
  private finishTitle: Phaser.GameObjects.Text;
  private finishHint: Phaser.GameObjects.Text;
  private shown: [number, number] = [1, 1];
  private lag: [number, number] = [1, 1];
  private labelText: Phaser.GameObjects.Text;
  readonly container: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, private chars: [CharacterDef, CharacterDef], private humans: [boolean, boolean], label?: string) {
    this.g = scene.add.graphics().setDepth(100);
    const objs: Phaser.GameObjects.GameObject[] = [this.g];
    for (const i of [0, 1] as const) {
      const x = i === 0 ? 40 : GAME_W - 40;
      const n = txt(scene, x, BAR_Y + BAR_H + 6, chars[i].name.toUpperCase(), 20, CSS.goldLight, { title: true, origin: [i === 0 ? 0 : 1, 0], depth: 101 });
      this.names.push(n);
      const cx = i === 0 ? 150 : GAME_W - 150;
      const c = txt(scene, cx, 300, '', 56, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 101 });
      const s = txt(scene, cx, 350, '', 22, CSS.white, { origin: [0.5, 0.5], depth: 101 });
      this.comboText.push(c); this.comboSub.push(s);
      for (let k = 0; k < 4; k++) {
        const sx = i === 0 ? 48 + k * 52 : GAME_W - 48 - (3 - k) * 52;
        this.slotLabels[i].push(txt(scene, sx, GAME_H - 38, SLOT_KEYS[k], 13, CSS.white, { origin: [0.5, 0.5], depth: 102, strokeW: 2 }));
      }
      this.ultLabel.push(txt(scene, i === 0 ? 300 : GAME_W - 300, GAME_H - 66, '', 15, CSS.goldLight, { origin: [0.5, 0.5], depth: 102, title: true }));
      objs.push(n, c, s, ...this.slotLabels[i], this.ultLabel[i]);
    }
    this.timerText = txt(scene, GAME_W / 2, 56, '99', 46, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 102 });
    this.announce = txt(scene, GAME_W / 2, 250, '', 120, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 110, strokeW: 10, shadow: true });
    this.sub = txt(scene, GAME_W / 2, 340, '', 30, CSS.white, { title: true, origin: [0.5, 0.5], depth: 110, strokeW: 5 });
    this.finishTitle = txt(scene, GAME_W / 2, 215, '', 56, CSS.red, { title: true, origin: [0.5, 0.5], depth: 110, strokeW: 8, shadow: true });
    this.finishHint = txt(scene, GAME_W / 2, 290, '', 40, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 110, strokeW: 6 });
    this.labelText = txt(scene, GAME_W / 2, 100, label ?? '', 16, CSS.dim, { origin: [0.5, 0.5], depth: 101 });
    objs.push(this.timerText, this.announce, this.sub, this.finishTitle, this.finishHint, this.labelText);
    this.container = scene.add.container(0, 0, objs).setDepth(100);
    // The container re-parents depth; keep children relative order via their own depth values
    void FONT_BODY; void FONT_TITLE;
  }

  say(text: string, sub = '', color: string = CSS.goldLight, size = 120): void {
    this.announce.setText(text).setColor(color).setFontSize(size).setAlpha(1).setScale(2.2);
    this.sub.setText(sub).setAlpha(1);
    this.scene.tweens.killTweensOf([this.announce, this.sub]);
    this.scene.tweens.add({ targets: this.announce, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: [this.announce, this.sub], alpha: 0, delay: 900, duration: 400 });
  }
  sticky(text: string, sub = '', color: string = CSS.goldLight, size = 90): void {
    this.announce.setText(text).setColor(color).setFontSize(size).setAlpha(1).setScale(2);
    this.sub.setText(sub).setAlpha(1);
    this.scene.tweens.killTweensOf([this.announce, this.sub]);
    this.scene.tweens.add({ targets: this.announce, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
  clearAnnounce(): void { this.announce.setAlpha(0); this.sub.setAlpha(0); }
  setVisible(v: boolean): void { this.container.setVisible(v); }

  showFinish(winner: 0 | 1, secondaryAvailable: boolean): void {
    const c = this.chars[winner];
    this.finishTitle.setText('¡SELLÁ LA LEYENDA!').setAlpha(1);
    const prim = `${arrows(c.fatality.input)} + Remate`;
    this.finishHint.setText(prim + (secondaryAvailable ? `\n(secundario: ${arrows(c.secondary.input)})` : '')).setAlpha(1);
    this.finishHint.setFontSize(secondaryAvailable ? 32 : 40);
  }
  hideFinish(): void { this.finishTitle.setAlpha(0); this.finishHint.setAlpha(0); }

  update(sim: FightSim): void {
    const g = this.g; g.clear();
    const fs = sim.fighters;
    for (const i of [0, 1] as const) {
      const f = fs[i];
      const frac = Math.max(0, f.hp / f.maxHp);
      this.shown[i] += (frac - this.shown[i]) * 0.5;
      this.lag[i] += (frac - this.lag[i]) * 0.035;
      if (this.lag[i] < frac) this.lag[i] = frac;
      const x = i === 0 ? 40 : GAME_W - 40 - BAR_W;
      // frame
      g.fillStyle(0x000000, 0.75); g.fillRoundedRect(x - 6, BAR_Y - 6, BAR_W + 12, BAR_H + 12, 6);
      g.lineStyle(2, COLORS.gold, 0.9); g.strokeRoundedRect(x - 6, BAR_Y - 6, BAR_W + 12, BAR_H + 12, 6);
      const fillW = (v: number) => BAR_W * Math.max(0, Math.min(1, v));
      const draw = (w: number, color: number, a = 1) => {
        g.fillStyle(color, a);
        if (i === 0) g.fillRect(x, BAR_Y, w, BAR_H); else g.fillRect(x + BAR_W - w, BAR_Y, w, BAR_H);
      };
      draw(fillW(this.lag[i]), 0xe8e0c0, 0.85);
      const col = frac > 0.5 ? 0x5fcf6a : frac > 0.25 ? 0xe0b030 : 0xd83a2a;
      draw(fillW(frac), col);
      draw(fillW(frac) * 1, 0xffffff, 0.12);
      g.fillStyle(0x000000, 0.18);
      if (i === 0) g.fillRect(x, BAR_Y + BAR_H / 2, fillW(frac), BAR_H / 2); else g.fillRect(x + BAR_W - fillW(frac), BAR_Y + BAR_H / 2, fillW(frac), BAR_H / 2);
      // round pips
      for (let r = 0; r < sim.cfg.roundsToWin; r++) {
        const px = i === 0 ? GAME_W / 2 - 70 - r * 22 : GAME_W / 2 + 70 + r * 22, py = 62;
        g.lineStyle(2, COLORS.gold, 1); g.fillStyle(r < sim.wins[i] ? COLORS.gold : 0x000000, r < sim.wins[i] ? 1 : 0.6);
        g.beginPath(); g.moveTo(px, py - 8); g.lineTo(px + 8, py); g.lineTo(px, py + 8); g.lineTo(px - 8, py); g.closePath(); g.fillPath(); g.strokePath();
      }
      // meter
      const mx = i === 0 ? 40 : GAME_W - 40 - 360, my = GAME_H - 82;
      const m = f.meter / 100;
      g.fillStyle(0x000000, 0.75); g.fillRoundedRect(mx - 4, my - 4, 368, 20, 5);
      const pulse = 0.65 + 0.35 * Math.sin(sim.frame * 0.2);
      const mc = f.meter >= 100 ? 0xffe070 : f.meter >= 50 ? 0xff9a2a : 0xb8862a;
      g.fillStyle(mc, f.meter >= 50 ? pulse : 1);
      const mw = 360 * m;
      if (i === 0) g.fillRect(mx, my, mw, 12); else g.fillRect(mx + 360 - mw, my, mw, 12);
      g.lineStyle(1, COLORS.gold, 0.9); g.strokeRoundedRect(mx - 4, my - 4, 368, 20, 5);
      // EX marker
      const ex = mx + (i === 0 ? 180 : 180);
      g.lineStyle(1, 0xffffff, 0.5); g.lineBetween(ex, my, ex, my + 12);
      this.ultLabel[i].setText(f.meter >= 100 ? '¡DEFINITIVO LISTO! (Remate)' : f.meter >= 50 ? 'EX DISPONIBLE (Bloq + Esp)' : '');
      this.ultLabel[i].setPosition(i === 0 ? mx + 180 : mx + 180, my - 14);
      // special slots with cooldown
      const def = this.chars[i].specials;
      for (let k = 0; k < 4; k++) {
        const sx = i === 0 ? 48 + k * 52 : GAME_W - 48 - (3 - k) * 52;
        const cd = f.cooldowns[k], tot = Math.max(1, def[k].cooldown);
        g.fillStyle(0x000000, 0.7); g.fillCircle(sx, GAME_H - 38, 20);
        g.fillStyle(cd > 0 ? 0x554a38 : COLORS.gold, cd > 0 ? 0.8 : 0.95);
        g.fillCircle(sx, GAME_H - 38, 17);
        if (cd > 0) {
          g.fillStyle(0x000000, 0.65);
          g.slice(sx, GAME_H - 38, 17, -Math.PI / 2, -Math.PI / 2 + (cd / tot) * Math.PI * 2, false);
          g.fillPath();
        }
        g.lineStyle(2, cd > 0 ? 0x554a38 : COLORS.goldLight, 1); g.strokeCircle(sx, GAME_H - 38, 19);
        this.slotLabels[i][k].setColor(cd > 0 ? '#9a8a6a' : '#1a1008');
      }
      // buffs
      f.activeBuffs.forEach((b, bi) => {
        const bx = i === 0 ? 48 + bi * 26 : GAME_W - 48 - bi * 26;
        g.fillStyle(b.color, 0.9); g.fillCircle(bx, GAME_H - 118, 9);
        g.lineStyle(1, 0xffffff, 0.8); g.strokeCircle(bx, GAME_H - 118, 9);
        g.fillStyle(0x000000, 0.5); g.fillRect(bx - 9, GAME_H - 106, 18, 3);
        g.fillStyle(b.color, 1); g.fillRect(bx - 9, GAME_H - 106, 18 * Math.min(1, b.frames / 600), 3);
      });
      // combo
      const c = sim.combo[i];
      const show = c.hits >= 2 && c.timer > 0;
      this.comboText[i].setText(show ? `${c.hits} GOLPES` : '').setAlpha(show ? Math.min(1, c.timer / 30) : 0);
      this.comboText[i].setFontSize(Math.min(70, 40 + c.hits * 3));
      this.comboSub[i].setText(show ? `Daño ${Math.round(c.damage)}` : '').setAlpha(show ? Math.min(1, c.timer / 30) : 0);
    }
    // timer
    g.fillStyle(0x000000, 0.8); g.fillCircle(GAME_W / 2, 56, 36);
    g.lineStyle(3, COLORS.gold, 1); g.strokeCircle(GAME_W / 2, 56, 36);
    const ts = sim.timerSeconds;
    this.timerText.setText(ts < 0 ? '∞' : String(ts));
    this.timerText.setColor(ts >= 0 && ts <= 10 ? CSS.red : CSS.goldLight);
    // finish countdown bar
    if (sim.phase === 'finish') {
      const t = 1 - sim.phaseT / 660;
      g.fillStyle(0x000000, 0.6); g.fillRect(GAME_W / 2 - 200, 340, 400, 8);
      g.fillStyle(COLORS.red, 1); g.fillRect(GAME_W / 2 - 200, 340, 400 * t, 8);
    }
  }
}
