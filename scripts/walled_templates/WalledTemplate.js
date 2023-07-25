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

import { MODULE_ID, FLAGS, LABELS } from "../const.js";
import { Point3d } from "../geometry/3d/Point3d.js";
import { ClipperPaths } from "../geometry/ClipperPaths.js";
import { SETTINGS, getSetting, debugPolygons } from "../settings.js";
import { ClockwiseSweepShape } from "../ClockwiseSweepShape.js";
import { LightWallSweep } from "../ClockwiseSweepLightWall.js";
import { WalledTemplateCircle } from "./WalledTemplateCircle.js";
import { WalledTemplateRectangle } from "./WalledTemplateRectangle.js";
import { WalledTemplateCone } from "./WalledTemplateCone.js";
import { WalledTemplateRay } from "./WalledTemplateRay.js";
import { WalledTemplateRoundedCone } from "./WalledTemplateRoundedCone.js";

// Debugging
import { Draw } from "../geometry/Draw.js";

/**
 * Class to handle the different template shapes, allowing for subclasses of each shape.
 * A subclass must define its original shape and register its shape and code.
 */
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
    // Default to treating template as infinite in vertical directions
    // Do this after initialization b/c something is flipping them around. Likely Wall Height.
    cfg.source.object ??= {};
    cfg.source.object.b ??= Number.POSITIVE_INFINITY;
    cfg.source.object.t ??= Number.NEGATIVE_INFINITY;

    let sweepClass = this.sweepClass;
    if ( sweepClass === LightWallSweep && !this.options.lastReflectedEdge) sweepClass = ClockwiseSweepShape;

    const sweep = new sweepClass();
    sweep.initialize(this.origin, cfg);

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
      if ( !shape ) shape = sweep; // Rare but it is possible due to some obscure bug.

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
        shapeConstructor = game.settings.get("core", "coneTemplateType") === "round"
          && game.system.id !== "swade" ? WalledTemplateRoundedCone : WalledTemplateCone;
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
export function reflectRayOffEdge(ray, edge, reflectionPoint) {
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

/* -------------------------------------------- */


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
