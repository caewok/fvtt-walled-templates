/* globals
canvas,
game,
ClockwiseSweepPolygon,
PIXI,
LimitedAnglePolygon
*/

"use strict";

import { log } from "./util.js";
import { debugPolygons, getSetting, SETTINGS } from "./settings.js";
import { MODULE_ID } from "./const.js";

/**
 * Use ClockwiseSweep to construct the polygon shape, passing it this template object.
 */


/**
 * Helper function that presumes this.shape has been set.
 * If walled templates are not enabled, return the default this.shape.
 * Otherwise, pass ClockwiseSweep this object, which in turn calls this object's
 * boundaryPolygon method to intersect the sweep polygon against the template shape.
 * While we could do this by just calling a normal sweep and intersecting the result,
 * it is much more performant to give the sweep the polygon boundary, so the sweep can
 * use it to ignore unnecessary walls.
 */
export function computeSweepPolygon() {
  log("Starting computeSweepPolygon", this);

  const origin = { x: this.x, y: this.y };

  // Trick Wall Height into keeping walls based on elevation of the token that created the template

  const cfg = {
    debug: debugPolygons(),
    type: "light",
    source: this,
    boundaryShapes: this.getBoundaryShapes()
  };

  // Add in elevation for Wall Height to use
  origin.b = this.document?.elevation ?? 0;
  origin.t = this.document?.elevation ?? 0;
  origin.object = {};

  const sweep = new ClockwiseSweepPolygon();
  sweep.initialize(origin, cfg);
  sweep.compute();

  // Shift to origin 0,0 as expected for Template shape.
  const poly = sweep.translate(-origin.x, -origin.y);
  poly._sweep = sweep; // For debugging
  return poly;
}

function useSweep(template) {
  // When not testing:
  //   return this.document.getFlag(MODULE_ID, "enabled")
  //     && canvas.walls.quadtree
  //     && canvas.walls.innerBounds.length;

  if ( !template.document.getFlag(MODULE_ID, "enabled") ) {
    log("useBoundaryPolygon|not enabled. Skipping sweep.");
    return false;
  }

  // Avoid error when first loading
  if (!canvas.walls.quadtree) {
    log("useBoundaryPolygon|no quadtree. Skipping sweep.");
    return false;
  }

  if ( !canvas.walls.innerBounds.length ) {
    log("useBoundaryPolygon|no innerBounds. Skipping sweep.");
    return false;
  }

  return true;
}

// Helpers for each of the getShape Foundry functions:
// • _getCircleShape: Use a boundaryPolygon (circle) in the sweep
// • _getConeShape: Use a boundaryPolygon in the sweep unless rounded cone.
// • _getRectShape: Use a boundaryPolygon (rectangle) in the sweep
// • _getRayShape: Use a boundaryPolygon (circle) in the sweep

/**
 * Replacement for MeasuredTemplate.prototype._getCircleShape.
 * Get a circular area of effect given a radius of effect.
 * Use ClockwiseSweep to create the area with walls blocking moving from the origin.
 * @param {Function} wrapped
 * @param {Number}   distance   Radius of the circle.
 * @return {PIXI.Polygon}
 */
export function walledTemplateGetCircleShape(wrapped, distance) {
  log(`walledTemplateGetCircleShape with distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(distance);
  if ( !useSweep(this) ) return this.originalShape;

  // Use sweep to construct the shape
  const poly = computeSweepPolygon.bind(this)();

  // Add back in original shape parameters in case modules or system need them
  poly.x = this.originalShape.x;
  poly.y = this.originalShape.y;
  poly.radius = this.originalShape.radius;

  return poly;
}

/**
 * Replacement for MeasuredTemplate.prototype._getConeShape
 * Get a cone area of effect with the cone expanding outward toward a direction with a
 * given angle for a given distance.
 * @param {Function}  wrapped
 * @param {Number}    direction
 * @param {Number}    angle
 * @param {Number}    distance
 * @return {PIXI.Polygon}
 */
export function walledTemplateGetConeShape(wrapped, direction, angle, distance) {
  log(`walledTemplateGetConeShape with direction ${direction}, angle ${angle}, distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, angle, distance);
  if ( !useSweep(this) ) return this.originalShape;

  // Use sweep to construct the shape
  const poly = computeSweepPolygon.bind(this)();

  // Cone was already a polygon in original so no need to add parameters back
  return poly;
}

/**
 * Replacement for MeasuredTemplate.prototype._getRectShape.
 * Get a rectangular area of effect given a radius of effect.
 * Use ClockwiseSweep to create the area with walls blocking moving from the origin.
 * @param {Function}  wrapped
 * @param {Number}    direction
 * @param {Number}    distance
 * @return {PIXI.Polygon}
 */
