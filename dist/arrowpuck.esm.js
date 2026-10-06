/**
 * MathUtils.js - ArrowShot Vector and Math Utilities
 * Pure ES6+, zero dependencies.
 */

const MathUtils = {
  /**
   * Clamp a value between min and max.
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Linear interpolation between a and b.
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /**
   * Euclidean distance between two points.
   */
  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.hypot(dx, dy);
  },

  /**
   * Angle in radians from (x1, y1) to (x2, y2).
   */
  angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  /**
   * Damped harmonic oscillator / spring calculation.
   * x(t) = amplitude * exp(-damping * t) * cos(frequency * t)
   */
  spring(amplitude, damping, frequency, time) {
    return amplitude * Math.exp(-damping * time) * Math.cos(frequency * time);
  },

  /**
   * Random float between min and max.
   */
  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }
};

/**
 * Physics.js - ArrowShot Core Physics Engine
 * Implements GDD Section 4: displacement clamping, Euler flight integration,
 * velocity calculations, and trajectory forecasting.
 */


class Physics {
  /**
   * Calculates the clamped displacement vector and pull ratio.
   * Delta is (anchor - pointer) because pulling backward launches forward.
   * 
   * @param {number} anchorX - Base anchor X coordinate
   * @param {number} anchorY - Base anchor Y coordinate
   * @param {number} pointerX - Pointer X coordinate
   * @param {number} pointerY - Pointer Y coordinate
   * @param {number} maxDragRadius - Maximum allowable pull radius (px)
   * @returns {{ dx: number, dy: number, distance: number, ratio: number, dragX: number, dragY: number }}
   */
  static calculatePullVector(anchorX, anchorY, pointerX, pointerY, maxDragRadius = 90) {
    const rawDx = anchorX - pointerX;
    const rawDy = anchorY - pointerY;
    const distance = Math.hypot(rawDx, rawDy);

    if (distance === 0) {
      return {
        dx: 0,
        dy: 0,
        distance: 0,
        ratio: 0,
        dragX: anchorX,
        dragY: anchorY
      };
    }

    const clampedDist = Math.min(distance, maxDragRadius);
    const scale = clampedDist / distance;
    const dx = rawDx * scale;
    const dy = rawDy * scale;

    // The actual drag position where the arrow notch/pouch rests
    const dragX = anchorX - dx;
    const dragY = anchorY - dy;

    return {
      dx,
      dy,
      distance: clampedDist,
      ratio: clampedDist / maxDragRadius,
      dragX,
      dragY
    };
  }

  /**
   * Calculates initial launch velocity vector from clamped displacement.
   * 
   * @param {number} dx - Clamped horizontal displacement
   * @param {number} dy - Clamped vertical displacement
   * @param {number} powerMultiplier - Power scale factor (default ~0.22)
   * @returns {{ vx: number, vy: number }}
   */
  static calculateLaunchVelocity(dx, dy, powerMultiplier = 0.22) {
    return {
      vx: dx * powerMultiplier,
      vy: dy * powerMultiplier
    };
  }

  /**
   * Advances a projectile's state by one frame using Euler integration.
   * 
   * @param {{ x: number, y: number, vx: number, vy: number, angle: number }} state
   * @param {number} gravity - Gravity acceleration (px/frame^2, default ~0.42)
   * @param {number} airResistance - Air drag multiplier (default ~0.998)
   */
  static stepFlight(state, gravity = 0.42, airResistance = 0.998) {
    state.vy += gravity;
    state.vx *= airResistance;
    state.x += state.vx;
    state.y += state.vy;
    state.angle = Math.atan2(state.vy, state.vx);
  }

  /**
   * Generates trajectory prediction sample points for aiming preview.
   * Uses simulated integration matching stepFlight for 100% trajectory accuracy.
   * 
   * @param {number} startX - Launch origin X
   * @param {number} startY - Launch origin Y
   * @param {number} vx - Initial horizontal velocity
   * @param {number} vy - Initial vertical velocity
   * @param {number} gravity - Gravity acceleration
   * @param {number} airResistance - Air resistance multiplier
   * @param {number} maxFrames - Total simulation frames to forecast
   * @param {number} sampleInterval - Frames between sample dots
   * @returns {Array<{ x: number, y: number, index: number, alpha: number }>}
   */
  static predictTrajectory(
    startX,
    startY,
    vx,
    vy,
    gravity = 0.42,
    airResistance = 0.998,
    maxFrames = 60,
    sampleInterval = 3
  ) {
    const points = [];
    let curX = startX;
    let curY = startY;
    let curVx = vx;
    let curVy = vy;

    for (let frame = 1; frame <= maxFrames; frame++) {
      curVy += gravity;
      curVx *= airResistance;
      curX += curVx;
      curY += curVy;

      if (frame % sampleInterval === 0) {
        // Subtle progressive fade out along the trajectory arc
        const progress = frame / maxFrames;
        const alpha = MathUtils.clamp(1.0 - progress * 0.85, 0.15, 1.0);
        points.push({
          x: curX,
          y: curY,
          index: points.length,
          alpha
        });
      }
    }

    return points;
  }
}

