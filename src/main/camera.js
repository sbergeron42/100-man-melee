/* eslint-disable */
import {player, playerType, ports, fg1, fg2, bg2, ui, layers} from "main/main";
import {activeStage} from "stages/activeStage";

// Camera state
let cameraX = 0; // in game units
let cameraY = 0;
let targetX = 0;
let targetY = 0;
const LERP = 0.08; // smooth follow speed
const CANVAS_W = 1200;
const CANVAS_H = 750;

// The "default" offset is what the stage uses for its center
// We compute camera offset relative to that
let baseOffsetX = 600;
let baseOffsetY = 480;

export let cameraEnabled = false;

// Spectator mode: follow a different player when eliminated
let spectateTarget = 0;
export function getSpectateTarget() { return spectateTarget; }

export function spectateNext() {
  var start = spectateTarget;
  for (var n = 1; n < ports; n++) {
    var idx = (start + n) % ports;
    if (playerType[idx] > -1 && player[idx] && player[idx].stocks > 0) {
      spectateTarget = idx;
      return;
    }
  }
}

export function spectatePrev() {
  var start = spectateTarget;
  for (var n = 1; n < ports; n++) {
    var idx = (start - n + ports) % ports;
    if (playerType[idx] > -1 && player[idx] && player[idx].stocks > 0) {
      spectateTarget = idx;
      return;
    }
  }
}

export function resetSpectate() {
  spectateTarget = 0;
}

export function enableCamera() {
  cameraEnabled = true;
}

export function disableCamera() {
  cameraEnabled = false;
  cameraX = 0;
  cameraY = 0;
}

window.enableCamera = enableCamera;
window.disableCamera = disableCamera;

export function updateCamera(isEliminated) {
  if (!cameraEnabled) return;

  // Follow spectate target when eliminated, otherwise follow P1
  var followIdx = (isEliminated && spectateTarget > 0) ? spectateTarget : 0;
  if (!player[followIdx] || !player[followIdx].phys) return;

  targetX = player[followIdx].phys.pos.x;
  targetY = player[followIdx].phys.pos.y;

  // Smooth follow
  cameraX += (targetX - cameraX) * LERP;
  cameraY += (targetY - cameraY) * LERP;
}

// Get the pixel offset that all rendering should use
// This replaces activeStage.offset for camera-aware rendering
export function getCameraOffset() {
  if (!cameraEnabled) {
    return [activeStage.offset[0], activeStage.offset[1]];
  }
  // Convert camera game position to pixel offset
  // Default offset centers the stage. We shift by camera delta.
  const ox = activeStage.offset[0] - (cameraX * activeStage.scale);
  const oy = activeStage.offset[1] + (cameraY * activeStage.scale);
  return [ox, oy];
}

// Apply camera transform to a canvas context
export function applyCameraTransform(ctx) {
  if (!cameraEnabled) return;
  const ox = -(cameraX * activeStage.scale);
  const oy = (cameraY * activeStage.scale);
  ctx.translate(ox, oy);
}

// Restore camera transform
export function restoreCameraTransform(ctx) {
  if (!cameraEnabled) return;
  const ox = (cameraX * activeStage.scale);
  const oy = -(cameraY * activeStage.scale);
  ctx.translate(ox, oy);
}

// Check if a game-coordinate position is visible on screen
// Works in game units relative to camera position
export function isOnScreen(gameX, gameY) {
  if (!cameraEnabled) return true;
  // Half-viewport size in game units, plus generous margin
  var halfW = (CANVAS_W / activeStage.scale) / 2 + 50;
  var halfH = (CANVAS_H / activeStage.scale) / 2 + 50;
  return Math.abs(gameX - cameraX) < halfW && Math.abs(gameY - cameraY) < halfH;
}
