/* globals
canvas,
foundry,
fromUuidSync,
game,
renderTemplate,
ui
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { log, tokenName } from "./util.js";
import { MODULE_ID, FLAGS, LABELS, NOTIFICATIONS, TEMPLATES } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};

/**
 * Helper to move all children from one node to another.
 * @param {Node} oldParent
 * @param {Node} newParent
 * @returns {Node} The newParent node
 */
function moveAllChildren(oldParent, newParent) {
  while (oldParent.childNodes.length > 0) {
    newParent.appendChild(oldParent.removeChild(oldParent.childNodes[0]));
  }
  return newParent;
}

// ----- Note: Hooks ----- //
async function renderMeasuredTemplateConfigHook(app, html, data) {
  // Look up the token. If present in the scene, consider it attached for the config.
  const template = app.object.object;
  const attachedToken = template.attachedToken;
  let rotateWithToken = template.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ROTATE);
  if (typeof rotateWithToken === 'undefined') {
    rotateWithToken = true;
  }
  const renderData = {};
  renderData[MODULE_ID] = {
    blockoptions: LABELS.WALLS_BLOCK,
    walloptions: LABELS.WALL_RESTRICTION,
    hideoptions: LABELS.TEMPLATE_HIDE,
    attachedTokenName: tokenName(attachedToken) || game.i18n.localize("None"),
    hasAttachedToken: Boolean(attachedToken),
    rotateWithToken: Boolean(rotateWithToken)
  };

  foundry.utils.mergeObject(data, renderData, { inplace: true });

  const form = html.find("form")[0];
  if ( !form ) return;

  const button = html.find("button[type='submit']")[0];
  if ( !button ) return;

  // Remove the button from the form.
  form.removeChild(button);

  // Construct a footer to hold the submission button.
  const footer = document.createElement("footer");
  footer.setAttribute("class", "sheet-footer");
  footer.appendChild(button);

  // Construct two divs: one for the basic tab and one for the walled templates tab.
  const divBasic = document.createElement("div");
  divBasic.setAttribute("class", "tab");
  divBasic.setAttribute("data-tab", "basic");
  divBasic.setAttribute("data-group", "main");

  const divWT = document.createElement("div");
  divWT.setAttribute("class", "tab");
  divWT.setAttribute("data-tab", MODULE_ID);
  divWT.setAttribute("data-group", "main");

  // Create tab navigation. Measured templates by default have none.
  const tabNav = document.createElement("nav");
  tabNav.setAttribute("class", "sheet-tabs tabs");
  tabNav.setAttribute("data-group", "main");
  tabNav.setAttribute("aria-role", game.i18n.localize("SHEETS.FormNavLabel"));

  // Create basic tab for Foundry settings.
  const tabElemBasic = document.createElement("a");
  tabElemBasic.setAttribute("class", "item");
  tabElemBasic.setAttribute("data-tab", "basic");

  // Basic tab icon.
  const tabIconBasic = document.createElement("i");
  tabIconBasic.setAttribute("class", "fas fa-ruler-combined");
  tabElemBasic.appendChild(tabIconBasic)

  // Basic tab title
  const legendBasic = document.createTextNode(game.i18n.localize("DOCUMENT.MeasuredTemplate"));
  tabElemBasic.appendChild(legendBasic);

  // Create walled templates tab.
  const tabElemWT = document.createElement("a");
  tabElemWT.setAttribute("class", "item");
  tabElemWT.setAttribute("data-tab", MODULE_ID);

  // WT tab icon.
  const tabIconWT = document.createElement("i");
  tabIconWT.setAttribute("class", "fas fa-object-group");
  tabElemWT.appendChild(tabIconWT)

  // WT tab title
  const legendWT = document.createTextNode(game.i18n.localize("walledtemplates.MeasuredTemplateConfiguration.LegendTitle"));
  tabElemWT.appendChild(legendWT);

  // Add each tab to the navigation.
  tabNav.appendChild(tabElemBasic);
  tabNav.appendChild(tabElemWT);

  // Move all the basic configuration elements to the basic tab.
  moveAllChildren(form, divBasic);

  // Add the walled template tab data.
  const myHTML = await renderTemplate(TEMPLATES.CONFIG_PARTIAL, data);
  divWT.innerHTML = myHTML;

  // Put it all together (remember that we already stripped the form of children).
  form.appendChild(tabNav);
  form.appendChild(divBasic);
  form.appendChild(divWT);
  form.appendChild(footer);

  // Add tab options to the application.
  app.options.tabs = [{navSelector: '.tabs[data-group="main"]', contentSelector: "form", initial: "basic"}];
  app._tabs = app._createTabHandlers();
  app._activateCoreListeners(html);

  // renderMeasuredTemplateConfig(app, html, data);
  activateListeners(app, html);
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
function defaultOptions(wrapper) {
  const options = wrapper();
  return foundry.utils.mergeObject(options, {
    height: "auto",
//    tabs: [{navSelector: '.tabs[data-group="main"]', contentSelector: "form", initial: "basic"}],
//    template: TEMPLATES.CONFIG_TABS
  });
}

