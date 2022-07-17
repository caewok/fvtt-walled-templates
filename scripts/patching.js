/* globals
libWrapper,
game,
MeasuredTemplate
*/

"use strict";

import { log, gridShapeForTopLeft } from "./util.js";
import { MODULE_ID, getSetting, SETTINGS } from "./settings.js";
import {
  walledTemplateGetCircleShape,
  walledTemplateGetConeShape,
  walledTemplateGetRectShape,
  walledTemplateGetRayShape,
  getBoundaryShapes,
  computeSweepPolygon } from "./getShape.js";
import { walledTemplate5eFromItem } from "./render5eSpellTemplateConfig.js";
import {
  walledTemplatesMeasuredTemplateRefresh,
  boundsOverlap,
  autotargetToken } from "./targeting.js";

// Disable for now until PF2 and PF1 are updated for v10; may not need these
// import { WalledTemplatesPF1eGetHighlightedSquares } from "./systems/PF1e_HighlightGrid.js";
// import { WalledTemplatesPF2eHighlightGrid } from "./systems/PF2e_HighlightGrid.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getCircleShape", walledTemplateGetCircleShape, libWrapper.WRAPPER);
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getConeShape", walledTemplateGetConeShape, libWrapper.WRAPPER);
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRectShape", walledTemplateGetRectShape, libWrapper.WRAPPER);
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRayShape", walledTemplateGetRayShape, libWrapper.WRAPPER);
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getGridHighlightPositions", getGridHighlightPositionsMeasuredTemplate, libWrapper.WRAPPER);

  if ( game.system.id === "dnd5e" ) {
    // Catch when template is created from item; set walled template enabled based on item
    libWrapper.register(MODULE_ID, "game.dnd5e.canvas.AbilityTemplate.fromItem", walledTemplate5eFromItem, libWrapper.WRAPPER);
  }

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

  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype.refresh", walledTemplatesMeasuredTemplateRefresh, libWrapper.MIXED);

  Object.defineProperty(MeasuredTemplate.prototype, "getBoundaryShapes", {
    value: getBoundaryShapes,
    writable: true,
    configurable: true
  });

  Object.defineProperty(MeasuredTemplate.prototype, "computeSweepPolygon", {
    value: computeSweepPolygon,
    writable: true,
    configurable: true
  });

  Object.defineProperty(MeasuredTemplate.prototype, "autotargetToken", {
    value: autotargetToken,
    writable: true,
    configurable: true
  });

  Object.defineProperty(MeasuredTemplate.prototype, "boundsOverlap", {
    value: boundsOverlap,
    writable: true,
    configurable: true
  });
}



/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
function getGridHighlightPositionsMeasuredTemplate(wrapper) {
  const positions = wrapper();

  const enabled = this.document.getFlag(MODULE_ID, "enabled");
  const need_targeting = !getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER;

  if ( !(enabled || need_targeting) ) {
    log("walledTemplatesHighlightGrid|Using Foundry default");
    return positions;
  }

  return positions.filter(p => {
    const shape = gridShapeForTopLeft(p);
    return this.boundsOverlap(shape);
  });
}
