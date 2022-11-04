/* globals
CONFIG,
renderTemplate
*/

"use strict";

import { log } from "./util.js";
import { getSetting, SETTINGS } from "./settings.js";
import { MODULE_ID, FLAGS } from "./const.js";

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
export async function walledTemplatesRender5eSpellTemplateConfig(app, html, data) {
  // Set default to be whatever the world setting is
  log("walledTemplatesRender5eSpellTemplateConfig data", data);
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)}`);
  if (typeof data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    log(`setting enabled flag to ${getSetting(SETTINGS.DEFAULT_WALLED)}`);
    data.document.setFlag(MODULE_ID, FLAGS.WALLS_BLOCK, getSetting(SETTINGS.DEFAULT_WALLED));
  }
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)}`);

  // Set variable to know if we are dealing with a template
  data.isTemplate = data.data.target.type in CONFIG.DND5E.areaTargetTypes;

  log("walledTemplatesRender5eSpellTemplateConfig data after", data);

  const template = `modules/${MODULE_ID}/templates/walled-templates-dnd5e-spell-template-config.html`;
  const myHTML = await renderTemplate(template, data);
  log("config rendered HTML", myHTML);

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
  log("Wrapped AbilityTemplate.fromItem", item, template);

  if (template) {
    const is_enabled = item.data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK);

    log(`Setting template flag to ${is_enabled}`);
    // Cannot use setFlag b/c template.data has no id

    template.data.update({ [`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`]: is_enabled });
    // Or template.data.update({ [key]: is_enabled })
    // Or template.data.update({ [`flags.${MODULE_ID}`]: { "enabled": is_enabled}})

  }
  log("Wrapped AbilityTemplate.fromItem template enabled is now", template);

  return template;
}