/**
 * Collision.js - ArrowPuck Collision and Hit Detection
 * Handles side-profile vertical target board collision testing,
 * multi-tier graded distance metrics, and scoring tier determination.
 */


class Collision {
  /**
   * Tests if the arrow hits the side-profile vertical target board.
   * Divided into 5 precision intervals for enhanced challenge.
   * 
   * @param {number} arrowX - Arrow tip X coordinate
   * @param {number} arrowY - Arrow tip Y coordinate
   * @param {number} prevX - Arrow tip X coordinate from previous frame
   * @param {number} boardX - Front strike face X of the target board
   * @param {number} boardY - Center Y of the target board
   * @param {number} [boardHeight=250] - Total height of the target board
   * @param {number} [boardWidth=26] - Thickness/depth of the target board
   * @returns {{ hit: boolean, impactX?: number, impactY?: number, distance?: number, score?: number, tier?: string, label?: string, ratio?: number }}
   */
  static checkBoardHit(arrowX, arrowY, prevX, boardX, boardY, boardHeight = 250, boardWidth = 26) {
    const halfH = boardHeight / 2;
    const inVerticalRange = arrowY >= boardY - halfH && arrowY <= boardY + halfH;

    // Arrow is sweeping across or touching the board's front strike face
    const sweptFace = (arrowX >= boardX && (prevX === undefined || prevX <= boardX + boardWidth));

    if (sweptFace && inVerticalRange) {
      const distFromCenter = Math.abs(arrowY - boardY);

      // 5 Graded Challenge Intervals:
      // Zone 1: Razor Bullseye (<= 8px from center, 16px total) -> 500 pts
      // Zone 2: Inner Master   (<= 22px from center)            -> 300 pts
      // Zone 3: Middle High    (<= 48px from center)            -> 150 pts
      // Zone 4: Mid-Outer      (<= 84px from center)            -> 75 pts
      // Zone 5: Outer Edge     (<= halfH)                       -> 25 pts
      const z1 = 8;
      const z2 = 22;
      const z3 = 48;
      const z4 = 84;

      if (distFromCenter <= z1) {
        return {
          hit: true,
          impactX: boardX,
          impactY: arrowY,
          distance: distFromCenter,
          score: 500,
          tier: 'bullseye',
          label: 'BULLSEYE! +500',
          ratio: distFromCenter / halfH
        };
      } else if (distFromCenter <= z2) {
        return {
          hit: true,
          impactX: boardX,
          impactY: arrowY,
          distance: distFromCenter,
          score: 300,
          tier: 'master',
          label: 'EXCELLENT! +300',
          ratio: distFromCenter / halfH
        };
      } else if (distFromCenter <= z3) {
        return {
          hit: true,
          impactX: boardX,
          impactY: arrowY,
          distance: distFromCenter,
          score: 150,
          tier: 'inner',
          label: '+150',
          ratio: distFromCenter / halfH
        };
      } else if (distFromCenter <= z4) {
        return {
          hit: true,
          impactX: boardX,
          impactY: arrowY,
          distance: distFromCenter,
          score: 75,
          tier: 'mid',
          label: '+75',
          ratio: distFromCenter / halfH
        };
      } else {
        return {
          hit: true,
          impactX: boardX,
          impactY: arrowY,
          distance: distFromCenter,
          score: 25,
          tier: 'outer',
          label: '+25',
          ratio: distFromCenter / halfH
        };
      }
    }

    return { hit: false };
  }

