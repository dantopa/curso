import { A, B, C, E, K, P, R, T, fat, makeCharacter, pal } from './builders';

export const guemes = makeCharacter({
  id: 'guemes', name: 'Martín Miguel de Güemes', title: 'El General Gaucho', archetype: 'Velocidad / Emboscada', difficulty: 'Difícil',
  bio: 'Jefe de los Infernales de Salta. Sombra, poncho rojo y facón: golpea y desaparece.',
  art: {
    palette: pal(0xbf9068, 0x20140c, 0xb02020, 0x1a1a1a, 0xf0e8d8, 0xe0c080, 0x1a110c, 0xff2a2a),
    headgear: 'gauchoHat', hair: 'short', facial: 'moustache', cape: 'poncho', weapon: 'facon', build: 'slim', height: 1.0,
    decor: ['spurs'],
  },
  stats: { health: 940, walkSpeed: 5.0, backSpeed: 4.0, dashSpeed: 13, attack: 0.98, defense: 0.94, jumpVel: 18.3 },
  normals: { lightStartup: 4, heavyStartup: 10, lightReach: 66, heavyReach: 82 },
  specials: [
    C('Facón Salteño', 'Cuchilladas rápidas.', 28, { hits: 4, interval: 6, step: 9, reach: 72, color: 0xff2a2a, launchFinisher: false }, { startup: 6, recovery: 24 }),
    R('Carga de Salta', 'Poderoso ataque montado.', 90,
      { speed: 15, duration: 22, vis: 'gaucho', color: 0xff2a2a, launch: true, reach: 92 }, { cooldown: 42 }),
    E('Poncho Fantasma', 'Maniobra evasiva con poncho: esquiva y pega.', 60, { dir: 1, speed: 15, frames: 16, strike: true, color: 0xff2a2a }, { cooldown: 70 }),
    P('Guerra Gaucha', 'Emboscada espectral de gauchos a caballo.', 36,
      { vis: 'gaucho', color: 0xff2a2a, color2: 0xffc0a0, speed: 12, w: 70, h: 100, yOff: 55, count: 3, stagger: 12, life: 80, pierce: true, spawn: 'behind' }, { recovery: 28, cooldown: 90 }),
  ],
  fatality: fat('LA NOCHE DE SALTA', 'Güemes desaparece en el polvo; gauchos espectrales cargan desde todos lados bajo una tormenta roja.', 'DUDF', 'storm', 0xff2a2a, 0xffc0a0, 'La Patria se defiende de noche y de día.'),
  secondary: fat('Los Infernales', 'La caballería gaucha arrasa la pampa.', 'UFDB', 'cavalry', 0xff2a2a, 0xffc0a0, '¡Guerra gaucha!'),
  ai: { aggression: 0.75, ambush: 0.8, zoning: 0.15, defense: 0.2, preferredRange: 100 },
});

export const cordova = makeCharacter({
  id: 'cordova', name: 'José María Córdova', title: 'El Héroe de Ayacucho', archetype: 'Ágil / Espadachín', difficulty: 'Medio',
  bio: 'A los 25 años comandó la carga que decidió Ayacucho: «¡Armas a discreción! ¡Paso de vencedores!».',
  art: {
    palette: pal(0xdcb08a, 0x4a2e1a, 0xe8e8e0, 0x2a3a6a, 0xc8a030, 0xe0c060, 0x15110e, 0xf0f4ff),
    headgear: 'shako', hair: 'short', facial: 'none', cape: 'none', weapon: 'sabre', build: 'slim', height: 0.98,
    decor: ['epaulettes', 'sash'],
  },
  stats: { health: 960, walkSpeed: 4.9, backSpeed: 3.8, dashSpeed: 12.5, attack: 1.0, defense: 0.96, jumpVel: 18.8 },
  normals: { lightStartup: 4, lightDmg: 1.04 },
  specials: [
    P('Golpe de Chorros Blancos', 'Onda de choque que recorre el suelo.', 72,
      { vis: 'shock', color: 0xf0f4ff, color2: 0xa0c0ff, speed: 10, w: 80, h: 44, yOff: 28, life: 80, launch: -10 }),
    A('Carga de Córdoba', 'Ataque con espada en salto.', 86, { vx: 8, vy: 18.5, color: 0xf0f4ff, reach: 88 }),
    C('Espada Relámpago', 'Combo rápido de sable.', 34, { hits: 4, interval: 7, step: 10, color: 0xf0f4ff }),
    A('Salto del Mariscal', 'Ataque aéreo evasivo en diagonal.', 80, { vx: -4, vy: 20, dive: true, color: 0xf0f4ff, reach: 90 }),
  ],
  fatality: fat('EL HÉROE JOVEN', 'Una secuencia acrobática de tajos que culmina en una explosión de energía blanca.', 'BUFF', 'acrobat', 0xf0f4ff, 0xffffff, '¡Paso de vencedores!'),
  secondary: fat('Chorros Blancos', 'Una tormenta de relámpagos blancos.', 'DBDB', 'lightning', 0xf0f4ff, 0xffffff, 'Armas a discreción.'),
  ai: { aggression: 0.7, ambush: 0.45, zoning: 0.2, defense: 0.3, preferredRange: 115 },
});

