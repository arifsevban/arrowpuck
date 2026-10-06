/**
 * MathUtils.js - ArrowShot Vector and Math Utilities
 * Pure ES6+, zero dependencies.
 */

export const MathUtils = {
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
