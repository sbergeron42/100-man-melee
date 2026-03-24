/* eslint-disable */
// 100-Man Melee WebSocket Client
import {OPCODES, PHASES, PLAYER_STATE_SIZE, ACTION_STATE_MAP, ACTION_STATE_LIST, encodePlayerState, decodePlayerState} from "./protocol";
import {player, playerType, characterSelections, ports, pPal, palettes} from "../main";

var OP = OPCODES;
var ws = null;
var localPlayerId = -1;
var isHost = false;
var roomPlayerCount = 0;
var gamePhase = PHASES.LOBBY;
var aliveCount = 0;

// Remote player state buffers (for interpolation)
var remoteStates = {};      // id -> {current, previous, timestamp}
var remoteCharacters = {};  // id -> charId

// Callbacks — use object so external code can set them
export var callbacks = {
  onWelcome: null,
  onPlayerJoined: null,
  onPlayerLeft: null,
  onCharUpdate: null,
  onGameStart: null,
  onWorldState: null,
  onKillFeed: null,
  onGameOver: null,
};
export var lobbyCountdown = 0;

export function connectToServer(url) {
  if (ws) ws.close();

  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  ws.onopen = function() {
    console.log('Connected to relay server');
    // Send JOIN: [opcode]
    var join = new Uint8Array(1);
    join[0] = OP.JOIN;
    ws.send(join);
  };

  ws.onmessage = function(event) {
    var buf = new Uint8Array(event.data);
    if (buf.length < 1) return;
    handleMessage(buf);
  };

  ws.onclose = function() {
    console.log('Disconnected from relay server');
    ws = null;
    localPlayerId = -1;
    gamePhase = PHASES.LOBBY;
  };

  ws.onerror = function(err) {
    console.log('WebSocket error:', err);
  };
}

export function disconnectFromServer() {
  if (ws) ws.close();
  ws = null;
  localPlayerId = -1;
}

export function isConnected() {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getLocalPlayerId() {
  return localPlayerId;
}

export function getIsHost() {
  return isHost;
}

export function getGamePhase() {
  return gamePhase;
}

export function getAliveCount() {
  return aliveCount;
}

export function getRoomPlayerCount() {
  return roomPlayerCount;
}

export function getRemoteStates() {
  return remoteStates;
}

export function getRemoteCharacter(id) {
  return remoteCharacters[id] !== undefined ? remoteCharacters[id] : 0;
}

// Send local player state to server
export function sendPlayerState(playerIndex) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!player[playerIndex] || !player[playerIndex].phys) return;

  var p = player[playerIndex];
  var state = {
    x: p.phys.pos.x,
    y: p.phys.pos.y,
    actionState: p.actionState,
    timer: p.timer,
    face: p.phys.face,
    percent: Math.floor(p.percent),
    stocks: p.stocks,
    character: characterSelections[playerIndex],
    velX: p.phys.cVel.x,
    velY: p.phys.cVel.y,
    grounded: p.phys.grounded,
    shielding: p.phys.shielding,
    palette: pPal[playerIndex] || 0,
  };

  var buf = new Uint8Array(1 + PLAYER_STATE_SIZE);
  buf[0] = OP.PLAYER_STATE;
  encodePlayerState(state, buf, 1);
  ws.send(buf);
}

export function sendCharacterSelect(charId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  var buf = new Uint8Array(2);
  buf[0] = OP.CHAR_SELECT;
  buf[1] = charId;
  ws.send(buf);
}

export function sendHostStart() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  var buf = new Uint8Array(1);
  buf[0] = OP.HOST_START;
  ws.send(buf);
}

export function sendPlayerDied(killedBy) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  var buf = new Uint8Array(2);
  buf[0] = OP.PLAYER_DIED;
  buf[1] = killedBy >= 0 ? killedBy : 255;
  ws.send(buf);
}

// --- Message Handling ---

