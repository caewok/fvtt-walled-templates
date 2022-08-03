/* globals
PIXI,
ClipperLib
*/
"use strict";

// Use Object.defineProperty so that writable, configurable can be set to let other modules override

export function registerPIXIPolygonMethods() {

  // ----- Weiler Atherton Methods ----- //

  /**
   * Determine if a polygon is oriented clockwise, meaning tracing the polygon
   * moves in a clockwise direction.
   * This getter relies on a cached property, _isClockwise.
   * If you know the polygon orientation in advance, you should set this._isClockwise to avoid
   * this calculation.
   * This will close the polygon.
   * @type {boolean}
   */
  Object.defineProperty(PIXI.Polygon.prototype, "isClockwise", {
    get: isClockwise,
    enumerable: false
  });

  /**
   * Reverse the order of the polygon points.
   * @returns {PIXI.Polygon}
   */
  Object.defineProperty(PIXI.Polygon.prototype, "reverseOrientation", {
    value: reverseOrientation,
    writable: true,
    configurable: true
  });
}

function isClockwise() {
  if ( typeof this._isClockwise === "undefined") {
    this.close();
    const path = this.toClipperPoints();
    this._isClockwise = ClipperLib.Clipper.Orientation(path);
  }
  return this._isClockwise;
}

function reverseOrientation() {
  const reversed_pts = [];
  const pts = this.points;
  const ln = pts.length - 2;
  for (let i = ln; i >= 0; i -= 2) {
    reversed_pts.push(pts[i], pts[i + 1]);
  }
  this.points = reversed_pts;
  if ( typeof this._isClockwise !== "undefined" ) this._isClockwise = !this._isClockwise;
  return this;
}
