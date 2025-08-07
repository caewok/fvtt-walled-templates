/* globals
foundry,
game,
Hooks,
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

  /** @type {string}*/
  ATTACHED_TEMPLATE_ID: "attachedTemplateId",

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
    /** @type {HIDE.TYPES} */
    BORDER: "hideBorder",

    /** @type {HIDE.TYPES} */
    HIGHLIGHTING: "hideHighlighting",

    TYPES: {
      GLOBAL_DEFAULT: "globalDefault",
      ALWAYS_HIDE: "alwaysHide",
      ALWAYS_SHOW: "alwaysShow"
    },

    TOKEN_HOVER: "tokenHover", // Whether user is currently hovering over a token within this template.

    /** @type {HIDE.TYPES} */
    SHOW_ON_HOVER: "showOnHover" // Template-specific show/hide hover setting.
  },

  SNAPPING: {
    /** @type {boolean} */
    CENTER: "snapCenter",

    /** @type {boolean} */
    CORNER: "snapCorner",

    /** @type {boolean} */
    SIDE_MIDPOINT: "snapSideMidpoint"
  },

  /** @type {boolean} */
  ADD_TOKEN_SIZE: "addTokenSize",

  /** @type {boolean} */
  NO_AUTOTARGET: "noAutotarget",

  /** @type {string} */
  VERSION: "version"
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

LABELS.SPELL_TEMPLATE.WALLS_BLOCK = foundry.utils.duplicate(LABELS.WALLS_BLOCK);
LABELS.SPELL_TEMPLATE.WALL_RESTRICTION = foundry.utils.duplicate(LABELS.WALL_RESTRICTION);
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

export const TEMPLATES = {
  DND5E: `modules/${MODULE_ID}/templates/dnd5e-spell-template-config.html`,
  CONFIG_TABS: `modules/${MODULE_ID}/templates/measured-template-config-tabs.html`,
  CONFIG_PARTIAL: `modules/${MODULE_ID}/templates/measured-template-config.html`,
  CONFIG_BASIC: `modules/${MODULE_ID}/templates/foundry-template-config.html`
};

export const ACTIVE_EFFECT_ICON = `modules/${MODULE_ID}/assets/ruler-combined-solid-gray.svg`;

export const SHAPE_KEYS = ["circle", "cone", "ray", "rect"];

export const MODULES = {
  DRAG_RULER: { ACTIVE: false, ID: "drag-ruler" },
  TOKEN_MAGIC: { ACTIVE: false, ID: "tokenmagic" },
  LEVELS: { ACTIVE: false, ID: "levels" },
  WALL_HEIGHT: { ACTIVE: false, ID: "wall-height"}
};

// Hook init b/c game.modules is not initialized at start.
Hooks.once("init", function () {
  MODULES.DRAG_RULER.ACTIVE = game.modules.get(MODULES.DRAG_RULER.ID)?.active;
  MODULES.TOKEN_MAGIC.ACTIVE = game.modules.get(MODULES.TOKEN_MAGIC.ID)?.active;
  MODULES.LEVELS.ACTIVE = game.modules.get(MODULES.LEVELS.ID)?.active;
  MODULES.WALL_HEIGHT.ACTIVE = game.modules.get(MODULES.WALL_HEIGHT.ID)?.active;
});
