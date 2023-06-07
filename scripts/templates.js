/* globals
canvas,
flattenObject
game,
isEmpty
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { log } from "./util.js";
import { MODULE_ID, FLAGS } from "./const.js";
import { getSetting, SETTINGS } from "./settings.js";

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

  // If Levels is active, defer to Levels for template elevation. Otherwise, estimate from token.
  if ( !game.modules.get("levels")?.active ) {
    const elevation = estimateTemplateElevation(id);

    // Add elevation flag. Sneakily, use the levels flag.
    updates["flags.levels.elevation"] = elevation;
  }


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
 * Hook preUpdateMeasuredTemplate to set render flag based on change to the WalledTemplate config.
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

/**
 * At preCreateMeasuredTemplate, attempt to get a token associated with the template.
 * Use that token's elevation.
 * If no tokens can be associated with the user, default to 0.
 * @param {string} id   User id who constructed the template
 * @returns {number}  Elevation value, in grid units.
 */
function estimateTemplateElevation(id) {
  // Try to find a token for the user
  const user = game.users.get(id);
  let token;

  // If in combat, assume it is the combatant if the user owns the combatant
  if ( !token && game.combat?.started ) {
    const c = game.combat.combatant;
    if ( (!c.players.length && user.isGM)
      || c.players.some(p => p.id === id) ) token = c.token.object;
  }

  if ( !token && canvas.tokens.active ) {
    const cToken = canvas.tokens.controlled;

    // If a single token is selected, use that.
    // If multiple tokens, use the last selected
    if ( cToken.length === 1 ) token = cToken[0];
    else token = user._lastSelected;
  } else if ( !token ) {
    // Get the last token selected by the user before the layer change
    token = user._lastDeselected;
  }

  const out = token?.document?.elevation ?? 0;
  log(`estimateTemplateElevation is ${out} for ${token?.name}`);

  return out;
}
