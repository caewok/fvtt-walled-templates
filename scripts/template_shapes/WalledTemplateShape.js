/* globals
canvas,
CONFIG,
game,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID, FLAGS, LABELS, MODULES } from "../const.js";
import { Point3d } from "../geometry/3d/Point3d.js";
import { ClipperPaths } from "../geometry/ClipperPaths.js";
import { Settings, debugPolygons } from "../settings.js";
import { ClockwiseSweepShape } from "../ClockwiseSweepShape.js";
import { LightWallSweep } from "../ClockwiseSweepLightWall.js";

// Debugging
import { Draw } from "../geometry/Draw.js";
import { log } from "../util.js";

/**
 * Class to handle the different template shapes, allowing for subclasses of each shape.
 * A subclass must define its original shape and register its shape and code.
 */
export class WalledTemplateShape {
  /**
   * Register storing different shape codes.
   * Key is the shape code. Typically Foundry defaults: "rect", "circle", "ray", "cone"
   * Others are possible if the template document has some other code set.
   * Value is the shape class.
   * Used in wrap of _computeShape to call the relevant shape.
   */
  static shapeCodeRegister = new Map();

  /** @type {Point3d} */
  origin = new Point3d(0, 0, 0);

  /** @type {number; degrees} */
  get angleDegrees() { return this.template.document.angle; }

  /** @type {number; radians} */
  get angle() { return Math.toRadians(this.angleDegrees); }

  /** @type {number; pixels} */
  get width() { return CONFIG.GeometryLib.utils.gridUnitsToPixels(this.template.document.width); }

  /** @type {number; pixel units} */
  distance = 0;

  /** @type {number; radians} */
  direction = 0; // In MeasuredTemplateDocument, rotation is equivalent to direction.

  /** @type {string} */
  get t() { return this.template.document.t; }

  /**
   * Options used primarily by recursion for reflect and spread algorithms for sub-templates
   * @typedef {object} WalledTemplateOptions
   * @property {Point3d} origin             Center point of the template, in 3 dimensions
   * @property {number; pixels} distance    Radius/length of the template, in pixel units
   * @property {number; radians} direction  Ray direction of the template, in radians
   * @property {number} level               What level of recursion we are on
   * @property {number; pixels} padding     Padding to add to the shape of the template, in pixel units
   */

  /** @type {WalledTemplateOptions} */
  options = {};

  /** @type {ClockwiseSweepShape|LightWallSweep} */
  sweepClass = ClockwiseSweepShape;

  /**
   * @param {MeasuredTemplate} template   The underlying measured template
   * @param {WalledTemplateOptions} [opts]
   */
  constructor(template, { origin, distance, direction, level, padding } = {}) {
    this.template = template;

    // Origin point
    this.origin.copyFrom(origin ?? { x: template.x, y: template.y, z: template.elevationZ });
    this.origin.roundDecimals(); // Avoid annoying issues with precision.

    // Distance
    distance ??= CONFIG.GeometryLib.utils.gridUnitsToPixels(this.template.document.distance);
    this.distance = distance;

    // Direction
    direction ??= Math.toRadians(this.template.document.direction);
    this.direction = direction;

    // Options
    this.options.level = level ??  0; // For recursion, what level of recursion are we at?
    this.options.padding = padding || 0;
  }

  /** @type {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon} */
  get originalShape() {
    if ( this.options.padding ) return this.calculatePaddedShape();
    else return this.calculateOriginalShape();
  }

  get translatedShape() { return this.originalShape.translate(this.origin.x, this.origin.y); }

  /**
   * Translate the boundary shape to the correct origin.
   * This can be represented in subclasses as two or more combined shapes for use in the sweep.
   * Thus an array of shapes is returned.
   * @returns {[PIXI.Circle|PIXI.Rectangle|PIXI.Polygon]}
   */
  get translatedBoundaryShapes() {
    return [this.translatedShape];
  }

