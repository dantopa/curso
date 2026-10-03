import Phaser from 'phaser';
import type { AnimName, CharacterDef, FighterView } from '../combat/types';
import { ARENA } from '../combat/types';
import { drawFighter, type DrawOpts } from './fighterRenderer';
import { PuppetRig, newPuppetPose, resetPuppetPose, type PuppetPose } from './puppetRig';

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
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const smooth = (t: number) => t * t * (3 - 2 * t);

const IS_ATTACK: Partial<Record<AnimName, number>> = {
  lightA: 1, airLight: 1, crouchLight: 1, slash: 1.2, heavyA: 1.5, airHeavy: 1.5, crouchHeavy: 1.5, rush: 1.5, throw: 1.3,
};

const P = newPuppetPose();

/** Fill the (shared, reused) puppet pose for an animation. Local space: facing right, + = forward. */
function puppetFor(f: FighterView, want: AnimName): PuppetPose {
  const p = resetPuppetPose(P);
  const t = f.clock, af = f.animFrame, phase = f.phase, pt = f.phaseT;
  const atk = IS_ATTACK[want];
  if (atk !== undefined) {
    const k = atk;
    const low = want === 'crouchLight' || want === 'crouchHeavy';
    const air = want === 'airLight' || want === 'airHeavy';
    if (low) { p.legSY = 0.64; p.legSX = 1.1; }
    if (air) { p.legSY = 0.88; p.legSkew = 0.1; }
    let a = 0; // -1 = full wind-up, +1 = full strike
    if (phase === 'startup') a = -easeOut(pt);
    else if (phase === 'active') a = 1 + 0.12 * pt;
    else if (phase === 'recovery') a = 1 - smooth(pt);
    else a = 0.5;
    const wind = Math.max(0, -a), strike = Math.max(0, a);
    p.upRot = -0.2 * k * wind + 0.3 * k * strike;
    p.upDx = -9 * k * wind + 24 * k * strike;
    p.upSX = 1 + 0.03 * strike; p.upSY = 1 - 0.02 * strike + 0.015 * wind;
    p.upDy = 2 * wind;
    p.headRot = 0.12 * wind * k - 0.1 * strike * k; // head stays level while the torso swings
    p.headDx = 3 * strike * k;
    p.legSkew += -0.07 * wind * k + 0.08 * strike * k;
    p.legDx = 4 * strike * k - 3 * wind;
    p.rootDx = (want === 'rush' ? 34 : 7) * strike * k - 4 * wind;
    return p;
  }
  switch (want) {
    case 'idle': case 'intro': case 'evade': {
      const s = Math.sin(t * 0.08);
      p.upSY = 1 + 0.02 * s; p.upSX = 1 - 0.008 * s; p.upRot = 0.014 * Math.sin(t * 0.04);
      p.headDy = 1.6 * Math.sin(t * 0.08 + 0.9); p.headRot = 0.02 * Math.sin(t * 0.05 + 0.5);
      p.legSY = 1 - 0.004 * s; p.legSkew = 0.01 * Math.sin(t * 0.04);
      if (want === 'evade') { p.upRot = -0.14; p.upDx = -14; p.rootDx = -10; p.headRot = 0.08; }
      break;
    }
    case 'walkF': case 'walkB': case 'dash': case 'backdash': {
      const c = t * 0.3, dir = (want === 'walkB' || want === 'backdash') ? -1 : 1, fast = want === 'dash' || want === 'backdash';
      const sn = Math.sin(c);
      p.legSkew = 0.16 * sn * dir * (fast ? 1.5 : 1);
      p.legSX = 1 + 0.03 * Math.abs(sn); p.legSY = 1 - 0.03 * Math.abs(Math.cos(c));
      p.legDy = -Math.abs(sn) * 4; p.legDx = 3 * sn;
      p.upRot = 0.05 * dir + (want === 'dash' ? 0.22 : want === 'backdash' ? -0.14 : 0) + 0.02 * Math.cos(c);
      p.upDy = -Math.abs(Math.cos(c)) * 2; p.upDx = want === 'dash' ? 8 : 0;
      p.headDy = 2.2 * Math.sin(2 * c); p.headRot = -0.04 * Math.sin(c - 0.6) - p.upRot * 0.4;
      p.rootRot = want === 'dash' ? 0.06 : want === 'backdash' ? -0.05 : 0;
      break;
    }
    case 'crouch': case 'getup': case 'crouchBlock': {
      p.legSY = 0.6; p.legSX = 1.13; p.legSkew = 0.02;
      p.upRot = 0.05; p.upSX = 1.04; p.upDy = 2;
      const s = Math.sin(t * 0.1);
      p.upSY = 1 + 0.012 * s;
      if (want === 'crouchBlock') { p.upRot = -0.1; p.upDx = -8; p.headRot = 0.12; p.upSX = 1.08; }
      if (want === 'getup') {
        const a = 1 - smooth(clamp(f.animT, 0, 1));
        p.rootRot = -1.45 * a; p.lift = 22 + (1 - a) * 20; p.pivotH = 0.4;
        p.legSY = 0.6 + 0.4 * (1 - a) * 0.5;
      }
      break;
    }
    case 'block': {
      p.upRot = -0.07; p.upDx = -7; p.headRot = 0.09; p.upSX = 1.05; p.legSkew = -0.05; p.legSY = 0.94;
      p.headDy = 1.5 * Math.sin(t * 0.3);
      break;
    }
    case 'jumpUp': p.legSY = 1.04; p.legSX = 0.95; p.upSY = 1.03; p.upRot = 0.03; p.headDy = -2; p.legSkew = 0.05; break;
    case 'jumpDown': p.legSY = 0.9; p.legSX = 1.06; p.upSY = 0.98; p.upRot = -0.02; p.headDy = 2; p.legSkew = -0.05; break;
    case 'aerial': p.legSY = 0.85; p.legSkew = 0.12; p.upRot = 0.12; p.upDx = 8; p.headRot = -0.08; break;
    case 'cast': case 'buff': case 'counter': {
      const s = Math.sin(t * 0.3);
      p.upSY = 1.03 + 0.03 * s; p.upRot = -0.06 + 0.02 * s; p.headRot = -0.1; p.headDy = -3 - 2 * s;
      p.legSY = 0.97; p.rootDy = -2 * Math.abs(Math.sin(t * 0.2));
      break;
    }
    case 'hit': {
      const a = Math.max(0, 1 - af / 16), j = Math.sin(af * 1.7) * 2 * a;
      p.upRot = -0.4 * a; p.upDx = -16 * a + j; p.upSY = 1 - 0.04 * a; p.headRot = -0.32 * a; p.headDx = -6 * a;
      p.legSkew = -0.12 * a; p.rootDx = -9 * a; p.legSY = 1 - 0.05 * a;
      break;
    }
    case 'launched': case 'thrown': {
      p.rootRot = -clamp(0.5 + f.vy * 0.05, -0.6, 1.8); p.pivotH = 0.4; p.lift = 70 + 20 * Math.abs(Math.sin(p.rootRot));
      p.upRot = 0.1; p.legSkew = 0.15; p.headRot = -0.15;
      break;
    }
    case 'knockdown': case 'dead': {
      const a = easeOut(clamp(af / 11, 0, 1));
      p.rootRot = -1.5 * a; p.pivotH = 0.4; p.lift = 0.4 * 224 * f.char.art.height * (1 - a) + 20 * a;
      p.upRot = 0.08 * a; p.headRot = -0.2 * a; p.legSkew = 0.1 * a;
      break;
    }
    case 'dazed': {
      const s = Math.sin(t * 0.12);
      p.upRot = -0.1 + 0.08 * s; p.upDx = -6 + 6 * s; p.headRot = 0.25 * Math.sin(t * 0.12 + 1); p.headDy = 3;
      p.legSkew = 0.05 * s; p.legSY = 0.96;
      break;
    }
    case 'win': {
      const b = Math.abs(Math.sin(t * 0.1)), s = Math.sin(t * 0.1);
      p.rootDy = -b * 9; p.legSY = 1 - 0.04 * (1 - b); p.legSkew = 0.03 * s;
      p.upSY = 1.07; p.upRot = -0.12 + 0.03 * s; p.upDy = -3; p.upSX = 1.03;
      p.headRot = -0.1 + 0.06 * s; p.headDy = -4 - 2 * b;
      break;
    }
    default: break;
  }
  return p;
}

