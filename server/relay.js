// 100-Man Melee WebSocket Relay Server
// Usage: node server/relay.js [--port 8080]

var WebSocket = require('ws');
var protocol = require('./protocol');
var OP = protocol.OPCODES;
var PHASES = protocol.PHASES;
var STATE_SIZE = protocol.PLAYER_STATE_SIZE;

var PORT = parseInt(process.argv[2]) || 8080;
var BROADCAST_RATE = 50; // ms between world state broadcasts (20hz)
var MAX_PLAYERS = 100;
var TIMEOUT_MS = 10000; // disconnect after 10s no data

// --- Room State ---
var room = {
  phase: PHASES.LOBBY,
  players: new Map(), // ws -> PlayerInfo
  playerById: [],     // id -> PlayerInfo
  nextId: 0,
  hostWs: null,
  aliveCount: 0,
  tick: 0,
  broadcastInterval: null,
};

function PlayerInfo(id, ws) {
  this.id = id;
  this.ws = ws;
  this.character = 0;
  this.state = new Uint8Array(STATE_SIZE); // latest state buffer
  this.alive = true;
  this.lastUpdate = Date.now();
  this.ready = false;
}

// --- Server ---
var wss = new WebSocket.Server({ port: PORT });
console.log('100-Man Melee relay server listening on port ' + PORT);

