import Phaser from 'phaser';
import { ARENA, GAME_H, GAME_W, emptyInput, type InputFrame, type SimEvent } from '../combat/types';
import { FightSim, specialColor } from '../combat/sim';
import { getCharacter } from '../characters';
import { AIController } from '../ai/ai';
import { AudioManager, type MusicTrack } from '../audio/AudioManager';
import { getStage } from '../data/stages';
import { StageRenderer } from '../ui/stageRenderer';
import { Effects } from '../systems/effects';
import { Hud } from '../ui/hud';
import { FatalityPlayer } from '../ui/fatalityPlayer';
import { drawFighter } from '../ui/fighterRenderer';
import { drawGhost, drawProjectile } from '../ui/projectileRenderer';
import { COLORS, CSS, MenuList, fadeIn, fadeTo, navFrom, panel, txt } from '../ui/theme';
import { arrows } from './SelectScene';
import { input, touch } from '../game/context';
import { getSettings, recordMatch, secondaryUnlocked } from '../systems/storage';
import { isTouchDevice } from '../systems/touchControls';
import type { FightConfig, MatchResult } from '../game/flow';

const STEP_MS = 1000 / 60;
const SLOT_KEY = ['L', '→ + L', '↓ + L', '↑ + L'];

export class FightScene extends Phaser.Scene {
  private cfg!: FightConfig;
  private sim!: FightSim;
  private stage!: StageRenderer;
  private world!: Phaser.GameObjects.Container;
  private gGhost!: Phaser.GameObjects.Graphics;
  private gFighter!: Phaser.GameObjects.Graphics;
  private gProj!: Phaser.GameObjects.Graphics;
  private gFx!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Graphics;
  private fx = new Effects();
  private hud!: Hud;
  private ai: (AIController | null)[] = [null, null];
  private acc = 0;
  private slowToggle = false;
  private camX = GAME_W / 2;
  private camZ = 1;
  private paused = false;
  private pauseObjs: Phaser.GameObjects.GameObject[] = [];
  private pauseMenu?: MenuList;
  private fatPlayer: FatalityPlayer | null = null;
  private fatDone = false;
  private ended = false;
  private flashAlpha = 0;
  private flashColor = 0xffffff;
  private usedFatality = false;
  private usedSecondary = false;
  private fatalityName = '';
  private ghostAge = [0, 0];

  constructor() { super('Fight'); }
  init(d: { cfg: FightConfig }): void {
    this.cfg = d.cfg;
    this.acc = 0; this.slowToggle = false; this.camX = GAME_W / 2; this.camZ = 1; this.paused = false;
    this.pauseObjs = []; this.pauseMenu = undefined; this.fatPlayer = null; this.fatDone = false; this.ended = false;
    this.flashAlpha = 0; this.usedFatality = false; this.usedSecondary = false; this.fatalityName = '';
    this.ghostAge = [0, 0]; this.ai = [null, null]; this.fx = new Effects();
  }

  create(): void {
    fadeIn(this, 400);
    const cfg = this.cfg;
    const a = getCharacter(cfg.p1), b = getCharacter(cfg.p2);
    this.sim = new FightSim({
      chars: [a, b], roundsToWin: cfg.roundsToWin, timer: cfg.timer,
      fatalityHuman: [cfg.p1Human, cfg.p2Human],
      secondaryUnlocked: [cfg.p1Human && secondaryUnlocked(a.id), cfg.p2Human && secondaryUnlocked(b.id)],
      seed: Math.floor(Math.random() * 1e9),
    });
    const stageDef = getStage(cfg.stageId);
    this.stage = new StageRenderer(this, stageDef, -100);
    this.world = this.add.container(0, 0).setDepth(10);
    this.gGhost = this.add.graphics(); this.gFighter = this.add.graphics();
    this.gProj = this.add.graphics(); this.gFx = this.add.graphics();
    this.world.add([this.gGhost, this.gFighter, this.gProj, this.gFx]);
    this.flash = this.add.graphics().setDepth(90);
    this.hud = new Hud(this, [a, b], [cfg.p1Human, cfg.p2Human], cfg.label);
    if (!cfg.p1Human) this.ai[0] = new AIController(0, cfg.difficulty, 11);
    if (!cfg.p2Human) this.ai[1] = new AIController(1, cfg.difficulty, 23);
    input.reset();
    input.capture = true;
    const s = getSettings();
    const showTouch = s.touch === 'on' || (s.touch === 'auto' && isTouchDevice());
    touch.show(showTouch);
    this.events.once('shutdown', () => { input.capture = false; touch.show(false); this.stage.destroy(); AudioManager.get().stopMusic(0.4); });
    const tracks: MusicTrack[] = ['fight1', 'fight2', 'fight3'];
    AudioManager.get().playMusic(tracks[Math.floor(Math.random() * 3)]);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    // pause button for touch devices
    const pb = txt(this, GAME_W - 24, 110, 'II', 22, CSS.goldLight, { title: true, origin: [1, 0.5], depth: 120 }).setInteractive({ useHandCursor: true });
    pb.on('pointerdown', () => this.togglePause());
    this.hud.update(this.sim);
    this.render();
  }

