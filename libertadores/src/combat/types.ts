// Shared types for the whole game. Gameplay logic (src/combat, src/ai, src/data) is pure TS
// with no Phaser dependency; rendering modules only read these types.

export const GAME_W = 1280;
export const GAME_H = 720;
export const ARENA = { left: 70, right: 1210, ground: 610 } as const;

export type Facing = 1 | -1;
export type Difficulty = 'novice' | 'fighter' | 'veteran' | 'legend';

/* ------------------------------------------------------------------ input */
export interface Buttons {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
  block: boolean;
  throw: boolean;
  fatality: boolean;
}
export const BUTTON_KEYS: (keyof Buttons)[] = [
  'left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'block', 'throw', 'fatality',
];
export const emptyButtons = (): Buttons => ({
  left: false, right: false, up: false, down: false,
  light: false, heavy: false, special: false, block: false, throw: false, fatality: false,
});
/** held = currently down; pressed = rising edge on this frame */
export interface InputFrame { held: Buttons; pressed: Buttons }
export const emptyInput = (): InputFrame => ({ held: emptyButtons(), pressed: emptyButtons() });
export function makeInputFrame(prev: Buttons, held: Buttons): InputFrame {
  const pressed = emptyButtons();
  for (const k of BUTTON_KEYS) pressed[k] = held[k] && !prev[k];
  return { held: { ...held }, pressed };
}

/* ------------------------------------------------------------- animations */
/** Animation names understood by the procedural fighter renderer. */
export type AnimName =
  | 'idle' | 'walkF' | 'walkB' | 'crouch' | 'jumpUp' | 'jumpDown' | 'dash' | 'backdash'
  | 'lightA' | 'heavyA' | 'crouchLight' | 'crouchHeavy' | 'airLight' | 'airHeavy'
  | 'block' | 'crouchBlock' | 'hit' | 'launched' | 'knockdown' | 'getup'
  | 'throw' | 'thrown' | 'cast' | 'rush' | 'slash' | 'counter' | 'evade' | 'aerial'
  | 'intro' | 'win' | 'dazed' | 'dead' | 'buff';

export type AttackPhase = 'startup' | 'active' | 'recovery' | null;

/** Everything the renderer needs to draw a fighter. FighterState implements this. */
export interface FighterView {
  x: number;            // horizontal center
  y: number;            // feet position (ARENA.ground when standing)
  facing: Facing;
  anim: AnimName;
  animFrame: number;    // frames since anim started
  animLen: number;      // expected length in frames (0 = looping/unknown)
  animT: number;        // 0..1 progress through the whole animation (0 when unknown)
  phase: AttackPhase;   // attack phase when attacking
  phaseT: number;       // 0..1 progress inside the current phase
  clock: number;        // global frame counter (for idle bob / walk cycle)
  char: CharacterDef;
  hitFlash: number;     // >0 means just got hit (flash white)
  hidden: boolean;      // true while teleporting
  buffs: BuffType[];    // active buffs (renderer draws aura)
  vx: number;
  vy: number;
  /** kind of the special being performed (null/undefined otherwise); lets frame-animated art pick the right clip */
  moveKind?: SpecialKind | null;
  /** combo specials: index of the current swing and total swings */
  swing?: number;
  swings?: number;
}

/* -------------------------------------------------------------- characters */
export type WeaponKind =
  | 'sabre' | 'curvedSabre' | 'sword' | 'spear' | 'lasso' | 'facon'
  | 'pistolSword' | 'sling' | 'pen' | 'ceremonial' | 'club' | 'fists';
export type HeadgearKind =
  | 'none' | 'bicorne' | 'shako' | 'kepi' | 'llautu' | 'feathers' | 'gauchoHat'
  | 'sombrero' | 'bandana' | 'crown' | 'tricorn' | 'headband' | 'turban' | 'inkaCrown';
export type HairStyle = 'short' | 'long' | 'bald' | 'braids' | 'curly' | 'slicked' | 'bun';
export type FacialHair = 'none' | 'moustache' | 'beard' | 'goatee' | 'sideburns' | 'fullBeard';
export type CapeKind = 'none' | 'cape' | 'poncho' | 'sash' | 'banner' | 'unku';
export type BuildKind = 'slim' | 'normal' | 'heavy';

