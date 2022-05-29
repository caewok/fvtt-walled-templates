/* globals

*/
"use strict";

import { shapeForGridPixels } from "../targeting.js";

// Same as PF1e but for the contains test
// https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/master/module/measure.js
export function WalledTemplatesPF1eGetHighlightedSquares(wrapped) {
  const highlightSquares = wrapped();
  return highlightSquares.filter(s => {
    // Each s has {x, y} top left corners from canvas.grid.grid.`getPixelsFromGridPosition`
    const shape = shapeForGridPixels(s);
    return this.boundsOverlap(shape);
  });
}


