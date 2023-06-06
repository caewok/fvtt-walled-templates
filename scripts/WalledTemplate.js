/* globals
canvas,
CONFIG,
foundry,
game,
MeasuredTemplate,
PIXI,
Ray
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, LABELS } from "./const.js";
import { Point3d } from "./geometry/3d/Point3d.js";
import { ClipperPaths } from "./geometry/ClipperPaths.js";
import { SETTINGS, getSetting, debugPolygons } from "./settings.js";
import { ClockwiseSweepShape, pointFromKey } from "./ClockwiseSweepShape.js";
import { LightWallSweep } from "./ClockwiseSweepLightWall.js";

// Debugging
import { Draw } from "./geometry/Draw.js";

const MIN_PARALLEL_EPSILON = 1e-04;
const MIN_DIST_EPSILON = 1 + MIN_PARALLEL_EPSILON;
const PI_1_2 = Math.PI * 0.5;

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
    this.origin.roundDecimals(); // Avoid annoying issues with precision.
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
   * @param {Wall} [lightWall]    Wall used when using the LightWall class
   * @returns {ClockwiseSweepShape|LightWallSweep}
   */
  computeSweep() {
    const cfg = {
      debug: debugPolygons(),
      type: this.options.wallRestriction,
      source: this,
      boundaryShapes: this.getTranslatedBoundaryShapes(),
      lightWall: this.options.lastReflectedEdge // Only used for cones
    };

    // Add in elevation for Wall Height to use
    const origin = this.origin;
    origin.b = this.origin.z;
    origin.t = this.origin.z;
    origin.object = {};

    let sweepClass = this.sweepClass;
    if ( sweepClass === LightWallSweep && !this.options.lastReflectedEdge) sweepClass = ClockwiseSweepShape;

    const sweep = new sweepClass();
    sweep.initialize(origin, cfg);
    sweep.compute();
    return sweep;
  }

  computeSweepPolygon() {
    const sweep = this.computeSweep();
    let shape = sweep;
    let recurseData;

    if ( this.doRecursion ) {
      const res = this._recurse(sweep, new Map());
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

  // -------------------- //

  /**
   * For a given sweep result, re-run by moving the origin in a manner specific to the
   * shape and shrinking the shape.
   * For example:
   * - Circle: Draw circle at each wall corner, shrinking the circle radius relative to
   *           the distance from this template's origin.
   * - Ray: Draw ray reflecting a given wall, shrinking the ray length relative to
   *        the distance from this template's origin.
   * Subclasses implement the specific recursion template generation.
   * @param {ClockwiseSweepPolygon} sweep   Sweep result for this template.
   * @param {Map} recursionTracker          A map that can be utilized to avoid repeats in the recursion.
   * @returns {object} Array of polygons generated and an array of generated sub-templates.
   */
  _recurse(sweep, recursionTracker) {
    const polys = [];
    const recurseData = [];
    const subtemplates = this._generateSubtemplates(sweep, recursionTracker);

    // Subtemplates may be length zero, which will cause this to return empty arrays.
    for ( const subtemplate of subtemplates ) {
      if ( !subtemplate ) {
        console.error("_recurse encountered bad subtemplate!");
      }

      const subsweep = subtemplate.computeSweep();
      polys.push(subsweep);
      recurseData.push(subtemplate);

      if ( subtemplate.doRecursion ) {
        const { polys: childPolys, recurseData: childData } = subtemplate._recurse(subsweep, recursionTracker);
        polys.push(...childPolys);
        if ( childData.length ) recurseData.push(...childData);
      }
    }

    return { polys, recurseData };
  }

  /**
   * Generate new smaller template(s) based on the sweep.
   * For example, generate templates based on spreading from corners or reflecting from walls.
   * Must be implemented by the subclass.
   * @param {PIXI.Point} corner
   * @returns {WalledTemplate[]|null}
   */
  _generateSubtemplates(_sweep, _recursionTracker) {
    console.error("WalledTemplate.prototype._generateSubtemplates must be implemented by subclass.");
    return null;
  }

  // -------------------- //

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

  /**
   * Get the bounding box for this shape.
   * @returns {PIXI.Rectangle}
   */
  getBounds() {
    const shapes = this.getTranslatedBoundaryShapes();
    if ( shapes.length === 1 ) return shapes[0].getBounds();

    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    shapes.forEach(shape => {
      const bounds = shape.getBounds();
      xMin = Math.min(xMin, bounds.left);
      xMax = Math.max(xMax, bounds.right);
      yMin = Math.min(yMin, bounds.top);
      yMax = Math.max(yMax, bounds.bottom);
    });
    return new PIXI.Rectangle(xMin, yMin, xMax - xMin, yMax - yMin);
  }

  // For debugging, draw the template shape on the canvas.
  draw({ color, fillAlpha } = {}) {
    fillAlpha ??= 0;
    color ??= Draw.COLORS.yellow;
    const fill = fillAlpha ? color : false;
    this.getTranslatedBoundaryShapes().forEach(s => Draw.shape(s, { color, fill, fillAlpha }));
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

  /**
   * Generate a new CircleTemplate based on spreading from the corners present in the sweep.
   * @param {ClockwiseSweepPolygon} sweep   Sweep result for this template.
   * @param {Map} recursionTracker          A map that can be utilized to avoid repeats in the recursion.
   * @returns {object} Array of polygons generated and an array of generated sub-templates.
   * @override
   */
  _generateSubtemplates(sweep, cornerTracker) {
    const subtemplates = [];
    for ( const cornerKey of sweep.cornersEncountered ) {
      const spreadTemplates = this._generateSpreadsFromCorner(cornerKey, sweep.edgesEncountered, cornerTracker);
      if ( spreadTemplates ) subtemplates.push(...spreadTemplates);
    }
    return subtemplates;
  }

  /**
   * Generate a new CircleTemplate based on spreading from a designated corner.
   * @param {PIXI.Point} corner
   * @returns {WalledTemplateCircle|null}
   */
  _generateSpreadsFromCorner(cornerKey, edgesEncountered, cornerTracker) {
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

    return [new this.constructor(
      new Point3d(extendedCorner.x, extendedCorner.y, this.origin.z),
      distance,
      opts
    )];
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
   * @returns {WalledTemplateRectangle[]|null}
   */
  _generateSpreadsFromCorner(cornerKey, edgesEncountered, cornerTracker) {
    // If the corner is not within the template shape, ignore
    const corner = pointFromKey(cornerKey);
    const bounds = this.getBounds();
    if ( !bounds.contains(corner.x, corner.y) ) return null;

    const out = super._generateSpreadsFromCorner(cornerKey, edgesEncountered, cornerTracker);
    if ( !out ) return null;

    // Build the rectangle template in 4 directions.
    // For each one, intersect the shape against the current to get the new distance.
    // The new shape will be entirely contained by the old.
    const spread = out[0]; // Circle only produces a single template.
    const spreads = new Array(4);
    for ( let i = 0; i < 4; i += 1 ) {
      spreads[i] = spread.rotateTemplate(Math.normalizeRadians(this.direction + (PI_1_2 * i)), bounds);
    }
    return spreads;
  }

  /**
   * Construct a template based on this template, rotating around the origin.
   * Optionally limit the frame of the rectangle.
   * @param {number} radians                  Amount to rotate the template, in radians
   * @param {PIXI.Rectangle} [enclosingFrame] Boundary to restrict the resulting template
   * @returns {WalledTemplateRectangle}
   */
  rotateTemplate(radians, enclosingFrame) {
    const direction = Math.normalizeRadians(this.direction + radians);
    enclosingFrame ??= canvas.dimensions.rect;
    const origin2d = this.origin.to2d();

    // Build a new shape and intersect with the frame.
    const ixShape = MeasuredTemplate.getRectShape(direction, this.distance)
      .translate(origin2d.x, origin2d.y)
      .intersection(enclosingFrame);

    // Direction and diagonal may have changed due to the intersection.
    // 0–90º: SE quadrant
    // 90–180º: SW quadrant
    // 180–270º: NW quadrant
    // 270–360º: NE quadrant

    let oppositeCorner;
    if ( origin2d.almostEqual(ixShape) ) {
      oppositeCorner = new PIXI.Point(ixShape.right, ixShape.bottom); // TL -> BR
    } else if ( origin2d.almostEqual({ x: ixShape.right, y: ixShape.top }) ) {
      oppositeCorner = new PIXI.Point(ixShape.left, ixShape.bottom); // TR -> BL
    } else if ( origin2d.almostEqual({ x: ixShape.right, y: ixShape.bottom }) ) {
      oppositeCorner = new PIXI.Point(ixShape.left, ixShape.top); // BR -> TL
    } else {
      oppositeCorner = new PIXI.Point(ixShape.right, ixShape.top); // BL -> TR
    }


    // Construct a template based on this current template with distance and direction modified.
    const opts = { ...this.options };
    const delta = oppositeCorner.subtract(origin2d);
    opts.direction = Math.atan2(delta.y, delta.x);
    return new this.constructor(
      this.origin,
      PIXI.Point.distanceBetween(origin2d, oppositeCorner),
      opts
    );
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
    this.options.lastReflectedEdge = opts.lastReflectedEdge;
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
      const reflection = reflectRayOffEdge(dirRay, reflectingEdge);
      if ( !reflection ) continue;
      const { reflectionPoint, reflectionRay, Rr } = reflection;

      // Calculate where to originate the shadow cone for the reflection.
      const reflectionDist = PIXI.Point.distanceBetween(this.origin, reflectionPoint);
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
      opts.angle = this.angle;
      opts.direction = reflectionRay.angle;

      coneTemplates.push(new this.constructor(
        new Point3d(shadowConeOrigin.x, shadowConeOrigin.y, this.origin.z),
        this.distance - reflectionDist,
        opts
      ));
    }

    return coneTemplates;
  }
}

// NOTE: Set the recursion types to spread or reflect, accordingly.
WalledTemplateCircle.prototype._spread = WalledTemplateCircle.prototype._recurse;
WalledTemplateRay.prototype._reflect = WalledTemplateRay.prototype._recurse;
WalledTemplateCone.prototype._reflect = WalledTemplateCone.prototype._recurse;
WalledTemplateRectangle.prototype._spread = WalledTemplateRectangle.prototype._recurse;

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
