/* globals
libWrapper
*/

'use strict';

// Patches

import { MODULE_ID } from "./const.js";
import { walledTemplateGetCircleShape } from "./getCircleShape.js";
import { walledTemplateGetConeShape } from "./getConeShape.js";

export function registerWalledTemplates() {
  libWrapper.register(MODULE_ID, `MeasuredTemplate.prototype._getCircleShape`, walledTemplateGetCircleShape, `MIXED`);
  libWrapper.register(MODULE_ID, `MeasuredTemplate.prototype._getConeShape`, walledTemplateGetConeShape, `MIXED`);
}