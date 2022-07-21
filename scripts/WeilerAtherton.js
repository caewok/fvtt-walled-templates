/* globals
PolygonVertex,
PIXI,
foundry
*/
"use strict";

/**
 * @typedef {WeilerAthertonClipperConfig} WeilerAthertonClipperConfig
 * @property {number}   [density]    The desired density of the approximated circle, a number per PI
 * @property {boolean}  [union]         Whether this is a union or an intersect
 */


/* Methods required for the clipObject

// Get the center point of the clipObject. Technically, any point within the clipObject will do.
// @type {Point}
get center()

// Does the clipObject contain the point?
// Required for testForEnvelopment, _buildPointTrackingArray
// @param {number} x
// @param {number} y
// @returns {boolean} True if point {x,y} is contained within the clipObject.
contains(x, y)

// Convert the clipObject to a polygon.
// Required for testForEnvelopment
// @param {Object} opts   Optional parameters passed to toPolygon. E.g., {density} for circle.
// @returns {PIXI.Polygon}
toPolygon(opts)

// Get all intersection points for a segment A|B
// Intersections must be sorted from A to B.
// @param {Point} a
// @param {Point} b
// @returns {Point[]}
segmentIntersections(a, b)

// Get all the points (for a polygon approximation of) the clipObject between
// two points on (or nearly on) the clipObject.
// Points must be sorted clockwise around the clipObject.
// @param {Point} a
// @param {Point} b
// @param {object} opts Optional parameters passed to toPolygon. E.g., {density} for circle.
// @returns {Point[]}
pointsBetween(a, b, opts)
*/

/**
 * An implementation of the Weiler Atherton algorithm for clipping polygons.
 * It currently only handles combinations that will not result in any holes.
 * Handling holes is not terribly difficult, but is non-trivial code to maintain.
 * It is faster than the Clipper library for this task because it relies on the unique properties of the
 * circle. It is also more precise in that it uses the actual intersection points between
 * the circle and polygon, instead of relying on the polygon approximation of the circle
 * to find the intersection points.
 *
 * Primary methods:
 * - intersect and union: Combine a clip object with a polygon
 *
 * For more explanation of the underlying algorithm, see:
 * https://en.wikipedia.org/wiki/Weiler%E2%80%93Atherton_clipping_algorithm
 * https://www.geeksforgeeks.org/weiler-atherton-polygon-clipping-algorithm
 * https://h-educate.in/weiler-atherton-polygon-clipping-algorithm/
 */
export class WeilerAthertonClipper extends PIXI.Polygon {
  constructor(points = [], { union = true, clippingOpts = {} } = {}) {
    super(points);

    this.close();
    if ( !this.isClockwise ) this.reverseOrientation();

    /**
     * Configuration settings
     * @type {object} [config]
     * @param {boolean} [config.union]  True for union, false for intersect
     * @param {object} [config.clippingOpts]  Object passed to the clippingObject methods
     *                                        toPolygon and pointsBetween
     */
    this.config = { union, clippingOpts };
  }

  static INTERSECTION_TYPES = { OUT_IN: -1, IN_OUT: 1, TANGENT: 0 };

  /**
   * Convert a polygon into a WeilerAthertonClipper object.
   * @param {PIXI.Polygon} polygon
   * @returns {WeilerAthertonClipper}
   */
  static fromPolygon(polygon, { union = true, clippingOpts = {} } = {}) {
    return new this(polygon.points, { union, clippingOpts })
  }

  /**
   * Union a polygon and clipObject using the Weiler Atherton algorithm.
   * @param {PIXI.Polygon} polygon
   * @param {Object} clipObject
   * @returns {PIXI.Polygon[]}
   */
  static union(polygon, clipObject, { clippingOpts = {}} = {}) {
    const wa = this.fromPolygon(polygon, { clippingOpts, union: true });
    return wa.combine(clipObject);
  }

  /**
   * Intersect a polygon and clipObject using the Weiler Atherton algorithm.
   * @param {PIXI.Polygon} polygon
   * @param {Object} clipObject
   * @returns {PIXI.Polygon[]}
   */
  static intersect(polygon, clipObject, { clippingOpts = {}} = {}) {
    const wa = this.fromPolygon(polygon, { clippingOpts, union: false });
    return wa.combine(clipObject);
  }

