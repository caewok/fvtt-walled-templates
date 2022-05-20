/* globals
renderTemplate
*/

"use strict";

import { log } from "./module.js";
import { getSetting, MODULE_ID } from "./settings.js";

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
export async function walledTemplatesRenderMeasuredTemplateConfig(app, html, data) {
  // Set default to be whatever the world setting is
  log("walledTemplatesRenderMeasuredTemplateConfig data", data);
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, "enabled")}`);
  if (typeof data.document.getFlag(MODULE_ID, "enabled") === "undefined") {
    log(`setting enabled flag to ${getSetting("default-to-walled")}`);
    data.document.setFlag(MODULE_ID, "enabled", getSetting("default-to-walled"));
  }
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, "enabled")}`);
  log("walledTemplatesRenderMeasuredTemplateConfig data after", data);

  const template = `modules/${MODULE_ID}/templates/walled-templates-measured-template-config.html`;

  const myHTML = await renderTemplate(template, data);
  log("config rendered HTML", myHTML);
  html.find(".form-group").last().after(myHTML);
}
