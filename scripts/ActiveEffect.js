/* globals
CONFIG,
fromUuid
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

export const PATCHES = {};
PATCHES.BASIC = {};

/**
 * If a template attachment effect is deleted, remove from the corresponding template.
 * @param {ActiveEffect} activeEffect
 * @param {object} opts
 * @param {string} id
 */
async function deleteActiveEffectHook(activeEffect, _opts, _id) {
  if ( !activeEffect.origin || !activeEffect.origin.includes(CONFIG.MeasuredTemplate.objectClass.name) ) return;
  const t = await fromUuid(activeEffect.origin);
  if ( t ) t.object?.detachToken();
}

PATCHES.BASIC.HOOKS = { deleteActiveEffect: deleteActiveEffectHook };
