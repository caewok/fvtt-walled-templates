/* globals
foundry,
renderTemplate
*/

"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS, LABELS, NOTIFICATIONS, SHAPE_KEYS } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};

// ----- Note: Hooks ----- //
function renderMeasuredTemplateConfigHook(app, html, data) {
  renderMeasuredTemplateConfig(app, html, data);
  activateListeners(app, html);

  // Look up the token. If present in the scene, consider it attached for the config.
  const template = app.object.object;
  const attachedToken = template.attachedToken;
  const renderData = {};
  renderData[MODULE_ID] = {
    computedHeight: template[MODULE_ID].walledTemplate.height,
    heightChoices: LABELS.HEIGHT_CHOICES,
    blockoptions: LABELS.WALLS_BLOCK,
    walloptions: LABELS.WALL_RESTRICTION,
    attachedTokenName: attachedToken?.name || game.i18n.localize("None"),
    noAttachedToken: Boolean(attachedToken)
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

// ----- Note: Wraps ---- //

/**
 * Wrap MeasuredTemplateConfig.prototype._updateObject
 * Update the calculated height for the template.
 */
async function _onChangeInput(wrapped, event) {
  // How to check that the template has an attached token?
  switch ( event.currentTarget.name ) {
    case "walledtemplates.heightType": {
      await this.document.setFlag(MODULE_ID, FLAGS.HEIGHT_ALGORITHM, event.currentTarget.value);
      this.render();
      break;
    }

    case "walledtemplates.heightValue": {
      await this.document.setFlag(MODULE_ID, FLAGS.HEIGHT_CUSTOM_VALUE, event.currentTarget.value);
      this.render();
      break;
    }
  }

  return wrapped(event);
}

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



/**
 * Catch when the user clicks a button to attach a token.
 */
function activateListeners(app, html) {
  html.on("click", "#walledtemplates-useSelectedToken", onSelectedTokenButton.bind(app));
  html.on("click", "#walledtemplates-useTargetedToken", onTargetedTokenButton.bind(app));
  html.on("click", "#walledtemplates-removeAttachedToken", onRemoveTokenButton.bind(app));
}

/**
 * Handle when user clicks the "Attach last selected token" button.
 * @param {Event} event
 */
async function onSelectedTokenButton(_event) {
  const token = game.user._lastSelected;
  if ( !token ) {
    ui.notifications.notify(game.i18n.localize(NOTIFICATIONS.NOTIFY.ATTACH_TOKEN_NOT_SELECTED));
    return;
  }
  await this.document.setFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN_ID, token.id);
  ui.notifications.notify(`${token.name} attached!`);
  this.render();
}

/**
 * Handle when user clicks the "Attach last targeted token" button.
 * @param {Event} event
 */
async function onTargetedTokenButton(_event) {
  const tokenId = game.user.targets.ids.at(-1);
  if ( !tokenId ) {
    ui.notifications.notify(game.i18n.localize(NOTIFICATIONS.NOTIFY.ATTACH_TOKEN_NOT_TARGETED));
    return;
  }
  const token = canvas.tokens.documentCollection.get(tokenId)?.object;
  if ( !token ) {
    ui.notifications.error(`Targeted token for id ${tokenId} not found.`);
    return;
  }

  await this.document.setFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN_ID, token.id);
  this.render();
  ui.notifications.notify(`${token.name} attached!`);
}

/**
 * Handle when user clicks "Remove attached token" button
 * @param {Event} event
 */
async function onRemoveTokenButton(_event) {
  await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN_ID);
  this.render();
  ui.notifications.notify(`Remove attached clicked!`);
}


