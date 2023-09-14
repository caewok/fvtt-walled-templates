## 0.6.9
Fix for overhead tiles not working as expected. Closes issue #62.
Update to geometry lib v0.2.8.

## 0.6.8
Grouped the dnd5e spell configuration properties for Walled Template in a distinct area, with a header, to help distinguish those properties from base dnd5e properties.
Add toggle to the dnd5e spell configuration to increase template size by the token size if a token is directly under the template origination point. Best used with spells like *spirit guardians* that would be ineffective when used by larger tokens, like dragons. Closes issue #55.
Fixes for highlighting weirdness along borders when the highlighting setting is set to area === 0. Workaround for potential Foundry bug issue [#9991](https://github.com/foundryvtt/foundryvtt/issues/9991). Closes issue #60.
Fix for square templates not displaying animations. Closes issue #58.

Update to geometry lib v0.2.7.

## 0.6.7
Add setting to snap-to-grid when dragging templates. Closes issue #53.
Avoid errors when removing a token with an attached template or when attaching a token that was immediately attached and then removed previously. Closes issue #50.
Address change in Foundry v11.308 that caused the border to disappear. Closes issue #51. As a result, weirdness may ensue if a version lower than v11.308 is used.
Allow non-owners of templates to see the control icon when in the template layer, and when hovering over the control icon, the hidden template border and highlight will appear. Closes issue #46.
As a result of addressing #51 and by switching to hiding the highlight layer by setting alpha to 0, improved compatibility with Token Magic FX. Closes issue #49.
Add option to compute the shape without recursion, for use by modules like Sequencer.
Possible fix for #47 (Drag Ruler compatibility) by fixing issue #50.
Merged PR to close #52 (SVG dimensions). Thanks @morepurplemorebetter!

## 0.6.6
Add setting to hide template border or highlighting. Closes issue #43.
Fix for sequencer animations of rectangle shapes. Closes issue #44.

## 0.6.5
Fix for template attaching not working in SWADE, possibly other systems. Closes issue #35.
Fix for midi no-targe flag. Closes issue #37.
Fix for limited height walls ignoring templates. Closes issue #39. Needs additional thought on how to properly handle template elevation with limited height walls in a reasonable way.
Fix for templates not updating when walls updated. Closes issue #40.
Fix for attached template token dragging failing (completely) when autotarget is off. Closes issue #38.
Possible fix for template highlighting to better follow targeting/area rules. Closes issue #36.
Added methods for padding a given template shape. Closes issue #41.

Update to geometry lib v0.2.5.

## 0.6.4
Fix conversion of circles to equivalent square templates, for 5-5-5 diagonal rule. Closes issue #33.

Fix error when an active effect has no origin. Closes issue #34.

## 0.6.3
Add the ability to connect a token to a template, syncing template movement and elevation to the token. If the template origin is at the token center, rotation is also synced. Templates are added to tokens as active effects. Methods for token/template attachment:
- `Token.prototype.attachTemplate`
- `Token.prototype.attachedTemplates`
- `Token.prototype.detachTemplate`
- `MeasuredTemplate.prototype.attachToken`
- `MeasuredTemplate.prototype.attachedToken`
- `MeasuredTemplate.prototype.detachToken`

Tokens can be attached to templates in the template configuration. For dnd5e, a setting in the spell configuration will attach a spell template to the caster or to the last targeted token.

Dragged templates (or dragged tokens with attached templates) will no longer target tokens. Instead, a more transparent "target" will be shown, indicating what would be targeted if either the template was dropped or if the token move (for attached templates) was allowed to complete. This avoids unintentional triggering of active effects based on dragging a template that is autotargeting.

Moved the default template settings to a tabbed submenu to make the settings configuration more manageable. Some cleanup of configuration labels and use of tooltips to conserve space in certain places. Improvements to the `WalledTemplateShape` class to facilitate subclassing of different shapes. Improvements to patching and adding methods.

Update geometry lib to v0.2.3.

## 0.6.2
Update geometry lib to v0.2.2.
Use `MeasuredTemplate.getCircleShape`, etc. static methods introduced in v11.302.
Fix for Wall Height issue with templates ignoring limited height walls. Closes issue #30.

## 0.6.1
Update geometry lib to v0.2.1.

## 0.6.0
Updated for v11. Update geometry lib to v0.2.0.

Refactor the spread/reflect code with some improvements to rectangular spreads.

## 0.5.2
Fix for console error when placing square templates (issue #26).

Ignore targeting for tokens that have the `actor.system.details.type.custom` property set to "NoTarget". To set this in Foundry, enable an active effect on the token with "Attribute Key" set to "system.details.type.custom", "Change Mode" set to "Add", and "Effect Value" set to "NoTarget". (Issue #28.)

Add settings so the GM can set a default wall restriction type for each template shape. Use a "Global default" choice in spell item drop-downs to pass through the default wall restriction and wall blocking choice to the template when created. (Issue #27.)

## 0.5.1
Update geometry lib to v0.1.5.
Add recurse data flag for use by other modules.
Fix dropping templates from the chat log in dnd5e (lookup item using dnd5e origin flag).

## 0.5.0
Added option to configure circles and rectangles to spread around walls. Addresses issue #22.
Added option to configure rays and cones to reflect off walls.
Added option to configure templates to be *move*, *light*, *sound*, or *sight*. Templates will ignore walls that do not block the corresponding type. Addresses issue #24.
Added changelog pop-up dialog when first installing or updating.

## 0.4.9
Update geometry lib to v0.1.4.

## 0.4.8
Update geometry lib to v0.1.3.

## 0.4.7
Update geometry lib to v0.1.1.

## 0.4.6
Possible fix for issue #20 (poly.close method does not exist).

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

