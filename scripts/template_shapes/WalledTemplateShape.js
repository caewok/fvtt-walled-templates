/* globals
canvas,
CONFIG,
game,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, LABELS } from "../const.js";
import { Point3d } from "../geometry/3d/Point3d.js";
import { ClipperPaths } from "../geometry/ClipperPaths.js";
import { SETTINGS, getSetting, debugPolygons } from "../settings.js";
import { ClockwiseSweepShape } from "../ClockwiseSweepShape.js";
import { LightWallSweep } from "../ClockwiseSweepLightWall.js";

// Debugging
import { Draw } from "../geometry/Draw.js";

/**
 * Class to handle the different template shapes, allowing for subclasses of each shape.
 * A subclass must define its original shape and register its shape and code.
 */
export class WalledTemplateShape {
  /**
   * Register storing different shape codes.
   * Key is the shape code. Typically Foundry defaults: "rect", "cir", "ray", "cone"
   * Others are possible if the template document has some other code set.
   * Value is the shape class.
   * Used in wrap of _computeShape to call the relevant shape.
   */
  static shapeCodeRegister = new Map();

  /** @type {Point3d} */
  origin = new Point3d(0, 0, 0);

  /** @type {number} */
  distance = 0;

  /** @type {number} */
  direction = 0;

  /**
   * Options used primarily by recursion for reflect and spread algorithms
   * @typedef {object} WalledTemplateOptions
   * @property {Point3d} origin     Center point of the template or sub-template
   * @property {number} distance    Length of the template or sub-template, in pixel units
   * @property {number} direction   Ray direction of the template or sub-template, in radians
   * @property {number} level       What level of recursion we are on
   */

  /** @type {WalledTemplateOptions} */
  options = {};

  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = ClockwiseSweepShape;

  /** @type {Set<Wall>} */
  _boundaryWalls = new Set();

  /**
   * @param {MeasuredTemplate} template   The underlying measured template
   * @param {WalledTemplateOptions} [opts]
   */
  constructor(template, { origin, distance, direction, level } = {}) {
    this.template = template;
    this.origin.copyFrom(origin ?? { x: template.x, y: template.y, z: template.elevationZ });
    this.origin.roundDecimals(); // Avoid annoying issues with precision.
    this.distance = distance ?? this.template.ray.distance;
    this.direction = direction ?? this.template.ray.angle;
    this.options.level = level ?? 0; // For recursion, what level of recursion are we at?
    this._boundaryWalls = new Set([...canvas.walls.outerBounds, ...canvas.walls.innerBounds]);
  }

  /** @type {string} */
  get t() { return this.template.document.t; }

  /** @type {number} */
  get angle() { return this.template.document.angle; }

  /** @type {number} */
  get width() { return this.template.document.width * canvas.dimensions.distancePixels; }


  /** @type {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon} */
  get originalShape() {
    const wt = this.template[MODULE_ID];
    if ( wt?.originalShape ) return wt.originalShape;

    // Should not reach this, but...
    console.debug("WalledTemplateShape no original shape defined.");
    const doc = this.template.document;
    const distance = this.distance ?? doc.distance;
    const direction = this.direction ?? doc.direction;
    const width = this.width ?? doc.width;
    const angle = this.angle ?? doc.angle;
    switch ( this.t ) {
      case "cir": return CONFIG.MeasuredTemplate.objectClass.getCircleShape(distance);
      case "rect": return CONFIG.MeasuredTemplate.objectClass.getRectShape(direction, distance);
      case "cone": return CONFIG.MeasuredTemplate.objectClass.getConeShape(direction, angle, distance);
      case "ray": return CONFIG.MeasuredTemplate.objectClass.getRayShape(direction, distance, width);
    }
    return undefined;
  }

  /**
   * Original shape centered at 0,0, with any modifications required.
   */
  get boundaryShape() { return this.originalShape; }

