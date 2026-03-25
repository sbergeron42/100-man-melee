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
var MAX_PLAYERS = 100;
var TIMEOUT_MS = 10000;    // disconnect after 10s no data
var MIN_PLAYERS = 2;       // minimum to start
var TARGET_PLAYERS = 25;   // server fills remaining slots with AI bots
var LOBBY_COUNTDOWN = 3;   // seconds countdown once min players reached
var RESTART_DELAY = 10;    // seconds before restarting after game over

// Server-side bot simulation
var headless = null;
try {
  headless = require('./headless/dist/headless');
  console.log('Headless physics engine loaded');
} catch(e) {
  console.log('Headless physics engine not found (run npm run build:headless). Bots disabled.');
}
var botRunner = null;
var botInterval = null;
var botPlayerInfos = []; // fake PlayerInfo objects for bots

// Dynamic broadcast rate: scales up as players die off
function getBroadcastRate(aliveCount) {
  if (aliveCount <= 4)  return 16;  // 60hz — near-local feel
  if (aliveCount <= 10) return 20;  // 50hz
  if (aliveCount <= 20) return 22;  // 45hz
  if (aliveCount <= 50) return 25;  // 40hz
  return 33;                         // 30hz — 50+ players
}

function updateBroadcastRate() {
  if (room.phase !== PHASES.PLAYING || !room.broadcastInterval) return;
  var newRate = getBroadcastRate(room.aliveCount);
  if (newRate !== room.currentBroadcastRate) {
    clearInterval(room.broadcastInterval);
    room.broadcastInterval = setInterval(broadcastWorldState, newRate);
    room.currentBroadcastRate = newRate;
    console.log('Broadcast rate: ' + Math.round(1000/newRate) + 'hz (' + newRate + 'ms) for ' + room.aliveCount + ' alive');
  }
}

