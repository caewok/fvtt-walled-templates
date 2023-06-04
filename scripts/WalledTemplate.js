/* globals
canvas,
CONFIG,
foundry,
game,
MeasuredTemplate,
PIXI,
Ray
*/
"use strict";

import { MODULE_ID, FLAGS, LABELS } from "./const.js";
import { Point3d } from "./geometry/3d/Point3d.js";
import { ClipperPaths } from "./geometry/ClipperPaths.js";
import { SETTINGS, getSetting, debugPolygons } from "./settings.js";
import { ClockwiseSweepShape, pointFromKey } from "./ClockwiseSweepShape.js";
import { LightWallSweep } from "./ClockwiseSweepLightWall.js";

export class WalledTemplate {
  /** @type {Point3d} */
  origin = new Point3d(0, 0, 0);

  /** @type {"circle"|"cone"|"rect"|"ray"} */
  t = "circle";

  /**
   * @typedef {object} WalledTemplateOptions
   * @property {SETTINGS.DEFAULTS.CHOICES} wallsBlock
   * @property {CONST.WALL_RESTRICTION_TYPES} wallRestriction
   * @property {number} level
   */

  /** @type {WalledTemplateOptions} */
  options = {};

  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = ClockwiseSweepShape;

  _boundaryWalls = new Set();

  /**
   * @param {Point3d} origin    Center point of the template
   * @param {number} distance   Distance, in pixel units
   * @param {WalledTemplateOptions} [options]
   */
  constructor(origin, distance, { wallsBlock, wallRestriction, level } = {}) {
    this.origin.copyFrom(origin);
    this.distance = distance ?? 0;
    this.options.wallsBlock = wallsBlock ?? SETTINGS.DEFAULTS.CHOICES.UNWALLED;
    this.options.wallRestriction = wallRestriction ?? SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE;

    // For recursion, what level of recursion are we at?
    this.options.level = level ?? 0;

    // The WalledTemplate instance is generated per-scene, so we can store the boundary walls here.
    // Alternatively could test ids, but this is probably better long-term.
    this._boundaryWalls = new Set([...canvas.walls.outerBounds, ...canvas.walls.innerBounds]);
  }

  /**
   * Should recursion be used, given these settings?
   * @override
   */
  get doRecursion() {
    return this.options.wallsBlock === SETTINGS.DEFAULTS.CHOICES.RECURSE
      && this.options.level < CONFIG[MODULE_ID].recursions[this.t];
  }

  /**
   * Run a clockwise sweep for this template.
   * @param {ClockwiseSweepShape|LightWallSweep} sweepClass
   * @returns {ClockwiseSweepShape|LightWallSweep}
   */
  computeSweep() {
    const cfg = {
      debug: debugPolygons(),
      type: this.options.wallRestriction,
      source: this,
      boundaryShapes: this.getTranslatedBoundaryShapes()
    };

    // Add in elevation for Wall Height to use
    const origin = this.origin;
    origin.b = this.origin.z;
    origin.t = this.origin.z;
    origin.object = {};

    const sweep = new this.sweepClass();
    sweep.initialize(origin, cfg);
    sweep.compute();
    return sweep;
  }

  computeSweepPolygon() {
    const sweep = this.computeSweep();
    let shape = sweep;
    let recurseData;

    if ( this.doRecursion ) {
      const res = this.recurseFn(sweep, new Map());
      recurseData = res.recurseData;
      const polys = res.polys;
      polys.push(sweep);
      const paths = ClipperPaths.fromPolygons(polys);
      const combined = paths.combine();
      combined.clean();
      shape = combined.toPolygons()[0]; // TODO: Can there ever be more than 1?
      shape.polys = polys;

      // TODO: Need to deal with storing the recurse data.
      // if ( this.id ) this.document.setFlag(MODULE_ID, FLAGS.RECURSE_DATA, recurseData);
    }

    // Shift to origin 0,0 as expected for Template shape.
    const poly = shape.translate(-this.origin.x, -this.origin.y);
    poly._sweep = sweep; // For debugging
    poly._shape = shape; // For debugging
    poly._recurseData = recurseData;
    return poly;
  }

  /**
   * @override
   */
  getOriginalShape() {
    console.error("Each WalledTemplate subclass must override getOriginalShape.");
    return MeasuredTemplate.getCircleShape(this.distance);
  }

  /**
   * @override
   */
  getBoundaryShape() { return this.getOriginalShape(); }

