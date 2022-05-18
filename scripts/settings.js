/* globals
game
*/

"use strict";

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";

export function getSetting(settingName) {
  return game.settings.get(MODULE_ID, settingName);
}

export function registerSettings() {
  log("Registering walled template switch");

  game.settings.register(MODULE_ID, "default-to-walled", {
    name: "Default to Walled Measured Templates",
    hint: "If set, newly-created measured templates will default to being walled.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(MODULE_ID, "autotarget-method", {
    name: "Autotargeting method",
    hint: "Method to auto-target tokens with templates",
    scope: "world",
    config: true,
    default: "center",
    type: String,
    choices: {
      no: "No autotargeting",
      center: "Token center inside template",
      overlap: "Token area overlaps template",
    }
  }); // See class TokenLayer.targetObjects

  game.settings.register(MODULE_ID, "autotarget-area", {
    name: "Autotargeting area",
    hint: "For overlap method, percent of the token area that must overlap the template to count as a target. 0 means any overlap counts.",
    range: {
      max: 1,
      min: 0,
      step: 0.1
    },
    type: Number,
    default: 0,
    scope: "world",
    config: true
  });

  // Setting to use percentage of token area on template edges
  // Setting to force token autotarget on/off?
  // Add control button to toggle autotarget on/off?

  log("Done registering settings.");
}

export function debugPolygons() {
  return game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
}
