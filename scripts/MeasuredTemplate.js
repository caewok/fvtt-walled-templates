/* globals
canvas,
CONFIG,
foundry,
game,
getProperty,
MouseInteractionManager,
PIXI,
PreciseText,
_token
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplateShape } from "./template_shapes/WalledTemplateShape.js";
import { log, gridShapeForTopLeft, tokenBounds } from "./util.js";
import { MODULE_ID, FLAGS, MODULES } from "./const.js";
import { Settings } from "./settings.js";
import { Square } from "./geometry/RegularPolygon/Square.js";
import { UserCloneTargets } from "./UserCloneTargets.js";
import { addDnd5eItemConfigurationToTemplate } from "./dnd5e.js";

export const PATCHES = {};
PATCHES.BASIC = {};
PATCHES.AUTOTARGET = {};
PATCHES.dnd5e = {};

// ----- NOTE: Hooks ----- //



/**
 * On refresh, control the ruler (text) visibility.
 *
 * A hook event that fires when a {@link PlaceableObject} is incrementally refreshed.
 * The dispatched event name replaces "Object" with the named PlaceableObject subclass, i.e. "refreshToken".
 * @event refreshObject
 * @category PlaceableObject
 * @param {PlaceableObject} object    The object instance being refreshed
 */
function refreshMeasuredTemplate(template, flags) {
  const canHide = canHideTemplate(template);

  // Control the border visibility including border text.
  if ( flags.refreshTemplate || flags.refreshState ) {
    log(`refreshMeasuredTemplate|template alpha ${template.template.alpha}`);
    if ( canHide && canHideTemplateComponent(template, "BORDER") ) {
      template.template.alpha = 0; // Don't mess with visible to fool automated animations into displaying.
      // This doesn't work: template.template.visible = false;
      template.ruler.visible = false;
    } else {
      template.template.alpha = MODULES.TOKEN_MAGIC.ACTIVE ? (template.document.getFlag(MODULES.TOKEN_MAGIC.ID, "templateData")?.opacity ?? 1) : 1;
      // This doesn't work: template.template.visible = true;
      template.ruler.visible = true;
    }
  }

  // Control the highlight visibility by changing its alpha.
  if ( flags.refreshGrid || flags.refreshState ) {
    const hl = canvas.interface.grid.getHighlightLayer(template.highlightId);
    log(`refreshMeasuredTemplate|highlight layer alpha ${hl.alpha}`);
    if ( canHide && canHideTemplateComponent(template, "HIGHLIGHTING") ) hl.alpha = 0;
    else hl.alpha = template.document.hidden ? 0.5 : 1;
  }

  // Make the control icon visible to non-owners.
  if ( flags.refreshState && !template.document.isOwner ) {
    template.controlIcon.refresh({
      visible: template.visible && template.layer.active && !template.document.hidden
    });
    template.controlIcon.alpha = 0.5;
  }

  // Display the elevation tooltip if the control icon, border, or highlight is visible.
  if ( flags.refreshTemplate || flags.refreshState || flags.refreshGrid ) {
    const toolTipVisible = template.template.alpha > 0                              // Border visible
      || canvas.interface.grid.getHighlightLayer(template.highlightId).alpha > 0              // Highlight visible
      || (template.visible && template.layer.active && !template.document.hidden);  // Control icon visible
    template.tooltip.visible = toolTipVisible;
  }

  // Update the elevation value of the tooltip.
  if ( flags.refreshElevation ) {
    // See Token.prototype.#refreshElevation
    canvas.primary.sortDirty = true;

    // Elevation tooltip text
    const tt = template._getTooltipText();
    if ( tt !== template.tooltip.text ) template.tooltip.text = tt;
  }
}

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
    // template.setFlag(MODULE_ID, "enabled", Settings.get(Settings.KEYS.DEFAULT_WALLED));
    updates[`flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`] = Settings.get(Settings.KEYS.DEFAULT_WALLS_BLOCK[t]);
  }

  if ( typeof templateD.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION) === "undefined" ) {
    updates[`flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`] = Settings.get(Settings.KEYS.DEFAULT_WALL_RESTRICTION[t]);
  }

  if ( (t === "ray" || t === "cone") && Settings.get(Settings.KEYS.DIAGONAL_SCALING[t]) ) {
    // Extend rays or cones to conform to 5-5-5 diagonal, if applicable.
    // See dndHelpers for original:
    // https://github.com/trioderegion/dnd5e-helpers/blob/342548530088f929d5c243ad2c9381477ba072de/scripts/modules/TemplateScaling.js#L78
    updates.distance = scaleDiagonalDistance(direction, distance);
  }

  if ( !foundry.utils.isEmpty(updates) ) templateD.updateSource(updates);
}

