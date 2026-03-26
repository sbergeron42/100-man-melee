# 100-Man Melee

A 100-player online battle royale mod of [Melee Light](https://github.com/schmooblidon/meleelight), the browser-based Super Smash Bros. Melee clone.

Think Mario Royale, but Melee.

## What is this?

**Melee Light** is an open-source browser platform fighter built entirely in JavaScript and Canvas -- no Flash, Unity, or game engines. It features frame-accurate Melee mechanics with 5 characters (Marth, Fox, Falco, Falcon, Jigglypuff) rendered as vector bezier paths.

**100-Man Melee** extends it into an online battle royale:
- **25 players** per match (humans + server-side AI bots)
- **Battle royale format** -- 1 stock, last one standing wins
- **Shrinking blastzones** that close in over time
- **Server-side bot AI** using the same AI engine as local play
- **Real-time WebSocket networking** with binary state protocol
- **Spectator mode** after elimination with L/R player cycling

## Features

- Online multiplayer via WebSocket relay server
- Server-side headless physics engine for AI bots (60hz)
- Bot-to-human combat (ghost player system for hit detection)
- Network grabs (GRAB_EVENT/GRAB_RELEASE protocol)
- Dynamic broadcast rate (scales with alive player count)
- Elimination HUD with placement rank and kill feed
- Spectator camera with auto-spectate after death
- Blastzone shrink (server + client synced)
- Remote player VFX/SFX (attack sounds, shine, sword trails)
- Network pause overlay (game continues behind it)

## Getting Started

### Prerequisites
- Node.js 6+
- npm or yarn

### Setup
```bash
npm install
npm run animations   # compile animations (once)
npm run build        # build client
npm run build:headless  # build server-side bot engine
```

### Running Locally
```bash
# Terminal 1: Start relay server
node server/relay.js 3001

# Terminal 2: Serve client
npx http-server dist -p 5001

# Terminal 3 (optional): Open two test windows
bash tools/test.sh
```

Then open `http://localhost:5001/meleelight.html` and select **Online Melee**.

### Commands

|Name              |Description                                              |
|------------------|---------------------------------------------------------|
|`npm run dev`     |Build dev version, watches for changes                   |
|`npm run build`   |Build optimized production client                        |
|`npm run build:headless`|Build server-side bot physics engine                |
|`npm run animations`|Compile animation data (run once)                      |

## Architecture

```
├── server/
│   ├── relay.js              # WebSocket relay server (game flow, bot management)
│   ├── protocol.js           # Binary protocol (opcodes, state encoding)
│   └── headless/
│       ├── entry.js          # Headless physics engine (bot AI, ghost humans)
│       ├── dist/headless.js  # Compiled headless bundle
│       └── stubs/            # No-op stubs for browser APIs
├── src/
│   ├── main/                 # Core game (main loop, rendering, VFX, camera)
│   ├── characters/           # Character data (moves, attributes, hitboxes)
│   ├── animations/           # Vector bezier path animation data
│   ├── physics/              # Physics engine, hit detection, action states
│   ├── stages/               # Stage definitions
│   ├── menus/                # Menu system
│   └── input/                # Input handling (keyboard, gamepad, AI)
├── tools/
│   └── test.sh               # Launch two Chromium windows for testing
└── dist/                     # Compiled client
```

## Credits

- **Melee Light** original project by [schmooblidon](https://github.com/schmooblidon/meleelight) (Schmoo, Tatatat0, Bites)
- **100-Man Melee** mod and online multiplayer by sbergeron42
- Character data extracted from Super Smash Bros. Melee
