/* globals
canvas,
flattenObject
game,
isEmpty
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplate, templateFlagProperties } from "./WalledTemplate.js";
import { log, gridShapeForTopLeft } from "./util.js";
import { MODULE_ID, FLAGS } from "./const.js";
import { getSetting, SETTINGS } from "./settings.js";

/**
 * Hook template refresh to address the retarget renderFlag.
 * Target tokens after drawing/refreshing the template.
 * See MeasuredTemplate.prototype._applyRenderFlags.
 * @param {PlaceableObject} object    The object instance being refreshed
 * @param {RenderFlags} flags
 */
export function refreshMeasuredTemplateHook(template, flags) {
  if ( flags.retarget ) template.autotargetToken();
}

/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
export function getGridHighlightPositionsMeasuredTemplate(wrapper) {
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
export function _computeShapeMeasuredTemplate(wrapped) {
  // Store the original shape.
  this.originalShape = wrapped();
  if ( !requiresSweep(this) ) return this.originalShape;

  const walledTemplate = WalledTemplate.fromMeasuredTemplate(this);
  const poly = walledTemplate.computeSweepPolygon();

  poly.x = this.originalShape.x;
  poly.y = this.originalShape.y;
  poly.radius = this.originalShape.radius;

  if ( !poly || isNaN(poly.points[0]) ) {
    console.error("_computeShapeMeasuredTemplate poly is broken.");
    return this.originalShape;
  }
  return poly;
}

/**
 * Determine if a sweep is needed for a template.
 * @param {MeasuredTemplate}
 * @returns {boolean}
 */
function requiresSweep(template) {
  const { wallsBlock } = templateFlagProperties(template);
  return wallsBlock !== SETTINGS.DEFAULTS.CHOICES.UNWALLED;
}

/**
 * Hook preCreateMeasuredTemplate to
 * @param {MeasuredTemplateDocument} template
 * @param {Object} data
 * @param {Object} opt { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} id
 */
export function preCreateMeasuredTemplateHook(templateD, updateData, opts, id) {
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
export function updateMeasuredTemplateHook(templateD, data, _options, _userId) {
  const wtChangeFlags = [
    `flags.${MODULE_ID}.${FLAGS.WALLS_BLOCK}`,
    `flags.${MODULE_ID}.${FLAGS.WALL_RESTRICTION}`
  ];

  const changed = new Set(Object.keys(flattenObject(data)));
  if ( wtChangeFlags.some(k => changed.has(k)) ) templateD.object.renderFlags.set({
    refreshShape: true
  });
}

function scaleDiagonalDistance(direction, distance) {
  const dirRadians = Math.toRadians(direction);
  const diagonalScale = Math.abs(Math.sin(dirRadians)) + Math.abs(Math.cos(dirRadians));
  return diagonalScale * distance;
}
