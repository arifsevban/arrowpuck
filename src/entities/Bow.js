/**
 * Bow.js - Precision Archery Recurve Bow Entity
 * Renders an elegant aerodynamic recurve bow with flexing limbs,
 * dynamic aiming rotation, high-tensile bowstring, and vibration dampening.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Bow {
  /**
   * @param {Object} options
   * @param {number} options.x - Base anchor X coordinate
   * @param {number} options.y - Base anchor Y coordinate
   * @param {number} [options.maxDragRadius=110] - Maximum pull distance
   * @param {Object} [options.theme] - Theme customization
   */
  constructor({ x, y, maxDragRadius = 110, theme = {} }) {
    this.x = x;
    this.y = y;
    this.maxDragRadius = maxDragRadius;

    this.theme = {
      accent: theme.primaryColor || '#f59e0b',
      riser: '#27272a',
      riserHighlight: '#3f3f46',
      limb: '#18181b',
      limbEdge: '#3f3f46',
      string: '#71717a',
      stringActive: '#f4f4f5',
      nock: '#f59e0b',
      ...theme
    };

    // Bow physical dimensions
    this.bowLength = 76; // Total tip-to-tip span
    this.halfLength = this.bowLength / 2;
    this.riserHeight = 22;

    // Resting orientation (pointing towards top-right at -45 deg)
    this.defaultAngle = -Math.PI / 4;
    this.currentAngle = this.defaultAngle;

    // Elastic snap-back and vibration
    this.isSnapping = false;
    this.snapTime = 0;
    this.snapDisplacement = { dx: 0, dy: 0 };

    // Hover & interaction bounds
    this.isHovered = false;
    this.idleTime = 0;
  }

  /**
   * Updates position on resize.
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Triggers string snap-back when arrow is fired.
   */
  triggerSnapBack(releaseDx, releaseDy) {
    this.isSnapping = true;
    this.snapTime = 0;
    this.snapDisplacement = { dx: releaseDx, dy: releaseDy };
  }

  /**
   * Per-frame animation update.
   */
  update(dt = 0.016) {
    this.idleTime += dt;

    if (this.isSnapping) {
      this.snapTime += dt;
      if (this.snapTime > 0.28) {
        this.isSnapping = false;
        this.snapTime = 0;
      }
    }
  }

  /**
   * Computes limb tips and bow rotation for given aiming state.
   */
  getGeometry(isAiming, dragX, dragY, pullRatio = 0) {
    let angle = this.defaultAngle;
    let nockX = this.x - Math.cos(angle) * 4;
    let nockY = this.y - Math.sin(angle) * 4;

    if (isAiming) {
      const dx = this.x - dragX;
      const dy = this.y - dragY;
      angle = Math.atan2(dy, dx);
      nockX = dragX;
      nockY = dragY;
    } else if (this.isSnapping) {
      const decay = Math.exp(-22 * this.snapTime);
      const wave = Math.cos(56 * this.snapTime);
      const factor = decay * wave * 0.35;
      nockX = this.x - this.snapDisplacement.dx * factor;
      nockY = this.y - this.snapDisplacement.dy * factor;
    }

    this.currentAngle = angle;

    // Perpendicular angle for limb span
    const perpAngle = angle + Math.PI / 2;
    const limbSpan = this.halfLength;

    // Limbs flex backward slightly when drawn
    const limbFlex = isAiming ? pullRatio * 7 : 0;
    const flexDx = -Math.cos(angle) * limbFlex;
    const flexDy = -Math.sin(angle) * limbFlex;

    const tip1 = {
      x: this.x + Math.cos(perpAngle) * limbSpan + flexDx,
      y: this.y + Math.sin(perpAngle) * limbSpan + flexDy
    };

    const tip2 = {
      x: this.x - Math.cos(perpAngle) * limbSpan + flexDx,
      y: this.y - Math.sin(perpAngle) * limbSpan + flexDy
    };

    return { angle, nockX, nockY, tip1, tip2, perpAngle, limbFlex };
  }

  /**
   * Renders the rear layer (drag range guide + bowstring).
   */
  renderBack(ctx, isAiming, dragX, dragY, pullRatio = 0) {
    ctx.save();

    const { nockX, nockY, tip1, tip2 } = this.getGeometry(isAiming, dragX, dragY, pullRatio);

    // 1. Max drag boundary indicator when hovered or aiming
    if (this.isHovered || isAiming) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.maxDragRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isAiming
        ? 'rgba(245, 158, 11, 0.22)'
        : 'rgba(113, 113, 122, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. High-tensile Bowstring (Upper Tip -> Arrow Nock -> Lower Tip)
    ctx.beginPath();
    ctx.moveTo(tip1.x, tip1.y);
    ctx.lineTo(nockX, nockY);
    ctx.lineTo(tip2.x, tip2.y);
    ctx.strokeStyle = isAiming ? this.theme.stringActive : this.theme.string;
    ctx.lineWidth = isAiming ? 1.4 : 1.8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 3. String nocking point brass ring
    ctx.beginPath();
    ctx.arc(nockX, nockY, 3, 0, Math.PI * 2);
    ctx.fillStyle = isAiming ? this.theme.accent : this.theme.riserHighlight;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders the front layer (recurve bow body, grip, and limbs).
   */
  renderFront(ctx, isAiming, dragX, dragY, pullRatio = 0) {
    ctx.save();

    const { angle, tip1, tip2, perpAngle, limbFlex } = this.getGeometry(isAiming, dragX, dragY, pullRatio);

    // Translate and rotate along bow center
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    const H = this.halfLength;
    const flex = isAiming ? pullRatio * 7 : 0;

    // 1. Sleek Recurve Limbs (Aerodynamic carbon laminate curve)
    // Upper Limb Curve: From (0, 0) to tip at (-flex, H)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(8, H * 0.4, 6 - flex * 0.5, H * 0.8, -flex, H);
    // Outer recurve return at tip
    ctx.bezierCurveTo(4 - flex, H * 0.85, 4, H * 0.35, 0, 0);
    ctx.fillStyle = this.theme.limb;
    ctx.fill();
    ctx.strokeStyle = this.theme.limbEdge;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Lower Limb Curve: From (0, 0) to tip at (-flex, -H)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(8, -H * 0.4, 6 - flex * 0.5, -H * 0.8, -flex, -H);
    ctx.bezierCurveTo(4 - flex, -H * 0.85, 4, -H * 0.35, 0, 0);
    ctx.fillStyle = this.theme.limb;
    ctx.fill();
    ctx.strokeStyle = this.theme.limbEdge;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 2. Machined Limb Tips (Reinforced nock caps)
    ctx.fillStyle = this.theme.accent;
    ctx.beginPath();
    ctx.arc(-flex, H, 2.5, 0, Math.PI * 2);
    ctx.arc(-flex, -H, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Ergonomic Bow Riser & Leather Grip
    const gripH = this.riserHeight;
    ctx.beginPath();
    ctx.roundRect(-2.5, -gripH / 2, 7, gripH, 3.5);
    ctx.fillStyle = this.theme.riser;
    ctx.fill();
    ctx.strokeStyle = this.theme.riserHighlight;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Accent line on grip
    ctx.beginPath();
    ctx.moveTo(1, -gripH * 0.35);
    ctx.lineTo(1, gripH * 0.35);
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Arrow shelf indicator
    ctx.fillStyle = this.theme.accent;
    ctx.beginPath();
    ctx.arc(4, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
