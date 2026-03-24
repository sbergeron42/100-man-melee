// Protocol constants for 100-Man Melee networking
// CommonJS module (used by server + bot script)

var OPCODES = {
  JOIN:          0x01, // C->S: join room
  WELCOME:       0x02, // S->C: assigned player ID + room state
  PLAYER_JOINED: 0x03, // S->C: another player joined
  PLAYER_LEFT:   0x04, // S->C: a player disconnected
  CHAR_SELECT:   0x05, // C->S: character selection
  CHAR_UPDATE:   0x06, // S->C: broadcast character selections
  GAME_START:    0x07, // S->C: game begins
  PLAYER_STATE:  0x08, // C->S: per-frame state (18 bytes)
  WORLD_STATE:   0x09, // S->C: batched all-player state
  PLAYER_DIED:   0x0A, // C->S: client reports own death
  KILL_FEED:     0x0B, // S->C: kill event
  GAME_OVER:     0x0C, // S->C: winner announcement
  HOST_START:    0x0D, // C->S: host requests game start
};

var PHASES = {
  LOBBY:      0,
  CHARSELECT: 1,
  PLAYING:    2,
  GAMEOVER:   3,
};

// Action state string -> uint8 mapping for wire format
// Covers all shared states. Unknown states map to WAIT (0).
var ACTION_STATE_LIST = [
  "WAIT",             // 0
  "WALK",             // 1
  "DASH",             // 2
  "RUN",              // 3
  "RUNBRAKE",         // 4
  "RUNTURN",          // 5
  "KNEEBEND",         // 6
  "JUMPF",            // 7
  "JUMPB",            // 8
  "JUMPAERIALF",      // 9
  "JUMPAERIALB",      // 10
  "FALL",             // 11
  "FALLAERIAL",       // 12
  "FALLSPECIAL",      // 13
  "LANDING",          // 14
  "LANDINGFALLSPECIAL",// 15
  "LANDINGATTACKAIRN", // 16
  "LANDINGATTACKAIRF", // 17
  "LANDINGATTACKAIRB", // 18
  "LANDINGATTACKAIRU", // 19
  "LANDINGATTACKAIRD", // 20
  "SQUAT",            // 21
  "SQUATWAIT",        // 22
  "SQUATRV",          // 23
  "TILTTURN",         // 24
  "SMASHTURN",        // 25
  "OTTOTTO",          // 26
  "OTTOTTOWAIT",      // 27
  "GUARD",            // 28
  "GUARDON",          // 29
  "GUARDOFF",         // 30
  "ESCAPEN",          // 31
  "ESCAPEF",          // 32
  "ESCAPEB",          // 33
  "ESCAPEAIR",        // 34
  "ATTACKAIRN",       // 35
  "ATTACKAIRF",       // 36
  "ATTACKAIRB",       // 37
  "ATTACKAIRU",       // 38
  "ATTACKAIRD",       // 39
  "JAB1",             // 40
  "JAB2",             // 41
  "JAB3",             // 42
  "FORWARDTILT",      // 43
  "UPTILT",           // 44
  "DOWNTILT",         // 45
  "FORWARDSMASH",     // 46
  "UPSMASH",          // 47
  "DOWNSMASH",        // 48
  "ATTACKDASH",       // 49
  "GRAB",             // 50
  "CATCHWAIT",        // 51
  "CATCHCUT",         // 52
  "CATCHATTACK",      // 53
  "CAPTUREWAIT",      // 54
  "CAPTURECUT",       // 55
  "CAPTUREDAMAGE",    // 56
  "CAPTUREPULLED",    // 57
  "THROWFORWARD",     // 58
  "THROWBACK",        // 59
  "THROWUP",          // 60
  "THROWDOWN",        // 61
  "DAMAGEN2",         // 62
  "DAMAGEFLYN",       // 63
  "DAMAGEFALL",       // 64
  "DOWNBOUND",        // 65
  "DOWNDAMAGE",       // 66
  "DOWNWAIT",         // 67
  "DOWNSTANDN",       // 68
  "DOWNSTANDF",       // 69
  "DOWNSTANDB",       // 70
  "DOWNATTACK",       // 71
  "TECHN",            // 72
  "TECHF",            // 73
  "TECHB",            // 74
  "TECHU",            // 75
  "WALLJUMP",         // 76
  "WALLDAMAGE",       // 77
  "WALLTECH",         // 78
  "WALLTECHJUMP",     // 79
  "CLIFFCATCH",       // 80
  "CLIFFWAIT",        // 81
  "CLIFFGETUPQUICK",  // 82
  "CLIFFGETUPSLOW",   // 83
  "CLIFFESCAPEQUICK", // 84
  "CLIFFESCAPESLOW",  // 85
  "CLIFFJUMPQUICK",   // 86
  "CLIFFJUMPSLOW",    // 87
  "CLIFFATTACKQUICK", // 88
  "CLIFFATTACKSLOW",  // 89
  "DEADLEFT",         // 90
  "DEADRIGHT",        // 91
  "DEADUP",           // 92
  "DEADDOWN",         // 93
  "REBIRTH",          // 94
  "REBIRTHWAIT",      // 95
  "SLEEP",            // 96
  "ENTRANCE",         // 97
  "PASS",             // 98
  "MISSFOOT",         // 99
  "SHIELDBREAKFALL",  // 100
  "SHIELDBREAKSTAND", // 101
  "SHIELDBREAKDOWNBOUND", // 102
  "FURAFURA",         // 103
  "FURASLEEPSTART",   // 104
  "FURASLEEPLOOP",    // 105
  "FURASLEEPEND",     // 106
  "STOPCEIL",         // 107
  "APPEAL",           // 108
  "REBOUND",          // 109
  // Character-specific specials (shared indices for all chars)
  "NEUTRALSPECIALGROUND", // 110
  "NEUTRALSPECIALAIR",    // 111
  "SIDESPECIALGROUND",    // 112
  "SIDESPECIALAIR",       // 113
  "UPSPECIALCHARGE",      // 114
  "UPSPECIALLAUNCH",      // 115
  "UPSPECIAL",            // 116
  "DOWNSPECIALGROUNDSTART",// 117
  "DOWNSPECIALAIRSTART",  // 118
  "DOWNSPECIALGROUNDLOOP",// 119
  "DOWNSPECIALAIRLOOP",   // 120
  "DOWNSPECIALGROUNDEND", // 121
  "DOWNSPECIALAIREND",    // 122
  "DOWNSPECIALGROUND",    // 123
  "DOWNSPECIALAIR",       // 124
  "FIREFOXBOUNCE",        // 125
];

