import { ARENA, emptyButtons, makeInputFrame, type Buttons, type Difficulty, type InputFrame } from '../combat/types';
import type { FightSim } from '../combat/sim';
import type { Fighter } from '../combat/fighter';
import { Rng } from '../utils/rng';

interface DiffParams {
  react: number; blockP: number; think: number; combo: number; special: number; aggr: number; ex: boolean; ult: boolean; antiProj: number;
}
export const DIFFICULTY: Record<Difficulty, DiffParams> = {
  novice: { react: 30, blockP: 0.2, think: 14, combo: 1, special: 0.22, aggr: 0.7, ex: false, ult: false, antiProj: 0.1 },
  fighter: { react: 18, blockP: 0.45, think: 10, combo: 2, special: 0.4, aggr: 0.9, ex: false, ult: true, antiProj: 0.35 },
  veteran: { react: 10, blockP: 0.7, think: 7, combo: 3, special: 0.55, aggr: 1.0, ex: true, ult: true, antiProj: 0.6 },
  legend: { react: 5, blockP: 0.88, think: 5, combo: 4, special: 0.7, aggr: 1.1, ex: true, ult: true, antiProj: 0.85 },
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  novice: 'Novato', fighter: 'Peleador', veteran: 'Veterano', legend: 'Leyenda',
};

type Step = { held: Partial<Buttons>; frames: number };

/** Produces an InputFrame per tick for a CPU-controlled fighter. Behaviour comes from the character's AIStyle. */
export class AIController {
  private prev: Buttons = emptyButtons();
  private queue: Step[] = [];
  private rng: Rng;
  private p: DiffParams;
  private nextThink = 0;
  private oppActionStart = -1;
  private lastOppBusy = false;
  private strafe = 0;

  constructor(private idx: 0 | 1, difficulty: Difficulty, seed = 7) {
    this.p = DIFFICULTY[difficulty];
    this.rng = new Rng(seed * 31 + idx * 977 + 5);
  }

  think(sim: FightSim): InputFrame {
    const held = this.decide(sim);
    const frame = makeInputFrame(this.prev, held);
    this.prev = held;
    return frame;
  }

  private tap(btns: Partial<Buttons>, then = 0): void {
    this.queue.push({ held: btns, frames: 1 });
    if (then > 0) this.queue.push({ held: {}, frames: then });
  }
  private hold(btns: Partial<Buttons>, frames: number): void { this.queue.push({ held: btns, frames }); }

  private decide(sim: FightSim): Buttons {
    const out = emptyButtons();
    if (sim.phase !== 'fight') { this.queue = []; return out; }
    const me = sim.fighters[this.idx];
    const opp = sim.fighters[1 - this.idx];
    // execute queued steps
    if (this.queue.length) {
      const st = this.queue[0];
      Object.assign(out, st.held);
      if (--st.frames <= 0) this.queue.shift();
      if (!this.canAct(me)) { /* inputs are harmless while stunned */ }
      return out;
    }
    if (!this.canAct(me)) return out;

    const dx = opp.x - me.x;
    const dist = Math.abs(dx);
    const toward = dx >= 0 ? 'right' : 'left';
    const away = dx >= 0 ? 'left' : 'right';
    const style = me.char.ai;
    const aggr = style.aggression * this.p.aggr;

    // track opponent action start for reaction delay
    const oppBusy = opp.state === 'attack' || opp.state === 'special';
    if (oppBusy && !this.lastOppBusy) this.oppActionStart = sim.frame;
    this.lastOppBusy = oppBusy;

    // 1) defensive reactions
    const incoming = sim.projectiles.find((q) => q.owner !== this.idx && q.delay === 0 && !q.isStatic &&
      Math.sign(me.x - q.x) === q.dir && Math.abs(me.x - q.x) < 230);
    if (incoming && this.rng.chance(this.p.antiProj * 0.25)) {
      if (this.rng.chance(0.5 + style.defense * 0.3)) { this.hold({ block: true, down: this.rng.chance(0.3) }, 22); }
      else if (me.char.specials.some((s, i) => s.kind === 'evade' && me.cooldowns[i] === 0) && this.rng.chance(0.4)) this.useSpecial(me, 'evade');
      else { this.hold({ up: true, [toward]: this.rng.chance(0.5) } as Partial<Buttons>, 3); }
      return out;
    }
    if (oppBusy && sim.frame - this.oppActionStart >= this.p.react) {
      const reach = opp.atk ? opp.atk.data.reach : opp.sp?.def.rush ? 190 : 120;
      if (dist < reach + 50) {
        const bp = Math.min(0.97, this.p.blockP * (0.6 + style.defense * 0.8));
        if (this.rng.chance(bp)) {
          const low = opp.atk?.data.level === 'low';
          const ov = opp.atk?.data.level === 'overhead';
          this.hold({ block: true, down: low || (!ov && this.rng.chance(0.25)) }, 16 + this.rng.int(0, 10));
          this.oppActionStart = Infinity;
          return out;
        }
        if (style.defense > 0.7 && this.rng.chance(0.4) && this.useSpecial(me, 'counter')) return out;
      }
    }
    if (sim.frame < this.nextThink) {
      // keep light movement between decisions
      if (this.strafe) out[this.strafe > 0 ? toward : away] = true;
      return out;
    }
    this.nextThink = sim.frame + this.p.think + this.rng.int(0, 4);
    this.strafe = 0;

    // 2) punish recovery
    const oppVuln = opp.phase === 'recovery' || opp.state === 'dazed';
    const reachNow = me.char.normals.heavyReach;
    if (oppVuln && dist < reachNow + 10 && this.rng.chance(0.4 + this.p.combo * 0.12)) { this.attackSequence(me, opp, dist); return out; }

    // 3) ultimate / EX
    if (me.meter >= 100 && this.p.ult && dist < 420 && this.rng.chance(0.5)) { this.tap({ fatality: true }, 6); return out; }

    // 4) specials by profile & distance
    if (this.rng.chance(this.p.special * (0.35 + style.zoning * 0.6 + style.ambush * 0.3) * (dist > 130 ? 1 : 0.5))) {
      const kind = this.pickSpecialKind(me, dist, style.zoning);
      if (kind && this.useSpecial(me, kind)) return out;
    }

    // 5) spacing
    const pref = style.preferredRange;
    if (dist > pref + 50) {
      // approach
      if (this.rng.chance(aggr * 0.35) && dist > 280) { this.tap({ [toward]: true }); this.tap({}, 1); this.hold({ [toward]: true }, 4); this.tap({ [toward]: true }, 0); this.hold({ [toward]: true }, 12); return out; }
      if (this.rng.chance(0.08 * aggr + style.ambush * 0.05) && dist < 420) { this.hold({ up: true, [toward]: true } as Partial<Buttons>, 3); return out; }
      this.strafe = 1;
      this.hold({ [toward]: true }, 8 + this.rng.int(0, 10));
      return out;
    }
    if (dist < pref - 60 && this.rng.chance(0.3 + style.zoning * 0.5)) {
      this.hold({ [away]: true }, 10 + this.rng.int(0, 10));
      return out;
    }
    if (dist <= reachNow + 20) {
      if (this.rng.chance(0.25 + aggr * 0.55)) {
        // throw against blockers
        if ((opp.state === 'block' || style.grappling > 0.5) && dist < 80 && this.rng.chance(0.25 + style.grappling * 0.5)) { this.tap({ throw: true }, 8); return out; }
        this.attackSequence(me, opp, dist);
        return out;
      }
      if (this.rng.chance(0.3 * style.defense)) { this.hold({ block: true }, 12); return out; }
      this.hold({ [away]: true }, 8);
      return out;
    }
    // mid range pokes / waiting
    if (this.rng.chance(0.15 + aggr * 0.3)) { this.hold({ [toward]: true }, 6); }
    return out;
  }

