[![Version (latest)](https://img.shields.io/github/v/release/caewok/fvtt-walled-templates)](https://github.com/caewok/fvtt-walled-templates/releases/latest)
[![Foundry Version](https://img.shields.io/badge/dynamic/json.svg?url=https://github.com/caewok/fvtt-walled-templates/releases/latest/download/module.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=blueviolet)](https://github.com/caewok/fvtt-walled-templates/releases/latest)
[![License](https://img.shields.io/github/license/caewok/fvtt-walled-templates)](LICENSE)

# Walled Templates

This module lets you toggle measured templates so that they can be blocked by walls. For example, if in your game system, walls block *fireball*, you can use this module to determine the extent of the fireball given one or more walls.

This could be used in combination with other modules or macros that automatically target tokens based on measured templates, such as [midi-qol](https://foundryvtt.com/packages/midi-qol/) or [DragonFlagon Quality of Life](https://foundryvtt.com/packages/df-qol).

As of v0.3.0, you also have the option to enable autotargeting of tokens in templates.

# Installation

Add this [Manifest URL](https://github.com/caewok/fvtt-walled-templates/releases/latest/download/module.json) in Foundry to install.

## Dependencies
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)

## Known conflicts
- [DF Template Enhancements](https://foundryvtt.com/packages/df-templates) (See [issue #5](https://github.com/caewok/fvtt-walled-templates/issues/5))

# Usage
When you add a template to the canvas, double click the template drag handle to open the template configuration. Select "Blocked by Walls" to enable for the given template.

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/template_config.jpg" width="400" alt="Screenshot of template configuration for Walled Templates: 'Blocked by Walls' selected">

To make "Blocked by Walls" the default for all templates, select "Default to Walled Measured Templates" in the module configuration.

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/module_config.jpg" width="400" alt="Screenshot of Walled Templates Module configuration: 'Default to Walled Measured Templates' selected">

## dnd5e

For the dnd5e system, this module adds a checkbox to spell detail templates that overrides the world default, so you can indicate on a per-spell basis whether walls should block.

## Macros and advanced usage
This module adds a flag to template objects, `flags.walledtemplates.enabled: true` or `flags.walledtemplates.enabled: false`, to indicate if walls should block a given template. Templates without the flag will use the world default.

## Circle

Walled Templates works with grids or gridless scenes. But it is easiest to see exactly the bounds of the template in a gridless scene.

For example, here is a gridless circle template:

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/circle_gridless.jpg" width="400" alt="Gridless circle template screenshot">

And here is a comparable circle template on a gridded scene:

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/circle_gridded.jpg" width="400" alt="Gridded circle template screenshot">

## Cone

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/cone_gridless.jpg" width="400" alt="Gridless cone template screenshot">

## Rectangle

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/rectangle_gridless.jpg" width="400" alt="Gridless rectangle template screenshot">

## Ray

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/ray_gridless.jpg" width="400" alt="Gridless ray template screenshot">

# Autotargeting

Walled Templates v0.3.0 adds settings to autotarget tokens touched by the template. These settings work with or without enabling "Blocked by Walls". Options include:
1. Disable autotargeting completely.
2. Add a toggle switch to the template controls to enable/disable autotargeting.
3. Enable autotargeting everywhere.

Several settings specified at the "world" level allow you to specify rules for autotargeting. The default targets tokens if their centerpoint is under the template. Alternatively, you can specify a percentage of the token area that must be covered by the template to be considered a target. Gridless or squares use the rectangular (generally, square) hit area for the token area and overlap. Hex grids use the hexagon hit area for the token area and overlap.
