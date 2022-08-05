/* globals
PIXI,
ClipperLib,
foundry
*/
"use strict";

// Use Object.defineProperty so that writable, configurable can be set to let other modules override
export function registerPIXIPolygonMethods() {

  // ----- Weiler Atherton Methods ----- //

  /**
   * Determine if a polygon is oriented clockwise, meaning tracing the polygon
   * moves in a clockwise direction.
   * This getter relies on a cached property, _isClockwise.
   * If you know the polygon orientation in advance, you should set this._isClockwise to avoid
   * this calculation.
   * This will close the polygon.
   * @type {boolean}
   */
  Object.defineProperty(PIXI.Polygon.prototype, "isClockwise", {
    get: isClockwise,
    enumerable: false
  });

  /**
   * Reverse the order of the polygon points.
   * @returns {PIXI.Polygon}
   */
  Object.defineProperty(PIXI.Polygon.prototype, "reverseOrientation", {
    value: reverseOrientation,
    writable: true,
    configurable: true
  });

  /**
   * Translate, shifting this polygon in the x and y direction. Return new polygon.
   * @param {Number} dx  Movement in the x direction.
   * @param {Number} dy  Movement in the y direction.
   * @return {PIXI.Polygon}
   */
  Object.defineProperty(PIXI.Polygon.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });

  /**
   * Does this polygon overlap something else?
   * @param {PIXI.Rectangle|PIXI.Circle|PIXI.Polygon|RegularPolygon} other
   * @returns {boolean}
   */
  Object.defineProperty(PIXI.Polygon.prototype, "overlaps", {
    value: overlaps,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "_overlapsPolygon", {
    value: overlapsPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "_overlapsCircle", {
    value: overlapsCircle,
    writable: true,
    configurable: true
  });

  Object.defineProperty(PIXI.Polygon.prototype, "area", {
    get: function() {
      const path = this.toClipperPoints();
      const area = ClipperLib.Clipper.Area(path);
      return Math.abs(area);
    },
    enumerable: false
  });

  /**
   * Close this polygon if needed.
   */
  Object.defineProperty(PIXI.Polygon.prototype, "close", {
    value: function() {
      if ( this.isClosed ) return;
      if ( this.points.length < 2 ) return;
      this.addPoint({x: this.points[0], y: this.points[1]});
      this.is
    },
    writable: true,
    configurable: true
  });
}

function isClockwise() {
  if ( typeof this._isClockwise === "undefined") {
    this.close();
    const path = this.toClipperPoints();
    this._isClockwise = ClipperLib.Clipper.Orientation(path);
  }
  return this._isClockwise;
}

function reverseOrientation() {
  const reversed_pts = [];
  const pts = this.points;
  const ln = pts.length - 2;
  for (let i = ln; i >= 0; i -= 2) {
    reversed_pts.push(pts[i], pts[i + 1]);
  }
  this.points = reversed_pts;
  if ( typeof this._isClockwise !== "undefined" ) this._isClockwise = !this._isClockwise;
  return this;
}

function translate(dx, dy) {
  const pts = [];
  const ln = this.points.length;
  for (let i = 0; i < ln; i += 2) {
    pts.push(this.points[i] + dx, this.points[i + 1] + dy);
  }
  const out = new this.constructor(pts);
  out._isClockwise = this._isClockwise;
  if ( this.bounds ) out.bounds = out.getBounds(); // Bounds will have changed due to translate

  return out;
}


/**
 * Does this polygon overlap something else?
 * @param {PIXI.Rectangle|PIXI.Circle|PIXI.Polygon|RegularPolygon} other
 * @returns {boolean}
 */
function overlaps(other) {
  if ( other instanceof PIXI.Polygon ) { return this._overlapsPolygon(other); }
  if ( other instanceof PIXI.Circle ) { return this._overlapsCircle(other); }
  if ( other instanceof PIXI.Rectangle ) { return other.overlaps(this); }

  if ( other.toPolygon) return this._overlapsPolygon(other.toPolygon());

  console.warn("overlaps|shape not recognized.", other);
  return false;
}

/**
 * Detect overlaps using brute force
 * TO-DO: Use Separating Axis Theorem to detect collisions, or overlap, between two polygons.
 * See http://programmerart.weebly.com/separating-axis-theorem.html#:~:text=%E2%80%8BThe%20Separating%20Axis%20Theorem,the%20Polyhedra%20are%20not%20colliding.
 * @param {PIXI.Polygon} other
 * @returns {boolean}
 */
function overlapsPolygon(other) {
  const polyBounds = this.getBounds();
  const otherBounds = other.getBounds();

  if ( !polyBounds.overlaps(otherBounds) ) return false;

  this.close();
  other.close();
  const pts1 = this.points;
  const pts2 = other.points;
  const ln1 = pts1.length;
  const ln2 = pts2.length;
  let a = { x: pts1[0], y: pts1[1] };
  if ( other.contains(a.x, a.y) ) return true;

  for ( let i = 2; i < ln1; i += 2 ) {
    const b = { x: pts1[i], y: pts1[i+1] };
    if ( other.contains(b.x, b.y) ) return true;

    let c = { x: pts2[0], y: pts2[1] };
    if ( this.contains(c.x, c.y) ) return true;

    for ( let j = 2; j < ln2; j += 2 ) {
      const d = { x: pts2[j], y: pts2[j+1] };
      if ( foundry.utils.lineSegmentIntersects(a, b, c, d) || this.contains(d.x, d.y) ) return true;
      c = d;
    }

    a = b;
  }
  return false;
}

/**
 * Does this polygon overlap a circle?
 * TO-DO: Use Separating Axis Theorem?
 * @param {PIXI.Circle} circle
 * @returns {boolean}
 */
function overlapsCircle(circle) {
  const polyBounds = this.getBounds();

  if ( !polyBounds.overlaps(circle) ) return false;

  this.close();
  const pts = this.points;
  const ln = pts.length;
  let a = { x: pts[0], y: pts[1] };
  if ( circle.contains(a.x, a.y) ) return true;
  for ( let i = 2; i < ln; i += 2 ) {
    const b = { x: pts[i], y: pts[i+1] };

    // Get point on the line closest to a|b (might be a or b)
    const c = foundry.utils.closestPointToSegment(c, a, b);
    if ( circle.contains(c.x, c.y) ) return true;
  }

  return false;
}
