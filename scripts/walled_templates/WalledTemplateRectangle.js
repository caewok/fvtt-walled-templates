/* globals
canvas,
CONFIG,
MeasuredTemplate,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";


import { ClockwiseSweepShape, pointFromKey } from "../ClockwiseSweepShape.js";
import { WalledTemplateCircle } from "./WalledTemplateCircle.js";

export class WalledTemplateRectangle extends WalledTemplateCircle {
  /** @type {"circle"|"cone"|"rect"|"ray"} */
  t = "rect";

  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = ClockwiseSweepShape;

  /** @type {number} */
  direction = 0;

  /**
   * @param {Point3d} origin    Center point of the template
   * @param {number} distance   Distance, in pixel units
   * @param {object} [opts]     Options
   * @param {number} [opts.direction=0]  Direction, in grid units
   * @param {WalledTemplateOptions} [options]
   */
  constructor(origin, distance, opts = {}) {
    super(origin, distance, opts);
    this.direction = opts.direction ?? 0;
  }

  /**
   * Get the original version of this rectangle shape.
   * @returns {PIXI.Circle}
   */
  getOriginalShape() { return CONFIG.MeasuredTemplate.objectClass.getRectShape(this.direction, this.distance); }

  /**
   * Get boundary shape for this rectangle set to the origin.
   * @returns {PIXI.Circle}
   */
  getBoundaryShape() { return this.getOriginalShape(); }

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
    return new this.constructor(
      this.origin,
      PIXI.Point.distanceBetween(origin2d, oppositeCorner),
      opts
    );
  }
}
