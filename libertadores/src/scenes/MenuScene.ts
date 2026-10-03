import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { AudioManager } from '../audio/AudioManager';
import { getProgress } from '../systems/storage';
import { CSS, MenuBackdrop, MenuList, fadeIn, fadeTo, txt } from '../ui/theme';
import { ROSTER } from '../characters';
import { drawPortrait } from '../ui/fighterRenderer';

export class MenuScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  constructor() { super('Menu'); }
  create(): void {
    fadeIn(this);
    AudioManager.get().playMusic('menu');
    this.bd = new MenuBackdrop(this);
    txt(this, 80, 110, 'LIBERTADORES', 78, CSS.goldLight, { title: true, shadow: true, strokeW: 6 });
    txt(this, 84, 192, 'BLOOD OF INDEPENDENCE', 30, CSS.gold, { title: true, strokeW: 4 });
    txt(this, 86, 236, 'La libertad se conquista. La leyenda se forja.', 20, CSS.dim);

    // decorative portrait wall on the right
    const g = this.add.graphics().setDepth(-30);
    const cols = 5, size = 108;
    ROSTER.forEach((c, i) => {
      const x = 760 + (i % cols) * (size + 10) + size / 2, y = 90 + Math.floor(i / cols) * (size + 10) + size / 2;
      g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x - size / 2, y - size / 2, size, size, 8);
      g.lineStyle(2, 0x7a5a1c, 0.7); g.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 8);
      drawPortrait(g, c, x, y + 4, size - 8, { alpha: 0.78 });
    });

    const saved = getProgress().tournament;
    const hasSaved = !!saved && !saved.finished && !saved.eliminated;
    const items = [
      { label: 'Torneo de Leyendas', onSelect: () => fadeTo(this, 'Select', { mode: 'tournament' }) },
      ...(hasSaved ? [{ label: 'Continuar torneo', onSelect: () => fadeTo(this, 'Tournament', { resume: true }) }] : []),
      { label: 'Combate rápido', onSelect: () => fadeTo(this, 'Select', { mode: 'quick' }) },
      { label: 'Versus local (2 jugadores)', onSelect: () => fadeTo(this, 'Select', { mode: 'versus' }) },
      { label: 'Cómo jugar', onSelect: () => fadeTo(this, 'HowTo') },
      { label: 'Opciones', onSelect: () => fadeTo(this, 'Settings') },
    ];
    new MenuList(this, 90, 330, items, { size: 32, gap: 62, width: 520 });
    txt(this, 80, GAME_H - 38, 'Enter / J: confirmar   ·   Flechas / WASD: moverse   ·   Esc: volver', 16, CSS.dim);
  }
  update(t: number): void { this.bd.update(t); }
}
