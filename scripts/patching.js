/* globals
canvas,
foundry,
game,
ui,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Settings as ModuleSettings } from "./settings.js";
import { Patcher } from "./Patcher.js";

import { PATCHES as PATCHES_MeasuredTemplate } from "./MeasuredTemplate.js";
import { PATCHES as PATCHES_MeasuredTemplateConfig } from "./MeasuredTemplateConfig.js";
import { PATCHES as PATCHES_Token } from "./Token.js";
import { PATCHES as PATCHES_Wall } from "./Wall.js";
import { PATCHES_dnd5e } from "./dnd5e.js";
import { PATCHES as PATCHES_ActiveEffect } from "./ActiveEffect.js";
import { PATCHES as PATCHES_GridLayer } from "./GridLayer.js";


// Settings
import { PATCHES as PATCHES_ClientSettings } from "./ModuleSettingsAbstract.js";

export const PATCHES = {
  ActiveEffect: PATCHES_ActiveEffect,
  ClientSettings: PATCHES_ClientSettings,
  GridLayer: PATCHES_GridLayer,
  MeasuredTemplate: PATCHES_MeasuredTemplate,
  "foundry.applications.sheets.MeasuredTemplateConfig": PATCHES_MeasuredTemplateConfig,
  Token: PATCHES_Token,
  Wall: PATCHES_Wall,
  dnd5e: PATCHES_dnd5e // Only works b/c these are all hooks. Otherwise, would need class breakdown.
};

export const PATCHER = new Patcher();


export function initializePatching() {
  if ( game.system.id === "dnd5e" && foundry.utils.isNewerVersion(game.system.version, "3.99") ) {
    PATCHES.dnd5e.dnd5e.HOOKS["dnd5e.postUseActivity"] = PATCHES.dnd5e.dnd5e.HOOKS["dnd5e.useItem"];
    delete PATCHES.dnd5e.dnd5e.HOOKS["dnd5e.useItem"];
  }

  PATCHER.addPatchesFromRegistrationObject(PATCHES);
  PATCHER.registerGroup("BASIC");
  PATCHER.registerGroup(game.system.id);
}

/**
 * Register the autotargeting patches. Must be done after settings are enabled.
 */
export function registerAutotargeting() {
  const autotarget = ModuleSettings.get(ModuleSettings.KEYS.AUTOTARGET.MENU) !== ModuleSettings.KEYS.AUTOTARGET.CHOICES.NO;

  // Disable existing targeting before completely removing autotarget patches
  if ( PATCHER.groupIsRegistered("AUTOTARGET") && !autotarget ) {
    canvas.templates.placeables.forEach(t => t.autotargetTokens());
  }

  PATCHER.deregisterGroup("AUTOTARGET");
  if ( autotarget ) { PATCHER.registerGroup("AUTOTARGET"); }

  // Redraw the toggle button.
  if ( canvas.templates.active
    && ui.controls ) ui.controls.initialize({layer: canvas.templates.constructor.layerOptions.name});
}
