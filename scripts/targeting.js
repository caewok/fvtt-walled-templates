/* globals
canvas,
Ray,
ClockwiseSweepPolygon,
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

  log(`autotargetByTokenOverlap: ${targets.length} targets.`);
  releaseAndAcquireTargets(targets);
}

/**
 * Target token based on whether there is a collision between any corner of the token
 * and the origin of the template shape.
 * Whether target token is within the template is determined mathematically based
 * on shape type.
 */
export function autotargetByCollision({ type = "move", only_visible = false } = {}) {
  // Locate the set of tokens to target
  // Any overlap with the template counts.
  // Refine set of targets by collision ray
  let targets = canvas.tokens.placeables.filter(token => {
    if ( only_visible && !token.visible ) { return false; }
    const tRect = token._boundsRect;
    const corners = [
      { x: tRect.left, y: tRect.top },
      { x: tRect.right, y: tRect.top },
      { x: tRect.right, y: tRect.bottom },
      { x: tRect.left, y: tRect.bottom }
    ];

    for ( let i = 0; i < 4; i += 1 ) {
      const r = new Ray(this.data, corners[i]);
      if ( ClockwiseSweepPolygon.getRayCollisions(r, { type, mode: "any" }) ) {
        return false;
      }
    }

    return true;
  });

  log(`autotargetByCollision: ${targets.length} targets.`);
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

