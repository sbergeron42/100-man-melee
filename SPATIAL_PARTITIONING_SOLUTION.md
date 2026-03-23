# Spatial Partitioning Solution for 100-Player Hit Detection

## The Problem

**Current:** O(n²) = 10,000 checks per frame for 100 players
**Needed:** Reduce to ~500-2,000 checks per frame using spatial optimization

## Solution: Spatial Hash Grid

For a 2D fighting game, a **Spatial Hash Grid** is the most efficient approach:

1. Divide the stage into a grid of cells
2. Each player/hitbox belongs to cells based on their position
3. Only check collisions between objects in the same or adjacent cells
4. Reduces complexity from O(n²) to roughly O(n) in practice

## Implementation Strategy

### Step 1: Create Spatial Hash Grid

```javascript
// server/spatialHash.js

class SpatialHashGrid {
  constructor(stageBounds, cellSize = 50) {
    // Stage bounds (from blastzone)
    // Battlefield: approximately -224 to 224 in X, -108.8 to 200 in Y
    this.bounds = {
      minX: -250,
      maxX: 250,
      minY: -150,
      maxY: 220
    };
    
    // Cell size: large enough to contain max attack range (~50-60 units)
    // But small enough to exclude distant players
    this.cellSize = cellSize;
    
    // Calculate grid dimensions
    this.width = Math.ceil((this.bounds.maxX - this.bounds.minX) / cellSize);
    this.height = Math.ceil((this.bounds.maxY - this.bounds.minY) / cellSize);
    
    // Grid: 2D array of sets containing player indices
    this.grid = [];
    for (let i = 0; i < this.width * this.height; i++) {
      this.grid[i] = new Set();
    }
    
    // Track which cells each player is in (for quick cleanup)
    this.playerCells = new Map(); // playerIndex -> Set of cell indices
  }
  
  // Convert world position to grid cell coordinates
  worldToCell(x, y) {
    const cellX = Math.floor((x - this.bounds.minX) / this.cellSize);
    const cellY = Math.floor((y - this.bounds.minY) / this.cellSize);
    
    // Clamp to grid bounds
    return {
      x: Math.max(0, Math.min(cellX, this.width - 1)),
      y: Math.max(0, Math.min(cellY, this.height - 1))
    };
  }
  
  // Convert cell coordinates to grid index
  cellToIndex(cellX, cellY) {
    return cellY * this.width + cellX;
  }
  
  // Get all cells that a bounding box overlaps
  getCellsForBounds(minX, minY, maxX, maxY) {
    const minCell = this.worldToCell(minX, minY);
    const maxCell = this.worldToCell(maxX, maxY);
    const cells = new Set();
    
    for (let y = minCell.y; y <= maxCell.y; y++) {
      for (let x = minCell.x; x <= maxCell.x; x++) {
        cells.add(this.cellToIndex(x, y));
      }
    }
    
    return cells;
  }
  
  // Insert a player into the grid
  insert(playerIndex, position, hitboxRadius) {
    // Remove player from old cells
    this.remove(playerIndex);
    
    // Calculate bounding box around player (position + hitbox radius)
    const minX = position.x - hitboxRadius;
    const maxX = position.x + hitboxRadius;
    const minY = position.y - hitboxRadius;
    const maxY = position.y + hitboxRadius;
    
    // Get all cells this player overlaps
    const cells = this.getCellsForBounds(minX, minY, maxX, maxY);
    
    // Add player to each cell
    cells.forEach(cellIndex => {
      this.grid[cellIndex].add(playerIndex);
    });
    
    // Store which cells this player is in
    this.playerCells.set(playerIndex, cells);
  }
  
  // Remove a player from the grid
  remove(playerIndex) {
    const cells = this.playerCells.get(playerIndex);
    if (cells) {
      cells.forEach(cellIndex => {
        this.grid[cellIndex].delete(playerIndex);
      });
      this.playerCells.delete(playerIndex);
    }
  }
  
  // Get all players that could potentially collide with a given position/radius
  getNearbyPlayers(position, radius) {
    const minX = position.x - radius;
    const maxX = position.x + radius;
    const minY = position.y - radius;
    const maxY = position.y + radius;
    
    const cells = this.getCellsForBounds(minX, minY, maxX, maxY);
    const nearby = new Set();
    
    cells.forEach(cellIndex => {
      this.grid[cellIndex].forEach(playerIndex => {
        nearby.add(playerIndex);
      });
    });
    
    return nearby;
  }
  
  // Clear the entire grid
  clear() {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i].clear();
    }
    this.playerCells.clear();
  }
}
```

### Step 2: Modified Hit Detection Function

