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
   * Is the origin contained within the canvas bounds?
   * @type {boolean}
   */
  #originContained = true;

  /**
   * Outermost boundary edges, which may be further out than canvas boundaries.
   * @type {Edge[4]}
   */
  #boundaryEdges = [];

  /**
   * Compute the polygon using the origin and configuration options.
   * Unlike super.compute, this version permits origins outside canvas bounds.
   * @returns {PointSourcePolygon}    The computed polygon
   * @override
   */
  compute() {
    if ( !this.#originContained ) {
      // Lie to the parent class about the origin.
      // So we can avoid overriding the entire compute.
      const canvasCenter = canvas.dimensions.rect.center;
      this.origin.x = canvasCenter.x;
      this.origin.y = canvasCenter.y;
    }
    return super.compute();
  }

  /**
   * Perform the implementation-specific computation.
   * Revert the origin from the temporary setting.
   * @protected
   */
  _compute() {
    if ( !this.#originContained ) {
      this.origin.x = this.config.lightWallOrigin.x;
      this.origin.y = this.config.lightWallOrigin.y;
    }
    super._compute();
  }

  /**
   * Construct a set of outer boundary edges from a rectangle.
   */
  _boundaryEdgesFromRectangle(rect) {
    // From CanvasEdges##defineBoundaries
    const define = (type, r) => {
      const top = new Edge({x: r.x, y: r.y}, {x: r.right, y: r.y}, {id: `${type}Top`, type});
      const right = new Edge({x: r.right, y: r.y}, {x: r.right, y: r.bottom}, {id: `${type}Right`, type});
      const bottom = new Edge({x: r.right, y: r.bottom}, {x: r.x, y: r.bottom}, {id: `${type}Bottom`, type});
      const left = new Edge({x: r.x, y: r.bottom}, {x: r.x, y: r.y}, {id: `${type}Left`, type});
      return [top, right, bottom, left];
    };
    this.#boundaryEdges = define(`${MODULE_ID}.${this.config.source.sourceId}`, );
  }

  /**
   * Add canvas boundaries or larger boundaries, depending on where the origin is.
   * @override
   */
  _identifyEdges() {
    super._identifyEdges();
    if ( this.#originContained ) return;
    this._boundaryEdgesFromRectangle().forEach(edge => this.edges.add(edge));
  }

  /**
   * Test whether a wall should be included in the computed polygon for a given origin and type
   * Skip all boundary walls if the origin is outside the boundary rectangle.
   * Eliminate all walls within the exclusionary triangle.
   * @param {Edge} edge                     The Edge being considered
   * @param {Record<EdgeTypes, 0|1|2>} edgeTypes Which types of edges are being used? 0=no, 1=maybe, 2=always
   * @param {PIXI.Rectangle} bounds         The overall bounding box
   * @returns {boolean}                     Should the edge be included?
   * @protected
   */
  _testEdgeInclusion(edge, edgeTypes, bounds) {
    if ( !this._originContained && (edge.type === "innerBounds" || edge.type === "outerBounds") ) return false;
    if ( !super._testEdgeInclusion(edge, edgeTypes, bounds) ) return false;

    // Eliminate all edges on the same side as origin is to a|b
    const { exclusionarySide, exclusionaryTriangle, lightWall } = this.config;
    const triPts = exclusionaryTriangle.points;
    const a = { x: triPts[2], y: triPts[3] };
    const b = { x: triPts[4], y: triPts[5] };
    if ( Math.sign(foundry.utils.orient2dFast(a, b, edge.a)) === exclusionarySide
      && Math.sign(foundry.utils.orient2dFast(a, b, edge.b)) === exclusionarySide ) return false;
    if ( edge.object && lightWall.id && edge.object.id === lightWall.id  ) return false;
    return !exclusionaryTriangle.lineSegmentIntersects(edge.a, edge.b, { inside: true });
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
    this.#originContained = canvas.dimensions.rect.contains(origin);
    this.config.lightWallOrigin = duplicate(origin);
  }
}