export const juarez = makeCharacter({
  id: 'juarez', name: 'Benito Juárez', title: 'El Benemérito', archetype: 'Defensivo / Contraataque', difficulty: 'Difícil',
  bio: '«El respeto al derecho ajeno es la paz». Pequeño de estatura, inmenso de principios.',
  art: {
    palette: pal(0x9a6a4a, 0x111111, 0x14141c, 0xe8e8e8, 0xc9a43a, 0xd8b850, 0x0e0c0a, 0x4adf8a),
    headgear: 'none', hair: 'short', facial: 'none', cape: 'none', weapon: 'sword', build: 'normal', height: 0.93,
    decor: ['medals'],
  },
  stats: { health: 1040, defense: 1.1, attack: 0.94, walkSpeed: 3.9, meterGain: 1.1 },
  normals: { heavyReach: 98 },
  specials: [
    P('Águila de la República', 'Águila espectral que ataca en picada.', 78,
      { vis: 'eagle', color: 0x4adf8a, color2: 0xffe9a0, speed: 13, w: 90, h: 60, yOff: 110, life: 80 }),
    K('Justicia Republicana', 'Poderoso contraataque.', 115, { window: 36, color: 0x4adf8a }),
    B('Ley de Reforma', 'Escudo de energía protectora.', 'shield', 2, 420, 0x4adf8a, { cooldown: 480 }),
    B('Resistencia Republicana', 'Reducción temporal de daño.', 'defense', 0.4, 540, 0xffe9a0, { cooldown: 540 }),
  ],
  ultimateSlot: 0,
  fatality: fat('LA LEY SUPREMA', 'Una balanza espectral monumental y un haz dorado de energía republicana.', 'UDUD', 'balance', 0x4adf8a, 0xffe9a0, 'Entre los individuos, como entre las naciones, el respeto al derecho ajeno es la paz.'),
  secondary: fat('El Respeto al Derecho Ajeno', 'Un águila republicana desciende con la ley.', 'FBFB', 'eagle', 0x4adf8a, 0xffe9a0, 'Nada por la fuerza, todo por el derecho.'),
  ai: { aggression: 0.2, defense: 0.95, zoning: 0.3, grappling: 0.1, preferredRange: 170 },
});

