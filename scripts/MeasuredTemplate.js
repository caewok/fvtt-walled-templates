/* globals
canvas,
CONST,
flattenObject,
getProperty,
isEmpty,
MouseInteractionManager,
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
import { UserCloneTargets } from "./UserCloneTargets.js";

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

  const { t, distance, direction } = templateD;
  const updates = {};

  // Only create if the id does not already exist
  if (typeof templateD.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) === "undefined") {
    // In v10, setting the flag throws an error about not having id
    // template.setFlag(MODULE_ID, "enabled", getSetting(SETTINGS.DEFAULT_WALLED));
    updates[`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`] = getSetting(SETTINGS.DEFAULT_WALLS_BLOCK[t]);
  }

  if ( typeof templateD.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
    updates[`flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`] = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTION[t]);
  }

  if ( (t === "ray" || t === "cone") && getSetting(SETTINGS.DIAGONAL_SCALING[t]) ) {
    // Extend rays or cones to conform to 5-5-5 diagonal, if applicable.
    // See dndHelpers for original:
    // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L78
    updates.distance = scaleDiagonalDistance(direction, distance);
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

/**
 * Hook destroyMeasuredTemplate to remove attached token
 * @param {PlaceableObject} object    The object instance being destroyed
 */
async function destroyMeasuredTemplateHook(template) {
  if ( template._original ) return;
  await template.detachToken();
}

/**
 * Hook hoverMeasuredTemplate to trigger template hiding
 * @param {MeasuredTemplate} template
 * @param {boolean} hovering
 */
function hoverMeasuredTemplateHook(template, _hovering) {
  if ( getSetting(SETTINGS.HIDE.BORDER) ) template.renderFlags.set({ refreshTemplate: true });
  if ( getSetting(SETTINGS.HIDE.HIGHLIGHTING) ) template.renderFlags.set({ refreshGrid: true });
}


PATCHES.BASIC.HOOKS = {
  refreshMeasuredTemplate: refreshMeasuredTemplateHook,
  preCreateMeasuredTemplate: preCreateMeasuredTemplateHook,
  updateMeasuredTemplate: updateMeasuredTemplateHook,
  destroyMeasuredTemplate: destroyMeasuredTemplateHook,
  hoverMeasuredTemplate: hoverMeasuredTemplateHook
};

// ----- NOTE: Wraps ----- //

