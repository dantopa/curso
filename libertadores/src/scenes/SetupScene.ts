import Phaser from 'phaser';
import { GAME_W, type Difficulty } from '../combat/types';
import { getCharacter } from '../characters';
import { STAGES } from '../data/stages';
import { StageRenderer } from '../ui/stageRenderer';
import { DIFFICULTY_LABEL } from '../ai/ai';
import { getSettings, saveSettings } from '../systems/storage';
import { COLORS, CSS, MenuBackdrop, MenuList, fadeIn, fadeTo, onNav, panel, screenTitle, txt } from '../ui/theme';
import { drawPortrait, drawPortraitBackdrop } from '../ui/fighterRenderer';
import type { FightConfig, Mode } from '../game/flow';

export class SetupScene extends Phaser.Scene {
  private d!: { mode: Mode; p1: string; p2: string };
  private bd!: MenuBackdrop;
  private thumb!: Phaser.GameObjects.Graphics;
  private stageIdx = 0;
  private stageName!: Phaser.GameObjects.Text;
  private stageDesc!: Phaser.GameObjects.Text;
  constructor() { super('Setup'); }
  init(d: { mode: Mode; p1: string; p2: string }): void { this.d = d; }

  create(): void {
    fadeIn(this);
    this.bd = new MenuBackdrop(this);
    const s = getSettings();
    screenTitle(this, this.d.mode === 'versus' ? 'VERSUS LOCAL' : 'COMBATE RÁPIDO', 'Configurá el duelo');
    this.stageIdx = Math.max(0, STAGES.findIndex((x) => x.id === s.stageId));
    const a = getCharacter(this.d.p1), b = getCharacter(this.d.p2);
    const g = this.add.graphics();
    // fighters header
    for (const [c, x, tag] of [[a, 220, this.d.mode === 'versus' ? 'JUGADOR 1' : 'VOS'], [b, 1060, this.d.mode === 'versus' ? 'JUGADOR 2' : 'CPU']] as const) {
      drawPortraitBackdrop(g, c, x - 80, 140, 160, 160);
      drawPortrait(g, c, x, 225, 150);
      g.lineStyle(2, COLORS.gold, 1); g.strokeRect(x - 80, 140, 160, 160);
      txt(this, x, 318, c.name, 22, CSS.goldLight, { title: true, origin: [0.5, 0.5] });
      txt(this, x, 344, tag, 16, CSS.dim, { origin: [0.5, 0.5] });
    }
    txt(this, GAME_W / 2, 218, 'VS', 60, CSS.gold, { title: true, origin: [0.5, 0.5], shadow: true });
    // stage thumbnail
    panel(g, 440, 130, 400, 235, { alpha: 0.5 });
    this.thumb = this.add.graphics();
    this.stageName = txt(this, GAME_W / 2, 330, '', 22, CSS.goldLight, { title: true, origin: [0.5, 0.5] });
    this.stageDesc = txt(this, GAME_W / 2, 352, '', 14, CSS.dim, { origin: [0.5, 0.5], wrap: 380, align: 'center' });
    this.drawStage();

    const diffs: Difficulty[] = ['novice', 'fighter', 'veteran', 'legend'];
    const rounds: (1 | 2 | 3)[] = [1, 2, 3];
    const timers: (0 | 60 | 99)[] = [60, 99, 0];
    const cycle = <T,>(arr: T[], v: T, d: number) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
    const items = [
      { label: 'Arena', value: () => STAGES[this.stageIdx].name,
        onLeft: () => { this.stageIdx = (this.stageIdx + STAGES.length - 1) % STAGES.length; this.drawStage(); },
        onRight: () => { this.stageIdx = (this.stageIdx + 1) % STAGES.length; this.drawStage(); } },
      ...(this.d.mode === 'quick' ? [{ label: 'Dificultad CPU', value: () => DIFFICULTY_LABEL[s.difficulty],
        onLeft: () => { s.difficulty = cycle(diffs, s.difficulty, -1); }, onRight: () => { s.difficulty = cycle(diffs, s.difficulty, 1); } }] : []),
      { label: 'Rondas', value: () => `Mejor de ${s.roundsToWin * 2 - 1}`,
        onLeft: () => { s.roundsToWin = cycle(rounds, s.roundsToWin, -1); }, onRight: () => { s.roundsToWin = cycle(rounds, s.roundsToWin, 1); } },
      { label: 'Tiempo por ronda', value: () => (s.timer === 0 ? '∞' : `${s.timer} s`),
        onLeft: () => { s.timer = cycle(timers, s.timer, -1); }, onRight: () => { s.timer = cycle(timers, s.timer, 1); } },
      { label: '¡A PELEAR!', onSelect: () => this.start() },
      { label: 'Volver', onSelect: () => fadeTo(this, 'Select', { mode: this.d.mode, step: 'p2', p1: this.d.p1 }) },
    ];
    new MenuList(this, GAME_W / 2, 460, items, { size: 28, gap: 52, width: 560, center: true });
    onNav(this, (k) => { if (k === 'back') fadeTo(this, 'Select', { mode: this.d.mode, step: 'p2', p1: this.d.p1 }); });
  }
  private drawStage(): void {
    const st = STAGES[this.stageIdx];
    this.thumb.clear();
    StageRenderer.drawThumbnail(this.thumb, st, 450, 140, 380, 180);
    this.stageName.setText(st.name);
    this.stageDesc.setText('');
    getSettings().stageId = st.id;
  }
  private start(): void {
    const s = getSettings();
    saveSettings();
    const cfg: FightConfig = {
      mode: this.d.mode, p1: this.d.p1, p2: this.d.p2, p1Human: true, p2Human: this.d.mode === 'versus',
      stageId: STAGES[this.stageIdx].id, difficulty: s.difficulty, roundsToWin: s.roundsToWin, timer: s.timer,
    };
    fadeTo(this, 'Fight', { cfg });
  }
  update(t: number): void { this.bd.update(t); }
}
