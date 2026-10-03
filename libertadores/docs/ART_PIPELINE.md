# Painted fighter art pipeline

The game ships with procedural fighters. To make them look like the painted portraits, drop illustrations here:

```
public/assets/fighters/<id>/<pose>.png      e.g. public/assets/fighters/bolivar/idle.png
```

then run `npm run art:manifest` (writes `public/assets/fighters/manifest.json`) and reload. A fighter with an
`idle.png` is rendered from sprites everywhere (fight, cinematics, select, results); fighters without one keep the
procedural look, so you can migrate one character at a time.

## Format
* PNG with transparency, character **facing right**, **feet touching the bottom edge** of the image, small side margin.
* **Same canvas size for every pose of a character** (recommended 768×1024). Pixels-to-world scale is taken from `idle`.
* Poses: `idle` (required), `walk`, `crouch`, `jump`, `light`, `heavy`, `special`, `block`, `hit`, `down`, `win`.
  Missing poses fall back automatically (e.g. `light` → `heavy` → `idle`) and are animated with transforms
  (breathing, lunge, recoil, spin, lying down). Minimum viable set: `idle`, `light`, `heavy`, `hit`, `down`.
* The code adds shadows, auras, slash trails, hit flashes and knockback motion on top.

## Getting the art
`npm run art:prompts` writes `docs/ART_PROMPTS.md` with one prompt per character and pose, derived from the character
data. Generate `idle` from the existing portrait (`public/assets/portraits/<id>.jpg`) and use it as the reference for
the other poses so the face and costume stay consistent.

## Frame-by-frame animation packs (MK3 style, optional per character)
Instead of (or on top of) the single-pose PNGs a character can ship a frame animation pack:

```
public/assets/fighters/<id>/anims.json
public/assets/fighters/<id>/anims/<anim>/00.png, 01.png, ...
```
`npm run art:manifest` detects `anims.json` (and checks that every frame file exists) and lists the usable animation
names in `manifest.json`; BootScene then loads every frame as texture `fa_<id>_<anim>_<NN>`. Animations that are
missing fall back (hit_high → hit_body, crouch_light → light, ... → painted pose / puppet), so packs can be partial.

* Every frame: **1024x1024 transparent PNG, facing RIGHT**, ground contact point between the feet at pixel **(512, 1000)**,
  identical scale across ALL frames (standing height ≈ 820 px). The game scales by `224 * art.height / standHeight`.
* `anims.json` (TS type + validator in `src/ui/frameAnim.ts`):
  `{ "canvas":[1024,1024], "anchor":[512,1000], "standHeight":820, "anims": { "<name>": { "frames":[paths], "durations":[ticks],
  "loop":bool, "phases":["startup"|"active"|"recovery"|null,...] (attacks), "swordTip":[[x,y],...] (optional) } } }`
  (1 tick = 1/60 s, `durations` weight how long each frame stays on screen).
* Names: idle, walk_fwd, walk_back, crouch, jump, light, heavy, crouch_light, crouch_heavy, air_attack, block, crouch_block,
  hit_high, hit_body, knockdown, getup, special_cast, rush, counter, throw, turn, win, dazed, dead, intro.
* **Attacks follow the sim**: the frame comes from the sim phase (startup/active/recovery) and the progress inside it.
  Frames tagged `"active"` are on screen exactly while the hitbox is active (light = 3 ticks, heavy = 4, crouch light 3,
  crouch heavy 4, air light 9, air heavy 8): give an attack **at most as many active frames as active ticks**, otherwise
  the extra ones are skipped. Startup/recovery frames are spread over the phase's ticks the same way (weighted by `durations`).
  Specials: proj/teleport/buff → special_cast, rush → rush, combo → light hits then heavy finisher, counter → counter,
  aerial → air_attack, evade → walk_back.
* Loops (idle, walk_*, block, win...) advance by `durations`; one-shots (hit_*, knockdown, getup, dead, crouch) hold the
  last frame; `jump` is picked by vertical speed (first frame rising fast → last frame falling fast); `intro` spreads
  over the intro window.
* `turn` (3 frames, ~6 ticks): played when a grounded, actionable fighter changes facing; frames 0-1 are drawn with the old
  facing, the engine mirrors at the middle (tick 3), frame 2 is drawn with the new facing. Without a `turn` clip (and for
  puppets/procedural fighters) a quick squash-turn is used.
* `swordTip` (pixel coords per frame) draws a streak following the blade during active frames instead of the generic slash arc.

### Painted PNGs that face LEFT
Do not edit the PNG: add `public/assets/fighters/<id>/sprite.json` with `{"flipIdle": true}` and run `npm run art:manifest`.
All legacy pose PNGs of that character are mirrored. (Frame packs are always authored facing right.)
