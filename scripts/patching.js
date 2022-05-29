/* globals
libWrapper,
game,
MeasuredTemplate,
canvas,
CONST
*/

"use strict";

// Patches

import { MODULE_ID } from "./settings.js";
import {
  walledTemplateGetCircleShape,
  walledTemplateGetConeShape,
  walledTemplateGetRectShape,
  walledTemplateGetRayShape } from "./getShape.js";
import { walledTemplate5eFromItem } from "./render5eSpellTemplateConfig.js";
import { boundaryPolygon } from "./boundaryPolygon.js";
import {
  walledTemplatesMeasuredTemplateDraw,
  shapeForGridPixels,
  boundsOverlap,
  autotargetToken } from "./targeting.js";
import { WalledTemplatesPF1eGetHighlightedSquares } from "./systems/PF1e_HighlightGrid.js";
import { WalledTemplatesPF2eHighlightGrid } from "./systems/PF2e_HighlightGrid.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getCircleShape", walledTemplateGetCircleShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getConeShape", walledTemplateGetConeShape, "MIXED");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRectShape", walledTemplateGetRectShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype._getRayShape", walledTemplateGetRayShape, "WRAPPER");
  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype.highlightGrid", walledTemplatesHighlightGrid, "OVERRIDE");

  if ( game.system.id === "dnd5e" ) {
    // Catch when template is created from item; set walled template enabled based on item
    libWrapper.register(MODULE_ID, "game.dnd5e.canvas.AbilityTemplate.fromItem", walledTemplate5eFromItem, "WRAPPER");
  }

  if ( game.system.id === "pf2e" ) {
    // Override how the grid is highlighted for cones and rays
    libWrapper.register(MODULE_ID, "CONFIG.MeasuredTemplate.objectClass.prototype.highlightGrid", WalledTemplatesPF2eHighlightGrid, "OVERRIDE");
  }

  if ( game.system.id === "pf1" ) {
    libWrapper.register(MODULE_ID, "CONFIG.MeasuredTemplate.objectClass.prototype.getHighlightedSquares", WalledTemplatesPF1eGetHighlightedSquares, "WRAPPER");
  }

  libWrapper.register(MODULE_ID, "MeasuredTemplate.prototype.refresh", walledTemplatesMeasuredTemplateDraw, "WRAPPER");
}

Object.defineProperty(MeasuredTemplate.prototype, "boundaryPolygon", {
  value: boundaryPolygon,
  writable: true,
  configurable: true
});

Object.defineProperty(MeasuredTemplate.prototype, "autotargetToken", {
  value: autotargetToken,
  writable: true,
  configurable: true
});

Object.defineProperty(MeasuredTemplate.prototype, "boundsOverlap", {
  value: boundsOverlap,
  writable: true,
  configurable: true
});

function walledTemplatesHighlightGrid() {
  const grid = canvas.grid;
  const d = canvas.dimensions;
  const border = this.borderColor;
  const color = this.fillColor;

  // Only highlight for objects which have a defined shape
  if ( !this.id || !this.shape ) return;

  // Clear existing highlight
  const hl = grid.getHighlightLayer(`Template.${this.id}`);
  hl.clear();

  // If we are in gridless mode, highlight the shape directly
  if ( grid.type === CONST.GRID_TYPES.GRIDLESS ) {
    const shape = this.shape.clone();
    if ( "points" in shape ) {
      shape.points = shape.points.map((p, i) => {
        if ( i % 2 ) return this.y + p;
        else return this.x + p;
      });
    } else {
      shape.x += this.x;
      shape.y += this.y;
    }
    return grid.grid.highlightGridPosition(hl, {border, color, shape});
  }

  // Get number of rows and columns
  const [maxr, maxc] = grid.grid.getGridPositionFromPixels(d.width, d.height);
  let nr = Math.ceil(((this.data.distance * 1.5) / d.distance) / (d.size / grid.h));
  let nc = Math.ceil(((this.data.distance * 1.5) / d.distance) / (d.size / grid.w));
  nr = Math.min(nr, maxr);
  nc = Math.min(nc, maxc);

  // Get the offset of the template origin relative to the top-left grid space
  const [tx, ty] = canvas.grid.getTopLeft(this.data.x, this.data.y);
  const [row0, col0] = grid.grid.getGridPositionFromPixels(tx, ty);
  const hx = Math.ceil(canvas.grid.w / 2);
  const hy = Math.ceil(canvas.grid.h / 2);
  const isCenter = (this.data.x - tx === hx) && (this.data.y - ty === hy);

  // Identify grid coordinates covered by the template Graphics
  for (let r = -nr; r < nr; r++) {
    for (let c = -nc; c < nc; c++) {
      let [gx, gy] = canvas.grid.grid.getPixelsFromGridPosition(row0 + r, col0 + c);
      const testX = (gx+hx) - this.data.x;
      const testY = (gy+hy) - this.data.y;
      let contains = ((r === 0) && (c === 0) && isCenter ) || this.shape.contains(testX, testY);
      if ( !contains ) continue;

      const shape = shapeForGridPixels({x: gx, y: gy});
      if ( !this.boundsOverlap(shape) ) { continue; }

      grid.grid.highlightGridPosition(hl, {x: gx, y: gy, border, color});
    }
  }
}
