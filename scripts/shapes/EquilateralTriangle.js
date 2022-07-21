/* globals
PIXI,
foundry
*/
"use strict";

/* Define a set of Regular Polygon shapes
Each should extend PIXI.Polygon like LimitedAnglePolygon does.
Each is non-changeable; modifications result in new object.
Each are referenced in local space for the contains test:
- local origin 0, 0
- rotation considered after: all oriented up

Each can be intersected quickly using WA
*/

/** Testing **/
tri = new RegularPolygon({x: 1000, y: 1000}, 100);
tri._fixedPoints.forEach(pt => drawPoint(pt))
tri._fixedPoints.forEach(pt => drawPoint(tri.toCartesianCoords(pt)))
drawShape(tri)
drawShape(tri.getBounds())


export class RegularPolygon extends PIXI.Polygon {
  constructor(origin, radius, {numSides = 3, rotation = 0} = {}) {
    super([]);
    this.x = origin.x;
    this.y = origin.y;
    this.numSides = numSides;
    this.radius = radius;
    this.rotation = Math.normalizeDegrees(rotation);

    this._fixedPoints = this.#generateFixedPoints();

    // Placeholders for getters
    this._points = undefined;

    // Polygon properties
    this._isClosed = false;
    this._isClockwise = true;
  }

  get center() { return { x: this.x, y: this.y }; }

  get points() { return this._points || (this._points = this.#generatePoints()); }

  set points(value) { }

  /**
   * Generate the points of the shape in shape-space (before rotation or translation)
   * @return {Points[]}
   */
  #generateFixedPoints() {
    const { numSides, radius } = this;

    const angles = Array.fromRange(numSides).map(i => (360 / numSides) * i);
    const radAngles = angles.map(a => Math.toRadians(a));
    return radAngles.map(angle => pointFromAngle({x: 0, y: 0}, angle, radius));
  }

  /**
   * Generate the points that represent this shape as a polygon in Cartesian space.
   * @return {Points[]}
   */
  #generatePoints() {
    // Faster to use for loop rather than flatten
    const pts = [];
    const { numSides, _fixedPoints: fp } = this;
    for ( let i = 0; i < numSides; i += 1 ) {
      const pt = this.toCartesianCoords(fp[i]);
      pts.push(pt.x, pt.y);
    }
    return pts;
  }

  /**
   * Generate the bounding box (in Cartesian coordinates)
   * @returns {PIXI.Rectangle}
   */
  getBounds() {
    // Default to the bounding box of the radius circle
    const { x, y, radius: r } = this;
    const r2 = r * 2;
    return new PIXI.Rectangle(x - r, y - r, r2, r2);
  }

  /**
   * Shift from cartesian coordinates to the shape space.
   * @param {Point} a
   * @returns {Point}
   */
  fromCartesianCoords(a) { return rotatePoint(translatePoint(a, -this.x, -this.y), -this.rotation); }

  /**
   * Shift to cartesian coordinates from the shape space.
   * @param {Point} a
   * @returns {Point}
   */
  toCartesianCoords(a) { return rotatePoint(translatePoint(a, this.x, this.y), this.rotation); }

  /**
   * Does the triangle contain the point?
   * @param {number} x
   * @param {number} y
   * @returns {boolean} True if point {x,y} is contained within the triangle.
   */
  contains(x, y) {
    const bounds = this.getBounds();
    if ( !bounds.contains(x, y) ) return false;
  }

  /**
   * Convert the shape to a normal polygon
   * @returns {PIXI.Polygon}
   */
  toPolygon() { return new PIXI.Polygon(this.points) }

  /**
   * Get all intersection points for a segment A|B
   * Intersections must be sorted from A to B.
   * @param {Point} a
   * @param {Point} b
   * @returns {Point[]}
   */
  segmentIntersections(a, b) {
    a = this.fromCartesianCoords(a);
    b = this.fromCartesianCoords(b);

    const ixs = [];
    const fp = this._fixedPoints;
    const ln = fp.length;
    for ( let i = 0; i < ln; i += 1 ) {
      const x = foundry.utils.lineSegmentIntersection(fp[i], fp[(i + 1) % ln], a, b);
      if ( x ) ixs.push(x);
    }

    return ixs.map(ix => this.toCartesianCoords(ix));
  }

