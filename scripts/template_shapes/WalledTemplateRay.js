/* globals
CONFIG,
foundry,
PIXI,
Ray
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d } from "../geometry/3d/Point3d.js";
import { WalledTemplateShape } from "./WalledTemplateShape.js";

export class WalledTemplateRay extends WalledTemplateShape {
  /**
   * @param {MeasuredTemplate} template   The underlying measured template
   * @param {WalledTemplateOptions} [opts]
   * @param {number} [opts.direction]   Direction of the ray, in radians
   * @param {number} [opts.width]       Width of the ray, in pixel units
   * @param {Wall} [opts.reflectedWall] Wall that the ray is reflected off of, when using recursion
   * @param {Ray}  [opts.reflectionRay] Ray describing the reflection
   * @param {PIXI.Point} [opts.Rr]      Point used in calculating the reflection incidence
   */
  constructor(template, opts = {}) {
    super(template, opts);
    this.options.reflectedWall = opts.reflectedWall;
    this.options.reflectionRay = opts.reflectionRay;
    this.options.Rr = opts.Rr;
  }

  /** @type {PIXI.Polygon} */
  get originalShape() {
    return CONFIG.MeasuredTemplate.objectClass.getRayShape(this.direction, this.distance, this.width);
  }

  /**
   * Generate a new WalledTemplateRay based on reflecting off the first wall encountered
   * from this WalledTemplateRay.
   * @param {Set<Wall>|Map<Wall>|Wall[]}
   * @returns {WalledTemplateRay|null}
   */
  _generateSubtemplates(sweep) {
    const dirRay = Ray.fromAngle(this.origin.x, this.origin.y, this.direction, this.distance);

    // Sort walls by closest collision to the template origin, skipping those that do not intersect.
    const wallRays = [];
    for ( const edge of sweep.edgesEncountered) {
      if ( this._boundaryWalls.has(edge) ) continue;
      const ix = foundry.utils.lineSegmentIntersection(dirRay.A, dirRay.B, edge.A, edge.B);
      if ( !ix ) continue;
      const wallRay = new Ray(edge.A, edge.B);
      wallRay._reflectionPoint = ix;
      wallRay._reflectionDistance = PIXI.Point.distanceBetween(this.origin, ix);
      if ( wallRay._reflectionDist <= 1 ) continue;

      // If the wall intersection is beyond the template, ignore.
      if ( this.distance < wallRay._reflectionDistance ) continue;

      wallRays.push(wallRay);
    }
    if ( !wallRays.length ) return [];

    // Only reflect off the first wall encountered.
    wallRays.sort((a, b) => a._reflectionDistance - b._reflectionDistance);
    const reflectedWall = wallRays[0];
    const reflectionPoint = new PIXI.Point(reflectedWall._reflectionPoint.x, reflectedWall._reflectionPoint.y);
    const reflection = this.constructor.reflectRayOffEdge(dirRay, reflectedWall, reflectionPoint);
    if ( !reflection ) return [];
    const { reflectionRay, Rr } = reflection;

    // Set the new origin to be just inside the reflecting wall, to avoid using sweep
    // on the wrong side of the wall.
    // Need to move at least 2 pixels to avoid rounding issues.
    const reflectedOrigin = reflectionPoint.add(Rr.normalize());
    // This version would be on the wall: const reflectedOrigin = reflectionPoint;

    //   Draw.segment(reflectionRay);
    //   Draw.point(reflectionPoint);

    // Shallow copy the options for the new template.
    const opts = { ...this.options };
    opts.level += 1;
    opts.reflectedWall = reflectedWall;
    opts.reflectionRay = reflectionRay;
    opts.Rr = Rr;
    opts.direction = reflectionRay.angle;
    opts.origin = new Point3d(reflectedOrigin.x, reflectedOrigin.y, this.origin.z);
    opts.distance = this.distance - reflectedWall._reflectionDistance;
    const rayTemplate = new this.constructor(this.template, opts);
    return [rayTemplate];
  }

  /**
   * Given a ray and an edge, calculate the reflection off the edge.
   * See:
   * https://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
   * http://paulbourke.net/geometry/reflected/
   * @param {Ray|Segment} ray     Ray to reflect off the edge
   * @param {Ray|Segment} edge    Segment with A and B endpoints
   * @returns {null|{ reflectionPoint: {PIXI.Point}, reflectionRay: {Ray}, Rr: {PIXI.Point} }}
   */
  static reflectRayOffEdge(ray, edge, reflectionPoint) {
    if ( !reflectionPoint ) {
      const ix = foundry.utils.lineLineIntersection(ray.A, ray.B, edge.A, edge.B);
      if ( !ix ) return null;
      reflectionPoint = new PIXI.Point(ix.x, ix.y);
    }

    // Calculate the normals for the edge; pick the one closest to the origin of the ray.
    const dx = edge.B.x - edge.A.x;
    const dy = edge.B.y - edge.A.y;
    const normals = [
      new PIXI.Point(-dy, dx),
      new PIXI.Point(dy, -dx)].map(n => n.normalize());
    const N = PIXI.Point.distanceSquaredBetween(ray.A, reflectionPoint.add(normals[0]))
      < PIXI.Point.distanceSquaredBetween(ray.A, reflectionPoint.add(normals[1]))
      ? normals[0] : normals[1];

    // Calculate the incidence vector.
    const Ri = reflectionPoint.subtract(ray.A);

    // Rr = Ri - 2 * N * (Ri dot N)
    const dot = Ri.dot(N);
    const Rr = Ri.subtract(N.multiplyScalar(2 * dot));
    const reflectionRay = new Ray(reflectionPoint, reflectionPoint.add(Rr));
    return { reflectionPoint, reflectionRay, Rr };
  }
}

// NOTE: Set the recursion types to spread or reflect, accordingly.
WalledTemplateRay.prototype._reflect = WalledTemplateRay.prototype._recurse;
