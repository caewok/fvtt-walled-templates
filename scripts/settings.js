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

  game.settings.register(MODULE_ID, "auto-target-method", {
    name: "Auto-targeting method",
    hint: "Method to auto-target tokens with templates",
    scope: "world",
    config: true,
    default: "center",
    type: String,
    choices: {
      center: "By token center",
      collision: "Using collision rays from template center",
    }
  }); // See class TokenLayer.targetObjects

  // Setting to use percentage of token area on template edges
  // Setting to force token autotarget on/off?
  // Add control button to toggle autotarget on/off?

  log("Done registering settings.");
}

export function debugPolygons() {
  return game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
}
