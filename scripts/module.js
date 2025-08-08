/* globals
canvas,
CONFIG,
fromUuidSync,
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
import { MODULE_ID, FLAGS, TEMPLATES } from "./const.js";

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
import { WalledTemplateSquare } from "./template_shapes/WalledTemplateSquare.js";
import { WalledTemplateRotatedSquare } from "./template_shapes/WalledTemplateRotatedSquare.js";

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
  registerGeometry();

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
    autotargetStatusesToIgnore: new Set(["dead"]),

    /**
     * Which version of Clipper to use.
     * @type{CONFIG.GeometryLib.ClipperPaths|CONFIG.GeometryLib.Clipper2Paths}
     */
    ClipperPaths: CONFIG.GeometryLib.ClipperPaths,
  };

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
    WalledTemplateRotatedSquare,

    PATCHER,

    Settings
  };

  // Add render flags to help with autotargeting and elevation of the template.
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshTargets = {};
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate.push("refreshTargets");
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate.push("refreshShape");

  // Tell modules that the module is set up
  Hooks.callAll(`${MODULE_ID}Ready`);

  // Must go later
  const promises = [];
  for ( const template of Object.values(TEMPLATES) ) promises.push(foundry.applications.handlebars.getTemplate(template)); // Async but not awaiting here.
  Promise.allSettled(promises);
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
});


Hooks.once("ready", function() {
  log("Ready...");

  // Check for whether children exist. See issue #18.
  if ( !canvas.templates?.objects?.children ) return;

  // Ensure autotargeting is registered on setup.
  registerAutotargeting();

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

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.SNAPPING.CENTER) === "undefined" ) {
      promises.push(t.document.setFlag(
        MODULE_ID,
        FLAGS.SNAPPING.CENTER,
        Settings.get(KEYS.DEFAULT_SNAPPING[shape].CENTER)));
    }

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.SNAPPING.CORNER) === "undefined" ) {
      promises.push(t.document.setFlag(
        MODULE_ID,
        FLAGS.SNAPPING.CORNER,
        Settings.get(KEYS.DEFAULT_SNAPPING[shape].CORNER)));
    }

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.SNAPPING.SIDE_MIDPOINT) === "undefined" ) {
      promises.push(t.document.setFlag(
        MODULE_ID,
        FLAGS.SNAPPING.SIDE_MIDPOINT,
        Settings.get(KEYS.DEFAULT_SNAPPING[shape].SIDE_MIDPOINT)));
    }
  }
  if ( promises.length ) Promise.all(promises);

  log("Refreshing templates on ready hook.");
  // Redraw templates once the canvas is loaded
  // Cannot use walls to draw templates until canvas.walls.quadtree is loaded.
//   canvas.templates.placeables.forEach(t => {
//     t.renderFlags.set({
//       refreshShape: true
//     });
//   });

});

/**
 * Add an autotarget button to the measured template tools.
 */
Hooks.on("getSceneControlButtons", controls => {
  const control = controls.templates;
  const AUTOTARGET = Settings.KEYS.AUTOTARGET;
  const opt = Settings.get(AUTOTARGET.MENU);
  const autotargetTool = {
    icon: "fas fa-crosshairs",
    name: "autotarget",
    order: control.tools.clear.order,
    title: game.i18n.localize("walledtemplates.controls.autotarget.Title"),
    toggle: true,
    visible: opt === AUTOTARGET.CHOICES.TOGGLE,
    active: Settings.get(AUTOTARGET.ENABLED),
    onClick: toggle => { // eslint-disable-line no-unused-vars
      Settings.toggle(AUTOTARGET.ENABLED);
      canvas.templates.placeables.forEach(t => t.renderFlags.set({ refreshTargets: true }));
    }
  };

  // Increment every tool after the autotarget in the order.
  Object.values(control.tools).forEach(tool => { if ( tool.order >= autotargetTool.order ) tool.order += 1; });
  control.tools.autotarget = autotargetTool;
});

/**
 * When loading a new scene, check if any version updates are required.
 */
Hooks.on("canvasReady", function(canvas) {
  // Migrate attached templates to new version.
  if ( !canvas.scene.getFlag(MODULE_ID, FLAGS.VERSION) ) {
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
    Promise.allSettled(promises).then(() => canvas.scene.setFlag(MODULE_ID, FLAGS.VERSION, game.modules.get(MODULE_ID).version));
  }

  // token.hitArea not defined as of `canvasReady`. So trigger on later hook.
  Hooks.once("visibilityRefresh", () => {
    log("Refreshing autotargeting.");
    Settings.refreshAutotargeting();
  });
});
