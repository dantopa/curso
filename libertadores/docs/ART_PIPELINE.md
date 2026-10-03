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