  /* ---------------------------------------------------------------- input */
  private onKey(e: KeyboardEvent): void {
    AudioManager.get().unlock();
    if (this.fatPlayer) { this.fatPlayer.skip(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!this.ended) this.togglePause(); }
  }

  private togglePause(): void {
    if (this.fatPlayer || this.sim.phase === 'fatality') return;
    this.paused = !this.paused;
    this.pauseObjs.forEach((o) => o.destroy()); this.pauseObjs = [];
    this.pauseMenu?.destroy(); this.pauseMenu = undefined;
    AudioManager.get().setMusicDuck(this.paused);
    if (!this.paused) { input.reset(); return; }
    const g = this.add.graphics().setDepth(300);
    g.fillStyle(0x000000, 0.7); g.fillRect(0, 0, GAME_W, GAME_H);
    panel(g, 380, 150, 520, 420);
    this.pauseObjs.push(g, txt(this, GAME_W / 2, 190, 'PAUSA', 44, CSS.goldLight, { title: true, origin: [0.5, 0.5], depth: 301 }));
    const items = [
      { label: 'Continuar', onSelect: () => this.togglePause() },
      { label: 'Lista de movimientos', onSelect: () => this.showMoves() },
      ...(this.cfg.mode !== 'tournament' ? [{ label: 'Reiniciar combate', onSelect: () => fadeTo(this, 'Fight', { cfg: this.cfg }) }] : []),
      { label: this.cfg.mode === 'tournament' ? 'Abandonar torneo' : 'Salir al menú', onSelect: () => fadeTo(this, 'Menu') },
    ];
    this.pauseMenu = new MenuList(this, GAME_W / 2, 280, items, { size: 28, gap: 56, width: 440, center: true, depth: 302 });
  }

  private showMoves(): void {
    this.pauseMenu!.active = false;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics().setDepth(310);
    g.fillStyle(0x000000, 0.9); g.fillRect(0, 0, GAME_W, GAME_H); panel(g, 60, 40, 1160, 640);
    objs.push(g);
    const humans = ([0, 1] as const).filter((i) => (i === 0 ? this.cfg.p1Human : this.cfg.p2Human));
    (humans.length ? humans : [0 as const]).forEach((i, col) => {
      const c = this.sim.fighters[i].char;
      const x = humans.length > 1 ? 90 + col * 570 : 90;
      objs.push(txt(this, x, 60, c.name.toUpperCase(), 30, CSS.goldLight, { title: true, depth: 311 }));
      c.specials.forEach((s, k) => {
        objs.push(txt(this, x, 120 + k * 78, `${SLOT_KEY[k]}   ${s.name}`, 22, CSS.gold, { title: true, depth: 311 }));
        objs.push(txt(this, x + 10, 150 + k * 78, s.desc, 16, CSS.white, { depth: 311, wrap: 520 }));
      });
      objs.push(txt(this, x, 440, 'EX: Bloquear + Especial (50)   ·   Rompeguardia: Pesado al bloquear (25)', 16, CSS.dim, { depth: 311 }));
      objs.push(txt(this, x, 470, `Definitivo (medidor 100): ${c.specials[c.ultimateSlot].name} potenciado — botón Remate`, 16, CSS.white, { depth: 311 }));
      objs.push(txt(this, x, 520, `REMATE: ${c.fatality.name}`, 22, CSS.goldLight, { title: true, depth: 311 }));
      objs.push(txt(this, x, 552, `${arrows(c.fatality.input)} + Remate`, 24, CSS.white, { depth: 311 }));
      if (secondaryUnlocked(c.id)) {
        objs.push(txt(this, x, 592, `SECUNDARIO: ${c.secondary.name}  ${arrows(c.secondary.input)} + Remate`, 17, CSS.goldLight, { depth: 311 }));
      }
    });
    objs.push(txt(this, GAME_W / 2, 654, 'Cualquier tecla para volver', 16, CSS.dim, { origin: [0.5, 0.5], depth: 311 }));
    const close = (e?: KeyboardEvent) => {
      if (e && !navFrom(e) && e.code !== 'Escape') return;
      objs.forEach((o) => o.destroy());
      this.input.keyboard?.off('keydown', close);
      this.input.off('pointerdown', close);
      this.time.delayedCall(80, () => { if (this.pauseMenu) this.pauseMenu.active = true; });
    };
    this.time.delayedCall(120, () => { this.input.keyboard?.on('keydown', close); this.input.on('pointerdown', close); });
  }