function crescent(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, th: number, a0: number, a1: number, face: number, color: number, alpha: number): void {
  // facing left mirrors the angles around the vertical axis
  const s0 = face === 1 ? a0 : Math.PI - a0, s1 = face === 1 ? a1 : Math.PI - a1;
  const anti = face !== 1;
  g.fillStyle(color, alpha); g.beginPath();
  g.arc(cx, cy, r, s0, s1, anti);
  // inner edge: slightly smaller circle shifted back so the crescent tapers at its tips
  g.arc(cx - face * th * 0.55, cy, r - th, s1, s0, !anti);
  g.closePath(); g.fillPath();
}

/** One per on-screen fighter. Uses a painted Image when sprites exist, otherwise the procedural renderer. */
export class FighterVisual {
  private img: Phaser.GameObjects.Image | null = null;
  private rig: PuppetRig | null = null;
  constructor(
    private scene: Phaser.Scene, private parent: Phaser.GameObjects.Container | null, readonly char: CharacterDef,
    private o: { after?: Phaser.GameObjects.GameObject; depth?: number } = {},
  ) {}

  get sprite(): boolean { return hasSprites(this.char.id); }

  private place(go: Phaser.GameObjects.Container | Phaser.GameObjects.Image): void {
    if (this.o.depth !== undefined) go.setDepth(this.o.depth);
    if (this.parent) {
      if (this.o.after) this.parent.addAt(go, this.parent.getIndex(this.o.after) + 1); else this.parent.add(go);
    }
  }

