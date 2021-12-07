/* globals
*/

'use strict';

export function shiftPolygon(poly, origin) {
  const ln = poly.points.length;
  for(let i = 0; i < ln; i += 2) {
    poly.points[i] = poly.points[i] - origin.x;
    poly.points[i + 1] = poly.points[i + 1] - origin.y;
  }
  return poly;
}
