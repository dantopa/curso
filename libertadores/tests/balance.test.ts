import { expect, it } from 'vitest';
import { ROSTER } from '../src/characters';
import { simulateAiMatch } from '../src/ai/headless';

/** Round-robin of CPU matches: no fighter may dominate or be hopeless. Deterministic (fixed seeds). */
it('round-robin win rates stay within 25%..75%', () => {
  const wins: Record<string, number> = {}, games: Record<string, number> = {};
  ROSTER.forEach((c) => { wins[c.id] = 0; games[c.id] = 0; });
  let seed = 1;
  for (let i = 0; i < ROSTER.length; i++) for (let j = i + 1; j < ROSTER.length; j++) for (let k = 0; k < 4; k++) {
    const a = k % 2 ? ROSTER[j] : ROSTER[i], b = k % 2 ? ROSTER[i] : ROSTER[j];
    const r = simulateAiMatch(a.id, b.id, seed++, 'veteran');
    wins[r.winner]++; games[a.id]++; games[b.id]++;
  }
  for (const c of ROSTER) {
    const rate = wins[c.id] / games[c.id];
    expect(rate, c.id).toBeGreaterThan(0.25);
    expect(rate, c.id).toBeLessThan(0.75);
  }
}, 120000);
