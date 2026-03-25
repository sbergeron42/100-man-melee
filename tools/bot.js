// Headless bot script for 100-Man Melee load testing
// Usage: node tools/bot.js [count] [serverUrl]
// Example: node tools/bot.js 50 ws://localhost:8080

var WebSocket = require('ws');
var protocol = require('../server/protocol');
var OP = protocol.OPCODES;

var COUNT = parseInt(process.argv[2]) || 10;
var URL = process.argv[3] || 'ws://localhost:8080';
var CHARACTERS = [0, 1, 2, 3, 4];

console.log('Spawning ' + COUNT + ' bots connecting to ' + URL);

var bots = [];

for (var i = 0; i < COUNT; i++) {
  spawnBot(i);
}

function spawnBot(index) {
  var bot = {
    index: index,
    ws: null,
    playerId: -1,
    alive: true,
    x: -200 + Math.random() * 400,
    y: 0.001,
    velX: 0,
    velY: 0,
    character: CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)],
    actionState: 'WAIT',
    timer: 1,
    face: Math.random() < 0.5 ? 1 : -1,
    phase: 0, // 0=walking, 1=jumping, 2=attacking
    phaseTimer: 0,
    sendInterval: null,
    grounded: true,
  };
  bots.push(bot);

  var ws = new WebSocket(URL);
  bot.ws = ws;

  ws.on('open', function() {
    // Server sends WELCOME automatically after connection
  });

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

    switch (opcode) {
      case OP.WELCOME:
        bot.playerId = buf[1];
        console.log('Bot ' + index + ' -> Player ' + bot.playerId);
        // Send character select
        var cs = new Uint8Array(2);
        cs[0] = OP.CHAR_SELECT;
        cs[1] = bot.character;
        ws.send(cs);
        break;

      case OP.GAME_START:
        console.log('Bot ' + index + ' received GAME_START');
        // Start sending state
        if (bot.sendInterval) clearInterval(bot.sendInterval);
        bot.sendInterval = setInterval(function() {
          updateBot(bot);
          sendBotState(bot);
        }, 50); // 20hz
        break;

      case OP.GAME_OVER:
        console.log('Bot ' + index + ' received GAME_OVER');
        if (bot.sendInterval) {
          clearInterval(bot.sendInterval);
          bot.sendInterval = null;
        }
        // Reconnect after a delay
        setTimeout(function() {
          bot.alive = true;
          bot.x = -200 + Math.random() * 400;
          bot.y = 0.001;
          bot.phaseTimer = 0;
          bot.phase = 0;
          bot.timer = 1;
        }, 3000);
        break;

      default:
        break;
    }
  });

  ws.on('close', function() {
    if (bot.sendInterval) clearInterval(bot.sendInterval);
  });

  ws.on('error', function(err) {
    console.log('Bot ' + index + ' error: ' + err.message);
  });
}

function updateBot(bot) {
  bot.phaseTimer++;

  // Simple AI: walk around, occasionally jump and attack
  if (bot.phaseTimer > 60 + Math.random() * 120) {
    bot.phase = Math.floor(Math.random() * 3);
    bot.phaseTimer = 0;
    if (Math.random() < 0.3) bot.face *= -1;
  }

  switch (bot.phase) {
    case 0: // Walking
      bot.velX = bot.face * (0.5 + Math.random() * 0.5);
      bot.x += bot.velX;
      bot.actionState = 'WALK';
      bot.grounded = true;
      break;

    case 1: // Jumping
      if (bot.grounded) {
        bot.velY = 2;
        bot.grounded = false;
        bot.actionState = 'JUMPF';
      }
      bot.velY -= 0.1; // gravity
      bot.y += bot.velY;
      bot.x += bot.face * 0.3;
      if (bot.y <= 0.001) {
        bot.y = 0.001;
        bot.velY = 0;
        bot.grounded = true;
        bot.actionState = 'LANDING';
        bot.phase = 0;
      }
      break;

    case 2: // Attacking
      bot.actionState = ['ATTACKAIRN', 'JAB1', 'FORWARDTILT', 'DOWNSMASH'][Math.floor(Math.random() * 4)];
      bot.grounded = true;
      if (bot.phaseTimer > 20) {
        bot.phase = 0;
        bot.actionState = 'WAIT';
      }
      break;
  }

  // Clamp to stage
  if (bot.x < -200) { bot.x = -200; bot.face = 1; }
  if (bot.x > 200) { bot.x = 200; bot.face = -1; }

  bot.timer += 1;
  if (bot.timer > 60) bot.timer = 1;

  // Random death after 2-8 minutes
  if (bot.alive && Math.random() < 0.00005) {
    bot.alive = false;
    var died = new Uint8Array(2);
    died[0] = OP.PLAYER_DIED;
    died[1] = 255; // no killer
    if (bot.ws.readyState === WebSocket.OPEN) {
      bot.ws.send(died);
    }
    console.log('Bot ' + bot.index + ' (Player ' + bot.playerId + ') died');
    if (bot.sendInterval) {
      clearInterval(bot.sendInterval);
      bot.sendInterval = null;
    }
  }
}

function sendBotState(bot) {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN || !bot.alive) return;

  var state = {
    x: bot.x,
    y: bot.y,
    actionState: bot.actionState,
    timer: bot.timer,
    face: bot.face,
    percent: Math.floor(Math.random() * 50),
    stocks: 1,
    character: bot.character,
    velX: bot.velX,
    velY: bot.velY || 0,
    grounded: bot.grounded,
    shielding: false,
    palette: bot.index % 7,
  };

  var buf = new Uint8Array(1 + protocol.PLAYER_STATE_SIZE);
  buf[0] = OP.PLAYER_STATE;
  protocol.encodePlayerState(state, buf, 1);
  bot.ws.send(buf);
}

// Keep process alive
setInterval(function() {}, 60000);

process.on('SIGINT', function() {
  console.log('Shutting down bots...');
  bots.forEach(function(bot) {
    if (bot.sendInterval) clearInterval(bot.sendInterval);
    if (bot.ws) bot.ws.close();
  });
  process.exit();
});
