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
  const out = new this.constructor(pts);
  out._isClockwise = this._isClockwise;
  out._isConvex = this._isConvex;
  out._isClosed = this._isClosed;
  return out;
}

// ----------------  ADD METHODS TO THE PIXI.POLYGON PROTOTYPE --------------------------
export function registerPIXIPolygonMethods() {

  Object.defineProperty(PIXI.Polygon.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });
}