  /**
   * Compatibility method for circular targets.
   */
  static checkTargetHit(arrowTipX, arrowTipY, targetX, targetY, targetRadius) {
    const dist = MathUtils.distance(arrowTipX, arrowTipY, targetX, targetY);

    if (dist <= targetRadius) {
      const ratio = dist / targetRadius;

      if (ratio <= 0.33) {
        return {
          hit: true,
          distance: dist,
          score: 300,
          tier: 'bullseye',
          label: 'BULLSEYE! +300',
          ratio
        };
      } else if (ratio <= 0.66) {
        return {
          hit: true,
          distance: dist,
          score: 150,
          tier: 'inner',
          label: '+150',
          ratio
        };
      } else {
        return {
          hit: true,
          distance: dist,
          score: 50,
          tier: 'outer',
          label: '+50',
          ratio
        };
      }
    }

    return { hit: false };
  }

  /**
   * Checks if a point is outside viewport bounds plus a margin.
   */
  static isOutOfBounds(x, y, width, height, margin = 80) {
    return x < -margin || x > width + margin || y > height + margin;
  }

  /**
   * Checks if an arrow has hit the ground floor of the viewport.
   */
  static checkGroundHit(y, height, groundPadding = 24) {
    return y >= height - groundPadding;
  }
}

/**
 * Bow.js - Precision Archery Recurve Bow Entity
 * Renders an elegant aerodynamic recurve bow with flexing limbs,
 * dynamic aiming rotation, high-tensile bowstring, and vibration dampening.
 */


class Bow {
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

/**
 * Projectile.js - Precision Arrow Entity
 * Handles arrow kinematics, orientation tangent to velocity, and crisp geometric rendering.
 */


const ProjectileState = {
  IDLE: 'idle',
  AIMING: 'aiming',
  FLYING: 'flying',
  STUCK: 'stuck',
  FADING: 'fading'
};

class Projectile {
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
    const headHalfW = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, 0); // Sharp tip
    ctx.lineTo(-10, -headHalfW);
    ctx.lineTo(-10 + 2.5, 0); // Subtle inner bevel
    ctx.lineTo(-10, headHalfW);
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

/**
 * Target.js - Precision Wall-Mounted Archery Target Board (Side Profile)
 * Features 5 graded difficulty intervals without cluttered numbers,
 * ambient drop-shadow depth, multi-layer composite core, and crisp caliper markings.
 */


class Target {
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

/**
 * ParticleSystem.js - Minimalist Physical Micro-Sparks
 * Emits crisp, vector-sharp kinetic sparks upon impact instead of noisy confetti.
 */


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

class ParticleSystem {
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

/**
 * ScorePopup.js - Floating Score Indicator
 * Implements GDD Section 6.3: Rises and fades smoothly upon target hit.
 */

class ScorePopup {
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