  /**
   * Clip a given clipObject using the Weiler Atherton algorithm.
   * @param {Object} clipObject
   * @returns {PIXI.Polygon[]}
   */
  combine(clipObject, { union = this.config.union } = {}) {
    const trackingArray = this._buildPointTrackingArray(clipObject);

    if ( !trackingArray.length ) return this.testForEnvelopment(clipObject, { union });

    return this._combineNoHoles(trackingArray, clipObject, { union });
  }

  /**
   * Clip the polygon with the clipObject, assuming no holes will be created.
   * For a union or intersect with no holes, a single pass through the intersections will
   * build the resulting union shape.
   * @param {PolygonVertex[]} trackingArray
   * @param {Object} clipObject
   * @returns {[PIXI.Polygon]}
   */
  _combineNoHoles(trackingArray, clipObject, { union = this.config.union } = {}) {
    const { opts } = this.config;

    let prevIx = trackingArray[0];
    let tracePolygon = (prevIx.type === this.constructor.INTERSECTION_TYPES.OUT_IN) ^ union;
    const points = [prevIx];
    const ln = trackingArray.length;
    for ( let i = 1; i < ln; i += 1 ) {
      const ix = trackingArray[i];
      this._processIntersection(ix, prevIx, tracePolygon, points, clipObject);
      tracePolygon = !tracePolygon;
      prevIx = ix;
    }

    // Finish by filling in points leading up to the first intersection.
    this._processIntersection(trackingArray[0], prevIx, tracePolygon, points, clipObject);
    return [new PIXI.Polygon(points)];
  }

  /**
   * Given an intersection and the previous intersection, fill the points
   * between the two intersections, in clockwise order.
   * @param {PolygonVertex} prevIx
   * @param {PolygonVertex} ix
   * @param {Object} clipObject
   * @param {boolean} tracePolygon  Whether we are tracing the polygon (true) or the clipObject (false).
   */
  _processIntersection(ix, prevIx, tracePolygon, points, clipObject) {
    const { opts } = this.config;

    if ( tracePolygon ) points.push(...ix.leadingPoints);
    else points.push(...clipObject.pointsBetween(prevIx, ix, {opts}));

    points.push(ix);
  }

  /**
   * Test if one shape envelops the other. Assumes the shapes do not intersect.
   *  1. Polygon is contained within the clip object. Union: clip object; Intersect: polygon
   *  2. Clip object is contained with polygon. Union: polygon; Intersect: clip object
   *  3. Polygon and clip object are outside one another. Union: both; Intersect: null
   * @param {PIXI.Polygon} polygon    Polygon to test
   * @param {Object} clipObject       Other object to test. Must have:
   *                                  - Getter "center"
   *                                  - "toPolygon" method
   *                                  - "contains" method
   *
   * @param {Object}  [options]       Options that affect the result
   * @param {boolean} [options.union] Is this a union (true) or intersect (false)
   * @returns {[PIXI.Polygon|clipObject]}  Returns the polygon, the clipObject, both, or neither.
   */
  testForEnvelopment(clipObject, { union = this.config.union } = {}) {
    const points = this.points;
    if ( points.length < 6 ) return [];

    // Option 1: Polygon contained within circle
    const polygonInClipObject = clipObject.contains(points[0], points[1]);
    if ( polygonInClipObject ) return union ? [clipObject] : [this];

    // Option 2: Circle contained within polygon
    const center = clipObject.center;
    const clipObjectInPolygon = polygonInClipObject ? false : this.contains(center.x, center.y);
    if ( clipObjectInPolygon ) return union ? [this] : [clipObject];

    // Option 3: Neither contains the other
    return union ? [this, clipObject] : [];
  }

