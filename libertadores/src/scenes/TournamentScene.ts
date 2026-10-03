import Phaser from 'phaser';
import { GAME_H, GAME_W, type Difficulty } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { CHARACTER_IDS, getCharacter } from '../characters';
import {
  STAGE_LABEL, STAGE_ORDER, createTournament, currentStage, finishTournament, nextPlayerMatch, playerStatus,
  reportPlayerResult, resolveCpuMatches, stageMatches, type BracketMatch, type StageName, type Tournament,
} from '../data/tournament';
import { makeCpuSimulator } from '../ai/headless';
import { STAGES } from '../data/stages';
import { charStat, getProgress, getSettings, saveProgress } from '../systems/storage';
import { COLORS, CSS, MenuBackdrop, fadeIn, fadeTo, navFrom, panel, screenTitle, txt } from '../ui/theme';
import { drawPortrait, drawPortraitBackdrop } from '../ui/fighterRenderer';
import { shortName } from '../ui/names';
import type { FightConfig, MatchResult } from '../game/flow';

const COL_X: Record<StageName, number> = { prelim: 24, r16: 236, qf: 448, sf: 660, final: 872 };
const BW = 190, BH = 50;
const DIFFS: Difficulty[] = ['novice', 'fighter', 'veteran', 'legend'];

export class TournamentScene extends Phaser.Scene {
  private t!: Tournament;
  private bd!: MenuBackdrop;
  private g!: Phaser.GameObjects.Graphics;
  private pulse!: Phaser.GameObjects.Graphics;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private status!: Phaser.GameObjects.Text;
  private action!: Phaser.GameObjects.Text;
  private busy = false;
  private init_!: { player?: string; resume?: boolean; result?: MatchResult };
  private pulseMatch: string | null = null;
  constructor() { super('Tournament'); }
  init(d: { player?: string; resume?: boolean; result?: MatchResult }): void { this.init_ = d ?? {}; }

  create(): void {
    fadeIn(this);
    AudioManager.get().playMusic('tournament');
    this.bd = new MenuBackdrop(this);
    screenTitle(this, 'TORNEO DE LEYENDAS', '20 libertadores · eliminación directa');
    this.g = this.add.graphics().setDepth(2);
    this.pulse = this.add.graphics().setDepth(3);
    this.status = txt(this, GAME_W / 2, GAME_H - 66, '', 24, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 5 });
    this.action = txt(this, GAME_W / 2, GAME_H - 30, '', 18, CSS.white, { origin: [0.5, 0.5], depth: 5 });

    const prog = getProgress();
    const d = this.init_;
    if (d.player) {
      const s = getSettings();
      this.t = createTournament(d.player, CHARACTER_IDS, Math.floor(Math.random() * 1e9), s.difficulty);
      prog.tournament = this.t; saveProgress();
    } else {
      if (!prog.tournament) { this.scene.start('Menu'); return; }
      this.t = prog.tournament;
    }
    if (d.result) this.applyResult(d.result);
    this.redraw();

