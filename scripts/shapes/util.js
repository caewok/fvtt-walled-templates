/* globals

*/
"use strict";

// Store √3 as a constant
Math.SQRT3 = Math.sqrt(3);

/**
 * Rotate a point around a given angle
 * @param {Point} point
 * @param {number} angle  In radians
 * @returns {Point}
 */
export function rotatePoint(point, angle) {
  return {
    x: (point.x * Math.cos(angle)) - (point.y * Math.sin(angle)),
    y: (point.y * Math.cos(angle)) + (point.x * Math.sin(angle))
  };
}

/**
 * Translate a point by a given dx, dy
 * @param {Point} point
 * @param {number} dx
 * @param {number} dy
 * @returns {Point}
 */
export function translatePoint(point, dx, dy) {
  return {
    x: point.x + dx,
    y: point.y + dy
  };
}

/**
 * Point between two points on a line
 * @param {Point} a
 * @param {Point} b
 * @returns {Point}
 */
export function midPoint(a, b) {
  return {
    x: a.x + ((b.x - a.x) / 2),
    y: a.y + ((b.y - a.y) / 2)
  }
}

/**
 * Build a geometric shape given a set of angles.
 * @param {Number[]} angles      Array of angles, in degrees, indicating vertex positions.
 * @param {Point}    origin      Center of the shape.
 * @param {Number}   radius      Distance from origin to each vertex.
 * @param {Number}   rotation    Angle in degrees describing rotation from due east.
 * @returns {Points[]} Array of vertices.
 */
export function geometricShapePoints(angles, origin, radius, rotation = 0) {
  const a_translated = angles.map(a => Math.toRadians(Math.normalizeDegrees(a + rotation)));
  return a_translated.map(a => pointFromAngle(origin, a, radius));
}

/**
 * Same as Ray.fromAngle but returns a point instead of constructing the full Ray.
 * @param {Point}   origin    Starting point.
 * @param {Number}  radians   Angle to move from the starting point.
 * @param {Number}  distance  Distance to travel from the starting point.
 * @returns {Point}  Coordinates of point that lies distance away from origin along angle.
 */
export function pointFromAngle(origin, radians, distance) {
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  return { x: origin.x + (dx * distance), y: origin.y + (dy * distance) };
}

/**
 * Test if two points are almost equal, within some small epsilon.
 * @param {Point} a
 * @param {Point} b
 * @returns {booleam}
 */
export function pointsAlmostEqual(a, b, epsilon = 1e-8) {
  return a.x.almostEqual(b.x, epsilon) && a.y.almostEqual(b.y, epsilon);
}
