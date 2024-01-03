/* globals
CONFIG,
game,
renderTemplate
*/
"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS, LABELS } from "./const.js";
import { Settings } from "./settings.js";

export const PATCHES_dnd5e = {};
PATCHES_dnd5e.dnd5e = {};

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
 * Given a template, add configuration from the attached item, if any.
 * Called in the drawMeasuredTemplate hook. At that point, the template may not have an id.
 * @param {AbilityTemplate} template    Template created from item in dnd5e
 */
export function addDnd5eItemConfigurationToTemplate(template) {
  const item = template.item;
  if ( !item ) return;

  // Add item flags to the template(s)
  const attachToken = item.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.SPELL_TEMPLATE);
  const templateD = template.document;
  const shape = templateD.t;
  let wallsBlock = item.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK);
  let wallRestriction = item.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION);
  if ( !wallsBlock
    || wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = Settings.get(Settings.KEYS.DEFAULT_WALLS_BLOCK[shape]);
  if ( !wallRestriction || wallRestriction === LABELS.GLOBAL_DEFAULT ) {
    wallRestriction = Settings.get(Settings.KEYS.DEFAULT_WALL_RESTRICTION[shape]);
  }

  // templateD.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, wallsBlock);
  // templateD.setFlag(MODULE_ID, FLAGS.WALL_RESTRICTION, wallRestriction);
  templateD.updateSource({
    flags: {
      [MODULE_ID]: {
        [FLAGS.WALLS_BLOCK]: wallsBlock,
        [FLAGS.WALL_RESTRICTION]: wallRestriction
      }
    }
  });

  if ( item.getFlag(MODULE_ID, FLAGS.ADD_TOKEN_SIZE) ) {
    // Does the template originate on a token? (Use the first token found.)
    const templateOrigin = new PIXI.Point(templateD.x, templateD.y);
    const token = canvas.tokens.placeables.find(t => templateOrigin.almostEqual(t.center));
    if ( token ) {
      // Add 1/2 token size to the template distance.
      const { width, height } = token.document;
      const size = Math.min(width, height) * canvas.dimensions.distance;
      templateD.updateSource({ distance: templateD.distance + size });
    }
  }
}

/**
 * Hook dnd template creation from item, to attach the caster or target to the template.
 * Must wait until after template preview is done, for at least two reasons:
 * (1) No template id during preview, which breaks attaching.
 * (2) Could cause tokens to move around during preview, which is not good.
 * Other flags set up earlier, with the draw hook.
 */
function dnd5eUseItemHook(item, config, options, templates) { // eslint-disable-line no-unused-vars
  log("dnd5e.useItem hook", item);
  if ( !templates || !item ) return;

  // Add item flags to the template(s)
  const attachToken = item.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.SPELL_TEMPLATE);
  if ( !attachToken ) return;
  let token;
  switch ( attachToken ) {
    case "caster": token = item.parent.token ?? item.parent.getActiveTokens()[0]; break;
    case "target": token = options.flags.lastTargeted; break; // tokenId
    default: return;
  }
  templates.forEach(templateD => templateD.object.attachToken(token));
}

PATCHES_dnd5e.dnd5e.HOOKS = {
  renderItemSheet5e: renderItemSheet5eHook,
  ["dnd5e.useItem"]: dnd5eUseItemHook
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
    walloptions: LABELS.SPELL_TEMPLATE.WALL_RESTRICTION,
    attachtokenoptions: LABELS.SPELL_TEMPLATE.ATTACH_TOKEN
  };

  const template = `modules/${MODULE_ID}/templates/walled-templates-dnd5e-spell-template-config.html`;
  const myHTML = await renderTemplate(template, data);

  html.find(".form-group.consumption").first().after(myHTML);
}