  /**
   * Translate the boundary shape to the correct origin
   * @returns {[PIXI.Circle|PIXI.Rectangle|PIXI.Polygon]}
   */
  getTranslatedBoundaryShapes() {
    const shape = this.getBoundaryShape();
    return [shape.translate(this.origin.x, this.origin.y)];
  }

  static fromMeasuredTemplate(template) {
    const opts = templateFlagProperties(template);

    // Convert to pixel units
    const { angle, t, x, y, elevation } = template.document;
    const width = template.document.width * canvas.dimensions.distancePixels;
    const { angle: direction, distance } = template.ray;
    const elevationZ = CONFIG.GeometryLib.utils.gridUnitsToPixels(elevation ?? 0);
    const origin = new Point3d(x, y, elevationZ);

    let shapeConstructor;
    switch ( t ) {
      case "circle":
        shapeConstructor = WalledTemplateCircle;
        break;
      case "cone":
        shapeConstructor = WalledTemplateCone;
        opts.direction = direction;
        opts.angle = angle;
        break;
      case "rect":
        shapeConstructor = WalledTemplateRectangle;
        opts.direction = direction;
        break;
      case "ray":
        shapeConstructor = WalledTemplateRay;
        opts.direction = direction;
        opts.width = width;
        break;
    }

    return new shapeConstructor(origin, distance, opts);
  }
}

export class WalledTemplateCircle extends WalledTemplate {
  /** @type {"circle"|"cone"|"rect"|"ray"} */
  t = "circle";

  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = ClockwiseSweepShape;

  /**
   * @param {Point3d} origin    Center point of the template
   * @param {number} distance   Radius of the circle, in pixel units
   * @param {WalledTemplateOptions} [options]
   */
  constructor(origin, distance, opts = {}) {
    super(origin, distance, opts);
    this.options.corner = opts.corner;
  }

  /** @type {boolean} */
  get doRecursion() { return super.doRecursion && this.options.level < CONFIG[MODULE_ID].recursions[this.t]; }

  /**
   * Get the original version of this shape.
   * @returns {PIXI.Circle}
   */
  getOriginalShape() { return MeasuredTemplate.getCircleShape(this.distance); }

  /**
   * Get boundary shape for this sized circle set to the origin.
   * @returns {PIXI.Circle}
   */
  getBoundaryShape() {
    // Pad the circle by one pixel so it better covers expected grid spaces.
    // (Rounding tends to drop spaces on the edge.)
    return MeasuredTemplate.getCircleShape(this.distance + 1);
  }

  // TODO: Track spread points.
  // If the origin is nearly equal to the sweep origin, don't use it unless distance is larger.

  /**
   * For each wall within distance of the template origin,
   * re-run sweep, using the corner as the origin and the remaining distance as the radius.
   */
  spread(sweep, cornerTracker) {
    const polys = [];
    const recurseData = [];

    for ( const cornerKey of sweep.cornersEncountered ) {
      const spreadTemplate = this.generateSpread(cornerKey, sweep.edgesEncountered, cornerTracker);
      if ( !spreadTemplate ) continue;

      const spreadSweep = spreadTemplate.computeSweep();
      polys.push(spreadSweep);
      recurseData.push(spreadTemplate);

      if ( spreadTemplate.doRecursion ) {
        const { polys: childPolys, recurseData: childData } = spreadTemplate.spread(spreadSweep, cornerTracker);
        polys.push(...childPolys);
        if ( childData.length ) recurseData.push(...childData);
      }
    }

    return { polys, recurseData};
  }