/**
 * Hook updateMeasuredTemplate to set render flag based on change to the WalledTemplate config.
 * @param {Document} document                       The existing Document which was updated
 * @param {object} change                           Differential data that was used to update the document
 * @param {DocumentModificationContext} options     Additional options which modified the update request
 * @param {string} userId                           The ID of the User who triggered the update workflow
 */
const UPDATE_FLAGS = {
  WALLS_BLOCK: `flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`,
  WALL_RESTRICTION: `flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`,
  HIDE_BORDER: `flags.${MODULE_ID}.${FLAGS.HIDE.BORDER}`,
  HIDE_HIGHLIGHTING: `flags.${MODULE_ID}.${FLAGS.HIDE.HIGHLIGHTING}`,
  NO_AUTOTARGET: `flags.${MODULE_ID}.${FLAGS.NO_AUTOTARGET}`,
  ELEVATION: `flags.elevatedvision.elevation`
};
const WALL_FLAGS = [UPDATE_FLAGS.WALLS_BLOCK, UPDATE_FLAGS.WALL_RESTRICTION];
const DISPLAY_FLAGS = [UPDATE_FLAGS.HIDE_BORDER, UPDATE_FLAGS.HIDE_HIGHLIGHTING];

function updateMeasuredTemplateHook(templateD, data, _options, _userId) {
  if ( !templateD.object ) return;
  const changed = new Set(Object.keys(foundry.utils.flattenObject(data)));
  const rf = templateD.object.renderFlags;
  if ( WALL_FLAGS.some(k => changed.has(k)) ) rf.set({ refreshShape: true });
  if ( DISPLAY_FLAGS.some(k => changed.has(k)) ) rf.set({
    refreshTemplate: true,
    refreshGrid: true
  });
  if ( changed.has(UPDATE_FLAGS.NO_AUTOTARGET) ) rf.set({ retarget: true });
  if ( changed.has(UPDATE_FLAGS.ELEVATION) ) rf.set({ refreshElevation: true });
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
  if ( Settings.get(Settings.KEYS.HIDE.BORDER) ) template.renderFlags.set({ refreshTemplate: true });
  if ( Settings.get(Settings.KEYS.HIDE.HIGHLIGHTING) ) template.renderFlags.set({ refreshGrid: true });
}


PATCHES.BASIC.HOOKS = {
  refreshMeasuredTemplate,
  preCreateMeasuredTemplate: preCreateMeasuredTemplateHook,
  updateMeasuredTemplate: updateMeasuredTemplateHook,
  destroyMeasuredTemplate: destroyMeasuredTemplateHook,
  hoverMeasuredTemplate: hoverMeasuredTemplateHook
};

// ----- NOTE: dnd5e Hooks ----- //

/**
 * Hook drawMeasuredTemplate to monitor if a template has been created with an item.
 * Pull necessary flags from that item, such as caster.
 *
 * A hook event that fires when a {@link PlaceableObject} is initially drawn.
 * The dispatched event name replaces "Object" with the named PlaceableObject subclass, i.e. "drawToken".
 * @event drawObject
 * @category PlaceableObject
 * @param {PlaceableObject} object    The object instance being drawn
 */
