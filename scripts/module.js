/* globals
Hooks,
game,
canvas
*/

"use strict";

import { registerWalledTemplates } from "./patching.js";
import { MODULE_ID, SETTINGS, registerSettings, getSetting, toggleSetting } from "./settings.js";

import { registerPIXIPolygonMethods } from "./ClockwiseSweep/PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./ClockwiseSweep/PIXIRectangle.js";
import { registerPIXICircleMethods } from "./ClockwiseSweep/PIXICircle.js";
import { registerPolygonVertexMethods } from "./ClockwiseSweep/SimplePolygonEdge.js";

import { walledTemplatesRenderMeasuredTemplateConfig } from "./renderMeasuredTemplateConfig.js";
import { walledTemplatesRender5eSpellTemplateConfig } from "./render5eSpellTemplateConfig.js";
import { LightMaskClockwisePolygonSweep as WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweep/LightMaskClockwisePolygonSweep.js";
import { LimitedAngleSweepPolygon } from "./ClockwiseSweep/LimitedAngle.js";

import { ClipperLib } from "./ClockwiseSweep/clipper_unminified.js";
import { Hexagon } from "./Hexagon.js";

import {
  walledTemplateGetCircleShape,
  walledTemplateGetConeShape,
  walledTemplateGetRectShape,
  walledTemplateGetRayShape } from "./getShape.js";

/**
 * Log message only when debug flag is enabled from DevMode module.
 * @param {Object[]} args  Arguments passed to console.log.
 */
export function log(...args) {
  try {
    const isDebugging = game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
    if ( isDebugging ) {
      console.log(MODULE_ID, "|", ...args);
    }
  } catch(e) {
    // Empty
  }
}

/**
 * Tell DevMode that we want a flag for debugging this module.
 * https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
 */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

Hooks.once("init", async function() {
  log("Initializing...");
  registerWalledTemplates();
  registerPIXIPolygonMethods();
  registerPIXIRectangleMethods();
  registerPIXICircleMethods();
  registerPolygonVertexMethods();

  game.modules.get(MODULE_ID).api = {
    WalledTemplatesClockwiseSweepPolygon,
    walledTemplateGetCircleShape,
    walledTemplateGetConeShape,
    walledTemplateGetRectShape,
    walledTemplateGetRayShape,
    LimitedAngleSweepPolygon,
    ClipperLib,
    Hexagon
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
    onClick: toggle => toggleSetting(SETTINGS.AUTOTARGET.ENABLED) // eslint-disable-line no-unused-vars
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
    t.refresh(); // Async but probably don't need to await
  });
});


/**
 * Hook wall creation and update to refresh templates
 * updateWall
 * createWall
 * TO-DO: Only refresh templates that contain part of the wall
 */

/**
 * createWall Hook
 * @param {WallDocument} wall
 * @param {Object} opts { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
Hooks.on("createWall", async (wall, opts, id) => { // eslint-disable-line no-unused-vars
  log("Refreshing templates on createWall.");
  if (opts.temporary) return;
  canvas.templates.placeables.forEach(t => {
    t.refresh(); // Async but probably don't need to await
  });
});

/**
 * Hook for updateWall.
 * @param {WallDocument} wall
 * @param {Object} coords { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} opts { diff: Boolean, render: Boolean }
 * @param {string} id
 */
Hooks.on("updateWall", async (wall, coords, opts, id) => { // eslint-disable-line no-unused-vars
  log("Refreshing templates on updateWall.");
  if (!opts.diff) return;
  canvas.templates.placeables.forEach(t => {
    t.refresh(); // Async but probably don't need to await
  });
});

/**
 * Hook for deleteWall.
 * @param {WallDocument} wall
 * @param {Object} opts { render: Boolean }
 * @param {string} id
 */
Hooks.on("deleteWall", async (wall, opts, id) => { // eslint-disable-line no-unused-vars
  log("Refreshing templates on deleteWall.");
  canvas.templates.placeables.forEach(t => {
    t.refresh(); // Async but probably don't need to await
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
Hooks.on("preCreateMeasuredTemplate", async (template, updateData, opts, id) => {
  // Only create if the id does not already exist
  if (typeof template.data.document.getFlag(MODULE_ID, "enabled") === "undefined") {
    log(`Creating template ${id} with default setting ${getSetting(SETTINGS.DEFAULT_WALLED)}.`, template, updateData);
    // Cannot use setFlag here. E.g.,
    // template.data.document.setFlag(MODULE_ID, "enabled", getSetting(SETTINGS.DEFAULT_WALLED));
    const flag = `flags.${MODULE_ID}.enabled`;

    template.data.update({ [flag]: getSetting(SETTINGS.DEFAULT_WALLED) });
  } else {
    log(`preCreateMeasuredTemplate: template enabled flag already set to ${template.data.document.getFlag(MODULE_ID, "enabled")}`);
  }
});
