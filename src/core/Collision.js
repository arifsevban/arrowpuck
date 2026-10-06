/**
 * Collision.js - ArrowShot Collision and Hit Detection
 * Implements GDD Section 4.5 concentric ring collision testing,
 * distance metrics, and scoring tier determination.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Collision {
  /**
   * Tests if the arrow tip hits the circular target.
   * 
   * @param {number} arrowTipX - Arrow tip X coordinate
   * @param {number} arrowTipY - Arrow tip Y coordinate
   * @param {number} targetX - Target center X coordinate
   * @param {number} targetY - Target center Y coordinate
   * @param {number} targetRadius - Outer radius of the target
   * @returns {{ hit: boolean, distance: number, score: number, tier: string, label: string, ratio: number } | { hit: false }}
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
   * 
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} margin
   * @returns {boolean}
   */
  static isOutOfBounds(x, y, width, height, margin = 80) {
    return x < -margin || x > width + margin || y > height + margin;
  }

  /**
   * Checks if an arrow has hit the ground floor of the viewport.
   * 
   * @param {number} y
   * @param {number} height
   * @param {number} groundPadding
   * @returns {boolean}
   */
  static checkGroundHit(y, height, groundPadding = 24) {
    return y >= height - groundPadding;
  }
}
