/* globals
canvas,
CONST
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";
import { WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweepPolygon.js";
import { shiftPolygon } from "./utility.js";


export function walledTemplateGetRectShape(wrapped, direction, distance) {
  // origin is this.data.x, this.data.y
  // shape is relative to the origin
  // direction a line from origin through the center of the cone. 
  //   0: due east; 180: due west
  // angle is the angle (width) of the cone. 
  // So if you have direction, moving - angle / 2 along the circle will get you to 
  // 1 point of the cone; + angle / 2 will get the other point of the cone.
  
  log(`getRectShape origin ${this.data.x}, ${this.data.y} with distance ${distance},  direction ${direction}`, this);
  
  // use the default Foundry version to get the original shape
  const orig_rect = wrapped(direction, distance);
  
  if(!this.document.getFlag(MODULE_ID, "enabled")) return orig_rect;
  if(!canvas.walls.quadtree) return orig_rect; // avoid error when first loading
  
  
  // NormalizedRect has height, width, x, y
  // plus bottom, left, right, top getters
  // rectangle is drawn such that origin is top left
  // always aligned to the canvas; no diagonally rotated rectangles
  
  // shift by origin (default version will be at origin 0, 0)
  orig_rect.x = orig_rect.x + this.data.x;
  orig_rect.y = orig_rect.y + this.data.y;
  
  // Pass four walls of the rectangle, but re-center the origin to the center of the 
  // rectangle.
  // For efficiency, can then pass a radius as half the diagonal of the rectangle
  // make sure to add a bit to the radius to avoid trimming the added edges
 
  const pts = orig_rect.points;
  const tmpWalls = [
    // top
    { A: pts.topLeft,
      B: pts.topRight,
      light: CONST.WALL_SENSE_TYPES.NORMAL },  
    
    // right  
    { A: pts.topRight,
      B: pts.bottomRight,
      light: CONST.WALL_SENSE_TYPES.NORMAL },
    
    // bottom
    { A: pts.bottomRight,
      B: pts.bottomLeft,
      light: CONST.WALL_SENSE_TYPES.NORMAL }, 
  
    // left  
    { A: pts.bottomLeft,
      B: pts.topLeft,
      light: CONST.WALL_SENSE_TYPES.NORMAL }]; 
  
  
  // for a flat cone, would need ClockwiseSweep to add relevant walls
  const cfg = {
    debug: true, //false,
    density: 60,
    radius: (Math.hypot(orig_rect.width, orig_rect.height) / 2) + 1,
    rotation: 0,
    type: "light",
    tmpWalls: tmpWalls
  }
  
  const poly = new WalledTemplatesClockwiseSweepPolygon();  
  poly.initialize(orig_rect.centerPoint, cfg);    
  poly.compute();
  

  // need to shift the polygon to have 0,0 origin because of how the MeasuredTemplate 
  // sets the origin for the drawing separately
  // Polygon points, annoyingly, are array [x0, y0, x1, y1, ...]
  return shiftPolygon(poly, this.data);
  
  //return new PIXI.Polygon(poly.points);
}


