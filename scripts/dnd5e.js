/* globals
CONFIG,
renderTemplate
*/
"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS, LABELS } from "./const.js";
import { getSetting, SETTINGS } from "./settings.js";

export const PATCHES = {};
PATCHES.dnd5e = {};

// ----- NOTE: Hooks ----- //

/**
 * Hook renderItemSheet5e to add template configuration options for spells.
 * @param {ItemSheet5e} sheet
 * @param {Object} html
 * @param {Object} data
 */
function renderItemSheet5eHook(app, html, data) {
  if (data.itemType !== "Spell") return;
  render5eSpellTemplateConfig(app, html, data);
}

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
    if ( !wallsBlock || wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = getSetting(SETTINGS.DEFAULT_WALLS_BLOCK[shape]);
    if ( !wallRestriction || wallRestriction === LABELS.GLOBAL_DEFAULT ) {
      wallRestriction = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTION[shape]);
    }

    template.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, wallsBlock);
    template.setFlag(MODULE_ID, FLAGS.WALL_RESTRICTION, wallRestriction);
  }
}

PATCHES.dnd5e.HOOKS = {
  renderItemSheet5e: renderItemSheet5eHook,
  dnd5eUseItem: dnd5eUseItemHook
};

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
async function render5eSpellTemplateConfig(app, html, data) {
  // By default, rely on the global settings.
  if (typeof data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    data.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, LABELS.GLOBAL_DEFAULT);
  }

  if (typeof data.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined") {
    data.document.setFlag(MODULE_ID, FLAGS.WALL_RESTRICTION, LABELS.GLOBAL_DEFAULT);
  }

  // Set variable to know if we are dealing with a template
  const areaType = data.system.target.type;
  data.isTemplate = areaType in CONFIG.DND5E.areaTargetTypes;
  data.walledtemplates = {
    blockoptions: LABELS.SPELL_TEMPLATE.WALLS_BLOCK,
    walloptions: LABELS.SPELL_TEMPLATE.WALL_RESTRICTION
  };

  const template = `modules/${MODULE_ID}/templates/walled-templates-dnd5e-spell-template-config.html`;
  const myHTML = await renderTemplate(template, data);

  html.find(".input-select-select").first().after(myHTML);
}

