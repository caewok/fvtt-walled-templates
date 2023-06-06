/* globals
Hooks,
game,
canvas,
isEmpty,
CONFIG,
CONST,
foundry
*/

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

// Rendering
import { walledTemplatesRenderMeasuredTemplateConfig, walledTemplatesRenderMeasuredTemplateElevationConfig } from "./renderMeasuredTemplateConfig.js";
import { walledTemplatesRender5eSpellTemplateConfig } from "./render5eSpellTemplateConfig.js";

// API
import { ClockwiseSweepShape } from "./ClockwiseSweepShape.js";
import { LightWallSweep } from "./ClockwiseSweepLightWall.js";
import * as WalledTemplateClasses from "./WalledTemplate.js";

// Self-executing scripts for hooks
import "./changelog.js";

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
});

Hooks.once("setup", async function() {
  log("Setup...");
  registerSettings();

  // If using dnd5e, hook the actor item sheet and add a toggle in spell details for
  // walled templates

  /**
   * renderItemSheet5e hook
   * @param {ItemSheet5e} sheet
   * @param {Object} html
   * @param {Object} data
   */
  if (game.system.id === "dnd5e") {
    Hooks.on("renderItemSheet5e", async (app, html, data) => {
      if (data.itemType === "Spell") {
        walledTemplatesRender5eSpellTemplateConfig(app, html, data);
      }
    });
  }
});


Hooks.once("ready", async function() {
  log("Ready...");

  // Check for whether children exist. See issue #18.
  if ( !canvas.templates?.objects?.children ) return;

  // Ensure every template has an enabled flag; set to world setting if missing.
  // Happens if templates were created without Walled Templates module enabled
  canvas.templates.objects.children.forEach(t => {
    const shape = t.document.t;

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined" ) {
      // Conversion from v0.4 properties to v0.5.
      const enabled = t.document.getFlag(MODULE_ID, "enabled");
      if ( typeof enabled !== "undefined" ) {
        t.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, enabled
          ? SETTINGS.DEFAULTS.CHOICES.WALLED : SETTINGS.DEFAULTS.CHOICES.UNWALLED);
      } else {
        t.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, getSetting(SETTINGS.DEFAULTS[shape]));
      }
    }

    if ( typeof t.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
      t.document.setFlag(MODULE_ID, FLAGS.WALL_RESTRICTION, getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[shape]));
    }
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
        canvas.templates.placeables.forEach(t => t.refresh({ retarget: true }));
      }
    }
  });
});

/**
 * Add controls to the measured template configuration
 */
Hooks.on("renderMeasuredTemplateConfig", async (app, html, data) => {
  walledTemplatesRenderMeasuredTemplateConfig(app, html, data);
  if ( !game.modules.get("levels")?.active ) walledTemplatesRenderMeasuredTemplateElevationConfig(app, html, data);

  const renderData = {};
  renderData.walledtemplates = {
    blockoptions: LABELS.WALLS_BLOCK,
    walloptions: LABELS.WALL_RESTRICTION
  };

  foundry.utils.mergeObject(data, renderData, { inplace: true });
});


/**
 * Redraw templates once the canvas is loaded
 * Cannot use walls to draw templates until canvas.walls.quadtree is loaded.
 */
Hooks.on("canvasReady", async canvas => {
  log("Refreshing templates on canvasReady.");
  canvas.templates.placeables.forEach(t => {
    t.renderFlags.set({
      refreshShape: true
    });
  });
});


/**
 * Hook wall creation and update to refresh templates
 * https://foundryvtt.com/api/hookEvents.html
 * updateWall
 * createWall
 * TO-DO: Only refresh templates that contain part of the wall
 */

/**
 * createWall Hook
 * @param {WallDocument} document
 * @param {Object} options { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} userId
 */
Hooks.on("createWall", async (document, options, userId) => { // eslint-disable-line no-unused-vars
  if (options.temporary) return;

  const A = document._object.A;
  const B = document._object.B;
  log(`Refreshing templates on createWall ${A.x},${A.y}|${B.x},${B.y}.`);

  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.refresh({ redraw: true }); // Async but probably don't need to await
    }
  });
});


/**
 * Hook for preUpdateWall, so the existing wall can be checked for whether it
 * interacts with the template
 * @param {WallDocument} document
 * @param {Object} change { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} options { diff: Boolean, render: Boolean }
 * @param {string} userId
 */
