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
    let text = `+${score}`;
    if (tier === 'bullseye') text = `BULLSEYE +${score}`;
    else if (tier === 'master') text = `EXCELLENT +${score}`;

    const isBullseye = tier === 'bullseye';

    this.popups.push({
      x,
      y: y - 10,
      startY: y - 10,
      score,
      tier,
      text,
      time: 0,
      duration: isBullseye ? 1.35 : 1.1
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
      const floatDistance = p.tier === 'bullseye' ? 42 : 34;
      p.y = p.startY - ease * floatDistance;

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
      const isBullseye = p.tier === 'bullseye';
      const isMaster = p.tier === 'master';

      // Alpha: hold longer for bullseye
      const holdTime = isBullseye ? 0.45 : 0.35;
      const alpha = progress < holdTime ? 1.0 : Math.max(0, 1.0 - (progress - holdTime) / (1.0 - holdTime));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      // Scale pop with elastic overshoot for bullseye
      let scale = 1.0;
      if (progress < 0.18) {
        const t = progress / 0.18;
        scale = isBullseye ? 0.6 + Math.sin(t * Math.PI * 0.75) * 0.6 : 0.8 + t * 0.25;
      }
      ctx.scale(scale, scale);

      ctx.font = isBullseye
        ? '700 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : isMaster
        ? '600 12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '600 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const metrics = ctx.measureText(p.text);
      const paddingX = isBullseye ? 14 : 10;
      const paddingY = isBullseye ? 6 : 5;
      const boxW = metrics.width + paddingX * 2;
      const boxH = isBullseye ? 26 : 22;

      // Radiant gold glow for bullseye
      if (isBullseye) {
        ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
        ctx.shadowBlur = 18;
      }

      // Clean pill background
      ctx.fillStyle = isBullseye ? '#18181b' : 'rgba(24, 24, 27, 0.88)';
      ctx.strokeStyle = isBullseye ? '#fbbf24' : isMaster ? this.accentColor : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = isBullseye ? 1.8 : 1;

      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, boxH / 2);
      ctx.fill();
      ctx.stroke();

      // Reset shadow before drawing text
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Typography
      ctx.fillStyle = isBullseye ? '#fbbf24' : isMaster ? this.accentColor : '#ffffff';
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
