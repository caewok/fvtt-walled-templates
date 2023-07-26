/* globals
foundry,
renderTemplate
*/

"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS, LABELS } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};

// ----- Note: Hooks ----- //
function renderMeasuredTemplateConfigHook(app, html, data) {
  renderMeasuredTemplateConfig(app, html, data);

  //   const attachedTokenId = data.object.flags[MODULE_ID]?.[FLAGS.ATTACHED_TOKEN]

  const renderData = {};
  renderData[MODULE_ID] = {
    blockoptions: LABELS.WALLS_BLOCK,
    walloptions: LABELS.WALL_RESTRICTION,
    attachedTokenName: "None"
  };

  foundry.utils.mergeObject(data, renderData, { inplace: true });
}

PATCHES.BASIC.HOOKS = { renderMeasuredTemplateConfig: renderMeasuredTemplateConfigHook };

// ----- Note: Wraps ----- //

/**
 * Wrapper for MeasuredTemplateConfig.defaultOptions
 * Make the template config window resize height automatically, to accommodate
 * different parameters.
 * @param {Function} wrapper
 * @return {Object} See MeasuredTemplateConfig.defaultOptions.
 */
export function defaultOptions(wrapper) {
  const options = wrapper();
  return foundry.utils.mergeObject(options, {
    height: "auto"
  });
}

PATCHES.BASIC.STATIC_WRAPS = { defaultOptions };

// ----- Note: Helper functions ----- //

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
async function renderMeasuredTemplateConfig(app, html, data) {
  log("walledTemplatesRenderMeasuredTemplateConfig data", data);
  log(`enabled flag is ${data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)}`);
  log("walledTemplatesRenderMeasuredTemplateConfig data after", data);

  const template = `modules/${MODULE_ID}/templates/walled-templates-measured-template-config.html`;
  const myHTML = await renderTemplate(template, data);
  log("config rendered HTML", myHTML);
  html.find(".form-group").last().after(myHTML);

  app.setPosition(app.position);
}
