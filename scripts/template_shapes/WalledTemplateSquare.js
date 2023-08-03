/* globals
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { WalledTemplateCircle } from "./WalledTemplateCircle.js";

export class WalledTemplateSquare extends WalledTemplateCircle {
  /**
   * Square centered on an origin point.
   * https://gitlab.com/peginc/swade/-/blob/develop/src/module/canvas/SwadeMeasuredTemplate.ts
   */
  get originalShape() {
    const { distance, origin } = this;
    const xMinMax = Math.minMax(origin.x - distance, origin.x + distance);
    const yMinMax = Math.minMax(origin.y - distance, origin.y + distance);
    return new PIXI.Rectangle(xMinMax.min, yMinMax.min, xMinMax.max - xMinMax.min, yMinMax.max - yMinMax.min);
  }
}
