import { BUTTON_KEYS, emptyButtons, makeInputFrame, type Buttons, type InputFrame } from '../combat/types';
import { P2_ALIASES, getSettings, type KeyMap } from './storage';

/** Keyboard + gamepad + touch input for two local players. Edge detection happens in sample(). */
export class InputSystem {
  private keys = new Set<string>();
  /** Only swallow keys (preventDefault) during a fight; menus rely on Phaser seeing the raw events. */
  capture = false;
  private prev: [Buttons, Buttons] = [emptyButtons(), emptyButtons()];
  /** Touch overlay writes here (player 1). */
  readonly virtual: Buttons = emptyButtons();
  private onDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (this.capture && this.isMapped(e.code)) e.preventDefault();
  };
  private onUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); };

  attach(): void {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }
  detach(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    this.keys.clear();
  }
  private isMapped(code: string): boolean {
    const s = getSettings();
    return [s.p1, s.p2].some((m) => Object.values(m).includes(code)) || code in P2_ALIASES;
  }
  private isDown(map: KeyMap, action: keyof Buttons, player: 0 | 1): boolean {
    const code = map[action];
    if (this.keys.has(code)) return true;
    if (player === 1) {
      for (const [alias, target] of Object.entries(P2_ALIASES)) if (target === code && this.keys.has(alias)) return true;
    }
    return false;
  }
  private pad(player: 0 | 1, b: Buttons): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[player];
    if (!gp) return;
    const bt = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    if (ax < -0.5 || bt(14)) b.left = true;
    if (ax > 0.5 || bt(15)) b.right = true;
    if (ay < -0.5 || bt(12)) b.up = true;
    if (ay > 0.5 || bt(13)) b.down = true;
    if (bt(2)) b.light = true;
    if (bt(3)) b.heavy = true;
    if (bt(1)) b.special = true;
    if (bt(4) || bt(5) || bt(6)) b.block = true;
    if (bt(0)) b.throw = true;
    if (bt(7)) b.fatality = true;
  }
  held(player: 0 | 1): Buttons {
    const s = getSettings();
    const map = player === 0 ? s.p1 : s.p2;
    const b = emptyButtons();
    for (const k of BUTTON_KEYS) b[k] = this.isDown(map, k, player);
    this.pad(player, b);
    if (player === 0) for (const k of BUTTON_KEYS) if (this.virtual[k]) b[k] = true;
    // opposite directions cancel
    if (b.left && b.right) { b.left = false; b.right = false; }
    return b;
  }
  sample(player: 0 | 1): InputFrame {
    const h = this.held(player);
    const f = makeInputFrame(this.prev[player], h);
    this.prev[player] = h;
    return f;
  }
  reset(): void { this.prev = [emptyButtons(), emptyButtons()]; this.keys.clear(); }
}
