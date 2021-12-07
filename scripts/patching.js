/* globals
libWrapper,
NormalizedRectangle
*/

'use strict';

// Patches

import { MODULE_ID } from "./const.js";
import { walledTemplateGetCircleShape } from "./getCircleShape.js";
import { walledTemplateGetConeShape } from "./getConeShape.js";
import { walledTemplateGetRectShape } from "./getRectShape.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, `MeasuredTemplate.prototype._getCircleShape`, walledTemplateGetCircleShape, `MIXED`);
  libWrapper.register(MODULE_ID, `MeasuredTemplate.prototype._getConeShape`, walledTemplateGetConeShape, `MIXED`);
  libWrapper.register(MODULE_ID, `MeasuredTemplate.prototype._getRectShape`, walledTemplateGetRectShape, `WRAPPER`);
}


/**
 * Add method to retrieve center coordinate from a normalized rectangle.
 * Assists with adding walls for the rectangle and ray templates
 */
Object.defineProperty(NormalizedRectangle.prototype, "centerPoint", {
  get() {
    return {  
      x: (this.x + this.width / 2),
      y: (this.y + this.height / 2)
    };
  }
});

/**
 * Add getter methods to retrieve coordinates from a normalized rectangle
 * Assists with adding walls for the rectangle and ray templates
 */
Object.defineProperty(NormalizedRectangle.prototype, "points", {
  get() { 
    const x_right  = this.x + this.width;
    const y_bottom = this.y + this.height;
    return {
      topLeft:     { x: this.x,  y: this.y },
      topRight:    { x: x_right, y: this.y },
      bottomRight: { x: x_right, y: y_bottom },
      bottomLeft:  { x: this.x,  y: y_bottom }
    };
  }
});

