/* globals
PIXI
*/
"use strict";

/**
 * Translate a circle, shifting it in the x and y direction.
 * (Basic but useful b/c it is equivalent to polygon.translate)
 * @param {Number} dx  Movement in the x direction.
 * @param {Number} dy  Movement in the y direction.
 * @return {PIXI.Circle}
 */
function translate(dx, dy) {
  return new this.constructor(this.x + dx, this.y + dy, this.radius);
}

/**
 * Intersect this circle with a polygon
 * @param {PIXI.Polygon} poly
 * @returns {PIXI.Polygon}
 */
function intersectPolygon(poly, {density} = {}) {
  return poly.intersectCircle(this, {density});
}

// ----------------  ADD METHODS TO THE PIXI.CIRCLE PROTOTYPE ------------------------
export function registerPIXICircleMethods() {
  Object.defineProperty(PIXI.Circle.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Circle.prototype, "intersectPolygon", {
    value: intersectPolygon,
    writable: true,
    configurable: true
  });
}
