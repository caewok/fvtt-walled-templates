/* globals
CONFIG
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, ACTIVE_EFFECT_ICON } from "./const.js";

export const PATCHES = {};
PATCHES.BASIC = {};

/**
 * If a template attachment effect is deleted, remove from the corresponding template.
 * @param {ActiveEffect} activeEffect
 * @param {object} opts
 * @param {string} id
 */
async function deleteActiveEffectHook(activeEffect, _opts, _id) {
  if ( !activeEffect.origin.includes(CONFIG.MeasuredTemplate.objectClass.name) ) return;
  const t = await fromUuid(activeEffect.origin);
  if ( t ) t.object?.detachToken();
}

PATCHES.BASIC.HOOKS = { deleteActiveEffect: deleteActiveEffectHook };
