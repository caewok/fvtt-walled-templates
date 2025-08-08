/* globals
foundry,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS } from "./const.js";
import { Settings } from "./settings.js";

/**
 * Hook preCreateMeasuredTemplate to
 * @param {MeasuredTemplateDocument} template
 * @param {Object} data
 * @param {Object} opt { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
export function preCreateMeasuredTemplateHook(templateD, updateData, _opts, _id) {
  log("Hooking preCreateMeasuredTemplate", templateD, updateData);

  const updates = {};

  // Only create if the id does not already exist
  if (typeof templateD.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    // In v10, setting the flag throws an error about not having id
    // template.setFlag(MODULE_ID, "enabled", Settings.get(Settings.KEYS.DEFAULT_WALLED));
    updates[`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`] = Settings.get(Settings.KEYS.DEFAULT_WALLS_BLOCK[templateD.t]);
  }

  if ( typeof templateD.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
    updates[`flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`] = Settings.get(Settings.KEYS.DEFAULT_WALL_RESTRICTION[templateD.t]);
  }

  if ( !foundry.utils.isEmpty(updates) ) templateD.updateSource(updates);
}

/**
 * Hook updateMeasuredTemplate to set render flag based on change to the WalledTemplate config.
 * @param {Document} document                       The existing Document which was updated
 * @param {object} change                           Differential data that was used to update the document
 * @param {DocumentModificationContext} options     Additional options which modified the update request
 * @param {string} userId                           The ID of the User who triggered the update workflow
 */
export function updateMeasuredTemplateHook(templateD, data, _options, _userId) {
  const wtChangeFlags = [
    `flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`,
    `flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`
  ];

  const changed = new Set(Object.keys(foundry.utils.flattenObject(data)));
  if ( wtChangeFlags.some(k => changed.has(k)) ) templateD.object.renderFlags.set({
    refreshShape: true
  });
}