  private ensure(): Phaser.GameObjects.Image {
    if (!this.img) {
      this.img = this.scene.add.image(0, 0, texKey(this.char.id, 'idle')).setOrigin(0.5, 1);
      this.place(this.img);
    }
    return this.img;
  }

  private ensureRig(): PuppetRig {
    if (!this.rig) { this.rig = new PuppetRig(this.scene); this.place(this.rig.root); }
    return this.rig;
  }

  private resolve(p: Pose): Pose {
    const have = registry.get(this.char.id)!;
    if (have.has(p)) return p;
    for (const f of POSE_FALLBACK[p]) if (have.has(f)) return f;
    return 'idle';
  }

  /** `g` is the shared graphics layer (shadow, auras, trails; also used for the procedural fallback). */
  draw(g: Phaser.GameObjects.Graphics, f: FighterView, o: DrawOpts = {}): void {
    if (!this.sprite) { this.img?.setVisible(false); this.rig?.hide(); drawFighter(g, f, o); return; }
    if (f.hidden) { this.img?.setVisible(false); this.rig?.hide(); return; }
    const want = o.pose ?? f.anim;
    const wantPose = poseFor(want);
    const pose = this.resolve(wantPose);
    const idleTex = this.scene.textures.get(texKey(this.char.id, 'idle')).getSourceImage();
    const base = (224 * this.char.art.height * (o.scale ?? 1)) / (idleTex.height || 1);
    const t = f.clock, face = f.facing, phase = f.phase, pt = f.phaseT;
    const ox = o.xOffset ?? 0, oy = o.yOffset ?? 0;
    const alpha = (o.alpha ?? 1) * (want === 'evade' ? 0.4 : 1);
    const flash = (o.flash ?? 0) > 0.05;

    if (pose === 'idle') {
      // only idle art available (or asked for): paper-puppet it
      this.img?.setVisible(false);
      const p = puppetFor(f, want);
      this.ensureRig().apply(this.scene, texKey(this.char.id, 'idle'), base, f.x + ox, f.y + oy, face, alpha, flash, p);
    } else {
      this.rig?.hide();
      this.drawWhole(this.ensure(), f, o, want, wantPose, pose, base, alpha, flash);
    }

    // shadow, aura and slash trail go on the shared graphics layer
    if (o.shadow !== false) {
      const air = clamp((ARENA.ground - f.y) / 260, 0, 1);
      g.fillStyle(0x000000, 0.4 * (1 - air * 0.6) * (o.alpha ?? 1)); g.fillEllipse(f.x + ox, ARENA.ground + 4, 120 * (1 - air * 0.4), 18);
    }
    if (f.buffs.length) {
      const c = f.char.art.palette.aura;
      for (let i = 0; i < 4; i++) { g.fillStyle(c, 0.07 + 0.02 * Math.sin(t * 0.2 + i)); g.fillEllipse(f.x, f.y - 100, 120 + i * 22, 220 + i * 18); }
    }
    if (phase === 'active' && (want === 'lightA' || want === 'heavyA' || want === 'slash' || want === 'airLight' || want === 'airHeavy' || want === 'crouchLight' || want === 'crouchHeavy')) {
      const heavy = want === 'heavyA' || want === 'airHeavy' || want === 'crouchHeavy';
      const low = want === 'crouchLight' || want === 'crouchHeavy';
      const c = f.char.art.palette.aura;
      const cx = f.x + face * 20, cy = f.y - (low ? 62 : 110), r = heavy ? 150 : 110, th = heavy ? 40 : 26;
      const a0 = -1.15, a1 = a0 + (heavy ? 1.55 : 1.4) * (0.45 + 0.55 * clamp(pt * 2.5, 0, 1));
      const fade = 1 - 0.5 * pt;
      crescent(g, cx, cy, r + 12, th + 14, a0 - 0.1, a1 + 0.08, face, c, 0.14 * fade);
      crescent(g, cx, cy, r, th, a0, a1, face, c, 0.34 * fade);
      crescent(g, cx, cy, r - 4, th * 0.5, a0 + 0.12, a1 - 0.06, face, 0xffffff, 0.62 * fade);
      crescent(g, cx, cy, r - 6, th * 0.2, a0 + 0.2, a1 - 0.14, face, 0xffffff, 0.9 * fade);
      if (pt < 0.4) { // short white impact flash at the tip of the swing
        const k = 1 - pt / 0.4, tx = cx + face * Math.cos(a1) * (r - 8) * 1 , ty = cy + Math.sin(a1) * (r - 8);
        const R = (heavy ? 44 : 30) * (0.6 + 0.6 * pt * 2.5);
        g.fillStyle(0xffffff, 0.75 * k); g.fillCircle(tx, ty, R * 0.55);
        g.fillStyle(c, 0.35 * k); g.fillCircle(tx, ty, R);
        g.fillStyle(0xffffff, 0.85 * k);
        for (let i = 0; i < 4; i++) {
          const an = i * Math.PI / 2 + Math.PI / 4 + t * 0.05, l = R * 1.7, w = R * 0.16;
          const ca = Math.cos(an), sa = Math.sin(an);
          g.fillTriangle(tx + ca * l, ty + sa * l, tx - sa * w, ty + ca * w, tx + sa * w, ty - ca * w);
        }
      }
    }
  }

  /** Dedicated pose art: one whole image, animated by transforms (pose art wins over puppeting). */
  private drawWhole(img: Phaser.GameObjects.Image, f: FighterView, o: DrawOpts, want: AnimName, wantPose: Pose, pose: Pose, base: number, alpha: number, flash: boolean): void {
    const key = texKey(this.char.id, pose);
    if (img.texture.key !== key) img.setTexture(key);
    let scaleX = base, scaleY = base, rot = 0, dx = 0, dy = 0;
    const t = f.clock, face = f.facing, phase = f.phase, pt = f.phaseT;
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
      default: break;
    }
    img.setVisible(true);
    img.setPosition(f.x + (o.xOffset ?? 0) + dx, f.y + (o.yOffset ?? 0) + dy);
    img.setScale(scaleX * (face === 1 ? 1 : -1), scaleY);
    img.setRotation(rot);
    img.setAlpha(alpha);
    if (flash) img.setTintFill(0xffffff); else img.clearTint();
  }

  hide(): void { this.img?.setVisible(false); this.rig?.hide(); }
  destroy(): void { this.img?.destroy(); this.img = null; this.rig?.destroy(); this.rig = null; }
}
