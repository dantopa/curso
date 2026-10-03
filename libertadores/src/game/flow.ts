import type { Difficulty } from '../combat/types';

export type Mode = 'quick' | 'versus' | 'tournament';

export interface FightConfig {
  mode: Mode;
  p1: string;
  p2: string;
  p1Human: boolean;
  p2Human: boolean;
  stageId: string;
  difficulty: Difficulty;
  roundsToWin: 1 | 2 | 3;
  timer: 0 | 60 | 99;
  tournamentMatchId?: string;
  /** label shown in the intro (e.g. tournament stage name) */
  label?: string;
}

export interface MatchResult {
  cfg: FightConfig;
  winner: 0 | 1;
  wins: [number, number];
  fatality: boolean;
  secondary: boolean;
  fatalityName?: string;
}
