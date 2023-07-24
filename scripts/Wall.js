/* globals
canvas
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { log } from "./util.js";
import { MODULE_ID } from "./const.js";

// Hook wall modification to enable template shape changes.

/**
 * createWall Hook
 * @param {WallDocument} document
 * @param {Object} options { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} userId
 */
export function createWallHook(document, options, _userId) {
  if (options.temporary) return;

  const A = document._object.A;
  const B = document._object.B;
  log(`Refreshing templates on createWall ${A.x},${A.y}|${B.x},${B.y}.`);

  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.renderFlags.set({
        refreshShape: true
      });
    }
  });
}

/**
 * Hook for preUpdateWall, so the existing wall can be checked for whether it
 * interacts with the template
 * @param {WallDocument} document
 * @param {Object} change { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} options { diff: Boolean, render: Boolean }
 * @param {string} userId
 */
export async function preUpdateWallHook(document, change, _options, _userId) {
  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };

  // Issue #19: Door open/close passes a change.ds but not a change.c
  const new_A = change.c ? { x: change.c[0], y: change.c[1] } : A;
  const new_B = change.c ? { x: change.c[2], y: change.c[3] } : B;
  log(`Refreshing templates on preUpdateWall ${A.x},${A.y}|${B.x},${B.y} --> ${new_A.x},${new_A.y}|${new_B.x},${new_B.y}`);

  // We want to update the template if this wall is within the template, but
  // hold until updateWall is called.
  const promises = [];
  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      promises.push(t.document.setFlag(MODULE_ID, "redraw", true)); // Async
    }
  });
  promises.length && ( Promise.all(promises) ); // eslint-disable-line no-unused-expressions
}

/**
 * Hook for updateWall, so the existing wall can be checked for whether it
 * interacts with the template
 * @param {WallDocument} document
 * @param {Object} change { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} options { diff: Boolean, render: Boolean }
 * @param {string} userId
 */
export function updateWallHook(document, change, options, _userId) {
  if (!options.diff) return;

  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };

  canvas.templates.placeables.forEach(t => {
    if ( t.document.getFlag(MODULE_ID, "redraw") ) {
      t.document.setFlag(MODULE_ID, "redraw", false);
      t.renderFlags.set({
        refreshShape: true
      });
      return;
    }
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.renderFlags.set({
        refreshShape: true
      });
    }
  });
}

/**
 * Hook for deleteWall.
 * @param {WallDocument} document
 * @param {Object} options { render: Boolean }
 * @param {string} userId
 */
export function deleteWallHook(document, _options, _userId) {
  const A = { x: document.c[0], y: document.c[1] };
  const B = { x: document.c[2], y: document.c[3] };
  log(`Refreshing templates on deleteWall ${A.x},${A.y}|${B.x},${B.y}.`);

  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.renderFlags.set({
        refreshShape: true
      });
    }
  });
}
