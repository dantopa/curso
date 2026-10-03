import { Rng } from '../utils/rng';
import type { Difficulty } from '../combat/types';

export type StageName = 'prelim' | 'r16' | 'qf' | 'sf' | 'final';
export const STAGE_ORDER: StageName[] = ['prelim', 'r16', 'qf', 'sf', 'final'];
export const STAGE_LABEL: Record<StageName, string> = {
  prelim: 'Preliminares', r16: 'Octavos de final', qf: 'Cuartos de final', sf: 'Semifinales', final: 'Gran Final',
};

export interface BracketMatch {
  id: string;
  stage: StageName;
  index: number;
  a: string | null;
  b: string | null;
  winner: string | null;
  score: [number, number] | null;   // rounds won by a, b
  byPlayer: boolean;                // true when the human played it
  fatality: boolean;
}

export interface Tournament {
  version: 1;
  seed: number;
  player: string;
  difficulty: Difficulty;
  entrants: string[];
  byes: string[];
  matches: BracketMatch[];
  stageIndex: number;               // index in STAGE_ORDER of the current stage
  eliminated: boolean;              // human has been knocked out
  champion: string | null;
  runnerUp: string | null;
  finished: boolean;
}

export type MatchSimulator = (a: string, b: string, rng: Rng) => { winner: string; score: [number, number] };

/**
 * 20 entrants → 4 preliminary matches (8 fighters) → 4 winners + 12 byes = 16 in the
 * round of 16 → 8 → 4 → 2 → 1.
 */
export function createTournament(player: string, ids: string[], seed: number, difficulty: Difficulty): Tournament {
  if (ids.length !== 20) throw new Error('Tournament needs exactly 20 entrants');
  const rng = new Rng(seed);
  const order = rng.shuffle(ids);
  const prelimFighters = order.slice(0, 8);
  const byes = order.slice(8);
  const matches: BracketMatch[] = [];
  const mk = (stage: StageName, index: number, a: string | null, b: string | null): BracketMatch => ({
    id: `${stage}-${index}`, stage, index, a, b, winner: null, score: null, byPlayer: false, fatality: false,
  });
  for (let i = 0; i < 4; i++) matches.push(mk('prelim', i, prelimFighters[i * 2], prelimFighters[i * 2 + 1]));
  // Round of 16: 16 slots. Prelim winner k goes to slot 4k+1; the 12 byes fill the rest.
  const slots: (string | null)[] = new Array(16).fill(null);
  let bi = 0;
  for (let s = 0; s < 16; s++) if (s % 4 !== 1) slots[s] = byes[bi++];
  for (let i = 0; i < 8; i++) matches.push(mk('r16', i, slots[i * 2], slots[i * 2 + 1]));
  for (let i = 0; i < 4; i++) matches.push(mk('qf', i, null, null));
  for (let i = 0; i < 2; i++) matches.push(mk('sf', i, null, null));
  matches.push(mk('final', 0, null, null));
  return {
    version: 1, seed, player, difficulty, entrants: ids.slice(), byes, matches,
    stageIndex: 0, eliminated: false, champion: null, runnerUp: null, finished: false,
  };
}

export const stageMatches = (t: Tournament, stage: StageName) => t.matches.filter((m) => m.stage === stage);
export const currentStage = (t: Tournament): StageName => STAGE_ORDER[Math.min(t.stageIndex, STAGE_ORDER.length - 1)];
export const matchLoser = (m: BracketMatch): string | null => (m.winner === null ? null : m.winner === m.a ? m.b : m.a);

/** Next unplayed match of the human, in the current stage (null if none: bye or eliminated). */
export function nextPlayerMatch(t: Tournament): BracketMatch | null {
  if (t.eliminated || t.finished) return null;
  return stageMatches(t, currentStage(t)).find((m) => m.winner === null && (m.a === t.player || m.b === t.player)) ?? null;
}

/** Plays out every CPU-vs-CPU match in the current stage and, once the stage is complete, advances. */
export function resolveCpuMatches(t: Tournament, sim: MatchSimulator): void {
  const rng = new Rng(t.seed * 7 + t.stageIndex * 131);
  for (const m of stageMatches(t, currentStage(t))) {
    if (m.winner !== null || !m.a || !m.b) continue;
    if (m.a === t.player || m.b === t.player) { if (!t.eliminated) continue; }
    const r = sim(m.a, m.b, rng);
    m.winner = r.winner; m.score = r.score;
  }
  tryAdvance(t);
}

/** Record the human's result and move the bracket forward. */
export function reportPlayerResult(t: Tournament, matchId: string, winner: string, score: [number, number], fatality: boolean): void {
  const m = t.matches.find((x) => x.id === matchId);
  if (!m) throw new Error('match not found');
  m.winner = winner; m.score = score; m.byPlayer = true; m.fatality = fatality;
  if (winner !== t.player) t.eliminated = true;
  tryAdvance(t);
}

/** Auto-play the rest of the tournament (used after the human is eliminated). */
export function finishTournament(t: Tournament, sim: MatchSimulator): void {
  let guard = 10;
  while (!t.finished && guard-- > 0) resolveCpuMatches(t, sim);
}

function tryAdvance(t: Tournament): void {
  let guard = 6;
  while (guard-- > 0) {
    const stage = currentStage(t);
    const ms = stageMatches(t, stage);
    if (ms.some((m) => m.winner === null)) return;
    if (stage === 'final') {
      const f = ms[0];
      t.champion = f.winner; t.runnerUp = matchLoser(f); t.finished = true;
      return;
    }
    // feed winners to next stage
    if (stage === 'prelim') {
      const r16 = stageMatches(t, 'r16');
      ms.forEach((m, k) => {
        const slot = 4 * k + 1;
        const match = r16[Math.floor(slot / 2)];
        if (slot % 2 === 0) match.a = m.winner; else match.b = m.winner;
      });
    } else {
      const next = STAGE_ORDER[t.stageIndex + 1];
      const nm = stageMatches(t, next);
      ms.forEach((m, k) => {
        const target = nm[Math.floor(k / 2)];
        if (k % 2 === 0) target.a = m.winner; else target.b = m.winner;
      });
    }
    t.stageIndex++;
    // a human with a bye in this stage: nothing to play, resolve CPU matches immediately is the caller's job
    return;
  }
}

/** Round the human is about to play (or null). */
export function playerStatus(t: Tournament): 'bye' | 'match' | 'eliminated' | 'champion' | 'finished' {
  if (t.finished) return t.champion === t.player ? 'champion' : 'finished';
  if (t.eliminated) return 'eliminated';
  return nextPlayerMatch(t) ? 'match' : 'bye';
}

export function playerMatches(t: Tournament): BracketMatch[] {
  return t.matches.filter((m) => m.byPlayer);
}
