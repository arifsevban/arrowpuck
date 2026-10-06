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

class Shockwave {
  constructor(x, y, maxRadius = 85, duration = 0.58, color = '#f59e0b') {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.time = 0;
    this.color = color;
  }

  update(dt) {
    this.time += dt;
  }

  get isDead() {
    return this.time >= this.duration;
  }

  render(ctx) {
    const progress = Math.min(1, this.time / this.duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const radius = ease * this.maxRadius;
    const alpha = (1 - progress);

    ctx.save();
    // Primary outer expanding shockwave
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(1, 3.8 * (1 - progress));
    ctx.globalAlpha = alpha * 0.9;
    ctx.stroke();

    // Inner bright white shockwave ring
    if (radius > 12) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.8, 2.0 * (1 - progress));
      ctx.globalAlpha = alpha * 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }
}

class Glitter {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life;
    this.rotation = Math.random() * Math.PI;
    this.rotSpeed = (Math.random() - 0.5) * 8;
  }

  update(dt) {
    this.life -= dt;
    this.vy += 0.09;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed * dt;
  }

  get isDead() {
    return this.life <= 0;
  }

  render(ctx) {
    const progress = Math.max(0, this.life / this.maxLife);
    const alpha = Math.sin(progress * Math.PI); // Twinkle fade in and out
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // 4-pointed golden sparkle star
    const r = this.size;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -r * 2);
    ctx.quadraticCurveTo(0, 0, r * 2, 0);
    ctx.quadraticCurveTo(0, 0, 0, r * 2);
    ctx.quadraticCurveTo(0, 0, -r * 2, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r * 2);
    ctx.fill();

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
   * Spawns a grand, spectacular particle burst for razor-center bullseye hits.
   * Includes expanding dual shockwaves, high-speed kinetic sparks, and golden twinkling stars.
   * 
   * @param {number} x - Impact X coordinate
   * @param {number} y - Impact Y coordinate
   * @param {number} impactAngle - Direction of arrow at impact
   */
  emitBullseyeBurst(x, y, impactAngle) {
    // 1. Dual expanding shockwaves
    this.particles.push(new Shockwave(x, y, 95, 0.65, this.accentColor));
    this.particles.push(new Shockwave(x, y, 52, 0.45, '#ffffff'));

    // 2. High-speed radiant kinetic sparks (58 particles)
    const reboundAngle = impactAngle + Math.PI;
    const goldPalette = ['#f59e0b', '#fbbf24', '#fde68a', '#ffffff', '#fef08a'];

    for (let i = 0; i < 58; i++) {
      const spread = MathUtils.randomRange(-Math.PI * 0.75, Math.PI * 0.75);
      const angle = reboundAngle + spread;
      const speed = MathUtils.randomRange(3.5, 12.0);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = goldPalette[Math.floor(Math.random() * goldPalette.length)];
      const size = MathUtils.randomRange(1.6, 2.8);
      const life = MathUtils.randomRange(0.45, 0.85);

      this.particles.push(new Spark(x, y, vx, vy, color, size, life));
    }

    // 3. Shimmering 4-point golden glitter stars (24 stars)
    for (let i = 0; i < 24; i++) {
      const angle = MathUtils.randomRange(0, Math.PI * 2);
      const speed = MathUtils.randomRange(1.5, 6.0);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 1.2;
      const color = i % 2 === 0 ? '#fbbf24' : '#ffffff';
      const size = MathUtils.randomRange(2.2, 4.2);
      const life = MathUtils.randomRange(0.65, 1.2);

      this.particles.push(new Glitter(x, y, vx, vy, color, size, life));
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
