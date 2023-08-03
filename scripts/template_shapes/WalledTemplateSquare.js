/* globals
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplateCircle } from "./WalledTemplateCircle.js";

export class WalledTemplateSquare extends WalledTemplateCircle {
  /**
   * Square centered on an origin point.
   * See dndHelpers for original:
   * https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L91
   * Conforms with 5-5-5 diagonal rule.
   */
  get originalShape() {
    // Based on 5-5-5, the square's width should equate to the circle's diameter.
    // (Consider the diameter of the circle in the X-Y directions.)
    const distance = this.distance;
    const dist2 = distance * 2;
    return new PIXI.Rectangle(-distance, -distance, dist2, dist2);
  }
}
