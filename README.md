[![Version (latest)](https://img.shields.io/github/v/release/caewok/fvtt-walled-templates)](https://github.com/caewok/fvtt-walled-templates/releases/latest)
[![Foundry Version](https://img.shields.io/badge/dynamic/json.svg?url=https://github.com/caewok/fvtt-walled-templates/releases/latest/download/module.json&label=Foundry%20Version&query=$.compatibility.minimum&colorB=blueviolet)](https://github.com/caewok/fvtt-walled-templates/releases/latest)
[![License](https://img.shields.io/github/license/caewok/fvtt-walled-templates)](LICENSE)
![Latest Release Download Count](https://img.shields.io/github/downloads/caewok/fvtt-walled-templates/latest/module.zip)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fwalledtemplates&colorB=4aa94a)

# Walled Templates

This module lets you toggle measured templates so that they can be blocked by walls. For example, if in your game system, walls block *fireball*, you can use this module to determine the extent of the fireball given one or more walls.

This could be used in combination with other modules or macros that automatically target tokens based on measured templates, such as [midi-qol](https://foundryvtt.com/packages/midi-qol/) or [DragonFlagon Quality of Life](https://foundryvtt.com/packages/df-qol).

As of v0.3.0, you also have the option to enable autotargeting of tokens in templates.

Version v0.4.0 requires v10, and drops v9 compatibility.

# Installation

Add this [Manifest URL](https://github.com/caewok/fvtt-walled-templates/releases/latest/download/module.json) in Foundry to install.

## Dependencies
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)

## Recommended Modules
- [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) will mask animations within templates that are blocked by walls, so that only the unblocked portion is seen.
- [MidiQOL](https://gitlab.com/tposney/midi-qol). Select either "always" or "always ignore defeated" in the "Autotarget on template draw"  setting in MidiQOL workflows and turn on autotargeting in Walled Templates.

## Known conflicts
- [DF Template Enhancements](https://foundryvtt.com/packages/df-templates) (See [issue #5](https://github.com/caewok/fvtt-walled-templates/issues/5))

# Usage
When you add a template to the canvas, double click the template drag handle to open the template configuration. Select "Blocked by Walls" to enable for the given template.

<img src="https://raw.githubusercontent.com/caewok/fvtt-walled-templates/feature/screenshots/screenshots/template_config.jpg" width="400" alt="Screenshot of template configuration for Walled Templates: 'Blocked by Walls' selected">

To make "Blocked by Walls" the default for all templates, select "Default to Walled Measured Templates" in the module configuration.

## dnd5e

For the dnd5e system, this module adds a checkbox to spell detail templates that overrides the world default, so you can indicate on a per-spell basis whether walls should block.

## Autotargeting

Walled Templates v0.3.0 adds settings to autotarget tokens touched by the template. These settings work with or without enabling "Blocked by Walls". Options include:
1. Disable autotargeting completely.
2. Add a toggle switch to the template controls to enable/disable autotargeting.
3. Enable autotargeting everywhere.

Several settings specified at the "world" level allow you to specify rules for autotargeting. (See below.)

# Settings

## Default to walls block
<img
src="https://github.com/caewok/fvtt-walled-templates/blob/feature/screenshots/screenshots/settings-walls-block.jpg" width="400" alt="Screenshot of Walled Templates Module configuration: 'Default to walls block' selected">

If enabled, all newly created templates will be set to have walls block.

## Autotargeting and highlighting
<img
src="https://github.com/caewok/fvtt-walled-templates/blob/feature/screenshots/screenshots/settings-area-overlaps.jpg" width="400" alt="Screenshot of Walled Templates Module configuration for autotargeting and highlighting">

These settings impose rules on how tokens are autotargeted and how grid squares are highlighted.

The default setting targets tokens (and highlights grid squares) if their centerpoint is under the template.

The alternative setting, "Token area overlaps template," allows you can specify a percentage of the token area that must be covered by the template to be considered a target. Gridless or squares use the rectangular (generally, square) hit area for the token area and overlap. Hex grids use the hexagon hit area for the token area and overlap.

Note that while targeting of tokens at medium size is equivalent to highlighting of the grid, this may not be the same for larger tokens. For example, if you select 50% area, a grid square will be highlighted if 50% of that square is covered by the template. But a large token that has only 25% of the token shape covered, would not be autotargeted even if the token shape overlaps the single highlighted grid square.

## Enable autotargeting
<img
src="https://github.com/caewok/fvtt-walled-templates/blob/feature/screenshots/screenshots/settings-autotarget.jpg" width="400" alt="Screenshot of Walled Templates Module Configuration: 'Enable autotargeting' with 'Display toggle button; default off' selected">
<img
src="https://github.com/caewok/fvtt-walled-templates/blob/feature/screenshots/screenshots/template-controls.jpg" align="right" width="100" alt="Screenshot of template controls with added bullseye activated as the fifth control in the set">

This setting controls whether a template will automatically target tokens within the template area. There are four options:
  1. Disable autotargeting completely.
  2. Add a toggle switch to the template controls to control autotargeting; default to disabled.
  3. Add a toggle switch to the template controls to control autotargeting; default to enabled.
  4. Enable autotargeting everywhere.

Options (2) and (3) add a toggle switch to the template controls on the left side of the canvas.

## Macros and advanced usage
This module adds a flag to template objects, `flags.walledtemplates.enabled: true` or `flags.walledtemplates.enabled: false`, to indicate if walls should block a given template. Templates without the flag will use the world default.

# Known issues

## Circles

Circles templates are particularly problematic in Foundry because Foundry tests whether the center point of the template is within the circle, and so when the center point is on the edge of the circle, it can be difficult to know whether a point is in or out, given limited precision of pixels on a canvas. Hex grids can be particularly problematic.

In addition, Walled Templates must translate the circle to a polygon so it can deform the template based on walls. This polygon can only approximate the circle.

<img
src="https://github.com/caewok/fvtt-walled-templates/blob/feature/screenshots/screenshots/circle-hex-grid.jpg" width="400" alt="Screenshot two circles on a row-odd hex grid: one with walls block enabled; one without">

For these reasons, there are some instances, like the above example, where the "walls block" version of the template may deviate slightly from the Foundry version. In the example above, the Walled Templates version is arguably a better representation of a circle on the hex grid because the template is more "balanced". But opinions and use cases can differ.

Walled Templates intends to be the same or nearly the same as the Foundry version of the templates. If you find a particular example where this is not the case, or if you have a specific use case where the Walled Template approximation is insufficient, please feel free to [submit an issue](https://github.com/caewok/fvtt-walled-templates/issues)!

# Examples

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


