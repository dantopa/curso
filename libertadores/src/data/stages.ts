import type { StageDef } from '../combat/types';

export const STAGES: StageDef[] = [
  {
    id: 'llanos', name: 'Llanos de Venezuela', kind: 'llanos',
    desc: 'Sabana infinita bajo un crepusculo de tormenta. La lluvia lava la sangre de los jinetes.',
    sky: [0x1a1c2e, 0x8a4a3a], ground: 0x2d3a1e, fog: 0x4a4458, accent: 0xffb060, ambience: 'rain',
  },
  {
    id: 'andes', name: 'Paso de los Andes', kind: 'andes',
    desc: 'Cumbres nevadas y ventisca. El ejercito libertador cruza la cordillera.',
    sky: [0x2a3a5c, 0xc4d4e6], ground: 0xdfe8f0, fog: 0xb8c8dc, accent: 0x9fd0ff, ambience: 'snow',
  },
  {
    id: 'tiwanaku', name: 'Ruinas de Tiwanaku', kind: 'tiwanaku',
    desc: 'La Puerta del Sol al amanecer. Piedra milenaria y polvo del altiplano.',
    sky: [0x3a2a4a, 0xf0a060], ground: 0x6a5238, fog: 0xd8a070, accent: 0xffd070, ambience: 'dust',
  },
  {
    id: 'citadel', name: 'Ciudadela de Vilcabamba', kind: 'citadel',
    desc: 'Terrazas incas entre la niebla. El ultimo refugio del Sapa Inca.',
    sky: [0x14262a, 0x6a8a82], ground: 0x4a4a42, fog: 0x8aa8a0, accent: 0xffc860, ambience: 'fireflies',
  },
  {
    id: 'battlefield', name: 'Campo de Ayacucho', kind: 'battlefield',
    desc: 'Alba sobre el campo de batalla. Humo, estandartes rotos y ceniza.',
    sky: [0x3a3038, 0xd89a6a], ground: 0x4a3c2c, fog: 0x7a6a60, accent: 0xff9040, ambience: 'ash',
  },
  {
    id: 'jungle', name: 'Selva de Saint-Domingue', kind: 'jungle',
    desc: 'Noche cerrada en la jungla. Los fuegos de la revuelta iluminan el follaje.',
    sky: [0x040a0c, 0x1a2a20], ground: 0x1c2a1a, fog: 0x2a4a38, accent: 0xff6020, ambience: 'embers',
  },
  {
    id: 'plaza', name: 'Plaza de Dolores', kind: 'plaza',
    desc: 'Noche en la plaza colonial. Repican las campanas del Grito de Dolores.',
    sky: [0x0a0c1e, 0x3a2a40], ground: 0x4a4038, fog: 0x3a3450, accent: 0xffa040, ambience: 'embers',
  },
  {
    id: 'pampa', name: 'Pampa de Salta', kind: 'pampa',
    desc: 'Atardecer rojo sangre. Un ombu solitario custodia la llanura gaucha.',
    sky: [0x3a0e14, 0xe0502a], ground: 0x4a2e1a, fog: 0x8a3a30, accent: 0xff7040, ambience: 'dust',
  },
  {
    id: 'dimension', name: 'Dimension del Torneo', kind: 'dimension',
    desc: 'Vacio misterioso donde las eras colisionan. Ruinas flotantes y portales.',
    sky: [0x0a0420, 0x4a1a6a], ground: 0x1a1030, fog: 0x4a2a7a, accent: 0x40ffd0, ambience: 'embers',
  },
];

export function getStage(id: string): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}
