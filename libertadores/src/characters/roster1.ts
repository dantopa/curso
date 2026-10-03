import { A, B, C, E, K, P, R, T, fat, makeCharacter, pal } from './builders';

const GOLD = 0xffc83d;

export const bolivar = makeCharacter({
  id: 'bolivar', name: 'Simón Bolívar', title: 'El Libertador', archetype: 'Balanceado / Táctico', difficulty: 'Medio',
  bio: 'Caraqueño de sable curvo y voluntad de hierro. Su visión continental convierte cada pelea en una campaña.',
  art: {
    palette: pal(0xc89a72, 0x2a1a10, 0x1c2c5a, 0xf0f0e8, 0xd4a017, 0xe0b840, 0x15110e, GOLD),
    headgear: 'none', hair: 'short', facial: 'sideburns', cape: 'cape', weapon: 'sabre', build: 'normal', height: 1.0,
    decor: ['epaulettes', 'medals'],
  },
  stats: { health: 1020, attack: 1.07, defense: 1.02 },
  specials: [
    P('Rayo de Caracas', 'Onda de energía dorada lanzada con el sabre.', 78,
      { vis: 'wave', color: GOLD, color2: 0xfff2b0, speed: 12, w: 80, h: 70, yOff: 90, pierce: false, life: 80 }),
    R('Carga de los Llanos', 'Carga espectral de caballería.', 92,
      { speed: 13, duration: 24, vis: 'cavalry', color: GOLD, launch: true, reach: 95 }, { cooldown: 40 }),
    B('Estrategia Continental', 'Aumenta el alcance de tus ataques un tiempo.', 'range', 0.35, 600, GOLD),
    C('Espada de la Libertad', 'Combo de tres tajos de sable.', 38, { hits: 3, color: GOLD, launchFinisher: true }),
  ],
  fatality: fat('LA GRAN COLOMBIA', 'Un ejército espectral rodea al rival; una ola dorada barre la arena.', 'DFDF', 'army', GOLD, 0xfff0b0, '¡Una sola nación, de los Andes al Caribe!'),
  secondary: fat('Juramento del Monte Sacro', 'Un círculo de luz dorada sella el juramento.', 'FFBB', 'oath', GOLD, 0xffffff, 'No daré descanso a mi brazo ni reposo a mi alma.'),
  ai: { aggression: 0.55, zoning: 0.4, defense: 0.45, preferredRange: 170 },
});

export const sanMartin = makeCharacter({
  id: 'sanmartin', name: 'José de San Martín', title: 'El Padre de la Patria', archetype: 'Espadachín / Defensivo', difficulty: 'Medio',
  bio: 'El Gran Capitán cruzó los Andes. Su sable corvo corta tan hondo como su paciencia estratégica.',
  art: {
    palette: pal(0xd0a27a, 0x1a120c, 0x1d3d7a, 0xe9e4d6, 0xa8201a, 0xd8d0b0, 0x15110e, 0xcfeaff),
    headgear: 'bicorne', hair: 'short', facial: 'sideburns', cape: 'cape', weapon: 'curvedSabre', build: 'normal', height: 1.03,
    decor: ['epaulettes', 'medals'],
  },
  stats: { health: 1020, defense: 1.08, walkSpeed: 3.9, attack: 0.96 },
  normals: { heavyReach: 100, lightReach: 76 },
  specials: [
    P('Sable Corvo', 'Tajo curvo de energía que atraviesa el aire.', 76,
      { vis: 'wave', color: 0xcfeaff, color2: 0xffffff, speed: 13, w: 70, h: 60, yOff: 85, life: 70 }),
    R('Carga de Granaderos', 'Carga espectral de granaderos a caballo.', 90,
      { speed: 13, duration: 24, vis: 'cavalry', color: 0xcfeaff, launch: true, reach: 95 }, { cooldown: 42 }),
    K('Guardia de Granadero', 'Postura defensiva: absorbe un golpe y contraataca.', 105, { window: 34, color: 0xcfeaff }),
    T('Cruce de los Andes', 'Teletransporte entre ventisca y tajo por la espalda.', 88, { behind: true, color: 0xcfeaff }),
  ],
  fatality: fat('EL CRUCE FINAL', 'Una ventisca cubre la arena y una caballería espectral arrasa el hielo.', 'BBDF', 'blizzard', 0xbfe8ff, 0xffffff, 'Seamos libres, lo demás no importa nada.'),
  secondary: fat('Carga de Chacabuco', 'Los Granaderos arremeten al alba.', 'DUDU', 'cavalry', 0xcfeaff, 0xffffff, '¡Sable en mano, granaderos!'),
  ai: { aggression: 0.35, defense: 0.8, zoning: 0.2, preferredRange: 130 },
});

