/**
 * Target.js - Precision Wall-Mounted Archery Target Board (Side Profile)
 * Features 5 graded difficulty intervals without cluttered numbers,
 * ambient drop-shadow depth, multi-layer composite core, and crisp caliper markings.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Target {
  /**
   * @param {Object} options
   * @param {number} options.x - Front strike surface X coordinate
   * @param {number} options.y - Center Y coordinate
   * @param {number} [options.height=250] - Total vertical board height
   * @param {number} [options.width=26] - Board thickness / depth
   * @param {Object} [options.theme] - Theme customization
   */
  constructor({ x, y, height = 250, width = 26, theme = {} }) {
    this.x = x;
    this.y = y;
    this.height = height;
    this.width = width;
    this.halfHeight = height / 2;

    this.theme = {
      accent: theme.primaryColor || '#f59e0b',
      accentBright: '#fbbf24',
      backplate: '#18181b',
      backplateBorder: '#3f3f46',
      zone5: '#1c1c23', // Outer edge (25 pts)
      zone4: '#272733', // Mid-outer (75 pts)
      zone3: '#373746', // Middle high (150 pts)
      zone2: '#4a4035', // Inner master (300 pts, warm brass)
      zone1: theme.primaryColor || '#f59e0b', // Razor bullseye (500 pts)
      ticks: 'rgba(255, 255, 255, 0.35)',
      ...theme
    };

    // Elastic shake and recoil state
    this.isShaking = false;
    this.shakeTime = 0;
    this.shakeDuration = 0.55;
    this.recoilIntensity = 0;
    this.tiltIntensity = 0;

    // Current animated offsets
    this.offsetX = 0;
    this.offsetY = 0;
    this.tilt = 0;
  }

  /**
   * Updates target position on resize.
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Triggers elastic recoil when struck by an arrow.
   */
  hit(impactY, impactSpeed = 15) {
    this.isShaking = true;
    this.shakeTime = 0;
    this.recoilIntensity = Math.min(Math.max(10, impactSpeed * 0.75), 20);

    // Tilt based on vertical distance from center
    const distFromCenter = impactY - this.y;
    this.tiltIntensity = MathUtils.clamp(distFromCenter / this.halfHeight, -1, 1) * 0.09;
  }

  /**
   * Per-frame recoil integration.
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

    // Damped harmonic decay: recoil pushes into the wall (+X)
    const decay = Math.exp(-9 * this.shakeTime);
    const oscillation = Math.cos(32 * this.shakeTime);

    this.offsetX = this.recoilIntensity * decay * oscillation;
    this.tilt = this.tiltIntensity * decay * oscillation;
  }

  /**
   * Renders the distinct side-profile archery target board.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.save();

    const baseX = this.x + this.offsetX;
    const baseY = this.y + this.offsetY;
    const H = this.halfHeight;
    const W = this.width;

    ctx.translate(baseX, baseY);
    ctx.rotate(this.tilt);

    // 1. Subtle Ambient Drop Shadow (lifts board off background page)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = -5;

    // Solid Wall Backing Plate (extends slightly above & below)
    const plateExtra = 8;
    ctx.fillStyle = this.theme.backplate;
    ctx.beginPath();
    ctx.roundRect(W - 4, -H - plateExtra, 12, this.height + plateExtra * 2, [0, 4, 4, 0]);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = this.theme.backplateBorder;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(W - 4, -H - plateExtra, 12, this.height + plateExtra * 2, [0, 4, 4, 0]);
    ctx.stroke();

    // Rivet screws on wall mount
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(W + 2, -H + 4, 2.2, 0, Math.PI * 2);
    ctx.arc(W + 2, H - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 2. Target Board Composite Core Base
    ctx.fillStyle = '#141418';
    ctx.beginPath();
    ctx.roundRect(0, -H, W, this.height, [4, 0, 0, 4]);
    ctx.fill();
    ctx.strokeStyle = this.theme.backplateBorder;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 3. 5 Graded Scoring Intervals (Increased challenge and precision)
    const z1 = 8;  // Razor Bullseye (500 pts, 16px span)
    const z2 = 22; // Inner Master   (300 pts, 44px span)
    const z3 = 48; // Middle High    (150 pts, 96px span)
    const z4 = 84; // Mid-Outer      (75 pts, 168px span)
    // z5 extends to H = 125 (25 pts, 250px span)

    // --- Zone 5: Outer Edge (Top & Bottom ends) ---
    ctx.fillStyle = this.theme.zone5;
    ctx.fillRect(1, -H + 1, W - 2, H - z4);
    ctx.fillRect(1, z4, W - 2, H - z4 - 1);

    // --- Zone 4: Mid-Outer Zones ---
    ctx.fillStyle = this.theme.zone4;
    ctx.fillRect(1, -z4, W - 2, z4 - z3);
    ctx.fillRect(1, z3, W - 2, z4 - z3);

    // --- Zone 3: Middle High Zones ---
    ctx.fillStyle = this.theme.zone3;
    ctx.fillRect(1, -z3, W - 2, z3 - z2);
    ctx.fillRect(1, z2, W - 2, z3 - z2);

    // --- Zone 2: Inner Master Zones (Warm brass accent tint) ---
    ctx.fillStyle = this.theme.zone2;
    ctx.fillRect(1, -z2, W - 2, z2 - z1);
    ctx.fillRect(1, z1, W - 2, z2 - z1);

    // --- Zone 1: Razor Bullseye Core (Pure gold / amber) ---
    ctx.fillStyle = this.theme.zone1;
    ctx.fillRect(1, -z1, W - 2, z1 * 2);

    // 4. Boundary Dividers between score zones
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    // Zone 4 boundaries
    ctx.moveTo(0, -z4);
    ctx.lineTo(W, -z4);
    ctx.moveTo(0, z4);
    ctx.lineTo(W, z4);
    // Zone 3 boundaries
    ctx.moveTo(0, -z3);
    ctx.lineTo(W, -z3);
    ctx.moveTo(0, z3);
    ctx.lineTo(W, z3);
    // Zone 2 boundaries
    ctx.moveTo(0, -z2);
    ctx.lineTo(W, -z2);
    ctx.moveTo(0, z2);
    ctx.lineTo(W, z2);
    // Zone 1 Bullseye boundaries
    ctx.moveTo(0, -z1);
    ctx.lineTo(W, -z1);
    ctx.moveTo(0, z1);
    ctx.lineTo(W, z1);
    ctx.stroke();

    // 5. Front Strike Face Contrast Edges
    ctx.lineWidth = 2.4;
    // Zone 5 edges
    ctx.strokeStyle = '#3f3f46';
    ctx.beginPath();
    ctx.moveTo(0, -H);
    ctx.lineTo(0, -z4);
    ctx.moveTo(0, z4);
    ctx.lineTo(0, H);
    ctx.stroke();

    // Zone 4 edges
    ctx.strokeStyle = '#52525b';
    ctx.beginPath();
    ctx.moveTo(0, -z4);
    ctx.lineTo(0, -z3);
    ctx.moveTo(0, z3);
    ctx.lineTo(0, z4);
    ctx.stroke();

    // Zone 3 edges
    ctx.strokeStyle = '#71717a';
    ctx.beginPath();
    ctx.moveTo(0, -z3);
    ctx.lineTo(0, -z2);
    ctx.moveTo(0, z2);
    ctx.lineTo(0, z3);
    ctx.stroke();

    // Zone 2 edges
    ctx.strokeStyle = '#d4d4d8';
    ctx.beginPath();
    ctx.moveTo(0, -z2);
    ctx.lineTo(0, -z1);
    ctx.moveTo(0, z1);
    ctx.lineTo(0, z2);
    ctx.stroke();

    // Zone 1 Bullseye edge
    ctx.strokeStyle = this.theme.accentBright;
    ctx.beginPath();
    ctx.moveTo(0, -z1);
    ctx.lineTo(0, z1);
    ctx.stroke();

    // 6. Strike Face Caliper Ticks (Engineered tick marks without numbers)
    ctx.strokeStyle = this.theme.ticks;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const tickStep = 8;
    for (let y = -H + 8; y <= H - 8; y += tickStep) {
      const isMajor = Math.abs(y) === z4 || Math.abs(y) === z3 || Math.abs(y) === z2 || Math.abs(y) === z1 || y === 0;
      const len = isMajor ? 6.5 : 3.0;
      ctx.moveTo(0, y);
      ctx.lineTo(len, y);
    }
    ctx.stroke();

    // 7. Center Indicator Notch on Left Face (Points directly at the bullseye)
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-1.5, -4.5);
    ctx.lineTo(-1.5, 4.5);
    ctx.closePath();
    ctx.fillStyle = this.theme.accentBright;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 8. Top & Bottom Machined Metal End Caps
    ctx.fillStyle = this.theme.backplateBorder;
    ctx.fillRect(0, -H, W, 2.5);
    ctx.fillRect(0, H - 2.5, W, 2.5);

    // Corner accent dots on caps
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(0, -H, 2.5, 2.5);
    ctx.fillRect(0, H - 2.5, 2.5, 2.5);

    ctx.restore();
  }
}
