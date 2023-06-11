/* globals
canvas,
foundry,
PIXI,
PolygonEdge,
PolygonVertex,
*/
"use strict";

import { ClockwiseSweepShape } from "./ClockwiseSweepShape.js";

/**
 * Extend Clockwise Sweep to sweep using a distant origin point to simulate a light wall.
 * As the origin point is extended backwards, the sweep is close to horizontal lines.
 */
export class LightWallSweep extends ClockwiseSweepShape {
  /**
   * Compute the polygon using the origin and configuration options.
   * @returns {PointSourcePolygon}    The computed polygon
   * @override
   */
  compute() {
    let t0 = performance.now();
    const {angle, debug, radius} = this.config;

    // Skip zero-angle or zero-radius polygons
    if ( (radius === 0) || (angle === 0) ) {
      this.points.length = 0;
      this.bounds = new PIXI.Rectangle(0, 0, 0, 0);
      return this;
    }

    // Clear the polygon bounds
    this.bounds = undefined;

    // Delegate computation to the implementation
    this._compute();

    // Cache the new polygon bounds
    this.bounds = this.getBounds();

    // Debugging and performance metrics
    if ( debug ) {
      let t1 = performance.now();
      console.log(`Created ${this.constructor.name} in ${Math.round(t1 - t0)}ms`);
      this.visualize();
    }
    return this;
  }

  _boundaryWallsFromRectangle(rect) {
    // From WallsLayer.prototype.#defineBoundaries
    const cls = getDocumentClass("Wall");
    const ctx = {parent: canvas.scene};
    const define = (name, r) => {
      // Data model for the wall requires integers.
      const x = Math.floor(r.x);
      const y = Math.floor(r.y);
      const right = Math.ceil(r.right);
      const bottom = Math.ceil(r.bottom);

     //  if ( !Number.isInteger(x)
//         || !Number.isInteger(y)
//         || !Number.isInteger(right)
//         || !Number.isInteger(bottom) ) {
//         console.error("_boundaryWallsFromRectangle requires integers!", rect);
//
//       }

      const docs = [
        new cls({_id: `Bounds${name}Top`.padEnd(16, "0"), c: [x, y, right, y]}, ctx),
        new cls({_id: `Bounds${name}Right`.padEnd(16, "0"), c: [right, y, right, bottom]}, ctx),
        new cls({_id: `Bounds${name}Bottom`.padEnd(16, "0"), c: [right, bottom, x, bottom]}, ctx),
        new cls({_id: `Bounds${name}Left`.padEnd(16, "0"), c: [x, bottom, x, y]}, ctx)
      ];
      return docs.map(d => new Wall(d));
    };
    return define("Temp", rect);
  }

  /**
   * Add canvas boundaries or larger boundaries, depending on where the origin is.
   * @override
   */
  _identifyEdges() {
    super._identifyEdges();
    const rect = canvas.dimensions.rect;

    if ( !rect.contains(this.origin) ) {
      // Strip out the boundary edges
      this.edges.forEach(e => {
        if ( e._isBoundary ) this.edges.delete(e);
      });

      // Build new edges
      const xMinMax = Math.minMax(this.origin.x, rect.left, rect.right);
      const yMinMax = Math.minMax(this.origin.y, rect.top, rect.bottom);
      const encompassingRect = new PIXI.Rectangle(
        xMinMax.min - 2,
        yMinMax.min - 2,
        xMinMax.max - xMinMax.min + 4,
        yMinMax.max - yMinMax.min + 4
      );

      // if ( Number.isNaN(encompassingRect.x)
//         || Number.isNaN(encompassingRect.y)
//         || Number.isNaN(encompassingRect.width)
//         || Number.isNaN(encompassingRect.height) ) {
//
//         console.error("_identifyEdges boundary rect fail!", rect);
//       }


      const boundaries = this._boundaryWallsFromRectangle(encompassingRect);
      for ( let boundary of boundaries ) {
        const edge = PolygonEdge.fromWall(boundary, this.config.type);
        edge._isBoundary = true;
        this.edges.add(edge);
      }
    }
  }

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

    if ( (lightWall.id && wall.id === lightWall.id)|| !super._testWallInclusion(wall, bounds) ) return false;
    return !exclusionaryTriangle.lineSegmentIntersects(wall.A, wall.B, { inside: true });
  }
}
