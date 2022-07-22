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
rotation = 0
numSides = 3

clearDrawings()
poly = new RegularPolygon({x: 1000, y: 1000}, 100, { rotation, numSides });
poly.fixedPoints.forEach(pt => drawPoint(pt, {color: COLORS.blue}))
poly.fixedPoints.forEach(pt => drawPoint(poly.toCartesianCoords(pt), {color: COLORS.blue, radius: 2}))
drawShape(poly)
drawShape(poly.getBounds())

tri = new EquilateralTriangle(poly.center, poly.radius, { rotation })
tri.fixedPoints.forEach(pt => drawPoint(pt, {color: COLORS.blue}))
tri.fixedPoints.forEach(pt => drawPoint(tri.toCartesianCoords(pt), {color: COLORS.blue}))
drawShape(tri)
drawShape(tri.getBounds(), {color: COLORS.blue})

sq = Square.fromPoint(poly.center, 100)
sq.fixedPoints.forEach(pt => drawPoint(pt, {color: COLORS.blue}))
sq.fixedPoints.forEach(pt => drawPoint(sq.toCartesianCoords(pt), {color: COLORS.blue}))
drawShape(sq)
drawShape(sq.getBounds(), {color: COLORS.blue})

sq2 = new Square(sq.center, Math.SQRT2 * 100, {rotation: 45})
sq2.fixedPoints.forEach(pt => drawPoint(pt, {color: COLORS.blue}))
sq2.fixedPoints.forEach(pt => drawPoint(sq2.toCartesianCoords(pt), {color: COLORS.blue}))
drawShape(sq2)
drawShape(sq2.getBounds(), {color: COLORS.blue})

// points
pts = {
  inside: {x: 1000, y: 1000},
  left: { x: 500, y: 1000},
  right: { x: 1500, y: 1000},
  top: { x: 1000, y: 500},
  bottom: {x: 1000, y: 1500}
}

Object.values(pts).forEach(pt => drawPoint(pt, { color: COLORS.black}))

for ( const [key, pt] of Object.entries(pts) ) {
  const res = poly.contains(pt.x, pt.y)
  console.log(`${key}: ${res}`)
}


segments = {
  li: {A: pts.left, B: pts.inside},
  ri: {A: pts.right, B: pts.inside},
  ti: {A: pts.top, B: pts.inside},
  bi: {A: pts.bottom, B: pts.inside},
  ii: {A: pts.inside, B: {x: pts.inside.x + 20, y: pts.inside.y - 20}},
  lr: {A: pts.left, B: pts.right},
  tb: {A: pts.top, B: pts.bottom},
  lt: {A: pts.left, B: pts.top},
  lb: {A: pts.left, B: pts.bottom},
  tl: {A: pts.top, B: pts.left},
  rt: {A: pts.right, B: pts.top},
}

Object.values(segments).forEach(s => drawSegment(s))

for ( const [key, s] of Object.entries(segments) ) {
  const x = poly.segmentIntersections(s.A, s.B)
  x.forEach(ix => drawPoint(ix))
  console.log(`${key}: ${x[0]?.x},${x[0]?.y} & ${x[1]?.x},${x[1]?.y}`)
}


for ( const [key, s] of Object.entries(segments) ) {
  const res = poly.pointsBetween(s.A, s.B)
  console.log(`${key}:`, res)
}

poly.pointsBetween(pts.left, pts.bottom)
poly.pointsBetween(pts.left, {x: pts.left.x, y: pts.left.y + 10})
poly.pointsBetween(pts.left, {x: pts.left.x, y: pts.left.y - 10})

export class RegularPolygon extends PIXI.Polygon {

 /**
  * @param {Point} origin   Center point of the polygon.
  * @param {number} radius  Circumscribed circle radius.
  * @param {object} options Options that affect the polygon shape
  * @param {number} options.numSides  Number of sides for this polygon
  * @param {number} options.rotation  Rotation, in degrees, from a starting point due east
  */
  constructor(origin, radius, {numSides = 3, rotation = 0} = {}) {
    super([]);
    this.x = origin.x;
    this.y = origin.y;
    this.numSides = numSides;
    this.radius = radius;
    this.rotation = Math.normalizeDegrees(rotation);

    // Placeholders for getters
    this._fixedPoints = undefined; // So that subclasses can override generateFixedPoints
    this._points = undefined;

    // Polygon properties
    this._isClosed = false;
    this._isClockwise = true;
  }

  get center() { return { x: this.x, y: this.y }; }