function drawMeasuredTemplate(template) {
  // Add token elevation to the template if using Levels or Wall-Height modules
  let moduleLevels = game.modules.get('levels');
  let moduleWallHeight_active = game.modules.get('wall-height')?.active;
  if ( moduleLevels && (moduleLevels.active || moduleWallHeight_active) ) {
    // Copy the Levels method of getting the elevation so that the tool button for it is respected. Levels only sets its flags at preCreateMeasuredTemplate
    if ( template.flags?.levels?.elevation !== undefined || template.flags?.[MODULE_ID]?.elevation !== undefined ) return;
    const templateData = CONFIG.Levels.handlers.TemplateHandler.getTemplateData(false);
    template.document.updateSource({
      flags: { [MODULE_ID]: { elevation: templateData.elevation } }
    });
  } else if ( moduleWallHeight_active ) {
    // If wall-height is active, but levels doesn't exist, we need a different approach. Take the elevation from the caster token
    let parentToken = template.item?.parent ? template.item.parent.getActiveTokens().findLast((token, index) => token.controlled || index == 0 ) : canvas.tokens.controlled[0] ?? _token;
    if ( parentToken ) {
      template.document.updateSource({
        flags: { [MODULE_ID]: { elevation: parentToken.document.elevation } }
      });
    }
  }

  if ( !template.item ) return;
  addDnd5eItemConfigurationToTemplate(template);
}

PATCHES.dnd5e.HOOKS = { drawMeasuredTemplate };



// ----- NOTE: Wraps ----- //

/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
function _getGridHighlightPositions(wrapper) {
  if ( Settings.autotargetMethod(this.document.t) === Settings.KEYS.AUTOTARGET.METHODS.CENTER ) return wrapper();

  // Determine all the grid positions that could be under the shape.
  // Temporarily change the shape to bounds that are expanded by one grid square.
  const oldShape = this.shape;
  this.shape = oldShape.getBounds().pad(canvas.grid.sizeX, canvas.grid.sizeY);
  const positions = wrapper();

  // Debug
  if ( CONFIG[MODULE_ID].debug ) {
    const Draw = CONFIG.GeometryLib.Draw;
    Draw.clearDrawings();
    positions.forEach(p => Draw.point(p, { alpha: 0.4 }))
    positions.forEach(p => Draw.shape(gridShapeForTopLeft(p), { fill: Draw.COLORS.blue, fillAlpha: 0.2 }));
  }

  // Reset shape.
  this.shape = oldShape;

  // Filter positions to fit the actual shape.
  const filteredPositions = positions.filter(p => {
    const shape = gridShapeForTopLeft(p);
    return this.boundsOverlap(shape);
  });

  // Debug
  if ( CONFIG[MODULE_ID].debug ) {
    const Draw = CONFIG.GeometryLib.Draw;
    filteredPositions.forEach(p => Draw.point(p, { alpha: 0.8 }))
    filteredPositions.forEach(p => Draw.shape(gridShapeForTopLeft(p), { fill: Draw.COLORS.blue, fillAlpha: 0.5 }));
  }

  return filteredPositions;
}

