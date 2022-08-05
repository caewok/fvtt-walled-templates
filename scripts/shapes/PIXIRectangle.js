/* globals
PIXI,
foundry,
libWrapper,
ClipperLib
*/
"use strict";

import { MODULE_ID } from "../const.js";
import { WeilerAthertonClipper } from "../WeilerAtherton.js";

// ----------------  ADD METHODS TO THE PIXI.RECTANGLE PROTOTYPE ------------------------

export function registerPIXIRectangleMethods() {
  // ----- Weiler Atherton Methods ----- //

  /**
   * Get the center point of the rectangle
   * @type {Point}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "center", {
    get: function() {
      return { x: this.left + (this.width * 0.5), y: this.top + (this.height * 0.5) };
    },
    enumerable: false
  });

  /**
   * Get all intersection points for a segment A|B
   * Intersections are sorted from A to B.
   * @param {Point} a
   * @param {Point} b
   * @returns {Point[]}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "segmentIntersections", {
    value: segmentIntersections,
    writable: true,
    configurable: true
  });

  /**
   * Calculate the rectangle Zone for a given point located around, on, or in the rectangle.
   * https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm
   *
   * This differs from _getZone in how points on the edge are treated: they are not considered inside.
   *
   * @param {Point} p     Point to test for location relative to the rectangle
   * @returns {integer}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "_getEdgeZone", {
    value: _getEdgeZone,
    writable: true,
    configurable: true
  });

  /**
   * Get all the points (corners) for a polygon approximation of a rectangle between two points on the rectangle.
   * Points are clockwise from a to b.
   * @param { Point } a
   * @param { Point } b
   * @return { Point[]}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "pointsBetween", {
    value: pointsBetween,
    writable: true,
    configurable: true
  });

  // ----- Walled Template methods ----- //

  /**
   * Measure the area of this rectangle
   * @type {number}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "area", {
    get: function() {
      return this.width * this.height;
    },
    enumerable: false
  });

  /**
   * Move the rectangle by given x,y delta. Return new rectangle.
   * @param {number} dx
   * @param {number} dy
   * @returns {PIXI.Circle}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "translate", {
    value: function(dx, dy) {
      return new PIXI.Rectangle(this.x + dx, this.y + dy, this.width, this.height);
    },
    writable: true,
    configurable: true
  });

  /**
   * Does this rectangle overlap something else?
   * @param {PIXI.Rectangle|PIXI.Circle|PIXI.Polygon} shape
   * @returns {boolean}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "overlaps", {
    value: overlaps,
    writable: true,
    configurable: true
  });

  /**
   * Does this rectangle overlap another?
   * @param {PIXI.Rectangle} other
   * @return {Boolean}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "_overlapsRectangle", {
    value: overlapsRectangle,
    writable: true,
    configurable: true
  });

  /**
   * Does this rectangle overlap a circle?
   * @param {PIXI.Circle} circle
   * @return {Boolean}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "_overlapsCircle", {
    value: overlapsCircle,
    writable: true,
    configurable: true
  });

  /**
   * Does this rectangle overlap a polygon?
   * @param {PIXI.Polygon} poly
   * @return {Boolean}
   */
  Object.defineProperty(PIXI.Rectangle.prototype, "_overlapsPolygon", {
    value: overlapsPolygon,
    writable: true,
    configurable: true
  });

  /**
   * Intersect this PIXI.Rectangle with a PIXI.Polygon.
   * Use the WeilerAtherton algorithm
   * @param {PIXI.Polygon} polygon      A PIXI.Polygon
   * @param {object} [options]          Options which configure how the intersection is computed
   * @returns {PIXI.Polygon}            The intersected polygon
   */
  libWrapper.register(MODULE_ID, "PIXI.Rectangle.prototype.intersectPolygon", intersectPolygonPIXIRectangle, libWrapper.MIXED, { perf_mode: libWrapper.PERF_FAST });

}

