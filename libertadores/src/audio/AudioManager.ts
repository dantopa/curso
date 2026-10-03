// Fully procedural audio: no asset files. Singleton; the AudioContext is created lazily on the
// first user gesture (see unlock()). Every public method is safe to call at any time and never throws.
import { MusicPlayer } from './music';
import type { MusicTrack } from './music';
import { SFX, SFX_MIN_GAP } from './sfx';
import type { SfxName } from './sfx';
import { makeImpulse, makeNoiseBuffer } from './synth';
import type { Env } from './synth';

export type { SfxName } from './sfx';
export type { MusicTrack } from './music';

export interface Volumes { master: number; sfx: number; music: number; voice: number }

const MAX_ACTIVE_SFX = 36;

export class AudioManager {
  private static inst: AudioManager | null = null;
  static get(): AudioManager {
    if (!AudioManager.inst) AudioManager.inst = new AudioManager();
    return AudioManager.inst;
  }

  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private duckGain!: GainNode;
  private revSfx!: GainNode;
  private revMusic!: GainNode;
  private noiseBuf!: AudioBuffer;
  private player: MusicPlayer | null = null;
  private unlocked = false;
  private failed = false;
  private vol: Volumes = { master: 0.8, sfx: 0.8, music: 0.6, voice: 0.9 };
  private ducked = false;
  private pendingTrack: MusicTrack | null = null;
  private wantTrack: MusicTrack | null = null;
  private lastPlay = new Map<SfxName, number>();
  private active = 0;
  private listening = false;

  private constructor() {
    this.installGestureListeners();
  }

  /* ----------------------------------------------------------- lifecycle */
  private installGestureListeners(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    const h = () => {
      this.unlock();
      if (this.unlocked && this.ctx && this.ctx.state === 'running') {
        for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousedown']) window.removeEventListener(ev, h, true);
      }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousedown']) window.addEventListener(ev, h, true);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.failed) return null;
    try {
      const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) { this.failed = true; return null; }
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.22;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
      this.duckGain = ctx.createGain(); this.duckGain.connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.connect(this.duckGain);
      this.noiseBuf = makeNoiseBuffer(ctx, 2);
      const imp = makeImpulse(ctx, 2.2, 3);
      const mkRev = (bus: AudioNode, wet: number): GainNode => {
        const input = ctx.createGain();
        const conv = ctx.createConvolver(); conv.buffer = imp;
        const out = ctx.createGain(); out.gain.value = wet;
        input.connect(conv); conv.connect(out); out.connect(bus);
        return input;
      };
      this.revSfx = mkRev(this.sfxBus, 0.5);
      this.revMusic = mkRev(this.musicBus, 0.55);
      this.applyVolumes();
      this.player = new MusicPlayer({ ctx, out: this.musicBus, rev: this.revMusic, noise: this.noiseBuf }, this.musicBus);
      return ctx;
    } catch {
      this.failed = true; this.ctx = null;
      return null;
    }
  }

  /** Resume the context; call from any user gesture (the manager also listens by itself). */
  unlock(): void {
    try {
      const ctx = this.ensure();
      if (!ctx) return;
      this.unlocked = true;
      if (ctx.state !== 'running') {
        ctx.resume().then(() => this.flushPending()).catch(() => undefined);
      } else this.flushPending();
    } catch { /* ignore */ }
  }

