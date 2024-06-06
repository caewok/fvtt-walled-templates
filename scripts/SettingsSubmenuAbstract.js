/* globals
FormApplication
foundry,
game,
getTemplate,
SettingsConfig
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID } from "./const.js";
import { Settings } from "./settings.js";

export class SettingsSubmenuAbstract extends FormApplication {
  async _renderInner(data) {
    await getTemplate(`modules/${MODULE_ID}/templates/settings-menu-tab-partial.html`, "atvSettingsMenuTabPartial");
    return super._renderInner(data);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize(`${MODULE_ID}.settings.submenu.title`),
      template: `modules/${MODULE_ID}/templates/settings-menu.html`,
      height: "auto",
      width: 700
    });
  }

  getData(options={}) {
    return foundry.utils.mergeObject(super.getData(options), {
      settings: this._prepareCategoryData()
    });
  }

  /**
   * Comparable to SettingsConfig.prototype._updateObject
   */
  async _updateObject(event, formData) {
    let requiresClientReload = false;
    let requiresWorldReload = false;
    const promises = [];
    for ( let [k, v] of Object.entries(foundry.utils.flattenObject(formData)) ) {
      let s = game.settings.settings.get(k);
      let current = game.settings.get(s.namespace, s.key);
      if ( v === current ) continue;
      requiresClientReload ||= (s.scope === "client") && s.requiresReload;
      requiresWorldReload ||= (s.scope === "world") && s.requiresReload;
      promises.push(game.settings.set(s.namespace, s.key, v));
    }
    await Promise.allSettled(promises);
    Settings.cache.clear();
    if ( requiresClientReload || requiresWorldReload ) SettingsConfig.reloadConfirm({world: requiresWorldReload});
  }

  /**
   * Comparable to SettingsConfig.prototype._prepareCategoryData.
   * Prepare the settings data for this module only.
   * Exclude settings that are do not have a tab property.
   */
  _prepareCategoryData() {
    const settings = [];
    const canConfigure = game.user.can("SETTINGS_MODIFY");
    for ( let setting of game.settings.settings.values() ) {
      if ( setting.namespace !== MODULE_ID
        || !setting.tab
        || (!canConfigure && (setting.scope !== "client")) ) continue;

      // Update setting data
      const s = foundry.utils.deepClone(setting);
      s.id = `${s.namespace}.${s.key}`;
      s.name = game.i18n.localize(s.name);
      s.hint = game.i18n.localize(s.hint);
      s.value = game.settings.get(s.namespace, s.key);
      s.type = setting.type instanceof Function ? setting.type.name : "String";
      s.isCheckbox = setting.type === Boolean;
      s.isSelect = s.choices !== undefined;
      s.isRange = (setting.type === Number) && s.range;
      s.isNumber = setting.type === Number;
      s.filePickerType = s.filePicker === true ? "any" : s.filePicker;
      s.dataField = setting.type instanceof foundry.data.fields.DataField ? setting.type : null;
      s.input = setting.input;

      settings.push(s);
    }
    return settings;
  }
}
