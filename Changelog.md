## 0.4.5
Use shared geometry lib git submodule.
Fix issue #19 (error during door open/close).

## 0.4.4
Fix issue #14 (Player template changes GM targeting)
Fix issue #15 (Wall Height compatibility). Add an elevation property to wall template and infer template elevation from combatant or last selected token for user.
Fix issue #16 (SWADE rounded cone)
Fix issue #17 (Walls block)
Potential fix for issue #18 (canvas.templates.objects can be null).

## 0.4.3
Added settings to enable template scaling for a 5-5-5 diagonal rule. This replicates functionality originally in [dnd5e helpers](https://github.com/trioderegion/dnd5e-helpers#diagonal-template-scaling).
- Convert circles to squares
- Extend rays based on 5-5-5 diagonal distance.
- Extend cones based on 5-5-5 diagonal distance.

## 0.4.2
Fix issue #13 (default to walled). This apparently also fixed issue #12 (PF2e template creation)!

## 0.4.1
Allow steps of 0.01 increments when setting overlap area. Address issue #11.

## 0.3.5 (v9)
Allow steps of 0.01 increments when setting overlap area. Address issue #11 for v9.

## 0.4.0
Foundry v10 version! Major rewrite to accommodate improvements to v10 ClockwiseSweep and data model. As a result, not compatible with v9.
- No longer overrides the Foundry sweep methodology, which should improve compatibility and results in much less code to upkeep.
- Improved Weiler-Atherton clipping methodology for faster intersects of a polygon with convex polygon shapes.
- New classes to handle different types of regular polygons, including an improved Hexagon class.

## 0.3.4
Use the original Foundry highlight grid method if no walls blocking and autotargeting is set to use the center point. Fixes to improve hex grid highlighting and targeting. Tweak settings descriptions.

## 0.3.3
Improve performance by not triggering a template shape redraw unless either the template
changes or a wall intersecting the template changes.

Requires using a MIXED libWrapper for `MeasuredTemplate.prototype.refresh`. Please file an issue if you encounter compatibility issues with other modules that may use this method.

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

