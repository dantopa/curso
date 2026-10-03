import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { CSS, MenuBackdrop, fadeIn, txt } from '../ui/theme';
import { CHARACTER_IDS } from '../characters';

export class BootScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  constructor() { super('Boot'); }
  preload(): void {
    // Optional painted portraits: if a file is missing the procedural portrait is used instead.
    this.load.setPath('assets/portraits/');
    for (const id of CHARACTER_IDS) this.load.image(`portrait_${id}`, `${id}.jpg`);
    this.load.on('loaderror', () => { /* missing portrait → procedural fallback */ });
  }
  create(): void {
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
  update(t: number): void { this.bd.update(t); }
}
