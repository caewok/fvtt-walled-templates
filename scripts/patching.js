/* globals
libWrapper,
game,
MeasuredTemplate
*/

"use strict";

// Patches

import { MODULE_ID } from "./const.js";
import {
  walledTemplateGetCircleShape,
  walledTemplateGetConeShape,
  walledTemplateGetRectShape,
  walledTemplateGetRayShape } from "./getShape.js";
import { walledTemplate5eFromItem } from "./render5eSpellTemplateConfig.js";
import { boundaryPolygon } from "./boundaryPolygon.js";
import {
  walledTemplatesMeasuredTemplateDraw,
  autotargetByTokenCenter,
  autotargetByTokenOverlap } from "./targeting.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getCircleShape", walledTemplateGetCircleShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getConeShape", walledTemplateGetConeShape, "MIXED");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRectShape", walledTemplateGetRectShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRayShape", walledTemplateGetRayShape, "WRAPPER");

  if (game.system.id === "dnd5e") {
    // Catch when template is created from item; set walled template enabled based on item
    libWrapper.register(MODULE_ID, "game.dnd5e.canvas.AbilityTemplate.fromItem", walledTemplate5eFromItem, "WRAPPER");
  }

  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype.refresh", walledTemplatesMeasuredTemplateDraw, "WRAPPER");
}

Object.defineProperty(MeasuredTemplate.prototype, "boundaryPolygon", {
  value: boundaryPolygon,
  writable: true,
  configurable: true
});

Object.defineProperty(MeasuredTemplate.prototype, "autotargetByTokenCenter", {
  value: autotargetByTokenCenter,
  writable: true,
  configurable: true
});

Object.defineProperty(MeasuredTemplate.prototype, "autotargetByTokenOverlap", {
  value: autotargetByTokenOverlap,
  writable: true,
  configurable: true
});
