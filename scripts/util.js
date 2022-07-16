/* globals
*/

"use strict";

import { MODULE_ID } from "./settings.js";

/**
 * Log message only when debug flag is enabled from DevMode module.
 * @param {Object[]} args  Arguments passed to console.log.
 */
export function log(...args) {
  try {
    const isDebugging = game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
    if ( isDebugging ) {
      console.log(MODULE_ID, "|", ...args);
    }
  } catch(e) {
    // Empty
  }
}

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
 * Determine if at least one segment from black intersects one segment from red.
 * @param {Segments[]} red      Array of objects that contain points A.x, A.y, B.x, B.y.
 * @param {Segments[]} black    Array of objects that contain points A.x, A.y, B.x, B.y.
 * @return {Boolean}
 */
export function hasIntersectionBruteRedBlack(red, black) {
  const ln1 = red.length;
  const ln2 = black.length;
  if (!ln1 || !ln2) { return; }

  for (let i = 0; i < ln1; i += 1) {
    const si = red[i];
    for (let j = 0; j < ln2; j += 1) {
      const sj = black[j];
      if ( foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) ) return true;
    }
  }
  return false;
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
