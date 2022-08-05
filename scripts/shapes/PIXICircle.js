/* globals
PIXI,
ClipperLib,
libWrapper
*/
"use strict";

import { WeilerAthertonClipper } from "../WeilerAtherton.js";
import { MODULE_ID } from "../const.js";

// ----------------  ADD METHODS TO THE PIXI.CIRCLE PROTOTYPE ------------------------
export function registerPIXICircleMethods() {
  // ----- Weiler Atherton Methods ----- //

  /**
   * Get the center point of the circle
   * @type {Point}
   */
  if ( !Object.hasOwn(PIXI.Circle.prototype, "center") ) {

    Object.defineProperty(PIXI.Circle.prototype, "center", {
      get: function() {
        return { x: this.x, y: this.y };
      },
      enumerable: false
    });

  }

  /**
   * Get all intersection points for a segment A|B
   * Intersections are sorted from A to B.
   * @param {Point} a
   * @param {Point} b
   * @returns {Point[]}
   */
  Object.defineProperty(PIXI.Circle.prototype, "segmentIntersections", {
    value: function(a, b) {
      const ixs = lineCircleIntersection(a, b, this, this.radius);
      return ixs.intersections;
    },
    writable: true,
    configurable: true
  });

  /**
   * Calculate an x,y point on this circle's circumference given an angle
   * 0: due east
   * π / 2: due south
   * π or -π: due west
   * -π/2: due north
   * @param {number} angle    Angle of the point, in radians.
   * @returns {Point}
   */
  Object.defineProperty(PIXI.Circle.prototype, "pointAtAngle", {
    value: function(angle) {
      return {
        x: this.x + (this.radius * Math.cos(angle)),
        y: this.y + (this.radius * Math.sin(angle)) };
    },
    writable: true,
    configurable: true
  });

  /**
   * Calculate the angle of a point in relation to a circle.
   * This is the angle of a line from the circle center to the point.
   * Reverse of PIXI.Circle.prototype.pointAtAngle.
   * @param {Point} point
   * @returns {number} Angle in radians.
   */
  Object.defineProperty(PIXI.Circle.prototype, "angleAtPoint", {
    value: function(point) {
      return Math.atan2(point.y - this.y, point.x - this.x);
    },
    writable: true,
    configurable: true
  });

  /**
   * Get the points that would approximate a circular arc along this circle, given
   * a starting and ending angle. Points returned are clockwise.
   * If from and to are the same, a full circle will be returned.
   *
   * @param {Point}   fromAngle     Starting angle, in radians. π is due north, π/2 is due east
   * @param {Point}   toAngle       Ending angle, in radians
   * @param {object}  [options]     Options which affect how the circle is converted
   * @param {number}  [options.density]           The number of points which defines the density of approximation
   * @param {boolean} [options.includeEndpoints]  Whether to include points at the circle
   *                                              where the arc starts and ends.
   * @returns {Point[]}
   */
  Object.defineProperty(PIXI.Circle.prototype, "pointsForArc", {
    value: pointsForArc,
    writable: true,
    configurable: true
  });

  /**
   * Get all the points for a polygon approximation of a circle between two points on the circle.
   * Points are clockwise from a to b.
   * @param { Point } a
   * @param { Point } b
   * @return { Point[]}
   */
  Object.defineProperty(PIXI.Circle.prototype, "pointsBetween", {
    value: function(a, b, { density } = {}) {
      const fromAngle = this.angleAtPoint(a);
      const toAngle = this.angleAtPoint(b);
      return this.pointsForArc(fromAngle, toAngle, { density, includeEndpoints: false });
    },
    writable: true,
    configurable: true
  });

  /**
   * Move the circle center by given x,y delta. Return new circle.
   * @param {number} dx
   * @param {number} dy
   * @returns {PIXI.Circle}
   */
  Object.defineProperty(PIXI.Circle.prototype, "translate", {
    value: function(dx, dy) {
      return new PIXI.Circle(this.x + dx, this.y + dy, this.radius);
    },
    writable: true,
    configurable: true
  });

  /**
   * Intersect this PIXI.Circle with a PIXI.Polygon.
   * Use the WeilerAtherton algorithm
   * @param {PIXI.Polygon} polygon      A PIXI.Polygon
   * @param {object} [options]          Options which configure how the intersection is computed
   * @param {number} [options.density]  The number of points which defines the density of approximation
   * @returns {PIXI.Polygon}            The intersected polygon
   */

  libWrapper.register(MODULE_ID, "PIXI.Circle.prototype.intersectPolygon", intersectPolygonPIXICircle, libWrapper.MIXED, { perf_mode: libWrapper.PERF_FAST });
}

