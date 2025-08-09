/* globals
canvas,
dnd5e,
game,
Hooks,
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, LABELS, TEMPLATES } from "./const.js";
import { Settings } from "./settings.js";

export const PATCHES = {};
PATCHES.dnd5e = {};

// Patches for dnd5e ItemSheet5e

// ----- NOTE: Hooks ----- //

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

/**
 * Hook dnd5e.preCreateActivityTemplate
 * Add pertinent WT information based on the item or activity to construct the template.
 *
 * ---
 * A hook event that fires before a template is created for an Activity.
 * @function dnd5e.preCreateActivityTemplate
 * @memberof hookEvents
 * @param {Activity} activity    Activity for which the template is being placed.
 * @param {object} templateData  Data used to create the new template.
 * @returns {boolean}            Explicitly return `false` to prevent the template from being placed.
 */
function preCreateActivityTemplate(activity, templateData) {
  console.log("preCreateActivityTemplate", { activity, templateData })

  // For now, use the item flags and global defaults.
  // TODO: Determine how to incorporate activity data.
  const item = templateData.item;
  if ( !item ) return;
  const shape = templateData.t;

  // Store flags in the template data object.
  const flags = templateData.flags[MODULE_ID] ??= {};

  // Wall settings.
  let wallsBlock = item.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK);
  let wallRestriction = item.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION);
  if ( !wallsBlock
    || wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = Settings.get(Settings.KEYS.DEFAULT_WALLS_BLOCK[shape]);
  if ( !wallRestriction || wallRestriction === LABELS.GLOBAL_DEFAULT ) {
    wallRestriction = Settings.get(Settings.KEYS.DEFAULT_WALL_RESTRICTION[shape]);
  }
  flags[FLAGS.WALLS_BLOCK] = wallsBlock;
  flags[FLAGS.WALL_RESTRICTION] = wallRestriction;

  // Autotargeting.
  flags[FLAGS.NO_AUTOTARGET] = item.getFlag(MODULE_ID, FLAGS.NO_AUTOTARGET) ?? false;

  // Hide settings.
  flags[FLAGS.HIDE.BORDER] = item.getFlag(MODULE_ID, FLAGS.HIDE.BORDER) ?? LABELS.GLOBAL_DEFAULT;
  flags[FLAGS.HIDE.HIGHLIGHTING] = item.getFlag(MODULE_ID, FLAGS.HIDE.HIGHLIGHTING) ?? LABELS.GLOBAL_DEFAULT;
  flags[FLAGS.HIDE.SHOW_ON_HOVER] = item.getFlag(MODULE_ID, FLAGS.HIDE.SHOW_ON_HOVER) ?? LABELS.GLOBAL_DEFAULT;

  // Snapping.
  flags[FLAGS.SNAPPING.CENTER] = item.getFlag(MODULE_ID, FLAGS.SNAPPING.CENTER) ?? Settings.get(Settings.KEYS.DEFAULT_SNAPPING[shape].CENTER);
  flags[FLAGS.SNAPPING.CORNER] = item.getFlag(MODULE_ID, FLAGS.SNAPPING.CORNER) ?? Settings.get(Settings.KEYS.DEFAULT_SNAPPING[shape].CORNER);
  flags[FLAGS.SNAPPING.SIDE_MIDPOINT] = item.getFlag(MODULE_ID, FLAGS.SNAPPING.SIDE_MIDPOINT) ?? Settings.get(Settings.KEYS.DEFAULT_SNAPPING[shape].SIDE_MIDPOINT);
}

/**
 * Hook dnd5.createActivityTemplate
 * Add pertinent WT information to the template based on the item or activity
 * ---
 * A hook event that fires after a template are created for an Activity.
 * @function dnd5e.createActivityTemplate
 * @memberof hookEvents
 * @param {Activity} activity            Activity for which the template is being placed.
 * @param {AbilityTemplate[]} templates  The templates being placed.
 */
function createActivityTemplate(activity, templates) {
  console.log("createActivityTemplate", { activity, templates })

  // For now, use the item flags and global defaults.
  // TODO: Determine how to incorporate activity data.
  const item = activity.item;
  if ( !item ) return;
  if ( !item.getFlag(MODULE_ID, FLAGS.ADD_TOKEN_SIZE) ) return;

  // Expand to account for token size.
  const templateOrigin = PIXI.Point.tmp;
  for ( const template of templates ) {
    const templateD = template.document;

    // Does the template originate on a token? (Use the first token found.)
    templateOrigin.fromObject(templateD);
    const token = canvas.tokens.placeables.find(t => templateOrigin.almostEqual(t.center));
    if ( token ) {
      // Add 1/2 token size to the template distance.
      const { width, height } = token.document;
      const size = Math.min(width, height) * canvas.dimensions.distance;
      templateD.updateSource({ distance: templateD.distance + size });
    }

  }
  templateOrigin.release();
}

/**
 * Hook dnd5e.postUseActivity
 * Attach template to caster or target if that setting was enabled.
 * Must wait until after template preview is done, for at least two reasons:
 * (1) No template id during preview, which breaks attaching.
 * (2) Could cause tokens to move around during preview, which is not good.
 * ---
 * A hook event that fires when an activity is activated.
 * @function dnd5e.postUseActivity
 * @memberof hookEvents
 * @param {Activity} activity                     Activity being activated.
 * @param {ActivityUseConfiguration} usageConfig  Configuration data for the activation.
 * @param {ActivityUsageResults} results          Final details on the activation.
 * @returns {boolean}  Explicitly return `false` to prevent any subsequent actions from being triggered.
 */
function postUseActivity(activity, usageConfig, results) {
  // For now, use the item flags and global defaults.
  // TODO: Determine how to incorporate activity data.
  const item = activity.item;
  if ( !item ) return;

  // Determine if a token should be attached to the template.
  const attachToken = item.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.SPELL_TEMPLATE);
  if ( !attachToken ) return;
  let token;
  switch ( attachToken ) {
    case "caster": token = item.parent.token ?? item.parent.getActiveTokens()[0]; break;
    // case "target": token = options.flags?.lastTargeted ?? [...game.user.targets.values()].at(-1); break; // tokenId
    case "target": [...game.user.targets.values()].at(-1); break; // tokenId
  }
  if ( !token ) return;

  // Attach the token to every template created.
  // Unclear why it is a double array...
  for ( const templates of results.templates ) {
    templates.forEach(template => template.object.attachToken(token));
  }
}

PATCHES.dnd5e.HOOKS = {
  "dnd5e.preCreateActivityTemplate": preCreateActivityTemplate,
  "dnd5e.createActivityTemplate": createActivityTemplate,
  "dnd5e.postUseActivity": postUseActivity,
};

// ----- NOTE: Wraps ----- //

/**
 * Add in module-specific data to the dnd5e spell tab.
 * @param {string} partId                         The part being rendered
 * @param {ApplicationRenderContext} context      Shared context provided by _prepareContext
 * @param {HandlebarsRenderOptions} options       Options which configure application rendering behavior
 * @returns {Promise<ApplicationRenderContext>}   Context data for a specific part
 */
export async function _preparePartContext(wrapper, partId, context, options) {
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

// ----- NOTE: Helper functions ----- //

/**
 * Should this item include a Walled Templates tab in its sheet?
 * @param {Item5e}
 * @returns {boolean} True for spells, feats.
 */
function itemHasModuleTab(item) {
  return item.type === "spell" || item.type === "feat";
}