  /**
   * Construct an array of intersections between the polygon and the clipping object.
   * The intersections follow clockwise around the polygon.
   * Round all intersections and polygon vertices to the nearest pixel (integer).
   *
   * @param {PIXI.Polygon} polygon
   * @param {PIXI.Polygon} polygon    Polygon to test
   * @param {Object} clipObject       Other object to test. Must have:
   *                                  - "segmentIntersections" method
   * @returns {PolygonVertex[]}
   */
   _buildPointTrackingArray(clipObject) {
    const points = this.points;
    const ln = points.length;
    if ( ln < 6 ) return []; // Minimum 3 Points required

    const trackingArray = [];

    // Cycle over each edge of the polygon in turn
    // For _findIntersection, also track the edges before and after the edge of interest
    // To make this easier, start at the end of the polygon so it cycles through.
    // If the polygon has only 4 points (6 coords), double-back to beginning
    let prevPt = new PolygonVertex(points[(ln - 4) % ln], points[(ln - 3) % ln]); // Ignore closing point
    let a = new PolygonVertex(points[0], points[1]);

    // At each intersection, add the intersection points to the trackingArray.
    // Add the points leading up to this intersection to the first intersection
    let leadingPoints = [a];

    // Example:
    // Points: a -- b -- c -- a
    // Edges: a|b, b|c, c|a
    // If ix0 is on a|b and ix1 is on c|a, leading points for ix1 are b and c.
    // The trick is not doubling up the a point

    // You would think if you find an intersection at an endpoint, it would also show up
    // next round, but you would be (sometimes) wrong. For example,
    // an intersection for a -- b near b on a -- b -- c could be rounded to "b" but then
    // b -- c may have no intersection.

    for ( let i = 2; i < ln; i += 2 ) {
      const b = new PolygonVertex(points[i], points[i + 1]);
      const ixs = clipObject.segmentIntersections(a, b).map(ix => {
        const v = PolygonVertex.fromPoint(ix)
        v.leadingPoints = []; // Ensure leadingPoints is defined.
        return v;
      });

      const ixsLn = ixs.length;
      if ( ixsLn ) {
        // If the intersection is the starting endpoint, prefer the intersection.
        if ( ixs[0].equals(a) ) leadingPoints.pop();
        ixs[0].leadingPoints = leadingPoints;
        trackingArray.push(...ixs);
        leadingPoints = [];
      }

      // Always add b unless we already did because it is an intersection.
      if ( !ixsLn || (trackingArray.length && !b.equals(trackingArray[trackingArray.length - 1])) ) leadingPoints.push(b);

      // Cycle to next edge
      prevPt = a;
      a = b;
    }

    // Add the points at the end of the points array leading up to the initial intersection
    // Pop the last leading point to avoid repetition (closed polygon)
    const tLn = trackingArray.length;
    if ( !tLn ) return trackingArray;

    leadingPoints.pop();
    trackingArray[0].leadingPoints.unshift(...leadingPoints);

    // Determine the first intersection label
    const ix = trackingArray[0];
    const priorIx = trackingArray[tLn - 1];
    let nextIx = trackingArray[1] || ix;
    const priorPt = ix.leadingPoints[ix.leadingPoints.length - 1] || priorIx;
    const nextPt = nextIx.leadingPoints[0] || nextIx;
    this.constructor._labelIntersections([ix], priorPt, nextPt, clipObject)

    return trackingArray;
  }

  /**
   * Label an array of intersections for an edge as in/out or out/in.
   * Intersections are labeled in place.
   * @param {Point} ix
   * @param {Point} prevPt
   * @param {Point} nextPt
   * @param {boolean} If the intersection is a tangent, return false
   */
  static _labelIntersections(ixs, a, b, clipObject) {
    if ( !ixs.length ) return false;

    const types = this.INTERSECTION_TYPES;
    const aInside = clipObject.contains(a.x, a.y);
    const bInside = clipObject.contains(b.x, b.y);

    //if ( !(aInside ^ bInside) && ixs.length === 1 ) return types.TANGENT;

    const type = aInside ? types.IN_OUT : types.OUT_IN;
    let sign = 1;
    ixs.forEach(ix => {
      ix.attachEdge({A: a, B: b});
      ix.type = type * sign;
      sign *= -1;
    });

    return true;
  }
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


export function addWeilerAthertonMethods() {

// ------ METHODS FOR PIXI.POLYGON -------------- //
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
  get: function() {
    if ( typeof this._isClockwise === "undefined") {
      this.close();
      const path = this.toClipperPoints();
      this._isClockwise = ClipperLib.Clipper.Orientation(path);
    }
    return this._isClockwise;
  },
  enumerable: false
});

/**
 * Reverse the order of the polygon points.
 * @returns {PIXI.Polygon}
 */
PIXI.Polygon.prototype.reverseOrientation = function() {
  const reversed_pts = [];
  const pts = this.points;
  const ln = pts.length - 2;
  for (let i = ln; i >= 0; i -= 2) {
    reversed_pts.push(pts[i], pts[i + 1]);
  }
  this.points = reversed_pts;
  if ( typeof this._isClockwise !== "undefined" ) this._isClockwise = !this._isClockwise;
  return this;
};



// ------ METHODS FOR PIXI.CIRCLE --------------- //

// PIXI.Circle has contains method
// PIXI.Circle has toPolygon method

