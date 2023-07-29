/* globals
canvas,
CONFIG,
CONST,
foundry,
fromUuidSync,
game,
isEmpty,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, ACTIVE_EFFECT_ICON } from "./const.js";
import { UserCloneTargets } from "./UserCloneTargets.js";

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
//   console.debug(`preUpdateToken hook ${changes.x}, ${changes.y}, ${changes.elevation} at elevation ${token.document?.elevation} with elevationD ${tokenD.elevation}`, changes);
//   console.debug(`preUpdateToken hook moving ${tokenD.x},${tokenD.y} --> ${changes.x ? changes.x : tokenD.x},${changes.y ? changes.y : tokenD.y}`);
}

/**
 * Hook updateToken
 */
function updateTokenHook(tokenD, changed, _options, _userId) {
  const token = tokenD.object;
//   console.debug(`updateToken hook ${changed.x}, ${changed.y}, ${changed.elevation} at elevation ${token.document?.elevation} with elevationD ${tokenD.elevation}`, changed);
//   console.debug(`updateToken hook moving ${tokenD.x},${tokenD.y} --> ${changed.x ? changed.x : tokenD.x},${changed.y ? changed.y : tokenD.y}`);

  const attachedTemplates = token.attachedTemplates;
  if ( !attachedTemplates.length ) return;

  // TODO: Update elevation, rotation
  const props = (new Set(["x", "y", "elevation", "rotation"])).intersection(new Set(Object.keys(changed)));
  if ( !props.size ) return;

  const updates = [];
  for ( const template of token.attachedTemplates ) {
//     console.debug(`Updating template ${template.id}. Current: ${template.document.x},${template.document.y}. Token: ${tokenD.x},${tokenD.y}`);
    const templateData = template._calculateAttachedTemplateOffset(changed);
    if ( isEmpty(templateData) ) continue;
    templateData._id = template.id;
    updates.push(templateData);
//     console.debug(`Updating template ${template.id} to ${updates.at(-1).x},${updates.at(-1).y}`, templateData);
  }
  if ( updates.length ) canvas.scene.updateEmbeddedDocuments("MeasuredTemplate", updates);
}

/**
 * Hook Token refresh
 */
