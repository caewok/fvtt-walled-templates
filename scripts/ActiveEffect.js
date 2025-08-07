/* globals
canvas,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { FLAGS, MODULE_ID } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};

/**
 * If a template attachment effect is deleted, remove from the corresponding template.
 * @param {ActiveEffect} activeEffect
 * @param {object} opts
 * @param {string} id
 */
function deleteActiveEffectHook(activeEffect, _opts, _id) {
  const id = activeEffect.getFlag(MODULE_ID, FLAGS.ATTACHED_TEMPLATE_ID);
  if ( !id ) return;
  const t = canvas.templates.placeables.find(t => t.id === id);
  t?.object?.detachToken();
}

PATCHES.BASIC.HOOKS = { deleteActiveEffect: deleteActiveEffectHook };
