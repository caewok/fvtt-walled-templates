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
          - **Reflecting templates:** Ray and cone templates can be configured to reflect off walls.

          - **Spreading Templates:** Circle and rectangle templates can be configured to "spread" around walls.
            When encountering the corner of a wall, the template will spawn a child template at that corner, with
            radius equal to the remaining distance. The various children are combined to construct the final template.

          - **Wall restriction type:** Templates can be configured with a wall restriction type:
            *sight*, *sound*, *light*, or *move*. Templates will ignore walls that do not block the
            type for that template. For example, set a *ray of light* spell to the *light* type, and then
            walls that do not block light (like windows) will let that ray through.

          - **Updated settings:** Settings have been updated to accommodate the addition of the reflecting/spreading
            option. You may need to update your preferred default settings accordingly. A "CONFIG.walledtemplates" property
            has also been added to allow more customization. See the Git page for details.`
    })

    .addEntry({
      version: "0.5.2",
      title: "Wall Restriction and Global Defaults",
      body: `\
          - **Wall restriction default settings:** GMs can now set default choices for the wall restriction
            type for the different template shapes in Settings. (This was previously a hidden CONFIG setting.)

          - **Global defaults in dnd5e spell items:** In dnd5e spell configuration for template spells,
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

          - **Revamped rectangle template spread:** Using "spread" with rectangular templates now
            operates a bit differently than before and should be more useful. At each corner within the
            rectangle, a new smaller rectangle is drawn in the four cardinal directions. The resulting
            template is better able to move around walls but does not exceed the original template shape.`
    })

    .addEntry({
      version: "0.6.3",
      title: "Token Attachment",
      body: `\
          - **Attach tokens to template:** In the template configuration, you can now choose to attach a
            token to a template! When attached, the template can no longer be dragged but instead moves
            in sync with the token. The template is linked via adding an active effect to the token. Deleting
            the active effect, the token, or the template will sever the link. Or detach the token in the template
            configuration. For dnd5e, I have added a configuration in the spell template to link the template with
            either the caster or the last targeted token (prior to spell casting).

          - **Dragging no longer autotargets:** If a template is dragged (or dragged via an attached token), it no
            longer autotargets tokens during the drag. Instead, a more transparent "target" is indicated, to show
            what would be targeted if the template were dropped at that point (or the dragged token was dropped).
            This is meant to avoid inadvertent autotargeting that might trigger active effects during a template drag.

          - **Future efforts:** If you have ideas for how to better integrate the active effect used for token/template
            attachment, feel free to reach out to me on Discord or on my Github issues page. You may also notice that
            templates have an elevation configuration now—--I am considering options to provide some handling of 3d templates.`
    })

    .addEntry({
      version: "0.6.6",
      title: "Template Hiding",
      body: `\
          The GM can now hide template highlighting or template borders in the game settings.
          Hovering over the template control icon will still show the highlighting and border. Animations
          continue to display regardless of this setting. This is mostly intended to facilitate better-looking
          animations used with templates. Thanks to @TMinz for the idea!`
    })

    .addEntry({
      version: "0.6.7",
      title: "Grid Snapping",
      body: `\
          - **Grid snapping setting:** New setting added that will force dragged templates to snap-to-grid. Hold
            shift to get half-snapping, which allows templates to still be centered on grid squares.

          - **Improvements to hiding:** Changes to template highlight and border hiding. Non-owners can now go to the
            template layer and hover over the template control icon to reveal highlighting and border.
            Non-owners cannot control the template (the control icon is partially transparent to indicate this) and if the template is
            hidden, nothing will appear in the template layer, as expected in default Foundry.

          - **Requires Foundry v11.308:** Walled Templates does not currently force you to use Foundry v11.308, but certain changes
            in v11.308 mean that older versions of Foundry may not play nicely with Walled Templates from now on.`
    })

    .addEntry({
      version: "0.6.8",
      title: "Dnd5e Spell Item Improvements",
      body: `\
          - **Account for token size:** In dnd5e, added a toggle in the spell item configuration to add the token size (min width/height)
            to the template distance if the template originates at the center of a token.

          - **Spell configuration legend.** In dnd5e, the spell item configuration now displays Walled Template configuration options
            in a distinct area, identified by a header. (Only displays when valid spell template shapes are chosen.)`
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
