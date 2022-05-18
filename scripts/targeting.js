import { getSetting } from "./settings.js";
import { log } from "./module.js";

/**
 * Wrap MeasuredTemplate.prototype.draw to target tokens after drawing.
 */
export function walledTemplatesMeasuredTemplateDraw(wrapped) {
  log("walledTemplatesMeasuredTemplateDraw");
  const out = wrapped();
  log("walledTemplatesMeasuredTemplateDraw returned from wrap", out);
  if(getSetting("auto-target-method") === "center") {
    this.autotargetByTokenCenter();
  }
  return out;
}

/**
 * Target tokens based on whether the token center point is within the template shape.
 * Assumes this function is a method added to MeasuredTemplate class.
 */
export function autotargetByTokenCenter() {
  // Closely follows TokenLayer.prototype.targetObjects
  const user = game.user;


  // Locate the set of tokens to target
  const targets = canvas.tokens.placeables.filter(obj => {
    if ( !obj.visible ) { return false; }

    // translate the point to 0,0 to compare to the template
    // (could translate the shape but would have to move it back; this likely faster for polygons)
    return this.shape.contains(obj.center.x - this.data.x, obj.center.y - this.data.y);
  });

  log(`autotargetByTokenCenter: ${targets.length} targets.`);


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

/**
 * Target token based on whether there is a direct line between the origin
 * and the token, and any part of the token is within the template shape.
 */
function autotargetByCollision() {
  // Closely follows TokenLayer.prototype.targetObjects
  const user = game.user;

  // Locate the set of tokens to target
  const targets = this.placeables.filter(obj => {
    if ( !obj.visible ) { return false; }
    return this.shape.contains(obj.center.x, obj.center.y);
  });
}

/**
 * Token edges based on hit area.
 * Use hex or square accordingly
 */
function tokenEdges(token) {

}

function tokenIntersectsShape() {


}

function tokenIntersectsCircle() {


}