  /**
   * Get all the points (corners) of the shape between
   * two points on (or nearly on) the shape.
   * Points must be sorted clockwise around the shape.
   * @param {Point} a
   * @param {Point} b
   * @returns {Point[]}
   */
  pointsBetween(a, b) {
    if ( a.x.almostEqual(b.x) && a.y.almostEqual(b.y) ) return [];

    a = this.fromCartesianCoords(a);
    b = this.fromCartesianCoords(b);

    const aSide = this._getSide(a);
    if ( ~aSide ) return []; // A is inside

    const bSide = this._getSide(b);
    if ( ~bSide ) return []; // B is inside

    const pts = [];
    const { numSides, _fixedPoints: fp } = this;

    if ( aSide === bSide ) {
      // Either a is before b moving clockwise (no points)
      // or a is after b moving clockwise (all points)
      if ( foundry.utils.orient2dFast({x: 0, y: 0}, a, b) > 0 ) return [];
      pts.push([0, 1, 2].map(i => fp[(i + aSide + 1) % numSides]));
    } else {
      let currSide = aSide;
      while ( currSide !== bSide ) {
        currSide = (currSide + 1) % numSides;
        pts.push(fp[currSide]);
      }
    }

    return pts.map(pt => this.toCartesianCoords(pt));
  }

  /**
   * Determine on which side a point lies.
   * @param {Point} point  Point, in shape-space
   * @returns {number} 0, 1, or 2 for the side.
   *                   If point is on a corner, returns the next side
   *                   Returns -1 if inside.
   */
  _getSide(point) {
    const numSides = this.numSides;
    for ( let i = 0; i < numSides; i += 1 ) {
      const side = this._checkSide(point, i);
      if ( ~side ) return side;
    }
    return -1;
  }

  /**
   * Determine if a point is on this side
   * @param {Point} point  Point, in shape-space
   * @returns {number} Returns the side number.
   *                   If point is on a corner, returns the next side.
   *                   Returns -1 if not on this side
   */
  _checkSide(point, side) {
    const numSides = this.numSides;
    const fp0 = this._fixedPoints[side];
    const fp1 = this._fixedPoints[(side + 1) % numSides];

    if ( fp1.x.almostEqual(point.x) && fp1.y.almostEqual(point.y) ) return (side + 1) % numSides;

    const orient = foundry.utils.orient2dFast(fp0, fp1, point);
    return orient >= 0 ? side : -1;
  }
}


export class EquilateralTriangle extends PIXI.Polygon {
  constructor(origin, radius, {rotation = 0} = {}) {
    super([]);
    this.x = origin.x;
    this.y = origin.y;
    this.radius = radius;
    this.rotation = Math.normalizeDegrees(rotation);

    // Basic calculations
    // https://en.wikipedia.org/wiki/Equilateral_triangle
    this.altitude = 1.5 * radius;
    this.apothem = radius * 0.5; // Radius of inscribed circle

    this.#generateFixedPoints();

    // Placeholders for getters
    this._points = undefined;
  }

  get center() { return { x: this.x, y: this.y }; }

  get points() { return this._points || (this._points = this.#generatePoints); }

  set points(value) { }

  _lengthSide() { return this.radius * Math.SQRT3; }

  area() { return Math.pow(this.altitude, 2) / Math.SQRT3; }

  /**
   * Generate the points of the equilateral triangle using the provided configuration.
   */
  #generateFixedPoints() {
    // At rotation 0:
    // { r, y }
    // { -r/2, .86... * r }
    // { -r/2, -.86... * r}

    // Shape before rotation is ∆ turned clockwise 90º
    const sqrt3_2 = Math.SQRT3 / 2;
    const { radius, apothem } = this;
    this._fixedPoints = [
      { x: radius, y: 0 },
      { x: -apothem, y: sqrt3_2 * radius },
      { x: -apothem, y: -sqrt3_2 * radius }
    ];

    // Using angles:
    // const angles = [0, 120, 240];
    // this.points = geometricShapePoints(angles, this.origin, this.radius, this.rotation);
    //  geometricShapePoints(angles, tri.origin, tri.radius, tri.rotation);
  }

  #generatePoints() {
    return this._fixedPoints.map(pt => rotatePoint(translatePoint(pt, this.x, this.y), this.rotation));
  }

