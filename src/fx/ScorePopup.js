/**
 * ScorePopup.js - Floating Score Indicator
 * Implements GDD Section 6.3: Rises and fades smoothly upon target hit.
 */

export class ScorePopup {
  /**
   * @param {Object} [options]
   * @param {Object} [options.theme]
   */
  constructor({ theme = {} } = {}) {
    this.popups = [];
    this.accentColor = theme.primaryColor || '#f59e0b';
  }

  /**
   * Spawns a floating score notification.
   * 
   * @param {number} x - Target impact X
   * @param {number} y - Target impact Y
   * @param {number} score - Points awarded (50, 150, 300)
   * @param {string} [tier='outer'] - Tier identifier ('bullseye', 'inner', 'outer')
   */
  spawn(x, y, score, tier = 'outer') {
    this.popups.push({
      x,
      y: y - 10,
      startY: y - 10,
      score,
      tier,
      text: tier === 'bullseye' ? `BULLSEYE +${score}` : `+${score}`,
      time: 0,
      duration: 1.1
    });
  }

  /**
   * Updates all active popups.
   * @param {number} dt - Delta time in seconds
   */
  update(dt = 0.016) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.time += dt;

      // Float upward with ease-out deceleration
      const progress = p.time / p.duration;
      const ease = 1 - Math.pow(1 - progress, 3);
      p.y = p.startY - ease * 34;

      if (p.time >= p.duration) {
        this.popups.splice(i, 1);
      }
    }
  }

  /**
   * Renders active score popups.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (this.popups.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.popups.length; i++) {
      const p = this.popups[i];
      const progress = p.time / p.duration;
      // Alpha: hold for 30%, then linear fade
      const alpha = progress < 0.35 ? 1.0 : Math.max(0, 1.0 - (progress - 0.35) / 0.65);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      // Scale pop on spawn
      const scale = progress < 0.15 ? 0.8 + (progress / 0.15) * 0.25 : 1.0;
      ctx.scale(scale, scale);

      // Subtle minimalist dark pill backing
      const isBullseye = p.tier === 'bullseye';
      ctx.font = isBullseye
        ? '600 12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '600 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const metrics = ctx.measureText(p.text);
      const paddingX = 10;
      const paddingY = 5;
      const boxW = metrics.width + paddingX * 2;
      const boxH = 22;

      // Clean pill background
      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
      ctx.strokeStyle = isBullseye ? this.accentColor : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 11);
      ctx.fill();
      ctx.stroke();

      // Typography
      ctx.fillStyle = isBullseye ? this.accentColor : '#ffffff';
      ctx.fillText(p.text, 0, 0.5);

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Clears all popups.
   */
  clear() {
    this.popups = [];
  }
}
