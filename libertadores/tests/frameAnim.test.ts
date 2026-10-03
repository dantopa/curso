import { describe, expect, it } from 'vitest';
import { FightSim } from '../src/combat/sim';
import { getCharacter } from '../src/characters';
import { emptyButtons, makeInputFrame, type Buttons, type InputFrame } from '../src/combat/types';
import {
  frameByPhase, frameByProgress, frameByTime, selectFrame, validateAnimsFile, type FaPhase, type FrameAnimDef, type FrameView,
} from '../src/ui/frameAnim';

const def = (n: number, o: Partial<FrameAnimDef> = {}): FrameAnimDef => ({
  frames: Array.from({ length: n }, (_, i) => `anims/x/${i}.png`), durations: Array(n).fill(2), loop: false, ...o,
});
const view = (o: Partial<FrameView>): FrameView => ({ anim: 'idle', animFrame: 0, animLen: 0, animT: 0, phase: null, phaseT: 0, vy: 0, ...o });

describe('frame index maths', () => {
  it('time: loops wrap, one-shots hold the last frame, durations weight frames', () => {
    const d = def(3, { durations: [1, 3, 2], loop: true });
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((t) => frameByTime(d, t))).toEqual([0, 1, 1, 1, 2, 2, 0, 1]);
    const one = def(3, { durations: [1, 3, 2], loop: false });
    expect(frameByTime(one, 99)).toBe(2);
    expect(frameByTime(one, 4)).toBe(2);
  });
  it('progress covers the whole clip', () => {
    const d = def(4);
    expect([0, 0.2, 0.3, 0.6, 0.99, 1].map((p) => frameByProgress(d, p))).toEqual([0, 0, 1, 2, 3, 3]);
  });
  it('phase: frames are picked only among the frames tagged with the current phase', () => {
    const ph: FaPhase[] = ['startup', 'startup', 'active', 'active', 'recovery', 'recovery', 'recovery'];
    const d = def(7, { phases: ph });
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      expect(ph[frameByPhase(d, 'startup', t)]).toBe('startup');
      expect(ph[frameByPhase(d, 'active', t)]).toBe('active');
      expect(ph[frameByPhase(d, 'recovery', t)]).toBe('recovery');
    }
    expect(frameByPhase(d, 'active', 0)).toBe(2);
    expect(frameByPhase(d, 'active', 0.75)).toBe(3);
    expect(frameByPhase(d, 'recovery', 0.99)).toBe(6);
  });
  it('phase: a missing phase falls back to nominal progress, no phases array → animT', () => {
    const d = def(4, { phases: ['startup', 'active', 'active', 'active'] });
    expect(frameByPhase(d, 'recovery', 0.5)).toBeGreaterThanOrEqual(0);
    expect(frameByPhase(def(4), 'active', 0.5, 0.75)).toBe(3);
  });
});

describe('selectFrame mapping', () => {
  const anims = {
    idle: def(4, { loop: true }), walk_fwd: def(6, { loop: true }), light: def(5, { phases: ['startup', 'active', 'active', 'recovery', 'recovery'] }),
    heavy: def(3), jump: def(5), hit_high: def(3), knockdown: def(4),
  };
  it('walking maps to walk_fwd; missing walk_back → null (caller falls back)', () => {
    expect(selectFrame(anims, view({ anim: 'walkF', animFrame: 5 }))).toMatchObject({ name: 'walk_fwd', index: 2 });
    expect(selectFrame(anims, view({ anim: 'walkB' }))).toBeNull();
  });
  it('jump uses vy: rising → first frame, apex → middle, falling → last', () => {
    expect(selectFrame(anims, view({ anim: 'jumpUp', vy: -17 }), 17)!.index).toBe(0);
    expect(selectFrame(anims, view({ anim: 'jumpUp', vy: 0 }), 17)!.index).toBe(2);
    expect(selectFrame(anims, view({ anim: 'jumpDown', vy: 17 }), 17)!.index).toBe(4);
  });
  it('hit falls back hit_high → hit_body, crouch_light → light, special slash alternates', () => {
    expect(selectFrame(anims, view({ anim: 'hit' }))!.name).toBe('hit_high');
    expect(selectFrame(anims, view({ anim: 'crouchLight', phase: 'active', phaseT: 0 }))!.name).toBe('light');
    expect(selectFrame(anims, view({ anim: 'slash', moveKind: 'combo', swing: 0, swings: 3 }))!.name).toBe('light');
    expect(selectFrame(anims, view({ anim: 'slash', moveKind: 'combo', swing: 2, swings: 3 }))!.name).toBe('heavy');
    expect(selectFrame(anims, view({ anim: 'slash', moveKind: 'teleport' }))!.name).toBe('heavy');
  });
  it('one-shots hold their last frame', () => {
    expect(selectFrame(anims, view({ anim: 'knockdown', animFrame: 400 }))!.index).toBe(3);
  });
});

