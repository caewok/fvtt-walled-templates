/* globals
Hooks
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { registerWalledTemplates } from "./patching.js";

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
   
  }

});

