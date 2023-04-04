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
export async function walledTemplatesRenderMeasuredTemplateConfig(app, html, data) {
  log("walledTemplatesRenderMeasuredTemplateConfig data", data);
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)}`);
  log("walledTemplatesRenderMeasuredTemplateConfig data after", data);

  const template = `modules/${MODULE_ID}/templates/walled-templates-measured-template-config.html`;

  const myHTML = await renderTemplate(template, data);
  log("config rendered HTML", myHTML);
  html.find(".form-group").last().after(myHTML);
}


/**
 * Inject a setting for elevation
 */
export async function walledTemplatesRenderMeasuredTemplateElevationConfig(app, html, data) {
  const template = `modules/${MODULE_ID}/templates/walled-templates-measured-template-elevation-config.html`;

  const myHTML = await renderTemplate(template, data);
  log("elevation config rendered HTML", myHTML);
  const dataInject = 'input[name="width"]';
  html.find(dataInject).first().closest(".form-group").after(myHTML);
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

/**
 * Wrap MeasuredTemplateConfig.prototype._render.
 * Store the original values for this object.
 */
export async function _renderMeasuredTemplateConfig(wrapper, force, options) {
  if ( !this.rendered ) this.original = this.object.toObject();
  return wrapper(force, options);
}