export const guerrero = makeCharacter({
  id: 'guerrero', name: 'Vicente Guerrero', title: 'El Tigre del Sur', archetype: 'Pesado / Resistencia', difficulty: 'Medio',
  bio: '«¡Mi patria es primero!». Aguanta el castigo como una montaña y devuelve como un felino.',
  art: {
    palette: pal(0x6a4630, 0x0f0f0f, 0x2a2a2a, 0xc03a1a, 0x2a8a4a, 0xe0b040, 0x14100c, 0xff8a1a),
    headgear: 'headband', hair: 'curly', facial: 'moustache', cape: 'sash', weapon: 'sword', build: 'heavy', height: 1.04,
    decor: ['warpaint'],
  },
  stats: { health: 1120, walkSpeed: 3.8, backSpeed: 3.0, attack: 1.08, defense: 1.1, jumpVel: 16.8, meterGain: 0.95 },
  normals: { lightStartup: 6, heavyStartup: 12, heavyDmg: 1.12, lightReach: 70 },
  specials: [
    C('Zarpazo del Tigre', 'Devastador golpe de zarpa.', 58, { hits: 2, interval: 11, step: 14, reach: 85, color: 0xff8a1a }, { startup: 9 }),
    T('Guerrilla del Sur', 'Emboscada con teletransporte.', 88, { behind: true, color: 0xff8a1a }),
    B('Espíritu Insurgente', 'Resistencia temporal.', 'defense', 0.35, 540, 0xff8a1a),
    C('Furia del Guerrero', 'Pesada combinación cuerpo a cuerpo.', 44, { hits: 3, interval: 10, step: 14, reach: 85, color: 0xff8a1a }),
  ],
  fatality: fat('EL TIGRE DESATADO', 'Guerrero se transforma en un colosal felino espectral y arrasa en una explosión de fuego.', 'FDDB', 'tiger', 0xff8a1a, 0xffe070, 'Mi patria es primero.'),
  secondary: fat('Abrazo de Acatempan', 'Un círculo de luz y espadas sella la unión.', 'FBBD', 'oath', 0xff8a1a, 0xffe070, 'Vivir libres o morir.'),
  ai: { aggression: 0.55, grappling: 0.5, defense: 0.5, zoning: 0.1, preferredRange: 95 },
});

export const iturbide = makeCharacter({
  id: 'iturbide', name: 'Agustín de Iturbide', title: 'El Emperador', archetype: 'Dominio / Poder', difficulty: 'Medio',
  bio: 'Del Plan de Iguala a la corona. Su sable trigarante ondea en verde, blanco y rojo.',
  art: {
    palette: pal(0xdcb090, 0x2a1a10, 0x1a6a3a, 0xf2f2f2, 0xc41e3a, 0xffd040, 0x15110e, 0xffd040),
    headgear: 'crown', hair: 'short', facial: 'sideburns', cape: 'cape', weapon: 'sabre', build: 'normal', height: 1.03,
    decor: ['epaulettes', 'medals', 'sash'],
  },
  stats: { health: 1030, attack: 1.06, defense: 1.04, walkSpeed: 3.9 },
  normals: { heavyDmg: 1.1, heavyReach: 96 },
  specials: [
    P('Corona Imperial', 'Onda de choque dorada.', 80,
      { vis: 'crown', color: 0xffd040, color2: 0xffffff, speed: 11, w: 80, h: 70, yOff: 80, life: 80 }),
    C('Sable Trigarante', 'Serie de ataques de sable tricolor.', 36, { hits: 3, interval: 9, step: 12, color: 0xffd040 }),
    P('Decreto Imperial', 'Atadura de energía que inmoviliza.', 52,
      { vis: 'chain', color: 0xffd040, color2: 0xc41e3a, speed: 14, w: 70, h: 44, yOff: 80, effect: 'root', life: 50 }, { cooldown: 60 }),
    K('Guardia Imperial', 'Postura defensiva con contragolpe.', 100, { window: 32, color: 0xffd040 }),
  ],
  fatality: fat('EL TRONO DE MÉXICO', 'Un trono dorado emerge y una corona gigante desciende en una explosión tricolor.', 'BFBF', 'throne', 0xffd040, 0xffffff, 'Tres garantías: religión, independencia y unión.'),
  secondary: fat('Plan de Iguala', 'El ejército trigarante rodea al rival.', 'DDBF', 'army', 0x1a6a3a, 0xffd040, 'Unión, independencia, religión.'),
  ai: { aggression: 0.6, zoning: 0.3, defense: 0.45, grappling: 0.3, preferredRange: 130 },
});

