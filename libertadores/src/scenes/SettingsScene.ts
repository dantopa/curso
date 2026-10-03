import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import {
  ACTIONS, ACTION_LABEL, DEFAULT_P1, DEFAULT_P2, getSettings, resetProgress, saveSettings, type ActionKey,
} from '../systems/storage';
import { COLORS, CSS, MenuBackdrop, MenuList, fadeIn, fadeTo, navFrom, onNav, panel, screenTitle, txt } from '../ui/theme';
import { DIFFICULTY_LABEL } from '../ai/ai';
import type { Difficulty } from '../combat/types';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const step = (v: number, d: number) => Math.max(0, Math.min(1, Math.round((v + d * 0.1) * 10) / 10));

export class SettingsScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  private flash?: Phaser.GameObjects.Text;
  constructor() { super('Settings'); }
  create(): void {
    fadeIn(this);
    this.bd = new MenuBackdrop(this);
    screenTitle(this, 'OPCIONES', 'Audio, juego y controles');
    const s = getSettings();
    const apply = () => {
      AudioManager.get().setVolumes({ master: s.master, sfx: s.sfx, music: s.music, voice: s.voice });
      saveSettings();
    };
    const diffs: Difficulty[] = ['novice', 'fighter', 'veteran', 'legend'];
    const touchModes = ['auto', 'on', 'off'] as const;
    const touchLabel = { auto: 'Automático', on: 'Siempre', off: 'Nunca' };
    const items = [
      { label: 'Volumen general', value: () => pct(s.master), onLeft: () => { s.master = step(s.master, -1); apply(); }, onRight: () => { s.master = step(s.master, 1); apply(); } },
      { label: 'Efectos', value: () => pct(s.sfx), onLeft: () => { s.sfx = step(s.sfx, -1); apply(); AudioManager.get().sfx('heavyHit'); }, onRight: () => { s.sfx = step(s.sfx, 1); apply(); AudioManager.get().sfx('heavyHit'); } },
      { label: 'Música', value: () => pct(s.music), onLeft: () => { s.music = step(s.music, -1); apply(); }, onRight: () => { s.music = step(s.music, 1); apply(); } },
      { label: 'Voz del locutor', value: () => (s.voice === 0 ? 'No' : pct(s.voice)), onLeft: () => { s.voice = step(s.voice, -1); apply(); }, onRight: () => { s.voice = step(s.voice, 1); apply(); } },
      { label: 'Dificultad por defecto', value: () => DIFFICULTY_LABEL[s.difficulty],
        onLeft: () => { s.difficulty = diffs[(diffs.indexOf(s.difficulty) + 3) % 4]; saveSettings(); },
        onRight: () => { s.difficulty = diffs[(diffs.indexOf(s.difficulty) + 1) % 4]; saveSettings(); } },
      { label: 'Controles táctiles', value: () => touchLabel[s.touch],
        onLeft: () => { s.touch = touchModes[(touchModes.indexOf(s.touch) + 2) % 3]; saveSettings(); },
        onRight: () => { s.touch = touchModes[(touchModes.indexOf(s.touch) + 1) % 3]; saveSettings(); } },
      { label: 'Sacudida de pantalla', value: () => (s.shake ? 'Sí' : 'No'), onLeft: () => { s.shake = !s.shake; saveSettings(); }, onRight: () => { s.shake = !s.shake; saveSettings(); } },
      { label: 'Desbloquear remates secundarios', value: () => (s.unlockAll ? 'Sí' : 'No'), onLeft: () => { s.unlockAll = !s.unlockAll; saveSettings(); }, onRight: () => { s.unlockAll = !s.unlockAll; saveSettings(); } },
      { label: 'Configurar controles', onSelect: () => fadeTo(this, 'Remap') },
      { label: 'Borrar progreso', onSelect: () => { resetProgress(); this.say('Progreso borrado.'); } },
      { label: 'Volver', onSelect: () => fadeTo(this, 'Menu') },
    ];
    new MenuList(this, GAME_W / 2, 175, items, { size: 26, gap: 46, width: 700, center: true });
    onNav(this, (k) => { if (k === 'back') fadeTo(this, 'Menu'); });
  }
  private say(m: string): void {
    this.flash?.destroy();
    this.flash = txt(this, GAME_W / 2, GAME_H - 34, m, 20, CSS.goldLight, { origin: [0.5, 0.5] });
    this.time.delayedCall(1800, () => this.flash?.destroy());
  }
  update(t: number): void { this.bd.update(t); }
}