/**
 * Get all the grid positions under the given shape.
 *

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

  // See issue #112 and Discord https://ptb.discord.com/channels/915186263609454632/1167221795103985764/1235614818304655465
  const oldControllableObjects = this.layer.options.controllableObjects;
  if ( !this.layer.controlled.length ) this.layer.options.controllableObjects = false;
  wrapped(event);
  this.layer.options.controllableObjects = oldControllableObjects;
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

  const precision = event.shiftKey ? 2 : 1;
  const destination = event.interactionData.destination;
  if ( Settings.get(Settings.KEYS.SNAP_GRID) ) {
    event.interactionData.destination = canvas.grid.getSnappedPosition(destination.x, destination.y, precision);

    // Drag ruler fix when holding shift.
    const ruler = canvas.controls.ruler;
    if ( ruler.rulerOffset ) {
      ruler.rulerOffset.x = 0;
      ruler.rulerOffset.y = 0;
    }
  }

  wrapped(event);
  if ( !Settings.get(Settings.KEYS.SNAP_GRID) ) return;

  // Move the clones to snapped locations.
  // Mimics MeasuredTemplate.prototype._onDragLeftMove


  for ( let c of event.interactionData.clones || [] ) {
    const snapped = canvas.grid.getSnappedPosition(c.document.x, c.document.y, precision);
    c.document.x = snapped.x;
    c.document.y = snapped.y;
    c.renderFlags.set({refresh: true});
  }
}

function _onDragLeftCancel(wrapped, event) {
  return wrapped(event);
}

async function _onDragLeftDrop(wrapped, event) {
  const precision = event.shiftKey ? 2 : 1;
  const destination = event.interactionData.destination;
  if ( Settings.get(Settings.KEYS.SNAP_GRID) ) {
    event.interactionData.destination = canvas.grid.getSnappedPosition(destination.x, destination.y, precision);

    // Drag ruler fix when holding shift.
    const ruler = canvas.controls.ruler;
    if ( ruler.rulerOffset ) {
      ruler.rulerOffset.x = 0;
      ruler.rulerOffset.y = 0;
    }
  }

  const attachedToken = this.attachedToken;
  if ( !attachedToken ) return wrapped(event);

  // Temporarily set the event clones to this template clone.
  const tokenClones = event.interactionData.clones;
  const c = event.interactionData.attachedTemplateClones.get(this.id);
  event.interactionData.clones = [c];

  // Enforce the distance between the template and token.
  const changes = this._calculateAttachedTemplateOffset(attachedToken.document);
  this.document.updateSource(changes);
  await wrapped(event);

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
 * Allow non-owners to hover over a template icon.
 */
function _canHover(wrapped, user, event) {
  if ( wrapped(user, event) ) return true;
  return this.controlIcon?.visible;
}

/**
 * Wrap MeasuredTemplate.prototype._draw
 * Add the elevation tooltip.
 */
function _draw(wrapped) {
  wrapped();
  this.tooltip ||= this.addChild(this._drawTooltip());
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
  _canHover,
  _draw,
  _getGridHighlightPositions
};

// ----- NOTE: Mixed wraps ----- //

/**
 * Mixed wrap of MeasuredTemplate.prototype.highlightGrid
 * If the setting is set to hide, don't highlight grid unless hovering.
 */
function highlightGrid(wrapped) {
  if ( !(canHideTemplate(this) && canHideTemplateComponent(this, "HIGHLIGHTING")) ) return wrapped();

  // Clear the existing highlight layer
  const hl = canvas.interface.grid.getHighlightLayer(this.highlightId);
  hl.clear();
}

PATCHES.BASIC.MIXES = { highlightGrid };

// ----- NOTE: Autotarget Wraps ----- //



// ----- NOTE: Methods ----- //

/**
 * New method: MeasuredTemplate.prototype.boundsOverlap
 * For a given bounds shape, determine if it overlaps the template according to
 * provided settings. Will translate the bounds to template origin.
 * @param {PIXI.Rectangle|Hexagon}  bounds    Boundary shape, with true position on grid.
 * @return {Boolean}
 */
function boundsOverlap(bounds) {
  if ( !this.shape?.getBounds ) return false; // Issue #110.

  const tBounds = bounds.translate(-this.x, -this.y);

  if ( Settings.autotargetMethod(this.document.t) === Settings.KEYS.AUTOTARGET.METHODS.CENTER ) {
    return this.shape.contains(tBounds.center.x, tBounds.center.y);
  }

  // If the rectangles don't overlap, we can stop here.
  if ( !tBounds.overlaps(this.shape.getBounds()) ) return false;

  // Calculate the area of potential overlap by constructing the intersecting polygon between the
  // bounds and the template shape.
  // It is possible for the overlap to be a single point, and the poly returned would be degen.
  const poly = boundsShapeIntersection(tBounds, this.shape);
  if ( !poly || poly.points.length < 6 ) return false; // Less than 6 points: line, point, or empty.

  // If the polygon area is zero, no overlap.
  const p_area = poly.area;
  if ( p_area.almostEqual(0) ) return false;

  // Test for overlap.
  const area_percentage = Settings.autotargetArea(this.document.t);
  const b_area = bounds.area;
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
  } catch( _error ) { /* empty */ } // eslint-disable-line no-unused-vars
  try { await this.document.unsetFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.DELTAS);
  } catch( _error) { /* empty */ } // eslint-disable-line no-unused-vars

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
  if ( Object.hasOwn(tokenD, "rotation") && Object.hasOwn(delta, "rotation") && this.document.getFlag(MODULE_ID, FLAGS.ATTACHED_TOKEN.ROTATE) ) {
    templateData.direction = Math.normalizeDegrees(tokenD.rotation + delta.rotation);
  }
  return this.document.constructor.cleanData(templateData, {partial: true});
}