  get points() { return this._points || (this._points = this._generatePoints()); }

  set points(value) { }

  get fixedPoints() { return this._fixedPoints || (this._fixedPoints = this.#generateFixedPoints()); }

  /**
   * Calculate the distance of the line segment from the center to the midpoint of a side.
   * @type {number}
   */
  get apothem() {
    return this.radius * Math.cos(Math.PI / this.numSides);
  }

  /**
   * Calculate length of a side of this regular polygon.
   * @type {number}
   */
  get sideLength() {
    return 2 * this.radius * Math.sin(Math.PI / this.numSides);
  }

  /**
   * Calculate area of the regular polygon.
   * @type {number}
   */
  get area() {
    return this.numSides * this.sideLength * this.apothem;
  }

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
  _generatePoints() {
    // Faster to use for loop rather than flatten
    const pts = [];
    const { numSides, fixedPoints: fp } = this;
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
  toCartesianCoords(a) { return translatePoint(rotatePoint(a, this.rotation), this.x, this.y); }

  /**
   * Does the triangle contain the point?
   * @param {number} x
   * @param {number} y
   * @returns {boolean} True if point {x,y} is contained within the triangle.
   */
  contains(x, y) {
    const bounds = this.getBounds();
    if ( !bounds.contains(x, y) ) return false;

    const pt = this.fromCartesianCoords({ x, y });

    // Use orientation to test the point.
    // Moving clockwise, must be clockwise to each side.
    const { fixedPoints: fp, numSides } = this;
    for ( let i = 0; i < numSides; i += 1 ) {
      const fp0 = fp[i];
      const fp1 = fp[(i + 1) % numSides];
      if ( foundry.utils.orient2dFast(fp0, fp1, pt) >= 0 ) return false;
    }

    return true;
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
    const fp = this.fixedPoints;
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
    if ( !~aSide ) return []; // A is inside

    const bSide = this._getSide(b);
    if ( !~bSide ) return []; // B is inside

    const pts = [];
    const { numSides, fixedPoints: fp } = this;

    if ( aSide === bSide ) {
      // Either a is before b moving clockwise (no points)
      // or a is after b moving clockwise (all points)
      if ( foundry.utils.orient2dFast({x: 0, y: 0}, a, b) < 0 ) return [];
      pts.push(...[0, 1, 2].map(i => fp[(i + aSide + 1) % numSides]));
    } else {
      let currSide = aSide;
      while ( currSide !== bSide ) {
        currSide = (currSide + 1) % numSides;
        pts.push(fp[currSide]);
      }
    }

    // If the last point is collinear to the center, drop
    if ( !foundry.utils.orient2dFast({x: 0, y: 0}, pts[pts.length - 1], b )) pts.pop();

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
    const fp0 = this.fixedPoints[side];
    const fp1 = this.fixedPoints[(side + 1) % numSides];



    if ( fp1.x.almostEqual(point.x) && fp1.y.almostEqual(point.y) ) return (side + 1) % numSides;

    const orient01 = foundry.utils.orient2dFast(fp0, fp1, point);

    // If clockwise, the point is inside relative to this side
    if ( orient01 < 0 ) return -1;

    // If counterclockwise, the point is on this side, but might be equivalent to fp1
    const orientC = foundry.utils.orient2dFast({x: 0, y: 0}, fp1, point);
    if ( !orientC ) return (side + 1) % numSides;
    return side;
  }
}

export class EquilateralTriangle extends RegularPolygon {
  constructor(origin, radius, {rotation = 0} = {}) {
    super(origin, radius, { rotation, numSides: 3 });
  }

  /**
   * Calculate the distance from a side midpoint to the opposite point.
   * @type {number}
   */
  get altitude() { return 1.5 * this.radius; }

  /**
   * Calculate the distance of the line segment from the center to the midpoint of a side.
   * @type {number}
   */
  get apothem() { return this.radius * 0.5; }

  /**
   * Calculate length of a side of this equilateral triangle.
   * @type {number}
   */
  get sideLength() { return this.radius * Math.SQRT3; }

  /**
   * Calculate area of this equilateral triangle.
   * @type {number}
   */
  get area() { Math.pow(this.altitude, 2) / Math.SQRT3; }

  /**
   * Generate the points of the equilateral triangle using the provided configuration.
   * Simpler and more mathematically precise than the default version.
   * @returns {Point[]}
   */
  #generateFixedPoints() {
    // Shape before rotation is ∆ turned clockwise 90º
    const sqrt3_2 = Math.SQRT3 / 2;
    const { radius, apothem } = this;
    return [
      { x: radius, y: 0 },
      { x: -apothem, y: sqrt3_2 * radius },
      { x: -apothem, y: -sqrt3_2 * radius }
    ];
  }

  getBounds() {
    // If an edge is on the bounding box, use it as the border
    const { x, y, sideLength, altitude, apothem, fixedPoints: fp } = this;

    switch ( this.rotation ) {
      // PIXI.Rectangle(x, y, width, height)
      case 0:
        // ∆ rotated clockwise 90º
        return new PIXI.Rectangle(
          fp[2].x + x,
          fp[2].y + y,
          altitude, sideLength)

      case 90:
        // ∆ upside down
        return new PIXI.Rectangle(
          -(sideLength / 2) + x,
          -apothem + y,
          sideLength, altitude);

      case 180:
        // ∆ rotated counterclockwise 90º
        return new PIXI.Rectangle(
          -altitude + apothem + x,
          fp[2].y + y,
          altitude, sideLength)

      case 270:
        // ∆
        return new PIXI.Rectangle(
          -(sideLength / 2) + x,
          -altitude + apothem + y,
          sideLength, altitude);
    }

    return super.getBounds();
  }
}

/**
 * Square is oriented at 0º rotation like a diamond.
 * Special case when square is rotate 45º or some multiple thereof
 * @param {Point} origin  Center point of the square
 * @param {number} radius Circumscribed circle radius
 * @param {object} options
 * @param {number} [options.rotation]   Rotation in degrees
 * @param {number} [options.width]      Alternative specification when skipping radius
 */
export class Square extends RegularPolygon {
  constructor(origin, radius, {rotation = 0, width} = {}) {
    radius ??= Math.sqrt(Math.pow(width, 2) * 2);
    super(origin, radius, { rotation, numSides: 4 });

    this.width = width ?? (this.radius * Math.SQRT2);
  }

  /**
   * Calculate the distance of the line segment from the center to the midpoint of a side.
   * @type {number}
   */
  get apothem() { return this.width; }

  /**
   * Calculate length of a side of this square.
   * @type {number}
   */
  get sideLength() { return this.apothem * 2; }

  /**
   * Calculate area of this square.
   * @type {number}
   */
  get area() { this.sideLength * 2; }

  /**
   * Construct a square like a PIXI.Rectangle, where the point is the top left corner.
   */
  static fromPoint(point, width) {
    const w1_2 = width / 2;
    return new this({x: point.x + w1_2, y: point.y + w1_2}, undefined, { rotation: 45, width })
  }

  /**
   * Construct a square from a token's hitArea.
   * @param {Token} token
   * @return {Hexagon}
   */
  static fromToken(token) {
    const { x, y } = this.token.center;
    const { width, height } = this.token.hitArea;

    if ( width !== height ) return new PIXI.Rectangle(x, y, width, height);

    return this.fromPoint({x, y}, width);
  }

  /**
   * Generate the points of the square using the provided configuration.
   * Simpler and more mathematically precise than the default version.
   * @returns {Point[]}
   */
  #generateFixedPoints() {
    // Shape before rotation is [] rotated 45º
    const r = this.radius;

    return [
      { x: r, y: 0 },
      { x: 0, y: r },
      { x: -r, y: r },
      { x: 0, y: -r }
    ];
  }

  /**
   * Generate the points that represent this shape as a polygon in Cartesian space.
   * @return {Points[]}
   */
  _generatePoints() {
    const { x, y, rotation, apothem } = this;

    switch ( rotation ) {
      // oriented []
      case 45:
      case 135:
      case 225:
      case 315:
        return [
          { x: apothem + x, y: apothem + y },
          { x: -apothem + x, y: apothem + y },
          { x: -apothem + x, y: -apothem + y },
          { x: apothem + x, y: -apothem + y },
        ]

      // oriented [] turned 45º
      case 0:
      case 90:
      case 180:
      case 270:
        return [
          { x: r + x, y},
          { x, y: r + y },
          { x: -r + x, y: r + y},
          { x, y: -r + y }
        ];
    }

    return super._generatePoints();
  }

  getBounds() {
    // If an edge is on the bounding box, use it as the border
    const { x, y, sideLength, apothem, fixedPoints: fp } = this;

    switch ( this.rotation ) {
      // PIXI.Rectangle(x, y, width, height)
      // oriented []
      case 45:
      case 135:
      case 225:
      case 315:
        return new PIXI.Rectangle(-apothem + x, -apothem + y, sideLength, sideLength);

      // oriented [] turned 45º
      case 0:
      case 90:
      case 180:
      case 270:
        return new PIXI.Rectangle(fp[2], fp[3], sideLenth, sideLength);
    }

    return super.getBounds();
  }
}

/**
 * "Column" hexagon with points at W and E
 * If height is greater than width, a row hexagon will be returned; otherwise column or rotated.
 * @param {Number}  width     Distance from left to right, through center.
 * @param {Number}  height    Distance from top to bottom, through center.
 */
export class Hexagon extends RegularPolygon {
  constructor(origin, radius, { rotation = 0, width, height = 0 } = {}) {
    radius ??= Math.max(width, height) / 2;
    if ( width && height > width ) rotation = 90;

    super(origin, radius, {rotation});

    switch ( rotation ) {
      case 0:
      case 180:
        this._apothem = height || (Math.SQRT3 * this.radius * 0.5);
        break;

      case 90:
      case 270:
        this._apothem = width || (Math.SQRT3 * this.radius * 0.5);
        break;

      default:
        this._apothem = Math.SQRT3 * this.radius * 0.5;
    }

    this.radius2 = Math.pow(this.radius, 2);
  }

