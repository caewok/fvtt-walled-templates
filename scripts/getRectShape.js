/* globals
canvas,
CONST
*/

'use strict';

import { MODULE_ID } from "./const.js";
import { log } from "./module.js";
import { WalledTemplatesClockwiseSweepPolygon } from "./ClockwiseSweepPolygon.js";
import { shiftPolygon, pointsAlmostEqual } from "./utility.js";


/**
 * @param {number} direction  Direction in radians
 * @param {number} distance   Diagonal length of the rectangle.
 * @return {PIXI.Polygon}
 */
export function walledTemplateGetRectShape(wrapped, direction, distance) {
  // origin is this.data.x, this.data.y
  // direction a line from origin defining the diagonal
  //   0: due east; 180: due west
  // So if you have direction, moving direction will get you the far origin corner
  const origin = { x: this.data.x, y: this.data.y };
  
  log(`getRectShape origin ${origin.x}, ${origin.y} with distance ${distance},  direction ${direction}`, this);
  
  const orig_rect = wrapped(direction, distance);
  if(!this.document.getFlag(MODULE_ID, "enabled")) return orig_rect;
  if(!canvas.walls.quadtree) return orig_rect; // avoid error when first loading
  
  // catch and avoid edge cases where the rectangle is flat / 1-dimensional
  if(direction.almostEqual(0) || 
     direction.almostEqual(Math.PI) || 
     direction.almostEqual(Math.PI / 2) ||
     direction.almostEqual(Math.PI / 2 * 3)) return orig_rect;


  // Use limited angle to get the rectangle.
  // origin is data.x, data.y
  // emission angle is always 90º b/c it is a rectangle
  // need to calculate the rotation angle so that the min and max limited rays line up
  // with the rectangle.
  // lights: direction 0 is due south; template is due west.

  // shift the original rectangle to the current origin
  orig_rect.x = orig_rect.x + origin.x;
  orig_rect.y = orig_rect.y + origin.y;
  
  // get the four corner points of the rectangle and figure out which is the origin
  const pts = orig_rect.points;
  log(`getRectShape rectangle points are: \ntopLeft ${pts.topLeft.x}, ${pts.topLeft.y}\ntopRight ${pts.topRight.x}, ${pts.topRight.y} \nbottomLeft ${pts.bottomLeft.x}, ${pts.bottomLeft.y} \nbottomRight ${pts.bottomRight.x}, ${pts.bottomRight.y}`, orig_rect);
  
  const diag_dist = Math.hypot(orig_rect.width, orig_rect.height);
  
  const cfg = {
    debug: true, //false,
    density: 60,
    radius: diag_dist + 2, // make sure added walls are not trimmed
//     rotation: rotation,
    angle: 90,
    type: "light",
  }
  
  // depending on how the rectangle is oriented, we have a different manipulation to make
  let diag;
  if(pointsAlmostEqual(origin, pts.topLeft)) {
    // origin at top left; rectangle goes down and to the right
    cfg.rotation = 315;
    diag = pts.bottomRight;
    
  } else if(pointsAlmostEqual(origin, pts.topRight)) {
    // origin at top right; rectangle goes down and to the left
    cfg.rotation = 45;
    diag = pts.bottomLeft;
  
  } else if(pointsAlmostEqual(origin, pts.bottomRight)) {
    // origin is at the bottom right; rectangle goes up and to the left
    cfg.rotation = 135;
    diag = pts.topLeft;
    
  } else {
    // origin is at bottom left; rectangle goes up and to the right
    cfg.rotation = 225;
    diag = pts.topRight;
  }
    
  // need two walls, each intersecting the limited rays (vertical and horizontal) 
  // and meeting at the diagonal point opposite the origin 
  // Make the walls longer so they definitely cross the limited rays
  const dx = diag.x - origin.x;
  const dy = diag.y - origin.y;
  const pt1 = { x: origin.x - Math.sign(dx)*5, y: diag.y };
  const pt2 = { x: diag.x, y: origin.y - Math.sign(dy)*5 };
  
  cfg.tmpWalls = [
    { A: pt1,
      B: diag,
      light: CONST.WALL_SENSE_TYPES.NORMAL },
    
    { A: pt2,
      B: diag,
      light: CONST.WALL_SENSE_TYPES.NORMAL },
  ];
 
  const poly = new WalledTemplatesClockwiseSweepPolygon();  
  poly.initialize(origin, cfg);    
  poly.compute();
  
  log(`getRectShape poly for origin ${origin.x}, ${origin.y} with distance ${distance},  direction ${direction}`, poly);

  // need to shift the polygon to have 0,0 origin because of how the MeasuredTemplate 
  // sets the origin for the drawing separately
  // Polygon points, annoyingly, are array [x0, y0, x1, y1, ...]
  return shiftPolygon(poly, this.data);
  
  //return new PIXI.Polygon(poly.points);
}


