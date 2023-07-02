/* globals
CONFIG,
game,
libWrapper
*/

"use strict";

import { MODULE_ID } from "./const.js";
import { defaultOptionsMeasuredTemplateConfig } from "./renderMeasuredTemplateConfig.js";
import { _computeShapeMeasuredTemplate } from "./getShape.js";
import {
  boundsOverlap,
  autotargetToken } from "./targeting.js";
import { getGridHighlightPositionsMeasuredTemplate } from "./highlighting/Foundry_highlighting.js";

// Disable for now until PF2 and PF1 are updated for v10; may not need these
// import { WalledTemplatesPF1eGetHighlightedSquares } from "./highlighting/PF1e_highlighting.js";
// import { WalledTemplatesPF2eHighlightGrid } from "./highlighting/PF2e_highlighting.js";

/**
 * Helper to wrap methods.
 * @param {string} method       Method to wrap
 * @param {function} fn         Function to use for the wrap
 * @param {object} [options]    Options passed to libWrapper.register. E.g., { perf_mode: libWrapper.PERF_FAST}
 */
function wrap(method, fn, options = {}) { libWrapper.register(MODULE_ID, method, fn, libWrapper.WRAPPER, options); }

/**
 * Helper to add a method to a class.
 * @param {class} cl      Either Class.prototype or Class
 * @param {string} name   Name of the method
 * @param {function} fn   Function to use for the method
 */
function addClassMethod(cl, name, fn) {
  Object.defineProperty(cl, name, {
    value: fn,
    writable: true,
    configurable: true
  });
}

export function registerWalledTemplates() {
  // ----- MeasuredTemplate ----- //
  wrap("CONFIG.MeasuredTemplate.objectClass.prototype._computeShape", _computeShapeMeasuredTemplate);
  wrap("CONFIG.MeasuredTemplate.objectClass.prototype._getGridHighlightPositions", getGridHighlightPositionsMeasuredTemplate);

  // ----- MeasuredTemplateConfig ----- //
  wrap("MeasuredTemplateConfig.defaultOptions", defaultOptionsMeasuredTemplateConfig);


  // TODO: Reenable swade fix
//   if ( game.system.id === "swade" ) {
//     libWrapper.register(MODULE_ID, "CONFIG.MeasuredTemplate.objectClass.prototype._getConeShape", _getConeShapeSwadeMeasuredTemplate, libWrapper.WRAPPER);
//   }

  // Disable for now until PF2 and PF1 are updated for v10; may not need these
  //   if ( game.system.id === "pf2e" ) {
  //     // Override how the grid is highlighted for cones and rays
  //     libWrapper.register(MODULE_ID, "CONFIG.MeasuredTemplate.objectClass.prototype.highlightGrid",
  //  WalledTemplatesPF2eHighlightGrid, libWrapper.MIXED);
  //   }
  //
  //   if ( game.system.id === "pf1" ) {
  //     libWrapper.register(MODULE_ID, "CONFIG.MeasuredTemplate.objectClass.prototype.getHighlightedSquares",
  // WalledTemplatesPF1eGetHighlightedSquares, libWrapper.WRAPPER);
  //   }

  // For debugging
  if ( game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID) ) {
    wrap("ClockwiseSweepPolygon.prototype._executeSweep", executeSweepClockwiseSweepPolygon, { perf_mode: libWrapper.PERF_FAST});
  }

  // ----- New methods ----- //
  addClassMethod(CONFIG.MeasuredTemplate.objectClass.prototype, "autotargetToken", autotargetToken);
  addClassMethod(CONFIG.MeasuredTemplate.objectClass.prototype, "boundsOverlap", boundsOverlap);
}

// For debugging
function executeSweepClockwiseSweepPolygon(wrapper) {
  wrapper();
  this._preWApoints = [...this.points];
}