function segmentIntersections(a, b) {
  // Follows structure of lineSegmentIntersects
  const zoneA = this._getZone(a);
  const zoneB = this._getZone(b);

  if ( !(zoneA | zoneB) ) return []; // Bitwise OR is 0: both points inside rectangle.
  if ( zoneA & zoneB ) return []; // Bitwise AND is not 0: both points share outside zone

  // Reguler AND: one point inside, one outside
  // Otherwise, both points outside
  const zones = !(zoneA && zoneB) ? [zoneA || zoneB] : [zoneA, zoneB];

  // If 2 zones, line likely intersects two edges,
  // but some possibility that the line starts at, say, center left
  // and moves to center top which means it may or may not cross the rectangle.
  // Check so we can use lineLineIntersection below
  if ( zones.length === 2 && !this.lineSegmentIntersects(a, b) ) return [];

  const CSZ = PIXI.Rectangle.CS_ZONES;
  const lsi = foundry.utils.lineSegmentIntersects;
  const lli = foundry.utils.lineLineIntersection;
  const { leftEdge, rightEdge, bottomEdge, topEdge } = this;
  const ixs = [];
  for ( const z of zones ) {
    let ix;
    if ( (z & CSZ.LEFT)
      && lsi(leftEdge.A, leftEdge.B, a, b)) ix = lli(leftEdge.A, leftEdge.B, a, b);
    if ( !ix && (z & CSZ.RIGHT)
      && lsi(rightEdge.A, rightEdge.B, a, b)) ix = lli(rightEdge.A, rightEdge.B, a, b);
    if ( !ix && (z & CSZ.TOP)
      && lsi(topEdge.A, topEdge.B, a, b)) ix = lli(topEdge.A, topEdge.B, a, b);
    if ( !ix && (z & CSZ.BOTTOM)
      && lsi(bottomEdge.A, bottomEdge.B, a, b)) ix = lli(bottomEdge.A, bottomEdge.B, a, b);

    // The ix should always be a point by now
    if ( !ix ) console.warn("PIXI.Rectangle.prototype.segmentIntersections returned a null point.");
    ixs.push(ix);
  }

  return ixs;
}

function _getEdgeZone(p) {
  const CSZ = PIXI.Rectangle.CS_ZONES;
  let code = CSZ.INSIDE;

  if ( p.x < this.x || p.x.almostEqual(this.x) ) code |= CSZ.LEFT;
  else if ( p.x > this.right || p.x.almostEqual(this.right) ) code |= CSZ.RIGHT;

  if ( p.y < this.y || p.y.almostEqual(this.y) ) code |= CSZ.TOP;
  else if ( p.y > this.bottom || p.y.almostEqual(this.bottom) ) code |= CSZ.BOTTOM;

  return code;
}

function pointsBetween(a, b) {
  const CSZ = PIXI.Rectangle.CS_ZONES;

  // Assume the point could be outside the rectangle but not inside (which would be undefined).
  const zoneA = this._getEdgeZone(a);
  if ( !zoneA ) return [];

  const zoneB = this._getEdgeZone(b);
  if ( !zoneB ) return [];

  // If on the same wall, return none if b is counterclockwise to a.
  if ( zoneA === zoneB && foundry.utils.orient2dFast(this.center, a, b) <= 0 ) return [];

  let z = zoneA;
  const pts = [];

  for ( let i = 0; i < 4; i += 1) {
    if ( (z & CSZ.LEFT) ) {
      z !== CSZ.TOPLEFT && pts.push({ x: this.left, y: this.top }); // eslint-disable-line no-unused-expressions
      z = CSZ.TOP;
    } else if ( (z & CSZ.TOP) ) {
      z !== CSZ.TOPRIGHT && pts.push({ x: this.right, y: this.top }); // eslint-disable-line no-unused-expressions
      z = CSZ.RIGHT;
    } else if ( (z & CSZ.RIGHT) ) {
      z !== CSZ.BOTTOMRIGHT && pts.push({ x: this.right, y: this.bottom }); // eslint-disable-line no-unused-expressions
      z = CSZ.BOTTOM;
    } else if ( (z & CSZ.BOTTOM) ) {
      z !== CSZ.BOTTOMLEFT && pts.push({ x: this.left, y: this.bottom }); // eslint-disable-line no-unused-expressions
      z = CSZ.LEFT;
    }

    if ( z & zoneB ) break;

  }

  return pts;
}

// Options: clipType, scalingFactor
function intersectPolygonPIXIRectangle(wrapped, polygon, options = {}) {
  if ( !this.width || !this.height ) return new PIXI.Polygon([]);
  options.clipType ??= ClipperLib.ClipType.ctIntersection;

  if ( options.clipType !== ClipperLib.ClipType.ctIntersection
    && options.clipType !== ClipperLib.ClipType.ctUnion) {
    return wrapped(polygon, options);
  }

  const union = options.clipType === ClipperLib.ClipType.ctUnion;
  const wa = WeilerAthertonClipper.fromPolygon(polygon, { union });
  const res = wa.combine(this)[0];
  if ( !res ) {
//     log("PIXI.Circle.prototype.intersectPolygon returned undefined.");
    return new PIXI.Polygon([]);
  }
  return res instanceof PIXI.Polygon ? res : res.toPolygon();
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

  if ( shape.toPolygon) return this._overlapsPolygon(shape.toPolygon());

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
    || poly.contains(this.right, this.bottom)) return true;

  poly.close();
  const pts = poly.points;
  const ln = pts.length;
  let a = { x: pts[0], y: pts[1] };
  if ( this.contains(a.x, a.y) ) return true;
  for ( let i = 2; i < ln; i += 2 ) {
    const b = { x: pts[i], y: pts[i+1] };
    if ( this.lineSegmentIntersects(a, b) || this.contains(b.x, b.y) ) return true;
    a = b;
  }
  return false;
}
