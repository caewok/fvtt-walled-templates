/* globals
canvas,
expandObject,
FormApplication,
foundry,
game
*/
"use strict";

import { MODULE_ID, LABELS, SHAPE_KEYS } from "./const.js";
import { Settings } from "./settings.js";
import { SettingsSubmenuAbstract } from "./SettingsSubmenuAbstract.js";

/**
 * Settings submenu for setting shape options.
 */
export class WalledTemplateShapeSettings extends SettingsSubmenuAbstract {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: "form",
          initial: "circle"
        }
      ],
      submitOnClose: false,
      closeOnSubmit: true
    });
  }

  getData(options={}) {
    return foundry.utils.mergeObject(super.getData(options), {
      gridUnits: canvas.scene.grid.units || game.i18n.localize("GridUnits")
    });
  }
}