  /* ---------------------------------------------------------------- loop */
  update(time: number, delta: number): void {
    this.stage.update(time, delta);
    if (this.paused) return;
    if (this.fatPlayer) {
      this.fatPlayer.update(delta);
      if (this.fatPlayer.done && !this.fatDone) { this.fatDone = true; this.endFatality(); }
      return;
    }
    this.acc += Math.min(delta, 100);
    let n = 0;
    while (this.acc >= STEP_MS && n < 4) {
      this.acc -= STEP_MS; n++;
      if (this.sim.slowmo) { this.slowToggle = !this.slowToggle; if (this.slowToggle) continue; }
      this.stepOnce();
      if (this.fatPlayer) return;
    }
    this.fx.update();
    this.updateCamera();
    this.render();
    this.hud.update(this.sim);
    this.flashAlpha = Math.max(0, this.flashAlpha - 0.03);
    this.flash.clear();
    if (this.flashAlpha > 0) { this.flash.fillStyle(this.flashColor, this.flashAlpha); this.flash.fillRect(0, 0, GAME_W, GAME_H); }
    this.stage.setFlash(this.flashColor, this.flashAlpha * 0.4);
  }

  private stepOnce(): void {
    const s = this.sim;
    const inputs: [InputFrame, InputFrame] = [emptyInput(), emptyInput()];
    for (const i of [0, 1] as const) {
      const human = i === 0 ? this.cfg.p1Human : this.cfg.p2Human;
      if (human) inputs[i] = input.sample(i);
      else if (s.phase === 'fight') inputs[i] = this.ai[i]!.think(s);
    }
    s.step(inputs);
    this.handleEvents(s.events);
    if (s.phase === 'done' && !this.ended) this.finish();
  }

  /* -------------------------------------------------------------- events */
  private shake(ms: number, amt: number): void {
    if (getSettings().shake) this.cameras.main.shake(ms, amt);
  }
  private pan(x: number): number { return Math.max(-1, Math.min(1, (x - GAME_W / 2) / 600)); }