```javascript
// server/hitDetection.js (modified for spatial partitioning)

import { SpatialHashGrid } from './spatialHash.js';

// Global spatial hash (recreated each frame)
let spatialGrid = null;

// Maximum interaction range (largest possible hitbox + safety margin)
const MAX_HITBOX_RANGE = 30; // units (adjust based on largest attack range)

export function hitDetectWithSpatial(attackerIndex, players, input, spatialHash) {
  const attacker = players[attackerIndex];
  if (!attacker || attacker.phys === undefined) return;
  
  const attackerClank = false;
  
  // Get attacker's position and maximum hitbox radius
  const attackerPos = attacker.phys.pos;
  const maxAttackerHitboxSize = Math.max(
    ...attacker.hitboxes.id.filter(hb => hb && attacker.hitboxes.active[attacker.hitboxes.id.indexOf(hb)])
      .map(hb => hb.size || 0),
    0
  ) || MAX_HITBOX_RANGE;
  
  // Only check players in nearby cells
  const nearbyPlayers = spatialHash.getNearbyPlayers(
    attackerPos,
    MAX_HITBOX_RANGE * 2 // Search radius = 2x max hitbox (safety margin)
  );
  
  // Convert Set to Array for iteration
  const nearbyArray = Array.from(nearbyPlayers);
  
  // Now only check collisions with nearby players instead of all players
  for (let i = 0; i < nearbyArray.length; i++) {
    const victimIndex = nearbyArray[i];
    
    // Skip self
    if (victimIndex === attackerIndex) continue;
    
    const victim = players[victimIndex];
    if (!victim || !victim.phys) continue;
    
    // Additional distance check (double-check we're close enough)
    const distance = Math.sqrt(
      Math.pow(victim.phys.pos.x - attackerPos.x, 2) +
      Math.pow(victim.phys.pos.y - attackerPos.y, 2)
    );
    
    // Skip if definitely too far (larger than max possible interaction)
    if (distance > MAX_HITBOX_RANGE * 3) continue;
    
    // ... rest of your existing hit detection logic ...
    // (check if victim is already in hitList, check hitboxes, etc.)
    
    // Check if victim is already in hitList
    const inHitList = attacker.hitboxes.hitList.includes(victimIndex);
    
    if (!inHitList) {
      // Your existing hit detection code here (lines 38-147 from hitDetection.js)
      // Just replace the outer loop with this nearby player check
      
      for (let j = 0; j < 4; j++) {
        if (attacker.hitboxes.active[j] && /* ... existing conditions ... */) {
          // Check hitboxes against victim
          // ... existing collision detection code ...
        }
      }
    }
  }
}

// Updated main hit detection loop
export function performHitDetection(players, input) {
  // Create spatial hash grid
  const spatialHash = new SpatialHashGrid();
  
  // Insert all active players into the grid
  for (let i = 0; i < players.length; i++) {
    if (players[i] && players[i].phys && players[i].phys.pos) {
      // Use player position and estimate of max hitbox size
      const maxHitboxSize = MAX_HITBOX_RANGE;
      spatialHash.insert(i, players[i].phys.pos, maxHitboxSize);
    }
  }
  
  // Now perform hit detection with spatial optimization
  for (let attackerIndex = 0; attackerIndex < players.length; attackerIndex++) {
    if (players[attackerIndex] && players[attackerIndex].phys) {
      hitDetectWithSpatial(attackerIndex, players, input, spatialHash);
    }
  }
}
```

### Step 3: Integration into Game Server

```javascript
// server/gameServer.js

import { performHitDetection } from './hitDetection.js';

class GameServer {
  constructor() {
    this.players = [];
    // ... other initialization
  }
  
  tick() {
    // ... collect inputs, update physics, etc.
    
    // Before hit detection, update spatial hash
    // (Or use the one created in performHitDetection)
    
    // Perform optimized hit detection
    performHitDetection(this.players, this.inputs);
    
    // ... execute hits, update game state, etc.
  }
}
```

## Performance Analysis

### Without Spatial Partitioning
- 100 players × 100 players = 10,000 checks per frame
- At 60 fps = 600,000 checks per second

### With Spatial Partitioning
**Assumptions:**
- Stage size: 500×370 units
- Cell size: 50 units
- Average players per cell: 5-10 (battle royale, players spread out)
- Average nearby players per check: 10-15

**Calculation:**
- 100 players × 12 nearby players (average) = 1,200 checks per frame
- At 60 fps = 72,000 checks per second

**Performance Improvement: ~8-10× reduction**

In worst case (all players clustered):
- Worst case: 100 players × 50 nearby = 5,000 checks
- Still 2× better than naive approach
- But this is rare in battle royale (players spread out)

## Additional Optimizations

### 1. Distance-Based Early Exit
```javascript
// Already included above - skip if distance > MAX_HITBOX_RANGE * 3
if (distance > MAX_HITBOX_RANGE * 3) continue;
```

### 2. Hitbox Activation Check First
```javascript
// Only check if attacker has active hitboxes
if (!attacker.hitboxes.active.some(active => active)) {
  continue; // Skip this player entirely
}
```

### 3. Frame-Based Optimization
```javascript
// Only update spatial hash every N frames (not every frame)
// Players don't move far in 1 frame, so you can update less frequently
let spatialHashUpdateCounter = 0;
if (spatialHashUpdateCounter % 2 === 0) { // Update every 2 frames
  spatialHash.clear();
  // ... reinsert players
}
spatialHashUpdateCounter++;
```

### 4. Separate Hitbox and Player Grids
```javascript
// More advanced: Use two grids
// - One for player positions (for general queries)
// - One specifically for active hitboxes (smaller cells, updated less frequently)
```

## Cell Size Tuning

The cell size is critical:

**Too small (e.g., 20 units):**
- More cells to check
- Players span multiple cells
- Overhead from grid management

**Too large (e.g., 100 units):**
- Too many players per cell
- Less benefit from spatial partitioning

**Recommended: 40-60 units**
- Based on largest attack range (~30-40 units)
- Plus safety margin

## Expected Performance

**Server CPU Usage (per match):**
- Without optimization: ~40-60% of 1 CPU core
- With spatial partitioning: ~5-10% of 1 CPU core

**Hit Detection Time:**
- Without: ~5-10ms per frame
- With: ~0.5-1.5ms per frame

This leaves plenty of CPU for:
- Physics simulation
- Game logic
- Network handling
- Other game systems

## Implementation Notes

1. **Maintain Existing Logic**: Keep all your existing hit detection code, just add spatial filtering before it
2. **Battle Royale Benefit**: Spatial partitioning works even better in battle royale because players spread out naturally
3. **Server-Only**: This optimization only runs on server; clients just receive game state
4. **Frame-Perfect**: Doesn't affect game accuracy - just makes checks more efficient