    this.popups.push({
      x,
      y: y - 10,
      startY: y - 10,
      score,
      tier,
      text,
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
      const isHighTier = p.tier === 'bullseye' || p.tier === 'master';
      ctx.font = isHighTier
        ? '600 12px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '600 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const metrics = ctx.measureText(p.text);
      const paddingX = 10;
      const boxW = metrics.width + paddingX * 2;
      const boxH = 22;

      // Clean pill background
      ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
      ctx.strokeStyle = isHighTier ? this.accentColor : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 11);
      ctx.fill();
      ctx.stroke();

      // Typography
      ctx.fillStyle = isHighTier ? this.accentColor : '#ffffff';
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

/**
 * ArrowShot.js - Main Entry and Orchestration Class
 * Implements GDD Section 1-8: Full lifecycle management, non-intrusive Canvas layer,
 * high-DPI scaling, Euler physics, micro-sparks, and responsive layout.
 */


const GameState = {
  IDLE: 'idle',
  AIMING: 'aiming',
  FLYING: 'flying',
  HIT: 'hit',
  MISS: 'miss',
  RESETTING: 'resetting'
};

class ArrowShot {
  /**
   * @param {Object} [options] - Configuration options matching GDD Section 8
   */
  constructor(options = {}) {
    this.options = {
      mountTarget: document.body,
      bowPosition: 'bottom-left',
      targetPosition: 'top-right',
      gravity: 0.38,
      powerMultiplier: 0.38,
      maxDragRadius: 110,
      airResistance: 1.0,
      theme: {
        primaryColor: '#f59e0b',
        arrowColor: '#27272a',
        targetRingColors: ['#18181b', '#27272a', '#f59e0b']
      },
      enableTrajectory: true,
      enableSound: false,
      onHit: (score, totalScore) => {},
      onMiss: () => {},
      ...options
    };

    // State & Scores
    this.state = GameState.IDLE;
    this.totalScore = 0;
    this.totalShots = 0;
    this.hits = 0;

    // Time & loop tracking
    this.lastTime = 0;
    this.resetTimer = 0;
    this.rafId = null;

    // Pull tracking
    this.dragData = {
      dx: 0,
      dy: 0,
      distance: 0,
      ratio: 0,
      dragX: 0,
      dragY: 0
    };

    // Initialize audio synthesizer if requested
    this.audioCtx = null;
    if (this.options.enableSound) {
      this.initAudio();
    }

    // Build DOM & Canvas
    this.initDOM();

    // Instantiate Entities
    this.initEntities();

    // Setup input listeners on the non-intrusive trigger
    this.setupInteractions();

    // Start game loop
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Sets up full-screen fixed canvas and minimal trigger hotspot.
   */
  initDOM() {
    this.mountTarget = this.options.mountTarget || document.body;

    // 1. Full-screen fixed canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'arrowshot-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.zIndex = '99999';
    this.canvas.style.pointerEvents = 'none'; // Critical: strictly non-intrusive!
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';

    this.ctx = this.canvas.getContext('2d');
    this.mountTarget.appendChild(this.canvas);

    // 2. Interaction Hotspot Trigger (strictly captures inputs only at the launcher)
    this.triggerZone = document.createElement('div');
    this.triggerZone.id = 'arrowshot-trigger';
    this.triggerZone.style.position = 'fixed';
    this.triggerZone.style.width = '104px';
    this.triggerZone.style.height = '104px';
    this.triggerZone.style.borderRadius = '50%';
    this.triggerZone.style.pointerEvents = 'auto';
    this.triggerZone.style.cursor = 'grab';
    this.triggerZone.style.zIndex = '100000';
    this.triggerZone.style.touchAction = 'none';
    this.triggerZone.style.userSelect = 'none';
    this.triggerZone.style.webkitUserSelect = 'none';
    this.triggerZone.setAttribute('aria-label', 'ArrowPuck Launcher');
    this.triggerZone.title = 'Tıkla ve yayı geriye çekerek nişan al';

    this.mountTarget.appendChild(this.triggerZone);

    // Resize handling with high-DPI / retina sharpness
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  /**
   * Resizes canvas to exact viewport and recalculates high-DPI scaling.
   */
  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);

    // Recalculate anchor positions
    const bowCoords = this.calculatePosition(this.options.bowPosition, 'bow');
    const targetCoords = this.calculatePosition(this.options.targetPosition, 'target');

    this.bowPos = bowCoords;
    this.targetPos = targetCoords;

    // Reposition trigger hotspot element
    if (this.triggerZone) {
      this.triggerZone.style.left = `${bowCoords.x - 52}px`;
      this.triggerZone.style.top = `${bowCoords.y - 52}px`;
    }

    if (this.bow) {
      this.bow.setPosition(bowCoords.x, bowCoords.y);
    }
    if (this.target) {
      this.target.setPosition(targetCoords.x, targetCoords.y);
    }
    if (this.projectile && this.state === GameState.IDLE) {
      this.projectile.resetToIdle(bowCoords.x, bowCoords.y, -Math.PI / 4);
    }
  }

  /**
   * Resolves preset strings ('bottom-left', 'top-right') or explicit {x, y} coordinates.
   */
  calculatePosition(posConfig, type) {
    if (typeof posConfig === 'object' && posConfig !== null) {
      return { x: posConfig.x, y: posConfig.y };
    }

    if (type === 'bow') {
      const marginX = Math.max(50, Math.min(100, this.width * 0.08));
      const marginY = Math.max(60, Math.min(110, this.height * 0.12));

      switch (posConfig) {
        case 'bottom-right':
          return { x: this.width - marginX, y: this.height - marginY };
        case 'bottom-left':
        default:
          return { x: marginX, y: this.height - marginY };
      }
    } else {
      // Side-profile target board mounted on the right screen border
      const marginFromEdge = 34; // Board front face sits 34px from right border
      const boardX = this.width - marginFromEdge;
      const boardY = Math.max(130, Math.min(this.height * 0.36, this.height - 150));

      switch (posConfig) {
        case 'top-left':
          return { x: 34, y: boardY };
        case 'top-right':
        default:
          return { x: boardX, y: boardY };
      }
    }
  }

  /**
   * Instantiates Bow, Projectile, Target, and Particle System.
   */
  initEntities() {
    this.bow = new Bow({
      x: this.bowPos.x,
      y: this.bowPos.y,
      maxDragRadius: this.options.maxDragRadius,
      theme: this.options.theme
    });
    this.slingshot = this.bow; // Backward compatibility alias

    this.projectile = new Projectile({
      length: 42,
      theme: this.options.theme
    });
    this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);

    this.target = new Target({
      x: this.targetPos.x,
      y: this.targetPos.y,
      height: 250,
      width: 26,
      theme: this.options.theme
    });

    this.particles = new ParticleSystem({
      theme: this.options.theme
    });

    this.popups = new ScorePopup({
      theme: this.options.theme
    });
  }

  /**
   * Configures non-intrusive pointer interactions via pointer capture.
   */
  setupInteractions() {
    const trigger = this.triggerZone;

    trigger.addEventListener('pointerenter', () => {
      if (this.state === GameState.IDLE) {
        this.bow.isHovered = true;
      }
    });

    trigger.addEventListener('pointerleave', () => {
      if (this.state === GameState.IDLE) {
        this.bow.isHovered = false;
      }
    });

    trigger.addEventListener('pointerdown', (e) => {
      if (this.state !== GameState.IDLE) return;

      trigger.setPointerCapture(e.pointerId);
      trigger.style.cursor = 'grabbing';
      this.state = GameState.AIMING;
      this.bow.isHovered = true;

      this.updateDrag(e.clientX, e.clientY);
      this.playSound('aim');
    });

    trigger.addEventListener('pointermove', (e) => {
      if (this.state !== GameState.AIMING) return;
      this.updateDrag(e.clientX, e.clientY);
    });

    const releaseHandler = (e) => {
      if (this.state !== GameState.AIMING) return;

      try {
        trigger.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if already released
      }
      trigger.style.cursor = 'grab';
      this.bow.isHovered = false;

      // Minimum pull threshold to avoid accidental micro-clicks
      if (this.dragData.distance >= 12) {
        this.fireProjectile();
      } else {
        // Cancel pull smoothly
        this.state = GameState.IDLE;
        this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);
      }
    };

    trigger.addEventListener('pointerup', releaseHandler);
    trigger.addEventListener('pointercancel', releaseHandler);
  }

