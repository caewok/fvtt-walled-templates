/* globals
canvas,
game,
PIXI,
Ray,
*/

"use strict";

import { SETTINGS } from "./settings.js";
import { WalledTemplate, templateFlagProperties } from "./WalledTemplate.js";


/**
 * Use ClockwiseSweep to construct the polygon shape, passing it this template object.
 */


/**
 * Wrap MeasuredTemplate.prototype._computeShape
 * Allow the original shape to be constructed, then build from that.
 * @returns {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon}
 */
export function _computeShapeMeasuredTemplate(wrapped) {
  // Store the original shape.
  this.originalShape = wrapped();
  if ( !requiresSweep(this) ) return this.originalShape;

  const walledTemplate = WalledTemplate.fromMeasuredTemplate(this);
  const poly = walledTemplate.computeSweepPolygon();

  poly.x = this.originalShape.x;
  poly.y = this.originalShape.y;
  poly.radius = this.originalShape.radius;

  if ( !poly || isNaN(poly.points[0]) ) {
    console.error("_computeShapeMeasuredTemplate poly is broken.");
    return this.originalShape;
  }
  return poly;
}

/**
 * Determine if a sweep is needed for a template.
 * @param {MeasuredTemplate}
 * @returns {boolean}
 */
function requiresSweep(template) {
  const { wallsBlock } = templateFlagProperties(template);
  return wallsBlock !== SETTINGS.DEFAULTS.CHOICES.UNWALLED;
}

// NOTE: Original shape calculations
// From Foundry v11.299.

/**
 * Original shape calculation from Foundry v11.
 * Get a Circular area of effect given a radius of effect
 * @param {number} distance
 * @returns {PIXI.Circle}
 */
export function getCircleShape(distance) {
  return new PIXI.Circle(0, 0, distance);
}

/**
 * Original shape calculation from Foundry v11.
 * Get a Conical area of effect given a direction, angle, and distance
 * @param {number} direction
 * @param {number} angle
 * @param {number} distance
 * @returns {PIXI.Polygon}
 */
export function getConeShape(direction, angle, distance) {
  angle = angle || 90;
  const coneType = game.settings.get("core", "coneTemplateType");

  // For round cones - approximate the shape with a ray every 3 degrees
  let angles;
  if ( coneType === "round" ) {
    const da = Math.min(angle, 3);
    angles = Array.fromRange(Math.floor(angle/da)).map(a => (angle/-2) + (a*da)).concat([angle/2]);
  }

  // For flat cones, direct point-to-point
  else {
    angles = [(angle/-2), (angle/2)];
    distance /= Math.cos(Math.toRadians(angle/2));
  }

  // Get the cone shape as a polygon
  const rays = angles.map(a => Ray.fromAngle(0, 0, direction + Math.toRadians(a), distance+1));
  const points = rays.reduce((arr, r) => {
    return arr.concat([r.B.x, r.B.y]);
  }, [0, 0]).concat([0, 0]);
  return new PIXI.Polygon(points);
}

/**
 * Original shape calculation from Foundry v11.
 * Get a Rectangular area of effect given a width and height
 * @param {number} direction
 * @param {number} distance
 * @returns {PIXI.Rectangle}
 */
export function getRectShape(direction, distance) {
  let d = canvas.dimensions;
  let r = Ray.fromAngle(0, 0, direction, distance);
  let dx = Math.round(r.dx / (d.size / 2)) * (d.size / 2);
  let dy = Math.round(r.dy / (d.size / 2)) * (d.size / 2);
  return new PIXI.Rectangle(0, 0, dx, dy).normalize();
}

/**
 * Original shape calculation from Foundry v11.
 * Get a rotated Rectangular area of effect given a width, height, and direction
 * @param {number} direction
 * @param {number} distance
 * @param {number} width
 * @returns {PIXI.Polygon}
 */
export function getRayShape(direction, distance, width) {
  let up = Ray.fromAngle(0, 0, direction - Math.toRadians(90), (width / 2)+1);
  let down = Ray.fromAngle(0, 0, direction + Math.toRadians(90), (width / 2)+1);
  let l1 = Ray.fromAngle(up.B.x, up.B.y, direction, distance+1);
  let l2 = Ray.fromAngle(down.B.x, down.B.y, direction, distance+1);

  // Create Polygon shape and draw
  const points = [down.B.x, down.B.y, up.B.x, up.B.y, l1.B.x, l1.B.y, l2.B.x, l2.B.y];
  return new PIXI.Polygon(points);
}


