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

import { tokenName, constructTabElement, constructTabDivision, moveAllChildren, constructTabNavigation } from "./util.js";
import { MODULE_ID, FLAGS, LABELS, NOTIFICATIONS, TEMPLATES } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};


// ----- Note: Hooks ----- //
async function renderMeasuredTemplateConfigHook(app, html, _data) {
  activateListeners(app, html);
}

PATCHES.BASIC.HOOKS = { renderMeasuredTemplateConfig: renderMeasuredTemplateConfigHook };

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
    tabs: [{navSelector: '.tabs[data-group="main"]', contentSelector: "form", initial: "basic"}],
//    template: TEMPLATES.CONFIG_TABS
  });
}

PATCHES.BASIC.STATIC_WRAPS = { defaultOptions };

// ----- Note: Wraps ----- //

/**
 * Wrapper for MeasuredTemplatedConfig.prototype._renderInner
 */
async function _renderInner(wrapper, data) {
  const html = await wrapper(data);
  const form = html[0];
  if ( !form ) return html;
  const button = html.find("button[type='submit']")[0];
  if ( !button ) return html;

  // Remove the button from the form.
  form.removeChild(button);

  // Construct a footer to hold the submission button.
  const footer = document.createElement("footer");
  footer.setAttribute("class", "sheet-footer");
  footer.appendChild(button);

  // Construct two divs: one for the basic tab and one for the walled templates tab.
  const divBasic = constructTabDivision("basic");
  const divWT = constructTabDivision(MODULE_ID);

  // Construct two tab navigation elements.
  const tabElemBasic = constructTabElement("basic", "DOCUMENT.MeasuredTemplate", "fas fa-ruler-combined");
  const tabElemWT = constructTabElement(MODULE_ID, "walledtemplates.MeasuredTemplateConfiguration.LegendTitle", "fas fa-object-group");

  // Create tab navigation. Measured templates by default have none.
  const tabNav = constructTabNavigation([tabElemBasic, tabElemWT]);

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

  return html;
}



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

PATCHES.BASIC.WRAPS = { getData, _onChangeTab, _renderInner};

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
