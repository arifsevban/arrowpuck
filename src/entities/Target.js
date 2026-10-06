/**
 * Target.js - Precision Minimalist Target Board
 * Renders concentric scoring rings, suspension mount, and elastic shake physics.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Target {
  /**
   * @param {Object} options
   * @param {number} options.x - Center X
   * @param {number} options.y - Center Y
   * @param {number} [options.radius=38] - Target radius in pixels
   * @param {Object} [options.theme] - Theme customization
   */
  constructor({ x, y, radius = 38, theme = {} }) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    this.theme = {
      accent: theme.primaryColor || '#f59e0b',
      outerRing: '#18181b',
      outerBorder: '#3f3f46',
      middleRing: '#27272a',
      innerRing: '#3f3f46',
      bullseye: theme.primaryColor || '#f59e0b',
      centerPin: '#ffffff',
      mountLine: 'rgba(113, 113, 122, 0.4)',
      ...theme
    };

    // Elastic shake state
    this.isShaking = false;
    this.shakeTime = 0;
    this.shakeDuration = 0.6;
    this.shakeIntensity = 0;
    this.shakeAngle = 0;

    // Current animated offsets
    this.offsetX = 0;
    this.offsetY = 0;
    this.tilt = 0;
  }

  /**
   * Updates target position (e.g. on window resize).
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Triggers elastic recoil and dampening when struck by an arrow.
   * 
   * @param {number} hitAngle - Flight angle of the striking arrow
   * @param {number} power - Impact intensity based on arrow speed
   */
  hit(hitAngle, power = 12) {
    this.isShaking = true;
    this.shakeTime = 0;
    this.shakeIntensity = Math.min(power, 16);
    this.shakeAngle = hitAngle;
  }

  /**
   * Per-frame shake integration using damped harmonic oscillation.
   * @param {number} dt - Delta time in seconds
   */
  update(dt = 0.016) {
    if (!this.isShaking) {
      this.offsetX = 0;
      this.offsetY = 0;
      this.tilt = 0;
      return;
    }

    this.shakeTime += dt;

    if (this.shakeTime >= this.shakeDuration) {
      this.isShaking = false;
      this.offsetX = 0;
      this.offsetY = 0;
      this.tilt = 0;
      return;
    }

    // Damped harmonic decay: A * exp(-lambda * t) * cos(omega * t)
    const decay = Math.exp(-8 * this.shakeTime);
    const oscillation = Math.cos(28 * this.shakeTime);
    const displacement = this.shakeIntensity * decay * oscillation;

    this.offsetX = Math.cos(this.shakeAngle) * displacement;
    this.offsetY = Math.sin(this.shakeAngle) * displacement;
    this.tilt = (displacement / this.radius) * 0.25;
  }

  /**
   * Renders the target board, mounting bracket/cord, and concentric rings.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.save();

    const curX = this.x + this.offsetX;
    const curY = this.y + this.offsetY;

    // 1. Suspension Cord / Ceiling Mount
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, curY - this.radius);
    ctx.strokeStyle = this.theme.mountLine;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cord top eyelet
    ctx.beginPath();
    ctx.arc(curX, curY - this.radius, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.outerBorder;
    ctx.fill();

    // 2. Target Board with Tilt
    ctx.translate(curX, curY);
    ctx.rotate(this.tilt);

    const R = this.radius;

    // Outer Target Rim Shadow / Base
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.outerRing;
    ctx.fill();
    ctx.strokeStyle = this.theme.outerBorder;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Outer Scoring Ring (0.66R to 1.0R) - 50 pts
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.66, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.middleRing;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Middle Scoring Ring (0.33R to 0.66R) - 150 pts
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.33, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.innerRing;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner Bullseye Ring (<= 0.33R) - 300 pts
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.bullseye;
    ctx.fill();

    // Precision Center Pin
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.centerPin;
    ctx.fill();

    // Subtle crosshair indicators on outer rim
    const tickLen = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Top tick
    ctx.moveTo(0, -R);
    ctx.lineTo(0, -R + tickLen);
    // Bottom tick
    ctx.moveTo(0, R);
    ctx.lineTo(0, R - tickLen);
    // Left tick
    ctx.moveTo(-R, 0);
    ctx.lineTo(-R + tickLen, 0);
    // Right tick
    ctx.moveTo(R, 0);
    ctx.lineTo(R - tickLen, 0);
    ctx.stroke();

    ctx.restore();
  }
}
