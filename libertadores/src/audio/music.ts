// Procedural music: lookahead step-sequencer on top of Web Audio, all sound synthesised.
import { ksBuffer, midiToFreq, noise, playBuffer, tone } from './synth';
import type { Env } from './synth';

export type MusicTrack = 'menu' | 'select' | 'fight1' | 'fight2' | 'fight3' | 'tournament' | 'fatality' | 'victory' | 'defeat';

type Q = 'm' | 'M' | 'd' | '5' | 's';
interface Chord { r: number; q: Q }
type Mel = [number, number, number][]; // [step, scale degree, length in steps]

interface TrackDef {
  bpm: number; root: number; scale: number[]; spb: number; bars: number; swing?: number;
  chords: Chord[];
  tom?: string; bombo?: string; rim?: string; snare?: string; hat?: string;
  bass?: string; bassOct?: number; bassVol?: number;
  pad?: number;               // pad volume
  guitar?: string; gOct?: number; gVol?: number; charango?: boolean;
  lead?: Mel; voice?: 'quena' | 'brass'; leadOct?: number; leadVol?: number;
  bellEvery?: number;         // bars
  swellEvery?: number;        // bars (reverse noise swell)
  drumVol?: number;
}

const PHR = [0, 1, 3, 5, 7, 8, 10];
const PHRDOM = [0, 1, 4, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const MAJ = [0, 2, 4, 5, 7, 9, 11];

const TRACKS: Record<MusicTrack, TrackDef> = {
  menu: {
    bpm: 60, root: 38, scale: PHR, spb: 16, bars: 8,
    chords: [{ r: 0, q: 'm' }, { r: 1, q: 'M' }, { r: 0, q: 'm' }, { r: -2, q: 'M' }, { r: 0, q: 'm' }, { r: 5, q: 'm' }, { r: 1, q: 'M' }, { r: 0, q: '5' }],
    tom: 'X...............o...x...........',
    bass: 'X', bassOct: 0, bassVol: 0.3,
    pad: 0.06,
    guitar: '0.......2...1...3.......2...1...', gOct: 24, gVol: 0.22,
    lead: [[0, 7, 12], [12, 6, 4], [16, 5, 12], [28, 4, 4], [32, 4, 10], [44, 5, 4], [48, 7, 10], [60, 9, 4], [64, 8, 12], [76, 7, 4], [80, 6, 10], [92, 5, 4], [96, 4, 14], [112, 3, 6], [120, 4, 8]],
    voice: 'quena', leadOct: 24, leadVol: 0.12, bellEvery: 4, drumVol: 0.9,
  },
  select: {
    bpm: 94, root: 45, scale: HARM, spb: 16, bars: 8,
    chords: [{ r: 0, q: 'm' }, { r: 5, q: 'm' }, { r: 7, q: 'M' }, { r: 0, q: 'm' }, { r: 8, q: 'M' }, { r: 5, q: 'm' }, { r: 7, q: 'M' }, { r: 0, q: 'm' }],
    tom: 'X...x...X...x.x.', bombo: 'x.......x.......', rim: '....x.......x..x',
    bass: 'X.x.X.x.X.x.X.x.', bassOct: 0, bassVol: 0.28,
    pad: 0.05,
    guitar: '0.1.2.1.0.1.2.3.', gOct: 24, gVol: 0.28,
    lead: [[0, 0, 4], [4, 2, 4], [8, 4, 8], [16, 4, 3], [20, 5, 3], [24, 4, 4], [28, 2, 4], [32, 0, 8], [40, 2, 4], [44, 4, 4], [48, 7, 8], [56, 6, 4], [60, 4, 4], [64, 5, 8], [72, 4, 4], [76, 2, 4], [80, 3, 8], [88, 2, 4], [92, 0, 4], [96, 4, 6], [104, 5, 2], [106, 6, 2], [108, 7, 4], [112, 8, 12], [124, 6, 4]],
    voice: 'brass', leadOct: 24, leadVol: 0.06, bellEvery: 8, drumVol: 0.85,
  },
  fight1: {
    bpm: 128, root: 40, scale: PHRDOM, spb: 16, bars: 4,
    chords: [{ r: 0, q: 'M' }, { r: 1, q: 'M' }, { r: 0, q: 'M' }, { r: -2, q: 'M' }],
    tom: 'X..x..x.X..x.x..', bombo: 'x...x...x...x.x.', rim: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.xx',
    bass: 'x.xxx.xxx.xxx.x.', bassOct: 0, bassVol: 0.3,
    pad: 0.04,
    guitar: '0.12.1020.12.102', gOct: 24, gVol: 0.3,
    lead: [[0, 0, 3], [4, 1, 2], [6, 0, 2], [8, 2, 3], [12, 1, 2], [16, 0, 3], [20, 4, 2], [22, 3, 2], [24, 2, 4], [28, 1, 2], [32, 0, 3], [36, 1, 2], [38, 2, 2], [40, 4, 3], [44, 5, 2], [46, 4, 2], [48, 2, 4], [52, 1, 4], [56, 0, 6], [62, 1, 2]],
    voice: 'brass', leadOct: 24, leadVol: 0.05, drumVol: 1,
  },
  fight2: {
    bpm: 116, root: 43, scale: HARM, spb: 12, bars: 8,
    chords: [{ r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 5, q: 'm' }, { r: 7, q: 'M' }, { r: 0, q: 'm' }, { r: 8, q: 'M' }, { r: 7, q: 'M' }, { r: 0, q: 'm' }],
    tom: '......X.....', bombo: 'X.....x.x...', rim: '..x..x..x..x', hat: 'x.x.x.x.x.x.',
    bass: 'X.....x.....', bassOct: 0, bassVol: 0.32,
    pad: 0.04,
    guitar: '012.012.0123', gOct: 24, gVol: 0.32, charango: true,
    lead: [[0, 4, 3], [3, 5, 3], [6, 4, 3], [9, 2, 3], [12, 4, 3], [15, 5, 3], [18, 7, 6], [24, 6, 3], [27, 5, 3], [30, 4, 3], [33, 2, 3], [36, 0, 6], [42, 2, 3], [45, 4, 3], [48, 5, 3], [51, 4, 3], [54, 2, 6], [60, 0, 3], [63, 2, 3], [66, 4, 6], [72, 5, 3], [75, 6, 3], [78, 7, 6], [84, 6, 3], [87, 4, 3], [90, 2, 3], [93, 0, 3]],
    voice: 'quena', leadOct: 24, leadVol: 0.12, drumVol: 1,
  },
  fight3: {
    bpm: 146, root: 42, scale: PHR, spb: 16, bars: 4,
    chords: [{ r: 0, q: 'm' }, { r: 1, q: 'M' }, { r: 0, q: 'm' }, { r: -2, q: 'M' }],
    tom: 'X.xxX.xxX.xxX.xx', bombo: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    bass: 'xxxxxxxxxxxxxxxx', bassOct: 0, bassVol: 0.26,
    pad: 0.045,
    guitar: '0121.2102.1210.1', gOct: 24, gVol: 0.3,
    lead: [[0, 0, 2], [2, 1, 2], [4, 0, 2], [6, 3, 2], [8, 1, 4], [12, 0, 2], [14, 6, 2], [16, 0, 2], [18, 1, 2], [20, 4, 2], [22, 3, 2], [24, 1, 4], [28, 2, 2], [30, 1, 2], [32, 0, 2], [34, 1, 2], [36, 0, 2], [38, 5, 2], [40, 4, 4], [44, 3, 2], [46, 1, 2], [48, 0, 2], [50, 1, 2], [52, 3, 2], [54, 4, 2], [56, 5, 4], [60, 4, 2], [62, 3, 2]],
    voice: 'brass', leadOct: 24, leadVol: 0.055, drumVol: 1.05,
  },
  tournament: {
    bpm: 104, root: 36, scale: MIN, spb: 16, bars: 8,
    chords: [{ r: 0, q: 'm' }, { r: 8, q: 'M' }, { r: 10, q: 'M' }, { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 8, q: 'M' }, { r: 7, q: 'M' }, { r: 0, q: 'm' }],
    tom: 'X...x...X...x...', snare: 'x.xxx.xxx.xxx.xx', bombo: 'x...x...x...x...',
    bass: 'X...X...X...X...', bassOct: 0, bassVol: 0.3,
    pad: 0.05,
    lead: [[0, 0, 6], [6, 0, 2], [8, 2, 4], [12, 4, 4], [16, 4, 6], [22, 2, 2], [24, 0, 8], [32, 5, 6], [38, 5, 2], [40, 4, 4], [44, 2, 4], [48, 3, 8], [56, 4, 8], [64, 0, 6], [70, 0, 2], [72, 2, 4], [76, 4, 4], [80, 7, 6], [86, 6, 2], [88, 4, 8], [96, 5, 4], [100, 4, 4], [104, 3, 4], [108, 2, 4], [112, 0, 8], [120, 4, 8]],
    voice: 'brass', leadOct: 24, leadVol: 0.065, bellEvery: 8, drumVol: 1,
  },
  fatality: {
    bpm: 48, root: 36, scale: PHR, spb: 16, bars: 8,
    chords: [{ r: 0, q: 'd' }, { r: 0, q: '5' }, { r: 1, q: 'd' }, { r: 0, q: '5' }, { r: 0, q: 'd' }, { r: -1, q: '5' }, { r: 1, q: 'd' }, { r: 0, q: '5' }],
    tom: 'X.x.............', bass: 'X', bassOct: 0, bassVol: 0.34,
    pad: 0.07,
    lead: [[32, 0, 24], [64, 1, 28], [96, 4, 20]], voice: 'quena', leadOct: 12, leadVol: 0.1,
    bellEvery: 2, swellEvery: 4, drumVol: 0.9,
  },
  victory: {
    bpm: 112, root: 50, scale: MAJ, spb: 16, bars: 8,
    chords: [{ r: 0, q: 'M' }, { r: 7, q: 'M' }, { r: 9, q: 'm' }, { r: 5, q: 'M' }, { r: 0, q: 'M' }, { r: 7, q: 'M' }, { r: 5, q: 'M' }, { r: 0, q: 'M' }],
    tom: 'X..x..x.X..x....', snare: 'x.xx.x.xx.xx.x..', bombo: 'x...x...x...x...',
    bass: 'X...x...X...x...', bassOct: 0, bassVol: 0.28,
    pad: 0.06,
    guitar: 'S...1...2...1...', gOct: 24, gVol: 0.3,
    lead: [[0, 0, 4], [4, 0, 2], [6, 4, 6], [12, 2, 4], [16, 4, 8], [24, 2, 4], [28, 0, 4], [32, 5, 4], [36, 5, 2], [38, 4, 6], [44, 5, 4], [48, 6, 8], [56, 4, 8], [64, 0, 4], [68, 0, 2], [70, 4, 6], [76, 2, 4], [80, 7, 8], [88, 6, 4], [92, 5, 4], [96, 4, 6], [102, 5, 2], [104, 6, 4], [108, 5, 4], [112, 7, 16]],
    voice: 'brass', leadOct: 24, leadVol: 0.075, bellEvery: 4, drumVol: 1,
  },
  defeat: {
    bpm: 54, root: 45, scale: MIN, spb: 16, bars: 8,
    chords: [{ r: 0, q: 'm' }, { r: 8, q: 'M' }, { r: 5, q: 'm' }, { r: 0, q: 'm' }, { r: 0, q: 'm' }, { r: 3, q: 'M' }, { r: 7, q: 'm' }, { r: 0, q: '5' }],
    tom: 'X...............', bass: 'X', bassOct: 0, bassVol: 0.3,
    pad: 0.06,
    guitar: '0.......2.......', gOct: 12, gVol: 0.22,
    lead: [[0, 4, 12], [12, 3, 4], [16, 2, 12], [28, 1, 4], [32, 0, 16], [48, 2, 8], [56, 1, 8], [64, 4, 10], [74, 3, 6], [80, 2, 10], [90, 1, 6], [96, 0, 24], [120, -1, 8]],
    voice: 'quena', leadOct: 24, leadVol: 0.12, bellEvery: 4, drumVol: 0.8,
  },
};

const degMidi = (def: TrackDef, d: number): number => {
  const n = def.scale.length;
  const idx = ((d % n) + n) % n;
  return def.root + 12 * Math.floor(d / n) + def.scale[idx];
};

function chordMidi(def: TrackDef, bar: number): number[] {
  const c = def.chords[bar % def.chords.length];
  const base = def.root + c.r;
  const third = c.q === 'm' || c.q === 'd' ? 3 : c.q === 'M' ? 4 : c.q === 's' ? 5 : 7;
  const fifth = c.q === 'd' ? 6 : 7;
  return [base, base + third, base + fifth, base + 12];
}

const at = (pat: string | undefined, step: number): string => (pat && pat.length ? pat[step % pat.length] : '.');
const vel = (ch: string): number => (ch === 'X' ? 1 : ch === 'x' ? 0.7 : ch === 'o' ? 0.4 : ch === 'S' ? 1 : 0.6);

interface Running {
  track: MusicTrack; def: TrackDef; gain: GainNode; env: Env;
  step: number; nextT: number; timer: ReturnType<typeof setInterval> | null;
}

export class MusicPlayer {
  private cur: Running | null = null;
  private ks = new Map<number, AudioBuffer>();

  constructor(private base: Env, private bus: AudioNode) {}

  get current(): MusicTrack | null { return this.cur ? this.cur.track : null; }

  play(track: MusicTrack, fade = 1.0): void {
    const { ctx } = this.base;
    if (this.cur && this.cur.track === track) return;
    const def = TRACKS[track];
    if (!def) return;
    this.fadeOut(fade);
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + Math.max(0.05, fade));
    gain.connect(this.bus);
    const env: Env = { ctx, out: gain, rev: this.base.rev, noise: this.base.noise };
    const run: Running = { track, def, gain, env, step: 0, nextT: now + 0.08, timer: null };
    this.cur = run;
    const tick = () => {
      try {
        if (ctx.state !== 'running') { run.nextT = Math.max(run.nextT, ctx.currentTime + 0.05); return; }
        if (run.nextT < ctx.currentTime - 0.3) run.nextT = ctx.currentTime + 0.05; // resumed after stall
        const stepDur = 60 / def.bpm / 4;
        while (run.nextT < ctx.currentTime + 0.14) {
          const sw = def.swing && run.step % 2 === 1 ? def.swing * stepDur : 0;
          this.playStep(run, run.step, run.nextT + sw, stepDur);
          run.nextT += stepDur;
          run.step++;
        }
      } catch { /* never let audio kill the game */ }
    };
    run.timer = setInterval(tick, 25);
    tick();
  }

  stop(fade = 1): void {
    this.fadeOut(fade);
    this.cur = null;
  }

  private fadeOut(fade: number): void {
    const run = this.cur;
    if (!run) return;
    this.cur = null;
    if (run.timer) { clearInterval(run.timer); run.timer = null; }
    const { ctx } = this.base;
    try {
      const now = ctx.currentTime;
      run.gain.gain.cancelScheduledValues(now);
      run.gain.gain.setValueAtTime(Math.max(0.0001, run.gain.gain.value), now);
      run.gain.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
    } catch { /* ignore */ }
    setTimeout(() => { try { run.gain.disconnect(); } catch { /* ignore */ } }, (Math.max(0.05, fade) + 0.3) * 1000);
  }

  /* -------------------------------------------------------------- step */
  private playStep(run: Running, step: number, t: number, sd: number): void {
    const { def, env } = run;
    const loop = def.spb * def.bars;
    const s = step % loop;
    const bar = Math.floor(s / def.spb);
    const sb = s % def.spb;
    const dv = def.drumVol ?? 1;

    // drums
    const tm = at(def.tom, s); if (tm !== '.') this.tom(env, t, vel(tm) * dv, tm === 'X' ? 1 : 1.25);
    const bb = at(def.bombo, s); if (bb !== '.') this.bombo(env, t, vel(bb) * dv);
    const rm = at(def.rim, s); if (rm !== '.') this.rim(env, t, vel(rm) * dv);
    const sn = at(def.snare, s); if (sn !== '.') this.snare(env, t, vel(sn) * dv);
    const ht = at(def.hat, s); if (ht !== '.') noise(env, { t, dur: 0.035, vol: 0.05 * vel(ht) * dv, type: 'highpass', f0: 7000 });

    const chord = chordMidi(def, bar);

    // pad: one chord per bar
    if (def.pad && sb === 0) {
      const dur = def.spb * sd * 1.02;
      for (const n of chord.slice(0, 3)) {
        for (const d of [-7, 7]) tone(env, { type: 'sawtooth', f0: midiToFreq(n + 12), t, dur, vol: def.pad, lp: 500, lpEnd: 900, q: 0.6, atk: dur * 0.4, detune: d, rev: 0.5 });
      }
    }
    // bass
    if (def.bass) {
      const drone = def.bass.length === 1;
      const ch = drone ? (sb === 0 ? 'X' : '.') : at(def.bass, sb);
      if (ch !== '.') {
        let gap = 1;
        if (drone) gap = def.spb;
        else while (sb + gap < def.spb && at(def.bass, sb + gap) === '.') gap++;
        const dur = Math.max(sd * 0.9, gap * sd * 0.95);
        const fifth = !drone && sb % 8 === 6 && ch === 'x';
        const note = chord[0] + (def.bassOct ?? 0) + (fifth ? 7 : 0);
        const f = midiToFreq(note);
        const v = (def.bassVol ?? 0.3) * vel(ch);
        const atk = drone ? 0.3 : 0.005;
        tone(env, { type: 'triangle', f0: f, t, dur, vol: v, lp: 420, atk });
        tone(env, { type: 'sine', f0: f / 2, t, dur, vol: v * 0.7, atk });
        if (!drone) tone(env, { type: 'sawtooth', f0: f, t, dur: Math.min(dur, 0.16), vol: v * 0.25, lp: 700 });
      }
    }
    // guitar / charango
    if (def.guitar) {
      const ch = at(def.guitar, s);
      if (ch !== '.') {
        const gv = (def.gVol ?? 0.3);
        if (ch === 'S') {
          [0, 1, 2, 3].forEach((i) => this.pluck(env, chord[i % 4] + (def.gOct ?? 24) - 12, t + i * 0.014, gv * 0.8, 1.3));
        } else {
          const idx = parseInt(ch, 10);
          const note = chord[Number.isNaN(idx) ? 0 : idx % 4] + (def.gOct ?? 24);
          this.pluck(env, note, t, gv, def.charango ? 0.7 : 1.1, def.charango);
          if (def.charango && sb % 3 === 0) this.pluck(env, note + 12, t + 0.012, gv * 0.5, 0.5, true);
        }
      }
    }
    // lead
    if (def.lead) {
      for (const [st, deg, len] of def.lead) {
        if (st === s) this.leadNote(env, def, degMidi(def, deg) + (def.leadOct ?? 24), t, len * sd);
      }
    }
    // bell and swell accents
    if (sb === 0 && def.bellEvery && bar % def.bellEvery === 0) {
      const base = midiToFreq(def.root + 24 + def.scale[bar % 3 === 0 ? 0 : 2]);
      for (const [r, i] of [[1, 0], [1.19, 1], [2, 2], [2.74, 3]] as [number, number][])
        tone(env, { type: 'sine', f0: base * r, t, dur: 3.4 - i * 0.4, vol: 0.05 / (1 + i * 0.5), atk: 0.003, rev: 0.7 });
    }
    if (sb === 0 && def.swellEvery && bar % def.swellEvery === 2) {
      noise(env, { t, dur: def.spb * sd * 0.95, vol: 0.3, type: 'bandpass', f0: 180, f1: 2400, q: 1.5, swell: true, rev: 0.5 });
    }
  }

  /* ------------------------------------------------------------ voices */
  private tom(e: Env, t: number, v: number, pm = 1): void {
    tone(e, { type: 'sine', f0: 125 * pm, f1: 46 * pm, t, dur: 0.42, vol: 0.55 * v, atk: 0.002, rev: 0.18 });
    noise(e, { t, dur: 0.09, vol: 0.22 * v, type: 'lowpass', f0: 1100, f1: 300, q: 0.7 });
    tone(e, { type: 'triangle', f0: 200 * pm, f1: 90 * pm, t, dur: 0.1, vol: 0.14 * v });
  }
  private bombo(e: Env, t: number, v: number): void {
    tone(e, { type: 'sine', f0: 92, f1: 52, t, dur: 0.3, vol: 0.5 * v, atk: 0.002, rev: 0.12 });
    noise(e, { t, dur: 0.14, vol: 0.2 * v, type: 'lowpass', f0: 450, q: 0.6 });
    noise(e, { t, dur: 0.03, vol: 0.12 * v, type: 'bandpass', f0: 1800, q: 1.5 });
  }
  private rim(e: Env, t: number, v: number): void {
    noise(e, { t, dur: 0.045, vol: 0.22 * v, type: 'bandpass', f0: 1900, q: 4 });
    tone(e, { type: 'triangle', f0: 800, f1: 560, t, dur: 0.05, vol: 0.12 * v });
  }
  private snare(e: Env, t: number, v: number): void {
    noise(e, { t, dur: 0.13, vol: 0.26 * v, type: 'highpass', f0: 1400 });
    tone(e, { type: 'triangle', f0: 220, f1: 140, t, dur: 0.09, vol: 0.18 * v });
  }
  private pluck(e: Env, midi: number, t: number, v: number, seconds: number, bright = false): void {
    const key = midi * 10 + (bright ? 1 : 0);
    let buf = this.ks.get(key);
    if (!buf) {
      if (this.ks.size > 48) this.ks.clear();
      buf = ksBuffer(e.ctx, midiToFreq(midi), Math.min(1.5, seconds + 0.5), bright ? 0.35 : 0.6, bright ? 0.992 : 0.996);
      this.ks.set(key, buf);
    }
    playBuffer(e, buf, t, v, 1, undefined, bright ? 5000 : 3200);
    tone(e, { type: 'sine', f0: midiToFreq(midi) / 2, t, dur: 0.12, vol: v * 0.12 });
  }
  private leadNote(e: Env, def: TrackDef, midi: number, t: number, dur: number): void {
    const f = midiToFreq(midi);
    const v = def.leadVol ?? 0.1;
    if (def.voice === 'brass') {
      for (const d of [-8, 8]) tone(e, { type: 'sawtooth', f0: f, t, dur: dur * 0.98, vol: v, lp: 900, lpEnd: 2600, q: 1.2, atk: 0.04, hold: dur * 0.3, detune: d, rev: 0.3 });
      tone(e, { type: 'square', f0: f / 2, t, dur: dur * 0.9, vol: v * 0.5, lp: 600, atk: 0.04 });
    } else {
      // quena / flute: sine + soft harmonic, vibrato that grows, breath noise
      tone(e, { type: 'sine', f0: f, t, dur: dur * 1.05, vol: v, atk: 0.07, hold: dur * 0.4, vib: [5.2, f * 0.011], rev: 0.5 });
      tone(e, { type: 'sine', f0: f * 2, t, dur: dur, vol: v * 0.18, atk: 0.09, vib: [5.2, f * 0.02] });
      noise(e, { t, dur: dur * 0.9, vol: v * 0.35, type: 'bandpass', f0: f * 2.1, q: 7, atk: 0.05, rev: 0.4 });
    }
  }
}

export const TRACK_NAMES = Object.keys(TRACKS) as MusicTrack[];
