/* globals
Hooks,
game
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { registerWalledTemplates } from "./patching.js";
import { registerSettings, getSetting } from "./settings.js";
import { walledTemplatesRenderMeasuredTemplateConfig } from "./renderMeasuredTemplateConfig.js";
import { WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweepPolygon.js";
import { walledTemplateGetCircleShape } from "./getCircleShape.js";
import { walledTemplateGetConeShape } from "./getConeShape.js";
import { walledTemplateGetRectShape } from "./getRectShape.js";
import { walledTemplateGetRayShape } from "./getRayShape.js";

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
     getCircleShape: walledTemplateGetCircleShape,
     getConeShape: walledTemplateGetConeShape,
     getRectShape: walledTemplateGetRectShape,
     getRayShape: walledTemplateGetRayShape
  }

});

Hooks.once('setup', async function() {
  log(`Setup...`);
  registerSettings();
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
Hooks.on("canvasReady", async (canvas) => {
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
Hooks.on("createWall", async (wall, opts, id) => {
  log(`Refreshing templates on createWall.`);
  if(opts.temporary) return;
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
  });
}); 
 
/** 
 * updateWall Hook
 * @param {WallDocument} wall
 * @param {Object} coords { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} opts { diff: Boolean, render: Boolean } 
 * @param {string} id
 */
Hooks.on("updateWall", async (wall, coords, opts, id) => {
  log(`Refreshing templates on updateWall.`);
  if(!opts.diff) return;
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
  });
});

/**
 * deleteWall Hook
 * @param {WallDocument} wall
 * @param {Object} opts { render: Boolean } 
 * @param {string} id
 */
Hooks.on("deleteWall", async (wall, opts, id) => {
  log(`Refreshing templates on deleteWall.`);
  canvas.templates.placeables.forEach(t => {
    // t.refresh();
    t.draw(); // async but probably don't need to await
  });
});


/**
 * preCreateMeasuredTemplate hook
 * @param {MeasuredTemplateDocument} template
 * @param {Object} data
 * @param {Object} opt { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
// https://foundryvtt.wiki/en/migrations/foundry-core-0_8_x#adding-items-to-an-actor-during-precreate
Hooks.on("preCreateMeasuredTemplate", async (template, updateData, opts, id) => {
  log(`Creating template ${id}.`, template, updateData);
  // setFlag doesn't work
  //template.data.document.setFlag(MODULE_ID, "enabled", getSetting("default-to-walled"));
  //
  const flag = `flags.${MODULE_ID}.enabled`;
  
  template.data.update({ [flag]: true })
  
 // updateData.data.update({ flags.[MODULE_ID].enabled: getSetting("default-to-walled") });  
});
 
 