import { noise, tone } from './synth';
import type { Env } from './synth';

export type SfxName =
  | 'lightHit' | 'heavyHit' | 'block' | 'whoosh' | 'whooshHeavy' | 'special' | 'projectile' | 'launch' | 'ko'
  | 'menuMove' | 'menuSelect' | 'menuBack' | 'roundStart' | 'fight' | 'fatality' | 'ultimate' | 'thud' | 'buff'
  | 'teleport' | 'clash' | 'bell' | 'boom' | 'throw' | 'timer' | 'shield' | 'counter' | 'win' | 'land'
  | 'unlock' | 'error';

type Fx = (e: Env, I: number, t: number) => number; // returns approx duration in seconds

const BELL_RATIOS = [0.5, 1, 1.19, 1.56, 2.0, 2.51, 2.74, 3.0, 4.07];
function bell(e: Env, t: number, base: number, vol: number, len: number): void {
  BELL_RATIOS.forEach((r, i) => {
    tone(e, { type: 'sine', f0: base * r * (1 + (i % 2 ? 0.002 : -0.002)), t, dur: len * (1 - i * 0.07), vol: vol / (1 + i * 0.55), atk: 0.002, rev: 0.5 });
  });
  noise(e, { t, dur: 0.05, vol: vol * 0.6, type: 'bandpass', f0: base * 4, q: 2 });
}
function thump(e: Env, t: number, vol: number, f0 = 150, f1 = 45, dur = 0.2): void {
  tone(e, { type: 'sine', f0, f1, t, dur, vol, atk: 0.002 });
}

