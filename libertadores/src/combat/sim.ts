import {
  ARENA, emptyInput, type AnimName, type CharacterDef, type Facing, type FatalityDef, type FatInput,
  type InputFrame, type SimEvent, type SpecialDef,
} from './types';
import { normalAttack, totalFrames, type AttackData, type HitSpec, type NormalKind } from './moves';
import {
  buffAmount, createFighter, type ActiveSpecial, type Fighter, type Projectile, type Strike,
} from './fighter';
import { Rng, clamp } from '../utils/rng';

export const FPS = 60;
export const STAND_H = 170;
export const CROUCH_H = 105;
export const BODY_W = 54;
const INTRO_FRAMES = 100;
const KO_FRAMES = 120;
const ROUND_END_FRAMES = 110;
const FINISH_FRAMES = 660;
const MATCH_OVER_FRAMES = 190;
const FATALITY_SEQ_WINDOW = 110;

export type Phase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'finish' | 'matchOver' | 'fatality' | 'done';

export interface MatchConfig {
  chars: [CharacterDef, CharacterDef];
  roundsToWin: number;          // 1..3
  timer: number;                // seconds per round, 0 = infinite
  fatalityHuman: [boolean, boolean]; // who can perform a fatality when winning
  secondaryUnlocked: [boolean, boolean];
  seed?: number;
  fast?: boolean;               // headless simulation: skip intro/ko/round-end animations
}

export interface ComboDisplay { hits: number; damage: number; timer: number }
export interface Box { x0: number; x1: number; y0: number; y1: number }

const overlap = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export function hurtbox(f: Fighter): Box | null {
  if (f.state === 'knockdown' || f.state === 'getup' || f.state === 'dead' || f.hidden) return null;
  let h = STAND_H * f.char.art.height;
  let w = BODY_W;
  if (f.state === 'launched') { h = 120; w = 70; }
  else if (!f.grounded) h = 150 * f.char.art.height;
  else if (f.crouching) h = CROUCH_H * f.char.art.height;
  else if (f.state === 'dazed') h = 90;
  return { x0: f.x - w / 2, x1: f.x + w / 2, y0: f.y - h, y1: f.y };
}
export function strikeBox(f: Fighter, s: { reach: number; yOff: number; height: number }): Box {
  const inner = BODY_W / 4;
  const x0 = f.facing === 1 ? f.x + inner : f.x - s.reach;
  const x1 = f.facing === 1 ? f.x + s.reach : f.x - inner;
  return { x0, x1, y0: f.y - s.yOff - s.height, y1: f.y - s.yOff };
}

export function specialColor(def: SpecialDef): number {
  return def.proj?.color ?? def.rush?.color ?? def.combo?.color ?? def.buff?.color ?? def.counter?.color
    ?? def.teleport?.color ?? def.aerial?.color ?? def.evade?.color ?? 0xffffff;
}

const isNeutral = (f: Fighter) => f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'dash' || f.state === 'jump';

function defaultSpec(over: Partial<HitSpec>): HitSpec {
  return {
    damage: 30, hitstun: 18, blockstun: 12, knockback: 6, launch: 0, level: 'mid', hitstop: 7, meter: 8,
    strength: 'special', kdown: false, unblockable: false, chip: 0.1, effect: 'none', ...over,
  };
}