export interface Palette {
  skin: number; hair: number; primary: number; secondary: number;
  accent: number; trim: number; boots: number; aura: number;
}
export interface CharArt {
  palette: Palette;
  headgear: HeadgearKind;
  hair: HairStyle;
  facial: FacialHair;
  cape: CapeKind;
  weapon: WeaponKind;
  build: BuildKind;
  height: number;       // 0.9 .. 1.1 scale
  female?: boolean;
  /** extra decor: epaulettes, medals, feathers on arms, etc. */
  decor?: ('epaulettes' | 'medals' | 'sash' | 'armor' | 'warpaint' | 'feathers' | 'scarf' | 'spurs')[];
}

export interface CharStats {
  health: number;       // max HP (around 1000)
  walkSpeed: number;    // px/frame forward
  backSpeed: number;
  dashSpeed: number;
  attack: number;       // damage multiplier (1.0 baseline)
  defense: number;      // damage divisor (1.0 baseline)
  jumpVel: number;      // initial upward velocity (positive number, ~17)
  gravity: number;      // ~0.85
  meterGain: number;    // multiplier on meter gain
}

export type AIStyle = {
  aggression: number;   // 0..1 how often it pressures
  zoning: number;       // 0..1 prefers distance + projectiles
  grappling: number;    // 0..1 throws / close range
  defense: number;      // 0..1 blocks / counters
  ambush: number;       // 0..1 teleports / dashes / mix ups
  preferredRange: number; // px
};

export type BuffType = 'range' | 'damage' | 'defense' | 'shield' | 'speed';
export type ProjVis =
  | 'wave' | 'bolt' | 'fire' | 'letters' | 'feather' | 'stone' | 'bullet' | 'sun' | 'sound'
  | 'lasso' | 'chain' | 'soldier' | 'rider' | 'warrior' | 'condor' | 'gaucho' | 'snow'
  | 'eagle' | 'wall' | 'trap' | 'beam' | 'flag' | 'spear' | 'dust' | 'bell' | 'shock'
  | 'serpent' | 'tiger' | 'fist' | 'crown' | 'cannon';
export type GhostVis = 'cavalry' | 'condor' | 'spear' | 'fire' | 'gaucho' | 'tiger' | 'wind' | 'sun' | 'infantry' | 'none';
export type HitEffect = 'none' | 'stun' | 'root' | 'pull' | 'launch';

export interface ProjSpec {
  vis: ProjVis;
  color: number;
  color2?: number;
  speed: number;           // px/frame (0 = static trap/barrier)
  w: number; h: number;    // hitbox size
  yOff: number;            // height of center above the feet (px)
  count: number;
  stagger: number;         // frames between projectiles when count>1
  yStep: number;           // vertical offset between projectiles (spread)
  life: number;            // frames
  pierce: boolean;
  effect: HitEffect;
  gravity: number;
  spawn: 'front' | 'sky' | 'oppGround' | 'behind';
  blocksProj?: boolean;    // barrier destroys enemy projectiles
  hitstun?: number;
  launch?: number;         // upward velocity on hit (negative = up)
  knockback?: number;
  hits?: number;           // multi-hit (re-hits every 8 frames while overlapping)
}

export type SpecialKind = 'proj' | 'rush' | 'combo' | 'buff' | 'counter' | 'teleport' | 'aerial' | 'evade';
export interface SpecialDef {
  id: string;
  name: string;
  desc: string;
  kind: SpecialKind;
  startup: number;
  recovery: number;
  cooldown: number;
  damage: number;
  proj?: ProjSpec;
  rush?: { speed: number; duration: number; vis: GhostVis; color: number; launch: boolean; reach: number };
  combo?: { hits: number; interval: number; step: number; launchFinisher: boolean; reach: number; color: number };
  buff?: { type: BuffType; duration: number; amount: number; color: number };
  counter?: { window: number; launch: boolean; color: number };
  teleport?: { behind: boolean; color: number; reach: number };
  aerial?: { vx: number; vy: number; dive: boolean; reach: number; color: number };
  evade?: { dir: 1 | -1; speed: number; frames: number; strike: boolean; color: number };
  /** frames of invulnerability at the start (reversals/ultimates) */
  invuln?: number;
}

