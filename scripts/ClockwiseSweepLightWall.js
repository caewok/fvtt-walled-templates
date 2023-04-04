/* globals
PIXI,
foundry
*/
"use strict";

import { ClockwiseSweepShape } from "./ClockwiseSweepShape.js";

/**
 * Extend Clockwise Sweep to sweep using a distant origin point to simulate a light wall.
 * As the origin point is extended backwards, the sweep is close to horizontal lines.
 */
export class LightWallSweep extends ClockwiseSweepShape {

  /**
   * Add config for the wall of interest.
   * Walls between the origin and the wall will be ignored.
   * @inheritDoc
   */
  initialize(origin, config) {
    super.initialize(origin, config);
    const cfg = this.config;

    if ( !cfg.lightWall ) return console.error("LightWallSweep requires a wall!");

    const { A, B } = cfg.lightWall;
    const a = new PIXI.Point(A.x, A.y);
    const b = new PIXI.Point(B.x, B.y);
    cfg.exclusionaryTriangle = new PIXI.Polygon([origin, a, b]);
    cfg.exclusionarySide = Math.sign(foundry.utils.orient2dFast(a, b, origin));
    const av = a.subtract(origin);
    const bv = b.subtract(origin);

    const boundary = new PIXI.Polygon([
      a,
      a.add(av.normalize().multiplyScalar(cfg.radius)),
      b.add(bv.normalize().multiplyScalar(cfg.radius)),
      b
    ]);
    cfg.boundaryShapes.push(boundary);
  }

  /**
   * Eliminate all walls within the exclusionary triangle.
   * @inheritDoc
   */
  _testWallInclusion(wall, bounds) {
    // Eliminate all walls on the same side as origin is to a|b
    const { exclusionarySide, exclusionaryTriangle, lightWall } = this.config;
    const triPts = exclusionaryTriangle.points;
    const a = { x: triPts[2], y: triPts[3] };
    const b = { x: triPts[4], y: triPts[5] };

    if ( Math.sign(foundry.utils.orient2dFast(a, b, wall.A)) === exclusionarySide
      && Math.sign(foundry.utils.orient2dFast(a, b, wall.B)) === exclusionarySide ) return false;

    if ( wall.id === lightWall.id || !super._testWallInclusion(wall, bounds) ) return false;
    return !exclusionaryTriangle.lineSegmentIntersects(wall.A, wall.B, { inside: true });
  }
}
