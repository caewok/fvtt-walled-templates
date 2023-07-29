/* globals
canvas,
CONST,
flattenObject,
game,
getProperty,
isEmpty,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplateShape } from "./template_shapes/WalledTemplateShape.js";
import { log, gridShapeForTopLeft } from "./util.js";
import { MODULE_ID, FLAGS } from "./const.js";
import { getSetting, SETTINGS } from "./settings.js";
import { Hexagon } from "./geometry/RegularPolygon/Hexagon.js";
import { Square } from "./geometry/RegularPolygon/Square.js";

export const PATCHES = {};
PATCHES.BASIC = {};
PATCHES.AUTOTARGET = {};

// ----- NOTE: Hooks ----- //

/**
 * Hook preCreateMeasuredTemplate to
 * @param {MeasuredTemplateDocument} template
 * @param {Object} data
 * @param {Object} opt { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
function preCreateMeasuredTemplateHook(templateD, updateData, _opts, _id) {
  log("Hooking preCreateMeasuredTemplate", templateD, updateData);

  const { distance: gridDist, size: gridSize } = canvas.scene.grid;
  const { t, distance, direction, x, y } = templateD;
  const updates = {};

  // Only create if the id does not already exist
  if (typeof templateD.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    // In v10, setting the flag throws an error about not having id
    // template.setFlag(MODULE_ID, "enabled", getSetting(SETTINGS.DEFAULT_WALLED));
    updates[`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`] = getSetting(SETTINGS.DEFAULTS[t]);
  }

  if ( typeof templateD.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
    updates[`flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`] = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[t]);
  }

  if ( getSetting(SETTINGS.DIAGONAL_SCALING[t]) ) {
    if ( t === "circle" && ((distance / gridDist) >= 1) ) {
      // Switch circles to squares if applicable
      // Conforms with 5-5-5 diagonal rule.
      // Only if the template is 1 grid unit or larger.
      // See dndHelpers for original:
      // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L91
      const radiusPx = ( distance / gridDist ) * gridSize;

      // Calculate the square's hypotenuse based on the 5-5-5 diagonal distance
      const length = distance * 2;
      const squareDist = Math.hypot(length, length);

      log(`preCreateMeasuredTemplate: switching circle ${x},${y} distance ${distance} to rectangle ${x - radiusPx},${y - radiusPx} distance ${squareDist}`);

      updates.x = templateD.x - radiusPx;
      updates.y = templateD.y - radiusPx;
      updates.direction = 45;
      updates.distance = squareDist;
      updates.t = "rect";

    } else if ( t === "ray" || t === "cone" ) {
      // Extend rays or cones to conform to 5-5-5 diagonal, if applicable.
      // See dndHelpers for original:
      // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L78
      updates.distance = scaleDiagonalDistance(direction, distance);
    }
  }

  if ( !isEmpty(updates) ) templateD.updateSource(updates);
}

/**
 * Hook updateMeasuredTemplate to set render flag based on change to the WalledTemplate config.
 * @param {Document} document                       The existing Document which was updated
 * @param {object} change                           Differential data that was used to update the document
 * @param {DocumentModificationContext} options     Additional options which modified the update request
 * @param {string} userId                           The ID of the User who triggered the update workflow
 */
function updateMeasuredTemplateHook(templateD, data, _options, _userId) {
  const wtChangeFlags = [
    `flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`,
    `flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`
  ];

  const changed = new Set(Object.keys(flattenObject(data)));
  if ( wtChangeFlags.some(k => changed.has(k)) ) templateD.object.renderFlags.set({
    refreshShape: true
  });
}


PATCHES.BASIC.HOOKS = {
  refreshMeasuredTemplate: refreshMeasuredTemplateHook,
  preCreateMeasuredTemplate: preCreateMeasuredTemplateHook,
  updateMeasuredTemplate: updateMeasuredTemplateHook
};

// ----- NOTE: Wraps ----- //

/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
function _getGridHighlightPositions(wrapper) {
  const positions = wrapper();

  const enabled = this.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) !== SETTINGS.DEFAULTS.CHOICES.UNWALLED;
  const need_targeting = !getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER;
  if ( !(enabled || need_targeting) ) return positions;

  return positions.filter(p => {
    const shape = gridShapeForTopLeft(p);
    return this.boundsOverlap(shape);
  });
}

/**
 * Wrap MeasuredTemplate.prototype._computeShape
 * Allow the original shape to be constructed, then build from that.
 * @returns {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon}
 */
function _computeShape(wrapped) {
  // Store the original shape.
  const wt = this[MODULE_ID] ??= {};
  wt.originalShape = wrapped();

  const walledClass = WalledTemplateShape.shapeCodeRegister.get(this.document.t);
  if ( !walledClass ) return wt.originalShape;

  wt.walledTemplate = new walledClass(this);
  return wt.walledTemplate.computeShape();
}

