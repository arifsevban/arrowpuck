/**
 * ParticleSystem.js - Minimalist Physical Micro-Sparks
 * Emits crisp, vector-sharp kinetic sparks upon impact instead of noisy confetti.
 */

import { MathUtils } from '../utils/MathUtils.js';

class Spark {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life;
  }

  update(dt) {
    this.life -= dt;
    this.vy += 0.22; // subtle spark gravity
    this.vx *= 0.96; // air drag
    this.vy *= 0.96;
    this.x += this.vx;
    this.y += this.vy;
  }

  get isDead() {
    return this.life <= 0;
  }

  render(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    // Orient spark along motion vector for realistic kinetic streak
    const speed = Math.hypot(this.vx, this.vy);
    const angle = Math.atan2(this.vy, this.vx);
    const length = Math.max(this.size, this.size * 1.5 + speed * 0.4);

    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.size;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }
}

export class ParticleSystem {
  /**
   * @param {Object} [options]
   * @param {Object} [options.theme]
   */
  constructor({ theme = {} } = {}) {
    this.particles = [];
    this.accentColor = theme.primaryColor || '#f59e0b';
    this.palette = [
      this.accentColor,
      '#fbbf24',
      '#ffffff',
      '#e4e4e7',
      '#a1a1aa'
    ];
  }

  /**
   * Spawns physical micro-sparks at the impact location.
   * 
   * @param {number} x - Impact X coordinate
   * @param {number} y - Impact Y coordinate
   * @param {number} impactAngle - Direction of arrow at impact
   * @param {number} [count=20] - Number of sparks
   */
  emitSparks(x, y, impactAngle, count = 22) {
    // Sparks spray backward and outward from the collision point
    const reboundAngle = impactAngle + Math.PI;

    for (let i = 0; i < count; i++) {
      // Angular spread centered around rebound vector
      const spread = MathUtils.randomRange(-Math.PI * 0.55, Math.PI * 0.55);
      const angle = reboundAngle + spread;
      const speed = MathUtils.randomRange(2.0, 7.5);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = this.palette[Math.floor(Math.random() * this.palette.length)];
      const size = MathUtils.randomRange(1.2, 2.0);
      const life = MathUtils.randomRange(0.35, 0.65);

      this.particles.push(new Spark(x, y, vx, vy, color, size, life));
    }
  }

  /**
   * Updates all active sparks.
   * @param {number} dt - Delta time in seconds
   */
  update(dt = 0.016) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.isDead) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Renders active micro-sparks.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (this.particles.length === 0) return;
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].render(ctx);
    }
  }

  /**
   * Clears all sparks.
   */
  clear() {
    this.particles = [];
  }
}
