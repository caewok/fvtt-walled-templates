/* globals
canvas,
CONFIG,
CONST,
foundry,
game
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { ACTIVE_EFFECT_ICON, FLAGS, MODULE_ID } from "./const.js";
import { UserCloneTargets } from "./UserCloneTargets.js";
import { Settings } from "./settings.js";

export const PATCHES = {};
PATCHES.BASIC = {};

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
function controlToken(object, controlled) {
  const user = game.user;

  if ( controlled ) user._lastSelected = object.document.uuid;
  else if ( user._lastSelected === object.document.uuid ) user._lastDeselected = object.document.uuid;
}

/**
 * Hook updateToken
 * Update the position of attached templates.
 * @param {Document} document                       The existing Document which was updated
 * @param {object} changed                          Differential data that was used to update the document
 * @param {Partial<DatabaseUpdateOperation>} options Additional options which modified the update request
 * @param {string} userId                           The ID of the User who triggered the update workflow
 */
function updateToken(tokenD, changed, _options, userId) {
  if ( userId !== game.user.id ) return;

  if ( !(Object.hasOwn(changed, "x")
      || Object.hasOwn(changed, "y")
      || Object.hasOwn(changed, "elevation")
      || Object.hasOwn(changed, "rotation")) ) return;

  // Check if this token is attached to 1+ templates.
  const token = tokenD.object;
  const attachedTemplates = token.attachedTemplates;
  if ( !attachedTemplates || !attachedTemplates.length ) return;

  // Look for updates
  const updates = [];
  for ( const template of attachedTemplates ) {
    const templateData = template._calculateAttachedTemplateOffset(changed);
    if ( foundry.utils.isEmpty(templateData) ) continue;
    templateData._id = template.id;
    updates.push(templateData);
  }
  if ( updates.length ) canvas.scene.updateEmbeddedDocuments("MeasuredTemplate", updates); // Async
}

/**
 * Hook destroyToken to remove and delete attached template.
 * @param {PlaceableObject} object    The object instance being destroyed
 */
async function destroyToken(token) {
  if ( token.isPreview || !token.attachedTemplates.length ) return;

//   // Issue #50: Don't remove the active effect for a deleted unlinked token.
//   const isLinked = token.document.isLinked;
//   const promises = [];
//   for ( const t of token.attachedTemplates ) {
//     await token.detachTemplate(t, true, isLinked)
//     promises.push(t.document.delete());
//   }
//   await Promise.allSettled(promises);
}

PATCHES.BASIC.HOOKS = {
  controlToken,
  updateToken,
  destroyToken
};


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
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] ??= {};
  effectData.flags[MODULE_ID][FLAGS.ATTACHED_TEMPLATE_ID] = template.id;
  effectData.origin = template.document.uuid;
  return await this.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
}

/**
 * New method: Token.prototype.detachTemplate
 * Detach a given template from this token.
 * @param {MeasuredTemplate|string} templateId    Template to detach or its id.
 */
async function detachTemplate(templateId, detachFromTemplate = true, removeActiveEffect = true) {
  let template;
  if ( templateId instanceof CONFIG.MeasuredTemplate.objectClass ) {
    template = templateId;
    templateId = templateId.id;
  } else template = canvas.templates.documentCollection.get(templateId);

  // Remove the active effect associated with this template (if any).
  if ( removeActiveEffect) {
    const effect = this.actor.effects.find(e => templateId && e.getFlag(MODULE_ID, FLAGS.ATTACHED_TEMPLATE_ID) === templateId);
    if ( effect ) await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
  }

  // Remove this token from the template
  if ( detachFromTemplate && template ) await template.detachToken(false);
}

/**
 * New method: Token.prototype.refreshCloneTarget
 * Draw only the target arrows for the primary user.
 * @pram {ReticuleOptions} [reticule] Additional parameters to configure how the targeting reticule is drawn.
 */