export const tupacAmaru = makeCharacter({
  id: 'tupacamaru', name: 'Túpac Amaru II', title: 'El Inca Rebelde', archetype: 'Pesado / Poder ancestral', difficulty: 'Difícil',
  bio: 'José Gabriel Condorcanqui, descendiente de los Incas. Cuando el Sol manda, tiembla la tierra.',
  art: {
    palette: pal(0xa67654, 0x120c08, 0x8a1c1c, 0xe8b830, 0x2a6a4a, 0xf0c848, 0x2a1a10, 0xffd000),
    headgear: 'llautu', hair: 'long', facial: 'none', cape: 'unku', weapon: 'ceremonial', build: 'heavy', height: 1.05,
    decor: ['warpaint', 'feathers'],
  },
  stats: { health: 1110, walkSpeed: 3.6, backSpeed: 2.8, attack: 1.1, defense: 1.03, jumpVel: 16.5, meterGain: 0.95 },
  normals: { lightStartup: 6, heavyStartup: 13, heavyDmg: 1.15, lightReach: 72, heavyReach: 98 },
  specials: [
    P('Cólera del Sol', 'Onda de choque dorada que barre el suelo.', 82,
      { vis: 'shock', color: 0xffc030, color2: 0xfff0a0, speed: 9, w: 90, h: 50, yOff: 30, life: 90, launch: -11 }),
    C('Furia de los Andes', 'Devastador combo cuerpo a cuerpo.', 42, { hits: 3, interval: 10, step: 14, reach: 90, color: 0xffc030 }),
    P('Cadenas del Imperio', 'Cadenas mágicas que inmovilizan al enemigo.', 55,
      { vis: 'chain', color: 0xd0a040, color2: 0xfff0a0, speed: 14, w: 70, h: 40, yOff: 80, effect: 'root', life: 50 }, { cooldown: 55 }),
    A('Espíritu del Cóndor', 'Poderoso golpe aéreo en picada.', 90, { vx: 8, vy: 19, color: 0xffc030, reach: 90 }),
  ],
  fatality: fat('EL ÚLTIMO INCA', 'Un cóndor espectral colosal desciende y una onda dorada sacude los Andes.', 'FDFU', 'condor', 0xffc030, 0xfff0a0, 'Volveré, y seré millones.'),
  secondary: fat('Pachakuti', 'El mundo se invierte bajo un cielo de rayos.', 'UUDB', 'lightning', 0xffd000, 0xffffff, 'Pachakuti: el tiempo se da vuelta.'),
  ai: { aggression: 0.6, grappling: 0.55, zoning: 0.15, defense: 0.35, preferredRange: 100 },
});