/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
function _getGridHighlightPositions(wrapper) {
  if ( getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER ) return wrapper();

  // Replicate most of _getGridHighlightPositions but include all.
  const grid = canvas.grid.grid;
  const d = canvas.dimensions;
  const {x, y, distance} = this.document;

  // Get number of rows and columns
  const [maxRow, maxCol] = grid.getGridPositionFromPixels(d.width, d.height);
  const gridDistance = (distance * 1.5) / d.distance;
  let nRows = Math.ceil(gridDistance / (d.size / grid.h));
  let nCols = Math.ceil(gridDistance / (d.size / grid.w));
  [nRows, nCols] = [Math.min(nRows, maxRow), Math.min(nCols, maxCol)];

  // Get the offset of the template origin relative to the top-left grid space
  const [tx, ty] = grid.getTopLeft(x, y);
  const [row0, col0] = grid.getGridPositionFromPixels(tx, ty);

  // Identify grid coordinates covered by the template Graphics
  const positions = [];
  for ( let r = -nRows; r < nRows; r++ ) {
    for ( let c = -nCols; c < nCols; c++ ) {
      const [gx, gy] = grid.getPixelsFromGridPosition(row0 + r, col0 + c);
      positions.push({x: gx, y: gy});
    }
  }

  // Debug
  // positions.forEach(p => Draw.point(p))
  // positions.forEach(p => Draw.shape(gridShapeForTopLeft(p), { fill: Draw.COLORS.blue, fillAlpha: 0.5 }))

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
 * Mixed wrap of MeasuredTemplate.prototype.highlightGrid
 * If the setting is set to hide, don't highlight grid unless hovering.
 */
function highlightGrid(wrapped) {
  const interactionState = this._original?.mouseInteractionManager?.state ?? this.mouseInteractionManager?.state;
  if ( !this.visible
   || this.hover
   || typeof interactionState === "undefined"
   || interactionState === MouseInteractionManager.INTERACTION_STATES.DRAG
   || !getSetting(SETTINGS.HIDE.HIGHLIGHTING) ) return wrapped();

  // Clear the existing highlight layer
  const grid = canvas.grid;
  const hl = grid.getHighlightLayer(this.highlightId);
  hl.clear();
}

/**
 * Mixed wrap of MeasuredTemplate.prototype._refreshTemplate
 * If the setting is set to hide, don't draw the border.
 */
function _refreshTemplate(wrapped) {
  const interactionState = this._original?.mouseInteractionManager?.state ?? this.mouseInteractionManager?.state;
  if ( this.hover
    || typeof interactionState === "undefined"
    || interactionState === MouseInteractionManager.INTERACTION_STATES.DRAG
    || !getSetting(SETTINGS.HIDE.BORDER) ) return wrapped();

  // Clear the existing layer and draw the texture but not the outline or origin/destination points.
  const t = this.template.clear();

  // Fill Color or Texture
  if ( this.texture ) t.beginTextureFill({texture: this.texture});
  else t.beginFill(0x000000, 0.0);

  // Draw the shape
  t.drawShape(this.shape);
}

PATCHES.BASIC.MIXES = { _getGridHighlightPositions };

// ----- Autotarget Wraps ----- //

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
  if ( this.attachedToken ) {
    // Temporarily set the event clones to this template clone.
    const tokenClones = event.interactionData.clones;
    event.interactionData.clones = [event.interactionData.attachedTemplateClones.get(this.id)];
    wrapped(event);

    // Restore the token clones.
    event.interactionData.clones = tokenClones;
    return;
  }

  wrapped(event);
  if ( !getSetting(SETTINGS.SNAP_GRID) ) return;

  // Move the clones to snapped locations.
  // Mimics MeasuredTemplate.prototype._onDragLeftMove
  const precision = event.shiftKey ? 2 : 1;
  const { origin, destination } = event.interactionData;
  for ( let c of event.interactionData.clones || [] ) {
    const snapped = canvas.grid.getSnappedPosition(c.document.x, c.document.y, precision);
    console.debug(`Clone Origin: ${origin.x},${origin.y} Destination: ${destination.x},${destination.y}; Snapped: ${snapped.x},${snapped.y} Doc: ${c.document.x},${c.document.y}`);
    c.document.x = snapped.x;
    c.document.y = snapped.y;
    c.renderFlags.set({refresh: true});
  }
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

function destroy(wrapped, options) {
  if ( this._original ) {
    if ( this.releaseTargets ) this.releaseTargets();
    if ( this._original?.autotargetTokens ) this._original.autotargetTokens();
  }
  return wrapped(options);
}


/**
 * Control display of border when rendering the template.
 */
function _applyRenderFlags(wrapped, flags) {
  const interactionState = this.interactionState;
  const canHide = !(this.hover
    || this.isPreview
    || !this.visible
    || typeof interactionState === "undefined"
    || interactionState === MouseInteractionManager.INTERACTION_STATES.DRAG);

  // Control the border visibility by changing its thickness.
  if ( flags.refreshTemplate ) {
    if ( canHide && getSetting(SETTINGS.HIDE.BORDER) ) {
      if ( this._borderThickness ) this._oldBorderThickness = this._borderThickness;
      this._borderThickness = 0;
    } else {
      this._borderThickness = this._oldBorderThickness || 3;
    }
  }

  wrapped(flags);

  // Control the highlight visibility by changing its alpha.
  if ( flags.refreshGrid || flags.refreshState ) {
    const hl = canvas.grid.getHighlightLayer(this.highlightId);
    if ( canHide && getSetting(SETTINGS.HIDE.HIGHLIGHTING) ) {
      hl.alpha = 0;
    } else {
      hl.alpha = this.document.hidden ? 0.5 : 1;
    }
  }
}

PATCHES.BASIC.WRAPS = {
  _computeShape,
  _canDrag,
  clone,
  _onDragLeftStart,
  _onDragLeftMove,
  _onDragLeftCancel,
  _onDragLeftDrop,
  destroy,
  _applyRenderFlags
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
  if ( !attachedToken ) return;

  // It is possible that the document gets destroyed while we are waiting around for the flag.
  try { await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ID);
  } catch(error ) {}
  try { await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.DELTAS);
  } catch(error) {}

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

PATCHES.BASIC.METHODS = {
  boundsOverlap,
  attachToken,
  detachToken,
  _calculateAttachedTemplateOffset };

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
  if ( flags.retarget && template.autotargetTokens ) template.autotargetTokens();
}

PATCHES.AUTOTARGET.HOOKS = { refreshMeasuredTemplate: refreshMeasuredTemplateHook };

// ----- NOTE: Methods ----- //
/**
 * New method: MeasuredTemplate.prototype.autotarget
 * Target tokens within the template area.
 */
function autotargetTokens({ onlyVisible = false } = {}) {
  log("autotargetTokens", this);
  if ( !getSetting(SETTINGS.AUTOTARGET.ENABLED) ) return this.releaseTargets();

  log(`Autotarget ${this._original ? "clone" : "original"} with ${this.targets.size} targets.`);
  const tokens = new Set(this.targetsWithinShape({onlyVisible}));
  const tokensToRelease = this.targets.difference(tokens);

  this.releaseTargets({ tokens: tokensToRelease, broadcast: false });
  this.acquireTargets({ tokens, broadcast: true, onlyVisible: false, checkShapeBounds: false });
  log(`Autotarget ${this._original ? "clone" : "original"} finished with ${this.targets.size} targets remaining.`);
}

