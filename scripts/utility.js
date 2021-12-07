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

/**
 * Test if two points are almost equal within some epsilon
 * @param {Point} p0
 * @param {Point} p1
 * @param {number} e Some permitted epsilon, by default 1e-8
 * @return {boolean} Are the points almost equal?
 */
export function pointsAlmostEqual(p0, p1, e = 1e-8) {
  return p0.x.almostEqual(p1.x, e) && p0.y.almostEqual(p1.y, e);
}
