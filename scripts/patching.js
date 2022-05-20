/* globals
libWrapper,
game,
MeasuredTemplate,
canvas,
CONST,
Ray
*/

"use strict";

// Patches

import { MODULE_ID } from "./settings.js";
import { log } from "./module.js";
import {
  walledTemplateGetCircleShape,
  walledTemplateGetConeShape,
  walledTemplateGetRectShape,
  walledTemplateGetRayShape } from "./getShape.js";
import { walledTemplate5eFromItem } from "./render5eSpellTemplateConfig.js";
import { boundaryPolygon } from "./boundaryPolygon.js";
import {
  walledTemplatesMeasuredTemplateDraw,
  autotargetByTokenCenter,
  autotargetByTokenOverlap } from "./targeting.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getCircleShape", walledTemplateGetCircleShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getConeShape", walledTemplateGetConeShape, "MIXED");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRectShape", walledTemplateGetRectShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRayShape", walledTemplateGetRayShape, "WRAPPER");

  if (game.system.id === "dnd5e") {
    // Catch when template is created from item; set walled template enabled based on item
    libWrapper.register(MODULE_ID, "game.dnd5e.canvas.AbilityTemplate.fromItem", walledTemplate5eFromItem, "WRAPPER");
  }

  if (game.system.id === "pf2e") {
    // Override how the grid is highlighted for cones and rays
    libWrapper.register(MODULE_ID, "CONFIG.MeasuredTemplate.objectClass.prototype.highlightGrid", WalledTemplatesPF2eHighlightGrid, "OVERRIDE");
  }

  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype.refresh", walledTemplatesMeasuredTemplateDraw, "WRAPPER");
}

Object.defineProperty(MeasuredTemplate.prototype, "boundaryPolygon", {
  value: boundaryPolygon,
  writable: true,
  configurable: true
});

Object.defineProperty(MeasuredTemplate.prototype, "autotargetByTokenCenter", {
  value: autotargetByTokenCenter,
  writable: true,
  configurable: true
});

Object.defineProperty(MeasuredTemplate.prototype, "autotargetByTokenOverlap", {
  value: autotargetByTokenOverlap,
  writable: true,
  configurable: true
});


// Same as PF2e but for the contains test
function WalledTemplatesPF2eHighlightGrid() {
  log(`WalledTemplatesPF2eHighlightGrid type ${this.type}`);

  if ( !["circle", "cone"].includes(this.type)
    || canvas.scene?.data.gridType !== CONST.GRID_TYPES.SQUARE ) {
    return MeasuredTemplate.prototype.highlightGrid.bind(this)();
  }

  const grid = canvas.grid;
  const dimensions = canvas.dimensions;
  if (!(grid && dimensions)) return;

  // Only highlight for objects which have a defined shape
  if (!this.id || !this.shape) return;

  // Clear existing highlight
  const highlightLayer = grid.getHighlightLayer(`Template.${this.id}`)?.clear();
  if ( !highlightLayer ) return; // *** NEW: Break early if no highlight layer

  // Get the center of the grid position occupied by the template
  const x = this.data.x;
  const y = this.data.y;

  const [cx, cy] = grid.getCenter(x, y);
  const [col0, row0] = grid.grid.getGridPositionFromPixels(cx, cy);
  const minAngle = (360 + ((this.data.direction - (this.data.angle * 0.5)) % 360)) % 360;
  const maxAngle = (360 + ((this.data.direction + (this.data.angle * 0.5)) % 360)) % 360;

  const withinAngle = (min, max, value) => {
    min = (360 + (min % 360)) % 360;
    max = (360 + (max % 360)) % 360;
    value = (360 + (value % 360)) % 360;

    if ( min < max ) return value >= min && value <= max;
    return value >= min || value <= max;
  };

  const originOffset = { x: 0, y: 0 };
  // Offset measurement for cones
  // Offset is to ensure that cones only start measuring from cell borders,
  // as in https://www.d20pfsrd.com/magic/#Aiming_a_Spell
  if ( this.data.t === "cone" ) {
    // Degrees anticlockwise from pointing right. In 45-degree increments from 0 to 360
    const dir = (this.data.direction >= 0 ? 360 - this.data.direction : -this.data.direction) % 360;
    // If we're not on a border for X, offset by 0.5 or -0.5 to the border of the cell
    // in the direction we're looking on X axis
    const xOffset =
      this.data.x % dimensions.size !== 0
        ? Math.sign((1 * Math.round(Math.cos(Math.toRadians(dir)) * 100)) / 100) / 2
        : 0;
    // Same for Y, but cos Y goes down on screens, we invert
    const yOffset =
      this.data.y % dimensions.size !== 0
        ? -Math.sign((1 * Math.round(Math.sin(Math.toRadians(dir)) * 100)) / 100) / 2
        : 0;
    originOffset.x = xOffset;
    originOffset.y = yOffset;
  }

  // Point we are measuring distances from
  let origin = {
    x: this.data.x + (originOffset.x * dimensions.size),
    y: this.data.y + (originOffset.y * dimensions.size)
  };

  // Get number of rows and columns
  const rowCount = Math.ceil((this.data.distance * 1.5) / dimensions.distance / (dimensions.size / grid.h));
  const columnCount = Math.ceil((this.data.distance * 1.5) / dimensions.distance / (dimensions.size / grid.w));

  for (let a = -columnCount; a < columnCount; a++) {
    for (let b = -rowCount; b < rowCount; b++) {
      // Position of cell's top-left corner, in pixels
      const [gx, gy] = canvas.grid.grid.getPixelsFromGridPosition(col0 + a, row0 + b);
      // Position of cell's center, in pixels
      const [cellCenterX, cellCenterY] = [
        gx + (dimensions.size * 0.5),
        gy + (dimensions.size * 0.5)
      ];

      // Determine point of origin
      origin = { x: this.data.x, y: this.data.y };
      origin.x += (originOffset.x * dimensions.size);
      origin.y += (originOffset.y * dimensions.size);

      const ray = new Ray(origin, { x: cellCenterX, y: cellCenterY });

      const rayAngle = (360 + ((ray.angle / (Math.PI / 180)) % 360)) % 360;
      if (this.data.t === "cone" && ray.distance > 0 && !withinAngle(minAngle, maxAngle, rayAngle)) {
        continue;
      }

      // Determine point we're measuring the distance to - always in the center of a grid square
      const destination = { x: cellCenterX, y: cellCenterY };

      // *** NEW ***
      // check distance first because that is likely the easier calculation
      const distance = this.measureDistance(destination, origin);
      if ( distance > this.data.distance ) { continue; }

      // *** NEW ***
      // If the shape does not contain destination, skip.
      // Remember that the shape is set to 0,0 origin.
      const translated_destination = { x: destination.x - this.data.x, y: destination.y - this.data.y };
      if ( !this.shape.contains(translated_destination.x, translated_destination.y) ) { continue; }

      const color = this.fillColor;
      const border = this.borderColor;
      grid.grid.highlightGridPosition(highlightLayer, { x: gx, y: gy, color, border });
    }
  }
}
