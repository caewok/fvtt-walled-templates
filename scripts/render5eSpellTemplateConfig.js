/* globals
CONFIG,
renderTemplate,
CONST
*/

"use strict";

import { getSetting, SETTINGS } from "./settings.js";
import { MODULE_ID, FLAGS, LABELS } from "./const.js";

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
export async function walledTemplatesRender5eSpellTemplateConfig(app, html, data) {
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