export function walledTemplateGetRectShape(wrapped, direction, distance) {
  log(`walledTemplateGetRectShape with direction ${direction}, distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, distance);
  if ( !useSweep(this) ) return this.originalShape;

  // Use sweep to construct the shape
  const poly = computeSweepPolygon.bind(this)();

  // Add back in original shape.x, shape.y, shape.width, shape.height to fix issue #8
  // (expected values for original rectangle)
  poly.x = this.originalShape.x;
  poly.y = this.originalShape.y;
  poly.width = this.originalShape.width;
  poly.height = this.originalShape.height;

  return poly;
}

/**
 * Replacement for MeasuredTemplate.prototype._getRayShape.
 * Get a ray area of effect given a radius of effect.
 * Use ClockwiseSweep to create the area with walls blocking moving from the origin.
 * @param {Function}  wrapped
 * @param {Number}    direction
 * @param {Number}    distance
 * @param {Number}    width
 * @return {PIXI.Polygon}
 */
export function walledTemplateGetRayShape(wrapped, direction, distance, width) {
  log(`walledTemplateGetRayShape with direction ${direction}, distance ${distance}, width ${width}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, distance, width);
  if ( !useSweep(this) ) return this.originalShape;

  // Use sweep to construct the shape (when needed)
  const poly = computeSweepPolygon.bind(this)();

  // Ray is already a polygon in original so no need to add parameters back
  return poly;
}


export function getBoundaryShapes() {
  let { x, y, direction, angle, distance } = this.document;
  const origin = { x, y };

  switch ( this.document.t ) {
    case "circle": return getCircleBoundaryShapes(this.originalShape, origin);
    case "cone": return game.settings.get("core", "coneTemplateType") === "flat"
      ? getFlatConeBoundaryShapes(this.originalShape, origin)
      : getRoundedConeBoundaryShapes(this.originalShape, origin, direction, angle, distance);
    case "rect": return getRectBoundaryShapes(this.originalShape, origin);
    case "ray": return getRayBoundaryShapes(this.originalShape, origin);
  }
}

/**
 * Circle shape for sweep
 * Use the existing circle for the bounding shape.
 * @param {PIXI.Circle} shape
 * @param {Point} origin
 * @returns {[PIXI.Circle]}
 */
function getCircleBoundaryShapes(shape, origin) {
  // Pad the circle by one pixel so it better covers expected grid spaces.
  // (Rounding tends to drop spaces on the edge.)
  const circle = shape.translate(origin.x, origin.y);
  circle.radius += 1;
  return [circle];
}

/**
 * Rectangular shape for sweep
 * Use the existing rectangle shape for the bounding shape.
 * @param {PIXI.Rectangle} shape
 * @param {Point} origin
 * @returns {[PIXI.Rectangle]}
 */
function getRectBoundaryShapes(shape, origin) {
  // Pad the rectangle by one pixel so it definitely includes origin
  const rect = shape.translate(origin.x, origin.y);
  // Do we need padding here?
  //   rect.pad(1, 1);
  return [rect];
}

/**
 * Rounded cone shape for sweep.
 * Use a circle + limited radius for the bounding shapes.
 * @param {PIXI.Polygon} shape
 * @param {Point} origin
 * @param {number} direction    In degrees
 * @param {number} angle        In degrees
 * @param {number} distance     From the template document, before adjusting for canvas dimensions
 * @returns {[PIXI.Circle, LimitedAnglePolygon]}
 */
function getRoundedConeBoundaryShapes(shape, origin, direction, angle, distance) {
  // Use a circle + limited radius for the bounding shapes
  const pts = shape.points;
  const radius = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
  const rotation = direction - 90;

  const circle = new PIXI.Circle(origin.x, origin.y, radius);
  const la = new LimitedAnglePolygon(origin, {radius, angle, rotation});
  return [circle, la];
}

/**
 * Flat cone shape for sweep.
 * Use the existing shape polygon.
 * @param {PIXI.Polygon} shape
 * @param {Point} origin
 * @returns {[PIXI.Polygon]}
 */
function getFlatConeBoundaryShapes(shape, origin) {
  // Use the existing triangle polygon for the bounding shape
//
//   const shifted_origin = pointFromAngle(origin, Math.toRadians(this.direction), -1);
//     log(`boundaryPolygon|Polygon shifted origin to ${shifted_origin.x},${shifted_origin.y}
//    for direction ${this.direction}`);
//     shape = shape.translate(shifted_origin.x, shifted_origin.y);
  return [shape.translate(origin.x, origin.y)];
}

/**
 * Ray shape for sweep
 * Use the existing shape polygon.
 * @param {PIXI.Polygon} shape
 * @param {Point} origin
 * @param {[PIXI.Polygon]}
 */
function getRayBoundaryShapes(shape, origin) {
  // Dow we need to shift the origin for polygons?
  //   const shifted_origin = pointFromAngle(origin, Math.toRadians(this.direction), -1);
  //     log(`boundaryPolygon|Polygon shifted origin to ${shifted_origin.x},${shifted_origin.y}
  // for direction ${this.direction}`);
  //     shape = shape.translate(shifted_origin.x, shifted_origin.y);
  const ray = shape.translate(origin.x, origin.y);
  return [ray];
}
