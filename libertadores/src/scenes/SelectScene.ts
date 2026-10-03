import Phaser from 'phaser';
import { GAME_H, GAME_W, type CharacterDef, type FatInput } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { ROSTER } from '../characters';
import { SECONDARY_WINS_REQUIRED, charStat, getSettings, secondaryUnlocked } from '../systems/storage';
import { COLORS, CSS, MenuBackdrop, fadeIn, fadeTo, navFrom, panel, screenTitle, txt } from '../ui/theme';
import { drawFighter, drawPortrait, drawPortraitBackdrop } from '../ui/fighterRenderer';
import { previewView } from '../ui/preview';
import type { Mode } from '../game/flow';

const COLS = 5, TILE = 104, GAP = 10, GX = 40, GY = 140;
export const arrows = (inp: FatInput[]) => inp.map((d) => ({ F: '→', B: '←', U: '↑', D: '↓' }[d])).join(' ');
const SLOT_KEY = ['L', '→ + L', '↓ + L', '↑ + L'];

interface SelData { mode: Mode; step?: 'p1' | 'p2'; p1?: string }

export class SelectScene extends Phaser.Scene {
  private d!: SelData;
  private idx = 0;
  private bd!: MenuBackdrop;
  private gSel!: Phaser.GameObjects.Graphics;
  private gFighter!: Phaser.GameObjects.Graphics;
  private info: Phaser.GameObjects.GameObject[] = [];
  private frame = 0;
  private lastTap = -1;
  constructor() { super('Select'); }
  init(d: SelData): void { this.d = { step: 'p1', ...d }; this.info = []; this.frame = 0; this.lastTap = -1; }

