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
