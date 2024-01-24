/* globals
canvas,
game
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Settings } from "./settings.js";
import { Patcher } from "./Patcher.js";

import { PATCHES as PATCHES_MeasuredTemplate } from "./MeasuredTemplate.js";
import { PATCHES as PATCHES_MeasuredTemplateConfig } from "./MeasuredTemplateConfig.js";
import { PATCHES as PATCHES_Token } from "./Token.js";
import { PATCHES as PATCHES_Wall } from "./Wall.js";
import { PATCHES_dnd5e } from "./dnd5e.js";
import { PATCHES as PATCHES_ActiveEffect } from "./ActiveEffect.js";
import { PATCHES as PATCHES_Setting } from "./Setting.js";
import { PATCHES as PATCHES_AbilityTemplate } from "./AbilityTemplate.js";

// Settings
import { PATCHES as PATCHES_Settings } from "./ModuleSettingsAbstract.js";

export const PATCHES = {
  "dnd5e.canvas.AbilityTemplate": PATCHES_AbilityTemplate,
  ActiveEffect: PATCHES_ActiveEffect,
  MeasuredTemplate: PATCHES_MeasuredTemplate,
  MeasuredTemplateConfig: PATCHES_MeasuredTemplateConfig,
  Settings: PATCHES_Settings,
  Setting: PATCHES_Setting,
  Token: PATCHES_Token,
  Wall: PATCHES_Wall,
  dnd5e: PATCHES_dnd5e // Only works b/c these are all hooks. Otherwise, would need class breakdown.
};

export const PATCHER = new Patcher();
PATCHER.addPatchesFromRegistrationObject(PATCHES);

export function initializePatching() {
  PATCHER.registerGroup("BASIC");
  PATCHER.registerGroup(game.system.id);
}

/**
 * Register the autotargeting patches. Must be done after settings are enabled.
 */
export function registerAutotargeting() {
  const autotarget = Settings.get(Settings.KEYS.AUTOTARGET.MENU) !== Settings.KEYS.AUTOTARGET.CHOICES.NO;

  // Disable existing targeting before completely removing autotarget patches
  if ( PATCHER.groupIsRegistered("AUTOTARGET") && !autotarget ) {
    canvas.templates.placeables.forEach(t => t.autotargetTokens());
  }

  PATCHER.deregisterGroup("AUTOTARGET");
  if ( autotarget ) PATCHER.registerGroup("AUTOTARGET");

  // Redraw the toggle button.
  if ( canvas.templates.active
    && ui.controls ) ui.controls.initialize({layer: canvas.templates.constructor.layerOptions.name});
}
