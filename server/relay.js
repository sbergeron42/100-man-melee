// 100-Man Melee WebSocket Relay Server (agar.io model)
// Usage: node server/relay.js [port]
// No host — server controls game flow automatically.
// Players join, pick character, game auto-starts after countdown.

var WebSocket = require('ws');
var protocol = require('./protocol');
var OP = protocol.OPCODES;
var PHASES = protocol.PHASES;
var STATE_SIZE = protocol.PLAYER_STATE_SIZE;

var PORT = parseInt(process.argv[2]) || 3001;
var BROADCAST_RATE = 50;   // ms between world state broadcasts (20hz)
var MAX_PLAYERS = 100;
var TIMEOUT_MS = 10000;    // disconnect after 10s no data
var MIN_PLAYERS = 2;       // minimum to start
var LOBBY_COUNTDOWN = 3;   // seconds countdown once min players reached
var RESTART_DELAY = 10;    // seconds before restarting after game over

// --- Room State ---
var room = {
  phase: PHASES.LOBBY,
  players: new Map(),    // ws -> PlayerInfo
  playerById: [],        // id -> PlayerInfo
  nextId: 0,
  aliveCount: 0,
  tick: 0,
  broadcastInterval: null,
  countdownTimer: null,
  countdownSeconds: 0,
  restartTimer: null,
};

function PlayerInfo(id, ws) {
  this.id = id;
  this.ws = ws;
  this.character = Math.floor(Math.random() * 5); // random default
  this.state = new Uint8Array(STATE_SIZE);
  this.alive = true;
  this.lastUpdate = Date.now();
  this.ready = false; // selected character
}

// --- Server ---
var wss = new WebSocket.Server({ port: PORT });
console.log('100-Man Melee relay server listening on port ' + PORT);
console.log('Auto-start: ' + LOBBY_COUNTDOWN + 's countdown after ' + MIN_PLAYERS + '+ players join');

wss.on('connection', function(ws) {
  if (room.phase === PHASES.PLAYING) {
    // Game in progress — reject or let them spectate
    var spectate = new Uint8Array(2);
    spectate[0] = OP.WELCOME;
    spectate[1] = 255; // special "spectator" id
    ws.send(spectate);
    ws.close(1000, 'Game in progress, try again soon');
    return;
  }

  if (room.nextId >= MAX_PLAYERS) {
    ws.close(1013, 'Room full');
    return;
  }

  var id = room.nextId++;
  var info = new PlayerInfo(id, ws);
  room.players.set(ws, info);
  room.playerById[id] = info;

  console.log('Player ' + id + ' joined (' + room.players.size + '/' + MAX_PLAYERS + ')');

  // Send WELCOME: [opcode, playerId, playerCount, phase, 0(unused)]
  var welcome = new Uint8Array(5);
  welcome[0] = OP.WELCOME;
  welcome[1] = id;
  welcome[2] = room.players.size;
  welcome[3] = room.phase;
  welcome[4] = 0;
  ws.send(welcome);

  // Broadcast PLAYER_JOINED to others
  var joined = new Uint8Array(3);
  joined[0] = OP.PLAYER_JOINED;
  joined[1] = id;
  joined[2] = room.players.size;
  broadcast(joined, ws);

  // Check if we should start countdown
  checkAutoStart();

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
        if (buf.length >= 2) {
          info.character = buf[1];
          info.ready = true;
          // Broadcast char update
          var cu = new Uint8Array(3);
          cu[0] = OP.CHAR_UPDATE;
          cu[1] = id;
          cu[2] = buf[1];
          broadcast(cu);
          console.log('Player ' + id + ' selected character ' + buf[1]);
        }
        break;

      case OP.PLAYER_STATE:
        if (buf.length >= 1 + STATE_SIZE && room.phase === PHASES.PLAYING) {
          for (var i = 0; i < STATE_SIZE; i++) {
            info.state[i] = buf[1 + i];
          }
        }
        break;

      case OP.PLAYER_DIED:
        if (room.phase === PHASES.PLAYING) {
          info.alive = false;
          var killedBy = buf.length >= 2 ? buf[1] : 255;
          room.aliveCount = countAlive();

          var kf = new Uint8Array(4);
          kf[0] = OP.KILL_FEED;
          kf[1] = id;
          kf[2] = killedBy;
          kf[3] = room.aliveCount;
          broadcastAll(kf);

          console.log('Player ' + id + ' eliminated. Alive: ' + room.aliveCount);

          if (room.aliveCount <= 1) {
            endGame();
          }
        }
        break;

      case OP.HOST_START:
        if (room.phase === PHASES.LOBBY && room.players.size >= MIN_PLAYERS) {
          cancelCountdown();
          startGame();
        }
        break;

      case OP.HIT_EVENT:
        // Relay hit from attacker to victim
        // Format: [opcode, victimServerId, damage(uint16), knockback(uint16), angle(uint16), attackerServerId]
        if (buf.length >= 9 && room.phase === PHASES.PLAYING) {
          var victimId = buf[1];
          var victimInfo = room.playerById[victimId];
          if (victimInfo && victimInfo.ws.readyState === 1) {
            // Forward the hit event to the victim
            victimInfo.ws.send(buf);
          }
        }
        break;

      default:
        break;
    }
  });

  ws.on('close', function() {
    console.log('Player ' + id + ' disconnected (' + (room.players.size - 1) + ' remaining)');
    room.players.delete(ws);
    room.playerById[id] = null;
    info.alive = false;

    // Broadcast player left
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

    // Cancel countdown if not enough players
    if (room.phase === PHASES.LOBBY && room.players.size < MIN_PLAYERS) {
      cancelCountdown();
    }

    // Reset room if empty
    if (room.players.size === 0) {
      resetRoom();
    }
  });
});

