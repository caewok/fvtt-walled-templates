[![Version (latest)](https://img.shields.io/github/v/release/caewok/fvtt-walled-templates)](https://github.com/caewok/fvtt-walled-templates/releases/latest)
[![Foundry Version](https://img.shields.io/badge/dynamic/json.svg?url=https://github.com/caewok/fvtt-walled-templates/releases/latest/download/module.json&label=Foundry%20Version&query=$.minimumCoreVersion&colorB=blueviolet)](https://github.com/caewok/fvtt-walled-templates/releases/latest)
[![License](https://img.shields.io/github/license/caewok/fvtt-walled-templates)](LICENSE)

![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https://forge-vtt.com/api/bazaar/package/walledtemplates&colorB=4aa94a)
![Latest Release Download Count](https://img.shields.io/github/downloads/caewok/fvtt-walled-templates/latest/module.zip)
![All Downloads](https://img.shields.io/github/downloads/caewok/fvtt-walled-templates/total)

# Walled Templates

This module lets you toggle measured templates so that they can be blocked by walls. For example, if in your game system, walls block *fireball*, you can use this module to determine the extent of the fireball given one or more walls.

This could be used in combination with other modules or macros that automatically target tokens based on measured templates, such as [midi-qol](https://foundryvtt.com/packages/midi-qol/) or [DragonFlagon Quality of Life](https://foundryvtt.com/packages/df-qol).

## Summary of major version updates
- v0.3: Option to enable autotargeting of tokens under templates.
- v0.4: Requires Foundry v10; drops v9 compatibility.
- v0.5: Templates can reflect off walls (rays/cones) or spread around walls (circles, rectangles).

# Installation

Add this [Manifest URL](https://github.com/caewok/fvtt-walled-templates/releases/latest/download/module.json) in Foundry to install.

If you are still in v9 and you have an older version of Walled Templates (e.g., v0.3.3), Foundry may not let you update to a newer v9 version of Walled Templates (e.g., v0.3.4). Uninstalling and reinstalling Walled Templates should, however, get you the latest update for Foundry v9. See [this Foundry issue](https://github.com/foundryvtt/foundryvtt/issues/8115).

## Dependencies
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)

## Recommended Modules
- [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) will mask animations within templates that are blocked by walls, so that only the unblocked portion is seen.
- [MidiQOL](https://gitlab.com/tposney/midi-qol). Select either "always" or "always ignore defeated" in the "Autotarget on template draw"  setting in MidiQOL workflows and turn on autotargeting in Walled Templates.

## Known conflicts
- [DF Template Enhancements](https://foundryvtt.com/packages/df-templates) (See [issue #5](https://github.com/caewok/fvtt-walled-templates/issues/5))

# Usage
When you add a template to the canvas, double click the template drag handle to open the template configuration. In the Walled Templates area of the configuration, you can select whether walls "Do Not Block Template," "Block Template," or "Reflect/Spread template." In the configuration, you can also select whether the template should be considered "light," "sound," "sight," or "move" with respect to walls. (In Foundry VTT, these are "wall restriction types.") Select `move` if the template represents a physical object that is blocked by the same sort of things that would block token movement.

<img width="396" alt="Screenshot 2023-04-04 at 1 29 00 PM" src="https://user-images.githubusercontent.com/1267134/229947415-a5581b44-86f7-4c17-a6bd-b5f8ebde3c7b.png">

## Blocked by Walls
When blocked by walls, walls will block the template unless the wall does not block the selected wall restriction type (light, sound, sight, or move). For example, if you set a ray template to "light," walls that are set to not block light, like windows, would let the ray pass.

## Reflect
The "Reflect/Spread" setting, when applied to rays or cones, will cause these templates to reflect or "bounce" off walls. The direction of the reflection is based on the direction of the originating ray or cone. Multiple reflections are possible.

[Walled Template Ray Bounce.webm](https://user-images.githubusercontent.com/1267134/229948849-e27b3cf0-33e1-43e9-8459-6beb000efd90.webm)

[Walled Templates Cone Bounce.webm](https://user-images.githubusercontent.com/1267134/229948879-41c83f30-96d5-47a1-a523-4e3b9d3e78c0.webm)

## Spread

The "Reflect/Spread" setting, when applied to circles or rectangles, causes the template to "spread" around corners. When the template encounters a wall corner, it propogates a "child" template with radius equal to the remaining distance for the template at that point. In other words, a circle template that encounters a corner will create a smaller circle template at that corner, allowing it to expand around the corner. Multiple "children" can be spawned for a given template.

[Walled Template Circle Spread.webm](https://user-images.githubusercontent.com/1267134/229948904-35a39500-c479-41c2-872b-02f47ea880cc.webm)

## dnd5e

For the dnd5e system, this module adds a checkbox to spell detail templates that overrides the world default, so you can indicate on a per-spell basis whether walls should block, reflect, or spread the given template. You can also select the wall restriction type.

<img width="558" alt="Screenshot 2023-04-04 at 1 29 32 PM" src="https://user-images.githubusercontent.com/1267134/229948657-f2367488-f58e-4cbb-b411-22b6d507c5ad.png">

As of v0.4.3, this module has settings to use the diagonal scaling originally found in [dnd5e helpers module](https://github.com/trioderegion/dnd5e-helpers#diagonal-template-scaling).
- Convert circles to squares to conform to the 5-5-5 diagonal.
- Extend rays based on 5-5-5 diagonal distance.
- Extend cones based on 5-5-5 diagonal distance.

## Autotargeting

Walled Templates v0.3.0 adds settings to autotarget tokens touched by the template. These settings work with or without enabling "Blocked by Walls". Options include:
1. Disable autotargeting completely.
2. Add a toggle switch to the template controls to enable/disable autotargeting.
3. Enable autotargeting everywhere.

Several settings specified at the "world" level allow you to specify rules for autotargeting. (See below.)

To disable autotargeting on a per-actor basis, enable an active effect on the token with "Attribute Key" set to "system.details.type.custom", "Change Mode" set to "Add", and "Effect Value" set to "NoTarget". This property is the same as that used by Midi Qol to ignore targeting.

# Settings

## Default to walls block or reflect/spread.
<img width="955" alt="Screenshot 2023-04-04 at 1 27 58 PM" src="https://user-images.githubusercontent.com/1267134/229949638-1de99006-30f3-4eda-bb22-7a908bf02ee9.png">

If enabled, all newly created templates of the given shape will be set to have walls block or reflect/spread, as selected.

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

# Advanced usage

## API
This module adds two flags to template objects:
- `flags.walledtemplates.wallsBlock`: String. `unwalled`, `walled`, or `recurse`.
- `flags.walledtemplates.wallRestriction`: String. `light`, `sound`, `sight`, or `move`.

## CONFIG
This module adds several values to `CONFIG.walledtemplates` that modules, macros, or world scripts can modify:
```js
/**
 * Number of recursions for each template type when using spread or reflect.
 * (circle|rect: spread; ray|cone: reflect)
 * @type { object: number }
 */
recursions: {
  circle: 4,
  rect: 4,
  ray: 8,
  cone: 4
},

/**
 * Pixels away from the corner to place child templates when spreading.
 * (Placing directly on the corner will cause the LOS sweep to fail to round the corner.)
 * @type {number}
 */
 cornerSpacer: 10
```
Increasing the number of recursions will increase the number of reflections permitted, or for spreading, number of generations of children that may be spawned. There is a performance cost to increase recursions.

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


