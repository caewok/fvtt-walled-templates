/* globals
game
*/

"use strict";

import { log } from "./util.js";
import { MODULE_ID } from "./const.js";

export const SETTINGS = {
  DEFAULTS: {
    circle: "default_circle",
    cone: "default_cone",
    ray: "default_ray",
    rect: "default_rect",
    CHOICES: {
      UNWALLED: "unwalled",
      WALLED: "walled",
      RECURSE: "recurse"
    }
  },

  DEFAULT_WALL_RESTRICTIONS: {
    circle: "default-circle-wall-restriction",
    cone: "default-cone-wall-restriction",
    ray: "default-ray-wall-restriction",
    rect: "default-rect-wall-restriction",
    CHOICES: {
      LIGHT: "light",
      MOVE: "move",
      SIGHT: "sight",
      SOUND: "sound"
    }
  },

  DIAGONAL_SCALING: {
    ray: "diagonal-scaling-ray",
    cone: "diagonal-scaling-cone",
    circle: "diagonal-scaling-circle",
    rect: "diagonal-scaling-rect" // Not currently used
  },

  AUTOTARGET: {
    ENABLED: "autotarget-enabled",
    MENU: "autotarget-menu",
    METHOD: "autotarget-method",
    AREA: "autotarget-area",
    CHOICES: {
      NO: "no",
      TOGGLE_OFF: "toggle-off",
      TOGGLE_ON: "toggle-on",
      YES: "yes"
    },

    METHODS: {
      CENTER: "center",
      OVERLAP: "overlap"
    }
  },

  CHANGELOG: "changelog"
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

  game.settings.register(MODULE_ID, SETTINGS.DEFAULTS.circle, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.circle}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.circle}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULTS.CHOICES.UNWALLED,
    type: String,
    choices: {
      [SETTINGS.DEFAULTS.CHOICES.UNWALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.UNWALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.WALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.WALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.RECURSE]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.RECURSE}`)
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WALL_RESTRICTIONS.circle, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.circle}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.circle}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE,
    type: String,
    choices: {
      // Use the default Foundry en.json WALLS version
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.LIGHT]: game.i18n.localize("WALLS.Light"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE]: game.i18n.localize("WALLS.Movement"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SIGHT]: game.i18n.localize("WALLS.Sight"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SOUND]: game.i18n.localize("WALLS.Sound")
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULTS.cone, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.cone}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.cone}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULTS.CHOICES.UNWALLED,
    type: String,
    choices: {
      [SETTINGS.DEFAULTS.CHOICES.UNWALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.UNWALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.WALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.WALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.RECURSE]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.RECURSE}`)
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WALL_RESTRICTIONS.cone, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.cone}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.cone}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE,
    type: String,
    choices: {
      // Use the default Foundry en.json WALLS version
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.LIGHT]: game.i18n.localize("WALLS.Light"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE]: game.i18n.localize("WALLS.Movement"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SIGHT]: game.i18n.localize("WALLS.Sight"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SOUND]: game.i18n.localize("WALLS.Sound")
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULTS.rect, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.rect}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.rect}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULTS.CHOICES.UNWALLED,
    type: String,
    choices: {
      [SETTINGS.DEFAULTS.CHOICES.UNWALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.UNWALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.WALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.WALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.RECURSE]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.RECURSE}`)
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WALL_RESTRICTIONS.rect, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.rect}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.rect}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE,
    type: String,
    choices: {
      // Use the default Foundry en.json WALLS version
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.LIGHT]: game.i18n.localize("WALLS.Light"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE]: game.i18n.localize("WALLS.Movement"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SIGHT]: game.i18n.localize("WALLS.Sight"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SOUND]: game.i18n.localize("WALLS.Sound")
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULTS.ray, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.ray}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.ray}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULTS.CHOICES.UNWALLED,
    type: String,
    choices: {
      [SETTINGS.DEFAULTS.CHOICES.UNWALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.UNWALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.WALLED]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.WALLED}`),
      [SETTINGS.DEFAULTS.CHOICES.RECURSE]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULTS.CHOICES.RECURSE}`)
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_WALL_RESTRICTIONS.ray, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.ray}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DEFAULT_WALL_RESTRICTIONS.ray}.Hint`),
    scope: "world",
    config: true,
    default: SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE,
    type: String,
    choices: {
      // Use the default Foundry en.json WALLS version
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.LIGHT]: game.i18n.localize("WALLS.Light"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE]: game.i18n.localize("WALLS.Movement"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SIGHT]: game.i18n.localize("WALLS.Sight"),
      [SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.SOUND]: game.i18n.localize("WALLS.Sound")
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.ENABLED, {
    name: "Enable autotargeting",
    config: false,
    scope: "client",
    type: Boolean,
    default: false
  });

  const METHODS = SETTINGS.AUTOTARGET.METHODS;
  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.METHOD, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.METHOD}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.METHOD}.Hint`),
    scope: "world",
    config: true,
    default: "center",
    type: String,
    choices: {
      [SETTINGS.AUTOTARGET.METHODS.CENTER]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.METHOD}.Method.${METHODS.CENTER}`),
      [SETTINGS.AUTOTARGET.METHODS.OVERLAP]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.METHOD}.Method.${METHODS.OVERLAP}`)
    }
  }); // See class TokenLayer.targetObjects

  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.AREA, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.AREA}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.AREA}.Hint`),
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

  const CHOICES = SETTINGS.AUTOTARGET.CHOICES;
  game.settings.register(MODULE_ID, SETTINGS.AUTOTARGET.MENU, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.MENU}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.MENU}.Hint`),
    scope: "client",
    config: true,
    type: String,
    choices: {
      [SETTINGS.AUTOTARGET.CHOICES.NO]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.MENU}.Choice.${CHOICES.NO}`),
      [SETTINGS.AUTOTARGET.CHOICES.TOGGLE_OFF]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.MENU}.Choice.${CHOICES.TOGGLE_OFF}`),
      [SETTINGS.AUTOTARGET.CHOICES.TOGGLE_ON]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.MENU}.Choice.${CHOICES.TOGGLE_ON}`),
      [SETTINGS.AUTOTARGET.CHOICES.YES]: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.AUTOTARGET.MENU}.Choice.${CHOICES.YES}`)
    },
    default: SETTINGS.AUTOTARGET.CHOICES.TOGGLE_OFF,
    onChange: value => setSetting(SETTINGS.AUTOTARGET.ENABLED,
      value === SETTINGS.AUTOTARGET.CHOICES.TOGGLE_ON
      || value === SETTINGS.AUTOTARGET.CHOICES.YES)
  });

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.ray, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DIAGONAL_SCALING.ray}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DIAGONAL_SCALING.ray}.Hint`),
    type: Boolean,
    default: false,
    scope: "world",
    config: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.cone, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DIAGONAL_SCALING.cone}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DIAGONAL_SCALING.cone}.Hint`),
    type: Boolean,
    default: false,
    scope: "world",
    config: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.circle, {
    name: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DIAGONAL_SCALING.circle}.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.${SETTINGS.DIAGONAL_SCALING.circle}.Hint`),
    type: Boolean,
    default: false,
    scope: "world",
    config: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DIAGONAL_SCALING.rect, {
    type: Boolean,
    default: false,
    scope: "world",
    config: false
  });

  log("Done registering settings.");
}

export function debugPolygons() {
  return game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
}
