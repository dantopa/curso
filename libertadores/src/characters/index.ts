import type { CharacterDef } from '../combat/types';
import { artigas, bolivar, hidalgo, louverture, miranda, morelos, ohiggins, sanMartin, sucre, tupacAmaru } from './roster1';
import { belgrano, cordova, guemes, guerrero, iturbide, juarez, katari, manco, marti, micaela } from './roster2';

/** Roster in the official order (20 fighters). */
export const ROSTER: CharacterDef[] = [
  bolivar, sanMartin, tupacAmaru, sucre, louverture, hidalgo, morelos, ohiggins, artigas, miranda,
  guemes, cordova, juarez, guerrero, iturbide, marti, micaela, katari, manco, belgrano,
];

const BY_ID = new Map(ROSTER.map((c) => [c.id, c]));
export function getCharacter(id: string): CharacterDef {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}
export const CHARACTER_IDS = ROSTER.map((c) => c.id);
