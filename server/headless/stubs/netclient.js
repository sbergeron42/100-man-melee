/* eslint-disable */
export function connectToServer() {}
export function disconnectFromServer() {}
export function isConnected() { return false; }
export function getLocalPlayerId() { return -1; }
export function getIsHost() { return false; }
export function getGamePhase() { return 0; }
export function getAliveCount() { return 0; }
export function getRemoteStates() { return {}; }
export function getInterpolatedState() { return null; }
export function sendPlayerState() {}
export function sendCharacterSelect() {}
export function sendHostStart() {}
export function sendPlayerDied() {}
export function sendHitEvent() {}
export function getRoomPlayerCount() { return 0; }
export function getRemoteCharacter() { return 0; }
export let lobbyCountdown = 0;
export const callbacks = {};