// --- Auto-start logic ---

function checkAutoStart() {
  if (room.phase !== PHASES.LOBBY) return;
  if (room.players.size >= MIN_PLAYERS && !room.countdownTimer) {
    startCountdown();
  }
}

function startCountdown() {
  room.countdownSeconds = LOBBY_COUNTDOWN;
  console.log('Starting countdown: ' + room.countdownSeconds + 's');

  // Broadcast countdown start
  broadcastLobbyStatus();

  room.countdownTimer = setInterval(function() {
    room.countdownSeconds--;
    console.log('Countdown: ' + room.countdownSeconds + 's (' + room.players.size + ' players)');
    broadcastLobbyStatus();

    if (room.countdownSeconds <= 0) {
      cancelCountdown();
      startGame();
    }
  }, 1000);
}

function cancelCountdown() {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
    room.countdownSeconds = 0;
    console.log('Countdown cancelled');
  }
}

function broadcastLobbyStatus() {
  // Repurpose CHAR_UPDATE with special ID 255 to send lobby status
  // [opcode=CHAR_UPDATE, id=255, countdown_seconds]
  var status = new Uint8Array(4);
  status[0] = OP.CHAR_UPDATE;
  status[1] = 255; // special: lobby status
  status[2] = room.countdownSeconds;
  status[3] = room.players.size;
  broadcastAll(status);
}

// --- Game flow ---

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

  room.players.forEach(function(info) {
    info.alive = true;
  });

  // Build game start message
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

  console.log('=== GAME STARTED with ' + playerCount + ' players ===');

  // Start world state broadcast
  if (room.broadcastInterval) clearInterval(room.broadcastInterval);
  room.broadcastInterval = setInterval(broadcastWorldState, BROADCAST_RATE);
}

function broadcastWorldState() {
  if (room.phase !== PHASES.PLAYING) return;
  room.tick++;

  // Timeout check
  var now = Date.now();
  room.players.forEach(function(info) {
    if (info.alive && now - info.lastUpdate > TIMEOUT_MS) {
      console.log('Player ' + info.id + ' timed out');
      info.alive = false;
      room.aliveCount = countAlive();
    }
  });

  // Build world state
  var activePlayers = [];
  room.players.forEach(function(info) {
    activePlayers.push(info);
  });

  var headerSize = 6;
  var perPlayer = 1 + STATE_SIZE;
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

  var winnerId = 255;
  room.players.forEach(function(info) {
    if (info.alive) winnerId = info.id;
  });

  var go = new Uint8Array(3);
  go[0] = OP.GAME_OVER;
  go[1] = winnerId;
  go[2] = room.aliveCount;
  broadcastAll(go);

  console.log('=== GAME OVER! Winner: Player ' + winnerId + ' ===');

  // Auto-restart after delay
  room.restartTimer = setTimeout(function() {
    console.log('Restarting room...');
    room.phase = PHASES.LOBBY;
    room.nextId = 0;
    var reassignId = 0;
    room.players.forEach(function(info) {
      info.id = reassignId++;
      info.alive = true;
      info.ready = false;
      // Send new WELCOME
      var welcome = new Uint8Array(5);
      welcome[0] = OP.WELCOME;
      welcome[1] = info.id;
      welcome[2] = room.players.size;
      welcome[3] = room.phase;
      welcome[4] = 0;
      info.ws.send(welcome);
    });
    room.nextId = reassignId;
    room.playerById = [];
    room.players.forEach(function(info) {
      room.playerById[info.id] = info;
    });
    console.log('Room reset. ' + room.players.size + ' players in lobby.');
    checkAutoStart();
  }, RESTART_DELAY * 1000);
}

function resetRoom() {
  room.phase = PHASES.LOBBY;
  room.nextId = 0;
  room.aliveCount = 0;
  room.tick = 0;
  room.playerById = [];
  cancelCountdown();
  if (room.broadcastInterval) {
    clearInterval(room.broadcastInterval);
    room.broadcastInterval = null;
  }
  if (room.restartTimer) {
    clearTimeout(room.restartTimer);
    room.restartTimer = null;
  }
  console.log('Room empty, reset');
}
