## 0.8.4
Avoid error re modification not allowed when viewing spell from compendium. #134.


## 0.8.3
Fix incorrect merge that caused the snap-to-grid configs not to appear.

## 0.8.2
Add module config and template config settings to modify how snap-to-grid works. Also added to dnd5e spell config, but this will not affect template previews in dnd5e until [PR](https://github.com/foundryvtt/dnd5e/pull/4649) is accepted. #116.
Add module config to use a rotating square instead of a circle template. #118.

## 0.8.1
Dnd5e v4 compatibility. #128.
Tidy sheets compatibility. #129. Thanks @morepurplemorebetter!
Fix for preview templates not respecting elevation. #113.
Fix attached templates not changing elevation when the token elevation changes. #123.
Fix issue with changing multiple wall heights when Wall Height module is present. #125.
Add check to confirm `actor.statuses` is defined. #127.
Add Brazilian Portuguese translation. #119. Thanks @Kharmans!

## 0.8.0
Foundry v12 compatibility.
Use tabbed configuration for measured template config and dnd5e spell config.
Remove snapping option; now handled by Foundry default.
Remove elevation tooltip and configuration; now handled by Foundry default.
Remove diagonal 5-5-5 shape options; now handled by Foundry default.

## 0.7.11

### Features
Delete attached templates when their token is deleted from the scene. When a template is attached, respect its hide settings when the attached token is being moved/dragged. Thanks @gambit for the suggestions!

## 0.7.10
Quick fix for erroneous duplicated call to `wrapped` in `_onDragLeftStart` method.

## 0.7.9
Attempt to catch when other modules mess with the template layers and temporarily revert to avoid errors on drag start. Closes #112. Thanks @Michael (Discord)!
Add a `CONFIG.walledtemplates.autotargetStatusesToIgnore` that defines a set (modifiable by macro or world script) of token statuses to ignore when autotargeting. Closes #108.
Add selection (always/never/global default) in the template configuration and, for dnd5e, the spell configuration to determine whether a template should be revealed upon token hover. Closes #111.

Add Brazilian Portugese translation. Thanks @Kharmans!
Potential fix for Levels and Wall Height issue. Closes #66. Thanks @morepurplemorebetter!

## 0.7.8
Catch when a template shape is undefined or incorrectly defined such that it does not have a `getBounds` method. Avoids `getBounds` undefined error that may be related to TokenMagic module.
When unhiding a template, set template alpha to the TokenMagic alpha setting for the template if that module is active and the flag is present. Closes #110.
When checking if a template should be hidden, hide the template if TokenMagic is active and the template is set to observe global defaults and TokenMagic setting is set to hide the template.
The template shape is now set to top/bottom elevation of the template elevation, so that Wall Height walls not within the elevation of the template do not block. Closes in part #100.

## 0.7.7
Provide `MeasuredTemplate.prototype.targetsWithinShape` method at all times, not just when autotargeting is enabled. Closes #104.
Don't refresh targeting on a template not owned by the current user, to avoid refreshing targets incorrectly. Closes #105.

## 0.7.6

### Features
Add a toggle to force no autotargeting for a given spell template in dnd5e. Closes #102.

### Bug fixes
Address "endsWith" function not defined when using "attach to caster" in dnd5e. Closes  #101.
Switch to storing a module-specific flag on active effects representing an attached template. Avoids conflicts with other modules that use the effect origin. Closes #102.

## 0.7.5

### Features
Change the template configuration to a dropdown so user can choose to always/never/use global defaults for hiding template border and highlighting. Add the same dropdown to dnd5e spell configuration to pass those choices to the spell template. Closes #98.

### Bug fixes
Fix for show highlighting on token hover failing. Closes #99.

## 0.7.4

### Features
Add flag and MeasuredTemplate config to disable autotargeting for specific template.
Add keybinding to unhide template highlighting and borders. Add toggle to template configuration to force display of specific template highlighting and borders (flags: `forceBorder` and `forceHighlighting`). Closes #93, #95.
Add toggle to template configuration to disable autotargeting for specific template (flag: `noAutotarget`).
Add elevation tooltip.

### Bug fixes
Incorporate PR #89 and #90 from @strongpauly. Thanks!
Switch to a single toggle option (instead of 2) for autotargeting in settings. Fix for template target sets being shared between targets. Templates now do not autotarget on load if autotargeting is not enabled or the autotarget toggle is disabled. Closes #88.
Update lib geometry to v0.2.19.

## 0.7.3
Force the template to stick to its set distance when the token drag is completed. Ensure drag method is awaiting the underlying method to avoid ghosting when using Elevation Ruler to drag tokens. Closes issue #86.

Add a setting to show templates on token hover. Closes issue #84.

## 0.7.2
Force template preview in dnd5e to snap to grid if snapping is enabled. Closes issue #81.
Render template settings in the dnd5e Feature configuration. Closes issue #80.
Ensure autotarget settings are correctly registered on canvas load. Closes issue #85.
Switch to debug logging for when the sweep polygon is broken, which now seems to occur only when placing the template at the canvas edge results in the template being completely blocked. Closes issue #74.
Update lib geometry to v0.2.13.

## 0.7.1
Fix for Settings.cache undefined error.
Improve compatibility with Automated Animations when hiding template graphics. Closes issue #82.
Fix for template attachment config not finding the last selected token.
Fix for null attachedTemplates in Token hook. Closes issue #76.

## 0.7.0
Add keybinding to toggle template autotargeting. Closes issue #69.
Hide text of the template when hiding the border. Closes issue #45. Switch to using the template refresh hook for better compatibility.
Add settings to override the highlight/autotarget method and area for specific shapes. Closes issue #54.

Updates to patching methods.
Update geometry lib to v0.2.12.
Fix for undefined `attachedTemplate` on token update. Closes issue #75.
Fix for template preview not observing global defaults. Closes issue #79.
Fix for attachedTemplates not iterable. Closes issues #65, #77.

## 0.6.10
Fix for Drag Ruler snapping. Closes issues #59 and #64. Submitted PR to Drag Ruler git for issue with Drag Ruler not working with attached templates (issue #47).
Fix for null `token.actor.effects` error. Closes issue #65.
Update to geometry lib v0.2.9.

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

