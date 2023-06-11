/* globals
Hooks,
game,
showdown,
Dialog
*/
"use strict";

import { MODULE_ID } from "./const.js";
import { SETTINGS, getSetting, setSetting } from "./settings.js";
const CHANGELOG = SETTINGS.CHANGELOG;

// From Perfect Vision
// https://github.com/dev7355608/perfect-vision/blob/cdf03ae7e4b5969efaee8e742bf9dd11d18ba8b7/scripts/changelog.js


Hooks.once("ready", () => {
  if (!game.user.isGM) {
    return;
  }

  game.settings.register(
    MODULE_ID,
    CHANGELOG,
    {
      scope: "client",
      config: false,
      type: Number,
      default: 0
    }
  );

  new ChangelogBuilder()
    .addEntry({
      version: "0.5.0",
      title: "Reflecting and Spreading Templates",
      body: `\
          - **Reflecting Templates:** Ray and cone templates can be configured to reflect off walls.
          - **Spreading Templates:** Circle and rectangle templates can be configured to "spread" around walls.
            When encountering the corner of a wall, the template will spawn a child template at that corner, with
            radius equal to the remaining distance. The various children are combined to construct the final template.
          - **Wall Restriction Type:** Templates can be configured with a wall restriction type:
            *sight*, *sound*, *light*, or *move*. Templates will ignore walls that do not block the
            type for that template. For example, set a *ray of light* spell to the *light* type, and then
            walls that do not block light (like windows) will let that ray through.
          - **Updated Settings:** Settings have been updated to accommodate the addition of the reflecting/spreading
            option. You may need to update your preferred default settings accordingly. A "CONFIG.walledtemplates" property
            has also been added to allow more customization. See the Git page for details.`
    })

    .addEntry({
      version: "0.5.2",
      title: "Wall Restriction and Global Defaults",
      body: `\
          - **Wall Restriction Default Settings:** GMs can now set default choices for the wall restriction
            type for the different template shapes in Settings. (This was previously a hidden CONFIG setting.)

          - **Global Defaults in DND5e Spell Items:** In dnd5e spell configuration for template spells,
            the choice will default to "Use global default" for wall blocking and wall restriction type.
            (This will not affect existing spell items.)`
    })

    .addEntry({
      version: "0.6.0",
      title: "Foundry v11",
      body: `\
          - **Updated for v11:** Walled Templates is now updated for Foundry v11. If you need to
            regress back to v10, you should be able to use the version 0.5 series of this module in v10.
            Quite a bit of code changed for the update to v11; as always, please report any bugs to my Github.

          - **Revamped Rectangle Template Spread:** Using "spread" with rectangular templates now
            operates a bit differently than before and should be more useful. At each corner within the
            rectangle, a new smaller rectangle is drawn in the four cardinal directions. The resulting
            template is better able to move around walls but does not exceed the original template shape.`
    })

    .build()
    ?.render(true);
});


/**
 * Display a dialog with changes; store changes as entries.
 */
class ChangelogBuilder {
  #entries = [];

  addEntry({ version, title = "", body }) {
    this.#entries.push({ version, title, body });
    return this;
  }

  build() {
    const converter = new showdown.Converter();
    const curr = getSetting(CHANGELOG);
    const next = this.#entries.length;
    let content = "";

    if (curr >= next) {
      return;
    }

    for (let [index, { version, title, body }] of this.#entries.entries()) {
      let entry = `<strong>v${version}</strong>${title ? ": " + title : ""}`;

      if (index < curr) {
        entry = `<summary>${entry}</summary>`;
      } else {
        entry = `<h3>${entry}</h3>`;
      }

      let indentation = 0;

      while (body[indentation] === " ") indentation++;

      if (indentation) {
        body = body.replace(new RegExp(`^ {0,${indentation}}`, "gm"), "");
      }

      entry += converter.makeHtml(body);

      if (index < curr) {
        entry = `<details>${entry}</details><hr>`;
      } else if (index === curr) {
        entry += "<hr><hr>";
      }

      content = entry + content;
    }

    return new Dialog({
      title: "Walled Templates: Changelog",
      content,
      buttons: {
        view_documentation: {
          icon: `<i class="fas fa-book"></i>`,
          label: "View documentation",
          callback: () => window.open("https://github.com/caewok/fvtt-walled-templates/blob/master/README.md")
        },
        dont_show_again: {
          icon: `<i class="fas fa-times"></i>`,
          label: "Don't show again",
          callback: () => setSetting(CHANGELOG, next)
        }
      },
      default: "dont_show_again"
    });
  }
}
