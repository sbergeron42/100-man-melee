/* eslint-disable */
import {Vec2D} from "main/util/Vec2D";
export const lostStockQueue = [];
export function resetLostStockQueue() {}
export function rotateVector(vecx, vecy, ang) {
  return new Vec2D(vecx * Math.cos(ang) - vecy * Math.sin(ang), vecx * Math.sin(ang) + vecy * Math.cos(ang));
}
export function renderForeground() {}
export function renderPlayer() {}
export function renderOverlay() {}
export const hurtboxColours = [];
export const twoPi = Math.PI * 2;
export function drawArrayPathCompress() {}