export type FatalityFx =
  | 'army' | 'cavalry' | 'blizzard' | 'condor' | 'bell' | 'fist' | 'throne' | 'map'
  | 'serpent' | 'tiger' | 'balance' | 'letters' | 'wall' | 'citadel' | 'sun' | 'storm'
  | 'revolution' | 'acrobat' | 'lasso' | 'eagle' | 'oath' | 'lightning' | 'tide' | 'volley';
export type FatInput = 'F' | 'B' | 'U' | 'D';
export interface FatalityDef {
  name: string;
  desc: string;
  input: FatInput[];       // direction sequence, then Fatality button
  fx: FatalityFx;
  color1: number;
  color2: number;
  duration: number;        // frames (~360)
  quote: string;           // line shown during cinematic
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  archetype: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  bio: string;
  art: CharArt;
  stats: CharStats;
  /** normal-move tuning: reach multipliers and damage/startup tweaks */
  normals: {
    lightReach: number; heavyReach: number;
    lightDmg: number; heavyDmg: number;
    lightStartup: number; heavyStartup: number;
  };
  /** four specials: slot 0 = Special, 1 = →+Special, 2 = ↓+Special, 3 = ↑+Special */
  specials: [SpecialDef, SpecialDef, SpecialDef, SpecialDef];
  ultimateSlot: number;    // which special is boosted for the Ultimate (meter 100 + Fatality button in-match)
  fatality: FatalityDef;
  secondary: FatalityDef;  // unlockable
  ai: AIStyle;
}

/* ------------------------------------------------------------------ stages */
export type StageKind =
  | 'llanos' | 'andes' | 'tiwanaku' | 'citadel' | 'battlefield' | 'jungle' | 'plaza' | 'pampa' | 'dimension';
export type Ambience = 'rain' | 'snow' | 'embers' | 'dust' | 'ash' | 'fireflies' | 'none';
export interface StageDef {
  id: string;
  name: string;
  desc: string;
  kind: StageKind;
  sky: [number, number];      // top, bottom gradient
  ground: number;
  fog: number;
  accent: number;
  ambience: Ambience;
}

/* --------------------------------------------------------------- sim events */
export type SimEvent =
  | { type: 'hit'; x: number; y: number; strength: 'light' | 'heavy' | 'special'; by: 0 | 1; color?: number }
  | { type: 'block'; x: number; y: number; by: 0 | 1 }
  | { type: 'whoosh'; by: 0 | 1; heavy: boolean }
  | { type: 'special'; by: 0 | 1; slot: number; ex: boolean; color: number }
  | { type: 'projectile'; by: 0 | 1; vis: ProjVis; color: number }
  | { type: 'launch'; x: number; y: number }
  | { type: 'throw'; x: number; y: number; by: 0 | 1 }
  | { type: 'buff'; by: 0 | 1; color: number }
  | { type: 'teleport'; by: 0 | 1; color: number }
  | { type: 'clash'; x: number; y: number }
  | { type: 'shield'; x: number; y: number; by: 0 | 1 }
  | { type: 'counter'; x: number; y: number; by: 0 | 1; color: number }
  | { type: 'ultimate'; by: 0 | 1; color: number }
  | { type: 'land'; x: number; y: number }
  | { type: 'roundStart'; round: number }
  | { type: 'fight' }
  | { type: 'ko'; loser: 0 | 1 }
  | { type: 'timeout' }
  | { type: 'roundEnd'; winner: 0 | 1 | null }
  | { type: 'matchEnd'; winner: 0 | 1; ko: boolean }
  | { type: 'finishWindow'; winner: 0 | 1 }
  | { type: 'fatalityFail' }
  | { type: 'fatality'; winner: 0 | 1; secondary: boolean }
  | { type: 'timerWarn' };
