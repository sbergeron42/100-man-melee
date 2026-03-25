/* eslint-disable */
var handler = { get: function() { return {}; } };
export const vfx = typeof Proxy !== 'undefined' ? new Proxy({}, handler) : {};
export const dVfx = typeof Proxy !== 'undefined' ? new Proxy({}, { get: function() { return function(){}; } }) : {};
export let showVfx = false;
export function isShowSFX() { return false; }
export function toggleShowSFX() {}
