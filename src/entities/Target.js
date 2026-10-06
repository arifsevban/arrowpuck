/**
 * Target.js - Suspended Archery Target Board (Side Profile)
 * Suspended from the top of the screen via a precision cable.
 * Swings dynamically like a damped pendulum based on arrow impact speed and hit height.
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
  constructor({ x, y, height = 250, width = 26, theme = {}, initiallyDeployed = false }) {
    this.x = x;
    this.y = y;
    this.height = height;
    this.width = width;
    this.halfHeight = height / 2;

    this.theme = {
      accent: theme.primaryColor || '#f59e0b',
      accentBright: '#fbbf24',
      cable: 'rgba(161, 161, 170, 0.75)',
      cableMount: '#3f3f46',
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

    // Pendulum swing and rotational tilt state
    this.isShaking = false;
    this.swingTime = 0;
    this.swingDuration = 1.3;
    this.swayAmplitude = 0;
    this.tiltAmplitude = 0;

    // Current dynamic animated offsets
    this.swayX = 0;
    this.swayY = 0;
    this.tilt = 0;

    // Deployment / Ceiling drop animation state
    this.initiallyDeployed = initiallyDeployed;
    this.isDeployed = this.initiallyDeployed;
    this.isDropping = false;
    this.isRetracting = false;
    this.dropTime = 0;
    this.dropDuration = 0.88;
    this.retractTime = 0;
    this.retractDuration = 0.42;
    this.initialYOffset = -(this.y + this.height + 60);
    this.dropYOffset = this.isDeployed ? 0 : this.initialYOffset;

    // Aliases for compatibility
    this.offsetX = 0;
    this.offsetY = this.dropYOffset;
  }

  /**
   * Updates target base position on window resize.
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.initialYOffset = -(this.y + this.height + 60);
    if (!this.isDeployed && !this.isDropping && !this.isRetracting) {
      this.dropYOffset = this.initialYOffset;
      this.offsetY = this.dropYOffset;
    }
  }

  /**
   * Triggers the ceiling-drop entrance animation.
   * Target plunges down under gravity, cord catches with an elastic bounce and natural sway.
   */
  startDrop() {
    this.isDeployed = false;
    this.isDropping = true;
    this.isRetracting = false;
    this.dropTime = 0;
    this.initialYOffset = -(this.y + this.height + 60);
    this.dropYOffset = this.initialYOffset;
    this.isShaking = false;
    this.swayX = 0;
    this.swayY = 0;
    this.tilt = 0;
  }

  /**
   * Triggers the retract exit animation, pulling the board back up into the ceiling.
   */
  startRetract() {
    this.isRetracting = true;
    this.isDropping = false;
    this.retractTime = 0;
    this.initialYOffset = -(this.y + this.height + 60);
    this.isShaking = false;
    this.swayX = 0;
    this.swayY = 0;
    this.tilt = 0;
  }

  /**
   * Triggers physical pendulum swing when struck by an arrow.
   * Lever arm increases with distance from the top suspension point.
   * 
   * @param {number} impactY - Vertical coordinate where arrow struck
   * @param {number} [impactSpeed=16] - Speed of the arrow at collision
   */
  hit(impactY, impactSpeed = 16) {
    this.isShaking = true;
    this.swingTime = 0;

    // Linear horizontal pendulum impulse
    this.swayAmplitude = Math.min(34, impactSpeed * 1.55);

    // Lever arm from top suspension eyelet (0 at top, 250 at bottom)
    const topY = this.y - this.halfHeight + this.dropYOffset;
    const leverArm = Math.max(10, impactY - topY);

    // Angular tilt torque: hits near bottom kick out dramatically
    const normalizedLever = leverArm / this.height; // [0.04, 1.0]
    this.tiltAmplitude = normalizedLever * (impactSpeed / 14) * 0.24;
  }

  /**
   * Per-frame physics integration for pendulum swing, drop entrance, and angular oscillation.
   * @param {number} dt - Delta time in seconds
   */
  update(dt = 0.016) {
    // 1. Handle Drop / Retract animations
    if (this.isDropping) {
      this.dropTime += dt;
      const tau = Math.min(1, this.dropTime / this.dropDuration);

      if (tau < 0.60) {
        // Accelerating descent under gravity
        const p = tau / 0.60;
        const fall = p * p;
        this.dropYOffset = this.initialYOffset * (1 - fall);
      } else {
        // Cable catches: damped bounce & elastic rebound
        const pBounce = (tau - 0.60) / 0.40;
        const bounce = Math.sin(pBounce * Math.PI * 3.5) * Math.exp(-pBounce * 4.2);
        this.dropYOffset = -this.initialYOffset * 0.10 * bounce;

        // Deceleration impact jolt on initial cable catch
        if (!this.isShaking && (this.dropTime - dt) < 0.60 * this.dropDuration) {
          this.isShaking = true;
          this.swingTime = 0;
          this.swayAmplitude = 15;
          this.tiltAmplitude = 0.09;
        }
      }

      if (tau >= 1.0) {
        this.isDropping = false;
        this.isDeployed = true;
        this.dropYOffset = 0;
      }
    } else if (this.isRetracting) {
      this.retractTime += dt;
      const tau = Math.min(1, this.retractTime / this.retractDuration);
      const pull = tau * tau * tau;
      this.dropYOffset = this.initialYOffset * pull;

      if (tau >= 1.0) {
        this.isRetracting = false;
        this.isDeployed = false;
        this.dropYOffset = this.initialYOffset;
      }
    }

    // 2. Handle Pendulum Swing
    if (this.isShaking) {
      this.swingTime += dt;

      if (this.swingTime >= this.swingDuration) {
        this.isShaking = false;
        this.swayX = 0;
        this.swayY = 0;
        this.tilt = 0;
      } else {
        // Damped horizontal pendulum sway of the suspension point
        const swayDecay = Math.exp(-2.5 * this.swingTime);
        const swayWave = Math.sin(5.6 * this.swingTime);
        this.swayX = this.swayAmplitude * swayDecay * swayWave;
        // Slight upward circular arc lift as pendulum sways
        this.swayY = -Math.abs(this.swayX) * 0.06;

        // Damped rotational tilt oscillation around the suspension pivot
        const tiltDecay = Math.exp(-3.4 * this.swingTime);
        const tiltWave = Math.cos(9.8 * this.swingTime);
        this.tilt = this.tiltAmplitude * tiltDecay * tiltWave;
      }
    } else if (!this.isDropping) {
      this.swayX = 0;
      this.swayY = 0;
      this.tilt = 0;
    }

    this.offsetX = this.swayX;
    this.offsetY = this.swayY + this.dropYOffset;
  }

  /**
   * Returns top suspension eyelet world coordinates.
   */
  getPivot() {
    return {
      x: this.x + this.width / 2 + this.swayX,
      y: this.y - this.halfHeight + this.swayY + this.dropYOffset
    };
  }

  /**
   * Converts local board coordinates (relX from front face, relY from center)
   * to world coordinates accounting for swing and tilt.
   */
  toWorldCoords(localX, localY) {
    const pivot = this.getPivot();
    // In local space, pivot is at (width / 2, 0) relative to board top
    const fromPivotX = localX - this.width / 2;
    const fromPivotY = localY + this.halfHeight;

    const cosT = Math.cos(this.tilt);
    const sinT = Math.sin(this.tilt);

    return {
      x: pivot.x + fromPivotX * cosT - fromPivotY * sinT,
      y: pivot.y + fromPivotX * sinT + fromPivotY * cosT,
      angleDelta: this.tilt
    };
  }

  /**
   * Renders the suspended target board, ceiling mount, and suspension cord.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    // If completely retracted and not transitioning, skip rendering
    if (!this.isDeployed && !this.isDropping && !this.isRetracting) {
      return;
    }

    ctx.save();

    const pivot = this.getPivot();
    const ceilingX = this.x + this.width / 2;
    const W = this.width;
    const H = this.halfHeight;

    // 1. Ceiling Mount Fixture at top of screen (y = 0)
    ctx.fillStyle = this.theme.cableMount;
    ctx.fillRect(ceilingX - 10, 0, 20, 5);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1;
    ctx.strokeRect(ceilingX - 10, 0, 20, 5);

    // Ceiling eyelet loop
    ctx.beginPath();
    ctx.arc(ceilingX, 7, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#71717a';
    ctx.fill();

    // 2. Precision High-Tensile Suspension Cable (Ceiling -> Moving Top Pivot)
    ctx.beginPath();
    ctx.moveTo(ceilingX, 7);
    ctx.lineTo(pivot.x, pivot.y);
    ctx.strokeStyle = this.theme.cable;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 3. Render Suspended Target Board (Rotated around Pivot)
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(this.tilt);

    // Ambient drop shadow under board
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = -6;

    // Top Eyebolt & Collar
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Board Base Frame (-W/2 to W/2, 0 to 2H)
    ctx.fillStyle = '#141418';
    ctx.beginPath();
    ctx.roundRect(-W / 2, 4, W, this.height, [3, 3, 3, 3]);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = this.theme.backplateBorder;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-W / 2, 4, W, this.height, [3, 3, 3, 3]);
    ctx.stroke();

    // 4. 5 Graded Scoring Intervals (Shifted by H + 4 so center is at H + 4)
    const centerY = H + 4;
    const z1 = 8;  // Razor Bullseye (500 pts, 16px span)
    const z2 = 22; // Inner Master   (300 pts, 44px span)
    const z3 = 48; // Middle High    (150 pts, 96px span)
    const z4 = 84; // Mid-Outer      (75 pts, 168px span)
    const z5 = H;  // Outer Edge     (25 pts, 250px span)

    const boardLeft = -W / 2 + 1;
    const boardW = W - 2;

    // --- Zone 5: Outer Edge (Top & Bottom ends) ---
    ctx.fillStyle = this.theme.zone5;
    ctx.fillRect(boardLeft, centerY - z5, boardW, z5 - z4);
    ctx.fillRect(boardLeft, centerY + z4, boardW, z5 - z4);

    // --- Zone 4: Mid-Outer Zones ---
    ctx.fillStyle = this.theme.zone4;
    ctx.fillRect(boardLeft, centerY - z4, boardW, z4 - z3);
    ctx.fillRect(boardLeft, centerY + z3, boardW, z4 - z3);

    // --- Zone 3: Middle High Zones ---
    ctx.fillStyle = this.theme.zone3;
    ctx.fillRect(boardLeft, centerY - z3, boardW, z3 - z2);
    ctx.fillRect(boardLeft, centerY + z2, boardW, z3 - z2);

    // --- Zone 2: Inner Master Zones (Warm brass accent) ---
    ctx.fillStyle = this.theme.zone2;
    ctx.fillRect(boardLeft, centerY - z2, boardW, z2 - z1);
    ctx.fillRect(boardLeft, centerY + z1, boardW, z2 - z1);

    // --- Zone 1: Razor Bullseye Core (Pure gold / amber) ---
    ctx.fillStyle = this.theme.zone1;
    ctx.fillRect(boardLeft, centerY - z1, boardW, z1 * 2);

    // 5. Boundary Dividers between score zones
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(boardLeft, centerY - z4); ctx.lineTo(boardLeft + boardW, centerY - z4);
    ctx.moveTo(boardLeft, centerY + z4); ctx.lineTo(boardLeft + boardW, centerY + z4);
    ctx.moveTo(boardLeft, centerY - z3); ctx.lineTo(boardLeft + boardW, centerY - z3);
    ctx.moveTo(boardLeft, centerY + z3); ctx.lineTo(boardLeft + boardW, centerY + z3);
    ctx.moveTo(boardLeft, centerY - z2); ctx.lineTo(boardLeft + boardW, centerY - z2);
    ctx.moveTo(boardLeft, centerY + z2); ctx.lineTo(boardLeft + boardW, centerY + z2);
    ctx.moveTo(boardLeft, centerY - z1); ctx.lineTo(boardLeft + boardW, centerY - z1);
    ctx.moveTo(boardLeft, centerY + z1); ctx.lineTo(boardLeft + boardW, centerY + z1);
    ctx.stroke();

    // 6. Front Strike Face Contrast Edge Lines (at -W/2)
    const strikeX = -W / 2;
    ctx.lineWidth = 2.4;

    // Zone 5
    ctx.strokeStyle = '#3f3f46';
    ctx.beginPath();
    ctx.moveTo(strikeX, centerY - z5); ctx.lineTo(strikeX, centerY - z4);
    ctx.moveTo(strikeX, centerY + z4); ctx.lineTo(strikeX, centerY + z5);
    ctx.stroke();

    // Zone 4
    ctx.strokeStyle = '#52525b';
    ctx.beginPath();
    ctx.moveTo(strikeX, centerY - z4); ctx.lineTo(strikeX, centerY - z3);
    ctx.moveTo(strikeX, centerY + z3); ctx.lineTo(strikeX, centerY + z4);
    ctx.stroke();

    // Zone 3
    ctx.strokeStyle = '#71717a';
    ctx.beginPath();
    ctx.moveTo(strikeX, centerY - z3); ctx.lineTo(strikeX, centerY - z2);
    ctx.moveTo(strikeX, centerY + z2); ctx.lineTo(strikeX, centerY + z3);
    ctx.stroke();

    // Zone 2
    ctx.strokeStyle = '#d4d4d8';
    ctx.beginPath();
    ctx.moveTo(strikeX, centerY - z2); ctx.lineTo(strikeX, centerY - z1);
    ctx.moveTo(strikeX, centerY + z1); ctx.lineTo(strikeX, centerY + z2);
    ctx.stroke();

    // Zone 1 (Bullseye)
    ctx.strokeStyle = this.theme.accentBright;
    ctx.beginPath();
    ctx.moveTo(strikeX, centerY - z1); ctx.lineTo(strikeX, centerY + z1);
    ctx.stroke();

    // 7. Strike Face Caliper Ticks
    ctx.strokeStyle = this.theme.ticks;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = centerY - z5 + 8; y <= centerY + z5 - 8; y += 8) {
      const relY = Math.abs(y - centerY);
      const isMajor = relY === z4 || relY === z3 || relY === z2 || relY === z1 || relY === 0;
      const len = isMajor ? 6.5 : 3.0;
      ctx.moveTo(strikeX, y);
      ctx.lineTo(strikeX + len, y);
    }
    ctx.stroke();

    // 8. Center Indicator Notch on Left Face (Points directly at the bullseye)
    ctx.beginPath();
    ctx.moveTo(strikeX - 7, centerY);
    ctx.lineTo(strikeX - 1.5, centerY - 4.5);
    ctx.lineTo(strikeX - 1.5, centerY + 4.5);
    ctx.closePath();
    ctx.fillStyle = this.theme.accentBright;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 9. Top & Bottom Machined Metal End Caps
    ctx.fillStyle = this.theme.backplateBorder;
    ctx.fillRect(strikeX, 4, W, 2.5);
    ctx.fillRect(strikeX, 4 + this.height - 2.5, W, 2.5);

    // Bottom Brass Ballast Weight Ring (adds visual pendulum realism)
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(0, 4 + this.height + 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }
}
