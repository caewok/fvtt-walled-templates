/* globals
CONFIG,
Hooks,
libWrapper
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { MODULE_ID } from "./const.js";
import { SETTINGS, getSetting } from "./settings.js";

import { PATCHES as PATCHES_MeasuredTemplate } from "./MeasuredTemplate.js";
import { PATCHES as PATCHES_MeasuredTemplateConfig } from "./MeasuredTemplateConfig.js";
import { PATCHES as PATCHES_Token } from "./Token.js";
import { PATCHES as PATCHES_Wall } from "./Wall.js";
import { PATCHES as PATCHES_dnd5e } from "./dnd5e.js";

export const PATCHES = {
  MeasuredTemplate: PATCHES_MeasuredTemplate,
  MeasuredTemplateConfig: PATCHES_MeasuredTemplateConfig,
  Token: PATCHES_Token,
  Wall: PATCHES_Wall,
  dnd5e: PATCHES_dnd5e // Only works b/c these are all hooks. Otherwise, would need class breakdown.
};

export function initializePatching() {
  initializeRegistrationTracker();
  registerGroup("BASIC");
  // registerPatchesForSystem();
}

/**
 * Register the autotargeting wraps and methods. Must be done after settings are enabled.
 */
export function registerAutotargeting() {
  deregisterGroup("AUTOTARGET");
  const autotarget = getSetting(SETTINGS.AUTOTARGET.MENU) !== SETTINGS.AUTOTARGET.CHOICES.NO;
  if ( autotarget ) registerGroup("AUTOTARGET");
}


// ----- NOTE: Patching helper functions ----- //
export const REG_TRACKER = {};
const GROUPINGS = new Set();

/**
 * Helper to wrap/mix/override methods.
 * @param {string} method       Method to wrap
 * @param {function} fn         Function to use for the wrap
 * @param {object} [options]    Options passed to libWrapper.register. E.g., { perf_mode: libWrapper.PERF_FAST}
 * @returns {number} libWrapper ID
 */
function wrap(method, fn, options = {}) {
  return libWrapper.register(MODULE_ID, method, fn, libWrapper.WRAPPER, options);
}

// Currently unused
// function mixed(method, fn, options = {}) {
//   return libWrapper.register(MODULE_ID, method, fn, libWrapper.MIXED, options);
// }

function override(method, fn, options = {}) {
  return libWrapper.register(MODULE_ID, method, fn, libWrapper.OVERRIDE, options);
}


/**
 * A thorough lookup method to locate Foundry classes by name.
 * Relies on CONFIG where possible, falling back on eval otherwise.
 * @param {string} className
 * @param {object} [opts]
 * @param {boolean} [opts.returnPathString]   Return a string path to the object, for libWrapper.
 * @returns {class}
 */
function lookupByClassName(className, { returnPathString = false } = {}) {
  let isDoc = className.endsWith("Document");
  let isConfig = className.endsWith("Config");
  let baseClass = isDoc ? className.replace("Document", "") : isConfig ? className.replace("Config", "") : className;

  const configObj = CONFIG[baseClass];
  if ( !configObj || isConfig ) return returnPathString ? className : eval?.(`"use strict";(${className})`);

  // Do this the hard way to catch inconsistencies
  switch ( className ) {
    case "Actor":
    case "ActiveEffect":
    case "Item":
      isDoc = true; break;
  }

  if ( isDoc && configObj.documentClass ) {
    return returnPathString ? `CONFIG.${baseClass}.documentClass` : configObj.documentClass;
  }

  if ( configObj.objectClass ) return returnPathString ? `CONFIG.${baseClass}.objectClass` : configObj.objectClass;
  return returnPathString ? className : eval?.(`"use strict";(${className})`);
}

/**
 * Helper to add a method or a getter to a class.
 * @param {class} cl      Either Class.prototype or Class
 * @param {string} name   Name of the method
 * @param {function} fn   Function to use for the method
 * @param {object} [opts] Optional parameters
 * @param {boolean} [opts.getter]     True if the property should be made a getter.
 * @param {boolean} [opts.optional]   True if the getter should not be set if it already exists.
 * @returns {undefined|string} Either undefined if the getter already exists or the cl.prototype.name.
 */
function addClassMethod(cl, name, fn, { getter = false, optional = false } = {}) {
  if ( optional && Object.hasOwn(cl, name) ) return undefined;
  const descriptor = { configurable: true };
  if ( getter ) descriptor.get = fn;
  else {
    descriptor.writable = true;
    descriptor.value = fn;
  }
  Object.defineProperty(cl, name, descriptor);

  const prototypeName = cl.constructor?.name;
  return `${prototypeName ?? cl.name }.${prototypeName ? "prototype." : ""}${name}`; // eslint-disable-line template-curly-spacing
}

