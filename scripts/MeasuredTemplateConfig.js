/* globals
canvas,
foundry,
fromUuidSync,
game,
Hooks,
ui
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { tokenName } from "./util.js";
import { MODULE_ID, FLAGS, LABELS, NOTIFICATIONS, TEMPLATES, ICONS } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};

// Construct tabs for the measured template
// const mtConfig = foundry.applications.sheets.MeasuredTemplateConfig;
// mtConfig.PARTS = {
//   ...mtConfig.PARTS,
//   tabs: {
//     template: "templates/generic/tab-navigation.hbs"
//   },
//   [MODULE_ID]: TEMPLATES.CONFIG_PARTIAL,
// };
//
// mtConfig.TABS = {
//   sheet: {
//     tabs: [
//       { id: "basic", icon: "fa-solid fa-ruler-combined" },
//       { id: MODULE_ID, icon: "fa-solid fa-object-group"},
//     ],
//     initial: "basic",
//     labelPrefix: "MEASURED_TEMPLATE.TABS",
//   },
// };

// ----- Note: Hooks ----- //

// Hook init to update the PARTS of the measured template config
Hooks.once("init", async function() {
  const { footer, main, ...other } = foundry.applications.sheets.MeasuredTemplateConfig.PARTS;

  // Just in case.
  if ( Object.hasOwn(other, "tabs") ) delete other.tabs;

  // Wrap the main template by registering it as a partial and reusing it.
  await foundry.applications.handlebars.getTemplate(main.template);
  // Handlebars.registerPartial("AmbientSoundBody", main.template);


  // Wrap the measured template main template so it is displayed as a tab.
  // Ensure footer is last and the module tab is after the main.
  foundry.applications.sheets.MeasuredTemplateConfig.PARTS = {
    tabs: {  template: "templates/generic/tab-navigation.hbs" },
    main: { template: TEMPLATES.CONFIG_MT_MAIN },
    ...other,
    [MODULE_ID]: { template: TEMPLATES.CONFIG_MT_MODULE },
    footer
  };
});


/**
 * Hook the measured template config render.
 * @param {ApplicationV2} application          The Application instance being rendered
 * @param {HTMLElement} element                The inner HTML of the document that will be displayed and may be modified
 * @param {ApplicationRenderContext} context   The application rendering context data
 * @param {ApplicationRenderOptions} options   The application rendering options
 */
async function renderMeasuredTemplateConfig(app, element, _context, _options) {
  activateListeners(app, element);
}

PATCHES.BASIC.HOOKS = { renderMeasuredTemplateConfig };

// ----- Note: Wraps ----- //

/**
 * Add additional module tab to the config.
 * MT config currently has no tabs, so add "main" as the other.
 */
async function _prepareContext(wrapper, options) {
  const context = await wrapper(options);
  context.tabs ??= {};
  context.tabs.main = {
    id: "main",
    group: "sheet",
    icon: ICONS.MEASURED_TEMPLATE,
    label: "DOCUMENT.MeasuredTemplate",
  };
  context.tabs[MODULE_ID] =  {
    id: MODULE_ID,
    group: "sheet",
    icon: ICONS.MODULE,
    label: "walledtemplates.MeasuredTemplateConfiguration.LegendTitle",
  };

  // From AmbientLightConfig.#getTabs
  for ( const v of Object.values(context.tabs) ) {
    v.active = this.tabGroups[v.group] === v.id;
    v.cssClass = v.active ? "active" : "";
  }

  return context;
}

/**
 * Add in module-specific data to the measured template tab.
 * @param {string} partId                         The part being rendered
 * @param {ApplicationRenderContext} context      Shared context provided by _prepareContext
 * @param {HandlebarsRenderOptions} options       Options which configure application rendering behavior
 * @returns {Promise<ApplicationRenderContext>}   Context data for a specific part
 */
async function _preparePartContext(wrapper, partId, context, options) {
  context = await wrapper(partId, context, options);
  if ( partId !== MODULE_ID ) return context;
  const template = this.document?.object;
  if ( !template ) return context;

  // Add relevant data for this measured template
  const attachedToken = template.attachedToken;
  const rotateWithToken = template.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ROTATE) ?? true;
  context[MODULE_ID] = {
    blockoptions: LABELS.WALLS_BLOCK,
    walloptions: LABELS.WALL_RESTRICTION,
    hideoptions: LABELS.TEMPLATE_HIDE,
    attachedTokenName: tokenName(attachedToken) || game.i18n.localize("None"),
    hasAttachedToken: Boolean(attachedToken),
    rotateWithToken: Boolean(rotateWithToken)
  }
  return context;
}

/**
 * Wrap to set the initial tab group for sounds.
 * Modify the provided options passed to a render request.
 * @param {RenderOptions} options                 Options which configure application rendering behavior
 * @protected
 */
function _configureRenderOptions(wrapper, options) {
  wrapper(options);
  this.tabGroups = { sheet: "main" };
}


PATCHES.BASIC.WRAPS = {
  _configureRenderOptions,
  _prepareContext,
  _preparePartContext,
};

// ----- Note: Helper functions ----- //

/**
 * Catch when the user clicks a button to attach a token.
 */
function activateListeners(app, html) {
  const useSelectedButton = html.querySelector("#walledtemplates-useSelectedToken");
  useSelectedButton.addEventListener("click", onSelectedTokenButton.bind(app));

  const useTargetedButton = html.querySelector("#walledtemplates-useTargetedToken");
  useTargetedButton.addEventListener("click", onTargetedTokenButton.bind(app));

  const removeAttachedButton = html.querySelector("#walledtemplates-removeAttachedToken");
  removeAttachedButton.addEventListener("click", onRemoveTokenButton.bind(app));
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


