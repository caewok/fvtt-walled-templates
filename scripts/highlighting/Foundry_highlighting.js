/* globals

*/
"use strict";

import { log, gridShapeForTopLeft } from "../util.js";
import { MODULE_ID, getSetting, SETTINGS } from "../settings.js";

/**
 * Wrap MeasuredTemplate.prototype._getGridHighlightPositions
 * @returns {Points[]}
 */
export function getGridHighlightPositionsMeasuredTemplate(wrapper) {
  log("getGridHighlightPositionsMeasuredTemplate");

  const shape_type = this.shape instanceof ClockwiseSweepPolygon ? "ClockwiseSweep"
    : this.shape instanceof PIXI.Circle ? "circle"
    : this.shape instanceof PIXI.Rectangle ? "rectangle" : "undefined";

  // Can sometimes fail to have bounds set
  if ( this.shape instanceof ClockwiseSweepPolygon
    && !this.shape.bounds ) {
    log("Updating bounds for shape.");
    this.shape.bounds = this.shape.getBounds();
  }

  const positions = wrapper();

  const enabled = this.document.getFlag(MODULE_ID, "enabled");
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
