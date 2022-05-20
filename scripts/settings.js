/* globals
game
*/

"use strict";

import { log } from "./module.js";

export const MODULE_ID = "walledtemplates";
export const SETTINGS = {
  DEFAULT_WALLED: "default-to-walled",

  AUTOTARGET: {
    ENABLED: "autotarget-enabled",
    MENU: "autotarget-menu",
    METHOD: "autotarget-method",
    AREA: "autotarget-area",
    CHOICES: {
      NO: "no",
      TOGGLE_OFF: "toggle_off",
      TOGGLE_ON: "toggle_on",
      YES: "yes"
    },
    METHODS: {
      CENTER: "center",
      OVERLAP: "overlap"
    }
  }
}

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

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WALLED, {
    name: game.i18n.localize("walledtemplates.settings.default-to-walled.Name"),
    hint: game.i18n.localize("walledtemplates.settings.default-to-walled.Hint"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.ENABLED, {
    name: "Enable autotargeting",
    config: false,
    scope: "client",
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.MENU, {
    name: game.i18n.localize("walledtemplates.settings.autotarget-menu.Name"),
    hint: game.i18n.localize("walledtemplates.settings.autotarget-menu.Hint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      [SETTINGS.AUTOTARGET.CHOICES.NO]: game.i18n.localize("walledtemplates.settings.autotarget-menu.Choice.No"),
      [SETTINGS.AUTOTARGET.CHOICES.TOGGLE_OFF]: game.i18n.localize("walledtemplates.settings.autotarget-menu.Choice.Toggle_Off"),
      [SETTINGS.AUTOTARGET.CHOICES.TOGGLE_ON]: game.i18n.localize("walledtemplates.settings.autotarget-menu.Choice.Toggle_On"),
      [SETTINGS.AUTOTARGET.CHOICES.YES]: game.i18n.localize("walledtemplates.settings.autotarget-menu.Choice.Yes")
    },
    default: SETTINGS.AUTOTARGET.CHOICES.TOGGLE_OFF,
    onChange: value => setSetting(SETTINGS.AUTOTARGET.ENABLED,
      value === SETTINGS.AUTOTARGET.CHOICES.TOGGLE_ON
      || value === SETTINGS.AUTOTARGET.CHOICES.YES)
  });

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.METHOD, {
    name: game.i18n.localize("walledtemplates.settings.autotarget-method.Name"),
    hint: game.i18n.localize("walledtemplates.settings.autotarget-method.Hint"),
    scope: "world",
    config: true,
    default: "center",
    type: String,
    choices: {
      [SETTINGS.AUTOTARGET.METHODS.CENTER]: game.i18n.localize("walledtemplates.settings.autotarget-method.Method.Center"),
      [SETTINGS.AUTOTARGET.METHODS.OVERLAP]: game.i18n.localize("walledtemplates.settings.autotarget-method.Method.Overlap"),
    }
  }); // See class TokenLayer.targetObjects

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.AREA, {
    name: game.i18n.localize("walledtemplates.settings.autotarget-area.Name"),
    hint: game.i18n.localize("walledtemplates.settings.autotarget-area.Hint"),
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
