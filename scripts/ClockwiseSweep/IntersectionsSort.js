/* globals
foundry
*/

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

"use strict";

/*
Report intersections between segments using a near-brute force algorithm that
sorts the segment array to skip checks for segments that definitely cannot intersect.
"Single": Check each segment in an array against every other segment in that array.
"RedBlack": Check each segment in one array ("red") against every segment in a
            second array ("black").

Both functions take a callback function that reports intersecting segment pairs.

The sort functions require that the segment objects have "nw" and "se" properties
identifying the endpoints.
*/

/**
 * Identify intersections between segments in an Array.
 * Less than O(n^2) using a modified brute force method.
 * Very fast in practice assuming segments are distribute in space and do not all
 * intersect each other.
 * Sorts the segments by endpoints to facilitate skipping unnecessary checks.
 * - Counts shared endpoints.
 * - Passes pairs of intersecting segments to a reporting function but does not
 *   calculate the intersection point.
 * @param {Segments[]} segments   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
export function findIntersectionsSortSingle(segments, reportFn = (_s1, _s2) => {}) {
  const ln = segments.length;
  if (!ln) { return; }

  // In a single pass through the array, build an array of endpoint objects.
  // Each object contains an endpoint, a link to the underlying segment, and a boolean
  // Indicator for whether it is the nw or se endpoint.
  // Sort the new array by the x values, breaking ties by sorting the se point first.
  // (it is fine if two segments are otherwise equivalent in the sort)

  const endpoints = [];
  for (let i = 0; i < ln; i += 1) {
    const s = segments[i];
    endpoints.push({e: s.nw, s, se: -1},
                   {e: s.se, s, se: 1}); // eslint-disable-line indent
  }
  endpoints.sort(sortEndpoints);

  const ln2 = endpoints.length;
  for (let i = 0; i < ln2; i += 1) {
    const endpoint1 = endpoints[i];
    if (~endpoint1.se) continue; // Avoid duplicating the check

    // Starting j is always i + 1 b/c any segment with an se endpoint after si
    // would be after si or already processed b/c its ne endpoint was before.
    const start_j = i + 1;
    const si = endpoint1.s;
    for (let j = start_j; j < ln2; j += 1) {
      const endpoint2 = endpoints[j];

      if (endpoint2.e.x > si.se.x) break; // Segments past here are entirely right of si
      if (~endpoint2.se) continue;

      const sj = endpoint2.s;
      foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) && reportFn(si, sj); // eslint-disable-line no-unused-expressions
    }
  }
}

/**
 * Comparison function for SortSingle
 * Sort each endpoint object by the endpoint x coordinate then sort se first.
 * @param {Object} e1   Endpoint object containing:
 *                      e (endpoint), s (segment), and se (boolean)
 * @param {Object} e2   Endpoint object containing:
 *                      e (endpoint), s (segment), and se (boolean)
 * @return {Number} Number indicating whether to sort e1 before e2 or vice-versa.
 *                  > 0: sort e2 before e1
 *                  < 0: sort e1 before e2
 */
function sortEndpoints(e1, e2) {
  return e1.e.x - e2.e.x
         || e2.se - e1.se;

  // If e1.se then we want e1 first or they are equal. So return -
  // If e2.se then we want e2 first or they are equal. So return +
  // e2.se - e1.se
  // e1.se: -1, e2.se: 1. 1 - - 1 = 2; e2 first
  // e1.se: 1, e2.se: -1. -1 - 1 = -2:; e1 first
}


/**
 * Identify intersections between two arrays of segments.
 * Segments within a single array are not checked for intersections.
 * (If you want intra-array, see findIntersectionsSortSingle.)
 * Very fast in practice assuming segments are distribute in space and do not all
 * intersect each other.
 * Sorts the segments by endpoints to facilitate skipping unnecessary checks.
 * - Counts shared endpoints.
 * - Passes pairs of intersecting segments to a reporting function but does not
 *   calculate the intersection point.
 * @param {Segments[]} red   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Segments[]} black   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
export function findIntersectionsSortRedBlack(red, black, reportFn = (_s1, _s2) => {}) {
  const ln_red = red.length;
  const ln_black = black.length;
  if (!ln_red || !ln_black) return;

  // Build an array of endpoint objects like with SortSingle.
  // But mark red/black segments so same color segments can be skipped.
  // By convention, red is true; black is false.
  // (slightly faster b/c the inner loop gets hit more and so inner tests for true?)
  // Alternatively, could sort by red/black and then break a bit earlier in
  // the inner loop. But the check for color => continue is pretty quick and simpler.
  const endpoints = [];
  for (let i = 0; i < ln_red; i += 1) {
    const s = red[i];
    endpoints.push({e: s.nw, s, se: -1, red: true},
                   {e: s.se, s, se: 1,  red: true}); // eslint-disable-line indent, no-multi-spaces
  }
  for (let i = 0; i < ln_black; i += 1) {
    const s = black[i];
    endpoints.push({e: s.nw, s, se: -1, red: false},
                   {e: s.se, s, se: 1,  red: false}); // eslint-disable-line indent, no-multi-spaces
  }

  endpoints.sort(sortEndpoints);
  const ln_endpoints = endpoints.length;
  for (let i = 0; i < ln_endpoints; i += 1) {
    const endpoint1 = endpoints[i];
    if (~endpoint1.se) continue; // Avoid duplicating the check

    // Starting j is always i + 1 b/c any segment with an se endpoint after si
    // Would be after si or already processed b/c its ne endpoint was before.
    const start_j = i + 1;
    const si = endpoint1.s;
    for (let j = start_j; j < ln_endpoints; j += 1) {
      const endpoint2 = endpoints[j];

      if (endpoint2.e.x > si.se.x) break; // Segments past here are entirely right of si
      if (!(endpoint1.red ^ endpoint2.red)) continue; // Only want segments of different color
      if (~endpoint2.se) continue;

      const sj = endpoint2.s;
      foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) && reportFn(si, sj); // eslint-disable-line no-unused-expressions
    }
  }
}
// Testing:
// reportFn = (_s1, _s2) => { console.log(`${_s1.id} x ${_s2.id}`) }

// TO-DO: Version of RedBlack that uses an existing sorted endpoint list,
// adds to it (using insertion sort?) and returns the updated list.
// Could be used to add wall segments or just store a sorted list
// for use with temp walls.

