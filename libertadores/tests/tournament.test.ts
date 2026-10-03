import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../src/characters';
import {
  createTournament, currentStage, finishTournament, nextPlayerMatch, playerStatus, reportPlayerResult,
  resolveCpuMatches, stageMatches, type MatchSimulator,
} from '../src/data/tournament';
import { makeCpuSimulator } from '../src/ai/headless';

// deterministic fake: first listed fighter wins
const fake: MatchSimulator = (a, b) => ({ winner: a, score: [2, 0] });

describe('tournament bracket', () => {
  it('has 20 entrants: 4 prelims, 12 byes, 16 in the round of 16', () => {
    const t = createTournament(CHARACTER_IDS[0], CHARACTER_IDS, 42, 'fighter');
    expect(t.entrants).toHaveLength(20);
    expect(stageMatches(t, 'prelim')).toHaveLength(4);
    expect(t.byes).toHaveLength(12);
    expect(stageMatches(t, 'r16')).toHaveLength(8);
    expect(stageMatches(t, 'qf')).toHaveLength(4);
    expect(stageMatches(t, 'sf')).toHaveLength(2);
    expect(stageMatches(t, 'final')).toHaveLength(1);
    const prelimFighters = stageMatches(t, 'prelim').flatMap((m) => [m.a, m.b]);
    expect(new Set(prelimFighters).size).toBe(8);
    const r16Known = stageMatches(t, 'r16').flatMap((m) => [m.a, m.b]).filter(Boolean);
    expect(r16Known).toHaveLength(12);
    expect(new Set([...prelimFighters, ...t.byes]).size).toBe(20);
  });
  it('is playable from beginning to end for the human', () => {
    const player = CHARACTER_IDS[3];
    const t = createTournament(player, CHARACTER_IDS, 7, 'fighter');
    let played = 0, guard = 40;
    while (!t.finished && guard-- > 0) {
      const st = playerStatus(t);
      if (st === 'match') {
        const m = nextPlayerMatch(t)!;
        reportPlayerResult(t, m.id, player, [2, 0], false);
        played++;
        if (!t.eliminated) resolveCpuMatches(t, fake);
      } else if (st === 'bye') resolveCpuMatches(t, fake);
      else finishTournament(t, fake);
    }
    expect(t.finished).toBe(true);
    expect(t.champion).toBe(player);
    expect(t.runnerUp).not.toBeNull();
    expect(played).toBeGreaterThanOrEqual(4);
    expect(played).toBeLessThanOrEqual(5);
    expect(t.matches.every((m) => m.winner !== null)).toBe(true);
  });
  it('elimination ends human run, tournament can still be finished', () => {
    const player = CHARACTER_IDS[0];
    const t = createTournament(player, CHARACTER_IDS, 99, 'fighter');
    let guard = 10;
    while (playerStatus(t) === 'bye' && guard-- > 0) resolveCpuMatches(t, fake);
    const m = nextPlayerMatch(t)!;
    const opp = m.a === player ? m.b! : m.a!;
    reportPlayerResult(t, m.id, opp, [0, 2], false);
    expect(t.eliminated).toBe(true);
    finishTournament(t, fake);
    expect(t.finished).toBe(true);
    expect(t.champion).not.toBeNull();
    expect(currentStage(t)).toBe('final');
  });
  it('real AI simulator completes a whole CPU tournament', () => {
    const t = createTournament(CHARACTER_IDS[5], CHARACTER_IDS, 1234, 'fighter');
    t.eliminated = true;
    const t0 = Date.now();
    finishTournament(t, makeCpuSimulator('fighter'));
    expect(t.finished).toBe(true);
    expect(CHARACTER_IDS).toContain(t.champion);
    expect(Date.now() - t0).toBeLessThan(60000);
  }, 70000);
});
