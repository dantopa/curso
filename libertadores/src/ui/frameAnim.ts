// Frame-by-frame sprite animation (Mortal-Kombat-3 style). PURE module: no Phaser import, unit tested.
// Asset layout per character:  public/assets/fighters/<id>/anims.json  +  anims/<anim>/<NN>.png
import type { AnimName, AttackPhase, FighterView } from '../combat/types';

export type FaPhase = 'startup' | 'active' | 'recovery' | null;

export interface FrameAnimDef {
  frames: string[];          // paths relative to the fighter folder, e.g. "anims/light/00.png"
  durations: number[];       // ticks (1/60 s) each frame stays on screen
  loop: boolean;
  phases?: FaPhase[];        // per frame; attacks only
  swordTip?: [number, number][]; // per frame, pixel coords inside the frame
}
export interface FrameAnimsFile {
  canvas: [number, number];
  anchor: [number, number];  // ground contact point between the feet
  standHeight: number;       // pixels from feet to head in the standing pose
  anims: Record<string, FrameAnimDef>;
}

export const FRAME_ANIM_NAMES = [
  'idle', 'walk_fwd', 'walk_back', 'crouch', 'jump', 'light', 'heavy', 'crouch_light', 'crouch_heavy', 'air_attack',
  'block', 'crouch_block', 'hit_high', 'hit_body', 'knockdown', 'getup', 'special_cast', 'rush', 'counter', 'throw',
  'turn', 'win', 'dazed', 'dead', 'intro',
] as const;
export type FrameAnimName = (typeof FRAME_ANIM_NAMES)[number];

export const TURN_TICKS = 6;

/** Texture key for a frame: fa_<id>_<anim>_<NN> */
export const frameTexKey = (id: string, anim: string, i: number): string => `fa_${id}_${anim}_${String(i).padStart(2, '0')}`;

/* ---------------------------------------------------------------- validation */
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

export type ValidateResult = { ok: true; data: FrameAnimsFile; warnings: string[] } | { ok: false; errors: string[] };

/** Validates (and lightly normalises) a parsed anims.json. Unknown animation names are kept but warned about. */
export function validateAnimsFile(raw: unknown): ValidateResult {
  const errors: string[] = [], warnings: string[] = [];
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return { ok: false, errors: ['root must be an object'] };
  if (!isPair(r.canvas) || r.canvas[0] <= 0 || r.canvas[1] <= 0) errors.push('canvas must be [w,h] > 0');
  if (!isPair(r.anchor)) errors.push('anchor must be [x,y]');
  if (!isNum(r.standHeight) || r.standHeight <= 0) errors.push('standHeight must be a positive number');
  if (!r.anims || typeof r.anims !== 'object' || Array.isArray(r.anims)) errors.push('anims must be an object');
  if (errors.length) return { ok: false, errors };
  const anims: Record<string, FrameAnimDef> = {};
  for (const [name, d0] of Object.entries(r.anims as Record<string, unknown>)) {
    const d = d0 as Record<string, unknown>;
    const at = (m: string) => errors.push(`anims.${name}: ${m}`);
    if (!(FRAME_ANIM_NAMES as readonly string[]).includes(name)) warnings.push(`anims.${name}: unknown animation name (ignored by the game)`);
    if (!d || typeof d !== 'object') { at('must be an object'); continue; }
    if (!Array.isArray(d.frames) || d.frames.length === 0 || !d.frames.every((s) => typeof s === 'string' && s.length > 0)) { at('frames must be a non-empty string[]'); continue; }
    const n = d.frames.length;
    if (!Array.isArray(d.durations) || d.durations.length !== n || !d.durations.every((x) => isNum(x) && x > 0)) { at(`durations must be ${n} positive numbers`); continue; }
    if (typeof d.loop !== 'boolean') { at('loop must be boolean'); continue; }
    let phases: FaPhase[] | undefined;
    if (d.phases !== undefined) {
      if (!Array.isArray(d.phases) || d.phases.length !== n || !d.phases.every((p) => p === null || p === 'startup' || p === 'active' || p === 'recovery')) { at(`phases must be ${n} of "startup"|"active"|"recovery"|null`); continue; }
      phases = d.phases as FaPhase[];
      if (!phases.includes('active')) warnings.push(`anims.${name}: phases has no "active" frame`);
    }
    let swordTip: [number, number][] | undefined;
    if (d.swordTip !== undefined) {
      if (!Array.isArray(d.swordTip) || d.swordTip.length !== n || !d.swordTip.every(isPair)) { at(`swordTip must be ${n} [x,y] pairs`); continue; }
      swordTip = d.swordTip as [number, number][];
    }
    anims[name] = { frames: d.frames as string[], durations: d.durations as number[], loop: d.loop, phases, swordTip };
  }
  if (errors.length) return { ok: false, errors };
  if (!anims.idle) warnings.push('no "idle" animation (the painted idle.png is used instead)');
  return { ok: true, data: { canvas: r.canvas as [number, number], anchor: r.anchor as [number, number], standHeight: r.standHeight as number, anims }, warnings };
}

/* ------------------------------------------------------- frame index maths */
export const totalTicks = (d: FrameAnimDef): number => { let s = 0; for (const x of d.durations) s += x; return s; };

/** Frame shown `t` ticks after the animation started. Loops wrap, one-shots hold the last frame. */
export function frameByTime(d: FrameAnimDef, t: number, loop = d.loop): number {
  const n = d.frames.length, tot = totalTicks(d);
  if (t < 0) t = 0;
  if (loop) t %= tot; else if (t >= tot) return n - 1;
  let c = 0;
  for (let i = 0; i < n; i++) { c += d.durations[i]; if (t < c) return i; }
  return n - 1;
}

