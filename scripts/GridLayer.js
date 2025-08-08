/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

export const PATCHES = {};
PATCHES.BASIC = {};

// Wraps for GridLayer

// ----- NOTE: Wraps ----- //

/**
 * Wrap GridLayer#highlightPosition.
 * Allow multiple shapes to be passed in an array.
 */
function highlightPosition(wrapped, name, { shape, ...opts } = {}) {
  let shapes = shape;
  if ( !Array.isArray(shape) ) shapes = [shape];
  opts.shape = null;
  for ( const s of shapes ) {
    opts.shape = s;
    wrapped(name, opts);
  }
}

PATCHES.BASIC = { highlightPosition };