  private handleEvents(evs: SimEvent[]): void {
    const au = AudioManager.get();
    const s = this.sim;
    for (const e of evs) {
      switch (e.type) {
        case 'hit':
          this.fx.hit(e.x, e.y, e.strength, e.color ?? 0xffffff);
          au.sfx(e.strength === 'light' ? 'lightHit' : 'heavyHit', { pan: this.pan(e.x), intensity: e.strength === 'special' ? 1.3 : 1 });
          this.shake(e.strength === 'light' ? 60 : 110, e.strength === 'light' ? 0.0015 : e.strength === 'heavy' ? 0.004 : 0.007);
          break;
        case 'block': this.fx.block(e.x, e.y); au.sfx('block', { pan: this.pan(e.x) }); break;
        case 'whoosh': au.sfx(e.heavy ? 'whooshHeavy' : 'whoosh', { pan: this.pan(s.fighters[e.by].x) }); break;
        case 'special': {
          const f = s.fighters[e.by];
          au.sfx('special', { pan: this.pan(f.x) });
          this.fx.burst(f.x, f.y - 90, e.color);
          break;
        }
        case 'projectile': au.sfx('projectile', { pan: this.pan(s.fighters[e.by].x) }); break;
        case 'launch': au.sfx('launch'); this.fx.dust(e.x, ARENA.ground, 10); break;
        case 'throw': au.sfx('throw'); this.fx.hit(e.x, e.y, 'heavy', 0xffffff); this.shake(160, 0.006); break;
        case 'buff': au.sfx('buff'); this.fx.burst(s.fighters[e.by].x, s.fighters[e.by].y - 90, e.color); break;
        case 'teleport': au.sfx('teleport'); this.fx.burst(s.fighters[e.by].x, s.fighters[e.by].y - 90, e.color); break;
        case 'clash': au.sfx('clash'); this.fx.hit(e.x, e.y, 'heavy', 0xffe9a0); break;
        case 'shield': au.sfx('shield'); this.fx.block(e.x, e.y); break;
        case 'counter': au.sfx('counter'); this.fx.burst(e.x, e.y, e.color); this.flashColor = e.color; this.flashAlpha = 0.35; this.shake(160, 0.006); break;
        case 'ultimate': au.sfx('ultimate'); this.flashColor = e.color; this.flashAlpha = 0.9; this.shake(500, 0.008);
          this.hud.say('¡DEFINITIVO!', s.fighters[e.by].char.specials[s.fighters[e.by].char.ultimateSlot].name.toUpperCase(), '#ffd070', 64);
          break;
        case 'land': {
          const f = s.fighters.find((x) => Math.abs(x.x - e.x) < 1);
          if (f && (f.state === 'knockdown' || f.state === 'dead')) { au.sfx('thud'); this.fx.dust(e.x, e.y, 10); this.shake(100, 0.004); }
          else this.fx.dust(e.x, e.y, 3);
          break;
        }
        case 'roundStart': this.hud.say(`RONDA ${e.round}`, `${s.fighters[0].char.name}  vs  ${s.fighters[1].char.name}`, CSS.goldLight, 90); au.sfx('roundStart'); au.speak(`Ronda ${e.round}`); break;
        case 'fight': this.hud.say('¡PELEA!', '', '#ff5a3a', 130); au.sfx('fight'); au.speak('¡Pelea!', { rate: 1.1 }); break;
        case 'ko': this.hud.say('K.O.', '', '#ff3a2a', 160); au.sfx('ko'); au.speak('K O'); this.shake(500, 0.012); this.flashColor = 0xffffff; this.flashAlpha = 0.6; break;
        case 'timeout': this.hud.say('TIEMPO', '', CSS.goldLight, 100); au.speak('Tiempo'); break;
        case 'roundEnd': {
          if (e.winner === null) this.hud.say('EMPATE', '', CSS.white, 90);
          else this.hud.say(`¡${s.fighters[e.winner].char.name.toUpperCase()}!`, 'gana la ronda', CSS.goldLight, 54);
          break;
        }
        case 'matchEnd': {
          const w = s.fighters[e.winner];
          this.hud.sticky(`${w.char.name.toUpperCase()}`, '¡GANA EL COMBATE!', CSS.goldLight, w.char.name.length > 16 ? 56 : 72);
          au.speak(`${w.char.name} gana`);
          if (e.winner === 0 || this.cfg.p2Human) au.playMusic('victory'); else au.playMusic('defeat');
          break;
        }
        case 'finishWindow': {
          const w = s.fighters[e.winner].char;
          this.hud.clearAnnounce();
          this.hud.showFinish(e.winner, this.cfg.p1Human && e.winner === 0 ? secondaryUnlocked(w.id) : this.cfg.p2Human && e.winner === 1 ? secondaryUnlocked(w.id) : false);
          au.sfx('bell'); au.speak('Sellá la leyenda', { rate: 0.8, pitch: 0.7 });
          break;
        }
        case 'fatalityFail': au.sfx('error'); this.shake(100, 0.003); break;
        case 'fatality': this.startFatality(e.winner, e.secondary); break;
        case 'timerWarn': au.sfx('timer'); break;
      }
    }
    // ghost trails for rushes
    for (const i of [0, 1] as const) {
      const f = s.fighters[i];
      if (f.sp?.def.kind === 'rush' && f.sp.stage === 'run') this.fx.smoke(f.x - f.facing * 20, f.y - 10, 0xb8a37a);
    }
    void specialColor;
  }

