import type Phaser from 'phaser';
import type { FatalityFx, AnimName } from '../combat/types';
import {
  FxCtx, ActorPose, makePh, seg, lerp, easeOut, easeIO, hash, mix, rect, glow, ring, embers, circ,
} from './lib';
import { LAYERS_A, fistLift } from './fx_a';
import { LAYERS_B, acroState, lassoDrag } from './fx_b';

export type { FxCtx, ActorPose };
type G = Phaser.GameObjects.Graphics;

const LAYERS = { ...LAYERS_A, ...LAYERS_B };

/* ---------------------------------------------------------------- actors */
const WIN_PRE: Partial<Record<FatalityFx, AnimName>> = {
  army: 'rush', cavalry: 'buff', blizzard: 'buff', fist: 'buff', sun: 'buff', storm: 'buff',
  acrobat: 'evade', lasso: 'throw', volley: 'buff', tiger: 'rush', revolution: 'buff',
};
const WIN_MAIN: Partial<Record<FatalityFx, AnimName>> = {
  army: 'rush', sun: 'slash', tiger: 'rush', lasso: 'throw', acrobat: 'aerial', fist: 'buff', volley: 'buff',
  revolution: 'buff', cavalry: 'buff', blizzard: 'buff',
};

export function getFatalityActors(fx: FatalityFx, t: number, ctx: FxCtx): { winner: ActorPose; loser: ActorPose } {
  const dist = ctx.loserX - ctx.winnerX;
  const dissolve = seg(t, 0.76, 0.98);
  const climax = seg(t, 0.7, 0.85);

  /* loser */
  let anim: AnimName = t < 0.5 ? 'dazed' : t < 0.7 ? 'hit' : t < 0.85 ? 'launched' : 'knockdown';
  let ldx = 0, ldy = -Math.sin(climax * Math.PI) * 38 * (t < 0.85 ? 1 : 0);
  let shake = (t > 0.15 && t < 0.7 ? 3 + 3 * seg(t, 0.15, 0.7) : 0) + (t >= 0.7 && t < 0.85 ? 12 * (1 - climax) : 0);
  if (fx === 'fist') { ldy = -fistLift({ t } as never) ; if (t > 0.2) anim = t < 0.7 ? 'launched' : anim; shake *= 0.5; }
  if (fx === 'citadel') { ldy = -430 * easeOut(seg(t, 0.55, 0.78)) * (1 - 0) ; if (t > 0.55 && t < 0.85) anim = 'launched'; }
  if (fx === 'lasso') { ldx = lassoDrag(t, ctx); if (t > 0.32 && t < 0.7) anim = 'thrown'; }
  if (fx === 'map' || fx === 'balance' || fx === 'oath') { ldy = -Math.sin(seg(t, 0.4, 0.78) * Math.PI * 0.5) * 50 * (t < 0.8 ? 1 : 0); if (t > 0.45 && t < 0.85) anim = 'launched'; }
  if (fx === 'wall' || fx === 'throne') anim = t < 0.68 ? 'dazed' : t < 0.85 ? 'launched' : 'knockdown';
  if (fx === 'serpent') { ldy = -Math.sin(seg(t, 0.3, 0.7) * Math.PI * 0.5) * 40; if (t > 0.45 && t < 0.85) anim = 'launched'; }
  const loser: ActorPose = {
    dx: ldx, dy: ldy, anim, alpha: 1 - 0.93 * dissolve, dissolve, shake,
    scale: 1, hidden: dissolve >= 0.999,
  };

  /* winner */
  let wanim: AnimName = t < 0.15 ? (WIN_PRE[fx] ?? 'cast') : t < 0.85 ? (WIN_MAIN[fx] ?? 'cast') : 'win';
  let wdx = 0, wdy = 0, walpha = 1, flip: boolean | undefined;
  if (fx === 'army') {
    wdx = ctx.facing * Math.max(0, Math.abs(dist) - 110) * easeIO(seg(t, 0.3, 0.55)) * (1 - easeIO(seg(t, 0.76, 0.92)));
    if (t >= 0.55 && t < 0.85) wanim = 'slash';
  } else if (fx === 'acrobat') {
    const s = acroState(t, ctx);
    wdx = s.dx; wdy = s.dy;
    if (t < 0.15) wanim = 'buff';
    const side = s.side;
    if (t >= 0.15 && t < 0.88) { flip = -side !== ctx.facing; wanim = s.hopU > 0.5 ? 'slash' : 'aerial'; } else flip = false;
    if (t >= 0.7 && t < 0.85) wanim = 'slash';
  } else if (fx === 'storm') {
    const gone = Math.min(seg(t, 0.12, 0.2), 1 - seg(t, 0.6, 0.68));
    walpha = 1 - gone;
    wanim = t < 0.12 ? 'buff' : t < 0.85 ? 'cast' : 'win';
  } else if (fx === 'tiger') {
    const g = Math.min(seg(t, 0.15, 0.3), 1 - seg(t, 0.66, 0.78));
    walpha = 1 - 0.55 * g;
    wdx = ctx.facing * Math.max(0, Math.abs(dist) - 220) * easeIO(seg(t, 0.2, 0.62)) * (1 - easeIO(seg(t, 0.74, 0.9)));
  } else if (fx === 'sun') {
    if (t >= 0.15 && t < 0.35) wanim = 'slash';
    else if (t >= 0.35 && t < 0.85) wanim = 'buff';
  } else if (fx === 'lasso') {
    if (t >= 0.5 && t < 0.85) wanim = 'buff';
  } else if (fx === 'letters') {
    wanim = t < 0.7 ? 'cast' : t < 0.85 ? 'buff' : 'win';
  }
  const wshake = t >= 0.7 && t < 0.78 ? 3 : 0;
  const winner: ActorPose = {
    dx: wdx, dy: wdy, anim: wanim, alpha: walpha, dissolve: 0, shake: wshake, flip, scale: 1,
    hidden: walpha <= 0.02,
  };
  return { winner, loser };
}

