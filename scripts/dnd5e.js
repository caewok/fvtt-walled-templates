/**
 * Given a template, add configuration from the attached item, if any.
 * Called in the drawMeasuredTemplate hook. At that point, the template may not have an id.
 * @param {AbilityTemplate} template    Template created from item in dnd5e
 */
/* globals
canvas,
PIXI,
*/
"use strict";

import { MODULE_ID, FLAGS, LABELS } from "./const.js";
import { Settings } from "./settings.js";

export function addDnd5eItemConfigurationToTemplate(template) {
  const item = template.item;
  if ( !item ) return;

  // Constants
  const templateD = template.document;
  const shape = templateD.t;

  // Determine wall settings, falling back to global defaults.
  let wallsBlock = item.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK);
  let wallRestriction = item.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION);
  if ( !wallsBlock
    || wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = Settings.get(Settings.KEYS.DEFAULT_WALLS_BLOCK[shape]);
  if ( !wallRestriction || wallRestriction === LABELS.GLOBAL_DEFAULT ) {
    wallRestriction = Settings.get(Settings.KEYS.DEFAULT_WALL_RESTRICTION[shape]);
  }

  // Determine autotargeting, falling back to global.
  const noAutotarget = item.getFlag(MODULE_ID, FLAGS.NO_AUTOTARGET) ?? false;

  // Determine hide settings, falling back to global defaults.
  const hideBorder = item.getFlag(MODULE_ID, FLAGS.HIDE.BORDER) ?? LABELS.GLOBAL_DEFAULT;
  const hideHighlighting = item.getFlag(MODULE_ID, FLAGS.HIDE.HIGHLIGHTING) ?? LABELS.GLOBAL_DEFAULT;
  const showOnHover = item.getFlag(MODULE_ID, FLAGS.HIDE.SHOW_ON_HOVER) ?? LABELS.GLOBAL_DEFAULT;

  // Determine snapping settings, falling back to global defaults.
  const snapCenter = item.getFlag(MODULE_ID, FLAGS.SNAPPING.CENTER) ?? Settings.get(Settings.KEYS.DEFAULT_SNAPPING[shape].CENTER);
  const snapCorner = item.getFlag(MODULE_ID, FLAGS.SNAPPING.CORNER) ?? Settings.get(Settings.KEYS.DEFAULT_SNAPPING[shape].CORNER);
  const snapSideMidpoint = item.getFlag(MODULE_ID, FLAGS.SNAPPING.SIDE_MIDPOINT) ?? Settings.get(Settings.KEYS.DEFAULT_SNAPPING[shape].SIDE_MIDPOINT);

  // Attach items to the template.
  templateD.updateSource({
    flags: {
      [MODULE_ID]: {
        [FLAGS.WALLS_BLOCK]: wallsBlock,
        [FLAGS.WALL_RESTRICTION]: wallRestriction,
        [FLAGS.NO_AUTOTARGET]: noAutotarget,
        [FLAGS.HIDE.BORDER]: hideBorder,
        [FLAGS.HIDE.HIGHLIGHTING]: hideHighlighting,
        [FLAGS.HIDE.SHOW_ON_HOVER]: showOnHover,
        [FLAGS.SNAPPING.CENTER]: snapCenter,
        [FLAGS.SNAPPING.CORNER]: snapCorner,
        [FLAGS.SNAPPING.SIDE_MIDPOINT]: snapSideMidpoint
      }
    }
  });

  if ( item.getFlag(MODULE_ID, FLAGS.ADD_TOKEN_SIZE) ) {
    // Does the template originate on a token? (Use the first token found.)
    const templateOrigin = new PIXI.Point(templateD.x, templateD.y);
    const token = canvas.tokens.placeables.find(t => templateOrigin.almostEqual(t.center));
    if ( token ) {
      // Add 1/2 token size to the template distance.
      const { width, height } = token.document;
      const size = Math.min(width, height) * canvas.dimensions.distance;
      templateD.updateSource({ distance: templateD.distance + size });
    }
  }
}