function handleMessage(buf) {
  var opcode = buf[0];

  switch (opcode) {
    case OP.WELCOME:
      localPlayerId = buf[1];
      roomPlayerCount = buf[2];
      gamePhase = buf[3];
      isHost = buf[4] === 1;
      console.log('Welcome! Player ID: ' + localPlayerId + ', Host: ' + isHost + ', Players: ' + roomPlayerCount);
      if (callbacks.onWelcome) callbacks.onWelcome(localPlayerId, roomPlayerCount, isHost);
      break;

    case OP.PLAYER_JOINED:
      roomPlayerCount = buf[2];
      console.log('Player ' + buf[1] + ' joined. Total: ' + roomPlayerCount);
      if (callbacks.onPlayerJoined) callbacks.onPlayerJoined(buf[1], roomPlayerCount);
      break;

    case OP.PLAYER_LEFT:
      roomPlayerCount = buf[2];
      var leftId = buf[1];
      delete remoteStates[leftId];
      delete remoteCharacters[leftId];
      console.log('Player ' + leftId + ' left. Total: ' + roomPlayerCount);
      if (callbacks.onPlayerLeft) callbacks.onPlayerLeft(leftId, roomPlayerCount);
      break;

    case OP.CHAR_UPDATE:
      if (buf[1] === 255) {
        // Special: lobby status message [opcode, 255, countdown, playerCount]
        lobbyCountdown = buf[2];
        roomPlayerCount = buf[3];
        break;
      }
      remoteCharacters[buf[1]] = buf[2];
      if (callbacks.onCharUpdate) callbacks.onCharUpdate(buf[1], buf[2]);
      break;

    case OP.GAME_START:
      gamePhase = PHASES.PLAYING;
      var playerCount = buf[1];
      var playerList = [];
      for (var i = 0; i < playerCount; i++) {
        var pid = buf[2 + i * 2];
        var charId = buf[3 + i * 2];
        playerList.push({id: pid, character: charId});
        remoteCharacters[pid] = charId;
      }
      console.log('Game starting with ' + playerCount + ' players');
      if (callbacks.onGameStart) callbacks.onGameStart(playerList);
      break;

    case OP.WORLD_STATE:
      var count = buf[1];
      var tick = (buf[2] << 8) | buf[3];
      gamePhase = buf[4];
      aliveCount = buf[5];
      var now = Date.now();
      var headerSize = 6;
      var perPlayer = 1 + PLAYER_STATE_SIZE;

      for (var i = 0; i < count; i++) {
        var off = headerSize + i * perPlayer;
        var pid = buf[off];
        if (pid === localPlayerId) continue; // skip self

        var state = decodePlayerState(buf, off + 1);
        if (!remoteStates[pid]) {
          remoteStates[pid] = {current: state, previous: state, timestamp: now, prevTimestamp: now};
        } else {
          remoteStates[pid].previous = remoteStates[pid].current;
          remoteStates[pid].prevTimestamp = remoteStates[pid].timestamp;
          remoteStates[pid].current = state;
          remoteStates[pid].timestamp = now;
        }
      }

      if (callbacks.onWorldState) callbacks.onWorldState(remoteStates, aliveCount);
      break;

    case OP.KILL_FEED:
      aliveCount = buf[3];
      if (callbacks.onKillFeed) callbacks.onKillFeed(buf[1], buf[2], aliveCount);
      break;

    case OP.GAME_OVER:
      gamePhase = PHASES.GAMEOVER;
      console.log('Game Over! Winner: Player ' + buf[1]);
      if (callbacks.onGameOver) callbacks.onGameOver(buf[1]);
      break;

    default:
      break;
  }
}

// Local animation timers for smooth playback between network updates
var localTimers = {}; // serverId -> {timer, actionState, lastNetTimer}

// Get interpolated state for a remote player
export function getInterpolatedState(id) {
  var rs = remoteStates[id];
  if (!rs) return null;

  var now = Date.now();
  var dt = rs.timestamp - rs.prevTimestamp;
  var cur = rs.current;
  var prev = rs.previous;

  // Position interpolation: smooth between prev and current, allow extrapolation
  var alpha = 1;
  if (dt > 0) {
    alpha = Math.min((now - rs.prevTimestamp) / dt, 2.0);
  }
  var ix = prev.x + (cur.x - prev.x) * alpha;
  var iy = prev.y + (cur.y - prev.y) * alpha;

  // Animation: advance timer locally at ~1 per frame (60fps = +1/frame)
  // Reset when action state changes from network
  if (!localTimers[id]) {
    localTimers[id] = {timer: cur.timer, actionState: cur.actionState, lastNetTimer: cur.timer};
  }
  var lt = localTimers[id];
  if (lt.actionState !== cur.actionState) {
    // Action state changed — snap to network timer
    lt.actionState = cur.actionState;
    lt.timer = cur.timer;
    lt.lastNetTimer = cur.timer;
  } else {
    // Same action state — advance locally, nudge toward network value
    lt.timer += 1;
    // Gently correct toward network timer to prevent drift
    var timerDiff = cur.timer - lt.timer;
    if (Math.abs(timerDiff) > 5) {
      lt.timer = cur.timer; // snap if too far off
    } else {
      lt.timer += timerDiff * 0.1; // gentle nudge
    }
    lt.lastNetTimer = cur.timer;
  }

  return {
    x: ix,
    y: iy,
    actionState: cur.actionState,
    timer: Math.max(1, lt.timer),
    face: cur.face,
    percent: cur.percent,
    stocks: cur.stocks,
    character: cur.character,
    velX: cur.velX,
    velY: cur.velY,
    grounded: cur.grounded,
    shielding: cur.shielding,
    palette: cur.palette,
  };
}

// Expose for debugging
window.netclient = {
  connect: connectToServer,
  disconnect: disconnectFromServer,
  isConnected: isConnected,
  getLocalPlayerId: getLocalPlayerId,
  getRemoteStates: getRemoteStates,
  sendHostStart: sendHostStart,
};
