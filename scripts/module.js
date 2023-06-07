/* globals
canvas,
CONFIG,
flattenObject,
foundry,
game,
Hooks,
isEmpty,
MeasuredTemplate
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

/* Benchmark template construction
fn = function(t) { return t.computeSweepPolygon(); }
let [t] = canvas.templates.placeables;
await foundry.utils.benchmark(fn, 1e04, t)

*/


// Basics
import { log } from "./util.js";
import { SETTINGS, registerSettings, getSetting, toggleSetting } from "./settings.js";
import { MODULE_ID, FLAGS, LABELS } from "./const.js";

// Patches
import { registerWalledTemplates } from "./patching.js";
import { registerGeometry } from "./geometry/registration.js";

// API
import { ClockwiseSweepShape } from "./ClockwiseSweepShape.js";
import { LightWallSweep } from "./ClockwiseSweepLightWall.js";
import * as WalledTemplateClasses from "./WalledTemplate.js";

// Hooks
import { createWallHook, preUpdateWallHook, updateWallHook, deleteWallHook } from "./walls.js";
import { dnd5eUseItemHook, renderItemSheet5eHook } from "./dnd5e.js";
import { renderMeasuredTemplateConfigHook } from "./renderMeasuredTemplateConfig.js";

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

Hooks.once("init", async function() {
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
  registerWalledTemplates();

  game.modules.get(MODULE_ID).api = {
    ClockwiseSweepShape,
    LightWallSweep,
    WalledTemplateClasses
  };

  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.retarget = {};
  CONFIG.MeasuredTemplate.objectClass.RENDER_FLAGS.refreshPosition.propagate.push("retarget");
});

Hooks.once("setup", function() {
  log("Setup...");
  registerSettings();

  // If using dnd5e, hook the actor item sheet to add config options for spells.
  if (game.system.id === "dnd5e") {
    Hooks.on("renderItemSheet5e", renderItemSheet5eHook);
    Hooks.on("dnd5e.useItem", dnd5eUseItemHook);
  }
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
      if ( getSetting(SETTINGS.AUTOTARGET.ENABLED) ) {
        canvas.templates.placeables.forEach(t => t.renderFlags.set({ retarget: true }));
      }
    }
  });
});

// Note: Render hooks

/**
 * Add controls to the measured template configuration
 */
Hooks.on("renderMeasuredTemplateConfig", renderMeasuredTemplateConfigHook);


/**
 * Hook template refresh to address the retarget renderFlag.
 * Target tokens after drawing/refreshing the template.
 * See MeasuredTemplate.prototype._applyRenderFlags.
 * @param {PlaceableObject} object    The object instance being refreshed
 * @param {RenderFlags} flags
 */
Hooks.on("refreshMeasuredTemplate", refreshMeasuredTemplateHook);

function refreshMeasuredTemplateHook(template, flags) {
  if ( flags.retarget ) template.autotargetToken();
}

// Note: Wall hooks
Hooks.on("createWall", createWallHook);
Hooks.on("preUpdateWall", preUpdateWallHook);
Hooks.on("updateWall", updateWallHook);
Hooks.on("deleteWall", deleteWallHook);

/**
 * At preCreateMeasuredTemplate, attempt to get a token associated with the template.
 * Use that token's elevation.
 * If no tokens can be associated with the user, default to 0.
 * @param {string} id   User id who constructed the template
 * @returns {number}  Elevation value, in grid units.
 */
function estimateTemplateElevation(id) {
  // Try to find a token for the user
  const user = game.users.get(id);
  let token;

  // If in combat, assume it is the combatant if the user owns the combatant
  if ( !token && game.combat?.started ) {
    const c = game.combat.combatant;
    if ( (!c.players.length && user.isGM)
      || c.players.some(p => p.id === id) ) token = c.token.object;
  }

  if ( !token && canvas.tokens.active ) {
    const cToken = canvas.tokens.controlled;

    // If a single token is selected, use that.
    // If multiple tokens, use the last selected
    if ( cToken.length === 1 ) token = cToken[0];
    else token = user._lastSelected;
  } else if ( !token ) {
    // Get the last token selected by the user before the layer change
    token = user._lastDeselected;
  }

  const out = token?.document?.elevation ?? 0;
  log(`estimateTemplateElevation is ${out} for ${token?.name}`);

  return out;
}