export const marti = makeCharacter({
  id: 'marti', name: 'José Martí', title: 'El Apóstol de Cuba', archetype: 'A distancia / Energía', difficulty: 'Difícil',
  bio: 'Poeta, periodista, soldado. Sus versos de fuego iluminan el combate; su pluma es más filosa que el acero.',
  art: {
    palette: pal(0xd4a880, 0x101010, 0x14141a, 0xe8e0d0, 0xffd070, 0xe0c080, 0x0e0c0a, 0x7ad0ff),
    headgear: 'none', hair: 'curly', facial: 'moustache', cape: 'none', weapon: 'pen', build: 'slim', height: 0.97,
    decor: ['scarf'],
  },
  stats: { health: 940, walkSpeed: 4.3, attack: 0.96, defense: 0.94, meterGain: 1.15 },
  normals: { lightReach: 76, heavyReach: 94 },
  specials: [
    P('Versos de Fuego', 'Proyectiles de energía con forma de letras luminosas.', 70,
      { vis: 'letters', color: 0x7ad0ff, color2: 0xffffff, speed: 12, w: 56, h: 50, yOff: 90, life: 90 }),
    P('Espíritu de Dos Ríos', 'Poderoso haz de energía.', 90,
      { vis: 'beam', color: 0x7ad0ff, color2: 0xffffff, speed: 22, w: 300, h: 40, yOff: 90, pierce: true, life: 14 }, { startup: 20, recovery: 34, cooldown: 70 }),
    B('Nuestra América', 'Escudo de energía temporal.', 'shield', 2, 420, 0x7ad0ff, { cooldown: 480 }),
    P('Pluma Libertaria', 'Tormenta de plumas sobrenaturales.', 20,
      { vis: 'feather', color: 0xe8f4ff, color2: 0x7ad0ff, speed: 9, w: 34, h: 30, yOff: 150, count: 6, stagger: 4, yStep: 0, life: 80, gravity: 0.25, spawn: 'sky' }, { recovery: 30, cooldown: 80 }),
  ],
  fatality: fat('NUESTRA AMÉRICA', 'Martí escribe versos luminosos que se vuelven una tormenta de energía.', 'UBDF', 'letters', 0x7ad0ff, 0xffffff, 'Con los pobres de la tierra quiero yo mi suerte echar.'),
  secondary: fat('Versos Sencillos', 'Un águila de luz lleva el último verso.', 'BUBU', 'eagle', 0x7ad0ff, 0xffffff, 'Cultivo una rosa blanca.'),
  ai: { aggression: 0.25, zoning: 0.9, defense: 0.5, ambush: 0.15, preferredRange: 360 },
});

export const micaela = makeCharacter({
  id: 'micaela', name: 'Micaela Bastidas', title: 'La Estratega Rebelde', archetype: 'Técnica / Control', difficulty: 'Difícil',
  bio: 'La mente de Tungasuca. Organizó, mandó y dirigió: su látigo llega lejos y su plan, más.',
  art: {
    palette: pal(0x9a6c48, 0x0e0a08, 0x5a1a4a, 0xe8b030, 0x2a9a9a, 0xf0c050, 0x1a110c, 0xe05ac0),
    headgear: 'headband', hair: 'braids', facial: 'none', cape: 'poncho', weapon: 'lasso', build: 'slim', height: 0.95, female: true,
    decor: ['feathers'],
  },
  stats: { health: 950, walkSpeed: 4.7, backSpeed: 3.7, attack: 1.0, defense: 0.96, meterGain: 1.1 },
  normals: { lightReach: 72, heavyReach: 104, lightStartup: 4 },
  specials: [
    P('Látigo de la Rebelión', 'Golpe de largo alcance con el látigo.', 70,
      { vis: 'lasso', color: 0xe05ac0, color2: 0xffd070, speed: 20, w: 120, h: 30, yOff: 85, life: 22 }, { startup: 10, recovery: 22, cooldown: 24 }),
    C('Furia de Vilcabamba', 'Rápido combo cuerpo a cuerpo.', 28, { hits: 4, interval: 7, step: 10, reach: 76, color: 0xe05ac0, launchFinisher: true }),
    P('Estrategia de Tungasuca', 'Trampa táctica en el suelo.', 70,
      { vis: 'trap', color: 0xe05ac0, color2: 0xffd070, speed: 0, w: 70, h: 40, yOff: 15, life: 420, effect: 'root', launch: -8 }, { recovery: 18, cooldown: 140 }),
    P('Orden de Insurrección', 'Guerreros espectrales atacan al enemigo.', 38,
      { vis: 'warrior', color: 0xe05ac0, color2: 0xffd070, speed: 8, w: 50, h: 120, yOff: 60, count: 3, stagger: 12, life: 90, pierce: true }, { recovery: 28, cooldown: 90 }),
  ],
  fatality: fat('LA REBELIÓN DE LOS ANDES', 'Una serpiente andina colosal envuelve al rival antes de estallar en energía dorada.', 'DDUU', 'serpent', 0xe05ac0, 0xffd070, 'Que mi nombre no se apague con la noche.'),
  secondary: fat('Tungasuca', 'Un muro de energía y piedra encierra al rival.', 'BUBU', 'wall', 0xe05ac0, 0xffd070, 'Por la causa de los pueblos.'),
  ai: { aggression: 0.4, zoning: 0.5, ambush: 0.35, defense: 0.55, preferredRange: 210 },
});

