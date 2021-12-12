/* globals
CONFIG,
renderTemplate
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";
import { getSetting } from "./settings.js";

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
export async function walledTemplatesRender5eSpellTemplateConfig(app, html, data) {
  // set default to be whatever the world setting is
  log(`walledTemplatesRender5eSpellTemplateConfig data`, data);
  
  // data.document.setFlag; getFlag should work
  
  
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, "enabled")}`);
  if(data.document.getFlag(MODULE_ID, "enabled") === undefined) {
    log(`setting enabled flag to ${getSetting("default-to-walled")}`);
    data.document.setFlag(MODULE_ID, "enabled", getSetting("default-to-walled"));
  }
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, "enabled")}`);
  
  
  // set variable to know if we are dealing with a template
  data.isTemplate = data.data.target.type in CONFIG.DND5E.areaTargetTypes;
  
  
//   const newFlag = {}
//   newFlag[`data.flags.${MODULE_ID}.enabled`] = getSetting("default-to-walled");
//   foundry.utils.mergeObject(data, newFlag, { overwrite: false });
  
  log(`walledTemplatesRender5eSpellTemplateConfig data after`, data);
  
  const template = `modules/${MODULE_ID}/templates/walled-templates-dnd5e-spell-template-config.html`;
  
  const myHTML = await renderTemplate(template, data)
  log(`config rendered HTML`, myHTML);
  
  html.find(".input-select-select").first().after(myHTML);
  
  //html.find(".form-group").last().after(myHTML);
}