/**
 * Wrap MeasuredTemplate.prototype._canDrag
 * Don't allow dragging of attached templates.
 */
function _canDrag(wrapped, user, event) {
  if ( this.attachedToken ) return false;
  return wrapped(user, event);
}

/**
 * Wrap MeasuredTemplate.prototype.clone
 * Clone the shape
 * @returns {PlaceableObject}
 */
function clone(wrapped) {
  const clone = wrapped();

  // Ensure shape is not shared with original.
  clone.renderFlags.set({ refreshShape: true });
  return clone;
}

/**
 * Wrap MeasuredTemplate.prototype._onDragLeftStart
 * If this is a clone
 */
function _onDragLeftStart(wrapped, event) {
  if ( !this.attachedToken ) return wrapped(event);

  // Store token and template clones separately.
  const tokenClones = event.interactionData.clones;
  wrapped(event);
  event.interactionData.attachedTemplateClones ??= new Map();

  // Only one clone will be created for this template; retrieve and store.
  const templateClone = event.interactionData.clones[0];
  event.interactionData.attachedTemplateClones.set(templateClone.id, templateClone);

  // Restore the token clones.
  event.interactionData.clones = tokenClones;
}

function _onDragLeftMove(wrapped, event) {
  if ( !this.attachedToken ) return wrapped(event);

  // Temporarily set the event clones to this template clone.
  const tokenClones = event.interactionData.clones;
  event.interactionData.clones = [event.interactionData.attachedTemplateClones.get(this.id)];
  wrapped(event);

  // Restore the token clones.
  event.interactionData.clones = tokenClones;
}

function _onDragLeftCancel(wrapped, event) {
  return wrapped(event);
}

function _onDragLeftDrop(wrapped, event) {
  if ( !this.attachedToken ) return wrapped(event);

  // Temporarily set the event clones to this template clone.
  const tokenClones = event.interactionData.clones;
  event.interactionData.clones = [event.interactionData.attachedTemplateClones.get(this.id)];
  wrapped(event);

  // Restore the token clones.
  event.interactionData.clones = tokenClones;
}


PATCHES.BASIC.WRAPS = {
  _getGridHighlightPositions,
  _computeShape,
  _canDrag,
  clone,
  _onDragLeftStart,
  _onDragLeftMove,
  _onDragLeftCancel,
  _onDragLeftDrop

};

// ----- NOTE: Methods ----- //

/**
 * New method: MeasuredTemplate.prototype.boundsOverlap
 * For a given bounds shape, determine if it overlaps the template according to
 * provided settings. Will translate the bounds to template origin.
 * @param {PIXI.Rectangle|Hexagon}  bounds    Boundary shape, with true position on grid.
 * @return {Boolean}
 */
function boundsOverlap(bounds) {
  const tBounds = bounds.translate(-this.x, -this.y);

  if ( getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER ) {
    return this.shape.contains(tBounds.center.x, tBounds.center.y);
  }

  // Using SETTINGS.AUTOTARGET.METHODS.OVERLAP
  if ( !tBounds.overlaps(this.shape) ) { return false; }

  const area_percentage = getSetting(SETTINGS.AUTOTARGET.AREA);
  if ( !area_percentage ) { return true; }

  // Calculate the area of overlap by constructing the intersecting polygon between the
  // bounds and the template shape.
  const poly = boundsShapeIntersection(tBounds, this.shape);
  if ( !poly || poly.points.length < 3 ) return false;
  const b_area = bounds.area;
  const p_area = poly.area;
  const target_area = b_area * area_percentage;

  return p_area > target_area || p_area.almostEqual(target_area); // Ensure targeting works at 0% and 100%
}

/**
 * New method: MeasuredTemplate.prototype.attachToken
 * Attach the provided token to the template, so that both move in sync.
 * A template can have only one token attached.
 * The token id is added to this template flags.
 * An active effect is added to the token to indicate the template is attached.
 * If this template is attached to another token, it is detached first.
 * @param {Token} token           Token to attach
 * @param {object} [effectData]   Data passed to the token as an active effect
 * @param {opts}
 */
async function attachToken(token, effectData, attachToToken = true) {
  // Detach existing token, if any
  await this.detachToken();

  // Attach this template to the token as an active effect.
  if ( attachToToken ) await token.attachTemplate(this, effectData, false);

  // Attach token to the template.
  await this.document.setFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ID, token.id);

  // Record the difference between the token and template for specific properties.
  // Use the token document naming scheme.
  const delta = {};
  delta.x = this.document.x - token.x;
  delta.y = this.document.y - token.y;
  delta.elevation = this.elevationE - token.elevationE;

  // If the template originates from the token, rotate with the token.
  const center = PIXI.Point.fromObject(token.center);
  if ( center.almostEqual(this) ) delta.rotation = this.document.direction - token.document.rotation;

  // Attach deltas to the template. These should remain constant so long as the token is attached.
  await this.document.setFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.DELTAS, delta);
}