  /**
   * Translate the boundary shape to the correct origin.
   * This can be represented in subclasses as two or more combined shapes for use in the sweep.
   * Thus an array of shapes is returned.
   * @returns {[PIXI.Circle|PIXI.Rectangle|PIXI.Polygon]}
   */
  get translatedBoundaryShapes() {
    const shape = this.boundaryShape;
    return [shape.translate(this.origin.x, this.origin.y)];
  }

  /** @type {SETTINGS.DEFAULTS.CHOICES} */
  get wallsBlockCode() {
    let wallsBlock = this.item?.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)
      ?? this.template.document.getFlag(MODULE_ID, FLAGS.WALLS_BLOCK)
      ?? getSetting(SETTINGS.DEFAULTS[this.t])
      ?? SETTINGS.DEFAULTS.CHOICES.UNWALLED;

    if ( wallsBlock === LABELS.GLOBAL_DEFAULT ) wallsBlock = getSetting(SETTINGS.DEFAULTS[this.t]);
    return wallsBlock;
  }

  /** @type {boolean} */
  get doWallsBlock() { return this.wallsBlockCode !== SETTINGS.DEFAULTS.CHOICES.UNWALLED; }

  /** @type {SETTINGS.DEFAULT_WALL_RESTRICTIONS} */
  get wallRestriction() {
    let wallRestriction = this.item?.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION)
      ?? this.template.document.getFlag(MODULE_ID, FLAGS.WALL_RESTRICTION)
      ?? getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[this.t])
      ?? SETTINGS.DEFAULT_WALL_RESTRICTIONS.CHOICES.MOVE;

    if ( wallRestriction === LABELS.GLOBAL_DEFAULT ) {
      wallRestriction = getSetting(SETTINGS.DEFAULT_WALL_RESTRICTIONS[this.t]);
    }

    return wallRestriction;
  }

  /**
   * Fetch the item for a given template, which may be system-dependent.
   * @type {object|undefined}
   */
  get item() {
    let item = this.template.item;
    if ( game.system.id === "dnd5e" && !item ) {
      const uuid = this.template.document.getFlag("dnd5e", "origin");
      if ( origin ) {
        const leaves = game.documentIndex.uuids[uuid]?.leaves;
        if ( leaves ) item = leaves.find(leaf => leaf.uuid === uuid)?.entry;
      }
    }
    return item;
  }

  /**
   * Should recursion be used, given these settings?
   * @type {booleans}
   */
  get doRecursion() {
    const numRecursions = CONFIG[MODULE_ID].recursions[this.t] ?? 0;
    return this.wallsBlockCode === SETTINGS.DEFAULTS.CHOICES.RECURSE
      && this.options.level < numRecursions;
  }

  /**
   * Compute the shape to be used for this template.
   * Output depends on the specific template settings.
   * @returns {PIXI.Polygon|PIXI.Circle|PIXI.Rectangle}
   */
  computeShape() {
    if ( !this.doWallsBlock ) return this.originalShape;
    const poly = this.computeSweepPolygon();

    if ( !poly || isNaN(poly.points[0]) ) {
      console.error("_computeShapeMeasuredTemplate poly is broken.");
      return this.originalShape;
    }

    // Set values that may be used by other modules
    poly.x ??= this.originalShape.x;
    poly.y ??= this.originalShape.y;
    poly.radius ??= this.originalShape.radius;
    return poly;
  }

  /**
   * Compute the shape for this polygon with walls blocking.
   * This may be recursively applied depending on template settings.
   * @returns {PIXI.Polygon}
   */
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

  /**
   * Run a clockwise sweep for this template.
   * @param {Wall} [lightWall]    Wall used when using the LightWall class
   * @returns {ClockwiseSweepShape|LightWallSweep}
   */
  computeSweep() {
    const cfg = {
      debug: debugPolygons(),
      type: this.wallRestriction,
      source: this,
      boundaryShapes: this.translatedBoundaryShapes,
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
   * Get the bounding box for this shape.
   * @returns {PIXI.Rectangle}
   */
  getBounds() {
    const shapes = this.translatedBoundaryShapes;
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
    this.translatedBoundaryShapes.forEach(s => Draw.shape(s, { color, fill, fillAlpha }));
  }
}
