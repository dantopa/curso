# LIBERTADORES: BLOOD OF INDEPENDENCE

> **LA LIBERTAD SE CONQUISTA. LA LEYENDA SE FORJA.**

Juego de pelea 2D cinematográfico para navegador (escritorio y móvil). Una historia alternativa donde los grandes
libertadores, estrategas y guerreros indígenas de Latinoamérica son convocados a un torneo en una dimensión
misteriosa. Los personajes se inspiran en figuras históricas; **los poderes, combates, diálogos y eventos son ficticios**.

Arte de combate, escenarios, música y efectos son originales y procedurales (animación esquelética dibujada en código,
Web Audio API). Los **retratos pintados** de la selección de personaje (`public/assets/portraits/<id>.jpg`) provienen del
mockup provisto por el autor del proyecto; son opcionales: si falta un archivo se usa el retrato procedural. Se pueden
reemplazar por arte propio sin tocar código (mismo nombre de archivo, ~120×200 px o mayor).

## Requisitos y comandos

Node 18+.

```bash
npm install
npm run dev       # servidor de desarrollo (http://localhost:5173)
npm run build     # typecheck + build de producción en dist/
npm run preview   # sirve dist/
npm run test      # tests (Vitest): motor de combate, roster, torneo, IA y balance
```

Parámetro de URL `?canvas` fuerza el renderer Canvas 2D (útil si WebGL falla o para pruebas headless).

## Modos de juego

* **Torneo de Leyendas** – 20 luchadores, eliminación directa: **4 combates preliminares** (8 luchadores) → los 4
  ganadores + **12 luchadores con pase directo (bye)** forman los **16** del cuadro principal → 8 octavos → 4 cuartos →
  2 semifinales → 1 final. (El enunciado habla de «8 con bye» y «16 avanzan»; con 20 inscriptos y 4 preliminares la
  aritmética exacta es 12 byes + 4 ganadores = 16, que es lo implementado.) Los combates CPU-vs-CPU se resuelven
  con el mismo motor de combate y la misma IA (simulación sin render). El cuadro se muestra visualmente y se actualiza tras cada pelea;
  el progreso se guarda (se puede continuar). Al final: pantalla de resultados con campeón, subcampeón y todos los
  resultados. La dificultad sube en semifinales y final.
* **Combate rápido** – elegí peleador, rival (o `R` para aleatorio), arena (9), dificultad de la IA (Novato, Peleador,
  Veterano, Leyenda), rondas (mejor de 1/3/5) y tiempo.
* **Versus local** – 2 jugadores en el mismo teclado.

## Controles (remapeables en Opciones → Configurar controles)

| Acción | Jugador 1 | Jugador 2 |
|---|---|---|
| Mover izq/der | A / D | ← / → |
| Saltar | W | ↑ |
| Agacharse | S | ↓ |
| Ataque ligero | J | Num 1 (o 1) |
| Ataque pesado | K | Num 2 (o 2) |
| Especial | L | Num 3 (o 3) |
| Bloquear | U | Num 4 (o 4) |
| Agarre | I | Num 5 (o 5) |
| Remate / Definitivo | O | Num 6 (o 6) |

Pausa: `Esc` o `P`. Menús: flechas/WASD, Enter/J confirmar, Esc volver (también ratón/touch). Hay soporte básico de gamepad
y **controles táctiles en pantalla** (automáticos en móviles, configurable).

## Sistema de combate

* Movimiento, doble toque para correr / paso atrás con invulnerabilidad, salto, agacharse, bloqueo (bajos se bloquean
  agachado; aéreos parado), ligero, pesado, aéreos, agarre (ignora la guardia).
* **Combos**: Ligero→Ligero→Ligero→Pesado, cancelaciones a especial al conectar, lanzador (agachado + pesado), *juggles*
  con límite, **escalado de daño** por golpe, *hit-stop*, stun, knockback, empuje en esquinas, castigo por ataques inseguros.
  Contador de golpes y daño en tiempo real.
* **Especiales**: Especial = neutro, `→ + Especial`, `↓ + Especial`, `↑ + Especial` → 4 especiales distintos por
  peleador (proyectiles, cargas espectrales, combos, buffs, contraataques, teletransportes, trampas, barreras, aéreos,
  evasivas, agarres con lazo…), cada uno con su enfriamiento.
