import Phaser from 'phaser';
import { GAME_H, GAME_W, type CharacterDef, type FatInput } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { getCharacter } from '../characters';
import { SECONDARY_WINS_REQUIRED, charStat, secondaryUnlocked } from '../systems/storage';
import { COLORS, CSS, MenuBackdrop, drawSunEmblem, fadeIn, fadeTo, navFrom, portraitImage, txt } from '../ui/theme';
import { drawFighter, drawPortrait, drawPortraitBackdrop } from '../ui/fighterRenderer';
import { previewView } from '../ui/preview';
import { shortName } from '../ui/names';
import type { Mode } from '../game/flow';

const COLS = 10, ROWS = 2, CW = 116, CH = 190, GAP = 8, GX = 24, GY = 116;
/** Grid order (two rows of ten). */
const GRID = [
  'bolivar', 'sanmartin', 'tupacamaru', 'sucre', 'louverture', 'hidalgo', 'morelos', 'ohiggins', 'artigas', 'miranda',
  'belgrano', 'guemes', 'cordova', 'juarez', 'guerrero', 'iturbide', 'marti', 'micaela', 'katari', 'manco',
];
export const arrows = (inp: FatInput[]) => inp.map((d) => ({ F: '→', B: '←', U: '↑', D: '↓' }[d])).join(' ');
const SLOT_KEY = ['L', '→ + L', '↓ + L', '↑ + L'];
const SY = 514;

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

  private get cur(): CharacterDef { return getCharacter(GRID[this.idx]); }

  create(): void {
    fadeIn(this);
    AudioManager.get().playMusic('select');
    this.bd = new MenuBackdrop(this);
    const p2 = this.d.step === 'p2';
    const title = this.d.mode === 'versus' ? (p2 ? 'JUGADOR 2 · SELECCIONA TU PELEADOR' : 'JUGADOR 1 · SELECCIONA TU PELEADOR')
      : p2 ? 'SELECCIONA A TU RIVAL' : this.d.mode === 'tournament' ? 'SELECCIONA TU LIBERTADOR' : 'SELECCIONA TU PELEADOR';
    // header: logo + original sun emblems
    const head = this.add.graphics().setDepth(4);
    drawSunEmblem(head, 290, 52, 34); drawSunEmblem(head, GAME_W - 290, 52, 34);
    txt(this, GAME_W / 2, 40, 'LIBERTADORES', 44, CSS.goldLight, { title: true, origin: [0.5, 0.5], shadow: true, strokeW: 5, depth: 5 });
    txt(this, GAME_W / 2, 88, title.split('').join(' '), 15, CSS.white, { origin: [0.5, 0.5], depth: 5, strokeW: 2 });

    this.idx = p2 ? (GRID.indexOf(this.d.p1!) + 1) % 20 : 0;
    const g = this.add.graphics().setDepth(3);
    GRID.forEach((id, i) => {
      const c = getCharacter(id);
      const x = GX + (i % COLS) * (CW + GAP), y = GY + Math.floor(i / COLS) * (CH + GAP);
      if (!portraitImage(this, id, x, y, CW, CH, 4)) {
        drawPortraitBackdrop(g, c, x, y, CW, CH);
        drawPortrait(g, c, x + CW / 2, y + CH / 2 - 14, CW - 8);
      }
      // name plate
      const plate = this.add.graphics().setDepth(6);
      plate.fillStyle(0x000000, 0.82); plate.fillRect(x, y + CH - 40, CW, 40);
      plate.lineStyle(1, COLORS.goldDark, 1); plate.strokeRect(x, y, CW, CH);
      const words = c.name.toUpperCase().replace(' DE ', ' de ').split(' ');
      const nm = c.id === 'tupacamaru' ? ['TÚPAC', 'AMARU II'] : c.id === 'katari' ? ['TÚPAC', 'KATARI'] : [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')];
      txt(this, x + CW / 2, y + CH - 21, nm.join('\n'), 12, CSS.white, { origin: [0.5, 0.5], depth: 7, align: 'center', title: true, strokeW: 2 });
      const z = this.add.zone(x, y, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { if (this.idx !== i) { this.idx = i; AudioManager.get().sfx('menuMove'); this.refresh(); } });
      z.on('pointerdown', () => {
        if (this.idx === i && this.time.now - this.lastTap < 1200) this.confirm();
        else { this.idx = i; this.refresh(); }
        this.lastTap = this.time.now;
      });
    });
    // detail strip
    g.fillStyle(COLORS.panel, 0.92); g.fillRoundedRect(GX, SY, GAME_W - GX * 2, 160, 8);
    g.lineStyle(2, COLORS.goldDark, 1); g.strokeRoundedRect(GX, SY, GAME_W - GX * 2, 160, 8);
    this.gSel = this.add.graphics().setDepth(8);
    this.gFighter = this.add.graphics().setDepth(9);
    // confirm button
    const bx = GAME_W - GX - 150, by = SY + 160 - 46;
    const btn = this.add.graphics().setDepth(9);
    btn.fillStyle(COLORS.gold, 0.95); btn.fillRoundedRect(bx, by, 138, 34, 8);
    txt(this, bx + 69, by + 17, 'ELEGIR ▶', 18, '#1a1008', { title: true, origin: [0.5, 0.5], strokeW: 0, depth: 10 });
    this.add.zone(bx, by, 138, 34).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm()).setDepth(11);
    txt(this, GAME_W / 2, GAME_H - 22, '← ↑ ↓ →  mover   ·   Enter  seleccionar   ·   R  aleatorio   ·   Esc  atrás', 15, CSS.dim, { origin: [0.5, 0.5], depth: 5 });
    txt(this, GAME_W - 30, GAME_H - 22, this.d.mode === 'tournament' ? 'TORNEO · 20 PELEADORES' : '20 PELEADORES', 14, CSS.dim, { origin: [1, 0.5], depth: 5 });
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
    else if (k === 'up' || k === 'down') this.idx = (this.idx + COLS) % (COLS * ROWS);
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
    const c = this.cur;
    AudioManager.get().sfx('menuSelect');
    AudioManager.get().speak(c.name, { rate: 0.95 });
    if (this.d.mode === 'tournament') { fadeTo(this, 'Tournament', { player: c.id }); return; }
    if (this.d.step === 'p1') { fadeTo(this, 'Select', { mode: this.d.mode, step: 'p2', p1: c.id }); return; }
    fadeTo(this, 'Setup', { mode: this.d.mode, p1: this.d.p1, p2: c.id });
  }

  private refresh(): void {
    this.info.forEach((o) => o.destroy()); this.info = [];
    const c = this.cur;
    const g = this.gSel; g.clear();
    const x = GX + (this.idx % COLS) * (CW + GAP), y = GY + Math.floor(this.idx / COLS) * (CH + GAP);
    g.lineStyle(4, COLORS.goldLight, 1); g.strokeRect(x - 2, y - 2, CW + 4, CH + 4);
    g.lineStyle(10, COLORS.gold, 0.25); g.strokeRect(x - 6, y - 6, CW + 12, CH + 12);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.info.push(o); return o; };
    const T = (px: number, py: number, s: string, size: number, color: string, o = {}) => add(txt(this, px, py, s, size, color, { depth: 10, ...o }));
    const ty = SY + 10;
    // info column
    T(170, ty, c.name.toUpperCase(), c.name.length > 20 ? 18 : 22, CSS.goldLight, { title: true, wrap: 270 });
    T(170, ty + 28, c.title, 15, CSS.gold, { wrap: 270 });
    T(170, ty + 52, c.archetype, 14, CSS.white);
    const dcol = c.difficulty === 'Fácil' ? CSS.green : c.difficulty === 'Medio' ? CSS.goldLight : CSS.red;
    T(170, ty + 72, `Dificultad: ${c.difficulty}`, 14, dcol);
    T(170, ty + 94, c.bio, 12, CSS.dim, { wrap: 270 });
    // stats
    const st = c.stats;
    const bars: [string, number][] = [
      ['Vida', st.health / 1150], ['Velocidad', st.walkSpeed / 5.2], ['Ataque', st.attack / 1.2],
      ['Defensa', st.defense / 1.2], ['Alcance', c.normals.heavyReach / 120],
    ];
    const gg = add(this.add.graphics().setDepth(10));
    bars.forEach(([l, v], i) => {
      const by = ty + i * 25;
      T(460, by, l, 14, CSS.white);
      gg.fillStyle(0x000000, 0.7); gg.fillRect(550, by + 3, 120, 12);
      gg.fillStyle(COLORS.gold, 1); gg.fillRect(550, by + 3, Math.max(6, Math.min(1, v) * 120), 12);
      gg.lineStyle(1, COLORS.goldDark, 1); gg.strokeRect(550, by + 3, 120, 12);
    });
    // specials
    T(700, ty - 2, 'ESPECIALES', 14, CSS.gold, { title: true });
    c.specials.forEach((s, i) => T(700, ty + 20 + i * 22, `${SLOT_KEY[i].padEnd(6)} ${s.name}`, 14, CSS.white));
    T(700, ty + 112, 'Definitivo: O / Num6 con medidor 100', 12, CSS.dim);
    // fatalities
    T(960, ty - 2, 'REMATE', 14, CSS.gold, { title: true });
    T(960, ty + 17, c.fatality.name, 16, CSS.goldLight, { title: true, wrap: 280 });
    T(960, ty + 40, `${arrows(c.fatality.input)} + Remate`, 15, CSS.white);
    const unlocked = secondaryUnlocked(c.id), wins = charStat(c.id).wins;
    T(960, ty + 66, 'SECUNDARIO', 14, CSS.gold, { title: true });
    T(960, ty + 84, unlocked ? c.secondary.name : `🔒 ${c.secondary.name}`, 14, unlocked ? CSS.goldLight : CSS.dim, { wrap: 290 });
    T(960, ty + 104, unlocked ? `${arrows(c.secondary.input)} + Remate` : `Victorias: ${Math.min(wins, SECONDARY_WINS_REQUIRED)}/${SECONDARY_WINS_REQUIRED}`, 14, unlocked ? CSS.white : CSS.dim);
    void shortName;
  }

  update(t: number): void {
    this.bd.update(t);
    this.frame++;
    const g = this.gFighter; g.clear();
    drawFighter(g, previewView(this.cur, 92, SY + 150, this.frame), { scale: 0.62, shadow: false });
  }
}
