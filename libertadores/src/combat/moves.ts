import type { AnimName, CharacterDef } from './types';

export type CancelBtn = 'light' | 'heavy' | 'special';
export type NormalKind =
  | 'light' | 'heavy' | 'crouchLight' | 'crouchHeavy' | 'airLight' | 'airHeavy' | 'throw';
export type HitLevel = 'mid' | 'low' | 'overhead';

/** Data for one hit (normal attacks, special strikes, projectiles). */
export interface HitSpec {
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  launch: number;        // negative = up. 0 = none
  level: HitLevel;
  hitstop: number;
  meter: number;
  strength: 'light' | 'heavy' | 'special';
  kdown: boolean;        // knocks down (low launch)
  unblockable: boolean;
  chip: number;          // fraction of damage dealt through block
  effect: 'none' | 'stun' | 'root' | 'pull';
  isThrow?: boolean;
  isProjectile?: boolean;
  color?: number;
}

export interface AttackData extends HitSpec {
  id: NormalKind;
  anim: AnimName;
  startup: number;
  active: number;
  recovery: number;
  reach: number;
  yOff: number;          // bottom of hitbox above feet
  height: number;
  cancels: CancelBtn[];
  air: boolean;
}

const base = (o: Partial<AttackData> & Pick<AttackData, 'id' | 'anim' | 'startup' | 'active' | 'recovery' | 'damage' | 'reach'>): AttackData => ({
  hitstun: 16, blockstun: 11, knockback: 4, launch: 0, level: 'mid', hitstop: 6, meter: 6,
  strength: 'light', kdown: false, unblockable: false, chip: 0, effect: 'none',
  yOff: 50, height: 50, cancels: [], air: false,
  ...o,
});

/** Builds the (data-driven) normal attack for a character. */
export function normalAttack(c: CharacterDef, kind: NormalKind): AttackData {
  const n = c.normals;
  switch (kind) {
    case 'light':
      return base({ id: kind, anim: 'lightA', startup: n.lightStartup, active: 3, recovery: 8, damage: 28 * n.lightDmg, reach: n.lightReach,
        hitstun: 15, blockstun: 10, knockback: 3.5, yOff: 60, height: 44, hitstop: 5, meter: 6, cancels: ['light', 'heavy', 'special'] });
    case 'heavy':
      return base({ id: kind, anim: 'heavyA', startup: n.heavyStartup, active: 4, recovery: 17, damage: 62 * n.heavyDmg, reach: n.heavyReach,
        hitstun: 24, blockstun: 15, knockback: 9, yOff: 45, height: 70, hitstop: 9, meter: 10, strength: 'heavy', cancels: ['special'] });
    case 'crouchLight':
      return base({ id: kind, anim: 'crouchLight', startup: n.lightStartup + 1, active: 3, recovery: 9, damage: 24 * n.lightDmg, reach: n.lightReach * 0.9,
        level: 'low', hitstun: 14, blockstun: 10, knockback: 2.5, yOff: 0, height: 28, hitstop: 5, meter: 5, cancels: ['light', 'special'] });
    case 'crouchHeavy':
      return base({ id: kind, anim: 'crouchHeavy', startup: n.heavyStartup + 1, active: 4, recovery: 20, damage: 50 * n.heavyDmg, reach: n.lightReach + 6,
        hitstun: 26, blockstun: 14, knockback: 3, launch: -15.5, yOff: 20, height: 100, hitstop: 9, meter: 9, strength: 'heavy', cancels: ['special'] });
    case 'airLight':
      return base({ id: kind, anim: 'airLight', startup: 4, active: 9, recovery: 4, damage: 26 * n.lightDmg, reach: n.lightReach * 0.9,
        level: 'overhead', hitstun: 15, blockstun: 12, knockback: 4, yOff: 15, height: 70, hitstop: 5, meter: 6, air: true });
    case 'airHeavy':
      return base({ id: kind, anim: 'airHeavy', startup: 9, active: 8, recovery: 4, damage: 52 * n.heavyDmg, reach: n.heavyReach * 0.9,
        level: 'overhead', hitstun: 22, blockstun: 14, knockback: 8, kdown: true, yOff: 10, height: 80, hitstop: 9, meter: 9, strength: 'heavy', air: true });
    case 'throw':
      return base({ id: kind, anim: 'throw', startup: 6, active: 2, recovery: 26, damage: 90, reach: 78, unblockable: true, isThrow: true,
        hitstun: 30, blockstun: 0, knockback: 8, launch: -10, yOff: 10, height: 120, hitstop: 8, meter: 12, strength: 'heavy', kdown: true });
  }
}

export function totalFrames(a: AttackData): number { return a.startup + a.active + a.recovery; }