export class FightSim {
  cfg: MatchConfig;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  events: SimEvent[] = [];
  frame = 0;
  phase: Phase = 'intro';
  phaseT = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  timerFrames: number;
  hitstop = 0;
  combo: [ComboDisplay, ComboDisplay] = [{ hits: 0, damage: 0, timer: 0 }, { hits: 0, damage: 0, timer: 0 }];
  matchWinner: 0 | 1 | null = null;
  roundWinner: 0 | 1 | null = null;
  koRound = false;
  fatality: { winner: 0 | 1; secondary: boolean; def: FatalityDef } | null = null;
  rng: Rng;
  private nextProjId = 1;
  private draws = 0;
  private finishAllowed = false;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed ?? 1);
    this.fighters = [createFighter(0, cfg.chars[0], 470, 1), createFighter(1, cfg.chars[1], 810, -1)];
    this.timerFrames = cfg.timer * FPS;
    if (cfg.fast) this.phase = 'fight';
    else this.events.push({ type: 'roundStart', round: 1 });
  }

  get slowmo(): boolean { return this.phase === 'ko' && this.phaseT < 55 && this.koRound; }
  get timerSeconds(): number { return this.cfg.timer > 0 ? Math.ceil(this.timerFrames / FPS) : -1; }

  /* ----------------------------------------------------------- main step */
  step(inputs: [InputFrame, InputFrame]): void {
    this.events = [];
    this.frame++;
    for (const f of this.fighters) f.clock = this.frame;
    if (this.hitstop > 0) { this.hitstop--; this.updateViews(); return; }
    this.phaseT++;
    switch (this.phase) {
      case 'intro':
        for (const f of this.fighters) this.tickTimers(f);
        if (this.phaseT >= INTRO_FRAMES) { this.phase = 'fight'; this.phaseT = 0; this.events.push({ type: 'fight' }); }
        break;
      case 'fight': this.stepFight(inputs); break;
      case 'ko':
        this.stepPassive();
        if (this.phaseT >= (this.koRound ? KO_FRAMES : 70)) this.afterKo();
        break;
      case 'roundEnd':
        this.stepPassive();
        if (this.phaseT >= ROUND_END_FRAMES) this.startRound();
        break;
      case 'finish': this.stepFinish(inputs); break;
      case 'matchOver':
        this.stepPassive();
        if (this.phaseT >= MATCH_OVER_FRAMES) { this.phase = 'done'; }
        break;
      case 'fatality': case 'done': break;
    }
    this.updateViews();
  }

  finishFatality(): void { this.phase = 'done'; }

  private stepFight(inputs: [InputFrame, InputFrame]): void {
    if (this.cfg.timer > 0) {
      this.timerFrames--;
      if (this.timerFrames === 600) this.events.push({ type: 'timerWarn' });
    }
    this.fighters.forEach((f, i) => this.updateFighter(f, this.fighters[1 - i], inputs[i]));
    this.updatePhysics();
    this.resolveStrikes();
    this.updateProjectiles();
    this.updateCombos();
    this.checkEnd();
  }

  private stepPassive(): void {
    const neutral = emptyInput();
    this.fighters.forEach((f, i) => this.updateFighter(f, this.fighters[1 - i], neutral));
    this.updatePhysics();
    this.updateCombos();
  }

  /* --------------------------------------------------------------- rounds */
  private checkEnd(): void {
    const [a, b] = this.fighters;
    if (a.hp <= 0 || b.hp <= 0) {
      this.endRound(a.hp <= 0 && b.hp <= 0 ? null : a.hp <= 0 ? 1 : 0, true);
    } else if (this.cfg.timer > 0 && this.timerFrames <= 0) {
      this.events.push({ type: 'timeout' });
      const w = a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : null;
      this.endRound(w, false);
    }
  }

  private endRound(winner: 0 | 1 | null, ko: boolean): void {
    this.koRound = ko;
    this.phase = 'ko';
    this.phaseT = 0;
    this.projectiles = [];
    let w = winner;
    if (w === null) {
      this.draws++;
      if (this.draws >= 3) w = this.fighters[0].hp / this.fighters[0].maxHp >= this.fighters[1].hp / this.fighters[1].maxHp ? 0 : 1;
    }
    this.roundWinner = w;
    if (ko) {
      for (const f of this.fighters) if (f.hp <= 0) {
        this.events.push({ type: 'ko', loser: f.idx });
        f.dead = true;
        if (f.grounded && f.state !== 'launched') { f.vy = -9; f.vx = -f.facing * 4; f.grounded = false; f.state = 'launched'; }
      }
    }
    if (w !== null) {
      this.wins[w]++;
      if (this.wins[w] >= this.cfg.roundsToWin) this.matchWinner = w;
    }
    for (const f of this.fighters) { f.atk = null; f.sp = null; f.hidden = false; }
    if (this.cfg.fast) this.afterKo();
  }

  private afterKo(): void {
    const w = this.roundWinner;
    if (w !== null) {
      const win = this.fighters[w];
      if (!win.dead) { win.state = 'win'; win.vx = 0; this.setAnim(win, 'win'); }
    }
    this.phaseT = 0;
    if (this.matchWinner !== null) {
      const mw = this.matchWinner;
      this.events.push({ type: 'matchEnd', winner: mw, ko: this.koRound });
      this.finishAllowed = this.koRound && this.cfg.fatalityHuman[mw] && !this.cfg.fast;
      if (this.finishAllowed) {
        const loser = this.fighters[1 - mw as 0 | 1];
        loser.state = 'dazed'; loser.grounded = true; loser.y = ARENA.ground; loser.vx = 0; loser.vy = 0; loser.dead = true; loser.invuln = 9999;
        this.setAnim(loser, 'dazed');
        const win = this.fighters[mw];
        win.state = 'idle'; win.invuln = 9999; win.fatHist = [];
        this.phase = 'finish';
        this.events.push({ type: 'finishWindow', winner: mw });
      } else {
        this.phase = 'matchOver';
        if (this.cfg.fast) this.phase = 'done';
      }
    } else {
      this.phase = 'roundEnd';
      this.events.push({ type: 'roundEnd', winner: w });
      if (this.cfg.fast) this.startRound();
    }
  }

  private startRound(): void {
    this.round++;
    const [a, b] = this.fighters;
    const na = createFighter(0, a.char, 470, 1); na.meter = a.meter;
    const nb = createFighter(1, b.char, 810, -1); nb.meter = b.meter;
    this.fighters = [na, nb];
    this.projectiles = [];
    this.combo = [{ hits: 0, damage: 0, timer: 0 }, { hits: 0, damage: 0, timer: 0 }];
    this.timerFrames = this.cfg.timer * FPS;
    this.roundWinner = null;
    this.hitstop = 0;
    if (this.cfg.fast) { this.phase = 'fight'; this.phaseT = 0; return; }
    this.phase = 'intro'; this.phaseT = 0;
    this.events.push({ type: 'roundStart', round: this.round });
  }

  /* ---------------------------------------------------------- finish phase */
  private stepFinish(inputs: [InputFrame, InputFrame]): void {
    this.stepPassive();
    const wi = this.matchWinner as 0 | 1;
    const w = this.fighters[wi];
    const inp = inputs[wi];
    const p = inp.pressed;
    const fwdP = w.facing === 1 ? p.right : p.left;
    const backP = w.facing === 1 ? p.left : p.right;
    if (fwdP) w.fatHist.push({ d: 'F', f: this.frame });
    if (backP) w.fatHist.push({ d: 'B', f: this.frame });
    if (p.up) w.fatHist.push({ d: 'U', f: this.frame });
    if (p.down) w.fatHist.push({ d: 'D', f: this.frame });
    if (w.fatHist.length > 12) w.fatHist.splice(0, w.fatHist.length - 12);
    if (p.fatality) {
      const prim = w.char.fatality;
      const sec = w.char.secondary;
      if (this.matchesSequence(w, prim.input)) this.startFatality(wi, false);
      else if (this.cfg.secondaryUnlocked[wi] && this.matchesSequence(w, sec.input)) this.startFatality(wi, true);
      else this.events.push({ type: 'fatalityFail' });
    }
    if (this.phase === 'finish' && this.phaseT >= FINISH_FRAMES) {
      this.phase = 'matchOver'; this.phaseT = 0;
      const win = this.fighters[wi];
      win.state = 'win'; this.setAnim(win, 'win');
    }
  }

  matchesSequence(w: Fighter, seq: FatInput[]): boolean {
    if (w.fatHist.length < seq.length) return false;
    const tail = w.fatHist.slice(-seq.length);
    if (tail.some((t, i) => t.d !== seq[i])) return false;
    return this.frame - tail[0].f <= FATALITY_SEQ_WINDOW;
  }

  private startFatality(winner: 0 | 1, secondary: boolean): void {
    const def = secondary ? this.fighters[winner].char.secondary : this.fighters[winner].char.fatality;
    this.fatality = { winner, secondary, def };
    this.phase = 'fatality';
    this.events.push({ type: 'fatality', winner, secondary });
  }

  /* ------------------------------------------------------ fighter updating */
  private tickTimers(f: Fighter): void {
    if (f.hitFlash > 0) f.hitFlash--;
    if (f.invuln > 0 && f.invuln < 9000) f.invuln--;
    for (let i = 0; i < 4; i++) if (f.cooldowns[i] > 0) f.cooldowns[i]--;
    if (f.activeBuffs.length) {
      for (const b of f.activeBuffs) b.frames--;
      f.activeBuffs = f.activeBuffs.filter((b) => b.frames > 0 && !(b.type === 'shield' && b.hits <= 0));
    }
    f.buffs = f.activeBuffs.map((b) => b.type);
    if (f.chainTimer > 0 && --f.chainTimer === 0) f.chain = 0;
  }

  private setAnim(f: Fighter, name: AnimName, len = 0, force = false): void {
    if (f.anim !== name || force) { f.anim = name; f.animFrame = 0; }
    f.animLen = len;
  }

  private setState(f: Fighter, s: Fighter['state']): void {
    if (f.state !== s) { f.state = s; f.sf = 0; }
  }

  private updateFighter(f: Fighter, o: Fighter, inp: InputFrame): void {
    this.tickTimers(f);
    f.sf++; f.animFrame++;
    const h = inp.held;
    if (isNeutral(f) || f.state === 'block') {
      if (f.grounded && f.state !== 'dash' && (!f.sp)) f.facing = o.x >= f.x ? 1 : -1;
    }
    switch (f.state) {
      case 'idle': case 'walk': case 'crouch': case 'block': this.groundActions(f, o, inp); break;
      case 'jump': this.airActions(f, o, inp); break;
      case 'dash':
        f.dashT--;
        if (f.dashT <= 0) { this.setState(f, 'idle'); f.vx = 0; }
        break;
      case 'attack': this.updateAttack(f, o, inp); break;
      case 'special': this.updateSpecial(f, o); break;
      case 'hit':
        if (--f.hitstun <= 0) { this.setState(f, 'idle'); f.comboHits = 0; f.juggles = 0; }
        break;
      case 'knockdown':
        if (--f.kd <= 0) { this.setState(f, 'getup'); f.kd = 18; f.invuln = 22; this.setAnim(f, 'getup', 18); }
        break;
      case 'getup':
        if (--f.kd <= 0) { this.setState(f, 'idle'); f.comboHits = 0; f.juggles = 0; }
        break;
      default: break;
    }
    f.crouching = f.grounded && (f.state === 'crouch' || (f.state === 'block' && h.down) || (f.atk?.data.id === 'crouchLight' || f.atk?.data.id === 'crouchHeavy'));
    if (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch') { if (f.lag <= 0) { f.comboHits = 0; f.juggles = 0; } }
  }

  private groundActions(f: Fighter, o: Fighter, inp: InputFrame): void {
    const h = inp.held, p = inp.pressed;
    const fwd = f.facing === 1 ? h.right : h.left;
    const back = f.facing === 1 ? h.left : h.right;
    f.vx = 0;
    if (f.blockstun > 0) {
      f.blockstun--;
      this.setState(f, 'block');
      this.setAnim(f, h.down ? 'crouchBlock' : 'block');
      // guard breaker: spend 25 meter while blocking
      if (p.heavy && f.meter >= 25) this.guardBreaker(f, o);
      return;
    }
    if (f.lag > 0) { f.lag--; this.setAnim(f, 'crouch'); return; }
    if (p.fatality && f.meter >= 100 && this.phase === 'fight') { this.startUltimate(f, o); return; }
    if (p.throw) { this.startNormal(f, 'throw'); return; }
    if (p.special && this.trySpecial(f, o, inp)) return;
    if (p.heavy) { this.startNormal(f, h.down ? 'crouchHeavy' : 'heavy'); return; }
    if (p.light) { this.startNormal(f, h.down ? 'crouchLight' : 'light'); return; }
    if (h.block) {
      this.setState(f, 'block');
      this.setAnim(f, h.down ? 'crouchBlock' : 'block');
      return;
    }
    if (h.up) { this.startJump(f, fwd, back); return; }
    if (h.down) { this.setState(f, 'crouch'); this.setAnim(f, 'crouch'); return; }
    // dash on double tap
    if (p.left || p.right) {
      const dir = p.right ? 1 : -1;
      if (f.tapDir === dir && this.frame - f.tapFrame <= 14) {
        const isFwd = dir === f.facing;
        f.tapDir = 0;
        this.setState(f, 'dash');
        f.dashT = isFwd ? 13 : 15;
        f.vx = dir * f.stats.dashSpeed * (1 + buffAmount(f, 'speed'));
        if (!isFwd) f.invuln = Math.max(f.invuln, 6);
        this.setAnim(f, isFwd ? 'dash' : 'backdash', f.dashT, true);
        return;
      }
      f.tapDir = dir; f.tapFrame = this.frame;
    }
    if (fwd || back) {
      this.setState(f, 'walk');
      const sp = 1 + buffAmount(f, 'speed');
      f.vx = fwd ? f.facing * f.stats.walkSpeed * sp : -f.facing * f.stats.backSpeed * sp;
      this.setAnim(f, fwd ? 'walkF' : 'walkB');
    } else {
      this.setState(f, 'idle');
      this.setAnim(f, 'idle');
      f.chain = f.chainTimer > 0 ? f.chain : 0;
    }
  }

  private guardBreaker(f: Fighter, o: Fighter): void {
    f.meter -= 25;
    f.blockstun = 0;
    f.invuln = 14;
    f.lag = 10;
    this.setState(f, 'idle');
    this.setAnim(f, 'buff', 20, true);
    this.events.push({ type: 'clash', x: f.x, y: f.y - 90 });
    if (Math.abs(o.x - f.x) < 150 && o.grounded) {
      this.applyHit(f, o, defaultSpec({ damage: 22, hitstun: 22, knockback: 16, kdown: false, unblockable: true, hitstop: 10, strength: 'heavy', meter: 0, color: 0xffffff }), (f.x + o.x) / 2, f.y - 90);
    }
  }

  private startJump(f: Fighter, fwd: boolean, back: boolean): void {
    f.grounded = false;
    f.vy = -f.stats.jumpVel;
    const sp = 1 + buffAmount(f, 'speed');
    f.vx = fwd ? f.facing * f.stats.walkSpeed * 1.3 * sp : back ? -f.facing * f.stats.backSpeed * 1.2 * sp : 0;
    f.airUsed = false;
    this.setState(f, 'jump');
    this.setAnim(f, 'jumpUp', 0, true);
  }

  private airActions(f: Fighter, o: Fighter, inp: InputFrame): void {
    this.setAnim(f, f.vy < 0 ? 'jumpUp' : 'jumpDown');
    if (!f.airUsed) {
      if (inp.pressed.heavy) { f.airUsed = true; this.startNormal(f, 'airHeavy'); }
      else if (inp.pressed.light) { f.airUsed = true; this.startNormal(f, 'airLight'); }
    }
  }

  private startNormal(f: Fighter, kind: NormalKind, chainIdx = 0): void {
    const data: AttackData = { ...normalAttack(f.char, kind) };
    const range = buffAmount(f, 'range');
    if (range) data.reach *= 1 + range;
    f.atk = { data, frame: 0, connected: false, chainIdx };
    this.setState(f, 'attack');
    this.setAnim(f, data.anim, totalFrames(data), true);
    if (!data.air) f.vx = 0;
  }

  private updateAttack(f: Fighter, o: Fighter, inp: InputFrame): void {
    const a = f.atk;
    if (!a) { this.setState(f, f.grounded ? 'idle' : 'jump'); return; }
    a.frame++;
    const d = a.data;
    if (a.frame === d.startup) {
      this.events.push({ type: 'whoosh', by: f.idx, heavy: d.strength === 'heavy' });
      if (d.isThrow) { /* handled in resolve */ }
    }
    // cancel windows
    if (a.connected && a.frame > d.startup && a.frame < d.startup + d.active + 12 && f.grounded) {
      const p = inp.pressed, h = inp.held;
      if (d.cancels.includes('special') && p.special && this.trySpecial(f, o, inp)) return;
      if (d.cancels.includes('heavy') && p.heavy) {
        f.chain++; f.chainTimer = 40;
        this.startNormal(f, h.down ? 'crouchHeavy' : 'heavy', f.chain); return;
      }
      if (d.cancels.includes('light') && p.light && f.chain < 3) {
        f.chain++; f.chainTimer = 40;
        this.startNormal(f, h.down ? 'crouchLight' : 'light', f.chain); return;
      }
    }
    if (a.frame >= totalFrames(d)) {
      f.atk = null;
      if (f.grounded) { this.setState(f, 'idle'); f.vx = 0; f.chainTimer = 20; } else this.setState(f, 'jump');
    }
  }

  /* -------------------------------------------------------------- specials */
  private trySpecial(f: Fighter, o: Fighter, inp: InputFrame): boolean {
    if (!f.grounded) return false;
    const h = inp.held;
    const fwd = f.facing === 1 ? h.right : h.left;
    const slot = h.up ? 3 : h.down ? 2 : fwd ? 1 : 0;
    if (f.cooldowns[slot] > 0) return false;
    const def = f.char.specials[slot];
    let ex = false;
    if (h.block && f.meter >= 50) { f.meter -= 50; ex = true; }
    this.startSpecial(f, o, def, slot, ex, false);
    return true;
  }

  private startUltimate(f: Fighter, o: Fighter): void {
    f.meter = 0;
    const slot = f.char.ultimateSlot;
    const def = f.char.specials[slot];
    this.startSpecial(f, o, def, slot, false, true);
  }

  private startSpecial(f: Fighter, o: Fighter, def: SpecialDef, slot: number, ex: boolean, ult: boolean): void {
    const mul = ult ? 2.3 : ex ? 1.4 : 1;
    let total = 0;
    switch (def.kind) {
      case 'proj': total = def.startup + def.recovery + (def.proj!.count - 1) * def.proj!.stagger; break;
      case 'rush': total = def.startup + def.rush!.duration + def.recovery; break;
      case 'combo': total = def.startup + (def.combo!.hits + (ex ? 1 : 0)) * def.combo!.interval + def.recovery; break;
      case 'buff': total = def.startup + def.recovery; break;
      case 'counter': total = def.startup + Math.round(def.counter!.window * (ex ? 1.3 : 1)) + def.recovery; break;
      case 'teleport': total = def.startup + 20 + def.recovery; break;
      case 'aerial': total = 9999; break;
      case 'evade': total = def.startup + def.evade!.frames + (def.evade!.strike ? 10 : 0) + def.recovery; break;
    }
    f.sp = {
      def, slot, frame: 0, ex, ult, dmgMul: mul, stage: 'start', stageFrame: 0,
      connected: false, keysDone: new Set(), spawned: false, total,
    };
    f.atk = null;
    f.cooldowns[slot] = Math.round(def.cooldown * (ex ? 0.6 : 1));
    f.invuln = Math.max(f.invuln, def.invuln ?? 0, ex ? 8 : 0, ult ? def.startup + 12 : 0);
    this.setState(f, 'special');
    f.vx = 0;
    const animByKind: Record<SpecialDef['kind'], AnimName> = {
      proj: 'cast', rush: 'rush', combo: 'slash', buff: 'buff', counter: 'counter', teleport: 'cast', aerial: 'aerial', evade: 'evade',
    };
    this.setAnim(f, animByKind[def.kind], 0, true);
    const color = specialColor(def);
    this.events.push({ type: 'special', by: f.idx, slot, ex, color });
    if (ult) {
      this.events.push({ type: 'ultimate', by: f.idx, color });
      this.hitstop = Math.max(this.hitstop, 28);
      f.hitFlash = 10;
    }
    if (def.kind === 'aerial' || def.kind === 'proj') { /* nothing extra */ }
  }

  private endSpecial(f: Fighter): void {
    f.sp = null;
    f.hidden = false;
    f.vx = 0;
    this.setState(f, f.grounded ? 'idle' : 'jump');
    if (f.grounded) f.lag = 0;
  }

  private updateSpecial(f: Fighter, o: Fighter): void {
    const s = f.sp;
    if (!s) { this.setState(f, f.grounded ? 'idle' : 'jump'); return; }
    s.frame++;
    s.stageFrame++;
    const def = s.def;
    switch (def.kind) {
      case 'proj':
        if (!s.spawned && s.frame >= def.startup) { s.spawned = true; this.spawnProjectiles(f, o, s); }
        break;
      case 'rush': {
        const r = def.rush!;
        if (s.stage === 'start' && s.frame >= def.startup) {
          s.stage = 'run'; s.stageFrame = 0;
          this.events.push({ type: 'whoosh', by: f.idx, heavy: true });
          this.setAnim(f, 'rush', 0, true);
        }
        if (s.stage === 'run') {
          f.vx = f.facing * r.speed * (s.ex ? 1.1 : 1) * (1 + buffAmount(f, 'speed') * 0.5);
          if (s.connected || s.stageFrame >= r.duration) {
            s.stage = 'rec'; f.vx = 0; s.total = s.frame + def.recovery;
          }
        }
        break;
      }
      case 'combo': {
        const c = def.combo!;
        const n = c.hits + (s.ex ? 1 : 0);
        for (let i = 0; i < n; i++) {
          if (s.frame === def.startup + i * c.interval) {
            if (Math.abs(o.x - f.x) > 46) f.x += f.facing * c.step;
            this.setAnim(f, 'slash', 0, true);
            this.events.push({ type: 'whoosh', by: f.idx, heavy: i === n - 1 });
          }
        }
        break;
      }
      case 'buff':
        if (!s.spawned && s.frame >= def.startup) {
          s.spawned = true;
          const b = def.buff!;
          const dur = Math.round(b.duration * (s.ex ? 1.5 : 1));
          const existing = f.activeBuffs.find((x) => x.type === b.type);
          if (existing) { existing.frames = dur; existing.hits = b.type === 'shield' ? b.amount : 0; }
          else f.activeBuffs.push({ type: b.type, frames: dur, amount: b.type === 'shield' ? 0 : b.amount, color: b.color, hits: b.type === 'shield' ? b.amount : 0 });
          this.events.push({ type: 'buff', by: f.idx, color: b.color });
        }
        break;
      case 'counter': {
        const c = def.counter!;
        const win = Math.round(c.window * (s.ex ? 1.3 : 1));
        if (s.stage === 'start') {
          s.stage = 'wait'; s.stageFrame = 0;
        }
        if (s.stage === 'wait' && s.stageFrame > def.startup + win) {
          s.stage = 'rec'; s.total = s.frame + def.recovery + 10; this.setAnim(f, 'idle', 0, true);
        }
        if (s.stage === 'strike') {
          if (s.stageFrame === 1) {
            const tx = clamp(o.x - f.facing * 62, ARENA.left, ARENA.right);
            f.x = tx; f.facing = o.x >= f.x ? 1 : -1;
            this.setAnim(f, 'slash', 0, true);
            this.events.push({ type: 'whoosh', by: f.idx, heavy: true });
          }
        }
        break;
      }
      case 'teleport': {
        const t = def.teleport!;
        if (s.frame === def.startup) {
          f.hidden = true; f.invuln = Math.max(f.invuln, 40);
          this.events.push({ type: 'teleport', by: f.idx, color: t.color });
        }
        if (s.frame === def.startup + 10) {
          const nx = t.behind ? o.x - o.facing * 74 : o.x + o.facing * 74;
          f.x = clamp(nx, ARENA.left, ARENA.right);
          f.facing = o.x >= f.x ? 1 : -1;
          f.hidden = false; f.invuln = Math.max(f.invuln, 8);
          this.setAnim(f, 'slash', 0, true);
          this.events.push({ type: 'teleport', by: f.idx, color: t.color });
          this.events.push({ type: 'whoosh', by: f.idx, heavy: true });
        }
        break;
      }
      case 'aerial': {
        const a = def.aerial!;
        if (s.stage === 'start' && s.frame >= def.startup) {
          s.stage = 'air'; s.stageFrame = 0;
          f.grounded = false; f.vy = -a.vy; f.vx = f.facing * a.vx;
          this.events.push({ type: 'whoosh', by: f.idx, heavy: true });
        }
        if (s.stage === 'air' && a.dive && f.vy > 0) f.vy += 0.45;
        break;
      }
      case 'evade': {
        const e = def.evade!;
        const t = s.frame - def.startup;
        if (t >= 0 && t < e.frames) {
          f.vx = f.facing * e.dir * e.speed * (1 - (t / e.frames) * 0.6);
          f.invuln = Math.max(f.invuln, 2);
          if (t === 0) this.events.push({ type: 'teleport', by: f.idx, color: e.color });
        } else if (t === e.frames && e.strike) {
          this.setAnim(f, 'slash', 0, true);
          this.events.push({ type: 'whoosh', by: f.idx, heavy: true });
        }
        break;
      }
    }
    if (f.sp && s.frame >= s.total) this.endSpecial(f);
  }

  /** Strikes (hitboxes) that are active this frame for a fighter. */
  private getStrikes(f: Fighter): Strike[] {
    const out: Strike[] = [];
    if (f.state === 'attack' && f.atk) {
      const a = f.atk, d = a.data;
      if (!a.connected && a.frame >= d.startup && a.frame < d.startup + d.active) {
        out.push({ key: 0, reach: d.reach, yOff: d.yOff, height: d.height, spec: d });
      }
    } else if (f.state === 'special' && f.sp) {
      const s = f.sp, def = s.def;
      const done = (k: number) => s.keysDone.has(k);
      const dm = s.dmgMul;
      switch (def.kind) {
        case 'rush':
          if (s.stage === 'run' && !done(0)) {
            const r = def.rush!;
            out.push({ key: 0, reach: r.reach, yOff: 10, height: 110, spec: defaultSpec({
              damage: def.damage * dm, hitstun: 22, blockstun: 14, knockback: 11, launch: r.launch ? -14 : 0,
              hitstop: 9, strength: 'special', chip: 0.1, color: r.color }) });
          }
          break;
        case 'combo': {
          const c = def.combo!;
          const n = c.hits + (s.ex ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const hf = def.startup + i * c.interval;
            if (s.frame >= hf && s.frame <= hf + 3 && !done(i)) {
              const last = i === n - 1;
              out.push({ key: i, reach: c.reach, yOff: 20, height: 100, spec: defaultSpec({
                damage: def.damage * dm, hitstun: last ? 24 : 18, blockstun: 11, knockback: last ? 8 : 2.5,
                launch: last && c.launchFinisher ? -14 : 0, hitstop: last ? 9 : 5, strength: last ? 'special' : 'light',
                chip: 0.08, meter: 5, color: c.color }) });
            }
          }
          break;
        }
        case 'counter':
          if (s.stage === 'strike' && s.stageFrame >= 3 && s.stageFrame <= 10 && !done(0)) {
            out.push({ key: 0, reach: 95, yOff: 10, height: 120, spec: defaultSpec({
              damage: def.damage * dm, hitstun: 26, knockback: 9, launch: def.counter!.launch ? -14 : 0, hitstop: 10,
              unblockable: true, color: def.counter!.color }) });
          }
          break;
        case 'teleport': {
          const t = def.teleport!;
          const st = def.startup + 10;
          if (s.frame >= st && s.frame <= st + 7 && !done(0)) {
            out.push({ key: 0, reach: t.reach, yOff: 10, height: 120, spec: defaultSpec({
              damage: def.damage * dm, hitstun: 24, knockback: 8, launch: -12, hitstop: 9, color: t.color }) });
          }
          break;
        }
        case 'aerial': {
          const a = def.aerial!;
          if (s.stage === 'air' && s.stageFrame > 3 && !done(0) && !f.grounded) {
            out.push({ key: 0, reach: a.reach, yOff: 0, height: 130, spec: defaultSpec({
              damage: def.damage * dm, hitstun: 22, knockback: 7, kdown: true, hitstop: 9, level: 'overhead', color: a.color }) });
          }
          break;
        }
        case 'evade': {
          const e = def.evade!;
          const t = s.frame - def.startup - e.frames;
          if (e.strike && t >= 1 && t <= 8 && !done(0)) {
            out.push({ key: 0, reach: 88, yOff: 10, height: 110, spec: defaultSpec({
              damage: def.damage * dm, hitstun: 22, knockback: 9, launch: -11, hitstop: 8, color: e.color }) });
          }
          break;
        }
        default: break;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ projectiles */
  private spawnProjectiles(f: Fighter, o: Fighter, s: ActiveSpecial): void {
    const ps = s.def.proj!;
    const scale = s.ult ? 1.8 : s.ex ? 1.25 : 1;
    this.events.push({ type: 'projectile', by: f.idx, vis: ps.vis, color: ps.color });
    for (let i = 0; i < ps.count; i++) {
      const spec = defaultSpec({
        damage: s.def.damage * s.dmgMul, hitstun: ps.hitstun ?? 22, blockstun: 14, knockback: ps.knockback ?? 7,
        launch: ps.launch ?? (ps.effect === 'launch' ? -12 : 0), hitstop: 8, meter: 8, strength: 'special', chip: 0.12,
        effect: ps.effect === 'launch' ? 'none' : ps.effect, isProjectile: true, color: ps.color,
      });
      const p: Projectile = {
        id: this.nextProjId++, owner: f.idx, x: f.x, y: f.y - ps.yOff, vx: 0, vy: 0,
        w: ps.w * scale, h: ps.h * scale, vis: ps.vis, color: ps.color, color2: ps.color2 ?? 0xffffff,
        dir: f.facing, age: 0, life: ps.life, delay: i * ps.stagger, spawnIdx: i, spawnKind: ps.spawn,
        spec, speed: ps.speed * (s.ex ? 1.1 : 1), pierce: ps.pierce || s.ex || s.ult, gravity: ps.gravity, blocksProj: !!ps.blocksProj,
        hitsLeft: ps.hits ?? 1, rehit: 0, dead: false, isStatic: ps.speed === 0, hitSet: new Set(),
      };
      this.projectiles.push(p);
      if (p.delay === 0) this.activateProjectile(p, f, o, ps.count, ps.yStep, ps.yOff);
    }
  }

  private activateProjectile(p: Projectile, f: Fighter, o: Fighter, count: number, yStep: number, yOff: number): void {
    const dir = f.facing;
    const ground = ARENA.ground;
    p.dir = dir;
    switch (p.spawnKind) {
      case 'front':
        p.x = f.x + dir * (p.isStatic ? 130 : 50);
        p.y = ground - yOff + p.spawnIdx * yStep;
        p.vx = dir * p.speed;
        break;
      case 'sky':
        if (count > 1) { p.x = o.x + (p.spawnIdx - (count - 1) / 2) * 50; p.vx = dir * 1.5; p.vy = 10; }
        else { p.x = o.x - dir * 110; p.vx = dir * p.speed; p.vy = 9; }
        p.y = -60;
        break;
      case 'oppGround':
        p.x = o.x + (count > 1 ? (p.spawnIdx - (count - 1) / 2) * 72 : 0);
        p.y = ground - yOff;
        p.vx = 0;
        break;
      case 'behind':
        p.x = clamp(o.x + dir * 220, ARENA.left - 40, ARENA.right + 40) + p.spawnIdx * dir * 30;
        p.y = ground - yOff;
        p.dir = (-dir) as Facing;
        p.vx = -dir * p.speed;
        break;
    }
    p.y = Math.min(p.y, ground - p.h / 2 + (p.isStatic ? 0 : 0));
  }

  private updateProjectiles(): void {
    const ps = this.projectiles;
    for (const p of ps) {
      if (p.dead) continue;
      const owner = this.fighters[p.owner];
      const target = this.fighters[1 - p.owner];
      if (p.delay > 0) {
        p.delay--;
        if (p.delay === 0) {
          const s = owner.sp;
          const def = s?.def.proj;
          this.activateProjectile(p, owner, target, def?.count ?? 1, def?.yStep ?? 0, def?.yOff ?? 90);
        }
        continue;
      }
      p.age++;
      p.life--;
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      if (p.life <= 0 || p.x < ARENA.left - 260 || p.x > ARENA.right + 260) { p.dead = true; continue; }
      if (p.spawnKind === 'sky' && p.y + p.h / 2 >= ARENA.ground) { p.dead = true; continue; }
      if (p.rehit > 0) p.rehit--;
      if (p.hitSet.has(target.idx) && p.hitsLeft <= 1) continue;
      const hb = hurtbox(target);
      if (!hb || p.rehit > 0) continue;
      const pb: Box = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 };
      if (!overlap(pb, hb)) continue;
      const res = this.applyHit(owner, target, p.spec, p.x, p.y, p.dir);
      if (res === 'none') continue;
      p.hitSet.add(target.idx);
      if (p.hitsLeft > 1) { p.hitsLeft--; p.rehit = 8; }
      else if (!p.pierce || res === 'block' || res === 'absorbed') p.dead = true;
    }
    // projectile vs projectile
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.dead || a.delay > 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.dead || b.delay > 0 || a.owner === b.owner) continue;
        const ba: Box = { x0: a.x - a.w / 2, x1: a.x + a.w / 2, y0: a.y - a.h / 2, y1: a.y + a.h / 2 };
        const bb: Box = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2 };
        if (!overlap(ba, bb)) continue;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        if (a.blocksProj && !b.blocksProj) { b.dead = true; this.events.push({ type: 'clash', x: cx, y: cy }); }
        else if (b.blocksProj && !a.blocksProj) { a.dead = true; this.events.push({ type: 'clash', x: cx, y: cy }); }
        else if (!a.isStatic && !b.isStatic) {
          const da = a.spec.damage, db = b.spec.damage;
          if (da <= db * 1.2) a.dead = true;
          if (db <= da * 1.2) b.dead = true;
          this.events.push({ type: 'clash', x: cx, y: cy });
        }
        if (a.dead) break;
      }
    }
    this.projectiles = ps.filter((p) => !p.dead);
  }

  /* ------------------------------------------------------------- hit logic */
  private resolveStrikes(): void {
    const pending: { a: Fighter; d: Fighter; s: Strike; hx: number; hy: number }[] = [];
    for (const a of this.fighters) {
      const d = this.fighters[1 - a.idx];
      for (const s of this.getStrikes(a)) {
        const hb = hurtbox(d);
        if (!hb) continue;
        const sb = strikeBox(a, s);
        if (!overlap(sb, hb)) continue;
        if (s.spec.isThrow) {
          if (!a.grounded || !d.grounded || ['hit', 'launched', 'knockdown', 'getup', 'dazed', 'dead'].includes(d.state)) continue;
        }
        pending.push({ a, d, s, hx: (Math.max(sb.x0, hb.x0) + Math.min(sb.x1, hb.x1)) / 2, hy: (Math.max(sb.y0, hb.y0) + Math.min(sb.y1, hb.y1)) / 2 });
      }
    }
    for (const { a, d, s, hx, hy } of pending) {
      const res = this.applyHit(a, d, s.spec, hx, hy);
      if (res === 'none') continue;
      if (a.state === 'attack' && a.atk) a.atk.connected = true;
      if (a.sp) {
        a.sp.keysDone.add(s.key);
        a.sp.connected = true;
        if (a.sp.def.kind === 'counter') a.sp.total = a.sp.frame + 26;
        if (a.sp.def.kind === 'evade' || a.sp.def.kind === 'teleport') { /* keep */ }
      }
    }
  }

  private applyHit(a: Fighter, d: Fighter, spec: HitSpec, px: number, py: number, projDir?: Facing): 'hit' | 'block' | 'none' | 'absorbed' {
    if (d.invuln > 0 || d.hidden || d.state === 'knockdown' || d.state === 'getup' || d.state === 'dead') return 'none';
    const dir: Facing = projDir ?? a.facing;
    // counter stance
    const ds = d.sp;
    if (ds && ds.def.kind === 'counter' && ds.stage === 'wait' && !spec.isThrow) {
      ds.stage = 'strike'; ds.stageFrame = 0; d.invuln = 34;
      ds.total = ds.frame + 40;
      this.hitstop = Math.max(this.hitstop, 10);
      this.events.push({ type: 'counter', x: px, y: py, by: d.idx, color: ds.def.counter!.color });
      return 'absorbed';
    }
    // shield buff
    const sh = d.activeBuffs.find((b) => b.type === 'shield' && b.hits > 0);
    if (sh && !spec.isThrow) {
      sh.hits--;
      this.events.push({ type: 'shield', x: px, y: py, by: d.idx });
      this.hitstop = Math.max(this.hitstop, 4);
      return 'absorbed';
    }
    // block
    let blocked = false;
    if (d.state === 'block' && !spec.unblockable) {
      blocked = !((spec.level === 'low' && !d.crouching) || (spec.level === 'overhead' && d.crouching));
    }
    const mg = a.stats.meterGain;
    if (blocked) {
      const chipDmg = spec.damage * spec.chip * a.stats.attack / d.stats.defense;
      d.hp = Math.max(1, d.hp - chipDmg);
      d.blockstun = spec.blockstun + 2;
      d.vx = dir * (spec.knockback * 0.6 + 2.5);
      const cornered = d.x <= ARENA.left + 6 || d.x >= ARENA.right - 6;
      if (cornered && !spec.isProjectile) a.vx = -dir * (spec.knockback * 0.7 + 2.5);
      a.meter = Math.min(100, a.meter + spec.meter * 0.4 * mg);
      d.meter = Math.min(100, d.meter + 2.5 * d.stats.meterGain);
      this.hitstop = Math.max(this.hitstop, 4);
      this.events.push({ type: 'block', x: px, y: py, by: a.idx });
      this.setAnim(d, d.crouching ? 'crouchBlock' : 'block', 0, true);
      if (d.atk) d.atk = null;
      return 'block';
    }
    // clean hit
    const n = ++d.comboHits;
    const scale = spec.isThrow && n === 1 ? 1 : Math.max(0.3, Math.pow(0.88, n - 1));
    const dmgBoost = 1 + buffAmount(a, 'damage');
    const defBoost = 1 - Math.min(0.6, buffAmount(d, 'defense'));
    const dmg = spec.damage * a.stats.attack * dmgBoost * scale / d.stats.defense * defBoost;
    d.hp = Math.max(0, d.hp - dmg);
    a.chain = Math.min(a.chain, 3);
    // interrupt
    d.atk = null; d.sp = null; d.hidden = false; d.rooted = false;
    d.hitFlash = 7;
    let hs = Math.max(10, spec.hitstun - (n - 1) * 1.2);
    let launch = spec.launch;
    if (spec.effect === 'stun') hs = 64;
    else if (spec.effect === 'root') hs = 46;
    else if (spec.effect === 'pull') { d.x = clamp(a.x + dir * 70, ARENA.left, ARENA.right); hs = 34; }
    if (!d.grounded) {
      d.juggles++;
      d.grounded = false;
      if (spec.kdown || d.juggles > 3) { d.vy = 9; d.vx = dir * 2; }
      else { d.vy = -9.5; d.vx = dir * (spec.knockback * 0.4 + 1); }
      this.setState(d, 'launched');
    } else if (launch) {
      d.juggles = 1;
      d.grounded = false;
      d.vy = launch;
      d.vx = dir * (spec.knockback * 0.5 + 1.5);
      this.setState(d, 'launched');
      this.events.push({ type: 'launch', x: d.x, y: d.y - 90 });
    } else if (spec.kdown) {
      d.juggles = 1;
      d.grounded = false;
      d.vy = -8;
      d.vx = dir * (spec.knockback * 0.7 + 1);
      this.setState(d, 'launched');
      if (spec.isThrow) { d.x = clamp(a.x + dir * 40, ARENA.left, ARENA.right); d.vx = dir * 5; d.vy = -11; }
    } else {
      d.hitstun = hs;
      d.vx = dir * spec.knockback;
      this.setState(d, 'hit');
      const cornered = d.x <= ARENA.left + 6 || d.x >= ARENA.right - 6;
      if (cornered && !spec.isProjectile) a.vx = -dir * (spec.knockback * 0.6 + 1);
    }
    if (d.hp <= 0) {
      d.dead = true;
      if (d.grounded) { d.grounded = false; d.vy = -11; d.vx = dir * 6; this.setState(d, 'launched'); }
    }
    this.setAnim(d, spec.isThrow ? 'thrown' : d.state === 'launched' ? 'launched' : 'hit', 0, true);
    a.meter = Math.min(100, a.meter + spec.meter * mg);
    d.meter = Math.min(100, d.meter + dmg * 0.07 * d.stats.meterGain);
    this.hitstop = Math.max(this.hitstop, spec.hitstop);
    // combo display
    const c = this.combo[a.idx];
    if (n === 1 || c.timer <= 0) { c.hits = 1; c.damage = dmg; } else { c.hits = n; c.damage += dmg; }
    c.timer = 110;
    this.combo[d.idx] = { hits: 0, damage: 0, timer: 0 };
    if (spec.isThrow) this.events.push({ type: 'throw', x: px, y: py, by: a.idx });
    else this.events.push({ type: 'hit', x: px, y: py, strength: spec.strength, by: a.idx, color: spec.color });
    return 'hit';
  }

  private updateCombos(): void {
    for (const c of this.combo) { if (c.timer > 0) { c.timer--; if (c.timer === 0) { c.hits = 0; c.damage = 0; } } }
  }

  /* --------------------------------------------------------------- physics */
  private updatePhysics(): void {
    for (const f of this.fighters) {
      const frozen = f.state === 'special' && f.sp?.def.kind === 'teleport' && f.hidden;
      if (!f.grounded) {
        f.x += f.vx; f.y += f.vy;
        f.vy += f.state === 'launched' ? 0.85 : f.stats.gravity;
        if (f.y >= ARENA.ground) this.land(f);
      } else if (!frozen) {
        f.x += f.vx;
        f.vx *= 0.8;
        if (Math.abs(f.vx) < 0.05) f.vx = 0;
      }
      f.x = clamp(f.x, ARENA.left, ARENA.right);
    }
    this.separate();
  }

  private land(f: Fighter): void {
    f.y = ARENA.ground; f.vy = 0; f.grounded = true;
    this.events.push({ type: 'land', x: f.x, y: f.y });
    switch (f.state) {
      case 'jump': this.setState(f, 'idle'); f.vx = 0; f.airUsed = false; break;
      case 'launched':
        if (f.dead) { this.setState(f, 'dead'); f.vx *= 0.3; this.setAnim(f, 'dead', 0, true); }
        else { this.setState(f, 'knockdown'); f.kd = 44; f.vx *= 0.4; this.setAnim(f, 'knockdown', 44, true); f.juggles = 0; }
        this.hitstop = Math.max(this.hitstop, 3);
        break;
      case 'attack': f.atk = null; this.setState(f, 'idle'); f.vx = 0; f.lag = 6; f.airUsed = false; break;
      case 'special':
        if (f.sp?.def.kind === 'aerial') {
          const s = f.sp; s.stage = 'land'; s.total = s.frame + s.def.recovery; f.vx = 0;
        }
        break;
      default: break;
    }
  }

  private separate(): void {
    const [a, b] = this.fighters;
    if (a.hidden || b.hidden) return;
    const phase = (f: Fighter) => f.sp && (f.sp.def.kind === 'evade' || f.sp.def.kind === 'teleport');
    if (phase(a) || phase(b)) return;
    if (a.state === 'dead' || b.state === 'dead' || a.state === 'knockdown' || b.state === 'knockdown') return;
    if (Math.abs(a.y - b.y) > 90) return;
    const min = 50;
    const dx = b.x - a.x;
    const ov = min - Math.abs(dx);
    if (ov <= 0) return;
    const dir = dx >= 0 ? 1 : -1; // b is to the right when dir=1
    a.x -= dir * ov / 2; b.x += dir * ov / 2;
    const ca = clamp(a.x, ARENA.left, ARENA.right), cb = clamp(b.x, ARENA.left, ARENA.right);
    if (ca !== a.x) { b.x += (ca - a.x); a.x = ca; }
    if (cb !== b.x) { a.x += (cb - b.x); b.x = cb; }
    a.x = clamp(a.x, ARENA.left, ARENA.right); b.x = clamp(b.x, ARENA.left, ARENA.right);
  }

  /* ----------------------------------------------------------------- views */
  private updateViews(): void {
    for (const f of this.fighters) {
      f.buffs = f.activeBuffs.map((b) => b.type);
      f.phase = null; f.phaseT = 0; f.animT = f.animLen > 0 ? Math.min(1, f.animFrame / f.animLen) : 0;
      if (f.state === 'attack' && f.atk) {
        const d = f.atk.data, fr = f.atk.frame;
        if (fr < d.startup) { f.phase = 'startup'; f.phaseT = fr / d.startup; }
        else if (fr < d.startup + d.active) { f.phase = 'active'; f.phaseT = (fr - d.startup) / d.active; }
        else { f.phase = 'recovery'; f.phaseT = (fr - d.startup - d.active) / Math.max(1, d.recovery); }
        f.animT = Math.min(1, fr / totalFrames(d));
      } else if (f.state === 'special' && f.sp) {
        const s = f.sp, def = s.def;
        const act = s.def.kind === 'rush' ? def.rush!.duration : s.def.kind === 'combo' ? def.combo!.hits * def.combo!.interval : 8;
        if (s.frame < def.startup) { f.phase = 'startup'; f.phaseT = s.frame / def.startup; }
        else if (s.frame < def.startup + act) { f.phase = 'active'; f.phaseT = (s.frame - def.startup) / act; }
        else { f.phase = 'recovery'; f.phaseT = Math.min(1, (s.frame - def.startup - act) / Math.max(1, def.recovery)); }
        f.animT = Math.min(1, s.frame / Math.min(s.total, def.startup + act + def.recovery));
      }
      if (this.phase === 'intro' && this.phaseT < 70 && f.state === 'idle') { f.anim = 'intro'; f.animT = this.phaseT / 70; }
    }
  }
}

export type { Fighter, Projectile };
