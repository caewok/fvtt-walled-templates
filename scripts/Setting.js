/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { SETTINGS } from "./settings.js";

import { WalledTemplateShape } from "./template_shapes/WalledTemplateShape.js";
import { WalledTemplateCircle } from "./template_shapes/WalledTemplateCircle.js";
import { WalledTemplateSquare } from "./template_shapes/WalledTemplateSquare.js";

// ----- NOTE: Hooks ----- //
export const PATCHES = {};
PATCHES.BASIC = {};

/**
 * Hook updateSetting
 * @param {Setting} setting
 * @param {object} change {value, _id}
 * @param {object} opts {diff, render, type}
 * @param {string} id
 */
function updateSettingHook(setting, _change, _opts, _id) {
  const reg = WalledTemplateShape.shapeCodeRegister;
  if ( setting.key === SETTINGS.DIAGONAL_SCALING.circle ) {
    if ( setting.value ) reg.set("circle", WalledTemplateSquare);
    else reg.set("circle", WalledTemplateCircle);
  }
}

PATCHES.BASIC.HOOKS = { updateSetting: updateSettingHook };