export const sucre = makeCharacter({
  id: 'sucre', name: 'Antonio José de Sucre', title: 'El Gran Mariscal', archetype: 'Precisión / Técnico', difficulty: 'Difícil',
  bio: 'Cumanés de modales finos y estocada perfecta. En Ayacucho no sobró ni un movimiento.',
  art: {
    palette: pal(0xc9a07c, 0x2b1c12, 0x1f4d3a, 0xf0e8d0, 0xc8a030, 0xdcc060, 0x15110e, 0xdde8ff),
    headgear: 'bicorne', hair: 'short', facial: 'sideburns', cape: 'sash', weapon: 'sword', build: 'slim', height: 0.98,
    decor: ['epaulettes', 'medals'],
  },
  stats: { health: 970, walkSpeed: 4.6, backSpeed: 3.6, dashSpeed: 12, attack: 1.0, defense: 0.97, meterGain: 1.1 },
  normals: { lightStartup: 4, heavyStartup: 10, lightReach: 82, heavyReach: 100, lightDmg: 1.05 },
  specials: [
    P('Formación Impecable', 'Descarga espectral de infantería.', 24,
      { vis: 'bullet', color: 0xdde8ff, color2: 0xffffff, speed: 15, w: 36, h: 14, yOff: 95, count: 4, stagger: 5, yStep: -9, life: 60 }, { recovery: 28 }),
    R('Estocada de Ayacucho', 'Rápida estocada penetrante.', 80,
      { speed: 17, duration: 14, vis: 'wind', color: 0xdde8ff, launch: false, reach: 105 }, { startup: 9, recovery: 24, cooldown: 36 }),
    K('Estrategia Maestra', 'Postura de contraataque preciso.', 105, { window: 30, color: 0xdde8ff }),
    R('Marcha del Mariscal', 'Embestida de sable hacia adelante.', 86,
      { speed: 12, duration: 28, vis: 'infantry', color: 0xdde8ff, launch: true, reach: 90 }, { cooldown: 44 }),
  ],
  ultimateSlot: 0,
  fatality: fat('AYACUCHO', 'Una secuencia precisa y una descarga monumental de la formación espectral.', 'DDFB', 'volley', 0xcfe6ff, 0xffe9a0, 'Aquí se selló la libertad de América.'),
  secondary: fat('Batalla de Pichincha', 'Tormenta eléctrica sobre las laderas del volcán.', 'BFUF', 'lightning', 0xdde8ff, 0xffffff, 'Desde la cumbre, la victoria.'),
  ai: { aggression: 0.5, defense: 0.6, zoning: 0.35, ambush: 0.3, preferredRange: 150 },
});

export const louverture = makeCharacter({
  id: 'louverture', name: 'Toussaint Louverture', title: 'El Espartaco Negro', archetype: 'Táctico / Control', difficulty: 'Difícil',
  bio: 'Del cautiverio a la revolución que cambió el mundo. Un estratega que no se rinde ni se corta.',
  art: {
    palette: pal(0x5c3a28, 0x0f0f0f, 0x1a2a6a, 0xdcc16a, 0xc02020, 0xe8d080, 0x14100c, 0xff4a2a),
    headgear: 'bandana', hair: 'curly', facial: 'none', cape: 'sash', weapon: 'sword', build: 'normal', height: 1.0,
    decor: ['epaulettes', 'sash'],
  },
  stats: { health: 1020, defense: 1.04, attack: 1.02, meterGain: 1.05 },
  specials: [
    P('Tormenta de Saint-Domingue', 'Proyectil de viento oscuro.', 74,
      { vis: 'bolt', color: 0x5a2a7a, color2: 0xff4a2a, speed: 12, w: 70, h: 60, yOff: 85, life: 80 }),
    C('Sable de la Revolución', 'Rápida combinación de sable.', 36, { hits: 4, interval: 8, step: 10, color: 0xff4a2a }),
    B('Voluntad Indomable', 'Resistencia temporal: recibís menos daño.', 'defense', 0.35, 540, 0xff4a2a),
    P('Espíritu de la Libertad', 'Guerreros revolucionarios espectrales marchan al frente.', 40,
      { vis: 'warrior', color: 0xff6a3a, color2: 0xffd070, speed: 7, w: 50, h: 120, yOff: 60, count: 3, stagger: 14, life: 100, pierce: true }, { recovery: 28, cooldown: 80 }),
  ],
  fatality: fat('LA REVOLUCIÓN ETERNA', 'El campo se vuelve un frente revolucionario espectral entre fuego y luz.', 'UFUF', 'revolution', 0xff4a2a, 0xffd070, 'Al derribarme han talado apenas el tronco: las raíces son muchas.'),
  secondary: fat('Tempestad de Saint-Domingue', 'Una tormenta roja barre el campo.', 'DDUF', 'storm', 0xff4a2a, 0xffc0a0, 'Libertad o muerte.'),
  ai: { aggression: 0.45, zoning: 0.55, defense: 0.55, ambush: 0.25, preferredRange: 220 },
});

