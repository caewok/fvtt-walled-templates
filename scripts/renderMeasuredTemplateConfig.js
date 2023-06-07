/* globals
renderTemplate
*/

"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS } from "./const.js";

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
export async function renderMeasuredTemplateConfig(app, html, data) {
  log("walledTemplatesRenderMeasuredTemplateConfig data", data);
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)}`);
  log("walledTemplatesRenderMeasuredTemplateConfig data after", data);

  const template = `modules/${MODULE_ID}/templates/walled-templates-measured-template-config.html`;

  const myHTML = await renderTemplate(template, data);
  log("config rendered HTML", myHTML);
  html.find(".form-group").last().after(myHTML);

  app.setPosition(app.position);
}


/**
 * Inject a setting for elevation
 */
export async function renderMeasuredTemplateElevationConfig(app, html, data) {
  const template = `modules/${MODULE_ID}/templates/walled-templates-measured-template-elevation-config.html`;

  const myHTML = await renderTemplate(template, data);
  log("elevation config rendered HTML", myHTML);
  const dataInject = 'input[name="width"]';
  html.find(dataInject).first().closest(".form-group").after(myHTML);

  app.setPosition(app.position);
}

/**
 * Wrapper for MeasuredTemplateConfig.defaultOptions
 * Make the template config window resize height automatically, to accommodate
 * different parameters.
 * @param {Function} wrapper
 * @return {Object} See MeasuredTemplateConfig.defaultOptions.
 */
export function defaultOptionsMeasuredTemplateConfig(wrapper) {
  const options = wrapper();
  return foundry.utils.mergeObject(options, {
    height: "auto"
  });
}
