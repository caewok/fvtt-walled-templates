/* globals
PIXI,
foundry
*/

"use strict";

/* Additions to the PIXI.Rectangle class:
- getCenter: center point of the rectangle
- toPolygon: convert to a PIXI.Polygon
- containsPoint: if the point is within epsilon of the rectangle, return true
*/

// reminder:
// bottom = y + height
// right = x + width

/**
 * Locate the center of the rectangle
 * @return {Point}
 */
function getCenter() {
  return new PIXI.Point(this.x + (this.width / 2), this.y + (this.height / 2));
}

/**
 * Convert to closed PIXI.Polygon, where each corner is a vertex.
 * Ordered clockwise from top left corner.
 * @return {PIXI.Polygon}
 */
function toPolygon() {
  /* eslint-disable indent */
  const out = new PIXI.Polygon(this.x, this.y,
                               this.right, this.y,
                               this.right, this.bottom,
                               this.x, this.bottom,
                               this.x, this.y);
  /* eslint-enable indent */
  out._isClockwise = true;
  out._isConvex = true;
  out._isClosed = true;
  return out;
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
 * Is this segment contained by or intersects the rectangle?
 * @param {Segment} s   Object with {A: {x, y}, B: {x, y}} coordinates.
 * @param {Number}  e   Permitted epsilon. Default: 1e-8.
 * @return {Boolean} Is the segment contained by or intersects the rectangle?
 */
function encountersSegment(s, e = 1e-8) {
  if (this.containsPoint(s.A, e) || this.containsPoint(s.B, e)) return true;

  // Point are both outside the rectangle. Only true if the segment intersects.
  return this.lineSegmentIntersects(s.A, s.B);
}

/**
 * Pad rectangle to contain given point
 * @param {Point} p
 */
function padToPoint(p) {
  const horiz = Math.max(0, p.x > this.x ? (p.x - this.right) : (this.x - p.x));
  const vert  = Math.max(0, p.y > this.y ? (p.y - this.bottom) : (this.y - p.y)); // eslint-disable-line no-multi-spaces
  this.pad(horiz, vert);
}

/**
 * Helper methods to track whether a segment intersects an edge.
 */
function _intersectsTop(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b,
    { x: this.x, y: this.y },
    { x: this.right, y: this.y });
}

function _intersectsRight(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b,
    { x: this.right, y: this.y },
    { x: this.right, y: this.bottom });
}

function _intersectsBottom(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b,
    { x: this.right, y: this.bottom },
    { x: this.x, y: this.bottom });
}

function _intersectsLeft(a, b) {
  return foundry.utils.lineSegmentIntersects(a, b,
    { x: this.x, y: this.bottom },
    { x: this.x, y: this.y });
}

/**
 * Split outside of rectangle into 8 zones by extending the rectangle edges indefinitely.
 * Zone is 1–8 starting at northwest corner, moving clockwise around rectangle.
 * containsPoint === true is zone 0
 * Determine in which zone a point falls.
 * @param {Point} p
 * @return {number} 0–9
 */
function _zone(p) {
  if (this.containsPoint(p)) return 0;

  if (p.x < this.x) {
    // Zones 1, 8, 7
    return p.y < this.y ? 1 : p.y > this.bottom ? 7 : 8;
  } else if (p.x > this.right) {
    // Zones 3, 4, 5
    return p.y < this.y ? 3 : p.y > this.bottom ? 5 : 4;
  } else {
    // X is within rectangle bounds; zones 2, 6
    return p.y < this.y ? 2 : 6;
  }
}

