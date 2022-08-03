/* globals
PIXI
*/
"use strict";

import { RegularPolygon } from "./RegularPolygon.js";

/**
 * Square is oriented at 0º rotation like a diamond.
 * Special case when square is rotate 45º or some multiple thereof
 * @param {Point} origin  Center point of the square
 * @param {number} radius Circumscribed circle radius
 * @param {object} options
 * @param {number} [options.rotation]   Rotation in degrees
 * @param {number} [options.width]      Alternative specification when skipping radius
 */
export class Square extends RegularPolygon {
  constructor(origin, radius, {rotation = 0, width} = {}) {
    if ( !radius && !width ) {
      console.warn("Square should have either radius or width defined.");
      radius = 0;
      width = 0;
    }

    radius ??= Math.sqrt(Math.pow(width, 2) * 2);
    super(origin, radius, { rotation, numSides: 4 });

    this.width = width ?? (this.radius * Math.SQRT1_2);
  }

  /**
   * Calculate the distance of the line segment from the center to the midpoint of a side.
   * @type {number}
   */
  get apothem() { return this.width; }

  /**
   * Calculate length of a side of this square.
   * @type {number}
   */
  get sideLength() { return this.apothem * 2; }

  /**
   * Calculate area of this square.
   * @type {number}
   */
  get area() { return this.sideLength * 2; }

  /**
   * Construct a square like a PIXI.Rectangle, where the point is the top left corner.
   */
  static fromPoint(point, width) {
    const w1_2 = width / 2;
    return new this({x: point.x + w1_2, y: point.y + w1_2}, undefined, { rotation: 45, width });
  }

  /**
   * Construct a square from a token's hitArea.
   * @param {Token} token
   * @return {Hexagon}
   */
  static fromToken(token) {
    const { x, y } = token.center;
    const { width, height } = token.hitArea;

    if ( width !== height ) return new PIXI.Rectangle(x, y, width, height);

    return this.fromPoint({x, y}, width);
  }

  /**
   * Generate the points of the square using the provided configuration.
   * Simpler and more mathematically precise than the default version.
   * @returns {Point[]}
   */
  _generateFixedPoints() {
    // Shape before rotation is [] rotated 45º
    const r = this.radius;

    return [
      { x: r, y: 0 },
      { x: 0, y: r },
      { x: -r, y: 0 },
      { x: 0, y: -r }
    ];
  }

  /**
   * Generate the points that represent this shape as a polygon in Cartesian space.
   * @return {Points[]}
   */
  _generatePoints() {
    const { x, y, radius, rotation, apothem } = this;

    switch ( rotation ) {
      // Oriented []
      case 45:
      case 135:
      case 225:
      case 315:
        return [
          apothem + x, apothem + y,
          -apothem + x, apothem + y,
          -apothem + x, -apothem + y,
          apothem + x, -apothem + y
        ];

      // Oriented [] turned 45º
      case 0:
      case 90:
      case 180:
      case 270:
        return [
          radius + x, y,
          x, radius + y,
          -radius + x, y,
          x, -radius + y
        ];
    }

    return super._generatePoints();
  }

  getBounds() {
    // If an edge is on the bounding box, use it as the border
    const { x, y, sideLength, apothem, fixedPoints: fp } = this;

    switch ( this.rotation ) {
      // PIXI.Rectangle(x, y, width, height)
      // Oriented []
      case 45:
      case 135:
      case 225:
      case 315:
        return new PIXI.Rectangle(-apothem + x, -apothem + y, sideLength, sideLength);

      // Oriented [] turned 45º
      case 0:
      case 90:
      case 180:
      case 270:
        return new PIXI.Rectangle(fp[2], fp[3], sideLength, sideLength);
    }

    return super.getBounds();
  }
}
