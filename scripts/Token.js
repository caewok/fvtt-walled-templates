/* globals
game,
MeasuredTemplate
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, ACTIVE_EFFECT_ICON } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};
PATCHES.AUTOTARGET = {};

// ---- NOTE: Hooks ----- //

/**
 * Hook controlToken to track per-user control.
 * Each token is deselected prior to the layer deactivating.
 *
 * A hook event that fires when any PlaceableObject is selected or
 * deselected. Substitute the PlaceableObject name in the hook event to
 * target a specific PlaceableObject type, for example "controlToken".
 * @function controlPlaceableObject
 * @memberof hookEvents
 * @param {PlaceableObject} object The PlaceableObject
 * @param {boolean} controlled     Whether the PlaceableObject is selected or not
 */
function controlTokenHook(object, controlled) {
  const user = game.user;

  if ( controlled ) user._lastSelected = object;
  else if ( user.lastSelected === object ) user._lastDeselected = object;
}

/**
 * Hook preUpdateToken
 */
function preUpdateTokenHook(tokenD, changes, _options, _userId) {
  const token = tokenD.object;
  console.debug(`preUpdateToken hook ${changes.x}, ${changes.y}, ${changes.elevation} at elevation ${token.document?.elevation} with elevationD ${tokenD.elevation}`, changes);
  console.debug(`preUpdateToken hook moving ${tokenD.x},${tokenD.y} --> ${changes.x ? changes.x : tokenD.x},${changes.y ? changes.y : tokenD.y}`);
}

/**
 * Hook updateToken
 */
function updateTokenHook(tokenD, changed, _options, _userId) {
  const token = tokenD.object;
  console.debug(`updateToken hook ${changed.x}, ${changed.y}, ${changed.elevation} at elevation ${token.document?.elevation} with elevationD ${tokenD.elevation}`, changed);
  console.debug(`updateToken hook moving ${tokenD.x},${tokenD.y} --> ${changed.x ? changed.x : tokenD.x},${changed.y ? changed.y : tokenD.y}`);

  // Update elevation, rotation


}

/**
 * Hook Token refresh
 */
function refreshTokenHook(token, flags) {
  if ( !flags.refreshPosition ) return;
  // TODO: refreshElevation flag?
  console.debug(`refreshToken for ${token.name} at ${token.position.x},${token.position.y}. Token is ${token._original ? "Clone" : "Original"}. Token is ${token._animation ? "" : "not "}animating.`);
//   const priorPosition = token[MODULE_ID]?.priorPosition;
//   if ( typeof priorPosition === "undefined" ) return;
//   const delta = PIXI.Point.fromObject(token.position).subtract(priorPosition);
//   if ( !(delta.x || delta.y) ) return;
//
//   const attachedTemplates = token.attachedTemplates;
//   if ( !attachedTemplates.length ) return;
//
  if ( token._original ) {
    // clone
    console.debug(`clone of ${token.name} at ${token.position.x},${token.position.y} and document ${token.document.x}, ${token.document.y}`);

  }

  if ( token._animation ) {
    // animating
    console.debug(`${token.name} at ${token.position.x},${token.position.y} and document ${token.document.x}, ${token.document.y}`);
//     attachedTemplates.map(t => t.document.updateSource({ x: t.x + delta.x, y: t.y + delta.y }));
  }
}

PATCHES.AUTOTARGET.HOOKS = { controlToken: controlTokenHook };
PATCHES.BASIC.HOOKS = {
  preUpdateToken: preUpdateTokenHook,
  updateToken: updateTokenHook,
  refreshToken: refreshTokenHook };


// ----- NOTE: Methods ----- //

/**
 * New method: Token.prototype.attachTemplate
 * Attach a given template to this token as an active effect.
 * A token can have multiple templates attached.
 * @param {MeasuredTemplate}        template
 * @param {object} [effectData]     Data passed to the token as an active effect
 */
async function attachTemplate(template, effectData = {}) {
  // Detach any token from the template.
  await this.detachTemplate(template);

  // Attach token to the template.
  await template.document.setFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN_ID, this.id);

  // Attach the template to this token as an active effect.
  const templateShape = game.i18n.localize(template.document.t === "rect" ? "rectangle" : template.document.t);
  effectData.id = template.id;
  effectData.icon ??= ACTIVE_EFFECT_ICON;
  effectData.name ??= `Measured Template ${templateShape}`;
  effectData.origin = template.document.uuid;
  return this.document.toggleActiveEffect(effectData, { active: true });
}

