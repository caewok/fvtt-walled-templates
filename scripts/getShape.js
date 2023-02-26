/* globals
canvas,
game,
PIXI,
LimitedAnglePolygon,
CONFIG
*/

"use strict";

import { log } from "./util.js";
import { debugPolygons } from "./settings.js";
import { MODULE_ID, FLAGS } from "./const.js";
import { ClockwiseSweepShape, pointFromKey } from "./ClockwiseSweepShape.js";
import { ClipperPaths } from "./geometry/ClipperPaths.js";

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

  const sweep = new ClockwiseSweepShape();
  sweep.initialize(origin, cfg);
  sweep.compute();

  let shape = sweep;
  if ( this.document.getFlag(MODULE_ID, FLAGS.SPREAD) ) {
    const polys = spread(this, sweep);
    polys.push(sweep);
    const paths = ClipperPaths.fromPolygons(polys);
    const combined = paths.combine();
    combined.clean();
    shape = combined.toPolygons()[0]; // TODO: Can there ever be more than 1?
  }

  // Shift to origin 0,0 as expected for Template shape.
  const poly = shape.translate(-origin.x, -origin.y);
  poly._sweep = sweep; // For debugging
  return poly;
}

/**


/**
 * For each corner within distance of the template origin,
 * re-run sweep using the corner as the origin and the remaining distance as the radius.
 */
function spread(template, sweep, fakeTemplate = template, level = -1) {
  level += 1;
  const polys = [];
  const useRecursion = level < CONFIG[MODULE_ID].spreadRecursions;

  const d = canvas.dimensions;
  const dMult = (d.size / d.distance);
  const dInv = 1 / dMult;
  const doc = fakeTemplate.document;
  for ( const cornerKey of sweep.cornersEncountered ) {
    const origin = pointFromKey(cornerKey);

    // If the corner is beyond the template, ignore.
    const dist = PIXI.Point.distanceBetween(sweep.origin, origin);
    const distGrid = dist * dInv;
    if (  doc.distance < distGrid ) continue;

    // Construct a fake template to use for the sweep.
    const newTemplate = {
      document: {
        x: origin.x,
        y: origin.y,
        direction: doc.direction,
        distance: doc.distance - distGrid,
        angle: doc.angle,
        width: doc.width,
        t: doc.t,
        elevation: doc.elevation ?? 0
      }
    };
    newTemplate.originalShape = originalShape(template, newTemplate.document)

    const cfg = {
      debug: debugPolygons(),
      type: "light",
      source: newTemplate,
      boundaryShapes: getBoundaryShapes.bind(newTemplate)()
    };

    // Add in elevation for Wall Height to use
    origin.b = newTemplate.document.elevation;
    origin.t = newTemplate.document.elevation;
    origin.object = {};

    const newSweep = new ClockwiseSweepShape();
    newSweep.initialize(origin, cfg);
    newSweep.compute();
    polys.push(newSweep);

    if ( useRecursion ) {
      const res = spread(template, newSweep, newTemplate, level);
      polys.push(...res);
    }
  }
  return polys;
}


/**
 * Build the original shape given coordinates and a shape type.
 */
function originalShape(template, doc) {
  const d = canvas.dimensions;
  const dMult = (d.size / d.distance);

  switch ( doc.t ) {
    case "circle": return template._getCircleShape(doc.distance * dMult, true);
    case "cone": return template._getConeShape(doc.direction, doc.angle, doc.distance * dMult, true);
    case "rect": return template._getRectShape(doc.direction, doc.distance * dMult, true);
    case "ray": return template._getRayShape(doc.direction, doc.distance * dMult, doc.width, true);
  }
}

function useSweep(template) {
  // When not testing:
  //   return this.document.getFlag(MODULE_ID, "enabled")
  //     && canvas.walls.quadtree
  //     && canvas.walls.innerBounds.length;

  if ( !template.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) ) {
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
export function walledTemplateGetCircleShape(wrapped, distance, returnOriginal = !useSweep(this)) {
  log(`walledTemplateGetCircleShape with distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(distance);
  if ( returnOriginal ) return this.originalShape;

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
export function walledTemplateGetConeShape(wrapped, direction, angle, distance, returnOriginal = !useSweep(this)) {
  log(`walledTemplateGetConeShape with direction ${direction}, angle ${angle}, distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, angle, distance);
  if ( returnOriginal ) return this.originalShape;

  // Use sweep to construct the shape
  const poly = computeSweepPolygon.bind(this)();

  // Cone was already a polygon in original so no need to add parameters back
  return poly;
}

/**
 * Replace for SWADE system's SwadeMeasuredTemplate.prototype._getConeShape
 * @param {Function}  wrapped
 * @param {Number}    direction
 * @param {Number}    angle
 * @param {Number}    distance
 * @return {PIXI.Polygon}
 */
export function _getConeShapeSwadeMeasuredTemplate(wrapped, direction, angle, distance, returnOriginal = !useSweep(this)) {
  log(`_getConeShapeSwadeMeasuredTemplate with direction ${direction}, angle ${angle}, distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, angle, distance);
  if ( returnOriginal ) return this.originalShape;

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
export function walledTemplateGetRectShape(wrapped, direction, distance, returnOriginal = !useSweep(this)) {
  log(`walledTemplateGetRectShape with direction ${direction}, distance ${distance}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, distance);
  if ( returnOriginal ) return this.originalShape;

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
export function walledTemplateGetRayShape(wrapped, direction, distance, width, returnOriginal = !useSweep(this)) {
  log(`walledTemplateGetRayShape with direction ${direction}, distance ${distance}, width ${width}, origin ${this.x},${this.y}`, this);

  // Make sure the default shape is constructed.
  this.originalShape = wrapped(direction, distance, width);
  if ( returnOriginal ) return this.originalShape;

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
function getRoundedConeBoundaryShapes(shape, origin, direction, angle, distance) { // eslint-disable-line no-unused-vars
  // Fix for SWADE cones
  if ( game.system.id === "swade" ) return getSwadeRoundedConeBoundaryShapes(shape, origin, direction, angle, distance);

  // Use a circle + limited radius for the bounding shapes
  const pts = shape.points;
  const radius = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
  const rotation = direction - 90;

  const circle = new PIXI.Circle(origin.x, origin.y, radius);
  const la = new LimitedAnglePolygon(origin, {radius, angle, rotation});
  return [circle, la];
}

/**
 * Rounded cone shape for SWADE.
 * Use a circle + limited radius for the bounding shapes.
 * Cone is narrower than default Foundry, and (crucially) the circle is like an ice-cream cone:
 *   It is a half-circle at the end of the triangle.
 * @param {PIXI.Polygon} shape
 * @param {Point} origin
 * @param {number} direction    In degrees
 * @param {number} angle        In degrees
 * @param {number} distance     From the template document, before adjusting for canvas dimensions
 * @returns {[PIXI.Circle, LimitedAnglePolygon]}
 */
function getSwadeRoundedConeBoundaryShapes(shape, origin, direction, angle, distance) { // eslint-disable-line no-unused-vars
  //const pts = shape.points;

  // Use existing shape b/c the rounded cone is too difficult to build from simple shapes.
  // (Would need a half-circle and even then it would be difficult b/c the shapes should overlap.)
  return [shape.translate(origin.x, origin.y)];
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
  const ray = shape.translate(origin.x, origin.y);
  return [ray];
}
