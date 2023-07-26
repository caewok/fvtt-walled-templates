/* globals
CONFIG,
foundry,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID } from "../const.js";
import { Point3d } from "../geometry/3d/Point3d.js";
import { ClockwiseSweepShape, pointFromKey } from "../ClockwiseSweepShape.js";
import { WalledTemplateShape } from "./WalledTemplateShape.js";

export class WalledTemplateCircle extends WalledTemplateShape {
  /**
   * @param {MeasuredTemplate} template   The underlying measured template
   * @param {WalledTemplateOptions} [opts]
   * @param {PIXI.Point} [opt.corner]
   */
  constructor(template, opts = {}) {
    super(template, opts);
    this.options.corner = opts.corner;
  }

  /** @type {PIXI.Circle} */
  get originalShape() {
    const cir = CONFIG.MeasuredTemplate.objectClass.getCircleShape(this.distance);

    // Pad the circle by one pixel so it better covers expected grid spaces.
    // (Rounding tends to drop spaces on the edge.)
    if ( cir instanceof PIXI.Circle ) cir.radius += 1;
    return cir;
  }

  /**
   * Generate a new CircleTemplate based on spreading from the corners present in the sweep.
   * @param {ClockwiseSweepPolygon} sweep   Sweep result for this template.
   * @param {Map} recursionTracker          A map that can be utilized to avoid repeats in the recursion.
   * @returns {object} Array of polygons generated and an array of generated sub-templates.
   * @override
   */
  _generateSubtemplates(sweep, cornerTracker) {
    const subtemplates = [];
    for ( const cornerKey of sweep.cornersEncountered ) {
      const spreadTemplates = this._generateSpreadsFromCorner(cornerKey, sweep.edgesEncountered, cornerTracker);
      if ( spreadTemplates ) subtemplates.push(...spreadTemplates);
    }
    return subtemplates;
  }

  /**
   * Generate a new CircleTemplate based on spreading from a designated corner.
   * @param {PIXI.Point} corner
   * @returns {WalledTemplateCircle|null}
   */
  _generateSpreadsFromCorner(cornerKey, edgesEncountered, cornerTracker) {
    const corner = pointFromKey(cornerKey);

    // If the corner is beyond this template, ignore
    const dist = PIXI.Point.distanceBetween(this.origin, corner);
    if ( this.distance < dist ) return null;

    // Skip if we already created a spread at this corner.
    const prevCornerDist = cornerTracker.get(cornerKey);
    if ( prevCornerDist && prevCornerDist <= dist ) return null;
    cornerTracker.set(cornerKey, dist);

    // Adjust the origin so that it is 2 pixels off the wall at that corner, in direction of the wall.
    // If more than one wall, find the balance point.
    const extendedCorner = extendCornerFromWalls(cornerKey, edgesEncountered, this.origin);
    const distance = this.distance - dist;

    // Shallow copy the options for the new template.
    const opts = { ...this.options };
    opts.level += 1;
    opts.corner = corner;
    opts.distance = distance;
    opts.origin = new Point3d(extendedCorner.x, extendedCorner.y, this.origin.z);

    return [new this.constructor(this.template, opts)];
  }
}

// NOTE: Set the recursion types to spread or reflect, accordingly.
WalledTemplateCircle.prototype._spread = WalledTemplateCircle.prototype._recurse;

/**
 * Adjust a corner point to offset from the wall by 2 pixels.
 * Offset should move in the direction of the wall.
 * If more than one wall at this corner, use the average vector between the
 * rightmost and leftmost walls on the side of the template origin.
 * @param {number} cornerKey      Key value for the corner
 * @param {Set<Wall>} wallSet     Walls to test
 * @param {Point} templateOrigin  Origin of the template
 */