/** Key remapping table for both players. */
export class RemapScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  private sel = { p: 0, a: 0 };
  private waiting = false;
  private g!: Phaser.GameObjects.Graphics;
  private cells: Phaser.GameObjects.Text[][] = [[], []];
  private hint!: Phaser.GameObjects.Text;
  constructor() { super('Remap'); }
  create(): void {
    fadeIn(this);
    this.bd = new MenuBackdrop(this);
    screenTitle(this, 'CONTROLES', 'Elegí una celda, Enter para reasignar (Esc cancela)');
    this.g = this.add.graphics();
    txt(this, 330, 150, 'ACCIÓN', 20, CSS.gold, { title: true });
    txt(this, 700, 150, 'JUGADOR 1', 20, CSS.gold, { title: true, origin: [0.5, 0] });
    txt(this, 940, 150, 'JUGADOR 2', 20, CSS.gold, { title: true, origin: [0.5, 0] });
    ACTIONS.forEach((a, i) => {
      txt(this, 330, 190 + i * 40, ACTION_LABEL[a], 22, CSS.white);
      for (const p of [0, 1]) this.cells[p].push(txt(this, p === 0 ? 700 : 940, 190 + i * 40, '', 22, CSS.white, { origin: [0.5, 0] }));
    });
    this.hint = txt(this, GAME_W / 2, 650, '', 20, CSS.goldLight, { origin: [0.5, 0.5] });
    txt(this, GAME_W / 2, 690, 'R: restaurar valores por defecto   ·   Esc: volver', 16, CSS.dim, { origin: [0.5, 0.5] });
    this.redraw();
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.cells.forEach((col, p) => col.forEach((c, a) => {
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => { this.sel = { p, a }; this.startWait(); });
    }));
  }
  private startWait(): void { this.waiting = true; this.hint.setText('Presioná la nueva tecla…'); this.redraw(); }
  private onKey(e: KeyboardEvent): void {
    const s = getSettings();
    if (this.waiting) {
      e.preventDefault();
      this.waiting = false; this.hint.setText('');
      if (e.code !== 'Escape') {
        const map = this.sel.p === 0 ? s.p1 : s.p2;
        map[ACTIONS[this.sel.a] as ActionKey] = e.code;
        saveSettings();
        AudioManager.get().sfx('menuSelect');
      }
      this.redraw();
      return;
    }
    if (e.code === 'KeyR') { s.p1 = { ...DEFAULT_P1 }; s.p2 = { ...DEFAULT_P2 }; saveSettings(); this.redraw(); return; }
    const k = navFrom(e);
    if (k === 'back') fadeTo(this, 'Settings');
    else if (k === 'up') this.sel.a = (this.sel.a + 9) % 10;
    else if (k === 'down') this.sel.a = (this.sel.a + 1) % 10;
    else if (k === 'left') this.sel.p = 0;
    else if (k === 'right') this.sel.p = 1;
    else if (k === 'confirm') this.startWait();
    if (k) { AudioManager.get().sfx('menuMove'); this.redraw(); }
  }
  private redraw(): void {
    const s = getSettings();
    this.g.clear();
    panel(this.g, 300, 135, 760, 470);
    this.g.fillStyle(COLORS.gold, 0.22);
    this.g.fillRoundedRect(this.sel.p === 0 ? 620 : 860, 186 + this.sel.a * 40, 160, 36, 6);
    this.cells.forEach((col, p) => col.forEach((c, a) => {
      const code = (p === 0 ? s.p1 : s.p2)[ACTIONS[a]];
      const sel = this.sel.p === p && this.sel.a === a;
      c.setText(this.waiting && sel ? '…' : code.replace('Key', '').replace('Arrow', '↔').replace('Numpad', 'Num ').replace('Digit', ''));
      c.setColor(sel ? CSS.goldLight : CSS.white);
    }));
  }
  update(t: number): void { this.bd.update(t); }
}
