import Phaser from 'phaser';
import type { AnimName, CharacterDef, FighterView } from '../combat/types';
import { ARENA } from '../combat/types';
import { drawFighter, type DrawOpts } from './fighterRenderer';

/**
 * Painted-sprite support. Drop transparent PNGs (character facing RIGHT, feet at the bottom edge) into
 * public/assets/fighters/<id>/<pose>.png and run `npm run art:manifest`. Only `idle` is required; missing poses
 * fall back along POSE_FALLBACK. Characters without sprites keep using the procedural renderer.
 */
export type Pose = 'idle' | 'walk' | 'crouch' | 'jump' | 'light' | 'heavy' | 'special' | 'block' | 'hit' | 'down' | 'win';
export const POSES: Pose[] = ['idle', 'walk', 'crouch', 'jump', 'light', 'heavy', 'special', 'block', 'hit', 'down', 'win'];
const POSE_FALLBACK: Record<Pose, Pose[]> = {
  idle: [], walk: ['idle'], crouch: ['idle'], jump: ['idle'], light: ['heavy', 'idle'], heavy: ['light', 'idle'],
  special: ['heavy', 'light', 'idle'], block: ['crouch', 'idle'], hit: ['idle'], down: ['hit', 'idle'], win: ['idle'],
};
const registry = new Map<string, Set<Pose>>();
export const texKey = (id: string, pose: Pose) => `fighter_${id}_${pose}`;
export function registerSprites(id: string, poses: Pose[]): void { registry.set(id, new Set(poses)); }
export function hasSprites(id: string): boolean { return registry.get(id)?.has('idle') ?? false; }

