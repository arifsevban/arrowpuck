/**
 * Slingshot.js - Backwards compatibility alias for Bow.
 */

import { Bow } from './Bow.js';

export class Slingshot extends Bow {
  constructor(options) {
    super(options);
  }
}

export { Bow };
