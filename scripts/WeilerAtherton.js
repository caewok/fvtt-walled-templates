/* globals
PIXI
*/
"use strict";

import { pointsAlmostEqual } from "./shapes/util.js";

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
 * circle, ellipse, or convex simple clip object.
 * It is also more precise in that it uses the actual intersection points between
 * the circle/ellipse and polygon, instead of relying on the polygon approximation of the circle/ellipse
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
    return new this(polygon.points, { union, clippingOpts });
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
    const ln = trackingArray.length;
    if ( !ln ) return this.testForEnvelopment(clipObject, { union });

    let prevIx = trackingArray[ln - 1];
    let wasTracingPolygon = (prevIx.type === this.constructor.INTERSECTION_TYPES.OUT_IN) ^ union;
    const newPoly = new PIXI.Polygon();
    for ( let i = 0; i < ln; i += 1 ) {
      const ix = trackingArray[i];
      this._processIntersection(ix, prevIx, wasTracingPolygon, newPoly, clipObject);
      wasTracingPolygon = !wasTracingPolygon;
      prevIx = ix;
    }
    return [newPoly];
  }

  /**
   * Given an intersection and the previous intersection, fill the points
   * between the two intersections, in clockwise order.
   * @param {PolygonVertex} ix            Intersection to process
   * @param {PolygonVertex} prevIx        Previous intersection to process
   * @param {boolean} wasTracingPolygon   Whether we were tracing the polygon (true) or the clipObject (false).
   * @param {PIXI.Polygon} newPoly        The new polygon that results from this clipping operation
   * @param {Object} clipObject           The object to be clipped against this polygon.
   */
  _processIntersection(ix, prevIx, wasTracingPolygon, newPoly, clipObject) {
    const { opts } = this.config;
    const pts = wasTracingPolygon ? ix.leadingPoints : clipObject.pointsBetween(prevIx, ix, {opts});
    for ( const pt of pts ) newPoly.addPoint(pt);
    newPoly.addPoint(ix);
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
   * Assumes that clipObject is a convex shape such that drawing a line through it
   * will intersect at most twice.
   *
   * @param {PIXI.Polygon} polygon
   * @param {PIXI.Polygon} polygon    Polygon to test
   * @param {Object} clipObject       Other object to test. Must have:
   *                                  - "segmentIntersections" method
   * @returns {PolygonVertex[]}
   */
  _buildPointTrackingArray(clipObject) {
    // Moving clockwise around this polygon, construct an array of endpoints with
    // intersections with the clipObject inserted in place.
    const points = this._buildPointIntersectionArray(clipObject);
    if ( !points.length ) return [];

    // Label points as inside or outside.
    // Omit tangent intersections
    const labeledPoints = this._buildLabeledIntersectionsArray(points, clipObject);
    if ( !labeledPoints.length ) return [];

    // Consolidate to an array of intersections.
    // Add leading points to the next intersection
    return this._consolidatePoints(labeledPoints);
  }

  /**
   * Construct an array that holds all the points of the polygon with all the
   * intersections with the clipObject inserted, in correct position moving clockwise.
   * If an intersection and endpoint are nearly the same, prefer the intersection.
   * @param {object} clipObject
   * @returns {Point[]}
   */
  _buildPointIntersectionArray(clipObject) {
    const points = this.points;
    const ln = points.length;
    if ( ln < 6 ) return []; // Minimum 3 Points required

    let a = { x: points[0], y: points[1] };
    const pointsIxs = [a];

    // Closed polygon, so we can use the last point to circle back
    for ( let i = 2; i < ln; i += 2) {
      const b = { x: points[i], y: points[i+1] };
      const ixs = this._findIntersections(a, b, clipObject);
      const ixsLn = ixs.length;
      if ( ixsLn ) {
        if ( pointsAlmostEqual(ixs[0], a) ) pointsIxs.pop();
        if ( pointsAlmostEqual(ixs[ixsLn - 1], b) ) ixs.pop(); // Get next round
        pointsIxs.push(...ixs);
      }
      pointsIxs.push(b);

      a = b;
    }
    return pointsIxs;
  }

  /**
   * Given a set of points that are either endpoints or intersections of this polygon,
   * in clockwise order, label intersections as out/in or in/out and remove tangents.
   * @param {Point[]} points    Points array built by _buildPointIntersectionArray
   * @param {object} clipObject
   * @return {Point[]} Labeled array of points
   */
  _buildLabeledIntersectionsArray(points, clipObject) {
    const startIdx = points.findIndex(pt => !pt.isIntersection);
    if ( !~startIdx ) return []; // All intersections, so all tangent

    const types = this.constructor.INTERSECTION_TYPES;
    const startPt = points[startIdx];
    let previousInside = clipObject.contains(startPt.x, startPt.y);
    let numPrevIx = 0;
    const labeledPoints = [startPt];
    const ln = points.length;

    let lastIx;
    let secondLastIx;

    // We added the starting point already, so we can skip i = 0.
    for ( let i = 1; i < ln; i += 1 ) {
      const j = (i + startIdx) % ln;
      const pt = points[j];

      if ( pt.isIntersection ) {
        numPrevIx += 1;
        pt.type = lastIx ? -lastIx.type
          : previousInside ? types.IN_OUT : types.OUT_IN;

        secondLastIx = lastIx;
        lastIx = pt;

      } else if ( numPrevIx ) {
        const isInside = clipObject.contains(pt.x, pt.y);
        const changedSide = isInside ^ previousInside;
        const isOdd = numPrevIx & 1;

        // If odd number of intersections, should switch. e.g., outside --> ix --> inside
        // If even number of intersections, should stay same. e.g., outside --> ix --> ix --> outside.
        if ( isOdd ^ changedSide ) {
          if ( numPrevIx === 1 ) {
            lastIx.isIntersection = false;
          } else {
            secondLastIx.isIntersection = false;
            lastIx.type = secondLastIx.type;
          }
        }

        previousInside = isInside;
        numPrevIx = 0;
        secondLastIx = undefined;
        lastIx = undefined;

      }
      labeledPoints.push(pt);
    }
    return labeledPoints;
  }

  /**
   * Given a set of labeled points, consolidate into a tracking array of intersections,
   * where each intersection contains its array of leadingPoints.
   * @param {Point[]} points
   * @returns {Point[]} Array of intersections
   */
  _consolidatePoints(labeledPoints) {
    // Locate the first intersection
    const startIxIdx = labeledPoints.findIndex(pt => pt.isIntersection);
    if ( !~startIxIdx ) return []; // No intersections, so no tracking array

    const labeledLn = labeledPoints.length;
    let leadingPoints = [];
    const trackingArray = [];

    // Closed polygon, so use the last point to circle back
    for ( let i = 0; i < labeledLn; i += 1 ) {
      const j = (i + startIxIdx) % labeledLn;
      const pt = labeledPoints[j];
      if ( pt.isIntersection ) {
        pt.leadingPoints = leadingPoints;
        leadingPoints = [];
        trackingArray.push(pt);
      } else leadingPoints.push(pt);
    }

    // Add leading points to first intersection
    trackingArray[0].leadingPoints = leadingPoints;

    return trackingArray;
  }

  /**
   * Find intersections of this polygon with the clipObject.
   */
  _findIntersections(a, b, clipObject) {
    return clipObject.segmentIntersections(a, b).map(ix => {
      ix.isIntersection = true;
      ix.leadingPoints = []; // Ensure leadingPoints is defined.
      ix._edge = {A: a, B: b};  // For debugging
      return ix;
    });
  }
}