  /**
   * Computes clamped drag displacement and updates projectile aiming pose.
   */
  updateDrag(clientX, clientY) {
    this.dragData = Physics.calculatePullVector(
      this.bowPos.x,
      this.bowPos.y,
      clientX,
      clientY,
      this.options.maxDragRadius
    );

    this.projectile.updateAiming(
      this.dragData.dragX,
      this.dragData.dragY,
      this.dragData.dx,
      this.dragData.dy
    );
  }

  /**
   * Fires arrow with calculated initial velocity.
   */
  fireProjectile() {
    this.state = GameState.FLYING;
    this.totalShots++;

    const vel = Physics.calculateLaunchVelocity(
      this.dragData.dx,
      this.dragData.dy,
      this.options.powerMultiplier
    );

    this.projectile.launch(vel.vx, vel.vy);
    this.bow.triggerSnapBack(this.dragData.dx, this.dragData.dy);

    // Disable trigger hotspot while projectile is active
    this.triggerZone.style.pointerEvents = 'none';

    this.playSound('release');
  }

  /**
   * Handles target hit event.
   */
  onTargetHit(hitResult) {
    this.state = GameState.HIT;
    this.hits++;
    this.totalScore += hitResult.score;

    const impactX = hitResult.impactX ?? this.projectile.x;
    const impactY = hitResult.impactY ?? this.projectile.y;

    // Stick arrow into front face of target
    this.projectile.stick(impactX, impactY, this.projectile.angle);

    // Recoil shake on target board
    const impactSpeed = Math.hypot(this.projectile.vx, this.projectile.vy);
    this.target.hit(impactY, Math.max(10, impactSpeed * 0.8));

    // Emit minimalist micro-sparks leftward from impact face
    this.particles.emitSparks(impactX, impactY, this.projectile.angle, 24);

    // Spawn floating score pill
    this.popups.spawn(this.target.x - 36, impactY, hitResult.score, hitResult.tier);

    this.playSound('hit');

    // Callback notification
    if (typeof this.options.onHit === 'function') {
      this.options.onHit(hitResult.score, this.totalScore);
    }

    // Schedule reset
    this.resetTimer = 1.3;
  }

  /**
   * Handles miss or out-of-bounds event.
   */
  onMiss() {
    if (this.state === GameState.FLYING) {
      this.state = GameState.MISS;

      this.playSound('miss');

      if (typeof this.options.onMiss === 'function') {
        this.options.onMiss();
      }

      this.resetTimer = 0.9;
    }
  }

  /**
   * Resets game state smoothly back to IDLE.
   */
  resetCycle() {
    this.state = GameState.IDLE;
    this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);
    this.triggerZone.style.pointerEvents = 'auto';
  }