  create(): void {
    fadeIn(this);
    AudioManager.get().playMusic('select');
    this.bd = new MenuBackdrop(this);
    const p2 = this.d.step === 'p2';
    const title = this.d.mode === 'versus' ? (p2 ? 'JUGADOR 2: ELEGÍ TU PELEADOR' : 'JUGADOR 1: ELEGÍ TU PELEADOR')
      : p2 ? 'ELEGÍ A TU RIVAL' : this.d.mode === 'tournament' ? 'ELEGÍ TU LIBERTADOR' : 'ELEGÍ TU PELEADOR';
    screenTitle(this, title, this.d.mode === 'tournament' ? '20 leyendas, una sola corona' : undefined);
    this.idx = p2 ? Math.min(19, ROSTER.findIndex((c) => c.id === this.d.p1) + 1) % 20 : 0;

    const g = this.add.graphics();
    ROSTER.forEach((c, i) => {
      const x = GX + (i % COLS) * (TILE + GAP), y = GY + Math.floor(i / COLS) * (TILE + GAP);
      drawPortraitBackdrop(g, c, x, y, TILE, TILE);
      drawPortrait(g, c, x + TILE / 2, y + TILE / 2 + 4, TILE - 10);
      g.lineStyle(2, COLORS.goldDark, 1); g.strokeRect(x, y, TILE, TILE);
      const z = this.add.zone(x, y, TILE, TILE).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { if (this.idx !== i) { this.idx = i; AudioManager.get().sfx('menuMove'); this.refresh(); } });
      z.on('pointerdown', () => {
        if (this.idx === i && this.time.now - this.lastTap < 1200) this.confirm();
        else { this.idx = i; this.refresh(); }
        this.lastTap = this.time.now;
      });
    });
    panel(g, 630, 128, 620, 566, { alpha: 0.9 });
    this.gSel = this.add.graphics().setDepth(5);
    this.gFighter = this.add.graphics().setDepth(6);
    // confirm button (touch friendly)
    const bx = 1080, by = 640;
    const btn = this.add.graphics().setDepth(7);
    btn.fillStyle(COLORS.gold, 0.9); btn.fillRoundedRect(bx, by, 150, 38, 8);
    txt(this, bx + 75, by + 19, 'ELEGIR ▶', 20, '#1a1008', { title: true, origin: [0.5, 0.5], strokeW: 0, depth: 8 });
    this.add.zone(bx, by, 150, 38).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
    txt(this, 40, GAME_H - 50, '← ↑ ↓ → mover · Enter confirmar · R aleatorio · Esc volver', 16, CSS.dim);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.refresh();
  }

  private onKey(e: KeyboardEvent): void {
    const k = navFrom(e);
    const a = AudioManager.get(); a.unlock();
    if (e.code === 'KeyR') { this.idx = Math.floor(Math.random() * 20); a.sfx('menuMove'); this.refresh(); return; }
    if (!k) return;
    if (k === 'left') this.idx = (this.idx % COLS === 0 ? this.idx + COLS - 1 : this.idx - 1);
    else if (k === 'right') this.idx = (this.idx % COLS === COLS - 1 ? this.idx - COLS + 1 : this.idx + 1);
    else if (k === 'up') this.idx = (this.idx - COLS + 20) % 20;
    else if (k === 'down') this.idx = (this.idx + COLS) % 20;
    else if (k === 'confirm') { this.confirm(); return; }
    else if (k === 'back') { this.back(); return; }
    a.sfx('menuMove');
    this.refresh();
  }

  private back(): void {
    AudioManager.get().sfx('menuBack');
    if (this.d.step === 'p2') fadeTo(this, 'Select', { mode: this.d.mode, step: 'p1' });
    else fadeTo(this, 'Menu');
  }

  private confirm(): void {
    const id = ROSTER[this.idx].id;
    AudioManager.get().sfx('menuSelect');
    const a = AudioManager.get(); a.speak(ROSTER[this.idx].name, { rate: 0.95 });
    if (this.d.mode === 'tournament') { fadeTo(this, 'Tournament', { player: id }); return; }
    if (this.d.step === 'p1') { fadeTo(this, 'Select', { mode: this.d.mode, step: 'p2', p1: id }); return; }
    fadeTo(this, 'Setup', { mode: this.d.mode, p1: this.d.p1, p2: id });
  }

  private refresh(): void {
    this.info.forEach((o) => o.destroy()); this.info = [];
    const c = ROSTER[this.idx];
    const g = this.gSel; g.clear();
    const x = GX + (this.idx % COLS) * (TILE + GAP), y = GY + Math.floor(this.idx / COLS) * (TILE + GAP);
    g.lineStyle(4, COLORS.goldLight, 1); g.strokeRect(x - 2, y - 2, TILE + 4, TILE + 4);
    g.fillStyle(COLORS.gold, 0.12); g.fillRect(x, y, TILE, TILE);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.info.push(o); return o; };
    const T = (px: number, py: number, s: string, size: number, color: string, o = {}) => add(txt(this, px, py, s, size, color, { depth: 8, ...o }));
    const px = 850;
    T(px, 140, c.name.toUpperCase(), c.name.length > 18 ? 24 : 30, CSS.goldLight, { title: true, wrap: 380 });
    T(px, 184, c.title, 19, CSS.gold, { wrap: 380 });
    T(px, 236, `${c.archetype}`, 17, CSS.white);
    const dcol = c.difficulty === 'Fácil' ? CSS.green : c.difficulty === 'Medio' ? CSS.goldLight : CSS.red;
    T(px, 260, `Dificultad: ${c.difficulty}`, 17, dcol);
    T(px, 292, c.bio, 15, CSS.dim, { wrap: 385 });
    // stats
    const st = c.stats;
    const bars: [string, number][] = [
      ['Vida', st.health / 1150], ['Velocidad', st.walkSpeed / 5.2], ['Ataque', st.attack / 1.2],
      ['Defensa', st.defense / 1.2], ['Alcance', c.normals.heavyReach / 120],
    ];
    const gg = add(this.add.graphics().setDepth(8));
    bars.forEach(([l, v], i) => {
      const by = 400 + i * 28;
      T(660, by - 2, l, 16, CSS.white);
      gg.fillStyle(0x000000, 0.7); gg.fillRect(760, by + 2, 160, 14);
      gg.fillStyle(COLORS.gold, 1); gg.fillRect(760, by + 2, Math.max(6, Math.min(1, v) * 160), 14);
      gg.lineStyle(1, COLORS.goldDark, 1); gg.strokeRect(760, by + 2, 160, 14);
    });
    // specials
    T(950, 384, 'ESPECIALES', 16, CSS.gold, { title: true });
    c.specials.forEach((s, i) => {
      T(950, 408 + i * 26, `${SLOT_KEY[i].padEnd(6)} ${s.name}`, 15, CSS.white);
    });
    T(950, 516, 'Ult: O / Num6 con medidor 100', 13, CSS.dim);
    // fatalities
    T(660, 548, 'REMATE', 15, CSS.gold, { title: true });
    T(660, 568, `${c.fatality.name}`, 18, CSS.goldLight, { title: true });
    T(660, 592, `${arrows(c.fatality.input)} + Remate`, 17, CSS.white);
    const unlocked = secondaryUnlocked(c.id);
    const wins = charStat(c.id).wins;
    T(950, 548, 'REMATE SECUNDARIO', 15, CSS.gold, { title: true });
    T(950, 568, unlocked ? c.secondary.name : `🔒 ${c.secondary.name}`, 17, unlocked ? CSS.goldLight : CSS.dim, { title: true, wrap: 290 });
    T(950, 614, unlocked ? `${arrows(c.secondary.input)} + Remate` : `Victorias: ${Math.min(wins, SECONDARY_WINS_REQUIRED)}/${SECONDARY_WINS_REQUIRED}`, 17, unlocked ? CSS.white : CSS.dim);
    T(660, 636, `Victorias: ${wins}   ·   Remates: ${charStat(c.id).fatalities}`, 15, CSS.dim);
    void getSettings;
  }

  update(t: number): void {
    this.bd.update(t);
    this.frame++;
    const c: CharacterDef = ROSTER[this.idx];
    const g = this.gFighter; g.clear();
    g.fillStyle(0x000000, 0.35); g.fillEllipse(745, 352, 150, 22);
    drawFighter(g, previewView(c, 745, 350, this.frame), { scale: 1, shadow: false });
  }
}