* **Medidor**: se llena al dar y recibir daño. **EX** (Bloquear + Especial, 50), **rompeguardia** (Pesado mientras
  bloqueás, 25) y **Definitivo** cinemático con medidor 100 (botón Remate durante el combate).
* **Remates** (*fatalities*): sólo tras ganar la ronda final. Aparece una ventana de ~11 s: ingresá la secuencia
  de direcciones de tu peleador y apretá Remate. Cada uno tiene cinemática, efectos y sonido propios (sin gore: el rival se
  disuelve en energía), se puede saltear con cualquier tecla. Cada peleador tiene además un **remate secundario**
  desbloqueable (5 victorias con ese peleador, o ganar el torneo; opción de desbloquear todo en Opciones).
  La secuencia se ve en la selección de personaje y en el menú de pausa.
* **IA** con perfil por personaje (agresividad, zoning, agarres, defensa, emboscadas, distancia preferida) y 4 niveles
  de dificultad (reacción, bloqueo, encadenados, uso de EX/Definitivo).

## Plantel (20)

Simón Bolívar, José de San Martín, Túpac Amaru II, Antonio José de Sucre, Toussaint Louverture, Miguel Hidalgo,
José María Morelos, Bernardo O'Higgins, José Gervasio Artigas, Francisco de Miranda, Martín Miguel de Güemes,
José María Córdova, Benito Juárez, Vicente Guerrero, Agustín de Iturbide, José Martí, Micaela Bastidas, Túpac Katari,
Manco Inca y Manuel Belgrano. Cada uno con stats, normales, 4 especiales, remate, remate secundario y perfil de IA
definidos **como datos** (`src/characters/`).

## Arquitectura

```
src/
  main.ts             arranque de Phaser
  game/               flujo y singletons (input, touch)
  scenes/             Boot, Menu, Settings/Remap, HowTo, Select, Setup, Fight, Tournament, Results
  combat/             motor puro (sin Phaser): tipos, fighter, moves, sim (reglas, rondas, hit logic)
  characters/         datos: builders + roster1/roster2 (20 luchadores)
  ai/                 IA (ai.ts) y simulación headless (headless.ts)
  data/               stages.ts (9 arenas), tournament.ts (cuadro y avance)
  ui/                 fighterRenderer (animación esquelética procedural), projectileRenderer, stageRenderer,
                      hud, fatalityPlayer, theme/menús
  fatality/           24 efectos cinemáticos procedurales
  audio/              AudioManager: SFX y música 100% sintetizados (Web Audio) + locutor (SpeechSynthesis)
  systems/            input (teclado/gamepad/touch), storage (LocalStorage), efectos de partículas, touch
  utils/              rng, helpers
tests/                Vitest: simulación, roster, torneo, IA y balance (round-robin)
```

La lógica de juego (`src/combat`, `src/ai`, `src/data`) no depende de Phaser y corre a paso fijo de 60 fps, así que se
puede probar y simular sin renderizar. Agregar un personaje = agregar un `makeCharacter({...})` y sumarlo a `ROSTER`; el
motor, la IA, la selección, el torneo y los tests lo recogen solos (el torneo exige exactamente 20 inscriptos).

Rendimiento: el arte se dibuja con `Graphics` cada frame; en máquinas sin GPU (WebGL por software) puede ir lento: usá
`?canvas` o un navegador con aceleración por hardware.

## Arte pintado en combate

Los 20 luchadores tienen ilustración pintada de cuerpo entero (`public/assets/fighters/<id>/idle.png`), generada
localmente con SDXL-Turbo (`scripts/art/generate.py` + `characters.json`, recorte con rembg, selección e instalación con
`scripts/art/install.py`; `scripts/art/rescue.py` re-recorta descartes con un modelo de segmentación de personas) y
animada como títere de papel (piernas/torso/cabeza con bisagras) más efectos 2.5D (desactivables en Opciones).
Si falta la ilustración de un personaje se usa el render procedural. Se aceptan además poses extra por personaje:
`public/assets/fighters/<id>/<pose>.png` + `npm run art:manifest`. Ver `docs/ART_PIPELINE.md` (formato, poses y
animación por transformaciones) y `npm run art:prompts` (genera `docs/ART_PROMPTS.md` con un prompt por personaje y pose).
Se puede migrar de a un personaje; los que no tienen sprites siguen con el render procedural.

## Créditos

Diseño, código, arte y audio generados proceduralmente. Ficción histórica de homenaje; sin relación con juegos ni marcas
existentes.
