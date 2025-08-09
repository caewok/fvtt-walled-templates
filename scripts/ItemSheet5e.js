/* globals
canvas,
foundry,
fromUuidSync,
game,
Hooks,
ui
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { tokenName } from "./util.js";
import { MODULE_ID, FLAGS, LABELS, NOTIFICATIONS, TEMPLATES, ICONS } from "./const.js";

export const PATCHES = {};
PATCHES.dnd5e = {};

// Patches for dnd5e ItemSheet5e

// Hook ready to update the PARTS of the dnd5e item sheet.
// Have to wait until dnd5e system sets up.
Hooks.once("init", function() {
  if ( game.system.id !== "dnd5e" ) return;

  const ItemSheet5e = dnd5e.applications.item.ItemSheet5e
  ItemSheet5e.PARTS[MODULE_ID] = { template: TEMPLATES.DND5E, scrollable: [''] };
  ItemSheet5e.TABS.push({
    label: `${MODULE_ID}.MeasuredTemplateConfiguration.LegendTitle`,
    tab: MODULE_ID,
    condition: itemHasModuleTab
  });
});

function itemHasModuleTab(item) {
  return item.type === "spell" || item.type === "feat";
}

/**
 * Add in module-specific data to the dnd5e spell tab.
 * @param {string} partId                         The part being rendered
 * @param {ApplicationRenderContext} context      Shared context provided by _prepareContext
 * @param {HandlebarsRenderOptions} options       Options which configure application rendering behavior
 * @returns {Promise<ApplicationRenderContext>}   Context data for a specific part
 */
async function _preparePartContext(wrapper, partId, context, options) {
  context = await wrapper(partId, context, options);
  if ( partId !== MODULE_ID ) return context;
  const item = this.item;
  if ( !item ) return;

   // By default, rely on the global settings.
  if ( !item.pack ) { // Issue #134: error thrown when viewing spell in compendium.
    if (typeof item.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
      item.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, LABELS.GLOBAL_DEFAULT);
    }

    if (typeof item.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined") {
      item.setFlag(MODULE_ID, FLAGS.WALL_RESTRICTION, LABELS.GLOBAL_DEFAULT);
    }

    if (typeof item.getFlag(MODULE_ID, FLAGS.SNAPPING.CENTER) === "undefined") {
      item.setFlag(MODULE_ID, FLAGS.SNAPPING.CENTER, true);
    }

    if (typeof item.getFlag(MODULE_ID, FLAGS.SNAPPING.CORNER) === "undefined") {
      item.setFlag(MODULE_ID, FLAGS.SNAPPING.CORNER, true);
    }

    if (typeof item.getFlag(MODULE_ID, FLAGS.SNAPPING.SIDE_MIDPOINT) === "undefined") {
      item.setFlag(MODULE_ID, FLAGS.SNAPPING.SIDE_MIDPOINT, true);
    }
  }

  // Set variable to know if we are dealing with a template
  // const areaType = context.system.target.template.type;
//   context.isTemplate = areaType in CONFIG.DND5E.areaTargetTypes;

  context[MODULE_ID] = {
    blockoptions: LABELS.SPELL_TEMPLATE.WALLS_BLOCK,
    walloptions: LABELS.SPELL_TEMPLATE.WALL_RESTRICTION,
    attachtokenoptions: LABELS.SPELL_TEMPLATE.ATTACH_TOKEN,
    hideoptions: LABELS.TEMPLATE_HIDE
  };
  return context;
}

PATCHES.dnd5e.WRAPS = {
  _preparePartContext,
};


