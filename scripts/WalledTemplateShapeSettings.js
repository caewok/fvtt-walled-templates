/* globals
canvas,
foundry,
game
*/
"use strict";

import { MODULE_ID, SHAPE_KEYS } from "./const.js";
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

  activateListeners(html) {
    this._initializeDisplayOptions();
    super.activateListeners(html);

    // Disable the override settings until override is enabled.
    for ( const shape of SHAPE_KEYS ) {
      html.find(`[name="${MODULE_ID}.${Settings.KEYS.AUTOTARGET[shape].OVERRIDE}"]`).change(this.shapeOverrideChanged.bind(this, shape));
    }
  }

  _initializeDisplayOptions() {
    // Disable shape override depending on settings.
    for ( const shape of SHAPE_KEYS ) {
      const disable = !Settings.get(Settings.KEYS.AUTOTARGET[shape].OVERRIDE);
      if ( disable ) this.#disableShapeOverride(shape);
    }
  }

  shapeOverrideChanged(shape, event) {
    const disable = !event.target.checked;
    this.#disableShapeOverride(shape, disable);
  }

  #disableShapeOverride(shape, disable = true) {
    const color = disable ? "gray" : "black";

    // Method selection
    const elemMethod = document.getElementsByName(`${MODULE_ID}.${Settings.KEYS.AUTOTARGET[shape].METHOD}`);
    elemMethod[0].disabled = disable;
    elemMethod[0].parentElement.parentElement.style.color = color

    // Percent area selection
    const elemArea = document.getElementsByName(`${MODULE_ID}.${Settings.KEYS.AUTOTARGET[shape].AREA}`);
    elemArea[0].disabled = disable;
    elemArea[0].parentElement.parentElement.style.color = color
  }
}
