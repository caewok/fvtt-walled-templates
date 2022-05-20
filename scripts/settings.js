/* globals
game
*/

"use strict";

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";

export function getSetting(settingName) {
  return game.settings.get(MODULE_ID, settingName);
}

export async function toggleSetting(settingName) {
  const curr = getSetting(settingName);
  return await game.settings.set(MODULE_ID, settingName, !curr);
}

export async function setSetting(settingName, value) {
  return await game.settings.set(MODULE_ID, settingName, value);
}

export function registerSettings() {
  log("Registering walled template switch");

  game.settings.register(MODULE_ID, "default-to-walled", {
    name: "Default to Walled Measured Templates",
    hint: "If set, newly-created templates will default to being walled. Each template configuration has a toggle to turn walled on/off.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(MODULE_ID, "autotarget-enabled", {
    name: "Enable autotargeting",
    config: false,
    scope: "client",
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "autotarget-menu", {
    name: "Enable autotargeting",
    hint: "When toggle option is selected, a bullseye control button in the template control bar will allow you to switch between targeting or not targeting.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      no: "Do not autotarget",
      toggle_off: "Display toggle button; default off",
      toggle_on: "Display toggle button; default on",
      yes: "Always autotarget"
    },
    default: "toggle_off",
    onChange: value => setSetting("autotarget-enabled", value === "toggle_on" || value === "yes")
  });

  game.settings.register(MODULE_ID, "autotarget-method", {
    name: "Autotargeting method",
    hint: "Method to auto-target tokens with templates",
    scope: "world",
    config: true,
    default: "center",
    type: String,
    choices: {
      center: "Token center inside template",
      overlap: "Token area overlaps template",
    }
  }); // See class TokenLayer.targetObjects

  game.settings.register(MODULE_ID, "autotarget-area", {
    name: "Autotargeting area",
    hint: "For overlap autotarget method only. The percent of the token area that must overlap the template to count as a target. 0 means any overlap counts.",
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