/**
 * New method: MeasuredTemplate.prototype.releaseTargets
 * Release targets held by this template for this template document user.
 * @param {object} [opts]                       Options for narrowing target choices
 * @param {Set<Token>} [opts.tokens]            Release only tokens within this set
 * @param {boolean} [opts.broadcast=true]       Broadcast the user target change
 */
function releaseTargets({ tokens, broadcast = true } = {}) {
  const targetsToRelease = tokens ? this.targets.intersection(tokens) : this.targets;
  if ( !targetsToRelease.size ) return;

  // Release targets for this user.
  const user = this.document.user;
  let targetFn = "setTarget";
  let userTargets = user.targets;
  let broadcastOpts = { targets: user.targets.ids };
  if ( this._original ) { // Template is clone
    user.cloneTargets ||= new UserCloneTargets(user);
    targetFn = "setCloneTarget";
    userTargets = user.cloneTargets;
    broadcastOpts = { cloneTargets: user.cloneTargets.ids };
  }
  const userTargetsToRelease = targetsToRelease.intersection(userTargets);
  for ( const t of userTargetsToRelease ) {
    log(`Template ${this._original ? "clone" : "original"} releasing ${t.name}`);

    // When switching to a new scene, Foundry will sometimes try to setTarget using
    // token.position, but token.position throws an error. Maybe canvas not loaded?
    try {
      t[targetFn](false, { user, releaseOthers: false, groupSelection: true });
    } catch( error ) {
      console.debug(error);
    }
  }

  // Wipe the targets from this template.
  if ( targetsToRelease === this.targets ) this.targets.clear();
  else targetsToRelease.forEach(t => this.targets.delete(t));

  // Broadcast the target change
  if ( broadcast ) user.broadcastActivity(broadcastOpts);
}

/**
 * New method: MeasuredTemplate.prototype.acquireTargets
 * Acquire targets for this template. Targets must be within template shape to qualify.
 * @param {object} [opts]                         Options for narrowing target choices
 * @param {Set<Token>|Token[]} [opts.tokens]      Acquire tokens within this set
 * @param {boolean} [opts.checkShapeBounds=true]  Test the tokens against the shape bounds
 * @param {boolean} [opts.onlyVisible=false]      Acquire only visible tokens
 * @param {boolean} [opts.broadcast=true]         Broadcast the user target change
 */
function acquireTargets({ tokens, checkShapeBounds = true, onlyVisible = false, broadcast = true } = {}) {
  if ( tokens ) {
    if ( tokens instanceof Array ) tokens = new Set(tokens);
    if ( checkShapeBounds ) tokens = new Set(this.targetsWithinShape({onlyVisible})).intersection(tokens);
    else if ( onlyVisible ) tokens = tokens.filter(t => t.visible);
  } else tokens = new Set(this.targetsWithinShape({onlyVisible}));
  const targetsToAcquire = tokens.difference(this.targets);
  if ( !targetsToAcquire.size ) return;

  // Acquire targets for this user.
  const user = this.document.user;
  let targetFn = "setTarget";
  let userTargets = user.targets;
  let broadcastOpts = { targets: user.targets.ids };
  if ( this._original ) { // Template is clone
    user.cloneTargets ||= new UserCloneTargets(user);
    targetFn = "setCloneTarget";
    userTargets = user.cloneTargets;
    broadcastOpts = { cloneTargets: user.cloneTargets.ids };
  }
  const userTargetsToAcquire = targetsToAcquire.difference(userTargets);

  for ( const t of userTargetsToAcquire ) {
    // When switching to a new scene, Foundry will sometimes try to setTarget using
    // token.position, but token.position throws an error. Maybe canvas not loaded?
    try {
      t[targetFn](true, { user, releaseOthers: false, groupSelection: true });
    } catch( error ) {
      console.debug(error);
    }
  }

  // Add targets to this template
  targetsToAcquire.forEach(t => this.targets.add(t));

  // Broadcast the target change
  if ( broadcast ) user.broadcastActivity(broadcastOpts);
}

function targetsWithinShape({ onlyVisible = false } = {}) {
  return canvas.tokens.placeables.filter(token => {
    if ( onlyVisible && !token.visible ) return false;
    if ( !token.hitArea ) return false; // Token not yet drawn. See Token.prototype._draw.

    // Midi-qol; Walled Templates issue #28, issue #37.
    if ( getProperty(token, "actor.flags.midi-qol.neverTarget")
      || getProperty(token, "actor.system.details.type.custom")?.includes("NoTarget") ) return false;

    const tBounds = tokenBounds(token);
    return this.boundsOverlap(tBounds);
  });
}

PATCHES.AUTOTARGET.METHODS = {
  autotargetTokens,
  releaseTargets,
  acquireTargets,
  targetsWithinShape,
  targets: new Set()
};

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