export const katari = makeCharacter({
  id: 'katari', name: 'Túpac Katari', title: 'El Cerco de La Paz', archetype: 'Control de área / Pesado', difficulty: 'Difícil',
  bio: 'Julián Apaza puso cerco a La Paz durante meses. Honda del altiplano y paciencia de piedra.',
  art: {
    palette: pal(0x8a5a3a, 0x0a0806, 0x8a3a2a, 0x2a4a6a, 0xe0b040, 0xf0c050, 0x1a110c, 0xd8b060),
    headgear: 'feathers', hair: 'long', facial: 'none', cape: 'poncho', weapon: 'sling', build: 'heavy', height: 1.04,
    decor: ['warpaint', 'feathers'],
  },
  stats: { health: 1080, walkSpeed: 3.7, backSpeed: 2.9, attack: 1.08, defense: 1.06, jumpVel: 16.6 },
  normals: { lightStartup: 6, heavyStartup: 12, heavyDmg: 1.12 },
  specials: [
    P('Honda del Altiplano', 'Poderoso proyectil de piedra.', 80,
      { vis: 'stone', color: 0xb09060, color2: 0xe0c890, speed: 13, w: 44, h: 44, yOff: 90, life: 80 }),
    C('Furia del Altiplano', 'Pesado combo cuerpo a cuerpo.', 44, { hits: 3, interval: 10, step: 14, reach: 85, color: 0xd8b060 }),
    P('Cerco Aymara', 'Barrera de energía que atrapa al rival.', 45,
      { vis: 'wall', color: 0xd8b060, color2: 0xfff0c0, speed: 0, w: 70, h: 160, yOff: 80, life: 150, effect: 'root', blocksProj: true, spawn: 'oppGround' }, { recovery: 24, cooldown: 120 }),
    P('Cóndor Rebelde', 'Cóndor espectral ataca desde arriba.', 80,
      { vis: 'condor', color: 0xd8b060, color2: 0xffffff, speed: 5, w: 90, h: 80, yOff: 150, life: 70, spawn: 'sky', gravity: 0.2 }, { cooldown: 60 }),
  ],
  fatality: fat('EL CERCO ETERNO', 'Un muro de energía colosal encierra al rival; una tormenta de piedras culmina en un sismo.', 'FUFB', 'wall', 0xd8b060, 0xfff0c0, 'Volveré y seré millones.'),
  secondary: fat('Cerco de La Paz', 'Una descarga de honda de proporciones monumentales.', 'DFBU', 'volley', 0xd8b060, 0xfff0c0, 'Nayra... el cerco no se rompe.'),
  ai: { aggression: 0.35, zoning: 0.7, defense: 0.55, grappling: 0.2, preferredRange: 260 },
});

