import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { CSS, MenuBackdrop, fadeIn, txt } from '../ui/theme';
import { CHARACTER_IDS } from '../characters';
import { POSES, registerFrameAnims, registerSprites, setFlipIdle, texKey, type Pose } from '../ui/fighterVisual';
import { frameTexKey, validateAnimsFile, type FrameAnimsFile } from '../ui/frameAnim';

/** manifest.json entry: legacy `string[]` of poses, or `{ poses, anims?, flipIdle? }` (see scripts/art-manifest.mjs). */
type ManifestEntry = string[] | { poses?: string[]; anims?: boolean | string[]; flipIdle?: boolean };
const entryPoses = (e: ManifestEntry): string[] => (Array.isArray(e) ? e : e?.poses ?? []);

export class BootScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  constructor() { super('Boot'); }
  preload(): void {
    // Optional painted portraits: if a file is missing the procedural portrait is used instead.
    this.load.setPath('assets/portraits/');
    for (const id of CHARACTER_IDS) this.load.image(`portrait_${id}`, `${id}.jpg`);
    this.load.on('loaderror', () => { /* missing portrait → procedural fallback */ });
    // Optional painted fighter sprites listed by public/assets/fighters/manifest.json (npm run art:manifest)
    this.load.setPath('assets/fighters/');
    this.load.json('fighterManifest', 'manifest.json');
    this.load.once('filecomplete-json-fighterManifest', (_k: string, _t: string, data: Record<string, ManifestEntry>) => {
      this.load.setPath('assets/fighters/');
      for (const [id, e] of Object.entries(data ?? {})) {
        for (const p of entryPoses(e)) if (POSES.includes(p as Pose)) this.load.image(texKey(id, p as Pose), `${id}/${p}.png`);
        if (!Array.isArray(e) && e?.anims) {
          // frame-by-frame pack: load anims.json, then every frame it lists (texture keys fa_<id>_<anim>_<NN>)
          const jk = `fa_json_${id}`;
          this.load.once(`filecomplete-json-${jk}`, () => {
            const v = validateAnimsFile(this.cache.json.get(jk));
            if (!v.ok) { console.warn(`[anims] ${id}/anims.json invalid:`, v.errors); return; }
            this.load.setPath('assets/fighters/');
            for (const [name, def] of Object.entries(v.data.anims)) def.frames.forEach((path, i) => this.load.image(frameTexKey(id, name, i), `${id}/${path}`));
          });
          this.load.json(jk, `${id}/anims.json`);
        }
      }
    });
  }
  create(): void {
    const manifest = (this.cache.json.get('fighterManifest') ?? {}) as Record<string, ManifestEntry>;
    for (const [id, e] of Object.entries(manifest)) {
      const ok = entryPoses(e).filter((p) => this.textures.exists(texKey(id, p as Pose))) as Pose[];
      if (ok.includes('idle')) registerSprites(id, ok);
      if (!Array.isArray(e) && e?.flipIdle) setFlipIdle(id, true);
      if (!Array.isArray(e) && e?.anims) this.registerAnims(id);
    }
    fadeIn(this, 600);
    this.bd = new MenuBackdrop(this);
    txt(this, GAME_W / 2, 250, 'LIBERTADORES', 108, CSS.goldLight, { title: true, origin: [0.5, 0.5], shadow: true, strokeW: 8 });
    txt(this, GAME_W / 2, 350, 'BLOOD OF INDEPENDENCE', 40, CSS.gold, { title: true, origin: [0.5, 0.5], strokeW: 5 });
    txt(this, GAME_W / 2, 420, 'LA LIBERTAD SE CONQUISTA. LA LEYENDA SE FORJA.', 24, CSS.white, { origin: [0.5, 0.5] });
    const prompt = txt(this, GAME_W / 2, 560, 'TOCÁ LA PANTALLA O PRESIONÁ CUALQUIER TECLA', 26, CSS.goldLight, { origin: [0.5, 0.5], title: true });
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
    txt(this, GAME_W / 2, GAME_H - 28, 'Ficción histórica: los poderes, combates y diálogos son inventados.', 15, CSS.dim, { origin: [0.5, 0.5] });
    let go = false;
    const start = () => {
      if (go) return; go = true;
      const a = AudioManager.get(); a.unlock(); a.sfx('menuSelect'); a.playMusic('menu');
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    };
    this.input.once('pointerdown', start);
    this.input.keyboard?.once('keydown', start);
  }
  /** Registers the frames of an anims.json pack that actually loaded; animations with a missing frame are dropped. */
  private registerAnims(id: string): void {
    const v = validateAnimsFile(this.cache.json.get(`fa_json_${id}`));
    if (!v.ok) return;
    const file: FrameAnimsFile = v.data, keys: Record<string, string[]> = {};
    for (const [name, def] of Object.entries(file.anims)) {
      const ks = def.frames.map((_, i) => frameTexKey(id, name, i));
      if (ks.every((k) => this.textures.exists(k))) keys[name] = ks; else delete file.anims[name];
    }
    if (Object.keys(keys).length) registerFrameAnims(id, file, keys);
  }
  update(t: number): void { this.bd.update(t); }
}
