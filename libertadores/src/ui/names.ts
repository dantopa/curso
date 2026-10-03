import type { CharacterDef } from '../combat/types';

const SHORT: Record<string, string> = {
  tupacamaru: 'Túpac Amaru', katari: 'Túpac Katari', manco: 'Manco Inca', sanmartin: 'San Martín', ohiggins: "O'Higgins",
  louverture: 'Louverture', artigas: 'Artigas', guemes: 'Güemes', miranda: 'Miranda', bolivar: 'Bolívar', sucre: 'Sucre',
  hidalgo: 'Hidalgo', morelos: 'Morelos', cordova: 'Córdova', juarez: 'Juárez', guerrero: 'Guerrero', iturbide: 'Iturbide',
  marti: 'Martí', micaela: 'Micaela', belgrano: 'Belgrano',
};
export const shortName = (c: CharacterDef | string): string => SHORT[typeof c === 'string' ? c : c.id] ?? (typeof c === 'string' ? c : c.name);