/**
 * New method: MeasuredTemplate.prototype.detachToken
 * Detach the token, if any, from this template.
 */
async function detachToken(detachFromToken = true) {
  const attachedToken = this.attachedToken;
  await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ID);
  await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.DELTAS);

  if ( detachFromToken && attachedToken ) await attachedToken.detachTemplate(this, false);
}

/**
 * New method: Retrieve template change data based on a token document object
 * Construct a template data object that can be used for updating based on the delta from the token.
 * @param {object|TokenDocument} tokenData    Object with token data to offset.
 * @returns {object} Object of adjusted data for the template
 */
function _calculateAttachedTemplateOffset(tokenD) {
  const delta = this.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.DELTAS);
  if ( !delta ) return {};
  const templateData = {};
  if ( Object.hasOwn(tokenD, "x") ) templateData.x = tokenD.x + delta.x;
  if ( Object.hasOwn(tokenD, "y") ) templateData.y = tokenD.y + delta.y;
  if ( Object.hasOwn(tokenD, "elevation") ) {
    // Note: cleanData requires the actual object, no string properties
    // templateData.flags.["flags.elevatedvision.elevation"] = tokenD.elevation + delta.elevation;
    const elevation = tokenD.elevation + delta.elevation;
    templateData.flags = { elevatedvision: { elevation }};
  }
  if ( Object.hasOwn(tokenD, "rotation") && Object.hasOwn(delta, "rotation") ) {
    templateData.direction = Math.normalizeDegrees(tokenD.rotation + delta.rotation);
  }
  return this.document.constructor.cleanData(templateData, {partial: true});
}

PATCHES.BASIC.METHODS = { boundsOverlap, attachToken, detachToken, _calculateAttachedTemplateOffset };

// ----- NOTE: Getters ----- //
/**
 * New getter: MeasuredTemplate.prototype.attachedToken
 * @type {Token}
 */
function attachedToken() {
  const attachedTokenId = this.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ID);
  return canvas.tokens.documentCollection.get(attachedTokenId)?.object;
}

/**
 * New getter: MeasuredTemplate.prototype.wallsBlock
 * @type {boolean}
 */
function wallsBlock() { return this.walledtemplates?.walledTemplate?.doWallsBlock; }

PATCHES.BASIC.GETTERS = { attachedToken, wallsBlock };

// ----- NOTE: Autotargeting ----- //

// ----- Note: Hooks ----- //

/**
 * Hook template refresh to address the retarget renderFlag.
 * Target tokens after drawing/refreshing the template.
 * See MeasuredTemplate.prototype._applyRenderFlags.
 * @param {PlaceableObject} object    The object instance being refreshed
 * @param {RenderFlags} flags
 */
function refreshMeasuredTemplateHook(template, flags) {
  if ( flags.retarget ) template.autotargetTokens();
  // if ( flags.refreshPosition && template.wallsBlock ) template.renderFlags.set({refreshShape: true});
}

PATCHES.AUTOTARGET.HOOKS = { refreshMeasuredTemplate: refreshMeasuredTemplateHook };

// ----- NOTE: Methods ----- //
/**
 * New method: MeasuredTemplate.prototype.autotarget
 * Target tokens within the template area.
 */
function autotargetTokens({ only_visible = false } = {}) {
  log("autotargetTokens", this);

  const targets = canvas.tokens.placeables.filter(token => {
    if ( only_visible && !token.visible ) return false;
    if ( !token.hitArea ) return false; // Token not yet drawn. See Token.prototype._draw.

    // Midi-qol; Walled Templates issue #28.
    if ( getProperty(token, "actor.system.details.type.custom")?.includes("NoTarget") ) return false;

    const tBounds = tokenBounds(token);
    return this.boundsOverlap(tBounds);
  });

  log(`autotargetTokens|${targets.length} targets.`);
  if ( getSetting(SETTINGS.AUTOTARGET.ENABLED) ) releaseAndAcquireTargets(targets, this.document.user);
  else releaseTargets(targets, this.document.user);
}

/**
 * New method: Retrieve template change data based on a token document object
 * Construct a template data object that can be used for updating based on the delta from the token.
 * @param {object|TokenDocument} tokenData    Object with token data to offset.
 * @returns {object} Object of adjusted data for the template
 */
