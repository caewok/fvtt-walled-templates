/* globals
PIXI
*/
"use strict";

/**
 * Translate a rectangle, shifting it in the x and y direction.
 * (Basic but useful b/c it is equivalent to polygon.translate)
 * @param {Number} dx  Movement in the x direction.
 * @param {Number} dy  Movement in the y direction.
 * @return {PIXI.Rectangle}
 */
function translate(dx, dy) {
  return new this.constructor(this.x + dx, this.y + dy, this.width, this.height);
}

// ----------------  ADD METHODS TO THE PIXI.RECTANGLE PROTOTYPE ------------------------
export function registerPIXIRectangleMethods() {
  Object.defineProperty(PIXI.Rectangle.prototype, "translate", {
    value: translate,
    writable: true,
    configurable: true
  });
}
