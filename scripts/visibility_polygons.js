/* globals
canvas,
CONFIG,
CONST,
foundry,
game,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID } from "./const.js";


/* Functions to reconstruct token and multi-token vision.
Meant to mimic the illuminated portion of the canvas for 1+ tokens based on canvas.visibility.
Unlike that class, this constructs the underlying geometry——polygons that can be tested.

*/


/**
 * Return all tokens in the scene that have vision and for which the user has OBSERVER or better permissions.
 * @returns {Token[]}
 */
export function getObservableTokensWithVision() {
  const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  const tokens = canvas.tokens.controlled.length ? canvas.tokens.controlled : canvas.tokens.placeables;
  return tokens.filter(t => {
    if ( !t.vision ) return false;
    const actor = t.actor;
    if ( !actor ) return false;
    return Math.max(actor.ownership.default, actor.ownership[game.user.id] ?? 0) >= OBSERVER;
  });
}


/**
 * For given tokens, mimic CanvasVisibility#refreshVisibility
 * But return polygons covering visible areas.
 * @param {Token[]} [tokens]
 * @returns {PIXI.Polygon[]}
 */
export function canvasVisibilityPolygons(tokens) {
  // Store token ids to compare against active vision sources.
  tokens ??= getObservableTokensWithVision();
  const tokenIds = new Set(tokens.map(t => t.sourceId));

  const visionLightShapes = []; // Light perception
  const visionSightShapes = []; // FOV
  const lightShapes = []
  const globalLightEnabled = canvas.scene.environment.globalLight.enabled

  // Iterating over each active light source
  for ( const lightSource of canvas.effects.lightSources.values() ) {
    // Ignoring inactive sources or global light (which is rendered using the global light mesh)
    if ( !lightSource.hasActiveLayer || (lightSource instanceof foundry.canvas.sources.GlobalLightSource) ) continue;

    // Is the light source providing vision?
    if ( lightSource.data.vision ) visionSightShapes.push(lightSource.shape);

    // If global light is present, the other light sources don't matter, but just push anyway.
    lightShapes.push(lightSource.shape)
  }

  // Iterating over each active vision source
  for ( const [sourceId, visionSource] of canvas.effects.visionSources.entries() ) {
    if ( !tokenIds.has(sourceId) ) continue; // Ignore vision sources not in the token set.
    if ( !visionSource.hasActiveLayer ) continue;
    const blinded = visionSource.isBlinded;

    // Draw vision FOV
    // NOTE: Foundry v12 draws the preview vision sight shape no matter what.
    if ( (visionSource.radius > 0) && !blinded ) visionSightShapes.push(visionSource.shape);

    // Draw light perception
    // NOTE: Foundry v12 draws the preview vision light shape no matter what.
    if ( (visionSource.lightRadius > 0) && !blinded && !visionSource.isPreview ) visionLightShapes.push(visionSource.light);
  }

  // Each vision sight shape conveys vision on its own.
  // For vision light shapes, each must overlap a light source.
  if ( globalLightEnabled ) return [...visionLightShapes, ...visionSightShapes];

  // Combine the light sources, then intersect each vision light shape with the combined light sources.
  const ClipperPaths = CONFIG[MODULE_ID].ClipperPaths ?? CONFIG.GeometryLib.ClipperPaths;
  const lightPaths = ClipperPaths.fromPolygons(lightShapes).combine();
  const out = visionSightShapes;
  visionLightShapes.forEach(s => {
    const ixPaths = lightPaths.intersectPolygon(s);
    if ( ixPaths.area.almostEqual(0) ) return;
    out.push(...ixPaths.clean().toPolygons());
  });
  return out;
}


