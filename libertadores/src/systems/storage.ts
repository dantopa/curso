import type { Buttons, Difficulty } from '../combat/types';
import type { Tournament } from '../data/tournament';

export type ActionKey = keyof Buttons;
export const ACTIONS: ActionKey[] = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'block', 'throw', 'fatality'];
export const ACTION_LABEL: Record<ActionKey, string> = {
  left: 'Izquierda', right: 'Derecha', up: 'Saltar', down: 'Agacharse', light: 'Ataque ligero', heavy: 'Ataque pesado',
  special: 'Especial', block: 'Bloquear', throw: 'Agarre', fatality: 'Remate / Definitivo',
};
export type KeyMap = Record<ActionKey, string>;

export const DEFAULT_P1: KeyMap = {
  left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', light: 'KeyJ', heavy: 'KeyK',
  special: 'KeyL', block: 'KeyU', throw: 'KeyI', fatality: 'KeyO',
};
export const DEFAULT_P2: KeyMap = {
  left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', light: 'Numpad1', heavy: 'Numpad2',
  special: 'Numpad3', block: 'Numpad4', throw: 'Numpad5', fatality: 'Numpad6',
};
/** Keyboards without a numpad can use the digit row for P2's default bindings. */
export const P2_ALIASES: Record<string, string> = {
  Digit1: 'Numpad1', Digit2: 'Numpad2', Digit3: 'Numpad3', Digit4: 'Numpad4', Digit5: 'Numpad5', Digit6: 'Numpad6',
};

export interface Settings {
  master: number; sfx: number; music: number; voice: number;
  difficulty: Difficulty;
  roundsToWin: 1 | 2 | 3;
  timer: 0 | 60 | 99;
  touch: 'auto' | 'on' | 'off';
  shake: boolean;
  unlockAll: boolean;
  stageId: string;
  p1: KeyMap; p2: KeyMap;
}
export interface CharStat { wins: number; losses: number; fatalities: number; secondaries: number; tournamentWins: number }
export interface Progress { stats: Record<string, CharStat>; tournament: Tournament | null }

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, sfx: 0.9, music: 0.55, voice: 0.8, difficulty: 'fighter', roundsToWin: 2, timer: 99,
  touch: 'auto', shake: true, unlockAll: false, stageId: 'llanos', p1: { ...DEFAULT_P1 }, p2: { ...DEFAULT_P2 },
};
const KEY_S = 'libertadores.settings.v1';
const KEY_P = 'libertadores.progress.v1';

function read<T>(key: string): T | null {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore quota/private mode */ }
}

let settings: Settings | null = null;
let progress: Progress | null = null;

export function getSettings(): Settings {
  if (!settings) {
    const s = read<Partial<Settings>>(KEY_S) ?? {};
    settings = { ...DEFAULT_SETTINGS, ...s, p1: { ...DEFAULT_P1, ...(s.p1 ?? {}) }, p2: { ...DEFAULT_P2, ...(s.p2 ?? {}) } };
  }
  return settings;
}
export function saveSettings(): void { if (settings) write(KEY_S, settings); }

export function getProgress(): Progress {
  if (!progress) progress = read<Progress>(KEY_P) ?? { stats: {}, tournament: null };
  if (!progress.stats) progress.stats = {};
  return progress;
}
export function saveProgress(): void { if (progress) write(KEY_P, progress); }
export function resetProgress(): void { progress = { stats: {}, tournament: null }; saveProgress(); }

export function charStat(id: string): CharStat {
  const p = getProgress();
  return (p.stats[id] ??= { wins: 0, losses: 0, fatalities: 0, secondaries: 0, tournamentWins: 0 });
}
export const SECONDARY_WINS_REQUIRED = 5;
export function secondaryUnlocked(id: string): boolean {
  return getSettings().unlockAll || charStat(id).wins >= SECONDARY_WINS_REQUIRED || charStat(id).tournamentWins > 0;
}
export function recordMatch(winnerId: string, loserId: string, fatality: boolean, secondary: boolean): void {
  const w = charStat(winnerId), l = charStat(loserId);
  w.wins++; l.losses++;
  if (fatality) w.fatalities++;
  if (secondary) w.secondaries++;
  saveProgress();
}
