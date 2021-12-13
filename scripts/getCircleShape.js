/* globals
ClockwiseSweepPolygon,
canvas,
game
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";
import { shiftPolygon } from "./utility.js";
import { debugPolygons, getSetting } from "./settings.js";

export function walledTemplateGetCircleShape(wrapped, distance) {
  // origin is this.data.x, this.data.y
  // shape is relative to the origin
  
  log(`getCircleShape origin ${this.data.x}, ${this.data.y} with distance ${distance}`, this);
  
  // if no flag is present, go with the world default
  let enabled = this.document.getFlag(MODULE_ID, "enabled");
  log(`getCircleShape enabled is ${enabled}`);
  
  if(typeof enabled === "undefined") {
    enabled = getSetting("default-to-walled");
  }
  
  if(!enabled) return wrapped(distance);
  if(!canvas.walls.quadtree) return wrapped(distance); // avoid error when first loading
  
  log(`creating walled circle shape`)
  
 //  const circle = wrapped(distance);
  //   return circle;
  // get a polygon from the canvas
  const poly = new ClockwiseSweepPolygon();
  poly.initialize({x: this.data.x, y: this.data.y}, { 
    angle: 360,
    debug: debugPolygons(),
    density: 60,
    radius: distance,
    rotation: 0,
    type: "light",
    shape: "circle" // avoid padding checks in clockwise sweep by setting non-circular
  });
    
  poly.compute();
  

  // need to shift the polygon to have 0,0 origin because of how the MeasuredTemplate 
  // sets the origin for the drawing separately
  // Polygon points, annoyingly, are array [x0, y0, x1, y1, ...]
  return shiftPolygon(poly, this.data);
  
  //return new PIXI.Polygon(poly.points);
}


