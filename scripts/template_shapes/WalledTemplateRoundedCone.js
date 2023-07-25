/* globals
LimitedAnglePolygon,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplateCone } from "./WalledTemplateCone.js";

export class WalledTemplateRoundedCone extends WalledTemplateCone {
  /**
   * Translate the boundary shape to the correct origin.
   * Use a circle + limited radius for the bounding shapes.
   * @returns {[PIXI.Circle|PIXI.Rectangle|PIXI.Polygon]}
   */
  get translatedBoundaryShapes() {
    const shape = super.translatedBoundaryShapes[0];
    const origin = this.origin.to2d();
    const { angle, direction } = this; // Angle is in degrees; direction is in radians.

    // Use a circle + limited radius for the bounding shapes
    const pts = shape.points;
    const radius = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
    const rotation = Math.toDegrees(direction) - 90;

    const circle = new PIXI.Circle(origin.x, origin.y, radius);
    const la = new LimitedAnglePolygon(origin, {radius, angle, rotation});
    return [circle, la];
  }
}