/* ----------------------------------------------------------------- draw */
export function drawFatalityBack(g: G, fx: FatalityFx, t: number, ctx: FxCtx): void {
  const p = makePh(t);
  rect(g, 0, 0, ctx.w, ctx.h, 0x04030a, 0.42 * p.env);
  LAYERS[fx]?.back?.(g, p, ctx);
}

export function drawFatalityFront(g: G, fx: FatalityFx, t: number, ctx: FxCtx): void {
  const p = makePh(t);
  LAYERS[fx]?.front?.(g, p, ctx);

  const { loser } = getFatalityActors(fx, t, ctx);
  const lx = ctx.loserX + loser.dx, ly = ctx.groundY - 90 + loser.dy;
  const col = mix(ctx.c1, ctx.c2, 0.4);

  // generic climax shockwave
  const c = seg(t, 0.7, 0.88);
  if (c > 0 && c < 1) {
    glow(g, lx, ly, 50 + easeOut(c) * 260, col, 0.55 * (1 - c));
    ring(g, lx, ly, easeOut(c) * 460, 10 * (1 - c) + 2, mix(col, 0xffffff, 0.6), (1 - c) * 0.9);
    ring(g, lx, ctx.groundY + 6, easeOut(c) * 700, 6 * (1 - c) + 1, col, (1 - c) * 0.7, 0.2);
  }

  // dissolving loser: embers, ash and light motes
  const dk = seg(t, 0.76, 1.0);
  if (dk > 0) {
    const fade = 1 - seg(t, 0.93, 1) * 0.8;
    embers(g, ctx.seed + 31, dk, 70, lx, ly + 10, 110, 190, 300, mix(ctx.c1, 0xffa030, 0.5), fade, 3);
    embers(g, ctx.seed + 32, dk, 40, lx, ly + 20, 130, 200, 220, 0xffffff, fade * 0.8, 2);
    for (let i = 0; i < 30; i++) { // grey ash drifting
      const life = Math.min(1, dk * 1.3 - hash(ctx.seed, i, 301) * 0.3);
      if (life <= 0) continue;
      const ax = lx + (hash(ctx.seed, i, 302) - 0.5) * 120 + life * 60 * (hash(ctx.seed, i, 303) - 0.3);
      const ay = ly + (hash(ctx.seed, i, 304) - 0.3) * 160 - life * 140;
      circ(g, ax, ay, 2 + hash(ctx.seed, i, 305) * 3, 0x9a9490, 0.5 * (1 - life) * fade);
    }
    glow(g, lx, ly, 100 * (1 - dk * 0.7), mix(ctx.c1, 0xffffff, 0.5), 0.35 * (1 - dk));
  }

  // vignette
  const v = 0.55 * p.env;
  for (let i = 0; i < 6; i++) {
    const s = (1 - i / 6) * 150, a = v * 0.1 * (1 + i * 0.3);
    rect(g, 0, 0, s, ctx.h, 0x000000, a); rect(g, ctx.w - s, 0, s, ctx.h, 0x000000, a);
    rect(g, 0, 0, ctx.w, s * 0.6, 0x000000, a); rect(g, 0, ctx.h - s * 0.6, ctx.w, s * 0.6, 0x000000, a);
  }

  // white flash at the climax
  const fl = Math.max(0, 1 - Math.abs(t - 0.735) / 0.045) * 0.9 + (t > 0.735 ? 0.22 * (1 - seg(t, 0.735, 0.9)) : 0);
  if (fl > 0.01) rect(g, 0, 0, ctx.w, ctx.h, 0xffffff, Math.min(1, fl));
  void lerp;
}

