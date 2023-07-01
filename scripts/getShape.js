/* globals
*/

"use strict";

import { SETTINGS } from "./settings.js";
import { WalledTemplate, templateFlagProperties } from "./WalledTemplate.js";


/**
 * Use ClockwiseSweep to construct the polygon shape, passing it this template object.
 */


/**
 * Wrap MeasuredTemplate.prototype._computeShape
 * Allow the original shape to be constructed, then build from that.
 * @returns {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon}
 */
export function _computeShapeMeasuredTemplate(wrapped) {
  // Store the original shape.
  this.originalShape = wrapped();
  if ( !requiresSweep(this) ) return this.originalShape;

  const walledTemplate = WalledTemplate.fromMeasuredTemplate(this);
  const poly = walledTemplate.computeSweepPolygon();

  poly.x = this.originalShape.x;
  poly.y = this.originalShape.y;
  poly.radius = this.originalShape.radius;

  if ( !poly || isNaN(poly.points[0]) ) {
    console.error("_computeShapeMeasuredTemplate poly is broken.");
    return this.originalShape;
  }
  return poly;
}

/**
 * Determine if a sweep is needed for a template.
 * @param {MeasuredTemplate}
 * @returns {boolean}
 */
function requiresSweep(template) {
  const { wallsBlock } = templateFlagProperties(template);
  return wallsBlock !== SETTINGS.DEFAULTS.CHOICES.UNWALLED;
}
