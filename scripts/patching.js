/* globals
libWrapper,
game,
MeasuredTemplate
*/

"use strict";

import { MODULE_ID } from "./settings.js";
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
import { getGridHighlightPositionsMeasuredTemplate } from "./highlighting/Foundry_highlighting.js";
import { WeilerAthertonClipper } from "./WeilerAtherton.js";

// Disable for now until PF2 and PF1 are updated for v10; may not need these
// import { WalledTemplatesPF1eGetHighlightedSquares } from "./highlighting/PF1e_highlighting.js";
// import { WalledTemplatesPF2eHighlightGrid } from "./highlighting/PF2e_highlighting.js";

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


  // ----- New methods ----- //

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