/**
 * New method: MeasuredTemplate.prototype._drawTooltip
 */
function _drawTooltip() {
  let text = this._getTooltipText();
  const style = this.constructor._getTextStyle();
  const tip = new PreciseText(text, style);
  tip.anchor.set(0.5, 1);

  // From #drawControlIcon
  const size = Math.max(Math.round((canvas.dimensions.size * 0.5) / 20) * 20, 40);
  tip.position.set(0, -size / 2);
  return tip;
}

/**
 * New method: MeasuredTemplate.prototype._getTooltipText
 */
function _getTooltipText() {
  const el = this.elevationE;
  if ( !Number.isFinite(el) || el === 0 ) return "";
  let units = canvas.scene.grid.units;
  return el > 0 ? `+${el} ${units}` : `${el} ${units}`;
}

/**
 * New method: MeasuredTemplate.prototype.targetsWithinShape
 * Return tokens within the template shape.
 * @param {object} [opts]     Options that affect what counts as a target
 * @param {boolean} [opts.onlyVisible=false]      If true, limit potential targets to visible tokens for the user
 * @returns {Token[]}
 */
function targetsWithinShape({ onlyVisible = false } = {}) {
  const statusesToIgnore = CONFIG[MODULE_ID].autotargetStatusesToIgnore;
  return canvas.tokens.placeables.filter(token => {
    if ( onlyVisible && !token.visible ) return false;
    if ( !token.hitArea ) return false; // Token not yet drawn. See Token.prototype._draw.

    // Midi-qol; Walled Templates issue #28, issue #37.
    if ( getProperty(token, "actor.flags.midi-qol.neverTarget")
      || getProperty(token, "actor.system.details.type.custom")?.includes("NoTarget") ) return false;

    // Ignore certain statuses. See issue #108.
    if ( token.actor.statuses.intersects(statusesToIgnore) ) return false;

    // Test the token boundary.
    const tBounds = tokenBounds(token);
    return this.boundsOverlap(tBounds);
  });
}

PATCHES.BASIC.METHODS = {
  boundsOverlap,
  targetsWithinShape,
  attachToken,
  detachToken,
  _calculateAttachedTemplateOffset,
  _drawTooltip,
  _getTooltipText
 };

 // ----- NOTE: Static methods ----- //

/**
 * New method: MeasuredTemplate._getTextStyle
 * Get the text style that should be used for this Template's tooltip.
 * See Token.prototype._getTextStyle.
 * @returns {string}
 */
function _getTextStyle() {
  const style = CONFIG.canvasTextStyle.clone();
  style.fontSize = 24;
  if (canvas.dimensions.size >= 200) style.fontSize = 28;
  else if (canvas.dimensions.size < 50) style.fontSize = 20;

  // From #drawControlIcon
  const size = Math.max(Math.round((canvas.dimensions.size * 0.5) / 20) * 20, 40);
  style.wordWrapWidth = size * 2.5;
  return style;
}

PATCHES.BASIC.STATIC_METHODS = {
  _getTextStyle
};

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

/**
 * Determine if this template should autotarget.
 * @returns {boolean}
 */
function getAutotarget() {
  return Settings.autotargetEnabled && !this.document.getFlag(MODULE_ID, FLAGS.NO_AUTOTARGET);
}

PATCHES.BASIC.GETTERS = { attachedToken, wallsBlock, autotarget: getAutotarget };

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
  if ( flags.retarget && template.isOwner ) template.autotargetTokens();
}

