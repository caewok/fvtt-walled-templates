/* globals
canvas,
PIXI,
game,
CONST
*/
"use strict";

import { getSetting, SETTINGS } from "./settings.js";
import { log } from "./module.js";
import { Hexagon } from "./Hexagon.js";

/**
 * Wrap MeasuredTemplate.prototype.draw to target tokens after drawing.
 */
export function walledTemplatesMeasuredTemplateDraw(wrapped) {
  const out = wrapped();
  if ( !getSetting(SETTINGS.AUTOTARGET.ENABLED) ) { return out; }
  switch ( getSetting(SETTINGS.AUTOTARGET.METHOD) ) {
    case SETTINGS.AUTOTARGET.METHODS.CENTER: this.autotargetByTokenCenter(); break;
    case SETTINGS.AUTOTARGET.METHODS.OVERLAP: this.autotargetByTokenOverlap(); break;
  }

  return out;
}

/**
 * Target tokens based on whether the token center point is within the template shape.
 * Assumes this function is a method added to MeasuredTemplate class.
 */
export function autotargetByTokenCenter({ only_visible = false } = {}) {
  // Locate the set of tokens to target
  const targets = canvas.tokens.placeables.filter(obj => {
    if ( only_visible && !obj.visible ) { return false; }

    // Translate the point to 0,0 to compare to the template
    // (Could translate the shape but would have to move it back; this likely faster for polygons.)
    return this.shape.contains(obj.center.x - this.data.x, obj.center.y - this.data.y);
  });

  log(`autotargetByTokenCenter: ${targets.length} targets.`);
  releaseAndAcquireTargets(targets);
}

/**
 * Target token based on whether any part of the token is within the template shape.
 * @param {String} type   Type of collision to test for in CONST.WALL_RESTRICTION_TYPES
 */
export function autotargetByTokenOverlap({ only_visible = false } = {}) {
  // Locate the set of tokens to target
  // Any overlap with the template counts.
  // Refine set of targets by collision ray
  let targets = canvas.tokens.placeables.filter(token => {
    if ( only_visible && !token.visible ) { return false; }
    return tokenOverlapsShape(token, this.shape, this.data);
  });
  log(`autotargetByTokenOverlap: ${targets.length} targets before area calculation.`);

  const area_percentage = getSetting(SETTINGS.AUTOTARGET.AREA);
  if ( area_percentage ) {
    // For each target, calculate the area of overlap by constructing the intersecting
    // polygon between token hit rectangle and the template shape.
    targets = targets.filter(token => {
      const poly = tokenShapeIntersection(token, this.shape, this.data);
      if ( !poly || poly.points.length < 3 ) return false;
      const t_area = tokenArea(token);
      const p_area = poly.area();
      const target_area = t_area * area_percentage;
      log(`Target area: ${t_area}; Polygon area: ${p_area}.`, poly, token, this);

      return p_area > target_area || p_area.almostEqual(target_area); // Ensure targeting works at 0% and 100%
    });
  }

  log(`autotargetByTokenOverlap: ${targets.length} targets.`);
  releaseAndAcquireTargets(targets);
}

/**
 * Calculate the hit area of a token. Either square or hexagon.
 * @param {Token} token
 * @return {Number}
 */
function tokenArea(token) {
  if ( canvas.scene.data.gridType === CONST.GRID_TYPES.GRIDLESS
    || canvas.scene.data.gridType === CONST.GRID_TYPES.SQUARE) {
    return token.hitArea.width * token.hitArea.height;
  }
  return Hexagon.fromToken(token).area();
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
 * Test whether the token hit area overlaps a given shape.
 * @param {Token}           token
 * @param {PIXI.Polygon
          |PIXI.Circle
          |PIXI.Rectangle}  shape
 * @param {Point}           origin    Origin of the template. Shape is normalized to 0,0.
 * @return {Boolean}
 */
function tokenOverlapsShape(token, shape, origin) {
  log(`tokenOverlapsShape|testing token ${token?.id} at origin ${origin.x},${origin.y}`, token, shape);
  const tBounds = tokenBounds(token);  // Either a rectangle or hexagon representing token bounds
  tBounds.translate(-origin.x, -origin.y); // Adjust to match template origin 0,0

  if ( shape instanceof PIXI.Polygon ) { return tBounds.overlapsPolygon(shape); }
  if ( shape instanceof PIXI.Circle ) { return tBounds.overlapsCircle(shape); }
  if ( shape instanceof PIXI.Rectangle ) { return tBounds.overlapsRectangle(shape); }

  console.warn("tokenOverlapsShape|shape not recognized.", shape);
  return false;
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

/**
 * Return the intersection of the token hit area with a shape.
 * @param {Token}           token
 * @param {PIXI.Polygon
          |PIXI.Circle
          |PIXI.Rectangle}  shape
 * @param {Point}           origin    Origin of the template. Shape is normalized to 0,0.
 * @return {PIXI.Polygon}
 */
function tokenShapeIntersection(token, shape, origin) {
  log(`tokenShapeIntersection|testing token ${token?.id} at origin ${origin.x},${origin.y}`, token, shape);

  const tBounds = tokenBounds(token);
  tBounds.translate(-origin.x, -origin.y);

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
