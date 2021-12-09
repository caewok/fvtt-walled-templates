/* globals
game
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";

export function getSetting(settingName) {
  return game.settings.get(MODULE_ID, settingName);
}


export function registerSettings() {
  log("Registering walled template switch");
  
  game.settings.register(MODULE_ID, "default-to-walled", {
    name: 'Default to Walled Measured Templates',
    hint: 'If set, newly-created measured templates will default to being walled.',
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  log("Done registering settings.");

}

export function debugPolygons() {
  return game.modules.get(`_dev-mode`)?.api?.getPackageDebugValue(MODULE_ID)
}
