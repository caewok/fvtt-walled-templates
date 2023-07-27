/* globals
game
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

export const PATCHES = {};
PATCHES.BASIC = {};
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

/**
 * Hook preUpdateToken
 */
function preUpdateTokenHook(tokenD, changes, _options, _userId) {
  const token = tokenD.object;
  console.debug(`preUpdateToken hook ${changes.x}, ${changes.y}, ${changes.elevation} at elevation ${token.document?.elevation} with elevationD ${tokenD.elevation}`, changes);
  console.debug(`preUpdateToken hook moving ${tokenD.x},${tokenD.y} --> ${changes.x ? changes.x : tokenD.x},${changes.y ? changes.y : tokenD.y}`);
}

/**
 * Hook updateToken
 */
function updateTokenHook(tokenD, changed, _options, _userId) {
  const token = tokenD.object;
  console.debug(`updateToken hook ${changed.x}, ${changed.y}, ${changed.elevation} at elevation ${token.document?.elevation} with elevationD ${tokenD.elevation}`, changed);
  console.debug(`updateToken hook moving ${tokenD.x},${tokenD.y} --> ${changed.x ? changed.x : tokenD.x},${changed.y ? changed.y : tokenD.y}`);

}

/**
 * Hook Token refresh
 */
function refreshTokenHook(token, flags) {
  if ( !flags.refreshPosition ) return;
  // TODO: refreshElevation flag?
  console.debug(`refreshToken for ${token.name} at ${token.position.x},${token.position.y}. Token is ${token._original ? "Clone" : "Original"}. Token is ${token._animation ? "" : "not "}animating.`);
  if ( token._original ) {
    // clone
  }

  if ( token._animation ) {
    // animating
  }
}

PATCHES.AUTOTARGET.HOOKS = { controlToken: controlTokenHook };
PATCHES.BASIC.HOOKS = { preUpdateToken: preUpdateTokenHook, updateToken: updateTokenHook, refreshToken: refreshTokenHook };