  /**
   * Generate a new CircleTemplate based on spreading from a designated corner.
   * @param {PIXI.Point} corner
   * @returns {WalledTemplateCircle|null}
   */
  generateSpread(cornerKey, edgesEncountered, cornerTracker) {
    const corner = pointFromKey(cornerKey);

    // If the corner is beyond this template, ignore
    const dist = PIXI.Point.distanceBetween(this.origin, corner);
    if ( this.distance < dist ) return null;

    // Skip if we already created a spread at this corner.
    const prevCornerDist = cornerTracker.get(cornerKey);
    if ( prevCornerDist && prevCornerDist <= dist ) return null;
    cornerTracker.set(cornerKey, dist);

    // Adjust the origin so that it is 2 pixels off the wall at that corner, in direction of the wall.
    // If more than one wall, find the balance point.
    const extendedCorner = extendCornerFromWalls(cornerKey, edgesEncountered, this.origin);
    const distance = this.distance - dist;

    // Shallow copy the options for the new template.
    const opts = { ...this.options };
    opts.level += 1;
    opts.corner = corner;

    return new this.constructor(
      new Point3d(extendedCorner.x, extendedCorner.y, this.origin.z),
      distance,
      opts
    );
  }
}

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
  getOriginalShape() { return MeasuredTemplate.getRectShape(this.direction, this.distance); }

  /**
   * Get boundary shape for this rectangle set to the origin.
   * @returns {PIXI.Circle}
   */
  getBoundaryShape() { return this.getOriginalShape(); }

  /**
   * Generate a new RectangleTemplate based on spreading from a designated corner.
   * @param {PIXI.Point} corner
   * @returns {WalledTemplateRectangle|null}
   */
  generateSpread(cornerKey, edgesEncountered, cornerTracker) {
    const out = super.generateSpread(cornerKey, edgesEncountered, cornerTracker);
    if ( !out ) return out;
    out.direction = this.direction;
    return out;
  }
}

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
  getOriginalShape() { return MeasuredTemplate.getRayShape(this.direction, this.distance, this.width); }

  /**
   * For each wall within distance of the template origin,
   * re-run sweep, changing the direction based on bouncing it off the wall.
   * Use remaining distance.
   * @param {ClockwiseSweepPolygon} sweep   Results of prior sweep.
   */
  reflect(sweep) {
    const polys = [];
    const recurseData = [];

    const reflection = this.generateReflection(sweep.edgesEncountered);
    if ( !reflection ) return { polys, recurseData };
    const reflectionSweep = reflection.computeSweep();
    polys.push(reflectionSweep);
    recurseData.push(reflection);

    if ( reflection.doRecursion ) {
      const { polys: childPolys, recurseData: childData } = reflection.reflect(reflectionSweep);
      polys.push(...childPolys);
      if ( childData.length ) recurseData.push(...childData);
    }

    return { polys, recurseData };
  }

  /**
   * Generate a new WalledTemplateRay based on reflecting off the first wall encountered
   * from this WalledTemplateRay.
   * @param {Set<Wall>|Map<Wall>|Wall[]}
   * @returns {WalledTemplateRay|null}
   */
  generateReflection(edges) {
    const dirRay = Ray.fromAngle(this.origin.x, this.origin.y, this.direction, this.distance);

    // Sort walls by closest collision to the template origin, skipping those that do not intersect.
    const wallRays = [];
    for ( const edge of edges) {
      if ( this._boundaryWalls.has(edge) ) continue;
      const ix = foundry.utils.lineSegmentIntersection(dirRay.A, dirRay.B, edge.A, edge.B);
      if ( !ix ) continue;
      const wallRay = new Ray(edge.A, edge.B);
      wallRay._reflectionPoint = ix;
      wallRay._reflectionDistance = PIXI.Point.distanceBetween(this.origin, ix);

      // If the wall intersection is beyond the template, ignore.
      if ( this.distance < wallRay._reflectionDistance ) continue;

      wallRays.push(wallRay);
    }
    if ( !wallRays.length ) return null;

    // Only reflect off the first wall encountered.
    wallRays.sort((a, b) => a._reflectionDistance - b._reflectionDistance);
    const reflectedWall = wallRays[0];
    const reflectionPoint = new PIXI.Point(reflectedWall._reflectionPoint.x, reflectedWall._reflectionPoint.y);
    const { reflectionRay, Rr } = reflectRayOffEdge(dirRay, reflectedWall, reflectionPoint);


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

    return new this.constructor(
      new Point3d(reflectedOrigin.x, reflectedOrigin.y, this.origin.z),
      this.distance - reflectedWall._reflectionDistance,
      opts);
  }
}

export class WalledTemplateCone extends WalledTemplateRay {

  /** @type {"circle"|"cone"|"rect"|"ray"} */
  t = "cone";

  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = LightWallSweep;

  /**
   * @param {Point3d} origin    Center point of the template
   * @param {number} distance   Distance of the ray, in pixel units
   * @param {object} [opts]
   * @param {number} [opts.direction]   Direction of the ray, in radians
   * @param {number} [opts.angle]       Angle of the triangle formed by the cone, in degrees
   * @param {number} [opts.width]       Can be used in lieu of angle
   * @param {WalledTemplateOptions} [options]
   */
  constructor(origin, distance, opts = {}) {
    super(origin, distance, opts);
    if ( Object.hasOwn(opts, "angle") ) this.angle = opts.angle;
    this.options.lastReflectedWall = opts.lastReflectedWall;
  }

