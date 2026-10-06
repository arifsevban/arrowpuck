/**
 * Projectile.js - Precision Arrow Entity
 * Handles arrow kinematics, orientation tangent to velocity, and crisp geometric rendering.
 */

import { MathUtils } from '../utils/MathUtils.js';

export const ProjectileState = {
  IDLE: 'idle',
  AIMING: 'aiming',
  FLYING: 'flying',
  STUCK: 'stuck',
  FADING: 'fading'
};

export class Projectile {
  /**
   * @param {Object} options
   * @param {number} options.length - Arrow length in pixels (default 42)
   * @param {Object} [options.theme] - Visual theme colors
   */
  constructor({ length = 42, theme = {} } = {}) {
    this.length = length;

    this.theme = {
      shaft: theme.arrowColor || '#27272a',
      tip: theme.primaryColor || '#f59e0b',
      fletching: '#71717a',
      fletchingAccent: theme.primaryColor || '#f59e0b',
      ...theme
    };

    // State
    this.state = ProjectileState.IDLE;

    // Kinematics (x, y represents the arrow TIP)
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 4; // Default 45 deg upwards

    // Visual attributes
    this.alpha = 1.0;
    this.stuckTimer = 0;
    this.stuckOffset = { x: 0, y: 0 }; // For target vibration follow
  }

  /**
   * Sets the arrow to resting position on the slingshot.
   */
  resetToIdle(anchorX, anchorY, defaultAngle = -Math.PI / 4) {
    this.state = ProjectileState.IDLE;
    this.angle = defaultAngle;
    this.x = anchorX + Math.cos(this.angle) * this.length * 0.7;
    this.y = anchorY + Math.sin(this.angle) * this.length * 0.7;
    this.vx = 0;
    this.vy = 0;
    this.alpha = 1.0;
    this.stuckTimer = 0;
  }

  /**
   * Updates position while user is dragging/aiming.
   * Tail sits at (dragX, dragY) and tip extends forward along release angle.
   */
  updateAiming(dragX, dragY, dx, dy) {
    this.state = ProjectileState.AIMING;
    // Release vector is (dx, dy)
    this.angle = Math.atan2(dy, dx);
    // Tip extends forward from the nock/pouch
    this.x = dragX + Math.cos(this.angle) * this.length;
    this.y = dragY + Math.sin(this.angle) * this.length;
    this.alpha = 1.0;
  }

  /**
   * Releases arrow into flight with given initial velocity.
   */
  launch(vx, vy) {
    this.state = ProjectileState.FLYING;
    this.vx = vx;
    this.vy = vy;
    this.angle = Math.atan2(vy, vx);
  }

  /**
   * Embeds arrow into the target or ground upon impact.
   */
  stick(impactX, impactY, angle) {
    this.state = ProjectileState.STUCK;
    this.x = impactX;
    this.y = impactY;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.stuckTimer = 0;
  }

  /**
   * Updates flight physics or stuck fade timer.
   */
  update(gravity, airResistance, dt = 0.016) {
    if (this.state === ProjectileState.FLYING) {
      this.vy += gravity;
      this.vx *= airResistance;
      this.x += this.vx;
      this.y += this.vy;
      this.angle = Math.atan2(this.vy, this.vx);
    } else if (this.state === ProjectileState.STUCK) {
      this.stuckTimer += dt;
      // After 0.9s start fading out
      if (this.stuckTimer > 0.9) {
        this.alpha = Math.max(0, 1.0 - (this.stuckTimer - 0.9) / 0.5);
        if (this.alpha <= 0) {
          this.state = ProjectileState.FADING;
        }
      }
    }
  }

  /**
   * Renders the minimalist vector arrow with crisp geometry.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [offsetX=0] - Optional offset from target shake
   * @param {number} [offsetY=0] - Optional offset from target shake
   */
  render(ctx, offsetX = 0, offsetY = 0) {
    if (this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;

    // Translate to arrow tip
    ctx.translate(this.x + offsetX, this.y + offsetY);
    ctx.rotate(this.angle);

    const L = this.length;

    // 1. Carbon Shaft (extends backward from tip at 0 to -L)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-L, 0);
    ctx.strokeStyle = this.theme.shaft;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Razor Arrowhead (Sleek minimalist faceted triangle)
    const headLen = 10;
    const headHalfW = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, 0); // Sharp tip
    ctx.lineTo(-headLen, -headHalfW);
    ctx.lineTo(-headLen + 2.5, 0); // Subtle inner bevel
    ctx.lineTo(-headLen, headHalfW);
    ctx.closePath();
    ctx.fillStyle = this.theme.tip;
    ctx.fill();

    // Subtle edge highlight on arrowhead
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 3. Fletching (Geometric minimalist vanes at tail)
    const fletchStart = -L + 4;
    const fletchLen = 10;
    const fletchH = 4.2;

    // Top Vane
    ctx.beginPath();
    ctx.moveTo(fletchStart - fletchLen, -fletchH);
    ctx.lineTo(fletchStart, 0);
    ctx.lineTo(fletchStart - fletchLen * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = this.theme.fletching;
    ctx.fill();

    // Bottom Vane
    ctx.beginPath();
    ctx.moveTo(fletchStart - fletchLen, fletchH);
    ctx.lineTo(fletchStart, 0);
    ctx.lineTo(fletchStart - fletchLen * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = this.theme.fletching;
    ctx.fill();

    // Accent line along tail
    ctx.beginPath();
    ctx.moveTo(-L + 1, 0);
    ctx.lineTo(-L + 8, 0);
    ctx.strokeStyle = this.theme.fletchingAccent;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.restore();
  }
}
