/* globals
duplicate
*/

"use strict";

export const MODULE_ID = "walledtemplates";

export const FLAGS = {
  /** @type {LABELS.WALLS_BLOCK: "unwalled"|"walled"|"recurse"} */
  WALLS_BLOCK: "wallsBlock",

  /** @type {CONST.WALL_RESTRICTION_TYPES} */
  WALL_RESTRICTION: "wallRestriction",

  /** @type {object} */
  RECURSE_DATA: "recurseData",

  ATTACHED_TOKEN: {

    /** @type {string} */
    ID: "attachedTokenId",

    /** @type { x: {number}, y: {number}, elevation: {number} } */
    // Difference between template and attached token.
    DELTAS: "attachedTokenDelta",

    /** @type {Token} */
    // Used to access item flag in `addDnd5eItemConfigurationToTemplate`.
    SPELL_TEMPLATE: "attachToken",

    /** @type {boolean} */
    ROTATE: "rotateWithAttachedToken"
  },

  HIDE: {
    /** @type {boolean} */
    BORDER: "hideBorder",

    /** @type {boolean} */
    HIGHLIGHTING: "hideHighlighting",

    TYPES: {
      GLOBAL_DEFAULT: "globalDefault",
      ALWAYS: "alwaysHide",
      NEVER: "alwaysShow"
    }
  },

  /** @type {boolean} */
  ADD_TOKEN_SIZE: "addTokenSize",

  /** @type {boolean} */
  NO_AUTOTARGET: "noAutotarget"
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

  TEMPLATE_HIDE: {
    globalDefault: "walledtemplates.MeasuredTemplateConfiguration.globalDefault",
    alwaysHide: "walledtemplates.MeasuredTemplateConfiguration.alwaysHide",
    alwaysShow: "walledtemplates.MeasuredTemplateConfiguration.alwaysShow"
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

export const MODULES_ACTIVE = {
  DRAG_RULER: false
};

// Hook init b/c game.modules is not initialized at start.
Hooks.once("init", function () {
  MODULES_ACTIVE.DRAG_RULER = game.modules.get("drag-ruler")?.active;
});
