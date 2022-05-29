/* globals
canvas,
game
*/

"use strict";

import { pointFromAngle } from "./ClockwiseSweep/utilities.js";
import { log } from "./module.js";
import { MODULE_ID, debugPolygons, getSetting } from "./settings.js";
import { LightMaskClockwisePolygonSweep as WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweep/LightMaskClockwisePolygonSweep.js";

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
function useBoundaryPolygon() {
  log("Starting useBoundaryPolygon", this);

  let enabled = this.document.getFlag(MODULE_ID, "enabled");
  if (typeof enabled === "undefined") {
    enabled = getSetting("default-to-walled");
  }
  if (!enabled) {
    log("useBoundaryPolygon|not enabled. Returning shape", this.shape);
    return this.shape;
  }
  if (!canvas.walls.quadtree) {
    log("useBoundaryPolygon|no quadtree. Returning shape", this.shape);
    return this.shape; // Avoid error when first loading
  }

  const origin = { x: this.data.x, y: this.data.y };

  const cfg = {
    debug: debugPolygons(),
    type: "light",
    density: 60,
    source: this
  };

  let poly = new WalledTemplatesClockwiseSweepPolygon();
  poly.initialize(origin, cfg);
  poly.compute();

  // Shift to origin 0,0 as expected for Template shape.
  poly = poly.translate(-origin.x, -origin.y);
  log("useBoundaryPolygon|returning poly", poly);
  return poly;
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
  log(`walledTemplateGetCircleShape with distance ${distance}, origin ${this.data.x},${this.data.y}`, this);
  // Make sure the default shape is constructed.
  this.shape = wrapped(distance);
  log("walledTemplateGetCircleShape|shape", this.shape);

  return useBoundaryPolygon.bind(this)();
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
  log(`walledTemplateGetConeShape with direction ${direction}, angle ${angle}, distance ${distance}, origin ${this.data.x},${this.data.y}`, this);
  if (game.settings.get("core", "coneTemplateType") === "flat") {
    // For flat cone, use WalledTemplatesClockwiseSweepPolygon and pass this source object.

    this.shape = wrapped(direction, angle, distance);
    log("walledTemplateGetConeShape|shape", this.shape);
    let poly = useBoundaryPolygon.bind(this)();

    // Shift back the origin from the adjustment in boundaryPolygon
    const shifted_origin = pointFromAngle({x: 0, y: 0}, Math.toRadians(this.data.direction), 1);
    poly = poly.translate(shifted_origin.x, shifted_origin.y);
    return poly;
  }

  let enabled = this.document.getFlag(MODULE_ID, "enabled");
  if (typeof enabled === "undefined") {
    enabled = getSetting("default-to-walled");
  }
  if (!enabled) {
    const shape = wrapped(direction, angle, distance);
    log("useBoundaryPolygon|not enabled. Returning shape", shape);
    return shape;
  }
  if (!canvas.walls.quadtree) {
    const shape = wrapped(direction, angle, distance);
    log("useBoundaryPolygon|no quadtree. Returning shape", shape);
    return shape; // Avoid error when first loading
  }

  const origin = { x: this.data.x, y: this.data.y };

  // For round cone, treat like a circle plus limited angle
  const cfg = {
    debug: debugPolygons(),
    type: "light",
    density: 60,
    angle: angle || 90,
    radius: distance,
    rotation: Math.toDegrees(direction) - 90
  };

  log(`walledTemplateGetConeShape|Round cone. Angle ${angle}, distance ${distance}, direction ${direction} at origin ${origin.x},${origin.y}`);
  let poly = new WalledTemplatesClockwiseSweepPolygon();
  poly.initialize(origin, cfg);
  poly.compute();

  // Set polygon origin to 0, 0 as expected for Template shape.
  poly = poly.translate(-origin.x, -origin.y);
  log("walledTemplateGetConeShape|poly", poly);

  // Shift back the origin from the adjustment in boundaryPolygon
  const shifted_origin = pointFromAngle({x: 0, y: 0}, Math.toRadians(this.data.direction), 1);
  poly = poly.translate(shifted_origin.x, shifted_origin.y);

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
  log(`walledTemplateGetRectShape with direction ${direction}, distance ${distance}, origin ${this.data.x},${this.data.y}`, this);
  // Make sure the default shape is constructed.
  this.shape = wrapped(direction, distance);
  log("walledTemplateGetRectShape|shape", this.shape);
  return useBoundaryPolygon.bind(this)();
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
  log(`walledTemplateGetRayShape with direction ${direction}, distance ${distance}, width ${width}, origin ${this.data.x},${this.data.y}`, this);
  // Make sure the default shape is constructed.
  this.shape = wrapped(direction, distance, width);
  log("walledTemplateGetRayShape|shape", this.shape);
  return useBoundaryPolygon.bind(this)();
}
