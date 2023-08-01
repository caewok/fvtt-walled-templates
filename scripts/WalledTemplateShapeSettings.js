/* globals
expandObject,
FormApplication,
foundry,
game
*/
"use strict";

import { MODULE_ID, LABELS } from "./const.js";
import { getSetting, setSetting, SETTINGS } from "./settings.js";

/**
 * Settings submenu for setting shape options.
 */
export class WalledTemplateShapeSettings extends FormApplication {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      template: `modules/${MODULE_ID}/templates/walled-templates-settings-menu.html`,
      height: 350,
      title: game.i18n.localize(`${MODULE_ID}.settings.menu.title`),
      width: 600,
      classes: [MODULE_ID, "settings"],
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
    const data = super.getData(options);
    return foundry.utils.mergeObject(data, {
      blockoptions: LABELS.WALLS_BLOCK,
      walloptions: LABELS.WALL_RESTRICTION,
      circle: WalledTemplateShapeSettings.defaultSettings("circle"),
      cone: WalledTemplateShapeSettings.defaultSettings("cone"),
      ray: WalledTemplateShapeSettings.defaultSettings("ray"),
      rect: WalledTemplateShapeSettings.defaultSettings("rect")
    });
  }

  static defaultSettings(shapeKey) {
    return {
      DEFAULT_WALLS_BLOCK: getSetting(SETTINGS.DEFAULT_WALLS_BLOCK[shapeKey]),
      DEFAULT_WALL_RESTRICTIONS: getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[shapeKey]),
      DIAGONAL_SCALING: getSetting(SETTINGS.DIAGONAL_SCALING[shapeKey])
    };
  }

  async _updateObject(_, formData) {
    const expandedFormData = expandObject(formData);
    const promises = [];
    Object.entries(expandedFormData).forEach(([shape, value]) => {
      Object.entries(value).forEach(([settingName, settingValue]) => {
        let settingKey = SETTINGS[settingName][shape];
        promises.push(setSetting(settingKey, settingValue));
        console.debug(`WalledTemplateShapeSettings|_updateObject|${shape}: ${settingName}: ${settingValue}`);
      });
    });
    await Promise.all(promises);
  }
}