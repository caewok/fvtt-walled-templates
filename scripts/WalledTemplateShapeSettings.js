/* globals
FormApplication,
game
*/
"use strict";

import { MODULE_ID } from "./const.js";

/**
 * Settings submenu for setting shape options.
 */
export class WalledTemplateShapeSettings extends FormApplication {
  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      template: `modules/${MODULE_ID}/templates/walled-templates-settings-menu.html`,
      height: 700,
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
    };
  }
}
