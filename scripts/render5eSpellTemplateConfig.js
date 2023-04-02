/* globals
CONFIG,
renderTemplate
*/

"use strict";

import { log } from "./util.js";
import { getSetting, SETTINGS } from "./settings.js";
import { MODULE_ID, FLAGS, LABELS } from "./const.js";

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
export async function walledTemplatesRender5eSpellTemplateConfig(app, html, data) {
  // Set default to be whatever the world setting is
  const areaType = data.system.target.type;
  if (typeof data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    const shape = CONFIG.DND5E.areaTargetTypes[areaType]?.template ?? "circle";
    data.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, getSetting(SETTINGS.DEFAULTS[shape]));
  }

  // Set variable to know if we are dealing with a template
  data.isTemplate = areaType in CONFIG.DND5E.areaTargetTypes;
  data.walledtemplates = {
    blockoptions: LABELS.WALLS_BLOCK,
    walloptions: Object.fromEntries(CONST.WALL_RESTRICTION_TYPES.map(key => [key, key]))
  };

  const template = `modules/${MODULE_ID}/templates/walled-templates-dnd5e-spell-template-config.html`;
  const myHTML = await renderTemplate(template, data);

  html.find(".input-select-select").first().after(myHTML);
}

/**
 * Wrap AbilityTemplate.fromItem
 * Check if item enabled marked walled templates; change template flag accordingly
 *
 * @param {Item5e} item               The Item object for which to construct the template
 * @returns {AbilityTemplate|null}     The template object, or null if the item does not produce a template
 */
export function walledTemplate5eFromItem(wrapped, item) {
  const template = wrapped(item);

  if (template) {
    const wallsblock = item.data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK);
    const wallrestriction = item.data.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION)

    // Cannot use setFlag b/c template.data has no id

    template.data.update({ [`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`]: wallsblock });
    template.data.update({ [`flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`]: wallrestriction });
    // Or template.data.update({ [key]: is_enabled })
    // Or template.data.update({ [`flags.${MODULE_ID}`]: { "enabled": is_enabled}})

  }

  return template;
}
