/**
 * Slingshot.js - Minimalist Industrial Slingshot / Launcher
 * Renders the structural fork, dynamic elastic cords, and handles snap-back physics.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Slingshot {
  /**
   * @param {Object} options
   * @param {number} options.x - Base anchor X coordinate
   * @param {number} options.y - Base anchor Y coordinate
   * @param {number} [options.maxDragRadius=90] - Maximum pull distance
   * @param {Object} [options.theme] - Theme color tokens
   */
  constructor({ x, y, maxDragRadius = 90, theme = {} }) {
    this.x = x;
    this.y = y;
    this.maxDragRadius = maxDragRadius;

    this.theme = {
      accent: theme.primaryColor || '#f59e0b',
      frame: '#27272a',
      frameHighlight: '#3f3f46',
      band: '#71717a',
      bandActive: '#e4e4e7',
      pouch: '#18181b',
      guide: 'rgba(245, 158, 11, 0.25)',
      ...theme
    };

    // Fork geometry (relative to anchor x, y)
    this.forkWidth = 36;
    this.forkHeight = 32;

    // Left and right tine tips
    this.leftTine = { x: this.x - this.forkWidth / 2, y: this.y - 14 };
    this.rightTine = { x: this.x + this.forkWidth / 2, y: this.y - 14 };

    // Snap-back animation state
    this.isSnapping = false;
    this.snapTime = 0;
    this.snapDisplacement = { x: 0, y: 0 };

    // Hover & idle pulse
    this.isHovered = false;
    this.idleTime = 0;
  }

  /**
   * Updates position if window resizes.
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.leftTine = { x: this.x - this.forkWidth / 2, y: this.y - 14 };
    this.rightTine = { x: this.x + this.forkWidth / 2, y: this.y - 14 };
  }

  /**
   * Triggers elastic snap-back animation when the projectile is released.
   * 
   * @param {number} releaseDx - X displacement at release
   * @param {number} releaseDy - Y displacement at release
   */
  triggerSnapBack(releaseDx, releaseDy) {
    this.isSnapping = true;
    this.snapTime = 0;
    this.snapDisplacement = { x: releaseDx, y: releaseDy };
  }

  /**
   * Per-frame update for animations.
   * @param {number} dt - Delta time in seconds (or normalized frame)
   */
  update(dt = 0.016) {
    this.idleTime += dt;

    if (this.isSnapping) {
      this.snapTime += dt;
      // Damped vibration for 0.25s
      if (this.snapTime > 0.25) {
        this.isSnapping = false;
        this.snapTime = 0;
      }
    }
  }

  /**
   * Draws the slingshot behind the arrow (elastic bands + fork base).
   * 
   * @param {CanvasRenderingContext2D} ctx
   * @param {boolean} isAiming - Whether the user is dragging
   * @param {number} dragX - Current drag pouch X
   * @param {number} dragY - Current drag pouch Y
   * @param {number} pullRatio - Pull tension ratio [0, 1]
   */
  renderBack(ctx, isAiming, dragX, dragY, pullRatio = 0) {
    ctx.save();

    // Determine current pouch position (idle, dragging, or snapping)
    let currentPouchX = this.x;
    let currentPouchY = this.y - 4;

    if (isAiming) {
      currentPouchX = dragX;
      currentPouchY = dragY;
    } else if (this.isSnapping) {
      // Elastic damped harmonic snap-back towards center
      const decay = Math.exp(-18 * this.snapTime);
      const wave = Math.cos(48 * this.snapTime);
      const factor = decay * wave;
      currentPouchX = this.x - this.snapDisplacement.dx * factor * 0.4;
      currentPouchY = this.y - 4 - this.snapDisplacement.dy * factor * 0.4;
    }

    // 1. Draw Max Drag Range & Interactive Guide when hovered or aiming
    if (this.isHovered || isAiming) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.maxDragRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isAiming
        ? 'rgba(245, 158, 11, 0.22)'
        : 'rgba(113, 113, 122, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Left Elastic Band
    ctx.beginPath();
    ctx.moveTo(this.leftTine.x, this.leftTine.y);
    ctx.lineTo(currentPouchX, currentPouchY);
    ctx.strokeStyle = isAiming ? this.theme.bandActive : this.theme.band;
    ctx.lineWidth = Math.max(1.4, 2.6 - pullRatio * 1.0);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws the front elements (right band, fork handle, pouch).
   * 
   * @param {CanvasRenderingContext2D} ctx
   * @param {boolean} isAiming
   * @param {number} dragX
   * @param {number} dragY
   * @param {number} pullRatio
   */
  renderFront(ctx, isAiming, dragX, dragY, pullRatio = 0) {
    ctx.save();

    let currentPouchX = this.x;
    let currentPouchY = this.y - 4;

    if (isAiming) {
      currentPouchX = dragX;
      currentPouchY = dragY;
    } else if (this.isSnapping) {
      const decay = Math.exp(-18 * this.snapTime);
      const wave = Math.cos(48 * this.snapTime);
      const factor = decay * wave;
      currentPouchX = this.x - this.snapDisplacement.dx * factor * 0.4;
      currentPouchY = this.y - 4 - this.snapDisplacement.dy * factor * 0.4;
    }

    // 1. Right Elastic Band
    ctx.beginPath();
    ctx.moveTo(this.rightTine.x, this.rightTine.y);
    ctx.lineTo(currentPouchX, currentPouchY);
    ctx.strokeStyle = isAiming ? this.theme.bandActive : this.theme.band;
    ctx.lineWidth = Math.max(1.4, 2.6 - pullRatio * 1.0);
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Leather Pouch
    ctx.beginPath();
    ctx.arc(currentPouchX, currentPouchY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.pouch;
    ctx.fill();
    ctx.strokeStyle = isAiming ? this.theme.accent : this.theme.band;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. Precision Industrial Fork Frame
    this.renderForkFrame(ctx);

    ctx.restore();
  }

  /**
   * Renders the sleek minimalist metal fork frame.
   * Geometric, crisp lines with subtle industrial bevel.
   */
  renderForkFrame(ctx) {
    const { x, y } = this;
    const halfW = this.forkWidth / 2;

    // Metallic fork stem and prongs
    ctx.beginPath();
    // Stem bottom
    ctx.moveTo(x, y + 28);
    // Stem rising
    ctx.lineTo(x, y + 4);
    // Left branch
    ctx.quadraticCurveTo(x - 4, y - 4, this.leftTine.x, this.leftTine.y);
    // Back to stem
    ctx.moveTo(x, y + 4);
    // Right branch
    ctx.quadraticCurveTo(x + 4, y - 4, this.rightTine.x, this.rightTine.y);

    ctx.strokeStyle = this.theme.frameHighlight;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = this.theme.frame;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Fork tine tip caps (machined pegs)
    ctx.fillStyle = this.theme.accent;
    ctx.beginPath();
    ctx.arc(this.leftTine.x, this.leftTine.y, 2.8, 0, Math.PI * 2);
    ctx.arc(this.rightTine.x, this.rightTine.y, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Base mounting node
    ctx.fillStyle = this.theme.frameHighlight;
    ctx.beginPath();
    ctx.arc(x, y + 28, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
