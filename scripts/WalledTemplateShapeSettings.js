/* globals
canvas,
expandObject,
FormApplication,
foundry,
game
*/
"use strict";

import { MODULE_ID, LABELS, SHAPE_KEYS } from "./const.js";
import { getSetting, setSetting, SETTINGS } from "./settings.js";

/**
 * Settings submenu for setting shape options.
 */
export class WalledTemplateShapeSettings extends FormApplication {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      template: `modules/${MODULE_ID}/templates/walled-templates-settings-menu.html`,
      height: 390,
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
    const shapes = {};
    for ( const shapeKey of SHAPE_KEYS ) {
      shapes[shapeKey] = {
        key: shapeKey,
        ...WalledTemplateShapeSettings.defaultSettings(shapeKey)
      };
    }

    return foundry.utils.mergeObject(data, {
      shapes,
      gridUnits: canvas.scene.grid.units || game.i18n.localize("GridUnits"),
      blockoptions: LABELS.WALLS_BLOCK,
      walloptions: LABELS.WALL_RESTRICTION,
      heightoptions: LABELS.HEIGHT_CHOICES
    });
  }

  static defaultSettings(shapeKey) {
    const settingsObj = {};
    const settingKeys = [
      "DEFAULT_WALLS_BLOCK",
      "DEFAULT_WALL_RESTRICTION",
      "DIAGONAL_SCALING"
    ];
    for ( const key of settingKeys ) settingsObj[key] = getSetting(SETTINGS[key][shapeKey]);
    return settingsObj;
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