    const go = () => this.advance();
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      AudioManager.get().unlock();
      const k = navFrom(e);
      if (k === 'confirm') go();
      else if (k === 'back') { saveProgress(); fadeTo(this, 'Menu'); }
    });
    this.input.on('pointerdown', go);
  }

  private applyResult(r: MatchResult): void {
    const t = this.t;
    const id = r.cfg.tournamentMatchId!;
    const m = t.matches.find((x) => x.id === id)!;
    const winnerId = r.winner === 0 ? r.cfg.p1 : r.cfg.p2;
    const score: [number, number] = m.a === r.cfg.p1 ? [r.wins[0], r.wins[1]] : [r.wins[1], r.wins[0]];
    reportPlayerResult(t, id, winnerId, score, r.fatality);
    if (!t.eliminated) this.finishStageSim();
    if (t.finished && t.champion === t.player) charStat(t.player).tournamentWins++;
    saveProgress();
  }

  private finishStageSim(): void { resolveCpuMatches(this.t, makeCpuSimulator('veteran')); }

  private advance(): void {
    if (this.busy) return;
    const t = this.t;
    const st = playerStatus(t);
    AudioManager.get().sfx('menuSelect');
    if (st === 'match') this.startFight(nextPlayerMatch(t)!);
    else if (st === 'bye') {
      this.busy = true;
      this.status.setText('Tu leyenda descansa… los demás combaten');
      this.time.delayedCall(60, () => { this.finishStageSim(); saveProgress(); this.busy = false; this.redraw(); });
    } else {
      this.busy = true;
      this.status.setText('Simulando el resto del torneo…');
      this.time.delayedCall(60, () => {
        finishTournament(t, makeCpuSimulator('veteran'));
        if (t.champion === t.player && !t.eliminated) { /* counted in applyResult */ }
        getProgress().tournament = null; saveProgress();
        this.busy = false;
        fadeTo(this, 'Results', { tournament: t });
      });
    }
  }

  private startFight(m: BracketMatch): void {
    const t = this.t;
    const opp = m.a === t.player ? m.b! : m.a!;
    const base = DIFFS.indexOf(t.difficulty);
    const stageIdx = t.stageIndex;
    const di = Math.min(3, base + (stageIdx >= 3 ? 1 : 0) + (stageIdx === 4 && base >= 2 ? 1 : 0));
    const s = getSettings();
    const cfg: FightConfig = {
      mode: 'tournament', p1: t.player, p2: opp, p1Human: true, p2Human: false,
      stageId: STAGES[(t.seed + stageIdx * 3 + m.index) % STAGES.length].id,
      difficulty: DIFFS[di], roundsToWin: s.roundsToWin, timer: s.timer,
      tournamentMatchId: m.id, label: STAGE_LABEL[currentStage(t)],
    };
    this.status.setText(`${getCharacter(t.player).name} vs ${getCharacter(opp).name}`);
    fadeTo(this, 'Fight', { cfg }, 350);
  }

  /* ------------------------------------------------------------- drawing */
  private matchY(stage: StageName, i: number): number {
    const top = 140, span = 66;
    const r16 = (k: number) => top + k * span;
    switch (stage) {
      case 'prelim': return r16(i * 2);
      case 'r16': return r16(i);
      case 'qf': return (r16(i * 2) + r16(i * 2 + 1)) / 2;
      case 'sf': return (r16(i * 4) + r16(i * 4 + 3)) / 2;
      case 'final': return (r16(0) + r16(7)) / 2;
    }
  }

  private redraw(): void {
    this.dyn.forEach((o) => o.destroy()); this.dyn = [];
    const g = this.g; g.clear();
    const t = this.t;
    // column headers
    for (const st of STAGE_ORDER) {
      const x = COL_X[st] + BW / 2;
      const cur = !t.finished && currentStage(t) === st;
      this.dyn.push(txt(this, x, 126, STAGE_LABEL[st].toUpperCase(), 13, cur ? CSS.goldLight : CSS.dim, { title: true, origin: [0.5, 0.5], depth: 5 }));
    }
    // connectors
    g.lineStyle(2, COLORS.goldDark, 0.7);
    const link = (a: BracketMatch, b: BracketMatch) => {
      const x1 = COL_X[a.stage] + BW, y1 = this.matchY(a.stage, a.index) + BH / 2;
      const x2 = COL_X[b.stage], y2 = this.matchY(b.stage, b.index) + BH / 2;
      g.lineBetween(x1, y1, x1 + 11, y1); g.lineBetween(x1 + 11, y1, x1 + 11, y2); g.lineBetween(x1 + 11, y2, x2, y2);
    };
    const R = (s: StageName) => stageMatches(t, s);
    R('prelim').forEach((m, k) => link(m, R('r16')[2 * k]));
    R('r16').forEach((m, k) => link(m, R('qf')[Math.floor(k / 2)]));
    R('qf').forEach((m, k) => link(m, R('sf')[Math.floor(k / 2)]));
    R('sf').forEach((m, k) => link(m, R('final')[0]));
    for (const m of t.matches) this.drawMatch(m);
    // champion box
    const fx = 1085, fy = this.matchY('final', 0) - 40;
    panel(g, fx, fy - 20, 180, 180, { alpha: 0.8, border: COLORS.gold });
    this.dyn.push(txt(this, fx + 90, fy - 6, 'CAMPEÓN', 16, CSS.gold, { title: true, origin: [0.5, 0], depth: 5 }));
    if (t.champion) {
      const c = getCharacter(t.champion);
      drawPortraitBackdrop(g, c, fx + 20, fy + 18, 140, 110);
      drawPortrait(g, c, fx + 90, fy + 76, 120);
      this.dyn.push(txt(this, fx + 90, fy + 138, shortName(c), 18, CSS.goldLight, { title: true, origin: [0.5, 0], depth: 5 }));
    } else this.dyn.push(txt(this, fx + 90, fy + 70, '?', 70, '#7a5a1c', { title: true, origin: [0.5, 0.5], depth: 5 }));

    // status
    const st = playerStatus(t);
    const me = getCharacter(t.player).name;
    const pm = nextPlayerMatch(t);
    this.pulseMatch = pm?.id ?? null;
    if (st === 'match' && pm) {
      const opp = getCharacter(pm.a === t.player ? pm.b! : pm.a!);
      this.status.setText(`${STAGE_LABEL[currentStage(t)]}: ${me} vs ${opp.name}`);
      this.action.setText('Enter / toque: ¡a combatir!   ·   Esc: guardar y salir');
    } else if (st === 'bye') {
      this.status.setText(`${STAGE_LABEL[currentStage(t)]}: ${me} avanza directo (bye)`);
      this.action.setText('Enter / toque: ver cómo se juegan los demás combates');
    } else if (st === 'eliminated') {
      this.status.setText(`${me} fue eliminado…`);
      this.action.setText('Enter / toque: resolver el torneo y ver resultados');
    } else {
      this.status.setText(st === 'champion' ? `¡${me} es el CAMPEÓN!` : 'El torneo ha terminado');
      this.action.setText('Enter / toque: ver resultados');
    }
  }

  private drawMatch(m: BracketMatch): void {
    const g = this.g;
    const x = COL_X[m.stage], y = this.matchY(m.stage, m.index);
    const mine = m.a === this.t.player || m.b === this.t.player;
    g.fillStyle(0x000000, 0.7); g.fillRoundedRect(x, y, BW, BH, 5);
    g.lineStyle(mine ? 2 : 1, mine ? COLORS.goldLight : COLORS.goldDark, 1); g.strokeRoundedRect(x, y, BW, BH, 5);
    g.lineStyle(1, COLORS.goldDark, 0.6); g.lineBetween(x + 4, y + BH / 2, x + BW - 4, y + BH / 2);
    [m.a, m.b].forEach((id, row) => {
      const ry = y + row * (BH / 2);
      if (!id) { this.dyn.push(txt(this, x + 34, ry + 12, '—', 14, CSS.dim, { origin: [0, 0.5], depth: 5 })); return; }
      const c = getCharacter(id);
      const won = m.winner === id, lost = m.winner !== null && !won;
      if (won) { g.fillStyle(COLORS.gold, 0.22); g.fillRect(x + 2, ry + 1, BW - 4, BH / 2 - 2); }
      g.fillStyle(0x000000, 0.5); g.fillCircle(x + 16, ry + 12, 10);
      drawPortrait(g, c, x + 16, ry + 15, 22, { alpha: lost ? 0.4 : 1 });
      this.dyn.push(txt(this, x + 32, ry + 12, shortName(c), 14, lost ? '#6a5d44' : won ? CSS.goldLight : CSS.white, { origin: [0, 0.5], depth: 5, title: won, strokeW: 1 }));
      if (m.score) this.dyn.push(txt(this, x + BW - 8, ry + 12, String(row === 0 ? m.score[0] : m.score[1]), 14, lost ? '#6a5d44' : CSS.goldLight, { origin: [1, 0.5], depth: 5, strokeW: 1 }));
      if (id === this.t.player) { g.fillStyle(0x6ec6ff, 1); g.fillRect(x, ry + 3, 3, BH / 2 - 6); }
    });
  }

  update(time: number): void {
    this.bd.update(time);
    this.pulse.clear();
    if (this.pulseMatch) {
      const m = this.t.matches.find((x) => x.id === this.pulseMatch);
      if (m) {
        const x = COL_X[m.stage], y = this.matchY(m.stage, m.index);
        this.pulse.lineStyle(3, COLORS.goldLight, 0.4 + 0.4 * Math.sin(time * 0.006));
        this.pulse.strokeRoundedRect(x - 3, y - 3, BW + 6, BH + 6, 7);
      }
    }
  }
}
