/* globals
ClockwiseSweepPolygon,
canvas,
game,
Ray,
CONST
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";
import { WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweepPolygon.js";

export function walledTemplateGetConeShape(wrapped, direction, angle, distance) {
  // origin is this.data.x, this.data.y
  // shape is relative to the origin
  // direction a line from origin through the center of the cone. 
  //   0: due east; 180: due west
  // angle is the angle (width) of the cone. 
  // So if you have direction, moving - angle / 2 along the circle will get you to 
  // 1 point of the cone; + angle / 2 will get the other point of the cone.
  
  log(`getConeShape origin ${this.data.x}, ${this.data.y} with distance ${distance}, angle ${angle}, direction ${direction}`, this);
  
  if(!this.document.getFlag(MODULE_ID, "enabled")) return wrapped(direction, angle, distance);
  if(!canvas.walls.quadtree) return wrapped(direction, angle, distance); // avoid error when first loading
  
  // from original MeasuredTemplate.prototype._getConeShape
  angle = angle || 90;
  const coneType = game.settings.get("core", "coneTemplateType");

  
  // translate direction and angle to what ClockwiseSweep expects for lights
  // or other limited angle
  // lights: emission angle has the same connotation as angle here
  // lights: direction 0 is due south; template is due west.
  
  
  // for a flat cone, would need ClockwiseSweep to add relevant walls
  const cfg = {
    angle: angle,
    debug: true, //false,
    density: 60,
    radius: distance,
    rotation: Math.toDegrees(direction) - 90,
    type: "light"
  }
  
  
  let polyType = ClockwiseSweepPolygon;
  if(coneType !== "round") {
    log(`getConeShape constructing non-round cone.`);
    polyType = WalledTemplatesClockwiseSweepPolygon;
    // add one wall to flatten the cone
    // see MeasuredTemplate.prototype._getConeShape
    distance /= Math.cos(Math.toRadians(angle/2));
    const r1 = Ray.fromAngle(this.data.x, this.data.y, direction + Math.toRadians(angle / -2), distance + 1);
    const r2 = Ray.fromAngle(this.data.x, this.data.y, direction + Math.toRadians(angle / 2), distance + 1);
    
    cfg.radius = distance + 2;
    
    cfg.tmpWalls = [{
      A: r1.B,
      B: r2.B,
      light: CONST.WALL_SENSE_TYPES.NORMAL
    }];
    
    log(`getConeShape A: ${r1.B.x}, ${r1.B.y}; B: ${r2.B.x}, ${r2.B.y}`);
  }
  
  const poly = new polyType();
  poly.initialize({x: this.data.x, y: this.data.y}, cfg);    
  poly.compute();
  

  // need to shift the polygon to have 0,0 origin because of how the MeasuredTemplate 
  // sets the origin for the drawing separately
  // Polygon points, annoyingly, are array [x0, y0, x1, y1, ...]
  const ln = poly.points.length;
  for(let i = 0; i < ln; i += 2) {
    poly.points[i] = poly.points[i] - this.data.x;
    poly.points[i + 1] = poly.points[i + 1] - this.data.y;
  }
  
  //log(`getCircleShape poly points`, poly.points);
  
  return poly;
  //return new PIXI.Polygon(poly.points);
}


