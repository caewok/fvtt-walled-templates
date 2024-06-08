/* globals
canvas,
CONFIG,
MeasuredTemplate,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";


import { pointFromKey } from "../ClockwiseSweepShape.js";
import { WalledTemplateCircle } from "./WalledTemplateCircle.js";

export class WalledTemplateRectangle extends WalledTemplateCircle {

  /**
   * Calculate the original template shape from base Foundry.
   * Implemented by subclass.
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @returns {PIXI.Rectangle}
   */
  calculateOriginalShape({ direction, distance } = {}) {
    direction ??= this.direction;
    distance ??= this.distance;

    // Convert to degrees and grid units for Foundry method.
    direction = Math.toDegrees(direction);
    distance = CONFIG.GeometryLib.utils.pixelsToGridUnits(distance);
    return CONFIG.MeasuredTemplate.objectClass.getRectShape(distance, direction);
  }

  /**
   * Keeping the origin in the same place, pad the shape by adding (or subtracting) to it
   * in a border all around it, including the origin (for cones, rays, rectangles).
   * Implemented by subclass.
   * @param {number} [padding]    Optional padding value, if not using the one for this instance.
   * @returns {PIXI.Polygon}
   */
  calculatePaddedShape(padding) {
    padding ??= this.options.padding;
    const direction = this.direction;
    const rect = this.calculateOriginalShape({ distance: this.distance + (padding * 2), direction });
    if ( !padding ) return rect;

    // In order to shift the rectangle origin, must convert to a polygon.
    // The delta between the old (0, 0) and new origins is the translation required.
    const delta = PIXI.Point.fromAngle({x: 0, y: 0}, direction + Math.PI, padding);
    return rect.toPolygon().translate(delta.x, delta.y);
  }

  /**
   * Compute the shape to be used for this template.
   * Output depends on the specific template settings.
   * @returns {PIXI.Polygon|PIXI.Circle}
   */
  computeShape() {
    const shape = super.computeShape();

    // Set values that Sequencer or other modules may use from the rectangle.
    if ( !shape.width || !shape.height ) {
      const origShape = this.originalShape;
      shape.width ??= origShape.width;
      shape.height ??= origShape.height;
    }
    return shape;
  }

  /**
   * Generate a new RectangleTemplate based on spreading from a designated corner.
   * @param {PIXI.Point} corner
   * @returns {WalledTemplateRectangle[]|null}
   */
  _generateSpreadsFromCorner(cornerKey, edgesEncountered, cornerTracker) {
    // If the corner is not within the template shape, ignore
    const corner = pointFromKey(cornerKey);
    const bounds = this.getBounds();
    if ( !bounds.contains(corner.x, corner.y) ) return null;

    const out = super._generateSpreadsFromCorner(cornerKey, edgesEncountered, cornerTracker);
    if ( !out ) return null;

    // Build the rectangle template in 4 directions.
    // For each one, intersect the shape against the current to get the new distance.
    // The new shape will be entirely contained by the old.
    const spread = out[0]; // Circle only produces a single template.
    const spreads = new Array(4);
    for ( let i = 0; i < 4; i += 1 ) {
      spreads[i] = spread.rotateTemplate(Math.normalizeRadians(this.direction + (Math.PI_1_2 * i)), bounds);
    }
    return spreads;
  }

  /**
   * Construct a template based on this template, rotating around the origin.
   * Optionally limit the frame of the rectangle.
   * @param {number} radians                  Amount to rotate the template, in radians
   * @param {PIXI.Rectangle} [enclosingFrame] Boundary to restrict the resulting template
   * @returns {WalledTemplateRectangle}
   */
  rotateTemplate(radians, enclosingFrame) {
    const direction = Math.normalizeRadians(this.direction + radians);
    enclosingFrame ??= canvas.dimensions.rect;
    const origin2d = this.origin.to2d();

    // Build a new shape and intersect with the frame.
    const ixShape = MeasuredTemplate.getRectShape(direction, this.distance)
      .translate(origin2d.x, origin2d.y)
      .intersection(enclosingFrame);

    // Direction and diagonal may have changed due to the intersection.
    // 0–90º: SE quadrant
    // 90–180º: SW quadrant
    // 180–270º: NW quadrant
    // 270–360º: NE quadrant

    let oppositeCorner;
    if ( origin2d.almostEqual(ixShape) ) {
      oppositeCorner = new PIXI.Point(ixShape.right, ixShape.bottom); // TL -> BR
    } else if ( origin2d.almostEqual({ x: ixShape.right, y: ixShape.top }) ) {
      oppositeCorner = new PIXI.Point(ixShape.left, ixShape.bottom); // TR -> BL
    } else if ( origin2d.almostEqual({ x: ixShape.right, y: ixShape.bottom }) ) {
      oppositeCorner = new PIXI.Point(ixShape.left, ixShape.top); // BR -> TL
    } else {
      oppositeCorner = new PIXI.Point(ixShape.right, ixShape.top); // BL -> TR
    }


    // Construct a template based on this current template with distance and direction modified.
    const opts = { ...this.options };
    const delta = oppositeCorner.subtract(origin2d);
    opts.direction = Math.atan2(delta.y, delta.x);
    opts.distance = PIXI.Point.distanceBetween(origin2d, oppositeCorner);
    opts.origin = this.origin.clone();
    return new this.constructor(this.template, opts);
  }
}