// --- Room State ---
var room = {
  phase: PHASES.LOBBY,
  players: new Map(),    // ws -> PlayerInfo
  playerById: [],        // id -> PlayerInfo
  nextId: 0,
  aliveCount: 0,
  tick: 0,
  broadcastInterval: null,
  currentBroadcastRate: 0,
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
          updateBroadcastRate();

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
          var hitDamage = (buf[2] << 8) | buf[3];
          var hitKB = (buf[4] << 8) | buf[5];
          var hitAngle = (buf[6] << 8) | buf[7];
          var victimInfo = room.playerById[victimId];
          if (victimInfo && victimInfo.isBot && botRunner) {
            // Apply hit to server-side bot
            botRunner.applyHit(victimInfo.botIndex, hitDamage, hitKB, hitAngle);
          } else if (victimInfo && victimInfo.ws && victimInfo.ws.readyState === 1) {
            // Forward the hit event to human victim
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
    // Remove ghost from headless engine
    if (botRunner) {
      try { botRunner.removeHumanGhost(id); } catch(e) {}
    }

    // Broadcast player left
    var left = new Uint8Array(3);
    left[0] = OP.PLAYER_LEFT;
    left[1] = id;
    left[2] = room.players.size;
    broadcast(left);

    if (room.phase === PHASES.PLAYING) {
      room.aliveCount = countAlive();
      updateBroadcastRate();
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
  for (var bi = 0; bi < botPlayerInfos.length; bi++) {
    if (botPlayerInfos[bi].alive) count++;
  }
  return count;
}

function startGame() {
  room.phase = PHASES.PLAYING;
  room.tick = 0;

  room.players.forEach(function(info) {
    info.alive = true;
  });

  // Spawn server-side AI bots to fill remaining slots
  var humanCount = room.players.size;
  var botCount = 0;
  botPlayerInfos = [];
  if (headless && humanCount < TARGET_PLAYERS) {
    botCount = Math.min(TARGET_PLAYERS - humanCount, MAX_PLAYERS - humanCount);
    botRunner = headless.createBotRunner({ botCount: botCount, stageId: 6 });
    // Create fake PlayerInfo entries for bots (IDs start after human IDs)
    for (var bi = 0; bi < botCount; bi++) {
      var botId = room.nextId++;
      var botState = botRunner.getState(bi);
      var botInfo = {
        id: botId,
        ws: null, // no WebSocket — server-side bot
        character: botState ? botState.character : Math.floor(Math.random() * 5),
        state: new Uint8Array(STATE_SIZE),
        alive: true,
        lastUpdate: Date.now(),
        ready: true,
        isBot: true,
        botIndex: bi,
      };
      botPlayerInfos.push(botInfo);
      room.playerById[botId] = botInfo;
    }
    console.log('Spawned ' + botCount + ' server-side AI bots');

    // Register human players as ghosts in headless engine so bots can hit them
    if (botRunner) {
      room.players.forEach(function(info) {
        botRunner.addHumanGhost(info.id);
      });
    }

    // Blastzone shrink state (mirrors client logic)
    var bzOriginal = botRunner.getBlastzone();
    var bzTickCount = 0;
    var bzShrinkInterval = 3600; // 60fps * 60s = 1 minute
    var bzShrinkCount = 0;

    // Start bot simulation at 60hz
    if (botInterval) clearInterval(botInterval);
    botInterval = setInterval(function() {
      if (room.phase !== PHASES.PLAYING || !botRunner) return;

      // Blastzone shrink (same schedule as client)
      if (bzOriginal) {
        bzTickCount++;
        if (bzTickCount >= bzShrinkInterval) {
          bzTickCount = 0;
          bzShrinkCount++;
          var origW = bzOriginal.maxX - bzOriginal.minX;
          var origH = bzOriginal.maxY - bzOriginal.minY;
          var phase1End = 2, phase1TargetW = 650;
          var phase1TargetH = origH * (phase1TargetW / origW);
          var phase2Rate = 50, minWidth = 200, minHeight = 120;
          var minutes = bzShrinkCount;
          var targetW, targetH;
          if (minutes <= phase1End) {
            var t = minutes / phase1End;
            targetW = origW - t * (origW - phase1TargetW);
            targetH = origH - t * (origH - phase1TargetH);
          } else {
            var extraMinutes = minutes - phase1End;
            targetW = phase1TargetW - extraMinutes * phase2Rate;
            targetH = phase1TargetH - extraMinutes * (phase2Rate * origH / origW);
          }
          targetW = Math.max(targetW, minWidth);
          targetH = Math.max(targetH, minHeight);
          var cx = (bzOriginal.minX + bzOriginal.maxX) / 2;
          var cy = (bzOriginal.minY + bzOriginal.maxY) / 2;
          botRunner.setBlastzone(cx - targetW/2, cy - targetH/2, cx + targetW/2, cy + targetH/2);
          console.log('Headless blastzone shrink #' + bzShrinkCount + ': ' + Math.round(targetW) + 'x' + Math.round(targetH));
        }
      }

      // Feed human positions into headless engine
      room.players.forEach(function(info) {
        if (!info.alive) return;
        var decoded = protocol.decodePlayerState(info.state, 0);
        botRunner.updateHumanGhost(info.id, decoded);
      });

      try { botRunner.tick(); } catch(e) { if (!e._logged) { console.error('Headless tick error:', e.message, e.stack && e.stack.split('\n')[1]); e._logged = true; } }

      // Relay bot-to-human hits as HIT_EVENTs
      var humanHits = botRunner.getHumanHits();
      for (var hi = 0; hi < humanHits.length; hi++) {
        var hit = humanHits[hi];
        var victimInfo = room.playerById[hit.victimServerId];
        if (victimInfo && victimInfo.ws && victimInfo.ws.readyState === 1) {
          // Build HIT_EVENT: [opcode, victimId, dmg_hi, dmg_lo, kb_hi, kb_lo, angle_hi, angle_lo, attackerId]
          var hitBuf = new Uint8Array(9);
          hitBuf[0] = OP.HIT_EVENT;
          hitBuf[1] = hit.victimServerId;
          hitBuf[2] = (hit.damage >> 8) & 0xFF;
          hitBuf[3] = hit.damage & 0xFF;
          hitBuf[4] = (hit.knockback >> 8) & 0xFF;
          hitBuf[5] = hit.knockback & 0xFF;
          hitBuf[6] = (hit.angle >> 8) & 0xFF;
          hitBuf[7] = hit.angle & 0xFF;
          // Find bot's server ID
          var attackerServerId = 255;
          if (hit.attackerBotIndex < botPlayerInfos.length) {
            attackerServerId = botPlayerInfos[hit.attackerBotIndex].id;
          }
          hitBuf[8] = attackerServerId;
          victimInfo.ws.send(hitBuf);
        }
      }

      // Relay grab events to human clients
      var grabEvents = botRunner.getGrabEvents();
      for (var ge = 0; ge < grabEvents.length; ge++) {
        var grab = grabEvents[ge];
        var gVictimInfo = room.playerById[grab.victimServerId];
        if (gVictimInfo && gVictimInfo.ws && gVictimInfo.ws.readyState === 1) {
          var grabBuf = new Uint8Array(3);
          grabBuf[0] = OP.GRAB_EVENT;
          // Find grabber's server ID
          var grabberServerId = 255;
          if (grab.attackerBotIndex < botPlayerInfos.length) {
            grabberServerId = botPlayerInfos[grab.attackerBotIndex].id;
          }
          grabBuf[1] = grabberServerId;
          grabBuf[2] = grab.victimServerId;
          gVictimInfo.ws.send(grabBuf);
        }
      }

      // Relay grab release events
      var releaseEvents = botRunner.getGrabReleaseEvents();
      for (var re = 0; re < releaseEvents.length; re++) {
        var rel = releaseEvents[re];
        var rVictimInfo = room.playerById[rel.victimServerId];
        if (rVictimInfo && rVictimInfo.ws && rVictimInfo.ws.readyState === 1) {
          var relBuf = new Uint8Array(3);
          relBuf[0] = OP.GRAB_RELEASE;
          var relAttackerServerId = 255;
          if (rel.attackerBotIndex < botPlayerInfos.length) {
            relAttackerServerId = botPlayerInfos[rel.attackerBotIndex].id;
          }
          relBuf[1] = relAttackerServerId;
          relBuf[2] = rel.victimServerId;
          rVictimInfo.ws.send(relBuf);
        }
      }

      // Update bot state buffers for world broadcast
      for (var bi2 = 0; bi2 < botPlayerInfos.length; bi2++) {
        if (!botPlayerInfos[bi2].alive) continue;
        var bs = botRunner.getState(bi2);
        if (!bs) continue;
        protocol.encodePlayerState(bs, botPlayerInfos[bi2].state, 0);
        // Check if bot died (fell off stage)
        if (bs.stocks <= 0) {
          botPlayerInfos[bi2].alive = false;
          room.aliveCount = countAlive();
          updateBroadcastRate();
          console.log('Bot ' + botPlayerInfos[bi2].id + ' eliminated. Alive: ' + room.aliveCount);
          if (room.aliveCount <= 1) endGame();
        }
      }
    }, 16); // 60hz
  }

  var totalPlayers = humanCount + botCount;
  room.aliveCount = totalPlayers;

  // Build game start message including bots
  var gs = new Uint8Array(2 + totalPlayers * 2);
  gs[0] = OP.GAME_START;
  gs[1] = totalPlayers;
  var idx = 2;
  room.players.forEach(function(info) {
    gs[idx] = info.id;
    gs[idx + 1] = info.character;
    idx += 2;
  });
  for (var bj = 0; bj < botPlayerInfos.length; bj++) {
    gs[idx] = botPlayerInfos[bj].id;
    gs[idx + 1] = botPlayerInfos[bj].character;
    idx += 2;
  }
  broadcastAll(gs);

  console.log('=== GAME STARTED with ' + totalPlayers + ' players (' + humanCount + ' human, ' + botCount + ' bots) ===');

  // Start world state broadcast with dynamic rate
  if (room.broadcastInterval) clearInterval(room.broadcastInterval);
  var initialRate = getBroadcastRate(room.aliveCount);
  room.currentBroadcastRate = initialRate;
  room.broadcastInterval = setInterval(broadcastWorldState, initialRate);
  console.log('Broadcast rate: ' + Math.round(1000/initialRate) + 'hz (' + initialRate + 'ms) for ' + room.aliveCount + ' alive');
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
      updateBroadcastRate();
    }
  });

  // Build world state (humans + bots)
  var activePlayers = [];
  room.players.forEach(function(info) {
    activePlayers.push(info);
  });
  for (var bi = 0; bi < botPlayerInfos.length; bi++) {
    activePlayers.push(botPlayerInfos[bi]);
  }

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

  // Clean up bot simulation
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  botRunner = null;

  var winnerId = 255;
  room.players.forEach(function(info) {
    if (info.alive) winnerId = info.id;
  });
  // Check bots for winner too
  for (var bw = 0; bw < botPlayerInfos.length; bw++) {
    if (botPlayerInfos[bw].alive) winnerId = botPlayerInfos[bw].id;
  }

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
  room.currentBroadcastRate = 0;
  room.tick = 0;
  room.playerById = [];
  botPlayerInfos = [];
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  botRunner = null;
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
