/* globals
Hooks
*/
"use strict";

export class UserCloneTargets extends Set {
  constructor(user) {
    super();
    if ( user.cloneTargets ) throw new Error(`User ${user.id} already has a clone targets set defined`);
    this.user = user;
  }

  /**
   * Return the Token IDs which are user targets
   * @type {string[]}
   */
  get ids() {
    return Array.from(this).map(t => t.id);
  }

  /** @override */
  add(token) {
    if ( this.has(token) ) return this;
    super.add(token);
    this.#hook(token, true);
    return this;
  }

  /** @override */
  clear() {
    const tokens = Array.from(this);
    super.clear();
    tokens.forEach(t => this.#hook(t, false));
  }

  /** @override */
  delete(token) {
    if ( !this.has(token) ) return false;
    super.delete(token);
    this.#hook(token, false);
    return true;
  }

  /**
   * Dispatch the targetToken hook whenever the user's target set changes.
   * @param {Token} token        The targeted Token
   * @param {boolean} targeted   Whether the Token has been targeted or untargeted
   */
  #hook(token, targeted) {
    Hooks.callAll("cloneTargetToken", this.user, token, targeted);
  }
}
