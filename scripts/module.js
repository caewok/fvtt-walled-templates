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
import { Settings } from "./settings.js";
import { MODULE_ID, FLAGS } from "./const.js";

// Patches
import { initializePatching, registerAutotargeting, PATCHER } from "./patching.js";
import { registerGeometry } from "./geometry/registration.js";

// API
import { ClockwiseSweepShape } from "./ClockwiseSweepShape.js";
import { LightWallSweep } from "./ClockwiseSweepLightWall.js";
import { WalledTemplateShape } from "./template_shapes/WalledTemplateShape.js";
import { WalledTemplateCircle, extendCornerFromWalls } from "./template_shapes/WalledTemplateCircle.js";
import { WalledTemplateRectangle } from "./template_shapes/WalledTemplateRectangle.js";
import { WalledTemplateCone } from "./template_shapes/WalledTemplateCone.js";
import { WalledTemplateRay } from "./template_shapes/WalledTemplateRay.js";
import { WalledTemplateRoundedCone } from "./template_shapes/WalledTemplateRoundedCone.js";
import { WalledTemplateSquare } from "./template_shapes/WalledTemplateSquare.js";

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
     * Enable debug logging.
     */
    debug: false,

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
    cornerSpacer: 10,

    /**
     * For autotarget, do not target tokens with these statuses.
     * Use the id of the status in the set.
     */
    autotargetStatusesToIgnore: new Set(["dead"])
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
    WalledTemplateSquare,

    extendCornerFromWalls,

    PATCHER,

    Settings
  };

  // Add render flags to help with autotargeting and elevation of the template.
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.retarget = {};
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate = ["retarget", "refreshShape"];

  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshElevation = { propagate: ["retarget", "refreshShape"]};
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate = ["retarget", "refreshShape", "refreshElevation"];


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
  Settings.registerAll();
  Settings.toggleAutotarget();
  Settings.registerKeybindings();

  const reg = WalledTemplateShape.shapeCodeRegister;
  if ( Settings.get(Settings.KEYS.DIAGONAL_SCALING.circle) ) reg.set("circle", WalledTemplateSquare);
});


Hooks.once("ready", async function() {
  log("Ready...");

  // Check for whether children exist. See issue #18.
  if ( !canvas.templates?.objects?.children ) return;

  // Ensure every template has an enabled flag; set to world setting if missing.
  // Happens if templates were created without Walled Templates module enabled

  // Hold all promises so we can await at the end.
  const KEYS = Settings.KEYS;
  const promises = [];
  for ( const t of canvas.templates.objects.children ) {
    const shape = t.document.t;

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined" ) {
      // Conversion from v0.4 properties to v0.5.
      const enabled = t.document.getFlag(MODULE_ID, "enabled");
      if ( typeof enabled !== "undefined" ) {
        promises.push(t.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, enabled
          ? KEYS.DEFAULT_WALLS_BLOCK.CHOICES.WALLED : KEYS.DEFAULT_WALLS_BLOCK.CHOICES.UNWALLED));
      } else {
        promises.push(t.document.setFlag(
          MODULE_ID,
          FLAGS.WALLS_BLOCK,
          Settings.get(KEYS.DEFAULT_WALLS_BLOCK[shape])));
      }
    }

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
      promises.push(t.document.setFlag(
        MODULE_ID,
        FLAGS.WALL_RESTRICTION,
        Settings.get(KEYS.DEFAULT_WALL_RESTRICTION[shape])));
    }
  }
  if ( promises.length ) await Promise.all(promises);

  // Ensure autotargeting is registered on setup.
  registerAutotargeting();

  log("Refreshing templates on ready hook.");
  // Redraw templates once the canvas is loaded
  // Cannot use walls to draw templates until canvas.walls.quadtree is loaded.
  canvas.templates.placeables.forEach(t => {
    t.renderFlags.set({
      refreshShape: true
    });
  });

  log("Refreshing autotargeting.");
  Settings.refreshAutotargeting();

});

Hooks.on("getSceneControlButtons", controls => {
  const control = controls.find(x => x.name === "measure");
  const AUTOTARGET = Settings.KEYS.AUTOTARGET;
  const opt = Settings.get(AUTOTARGET.MENU);
  control.tools.splice(4, 0, {
    icon: "fas fa-crosshairs",
    name: "autotarget",
    title: game.i18n.localize("walledtemplates.controls.autotarget.Title"),
    toggle: true,
    visible: opt === AUTOTARGET.CHOICES.TOGGLE,
    active: Settings.get(AUTOTARGET.ENABLED),
    onClick: toggle => { // eslint-disable-line no-unused-vars
      Settings.toggle(AUTOTARGET.ENABLED);
      canvas.templates.placeables.forEach(t => t.renderFlags.set({ retarget: true }));
    }
  });
});

/**
 * When loading a new scene, check if any version updates are required.
 */
Hooks.on("canvasReady", async function(canvas) {
  // Migrate attached templates to new version.
  const sceneVersion = canvas.scene.getFlag(MODULE_ID, FLAGS.VERSION);
  if ( !sceneVersion ) {
    // For every token, check the actor effect origin for attached templates.
    // Add flag for attached template.
    const promises = [];
    for ( const token of canvas.tokens.placeables ) {
      for ( const effect of token.actor.effects ) {
        if ( !effect.origin?.includes("MeasuredTemplate") ) continue;
        const attachedTemplate = fromUuidSync(effect.origin)?.object;
        if ( !attachedTemplate ) continue;
        promises.push(effect.setFlag(MODULE_ID, FLAGS.ATTACHED_TEMPLATE_ID, attachedTemplate.id));
      }
    }
    await Promise.allSettled(promises);
    await canvas.scene.setFlag(MODULE_ID, FLAGS.VERSION, game.modules.get(MODULE_ID).version);
  }
});
