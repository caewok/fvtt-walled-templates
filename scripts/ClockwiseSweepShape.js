/* globals
foundry,
*/
"use strict";

/* Testing
Draw = CONFIG.GeometryLib.Draw;
draw = new Draw();

MAX_TEXTURE_SIZE = Math.pow(2, 16);
INV_MAX_TEXTURE_SIZE = 1 / MAX_TEXTURE_SIZE;
function pointFromKey(key) {
  const x = ~~(key * INV_MAX_TEXTURE_SIZE);
  const y = key % MAX_TEXTURE_SIZE;
  return {x, y}
}


[t] = canvas.templates.placeables
t.shape._sweep.edgesEncountered.forEach(edge => draw.segment(edge))
t.shape._sweep.cornersEncountered.forEach(corner => draw.point(pointFromKey(corner), { radius: 2 }))

*/

/**
 * Extend Clockwise Sweep to track when the sweep hits wall corners or wall edges.
 * Used for bounce and spread options for templates.
 * Also handles other shape-specific modifications to sweep previously done using libWrapper.
 */
export class ClockwiseSweepShape extends foundry.canvas.geometry.ClockwiseSweepPolygon {
  /**
   * "Corner" points encountered. Corners are when the sweep hits a non-limited wall
   * and must extend the sweep beyond that point.
   * @type {Point[]}
   */
  cornersEncountered = new Set();

  /**
   * "Edges" or walls encountered. Added if the wall forms part of the polygon.
   * @type {Set<Wall>}
   */
  edgesEncountered = new Set();

  /** @inheritdoc */
  _compute() {
    this.cornersEncountered.clear();
    this.edgesEncountered.clear();
    super._compute();
  }

  addPoint(point) {
    super.addPoint(point);

    // Super will skip repeated points, which really should not happen in sweep.
    // const l = this.points.length;
    // if ( (x === this.points[l-2]) && (y === this.points[l-1]) ) return this;
    if ( point.isEndpoint ) this.cornersEncountered.add(keyFromPoint(point.x, point.y));
    point.cwEdges.forEach(edge => this.edgesEncountered.add(edge));
  }
}

//  Same as PolygonVertex
const MAX_TEXTURE_SIZE = Math.pow(2, 16);
const INV_MAX_TEXTURE_SIZE = 1 / MAX_TEXTURE_SIZE;

/**
 * Construct an integer key from a 2d point.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function keyFromPoint(x, y) {
  return (MAX_TEXTURE_SIZE * x) + y;
}

