import Phaser from 'phaser';
import { drawHitSpark, drawSpecialFlash } from '../ui/projectileRenderer';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; g: number; kind: 'spark' | 'dust' | 'smoke' }
interface Burst { x: number; y: number; t: number; dur: number; strength: 'light' | 'heavy' | 'special'; color: number; ring: boolean }

/** Lightweight hit sparks, dust and bursts drawn into one Graphics object. */
export class Effects {
  private ps: Particle[] = [];
  private bursts: Burst[] = [];
  private rnd = (a: number, b: number) => a + Math.random() * (b - a);

  hit(x: number, y: number, strength: 'light' | 'heavy' | 'special', color = 0xffffff): void {
    const n = strength === 'light' ? 7 : strength === 'heavy' ? 14 : 22;
    for (let i = 0; i < n; i++) {
      const a = this.rnd(0, Math.PI * 2), v = this.rnd(2, strength === 'light' ? 6 : 11);
      this.ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 0, max: this.rnd(12, 28), color: i % 3 === 0 ? 0xffffff : color, size: this.rnd(1.5, 3.5), g: 0.25, kind: 'spark' });
    }
    this.bursts.push({ x, y, t: 0, dur: strength === 'light' ? 10 : 16, strength, color, ring: strength !== 'light' });
  }
  block(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = this.rnd(-1, 1) + (Math.random() < 0.5 ? 0 : Math.PI), v = this.rnd(2, 6);
      this.ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 14, color: 0x9ad0ff, size: 2, g: 0.1, kind: 'spark' });
    }
    this.bursts.push({ x, y, t: 0, dur: 12, strength: 'light', color: 0x9ad0ff, ring: true });
  }
  dust(x: number, y: number, n = 8): void {
    for (let i = 0; i < n; i++) {
      this.ps.push({ x: x + this.rnd(-20, 20), y: y - 2, vx: this.rnd(-2.2, 2.2), vy: this.rnd(-1.6, -0.2), life: 0, max: this.rnd(18, 34), color: 0xb8a37a, size: this.rnd(5, 11), g: -0.01, kind: 'dust' });
    }
  }
  burst(x: number, y: number, color: number): void {
    this.bursts.push({ x, y, t: 0, dur: 24, strength: 'special', color, ring: true });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.ps.push({ x, y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, life: 0, max: 22, color, size: 3, g: 0, kind: 'spark' });
    }
  }
  smoke(x: number, y: number, color: number): void {
    this.ps.push({ x, y, vx: this.rnd(-0.5, 0.5), vy: this.rnd(-1.5, -0.4), life: 0, max: 40, color, size: this.rnd(8, 16), g: 0, kind: 'smoke' });
  }
  clear(): void { this.ps = []; this.bursts = []; }

  update(): void {
    for (const p of this.ps) { p.life++; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.97; }
    this.ps = this.ps.filter((p) => p.life < p.max);
    for (const b of this.bursts) b.t++;
    this.bursts = this.bursts.filter((b) => b.t < b.dur);
  }
  draw(g: Phaser.GameObjects.Graphics): void {
    for (const p of this.ps) {
      const k = 1 - p.life / p.max;
      if (p.kind === 'spark') { g.fillStyle(p.color, k); g.fillCircle(p.x, p.y, p.size * (0.4 + k * 0.8)); }
      else { g.fillStyle(p.color, 0.28 * k); g.fillCircle(p.x, p.y, p.size * (1.4 - k * 0.4)); }
    }
    for (const b of this.bursts) {
      const t = b.t / b.dur;
      drawHitSpark(g, b.x, b.y, b.strength, b.color, t);
      if (b.ring && b.strength === 'special') drawSpecialFlash(g, b.x, b.y, b.color, t);
    }
  }
}