  /**
   * Calculate the distance of the line segment from the center to the midpoint of a side.
   * For column hexagon, this is height / 2
   * For row hexagon, this is width / 2
   * @type {number}
   */
  get apothem() {
    return this._apothem;
  }

  /**
   * Calculate length of a side of this hexagon
   * @type {number}
   */
  get sideLength() {
    return this.radius;
  }

  /**
   * Calculate area of this hexagon
   * @type {number}
   */
  get area() {
    // https://en.wikipedia.org/wiki/Hexagon
    return 1.5 * Math.SQRT3 * this.radius2;
  }

  /**
   * Construct a hexagon from a token's hitArea.
   * @param {Token} token
   * @return {Hexagon}
   */
  static fromToken(token) {
    const { width, height } = token.hitArea;
    return new this(token.center, undefined, { width, height });
  }

  /**
   * Generate the points of the hexagon using the provided configuration.
   * Simpler and more mathematically precise than the default version.
   * @returns {Point[]}
   */
  #generateFixedPoints() {
    // Shape before rotation is [] rotated 45º
    const { radius, apothem } = this;
    const r1_2 = radius * 0.5;

    // Points at W and E
    return [
      { x: radius, y: 0 },
      { x: r1_2, y: apothem },
      { x: -r1_2, y: apothem },
      { x: -radius, y: 0 },
      { x: -r1_2, y: -apothem },
      { x: r1_2, y: -apothem }
    ];
  }

