import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../combat/types';
import { ACTIONS, ACTION_LABEL, getSettings } from '../systems/storage';
import { COLORS, CSS, MenuBackdrop, fadeIn, fadeTo, onNav, panel, screenTitle, txt } from '../ui/theme';

export class HowToScene extends Phaser.Scene {
  private bd!: MenuBackdrop;
  constructor() { super('HowTo'); }
  create(): void {
    fadeIn(this);
    this.bd = new MenuBackdrop(this);
    screenTitle(this, 'CÓMO JUGAR', 'Dominá el arte del combate libertador');
    const g = this.add.graphics();
    panel(g, 60, 135, 520, 520); panel(g, 600, 135, 620, 520);
    const s = getSettings();
    const nice = (c: string) => c.replace('Key', '').replace('Arrow', '↔').replace('Numpad', 'Num ').replace('Digit', '');
    txt(this, 90, 150, 'CONTROLES', 24, CSS.gold, { title: true });
    txt(this, 330, 150, 'J1', 20, CSS.gold, { title: true }); txt(this, 450, 150, 'J2', 20, CSS.gold, { title: true });
    ACTIONS.forEach((a, i) => {
      txt(this, 90, 192 + i * 42, ACTION_LABEL[a], 20, CSS.white);
      txt(this, 330, 192 + i * 42, nice(s.p1[a]), 20, CSS.goldLight);
      txt(this, 450, 192 + i * 42, nice(s.p2[a]), 20, CSS.goldLight);
    });
    txt(this, 90, 620, 'Podés reasignar teclas en Opciones.', 16, CSS.dim);
    const lines = [
      ['ESPECIALES', 'Especial = neutro, → + Especial, ↓ + Especial, ↑ + Especial: cuatro especiales distintos por peleador. Cada uno tiene su propio enfriamiento.'],
      ['COMBOS', 'Ligero → Ligero → Pesado. Agachado + Pesado lanza al rival por el aire. Cancelá con un Especial al conectar.'],
      ['MEDIDOR', 'Se llena al dar y recibir daño. Bloquear + Especial = versión EX (50). Mientras bloqueás, Pesado rompe la guardia (25). Con 100, Definitivo (O / Num6) lanza un especial devastador.'],
      ['DEFENSA', 'Bloquear frena los golpes. Los bajos se bloquean agachado; los aéreos, parado. El agarre ignora la guardia.'],
      ['REMATE', 'Al ganar la ronda final aparece la ventana de remate: ingresá la secuencia de direcciones de tu peleador y apretá Remate. Mirá la secuencia en la selección de personaje y en el pausa.'],
      ['SECUNDARIO', 'Cada peleador tiene un remate secundario: se desbloquea con 5 victorias, o al ganar el torneo.'],
      ['DOBLE TOQUE', 'Tocá dos veces → o ← para correr o hacer un paso atrás con invulnerabilidad.'],
    ];
    let y = 150;
    for (const [h, b] of lines) {
      txt(this, 625, y, h, 18, CSS.gold, { title: true });
      const t = txt(this, 625, y + 24, b, 17, CSS.white, { wrap: 570 });
      y += 24 + t.height + 14;
    }
    txt(this, GAME_W / 2, GAME_H - 26, 'Esc / Enter: volver', 16, CSS.dim, { origin: [0.5, 0.5] });
    onNav(this, (k) => { if (k === 'back' || k === 'confirm') fadeTo(this, 'Menu'); });
    this.input.on('pointerdown', () => fadeTo(this, 'Menu'));
    void COLORS;
  }
  update(t: number): void { this.bd.update(t); }
}
