/* globals

*/
"use strict";

import { log, gridShapeForTopLeft } from "../util.js";
import { getSetting, SETTINGS } from "../settings.js";
import { MODULE_ID, FLAGS } from "../const.js";

/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
export function getGridHighlightPositionsMeasuredTemplate(wrapper) {
  log("getGridHighlightPositionsMeasuredTemplate");

  const positions = wrapper();

  const enabled = this.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK) !== SETTINGS.DEFAULTS.CHOICES.UNWALLED;
  const need_targeting = !getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER;
  if ( !(enabled || need_targeting) ) {
    log("walledTemplatesHighlightGrid|Using Foundry default");
    return positions;
  }

  log("getGridHighlightPositionsMeasuredTemplate: filtering positions");

  return positions.filter(p => {
    const shape = gridShapeForTopLeft(p);
    return this.boundsOverlap(shape);
  });
}