wss.on('connection', function(ws) {
  if (room.nextId >= MAX_PLAYERS) {
    ws.close(1013, 'Room full');
    return;
  }

  var id = room.nextId++;
  var info = new PlayerInfo(id, ws);
  room.players.set(ws, info);
  room.playerById[id] = info;

  if (room.hostWs === null) {
    room.hostWs = ws;
    console.log('Player ' + id + ' joined as HOST');
  } else {
    console.log('Player ' + id + ' joined');
  }

  // Send WELCOME: [opcode, playerId, playerCount, phase, isHost]
  var welcome = new Uint8Array(5);
  welcome[0] = OP.WELCOME;
  welcome[1] = id;
  welcome[2] = room.players.size;
  welcome[3] = room.phase;
  welcome[4] = ws === room.hostWs ? 1 : 0;
  ws.send(welcome);

  // Broadcast PLAYER_JOINED to others: [opcode, playerId, playerCount]
  var joined = new Uint8Array(3);
  joined[0] = OP.PLAYER_JOINED;
  joined[1] = id;
  joined[2] = room.players.size;
  broadcast(joined, ws);

  ws.on('message', function(data) {
    var buf;
    if (data instanceof ArrayBuffer) {
      buf = new Uint8Array(data);
    } else if (data instanceof Buffer) {
      buf = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else {
      return;
    }
    if (buf.length < 1) return;

    var opcode = buf[0];
    info.lastUpdate = Date.now();

    switch (opcode) {
      case OP.CHAR_SELECT:
        // [opcode, charId]
        if (buf.length >= 2) {
          info.character = buf[1];
          info.ready = true;
          // Broadcast char update: [opcode, playerId, charId]
          var cu = new Uint8Array(3);
          cu[0] = OP.CHAR_UPDATE;
          cu[1] = id;
          cu[2] = buf[1];
          broadcast(cu);
        }
        break;

      case OP.HOST_START:
        if (ws === room.hostWs && room.phase !== PHASES.PLAYING) {
          startGame();
        }
        break;

      case OP.PLAYER_STATE:
        // [opcode, ...18 bytes of state]
        if (buf.length >= 1 + STATE_SIZE) {
          for (var i = 0; i < STATE_SIZE; i++) {
            info.state[i] = buf[1 + i];
          }
        }
        break;

      case OP.PLAYER_DIED:
        // [opcode, killedBy]
        if (room.phase === PHASES.PLAYING) {
          info.alive = false;
          var killedBy = buf.length >= 2 ? buf[1] : 255;
          room.aliveCount = countAlive();

          // Broadcast kill feed: [opcode, victimId, killerId, aliveCount]
          var kf = new Uint8Array(4);
          kf[0] = OP.KILL_FEED;
          kf[1] = id;
          kf[2] = killedBy;
          kf[3] = room.aliveCount;
          broadcast(kf);

          console.log('Player ' + id + ' eliminated. Alive: ' + room.aliveCount);

          if (room.aliveCount <= 1) {
            endGame();
          }
        }
        break;

      default:
        break;
    }
  });

  ws.on('close', function() {
    console.log('Player ' + id + ' disconnected');
    room.players.delete(ws);
    room.playerById[id] = null;
    info.alive = false;

    if (ws === room.hostWs) {
      // Transfer host
      room.hostWs = null;
      room.players.forEach(function(p) {
        if (room.hostWs === null) room.hostWs = p.ws;
      });
      if (room.hostWs) {
        console.log('Host transferred to player ' + room.players.get(room.hostWs).id);
      }
    }

    // Broadcast player left: [opcode, playerId, playerCount]
    var left = new Uint8Array(3);
    left[0] = OP.PLAYER_LEFT;
    left[1] = id;
    left[2] = room.players.size;
    broadcast(left);

    if (room.phase === PHASES.PLAYING) {
      room.aliveCount = countAlive();
      if (room.aliveCount <= 1) {
        endGame();
      }
    }

    // Reset room if empty
    if (room.players.size === 0) {
      resetRoom();
    }
  });
});

function broadcast(data, excludeWs) {
  room.players.forEach(function(info) {
    if (info.ws !== excludeWs && info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(data);
    }
  });
}

function broadcastAll(data) {
  room.players.forEach(function(info) {
    if (info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(data);
    }
  });
}

function countAlive() {
  var count = 0;
  room.players.forEach(function(info) {
    if (info.alive) count++;
  });
  return count;
}

function startGame() {
  room.phase = PHASES.PLAYING;
  room.aliveCount = room.players.size;
  room.tick = 0;

  // Mark all players alive
  room.players.forEach(function(info) {
    info.alive = true;
  });

  // Build game start message: [opcode, playerCount, ...for each: playerId, charId]
  var playerCount = room.players.size;
  var gs = new Uint8Array(2 + playerCount * 2);
  gs[0] = OP.GAME_START;
  gs[1] = playerCount;
  var idx = 2;
  room.players.forEach(function(info) {
    gs[idx] = info.id;
    gs[idx + 1] = info.character;
    idx += 2;
  });
  broadcastAll(gs);

  console.log('Game started with ' + playerCount + ' players');

  // Start world state broadcast loop
  if (room.broadcastInterval) clearInterval(room.broadcastInterval);
  room.broadcastInterval = setInterval(broadcastWorldState, BROADCAST_RATE);
}

function broadcastWorldState() {
  if (room.phase !== PHASES.PLAYING) return;
  room.tick++;

  // Check for timeouts
  var now = Date.now();
  room.players.forEach(function(info) {
    if (info.alive && now - info.lastUpdate > TIMEOUT_MS) {
      console.log('Player ' + info.id + ' timed out');
      info.alive = false;
      room.aliveCount = countAlive();
    }
  });

  // Build world state: [opcode, playerCount, tickHi, tickLo, phase, aliveCount, ...per player: id + 18 bytes]
  var activePlayers = [];
  room.players.forEach(function(info) {
    activePlayers.push(info);
  });

  var headerSize = 6;
  var perPlayer = 1 + STATE_SIZE; // 1 byte id + 18 bytes state
  var buf = new Uint8Array(headerSize + activePlayers.length * perPlayer);

  buf[0] = OP.WORLD_STATE;
  buf[1] = activePlayers.length;
  buf[2] = (room.tick >> 8) & 0xFF;
  buf[3] = room.tick & 0xFF;
  buf[4] = room.phase;
  buf[5] = room.aliveCount;

  var off = headerSize;
  for (var i = 0; i < activePlayers.length; i++) {
    buf[off] = activePlayers[i].id;
    for (var j = 0; j < STATE_SIZE; j++) {
      buf[off + 1 + j] = activePlayers[i].state[j];
    }
    off += perPlayer;
  }

  broadcastAll(buf);
}

function endGame() {
  room.phase = PHASES.GAMEOVER;
  if (room.broadcastInterval) {
    clearInterval(room.broadcastInterval);
    room.broadcastInterval = null;
  }

  // Find winner
  var winnerId = 255;
  room.players.forEach(function(info) {
    if (info.alive) winnerId = info.id;
  });

  // Broadcast game over: [opcode, winnerId, aliveCount]
  var go = new Uint8Array(3);
  go[0] = OP.GAME_OVER;
  go[1] = winnerId;
  go[2] = room.aliveCount;
  broadcastAll(go);

  console.log('Game over! Winner: Player ' + winnerId);

  // Return to lobby after 10 seconds
  setTimeout(function() {
    room.phase = PHASES.LOBBY;
    room.nextId = 0;
    var reassignId = 0;
    room.players.forEach(function(info) {
      info.id = reassignId++;
      info.alive = true;
      info.ready = false;
      // Send new WELCOME with reassigned ID
      var welcome = new Uint8Array(5);
      welcome[0] = OP.WELCOME;
      welcome[1] = info.id;
      welcome[2] = room.players.size;
      welcome[3] = room.phase;
      welcome[4] = info.ws === room.hostWs ? 1 : 0;
      info.ws.send(welcome);
    });
    room.nextId = reassignId;
    room.playerById = [];
    room.players.forEach(function(info) {
      room.playerById[info.id] = info;
    });
    console.log('Room reset to lobby');
  }, 10000);
}

function resetRoom() {
  room.phase = PHASES.LOBBY;
  room.nextId = 0;
  room.hostWs = null;
  room.aliveCount = 0;
  room.tick = 0;
  room.playerById = [];
  if (room.broadcastInterval) {
    clearInterval(room.broadcastInterval);
    room.broadcastInterval = null;
  }
  console.log('Room empty, reset');
}
