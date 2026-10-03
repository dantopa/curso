import type { AnimName, CharacterDef, FighterView } from '../combat/types';

const CYCLE: { anim: AnimName; len: number; attack?: boolean }[] = [
  { anim: 'idle', len: 150 }, { anim: 'lightA', len: 36, attack: true }, { anim: 'idle', len: 60 },
  { anim: 'heavyA', len: 56, attack: true }, { anim: 'idle', len: 60 }, { anim: 'cast', len: 60 },
  { anim: 'idle', len: 60 }, { anim: 'win', len: 110 },
];
const TOTAL = CYCLE.reduce((a, c) => a + c.len, 0);

/** Builds a FighterView that cycles through showcase animations (character select / menus). */
export function previewView(char: CharacterDef, x: number, y: number, frame: number, facing: 1 | -1 = 1): FighterView {
  let f = frame % TOTAL;
  let seg = CYCLE[0];
  for (const c of CYCLE) { if (f < c.len) { seg = c; break; } f -= c.len; }
  const t = f / seg.len;
  let phase: FighterView['phase'] = null, phaseT = 0;
  if (seg.attack) {
    if (t < 0.3) { phase = 'startup'; phaseT = t / 0.3; }
    else if (t < 0.5) { phase = 'active'; phaseT = (t - 0.3) / 0.2; }
    else { phase = 'recovery'; phaseT = (t - 0.5) / 0.5; }
  }
  return {
    x, y, facing, anim: seg.anim, animFrame: f, animLen: seg.len, animT: t, phase, phaseT,
    clock: frame, char, hitFlash: 0, hidden: false, buffs: [], vx: 0, vy: 0,
  };
}
