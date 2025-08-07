/* globals
canvas,
fromUuidSync,
PIXI
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { log } from "./util.js";

// Hook wall modification to enable template shape changes.

export const PATCHES = {};
PATCHES.BASIC = {};

// ----- NOTE: Hooks ----- //

/**
 * createWall Hook
 * @param {WallDocument} document
 * @param {Object} options { temporary: Boolean, renderSheet: Boolean, render: Boolean }
 * @param {string} userId
 */
function createWallHook(document, options, _userId) {
  if (options.temporary) return;

  const A = document.object.edge.a;
  const B = document.object.edge.b;
  log(`Refreshing templates on createWall ${A.x},${A.y}|${B.x},${B.y}.`);

  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true }) ) {
      log(`Wall ${document.id} intersects ${t.id}`);
      t.renderFlags.set({ refreshShape: true });
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
function preUpdateWallHook(document, change, options, _userId) {
  const A = new PIXI.Point(document.c[0], document.c[1]);
  const B = new PIXI.Point(document.c[2], document.c[3]);

  // Issue #19: Door open/close passes a change.ds but not a change.c
  const newA = change.c ? new PIXI.Point(change.c[0], change.c[1]) : A;
  const newB = change.c ? new PIXI.Point(change.c[2], change.c[3]) : B;
  log(`Refreshing templates on preUpdateWall ${A.x},${A.y}|${B.x},${B.y} --> ${newA},${newA.y}|${newB.x},${newB.y}`);

  // We want to update the template if this wall was within the template or will be
  // within the template, but hold until updateWall is called.
  // Cannot pass the templates but can pass uuids.
  const coordinatesChanged = !(A.equals(newA) && B.equals(newB));
  const templatesToUpdate = options.templatesToUpdate = [];
  canvas.templates.placeables.forEach(t => {
    const bbox = t.shape.getBounds().translate(t.x, t.y);
    if ( bbox.lineSegmentIntersects(A, B, { inside: true })
      || (coordinatesChanged
        && bbox.lineSegmentIntersects(newA, newB, { inside: true })) ) templatesToUpdate.push(t.document.uuid);
  });
}

/**
 * Hook for updateWall, so the existing wall can be checked for whether it
 * interacts with the template
 * @param {WallDocument} document
 * @param {Object} change { c: Array[], _id: String }  Array of four coordinates plus id
 * @param {Object} options { diff: Boolean, render: Boolean }
 * @param {string} userId
 */
function updateWallHook(document, change, options, _userId) {
  if ( !options.templatesToUpdate || !options.templatesToUpdate.length ) return;
  const renderOpts = { refreshShape: true };
  options.templatesToUpdate.forEach(uuid => {
    const tDoc = fromUuidSync(uuid);
    tDoc.object.renderFlags.set(renderOpts);
  });
}

/**
 * Hook for deleteWall.
 * @param {WallDocument} document
 * @param {Object} options { render: Boolean }
 * @param {string} userId
 */
function deleteWallHook(document, _options, _userId) {
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

PATCHES.BASIC.HOOKS = {
  createWall: createWallHook,
  preUpdateWall: preUpdateWallHook,
  updateWall: updateWallHook,
  deleteWall: deleteWallHook
};
