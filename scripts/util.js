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
  } catch(e) { // eslint-disable-line no-unused-vars
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
  if ( canvas.grid.isHexagonal ) return hexGridShape(token);
  if ( !token.hitArea ) return token.bounds; // No hitArea if just loading.
  return Square.fromToken(token); // Will return PIXI.Rectangle if not even width/height.
}

function hexGridShape(token) {
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

// ----- NOTE: HTML / Form manipulation ----- //

/**
 * Helper to construct a tab element
 * @param {string} tabName      Internal name of the tab
 * @param {string} tabLegend    Public name of the tab
 * @param {string} [tabIcon]    Image to display on the tab
 * @returns {Node} Div element for the tab entry
 */
export function constructTabElement(tabName, tabLegend, tabIcon) {
  // Element
  const tabElem = document.createElement("a");
  tabElem.setAttribute("class", "item");
  tabElem.setAttribute("data-tab", tabName);

  // Icon
  if ( tabIcon ) {
    const iconElem = document.createElement("i");
    iconElem.setAttribute("class", tabIcon);
    tabElem.appendChild(iconElem);
  }

  // Title
  const legend = document.createTextNode(game.i18n.localize(tabLegend));
  tabElem.appendChild(legend);
  return tabElem;
}

/**
 * Helper to construct a tab division.
 * @param {string} tabName            Internal reference to the tab
 * @param {string} [groupName="main"] The data group for the tab
 * @param {string[]} [classes=[]]     Classes to add to the tab (besides "tab")
 * @param {string} [groupName="main"] The data group for the tab
 * @param {Map<string, string>} [attributes]  Attribute map
 */
export function constructTabDivision(tabName, groupName = "main", classes = []) {
  const div = document.createElement("div");
  div.setAttribute("class", "tab");
  classes.forEach(cl => div.classList.add(cl));
  div.setAttribute("data-tab", tabName);
  div.setAttribute("data-group", groupName);
  return div;
}

/**
 * Helper to move all children from one node to another.
 * @param {Node} oldParent
 * @param {Node} newParent
 * @returns {Node} The newParent node
 */
export function moveAllChildren(oldParent, newParent) {
  while (oldParent.childNodes.length > 0) {
    newParent.appendChild(oldParent.removeChild(oldParent.childNodes[0]));
  }
  return newParent;
}

/**
 * Helper to construct tabbed navigation.
 * @param {Node[]} tabElements    Tab elements, from constructTabElement
 * @returns {Node} Nav element with tabs inserted
 */
export function constructTabNavigation(tabElements = []) {
  const tabNav = document.createElement("nav");
  tabNav.setAttribute("class", "sheet-tabs tabs");
  tabNav.setAttribute("data-group", "main");
  tabNav.setAttribute("aria-role", game.i18n.localize("SHEETS.FormNavLabel"));
  tabElements.forEach(elem => tabNav.appendChild(elem));
  return tabNav;
}