  private canAct(f: Fighter): boolean {
    return f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'block' || f.state === 'dash' || f.state === 'jump' || f.state === 'attack';
  }

  private attackSequence(me: Fighter, opp: Fighter, dist: number): void {
    const n = this.rng.int(1, this.p.combo);
    const g = 7;
    const crouch = this.rng.chance(0.25);
    if (crouch && n >= 2) {
      this.tap({ down: true, light: true }, g);
      this.tap({ down: true, light: true }, g);
      this.tap({ down: true, heavy: true }, g + 6);
      if (this.p.combo >= 3 && me.meter >= 0 && this.rng.chance(0.5)) this.useSpecial(me, 'combo');
      return;
    }
    for (let i = 0; i < n; i++) this.tap({ light: true }, g);
    if (n >= 2 && this.rng.chance(0.7)) {
      this.tap({ heavy: true }, 9);
      if (this.p.combo >= 3 && this.rng.chance(0.55)) {
        const k = this.pickSpecialKind(me, dist, 0.3);
        if (k) this.useSpecial(me, k);
      }
    } else if (n === 1 && this.rng.chance(0.5)) this.tap({ heavy: true }, 10);
  }

  private pickSpecialKind(me: Fighter, dist: number, zoning: number): import('../combat/types').SpecialKind | null {
    const opts: { kind: import('../combat/types').SpecialKind; w: number }[] = [];
    me.char.specials.forEach((s, i) => {
      if (me.cooldowns[i] > 0) return;
      let w = 0;
      switch (s.kind) {
        case 'proj': w = s.proj!.speed === 0 ? (dist < 260 ? 1.2 : 0.2) : dist > 160 ? 2 + zoning * 3 : 0.3; break;
        case 'rush': w = dist > 140 && dist < 420 ? 2.2 : 0.2; break;
        case 'combo': w = dist < 120 ? 2.4 : 0; break;
        case 'buff': w = !me.activeBuffs.some((b) => b.type === s.buff!.type) && dist > 240 ? 1.5 : 0; break;
        case 'counter': w = dist < 170 ? 0.9 * me.char.ai.defense : 0; break;
        case 'teleport': w = dist > 110 && dist < 450 ? 1.6 : 0; break;
        case 'aerial': w = dist > 130 && dist < 320 ? 1.5 : 0; break;
        case 'evade': w = 0.3; break;
      }
      if (w > 0) opts.push({ kind: s.kind, w });
    });
    if (!opts.length) return null;
    const total = opts.reduce((a, o) => a + o.w, 0);
    let r = this.rng.next() * total;
    for (const o of opts) { r -= o.w; if (r <= 0) return o.kind; }
    return opts[0].kind;
  }

  private useSpecial(me: Fighter, kind: import('../combat/types').SpecialKind): boolean {
    const slot = me.char.specials.findIndex((s, i) => s.kind === kind && me.cooldowns[i] === 0);
    if (slot < 0) return false;
    const dir: Partial<Buttons> = slot === 3 ? { up: true } : slot === 2 ? { down: true } : slot === 1 ? { [me.facing === 1 ? 'right' : 'left']: true } : {};
    const ex = this.p.ex && me.meter >= 50 && this.rng.chance(0.35);
    this.tap({ ...dir, special: true, block: ex }, 10);
    return true;
  }
}
// ARENA import kept for future wall-awareness
void ARENA;