  /**
   * Generate the bounding box
   * @returns {PIXI.Rectangle}
   */
  getBounds() {
    // If an edge is on the bounding box, use it as the border
    const { x, y, radius, apothem, _fixedPoints: fp } = this;

    const w = radius + apothem;
    const h = this._lengthSide();

    switch ( this.rotation ) {
      case 0:
        // ∆ rotated clockwise 90º
        return new PIXI.Rectangle(fp[0].x + x, fp[0].y + y, w, h);

      case 90:
        // ∆ upside down
        return new PIXI.Rectangle(fp[1].x + x, fp[1].y + y, h, w);

      case 180:
        // ∆ rotated counterclockwise 90º
        return new PIXI.Rectangle(fp[0].x + x, fp[1].y + y, w, h);

      case 270:
        // ∆
        return new PIXI.Rectangle(fp[3].x + x, fp[0].y + y, h, w);
    }

    // Default to the bounding box of the radius circle
    const r2 = Math.pow(radius, 2);
    return new PIXI.Rectangle(x - radius, y - radius, r2, r2);
  }

  /**
   * Does the triangle contain the point?
   * @param {number} x
   * @param {number} y
   * @returns {boolean} True if point {x,y} is contained within the triangle.
   */
  contains(x, y) {
    const bounds = this.getBounds();
    if ( !bounds.contains(x, y) ) return false;

    // Move the point to triangle-space
    const tPt = translatePoint({x: x, y: y}, -this.origin.x, -this.origin.y);
    const pt = rotatePoint(tPt, -this.rotation);

    // Use orientation to test the point
    // Moving clockwise, must be clockwise to each side
    const fp = this._fixedPoints;
    if ( foundry.utils.orient2dFast(fp[0], fp[1], pt) > 0 ) return false;
    if ( foundry.utils.orient2dFast(fp[1], fp[2], pt) > 0 ) return false;
    if ( foundry.utils.orient2dFast(fp[2], fp[0], pt) > 0 ) return false;
    return true;
  }

  /**
   * Convert the triangle to a polygon
   * @returns {PIXI.Polygon}
   */
  toPolygon() { return this; }

  /**
   * Get all intersection points for a segment A|B
   * Intersections must be sorted from A to B.
   * @param {Point} a
   * @param {Point} b
   * @returns {Point[]}
   */
  segmentIntersections(a, b) {
    const { x, y, rotation, _fixedPoints: fp } = this;

    // Move to triangle-space
    a = rotate(translate(a, -x, -y), -rotation);
    b = rotate(translate(b, -x, -y), -rotation);

    // If both are counterclockwise to the same side, no intersection.
    const orientA0 = foundry.utils.orient2dFast(fp[0], fp[1], a);
    const orientB0 = foundry.utils.orient2dFast(fp[0], fp[1], b);
    if ( orientA0 > 0 && orientB0 > 0 ) return [];

    const orientA1 = foundry.utils.orient2dFast(fp[1], fp[2], a);
    const orientB1 = foundry.utils.orient2dFast(fp[1], fp[2], b);
    if ( orientA1 > 0 && orientB1 > 0 ) return [];

    const orientA2 = foundry.utils.orient2dFast(fp[2], fp[0], a);
    const orientB2 = foundry.utils.orient2dFast(fp[2], fp[0], b);
    if ( orientA2 > 0 && orientB2 > 0 ) return [];

    // If both points inside the triangle, no intersection
    const aInside = orientA0 < 0 && orientA1 < 0 && orientA2 < 0;
    const bInside = orientB0 < 0 && orientB1 < 0 && orientB2 < 0;
    if ( aInside && bInside ) return [];

    // Orientation tells us which side(s) to test
    const ixs = [];

    // If point is counter to a side, test that side
    if ( orientA0 > 0 || orientB0 > 0 ) {
      const x = foundry.utils.lineSegmentIntersection(fp[0], fp[1], a, b);
      if ( x ) ixs.push(x);
    }

    if ( orientA1 > 0 || orientB1 > 0 ) {
      const x = foundry.utils.lineSegmentIntersection(fp[1], fp[2], a, b);
      if ( x ) ixs.push(x);
    }

    if ( orientA2 > 0 || orientB2 > 0 ) {
      const x = foundry.utils.lineSegmentIntersection(fp[2], fp[3], a, b);
      if ( x ) ixs.push(x);
    }

    return ixs.map(pt => rotatePoint(translatePoint(pt, x, y), rotation));
  }

