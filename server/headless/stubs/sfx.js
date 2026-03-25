/* eslint-disable */
// No-op sound stub for headless mode
var noop = function() {};
var noopSound = { play: noop, stop: noop, fade: noop, volume: noop, seek: noop, playing: function() { return false; }, _volume: 0 };
var handler = { get: function() { return noopSound; } };
export const sounds = typeof Proxy !== 'undefined' ? new Proxy({}, handler) : {};
export function setCurrentSfxPlayer() {}
export function getCurrentSfxPlayer() { return -1; }
export function resetSfxThrottle() {}
window.changeVolume = function() {};
