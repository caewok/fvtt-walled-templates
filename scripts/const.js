/* globals
duplicate
*/

"use strict";

export const MODULE_ID = "walledtemplates";

export const FLAGS = {
  WALLS_BLOCK: "wallsBlock",
  WALL_RESTRICTION: "wallRestriction",
  RECURSE_DATA: "recurseData",
  ATTACHED_TOKEN: {
    ID: "attachedTokenId",
    DELTAS: "attachedTokenDelta",
    SPELL_TEMPLATE: "attachToken"
  },
  HIDE: {
    BORDER: "hideBorder",
    HIGHLIGHTING: "hideHighlighting"
  },
  HEIGHT_ALGORITHM: "heightAlgorithm",
  HEIGHT_CUSTOM_VALUE: "heightCustomValue",
  HEIGHT_TOKEN_OVERRIDES: "attachedTokenOverridesHeight",
  ADD_TOKEN_SIZE: "addTokenSize"
};

export const LABELS = {
  WALLS_BLOCK: {
    unwalled: "walledtemplates.MeasuredTemplateConfiguration.unwalled",
    walled: "walledtemplates.MeasuredTemplateConfiguration.walled",
    recurse: "walledtemplates.MeasuredTemplateConfiguration.recurse"
  },

  WALL_RESTRICTION: {
    light: "WALLS.Light",
    move: "WALLS.Movement",
    sight: "WALLS.Sight",
    sound: "WALLS.Sound"
  },

  SPELL_TEMPLATE: {},

  GLOBAL_DEFAULT: "globalDefault"
};

LABELS.SPELL_TEMPLATE.WALLS_BLOCK = duplicate(LABELS.WALLS_BLOCK);
LABELS.SPELL_TEMPLATE.WALL_RESTRICTION = duplicate(LABELS.WALL_RESTRICTION);
LABELS.SPELL_TEMPLATE.WALLS_BLOCK.globalDefault = "walledtemplates.MeasuredTemplateConfiguration.globalDefault";
LABELS.SPELL_TEMPLATE.WALL_RESTRICTION.globalDefault = "walledtemplates.MeasuredTemplateConfiguration.globalDefault";
LABELS.SPELL_TEMPLATE.ATTACH_TOKEN = {
  na: "walledtemplates.dnd5e-spell-config.attach-token.na",
  caster: "walledtemplates.dnd5e-spell-config.attach-token.caster",
  target: "walledtemplates.dnd5e-spell-config.attach-token.target"
};

export const NOTIFICATIONS = {
  NOTIFY: {
    ATTACH_TOKEN_NOT_SELECTED: "walledtemplates.notifications.attach-last-selected-token",
    ATTACH_TOKEN_NOT_TARGETED: "walledtemplates.notifications.attach-last-targeted-token"
  }
};

export const ACTIVE_EFFECT_ICON = `modules/${MODULE_ID}/assets/ruler-combined-solid-gray.svg`;

export const SHAPE_KEYS = ["circle", "cone", "ray", "rect"];