  private startFatality(winner: 0 | 1, secondary: boolean): void {
    const s = this.sim;
    this.hud.hideFinish(); this.hud.clearAnnounce(); this.hud.setVisible(false);
    this.world.setVisible(false);
    this.usedFatality = true; this.usedSecondary = secondary;
    const def = s.fatality!.def;
    this.fatalityName = def.name;
    this.fatPlayer = new FatalityPlayer(this, def, s.fighters[winner], s.fighters[1 - winner as 0 | 1], secondary, Math.floor(Math.random() * 1e6));
    this.cameras.main.resetFX();
  }

  private endFatality(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.fatPlayer?.destroy(); this.fatPlayer = null;
      this.sim.finishFatality();
      this.finish();
    });
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    const s = this.sim;
    const w = s.matchWinner ?? (s.wins[0] >= s.wins[1] ? 0 : 1);
    const winnerId = s.fighters[w].char.id, loserId = s.fighters[1 - w as 0 | 1].char.id;
    // stats are only credited for matches involving a human winner (CPU wins still count as losses for the human's fighter)
    const humanWon = w === 0 ? this.cfg.p1Human : this.cfg.p2Human;
    if (humanWon) recordMatch(winnerId, loserId, this.usedFatality, this.usedSecondary);
    const res: MatchResult = {
      cfg: this.cfg, winner: w as 0 | 1, wins: [...s.wins] as [number, number], fatality: this.usedFatality,
      secondary: this.usedSecondary, fatalityName: this.fatalityName,
    };
    const go = () => {
      if (this.cfg.mode === 'tournament') this.scene.start('Tournament', { result: res });
      else this.scene.start('Results', { result: res });
    };
    if (this.cameras.main.fadeEffect.isRunning || this.fatDone) { go(); return; }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', go);
  }

  /* -------------------------------------------------------------- render */
  private updateCamera(): void {
    const [a, b] = this.sim.fighters;
    const mid = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
    const tz = Phaser.Math.Clamp(1.2 - (dist - 180) / 1400, 1.0, 1.2);
    this.camZ += (tz - this.camZ) * 0.08;
    const half = GAME_W / 2 / this.camZ;
    const tx = Phaser.Math.Clamp(mid, half, GAME_W - half);
    this.camX += (tx - this.camX) * 0.12;
    this.world.setScale(this.camZ);
    this.world.setPosition(GAME_W / 2 - this.camZ * this.camX, GAME_H / 2 - this.camZ * GAME_H / 2);
    this.stage.setCamera(this.camX, this.camZ);
  }

  private render(): void {
    const s = this.sim;
    this.gGhost.clear(); this.gFighter.clear(); this.gProj.clear(); this.gFx.clear();
    for (const i of [0, 1] as const) {
      const f = s.fighters[i];
      this.ghostAge[i]++;
      if (f.sp?.def.kind === 'rush' && f.sp.stage === 'run' && f.sp.def.rush!.vis !== 'none') {
        const r = f.sp.def.rush!;
        drawGhost(this.gGhost, r.vis, f.x - f.facing * 30, f.y, f.facing, r.color, this.ghostAge[i], 0.55);
      }
      if (f.sp && f.sp.ult) {
        this.gGhost.fillStyle(specialColor(f.sp.def), 0.18 + 0.08 * Math.sin(s.frame * 0.4));
        this.gGhost.fillEllipse(f.x, f.y - 90, 150, 230);
      }
      const dead = f.state === 'dead' && s.phase === 'finish';
      drawFighter(this.gFighter, f, { alpha: dead ? 0.95 : 1, flash: f.hitFlash > 0 ? f.hitFlash / 7 : 0, shadow: true });
    }
    for (const p of s.projectiles) {
      if (p.delay > 0) continue;
      drawProjectile(this.gProj, p.vis, p.x, p.y, p.dir, p.w, p.h, p.color, p.color2, p.age);
    }
    this.fx.draw(this.gFx);
  }
}