function refreshTokenHook(token, flags) {
  if ( !flags.refreshPosition ) return;
  // TODO: refreshElevation flag?
//   console.debug(`refreshToken for ${token.name} at ${token.position.x},${token.position.y}. Token is ${token._original ? "Clone" : "Original"}. Token is ${token._animation ? "" : "not "}animating.`);

  if ( token._original ) {
    // clone
//     console.debug(`clone of ${token.name} at ${token.position.x},${token.position.y} and document ${token.document.x}, ${token.document.y}`);

  }

  if ( token._animation ) {
    // animating
//     console.debug(`${token.name} at ${token.position.x},${token.position.y} and document ${token.document.x}, ${token.document.y}`);
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
async function attachTemplate(template, effectData = {}, attachToTemplate = true) {
  // Detach existing token from the template, if any.
  await this.detachTemplate(template);

  // Attach token to the template.
  if ( attachToTemplate ) await template.attachToken(this, effectData, false);

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
 * @param {MeasuredTemplate|string} templateId    Template to detach or its id.
 */
async function detachTemplate(templateId, detachFromTemplate = true) {
  let template;
  if ( templateId instanceof CONFIG.MeasuredTemplate.objectClass ) {
    template = templateId;
    templateId = templateId.id;
  } else template = canvas.templates.documentCollection.get(templateId);

  // Remove the active effect associated with this template (if any).
  await this.document.toggleActiveEffect({ id: templateId }, { active: false });

  // Remove this token from the template
  if ( detachFromTemplate && template ) await template.detachToken(false);
}

/**
 * New method: Token.prototype.refreshCloneTarget
 * Draw only the target arrows for the primary user.
 * @pram {ReticuleOptions} [reticule] Additional parameters to configure how the targeting reticule is drawn.
 */
function _refreshCloneTarget(reticule) {
  this.cloneTarget ||= this.addChild(new PIXI.Graphics());
  this.cloneTarget.clear();

  // We don't show the target arrows for a secret token disposition and non-GM users
  const isSecret = (this.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) && !this.isOwner;
  if ( !this.cloneTargeted.size || isSecret ) return;

  // Determine whether the current user has target and any other users
  const [others, user] = Array.from(this.cloneTargeted).partition(u => u === game.user);

  // For the current user, draw the target arrows.
  if ( user.length ) {
    // Use half-transparency to distinguish from normal targets.
    reticule ||= {};
    reticule.alpha = 0.5;

    // So we can re-use drawTarget; swap in the clone target graphic.
    const origTarget = this.target;
    this.target = this.cloneTarget;
    this._drawTarget(reticule);
    this.target = this.cloneTarget;
  }
}

/**
 * New method: Token.prototype.setCloneTarget
 * @param {boolean} targeted                        Is the Token now targeted?
 * @param {object} [context={}]                     Additional context options
 * @param {User|null} [context.user=null]           Assign the token as a target for a specific User
 * @param {boolean} [context.releaseOthers=true]    Release other active targets for the same player?
 * @param {boolean} [context.groupSelection=false]  Is this target being set as part of a group selection workflow?
 */
function setCloneTarget(targeted=true, {user=null, releaseOthers=true, groupSelection=false}={}) {
  // Do not allow setting a preview token as a target
  if ( this.isPreview ) return;

  // Release other targets
  user = user || game.user;
  user.cloneTargets ||= new UserCloneTargets(user);
  if ( user.cloneTargets.size && releaseOthers ) {
    user.cloneTargets.forEach(t => {
      if ( t !== this ) t.setCloneTarget(false, {user, releaseOthers: false, groupSelection});
    });
  }

  const wasTargeted = this.cloneTargeted.has(user);

  // Acquire target
  if ( targeted ) {
    this.cloneTargeted.add(user);
    user.cloneTargets.add(this);
  }

  // Release target
  else {
    this.cloneTargeted.delete(user);
    user.cloneTargets.delete(this);
  }

  if ( wasTargeted !== targeted ) {
    // Refresh Token display
    this.renderFlags.set({refreshTarget: true});

    // Refresh the Token HUD
    if ( this.hasActiveHUD ) this.layer.hud.render();
  }

  // Broadcast the target change
  // if ( !groupSelection ) user.broadcastActivity({targets: user.targets.ids});
}


PATCHES.BASIC.METHODS = {
  attachTemplate,
  detachTemplate,
  cloneTargeted: new Set([]),  // Store targets created when dragging templates.
  _refreshCloneTarget,
  setCloneTarget
};

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

/**
 * Wrap Token.prototype.animate
 * Cannot just use the `preUpdate` hook b/c it does not pass back options to Token.prototype._updateData.
 */
async function animate(wrapped, updateData, opts) {
  const attachedTemplates = this.attachedTemplates;
  if ( !attachedTemplates.length ) return wrapped(updateData, opts);

  const props = (new Set(["x", "y", "elevation", "rotation"])).intersection(new Set(Object.keys(updateData)));
  if ( !props.size ) return wrapped(updateData, opts);

  if ( opts.ontick ) {
    const ontickOriginal = opts.ontick;
    opts.ontick = (dt, anim, documentData, config) => {
      attachedTemplates.forEach(t => doTemplateAnimation(t, dt, anim, documentData, config));

      ontickOriginal(dt, anim, documentData, config);
    };
  } else {
    opts.ontick = (dt, anim, documentData, config) => {
      attachedTemplates.forEach(t => doTemplateAnimation(t, dt, anim, documentData, config));
    };
  }

  return wrapped(updateData, opts);
}

function doTemplateAnimation(template, _dt, _anim, documentData, _config) {
  console.debug(`Animating template ${template.id}. Current: ${template.document.x},${template.document.y}. Token: ${documentData.x},${documentData.y}`);
  const templateData = template._calculateAttachedTemplateOffset(documentData);

  // Update the document
  foundry.utils.mergeObject(template.document, templateData, { insertKeys: false });

  // Refresh the Template
  template.renderFlags.set({
    refreshPosition: Object.hasOwn(templateData, "x") || Object.hasOwn(templateData, "y"),
    refreshElevation: Object.hasOwn(templateData, "elevation"),
    refreshShape: Object.hasOwn(templateData, "direction")
  });
}

/**
 * Wrap Token.prototype.clone
 * Clone attached templates for use in dragging.
 */
// function clone(wrapped) {
//   const tokenClone = wrapped();
//   const attachedTemplates = this.attachedTemplates;
//   if ( !attachedTemplates.length ) return clone;
//   tokenClone[MODULE_ID] ??= {};
//   const map = tokenClone[MODULE_ID].clonedTemplates = [];
//   for ( const template of attachedTemplates ) map.set(template.id, template.clone());
//   return tokenClone;
// }

/**
 * Wrap Token.prototype._onDragLeftStart
 * Trigger the attached template(s) to drag in sync.
 * @param {PIXI.FederatedEvent} event   The triggering canvas interaction event
 */
function _onDragLeftStart(wrapped, event) {
  wrapped(event);

  // Trigger each attached template to drag.
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    for ( const template of attachedTemplates ) template._onDragLeftStart(event);
  }
}

function _onDragLeftMove(wrapped, event) {
  wrapped(event);

  // Trigger each attached template to drag.
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    for ( const template of attachedTemplates ) template._onDragLeftMove(event);
  }
}

function _onDragLeftDrop(wrapped, event) {
  wrapped(event);

  // Trigger each attached template to drag.
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    for ( const template of attachedTemplates ) template._onDragLeftDrop(event);
  }
}

function _onDragLeftCancel(wrapped, event) {
  wrapped(event);

  // Trigger each attached template to drag.
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    for ( const template of attachedTemplates ) template._onDragLeftCancel(event);
  }
}

/**
 * Wrap Token.prototype._refreshTarget
 * Trigger refresh of the clone targets
 * @param {ReticuleOptions} [reticule]  Additional parameters to configure how the targeting reticule is drawn.
 */
function _refreshTarget(wrapped, reticule) {
  wrapped(reticule);
  this._refreshCloneTarget(reticule);
}


PATCHES.BASIC.WRAPS = {
  animate,
  _onDragLeftStart,
  _onDragLeftMove,
  _onDragLeftDrop,
  _onDragLeftCancel,
  _refreshTarget };
