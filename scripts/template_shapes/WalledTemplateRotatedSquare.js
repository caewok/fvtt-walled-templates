/* globals
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplateCircle } from "./WalledTemplateCircle.js";
import { Matrix } from "../geometry/Matrix.js";

export class WalledTemplateRotatedSquare extends WalledTemplateCircle {

  /**
   * Square centered on an origin point.
   * See dndHelpers for original:
   * https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L91
   * Conforms with 5-5-5 diagonal rule.
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @returns {PIXI.Rectangle}
   */
  calculateOriginalShape({ distance, direction } = {}) {
    // distance ??= this.distance;

    // Convert to degrees and grid units for Foundry method.
    // distance = CONFIG.GeometryLib.utils.pixelsToGridUnits(distance);

    // TODO: Redo for v12's grid settings.
    // Based on 5-5-5, the square's width should equate to the circle's diameter.
    // (Consider the diameter of the circle in the X-Y directions.)
    distance ??= this.distance;
    const dist2 = distance * 2;

    direction ??= this.direction;
    const rect = new PIXI.Rectangle(-distance, -distance, dist2, dist2);
    const centroid = PIXI.Point.tmp.set(0, 0);
    const poly = rotatePolygon(rect.toPolygon(), direction, centroid);
    centroid.release();
    return poly;
  }
}


/**
 * Rotate a polygon a given amount clockwise, in radians.
 * @param {PIXI.Polygon} poly   The polygon
 * @param {number} rotation     The amount to rotate clockwise in radians
 * @param {PIXI.Point} [centroid]   Center of the polygon
 */
function rotatePolygon(poly, rotation = 0, centroid) {
  if ( !rotation ) return poly;
  centroid ??= poly.center;

  // Translate to 0,0, rotate, translate back based on centroid.
  const rot = Matrix.rotationZ(rotation, false);
  const trans = Matrix.translation(-centroid.x, -centroid.y);
  const revTrans = Matrix.translation(centroid.x, centroid.y);
  const M = trans.multiply3x3(rot).multiply3x3(revTrans);

  // Multiply by the points of the polygon.
  const nPoints = poly.points.length * 0.5;
  const arr = new Array(nPoints);
  for ( let i = 0; i < nPoints; i += 1 ) {
    const j = i * 2;
    arr[i] = [poly.points[j], poly.points[j+1], 1];
  }
  const polyM = new Matrix(arr);
  const rotatedM = polyM.multiply(M);

  const rotatedPoints = new Array(poly.points.length);
  for ( let i = 0; i < nPoints; i += 1 ) {
    const j = i * 2;
    rotatedPoints[j] = rotatedM.arr[i][0];
    rotatedPoints[j+1] = rotatedM.arr[i][1];
  }
  return new PIXI.Polygon(rotatedPoints);
}