function _refreshCloneTarget() {
  this.cloneTargeted ||= new Set();

  // We don't show the target arrows for a secret token disposition and non-GM users
  const isSecret = (this.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) && !this.isOwner;
  if ( !this.cloneTargeted.size || isSecret ) return;

  // Clone target overrides the normal target.
  this.targetArrows.clear();

  // Determine whether the current user has target and any other users
  const [others, user] = Array.from(this.cloneTargeted).partition(u => u === game.user);

  // For the current user, draw the target arrows.
  // Use half-transparency to distinguish from normal targets.
  if ( user.length ) {
    const opts = {
      border: { width: 2 * canvas.dimensions.uiScale }, // From _refreshTarget.
      alpha: 0.5
    }
    this._drawTargetArrows(opts);
  }

  // For other users, draw offset pips
  this._drawTargetPips();
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
  if ( !groupSelection ) user.broadcastActivity({cloneTargets: user.cloneTargets.ids});
}


PATCHES.BASIC.METHODS = {
  attachTemplate,
  detachTemplate,
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
  if ( !this?.actor?.effects ) return [];  // Issue #65, #77.
  const attachedIds = new Set();
  this.actor.effects.forEach(e => {
    const id = e.getFlag(MODULE_ID, FLAGS.ATTACHED_TEMPLATE_ID);
    if ( id ) attachedIds.add(id);
  });
  return canvas.templates.placeables.filter(t => attachedIds.has(t.id));
}



PATCHES.BASIC.GETTERS = { attachedTemplates };

// ----- NOTE: Wraps ----- //





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
  if ( !event.interactionData.clones ) return;
  event[MODULE_ID] ??= {};
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    event[MODULE_ID].draggedAttachedToken = clone;
    for ( const template of attachedTemplates ) template._onDragLeftStart(event);
  }
}

function _onDragLeftMove(wrapped, event) {
  wrapped(event);
  if ( !event.interactionData.clones ) return;

  // Trigger each attached template to drag.
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    for ( const template of attachedTemplates ) template._onDragLeftMove(event);
  }
}

// async function _onDragLeftDrop(wrapped, event) {
//   const res = await wrapped(event);
//   if ( !res || !event.interactionData.clones ) return res;
//
//   // Trigger each attached template to stop the drag.
// //   let clearPreview = false;
// //   for ( const clone of event.interactionData.clones ) {
// //     const attachedTemplates = clone.attachedTemplates;
// //     for ( const template of attachedTemplates ) await template._onDragLeftDrop(event);
// //     clearPreview ||= attachedTemplates.size;
// //   }
// //   if ( clearPreview ) canvas.templates.clearPreviewContainer(); // Not otherwise cleared b/c we are in token layer.
//   return res;
// }

function _onDragLeftCancel(wrapped, event) {
  const out = wrapped(event); // Returns false if the drag event should *not* be canceled.
  if ( !event.interactionData.clones || out === false ) return out;

  // Trigger each attached template to cancel the drag
  const formerClear = event.interactionData.clearPreviewContainer;
  event.interactionData.clearPreviewContainer = true;
  for ( const clone of event.interactionData.clones ) {
    const attachedTemplates = clone.attachedTemplates;
    for ( const template of attachedTemplates ) template._onDragLeftCancel(event);
  }
  event.interactionData.clearPreviewContainer = formerClear;
}

/**
 * Wrap Token.prototype._onHoverIn
 * If the token is visible to the user and show-on-hover is enabled,
 * display any templates that would otherwise be hidden.
 */
function _onHoverIn(wrapped, event, options) {
  showHideTemplates(this, true);
  return wrapped(event, options);
}

/**
 * Wrap Token.prototype._onHoverOut
 * If the token is visible to the user and show-on-hover is enabled,
 * display any templates that would otherwise be hidden.
 */
function _onHoverOut(wrapped, event, options) {
  showHideTemplates(this, false);
  return wrapped(event, options);
}