  /**
   * For the cone, the angle property is substituted for the width property.
   */
  get angle() { return this.width; }

  set angle(value) { this.width = value; }

  /**
   * Get the original version of this shape.
   * @returns {PIXI.Polygon}
   */
  getOriginalShape() { return MeasuredTemplate.getConeShape(this.direction, this.width, this.distance); }

  /**
   * For each wall within the distance of the template origin,
   * re-run sweep for the reflection of the cone (shadow cone). Invert the reflection against the
   * reflected cone shape to get the reflected portion.
   * Recurse by using the reflected cone origin.
   * The shadow cone is the cone shape that could be used to describe the reflection,
   * where the origin is the reflection of the original origin, through the wall.
   * @param {ClockwiseSweepPolygon} sweep   Results of prior sweep.
   */
  reflect(sweep) {
    const polys = [];
    const recurseData = [];

    const reflections = this.generateReflections(sweep);
    if ( !reflections ) return { polys, recurseData };

    // Conduct a sweep using each reflected cone shape as a boundary (shadow cone).
    for ( const reflection of reflections ) {
      const reflectionSweep = reflection.computeSweep();
      polys.push(reflectionSweep);
      recurseData.push(reflection);

      if ( reflection.doRecursion ) {
        const { polys: childPolys, recurseData: childData } = reflection.reflect(reflectionSweep);
        polys.push(...childPolys);
        if ( childData.length ) recurseData.push(...childData);
      }
    }

    return { polys, recurseData };
  }

  // TODO: For cones, the reflect should be from the edges of the cone.
  // One approach: Shoot the reflected middle line straight through the wall.
  //   At the distance between template origin and wall intersection, that is the new origin.
  //   Cone sides go from there through the wall. In other words, the entire cone is reflected.

  /**
   * Locate wall segments that the cone hits.
   * For each segment, calculate the reflection ray based on normal of that edge.
   * For each reflecting edge, create a cone template using a shadow cone based on reflected distance.
   * Set origin of the template to just inside the edge, in the middle.
   * @param {Set<Wall>|Map<Wall>|Wall[]}
   * @returns {WalledTemplateRay|null}
   */
  generateReflections(sweep) {
    const COLLINEAR_MIN_NEG = -10;
    const COLLINEAR_MIN_POS = 10;
    const maxDist = this.distance;
    const maxDist2 = Math.pow(maxDist, 2);
    const dirRay = Ray.fromAngle(this.origin.x, this.origin.y, this.direction, this.distance);
    const { closestPointToSegment, orient2dFast } = foundry.utils;

    // Sort walls by closest collision to the template origin, skipping those that do not intersect.
    const reflectingEdges = [];
    const sweepEdges = [...sweep.iterateEdges()];
    const lastReflectedWall = this.options.lastReflectedWall;
    const oLastReflected = lastReflectedWall
      ? Math.sign(orient2dFast(lastReflectedWall.A, lastReflectedWall.B, this.origin))
      : undefined;
    for ( const edge of sweep.edgesEncountered) {
      if ( lastReflectedWall ) {
        // For recursion:
        // Any reflecting edge must be on the side of the reflecting wall opposite the origin.
        // Omit the last reflected wall.
        if ( edge.id === lastReflectedWall.id ) continue;
        const oEdge = orient2dFast(edge.A, edge.B, this.origin);
        if ( Math.sign(oEdge) === oLastReflected ) continue;
      }

      // Edge must be within distance of the template to use.
      const closestEdgePoint = closestPointToSegment(this.origin, edge.A, edge.B);
      const minDist2 = PIXI.Point.distanceSquaredBetween(this.origin, closestEdgePoint);
      if ( minDist2 > maxDist2 ) continue;

      // Edge will be nearly collinear with sweep edge, but probably not exactly b/c sweep rounds endpoints.
      for ( const sweepEdge of sweepEdges ) {
        if ( Number.between(orient2dFast(edge.A, edge.B, sweepEdge.A), COLLINEAR_MIN_NEG, COLLINEAR_MIN_POS)
          && Number.between(orient2dFast(edge.A, edge.B, sweepEdge.B), COLLINEAR_MIN_NEG, COLLINEAR_MIN_POS) ) {

          sweepEdge.wall = edge;
          reflectingEdges.push(sweepEdge);
          break;
        }
      }
    }
    const numEdges = reflectingEdges.length;
    if ( !numEdges ) return null;

    // For each reflecting edge, create a cone template using a shadow cone based on reflected distance.
    // Set origin to just inside the edge, in the middle.
    const coneTemplates = new Array(numEdges);
    for ( let i = 0; i < numEdges; i += 1 ) {
      const reflectingEdge = reflectingEdges[i];
      const { reflectionPoint, reflectionRay, Rr } = reflectRayOffEdge(dirRay, reflectingEdge);

      // Calculate where to originate the shadow cone for the reflection.
      const reflectionDist = PIXI.Point.distanceBetween(this.origin, reflectionPoint);
      const shadowConeV = Rr.normalize().multiplyScalar(reflectionDist);
      const shadowConeOrigin = reflectionPoint.subtract(shadowConeV);

      // Set the new origin to be just inside the reflecting wall, to avoid using sweep
      // on the wrong side of the wall.
      // Shallow copy the options for the new template.
      const opts = { ...this.options };
      opts.level += 1;
      opts.reflectedWall = reflectingEdge;
      opts.reflectionRay = reflectionRay;
      opts.Rr = Rr;
      opts.lastReflectedWall = reflectingEdge.wall;
      opts.angle = reflectionRay.angle;

      coneTemplates[i] = new this.constructor(
        new Point3d(shadowConeOrigin.x, shadowConeOrigin.y, this.origin.z),
        this.distance,
        opts
      );
    }

    return coneTemplates;
  }
}

