/* globals
LimitedAnglePolygon,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID } from "../const.js";
import { WalledTemplateCone } from "./WalledTemplateCone.js";

export class WalledTemplateRoundedCone extends WalledTemplateCone {
  /**
   * Original cone SWADE shape
   * https://gitlab.com/peginc/swade/-/blob/develop/src/module/canvas/SwadeMeasuredTemplate.ts
   */
  get originalShape() {
    if ( !this.template._getConeShape ) return super.originalShape; // In case SWADE is not present.
    return this.template._getConeShape(this.direction, this.angle, this.distance);
  }

  /** @type {number} */
  get minorAxisLength() {
    // SWADE Cone width
    return 1.5 * ( this.distance / 9 );
  }
}
