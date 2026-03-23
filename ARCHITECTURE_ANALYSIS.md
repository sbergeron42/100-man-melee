# 100-Player Battle Royale: Client vs Server Architecture Analysis

## Current Architecture (4 players)

**Type:** Client-authoritative deterministic lockstep
- Each client runs full game simulation
- Clients send inputs to each other via Deepstream (message broker)
- Server has NO game logic - just relays messages
- All game logic runs client-side

## Problem: Why Current Approach Doesn't Scale to 100 Players

### Client-Side Calculation Issues

**1. Network Bandwidth**
```
Current (4 players): 3 inputs/frame × 60 fps = 180 input packets/sec/client
100 players: 99 inputs/frame × 60 fps = 5,940 input packets/sec/client
Result: ~33× more network traffic per client
```

**2. Client CPU Load**
```
Each client must:
- Run full physics simulation for 100 players
- Perform hit detection: O(n²) = 10,000 checks/frame (vs 16 for 4 players)
- Render 100 characters
- Handle all game logic

Result: Unacceptable performance on average hardware
```

**3. Synchronization Problems**
- Deterministic lockstep requires ALL clients to be in sync
- One laggy client stalls everyone
- Network variance multiplied by 100 players
- Desyncs become inevitable

## Solution: Server-Authoritative Architecture

### How It Works

**Server-Side:**
- Server runs the authoritative game simulation
- Processes all inputs from all clients
- Calculates all physics, hit detection, game state
- Sends game state updates to clients

**Client-Side:**
- Sends local player's inputs to server
- Receives game state updates from server
- Renders the game state
- Optional: Client-side prediction for reduced perceived latency

### Architecture Diagram

```
┌─────────┐     Input      ┌──────────┐
│ Client  │───────────────>│          │
│   1     │                │          │
└─────────┘                │          │
                           │  Game    │  Game State
┌─────────┐     Input      │ Server   │<───────────┐
│ Client  │───────────────>│          │            │
│   2     │                │ - Physics│            │
└─────────┘                │ - Hit    │            │
                           │   Detect │            │
┌─────────┐     Input      │ - Game   │            │
│ Client  │───────────────>│   Logic  │            │
│  ...    │                │          │            │
└─────────┘                │          │            │
                           └──────────┘            │
                              ▲                    │
┌─────────┐     Input         │                    │
│ Client  │───────────────────┘                    │
│  100    │                                        │
└─────────┘<───────────────────────────────────────┘
        Game State Updates
```

## Implementation Options

### Option 1: Full Server-Authoritative (Recommended)

**Server Responsibilities:**
- Run complete game simulation (physics, hit detection, game logic)
- Maintain authoritative game state
- Send periodic state snapshots to clients
- Handle 100 players' inputs simultaneously

**Client Responsibilities:**
- Send inputs to server (60 times/sec)
- Receive and render game state
- Optional: Client-side prediction (render predicted state, correct when server updates arrive)

**Pros:**
- Cheating prevention (server is authoritative)
- Better synchronization
- Can handle laggy clients
- Scales better

**Cons:**
- Requires game server infrastructure
- Added latency (client → server → client)
- Server costs
- More complex implementation

### Option 2: Hybrid Approach (Client-Side for Single Player/Local)

**For Local/Single Player:**
- Run everything client-side (no server needed)
- Full performance, no latency

**For Multiplayer:**
- Use server-authoritative architecture
- Server handles all game logic

**Pros:**
- Best of both worlds
- No server needed for local play
- Proper multiplayer architecture for online

**Cons:**
- Need to maintain both code paths
- More code complexity

### Option 3: Client-Side with Optimizations (NOT Recommended for 100 Players)

**Theoretical approach:**
- Keep client-authoritative
- Massive optimizations (spatial partitioning, LOD, etc.)
- Only sync nearby players

**Why it won't work:**
- Still need to receive inputs from all players for determinism
- Network bandwidth still the bottleneck
- One laggy client still stalls everyone
- Cheating is trivial (client is authoritative)

## Recommended Approach: Server-Authoritative

### Technical Requirements

**1. Server-Side Game Logic**
- Port the game loop (`gameTick` function) to server
- Port physics calculations
- Port hit detection with spatial optimization
- Run at 60 ticks/sec for all 100 players

**2. Network Protocol**
- Input packets: Client → Server (small, ~10-20 bytes per input)
- State snapshots: Server → Client (larger, but optimized)
- Delta compression (only send what changed)
- Send full state every N frames, deltas in between

**3. Client-Side Prediction (Optional but Recommended)**
- Client predicts what will happen based on inputs
- Server sends corrections
- Reduces perceived latency

**4. Server Infrastructure**
- Need dedicated game server (Node.js, or port to C++/C# for performance)
- Handle 100 concurrent connections
- Process 6,000 input packets/sec (100 players × 60 fps)
- Calculate game state and send to all clients

### Performance Estimates

**Server CPU (approximate):**
- 100 players × 60 fps = 6,000 game ticks/sec
- O(n²) hit detection with spatial optimization: ~500-2,000 collision checks/tick
- Estimated: 2-4 CPU cores for game server

**Network Bandwidth (approximate):**
- Input: 100 clients × 60 fps × 20 bytes = ~120 KB/sec upstream
- State: 100 clients × 30 fps × 2 KB = ~6 MB/sec downstream
- Total server bandwidth: ~6-10 MB/sec per match

## Code Changes Required

### 1. Extract Game Logic to Shared Module
```javascript
// shared/gameLogic.js - Runs on both client (local) and server (multiplayer)
export function gameTick(players, inputs, deltaTime) {
  // Physics updates
  // Hit detection
  // Game logic
}
```

### 2. Server Implementation
```javascript
// server/gameServer.js
class GameServer {
  constructor() {
    this.players = new Map(); // 100 player objects
    this.gameState = {};
  }
  
  tick() {
    // Collect inputs from all clients
    const inputs = this.collectInputs();
    
    // Run game simulation
    const newState = gameTick(this.players, inputs, 16.67);
    
    // Send state to clients
    this.broadcastState(newState);
  }
}
```

### 3. Client Changes
```javascript
// client/gameClient.js
class GameClient {
  sendInput(input) {
    // Send to server only
    this.socket.emit('input', input);
  }
  
  onStateUpdate(state) {
    // Receive game state from server
    // Update local player objects
    // Render
  }
}
```

## Answer to Your Question

**"Would I need server-side compute to mitigate client-side calculation?"**

**YES, absolutely.** For 100 players, you MUST use server-authoritative architecture.

**"Is server-side computation already assumed?"**

**NO.** Currently, meleelight has NO server-side game logic. The `deepserver.js` file is just a Deepstream message broker with zero game code.

## Bottom Line

- **Current:** Client-authoritative (won't scale past ~8-10 players)
- **For 100 players:** Server-authoritative is REQUIRED
- **What needs to happen:** Port game logic to server, implement state sync protocol
- **Effort:** Significant (100+ hours) but necessary for 100-player multiplayer

For single-player/local 100-player matches, client-side is fine. But for online multiplayer, server-authoritative is the only viable option.