/**
 * Test every template on the scene.
 * If the token shape overlaps a template, show it. Otherwise hide it.
 * Skip if templates are not hidden, token is not visible, or show on hover not enabled.
 */
function showHideTemplates(token, show = true) {
  if ( !token.isVisible ) return;
  const showOnHoverSetting = Settings.get(Settings.KEYS.HIDE.SHOW_ON_HOVER);
  const tBounds = token.constrainedTokenBorder;
  const { SHOW_ON_HOVER, TOKEN_HOVER, TYPES } = FLAGS.HIDE;
  canvas.templates.placeables.forEach(t => {
    const hoverFlag = t.document.getFlag(MODULE_ID, SHOW_ON_HOVER) ?? TYPES.GLOBAL_DEFAULT;
    const canShow = hoverFlag === TYPES.ALWAYS_SHOW || (hoverFlag === TYPES.GLOBAL_DEFAULT && showOnHoverSetting);

    // Locally modify the template flags to indicate if there is a hovered token w/in the template.
    const mod = t.document.flags[MODULE_ID] ??= {};
    const showT = show && canShow && t.isVisible && t.boundsOverlap(tBounds);
    const changed = mod[TOKEN_HOVER] !== showT;
    mod[TOKEN_HOVER] = showT;
    if ( changed ) t.renderFlags.set({ refreshGrid: true });
  });
}

/**
 * Wrap Token.prototype._refreshTarget
 * Trigger refresh of the clone targets
 */
function _refreshTarget(wrapped) {
  wrapped();
  this._refreshCloneTarget();
}

/**
 * Wrap Token.prototype._draw
 * Add a PIXI.Graphics for the cloneTarget.
 * Add cloneTarget set
 */
// async function _draw(wrapped) {
//   await wrapped();
//   this.cloneTargeted ||= new Set();
// }

/**
 * Wrap Token.prototype.animate
 * Pass through animation parameters so any attached template moves with the token animation.
 * Animate from the old to the new state of this Token.
 * @param {Partial<TokenAnimationData>} to      The animation data to animate to
 * @param {object} [options]                    The options that configure the animation behavior.
 *                                              Passed to {@link Token#_getAnimationDuration}.
 * @param {number} [options.duration]           The duration of the animation in milliseconds
 * @param {number} [options.movementSpeed=6]    A desired token movement speed in grid spaces per second
 * @param {string} [options.transition]         The desired texture transition type
 * @param {Function|string} [options.easing]    The easing function of the animation
 * @param {string|symbol|null} [options.name]   The name of the animation, or null if nameless.
 *                                              The default is {@link Token#animationName}.
 * @param {Function} [options.ontick]           A on-tick callback
 * @returns {Promise<void>}                     A promise which resolves once the animation has finished or stopped
 */
async function animate(wrapped, to, options = {}) {
  const attachedTemplates = this.attachedTemplates;
  if ( !attachedTemplates.length ) return wrapped(to, options);

  if ( options.ontick ) {
    const ontickOriginal = options.ontick;
    options.ontick = (dt, anim, documentData, config) => {
      attachedTemplates.forEach(t => doTemplateAnimation(t, dt, anim, documentData, config));
      ontickOriginal(dt, anim, documentData, config);
    };
  } else {
    options.ontick = (dt, anim, documentData, config) => {
      attachedTemplates.forEach(t => doTemplateAnimation(t, dt, anim, documentData, config));
    };
  }
  return wrapped(to, options);
}

function doTemplateAnimation(template, _dt, _anim, documentData, _config) {
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



PATCHES.BASIC.WRAPS = {
  _onDragLeftStart,
  _onDragLeftMove,
//  _onDragLeftDrop, // Currently unused.
  _onDragLeftCancel,
  _refreshTarget,
  animate,

  // Show on hover
  _onHoverIn,
  _onHoverOut
};