export const hidalgo = makeCharacter({
  id: 'hidalgo', name: 'Miguel Hidalgo', title: 'El Padre de la Independencia Mexicana', archetype: 'Zoner / Energía', difficulty: 'Medio',
  bio: 'El cura de Dolores que hizo sonar la campana. Fuego y sonido: su voz es su mejor arma.',
  art: {
    palette: pal(0xcfa07a, 0xdcdcdc, 0x1a1a22, 0x8a6a3a, 0xc8a02a, 0xd8b050, 0x14100c, 0xff8a2a),
    headgear: 'none', hair: 'short', facial: 'none', cape: 'cape', weapon: 'sword', build: 'normal', height: 1.0,
    decor: ['scarf'],
  },
  stats: { health: 1010, attack: 1.0, defense: 1.0, walkSpeed: 3.9 },
  specials: [
    P('Antorcha Rebelde', 'Proyectil de fuego.', 82,
      { vis: 'fire', color: 0xff6a1a, color2: 0xffd070, speed: 11, w: 64, h: 58, yOff: 85, life: 90 }),
    P('Grito de Dolores', 'Ataque sónico que aturde.', 40,
      { vis: 'sound', color: 0xffe0a0, color2: 0xff8a2a, speed: 15, w: 70, h: 100, yOff: 95, effect: 'stun', life: 55 }, { cooldown: 60 }),
    B('Espíritu Insurgente', 'Aura que potencia tu daño.', 'damage', 0.3, 540, 0xff8a2a),
    P('Campanas de la Insurrección', 'Serie de ondas de choque desde el suelo.', 34,
      { vis: 'bell', color: 0xe0b040, color2: 0xffe8a0, speed: 0, w: 70, h: 120, yOff: 55, count: 3, stagger: 12, spawn: 'oppGround', life: 20, launch: -9 }, { cooldown: 70 }),
  ],
  fatality: fat('EL GRITO ETERNO', 'Una campana espectral gigante resuena sobre la arena en una explosión de fuego.', 'BDBD', 'bell', 0xff8a2a, 0xffe0a0, '¡Viva la independencia!'),
  secondary: fat('Campanas de Dolores', 'Una marea de sonido y llamas barre el campo.', 'FUBD', 'tide', 0xff8a2a, 0xffe0a0, 'Mexicanos, viva México.'),
  ai: { aggression: 0.3, zoning: 0.85, defense: 0.45, preferredRange: 330 },
});

export const morelos = makeCharacter({
  id: 'morelos', name: 'José María Morelos', title: 'El Siervo de la Nación', archetype: 'Poder / Cuerpo a cuerpo', difficulty: 'Medio',
  bio: 'Estratega implacable y cura de mano pesada. Escribió los Sentimientos de la Nación y los defiende a golpes.',
  art: {
    palette: pal(0x9a6a48, 0x111111, 0x44502e, 0x8a2a1a, 0xc8a030, 0xd8b850, 0x1a120c, 0xd0702a),
    headgear: 'turban', hair: 'short', facial: 'none', cape: 'sash', weapon: 'sword', build: 'heavy', height: 1.02,
    decor: ['epaulettes'],
  },
  stats: { health: 1060, attack: 1.1, defense: 1.02, walkSpeed: 3.7, jumpVel: 16.8 },
  normals: { heavyDmg: 1.15, heavyStartup: 12, lightReach: 72 },
  specials: [
    R('Carga Insurgente', 'Embestida de lanza espectral.', 90,
      { speed: 12, duration: 24, vis: 'spear', color: 0xd0702a, launch: true, reach: 100 }, { cooldown: 40 }),
    A('Martillo del Sur', 'Golpe demoledor desde lo alto.', 98, { vx: 5, vy: 18, color: 0xd0702a, reach: 95 }),
    B('Sentimientos de la Nación', 'Aumento temporal de poder.', 'damage', 0.35, 540, 0xd0702a),
    C('Puño de la Nación', 'Pesado golpe de puño a corta distancia.', 52, { hits: 2, interval: 12, step: 14, reach: 80, color: 0xd0702a }, { startup: 10 }),
  ],
  fatality: fat('LA NACIÓN SE LEVANTA', 'Un puño espectral colosal emerge del suelo mientras sube un estandarte.', 'FFDU', 'fist', 0xd0702a, 0xffe0b0, 'Que todo el que se sienta con valor, me siga.'),
  secondary: fat('Sentimientos de la Nación', 'Un círculo de luz y espadas jura la patria.', 'UBUB', 'oath', 0xd0702a, 0xffe0b0, 'Que la esclavitud se proscriba para siempre.'),
  ai: { aggression: 0.7, grappling: 0.5, zoning: 0.1, defense: 0.3, preferredRange: 95 },
});

