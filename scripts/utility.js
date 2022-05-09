/* globals
*/

"use strict";

/**
 * Test if two points are almost equal within some epsilon
 * @param {Point} p0
 * @param {Point} p1
 * @param {number} e Some permitted epsilon, by default 1e-8
 * @return {boolean} Are the points almost equal?
 */
export function pointsAlmostEqual(p0, p1, e = 1e-8) {
  return p0.x.almostEqual(p1.x, e) && p0.y.almostEqual(p1.y, e);
}


/**
 * Same as Ray.fromAngle but returns a point instead of constructing the full Ray.
 * @param {Point}   origin    Starting point.
 * @param {Number}  radians   Angle to move from the starting point.
 * @param {Number}  distance  Distance to travel from the starting point.
 * @return {Point}  Coordinates of point that lies distance away from origin along angle.
 */
export function pointFromAngle(origin, radians, distance) {
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  return { x: origin.x + (dx * distance), y: origin.y + (dy * distance) };
}
