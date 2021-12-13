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
  if(typeof data.document.getFlag(MODULE_ID, "enabled") === "undefined") {
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

/**
 * Wrap AbilityTemplate.fromItem
 * Check if item enabled marked walled templates; change template flag accordingly
 *
 * @param {Item5e} item               The Item object for which to construct the template
 * @returns {AbilityTemplate|null}     The template object, or null if the item does not produce a template
 */
export function walledTemplate5eFromItem(wrapped, item) {
  const template = wrapped(item);
  log(`Wrapped AbilityTemplate.fromItem`, item, template);

  if(template) {
    const is_enabled = item.data.document.getFlag(MODULE_ID, "enabled");
  
    log(`Setting template flag to ${is_enabled}`);
    
    // cannot use setFlag b/c template.data has no id
    //template.data.flags[`$MODULE_ID`] = { enabled:  item.data.document.getFlag(MODULE_ID, "enabled") }
    //template.document.data.flags["walledtemplates"] = { enabled: is_enabled };
    //const key = `flags.${MODULE_ID}.enabled`;
    
    //template.document.data.flags["walledtemplates"] = { enabled: is_enabled };
    //template.data.flags["walledtemplates"] = { enabled: is_enabled };
    //template.data.document.data.flags["walledtemplates"] = { enabled: is_enabled };
    template.data._source.flags["walledtemplates"] = { enabled: is_enabled };
    
    // template.document.update({ [key]: is_enabled }); doesn't work without id; also requires await
    
    
    // const newData = {}
//     newData[`flags.${MODULE_ID}.enabled`] = item.data.document.getFlag(MODULE_ID, "enabled");
//     foundry.utils.mergeObject(template.data, newData, {inplace: true});
  
//     template.data.document.setFlag(MODULE_ID, "enabled", item.data.document.getFlag(MODULE_ID, "enabled"));
   }
  log(`Wrapped AbilityTemplate.fromItem template enabled is now`, template) 
  
  return template;
} 