export const ohiggins = makeCharacter({
  id: 'ohiggins', name: "Bernardo O'Higgins", title: 'El Libertador de Chile', archetype: 'Agresivo / Espadachín', difficulty: 'Medio',
  bio: '¡Vivir con honor o morir con gloria! Lo de Rancagua lo hizo famoso por no retroceder jamás.',
  art: {
    palette: pal(0xe0b898, 0x6a4a2a, 0x1a3a8a, 0xf2f2f2, 0xc41e3a, 0xe0c060, 0x15110e, 0xff5a3a),
    headgear: 'shako', hair: 'short', facial: 'sideburns', cape: 'cape', weapon: 'sabre', build: 'normal', height: 1.02,
    decor: ['epaulettes', 'sash'],
  },
  stats: { health: 1020, attack: 1.08, defense: 0.98, walkSpeed: 4.5, dashSpeed: 12 },
  normals: { lightStartup: 5, lightDmg: 1.05, lightReach: 78 },
  specials: [
    P('Fuego de los Andes', 'Ráfaga de proyectiles en llamas.', 28,
      { vis: 'fire', color: 0xff5a3a, color2: 0xffd070, speed: 12, w: 40, h: 36, yOff: 90, count: 3, stagger: 6, yStep: -14, life: 70 }, { recovery: 28 }),
    R('Carga Patriota', 'Rápido ataque hacia adelante.', 84,
      { speed: 16, duration: 18, vis: 'wind', color: 0xff5a3a, launch: false, reach: 95 }, { startup: 9, cooldown: 30 }),
    K('Guardia de Chile', 'Contraataque defensivo.', 100, { window: 30, color: 0xff5a3a }),
    C('Sable de Rancagua', 'Tajo horizontal encadenado.', 44, { hits: 2, interval: 10, step: 16, reach: 100, color: 0xff5a3a }),
  ],
  fatality: fat('LA ÚLTIMA CARGA', 'Una caballería espectral lo atraviesa todo, y un sablazo sella la pelea.', 'DBFB', 'cavalry', 0xff5a3a, 0xffe0c0, '¡O vivir con honor, o morir con gloria!'),
  secondary: fat('Rancagua', 'El campo arde en una revolución espectral.', 'FFUB', 'revolution', 0xff5a3a, 0xffd070, '¡Soldados, vivir con honor...!'),
  ai: { aggression: 0.85, zoning: 0.15, defense: 0.25, ambush: 0.2, preferredRange: 105 },
});

