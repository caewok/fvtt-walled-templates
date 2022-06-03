/* globals
canvas,
PIXI,
game,
CONST
*/
"use strict";

import { getSetting, SETTINGS, MODULE_ID } from "./settings.js";
import { log } from "./module.js";
import { Hexagon } from "./Hexagon.js";


/**
 * Wrap MeasuredTemplate.prototype.draw to target tokens after drawing.
 */
export function walledTemplatesMeasuredTemplateRefresh(wrapped, { redraw = true, retarget = false } = {}) {
  let self = this;

  log(`Initiated MeasuredTemplate.prototype.refresh with current shape ${this.shape}`, self);
//   retarget ||= redraw;
//
//   // Cache the template properties to skip redrawing unless redraw is true
  // get/set flag is problematic as setFlag is async and is causing issues.
  // we may not care about database updates; instead store the cache on the object
  const new_cache = JSON.stringify(Object.entries(self.data));
  log(`old cache\n${this._template_props_cache}\nnew cache\n${new_cache}`);
  const use_cache = self._template_props_cache && self._template_props_cache === new_cache;

  if ( redraw || !use_cache ) {
    log(`Redrawing template`);
    self = wrapped();
    retarget = true;
  } else {
    log(`Keeping old data`);
    self = wrapped();
    // drawTemplateOutline.call(self);
//     drawTemplateHUD.call(self);
  }

  retarget && getSetting(SETTINGS.AUTOTARGET.ENABLED) && self.autotargetToken(); // eslint-disable-line no-unused-expressions

  self._template_props_cache = JSON.stringify(Object.entries(self.data));
  return self;
}

function drawTemplateOutline() {
  // Draw the Template outline
  this.template.clear().lineStyle(this._borderThickness, this.borderColor, 0.75).beginFill(0x000000, 0.0);

  // Fill Color or Texture
  if ( this.texture ) this.template.beginTextureFill({
    texture: this.texture
  });
  else this.template.beginFill(0x000000, 0.0);

  // Draw the shape
  this.template.drawShape(this.shape);

  // Draw origin and destination points
  this.template.lineStyle(this._borderThickness, 0x000000)
    .beginFill(0x000000, 0.5)
    .drawCircle(0, 0, 6)
    .drawCircle(this.ray.dx, this.ray.dy, 6);
}

function drawTemplateHUD() {
  // Update the HUD
  this.hud.icon.visible = this.layer._active;
  this.hud.icon.border.visible = this._hover;
  this._refreshRulerText();
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
  if ( !boundsOverlapShape(tBounds, this.shape) ) { return false; }

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
 * Return either a square or hexagon shape based on grid type.
 * Should be the grid at given p
 * @param {Point} p   Top left corner of the grid square.
 * @return {PIXI.Rectangle|Hexagon}
 */
export function shapeForGridPixels(p) {
  if ( canvas.scene.data.gridType === CONST.GRID_TYPES.GRIDLESS
    || canvas.scene.data.gridType === CONST.GRID_TYPES.SQUARE ) {
    return new PIXI.Rectangle(p.x, p.y, canvas.dimensions.size, canvas.dimensions.size);
  }

  return Hexagon.fromDimensions(
    p.x + canvas.dimensions.size,
    p.y + canvas.dimensions.size,
    canvas.grid.grid.w,
    canvas.grid.grid.h);
}

/**
 * Test whether the bounds shape overlaps a given template shape.
 * Bounds shape should already be translated to the template {0, 0} origin.
 * @param {PIXI.Rectangle|Hexagon}  tBounds
 * @param {PIXI.Polygon
          |PIXI.Circle
          |PIXI.Rectangle}  shape
 * @return {Boolean}
 */
function boundsOverlapShape(tBounds, shape) {
  if ( shape instanceof PIXI.Polygon ) { return tBounds.overlapsPolygon(shape); }
  if ( shape instanceof PIXI.Circle ) { return tBounds.overlapsCircle(shape); }
  if ( shape instanceof PIXI.Rectangle ) { return tBounds.overlapsRectangle(shape); }

  console.warn("tokenOverlapsShape|shape not recognized.", shape);
  return false;
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
  log("boundsShapeIntersection", tBounds, shape);

  if ( shape instanceof PIXI.Polygon ) {
    return shape.intersectPolygon(tBounds.toPolygon());
  }

  if ( shape instanceof PIXI.Circle ) {
    // Intersecting a polygon with a circle is faster than two polygons
    return shape.intersectPolygon(tBounds.toPolygon(), { density: 12});
  }

  if ( shape instanceof PIXI.Rectangle ) {
    // Intersecting rectangles is easier, so do that if possible
    if ( tBounds instanceof PIXI.Rectangle ) {
      return tBounds.intersection(shape).toPolygon(); // Intersection of two PIXI.Rectangles returns PIXI.Rectangle
    }
    return tBounds.toPolygon().intersectPolygon(shape.toPolygon());
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
