/* globals
foundry,
PIXI,
Ray
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d } from "../geometry/3d/Point3d.js";
import { LightWallSweep } from "../ClockwiseSweepLightWall.js";
import { WalledTemplateRay } from "./WalledTemplateRay.js";

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

  /** @type {PIXI.Polygon} */
  get originalShape() {
    return CONFIG.MeasuredTemplate.objectClass.getConeShape(this.direction, this.width, this.distance);
  }

  /** @type {number} */
  get minorAxisLength() {
    // Cone width
    const angles = [(this.width/-2), (this.width/2)];
    const rays = angles.map(a => Ray.fromAngle(0, 0, this.direction + Math.toRadians(a), this.distance+1));
    return PIXI.Point.distanceBetween(rays[0].B, rays[1].B);
  }

  /** @type {number} */
  get majorAxisLength() {
    // Cone distance
    return CONFIG.GeometryLib.utils.gridUnitsToPixels(this.distance || 1);
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
      .filter(e => !orient2dFast(e.A, e.B, templateOrigin).almostEqual(0));

    const lastReflectedEdge = this.options.lastReflectedEdge;
    const oLastReflected = lastReflectedEdge
      ? Math.sign(orient2dFast(lastReflectedEdge.A, lastReflectedEdge.B, templateOrigin))
      : undefined;

    // Build the left/right cone segments.


    // Locate walls that reflect the cone.
    // Walls must be within the sweep template or intersect the sweep template
    const reflectingEdges = [];
    for ( const wall of sweep.edgesEncountered ) {
      // Don't reflect off of bounds
      if ( this._boundaryWalls.has(wall) ) continue;

      if ( lastReflectedEdge ) {
        // Omit the last reflected.
        if ( wall.id === lastReflectedEdge.id ) continue;

        // Any reflecting wall must be on the side of the reflecting wall opposite the origin.
        const oEdge = orient2dFast(wall.A, wall.B, templateOrigin);
        if ( Math.sign(oEdge) === oLastReflected ) continue;
      }

      // Edge must be within distance of the template to use.
      const closestEdgePoint = closestPointToSegment(templateOrigin, wall.A, wall.B);
      const minDist2 = PIXI.Point.distanceSquaredBetween(templateOrigin, closestEdgePoint);
      if ( minDist2 > maxDist2 ) continue;

      // Shrink the wall to be inside the template if necessary.
      // Shrink the radius slightly to ensure the intersected point will count.
      const circleIx = lineCircleIntersection(wall.A, wall.B, templateOrigin, maxDist - 2);
      const numIx = circleIx.intersections.length;

      // Need PIXI points later; easier to convert now. (towardsPoint, almostEqual)
      const wallA = (!numIx || circleIx.aInside) ? new PIXI.Point(wall.A.x, wall.A.y)
        : new PIXI.Point(circleIx.intersections[0].x, circleIx.intersections[0].y);
      const wallB = (!numIx || circleIx.bInside) ? new PIXI.Point(wall.B.x, wall.B.y)
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
      const oWallA = orient2dFast(dirRay.A, dirRay.B, wallA);
      const oWallB = orient2dFast(dirRay.A, dirRay.B, wallB);
      const [leftWallPoint, rightWallPoint] = oWallA > oWallB ? [wallA, wallB] : [wallB, wallA];

      // Draw line from the origin to each sweep edge point.
      for ( const sweepEdge of sweepEdges ) {
        // Left (CCW) and right (CW) edges of the emitted cone for this edge
        const oEdgeA = orient2dFast(dirRay.A, dirRay.B, sweepEdge.A);
        const oEdgeB = orient2dFast(dirRay.A, dirRay.B, sweepEdge.B);
        const [leftEdgePoint, rightEdgePoint] = oEdgeA > oEdgeB
          ? [sweepEdge.A, sweepEdge.B] : [sweepEdge.B, sweepEdge.A];

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

        const edge = {
          A: new PIXI.Point(leftIx.x, leftIx.y),
          B: new PIXI.Point(rightIx.x, rightIx.y),
          wall,
          id: wall.id
        };
        reflectingEdges.push(edge);
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
      opts.reflectedWall = reflectingEdge;
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