function _calculateAttachedTemplateOffset(tokenD) {
  const delta = this.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.DELTAS);
  if ( !delta ) return {};
  const templateData = {};
  if ( Object.hasOwn(tokenD, "x") ) templateData.x = tokenD.x + delta.x;
  if ( Object.hasOwn(tokenD, "y") ) templateData.y = tokenD.y + delta.y;
  if ( Object.hasOwn(tokenD, "elevation") ) {
    // cleanData requires the actual object, no string properties
    // templateData.flags.["flags.elevatedvision.elevation"] = tokenD.elevation + delta.elevation;
    const elevation = tokenD.elevation + delta.elevation;
    templateData.flags = { elevatedvision: { elevation }};
  }
  if ( Object.hasOwn(tokenD, "rotation") && Object.hasOwn(delta, "rotation") ) {
    templateData.direction = Math.normalizeDegrees(tokenD.rotation + delta.rotation);
  }
  return this.document.constructor.cleanData(templateData, {partial: true});
}

PATCHES.AUTOTARGET.METHODS = { autotargetTokens, _calculateAttachedTemplateOffset };

// ----- NOTE: Helper functions ----- //

/**
 * Return the intersection of the bounds shape with the template shape.
 * Bounds shape should already be translated to the template {0, 0} origin.
 * @param {PIXI.Rectangle|Hexagon|Square}           tBounds
 * @param {PIXI.Polygon
          |PIXI.Circle
          |PIXI.Rectangle}  shape
 * @return {PIXI.Polygon}
 */
function boundsShapeIntersection(tBounds, shape) {
  // Intersection of two PIXI.Rectangles returns PIXI.Rectangle; convert to Polygon
  if ( shape instanceof PIXI.Rectangle
    && tBounds instanceof PIXI.Rectangle ) return tBounds.intersection(shape).toPolygon();

  if ( shape instanceof PIXI.Polygon ) return tBounds.intersectPolygon(shape);

  // Shape should be circle
  return shape.intersectPolygon(tBounds.toPolygon());
}

/**
 * Given an array of target tokens, release all other targets for the user and target
 * these.
 * @param {Token[]} targets
 */
function releaseAndAcquireTargets(targets, user = game.user) {
  // Closely follows TokenLayer.prototype.targetObjects

  // Release other targets
  for ( let t of user.targets ) {
    if ( !targets.includes(t) ) {
      log(`Un-targeting token ${t.id}`, t);
      // When switching to a new scene, Foundry will sometimes try to setTarget using
      // token.position, but token.position throws an error. Maybe canvas not loaded?
      try {
        t.setTarget(false, { releaseOthers: false, groupSelection: true });
      } catch(error) {
        log(error); // Just log it b/c probably not (easily) fixable
      }
    }
  }

  // Acquire targets for those not yet targeted
  targets.forEach(t => {
    if ( !user.targets.has(t) ) {
      log(`Targeting token ${t.id}`, t);
      // When switching to a new scene, Foundry will sometimes try to setTarget using
      // token.position, but token.position throws an error. Maybe canvas not loaded?
      try {
        t.setTarget(true, { user, releaseOthers: false, groupSelection: true });
      } catch(error) {
        log(error); // Just log it b/c probably not (easily) fixable
      }
    }
  });

  // Broadcast the target change
  user.broadcastActivity({ targets: user.targets.ids });
}

/**
 * Given an array of target tokens, release those for the user.
 * @param {Token[]} targets
 */
function releaseTargets(targets, user = game.user) {
  // Release other targets
  for ( let t of user.targets ) {
    if ( targets.includes(t) ) {
      log(`Un-targeting token ${t.id}`, t);
      // When switching to a new scene, Foundry will sometimes try to setTarget using
      // token.position, but token.position throws an error. Maybe canvas not loaded?
      try {
        t.setTarget(false, { releaseOthers: false, groupSelection: true });
      } catch(error) {
        log(error); // Just log it b/c probably not (easily) fixable
      }
    }
  }

  // Broadcast the target change
  user.broadcastActivity({ targets: user.targets.ids });
}

/**
 * Return either a square- or hexagon-shaped hit area object based on grid type
 * @param {Token} token
 * @return {PIXI.Rectangle|Hexagon}
 */
function tokenBounds(token) {
  if ( canvas.scene.grid.type === CONST.GRID_TYPES.GRIDLESS
    || canvas.scene.grid.type === CONST.GRID_TYPES.SQUARE ) {
    return Square.fromToken(token);
  }
  return Hexagon.fromToken(token);
}

function scaleDiagonalDistance(direction, distance) {
  const dirRadians = Math.toRadians(direction);
  const diagonalScale = Math.abs(Math.sin(dirRadians)) + Math.abs(Math.cos(dirRadians));
  return diagonalScale * distance;
}

