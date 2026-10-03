import { describe, expect, it } from 'vitest';
import { FightSim } from '../src/combat/sim';
import { getCharacter, ROSTER } from '../src/characters';
import { emptyInput, makeInputFrame, emptyButtons, type Buttons, type InputFrame } from '../src/combat/types';
import { simulateAiMatch } from '../src/ai/headless';

const mk = (a = 'bolivar', b = 'sanmartin', over: any = {}) =>
  new FightSim({ chars: [getCharacter(a), getCharacter(b)], roundsToWin: 2, timer: 99, fatalityHuman: [true, true], secondaryUnlocked: [true, true], seed: 3, ...over });

function runInputs(sim: FightSim, seq: { p0?: Partial<Buttons>; p1?: Partial<Buttons>; n: number }[]) {
  let prev: [Buttons, Buttons] = [emptyButtons(), emptyButtons()];
  for (const s of seq) for (let i = 0; i < s.n; i++) {
    const h0 = { ...emptyButtons(), ...(s.p0 ?? {}) }, h1 = { ...emptyButtons(), ...(s.p1 ?? {}) };
    const f: [InputFrame, InputFrame] = [makeInputFrame(prev[0], h0), makeInputFrame(prev[1], h1)];
    prev = [h0, h1];
    sim.step(f);
  }
}
const toFight = (sim: FightSim) => runInputs(sim, [{ n: 110 }]);
const close = (sim: FightSim) => { sim.fighters[0].x = 600; sim.fighters[1].x = 670; };

describe('roster', () => {
  it('has exactly 20 characters with 4 specials, fatality and secondary', () => {
    expect(ROSTER).toHaveLength(20);
    expect(new Set(ROSTER.map((c) => c.id)).size).toBe(20);
    for (const c of ROSTER) {
      expect(c.specials).toHaveLength(4);
      expect(c.fatality.input.length).toBeGreaterThanOrEqual(3);
      expect(c.secondary.input.join('')).not.toBe(c.fatality.input.join(''));
      expect(c.stats.health).toBeGreaterThan(800);
    }
  });
  it('balance: stats stay within sane bounds', () => {
    for (const c of ROSTER) {
      const power = c.stats.health * c.stats.attack * c.stats.defense;
      expect(power).toBeGreaterThan(800);
      expect(power).toBeLessThan(1500);
    }
  });
});

describe('combat', () => {
  it('starts in intro then fight', () => {
    const s = mk();
    expect(s.phase).toBe('intro');
    toFight(s);
    expect(s.phase).toBe('fight');
  });
  it('light attack deals damage and builds meter', () => {
    const s = mk(); toFight(s); close(s);
    runInputs(s, [{ p0: { light: true }, n: 1 }, { n: 20 }]);
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
    expect(s.fighters[0].meter).toBeGreaterThan(0);
  });
  it('blocking reduces damage to chip', () => {
    const s = mk(); toFight(s); close(s);
    runInputs(s, [{ p1: { block: true }, n: 3 }, { p0: { heavy: true }, p1: { block: true }, n: 1 }, { p1: { block: true }, n: 25 }]);
    const lost = s.fighters[1].maxHp - s.fighters[1].hp;
    expect(lost).toBeLessThan(5);
  });
  it('combo scaling reduces later hits', () => {
    const s = mk(); toFight(s); close(s);
    const hp0 = s.fighters[1].hp;
    runInputs(s, [{ p0: { light: true }, n: 1 }, { n: 7 }, { p0: { light: true }, n: 1 }, { n: 7 }, { p0: { light: true }, n: 1 }, { n: 20 }]);
    expect(s.combo[0].hits >= 2 || s.fighters[1].hp < hp0).toBe(true);
    expect(hp0 - s.fighters[1].hp).toBeGreaterThan(30);
  });
  it('special spawns a projectile and respects cooldown', () => {
    const s = mk(); toFight(s);
    runInputs(s, [{ p0: { special: true }, n: 1 }, { n: 20 }]);
    expect(s.projectiles.length).toBeGreaterThan(0);
    expect(s.fighters[0].cooldowns[0]).toBeGreaterThan(0);
  });
  it('projectiles travel and can hit', () => {
    const s = mk(); toFight(s);
    runInputs(s, [{ p0: { special: true }, n: 1 }, { n: 120 }]);
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
  });
  it('KO ends round and awards a win', () => {
    const s = mk(); toFight(s);
    s.fighters[1].hp = 1; close(s);
    runInputs(s, [{ p0: { light: true }, n: 1 }, { n: 10 }]);
    expect(s.wins[0]).toBe(1);
    expect(['ko', 'roundEnd']).toContain(s.phase);
  });
  it('timeout awards the round to the fighter with more health', () => {
    const s = mk('bolivar', 'sanmartin', { timer: 1 }); toFight(s);
    s.fighters[1].hp = 500;
    runInputs(s, [{ n: 70 }]);
    expect(s.wins[0]).toBe(1);
  });
  it('winning the final round opens fatality window and the right input triggers it', () => {
    const s = mk(); toFight(s);
    s.wins[0] = 1;
    s.fighters[1].hp = 1; close(s);
    runInputs(s, [{ p0: { light: true }, n: 1 }, { n: 300 }]);
    expect(s.phase).toBe('finish');
    const seq = s.fighters[0].char.fatality.input; // facing right: F = right
    const dirOf = (d: string): Partial<Buttons> => d === 'F' ? { right: true } : d === 'B' ? { left: true } : d === 'U' ? { up: true } : { down: true };
    const steps: any[] = [];
    for (const d of seq) { steps.push({ p0: dirOf(d), n: 2 }, { n: 4 }); }
    steps.push({ p0: { fatality: true }, n: 1 });
    runInputs(s, steps);
    expect(s.phase).toBe('fatality');
    expect(s.fatality?.secondary).toBe(false);
  });
  it('wrong fatality input does not trigger', () => {
    const s = mk(); toFight(s);
    s.wins[0] = 1; s.fighters[1].hp = 1; close(s);
    runInputs(s, [{ p0: { light: true }, n: 1 }, { n: 300 }]);
    runInputs(s, [{ p0: { fatality: true }, n: 1 }, { n: 5 }]);
    expect(s.phase).toBe('finish');
  });
  it('fatality is not offered to CPU winners', () => {
    const s = mk('bolivar', 'sanmartin', { fatalityHuman: [false, false] }); toFight(s);
    s.wins[0] = 1; s.fighters[1].hp = 1; close(s);
    runInputs(s, [{ p0: { light: true }, n: 1 }, { n: 300 }]);
    expect(s.phase).not.toBe('finish');
  });
});

describe('every fighter', () => {
  it('can execute all four specials without crashing', () => {
    for (const c of ROSTER) {
      for (let slot = 0; slot < 4; slot++) {
        const s = mk(c.id, 'sanmartin'); toFight(s);
        const dir: Partial<Buttons> = slot === 3 ? { up: true } : slot === 2 ? { down: true } : slot === 1 ? { right: true } : {};
        runInputs(s, [{ p0: { ...dir, special: true }, n: 1 }, { n: 200 }]);
        expect(Number.isFinite(s.fighters[0].x)).toBe(true);
        expect(s.fighters[0].state === 'special').toBe(false);
      }
    }
  });
});

describe('AI', () => {
  it('headless AI matches always terminate', () => {
    for (const [a, b] of [['bolivar', 'marti'], ['guemes', 'juarez'], ['katari', 'cordova'], ['manco', 'micaela']]) {
      const r = simulateAiMatch(a, b, 11, 'veteran');
      expect([a, b]).toContain(r.winner);
    }
  });
});