/**
 * New method: Token.prototype.detachTemplate
 * Detach a given template from this token.
 * @param {string|MeasuredTemplate} templateId
 */
async function detachTemplate(templateId) {
  if ( templateId instanceof MeasuredTemplate ) templateId = templateId.id;

  // Don't call template.detachToken to avoid circularity, but do check and remove this token.
  await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN_ID);

  // Remove the active effect associated with this template (if any).
  await this.document.toggleActiveEffect({ id: templateId }, { active: false });
}

PATCHES.BASIC.METHODS = { attachTemplate, detachTemplate };

// ----- NOTE: Getters ----- //

/**
 * New getter: Token.prototype.attachedTemplates
 * Provide an array of attached templates
 * @returns {MeasuredTemplate[]|ActiveEffects[]}
 */
function attachedTemplates() {
  return this.actor.effects
    .filter(e => e.origin && e.origin.includes(CONFIG.MeasuredTemplate.objectClass.name))
    .map(e => fromUuidSync(e.origin)?.object);
}

PATCHES.BASIC.GETTERS = { attachedTemplates };

// ----- NOTE: Wraps ----- //
function _applyRenderFlags(wrapper, flags) {
  this[MODULE_ID] ??= {};
  this[MODULE_ID].priorPosition ??= new PIXI.Point();
  if ( flags.refreshPosition ) this[MODULE_ID].priorPosition.copyFrom(this.position);
  return wrapper(flags);
}

async function animate(wrapped, updateData, opts) {
  const attachedTemplates = this.attachedTemplates;
  if ( !attachedTemplates.length )  return wrapped(updateData, opts);

  const props = (new Set(["x", "y"])).intersection(new Set(Object.keys(updateData)));
  if ( !props.size ) return wrapped(updateData, opts);

  let previousData;
  //for ( const prop of props ) previousData[prop] = updateData[prop];//this.document[prop];
//
//   const delta = {};
//   for ( const prop of props ) delta[prop] = updateData[prop] - previousData[prop];
//   for ( const template of attachedTemplates ) {
//     let templateData = {};
//     for ( const prop of props ) templateData[prop] = template.document[prop] + delta[prop];
//     templateData = template.document.constructor.cleanData(templateData, {partial: true});
//     await template.document.update({templateData});
//   }


  if ( opts.ontick ) {
    const ontickOriginal = opts.ontick;
    opts.ontick = (dt, anim, documentData, config) => {
      const delta = {};
      previousData ??= duplicate(documentData);
      for ( const prop of props ) delta[prop] = documentData[prop] - previousData[prop];
      attachedTemplates.forEach(t => doTemplateAnimation(t, delta, props, dt, anim, documentData, config));
      previousData = duplicate(documentData);
      ontickOriginal(dt, anim, documentData, config);
    }
  } else {
    opts.ontick = (dt, anim, documentData, config) => {
      const delta = {};
      previousData ??= duplicate(documentData);
      console.debug(`Previous ${previousData.x},${previousData.y} docData ${documentData.x},${documentData.y}`);
      for ( const prop of props ) delta[prop] = documentData[prop] - previousData[prop];
      attachedTemplates.forEach(t => doTemplateAnimation(t, delta, props, dt, anim, documentData, config));
      previousData = duplicate(documentData);
    }
  }

  return wrapped(updateData, opts);
}

function doTemplateAnimation(template, delta, props, dt, anim, documentData, config) {
  console.debug(`Animating template ${template.id} for ${delta.x},${delta.y}`);
  let templateData = {};
  for ( const prop of props ) templateData[prop] = template.document[prop] + delta[prop];

  // Update the document
  templateData = template.document.constructor.cleanData(templateData, {partial: true});
  foundry.utils.mergeObject(template.document, templateData, {insertKeys: false});

  // Refresh the Template
  template.renderFlags.set({
    refreshPosition: props.has("x") || props.has("y")
  });
}


PATCHES.BASIC.WRAPS = { _applyRenderFlags, animate };
