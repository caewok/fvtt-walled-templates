/* globals
libWrapper
*/

'use strict';

// Patches

import { MODULE_ID } from "./const.js";
import { walledTemplateGetCircleShape } from "./getCircleShape.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, `MeasuredTemplate.prototype._getCircleShape`, walledTemplateGetCircleShape, `MIXED`);
}