  /**
   * Get all the points (corners) of the triangle between
   * two points on (or nearly on) the triangle.
   * Points must be sorted clockwise around the triangle.
   * @param {Point} a
   * @param {Point} b
   * @returns {Point[]}
   */
  pointsBetween(a, b) {
    if ( a.x.almostEqual(b.x) && a.y.almostEqual(b.y) ) return [];

    const { x, y, rotation, _fixedPoints: fp } = this;

    // Move to triangle-space
    a = this._toTriangleSpace(a);
    b = this._toTriangleSpace(b);

    const aSide = this._getSide(a);
    if ( ~aSide ) return []; // a is inside

    const bSide = this._getSide(b);
    if ( ~bSide ) return []; // b is inside

    const pts = [];

    if ( aSide === bSide ) {
      // Either a is before b moving clockwise (no points)
      // or a is after b moving clockwise (all points)
      if ( foundry.utils.orient2dFast({x: 0, y: 0}, a, b) > 0 ) return [];
      pts.push([0,1,2].map(i => fp[(i + aSide + 1) % 3]));
    } else {
      let currSide = aSide;
      while ( currSide !== bSide ) {
        currSide = (currSide + 1) % 3
        pts.push(fp[currSide])
      }
    }

    return pts.map(pt => this._fromTriangleSpace(pt));
  }

  /**
   * Convert a point to triangle-space
   * @param {Point} a
   * @returns {Point}
   */
  _toTriangleSpace(a) { return rotatePoint(translatePoint(a, -this.x, -this.y), -this.rotation); }

  /**
   * Convert a point from triangle-space
   * @param {Point} a
   * @returns {Point}
   */
  _fromTriangleSpace(a) { return rotatePoint(translatePoint(a, this.x, this.y), this.rotation); }

  /**
   * Determine on which side a point lies.
   * @param {Point} point  Point, in triangle-space
   * @returns {number} 0, 1, or 2 for the side. If point is on a corner, returns the next side
   *                   Returns -1 if inside.
   */
  _getSide(point) {
    for ( let i = 0; i < 3; i += 1 ) {
      const side = this._checkSide(point, i);
      if ( ~side ) return side;
    }
    return -1;
  }

  /**
   * Determine if a point is on this side
   * Returns the side number or -1 if not on this side
   */r
  _checkSide(point, side) {
    const fp0 = this._fixedPoints[side];
    const fp1 = this._fixedPoints[(side + 1) % 3];

    if ( fp1.x.almostEqual(point.x) && fp1.y.almostEqual(point.y) ) return (side + 1) % 3;

    const orient = foundry.utils.orient2dFast(fp0, fp1, point);
    return orient >= 0 ? side : -1;
  }

}

Math.SQRT3 = Math.sqrt(3);

/**
 * Rotate a point around a given angle
 * @param {Point} point
 * @param {number} angle  In degrees
 * @returns {Point}
 */
function rotatePoint(point, angle) {
  angle = Math.toRadians(angle);
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.y * Math.cos(angle) + point.x * Math.sin(angle)
  }
}

/**
 * Translate a point by a given dx, dy
 * @param {Point} point
 * @param {number} dx
 * @param {number} dy
 * @returns {Point}
 */
function translatePoint(point, dx, dy) {
  return {
    x: point.x + dx,
    y: point.y + dy
  }
}


/**
 * Build a geometric shape given a set of angles.
 * @param {Number[]} angles      Array of angles indicating vertex positions.
 * @param {Point}    origin      Center of the shape.
 * @param {Number}   radius      Distance from origin to each vertex.
 * @param {Number}   rotation    Angle in degrees describing rotation from due east.
 * @returns {Points[]} Array of vertices.
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
 * @returns {Point}  Coordinates of point that lies distance away from origin along angle.
 */
function pointFromAngle(origin, radians, distance) {
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  return { x: origin.x + (dx * distance), y: origin.y + (dy * distance) };
}