/* globals
ClockwiseSweepPolygon,
CollisionResult
*/
"use strict";

/* Testing
Draw = CONFIG.GeometryLib.Draw;
draw = new Draw();

MAX_TEXTURE_SIZE = Math.pow(2, 16);
INV_MAX_TEXTURE_SIZE = 1 / MAX_TEXTURE_SIZE;
function pointFromKey(key) {
  const x = ~~(key * INV_MAX_TEXTURE_SIZE);
  const y = key % MAX_TEXTURE_SIZE;
  return {x, y}
}


[t] = canvas.templates.placeables
t.shape._sweep.edgesEncountered.forEach(edge => draw.segment(edge))
t.shape._sweep.cornersEncountered.forEach(corner => draw.point(pointFromKey(corner), { radius: 2 }))

*/

/**
 * Extend Clockwise Sweep to track when the sweep hits wall corners or wall edges.
 * Used for bounce and spread options for templates.
 * Also handles other shape-specific modifications to sweep previously done using libWrapper.
 */
export class ClockwiseSweepShape extends ClockwiseSweepPolygon {
  /**
   * "Corner" points encountered. Corners are when the sweep hits a non-limited wall
   * and must extend the sweep beyond that point.
   * @type {Point[]}
   */
  cornersEncountered = new Set();

  /**
   * "Edges" or walls encountered. Added if the wall forms part of the polygon.
   * @type {Set<Wall>}
   */
  edgesEncountered = new Set();

  /** @inheritdoc */
  _compute() {
    this.cornersEncountered.clear();
    this.edgesEncountered.clear();
    // super._compute();
    // Clear prior data
    this.points = [];
    this.rays = [];
    this.vertices.clear();
    this.edges.clear();

    // Step 1 - Identify candidate edges
    this._identifyEdges();

    // Step 2 - Construct vertex mapping
    this._identifyVertices();

    // Step 3 - Radial sweep over endpoints
    this._executeSweep();

    this._sweepPoints = duplicate(this.points);

    // Step 4 - Constrain with boundary shapes
    this._constrainBoundaryShapes();
  }

  /**
   * Determine the result for the sweep at a given vertex
   * @param {PolygonVertex} vertex      The target vertex
   * @param {EdgeSet} activeEdges       The set of active edges
   * @param {boolean} hasCollinear      Are there collinear vertices behind the target vertex?
   * @inheritdoc
   */
  _determineSweepResult(vertex, activeEdges, hasCollinear=false) {

    // Determine whether the target vertex is behind some other active edge
    const {isBehind, wasLimited} = this._isVertexBehindActiveEdges(vertex, activeEdges);

    // Case 1 - Some vertices can be ignored because they are behind other active edges
    if ( isBehind ) return;

    // Construct the CollisionResult object
    const result = new CollisionResult({
      target: vertex,
      cwEdges: vertex.cwEdges,
      ccwEdges: vertex.ccwEdges,
      isLimited: vertex.isLimited,
      isBehind,
      wasLimited
    });

    // Case 2 - No counter-clockwise edge, so begin a new edge
    // Note: activeEdges always contain the vertex edge, so never empty
    const nccw = vertex.ccwEdges.size;
    if ( !nccw ) {
      this._switchEdge(result, activeEdges);
      result.collisions.forEach(pt => {
        this.addPoint(pt);
        if ( pt.isEndpoint ) this.cornersEncountered.add(keyFromPoint(pt.x, pt.y));
        pt.cwEdges.forEach(edge => this.edgesEncountered.add(edge.wall));
      });
      return;
    }

    // Case 3 - Limited edges in both directions
    // We can only guarantee this case if we don't have collinear endpoints
    const ccwLimited = !result.wasLimited && vertex.isLimitingCCW;
    const cwLimited = !result.wasLimited && vertex.isLimitingCW;
    if ( !hasCollinear && cwLimited && ccwLimited ) return;

    // Case 4 - Non-limited edges in both directions
    if ( !ccwLimited && !cwLimited && nccw && vertex.cwEdges.size ) {
      result.collisions.push(result.target);
      this.addPoint(result.target);
      result.cwEdges.forEach(edge => this.edgesEncountered.add(edge.wall));
      return;
    }

    // Case 5 - Otherwise switching edges or edge types
    this._switchEdge(result, activeEdges);
    result.collisions.forEach(pt => {
      this.addPoint(pt);
      if ( pt.isEndpoint ) this.cornersEncountered.add(keyFromPoint(pt.x, pt.y));
      pt.cwEdges.forEach(edge => this.edgesEncountered.add(edge.wall));
    });
  }
}

//  Same as PolygonVertex
const MAX_TEXTURE_SIZE = Math.pow(2, 16);
const INV_MAX_TEXTURE_SIZE = 1 / MAX_TEXTURE_SIZE;

/**
 * Construct an integer key from a 2d point.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function keyFromPoint(x, y) {
  return (MAX_TEXTURE_SIZE * x) + y;
}

/**
 * Construct a 2d point from an integer key.
 * Reverse of keyFromPoint
 */
export function pointFromKey(key) {
  const x = ~~(key * INV_MAX_TEXTURE_SIZE);
  const y = key % MAX_TEXTURE_SIZE;
  return {x, y};
}