  /** @type {Settings.KEYS.DEFAULT_WALLS_BLOCK.CHOICES} */
  get wallsBlockCode() { return this.#getSetting("WALLS_BLOCK"); }

  /** @type {boolean} */
  get doWallsBlock() { return this.wallsBlockCode !== Settings.KEYS.DEFAULT_WALLS_BLOCK.CHOICES.UNWALLED; }

  /** @type {Settings.KEYS.DEFAULT_WALL_RESTRICTION} */
  get wallRestriction() { return this.#getSetting("WALL_RESTRICTION"); }

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
    return this.wallsBlockCode === Settings.KEYS.DEFAULT_WALLS_BLOCK.CHOICES.RECURSE
      && this.options.level < numRecursions;
  }

  /**
   * Calculate the original template shape from base Foundry.
   * Implemented by subclass.
   * @param {object} [opts]     Optional values to temporarily override the ones in this instance.
   * @returns {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon}
   */
  calculateOriginalShape({ distance, angle, direction, width } = {}) { // eslint-disable-line no-unused-vars
    console.error("calculateOriginalShape must be implemented by subclass.");
  }

  /**
   * Keeping the origin in the same place, pad the shape by adding (or subtracting) to it
   * in a border all around it, including the origin (for cones, rays, rectangles).
   * Implemented by subclass.
   * @param {number} [padding]    Optional padding value, if not using the one for this instance.
   * @returns {PIXI.Circle|PIXI.Rectangle|PIXI.Polygon}
   */
  calculatePaddedShape(padding) { // eslint-disable-line no-unused-vars
    console.error("calculateOriginalShape must be implemented by subclass.");
  }

  #getSetting(flagName) {
    const flag = FLAGS[flagName];
    const defaultSetting = Settings.KEYS[`DEFAULT_${flagName}`][this.t];
    const setting = this.item?.getFlag(MODULE_ID, flag)
      ?? this.template.document.getFlag(MODULE_ID, flag)
      ?? Settings.get(defaultSetting);
    if ( setting === LABELS.GLOBAL_DEFAULT ) return this.template.document.getFlag(MODULE_ID, flag);
    return setting;
  }

  /**
   * Compute the shape to be used for this template.
   * Output depends on the specific template settings.
   * @param {boolean} recurse   True if recursion should be done if applicable.
   * @returns {PIXI.Polygon|PIXI.Circle|PIXI.Rectangle}
   */
  computeShape(recurse = true) {
    if ( !this.doWallsBlock ) return this.originalShape;
    const poly = this.computeSweepPolygon(recurse);

    if ( !poly || isNaN(poly.points[0]) ) {
      // Seems to only happen in the top left corner of the canvas
      // or if the origin is on the border such that the entire template is off-canvas.
      if ( this.origin.x && this.origin.y ) log("_computeShapeMeasuredTemplate poly is broken.");
      return this.originalShape;
    }

    // Set origin, which may be used by other modules
    poly.x ??= 0;
    poly.y ??= 0;
    return poly;
  }

  /**
   * Compute the shape for this polygon with walls blocking.
   * This may be recursively applied depending on template settings.
   * @param {boolean} recurse   True if recursion should be done if applicable.
   * @returns {PIXI.Polygon}
   */
  computeSweepPolygon(recurse = true) {
    const sweep = this.computeSweep();
    let shape = sweep;
    let recurseData;
    let polys;

    if ( recurse && this.doRecursion ) {
      const res = this._recurse(sweep, new Map());
      recurseData = res.recurseData;
      polys = res.polys;
      polys.push(sweep);
      const paths = ClipperPaths.fromPolygons(polys);
      const combined = paths.combine();
      combined.clean();
      shape = combined.toPolygons()[0]; // TODO: Can there ever be more than 1?
      if ( !shape ) shape = sweep; // Rare but it is possible due to some obscure bug.
      // TODO: Need to deal with storing the recurse data.
      // if ( this.id ) this.document.setFlag(MODULE_ID, FLAGS.RECURSE_DATA, recurseData);
    }

    // Shift to origin 0,0 as expected for Template shape.
    const poly = shape.translate(-this.origin.x, -this.origin.y);
    poly._sweep = sweep; // For debugging
    poly._shape = shape; // For debugging
    poly._recurseData = recurseData;
    poly.polys = polys;
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
      // boundaryShapes: this.translatedBoundaryShapes.map(shape => shape.toPolygon()), // TODO: Don't map to polygon if rectangle intersection with poly gets fixed.
      lightWall: this.options.lastReflectedEdge // Only used for cones
    };

    // Add in elevation for Wall Height to use
    // Default to treating template as infinite in vertical directions
    // Do this after initialization b/c something is flipping them around. Likely Wall Height.
    let wallHasBottomBelow = Number.POSITIVE_INFINITY;
    let wallHasTopAbove = Number.NEGATIVE_INFINITY;
    // If Levels or Wall-Height modules are active, use the elevation flags set by levels or this module
    let elevation;
    if ( MODULES.LEVELS.ACTIVE ) elevation = this.template.document.getFlag('levels', 'elevation');
    elevation ??=  this.template.elevationE;
    if ( elevation !== undefined ) { wallHasBottomBelow = elevation; wallHasTopAbove = elevation; }
    cfg.source.object ??= {};
    cfg.source.object.b ??= wallHasBottomBelow;
    cfg.source.object.t ??= wallHasTopAbove;

    // Need to also set origin, for reasons.
    this.origin.b = wallHasBottomBelow;
    this.origin.t = wallHasTopAbove;

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
