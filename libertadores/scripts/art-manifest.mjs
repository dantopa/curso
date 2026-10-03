// Scans public/assets/fighters/<id>/ and writes public/assets/fighters/manifest.json
//   <pose>.png          legacy painted poses (idle required)
//   anims.json + anims/ frame-by-frame animation pack (see docs/ART_PIPELINE.md)
//   sprite.json         {"flipIdle": true} when the painted PNGs face LEFT
// Manifest entry: ["idle", ...]  (plain)  or  { poses, anims: [names], flipIdle? }  when a pack/flip is present.
import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../public/assets/fighters/', import.meta.url).pathname;
const POSES = ['idle', 'walk', 'crouch', 'jump', 'light', 'heavy', 'special', 'block', 'hit', 'down', 'win'];
if (!existsSync(root)) mkdirSync(root, { recursive: true });

function readAnims(id, dir) {
  const file = join(dir, 'anims.json');
  if (!existsSync(file)) return null;
  let j;
  try { j = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.warn(`! ${id}: anims.json is not valid JSON (${e.message}); ignored`); return null; }
  if (!j || typeof j !== 'object' || !j.anims || !Array.isArray(j.canvas) || !Array.isArray(j.anchor) || !(j.standHeight > 0)) {
    console.warn(`! ${id}: anims.json needs canvas, anchor, standHeight, anims; ignored`); return null;
  }
  const names = [];
  for (const [name, d] of Object.entries(j.anims)) {
    const ok = d && Array.isArray(d.frames) && d.frames.length > 0 && Array.isArray(d.durations) && d.durations.length === d.frames.length && typeof d.loop === 'boolean';
    if (!ok) { console.warn(`! ${id}: anims.${name} malformed (frames/durations/loop); the game will reject the pack`); continue; }
    const missing = d.frames.filter((p) => !existsSync(join(dir, p)));
    if (missing.length) { console.warn(`! ${id}: anims.${name} missing ${missing.length} frame file(s), e.g. ${missing[0]}`); continue; }
    names.push(name);
  }
  return names.length ? names : null;
}

const out = {};
for (const id of readdirSync(root)) {
  const dir = join(root, id);
  if (!statSync(dir).isDirectory()) continue;
  const poses = POSES.filter((p) => existsSync(join(dir, `${p}.png`)));
  const anims = readAnims(id, dir);
  let flipIdle = false;
  const sj = join(dir, 'sprite.json');
  if (existsSync(sj)) { try { flipIdle = !!JSON.parse(readFileSync(sj, 'utf8')).flipIdle; } catch { console.warn(`! ${id}: sprite.json invalid; ignored`); } }
  if (!poses.includes('idle') && !anims) { if (poses.length) console.warn(`! ${id}: missing required idle.png (ignored)`); continue; }
  out[id] = anims || flipIdle ? { poses, ...(anims ? { anims } : {}), ...(flipIdle ? { flipIdle: true } : {}) } : poses;
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify(out, null, 1));
console.log(`manifest: ${Object.keys(out).length} fighter(s) with sprites`, JSON.stringify(out));