/**
 * Get the center point of the circle
 * @type {Point}
 */
Object.defineProperty(PIXI.Circle.prototype, "center", {
  get: function() {
    return { x: this.x, y: this.y };
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
PIXI.Circle.prototype.segmentIntersections = function(a, b) {
  const ixs = lineCircleIntersection(a, b, this, this.radius);
  return ixs.intersections;
};

/* -------------------------------------------- */

/**
 * Calculate an x,y point on this circle's circumference given an angle
 * 0: due east
 * π / 2: due south
 * π or -π: due west
 * -π/2: due north
 * @param {number} angle    Angle of the point, in radians.
 * @returns {Point}
 */
PIXI.Circle.prototype.pointAtAngle = function(angle) {
  return {
    x: this.x + (this.radius * Math.cos(angle)),
    y: this.y + (this.radius * Math.sin(angle)) };
};

/**
 * Calculate the angle of a point in relation to a circle.
 * This is the angle of a line from the circle center to the point.
 * Reverse of PIXI.Circle.prototype.pointAtAngle.
 * @param {Point} point
 * @returns {number} Angle in radians.
 */
PIXI.Circle.prototype.angleAtPoint = function(point) {
  return Math.atan2(point.y - this.y, point.x - this.x);
};

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
PIXI.Circle.prototype.pointsForArc = function(fromAngle, toAngle,
  {density, includeEndpoints=true} = {}) {

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
};

/**
 * Get all the points for a polygon approximation of a circle between two points on the circle.
 * Points are clockwise from a to b.
 * @param { Point } a
 * @param { Point } b
 * @return { Point[]}
 */
PIXI.Circle.prototype.pointsBetween = function(a, b, { density } = {}) {
  const fromAngle = this.angleAtPoint(a);
  const toAngle = this.angleAtPoint(b);
  return this.pointsForArc(fromAngle, toAngle, { density, includeEndpoints: false });
};


// ------ METHODS FOR PIXI.RECTANGLE ------------ //

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


// PIXI.Rectangle has contains method
// PIXI.Rectangle has toPolygon method

/**
 * Get all intersection points for a segment A|B
 * Intersections are sorted from A to B.
 * @param {Point} a
 * @param {Point} b
 * @returns {Point[]}
 */
PIXI.Rectangle.prototype.segmentIntersections = function(a, b) {
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
  const lli = foundry.utils.lineLineIntersection;
  const { leftEdge, rightEdge, bottomEdge, topEdge } = this;
  const ixs = [];
  for ( const z of zones ) {
    let ix;
    if ( z & CSZ.LEFT ) ix = lli(leftEdge.A, leftEdge.B, a, b);
    if ( !ix && (z & CSZ.RIGHT) ) ix = lli(rightEdge.A, rightEdge.B, a, b);
    if ( !ix && (z & CSZ.TOP) ) ix = lli(topEdge.A, topEdge.B, a, b);
    if ( !ix && (z & CSZ.BOTTOM) ) ix = lli(bottomEdge.A, bottomEdge.B, a, b);

    // The ix should always be a point by now
    if ( !ix ) console.warn("PIXI.Rectangle.prototype.segmentIntersections returned a null point.");
    ixs.push(ix);
  }

  return ixs;
};

/**
 * Calculate the rectangle Zone for a given point located around, on, or in the rectangle.
 * https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm
 *
 * This differs from _getZone in how points on the edge are treated: they are not considered inside.
 *
 * @param {Point} p     Point to test for location relative to the rectangle
 * @returns {integer}
 */
PIXI.Rectangle.prototype._getEdgeZone = function(p) {
  const CSZ = PIXI.Rectangle.CS_ZONES;
  let code = CSZ.INSIDE;

  if ( p.x < this.x || p.x.almostEqual(this.x) ) code |= CSZ.LEFT;
  else if ( p.x > this.right || p.x.almostEqual(this.right) ) code |= CSZ.RIGHT;

  if ( p.y < this.y || p.y.almostEqual(this.y) ) code |= CSZ.TOP;
  else if ( p.y > this.bottom || p.y.almostEqual(this.bottom) ) code |= CSZ.BOTTOM;

  return code;
};

/**
 * Get all the points (corners) for a polygon approximation of a rectangle between two points on the rectangle.
 * Points are clockwise from a to b.
 * @param { Point } a
 * @param { Point } b
 * @return { Point[]}
 */
PIXI.Rectangle.prototype.pointsBetween = function(a, b) {
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
};
}
