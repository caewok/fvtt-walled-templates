/* globals
game
*/

"use strict";

import { log } from "./util.js";
import { MODULE_ID } from "./const.js";

export const SETTINGS = {
  DEFAULT_WALLED: "default-to-walled",

  DIAGONAL_SCALING: {
    RAY: "diagonal-scaling-ray",
    CONE: "diagonal-scaling-cone",
    CIRCLE: "diagonal-scaling-circle"
  },

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
};

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

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.METHOD, {
    name: game.i18n.localize("walledtemplates.settings.autotarget-method.Name"),
    hint: game.i18n.localize("walledtemplates.settings.autotarget-method.Hint"),
    scope: "world",
    config: true,
    default: "center",
    type: String,
    choices: {
      [SETTINGS.AUTOTARGET.METHODS.CENTER]: game.i18n.localize("walledtemplates.settings.autotarget-method.Method.Center"),
      [SETTINGS.AUTOTARGET.METHODS.OVERLAP]: game.i18n.localize("walledtemplates.settings.autotarget-method.Method.Overlap")
    }
  }); // See class TokenLayer.targetObjects

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.AREA, {
    name: game.i18n.localize("walledtemplates.settings.autotarget-area.Name"),
    hint: game.i18n.localize("walledtemplates.settings.autotarget-area.Hint"),
    range: {
      max: 1,
      min: 0,
      step: 0.01
    },
    type: Number,
    default: 0,
    scope: "world",
    config: true
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

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.RAY, {
    name: game.i18n.localize("walledtemplates.settings.diagonal-scaling-ray.Name"),
    hint: game.i18n.localize("walledtemplates.settings.diagonal-scaling-ray.Hint"),
    type: Boolean,
    default: false,
    scope: "world",
    config: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.CONE, {
    name: game.i18n.localize("walledtemplates.settings.diagonal-scaling-cone.Name"),
    hint: game.i18n.localize("walledtemplates.settings.diagonal-scaling-cone.Hint"),
    type: Boolean,
    default: false,
    scope: "world",
    config: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.CIRCLE, {
    name: game.i18n.localize("walledtemplates.settings.diagonal-scaling-circle.Name"),
    hint: game.i18n.localize("walledtemplates.settings.diagonal-scaling-circle.Hint"),
    type: Boolean,
    default: false,
    scope: "world",
    config: true
  });


  log("Done registering settings.");
}

export function debugPolygons() {
  return game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
}
