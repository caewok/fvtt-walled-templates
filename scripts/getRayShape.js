/* globals
canvas,
CONST,
game
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";
import { WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweepPolygon.js";
import { shiftPolygon } from "./utility.js";


/**
 * @param {number} direction  Direction in radians
 * @param {number} distance   Diagonal length of the rectangle.
 * @param {number} width      How wide the ray is 
 *                            (distance in the narrow direction from origin)
 * @return {PIXI.Polygon}
 */
export function walledTemplateGetRayShape(wrapped, direction, distance, width) {
  // origin is this.data.x, this.data.y
  // direction a line from origin defining the diagonal
  //   0: due east; 180: due west
  // So if you have direction, moving direction will get you the end of the ray
  const origin = { x: this.data.x, y: this.data.y };
  
  log(`getRayShape origin ${origin.x}, ${origin.y} with distance ${distance},  direction ${direction}, width ${width}`, this);
  
  const orig_poly = wrapped(direction, distance, width);
  if(!this.document.getFlag(MODULE_ID, "enabled")) return orig_poly;
  if(!canvas.walls.quadtree) return orig_poly; // avoid error when first loading
  
  // shift the polygon to the actual origin
  shiftPolygon(orig_poly, { x: -origin.x, y: -origin.y });
  
  // Use limited angle to form the rectangle.
  const cfg = {
    debug: game.modules.get(MODULE_ID).api.drawPolygons, //false,
    density: 60,
    radius: width + distance, // make sure added walls are not trimmed; could be less but this is simpler
    rotation: Math.toDegrees(direction) - 90,
    angle: 180,
    type: "light",
  }

  // for the polygon, point:
  // 0, 1: right of the origin,   
  // 2, 3: left of the origin,
  // 4, 5: far left of origin,
  // 6, 7: far right of origin,
  // 8, 9: same as 0, 1
  
  // so 0, 1 and 2, 3 are on the limited angle
  // draw walls for the three sides of the rectangle, ensuring the two walls 
  // cross the limited ray forming the fourth wall
  
  const pts = orig_poly.points;
  cfg.tmpWalls = [
    // right of origin
    { A: { x: pts[0] - Math.sign(this.ray.dx)*10, 
           y: pts[1] - Math.sign(this.ray.dx)*10 },
      B: { x: pts[6], y: pts[7] },
      light: CONST.WALL_SENSE_TYPES.NORMAL },
    
    // left of origin
    { A: { x: pts[2] - Math.sign(this.ray.dx)*10, 
           y: pts[3] - Math.sign(this.ray.dx)*10 },
      B: { x: pts[4], y: pts[5] },
      light: CONST.WALL_SENSE_TYPES.NORMAL },
      
    // far edge of the ray
    { A: { x: pts[4], y: pts[5] },
      B: { x: pts[6], y: pts[7] },
      light: CONST.WALL_SENSE_TYPES.NORMAL },  
  ];
  
 
  const poly = new WalledTemplatesClockwiseSweepPolygon();  
  poly.initialize(origin, cfg);    
  poly.compute();
  
  log(`getRayShape poly for origin ${origin.x}, ${origin.y} with distance ${distance},  direction ${direction}`, poly);

  // need to shift the polygon to have 0,0 origin because of how the MeasuredTemplate 
  // sets the origin for the drawing separately
  // Polygon points, annoyingly, are array [x0, y0, x1, y1, ...]
  return shiftPolygon(poly, this.data);
  
  //return new PIXI.Polygon(poly.points);
}


