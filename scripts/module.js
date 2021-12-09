/* globals
Hooks,
game
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { registerWalledTemplates } from "./patching.js";
import { registerSettings } from "./settings.js";
import { walledTemplatesRenderMeasuredTemplateConfig } from "./renderMeasuredTemplateConfig.js";
import { WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweepPolygon.js";

/**
 * Log message only when debug flag is enabled from DevMode module.
 * @param {Object[]} args  Arguments passed to console.log.
 */
export function log(...args) {
  try {
    const isDebugging = game.modules.get(`_dev-mode`)?.api?.getPackageDebugValue(MODULE_ID);
    if( isDebugging ) {
      console.log(MODULE_ID, `|`, ...args);
    }
  } catch (e) { 
    // empty 
  }
}

/**
 * Tell DevMode that we want a flag for debugging this module.
 * https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
 */
Hooks.once(`devModeReady`, ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

Hooks.once('init', async function() {
  log(`Initializing...`);
  registerWalledTemplates();
  
  game.modules.get(MODULE_ID).api = {
     WalledTemplatesClockwiseSweepPolygon: WalledTemplatesClockwiseSweepPolygon,
     drawPolygons: game.modules.get(`_dev-mode`)?.api?.getPackageDebugValue(MODULE_ID)
  }

});

Hooks.once('setup', async function() {
  log(`Setup...`);
  registerSettings();
});


/**
 * Add controls to the measured template configuration
 */
Hooks.on("renderMeasuredTemplateConfig", (app, html, data) => {
  walledTemplatesRenderMeasuredTemplateConfig(app, html, data);
});


/**
 * Redraw templates once the canvas is loaded
 * Cannot use walls to draw templates until canvas.walls.quadtree is loaded.
 */
Hooks.on("canvasReady", (canvas) => {
  log(`Refreshing templates on canvasReady.`);
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
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
Hooks.on("createWall", (wall, opts, id) => {
  log(`Refreshing templates on createWall.`);
  if(opts.temporary) return;
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
  });
})  
 
/** 
 * updateWall Hook
 * @param {WallDocument} wall
 * @param {Object} coords { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} opts { diff: Boolean, render: Boolean } 
 * @param {string} id
 */
Hooks.on("updateWall", (wall, coords, opts, id) => {
  log(`Refreshing templates on updateWall.`);
  if(!opts.diff) return;
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
  });
})

/**
 * deleteWall Hook
 * @param {WallDocument} wall
 * @param {Object} opts { render: Boolean } 
 * @param {string} id
 */
Hooks.on("deleteWall", (wall, opts, id) => {
  log(`Refreshing templates on deleteWall.`);
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
  });
})

 
 