  /**
   * Synthesizes minimalist mechanical UI audio tones via Web Audio API.
   */
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playSound(type) {
    if (!this.options.enableSound || !this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'release') {
      // Crisp whip / snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'hit') {
      // Minimalist metallic chime / chime click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'miss') {
      // Dull floor thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  /**
   * Main game animation loop.
   */
  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Per-frame updates.
   */
  update(dt) {
    this.bow.update(dt);
    this.target.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);

    if (this.state === GameState.FLYING) {
      const prevX = this.projectile.x;
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);

      // Check collision with side-profile vertical target board
      const hitResult = Collision.checkBoardHit(
        this.projectile.x,
        this.projectile.y,
        prevX,
        this.target.x + this.target.offsetX,
        this.target.y + this.target.offsetY,
        this.target.height,
        this.target.width
      );

      if (hitResult.hit) {
        this.onTargetHit(hitResult);
        return;
      }

      // Check floor ground collision
      if (Collision.checkGroundHit(this.projectile.y, this.height, 16)) {
        this.projectile.stick(this.projectile.x, this.height - 16, this.projectile.angle);
        this.onMiss();
        return;
      }

      // Check out of bounds
      if (Collision.isOutOfBounds(this.projectile.x, this.projectile.y, this.width, this.height)) {
        this.onMiss();
        return;
      }
    } else if (this.state === GameState.HIT || this.state === GameState.MISS) {
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) {
        this.resetCycle();
      }
    }
  }

  /**
   * Renders trajectory guide dots.
   */
  renderTrajectory() {
    if (!this.options.enableTrajectory || this.state !== GameState.AIMING) return;
    if (this.dragData.distance < 12) return;

    const vel = Physics.calculateLaunchVelocity(
      this.dragData.dx,
      this.dragData.dy,
      this.options.powerMultiplier
    );

    const points = Physics.predictTrajectory(
      this.bowPos.x,
      this.bowPos.y,
      vel.vx,
      vel.vy,
      this.options.gravity,
      this.options.airResistance,
      80,
      2
    );

    const ctx = this.ctx;
    ctx.save();

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const radius = MathUtils.clamp(2.4 - (i / points.length) * 1.2, 1.1, 2.4);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 158, 11, ${pt.alpha * 0.75})`;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Master render routine.
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const isAiming = this.state === GameState.AIMING;

    // 1. Back layer of bow (bowstring and draw guide)
    this.bow.renderBack(
      ctx,
      isAiming,
      this.dragData.dragX,
      this.dragData.dragY,
      this.dragData.ratio
    );

    // 2. Trajectory prediction dots
    this.renderTrajectory();

    // 3. Arrow Projectile
    if (this.state === GameState.HIT) {
      this.projectile.render(ctx, this.target.offsetX, this.target.offsetY);
    } else {
      this.projectile.render(ctx);
    }

    // 4. Front layer of bow (recurve limbs, riser grip, arrow shelf)
    this.bow.renderFront(
      ctx,
      isAiming,
      this.dragData.dragX,
      this.dragData.dragY,
      this.dragData.ratio
    );

    // 5. Target Board
    this.target.render(ctx);

    // 6. FX Micro-Sparks
    this.particles.render(ctx);

    // 7. FX Score Popups
    this.popups.render(ctx);
  }

  /**
   * Public API: reset game score and projectile.
   */
  reset() {
    this.totalScore = 0;
    this.totalShots = 0;
    this.hits = 0;
    this.particles.clear();
    this.popups.clear();
    this.resetCycle();
  }

  /**
   * Public API: get current game metrics.
   */
  getStats() {
    return {
      score: this.totalScore,
      shots: this.totalShots,
      hits: this.hits,
      accuracy: this.totalShots > 0 ? Math.round((this.hits / this.totalShots) * 100) : 0
    };
  }

  /**
   * Cleanup method to remove DOM elements and listeners.
   */
  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.canvas?.remove();
    this.triggerZone?.remove();
    if (this.audioCtx) this.audioCtx.close();
  }
}

// Auto-register to window in browser environments for direct CDN/script-tag usage
if (typeof window !== 'undefined') {
  window.ArrowPuck = ArrowShot;
  window.ArrowShot = ArrowShot;
}

const ArrowPuck = ArrowShot;

export { ArrowPuck, ArrowShot, GameState, ArrowPuck as default };
//# sourceMappingURL=arrowpuck.esm.js.map
