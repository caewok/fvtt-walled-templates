/* globals
PIXI
*/
"use strict";

import { RegularPolygon } from "./RegularPolygon.js";

/**
 * "Column" hexagon with points at W and E
 * If height is greater than width, a row hexagon will be returned; otherwise column or rotated.
 * @param {Number}  width     Distance from left to right, through center.
 * @param {Number}  height    Distance from top to bottom, through center.
 */
export class Hexagon extends RegularPolygon {
  constructor(origin, radius, { rotation = 0, width, height = 0 } = {}) {
    radius ??= Math.max(width, height) / 2;
    if ( width && height > width ) rotation = 90;

    super(origin, radius, {numSides: 6, rotation});

    switch ( rotation ) {
      case 0:
      case 180:
        this._apothem = height || (Math.SQRT3 * this.radius * 0.5);
        break;

      case 90:
      case 270:
        this._apothem = width || (Math.SQRT3 * this.radius * 0.5);
        break;

      default:
        this._apothem = Math.SQRT3 * this.radius * 0.5;
    }

    this.radius2 = Math.pow(this.radius, 2);
  }

  /**
   * Calculate the distance of the line segment from the center to the midpoint of a side.
   * For column hexagon, this is height / 2
   * For row hexagon, this is width / 2
   * @type {number}
   */
  get apothem() {
    return this._apothem;
  }

  /**
   * Calculate length of a side of this hexagon
   * @type {number}
   */
  get sideLength() {
    return this.radius;
  }

  /**
   * Calculate area of this hexagon
   * @type {number}
   */
  get area() {
    // https://en.wikipedia.org/wiki/Hexagon
    return 1.5 * Math.SQRT3 * this.radius2;
  }

  /**
   * Construct a hexagon from a token's hitArea.
   * @param {Token} token
   * @return {Hexagon}
   */
  static fromToken(token) {
    const { width, height } = token.hitArea;
    return new this(token.center, undefined, { width, height });
  }

  /**
   * Generate the points of the hexagon using the provided configuration.
   * Simpler and more mathematically precise than the default version.
   * @returns {Point[]}
   */
  _generateFixedPoints() {
    // Shape before rotation is [] rotated 45º
    const { radius, apothem } = this;
    const r1_2 = radius * 0.5;

    // Points at W and E
    return [
      { x: radius, y: 0 },
      { x: r1_2, y: apothem },
      { x: -r1_2, y: apothem },
      { x: -radius, y: 0 },
      { x: -r1_2, y: -apothem },
      { x: r1_2, y: -apothem }
    ];
  }

  /**
   * Generate the points that represent this shape as a polygon in Cartesian space.
   * @return {Points[]}
   */
  _generatePoints() {
    const { x, y, rotation, radius, apothem } = this;
    const r1_2 = radius * 0.5;

    switch ( rotation ) {
      // Pointy-side E/W
      case 0:
      case 180:
        return [
          radius + x, y ,
          r1_2 + x, apothem + y,
          -r1_2 + x, apothem + y,
          -radius + x, y,
          -r1_2 + x, -apothem + y,
          r1_2 + x, -apothem + y
        ];

      // Pointy-side N/S
      case 90:
      case 270:
        return [
          apothem + x, r1_2 + y,
          x, radius + y,
          -apothem + x, r1_2 + y,
          -apothem + x, -r1_2 + y,
          x, -radius + y,
          apothem + x, -r1_2 + y
        ];
    }

    return super._generatePoints();
  }

  getBounds() {
    // If an edge is on the bounding box, use it as the border
    const { x, y, radius, apothem, fixedPoints: fp } = this;

    switch ( this.rotation ) {
      // PIXI.Rectangle(x, y, width, height)
      // pointy-side E/W
      case 0:
      case 180:
        return new PIXI.Rectangle(
          fp[3].x + x,
          fp[4].y + y,
          radius * 2,
          apothem * 2);

      // Pointy-side N/S
      case 90:
      case 270:
        return new PIXI.Rectangle(
          -apothem + x,
          -radius + y,
          apothem * 2,
          radius * 2);
    }

    return super.getBounds();
  }
}
