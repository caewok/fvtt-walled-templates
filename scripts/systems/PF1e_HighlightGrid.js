/* globals

*/
"use strict";

import { gridShapeForTopLeft } from "../targeting.js";
import { MODULE_ID, getSetting, SETTINGS } from "../settings.js";
import { log } from "../module.js";

// Same as PF1e but for the contains test
// https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/module/measure.js
export function WalledTemplatesPF1eGetHighlightedSquares(wrapped) {
  const highlightSquares = wrapped();

  if ( !this.document.getFlag(MODULE_ID, "enabled")
    && getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER ) {
    log("WalledTemplatesPF1eGetHighlightedSquares|Using Foundry default");
    return highlightSquares;
  }

  return highlightSquares.filter(s => {
    // Each s has {x, y} top left corners from canvas.grid.grid.`getPixelsFromGridPosition`
    const shape = gridShapeForTopLeft(s);
    return this.boundsOverlap(shape);
  });
}