  /**
   * Generate the points that represent this shape as a polygon in Cartesian space.
   * @return {Points[]}
   */
  _generatePoints() {
    const { x, y, rotation, radius, apothem } = this;
    const r1_2 = radius * 0.5;

    switch ( rotation ) {
      // pointy-side E/W
      case 0:
      case 180:
        return [
          { x: radius + x, y },
          { x: r1_2 + x, y: apothem + y },
          { x: -r1_2 + x, y: apothem + y },
          { x: -radius + x, y },
          { x: -r1_2 + x, y: -apothem + y },
          { x: r1_2 + x, y: -apothem + y }
        ];

      // pointy-side N/S
      case 90:
      case 270:
        return [
          { x: apothem + x, y: r1_2 + y },
          { x, y: radius + y },
          { x: -apothem + x, y: r1_2 + y },
          { x: -apothem + x, y: -r1_2 + y },
          { x, y: -radius + y },
          { x: apothem + x, y: -r1_2 + y }
        ];
    }

    return super._generatePoints();
  }

  getBounds() {
    // If an edge is on the bounding box, use it as the border
    const { x, y, radius, apothem, fixedPoints: fp } = this;

    switch ( this.rotation ) {
      // PIXI.Rectangle(x, y, width, height)
      // pointy-side E/W
      case 0:
      case 180:
        return new PIXI.Rectangle(
          fp[3].x + x,
          fp[4].y + y,
          radius * 2,
          apothem * 2)

      // pointy-side N/S
      case 90:
      case 270:
        return new PIXI.Rectangle(
          -apothem + x,
          -radius + y,
          apothem * 2,
          radius * 2);
    }

    return super.getBounds();
  }
}

// Store √3 as a constant
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