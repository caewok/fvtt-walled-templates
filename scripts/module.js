/* globals
Hooks,
game,
canvas
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
import { MODULE_ID } from "./const.js";

// Rendering and main methods
import { registerWalledTemplates } from "./patching.js";
import { walledTemplatesRenderMeasuredTemplateConfig } from "./renderMeasuredTemplateConfig.js";
import { walledTemplatesRender5eSpellTemplateConfig } from "./render5eSpellTemplateConfig.js";

// Shapes and shape methods
import { RegularPolygon } from "./shapes/RegularPolygon.js";
import { Square } from "./shapes/Square.js";
import { Hexagon } from "./shapes/Hexagon.js";

import * as getShape from "./getShape.js";

import { registerPIXICircleMethods } from "./shapes/PIXICircle.js";
import { registerPIXIPolygonMethods } from "./shapes/PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./shapes/PIXIRectangle.js";

// Weiler Atherton clipping
import { WeilerAthertonClipper } from "./WeilerAtherton.js";

/**
 * Tell DevMode that we want a flag for debugging this module.
 * https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
 */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

Hooks.once("init", async function() {
  log("Initializing...");

  if ( !game.modules.get("lightmask")?.active ) {
    // LightMask shares these methods
    registerPIXIPolygonMethods();
    registerPIXIRectangleMethods();
    registerPIXICircleMethods();
  }

  registerWalledTemplates();

  game.modules.get(MODULE_ID).api = {
    getShape,
    shapes: {
     RegularPolygon,
     Square,
     Hexagon
    },
    WeilerAthertonClipper
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

  // Ensure every template has an enabled flag; set to world setting if missing.
  // Happens if templates were created without Walled Templates module enabled
  canvas.templates.objects.children.forEach(t => {
    if ( typeof t.document.getFlag(MODULE_ID, "enabled") === "undefined" ) {
      t.document.setFlag(MODULE_ID, "enabled", getSetting("default-to-walled"));
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
});


/**
 * Redraw templates once the canvas is loaded
 * Cannot use walls to draw templates until canvas.walls.quadtree is loaded.
 */
Hooks.on("canvasReady", async canvas => {
  log("Refreshing templates on canvasReady.");
  canvas.templates.placeables.forEach(t => {
    t.draw();
    t.refresh({redraw: true}); // Async but probably don't need to await
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
  const new_A = { x: change.c[0], y: change.c[1] };
  const new_B = { x: change.c[2], y: change.c[3] };
  log(`Refreshing templates on preUpdateWall ${A.x},${A.y}|${B.x},${B.y} --> ${new_A.x},${new_A.y}|${new_B.x},${new_B.y}`, document, change, options, userId);

  // We want to update the template if this wall is within the template, but
  // hold until updateWall is called.
  const promises = [];
  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      promises.push(t.setFlag(MODULE_ID, "redraw", true)); // Async
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
    if ( t.getFlag(MODULE_ID, "redraw") ) {
      t.setFlag(MODULE_ID, "redraw", false);
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
Hooks.on("updateWall", async (document, change, options, userId) => { // eslint-disable-line no-unused-vars
  if (!options.diff) return;

  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };
  const new_A = { x: change.c[0], y: change.c[1] };
  const new_B = { x: change.c[2], y: change.c[3] };
  log(`Refreshing templates on updateWall ${A.x},${A.y}|${B.x},${B.y} --> ${new_A.x},${new_A.y}|${new_B.x},${new_B.y}`, document, change, options, userId);

  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.data.x, t.data.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true })
      || bbox.lineSegmentIntersects(new_A, new_B, { inside: true })) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.refresh({ redraw: true }); // Async but probably don't need to await
    }
  });
});

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
 * Hook preCreateMeasuredTemplate to
 * @param {MeasuredTemplateDocument} template
 * @param {Object} data
 * @param {Object} opt { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
// https://foundryvtt.wiki/en/migrations/foundry-core-0_8_x#adding-items-to-an-actor-during-precreate
Hooks.on("preCreateMeasuredTemplate", async (templateD, updateData, opts, id) => {
  log("Hooking preCreateMeasuredTemplate", templateD, updateData);

  const updates = {};

  // Only create if the id does not already exist
  if (typeof templateD.getFlag(MODULE_ID, "enabled") === "undefined") {
    log(`Creating template ${id} with default setting ${getSetting(SETTINGS.DEFAULT_WALLED)}.`, templateD, updateData);

    // In v10, setting the flag throws an error about not having id
//     template.setFlag(MODULE_ID, "enabled", getSetting(SETTINGS.DEFAULT_WALLED));

    updates[`flags.${MODULE_ID}.enabled`] = `${getSetting(SETTINGS.DEFAULT_WALLED)}`

//     templateD.updateSource({[`flags.${MODULE_ID}.enabled`]: `${getSetting(SETTINGS.DEFAULT_WALLED)}`});

  } else {
    log(`preCreateMeasuredTemplate: template enabled flag already set to ${templateD.getFlag(MODULE_ID, "enabled")}`);
  }

  // Switch circles to squares if applicable
  // Conforms with 5-5-5 diagonal rule.
  // Only if the template is 1 grid unit or larger.
  // See dndHelpers for original:
  // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L91
  if ( getSetting(SETTINGS.DIAGONAL_SCALING.CIRCLE) ) {
    const { distance: gridDist, size: gridSize } = canvas.scene.grid;
    const t = updateData.t ?? templateD.t;
    const templateDist = updateData.distance ?? templateD.distance;

    if ( t === "circle" && ((templateDist / gridDist) >= 1) ) {
      const x = updateData.x ?? templateD.x;
      const y = updateData.y ?? templateD.y;
      const radiusPx = ( templateDist / gridDist ) * gridSize;

      // Calculate the square's hypotenuse based on the 5-5-5 diagonal distance
      const length = templateDist * 2;
      const squareDist = Math.hypot(length, length);

      log(`preCreateMeasuredTemplate: switching circle ${x},${y} distance ${templateDist} to rectangle ${x - radiusPx},${y - radiusPx} distance ${squareDist}`);

      updates.x = x - radiusPx;
      updates.y = y - radiusPx;
      updates.direction = 45;
      updates.distance = squareDist;
      updates.t = "rect";
    }
  }

  if ( !isEmpty(updates) ) templateD.updateSource(updates);
});
