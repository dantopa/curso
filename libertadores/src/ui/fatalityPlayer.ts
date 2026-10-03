import Phaser from 'phaser';
import { ARENA, GAME_H, GAME_W, type FatalityDef, type FighterView } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { drawFatalityBack, drawFatalityFront, fatalityBeats, getFatalityActors, type ActorPose, type FxCtx } from '../fatality/fx';
import { FighterVisual } from './fighterVisual';
import { CSS, txt } from './theme';

/** Plays the cinematic finishing move on top of the fight scene. Skippable. */
export class FatalityPlayer {
  private back: Phaser.GameObjects.Graphics;
  private mid: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Graphics;
  private bars: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private quote: Phaser.GameObjects.Text;
  private tag: Phaser.GameObjects.Text;
  private t = 0;
  private beats: { t: number; sfx: string }[];
  private beatIdx = 0;
  private ctx: FxCtx;
  private vw: FighterVisual;
  private vl: FighterVisual;
  done = false;
  private durationMs: number;
  private clock = 0;

  constructor(
    private scene: Phaser.Scene, private def: FatalityDef, private winner: FighterView, private loser: FighterView,
    private secondary: boolean, seed: number,
  ) {
    this.back = scene.add.graphics().setDepth(200);
    this.mid = scene.add.graphics().setDepth(201);
    this.front = scene.add.graphics().setDepth(202);
    this.vw = new FighterVisual(scene, null, winner.char, { depth: 201.5 });
    this.vl = new FighterVisual(scene, null, loser.char, { depth: 201.4 });
    this.bars = scene.add.graphics().setDepth(210);
    this.durationMs = (def.duration / 60) * 1000;
    this.ctx = {
      w: GAME_W, h: GAME_H, groundY: ARENA.ground, winnerX: winner.x, loserX: loser.x,
      facing: winner.x <= loser.x ? 1 : -1, c1: def.color1, c2: def.color2, seed,
    };
    this.beats = fatalityBeats(def.fx);
    this.tag = txt(scene, GAME_W / 2, GAME_H - 150, secondary ? 'REMATE SECUNDARIO' : 'REMATE LEGENDARIO', 20, CSS.dim, { title: true, origin: [0.5, 0.5], depth: 211 }).setAlpha(0);
    this.title = txt(scene, GAME_W / 2, GAME_H - 108, def.name, 56, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 211, strokeW: 7, shadow: true }).setAlpha(0);
    this.quote = txt(scene, GAME_W / 2, GAME_H - 56, `«${def.quote}»`, 24, CSS.white, { origin: [0.5, 0.5], depth: 211, strokeW: 4, wrap: 1000, align: 'center' }).setAlpha(0);
    const a = AudioManager.get();
    a.sfx('fatality');
    a.playMusic('fatality');
    a.speak(def.name.toLowerCase(), { rate: 0.8, pitch: 0.6 });
  }

  skip(): void { if (this.clock > 700) this.clock = this.durationMs; }

  private view(base: FighterView, p: ActorPose, flipBase: boolean): FighterView {
    const facing = ((p.flip ? -1 : 1) * (flipBase ? base.facing : base.facing)) as 1 | -1;
    return {
      ...base, x: base.x + p.dx, y: base.y + p.dy, anim: p.anim, facing, animFrame: Math.floor(this.clock / 16.7),
      animLen: 0, animT: 0, phase: null, phaseT: 0, clock: Math.floor(this.clock / 16.7), hidden: !!p.hidden, hitFlash: 0, buffs: [],
    };
  }

  update(deltaMs: number): void {
    this.clock += deltaMs;
    this.t = Math.min(1, this.clock / this.durationMs);
    while (this.beatIdx < this.beats.length && this.beats[this.beatIdx].t <= this.t) {
      AudioManager.get().sfx(this.beats[this.beatIdx].sfx as never);
      this.beatIdx++;
    }
    const t = this.t;
    const actors = getFatalityActors(this.def.fx, t, this.ctx);
    if (actors.loser.hidden) this.vl.hide();
    if (actors.winner.hidden) this.vw.hide();
    this.back.clear(); this.mid.clear(); this.front.clear(); this.bars.clear();
    // base dark backdrop dims the stage
    this.back.fillStyle(0x000000, Math.min(0.55, t * 6));
    this.back.fillRect(0, 0, GAME_W, GAME_H);
    drawFatalityBack(this.back, this.def.fx, t, this.ctx);
    const l = actors.loser, w = actors.winner;
    if (!l.hidden) this.vl.draw(this.mid, this.view(this.loser, l, true), { alpha: l.alpha, scale: l.scale, xOffset: (Math.random() - 0.5) * l.shake, shadow: true });
    if (!w.hidden) this.vw.draw(this.mid, this.view(this.winner, w, true), { alpha: w.alpha, scale: w.scale, shadow: true });
    drawFatalityFront(this.front, this.def.fx, t, this.ctx);
    // letterbox
    const bar = 70 * Math.min(1, t * 12) * Math.min(1, (1 - t) * 20 + 0.3);
    this.bars.fillStyle(0x000000, 1);
    this.bars.fillRect(0, 0, GAME_W, bar); this.bars.fillRect(0, GAME_H - bar, GAME_W, bar);
    // text
    const ta = Math.max(0, Math.min(1, (t - 0.04) * 8)) * Math.min(1, (1 - t) * 8);
    this.tag.setAlpha(ta * 0.9); this.title.setAlpha(ta);
    this.quote.setAlpha(Math.max(0, Math.min(1, (t - 0.78) * 8)) * Math.min(1, (1 - t) * 8));
    if (this.clock >= this.durationMs + 400) this.done = true;
  }

  destroy(): void {
    this.vw.destroy(); this.vl.destroy();
    [this.back, this.mid, this.front, this.bars, this.title, this.quote, this.tag].forEach((o) => o.destroy());
  }
}
