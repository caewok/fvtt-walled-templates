/* globals
CONFIG,
foundry,
PIXI,
Ray
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d } from "../geometry/3d/Point3d.js";
import { WalledTemplate, reflectRayOffEdge } from "./WalledTemplate.js";

export class WalledTemplateRay extends WalledTemplate {
  /**
   * Angle of the ray, in radians.
   * @type {number}
   */
  direction = 0;

  /** @type {number} */
  width = 0;

  /** @type {"circle"|"cone"|"rect"|"ray"} */
  t = "ray";

  /**
   * @param {Point3d} origin    Center point of the template
   * @param {number} distance   Distance of the ray, in pixel units
   * @param {object} [opts]
   * @param {number} [opts.direction]   Direction of the ray, in radians
   * @param {number} [opts.width]       Width of the ray, in pixel units
   * @param {WalledTemplateOptions} [options]
   */
  constructor(origin, distance, opts = {}) {
    super(origin, distance, opts);
    if ( Object.hasOwn(opts, "direction") ) this.direction = opts.direction;
    if ( Object.hasOwn(opts, "width") ) this.width = opts.width;
    this.options.reflectedWall = opts.reflectedWall;
    this.options.reflectionRay = opts.reflectionRay;
    this.options.Rr = opts.Rr;
  }

  /**
   * Get the original version of this shape.
   * @returns {PIXI.Polygon}
   */
  getOriginalShape() {
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
    const reflection = reflectRayOffEdge(dirRay, reflectedWall, reflectionPoint);
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
    opts.width = this.width;

    const rayTemplate = new this.constructor(
      new Point3d(reflectedOrigin.x, reflectedOrigin.y, this.origin.z),
      this.distance - reflectedWall._reflectionDistance,
      opts);
    return [rayTemplate];
  }
}

// NOTE: Set the recursion types to spread or reflect, accordingly.
WalledTemplateRay.prototype._reflect = WalledTemplateRay.prototype._recurse;
