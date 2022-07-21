/* globals
canvas,
PIXI,
game,
CONST
*/
"use strict";

import { getSetting, SETTINGS } from "./settings.js";
import { log } from "./util.js";
import { Hexagon } from "./shapes/Hexagon.js";

/**
 * Wrap MeasuredTemplate.prototype.draw to target tokens after drawing.
 */
export function walledTemplatesMeasuredTemplateRefresh(wrapped, { redraw = false, retarget = false } = {}) {

  retarget ||= redraw; // Re-drawing requires re-targeting.

  log(`walledTemplatesMeasuredTemplateRefresh ${this.id} redraw ${redraw} retarget ${retarget}`);
  const new_cache = this.document.toJSON();
  const use_cache = this._template_props_cache && this._template_props_cache === new_cache;

  if ( redraw || !use_cache ) {
    log("redrawing template");
    wrapped();

    // Necessary when the borders change
    Object.hasOwn(canvas.grid.highlightLayers, `Template.${this.id}`) && this.highlightGrid(); // eslint-disable-line no-unused-expressions

    retarget = true;

  } else {
    log("Using cached template data.");
//     this._refreshTemplate();
//     this.highlightGrid();

    // Update the HUD
    this._refreshControlIcon;
    this._refreshRulerText();
  }

  retarget && getSetting(SETTINGS.AUTOTARGET.ENABLED) && this.autotargetToken(); // eslint-disable-line no-unused-expressions
  this._template_props_cache = this.document.toJSON();

  return this;
}

export function autotargetToken({ only_visible = false } = {}) {
  log("autotargetToken", this);

  const targets = canvas.tokens.placeables.filter(token => {
    if ( only_visible && !token.visible ) { return false; }
    const tBounds = tokenBounds(token);
    return this.boundsOverlap(tBounds);
  });

  log(`autotargetToken|${targets.length} targets.`);
  releaseAndAcquireTargets(targets);
}

/**
 * For a given bounds shape, determine if it overlaps the template according to
 * provided settings. Will translate the bounds to template origin.
 * @param {PIXI.Rectangle|Hexagon}  bounds    Boundary shape, with true position on grid.
 * @return {Boolean}
 */
export function boundsOverlap(bounds) {
  const tBounds = bounds.translate(-this.data.x, -this.data.y);

  if ( getSetting(SETTINGS.AUTOTARGET.METHOD) === SETTINGS.AUTOTARGET.METHODS.CENTER ) {
    return this.shape.contains(tBounds.center.x, tBounds.center.y);
  }

  // Using SETTINGS.AUTOTARGET.METHODS.OVERLAP
  if ( !tBounds.overlaps(this.shape) ) { return false; }

  const area_percentage = getSetting(SETTINGS.AUTOTARGET.AREA);
  if ( !area_percentage ) { return true; }

  // Calculate the area of overlap by constructing the intersecting polygon between the
  // bounds and the template shape.
  const poly = boundsShapeIntersection(tBounds, this.shape);
  if ( !poly || poly.points.length < 3 ) return false;
  const b_area = bounds.area();
  const p_area = poly.area();
  const target_area = b_area * area_percentage;

  return p_area > target_area || p_area.almostEqual(target_area); // Ensure targeting works at 0% and 100%
}

/**
 * Return the intersection of the bounds shape with the template shape.
 * Bounds shape should already be translated to the template {0, 0} origin.
 * @param {PIXI.Rectangle|Hexagon}           tBounds
 * @param {PIXI.Polygon
          |PIXI.Circle
          |PIXI.Rectangle}  shape
 * @return {PIXI.Polygon}
 */
function boundsShapeIntersection(tBounds, shape) {
//   log("boundsShapeIntersection", tBounds, shape);

  if ( tBounds instanceof PIXI.Rectangle ) {
    if ( shape instanceof PIXI.Polygon ) return shape.intersectRectangle(tBounds);
    if ( shape instanceof PIXI.Circle ) return tBounds.toPolygon().intersectCircle(shape);
    if ( shape instanceof PIXI.Rectangle ) return tBounds.intersection(shape).toPolygon(); // Intersection of two PIXI.Rectangles returns PIXI.Rectangle
  }

  if ( tBounds instanceof Hexagon ) {
    tPoly = tBounds.toPolygon();
    if ( shape instanceof PIXI.Polygon ) return shape.intersectPolygon(tPoly);
    if ( shape instanceof PIXI.Circle ) return tPoly.intersectCircle(shape);
    if ( shape instanceof PIXI.Rectangle ) return tPoly.intersectRectangle(shape); // Intersection of two PIXI.Rectangles returns PIXI.Rectangle
  }

  console.warn("tokenOverlapsShape|shape not recognized.", shape);
  return new PIXI.Polygon(); // Null polygon b/c we expect a polygon on return
}

/**
 * Given an array of target tokens, release all other targets for the user and target
 * these.
 * @param {Token[]} targets
 */
function releaseAndAcquireTargets(targets) {
  // Closely follows TokenLayer.prototype.targetObjects
  const user = game.user;

  // Release other targets
  for ( let t of user.targets ) {
    if ( !targets.includes(t) ) {
      log(`Un-targeting token ${t.id}`, t);
      // When switching to a new scene, Foundry will sometimes try to setTarget using
      // token.position, but token.position throws an error. Maybe canvas not loaded?
      try {
        t.setTarget(false, { releaseOthers: false, groupSelection: true });
      } catch(error) {
        log(error); // Just log it b/c probably not (easily) fixable
      }
    }
  }

  // Acquire targets for those not yet targeted
  targets.forEach(t => {
    if ( !user.targets.has(t) ) {
      log(`Targeting token ${t.id}`, t);
      // When switching to a new scene, Foundry will sometimes try to setTarget using
      // token.position, but token.position throws an error. Maybe canvas not loaded?
      try {
        t.setTarget(true, { releaseOthers: false, groupSelection: true });
      } catch(error) {
        log(error); // Just log it b/c probably not (easily) fixable
      }
    }
  });

  // Broadcast the target change
  user.broadcastActivity({ targets: user.targets.ids });
}

/**
 * Return either a square- or hexagon-shaped hit area object based on grid type
 * @param {Token} token
 * @return {PIXI.Rectangle|Hexagon}
 */
function tokenBounds(token) {
  if ( canvas.scene.data.gridType === CONST.GRID_TYPES.GRIDLESS
    || canvas.scene.data.gridType === CONST.GRID_TYPES.SQUARE ) {
    const w = token.hitArea.width;
    const h = token.hitArea.height;
    return new PIXI.Rectangle(token.center.x - (w / 2), token.center.y - (h /2), w, h);
  }

  return Hexagon.fromToken(token);
}
