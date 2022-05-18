/* globals
canvas,
PIXI,
game
*/
"use strict";

import { getSetting } from "./settings.js";
import { log } from "./module.js";

/**
 * Wrap MeasuredTemplate.prototype.draw to target tokens after drawing.
 */
export function walledTemplatesMeasuredTemplateDraw(wrapped) {
  log("walledTemplatesMeasuredTemplateDraw");
  const out = wrapped();
  log("walledTemplatesMeasuredTemplateDraw returned from wrap", out);
  switch ( getSetting("autotarget-method") ) {
    case "center": this.autotargetByTokenCenter(); break;
    case "overlap": this.autotargetByTokenOverlap(); break;
    case "collision": this.autotargetByCollision(); break;
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

  const area_percentage = getSetting("autotarget-area");
  if ( area_percentage ) {
    // For each target, calculate the area of overlap by constructing the intersecting
    // polygon between token hit rectangle and the template shape.
    targets = targets.filter(token => {
      const poly = tokenShapeIntersection(token, this.shape, this.data);
      if ( !poly || poly.points.length < 3 ) return false;
      const t_area = token.hitArea.width * token.hitArea.height;
      const p_area = poly.area();
      const target_area = t_area * area_percentage;
      return p_area > target_area || p_area.almostEqual(target_area); // Ensure targeting works at 0% and 100%
    });
  }

  log(`autotargetByTokenOverlap: ${targets.length} targets.`);
  releaseAndAcquireTargets(targets);
}

function releaseAndAcquireTargets(targets) {
  // Closely follows TokenLayer.prototype.targetObjects
  const user = game.user;

  // Release other targets
  for ( let t of user.targets ) {
    if ( !targets.includes(t) ) {
      t.setTarget(false, { releaseOthers: false, groupSelection: true });
    }
  }

  // Acquire targets for those not yet targeted
  targets.forEach(t => {
    if ( !user.targets.has(t) ) {
      t.setTarget(true, { releaseOthers: false, groupSelection: true });
    }
  });

  // Broadcast the target change
  user.broadcastActivity({ targets: user.targets.ids });
}


// TO-DO: Handle hex token shapes
function tokenOverlapsShape(token, shape, origin) {
  log(`tokenOverlapsShape|testing token ${token?.id} at origin ${origin.x},${origin.y}`, token, shape);

  // Use the token hit area, adjusted for the token center.
  const w = token.hitArea.width;
  const h = token.hitArea.height;
  const tRect = new PIXI.Rectangle(token.center.x - (w / 2), token.center.y - (h /2), w, h);

  // Adjust to match template origin 0,0
  tRect.translate(-origin.x, -origin.y);

  let overlaps = false;
  if ( shape instanceof PIXI.Polygon ) {
    for ( const edge of shape.iterateEdges() ) {
      if ( tRect.lineSegmentIntersects(edge.A, edge.B)
        || tRect.containsPoint(edge.A)
        || tRect.containsPoint(edge.B)) {
        overlaps = true;
        break;
      }
    }
  } else if ( shape instanceof PIXI.Circle ) {
    // https://www.geeksforgeeks.org/check-if-any-point-overlaps-the-given-circle-and-rectangle
    // {xn,yn} is the nearest point on the rectangle to the circle center
    const xn = Math.max(tRect.right, Math.min(shape.x, tRect.left));
    const yn = Math.max(tRect.top, Math.min(shape.y, tRect.bottom));

    // Find the distance between the nearest point and the center of the circle
    const dx = xn - shape.x;
    const dy = yn - shape.y;
    overlaps = (Math.pow(dx, 2) + Math.pow(dy, 2)) <= Math.pow(shape.radius, 2);
  } else if ( shape instanceof PIXI.Rectangle ) {
    // https://www.geeksforgeeks.org/find-two-rectangles-overlap
    if ( tRect.top > shape.bottom || shape.top > tRect.bottom ) {
      // One rect is above the other: No overlap
    } else if ( tRect.left > shape.right || shape.left > tRect.right ) {
    // One rect is to the left of the other: No overlap
    } else {
      overlaps = true;
    }
  } else {
    console.warn("tokenOverlapsShape|shape not recognized.", shape);
  }

  return overlaps;
}

// TO-DO: Handle hex token shapes
function tokenShapeIntersection(token, shape, origin) {
  log(`tokenShapeIntersection|testing token ${token?.id} at origin ${origin.x},${origin.y}`, token, shape);

  // Use the token hit area, adjusted for the token center.
  const w = token.hitArea.width;
  const h = token.hitArea.height;
  const tRect = new PIXI.Rectangle(token.center.x - (w / 2), token.center.y - (h /2), w, h);

  // Adjust to match template origin 0,0
  tRect.translate(-origin.x, -origin.y);

  // Token always a rectangle. Shape could be rectangle, circle, or polygon
  if ( shape instanceof PIXI.Polygon ) {
    return shape.intersectPolygon(tRect.toPolygon());

  } else if ( shape instanceof PIXI.Circle ) {
    return shape.intersectPolygon(tRect.toPolygon(), { density: 12 });

  } else if ( shape instanceof PIXI.Rectangle ) {
    return tRect.rectangleIntersection(shape);

  } else {
    console.warn("tokenOverlapsShape|shape not recognized.", shape);
  }
}
