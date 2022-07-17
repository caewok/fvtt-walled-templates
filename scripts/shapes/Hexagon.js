/* globals
PIXI

*/
"use strict";

import { hasIntersectionBruteRedBlack } from "../util.js";

/**
 * Hexagon class structured similarly to PIXI.Rectangle or PIXI.Circle
 * - x, y center
 * - width and height if rotation is 0
 * Foundry grid types:
 * • Hexagonal rows - odd: height is longer than width, points at N and S.
 * • Hexagonal rows - even: Same as odd, just shifted right/left
 * • Hexagonal columns - odd: height is smaller than width, points at W and E
 * • Hexagonal columns - even: Same as odd, just shifted up/down (or left/right)
 */
export class Hexagon {
  /**
   * Default representation is a column hexagon, with points at W and E.
   * Width is larger than height.
   * If height is larger, polygon will be rotated accordingly and width/height swapped.
   *
   * @param {Number}  x         Center of hexagon
   * @param {Number}  y         Center of hexagon
   * @param {Number}  radius    Radius of the circle that contains the hexagon (circumradius).
   * Optional:
   * @param {Number}  rotation  Amount in degrees hexagon is rotated.
   */
  constructor(x, y, radius, { rotation = 0 } = {}) {
    this.x = x;
    this.y = y;
    this.rotation = Math.normalizeDegrees(rotation);
    this.radius = radius;
  }

  /**
   * Get the center point for the hexagon, which is just x,y
   */
  get center() { return new PIXI.Point(this.x, this.y); }

  /**
   * Construct either a column or a row hexagon given width and (optionally) height.
   * If height is greater than width, a row hexagon will be returned; otherwise column.
   * @param {Number}  x         Center of hexagon
   * @param {Number}  y         Center of hexagon
   * @param {Number}  width     Distance from left to right, through center.
   * @param {Number}  height    Distance from top to bottom, through center.
   * @return {Hexagon}
   */
  static fromDimensions(x, y, width, height = null) {
    const radius = Math.max(width, height) / 2;
    const rotation = height > width ? 90 : 0;
    return new this(x, y, radius, { rotation });
  }

  /**
   * Construct a hexagon from a token's hitArea.
   * @param {Token} token
   * @return {Hexagon}
   */
  static fromToken(token) {
    return this.fromDimensions(
      token.center.x,
      token.center.y,
      token.hitArea.width, // Token.hitArea has x,y of 0,0
      token.hitArea.height);
  }

  /**
   * Area of the hexagon
   * Not a getter so it matches Polygon and b/c the calculation is a bit more involved.
   * @return {Number}
   */
  area() {
    // https://en.wikipedia.org/wiki/Hexagon
    // A = (3√3 / 2) * R^2, where R = circumradius
    return 1.5 * Math.sqrt(3) * Math.pow(this.radius, 2);
  }

  /**
   * Maximum diameter of the hexagon
   * @type {Number}
   */
  get maxDiameter() { return this.radius * 2; }

  /**
   * Minimal diameter of the hexagon
   * For column hexagon, this is height.
   * For row hexagon, this is width.
   * @type {Number}
   */
  get minDiameter() {
    // https://en.wikipedia.org/wiki/Hexagon
    // d = √3 / 2 * D, where D = maxDiameter
    return Math.sqrt(3) * this.radius;
  }