  private flushPending(): void {
    if (this.pendingTrack) {
      const t = this.pendingTrack;
      this.pendingTrack = null;
      if (this.wantTrack === t) this.startTrack(t);
    }
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const v = this.vol;
      this.master.gain.setTargetAtTime(Math.pow(v.master, 1.5), now, 0.02);
      this.sfxBus.gain.setTargetAtTime(Math.pow(v.sfx, 1.5) * 1.0, now, 0.02);
      this.musicBus.gain.setTargetAtTime(Math.pow(v.music, 1.5) * 0.9, now, 0.05);
      this.duckGain.gain.setTargetAtTime(this.ducked ? 0.35 : 1, now, 0.15);
    } catch { /* ignore */ }
  }

  setVolumes(v: Partial<Volumes>): void {
    const c = (n: number | undefined, d: number) => (typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(1, n)) : d);
    this.vol = { master: c(v.master, this.vol.master), sfx: c(v.sfx, this.vol.sfx), music: c(v.music, this.vol.music), voice: c(v.voice, this.vol.voice) };
    this.applyVolumes();
    if (this.vol.voice <= 0) this.cancelSpeech();
  }

  /* ----------------------------------------------------------------- sfx */
  sfx(name: SfxName, opts?: { pan?: number; intensity?: number }): void {
    try {
      if (!this.unlocked) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const fx = SFX[name];
      if (!fx) return;
      const now = ctx.currentTime;
      const gap = SFX_MIN_GAP[name] ?? 0.015;
      const last = this.lastPlay.get(name) ?? -1;
      if (now - last < gap) return;
      if (this.active >= MAX_ACTIVE_SFX) return;
      this.lastPlay.set(name, now);
      const I = Math.max(0.05, Math.min(1.5, opts?.intensity ?? 1));
      let out: AudioNode = this.sfxBus;
      let panner: StereoPannerNode | null = null;
      if (typeof ctx.createStereoPanner === 'function') {
        panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, opts?.pan ?? 0));
        panner.connect(this.sfxBus);
        out = panner;
      }
      const env: Env = { ctx, out, rev: this.revSfx, noise: this.noiseBuf };
      this.active++;
      let dur = 0.5;
      try { dur = fx(env, I, now + 0.005); } catch { /* partial sound is fine */ }
      setTimeout(() => {
        this.active = Math.max(0, this.active - 1);
        try { panner?.disconnect(); } catch { /* ignore */ }
      }, (dur + 0.4) * 1000);
    } catch { /* never throw */ }
  }

  /* --------------------------------------------------------------- music */
  playMusic(track: MusicTrack): void {
    try {
      if (this.wantTrack === track && (this.player?.current === track || this.pendingTrack === track)) return;
      this.wantTrack = track;
      if (!this.unlocked || !this.ctx || this.ctx.state !== 'running') {
        this.pendingTrack = track;
        if (this.unlocked) this.unlock();
        return;
      }
      this.startTrack(track);
    } catch { /* ignore */ }
  }

  private startTrack(track: MusicTrack): void {
    try { this.player?.play(track, 1.2); } catch { /* ignore */ }
  }

  stopMusic(fadeSec = 1): void {
    try {
      this.wantTrack = null;
      this.pendingTrack = null;
      this.player?.stop(fadeSec);
    } catch { /* ignore */ }
  }

  setMusicDuck(duck: boolean): void {
    this.ducked = duck;
    this.applyVolumes();
  }

  /* --------------------------------------------------------------- voice */
  private cancelSpeech(): void {
    try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || !voices.length) return null;
      const want = [lang.toLowerCase(), 'es-ar', 'es-mx', 'es-us', 'es-es'];
      for (const w of want) {
        const v = voices.find((x) => x.lang.toLowerCase().replace('_', '-') === w);
        if (v) return v;
      }
      return voices.find((x) => x.lang.toLowerCase().startsWith('es')) ?? null;
    } catch { return null; }
  }

  speak(text: string, opts?: { rate?: number; pitch?: number; lang?: string }): void {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
      const vol = this.vol.voice * this.vol.master;
      if (vol <= 0.001 || !text) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const lang = opts?.lang ?? 'es-AR';
      u.lang = lang;
      const v = this.pickVoice(lang);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = Math.max(0.5, Math.min(2, opts?.rate ?? 1));
      u.pitch = Math.max(0, Math.min(2, opts?.pitch ?? 0.85));
      u.volume = Math.max(0, Math.min(1, vol));
      synth.speak(u);
    } catch { /* ignore */ }
  }
}
