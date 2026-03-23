/**
 * Spatial Hash Grid for optimizing hit detection in 100-player battle royale
 * 
 * Reduces hit detection from O(n²) to roughly O(n) by only checking nearby players
 */

export class SpatialHashGrid {
  constructor(stageBounds, cellSize = 50) {
    // Stage bounds based on Battlefield blastzone
    // Adjust these based on your actual stage
    this.bounds = stageBounds || {
      minX: -250,  // Slightly larger than blastzone for safety
      maxX: 250,
      minY: -150,
      maxY: 220
    };
    
    // Cell size: large enough for attack range, small enough to exclude distant players
    // 50 units works well - largest attacks are ~30-40 units
    this.cellSize = cellSize;
    
    // Calculate grid dimensions
    this.width = Math.ceil((this.bounds.maxX - this.bounds.minX) / cellSize);
    this.height = Math.ceil((this.bounds.maxY - this.bounds.minY) / cellSize);
    
    // Grid: 1D array of Sets containing player indices
    this.grid = [];
    for (let i = 0; i < this.width * this.height; i++) {
      this.grid[i] = new Set();
    }
    
    // Track which cells each player is in (for efficient cleanup)
    this.playerCells = new Map(); // playerIndex -> Set of cell indices
  }
  
  /**
   * Convert world position to grid cell coordinates
   */
  worldToCell(x, y) {
    const cellX = Math.floor((x - this.bounds.minX) / this.cellSize);
    const cellY = Math.floor((y - this.bounds.minY) / this.cellSize);
    
    // Clamp to grid bounds
    return {
      x: Math.max(0, Math.min(cellX, this.width - 1)),
      y: Math.max(0, Math.min(cellY, this.height - 1))
    };
  }
  
  /**
   * Convert cell coordinates to 1D grid index
   */
  cellToIndex(cellX, cellY) {
    return cellY * this.width + cellX;
  }
  
  /**
   * Get all cell indices that a bounding box overlaps
   */
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
  
  /**
   * Insert a player into the grid based on their position
   * @param {number} playerIndex - Index of the player
   * @param {Object} position - {x, y} position
   * @param {number} radius - Approximate interaction radius (hitbox size)
   */
  insert(playerIndex, position, radius) {
    // Remove player from old cells first
    this.remove(playerIndex);
    
    // Calculate bounding box around player
    const minX = position.x - radius;
    const maxX = position.x + radius;
    const minY = position.y - radius;
    const maxY = position.y + radius;
    
    // Get all cells this player overlaps
    const cells = this.getCellsForBounds(minX, minY, maxX, maxY);
    
    // Add player to each overlapping cell
    cells.forEach(cellIndex => {
      this.grid[cellIndex].add(playerIndex);
    });
    
    // Store which cells this player is in (for removal)
    this.playerCells.set(playerIndex, cells);
  }
  
  /**
   * Remove a player from the grid
   */
  remove(playerIndex) {
    const cells = this.playerCells.get(playerIndex);
    if (cells) {
      cells.forEach(cellIndex => {
        this.grid[cellIndex].delete(playerIndex);
      });
      this.playerCells.delete(playerIndex);
    }
  }
  
  /**
   * Get all players that could potentially interact with a given position/radius
   * @param {Object} position - {x, y} position to search around
   * @param {number} radius - Search radius
   * @returns {Set<number>} Set of player indices
   */
  getNearbyPlayers(position, radius) {
    const minX = position.x - radius;
    const maxX = position.x + radius;
    const minY = position.y - radius;
    const maxY = position.y + radius;
    
    const cells = this.getCellsForBounds(minX, minY, maxX, maxY);
    const nearby = new Set();
    
    // Collect all unique players from overlapping cells
    cells.forEach(cellIndex => {
      this.grid[cellIndex].forEach(playerIndex => {
        nearby.add(playerIndex);
      });
    });
    
    return nearby;
  }
  
  /**
   * Clear the entire grid (call at start of each frame before re-inserting)
   */
  clear() {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i].clear();
    }
    this.playerCells.clear();
  }
  
  /**
   * Get statistics about grid usage (for debugging/optimization)
   */
  getStats() {
    let totalPlayers = 0;
    let maxPlayersPerCell = 0;
    let cellsWithPlayers = 0;
    
    for (let i = 0; i < this.grid.length; i++) {
      const count = this.grid[i].size;
      if (count > 0) {
        cellsWithPlayers++;
        totalPlayers += count;
        if (count > maxPlayersPerCell) {
          maxPlayersPerCell = count;
        }
      }
    }
    
    return {
      totalCells: this.grid.length,
      cellsWithPlayers,
      totalPlayerEntries: totalPlayers,
      maxPlayersPerCell,
      avgPlayersPerCell: cellsWithPlayers > 0 ? totalPlayers / cellsWithPlayers : 0
    };
  }
}

