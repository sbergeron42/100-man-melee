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

// Callbacks
export var onWelcome = null;      // function(playerId, playerCount, isHost)
export var onPlayerJoined = null; // function(playerId, playerCount)
export var onPlayerLeft = null;   // function(playerId, playerCount)
export var onCharUpdate = null;   // function(playerId, charId)
export var onGameStart = null;    // function(playerList: [{id, character}])
export var onWorldState = null;   // function(states, aliveCount)
export var onKillFeed = null;     // function(victimId, killerId, aliveCount)
export var onGameOver = null;     // function(winnerId)
export var lobbyCountdown = 0;    // seconds until auto-start

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
      if (onWelcome) onWelcome(localPlayerId, roomPlayerCount, isHost);
      break;

    case OP.PLAYER_JOINED:
      roomPlayerCount = buf[2];
      console.log('Player ' + buf[1] + ' joined. Total: ' + roomPlayerCount);
      if (onPlayerJoined) onPlayerJoined(buf[1], roomPlayerCount);
      break;

    case OP.PLAYER_LEFT:
      roomPlayerCount = buf[2];
      var leftId = buf[1];
      delete remoteStates[leftId];
      delete remoteCharacters[leftId];
      console.log('Player ' + leftId + ' left. Total: ' + roomPlayerCount);
      if (onPlayerLeft) onPlayerLeft(leftId, roomPlayerCount);
      break;

    case OP.CHAR_UPDATE:
      if (buf[1] === 255) {
        // Special: lobby status message [opcode, 255, countdown, playerCount]
        lobbyCountdown = buf[2];
        roomPlayerCount = buf[3];
        break;
      }
      remoteCharacters[buf[1]] = buf[2];
      if (onCharUpdate) onCharUpdate(buf[1], buf[2]);
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
      if (onGameStart) onGameStart(playerList);
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

      if (onWorldState) onWorldState(remoteStates, aliveCount);
      break;

    case OP.KILL_FEED:
      aliveCount = buf[3];
      if (onKillFeed) onKillFeed(buf[1], buf[2], aliveCount);
      break;

    case OP.GAME_OVER:
      gamePhase = PHASES.GAMEOVER;
      console.log('Game Over! Winner: Player ' + buf[1]);
      if (onGameOver) onGameOver(buf[1]);
      break;

    default:
      break;
  }
}

// Get interpolated state for a remote player
export function getInterpolatedState(id) {
  var rs = remoteStates[id];
  if (!rs) return null;

  var now = Date.now();
  var dt = rs.timestamp - rs.prevTimestamp;
  if (dt <= 0) return rs.current;

  var alpha = Math.min((now - rs.timestamp) / dt, 1.5); // clamp to avoid overshooting
  var cur = rs.current;
  var prev = rs.previous;

  return {
    x: prev.x + (cur.x - prev.x) * alpha,
    y: prev.y + (cur.y - prev.y) * alpha,
    actionState: cur.actionState,
    timer: cur.timer,
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
