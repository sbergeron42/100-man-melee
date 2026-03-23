# Integration Guide: Spatial Partitioning for Hit Detection

## Quick Summary

**Problem:** 100 players = 10,000 hit detection checks per frame = too slow
**Solution:** Spatial Hash Grid = only check nearby players = ~1,000-2,000 checks per frame
**Result:** ~8-10× performance improvement

## Integration Steps

### Option 1: Minimal Changes (Recommended for Testing)

1. **Create the spatial hash grid** (files provided: `server/spatialHash.js`)

2. **Modify your hit detection loop** in `src/physics/hitDetection.js`:

```javascript
// At the top of hitDetection.js, import:
import { SpatialHashGrid } from '../../server/spatialHash.js';

// Add global constant
const MAX_HITBOX_RANGE = 35; // units

// Modify the hitDetect function:
export function hitDetect(p, input) {
  // ... existing code ...
  
  // REPLACE the outer loop (for (var i = 0; i < 4; i++))
  // with spatial hash filtering
  
  // Get spatial hash (you'll need to pass this in or create it)
  // For now, assume it's passed as a parameter or module-level variable
  const spatialHash = getSpatialHash(); // You'll implement this
  
  // Get nearby players instead of checking all players
  const nearbyPlayers = spatialHash.getNearbyPlayers(
    player[p].phys.pos,
    MAX_HITBOX_RANGE * 2
  );
  
  // Convert to array and filter out self
  const nearbyArray = Array.from(nearbyPlayers).filter(i => i !== p);
  
  // Replace: for (var i = 0; i < 4; i++)
  // With: for (var idx = 0; idx < nearbyArray.length; idx++)
  //       var i = nearbyArray[idx];
  
  for (var idx = 0; idx < nearbyArray.length; idx++) {
    var i = nearbyArray[idx];
    if (playerType[i] > -1) {
      if (i != p) {
        // ... rest of your existing hit detection code stays the same ...
      }
    }
  }
}
```

3. **Update gameTick to build spatial hash** in `src/main/main.js`:

```javascript
// At the top, import:
import { SpatialHashGrid } from '../../server/spatialHash.js';

// In gameTick function, before hit detection:
export function gameTick(oldInputBuffers) {
  // ... existing code ...
  
  // Before hit detection loop, build spatial hash
  const stageBounds = {
    minX: -250,
    maxX: 250,
    minY: -150,
    maxY: 220
  };
  const spatialHash = new SpatialHashGrid(stageBounds);
  
  // Insert all active players
  for (var i = 0; i < player.length; i++) {
    if (player[i] && player[i].phys && player[i].phys.pos && playerType[i] > -1) {
      spatialHash.insert(i, player[i].phys.pos, 35); // 35 = MAX_HITBOX_RANGE
    }
  }
  
  // Now modify hit detection to use spatial hash
  // Pass spatialHash to hitDetect, or use module-level variable
  setSpatialHash(spatialHash); // You'll implement this helper
  
  checkPhantoms();
  for (var i = 0; i < player.length; i++) {
    if (playerType[i] > -1) {
      hitDetect(i, input, spatialHash); // Pass spatialHash
    }
  }
  
  // ... rest of existing code ...
}
```

### Option 2: Refactor for Server-Side (Production)

If you're building server-side, create a new file structure:

```
server/
  spatialHash.js          (provided)
  optimizedHitDetection.js (provided)
  gameServer.js           (your new server)
```

In `gameServer.js`:

```javascript
import { SpatialHashGrid } from './spatialHash.js';
import { performOptimizedHitDetection } from './optimizedHitDetection.js';

class GameServer {
  constructor() {
    this.players = []; // Array of 100 player objects
    this.stageBounds = {
      minX: -250,
      maxX: 250,
      minY: -150,
      maxY: 220
    };
  }
  
  tick() {
    // ... collect inputs, update physics ...
    
    // Perform optimized hit detection
    performOptimizedHitDetection(
      this.players,
      this.inputs,
      this.stageBounds,
      this.originalHitDetect.bind(this)
    );
    
    // ... execute hits, update state ...
  }
}
```

## Performance Expectations

### Current (No Optimization)
```
100 players × 100 players = 10,000 checks/frame
At 60 fps = 600,000 checks/second
CPU usage: ~5-10ms per frame
```

### With Spatial Partitioning
```
100 players × ~12 nearby players (average) = 1,200 checks/frame
At 60 fps = 72,000 checks/second
CPU usage: ~0.5-1.5ms per frame
Improvement: ~8-10× faster
```

## Tuning Parameters

### Cell Size
- **Too small (20 units)**: More overhead, less benefit
- **Too large (100 units)**: Too many players per cell
- **Recommended (40-60 units)**: Good balance for Melee's attack ranges

Adjust in `SpatialHashGrid` constructor:
```javascript
const spatialHash = new SpatialHashGrid(stageBounds, 50); // 50 = cell size
```

### MAX_HITBOX_RANGE
- Set to largest possible attack range + safety margin
- Typical Melee attacks: 15-30 units
- Largest attacks (e.g., Marth f-smash): ~35-40 units
- **Recommended: 35-40 units**

### Search Radius Multiplier
In `getNearbyPlayers()`, the search radius is typically:
```javascript
searchRadius = MAX_HITBOX_RANGE * 2  // 2× for safety margin
```

You can adjust this multiplier (1.5, 2.0, 2.5) based on performance vs accuracy trade-off.

## Testing

1. **Start small**: Test with 10-20 players first
2. **Verify correctness**: Ensure hit detection results are identical
3. **Check performance**: Use console.time() to measure improvement
4. **Monitor stats**: Use `spatialHash.getStats()` to see distribution

## Common Issues

### Players missing hits that should connect
- **Cause**: Search radius too small
- **Fix**: Increase MAX_HITBOX_RANGE or search radius multiplier

### Still too slow
- **Cause**: Cell size not optimal, or worst-case scenario (all players clustered)
- **Fix**: 
  - Try different cell sizes
  - Add additional optimizations (hitbox activation check first)
  - Consider two-tier system (coarse grid + fine grid for active hitboxes)

### Hit detection results differ from original
- **Cause**: Logic error in filtering
- **Fix**: Double-check that you're still calling all the same collision functions, just with filtered player list

## Next Steps

1. Implement spatial hash grid (files provided)
2. Integrate into hit detection loop (modify hitDetect function)
3. Test with small player count (10-20)
4. Verify correctness
5. Scale up to 100 players
6. Measure performance improvement
7. Tune parameters if needed

