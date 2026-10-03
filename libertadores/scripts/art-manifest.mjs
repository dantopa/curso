// Scans public/assets/fighters/<id>/<pose>.png and writes public/assets/fighters/manifest.json
import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../public/assets/fighters/', import.meta.url).pathname;
const POSES = ['idle', 'walk', 'crouch', 'jump', 'light', 'heavy', 'special', 'block', 'hit', 'down', 'win'];
if (!existsSync(root)) mkdirSync(root, { recursive: true });
const out = {};
for (const id of readdirSync(root)) {
  const dir = join(root, id);
  if (!statSync(dir).isDirectory()) continue;
  const poses = POSES.filter((p) => existsSync(join(dir, `${p}.png`)));
  if (poses.includes('idle')) out[id] = poses; else if (poses.length) console.warn(`! ${id}: missing required idle.png (ignored)`);
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify(out, null, 1));
console.log(`manifest: ${Object.keys(out).length} fighter(s) with sprites`, out);