// NOTE: Geometric helper functions

/**
 * Given a ray and an edge, calculate the reflection off the edge.
 * See:
 * https://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
 * http://paulbourke.net/geometry/reflected/
 * @param {Ray|Segment} ray     Ray to reflect off the edge
 * @param {Ray|Segment} edge    Segment with A and B endpoints
 * @returns {null|{ reflectionPoint: {PIXI.Point}, reflectionRay: {Ray}, Rr: {PIXI.Point} }}
 */
function reflectRayOffEdge(ray, edge, reflectionPoint) {
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

// NOTE: Set the recursion types to spread or reflect, accordingly.
WalledTemplateCircle.prototype.recurseFn = WalledTemplateCircle.prototype.spread;
WalledTemplateRay.prototype.recurseFn = WalledTemplateRay.prototype.reflect;

/**
 * Adjust a corner point to offset from the wall by 2 pixels.
 * Offset should move in the direction of the wall.
 * If more than one wall at this corner, use the average vector between the
 * rightmost and leftmost walls on the side of the template origin.
 * @param {number} cornerKey      Key value for the corner
 * @param {Set<Wall>} wallSet     Walls to test
 * @param {Point} templateOrigin  Origin of the template
 */
function extendCornerFromWalls(cornerKey, wallSet, templateOrigin) {
  const CORNER_SPACER = CONFIG[MODULE_ID]?.cornerSpacer ?? 10;

  if ( !wallSet.size ) return pointFromKey(cornerKey);

  const walls = [...wallSet].filter(w => w.wallKeys.has(cornerKey));
  if ( !walls.length ) return pointFromKey(cornerKey); // Should not occur.
  if ( walls.length === 1 ) {
    const w = walls[0];
    let [cornerPt, otherPt] = w.A.key === cornerKey ? [w.A, w.B] : [w.B, w.A];
    cornerPt = new PIXI.Point(cornerPt.x, cornerPt.y);
    otherPt = new PIXI.Point(otherPt.x, otherPt.y);
    const dist = PIXI.Point.distanceBetween(cornerPt, otherPt);
    return otherPt.towardsPoint(cornerPt, dist + CORNER_SPACER);  // 2 pixels ^ 2 = 4
  }

  // Segment with the smallest (incl. negative) orientation is ccw to the point
  // Segment with the largest orientation is cw to the point
  const orient = foundry.utils.orient2dFast;
  const segments = [...walls].map(w => {
    // Construct new segment objects so walls are not modified.
    const [cornerPt, otherPt] = w.A.key === cornerKey ? [w.A, w.B] : [w.B, w.A];
    const segment = {
      A: new PIXI.Point(cornerPt.x, cornerPt.y),
      B: new PIXI.Point(otherPt.x, otherPt.y)
    };
    segment.orient = orient(cornerPt, otherPt, templateOrigin);
    return segment;
  });
  segments.sort((a, b) => a.orient - b.orient);

  // Get the directional vector that splits the segments in two from the corner.
  let ccw = segments[0];
  let cw = segments[segments.length - 1];
  let dir = averageSegments(ccw.A, ccw.B, cw.B);

  // The dir is the point between the smaller angle of the two segments.
  // Check if we need that point or its opposite, depending on location of the template origin.
  let pt = ccw.A.add(dir.multiplyScalar(CORNER_SPACER));
  let oPcw = orient(cw.A, cw.B, pt);
  let oTcw = orient(cw.A, cw.B, templateOrigin);
  if ( Math.sign(oPcw) !== Math.sign(oTcw) ) pt = ccw.A.add(dir.multiplyScalar(-CORNER_SPACER));
  else {
    let oPccw = orient(ccw.A, ccw.B, pt);
    let oTccw = orient(ccw.A, ccw.B, templateOrigin);
    if ( Math.sign(oPccw) !== Math.sign(oTccw) ) pt = ccw.A.add(dir.multiplyScalar(-CORNER_SPACER));
  }

  return pt;
}

/**
 * Calculate the normalized directional vector from a segment.
 * @param {PIXI.Point} a   First endpoint of the segment
 * @param {PIXI.Point} b   Second endpoint of the segment
 * @returns {PIXI.Point} A normalized directional vector
 */
function normalizedVectorFromSegment(a, b) {
  return b.subtract(a).normalize();
}

/* -------------------------------------------- */

/**
 * Get the normalized vectors pointing clockwise and counterclockwise from a segment.
 * Orientation is measured A --> B --> vector.
 * @param {PIXI.Point} a   First endpoint of the segment
 * @param {PIXI.Point} b   Second endpoint of the segment
 * @returns {cw: PIXI.Point, ccw: PIXI.Point} Normalized directional vectors labeled cw and ccw.
 */
function orthogonalVectorsToSegment(a, b) {
  // Calculate the normalized vectors orthogonal to the edge
  const norm = normalizedVectorFromSegment(a, b);
  const cw = new PIXI.Point(-norm.y, norm.x);
  const ccw = new PIXI.Point(norm.y, -norm.x);
  return { cw, ccw };
}

/* -------------------------------------------- */

/**
 * Find the normalized directional vector between two segments that share a common point A.
 * The vector returned will indicate a direction midway between the segments A|B and A|C.
 * The vector will indicate a direction clockwise from A|B.
 * In other words, the vector returned is the sum of the normalized vector of each segment.
 * @param {Point} a   Shared endpoint of the two segments A|B and A|C
 * @param {Point} b   Second endpoint of the segment A|B
 * @param {Point} c   Second endpoint of the segment B|C
 * @returns {Point} A normalized directional vector
 */
function averageSegments(a, b, c, outPoint) {
  // If c is collinear, return the orthogonal vector in the clockwise direction
  const orient = foundry.utils.orient2dFast(a, b, c);
  if ( !orient ) return orthogonalVectorsToSegment(a, b).cw;

  const normB = normalizedVectorFromSegment(a, b);
  const normC = normalizedVectorFromSegment(a, c);

  outPoint ??= new PIXI.Point();
  normB.add(normC, outPoint).multiplyScalar(0.5, outPoint);

  // If c is ccw to b, then negate the result to get the vector going the opposite direction.
  // if ( orient > 0 ) outPoint.multiplyScalar(-1, outPoint);

  return outPoint;
}

// NOTE: Other helper functions

/**
 * Determine the flag properties for a given template.
 * These might be derived from an associated item or from default settings.
 * @param {Template} template
 * @returns {object} { wallsBlock: string, wallRestriction: string }
 */
export function templateFlagProperties(template) {
  const templateShape = template.document.t;
  let item = template.item;
  if ( game.system.id === "dnd5e" && !item ) {
    const uuid = template.document.getFlag("dnd5e", "origin");
    if ( origin ) {
      const leaves = game.documentIndex.uuids[uuid]?.leaves;
      if ( leaves ) item = leaves.find(leaf => leaf.uuid === uuid)?.entry;
    }
  }

  let wallsBlock = item?.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)
    ?? template.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)
    ?? getSetting(SETTINGS.DEFAULTS[templateShape])
    ?? SETTINGS.DEFAULTS.CHOICES.UNWALLED;

  let wallRestriction = item?.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION)
    ?? template.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION)
    ?? getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[templateShape])
    ?? SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE;

  if ( wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = getSetting(SETTINGS.DEFAULTS[templateShape]);
  if ( wallRestriction === LABELS.GLOBAL_DEFAULT ) {
    wallRestriction = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[templateShape]);
  }

  return { wallsBlock, wallRestriction };
}
