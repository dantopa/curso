import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { getCharacter } from '../characters';
import { STAGE_LABEL, STAGE_ORDER, stageMatches, matchLoser, type Tournament } from '../data/tournament';
import { COLORS, CSS, MenuBackdrop, MenuList, fadeIn, fadeTo, onNav, panel, screenTitle, txt } from '../ui/theme';
import { drawFighter, drawPortrait, drawPortraitBackdrop } from '../ui/fighterRenderer';
import { previewView } from '../ui/preview';
import { shortName } from '../ui/names';
import { charStat } from '../systems/storage';
import type { MatchResult } from '../game/flow';

export class ResultsScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  private d!: { result?: MatchResult; tournament?: Tournament };
  private g!: Phaser.GameObjects.Graphics;
  private frame = 0;
  private who = '';
  private gf!: Phaser.GameObjects.Graphics;
  constructor() { super('Results'); }
  init(d: { result?: MatchResult; tournament?: Tournament }): void { this.d = d; this.frame = 0; }

  create(): void {
    fadeIn(this, 500);
    this.bd = new MenuBackdrop(this, 0xffc040);
    this.g = this.add.graphics().setDepth(4);
    this.gf = this.add.graphics().setDepth(7);
    if (this.d.tournament) this.tournamentResults(this.d.tournament); else this.matchResults(this.d.result!);
  }

  private matchResults(r: MatchResult): void {
    const w = getCharacter(r.winner === 0 ? r.cfg.p1 : r.cfg.p2);
    const l = getCharacter(r.winner === 0 ? r.cfg.p2 : r.cfg.p1);
    this.who = w.id;
    const humanWon = r.winner === 0 ? r.cfg.p1Human : r.cfg.p2Human;
    const title = r.cfg.mode === 'versus' ? `¡GANA ${r.winner === 0 ? 'JUGADOR 1' : 'JUGADOR 2'}!` : humanWon ? 'VICTORIA' : 'DERROTA';
    AudioManager.get().playMusic(humanWon ? 'victory' : 'defeat');
    screenTitle(this, title, `${w.name} derrota a ${l.name}`);
    txt(this, GAME_W / 2, 175, `${r.wins[0]}  –  ${r.wins[1]}`, 70, CSS.goldLight, { title: true, origin: [0.5, 0.5], shadow: true });
    panel(this.g, 80, 130, 400, 440, { alpha: 0.6 });
    drawPortraitBackdrop(this.g, w, 100, 150, 360, 400);
    txt(this, 280, 520, w.name, 24, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 6 });
    txt(this, 280, 548, w.title, 16, CSS.dim, { origin: [0.5, 0.5], depth: 6 });
    const lines: string[] = [];
    lines.push(`Rondas: ${r.wins[0]} - ${r.wins[1]}`);
    if (r.fatality) lines.push(`${r.secondary ? 'Remate secundario' : 'Remate'}: ${r.fatalityName}`);
    const st = charStat(w.id);
    lines.push(`${w.name}: ${st.wins} victorias · ${st.fatalities} remates`);
    lines.forEach((s, i) => txt(this, 560, 250 + i * 44, s, 26, CSS.white, { depth: 6 }));
    const items = [
      { label: 'Revancha', onSelect: () => fadeTo(this, 'Fight', { cfg: r.cfg }) },
      { label: 'Cambiar peleadores', onSelect: () => fadeTo(this, 'Select', { mode: r.cfg.mode }) },
      { label: 'Menú principal', onSelect: () => fadeTo(this, 'Menu') },
    ];
    new MenuList(this, 580, 460, items, { size: 28, gap: 54, width: 440, depth: 10 });
    onNav(this, (k) => { if (k === 'back') fadeTo(this, 'Menu'); });
  }

  private tournamentResults(t: Tournament): void {
    const champ = t.champion ? getCharacter(t.champion) : null;
    const run = t.runnerUp ? getCharacter(t.runnerUp) : null;
    this.who = champ?.id ?? '';
    AudioManager.get().playMusic('victory');
    screenTitle(this, 'RESULTADOS DEL TORNEO', t.champion === t.player ? '¡Tu leyenda fue forjada!' : 'La corona tiene nuevo dueño');
    const g = this.g;
    if (champ) {
      panel(g, 40, 130, 330, 520, { alpha: 0.7, border: COLORS.gold });
      txt(this, 205, 150, 'CAMPEÓN', 26, CSS.gold, { title: true, origin: [0.5, 0], depth: 6 });
      drawPortraitBackdrop(g, champ, 60, 190, 290, 230);
      drawPortrait(g, champ, 205, 305, 250);
      txt(this, 205, 560, champ.name, 22, CSS.goldLight, { title: true, origin: [0.5, 0], depth: 6, wrap: 300, align: 'center' });
      txt(this, 205, 590, champ.title, 16, CSS.dim, { origin: [0.5, 0], depth: 6 });
    }
    if (run) {
      txt(this, 400, 150, 'SUBCAMPEÓN', 20, CSS.gold, { title: true, depth: 6 });
      drawPortrait(g, run, 440, 215, 70);
      txt(this, 485, 200, run.name, 20, CSS.white, { depth: 6 });
    }
    txt(this, 400, 262, `Tu peleador: ${getCharacter(t.player).name}`, 20, CSS.goldLight, { depth: 6 });
    // results by stage
    let y = 296;
    for (const st of STAGE_ORDER) {
      txt(this, 400, y, STAGE_LABEL[st].toUpperCase(), 14, CSS.gold, { title: true, depth: 6 });
      y += 20;
      const ms = stageMatches(t, st);
      ms.forEach((m, i) => {
        if (!m.winner) return;
        const lo = matchLoser(m)!;
        const col = i % 2, row = Math.floor(i / 2);
        const mine = m.a === t.player || m.b === t.player;
        const s = `${shortName(m.winner)} ${m.score ? m.score[m.winner === m.a ? 0 : 1] + '-' + m.score[m.winner === m.a ? 1 : 0] : ''} ${shortName(lo)}${m.fatality ? '  ★' : ''}`;
        txt(this, 400 + col * 410, y + row * 17, s, 13, mine ? CSS.goldLight : CSS.white, { depth: 6, strokeW: 1 });
      });
      y += Math.ceil(ms.length / 2) * 17 + 6;
    }
    new MenuList(this, 1060, 640, [{ label: 'Menú principal', onSelect: () => fadeTo(this, 'Menu') }], { size: 22, gap: 40, width: 300, center: true, depth: 10 });
    onNav(this, (k) => { if (k === 'back') fadeTo(this, 'Menu'); });
    void GAME_H;
  }

  update(t: number): void {
    this.bd.update(t);
    this.frame++;
    if (this.d.result) {
      const w = getCharacter(this.who);
      const v = previewView(w, 280, 480, 0);
      v.anim = 'win'; v.animFrame = this.frame; v.animLen = 110; v.animT = Math.min(1, (this.frame % 110) / 110); v.clock = this.frame;
      this.gf.clear();
      drawFighter(this.gf, v, { shadow: true });
    }
  }
}
