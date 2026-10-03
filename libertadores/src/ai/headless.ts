import { FightSim } from '../combat/sim';
import { AIController } from './ai';
import { getCharacter } from '../characters';
import type { Difficulty, InputFrame } from '../combat/types';
import { emptyInput } from '../combat/types';
import type { Rng } from '../utils/rng';
import type { MatchSimulator } from '../data/tournament';

/** Plays a full AI-vs-AI match without rendering. Always terminates (frame cap → higher HP wins). */
export function simulateAiMatch(
  aId: string, bId: string, seed: number, difficulty: Difficulty = 'veteran', roundsToWin = 2,
): { winner: string; score: [number, number] } {
  const a = getCharacter(aId), b = getCharacter(bId);
  const sim = new FightSim({
    chars: [a, b], roundsToWin, timer: 45, fatalityHuman: [false, false], secondaryUnlocked: [false, false], seed, fast: true,
  });
  const ai: [AIController, AIController] = [new AIController(0, difficulty, seed), new AIController(1, difficulty, seed + 1)];
  let frames = 0;
  const idle: [InputFrame, InputFrame] = [emptyInput(), emptyInput()];
  while (sim.phase !== 'done' && frames < 60 * 45 * 8) {
    sim.step(sim.phase === 'fight' ? [ai[0].think(sim), ai[1].think(sim)] : idle);
    frames++;
  }
  let w: 0 | 1 = sim.matchWinner ?? (sim.wins[0] >= sim.wins[1] ? 0 : 1);
  if (sim.matchWinner === null && sim.wins[0] === sim.wins[1]) {
    w = a.stats.health * a.stats.attack >= b.stats.health * b.stats.attack ? 0 : 1;
  }
  return { winner: w === 0 ? aId : bId, score: [sim.wins[0], sim.wins[1]] };
}

export const makeCpuSimulator = (difficulty: Difficulty = 'veteran'): MatchSimulator =>
  (a: string, b: string, rng: Rng) => simulateAiMatch(a, b, Math.floor(rng.next() * 1e9) + 1, difficulty);
