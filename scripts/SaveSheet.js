/* globals
dnd5e,
game,
Hooks,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, LABELS, TEMPLATES, ICONS } from "./const.js";
import { _preparePartContext } from "./ItemSheet5e.js";

export const PATCHES = {};
PATCHES.dnd5e = {};

// Patches for dnd5e ActivitySheet
// Cannot just use ActivitySheet because dnd5e.applications.activity.ActivitySheet
// does not appear to be the ActivitySheet parent of the sheets, e.g., SaveSheet
// See https://github.com/foundryvtt/dnd5e/issues/5938

// Hook ready to update the PARTS of the dnd5e item sheet.
// Have to wait until dnd5e system sets up.
Hooks.once("init", function() {
  if ( game.system.id !== "dnd5e" ) return;

  const SaveSheet = dnd5e.applications.activity.SaveSheet;
  SaveSheet.PARTS[MODULE_ID] = {
    template: TEMPLATES.DND5E,
    templates: [
      TEMPLATES.DND5E_PARTIAL
    ],
  };
});

async function _prepareContext(wrapped, options) {
  console.log("_prepareContext", options);
  return wrapped(options);
}

/**
 * Wrap ActivitySheet._getTabs
 * Because dnd5e cannot just use the TABS structure...
 *
 * Prepare the tab information for the sheet.
 * @returns {Record<string, Partial<ApplicationTab>>}
 */
function _getTabs(wrapped) {
  const tabs = wrapped();
  tabs[MODULE_ID] = {
    id: MODULE_ID,
    group: "sheet",
    icon: ICONS.MODULE,
    label: `${MODULE_ID}.MeasuredTemplateConfiguration.LegendTitle`,
  };

  // Mark only the new entry; rest already marked.
  this._markTabs({ MODULE_ID: tabs[MODULE_ID]});
  return tabs;
}


/**
 * Hook closeActivitySheet to record the Walled Te
 * @param {ActivitySheet[]}
 */
// function closeActivitySheet(sheets) {
//
// }

// ----- NOTE: Wraps ----- //

PATCHES.dnd5e.WRAPS = {
  _prepareContext,
  _preparePartContext,
  _getTabs,
};

// ----- NOTE: Helper functions ----- //
