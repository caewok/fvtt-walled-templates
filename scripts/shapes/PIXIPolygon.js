/* globals
PIXI
*/
"use strict";

/**
 * Translate, shifting it in the x and y direction.
 * @param {Number} dx  Movement in the x direction.
 * @param {Number} dy  Movement in the y direction.
 * @return {PIXI.Polygon}
 */
function translate(dx, dy) {
  const pts = [];
  const ln = this.points.length;
  for (let i = 0; i < ln; i += 2) {
    pts.push(this.points[i] + dx, this.points[i + 1] + dy);
  }
//   const out = new this.constructor(pts);
  const out = new PIXI.Polygon(pts); // Don't use the constructor b/c ClockwiseSweep will screw this up
  out._isClosed = this._isClosed;
  return out;
}

/**
 * Iterate over the polygon's {x, y} points in order.
 * If the polygon is closed and close is false,
 * the last two points (which should equal the first two points) will be dropped.
 * Otherwise, all points will be returned regardless of the close value.
 * @return {x, y} PIXI.Point
 */
function* iteratePoints({close = true} = {}) {
  const dropped = (!this.isClosed || close) ? 0 : 2;
  const ln = this.points.length - dropped;
  for (let i = 0; i < ln; i += 2) {
    yield new PIXI.Point(this.points[i], this.points[i + 1]);
  }
}

/**
 * Iterate over the polygon's edges in order.
 * If the polygon is closed and close is false,
 * the last two points (which should equal the first two points) will be dropped and thus
 * the final edge closing the polygon will be ignored.
 * Otherwise, all edges, including the closing edge, will be returned regardless of the
 * close value.
 * @return Return an object { A: {x, y}, B: {x, y}} for each edge
 * Edges link, such that edge0.B === edge.1.A.
 */
function* iterateEdges({close = true} = {}) {
  // Very similar to iteratePoints
  const dropped = (!this.isClosed || close) ? 0 : 2;
  const iter = this.points.length - dropped - 2;
  for (let i = 0; i < iter; i += 2) {
    yield { A: { x: this.points[i], y: this.points[i + 1] },       // eslint-disable-line indent
            B: { x: this.points[i + 2], y: this.points[i + 3] } }; // eslint-disable-line indent
  }
}

/**
 * Area of polygon
 * @returns {number}
 */
function area() {
  const path = this.toClipperPoints();
  return Math.abs(ClipperLib.Clipper.Area(path));
}



// ----------------  ADD METHODS TO THE PIXI.POLYGON PROTOTYPE --------------------------
export function registerPIXIPolygonMethods() {

  Object.defineProperty(PIXI.Polygon.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "iteratePoints", {
    value: iteratePoints,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "iterateEdges", {
    value: iterateEdges,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "area", {
    value: area,
    writable: true,
    configurable: true
  });

}