function lineSegmentIntersects(a, b) {
  const zone_a = this._zone(a);
  const zone_b = this._zone(b);
  if (!zone_a && !zone_b) return false; // Both points inside
  if (zone_a === 0 || zone_b === 0) return true; // One point inside, one outside

  // Checking every zone combination is complicated
  // and does not give a huge speed increase.
  // Instead, check the easy ones.

  // Points outside && a is on a corner:
  if ((zone_a === 1)
     && (zone_b === 1 || zone_b === 2 || zone_b === 3 || zone_b === 7 || zone_b === 8)) { return false; }

  if ((zone_a === 3)
     && (zone_b === 1 || zone_b === 2 || zone_b === 3 || zone_b === 4 || zone_b === 5)) { return false; }

  if ((zone_a === 5)
     && (zone_b === 3 || zone_b === 4 || zone_b === 5 || zone_b === 6 || zone_b === 7)) { return false; }

  if ((zone_a === 7)
     && (zone_b === 5 || zone_b === 6 || zone_b === 7 || zone_b === 8 || zone_b === 1)) { return false; }

  // Points outside && on same side of rectangle:
  if   ((zone_a === 1 || zone_a === 2 || zone_a === 3) // eslint-disable-line no-multi-spaces
     && (zone_b === 1 || zone_b === 2 || zone_b === 3)) { return false; }

  if   ((zone_a === 3 || zone_a === 4 || zone_a === 5) // eslint-disable-line no-multi-spaces
     && (zone_b === 3 || zone_b === 4 || zone_b === 5)) { return false; }

  if   ((zone_a === 5 || zone_a === 6 || zone_a === 7) // eslint-disable-line no-multi-spaces
     && (zone_b === 5 || zone_b === 6 || zone_b === 7)) { return false; }

  if   ((zone_a === 7 || zone_a === 8 || zone_a === 1) // eslint-disable-line no-multi-spaces
     && (zone_b === 7 || zone_b === 8 || zone_b === 1)) { return false; }


  // Could just do this and skip the above; but it is a bit faster
  // to check some of the easy cases above first.
  return this._intersectsTop(a, b)
    || this._intersectsRight(a, b)
    || this._intersectsBottom(a, b)
    || this._intersectsLeft(a, b);
}


/**
 * From PIXI.js mathextras
 * https://pixijs.download/dev/docs/packages_math-extras_src_rectangleExtras.ts.html
 * If the area of the intersection between the Rectangles `other` and `this` is not zero,
 * returns the area of intersection as a Rectangle object. Otherwise, return an empty Rectangle
 * with its properties set to zero.
 * Rectangles without area (width or height equal to zero) can't intersect or be intersected
 * and will always return an empty rectangle with its properties set to zero.
 *
 * _Note: Only available with **@pixi/math-extras**._
 *
 * @method intersects
 * @memberof PIXI.Rectangle#
 * @param {Rectangle} other - The Rectangle to intersect with `this`.
 * @param {Rectangle} [outRect] - A Rectangle object in which to store the value,
 * optional (otherwise will create a new Rectangle).
 * @returns {Rectangle} The intersection of `this` and `other`.
 */
function rectangleIntersection(other, outRect) {
  const x0 = this.x < other.x ? other.x : this.x;
  const x1 = this.right > other.right ? other.right : this.right;

  if (!outRect) { outRect = new PIXI.Rectangle(); }

  if (x1 <= x0) {
    outRect.x = outRect.y = outRect.width = outRect.height = 0;
    return outRect;
  }

  const y0 = this.y < other.y ? other.y : this.y;
  const y1 = this.bottom > other.bottom ? other.bottom : this.bottom;
  if (y1 <= y0) {
    outRect.x = outRect.y = outRect.width = outRect.height = 0;
    return outRect;
  }

  outRect.x = x0;
  outRect.y = y0;
  outRect.width = x1 - x0;
  outRect.height = y1 - y0;

  return outRect;
}

/**
 * Translate a rectangle, shifting it in the x and y direction.
 * (Basic but useful b/c it is equivalent to polygon.translate)
 * @param {Number} delta_x  Movement in the x direction.
 * @param {Number} delta_y  Movement in the y direction.
 */
function translate(delta_x, delta_y) {
  this.x += delta_x;
  this.y += delta_y;
}


// ----------------  ADD METHODS TO THE PIXI.RECTANGLE PROTOTYPE ------------------------
export function registerPIXIRectangleMethods() {

  Object.defineProperty(PIXI.Rectangle.prototype, "getCenter", {
    value: getCenter,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "toPolygon", {
    value: toPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "containsPoint", {
    value: containsPoint,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "encountersSegment", {
    value: encountersSegment,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "padToPoint", {
    value: padToPoint,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "lineSegmentIntersects", {
    value: lineSegmentIntersects,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsTop", {
    value: _intersectsTop,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsBottom", {
    value: _intersectsBottom,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsLeft", {
    value: _intersectsLeft,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_intersectsRight", {
    value: _intersectsRight,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "_zone", {
    value: _zone,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "intersection", {
    value: rectangleIntersection,
    writable: true,
    configurable: true
  });

  // For equivalence with a PIXI.Polygon
  Object.defineProperty(PIXI.Rectangle.prototype, "isClosed", {
    get: () => true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Rectangle.prototype, "getBounds", {
    value: () => this,
    writable: true,
    configurable: true
  });
}