/* ------------------------------------------- alignment against the real sim */
const mk = (a: string, b: string) => new FightSim({ chars: [getCharacter(a), getCharacter(b)], roundsToWin: 2, timer: 99, fatalityHuman: [true, true], secondaryUnlocked: [true, true], seed: 3 });
function run(sim: FightSim, n: number, p0: Partial<Buttons>, prev: Buttons, onTick?: () => void): Buttons {
  let pv = prev;
  for (let i = 0; i < n; i++) {
    const h0 = { ...emptyButtons(), ...p0 };
    const fr: [InputFrame, InputFrame] = [makeInputFrame(pv, h0), makeInputFrame(emptyButtons(), emptyButtons())];
    pv = h0; sim.step(fr); onTick?.();
  }
  return pv;
}

describe('phase alignment with the simulation', () => {
  for (const [btn, label] of [['light', 'lightA'], ['heavy', 'heavyA']] as const) {
    it(`${label}: frames tagged active are shown exactly on the sim's active (hitbox) frames`, () => {
      const sim = mk('sanmartin', 'bolivar');
      let pv = run(sim, 110, {}, emptyButtons());
      sim.fighters[0].x = 560; sim.fighters[1].x = 900;
      // 8 frames: 2 startup, 2 active, 4 recovery (typical hand-authored clip)
      const ph: FaPhase[] = ['startup', 'startup', 'active', 'active', 'recovery', 'recovery', 'recovery', 'recovery'];
      const clip = def(8, { phases: ph });
      const anims = { light: clip, heavy: clip };
      const f = sim.fighters[0];
      let sawActive = 0, sawOther = 0;
      pv = run(sim, 1, { [btn]: true }, pv, () => {});
      for (let i = 0; i < 60 && f.state === 'attack'; i++) {
        const atk = f.atk!;
        const inActive = atk.frame >= atk.data.startup && atk.frame < atk.data.startup + atk.data.active;
        const c = selectFrame(anims, f)!;
        expect(c.name).toBe(f.anim === 'lightA' ? 'light' : 'heavy');
        if (inActive) { expect(ph[c.index]).toBe('active'); sawActive++; } else { expect(ph[c.index]).not.toBe('active'); sawOther++; }
        pv = run(sim, 1, {}, pv);
      }
      expect(sawActive).toBe(btn === 'light' ? 3 : 4);
      expect(sawOther).toBeGreaterThan(5);
    });
  }
});

describe('validateAnimsFile', () => {
  const good = { canvas: [1024, 1024], anchor: [512, 1000], standHeight: 820, anims: { idle: { frames: ['a.png', 'b.png'], durations: [4, 4], loop: true }, light: { frames: ['l0.png', 'l1.png'], durations: [2, 3], loop: false, phases: ['startup', 'active'], swordTip: [[1, 2], [3, 4]] } } };
  it('accepts a valid file', () => { expect(validateAnimsFile(good).ok).toBe(true); });
  it('rejects bad shapes with readable errors', () => {
    expect(validateAnimsFile(null).ok).toBe(false);
    expect(validateAnimsFile({ ...good, standHeight: 0 }).ok).toBe(false);
    const r = validateAnimsFile({ ...good, anims: { idle: { frames: ['a'], durations: [1, 2], loop: true } } });
    expect(r.ok).toBe(false);
    expect(validateAnimsFile({ ...good, anims: { light: { ...good.anims.light, phases: ['x', 'active'] } } }).ok).toBe(false);
    expect(validateAnimsFile({ ...good, anims: { light: { ...good.anims.light, swordTip: [[1, 2]] } } }).ok).toBe(false);
  });
  it('warns about unknown animation names', () => {
    const r = validateAnimsFile({ ...good, anims: { ...good.anims, bogus: good.anims.idle } });
    expect(r.ok && r.warnings.some((w) => w.includes('bogus'))).toBe(true);
  });
});

describe('facing', () => {
  it('a fighter that jumps over the opponent re-faces on landing; attackers re-face during recovery', () => {
    const sim = mk('sanmartin', 'bolivar');
    let pv = run(sim, 110, {}, emptyButtons());
    const a = sim.fighters[0], b = sim.fighters[1];
    a.x = 600; b.x = 680; b.facing = -1;
    pv = run(sim, 1, { up: true, right: true }, pv);
    let crossed = false;
    for (let i = 0; i < 80 && !a.grounded || i < 2; i++) { pv = run(sim, 1, { right: true }, pv); if (a.x > b.x) crossed = true; }
    expect(crossed).toBe(true);
    pv = run(sim, 2, {}, pv);
    expect(a.grounded).toBe(true);
    expect(a.facing).toBe(a.x < b.x ? 1 : -1);
    expect(a.facing).toBe(-1);
  });
});