export const manco = makeCharacter({
  id: 'manco', name: 'Manco Inca', title: 'El Inca de Vilcabamba', archetype: 'Magia ancestral / Combate', difficulty: 'Difícil',
  bio: 'Alzó el Cusco y fundó el reino neoinca de Vilcabamba. Lanza solar, murallas de piedra y fuego de cóndor.',
  art: {
    palette: pal(0xa87a56, 0x0a0806, 0xc0392b, 0x1a1a1a, 0xe8c030, 0xf0d050, 0x2a1a10, 0xff7a10),
    headgear: 'inkaCrown', hair: 'long', facial: 'none', cape: 'unku', weapon: 'spear', build: 'normal', height: 1.05,
    decor: ['warpaint', 'armor'],
  },
  stats: { health: 1000, walkSpeed: 4.1, attack: 1.02, defense: 1.0 },
  normals: { lightReach: 90, heavyReach: 115, lightStartup: 6, heavyStartup: 12 },
  specials: [
    P('Lanza del Sol', 'Proyectil solar.', 78,
      { vis: 'sun', color: 0xff7a10, color2: 0xffe090, speed: 13, w: 70, h: 64, yOff: 90, life: 80 }),
    C('Furia de Vilcabamba', 'Poderoso combo de lanza.', 38, { hits: 3, interval: 9, step: 12, reach: 110, color: 0xff7a10 }),
    P('Muro de Sacsayhuamán', 'Barrera de piedra.', 30,
      { vis: 'wall', color: 0xb09870, color2: 0xe8d8b0, speed: 0, w: 70, h: 160, yOff: 80, life: 180, effect: 'none', blocksProj: true, launch: -8 }, { startup: 12, recovery: 22, cooldown: 110 }),
    A('Cóndor de Fuego', 'Ataque aéreo espectral.', 92, { vx: 8, vy: 19, color: 0xff7a10, reach: 95 }),
  ],
  fatality: fat('EL RETORNO DEL IMPERIO', 'Una ciudadela inca emerge; un cóndor de fuego lleva al rival a una explosión solar.', 'BBFF', 'citadel', 0xff7a10, 0xffe090, 'El Sol vuelve a salir sobre el Tahuantinsuyo.'),
  secondary: fat('Cerco del Cusco', 'Un sol colosal se alza tras el guerrero.', 'UDUF', 'sun', 0xff7a10, 0xffe090, 'Inti manda.'),
  ai: { aggression: 0.5, zoning: 0.5, defense: 0.45, ambush: 0.2, preferredRange: 190 },
});

export const belgrano = makeCharacter({
  id: 'belgrano', name: 'Manuel Belgrano', title: 'El Creador de la Bandera', archetype: 'Balanceado / Energía', difficulty: 'Medio',
  bio: 'Abogado, economista y general sin vocación militar. Su bandera celeste y blanca flamea en cada golpe.',
  art: {
    palette: pal(0xe2bc9a, 0x7a4a2a, 0x24467a, 0xf0f4f8, 0x6ec6f0, 0xd8d0a0, 0x15110e, 0x6ec6ff),
    headgear: 'bicorne', hair: 'short', facial: 'sideburns', cape: 'banner', weapon: 'sabre', build: 'normal', height: 1.0,
    decor: ['epaulettes', 'sash'],
  },
  stats: { health: 1000, meterGain: 1.1 },
  specials: [
    P('Bandera Celeste y Blanca', 'Proyectil de energía bicolor.', 76,
      { vis: 'flag', color: 0x6ec6ff, color2: 0xffffff, speed: 12, w: 70, h: 60, yOff: 90, life: 85 }),
    R('Carga de Tucumán', 'Carga espectral de caballería.', 90,
      { speed: 13, duration: 24, vis: 'cavalry', color: 0x6ec6ff, launch: true, reach: 95 }, { cooldown: 42 }),
    K('Guardia Patriota', 'Contraataque defensivo.', 100, { window: 32, color: 0x6ec6ff }),
    P('Sol de Mayo', 'Ataque radiante solar que cae del cielo.', 82,
      { vis: 'sun', color: 0xffe9a0, color2: 0x6ec6ff, speed: 4, w: 80, h: 80, yOff: 150, life: 70, spawn: 'sky', gravity: 0.3 }, { cooldown: 60 }),
  ],
  fatality: fat('EL SOL DE LA PATRIA', 'Belgrano clava su sable y alza un sol gigante: una ola celeste y blanca lo cubre todo.', 'UDFB', 'sun', 0x6ec6ff, 0xffffff, 'Ni el oro ni el poder: la libertad es mi bandera.'),
  secondary: fat('Bandera de Macha', 'Un águila de luz acompaña la bandera.', 'FBBD', 'eagle', 0x6ec6ff, 0xffffff, 'Ahí tienen, la bandera.'),
  ai: { aggression: 0.5, zoning: 0.4, defense: 0.5, preferredRange: 170 },
});
