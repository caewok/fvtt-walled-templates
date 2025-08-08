/* globals
CONFIG,
foundry,
PIXI,
Ray
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d } from "../geometry/3d/Point3d.js";
import { LightWallSweep } from "../ClockwiseSweepLightWall.js";
import { WalledTemplateRay } from "./WalledTemplateRay.js";
import { pixelsToGridUnits } from "../geometry/util.js";

export const MIN_PARALLEL_EPSILON = 1e-04;
export const MIN_DIST_EPSILON = 1 + MIN_PARALLEL_EPSILON;

export class WalledTemplateCone extends WalledTemplateRay {
  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = LightWallSweep;

  /**
   * @param {MeasuredTemplate} template   The underlying measured template
   * @param {WalledTemplateOptions} [opts]
   * @param {PIXI.Point} [opt.corner]
   * @param {number} [opts.direction]   Direction of the ray, in radians
   * @param {number} [opts.angle]       Angle of the triangle formed by the cone, in degrees
   * @param {WalledTemplateOptions} [options]
   */
  constructor(template, opts = {}) {
    super(template, opts);
    this.options.lastReflectedEdge = opts.lastReflectedEdge;
  }

  /**
   * Calculate the original template shape from base Foundry.
   * Implemented by subclass.
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @param {number;pixels} [opts.direction]    Direction (rotation) of the cone
   * @param {number;radians} [opts.angle]       Angle of the cone
   * @param {number;pixels} [opts.distance]     Radius of the cone
   * @returns {PIXI.Polygon}
   */
  calculateOriginalShape({ direction, angle, distance } = {}) {
    direction ??= this.direction;
    angle ??= this.angle;
    distance ??= this.distance;

    // Convert to degrees and grid units for Foundry method.
    direction = Math.toDegrees(direction);
    angle = Math.toDegrees(angle);
    distance = pixelsToGridUnits(distance);
    return CONFIG.MeasuredTemplate.objectClass.getConeShape(distance, direction, angle);
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
    const cone = this.calculateOriginalShape({ distance: this.distance + (padding * 2), direction });
    if ( !padding ) return cone;

    // Move the shape relative to the actual origin, to pad in all directions. Reverse direction.
    // The delta between the old (0, 0) and new origins is the translation required.
    const delta = PIXI.Point.fromAngle({x: 0, y: 0}, direction + Math.PI, padding);
    const out = cone.translate(delta.x, delta.y);
    delta.release();
    return out;
  }

  /**
   * Locate wall segments that the cone hits.
   * For each segment, calculate the reflection ray based on normal of that edge.
   * For each reflecting edge, create a cone template using a shadow cone based on reflected distance.
   * Set origin of the template to just inside the edge, in the middle.
   * @param {Set<Wall>|Map<Wall>|Wall[]}
   * @returns {WalledTemplateRay|null}
   */
  _generateSubtemplates(sweep) {
    const maxDist = this.distance;
    const maxDist2 = Math.pow(maxDist, 2);
    const templateOrigin = this.origin.to2d();
    const dirRay = Ray.fromAngle(templateOrigin.x, templateOrigin.y, this.direction, this.distance);
    const {
      closestPointToSegment,
      orient2dFast,
      lineLineIntersection,
      lineSegmentIntersects,
      lineCircleIntersection } = foundry.utils;

    // Skip sweep edges that form the edge of the cone projecting from origin.
    const sweepEdges = [...sweep.iterateEdges({ close: true })]
      .filter(e => !orient2dFast(e.A, e.B, templateOrigin).almostEqual(0))
      .map(e => {
        return {
          a: e.A, // For consistency with other edges.
          b: e.B
        };
      });

    const lastReflectedEdge = this.options.lastReflectedEdge;
    const oLastReflected = lastReflectedEdge
      ? Math.sign(orient2dFast(lastReflectedEdge.a, lastReflectedEdge.b, templateOrigin))
      : undefined;

    // Build the left/right cone segments.


    // Locate walls that reflect the cone.
    // Walls must be within the sweep template or intersect the sweep template
    const reflectingEdges = [];
    for ( const edge of sweep.edgesEncountered ) {
      // Don't reflect off of bounds
      // if ( this._boundaryWalls.has(wall) ) continue;

      if ( lastReflectedEdge ) {
        // Omit the last reflected.
        if ( edge.id === lastReflectedEdge.id ) continue;

        // Any reflecting wall must be on the side of the reflecting wall opposite the origin.
        const oEdge = orient2dFast(edge.a, edge.b, templateOrigin);
        if ( Math.sign(oEdge) === oLastReflected ) continue;
      }

      // Edge must be within distance of the template to use.
      const closestEdgePoint = closestPointToSegment(templateOrigin, edge.a, edge.b);
      const minDist2 = PIXI.Point.distanceSquaredBetween(templateOrigin, closestEdgePoint);
      if ( minDist2 > maxDist2 ) continue;

      // Shrink the wall to be inside the template if necessary.
      // Shrink the radius slightly to ensure the intersected point will count.
      const circleIx = lineCircleIntersection(edge.a, edge.b, templateOrigin, maxDist - 2);
      const numIx = circleIx.intersections.length;

      // Need PIXI points later; easier to convert now. (towardsPoint, almostEqual)
      const edgeA = (!numIx || circleIx.aInside) ? new PIXI.Point(edge.a.x, edge.a.y)
        : new PIXI.Point(circleIx.intersections[0].x, circleIx.intersections[0].y);
      const edgeB = (!numIx || circleIx.bInside) ? new PIXI.Point(edge.b.x, edge.b.y)
        : new PIXI.Point(circleIx.intersections.at(-1).x, circleIx.intersections.at(-1).y);

      // Does the wall border a sweep edge?
      // Due to rounding, the walls may not exactly overlap the sweep edge.
      // So we cannot simply test for collinearity
      // 6 options:
      //     Edge          eA ----- eB
      // 1.  Wall A --------------------------- B
      // 2.  Wall A ------------ B
      // 3.  Wall              A ----------- B
      // 4.  Wall              A - B
      // 5.  Wall A-B
      // 6.  Wall                          A-B
      // Instead, shoot a ray from the origin through each point to find an intersection.
      // If the intersection is within a pixel of the point, count it.

      // Determine the left and right wall endpoints, to match to the edge endpoints.
      const oWallA = orient2dFast(dirRay.A, dirRay.B, edgeA);
      const oWallB = orient2dFast(dirRay.A, dirRay.B, edgeB);
      const [leftWallPoint, rightWallPoint] = oWallA > oWallB ? [edgeA, edgeB] : [edgeB, edgeA];

      // Draw line from the origin to each sweep edge point.
      for ( const sweepEdge of sweepEdges ) {
        // Left (CCW) and right (CW) edges of the emitted cone for this edge
        const oEdgeA = orient2dFast(dirRay.A, dirRay.B, sweepEdge.a);
        const oEdgeB = orient2dFast(dirRay.A, dirRay.B, sweepEdge.b);
        const [leftEdgePoint, rightEdgePoint] = oEdgeA > oEdgeB
          ? [sweepEdge.a, sweepEdge.b] : [sweepEdge.b, sweepEdge.a];

        let leftIx;
        if ( leftEdgePoint.almostEqual(leftWallPoint, MIN_DIST_EPSILON) ) {
          leftIx = leftEdgePoint;
          leftIx.t0 = 1;
        } else if ( lineSegmentIntersects(
          templateOrigin, templateOrigin.towardsPoint(leftWallPoint, maxDist), leftEdgePoint, rightEdgePoint) ) {
          leftIx = lineLineIntersection(templateOrigin, leftWallPoint, leftEdgePoint, rightEdgePoint);
        } else if ( lineSegmentIntersects(templateOrigin,
          templateOrigin.towardsPoint(leftEdgePoint, maxDist), leftWallPoint, rightWallPoint) ) {
          leftIx = lineLineIntersection(templateOrigin, leftEdgePoint, leftWallPoint, rightWallPoint);
        }
        if ( !leftIx || leftIx.t0 > MIN_DIST_EPSILON ) continue;

        let rightIx;
        if ( rightEdgePoint.almostEqual(rightWallPoint, MIN_DIST_EPSILON) ) {
          rightIx = rightEdgePoint;
          rightIx.t0 = 1;
        } else if ( lineSegmentIntersects(templateOrigin,
          templateOrigin.towardsPoint(rightWallPoint, maxDist), leftEdgePoint, rightEdgePoint) ) {
          rightIx = lineLineIntersection(templateOrigin, rightWallPoint, leftEdgePoint, rightEdgePoint);
        } else if ( lineSegmentIntersects(templateOrigin,
          templateOrigin.towardsPoint(rightEdgePoint, maxDist), leftWallPoint, rightWallPoint) ) {
          rightIx = lineLineIntersection(templateOrigin, rightEdgePoint, leftWallPoint, rightWallPoint);
        }
        if ( !rightIx || rightIx.t0 > MIN_DIST_EPSILON ) continue;

        reflectingEdges.push({
          a: PIXI.Point.fromObject(leftIx),
          b: PIXI.Point.fromObject(rightIx),
          edge: sweepEdge,
          id: sweepEdge.id
        });
      }
    }
    const numEdges = reflectingEdges.length;
    if ( !numEdges ) return [];

    // For each reflecting edge, create a cone template using a shadow cone based on reflected distance.
    // Set origin to just inside the edge, in the middle.
    const coneTemplates = [];
    for ( const reflectingEdge of reflectingEdges ) {
      const reflection = this.constructor.reflectRayOffEdge(dirRay, reflectingEdge);
      if ( !reflection ) continue;
      const { reflectionPoint, reflectionRay, Rr } = reflection;

      // Calculate where to originate the shadow cone for the reflection.
      const reflectionDist = PIXI.Point.distanceBetween(this.origin, reflectionPoint);
      if ( reflectionDist <= 1 ) continue;

      const distance = this.distance - reflectionDist;
      if ( distance < 1 ) continue;

      const shadowConeV = Rr.normalize().multiplyScalar(reflectionDist);
      const shadowConeOrigin = reflectionPoint.subtract(shadowConeV);

      // Shallow copy the options for the new template.
      const opts = { ...this.options };
      opts.level += 1;
      opts.reflectedEdge = reflectingEdge;
      opts.reflectionRay = reflectionRay;
      opts.Rr = Rr;
      opts.lastReflectedEdge = reflectingEdge;
      opts.direction = reflectionRay.angle;
      opts.origin = new Point3d(shadowConeOrigin.x, shadowConeOrigin.y, this.origin.z);
      opts.distance = distance;
      coneTemplates.push(new this.constructor(this.template, opts));
    }

    return coneTemplates;
  }
}
