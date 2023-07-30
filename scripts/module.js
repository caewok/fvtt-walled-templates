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
import { WalledTemplateShape } from "./template_shapes/WalledTemplateShape.js";
import { WalledTemplateCircle } from "./template_shapes/WalledTemplateCircle.js";
import { WalledTemplateRectangle } from "./template_shapes/WalledTemplateRectangle.js";
import { WalledTemplateCone } from "./template_shapes/WalledTemplateCone.js";
import { WalledTemplateRay } from "./template_shapes/WalledTemplateRay.js";
import { WalledTemplateRoundedCone } from "./template_shapes/WalledTemplateRoundedCone.js";

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

  initializeWalledTemplates(game.system.id);


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
  initializeWalledTemplates(game.system.id);
  initializePatching();

  game.modules.get(MODULE_ID).api = {
    ClockwiseSweepShape,
    LightWallSweep,
    WalledTemplateShape,
    WalledTemplateCircle,
    WalledTemplateRectangle,
    WalledTemplateCone,
    WalledTemplateRay,
    WalledTemplateRoundedCone,

    PATCHER
  };

  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.retarget = {};
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refresh.propagate = ["refreshState", "refreshPosition"];
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshShape.propagate = ["refreshGrid", "refreshText"];
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate = ["retarget", "refreshShape"];

  // Tell modules that the module is set up
  Hooks.callAll(`${MODULE_ID}Ready`);
});

function initializeWalledTemplates(systemId) {
  const reg = WalledTemplateShape.shapeCodeRegister;

  // Set the defaults.
  reg.set("circle", WalledTemplateCircle);
  reg.set("rect", WalledTemplateRectangle);
  reg.set("cone", WalledTemplateCone);
  reg.set("ray", WalledTemplateRay);

  switch ( systemId ) {
    case "swade": reg.set("cone", WalledTemplateRoundedCone); break;
  }

}

Hooks.once("setup", function() {
  log("Setup...");
  registerSettings();
  registerAutotargeting();
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
          ? SETTINGS.DEFAULT_WALLS_BLOCK.CHOICES.WALLED : SETTINGS.DEFAULT_WALLS_BLOCK.CHOICES.UNWALLED));
      } else {
        promises.push(t.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, getSetting(SETTINGS.DEFAULT_WALLS_BLOCK[shape])));
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
