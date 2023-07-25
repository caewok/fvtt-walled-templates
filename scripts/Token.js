/* globals
game
*/
"use strict";

export const PATCHES = {};
PATCHES.AUTOTARGET = {};

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
function controlTokenHook(object, controlled) {
  const user = game.user;

  if ( controlled ) user._lastSelected = object;
  else if ( user.lastSelected === object ) user._lastDeselected = object;
}

PATCHES.AUTOTARGET.HOOKS = { controlToken: controlTokenHook };