function extendCornerFromWalls(cornerKey, wallSet, templateOrigin) {
  const CORNER_SPACER = CONFIG[MODULE_ID]?.cornerSpacer ?? 10;

  if ( !wallSet.size ) return pointFromKey(cornerKey);

  const walls = [...wallSet].filter(w => w.wallKeys.has(cornerKey));
  if ( !walls.length ) return pointFromKey(cornerKey); // Should not occur.
  if ( walls.length === 1 ) {
    const w = walls[0];
    let [cornerPt, otherPt] = w.A.key === cornerKey ? [w.A, w.B] : [w.B, w.A];
    cornerPt = new PIXI.Point(cornerPt.x, cornerPt.y);
    otherPt = new PIXI.Point(otherPt.x, otherPt.y);
    const dist = PIXI.Point.distanceBetween(cornerPt, otherPt);
    return otherPt.towardsPoint(cornerPt, dist + CORNER_SPACER);  // 2 pixels ^ 2 = 4
  }

  // Segment with the smallest (incl. negative) orientation is ccw to the point
  // Segment with the largest orientation is cw to the point
  const orient = foundry.utils.orient2dFast;
  const segments = [...walls].map(w => {
    // Construct new segment objects so walls are not modified.
    const [cornerPt, otherPt] = w.A.key === cornerKey ? [w.A, w.B] : [w.B, w.A];
    const segment = {
      A: new PIXI.Point(cornerPt.x, cornerPt.y),
      B: new PIXI.Point(otherPt.x, otherPt.y)
    };
    segment.orient = orient(cornerPt, otherPt, templateOrigin);
    return segment;
  });
  segments.sort((a, b) => a.orient - b.orient);

  // Get the directional vector that splits the segments in two from the corner.
  let ccw = segments[0];
  let cw = segments[segments.length - 1];
  let dir = averageSegments(ccw.A, ccw.B, cw.B);

  // The dir is the point between the smaller angle of the two segments.
  // Check if we need that point or its opposite, depending on location of the template origin.
  let pt = ccw.A.add(dir.multiplyScalar(CORNER_SPACER));
  let oPcw = orient(cw.A, cw.B, pt);
  let oTcw = orient(cw.A, cw.B, templateOrigin);
  if ( Math.sign(oPcw) !== Math.sign(oTcw) ) pt = ccw.A.add(dir.multiplyScalar(-CORNER_SPACER));
  else {
    let oPccw = orient(ccw.A, ccw.B, pt);
    let oTccw = orient(ccw.A, ccw.B, templateOrigin);
    if ( Math.sign(oPccw) !== Math.sign(oTccw) ) pt = ccw.A.add(dir.multiplyScalar(-CORNER_SPACER));
  }

  return pt;
}

/**
 * Find the normalized directional vector between two segments that share a common point A.
 * The vector returned will indicate a direction midway between the segments A|B and A|C.
 * The vector will indicate a direction clockwise from A|B.
 * In other words, the vector returned is the sum of the normalized vector of each segment.
 * @param {Point} a   Shared endpoint of the two segments A|B and A|C
 * @param {Point} b   Second endpoint of the segment A|B
 * @param {Point} c   Second endpoint of the segment B|C
 * @returns {Point} A normalized directional vector
 */
function averageSegments(a, b, c, outPoint) {
  // If c is collinear, return the orthogonal vector in the clockwise direction
  const orient = foundry.utils.orient2dFast(a, b, c);
  if ( !orient ) return orthogonalVectorsToSegment(a, b).cw;

  const normB = normalizedVectorFromSegment(a, b);
  const normC = normalizedVectorFromSegment(a, c);

  outPoint ??= new PIXI.Point();
  normB.add(normC, outPoint).multiplyScalar(0.5, outPoint);

  // If c is ccw to b, then negate the result to get the vector going the opposite direction.
  // if ( orient > 0 ) outPoint.multiplyScalar(-1, outPoint);

  return outPoint;
}


/**
 * Calculate the normalized directional vector from a segment.
 * @param {PIXI.Point} a   First endpoint of the segment
 * @param {PIXI.Point} b   Second endpoint of the segment
 * @returns {PIXI.Point} A normalized directional vector
 */
function normalizedVectorFromSegment(a, b) {
  return b.subtract(a).normalize();
}

/* -------------------------------------------- */

/**
 * Get the normalized vectors pointing clockwise and counterclockwise from a segment.
 * Orientation is measured A --> B --> vector.
 * @param {PIXI.Point} a   First endpoint of the segment
 * @param {PIXI.Point} b   Second endpoint of the segment
 * @returns {cw: PIXI.Point, ccw: PIXI.Point} Normalized directional vectors labeled cw and ccw.
 */
function orthogonalVectorsToSegment(a, b) {
  // Calculate the normalized vectors orthogonal to the edge
  const norm = normalizedVectorFromSegment(a, b);
  const cw = new PIXI.Point(-norm.y, norm.x);
  const ccw = new PIXI.Point(norm.y, -norm.x);
  return { cw, ccw };
}
