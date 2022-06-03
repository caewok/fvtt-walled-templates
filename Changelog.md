## 0.3.2
Improve compatibility with Automated Animations and possibly other modules or systems that expect the template shape to have specific circle or rectangle properties.

## 0.3.1
Improve compatibility with Pathfinder 1e. Consistent grid highlighting based on autotarget settings.

## 0.3.0
Added settings to autotarget tokens from templates.
- Option to add a toggle to template controls.
- Target tokens by whether their center-point falls within the template.
- Target tokens by whether a percentage of their area overlaps the template
Localization improvements for settings.

## 0.2.5
Improve compatibility with Pathfinder 2e. Fixes [issue #4](https://github.com/caewok/fvtt-walled-templates/issues/4)

## 0.2.4
- Do not overwrite the origin object to improve compatibility with Wall Height.
- Use Cohen-Sutherland approach to classifying zones around a rectangle to improve segment intersection identification.

## 0.2.3
Fix rendering error when using a limited angle close to 360º. (Not typically an issue with templates, but inherited fix from light mask.)

## 0.2.2
Fix conflict with PerfectVision by switching ClipperLib to an internal-only import.

## 0.2.1
Fix conflict with light mask where both modules define the same getters.

## 0.2.0
Relies on a version of ClockwiseSweep that can accept arbitrary boundary polygons and temporary walls. Fixes [issue #1](https://github.com/caewok/fvtt-walled-templates/issues/1).

## 0.0.4
Add checks so that when first drawing a new template, the outline shape will have walls blocked if that is the world default.

dnd5e only: Add a checkbox in spell details for AoE spells to determine whether walls block on a per-spell basis.

## 0.0.3
Actually check the world setting for whether walls should block templates by default when creating new templates.

## 0.0.2
Fixed issue with templates facing west. Fixed flag for debugging field-of-vision polygons. Added hook to set the enabled flag when template is first created, so that templates work properly when first placed on the canvas. Added screenshots to the main git readme page.

## 0.0.1
Initial public release. Basic functionality present for all template types: circle, cone, flat cone, rectangle, ray. Templates automatically update when walls are added, modified, or removed. Templates re-draw on canvas load.

Known issues when templates are facing certain directions (primarily west) or are rotated to the west.

## 0.0.1-alpha

Testing framework

