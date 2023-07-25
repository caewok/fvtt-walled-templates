/* globals
canvas,
CONFIG,
game,
Hooks
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

/* Benchmark template construction
api = game.modules.get("walledtemplates").api
WalledTemplate = api.WalledTemplateClasses.WalledTemplate
fn = function(t) {
  wt = WalledTemplate.fromMeasuredTemplate(t)
  return wt.computeSweep();
}
let [t] = canvas.templates.placeables;
await foundry.utils.benchmark(fn, 1e04, t)
*/

// Basics
import { log } from "./util.js";
import { SETTINGS, registerSettings, getSetting, toggleSetting } from "./settings.js";
import { MODULE_ID, FLAGS } from "./const.js";

// Patches
import { initializePatching, registerAutotargeting, PATCHER } from "./patching.js";
import { registerGeometry } from "./geometry/registration.js";

// API
import { ClockwiseSweepShape } from "./ClockwiseSweepShape.js";
import { LightWallSweep } from "./ClockwiseSweepLightWall.js";
import * as WalledTemplateClasses from "./WalledTemplate.js";

// Self-executing scripts for hooks
import "./changelog.js";

// Note: Basic system hooks

/**
 * Tell DevMode that we want a flag for debugging this module.
 * https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
 */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

Hooks.once("init", function() {
  log("Initializing...");

  // Set CONFIGS used by this module.
  CONFIG[MODULE_ID] = {
    /**
     * Number of recursions for each template type when using spread or reflect.
     * (circle|rect: spread; ray|cone: reflect)
     * @type { object: number }
     */
    recursions: {
      circle: 4,
      rect: 4,
      ray: 8,
      cone: 4
    },

    /**
     * Pixels away from the corner to place child templates when spreading.
     * (Placing directly on the corner will cause the LOS sweep to fail to round the corner.)
     * @type {number}
     */
    cornerSpacer: 10
  };

  registerGeometry();
  initializePatching();

  game.modules.get(MODULE_ID).api = {
    ClockwiseSweepShape,
    LightWallSweep,
    WalledTemplateClasses,

    PATCHER
  };

  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.retarget = {};
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate.push("retarget");
});

Hooks.once("setup", function() {
  log("Setup...");
  registerSettings();
  registerAutotargeting();

//   // If using dnd5e, hook the actor item sheet to add config options for spells.
//   if (game.system.id === "dnd5e") {
//     Hooks.on("renderItemSheet5e", renderItemSheet5eHook);
//     Hooks.on("dnd5e.useItem", dnd5eUseItemHook);
//   }
});


Hooks.once("ready", async function() {
  log("Ready...");

  // Check for whether children exist. See issue #18.
  if ( !canvas.templates?.objects?.children ) return;

  // Ensure every template has an enabled flag; set to world setting if missing.
  // Happens if templates were created without Walled Templates module enabled

  // Hold all promises so we can await at the end.
  const promises = [];
  for ( const t of canvas.templates.objects.children ) {
    const shape = t.document.t;

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined" ) {
      // Conversion from v0.4 properties to v0.5.
      const enabled = t.document.getFlag(MODULE_ID, "enabled");
      if ( typeof enabled !== "undefined" ) {
        promises.push(t.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, enabled
          ? SETTINGS.DEFAULTS.CHOICES.WALLED : SETTINGS.DEFAULTS.CHOICES.UNWALLED));
      } else {
        promises.push(t.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, getSetting(SETTINGS.DEFAULTS[shape])));
      }
    }

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
      promises.push(t.document.setFlag(
        MODULE_ID,
        FLAGS.WALL_RESTRICTION,
        getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[shape])));
    }
  }
  if ( promises.length ) await Promise.all(promises);

  log("Refreshing templates on ready hook.");
  // Redraw templates once the canvas is loaded
  // Cannot use walls to draw templates until canvas.walls.quadtree is loaded.
  canvas.templates.placeables.forEach(t => {
    t.renderFlags.set({
      refreshShape: true
    });
  });
});

Hooks.on("getSceneControlButtons", controls => {
  const control = controls.find(x => x.name === "measure");
  const opt = getSetting(SETTINGS.AUTOTARGET.MENU);
  control.tools.splice(4, 0, {
    icon: "fas fa-crosshairs",
    name: "autotarget",
    title: game.i18n.localize("walledtemplates.controls.autotarget.Title"),
    toggle: true,
    visible: opt === SETTINGS.AUTOTARGET.CHOICES.TOGGLE_OFF || opt === SETTINGS.AUTOTARGET.CHOICES.TOGGLE_ON,
    active: getSetting(SETTINGS.AUTOTARGET.ENABLED),
    onClick: toggle => { // eslint-disable-line no-unused-vars
      toggleSetting(SETTINGS.AUTOTARGET.ENABLED);
      canvas.templates.placeables.forEach(t => t.renderFlags.set({ retarget: true }));
    }
  });
});
