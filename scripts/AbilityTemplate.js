/* globals
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Settings } from "./settings.js";

export const PATCHES = {};
PATCHES.dnd5e = {};

/**
 *

/**
 * Mixed AbilityTemplate.prototype._onMovePlacement
 * Moves template preview when mouse moves.
 * Snap to grid if enabled.
 * @param {Event} event  Triggering mouse event.
 */
let MOVE_TIME = 0;
function _onMovePlacement(wrapped, event) {
  if ( !Settings.get(Settings.KEYS.SNAP_GRID) ) return wrapped(event);

  // Mostly borrowed from AbilityTemplate.prototype._onMovePlacement.
  event.stopPropagation();
  const now = Date.now(); // Apply a 20ms throttle
  if ( now - MOVE_TIME <= 20 ) return;
  const center = event.data.getLocalPosition(this.layer);

  const precision = event.shiftKey ? 2 : 1;
  const snapped = canvas.grid.getSnappedPosition(center.x, center.y, precision);
  this.document.updateSource({x: snapped.x, y: snapped.y});
  this.refresh();
  MOVE_TIME = now;
}

PATCHES.dnd5e.MIXES = { _onMovePlacement };