/* ----------------------------------------------------------------- beats */
type Sfx = 'whoosh' | 'boom' | 'bell' | 'special' | 'ultimate' | 'thud' | 'launch' | 'teleport';
export function fatalityBeats(fx: FatalityFx): { t: number; sfx: Sfx }[] {
  const b: { t: number; sfx: Sfx }[] = [{ t: 0.02, sfx: 'special' }, { t: 0.13, sfx: 'whoosh' }];
  const add = (t: number, sfx: Sfx) => b.push({ t, sfx });
  switch (fx) {
    case 'bell': for (let i = 0; i < 5; i++) add(0.27 + i * 0.1, 'bell'); break;
    case 'cavalry': case 'blizzard': case 'lasso': case 'storm': case 'tide': case 'revolution': add(0.3, 'whoosh'); add(0.5, 'whoosh'); break;
    case 'fist': case 'citadel': add(0.3, 'launch'); add(0.5, 'thud'); break;
    case 'wall': add(0.2, 'thud'); add(0.4, 'thud'); add(0.55, 'thud'); break;
    case 'acrobat': for (let i = 1; i <= 6; i++) add(0.15 + (i / 6) * 0.55 - 0.035, 'whoosh'); break;
    case 'lightning': for (let i = 0; i < 7; i++) add(0.2 + i * 0.07, 'boom'); break;
    case 'volley': for (let i = 0; i < 6; i++) add(0.3 + i * 0.06, 'thud'); break;
    case 'condor': case 'eagle': add(0.3, 'whoosh'); add(0.5, 'whoosh'); break;
    case 'map': case 'letters': case 'oath': case 'balance': add(0.3, 'special'); add(0.55, 'whoosh'); break;
    case 'storm': add(0.1, 'teleport'); break;
    default: add(0.35, 'whoosh'); add(0.55, 'special');
  }
  if (fx === 'storm') add(0.1, 'teleport');
  add(0.72, 'boom'); add(0.74, 'ultimate'); add(0.9, 'thud');
  return b.sort((x, y) => x.t - y.t);
}