/**
 * Wrapper to add a hook, b/c calling Hooks.on directly with a decorator does not work.
 */
function addHook(hookName, hookFn) { return Hooks.on(hookName, hookFn); }

function registerWraps(wraps, groupName, className, { prototype = true, override = false } = {}) {
  className = lookupByClassName(className, { returnPathString: true });
  if ( prototype ) className = `${className}.prototype`;
  const wrapFn = override ? "regOverride" : "regWrap";
  for ( const [name, fn] of Object.entries(wraps) ) {
    const methodName = `${className}.${name}`;
    REG_TRACKER[groupName][wrapFn](methodName, fn, { perf_mode: libWrapper.PERF_FAST });
  }
}

function registerMethods(methods, groupName, className, { prototype = true, getter = false } = {}) {
  let cl = lookupByClassName(className);
  if ( prototype ) cl = cl.prototype;
  for ( const [name, fn] of Object.entries(methods) ) {
    REG_TRACKER[groupName].regMethod(cl, name, fn, { getter });
  }
}

function registerHooks(hooks, groupName) {
  for ( const [name, fn] of Object.entries(hooks) ) {
    REG_TRACKER[groupName].regHook(name, fn);
  }
}

/**
 * Register all of a given group of patches.
 */
function registerGroup(groupName) {
  for ( const className of Object.keys(PATCHES) ) registerGroupForClass(className, groupName);
}

/**
 * Decorator to register and record a patch, method, or hook.
 * @param {function} fn   A registration function that returns an id. E.g., libWrapper or Hooks.on.
 * @param {Map} map       The map in which to store the id along with the arguments used when registering.
 * @returns {number} The id
 */
function regDec(fn, map) {
  return function() {
    const id = fn.apply(this, arguments);
    map.set(id, arguments);
    return id;
  };
}

/**
 * For a given group of patches, register all of them.
 */
function registerGroupForClass(className, groupName) {
  const grp = PATCHES[className][groupName];
  if ( !grp ) return;
  for ( const [key, obj] of Object.entries(grp) ) {
    const prototype = !key.includes("STATIC");
    let override = false;
    let getter = false;
    switch ( key ) {
      case "HOOKS": registerHooks(obj, groupName); break;
      case "STATIC_OVERRIDES":
      case "OVERRIDES":
        override = true;
      case "STATIC_WRAPS": // eslint-disable-line no-fallthrough
      case "WRAPS":
        registerWraps(obj, groupName, className, { override, prototype });
        break;
      case "STATIC_GETTERS":
      case "GETTERS":
        getter = true;
      default:  // eslint-disable-line no-fallthrough
        registerMethods(obj, groupName, className, { prototype, getter });
    }
  }
}

/**
 * Deregister wrappers on-the-fly.
 */
function deregisterPatches(map) {
  map.forEach((_args, id) => libWrapper.unregister(MODULE_ID, id, false));
  map.clear();
}

function deregisterHooks(map) {
  map.forEach((args, id) => {
    const hookName = args[0];
    Hooks.off(hookName, id);
  });
  map.clear();
}

function deregisterMethods(map) {
  map.forEach((args, _id) => {
    const cl = args[0];
    const name = args[1];
    delete cl[name];
  });
  map.clear();
}

function deregisterGroup(groupName) {
  const regObj = REG_TRACKER[groupName];
  deregisterPatches(regObj.PATCHES);
  deregisterMethods(regObj.METHODS);
  deregisterHooks(regObj.HOOKS);
}

function initializeRegistrationTracker() {
  // Determine all the relevant groupings.
  GROUPINGS.clear();
  Object.values(PATCHES).forEach(obj => Object.keys(obj).forEach(k => GROUPINGS.add(k)));

  // Decorate each group type and create one per option.
  for ( const key of GROUPINGS ) {
    const regObj = REG_TRACKER[key] = {};
    regObj.PATCHES = new Map();
    regObj.METHODS = new Map();
    regObj.HOOKS = new Map();

    regObj.regWrap = regDec(wrap, regObj.PATCHES);
    regObj.regOverride = regDec(override, regObj.PATCHES);
    regObj.regMethod = regDec(addClassMethod, regObj.METHODS);
    regObj.regHook = regDec(addHook, regObj.HOOKS);
  }
}

