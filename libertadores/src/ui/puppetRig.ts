import Phaser from 'phaser';

/** Per-frame parameters of the paper puppet (all in "facing right" local space, world pixels). */
export interface PuppetPose {
  rootDx: number; rootDy: number; rootRot: number; // rootRot: radians, + = forward (toward facing)
  pivotH: number;                                   // height (fraction of body) the root rotates around
  lift: number;                                     // extra height of the rotation pivot above the ground (lying down etc.)
  legSX: number; legSY: number; legSkew: number; legDx: number; legDy: number;
  upRot: number; upSX: number; upSY: number; upDx: number; upDy: number;
  headRot: number; headDx: number; headDy: number;
}
export const newPuppetPose = (): PuppetPose => ({
  rootDx: 0, rootDy: 0, rootRot: 0, pivotH: 0.4, lift: -1,
  legSX: 1, legSY: 1, legSkew: 0, legDx: 0, legDy: 0,
  upRot: 0, upSX: 1, upSY: 1, upDx: 0, upDy: 0,
  headRot: 0, headDx: 0, headDy: 0,
});
export function resetPuppetPose(p: PuppetPose): PuppetPose {
  p.rootDx = 0; p.rootDy = 0; p.rootRot = 0; p.pivotH = 0.4; p.lift = -1;
  p.legSX = 1; p.legSY = 1; p.legSkew = 0; p.legDx = 0; p.legDy = 0;
  p.upRot = 0; p.upSX = 1; p.upSY = 1; p.upDx = 0; p.upDy = 0;
  p.headRot = 0; p.headDx = 0; p.headDy = 0;
  return p;
}

// Band layout, as fractions of the texture height measured from the top. Bands overlap so no seam shows.
const HEAD_Y0 = 0, HEAD_Y1 = 0.225, NECK = 0.19;
const TORSO_Y0 = 0.165, TORSO_Y1 = 0.59, HIP = 0.54;
const LEGS_Y0 = 0.485, LEGS_Y1 = 1;

type Img = Phaser.GameObjects.Image;

/** Three images (legs / torso / head) cut out of one texture and hinged at the hip and neck. */
export class PuppetRig {
  readonly root: Phaser.GameObjects.Container;
  private up: Phaser.GameObjects.Container;
  private legs: Img; private torso: Img; private head: Img;
  private key = '';
  private hipW = 0; private neckRel = 0; private bodyH = 0;

  constructor(scene: Phaser.Scene) {
    this.legs = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    this.torso = scene.add.image(0, 0, '__DEFAULT');
    this.head = scene.add.image(0, 0, '__DEFAULT');
    this.up = scene.add.container(0, 0, [this.torso, this.head]);
    this.root = scene.add.container(0, 0, [this.legs, this.up]);
    this.root.setVisible(false);
  }

  /** (Re)bind to a texture; creates the band frames once per texture. */
  private bind(scene: Phaser.Scene, key: string, base: number): void {
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage() as { width: number; height: number };
    const W = src.width, H = src.height;
    const fr = (n: string, y0: number, y1: number) => {
      const name = `${key}__${n}`;
      if (!tex.has(name)) tex.add(name, 0, 0, Math.round(y0 * H), W, Math.round((y1 - y0) * H));
      return name;
    };
    if (this.key !== key) {
      this.key = key;
      this.legs.setTexture(key, fr('legs', LEGS_Y0, LEGS_Y1)).setOrigin(0.5, 1);
      this.torso.setTexture(key, fr('torso', TORSO_Y0, TORSO_Y1)).setOrigin(0.5, (HIP - TORSO_Y0) / (TORSO_Y1 - TORSO_Y0));
      this.head.setTexture(key, fr('head', HEAD_Y0, HEAD_Y1)).setOrigin(0.5, (NECK - HEAD_Y0) / (HEAD_Y1 - HEAD_Y0));
    }
    this.bodyH = H * base;
    this.hipW = (1 - HIP) * H * base;
    this.neckRel = (HIP - NECK) * H * base;
  }

  /** Apply a pose. `base` is world-pixels per texel. */
  apply(scene: Phaser.Scene, key: string, base: number, x: number, y: number, face: number, alpha: number, flash: boolean, p: PuppetPose, fill = -1, sx = 1): void {
    this.bind(scene, key, base);
    const r = this.root;
    r.setVisible(true);
    const rot = p.rootRot * face;
    const m = p.pivotH * this.bodyH;
    const h = p.lift >= 0 ? p.lift : m;
    // rotate around a point `m` above the feet, then drop that point to height `h`
    r.setPosition(x + p.rootDx * face - m * Math.sin(rot), y + p.rootDy - h + m * Math.cos(rot));
    r.setRotation(rot);
    r.setScale(face * sx, 1);
    const L = this.legs;
    // legs pivot at the feet: a small rotation reads as a skew/step and carries the hip sideways
    L.setPosition(p.legDx, p.legDy).setScale(base * p.legSX, base * p.legSY).setRotation(p.legSkew);
    const hl = this.hipW * p.legSY;
    const hipX = Math.sin(p.legSkew) * hl, hipY = -Math.cos(p.legSkew) * hl + p.legDy;
    const u = this.up;
    u.setPosition(p.upDx + p.legDx + hipX, hipY + p.upDy).setRotation(p.upRot).setScale(p.upSX, p.upSY);
    this.torso.setScale(base);
    this.head.setScale(base).setPosition(p.headDx, -this.neckRel + p.headDy).setRotation(p.headRot);
    L.setAlpha(alpha); this.torso.setAlpha(alpha); this.head.setAlpha(alpha);
    if (fill >= 0) { L.setTintFill(fill); this.torso.setTintFill(fill); this.head.setTintFill(fill); }
    else if (flash) { L.setTintFill(0xffffff); this.torso.setTintFill(0xffffff); this.head.setTintFill(0xffffff); }
    else { L.clearTint(); this.torso.clearTint(); this.head.clearTint(); }
  }

  hide(): void { this.root.setVisible(false); }
  destroy(): void { this.root.destroy(); }
}