/** Frame shown at progress p (0..1) of the whole animation, weighted by durations. */
export function frameByProgress(d: FrameAnimDef, p: number): number {
  const tot = totalTicks(d);
  const t = Math.min(Math.max(p, 0), 0.999999) * tot;
  let c = 0;
  for (let i = 0; i < d.frames.length; i++) { c += d.durations[i]; if (t < c) return i; }
  return d.frames.length - 1;
}

const NOMINAL: Record<'startup' | 'active' | 'recovery', [number, number]> = { startup: [0, 0.35], active: [0.35, 0.55], recovery: [0.55, 1] };

/**
 * Frame for an attack from the sim's phase. With a `phases` array the frames tagged with the current phase are
 * spread (weighted by their durations) across phaseT 0..1, so frames tagged "active" are on screen exactly while
 * the sim's active hitbox frames run. Without `phases` the whole animation is spread over animT.
 */
export function frameByPhase(d: FrameAnimDef, phase: AttackPhase, phaseT: number, animT = 0): number {
  if (!phase) return frameByProgress(d, animT);
  const ph = d.phases;
  if (!ph) return frameByProgress(d, animT);
  const list: number[] = [];
  for (let i = 0; i < ph.length; i++) if (ph[i] === phase) list.push(i);
  if (list.length === 0) { const [a, b] = NOMINAL[phase]; return frameByProgress(d, a + (b - a) * Math.min(1, Math.max(0, phaseT))); }
  let tot = 0;
  for (const i of list) tot += d.durations[i];
  const t = Math.min(Math.max(phaseT, 0), 0.999999) * tot;
  let c = 0;
  for (const i of list) { c += d.durations[i]; if (t < c) return i; }
  return list[list.length - 1];
}

/* ---------------------------------------------------- AnimName → animation */
/** Candidate animations per game animation, first one that exists wins. Empty/no match → caller falls back (puppet). */
export const ANIM_CHAIN: Record<AnimName, FrameAnimName[]> = {
  idle: ['idle'], intro: ['intro', 'idle'],
  walkF: ['walk_fwd'], walkB: ['walk_back'], dash: ['walk_fwd'], backdash: ['walk_back'], evade: ['walk_back'],
  crouch: ['crouch'], crouchBlock: ['crouch_block', 'crouch', 'block'], block: ['block'], getup: ['getup', 'crouch'],
  jumpUp: ['jump'], jumpDown: ['jump'], aerial: ['air_attack'],
  lightA: ['light', 'heavy'], heavyA: ['heavy', 'light'],
  crouchLight: ['crouch_light', 'light'], crouchHeavy: ['crouch_heavy', 'crouch_light', 'heavy'],
  airLight: ['air_attack', 'light'], airHeavy: ['air_attack', 'heavy'],
  slash: ['light', 'heavy'], rush: ['rush', 'heavy'], throw: ['throw', 'heavy'],
  cast: ['special_cast', 'heavy'], buff: ['special_cast'], counter: ['counter', 'special_cast'],
  hit: ['hit_high', 'hit_body'], launched: ['hit_body', 'hit_high', 'knockdown'], thrown: ['hit_body', 'hit_high', 'knockdown'],
  knockdown: ['knockdown'], dead: ['dead', 'knockdown'], dazed: ['dazed', 'hit_high'], win: ['win'],
};

/** Subset of FighterView that frame selection reads. */
export type FrameView = Pick<FighterView, 'anim' | 'animFrame' | 'animLen' | 'animT' | 'phase' | 'phaseT' | 'vy'> & {
  moveKind?: FighterView['moveKind']; swing?: number; swings?: number;
};

export interface FrameChoice { name: FrameAnimName; index: number; def: FrameAnimDef }

const PHASED: Partial<Record<AnimName, true>> = {
  lightA: true, heavyA: true, crouchLight: true, crouchHeavy: true, airLight: true, airHeavy: true,
  rush: true, throw: true, cast: true, buff: true, aerial: true,
};

/** Which animation plays for this game animation (honouring combo light/heavy alternation). */
export function pickAnimName(anims: Record<string, FrameAnimDef>, v: FrameView): FrameAnimName | null {
  let chain = ANIM_CHAIN[v.anim];
  if (v.anim === 'slash') {
    // combo: light hits then a heavy finisher; every other 'slash' (teleport/counter/evade strike) is one heavy blow
    const heavy = v.moveKind !== 'combo' || (v.swings ?? 1) <= 1 || (v.swing ?? 0) >= (v.swings ?? 1) - 1;
    chain = heavy ? ['heavy', 'light'] : ['light', 'heavy'];
  }
  if (!chain) return null;
  for (const n of chain) if (anims[n]) return n;
  return null;
}

/** Pure frame selection: which animation and which frame index for this view. Null → no frame art, use fallback. */
export function selectFrame(anims: Record<string, FrameAnimDef>, v: FrameView, jumpVel = 17): FrameChoice | null {
  const name = pickAnimName(anims, v);
  if (!name) return null;
  const def = anims[name];
  let index: number;
  if (v.anim === 'jumpUp' || v.anim === 'jumpDown') {
    const p = (v.vy + jumpVel) / (2 * jumpVel); // rising fast → first frame, falling fast → last frame
    index = Math.min(def.frames.length - 1, Math.max(0, Math.floor(Math.min(0.999999, Math.max(0, p)) * def.frames.length)));
  } else if (PHASED[v.anim] && v.phase) {
    index = frameByPhase(def, v.phase, v.phaseT, v.animT);
  } else if (v.anim === 'intro' && name === 'intro') {
    index = frameByProgress(def, v.animT);
  } else {
    index = frameByTime(def, v.animFrame);
  }
  return { name, index, def };
}
