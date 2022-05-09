/* globals
PIXI
*/

"use strict";

import { log } from "./module.js";
import { pointFromAngle } from "./ClockwiseSweep/utilities.js";

/**
 * Callback function to create a polygon boundary in the shape of a flat cone.
 * Passed to ClockwiseSweep.
 * @param {Point}   origin
 * @param {Number}  radius
 * @param {Number}  rotation
 * @return {PIXI.Polygon}
 */
export function boundaryPolygon(origin, radius, rotation = 0) { // eslint-disable-line no-unused-vars
  // The MeasuredTemplate already defines a polygon or other shape but at origin 0, 0.
  // Shift it to the provided origin on the canvas.
  const shape = this.shape;

  log(`boundaryPolygon|origin: ${origin.x},${origin.y}, radius: ${radius}, rotation: ${rotation} and shape class ${typeof shape}`, this, shape);

  // Need to ensure the boundary contains the origin.
  if (shape instanceof PIXI.Polygon) {
    const shifted_origin = pointFromAngle(origin, Math.toRadians(this.data.direction), -1);
    log(`boundaryPolygon|Polygon shifted origin to ${shifted_origin.x},${shifted_origin.y} for direction ${this.data.direction}`);
    shape.translate(shifted_origin.x, shifted_origin.y);
  } else if (shape instanceof PIXI.Rectangle) {
    // Pad the rectangle by one pixel so it definitely includes origin
    shape.translate(origin.x, origin.y);
    shape.pad(1, 1);

  } else if (shape instanceof PIXI.Circle) {
    // Make the circle very slightly larger to better match expected template outputs.
    shape.radius *= .1;
  } else {
    shape.translate(origin.x, origin.y);
  }

  log(`boundaryPolygon| returning shape class ${typeof shape}`, shape);
  return shape;
}