export const artigas = makeCharacter({
  id: 'artigas', name: 'José Gervasio Artigas', title: 'El Protector de los Pueblos Libres', archetype: 'Ágil / Agarre', difficulty: 'Difícil',
  bio: 'Jefe de los Orientales. Facón corto, lazo largo y un ejército de blandengues espectrales.',
  art: {
    palette: pal(0xb88a62, 0x3a2414, 0x2a4a7a, 0xe8e0c8, 0x9ad0ff, 0xd8c890, 0x15110e, 0x7adf6a),
    headgear: 'tricorn', hair: 'long', facial: 'sideburns', cape: 'sash', weapon: 'facon', build: 'slim', height: 1.0,
    decor: ['spurs', 'epaulettes'],
  },
  stats: { health: 1060, walkSpeed: 4.8, backSpeed: 3.8, dashSpeed: 12.5, attack: 1.13, defense: 1.04, jumpVel: 18 },
  normals: { lightStartup: 4, lightReach: 74, heavyReach: 92, heavyStartup: 10 },
  specials: [
    P('Lazo Oriental', 'Atrapa al rival y lo arrastra hacia vos.', 50,
      { vis: 'lasso', color: 0xd8c890, color2: 0x7adf6a, speed: 18, w: 70, h: 40, yOff: 85, effect: 'pull', life: 28 }, { cooldown: 60 }),
    R('Carga de Blandengues', 'Carga espectral montada.', 88,
      { speed: 14, duration: 22, vis: 'cavalry', color: 0x7adf6a, launch: true, reach: 90 }, { cooldown: 42 }),
    K('Defensa de los Pueblos', 'Contraataque defensivo.', 100, { window: 30, color: 0x7adf6a }),
    C('Facón Federal', 'Cortes rápidos de facón.', 26, { hits: 5, interval: 6, step: 8, reach: 72, color: 0x7adf6a, launchFinisher: false }, { startup: 6, recovery: 26 }),
  ],
  fatality: fat('LA LIGA FEDERAL', 'El lazo atrapa al rival y lo arrastra al paso de una caballería espectral.', 'UUFD', 'lasso', 0x7adf6a, 0xe8ffd0, 'Mis pueblos serán libres... o no serán.'),
  secondary: fat('Éxodo del Pueblo Oriental', 'Una marea de pueblo y luz.', 'BBUD', 'tide', 0x7adf6a, 0xe8ffd0, 'Con libertad no ofendo ni temo.'),
  ai: { aggression: 0.65, grappling: 0.65, ambush: 0.4, defense: 0.3, zoning: 0.15, preferredRange: 120 },
});

export const miranda = makeCharacter({
  id: 'miranda', name: 'Francisco de Miranda', title: 'El Precursor', archetype: 'Versátil / Arsenal', difficulty: 'Difícil',
  bio: 'El venezolano universal: viajó por el mundo con espada, pistola y un sueño continental.',
  art: {
    palette: pal(0xe0b898, 0xe0e0e0, 0x8a1a1a, 0xf0e8d0, 0xd0a030, 0xe0c060, 0x15110e, 0xa07aff),
    headgear: 'tricorn', hair: 'slicked', facial: 'none', cape: 'none', weapon: 'pistolSword', build: 'slim', height: 1.0,
    decor: ['epaulettes', 'medals'],
  },
  stats: { health: 960, attack: 1.0, defense: 0.98, walkSpeed: 4.3, meterGain: 1.1 },
  normals: { lightReach: 78, heavyReach: 96 },
  specials: [
    P('Fuego Continental', 'Proyectil de pistola de chispa.', 64,
      { vis: 'bullet', color: 0xffe9a0, color2: 0xa07aff, speed: 20, w: 40, h: 16, yOff: 95, life: 50 }, { startup: 11, recovery: 22, cooldown: 30 }),
    C('Espada del Precursor', 'Serie de estocadas precisas.', 30, { hits: 4, interval: 8, step: 10, reach: 95, color: 0xa07aff }),
    E('Plan Continental', 'Maniobra evasiva táctica hacia atrás.', 0, { dir: -1, speed: 13, frames: 20, color: 0xa07aff }),
    P('Legión Extranjera', 'Infantería espectral al ataque.', 38,
      { vis: 'soldier', color: 0xa07aff, color2: 0xffffff, speed: 8, w: 50, h: 110, yOff: 55, count: 3, stagger: 16, life: 90, pierce: true }, { recovery: 28, cooldown: 90 }),
  ],
  ultimateSlot: 3,
  fatality: fat('EL SUEÑO CONTINENTAL', 'Un mapa luminoso de América se materializa y la energía lo envuelve todo.', 'FBFD', 'map', 0xa07aff, 0xf0e0ff, 'Hay un solo continente, y es el nuestro.'),
  secondary: fat('Colombeia', 'Una descarga de infantería espectral cierra el sueño.', 'DFUD', 'volley', 0xa07aff, 0xf0e0ff, 'Colombia: del nombre de Colón a la unidad.'),
  ai: { aggression: 0.4, zoning: 0.6, ambush: 0.4, defense: 0.45, preferredRange: 240 },
});
