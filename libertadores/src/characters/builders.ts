import type {
  AIStyle, BuffType, CharacterDef, CharArt, CharStats, FatalityDef, FatalityFx, FatInput,
  GhostVis, Palette, ProjSpec, SpecialDef,
} from '../combat/types';

export const pal = (
  skin: number, hair: number, primary: number, secondary: number,
  accent: number, trim: number, boots: number, aura: number,
): Palette => ({ skin, hair, primary, secondary, accent, trim, boots, aura });

const PROJ_DEFAULT: ProjSpec = {
  vis: 'bolt', color: 0xffd24a, speed: 11, w: 60, h: 44, yOff: 95, count: 1, stagger: 0, yStep: 0,
  life: 90, pierce: false, effect: 'none', gravity: 0, spawn: 'front',
};

type Timing = { startup?: number; recovery?: number; cooldown?: number; invuln?: number };
let counter = 0;
const sid = (n: string) => `${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${counter++}`;

/** Projectile / summon / trap / barrier special. */
export function P(name: string, desc: string, damage: number, proj: Partial<ProjSpec>, t: Timing = {}): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'proj', damage,
    startup: t.startup ?? 14, recovery: t.recovery ?? 24, cooldown: t.cooldown ?? 22, invuln: t.invuln,
    proj: { ...PROJ_DEFAULT, ...proj },
  };
}
/** Forward rush with a hitbox (cavalry charges, sword rushes). */
export function R(
  name: string, desc: string, damage: number,
  rush: { speed?: number; duration?: number; vis?: GhostVis; color?: number; launch?: boolean; reach?: number },
  t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'rush', damage,
    startup: t.startup ?? 12, recovery: t.recovery ?? 26, cooldown: t.cooldown ?? 36, invuln: t.invuln,
    rush: { speed: 12, duration: 22, vis: 'none', color: 0xffd24a, launch: false, reach: 80, ...rush },
  };
}
/** Multi-hit combo special (damage is per hit). */
export function C(
  name: string, desc: string, damage: number,
  combo: { hits?: number; interval?: number; step?: number; launchFinisher?: boolean; reach?: number; color?: number },
  t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'combo', damage,
    startup: t.startup ?? 8, recovery: t.recovery ?? 22, cooldown: t.cooldown ?? 30, invuln: t.invuln,
    combo: { hits: 3, interval: 9, step: 12, launchFinisher: true, reach: 85, color: 0xffffff, ...combo },
  };
}
/** Temporary buff (range, damage, defense, shield, speed). */
export function B(
  name: string, desc: string, type: BuffType, amount: number, duration: number, color: number, t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'buff', damage: 0,
    startup: t.startup ?? 14, recovery: t.recovery ?? 14, cooldown: t.cooldown ?? 420,
    buff: { type, amount, duration, color },
  };
}
/** Counter stance: absorbs one hit and strikes back. */
export function K(
  name: string, desc: string, damage: number, counter: { window?: number; launch?: boolean; color?: number }, t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'counter', damage,
    startup: t.startup ?? 4, recovery: t.recovery ?? 30, cooldown: t.cooldown ?? 70,
    counter: { window: 32, launch: true, color: 0xffffff, ...counter },
  };
}
/** Teleport then strike. */
export function T(
  name: string, desc: string, damage: number, teleport: { behind?: boolean; color?: number; reach?: number }, t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'teleport', damage,
    startup: t.startup ?? 12, recovery: t.recovery ?? 22, cooldown: t.cooldown ?? 60,
    teleport: { behind: true, color: 0xffffff, reach: 90, ...teleport },
  };
}
/** Jumping attack (rises, then dives). */
export function A(
  name: string, desc: string, damage: number,
  aerial: { vx?: number; vy?: number; dive?: boolean; reach?: number; color?: number }, t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'aerial', damage,
    startup: t.startup ?? 7, recovery: t.recovery ?? 14, cooldown: t.cooldown ?? 34,
    aerial: { vx: 7, vy: 18, dive: true, reach: 80, color: 0xffffff, ...aerial },
  };
}
/** Evasive maneuver with invulnerability, optionally ending in a strike. */
export function E(
  name: string, desc: string, damage: number,
  evade: { dir?: 1 | -1; speed?: number; frames?: number; strike?: boolean; color?: number }, t: Timing = {},
): SpecialDef {
  return {
    id: sid(name), name, desc, kind: 'evade', damage,
    startup: t.startup ?? 3, recovery: t.recovery ?? 10, cooldown: t.cooldown ?? 60,
    evade: { dir: -1, speed: 12, frames: 18, strike: false, color: 0xffffff, ...evade },
  };
}

export function fat(
  name: string, desc: string, input: string, fx: FatalityFx, color1: number, color2: number, quote: string, duration = 420,
): FatalityDef {
  return { name, desc, input: input.split('') as FatInput[], fx, color1, color2, duration, quote };
}

export interface CharInput {
  id: string; name: string; title: string; archetype: string;
  difficulty: CharacterDef['difficulty']; bio: string;
  art: Omit<CharArt, 'palette'> & { palette: Palette };
  stats?: Partial<CharStats>;
  normals?: Partial<CharacterDef['normals']>;
  specials: [SpecialDef, SpecialDef, SpecialDef, SpecialDef];
  ultimateSlot?: number;
  fatality: FatalityDef; secondary: FatalityDef;
  ai: Partial<AIStyle>;
}

const BASE_STATS: CharStats = {
  health: 1000, walkSpeed: 4.2, backSpeed: 3.2, dashSpeed: 11, attack: 1, defense: 1,
  jumpVel: 17.5, gravity: 0.85, meterGain: 1,
};
const BASE_NORMALS = { lightReach: 74, heavyReach: 92, lightDmg: 1, heavyDmg: 1, lightStartup: 5, heavyStartup: 11 };
const BASE_AI: AIStyle = { aggression: 0.5, zoning: 0.3, grappling: 0.2, defense: 0.4, ambush: 0.2, preferredRange: 150 };

export function makeCharacter(c: CharInput): CharacterDef {
  return {
    id: c.id, name: c.name, title: c.title, archetype: c.archetype, difficulty: c.difficulty, bio: c.bio,
    art: c.art,
    stats: { ...BASE_STATS, ...c.stats },
    normals: { ...BASE_NORMALS, ...c.normals },
    specials: c.specials,
    ultimateSlot: c.ultimateSlot ?? 1,
    fatality: c.fatality,
    secondary: c.secondary,
    ai: { ...BASE_AI, ...c.ai },
  };
}