  /**
   * Get the bounding box for this hexagon
   * @return {PIXI.Rectangle}
   */
  getBounds() {
    if ( this.rotation === 0 || this.rotation === 180 ) {
      // Points are W/E
      const maxR = this.radius;
      const minD = this.minDiameter;
      const minR = minD / 2;
      // Rectangle measured from top left corner. x, y, width, height
      return new PIXI.Rectangle(this.x - maxR, this.y - minR, maxR * 2, minD);
    } else if ( this.rotation === 90 || this.rotation === 270 ) {
      // Points are N/S
      const maxR = this.radius;
      const minD = this.minDiameter;
      const minR = minD / 2;
      // Rectangle measured from top left corner. x, y, width, height
      return new PIXI.Rectangle(this.x - minR, this.y - maxR, minD, maxR * 2);
    }
    // Default to the bounding box of the radius circle
    return new PIXI.Rectangle(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
  }

  /**
   * Translate the hexagon, shifting it in the x and y direction.
   * (Basic but useful b/c it is equivalent to polygon.translate)
   * @param {Number} delta_x  Movement in the x direction.
   * @param {Number} delta_y  Movement in the y direction.
   * @return {Hexagon}  New hexagon object
   */
  translate(dx, dy) {
    return new this.constructor(this.x + dx, this.y + dy, this.radius, { rotation: this.rotation });
  }

  /**
   * Checks whether the x and y coordinates given are contained within this hexagon.
   * @param {Number} x
   * @param {Number} y
   * @return {Boolean}
   */
  contains(x, y) {
    // Check bounding box first b/c it can deal with easy cases.
    if ( !this.getBounds().containsPoint({x, y}) ) { return false; }

    // Check the polygon
    return this.toPolygon().contains(x, y);
  }

  containsPoint(p) {
    // Check bounding box first b/c it can deal with easy cases.
    if ( !this.getBounds().containsPoint(p) ) { return false; }

    // Check the polygon
    return this.toPolygon().contains(p.x, p.y);
  }

  /**
   * Convert to a polygon
   * @return {PIXI.Polygon}
   */
  toPolygon() {
    return new PIXI.Polygon(this.points());
  }

  /**
   * Intersect with a polygon by using the clipper library.
   */
  intersectPolygon(poly) {
    return this.toPolygon().intersectPolygon(poly);
  }

  /**
   * Get the hexagon's vertices ({x, y} points) in order.
   * If the polygon is closed and close is false,
   * the last two points (which should equal the first two points) will be dropped.
   * Otherwise, all points will be returned regardless of the close value.
   * @return {x, y} PIXI.Point
   */
  points() {
    const angles = [0, 60, 120, 180, 240, 300];
    const origin = { x: this.x, y: this.y };
    return geometricShapePoints(angles, origin, this.radius, this.rotation);
  }

  /**
   * Determine if a line segment intersects the hexagon.
   * @param {Point} a
   * @param {Point} b
   */
  lineSegmentIntersects(A, B) {
    // Check bbox first
    if ( !this.getBounds().lineSegmentIntersects(A, B) ) { return false; }

    // Check all edges
    const hexPoly = this.toPolygon();
    return hasIntersectionBruteRedBlack([...hexPoly.iterateEdges()], { A, B });
  }

  /**
   * Test if this hexagon overlaps a polygon
   * @param {PIXI.Polygon} poly
   * @return {Boolean}
   */
  overlapsPolygon(poly) {
    // Test the bbox first b/c it is easy
    const hex_bbox = this.getBounds();
    const poly_bbox = poly.getBounds();
    if ( !hex_bbox.overlapsRectangle(poly_bbox) ) return false;

    for ( const pt of this.points() ) {
      if ( poly.contains(pt.x, pt.y) ) { return true; }
    }

    // Otherwise, if the hexagon either contains a polygon vertex or
    // intersects the polygon vertex, then it must overlap.
    for ( const edge of poly.iterateEdges() ) {
      if ( this.lineSegmentIntersects(edge.A, edge.B)
        || this.containsPoint(edge.A)
        || this.containsPoint(edge.B) ) { return true; }
    }

    return false;
  }

  /**
   * Test if this hexagon overlaps a circle
   * @param {PIXI.Circle} circle
   * @return {Boolean}
   */
  overlapsCircle(circle) {
    // If the centers are not within radius of one another, no overlap possible
    const total_radius = this.radius + circle.radius;
    const r2 = Math.pow(total_radius, 2);
    const d2 = distanceSquared(this.x, this.y, circle.x, circle.y);
    if ( d2 > r2 ) { return false; }

    // If within the short hex diameter, overlap is true
    const min_radius = this.minDiameter / 2;
    const min_r2 = Math.pow(min_radius, 2);
    if ( d2 < min_r2 ) { return true; }

    // Fall back on testing against a poly version of a circle
    return this.overlapsPolygon(circle.toPolygon({ density: 12 }));
  }

  /**
   * Test if this hexagon overlaps a rectangle
   * @param {PIXI.Rectangle} rect
   * @return {Boolean}
   */
  overlapsRectangle(rect) {
    const hex_bbox = this.getBounds();
    if ( !hex_bbox.overlapsRectangle(rect) ) return false;

    // Fall back on testing a polygon
    return this.overlapsPolygon(rect.toPolygon());
  }
}

function distanceSquared(x1, y1, x2, y2) { return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2); }

/**
 * Build a geometric shape given a set of angles.
 * @param {Number[]} angles      Array of angles indicating vertex positions.
 * @param {Point}    origin      Center of the shape.
 * @param {Number}   radius      Distance from origin to each vertex.
 * @param {Number}   rotation    Angle in degrees describing rotation from due east.
 * @return {Points[]} Array of vertices.
 */
function geometricShapePoints(angles, origin, radius, rotation = 0) {
  const a_translated = angles.map(a => Math.normalizeRadians(Math.toRadians(a + rotation)));
  return a_translated.map(a => pointFromAngle(origin, a, radius));
}

/**
 * Same as Ray.fromAngle but returns a point instead of constructing the full Ray.
 * @param {Point}   origin    Starting point.
 * @param {Number}  radians   Angle to move from the starting point.
 * @param {Number}  distance  Distance to travel from the starting point.
 * @return {Point}  Coordinates of point that lies distance away from origin along angle.
 */
function pointFromAngle(origin, radians, distance) {
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  return { x: origin.x + (dx * distance), y: origin.y + (dy * distance) };
}
