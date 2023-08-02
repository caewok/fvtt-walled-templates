/* globals
game,
canvas,
CONST
*/

"use strict";

import { MODULE_ID } from "./const.js";
import { Hexagon } from "./geometry/RegularPolygon/Hexagon.js";
import { Square } from "./geometry/RegularPolygon/Square.js";

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
  if ( canvas.scene.grid.type === CONST.GRID_TYPES.GRIDLESS
    || canvas.scene.grid.type === CONST.GRID_TYPES.SQUARE ) {

    return Square.fromTopLeft(p, canvas.dimensions.size);
  }

  const { h, w } = canvas.grid.grid;
  return Hexagon.fromTopLeft(p, undefined, { width: w, height: h });
}

/**
 * Get the token name or id, depending on permissions of the user.
 */
export function tokenName(token) {
  if ( !token ) return undefined;
  if ( token.document.testUserPermission(game.user, "LIMITED")
    || token.document.displayName === CONST.TOKEN_DISPLAY_MODES.HOVER
    || token.document.displayName === CONST.TOKEN_DISPLAY_MODES.ALWAYS ) return token.name;
  return token.id;
}
