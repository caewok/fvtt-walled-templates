/* globals
*/

"use strict";

import { MODULE_ID } from "./settings.js";
import { Hexagon } from "./shapes/Hexagon.js";

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

/**
 * Return either a square or a hexagon shape based on grid type for the current scene.
 * If the point is on a corner, it will draw the bottom right grid location.
 * @param {Point} p   Any point within the grid shape
 * @return {PIXI.Rectangle|Hexagon} Rectangle for square or gridless; hexagon for hex grids.
 */
export function gridShapeForPixel(p) {
  // Get the upper left corner of the grid for the pixel
  const [gx, gy] = canvas.grid.getTopLeft(p.x, p.y);
  return gridShapeForTopLeft({x: gx, y: gy});
}

/**
 * Return either a square or hexagon shape based on grid type.
 * Should be the grid at given p
 * @param {Point} p   Top left corner of the grid square.
 * @return {PIXI.Rectangle|Hexagon}  Rectangle for square or gridless; hexagon for hex grids.
 */
export function gridShapeForTopLeft(p) {
  if ( canvas.scene.data.gridType === CONST.GRID_TYPES.GRIDLESS
    || canvas.scene.data.gridType === CONST.GRID_TYPES.SQUARE ) {
    return new PIXI.Rectangle(p.x, p.y, canvas.dimensions.size, canvas.dimensions.size);
  }

  // Offset from top left to center
  const hx = Math.ceil(canvas.grid.w / 2);
  const hy = Math.ceil(canvas.grid.h / 2);

  return Hexagon.fromDimensions(
    p.x + hx,
    p.y + hy,
    canvas.grid.grid.w,
    canvas.grid.grid.h);
}
