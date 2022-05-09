// Used in the clockwise sweep: boundaryPolygon callback function.

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
  if(shape instanceof PIXI.Polygon) {
    const shifted_origin = pointFromAngle(origin, Math.toRadians(this.data.direction), -1)
    log(`boundaryPolygon|Polygon shifted origin to ${shifted_origin.x},${shifted_origin.y} for direction ${this.data.direction}`);
    shape.translate(shifted_origin.x, shifted_origin.y);
  } else if(shape instanceof PIXI.Rectangle) {
    // Pad the rectangle by one pixel so it definitely includes origin
    shape.translate(origin.x, origin.y);
    shape.pad(1, 1);

    // Move origin depending on where the origin is relative to the rectangle
    // (is at one of four corners). Use direction to determine.
//     const dir = this.data.direction;
//     if(dir >= 0 && dir < 90) {
//       // Origin at top left.
//       log(`boundaryPolygon|Rectangle shifted origin to ${origin.x - 1},${origin.y - 1} for direction ${dir}`);
//       shape.translate(origin.x - 1, origin.y - 1);
//     } else if(dir >= 90 && dir < 180) {
//       // Origin at bottom left.
//       log(`boundaryPolygon|Rectangle shifted origin to ${origin.x - 1},${origin.y + 1} for direction ${dir}`);
//       shape.translate(origin.x - 1, origin.y + 1);
//     } else if(dir >= 180 && dir < 270) {
//       // Origin at bottom right.
//       log(`boundaryPolygon|Rectangle shifted origin to ${origin.x + 1},${origin.y + 1} for direction ${dir}`);
//       shape.translate(origin.x + 1, origin.y + 1);
//     } else {
//       // Origin at top right. (>= 270)
//       log(`boundaryPolygon|Rectangle shifted origin to ${origin.x + 1},${origin.y - 1} for direction ${dir}`);
//       shape.translate(origin.x + 1, origin.y - 1);
//     }

  } else {
    shape.translate(origin.x, origin.y);
  }

  log(`boundaryPolygon| returning shape class ${typeof shape}`, shape);
  return shape;
}

