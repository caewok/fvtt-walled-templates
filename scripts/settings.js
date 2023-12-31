/* globals
canvas,
CONST,
game,
ui
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, SHAPE_KEYS } from "./const.js";
import { registerAutotargeting } from "./patching.js";
import { WalledTemplateShapeSettings } from "./WalledTemplateShapeSettings.js";
import { ModuleSettingsAbstract } from "./ModuleSettingsAbstract.js";

const KEYBINDINGS = {
  AUTOTARGET: "autoTarget"
};

export const SETTINGS = {
  DEFAULT_WALLS_BLOCK: {},
  DEFAULT_WALL_RESTRICTION: {},
  DIAGONAL_SCALING: {},
  AUTOTARGET: {},
  HIDE: {
    BORDER: "hideBorder",
    HIGHLIGHTING: "hideHighlighting"
  },
  SNAP_GRID: "snapGrid",
  CHANGELOG: "changelog"
};

SETTINGS.AUTOTARGET = {
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
};

SETTINGS.DEFAULT_WALLS_BLOCK.CHOICES = {
  UNWALLED: "unwalled",
  WALLED: "walled",
  RECURSE: "recurse"
};

SETTINGS.DEFAULT_WALL_RESTRICTION.CHOICES = {
  LIGHT: "light",
  MOVE: "move",
  SIGHT: "sight",
  SOUND: "sound"
};

for ( const shapeKey of SHAPE_KEYS ) {
  SETTINGS.DEFAULT_WALLS_BLOCK[shapeKey] = `default_${shapeKey}`;
  SETTINGS.DEFAULT_WALL_RESTRICTION[shapeKey] = `default-${shapeKey}-wall-restriction`;
  SETTINGS.DIAGONAL_SCALING[shapeKey] = `diagonal-scaling-${shapeKey}`;

  // Override highlighting/autotarget for specific shapes.
  SETTINGS.AUTOTARGET[shapeKey] = {};
  SETTINGS.AUTOTARGET[shapeKey].OVERRIDE = `autotarget-override-${shapeKey}`;
  SETTINGS.AUTOTARGET[shapeKey].METHOD = `autotarget-method-${shapeKey}`;
  SETTINGS.AUTOTARGET[shapeKey].AREA = `autotarget-area-${shapeKey}`;
}

export class Settings extends ModuleSettingsAbstract {
  /** @type {object} */
  static KEYS = SETTINGS;

  /**
   * Retrieve autotarget area for the given shape, taking into account override settings.
   * @param {string} [shape]    If not provided, default for all shapes will be provided.
   * @returns {number}
   */
  static autotargetArea(shape) { return this.#getShapeAutotarget("AREA", shape); }

  /**
   * Retrieve autotarget method for the given shape, taking into account override settings.
   * @param {string} [shape]    If not provided, default for all shapes will be provided.
   * @returns {SETTINGS.AUTOTARGET.METHODS}
   */
  static autotargetMethod(shape) { return this.#getShapeAutotarget("METHOD", shape); }

  /**
   * Helper to retrieve the shape override.
   * @param {"METHOD"|"AREA"} keyName
   * @param {string} [shape]    If not provided, default for all shapes will be provided.
   * @returns {SETTINGS.AUTOTARGET.METHODS}
   */
  static #getShapeAutotarget(keyName, shape) {
    const shapeSettings = this.KEYS.AUTOTARGET[shape];
    if ( !shapeSettings || !this.get(shapeSettings.OVERRIDE) ) return this.get(this.KEYS.AUTOTARGET[keyName]);
    return this.get(shapeSettings[keyName]);
  }

  static registerAll() {
    const { KEYS, register, registerMenu, localize } = this;

    registerMenu("menu", {
      name: "Walled Templates Settings Menu",
      label: localize("submenu.title"),
      icon: "fas fa-cog",
      type: WalledTemplateShapeSettings,
      restricted: true
    });

    register(KEYS.AUTOTARGET.ENABLED, {
      name: "Enable autotargeting",
      config: false,
      scope: "client",
      type: Boolean,
      default: false
    });

    const CHOICES = KEYS.AUTOTARGET.CHOICES;
    register(KEYS.AUTOTARGET.MENU, {
      name: localize(`${KEYS.AUTOTARGET.MENU}.Name`),
      hint: localize(`${KEYS.AUTOTARGET.MENU}.Hint`),
      scope: "client",
      config: true,
      type: String,
      choices: {
        [KEYS.AUTOTARGET.CHOICES.NO]: localize(`${KEYS.AUTOTARGET.MENU}.Choice.${CHOICES.NO}`),
        [KEYS.AUTOTARGET.CHOICES.TOGGLE_OFF]: localize(`${KEYS.AUTOTARGET.MENU}.Choice.${CHOICES.TOGGLE_OFF}`),
        [KEYS.AUTOTARGET.CHOICES.TOGGLE_ON]: localize(`${KEYS.AUTOTARGET.MENU}.Choice.${CHOICES.TOGGLE_ON}`),
        [KEYS.AUTOTARGET.CHOICES.YES]: localize(`${KEYS.AUTOTARGET.MENU}.Choice.${CHOICES.YES}`)
      },
      default: KEYS.AUTOTARGET.CHOICES.TOGGLE_OFF,
      onChange: value => {
        const enabled = value === KEYS.AUTOTARGET.CHOICES.TOGGLE_ON
        || value === KEYS.AUTOTARGET.CHOICES.YES;
        Settings.set(KEYS.AUTOTARGET.ENABLED, enabled);
        Settings.cache.delete(KEYS.AUTOTARGET.MENU); // Cache not reset yet; must do it manually b/c registerAutotargeting hits the cache.
        registerAutotargeting();
      }
    });

    const METHODS = KEYS.AUTOTARGET.METHODS;
    register(KEYS.AUTOTARGET.METHOD, {
      name: localize(`${KEYS.AUTOTARGET.METHOD}.Name`),
      hint: localize(`${KEYS.AUTOTARGET.METHOD}.Hint`),
      scope: "world",
      config: true,
      default: "center",
      type: String,
      choices: {
        [KEYS.AUTOTARGET.METHODS.CENTER]: localize(`${KEYS.AUTOTARGET.METHOD}.Method.${METHODS.CENTER}`),
        [KEYS.AUTOTARGET.METHODS.OVERLAP]: localize(`${KEYS.AUTOTARGET.METHOD}.Method.${METHODS.OVERLAP}`)
      }
    }); // See class TokenLayer.targetObjects

    register(KEYS.AUTOTARGET.AREA, {
      name: localize(`${KEYS.AUTOTARGET.AREA}.Name`),
      hint: localize(`${KEYS.AUTOTARGET.AREA}.Hint`),
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

    register(KEYS.HIDE.BORDER, {
      name: localize(`${KEYS.HIDE.BORDER}.Name`),
      hint: localize(`${KEYS.HIDE.BORDER}.Hint`),
      type: Boolean,
      default: false,
      scope: "world",
      config: true,
      onChange: _value => canvas.templates.placeables.forEach(t => t.renderFlags.set({ refreshTemplate: true }))
    });

    register(KEYS.HIDE.HIGHLIGHTING, {
      name: localize(`${KEYS.HIDE.HIGHLIGHTING}.Name`),
      hint: localize(`${KEYS.HIDE.HIGHLIGHTING}.Hint`),
      type: Boolean,
      default: false,
      scope: "world",
      config: true,
      onChange: _value => canvas.templates.placeables.forEach(t => t.renderFlags.set({ refreshGrid: true }))
    });

    register(KEYS.SNAP_GRID, {
      name: localize(`${KEYS.SNAP_GRID}.Name`),
      hint: localize(`${KEYS.SNAP_GRID}.Hint`),
      type: Boolean,
      default: false,
      scope: "world",
      config: true
    });

    // ----- NOTE: Submenu ---- //

    for ( const shape of SHAPE_KEYS ) {
      register(KEYS.DEFAULT_WALLS_BLOCK[shape], {
        name: localize(`${KEYS.DEFAULT_WALLS_BLOCK[shape]}.Name`),
        hint: localize(`${KEYS.DEFAULT_WALLS_BLOCK[shape]}.Hint`),
        scope: "world",
        config: false,
        tab: shape,
        default: KEYS.DEFAULT_WALLS_BLOCK.CHOICES.UNWALLED,
        type: String,
        choices: {
          [KEYS.DEFAULT_WALLS_BLOCK.CHOICES.UNWALLED]: localize(`${KEYS.DEFAULT_WALLS_BLOCK.CHOICES.UNWALLED}`),
          [KEYS.DEFAULT_WALLS_BLOCK.CHOICES.WALLED]: localize(`${KEYS.DEFAULT_WALLS_BLOCK.CHOICES.WALLED}`),
          [KEYS.DEFAULT_WALLS_BLOCK.CHOICES.RECURSE]: localize(`${KEYS.DEFAULT_WALLS_BLOCK.CHOICES.RECURSE}`)
        }
      });

      register(KEYS.DEFAULT_WALL_RESTRICTION[shape], {
        name: localize(`${KEYS.DEFAULT_WALL_RESTRICTION[shape]}.Name`),
        hint: localize(`${KEYS.DEFAULT_WALL_RESTRICTION[shape]}.Hint`),
        scope: "world",
        config: false,
        tab: shape,
        default: KEYS.DEFAULT_WALL_RESTRICTION.CHOICES.MOVE,
        type: String,
        choices: {
          // Use the default Foundry en.json WALLS version
          [KEYS.DEFAULT_WALL_RESTRICTION.CHOICES.LIGHT]: game.i18n.localize("WALLS.Light"),
          [KEYS.DEFAULT_WALL_RESTRICTION.CHOICES.MOVE]: game.i18n.localize("WALLS.Movement"),
          [KEYS.DEFAULT_WALL_RESTRICTION.CHOICES.SIGHT]: game.i18n.localize("WALLS.Sight"),
          [KEYS.DEFAULT_WALL_RESTRICTION.CHOICES.SOUND]: game.i18n.localize("WALLS.Sound")
        }
      });

      if ( shape !== "rect" ) {
        register(KEYS.DIAGONAL_SCALING[shape], {
          name: localize(`${KEYS.DIAGONAL_SCALING[shape]}.Name`),
          hint: localize(`${KEYS.DIAGONAL_SCALING[shape]}.Hint`),
          type: Boolean,
          default: false,
          scope: "world",
          config: false,
          tab: shape
        });
      }

      // ----- Overide the highlight/autotarget settings for this shape.
      register(KEYS.AUTOTARGET[shape].OVERRIDE, {
        name: localize(`submenu.autotarget-override.Name`),
        hint: localize(`submenu.autotarget-override.Hint`),
        type: Boolean,
        default: false,
        scope: "world",
        config: false,
        tab: shape,
        horizontalDivider: true
      });

      register(KEYS.AUTOTARGET[shape].METHOD, {
        name: localize(`${KEYS.AUTOTARGET.METHOD}.Name`),
        hint: localize(`${KEYS.AUTOTARGET.METHOD}.Hint`),
        scope: "world",
        config: false,
        tab: shape,
        default: "center",
        type: String,
        choices: {
          [KEYS.AUTOTARGET.METHODS.CENTER]: localize(`${KEYS.AUTOTARGET.METHOD}.Method.${METHODS.CENTER}`),
          [KEYS.AUTOTARGET.METHODS.OVERLAP]: localize(`${KEYS.AUTOTARGET.METHOD}.Method.${METHODS.OVERLAP}`)
        }
      });

      register(KEYS.AUTOTARGET[shape].AREA, {
        name: localize(`${KEYS.AUTOTARGET.AREA}.Name`),
        hint: localize(`${KEYS.AUTOTARGET.AREA}.Hint`),
        range: {
          max: 1,
          min: 0,
          step: 0.01
        },
        type: Number,
        default: 0,
        scope: "world",
        config: false,
        tab: shape
      });
    }
  }

  static registerKeybindings() {
    game.keybindings.register(MODULE_ID, KEYBINDINGS.AUTOTARGET, {
      name: game.i18n.localize(`${MODULE_ID}.keybindings.${KEYBINDINGS.AUTOTARGET}.name`),
      hint: game.i18n.localize(`${MODULE_ID}.keybindings.${KEYBINDINGS.AUTOTARGET}.hint`),
      editable: [
        { key: "KeyT",
          modifiers: ["Alt"]
        }
      ],
      onDown: () => this.toggleAutotarget(),
      precedence: CONST.KEYBINDING_PRECEDENCE.DEFERRED,
      restricted: false
    });
  }

  static async toggleAutotarget() {
    if ( !(canvas.tokens?.active || canvas.templates?.active) ) return;
    const AUTOTARGET = this.KEYS.AUTOTARGET;
    const autotargetType = this.get(AUTOTARGET.MENU);
    if ( !(autotargetType === AUTOTARGET.CHOICES.TOGGLE_OFF
        || autotargetType === AUTOTARGET.CHOICES.TOGGLE_ON) ) return;
    await this.toggle(AUTOTARGET.ENABLED);
    canvas.templates.placeables.forEach(t => t.renderFlags.set({ retarget: true }));

    // Redraw the toggle button.
    if ( canvas.templates.active
      && ui.controls ) ui.controls.initialize({layer: canvas.templates.constructor.layerOptions.name});
  }

}

export function debugPolygons() {
  return game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
}

