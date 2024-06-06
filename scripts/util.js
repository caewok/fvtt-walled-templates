/* globals
game,
canvas,
CONFIG,
CONST,
PIXI
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
    if ( CONFIG[MODULE_ID].debug ) console.debug(MODULE_ID, "|", ...args);
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
  const tl = canvas.grid.getTopLeftPoint(p);
  return gridShapeForTopLeft(tl);
}

/**
 * Return either a square or hexagon shape based on grid type.
 * Should be the grid at given p
 * @param {Point} p   Top left corner of the grid square.
 * @return {PIXI.Rectangle|Hexagon}  Rectangle for square or gridless; hexagon for hex grids.
 */
export function gridShapeForTopLeft(tl) {
  if ( canvas.grid.isHexagonal ) return Hexagon.fromTopLeft(tl, undefined, {
    width: canvas.grid.sizeX,
    height: canvas.grid.sizeY
  });
  return Square.fromTopLeft(tl, canvas.dimensions.size);
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

/* NOTE: TOKEN SHAPES */

/**
 * Return either a square- or hexagon-shaped hit area object based on grid type
 * @param {Token} token
 * @return {PIXI.Rectangle|Hexagon}
 */
export function tokenBounds(token) {
  if ( canvas.grid.isHexagonal ) return Square.fromToken(token); // Will return PIXI.Rectangle if not even width/height.
  return _hexGridShape(token);
}

function _hexGridShape(token) {
  // Canvas.grid.grid.getBorderPolygon will return null if width !== height.
  const { w, h } = token;
  if ( w !== h || (w === 1 && h === 1) ) return Hexagon.fromToken(token);

  // Get the top left corner
  const c = token.center;
  const tl = canvas.grid.getTopLeftPoint(c);
  const points = canvas.grid.getShape();
  const ln = points.length;
  const pointsTranslated = new Array(ln);
  for ( let i = 0; i < ln; i += 2) {
    pointsTranslated[i] = points[i] + tl.x;
    pointsTranslated[i+1] = points[i+1] + tl.y;
  }
  return new PIXI.Polygon(pointsTranslated);
}