PATCHES.BASIC.STATIC_WRAPS = { defaultOptions };

/**
 * Wrapper for MeasuredTemplateConfig#getData
 */
function getData(wrapper) {
  const template = this.object.object;
  const attachedToken = template.attachedToken;
  const rotateWithToken = template.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ROTATE) ?? true;
  return foundry.utils.mergeObject(wrapper(), {
    [MODULE_ID]: {
      blockoptions: LABELS.WALLS_BLOCK,
      walloptions: LABELS.WALL_RESTRICTION,
      hideoptions: LABELS.TEMPLATE_HIDE,
      attachedTokenName: tokenName(attachedToken) || game.i18n.localize("None"),
      hasAttachedToken: Boolean(attachedToken),
      rotateWithToken: Boolean(rotateWithToken)
    }
  });
}

/**
 * Method for MeasuredTemplateConfig#_onChangeTab
 * Test
 */
function _onChangeTab(wrapper, event, tabs, active) {
    wrapper(event, tabs, active);
}

PATCHES.BASIC.WRAPS = { getData, _onChangeTab };

// ----- Note: Helper functions ----- //

/**
 * Catch when the user clicks a button to attach a token.
 */
function activateListeners(app, html) {
  html.on("click", "#walledtemplates-useSelectedToken", onSelectedTokenButton.bind(app));
  html.on("click", "#walledtemplates-useTargetedToken", onTargetedTokenButton.bind(app));
  html.on("click", "#walledtemplates-removeAttachedToken", onRemoveTokenButton.bind(app));
}

/**
 * Inject html to add controls to the measured template configuration:
 * 1. Switch to have the template be blocked by walls.
 *
 * templates/scene/template-config.html
 */
async function renderMeasuredTemplateConfig(app, html, data) {
//   log("walledTemplatesRenderMeasuredTemplateConfig data", data);
//   log(`enabled flag is ${data.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)}`);
//   log("walledTemplatesRenderMeasuredTemplateConfig data after", data);
//
//   const template = TEMPLATES.CONFIG_PARTIAL;
//   const myHTML = await renderTemplate(template, data);
//   log("config rendered HTML", myHTML);
//   html.find(".form-group").last().after(myHTML);
//
//   app.setPosition(app.position);
}

/**
 * Handle when user clicks the "Attach last selected token" button.
 * @param {Event} event
 */
async function onSelectedTokenButton(_event) {
  const token = fromUuidSync(game.user._lastSelected)?.object;
  if (!token) {
    ui.notifications.notify(game.i18n.localize(NOTIFICATIONS.NOTIFY.ATTACH_TOKEN_NOT_SELECTED));
    return;
  }
  const template = this.document.object;
  await template.attachToken(token);
  ui.notifications.notify(`${tokenName(token)} attached!`);
  this.render();
}

/**
 * Handle when user clicks the "Attach last targeted token" button.
 * @param {Event} event
 */
async function onTargetedTokenButton(_event) {
  const tokenId = game.user.targets.ids.at(-1);
  if (!tokenId) {
    ui.notifications.notify(game.i18n.localize(NOTIFICATIONS.NOTIFY.ATTACH_TOKEN_NOT_TARGETED));
    return;
  }
  const token = canvas.tokens.documentCollection.get(tokenId)?.object;
  if (!token) {
    ui.notifications.error(`Targeted token for id ${tokenId} not found.`);
    return;
  }
  const template = this.document.object;
  await template.attachToken(token);
  ui.notifications.notify(`${tokenName(token)} attached!`);
}

/**
 * Handle when user clicks "Remove attached token" button
 * @param {Event} event
 */
async function onRemoveTokenButton(_event) {
  const template = this.document.object;
  await template.detachToken();
  this.render();
  ui.notifications.notify("Token detached!");
}
