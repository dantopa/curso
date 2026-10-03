import {
  ARENA, type AnimName, type BuffType, type CharacterDef, type Facing, type FatInput, type FighterView,
  type AttackPhase, type ProjVis, type SpecialDef,
} from './types';
import type { AttackData, HitSpec } from './moves';

export type FState =
  | 'idle' | 'walk' | 'crouch' | 'jump' | 'dash' | 'block' | 'attack' | 'special'
  | 'hit' | 'launched' | 'knockdown' | 'getup' | 'intro' | 'win' | 'dazed' | 'dead';

export interface Buff { type: BuffType; frames: number; amount: number; color: number; hits: number }

export interface Strike {
  key: number;
  reach: number;
  yOff: number;
  height: number;
  spec: HitSpec;
  onConnect?: () => void;
}

export interface ActiveAttack { data: AttackData; frame: number; connected: boolean; chainIdx: number }

export interface ActiveSpecial {
  def: SpecialDef;
  slot: number;
  frame: number;
  ex: boolean;
  ult: boolean;
  dmgMul: number;
  stage: string;        // kind-specific sub-stage
  stageFrame: number;
  connected: boolean;
  keysDone: Set<number>;
  spawned: boolean;
  total: number;        // total duration (frames); may be extended by connect
}

export interface Projectile {
  id: number;
  owner: 0 | 1;
  x: number; y: number; vx: number; vy: number;
  w: number; h: number;
  vis: ProjVis; color: number; color2: number;
  dir: Facing;
  age: number; life: number; delay: number;
  spawnIdx: number;
  spawnKind: 'front' | 'sky' | 'oppGround' | 'behind';
  spec: HitSpec;
  speed: number;
  pierce: boolean;
  gravity: number;
  blocksProj: boolean;
  hitsLeft: number;
  rehit: number;
  dead: boolean;
  isStatic: boolean;
  hitSet: Set<number>;
}

export interface Fighter extends FighterView {
  idx: 0 | 1;
  hp: number;
  maxHp: number;
  meter: number;
  state: FState;
  sf: number;                 // frames in current state
  grounded: boolean;
  crouching: boolean;
  atk: ActiveAttack | null;
  sp: ActiveSpecial | null;
  hitstun: number;
  blockstun: number;
  kd: number;                 // knockdown timer
  invuln: number;
  lag: number;                // landing lag / recovery lock
  comboHits: number;          // hits received in current combo
  juggles: number;
  activeBuffs: Buff[];
  cooldowns: [number, number, number, number];
  airUsed: boolean;
  tapDir: number;             // last tapped direction (-1 / 1 / 0)
  tapFrame: number;
  dashT: number;
  fatHist: { d: FatInput; f: number }[];
  dead: boolean;
  stunned: number;            // 'stun'/'root' effect frames
  rooted: boolean;
  chain: number;
  chainTimer: number;
  stats: CharacterDef['stats'];
}

export function createFighter(idx: 0 | 1, char: CharacterDef, x: number, facing: Facing): Fighter {
  return {
    idx, char, stats: char.stats,
    x, y: ARENA.ground, vx: 0, vy: 0, facing,
    anim: 'idle' as AnimName, animFrame: 0, animLen: 0, animT: 0,
    phase: null as AttackPhase, phaseT: 0, clock: 0, hitFlash: 0, hidden: false, buffs: [],
    hp: char.stats.health, maxHp: char.stats.health, meter: 0,
    state: 'idle', sf: 0, grounded: true, crouching: false,
    atk: null, sp: null,
    hitstun: 0, blockstun: 0, kd: 0, invuln: 0, lag: 0,
    comboHits: 0, juggles: 0, activeBuffs: [], cooldowns: [0, 0, 0, 0], airUsed: false,
    tapDir: 0, tapFrame: -99, dashT: 0, fatHist: [], dead: false, stunned: 0, rooted: false,
    chain: 0, chainTimer: 0,
  };
}

export function buffAmount(f: Fighter, type: BuffType): number {
  let a = 0;
  for (const b of f.activeBuffs) if (b.type === type) a += b.amount;
  return a;
}
