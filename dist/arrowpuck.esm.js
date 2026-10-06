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
 * Target.js - Suspended Archery Target Board (Side Profile)
 * Suspended from the top of the screen via a precision cable.
 * Swings dynamically like a damped pendulum based on arrow impact speed and hit height.
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

    // Bullseye golden flash intensity [0, 1]
    this.bullseyeFlash = 0;

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
   * Triggers a radiant golden energy flash across the bullseye notch and core.
   */
  triggerBullseyeFlash() {
    this.bullseyeFlash = 1.0;
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

    // Decay bullseye golden flash
    if (this.bullseyeFlash > 0) {
      this.bullseyeFlash = Math.max(0, this.bullseyeFlash - dt * 2.4);
    }
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

    // Bullseye Radiant Golden Flash Glow
    if (this.bullseyeFlash > 0.01) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 24 * this.bullseyeFlash;
      ctx.fillStyle = `rgba(251, 191, 36, ${0.45 * this.bullseyeFlash})`;
      ctx.fillRect(boardLeft - 4, centerY - z1 - 3, boardW + 8, (z1 + 3) * 2);

      // Radial energy ring from notch
      ctx.beginPath();
      ctx.arc(strikeX, centerY, 6 + (1 - this.bullseyeFlash) * 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * this.bullseyeFlash})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

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
    if (tier === 'bullseye') text = `🎯 BULLSEYE +${score}`;
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
      autoOpen: false,
      showPrompt: true,
      promptText: 'Bored? 🎯',
      closeText: '✕ Close',
      promptPosition: 'bottom-right',
      theme: {
        primaryColor: '#f59e0b',
        arrowColor: '#27272a',
        targetRingColors: ['#18181b', '#27272a', '#f59e0b']
      },
      enableTrajectory: true,
      enableSound: false,
      onOpen: () => {},
      onClose: () => {},
      onHit: (score, totalScore) => {},
      onMiss: () => {},
      ...options
    };

    // State & Scores
    this.state = GameState.IDLE;
    this.totalScore = 0;
    this.totalShots = 0;
    this.hits = 0;

    // Open/Closed widget state
    this.isOpen = Boolean(this.options.autoOpen);
    this.openProgress = this.isOpen ? 1 : 0;

    // Time & loop tracking
    this.lastTime = 0;
    this.resetTimer = 0;
    this.rafId = null;

    // Tactile screen micro-shake on bullseye hit
    this.screenShake = 0;
    this.screenShakeMagnitude = 0;

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
   * Sets up full-screen fixed canvas, minimal trigger hotspot, and floating prompt.
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
    this.triggerZone.style.display = this.isOpen ? 'block' : 'none';
    this.triggerZone.setAttribute('aria-label', 'ArrowPuck Launcher');
    this.triggerZone.title = 'Tıkla ve yayı geriye çekerek nişan al';

    this.mountTarget.appendChild(this.triggerZone);

    // 3. Floating interactive prompt badge (attention-grabber on host site)
    if (this.options.showPrompt) {
      this.initPromptUI();
    }

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
      // Suspended side-profile target board hanging from the ceiling (not glued to edge)
      const marginFromEdge = Math.max(100, Math.min(160, this.width * 0.12));
      const boardX = this.width - marginFromEdge;
      const boardY = Math.max(160, Math.min(this.height * 0.38, this.height - 180));

      switch (posConfig) {
        case 'top-left':
          return { x: marginFromEdge, y: boardY };
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
      theme: this.options.theme,
      initiallyDeployed: this.isOpen
    });

    this.particles = new ParticleSystem({
      theme: this.options.theme
    });

    this.popups = new ScorePopup({
      theme: this.options.theme
    });
  }

  /**
   * Initializes floating interactive trigger pill on host website.
   */
  initPromptUI() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('arrowshot-prompt-styles')) {
      const style = document.createElement('style');
      style.id = 'arrowshot-prompt-styles';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500;1,600&family=Inter:wght@400;500&display=swap');

        .arrowshot-prompt-link {
          position: fixed;
          z-index: 100001;
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          background: transparent !important;
          border: none !important;
          padding: 6px 8px !important;
          margin: 0;
          box-shadow: none !important;
          outline: none;
          color: #a1a1aa;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          text-decoration: none;
          transition: color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
          opacity: 0.85;
        }
        .arrowshot-prompt-link:hover {
          color: #f4f4f5;
          opacity: 1;
          transform: translateY(-1.5px);
        }
        .arrowshot-prompt-text {
          font-family: 'Playfair Display', Georgia, Cambria, 'Times New Roman', serif;
          font-style: italic;
          font-size: 16.5px;
          font-weight: 400;
          letter-spacing: 0.02em;
          border-bottom: 1px dotted rgba(255, 255, 255, 0.3);
          padding-bottom: 2px;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .arrowshot-prompt-link:hover .arrowshot-prompt-text {
          border-bottom-color: rgba(245, 158, 11, 0.75);
          color: #ffffff;
        }
        .arrowshot-prompt-emoji {
          font-size: 15px;
          font-style: normal;
          display: inline-block;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .arrowshot-prompt-link:hover .arrowshot-prompt-emoji {
          transform: scale(1.2) rotate(12deg);
        }
        .arrowshot-prompt-close {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #71717a;
          letter-spacing: 0.02em;
          transition: color 0.2s ease, border-color 0.2s ease;
          border-bottom: 1px dotted transparent;
          padding-bottom: 1px;
        }
        .arrowshot-prompt-link:hover .arrowshot-prompt-close {
          color: #e4e4e7;
          border-bottom-color: rgba(255, 255, 255, 0.4);
        }
      `;
      document.head.appendChild(style);
    }

    this.promptBtn = document.createElement('button');
    this.promptBtn.id = 'arrowshot-prompt';
    this.promptBtn.className = 'arrowshot-prompt-link' + (this.isOpen ? ' is-active' : '');

    // Positioning
    const pos = this.options.promptPosition;
    if (typeof pos === 'object' && pos !== null) {
      Object.assign(this.promptBtn.style, pos);
    } else {
      switch (pos) {
        case 'bottom-left':
          this.promptBtn.style.bottom = '24px';
          this.promptBtn.style.left = '24px';
          break;
        case 'top-right':
          this.promptBtn.style.top = '24px';
          this.promptBtn.style.right = '24px';
          break;
        case 'top-left':
          this.promptBtn.style.top = '24px';
          this.promptBtn.style.left = '24px';
          break;
        case 'bottom-right':
        default:
          this.promptBtn.style.bottom = '24px';
          this.promptBtn.style.right = '28px';
          break;
      }
    }

    this.updatePromptButtonUI();

    this.promptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.mountTarget.appendChild(this.promptBtn);
  }

  /**
   * Updates prompt pill content according to open/closed state.
   */
  updatePromptButtonUI() {
    if (!this.promptBtn) return;
    if (this.isOpen) {
      this.promptBtn.classList.add('is-active');
      this.promptBtn.innerHTML = `
        <span class="arrowshot-prompt-close">${this.options.closeText}</span>
      `;
      this.promptBtn.setAttribute('aria-label', this.options.closeText);
      this.promptBtn.title = 'Close interactive target';
    } else {
      this.promptBtn.classList.remove('is-active');
      const text = this.options.promptText || 'Bored? 🎯';
      const emojiMatch = text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
      if (emojiMatch) {
        const emoji = emojiMatch[0];
        const label = text.replace(emoji, '').trim();
        this.promptBtn.innerHTML = `
          <span class="arrowshot-prompt-text">${label}</span>
          <span class="arrowshot-prompt-emoji">${emoji}</span>
        `;
      } else {
        this.promptBtn.innerHTML = `<span class="arrowshot-prompt-text">${text}</span>`;
      }
      this.promptBtn.setAttribute('aria-label', text);
      this.promptBtn.title = 'Click to drop archery target';
    }
  }

  /**
   * Public API: Activates and opens the widget.
   * Target plunges down from the ceiling with pendulum drop animation.
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.openProgress = 0;
    this.triggerZone.style.display = 'block';

    this.updatePromptButtonUI();
    this.target.startDrop();

    this.options.onOpen?.();
  }

  /**
   * Public API: Closes and retracts the widget.
   * Target retracts back into the ceiling, bow fades away.
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.triggerZone.style.display = 'none';

    this.updatePromptButtonUI();
    this.target.startRetract();

    if (this.state === GameState.AIMING || this.state === GameState.FLYING) {
      this.resetCycle();
    }

    this.options.onClose?.();
  }

  /**
   * Public API: Toggles widget open/closed state.
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
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

    // Record relative coordinate on target board for swinging follow
    this.stuckRelY = impactY - this.target.y;
    this.stuckBaseAngle = this.projectile.angle;

    // Stick arrow into front face of target
    this.projectile.stick(impactX, impactY, this.projectile.angle);

    // Trigger physical pendulum swing on suspended target
    const impactSpeed = Math.hypot(this.projectile.vx, this.projectile.vy);
    this.target.hit(impactY, Math.max(12, impactSpeed));

    const isBullseye = hitResult.tier === 'bullseye';

    if (isBullseye) {
      // Spectacular golden particle burst, dual shockwaves, and stars
      this.particles.emitBullseyeBurst(impactX, impactY, this.projectile.angle);
      this.target.triggerBullseyeFlash();
      this.screenShake = 0.24;
      this.screenShakeMagnitude = 4.8;
      this.playSound('bullseye');
      this.popups.spawn(this.target.x - 48, impactY, hitResult.score, 'bullseye');
      this.resetTimer = 1.6;
    } else {
      // Standard kinetic micro-sparks leftward from impact face
      this.particles.emitSparks(impactX, impactY, this.projectile.angle, 24);
      this.popups.spawn(this.target.x - 36, impactY, hitResult.score, hitResult.tier);
      this.playSound('hit');
      this.resetTimer = 1.45;
    }

    // Callback notification
    if (typeof this.options.onHit === 'function') {
      this.options.onHit(hitResult.score, this.totalScore);
    }
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
    this.stuckRelY = null;
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
    } else if (type === 'bullseye') {
      // Celebratory multi-tone golden chime arpeggio
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 major triad
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.46);
      });
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
    // Smooth transition tracking for bow and arrow entrance
    if (this.isOpen && this.openProgress < 1) {
      this.openProgress = Math.min(1, this.openProgress + dt / 0.45);
    } else if (!this.isOpen && this.openProgress > 0) {
      this.openProgress = Math.max(0, this.openProgress - dt / 0.35);
    }

    // Decay tactile screen shake
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt);
    }

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
    } else if (this.state === GameState.HIT) {
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);

      // Embedded arrow swings and tilts in unison with the suspended board
      if (typeof this.stuckRelY === 'number') {
        const worldCoords = this.target.toWorldCoords(0, this.stuckRelY);
        this.projectile.x = worldCoords.x;
        this.projectile.y = worldCoords.y;
        this.projectile.angle = this.stuckBaseAngle + worldCoords.angleDelta;
      }

      this.resetTimer -= dt;
      if (this.resetTimer <= 0) {
        this.resetCycle();
      }
    } else if (this.state === GameState.MISS) {
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

    // If completely closed and target is not in motion, skip rendering
    if (!this.isOpen && this.openProgress <= 0 && !this.target.isDropping && !this.target.isRetracting) {
      return;
    }

    // Apply tactile screen micro-shake on bullseye impact
    let shook = false;
    if (this.screenShake > 0) {
      shook = true;
      const decay = this.screenShake / 0.24;
      const sx = (Math.random() - 0.5) * 2 * this.screenShakeMagnitude * decay;
      const sy = (Math.random() - 0.5) * 2 * this.screenShakeMagnitude * decay;
      ctx.save();
      ctx.translate(sx, sy);
    }

    // 1. Target Board (Renders ceiling mount, suspension cord & swinging board)
    this.target.render(ctx);

    // 2. Bow & Arrow with smooth entrance fade and slide
    const isAiming = this.state === GameState.AIMING;
    const bowAlpha = MathUtils.clamp(this.openProgress, 0, 1);
    const bowSlide = (1 - Math.sin(bowAlpha * Math.PI / 2)) * 48;

    if (bowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = bowAlpha;
      ctx.translate(0, bowSlide);

      // Back layer of bow (bowstring and draw guide)
      this.bow.renderBack(
        ctx,
        isAiming,
        this.dragData.dragX,
        this.dragData.dragY,
        this.dragData.ratio
      );

      // Trajectory prediction dots
      this.renderTrajectory();

      // Front layer of bow (recurve limbs, riser grip, arrow shelf)
      this.bow.renderFront(
        ctx,
        isAiming,
        this.dragData.dragX,
        this.dragData.dragY,
        this.dragData.ratio
      );

      ctx.restore();
    }

    // 3. Arrow Projectile
    // Rendered independently so stuck or flying arrows maintain exact coordinates
    if (this.state === GameState.HIT || this.state === GameState.MISS || this.state === GameState.FLYING) {
      this.projectile.render(ctx);
    } else if (bowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = bowAlpha;
      ctx.translate(0, bowSlide);
      this.projectile.render(ctx);
      ctx.restore();
    }

    // 4. FX Micro-Sparks
    this.particles.render(ctx);

    // 5. FX Score Popups
    this.popups.render(ctx);

    if (shook) {
      ctx.restore();
    }
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
    this.promptBtn?.remove();
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
