/* globals
CONFIG,
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
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @returns {PIXI.Rectangle}
   */
  calculateOriginalShape({ distance } = {}) {
    distance ??= this.distance;

    // Convert to degrees and grid units for Foundry method.
    distance = CONFIG.GeometryLib.utils.pixelsToGridUnits(distance);

    // TODO: Redo for v12's grid settings.
    // Based on 5-5-5, the square's width should equate to the circle's diameter.
    // (Consider the diameter of the circle in the X-Y directions.)
    distance ??= this.distance;
    const dist2 = distance * 2;
    return new PIXI.Rectangle(-distance, -distance, dist2, dist2);
  }
}