function poseFor(anim: AnimName): Pose {
  switch (anim) {
    case 'walkF': case 'walkB': case 'dash': case 'backdash': return 'walk';
    case 'crouch': case 'getup': return 'crouch';
    case 'crouchBlock': case 'block': return 'block';
    case 'jumpUp': case 'jumpDown': case 'aerial': return 'jump';
    case 'lightA': case 'airLight': case 'crouchLight': return 'light';
    case 'heavyA': case 'airHeavy': case 'crouchHeavy': case 'slash': case 'rush': case 'throw': return 'heavy';
    case 'cast': case 'buff': case 'counter': return 'special';
    case 'hit': case 'launched': case 'thrown': return 'hit';
    case 'knockdown': case 'dead': case 'dazed': return 'down';
    case 'win': return 'win';
    default: return 'idle';
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** One per on-screen fighter. Uses a painted Image when sprites exist, otherwise the procedural renderer. */
export class FighterVisual {
  private img: Phaser.GameObjects.Image | null = null;
  constructor(
    private scene: Phaser.Scene, private parent: Phaser.GameObjects.Container | null, readonly char: CharacterDef,
    private o: { after?: Phaser.GameObjects.GameObject; depth?: number } = {},
  ) {}

  get sprite(): boolean { return hasSprites(this.char.id); }

  private ensure(): Phaser.GameObjects.Image {
    if (!this.img) {
      this.img = this.scene.add.image(0, 0, texKey(this.char.id, 'idle')).setOrigin(0.5, 1);
      if (this.o.depth !== undefined) this.img.setDepth(this.o.depth);
      if (this.parent) {
        if (this.o.after) this.parent.addAt(this.img, this.parent.getIndex(this.o.after) + 1); else this.parent.add(this.img);
      }
    }
    return this.img;
  }

  private resolve(p: Pose): Pose {
    const have = registry.get(this.char.id)!;
    if (have.has(p)) return p;
    for (const f of POSE_FALLBACK[p]) if (have.has(f)) return f;
    return 'idle';
  }

  /** `g` is the shared graphics layer (shadow, auras, trails; also used for the procedural fallback). */
  draw(g: Phaser.GameObjects.Graphics, f: FighterView, o: DrawOpts = {}): void {
    if (!this.sprite) { this.img?.setVisible(false); drawFighter(g, f, o); return; }
    const img = this.ensure();
    if (f.hidden) { img.setVisible(false); return; }
    const want = o.pose ?? f.anim;
    const wantPose = poseFor(want);
    const pose = this.resolve(wantPose);
    const key = texKey(this.char.id, pose);
    if (img.texture.key !== key) img.setTexture(key);
    const idleTex = this.scene.textures.get(texKey(this.char.id, 'idle')).getSourceImage();
    const targetH = 196 * this.char.art.height * (o.scale ?? 1);
    const base = targetH / (idleTex.height || 1);
    // Every pose is drawn at the same pixels-to-world ratio as idle, so provide poses on the same canvas size.
    const sx = base;
    let scaleX = sx, scaleY = sx, rot = 0, dx = 0, dy = 0;
    const t = f.clock, face = f.facing;
    const phase = f.phase, pt = f.phaseT;
    const wasMissing = pose !== wantPose;
    switch (want) {
      case 'idle': case 'intro': scaleY *= 1 + 0.012 * Math.sin(t * 0.08); break;
      case 'walkF': case 'walkB': case 'dash': case 'backdash':
        dy = -Math.abs(Math.sin(t * 0.3)) * 5; rot = face * 0.035 * Math.sin(t * 0.3) + face * (want === 'dash' ? 0.12 : want === 'backdash' ? -0.1 : 0); break;
      case 'crouch': case 'crouchBlock': case 'getup': if (wasMissing) { scaleY *= 0.72; scaleX *= 1.08; } break;
      case 'jumpUp': scaleY *= 1.05; scaleX *= 0.96; break;
      case 'jumpDown': scaleY *= 0.97; scaleX *= 1.03; break;
      case 'lightA': case 'heavyA': case 'airLight': case 'airHeavy': case 'crouchLight': case 'crouchHeavy': case 'slash': case 'rush': case 'throw': {
        const heavy = want === 'heavyA' || want === 'airHeavy' || want === 'crouchHeavy' || want === 'rush';
        const k = heavy ? 1.5 : 1;
        if (phase === 'startup') { rot = -face * 0.1 * k * pt; dx = -face * 8 * k * pt; }
        else if (phase === 'active') { rot = face * 0.12 * k; dx = face * 26 * k; scaleX *= 1.04; }
        else if (phase === 'recovery') { rot = face * 0.12 * k * (1 - pt); dx = face * 26 * k * (1 - pt); }
        else { dx = face * 14; rot = face * 0.08; }
        if (want === 'crouchLight' || want === 'crouchHeavy') { if (wasMissing) scaleY *= 0.78; }
        break;
      }
      case 'cast': case 'buff': case 'counter': scaleY *= 1 + 0.02 * Math.sin(t * 0.3); dy = -3 * Math.abs(Math.sin(t * 0.2)); break;
      case 'block': dx = -face * 6; rot = -face * 0.05; break;
      case 'hit': dx = -face * 10 + Math.sin(f.animFrame * 1.7) * 3; rot = -face * 0.14; break;
      case 'launched': case 'thrown': rot = -face * clamp(0.5 + f.vy * 0.05, -0.6, 1.8); dy = -80; break;
      case 'knockdown': case 'dead': case 'dazed':
        if (wasMissing) { rot = -face * 1.5; dy = -4; } break;
      case 'win': dy = -Math.abs(Math.sin(t * 0.1)) * 6; break;
      case 'evade': img.setAlpha(0.4); break;
      default: break;
    }
    img.setVisible(true);
    img.setPosition(f.x + (o.xOffset ?? 0) + dx, f.y + (o.yOffset ?? 0) + dy);
    img.setScale(scaleX * (face === 1 ? 1 : -1), scaleY);
    img.setRotation(rot);
    img.setAlpha((o.alpha ?? 1) * (want === 'evade' ? 0.4 : 1));
    if ((o.flash ?? 0) > 0.05) img.setTintFill(0xffffff); else img.clearTint();
    // shadow, aura and slash trail go on the shared graphics layer
    if (o.shadow !== false) {
      const air = clamp((ARENA.ground - f.y) / 260, 0, 1);
      g.fillStyle(0x000000, 0.4 * (1 - air * 0.6)); g.fillEllipse(f.x + (o.xOffset ?? 0), ARENA.ground + 4, 120 * (1 - air * 0.4), 18);
    }
    if (f.buffs.length) {
      const c = f.char.art.palette.aura;
      for (let i = 0; i < 4; i++) { g.fillStyle(c, 0.07 + 0.02 * Math.sin(t * 0.2 + i)); g.fillEllipse(f.x, f.y - 100, 120 + i * 22, 220 + i * 18); }
    }
    if (phase === 'active' && (want === 'lightA' || want === 'heavyA' || want === 'slash' || want === 'airLight' || want === 'airHeavy')) {
      const heavy = want === 'heavyA' || want === 'airHeavy';
      const c = f.char.art.palette.aura;
      g.fillStyle(c, 0.28); g.beginPath();
      const cx = f.x + face * 20, cy = f.y - 110, r = heavy ? 150 : 110;
      g.arc(cx, cy, r, face === 1 ? -1.1 : Math.PI - 0.3, face === 1 ? 0.3 : Math.PI + 1.1, false);
      g.arc(cx, cy, r - (heavy ? 34 : 22), face === 1 ? 0.3 : Math.PI + 1.1, face === 1 ? -1.1 : Math.PI - 0.3, true);
      g.closePath(); g.fillPath();
    }
  }

  hide(): void { this.img?.setVisible(false); }
  destroy(): void { this.img?.destroy(); this.img = null; }
}