/**
 * Hook preUpdateMeasuredTemplate to set render flag based on change to the WalledTemplate config.
 * @param {Document} document                       The existing Document which was updated
 * @param {object} change                           Differential data that was used to update the document
 * @param {DocumentModificationContext} options     Additional options which modified the update request
 * @param {string} userId                           The ID of the User who triggered the update workflow
 */
Hooks.on("updateMeasuredTemplate", updateMeasuredTemplateHook);

function updateMeasuredTemplateHook(templateD, data, _options, _userId) {
  const wtChangeFlags = [
    `flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`,
    `flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`
  ];

  const changed = new Set(Object.keys(flattenObject(data)));
  if ( wtChangeFlags.some(k => changed.has(k)) ) templateD.object.renderFlags.set({
    refreshShape: true
  });
}

/**
 * Hook preCreateMeasuredTemplate to
 * @param {MeasuredTemplateDocument} template
 * @param {Object} data
 * @param {Object} opt { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
// https://foundryvtt.wiki/en/migrations/foundry-core-0_8_x#adding-items-to-an-actor-during-precreate
Hooks.on("preCreateMeasuredTemplate", preCreateMeasuredTemplateHook);

function preCreateMeasuredTemplateHook(templateD, updateData, opts, id) {
  log("Hooking preCreateMeasuredTemplate", templateD, updateData);

  const { distance: gridDist, size: gridSize } = canvas.scene.grid;
  const { t, distance, direction, x, y } = templateD;
  const updates = {};

  // If Levels is active, defer to Levels for template elevation. Otherwise, estimate from token.
  if ( !game.modules.get("levels")?.active ) {
    const elevation = estimateTemplateElevation(id);

    // Add elevation flag. Sneakily, use the levels flag.
    updates["flags.levels.elevation"] = elevation;
  }


  // Only create if the id does not already exist
  if (typeof templateD.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    // In v10, setting the flag throws an error about not having id
    // template.setFlag(MODULE_ID, "enabled", getSetting(SETTINGS.DEFAULT_WALLED));
    updates[`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`] = getSetting(SETTINGS.DEFAULTS[t]);
  }

  if ( typeof templateD.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
    updates[`flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`] = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[t]);
  }

  if ( getSetting(SETTINGS.DIAGONAL_SCALING[t]) ) {
    if ( t === "circle" && ((distance / gridDist) >= 1) ) {
      // Switch circles to squares if applicable
      // Conforms with 5-5-5 diagonal rule.
      // Only if the template is 1 grid unit or larger.
      // See dndHelpers for original:
      // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L91
      const radiusPx = ( distance / gridDist ) * gridSize;

      // Calculate the square's hypotenuse based on the 5-5-5 diagonal distance
      const length = distance * 2;
      const squareDist = Math.hypot(length, length);

      log(`preCreateMeasuredTemplate: switching circle ${x},${y} distance ${distance} to rectangle ${x - radiusPx},${y - radiusPx} distance ${squareDist}`);

      updates.x = templateD.x - radiusPx;
      updates.y = templateD.y - radiusPx;
      updates.direction = 45;
      updates.distance = squareDist;
      updates.t = "rect";

    } else if ( t === "ray" || t === "cone" ) {
      // Extend rays or cones to conform to 5-5-5 diagonal, if applicable.
      // See dndHelpers for original:
      // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L78
      updates.distance = scaleDiagonalDistance(direction, distance);
    }
  }

  if ( !isEmpty(updates) ) templateD.updateSource(updates);
}

function scaleDiagonalDistance(direction, distance) {
  const dirRadians = Math.toRadians(direction);
  const diagonalScale = Math.abs(Math.sin(dirRadians)) + Math.abs(Math.cos(dirRadians));
  return diagonalScale * distance;
}

/**
 * Hook controlToken to track per-user control.
 * Each token is deselected prior to the layer deactivating.
 *
 * A hook event that fires when any PlaceableObject is selected or
 * deselected. Substitute the PlaceableObject name in the hook event to
 * target a specific PlaceableObject type, for example "controlToken".
 * @function controlPlaceableObject
 * @memberof hookEvents
 * @param {PlaceableObject} object The PlaceableObject
 * @param {boolean} controlled     Whether the PlaceableObject is selected or not
 */
Hooks.on("controlToken", controlTokenHook);

function controlTokenHook(object, controlled) {
  const user = game.user;

  if ( controlled ) user._lastSelected = object;
  else if ( user.lastSelected === object ) user._lastDeselected = object;
}




