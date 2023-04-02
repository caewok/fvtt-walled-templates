/* globals

*/
"use strict";

import { getSetting, SETTINGS } from "../settings.js";
import { log, gridShapeForTopLeft } from "../util.js";
import { MODULE_ID, FLAGS } from "../const.js";

// Same as PF1e but for the contains test
// https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/module/measure.js
export function WalledTemplatesPF1eGetHighlightedSquares(wrapped) {
  const highlightSquares = wrapped();

  if ( this.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === SETTINGS.DEFAULTS.CHOICES.UNWALLED
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


