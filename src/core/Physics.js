/**
 * Physics.js - ArrowShot Core Physics Engine
 * Implements GDD Section 4: displacement clamping, Euler flight integration,
 * velocity calculations, and trajectory forecasting.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Physics {
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
