/* globals
canvas,
CONFIG,
MeasuredTemplate,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";


import { WalledTemplateRectangle } from "./WalledTemplateRectangle.js";
import { pixelsToGridUnits } from "../geometry/util.js";

/**
 * Calculate the radius of the rounded rectangle based on the smaller of the width or height.
 * radius = Math.min(width, height) * multiplier
 * @param {number} width
 * @param {number} height
 * @param {number} [multiplier=0.1]
 * @returns {number}
 */
function calculateRadius(width, height, multiplier = 0.1) {
  return Math.min(width, height) * multiplier;
}

export class WalledTemplateRoundedRectangle extends WalledTemplateRectangle {

  /**
   * Calculate the original template shape from base Foundry.
   * Implemented by subclass.
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @returns {PIXI.Rectangle}
   */
  calculateOriginalShape(opts) {
    const rect = super.calculateOriginalShape(opts);
    return new PIXI.RoundedRectangle(rect.x, rect.y, rect.width, rect.height, calculateRadius(rect.width, rect.height));
  }

  /**
   * Compute the shape to be used for this template.
   * Output depends on the specific template settings.
   * @returns {PIXI.Polygon|PIXI.Circle}
   */
  computeShape() {
    const shape = super.computeShape();

    // Set values that Sequencer or other modules may use from the rectangle.
    const origShape = this.originalShape;
    shape.radius ??= origShape.radius;
    return shape;
  }
}
