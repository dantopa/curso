import { BUTTON_KEYS, type Buttons } from '../combat/types';

type Spec = { key: keyof Buttons; label: string; x: string; y: string; size: number; dpad?: boolean };
const SPECS: Spec[] = [
  { key: 'up', label: '▲', x: '14%', y: '58%', size: 62, dpad: true },
  { key: 'down', label: '▼', x: '14%', y: '82%', size: 62, dpad: true },
  { key: 'left', label: '◀', x: '4%', y: '70%', size: 62, dpad: true },
  { key: 'right', label: '▶', x: '24%', y: '70%', size: 62, dpad: true },
  { key: 'light', label: 'LIG', x: '70%', y: '68%', size: 62 },
  { key: 'heavy', label: 'PES', x: '80%', y: '58%', size: 62 },
  { key: 'special', label: 'ESP', x: '90%', y: '68%', size: 62 },
  { key: 'block', label: 'BLQ', x: '70%', y: '84%', size: 54 },
  { key: 'throw', label: 'AGR', x: '81%', y: '82%', size: 54 },
  { key: 'fatality', label: 'ULT', x: '91%', y: '84%', size: 54 },
];

/** DOM overlay with on-screen buttons for mobile. Writes to the shared `virtual` Buttons object. */
export class TouchControls {
  private root: HTMLElement | null;
  private els: HTMLElement[] = [];
  constructor(private virtual: Buttons) {
    this.root = document.getElementById('touch');
    if (!this.root) return;
    for (const s of SPECS) {
      const el = document.createElement('div');
      el.className = 'btn' + (s.dpad ? ' dpad' : '');
      el.textContent = s.label;
      el.style.left = s.x; el.style.top = s.y;
      el.style.width = el.style.height = `${s.size}px`;
      el.style.transform = 'translate(-50%,-50%)';
      const set = (v: boolean) => { this.virtual[s.key] = v; el.classList.toggle('down', v); };
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(true); });
      const up = (e: PointerEvent) => { e.preventDefault(); set(false); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', () => set(false));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(el);
      this.els.push(el);
    }
  }
  show(on: boolean): void {
    this.root?.classList.toggle('on', on);
    if (!on) for (const k of BUTTON_KEYS) this.virtual[k] = false;
  }
  destroy(): void {
    this.show(false);
    for (const e of this.els) e.remove();
    this.els = [];
  }
}

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && (('ontouchstart' in window) || (window.matchMedia?.('(pointer: coarse)').matches ?? false));
}