export const SFX: Record<SfxName, Fx> = {
  lightHit(e, I, t) {
    thump(e, t, 0.55 * I, 190, 60, 0.12);
    tone(e, { type: 'triangle', f0: 420, f1: 140, t, dur: 0.09, vol: 0.22 * I });
    noise(e, { t, dur: 0.07, vol: 0.38 * I, type: 'highpass', f0: 1800, q: 0.6 });
    return 0.2;
  },
  heavyHit(e, I, t) {
    thump(e, t, 0.95 * I, 130, 32, 0.34);
    tone(e, { type: 'square', f0: 80, f1: 30, t, dur: 0.28, vol: 0.3 * I, lp: 260 });
    noise(e, { t, dur: 0.26, vol: 0.6 * I, type: 'lowpass', f0: 3200, f1: 350, q: 0.7 });
    noise(e, { t, dur: 0.1, vol: 0.5 * I, type: 'highpass', f0: 1200 });
    tone(e, { type: 'triangle', f0: 300, f1: 70, t, dur: 0.16, vol: 0.28 * I });
    return 0.4;
  },
  block(e, I, t) {
    noise(e, { t, dur: 0.09, vol: 0.4 * I, type: 'bandpass', f0: 2600, q: 7 });
    tone(e, { type: 'square', f0: 880, f1: 860, t, dur: 0.07, vol: 0.12 * I, lp: 3000 });
    tone(e, { type: 'sine', f0: 1320, t, dur: 0.14, vol: 0.12 * I });
    thump(e, t, 0.3 * I, 120, 70, 0.1);
    return 0.2;
  },
  whoosh(e, I, t) {
    noise(e, { t, dur: 0.2, vol: 0.26 * I, type: 'bandpass', f0: 500, f1: 2600, q: 1.8, atk: 0.07 });
    return 0.25;
  },
  whooshHeavy(e, I, t) {
    noise(e, { t, dur: 0.34, vol: 0.42 * I, type: 'bandpass', f0: 260, f1: 1800, q: 1.4, atk: 0.12 });
    tone(e, { type: 'sine', f0: 110, f1: 55, t, dur: 0.3, vol: 0.2 * I, atk: 0.08 });
    return 0.4;
  },
  special(e, I, t) {
    tone(e, { type: 'sawtooth', f0: 220, f1: 1760, t, dur: 0.55, vol: 0.12 * I, lp: 1500, lpEnd: 6000, atk: 0.1, rev: 0.4 });
    tone(e, { type: 'sine', f0: 440, f1: 1320, t, dur: 0.5, vol: 0.16 * I, atk: 0.05, trem: [24, 0.8] });
    tone(e, { type: 'sine', f0: 660, f1: 1980, t: t + 0.04, dur: 0.46, vol: 0.1 * I, atk: 0.05, trem: [18, 0.8] });
    noise(e, { t, dur: 0.5, vol: 0.2 * I, type: 'highpass', f0: 1500, f1: 7000, q: 1, atk: 0.15, rev: 0.3 });
    thump(e, t + 0.45, 0.3 * I, 120, 50, 0.2);
    return 0.7;
  },
  projectile(e, I, t) {
    noise(e, { t, dur: 0.28, vol: 0.3 * I, type: 'bandpass', f0: 700, f1: 3200, q: 2.5, atk: 0.04 });
    tone(e, { type: 'triangle', f0: 300, f1: 900, t, dur: 0.22, vol: 0.16 * I });
    return 0.3;
  },
  launch(e, I, t) {
    tone(e, { type: 'sine', f0: 120, f1: 760, t, dur: 0.35, vol: 0.3 * I, atk: 0.02 });
    noise(e, { t, dur: 0.3, vol: 0.4 * I, type: 'bandpass', f0: 400, f1: 3000, q: 1.2, atk: 0.05 });
    thump(e, t, 0.7 * I, 140, 40, 0.25);
    return 0.45;
  },
  ko(e, I, t) {
    thump(e, t, 1.0 * I, 110, 24, 1.0);
    tone(e, { type: 'sawtooth', f0: 420, f1: 38, t, dur: 1.3, vol: 0.2 * I, lp: 1400, lpEnd: 80, rev: 0.5 });
    noise(e, { t, dur: 1.1, vol: 0.5 * I, type: 'lowpass', f0: 2400, f1: 80, q: 0.6, rev: 0.4 });
    noise(e, { t, dur: 0.12, vol: 0.6 * I, type: 'highpass', f0: 900 });
    bell(e, t + 0.05, 110, 0.12 * I, 2.2);
    return 2.4;
  },
  menuMove(e, I, t) {
    tone(e, { type: 'triangle', f0: 660, f1: 700, t, dur: 0.07, vol: 0.14 * I, lp: 3000 });
    return 0.1;
  },
  menuSelect(e, I, t) {
    tone(e, { type: 'triangle', f0: 523, t, dur: 0.1, vol: 0.18 * I, lp: 3500 });
    tone(e, { type: 'triangle', f0: 784, t: t + 0.07, dur: 0.18, vol: 0.2 * I, lp: 3500, rev: 0.3 });
    tone(e, { type: 'sine', f0: 1568, t: t + 0.07, dur: 0.2, vol: 0.06 * I });
    return 0.3;
  },
  menuBack(e, I, t) {
    tone(e, { type: 'triangle', f0: 520, f1: 330, t, dur: 0.14, vol: 0.16 * I, lp: 2500 });
    return 0.2;
  },
  roundStart(e, I, t) {
    thump(e, t, 0.8 * I, 100, 38, 0.5);
    noise(e, { t, dur: 0.18, vol: 0.2 * I, type: 'lowpass', f0: 900, q: 0.6, rev: 0.4 });
    thump(e, t + 0.22, 0.65 * I, 90, 36, 0.5);
    tone(e, { type: 'sawtooth', f0: 110, t: t + 0.1, dur: 0.9, vol: 0.12 * I, lp: 500, lpEnd: 1400, atk: 0.35, rev: 0.4 });
    tone(e, { type: 'sawtooth', f0: 165, t: t + 0.1, dur: 0.9, vol: 0.09 * I, lp: 500, lpEnd: 1400, atk: 0.35, rev: 0.4 });
    return 1.1;
  },
  fight(e, I, t) {
    thump(e, t, 1.0 * I, 105, 34, 0.6);
    thump(e, t + 0.12, 0.8 * I, 95, 32, 0.5);
    noise(e, { t, dur: 0.6, vol: 0.35 * I, type: 'highpass', f0: 2500, q: 0.5, rev: 0.5 });
    for (const f of [147, 220, 294, 370]) tone(e, { type: 'sawtooth', f0: f, t, dur: 0.7, vol: 0.09 * I, lp: 1900, lpEnd: 700, atk: 0.02, rev: 0.4 });
    return 0.9;
  },
  fatality(e, I, t) {
    // deep braided drone
    for (const [f, d] of [[55, 0], [55.7, 0], [82.4, 0], [110.5, -5]] as [number, number][])
      tone(e, { type: 'sawtooth', f0: f, t, dur: 2.8, vol: 0.14 * I, lp: 260, lpEnd: 700, atk: 0.9, detune: d, rev: 0.5 });
    // reversed swell
    noise(e, { t, dur: 1.4, vol: 0.5 * I, type: 'bandpass', f0: 200, f1: 3500, q: 1.2, swell: true, rev: 0.4 });
    tone(e, { type: 'sine', f0: 60, f1: 300, t, dur: 1.4, vol: 0.18 * I, atk: 1.2 });
    // impact
    const b = t + 1.4;
    thump(e, b, 1.1 * I, 100, 22, 1.4);
    noise(e, { t: b, dur: 1.3, vol: 0.6 * I, type: 'lowpass', f0: 2200, f1: 70, rev: 0.5 });
    bell(e, b, 82, 0.16 * I, 3.2);
    return 3.2;
  },
  ultimate(e, I, t) {
    tone(e, { type: 'sawtooth', f0: 80, f1: 880, t, dur: 0.9, vol: 0.16 * I, lp: 400, lpEnd: 7000, atk: 0.5, rev: 0.4 });
    tone(e, { type: 'square', f0: 160, f1: 1760, t, dur: 0.9, vol: 0.06 * I, lp: 2000, lpEnd: 6000, atk: 0.5 });
    noise(e, { t, dur: 0.9, vol: 0.4 * I, type: 'highpass', f0: 600, f1: 8000, swell: true, rev: 0.3 });
    const b = t + 0.9;
    thump(e, b, 1.0 * I, 120, 30, 0.8);
    noise(e, { t: b, dur: 0.7, vol: 0.5 * I, type: 'lowpass', f0: 5000, f1: 200, rev: 0.5 });
    for (const f of [440, 660, 880, 1320]) tone(e, { type: 'sine', f0: f, t: b, dur: 1.1, vol: 0.08 * I, trem: [9, 0.6], rev: 0.5 });
    return 2.0;
  },
  thud(e, I, t) {
    thump(e, t, 0.7 * I, 100, 38, 0.2);
    noise(e, { t, dur: 0.12, vol: 0.2 * I, type: 'lowpass', f0: 500, q: 0.6 });
    return 0.3;
  },
  buff(e, I, t) {
    [523, 659, 784, 1047].forEach((f, i) => tone(e, { type: 'sine', f0: f, t: t + i * 0.06, dur: 0.4, vol: 0.14 * I, rev: 0.4, trem: [10, 0.4] }));
    noise(e, { t, dur: 0.4, vol: 0.12 * I, type: 'highpass', f0: 4000, atk: 0.1 });
    return 0.7;
  },
  teleport(e, I, t) {
    noise(e, { t, dur: 0.22, vol: 0.35 * I, type: 'bandpass', f0: 3500, f1: 250, q: 3 });
    tone(e, { type: 'sine', f0: 1500, f1: 160, t, dur: 0.2, vol: 0.2 * I });
    noise(e, { t: t + 0.2, dur: 0.2, vol: 0.3 * I, type: 'bandpass', f0: 250, f1: 3500, q: 3, swell: true });
    tone(e, { type: 'sine', f0: 200, f1: 1600, t: t + 0.2, dur: 0.2, vol: 0.18 * I, atk: 0.1 });
    return 0.5;
  },
  clash(e, I, t) {
    noise(e, { t, dur: 0.14, vol: 0.5 * I, type: 'bandpass', f0: 3600, q: 3 });
    for (const f of [1210, 1870, 2650, 3400]) tone(e, { type: 'sine', f0: f, t, dur: 0.28, vol: 0.1 * I, rev: 0.3 });
    tone(e, { type: 'square', f0: 700, f1: 650, t, dur: 0.06, vol: 0.12 * I, lp: 3500 });
    thump(e, t, 0.55 * I, 140, 50, 0.14);
    return 0.4;
  },
  bell(e, I, t) {
    bell(e, t, 330, 0.3 * I, 3.2);
    return 3.4;
  },
  boom(e, I, t) {
    thump(e, t, 1.1 * I, 95, 24, 1.2);
    tone(e, { type: 'sine', f0: 48, f1: 28, t, dur: 1.4, vol: 0.5 * I });
    noise(e, { t, dur: 1.0, vol: 0.6 * I, type: 'lowpass', f0: 700, f1: 70, q: 0.7, rev: 0.4 });
    noise(e, { t, dur: 0.1, vol: 0.4 * I, type: 'highpass', f0: 1000 });
    return 1.5;
  },
  throw(e, I, t) {
    noise(e, { t, dur: 0.22, vol: 0.28 * I, type: 'bandpass', f0: 400, f1: 2000, q: 1.5, atk: 0.08 });
    thump(e, t + 0.16, 0.8 * I, 120, 35, 0.3);
    noise(e, { t: t + 0.16, dur: 0.15, vol: 0.4 * I, type: 'lowpass', f0: 1500, f1: 300 });
    return 0.5;
  },
  timer(e, I, t) {
    for (let i = 0; i < 2; i++) tone(e, { type: 'square', f0: 1100, t: t + i * 0.13, dur: 0.06, vol: 0.13 * I, lp: 3500 });
    return 0.3;
  },
  shield(e, I, t) {
    tone(e, { type: 'sine', f0: 700, f1: 1500, t, dur: 0.4, vol: 0.18 * I, trem: [20, 0.7], rev: 0.4 });
    tone(e, { type: 'triangle', f0: 350, f1: 750, t, dur: 0.3, vol: 0.12 * I });
    noise(e, { t, dur: 0.3, vol: 0.2 * I, type: 'bandpass', f0: 2500, q: 3, atk: 0.1 });
    return 0.5;
  },
  counter(e, I, t) {
    tone(e, { type: 'sine', f0: 1800, f1: 900, t, dur: 0.18, vol: 0.2 * I, rev: 0.3 });
    noise(e, { t, dur: 0.18, vol: 0.4 * I, type: 'bandpass', f0: 300, f1: 3000, q: 2, swell: true });
    noise(e, { t: t + 0.12, dur: 0.07, vol: 0.4 * I, type: 'highpass', f0: 2500 });
    thump(e, t + 0.14, 0.7 * I, 150, 45, 0.18);
    return 0.4;
  },
  win(e, I, t) {
    const seq: [number, number][] = [[392, 0], [494, 0.14], [587, 0.28], [784, 0.42], [988, 0.62]];
    for (const [f, d] of seq) {
      tone(e, { type: 'sawtooth', f0: f, t: t + d, dur: d === 0.62 ? 1.0 : 0.3, vol: 0.12 * I, lp: 2400, lpEnd: 900, atk: 0.02, rev: 0.4 });
      tone(e, { type: 'sawtooth', f0: f * 1.005, t: t + d, dur: d === 0.62 ? 1.0 : 0.3, vol: 0.08 * I, lp: 2400, lpEnd: 900, atk: 0.02 });
    }
    thump(e, t + 0.62, 0.7 * I, 110, 40, 0.5);
    return 1.7;
  },
  land(e, I, t) {
    thump(e, t, 0.4 * I, 90, 45, 0.12);
    noise(e, { t, dur: 0.1, vol: 0.14 * I, type: 'lowpass', f0: 800, q: 0.6 });
    return 0.2;
  },
  unlock(e, I, t) {
    [880, 1175, 1568, 2093].forEach((f, i) => tone(e, { type: 'sine', f0: f, t: t + i * 0.08, dur: 0.5, vol: 0.14 * I, rev: 0.5 }));
    bell(e, t + 0.3, 523, 0.1 * I, 1.8);
    return 1.8;
  },
  error(e, I, t) {
    for (let i = 0; i < 2; i++) tone(e, { type: 'square', f0: 150, f1: 120, t: t + i * 0.13, dur: 0.1, vol: 0.16 * I, lp: 700 });
    return 0.3;
  },
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];
// Minimum spacing between identical sounds (sec) to avoid piling up.
export const SFX_MIN_GAP: Partial<Record<SfxName, number>> = {
  lightHit: 0.04, heavyHit: 0.05, whoosh: 0.06, whooshHeavy: 0.08, menuMove: 0.03, timer: 0.1, land: 0.08, thud: 0.06, block: 0.05,
};
