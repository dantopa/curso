// Low-level procedural synth helpers shared by SFX and music. Every node created here is
// disconnected automatically when its source ends, so node counts stay bounded.

export interface Env {
  ctx: AudioContext;
  out: AudioNode;               // destination bus for this sound
  rev: AudioNode | null;        // optional reverb send input
  noise: AudioBuffer;           // shared white-noise buffer
}

export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

function cleanup(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) { try { n.disconnect(); } catch { /* already gone */ } }
  };
}

export interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  t: number;
  dur: number;
  vol: number;
  atk?: number;
  /** hold at full volume this long (sec) before the exponential decay starts */
  hold?: number;
  lp?: number; lpEnd?: number; q?: number;
  hp?: number;
  detune?: number;
  rev?: number;                 // reverb send amount 0..1
  vib?: [number, number];       // [rate Hz, depth Hz]
  trem?: [number, number];      // [rate Hz, depth 0..1]
  dest?: AudioNode;
}

export function tone(e: Env, o: ToneOpts): void {
  const { ctx } = e;
  const t = Math.max(o.t, ctx.currentTime);
  const end = t + o.dur;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(1, o.f0), t);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), end);
  if (o.detune) osc.detune.value = o.detune;
  const nodes: AudioNode[] = [osc];
  let last: AudioNode = osc;
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; last.connect(f); last = f; nodes.push(f); }
  if (o.lp) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.lp, t);
    if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.lpEnd), end);
    last.connect(f); last = f; nodes.push(f);
  }
  const g = ctx.createGain();
  const atk = Math.min(o.atk ?? 0.004, o.dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, o.vol), t + atk);
  if (o.hold) g.gain.setValueAtTime(Math.max(0.0002, o.vol), Math.min(end - 0.01, t + atk + o.hold));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  last.connect(g); nodes.push(g);
  g.connect(o.dest ?? e.out);
  if (o.rev && e.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(e.rev); nodes.push(s); }
  if (o.vib) {
    const l = ctx.createOscillator(); const lg = ctx.createGain();
    l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
    l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(end + 0.05);
    nodes.push(l, lg);
  }
  if (o.trem) {
    const l = ctx.createOscillator(); const lg = ctx.createGain();
    l.frequency.value = o.trem[0]; lg.gain.value = o.trem[1] * o.vol * 0.5;
    l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(end + 0.05);
    nodes.push(l, lg);
  }
  osc.start(t);
  osc.stop(end + 0.05);
  cleanup(osc, nodes);
}

export interface NoiseOpts {
  t: number; dur: number; vol: number;
  type?: BiquadFilterType;
  f0?: number; f1?: number; q?: number;
  atk?: number;
  /** rising envelope (reverse swell): peak at the end */
  swell?: boolean;
  rev?: number;
  dest?: AudioNode;
}

export function noise(e: Env, o: NoiseOpts): void {
  const { ctx } = e;
  const t = Math.max(o.t, ctx.currentTime);
  const end = t + o.dur;
  const src = ctx.createBufferSource();
  src.buffer = e.noise; src.loop = true;
  const nodes: AudioNode[] = [src];
  let last: AudioNode = src;
  if (o.type) {
    const f = ctx.createBiquadFilter(); f.type = o.type; f.Q.value = o.q ?? 0.8;
    f.frequency.setValueAtTime(o.f0 ?? 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), end);
    last.connect(f); last = f; nodes.push(f);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  if (o.swell) {
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), end - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, end);
  } else {
    const atk = Math.min(o.atk ?? 0.002, o.dur * 0.5);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, o.vol), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  last.connect(g); nodes.push(g);
  g.connect(o.dest ?? e.out);
  if (o.rev && e.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(e.rev); nodes.push(s); }
  src.start(t, Math.random() * 1.5);
  src.stop(end + 0.05);
  cleanup(src, nodes);
}

/** Play a pre-rendered buffer (e.g. Karplus-Strong pluck). */
export function playBuffer(e: Env, buf: AudioBuffer, t: number, vol: number, rate = 1, dest?: AudioNode, lp?: number): void {
  const { ctx } = e;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol;
  const nodes: AudioNode[] = [src, g];
  let last: AudioNode = src;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; last.connect(f); last = f; nodes.push(f); }
  last.connect(g); g.connect(dest ?? e.out);
  src.start(Math.max(t, ctx.currentTime));
  cleanup(src, nodes);
}

export function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function makeImpulse(ctx: AudioContext, seconds = 2.2, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1);
  }
  return buf;
}

/** Karplus-Strong plucked string buffer. */
export function ksBuffer(ctx: AudioContext, freq: number, seconds: number, damp = 0.5, decay = 0.996): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx], b = ring[(idx + 1) % period];
    const v = (a * (1 - damp * 0.5) + b * damp * 0.5) * decay;
    d[i] = a;
    ring[idx] = v;
    idx = (idx + 1) % period;
  }
  // gentle fade to avoid clicks at end
  const fade = Math.min(len, 400);
  for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
  return buf;
}