function pointsForArc(fromAngle, toAngle, {density, includeEndpoints=true} = {}) {
  const pi2 = 2 * Math.PI;
  density ??= this.constructor.approximateVertexDensity(this.radius);
  const points = [];
  const delta = pi2 / density;

  if ( includeEndpoints ) points.push(this.pointAtAngle(fromAngle));

  // Determine number of points to add
  let dAngle = toAngle - fromAngle;
  while ( dAngle <= 0 ) dAngle += pi2; // Angles may not be normalized, so normalize total.
  const nPoints = Math.round(dAngle / delta);

  // Construct padding rays (clockwise)
  for ( let i = 1; i < nPoints; i++ ) points.push(this.pointAtAngle(fromAngle + (i * delta)));

  if ( includeEndpoints ) points.push(this.pointAtAngle(toAngle));
  return points;
}

function intersectPolygonPIXICircle(wrapped, polygon, options = {}) {
  if ( !this.radius ) return new PIXI.Polygon([]);
  options.clipType ??= ClipperLib.ClipType.ctIntersection;

  if ( options.clipType !== ClipperLib.ClipType.ctIntersection
    && options.clipType !== ClipperLib.ClipType.ctUnion) {
    return wrapped(polygon, options);
  }

  const union = options.clipType === ClipperLib.ClipType.ctUnion;
  const wa = WeilerAthertonClipper.fromPolygon(polygon, { union, density: options.density });
  const res = wa.combine(this)[0];

  if ( !res ) {
//     console.warn("PIXI.Circle.prototype.intersectPolygon returned undefined.");
    return new PIXI.Polygon([]);
  }

  return res instanceof PIXI.Polygon ? res : res.toPolygon();
}

// Needed to change 1 line in the quadraticIntersection, but cannot override, so...
// May as well trim down lineCircleIntersection a bit while we are at it...
/**
 * Determine the intersection between a candidate wall and the circular radius of the polygon.
 * @memberof helpers
 *
 * @param {Point} a                   The initial vertex of the candidate edge
 * @param {Point} b                   The second vertex of the candidate edge
 * @param {Point} center              The center of the bounding circle
 * @param {number} radius             The radius of the bounding circle
 * @param {number} epsilon            A small tolerance for floating point precision
 *
 * @returns {LineCircleIntersection}  The intersection of the segment AB with the circle
 */
function lineCircleIntersection(a, b, center, radius, epsilon=1e-8) {
  const r2 = Math.pow(radius, 2);
  let intersections = [];

  // Test whether endpoint A is contained
  const ar2 = Math.pow(a.x - center.x, 2) + Math.pow(a.y - center.y, 2);
  const aInside = ar2 <= r2 + epsilon;

  // Test whether endpoint B is contained
  const br2 = Math.pow(b.x - center.x, 2) + Math.pow(b.y - center.y, 2);
  const bInside = br2 <= r2 + epsilon;

  // Find quadratic intersection points
  const contained = aInside && bInside;
  if ( !contained ) {
    intersections = quadraticIntersection(a, b, center, radius, epsilon);
  }

  // Return the intersection data
  return {
    aInside,
    bInside,
    contained,
    intersections
  };
}


/**
 * Determine the points of intersection between a line segment (p0,p1) and a circle.
 * There will be zero, one, or two intersections
 * See https://math.stackexchange.com/a/311956
 * @memberof helpers
 *
 * @param {Point} p0            The initial point of the line segment
 * @param {Point} p1            The terminal point of the line segment
 * @param {Point} center        The center of the circle
 * @param {number} radius       The radius of the circle
 * @param {number} [epsilon=0]  A small tolerance for floating point precision
 */
function quadraticIntersection(p0, p1, center, radius, epsilon=0) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  // Quadratic terms where at^2 + bt + c = 0
  const a = Math.pow(dx, 2) + Math.pow(dy, 2);
  const b = (2 * dx * (p0.x - center.x)) + (2 * dy * (p0.y - center.y));
  const c = Math.pow(p0.x - center.x, 2) + Math.pow(p0.y - center.y, 2) - Math.pow(radius, 2);

  // Discriminant
  const disc2 = Math.pow(b, 2) - (4 * a * c);
  if ( disc2 < 0 ) return []; // No intersections

  // Roots
  const disc = Math.sqrt(disc2);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  // If t1 hits (between 0 and 1) it indicates an "entry"
  const intersections = [];
  if ( t1.between(0-epsilon, 1+epsilon) ) {
    intersections.push({
      x: p0.x + (dx * t1),
      y: p0.y + (dy * t1)
    });
  }

  // If the discriminant is exactly 0, a segment endpoint touches the circle
  // (and only one intersection point)
  if ( disc2 === 0 ) return intersections;

  // If t2 hits (between 0 and 1) it indicates an "exit"
  if ( t2.between(0-epsilon, 1+epsilon) ) {
    intersections.push({
      x: p0.x + (dx * t2),
      y: p0.y + (dy * t2)
    });
  }
  return intersections;
}