/**
 * Hook when a token has a status effect added or removed.
 * Refresh the autotarget.
 * @param {Token} token       The token affected.
 * @param {string} statusId   The status effect ID being applied, from CONFIG.specialStatusEffects.
 * @param {boolean} active    Is the special status effect now active?
 */
function applyTokenStatusEffect(token, statusId, _active) {
  if ( !CONFIG[MODULE_ID].autotargetStatusesToIgnore.has(statusId) ) return;

  // If the token is within the template boundary, trigger a retargeting.
  const tBounds = tokenBounds(token);
  canvas.templates.placeables.forEach(template => {
    if ( template.boundsOverlap(tBounds) ) template.renderFlags.set({ retarget: true });
  });
}

PATCHES.AUTOTARGET.HOOKS = { refreshMeasuredTemplate: refreshMeasuredTemplateHook, applyTokenStatusEffect };

// ----- NOTE: Getters ----- //

/** @type {Set<Token>} */
function getTargets() { return this._targets || (this._targets = new Set()); }

PATCHES.AUTOTARGET.GETTERS = { targets: getTargets };

// ----- NOTE: Methods ----- //
/**
 * New method: MeasuredTemplate.prototype.autotarget
 * Target tokens within the template area.
 */
function autotargetTokens({ onlyVisible = false } = {}) {
  log("autotargetTokens", this);
  if ( !this.autotarget ) return this.releaseTargets();

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



PATCHES.AUTOTARGET.METHODS = {
  autotargetTokens,
  releaseTargets,
  acquireTargets
};

// ----- NOTE: Helper functions ----- //

/**
 * Helper that tests if a template can be hidden.
 * Does not test all options.
 * @param {MeasuredTemplate} template
 * @returns {boolean} True if it can be hidden.
 */
function canHideTemplate(template) {
  // For attached templates, respect the hidden settings.
  // For non-attached, we probably want the preview to display the template
  const showPreview = template.isPreview && !template.attachedToken;
  return !(template.hover
    || showPreview
    || !template.visible
    || template.interactionState === MouseInteractionManager.INTERACTION_STATES.DRAG
    || Settings.FORCE_TEMPLATE_DISPLAY);
}

/**
 * Helper that tests the provided hide flag and the global defaults.
 * @param {MeasuredTemplate} template
 * @param {"BORDER"|"HIGHLIGHTING"} hideflag
 * @returns {boolean} True if template component can be hidden.
 */
function canHideTemplateComponent(template, hideFlag) {
  const HIDE = FLAGS.HIDE;

  // Check for local token hover flag.
  if ( template.document.flags?.[MODULE_ID]?.[HIDE.TOKEN_HOVER] ) return false;

  // Check for per-template setting.
  const TYPES = HIDE.TYPES;
  const local = template.document.getFlag(MODULE_ID, HIDE[hideFlag]);
  if ( !local || local === TYPES.GLOBAL_DEFAULT ) {
    if ( MODULES.TOKEN_MAGIC.ACTIVE ) return game.settings.get('tokenmagic', 'autohideTemplateElements');
    return Settings.get(Settings.KEYS.HIDE[hideFlag]);
  }
  return (local === TYPES.ALWAYS_HIDE);
}

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
  if ( tBounds instanceof Square ) tBounds = tBounds.toPolygon();


  // Intersection of two PIXI.Rectangles returns PIXI.Rectangle; convert to Polygon
  if ( shape instanceof PIXI.Rectangle
    && tBounds instanceof PIXI.Rectangle ) return tBounds.intersection(shape).toPolygon();

  if ( shape instanceof PIXI.Polygon ) return tBounds.intersectPolygon(shape);

  // See issue #9991 https://github.com/foundryvtt/foundryvtt/issues/9991
  if ( shape instanceof PIXI.Rectangle ) return shape.toPolygon().intersectPolygon(tBounds);

  // Shape should be circle
  return shape.intersectPolygon(tBounds.toPolygon());
}

function scaleDiagonalDistance(direction, distance) {
  const dirRadians = Math.toRadians(direction);
  const diagonalScale = Math.abs(Math.sin(dirRadians)) + Math.abs(Math.cos(dirRadians));
  return diagonalScale * distance;
}
