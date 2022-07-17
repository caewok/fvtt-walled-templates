/* globals
PIXI
*/
"use strict";

/**
 * Translate a rectangle, shifting it in the x and y direction.
 * (Basic but useful b/c it is equivalent to polygon.translate)
 * @param {Number} dx  Movement in the x direction.
 * @param {Number} dy  Movement in the y direction.
 * @return {PIXI.Rectangle}
 */
function translate(dx, dy) {
  return new this.constructor(this.x + dx, this.y + dy, this.width, this.height);
}

/**
 * Is this point contained by the rectangle?
 * Default PIXI.Rectangle.prototype.contains is problematic, in that it just compares
 * using "<", so points on the west and south edges are not included and points very
 * near an edge may or may not be included.
 * @param {Point} p
 * @param {number} e  Some permitted epsilon, by default 1e-8
 * @returns {boolean} Is the point contained by or on the edge of the rectangle?
 */
function containsPoint(p, e = 1e-8) {
  // Follow how contains method handles this
  if (this.width <= 0 || this.height <= 0) { return false; }

  const x_inside = (p.x > this.x && p.x < this.right) || p.x.almostEqual(this.x, e) || p.x.almostEqual(this.right, e);
  if (!x_inside) return false;

  // Y inside
  return (p.y > this.y && p.y < this.bottom) || p.y.almostEqual(this.y, e) || p.y.almostEqual(this.bottom, e);
}

/**
 * Does this rectangle overlap something else?
 * @param {PIXI.Rectangle|PIXI.Circle|PIXI.Polygon} shape
 * @returns {boolean}
 */
function overlaps(shape) {
  if ( shape instanceof PIXI.Polygon ) { return this._overlapsPolygon(shape); }
  if ( shape instanceof PIXI.Circle ) { return this._overlapsCircle(shape); }
  if ( shape instanceof PIXI.Rectangle ) { return this._overlapsRectangle(shape); }

  console.warn("overlaps|shape not recognized.", shape);
  return false;
}

/**
 * Does this rectangle overlap another?
 * @param {PIXI.Rectangle} other
 * @return {Boolean}
 */
function overlapsRectangle(other) {
  // https://www.geeksforgeeks.org/find-two-rectangles-overlap
  // One rectangle is completely above the other
  if ( this.top > other.bottom || other.top > this.bottom ) return false;

  // One rectangle is completely to the left of the other
  if ( this.left > other.right || other.left > this.right ) return false;

  return true;
}

/**
 * Does this rectangle overlap a circle?
 * @param {PIXI.Circle} circle
 * @return {Boolean}
 */
function overlapsCircle(circle) {
  // https://www.geeksforgeeks.org/check-if-any-point-overlaps-the-given-circle-and-rectangle
  // {xn,yn} is the nearest point on the rectangle to the circle center
  const xn = Math.max(this.right, Math.min(circle.x, this.left));
  const yn = Math.max(this.top, Math.min(circle.y, this.bottom));

  // Find the distance between the nearest point and the center of the circle
  const dx = xn - circle.x;
  const dy = yn - circle.y;
  return (Math.pow(dx, 2) + Math.pow(dy, 2)) <= Math.pow(circle.radius, 2);
}

/**
 * Does this rectangle overlap a polygon?
 * @param {PIXI.Polygon} poly
 * @return {Boolean}
 */
function overlapsPolygon(poly) {
  if ( poly.contains(this.left, this.top)
    || poly.contains(this.right, this.top)
    || poly.contains(this.left, this.bottom)
    || poly.contains(this.right, this.bottom)) { return true; }

  for ( const edge of poly.iterateEdges() ) {
    if ( this.lineSegmentIntersects(edge.A, edge.B)
      || this.containsPoint(edge.A)
      || this.containsPoint(edge.B)) { return true; }
  }
  return false;
}

/**
 * Calculate rectangle area
 * @return {Number}
 */
function area() {
  return this.width * this.height;
}


// ----------------  ADD METHODS TO THE PIXI.RECTANGLE PROTOTYPE ------------------------
export function registerPIXIRectangleMethods() {
  Object.defineProperty(PIXI.Rectangle.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "overlaps", {
    value: overlaps,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_overlapsRectangle", {
    value: overlapsRectangle,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_overlapsCircle", {
    value: overlapsCircle,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_overlapsPolygon", {
    value: overlapsPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "area", {
    value: area,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "containsPoint", {
    value: containsPoint,
    writable: true,
    configurable: true
  });
}