// Build reverse lookup: string -> uint8
var ACTION_STATE_MAP = {};
for (var i = 0; i < ACTION_STATE_LIST.length; i++) {
  ACTION_STATE_MAP[ACTION_STATE_LIST[i]] = i;
}

// Player state binary size
var PLAYER_STATE_SIZE = 18;

// Encode player state to 18-byte buffer
function encodePlayerState(state, buffer, offset) {
  // x: int16 at offset 0 (pos.x * 16)
  var x = Math.round(state.x * 16);
  buffer[offset]     = (x >> 8) & 0xFF;
  buffer[offset + 1] = x & 0xFF;
  // y: int16 at offset 2
  var y = Math.round(state.y * 16);
  buffer[offset + 2] = (y >> 8) & 0xFF;
  buffer[offset + 3] = y & 0xFF;
  // action state: uint8 at offset 4
  var as = ACTION_STATE_MAP[state.actionState];
  buffer[offset + 4] = (as !== undefined) ? as : 0;
  // timer: uint16 at offset 5 (timer * 100)
  var t = Math.round(state.timer * 100);
  buffer[offset + 5] = (t >> 8) & 0xFF;
  buffer[offset + 6] = t & 0xFF;
  // face: uint8 at offset 7
  buffer[offset + 7] = state.face === -1 ? 0 : 1;
  // percent: uint16 at offset 8
  buffer[offset + 8] = (state.percent >> 8) & 0xFF;
  buffer[offset + 9] = state.percent & 0xFF;
  // stocks: uint8 at offset 10
  buffer[offset + 10] = state.stocks;
  // character: uint8 at offset 11
  buffer[offset + 11] = state.character;
  // cVel.x: int16 at offset 12 (vel * 256)
  var vx = Math.round((state.velX || 0) * 256);
  buffer[offset + 12] = (vx >> 8) & 0xFF;
  buffer[offset + 13] = vx & 0xFF;
  // cVel.y: int16 at offset 14
  var vy = Math.round((state.velY || 0) * 256);
  buffer[offset + 14] = (vy >> 8) & 0xFF;
  buffer[offset + 15] = vy & 0xFF;
  // flags: uint8 at offset 16
  var flags = 0;
  if (state.grounded) flags |= 1;
  if (state.shielding) flags |= 2;
  buffer[offset + 16] = flags;
  // palette: uint8 at offset 17
  buffer[offset + 17] = state.palette || 0;
}

// Decode 18-byte buffer to state object
function decodePlayerState(buffer, offset) {
  // x
  var xRaw = (buffer[offset] << 8) | buffer[offset + 1];
  if (xRaw > 32767) xRaw -= 65536; // signed
  var x = xRaw / 16;
  // y
  var yRaw = (buffer[offset + 2] << 8) | buffer[offset + 3];
  if (yRaw > 32767) yRaw -= 65536;
  var y = yRaw / 16;
  // action state
  var asIndex = buffer[offset + 4];
  var actionState = ACTION_STATE_LIST[asIndex] || "WAIT";
  // timer
  var timer = ((buffer[offset + 5] << 8) | buffer[offset + 6]) / 100;
  // face
  var face = buffer[offset + 7] === 0 ? -1 : 1;
  // percent
  var percent = (buffer[offset + 8] << 8) | buffer[offset + 9];
  // stocks
  var stocks = buffer[offset + 10];
  // character
  var character = buffer[offset + 11];
  // velocity
  var vxRaw = (buffer[offset + 12] << 8) | buffer[offset + 13];
  if (vxRaw > 32767) vxRaw -= 65536;
  var velX = vxRaw / 256;
  var vyRaw = (buffer[offset + 14] << 8) | buffer[offset + 15];
  if (vyRaw > 32767) vyRaw -= 65536;
  var velY = vyRaw / 256;
  // flags
  var flags = buffer[offset + 16];
  var grounded = !!(flags & 1);
  var shielding = !!(flags & 2);
  // palette
  var palette = buffer[offset + 17];

  return {
    x: x, y: y,
    actionState: actionState, timer: timer,
    face: face, percent: percent, stocks: stocks,
    character: character,
    velX: velX, velY: velY,
    grounded: grounded, shielding: shielding,
    palette: palette
  };
}

if (typeof module !== 'undefined' && module.exports) {
  // CommonJS (Node.js server/bots)
  module.exports = {
    OPCODES: OPCODES,
    PHASES: PHASES,
    ACTION_STATE_LIST: ACTION_STATE_LIST,
    ACTION_STATE_MAP: ACTION_STATE_MAP,
    PLAYER_STATE_SIZE: PLAYER_STATE_SIZE,
    encodePlayerState: encodePlayerState,
    decodePlayerState: decodePlayerState,
  };
}
