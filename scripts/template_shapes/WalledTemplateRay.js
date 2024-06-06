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
   * @param {Wall} [opts.reflectedEdge] Edge that the ray is reflected off of, when using recursion
   * @param {Ray}  [opts.reflectionRay] Ray describing the reflection
   * @param {PIXI.Point} [opts.Rr]      Point used in calculating the reflection incidence
   */
  constructor(template, opts = {}) {
    super(template, opts);
    this.options.reflectedEdge = opts.reflectedEdge;
    this.options.reflectionRay = opts.reflectionRay;
    this.options.Rr = opts.Rr;
  }

  /**
   * Calculate the original template shape from base Foundry.
   * Implemented by subclass.
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @returns {PIXI.Polygon}
   */
  calculateOriginalShape({ direction, distance, width } = {}) {
    direction ??= this.direction;
    distance ??= this.distance;
    width ??= this.width;

    // Convert to degrees and grid units for Foundry method.
    direction = Math.toDegrees(direction);
    distance = CONFIG.GeometryLib.utils.pixelsToGridUnits(distance);
    width = CONFIG.GeometryLib.utils.pixelsToGridUnits(width);
    return CONFIG.MeasuredTemplate.objectClass.getRayShape(distance, direction, width);
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
    if ( !padding ) return this.calculateOriginalShape({ direction });

    const ray = this.calculateOriginalShape({
      distance: this.distance + (padding * 2),
      direction,
      width: this.width + (padding * 2) });

    // Shift the ray origin opposite of direction, thereby expanding the ray forwards and backwards.
    // The delta between the old (0, 0) and new origins is the translation required.
    const delta = PIXI.Point.fromAngle({x: 0, y: 0}, direction + Math.PI, padding);
    return ray.translate(delta.x, delta.y);
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
    let closestReflectingEdge;
    for ( const edge of sweep.edgesEncountered) {
      // if ( this._boundaryWalls.has(edge) ) continue;
      const ix = foundry.utils.lineSegmentIntersection(dirRay.A, dirRay.B, edge.a, edge.b);
      if ( !ix ) continue;

      // If the edge intersection is beyond the template, ignore.
      const reflectionDistance = PIXI.Point.distanceBetween(this.origin, ix);
      if ( reflectionDistance <= 1 || this.distance < reflectionDistance ) continue;

      // Keep only if this is the closest encountered thus far.
      if ( closestReflectingEdge && reflectionDistance >= closestReflectingEdge._reflectionDistance ) continue;

      // Construct a copy to keep for futher calculations.
      const reflectingEdge = edge.clone();
      reflectingEdge._reflectionPoint = ix;
      reflectingEdge._reflectionDistance = reflectionDistance;
      closestReflectingEdge = reflectingEdge;
    }
    if ( !closestReflectingEdge ) return [];

    // Construct the reflection off the closest wall.
    closestReflectingEdge._reflectionPoint = PIXI.Point.fromObject(closestReflectingEdge._reflectionPoint);
    const reflection = this.constructor.reflectRayOffEdge(dirRay, closestReflectingEdge, closestReflectingEdge._reflectionPoint);
    if ( !reflection ) return [];
    const { reflectionRay, Rr } = reflection;

    // Set the new origin to be just inside the reflecting wall, to avoid using sweep
    // on the wrong side of the wall.
    // Need to move at least 2 pixels to avoid rounding issues.
    const reflectedOrigin = closestReflectingEdge._reflectionPoint.add(Rr.normalize());
    // This version would be on the wall: const reflectedOrigin = reflectionPoint;

    //   Draw.segment(reflectionRay);
    //   Draw.point(reflectionPoint);

    // Shallow copy the options for the new template.
    const opts = { ...this.options };
    opts.level += 1;
    opts.reflectedEdge = closestReflectingEdge;
    opts.reflectionRay = reflectionRay;
    opts.Rr = Rr;
    opts.direction = reflectionRay.angle;
    opts.origin = new Point3d(reflectedOrigin.x, reflectedOrigin.y, this.origin.z);
    opts.distance = this.distance - closestReflectingEdge._reflectionDistance;
    const rayTemplate = new this.constructor(this.template, opts);
    return [rayTemplate];
  }

  /**
   * Given a ray and an edge, calculate the reflection off the edge.
   * See:
   * https://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
   * http://paulbourke.net/geometry/reflected/
   * @param {Ray|Segment} ray     Ray to reflect off the edge; has A and B endpoint
   * @param {Edge} edge           Segment with a and b endpoints
   * @returns {null|{ reflectionPoint: {PIXI.Point}, reflectionRay: {Ray}, Rr: {PIXI.Point} }}
   */
  static reflectRayOffEdge(ray, edge, reflectionPoint) {
    if ( !reflectionPoint ) {
      const ix = foundry.utils.lineLineIntersection(ray.A, ray.B, edge.a, edge.b);
      if ( !ix ) return null;
      reflectionPoint = new PIXI.Point(ix.x, ix.y);
    }

    // Calculate the normals for the edge; pick the one closest to the origin of the ray.
    const delta = edge.b.subtract(edge.a, PIXI.Point.tmp);
    const normals = [
      new PIXI.Point(-delta.y, delta.x),
      new PIXI.Point(delta.y, -delta.x)].map(n => n.normalize());
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
