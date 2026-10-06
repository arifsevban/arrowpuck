/**
 * Collision.js - ArrowPuck Collision and Hit Detection
 * Handles side-profile vertical target board collision testing,
 * multi-tier graded distance metrics, and scoring tier determination.
 */

import { MathUtils } from '../utils/MathUtils.js';

export class Collision {
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