Hooks.on("preUpdateWall", async (document, change, options, userId) => { // eslint-disable-line no-unused-vars
  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };

  // Issue #19: Door open/close passes a change.ds but not a change.c
  const new_A = change.c ? { x: change.c[0], y: change.c[1] } : A;
  const new_B = change.c ? { x: change.c[2], y: change.c[3] } : B;
  log(`Refreshing templates on preUpdateWall ${A.x},${A.y}|${B.x},${B.y} --> ${new_A.x},${new_A.y}|${new_B.x},${new_B.y}`, document, change, options, userId);

  // We want to update the template if this wall is within the template, but
  // hold until updateWall is called.
  const promises = [];
  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      promises.push(t.document.setFlag(MODULE_ID, "redraw", true)); // Async
    }
  });
  promises.length && ( await Promise.all(promises) ); // eslint-disable-line no-unused-expressions

  return true;
});

/**
 * Hook for updateWall, so the existing wall can be checked for whether it
 * interacts with the template
 * @param {WallDocument} document
 * @param {Object} change { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} options { diff: Boolean, render: Boolean }
 * @param {string} userId
 */
Hooks.on("updateWall", async (document, change, options, userId) => { // eslint-disable-line no-unused-vars
  if (!options.diff) return;

  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };
  log(`Refreshing templates on updateWall ${A.x},${A.y}|${B.x},${B.y}`, document, change, options, userId);

  canvas.templates.placeables.forEach(t => {
    if ( t.document.getFlag(MODULE_ID, "redraw") ) {
      t.document.setFlag(MODULE_ID, "redraw", false);
      t.refresh({ redraw: true }); // Async but probably don't need to await
      return;
    }
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.refresh({ redraw: true }); // Async but probably don't need to await
    }
  });
});

/**
 * Hook for updateWall.
 * @param {WallDocument} document
 * @param {Object} change { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} options { diff: Boolean, render: Boolean }
 * @param {string} userId
 */
// Hooks.on("updateWall", async (document, change, options, userId) => { // eslint-disable-line no-unused-vars
//   if (!options.diff) return;
//
//   const A = { x: document.c[0], y: document.c[1] };
//   const B = { x: document.c[2], y: document.c[3] };
//   const new_A = { x: change.c[0], y: change.c[1] };
//   const new_B = { x: change.c[2], y: change.c[3] };
//   log(`Refreshing templates on updateWall ${A.x},${A.y}|${B.x},${B.y} --> ${new_A.x},${new_A.y}|${new_B.x},${new_B.y}`, document, change, options, userId);
//
//   canvas.templates.placeables.forEach(t => {
//     const bbox = t.shape.getBounds().translate(t.data.x, t.data.y);
//     if ( bbox.lineSegmentIntersects(A, B, { inside: true })
//       || bbox.lineSegmentIntersects(new_A, new_B, { inside: true })) {
//       log(`Wall ${document.id} intersects ${t.id}`);
//       t.refresh({ redraw: true }); // Async but probably don't need to await
//     }
//   });
// });

/**
 * Hook for deleteWall.
 * @param {WallDocument} document
 * @param {Object} options { render: Boolean }
 * @param {string} userId
 */
Hooks.on("deleteWall", async (document, options, userId) => { // eslint-disable-line no-unused-vars

  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };
  log(`Refreshing templates on deleteWall ${A.x},${A.y}|${B.x},${B.y}.`);

  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.refresh({ redraw: true }); // Async but probably don't need to await
    }
  });
});


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
    // console.log(`${cToken.map(t => t.name)} controlled by ${id} or ${game.user.id}`);

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
  // console.log(`controlTokenHook for user ${game.userId} with ${object.name} controlled: ${controlled}`);
  const user = game.user;

  if ( controlled ) user._lastSelected = object;
  else if ( user.lastSelected === object ) user._lastDeselected = object;
}

Hooks.on("dnd5e.useItem", dnd5eUseItemHook);

/**
 * Hook dnd template creation from item, so item flags regarding the template can be added.
 */
function dnd5eUseItemHook(item, config, options, templates) { // eslint-disable-line no-unused-vars
  log("dnd5e.useItem hook", item);
  if ( !templates || !item ) return;

  // Add item flags to the template(s)
  for ( const template of templates ) {
    const shape = template.t;
    let wallsBlock = item.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK);
    let wallRestriction = item.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION);
    if ( !wallsBlock || wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = getSetting(SETTINGS.DEFAULTS[shape]);
    if ( !wallRestriction || wallRestriction === LABELS.GLOBAL_DEFAULT ) wallRestriction = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[shape]);

    template.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, wallsBlock);
    template.setFlag(MODULE_ID, FLAGS.WALL_RESTRICTION, wallRestriction);
  }
}
