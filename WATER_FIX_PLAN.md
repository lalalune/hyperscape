# Water System Fix Plan

## Issues Addressed

| Issue | Title | Problem |
|-------|-------|---------|
| **#337** | Water areas should not be walkable tiles | Players and mobs can walk through water areas |
| **#280** | Water under the entire map | Water renders everywhere, not just in actual water areas |

---

## Executive Summary

Both issues stem from **existing, implemented code that is not being used**:

1. **Walkability**: `TerrainSystem.isPositionWalkable()` correctly blocks water/steep slopes, but the movement managers don't call it
2. **Water Rendering**: `TerrainSystem.findWaterAreas()` correctly identifies underwater regions, but `generateWaterMeshes()` doesn't use it

**The fix connects existing infrastructure** - no new algorithms needed.

---

## Part 1: Root Cause Analysis

### Issue #337 - Water is Walkable

**Location**: Server-side tile movement managers

| File | Line | Current Code |
|------|------|--------------|
| `packages/server/src/systems/ServerNetwork/tile-movement.ts` | 64-68 | `return true` |
| `packages/server/src/systems/ServerNetwork/mob-tile-movement.ts` | 117-121 | `return true` |

Both `isTileWalkable()` methods have this stub implementation:

```typescript
private isTileWalkable(_tile: TileCoord): boolean {
  // MVP: All tiles are walkable
  // TODO: Add terrain slope checks and collision objects later
  return true;
}
```

**Existing Solution (Unused)**:
`TerrainSystem.isPositionWalkable()` at line 1910-1942 correctly implements:
- Water check: `height < WATER_THRESHOLD (14.4m)` → not walkable
- Slope check: `slope > biomeData.maxSlope` → not walkable
- Lakes biome: Always not walkable

### Issue #280 - Water Renders Everywhere

**Location**: `packages/shared/src/systems/shared/world/TerrainSystem.ts`

The `generateWaterMeshes()` method (line 2050-2063) creates a full-tile water plane for **every** terrain tile unconditionally:

```typescript
private generateWaterMeshes(tile: TerrainTile): void {
  if (!this.waterSystem) return;

  // Creates water for EVERY tile - no check for actual water areas!
  const waterMesh = this.waterSystem.generateWaterMesh(
    tile,
    this.CONFIG.WATER_THRESHOLD,
    this.CONFIG.TILE_SIZE,
  );

  if (tile.mesh) {
    tile.mesh.add(waterMesh);
    tile.waterMeshes.push(waterMesh);
  }
}
```

**Existing Solution (Unused)**:
`TerrainSystem.findWaterAreas()` at line 2078-2144 samples the heightmap and returns underwater regions, but **it is never called** anywhere in the codebase.

---

## Part 2: Implementation Plan

### Phase 1: Fix Walkability (Issue #337)

#### Step 1.1: Update Player Movement Manager

**File**: `packages/server/src/systems/ServerNetwork/tile-movement.ts`
**Lines**: 64-68

**Before**:
```typescript
private isTileWalkable(_tile: TileCoord): boolean {
  // MVP: All tiles are walkable
  // TODO: Add terrain slope checks and collision objects later
  return true;
}
```

**After**:
```typescript
/**
 * Check if a tile is walkable based on terrain constraints
 * Uses TerrainSystem's walkability check for water, slope, and biome rules
 */
private isTileWalkable(tile: TileCoord): boolean {
  const terrain = this.getTerrain();
  if (!terrain) {
    // Fallback: walkable if no terrain system available
    return true;
  }

  // Convert tile to world coordinates (center of tile)
  const worldPos = tileToWorld(tile);

  // Use TerrainSystem's comprehensive walkability check
  // Checks: water level (<14.4m), slope constraints, lakes biome
  const result = terrain.isPositionWalkable(worldPos.x, worldPos.z);
  return result.walkable;
}
```

**Dependencies**:
- `tileToWorld` - Already imported from `@hyperscape/shared` (line 23)
- `getTerrain()` - Already exists (line 54-58)
- `TerrainSystem.isPositionWalkable()` - Already exists and properly typed

#### Step 1.2: Update Mob Movement Manager

**File**: `packages/server/src/systems/ServerNetwork/mob-tile-movement.ts`
**Lines**: 117-121

Same changes as Step 1.1.

**Dependencies**:
- `tileToWorld` - Already imported from `@hyperscape/shared` (line 27)
- `getTerrain()` - Already exists (line 107-111)

---

### Phase 2: Fix Water Rendering (Issue #280)

#### Step 2.1: Add Underwater Area Check Before Water Mesh Generation

**File**: `packages/shared/src/systems/shared/world/TerrainSystem.ts`
**Lines**: 2050-2063

**Before**:
```typescript
private generateWaterMeshes(tile: TerrainTile): void {
  if (!this.waterSystem) return;

  const waterMesh = this.waterSystem.generateWaterMesh(
    tile,
    this.CONFIG.WATER_THRESHOLD,
    this.CONFIG.TILE_SIZE,
  );

  if (tile.mesh) {
    tile.mesh.add(waterMesh);
    tile.waterMeshes.push(waterMesh);
  }
}
```

**After**:
```typescript
/**
 * Generate water meshes for low areas
 * Only generates water if the tile actually has underwater terrain
 */
private generateWaterMeshes(tile: TerrainTile): void {
  if (!this.waterSystem) return;

  // Check if this tile has any underwater areas
  const waterAreas = this.findWaterAreas(tile);

  // Skip water generation if no underwater areas exist in this tile
  if (waterAreas.length === 0) {
    return;
  }

  // Generate water mesh only for tiles with actual water
  const waterMesh = this.waterSystem.generateWaterMesh(
    tile,
    this.CONFIG.WATER_THRESHOLD,
    this.CONFIG.TILE_SIZE,
  );

  if (tile.mesh) {
    tile.mesh.add(waterMesh);
    tile.waterMeshes.push(waterMesh);
  }
}
```

**Dependencies**:
- `findWaterAreas()` - Already exists at line 2078-2144 (private method, never called)

---

## Part 3: Files Summary

| File | Change | Issue | Complexity |
|------|--------|-------|------------|
| `packages/server/src/systems/ServerNetwork/tile-movement.ts` | Wire `isTileWalkable()` to TerrainSystem | #337 | Low |
| `packages/server/src/systems/ServerNetwork/mob-tile-movement.ts` | Wire `isTileWalkable()` to TerrainSystem | #337 | Low |
| `packages/shared/src/systems/shared/world/TerrainSystem.ts` | Add `findWaterAreas()` check in `generateWaterMeshes()` | #280 | Low |

---

## Part 4: Technical Details

### Water Threshold Configuration

From `TerrainSystem.CONFIG` (line 291):
```typescript
WATER_THRESHOLD: 14.4,  // Water appears below 14.4m (0.18 * MAX_HEIGHT)
MAX_HEIGHT: 80,         // 80m max height variation
```

### Walkability Rules (from `isPositionWalkable`)

| Check | Threshold | Result |
|-------|-----------|--------|
| Height < 14.4m | `height < CONFIG.WATER_THRESHOLD` | Not walkable ("Water bodies are impassable") |
| Slope > biome max | `slope > biomeData.maxSlope` | Not walkable ("Steep mountain slopes block movement") |
| Lakes biome | `biome === "lakes"` | Not walkable ("Lake water is impassable") |

### Biome Max Slopes (from `biomes.json`)

| Biome | maxSlope |
|-------|----------|
| plains | 0.6 |
| forest | 0.8 |
| valley | 0.8 |
| mountains | 0.9 |
| tundra | 0.8 |
| desert | 0.6 |
| lakes | 0.8 |
| swamp | 0.5 |

### Water Area Detection (`findWaterAreas`)

The method samples terrain at 10m intervals within each 100m tile:
- For **lakes biome**: Returns large water area covering 80% of tile
- For **other biomes**: Samples heightmap, finds regions below water threshold
- Returns empty array if no underwater samples found

---

## Part 5: Performance Considerations

### Walkability Checks

Each `isTileWalkable()` call invokes:
1. `tileToWorld()` - O(1) math
2. `isPositionWalkable()` which calls:
   - `getHeightAt()` - Noise calculation (cached in heightmap during tile generation)
   - `calculateSlope()` - 4 additional `getHeightAt()` calls
   - `getBiomeAt()` - O(1) lookup

**Impact**: Acceptable for OSRS-style gameplay where:
- BFS pathfinding is bounded to 128-tile radius
- Chase pathfinding only checks 1-4 tiles per tick
- Path calculations happen once per click, not per frame

### Water Area Detection

`findWaterAreas()` performance:
- Runs once per tile generation (not per frame)
- Samples 100 points per tile (10x10 grid at 10m spacing)
- Only called on client during terrain generation

**Impact**: Negligible - tiles are generated gradually as player moves

---

## Part 6: Behavioral Changes

### Before Fix

| Action | Result |
|--------|--------|
| Click on water | Player walks through water |
| Mob chases through water | Mob walks through water |
| View any terrain tile | Water plane visible (even on mountains) |

### After Fix

| Action | Result |
|--------|--------|
| Click on water | BFS finds path around water OR returns no path |
| Click near water | Player walks to water's edge, stops |
| Mob chases through water | Mob gets stuck at water edge (safespotting works!) |
| View high terrain | No water visible |
| View low terrain (<14.4m) | Water visible in depressions |
| View lakes biome | Large water area visible |

### OSRS Authenticity Preserved

- **BFS Pathfinding** (players): Automatically routes around water
- **Greedy Chase** (mobs): Get blocked by water = safespotting gameplay works
- **Visual/Collision Alignment**: Water renders exactly where movement is blocked

---

## Part 7: Testing Plan

### Walkability Tests (#337)

1. **Walk toward water**
   - Expected: Player stops at water's edge
   - Verify: Position Y should be >= 14.4m (water threshold)

2. **Click on water tile**
   - Expected: Pathfinding routes around water OR no path found
   - Verify: No path tiles have height < 14.4m

3. **Mob chase across water**
   - Expected: Mob blocked at water edge
   - Verify: Safespotting works (stand across water from mob)

4. **Steep slope movement**
   - Expected: Player blocked on slopes > biome maxSlope
   - Verify: Movement stops on mountain sides

### Water Rendering Tests (#280)

1. **Mountain/high terrain tiles**
   - Expected: No water mesh in scene
   - Verify: `tile.waterMeshes.length === 0`

2. **Low terrain tiles (valleys)**
   - Expected: Water visible only in depressions
   - Verify: Water mesh exists, positioned at 14.4m

3. **Lakes biome tiles**
   - Expected: Large water area visible
   - Verify: Water covers ~80% of tile

4. **Mixed terrain**
   - Expected: Water only where terrain < 14.4m
   - Verify: Standing on terrain above water = dry, below = underwater

---

## Part 8: Rollback Plan

If issues arise, both fixes can be independently reverted:

### Revert Walkability (#337)
Restore `isTileWalkable()` to return `true` in both movement managers.

### Revert Water Rendering (#280)
Remove the `findWaterAreas()` check from `generateWaterMeshes()`.

---

## Part 9: Future Improvements (Out of Scope)

These are potential enhancements not included in this fix:

1. **Sized Water Meshes**: Generate water planes that match underwater region bounds instead of full-tile planes
2. **Shader-Based Water**: Use fragment shader discard to only render water where terrain height < threshold
3. **Water Depth Effects**: Vary water opacity/color based on depth below surface
4. **Walkability Caching**: Cache tile walkability to avoid repeated terrain lookups
5. **Swimming Mechanic**: Instead of blocking water, allow swimming with slower movement

---

## Appendix: Code References

### TerrainSystem.isPositionWalkable()
`packages/shared/src/systems/shared/world/TerrainSystem.ts:1910-1942`

### TerrainSystem.findWaterAreas()
`packages/shared/src/systems/shared/world/TerrainSystem.ts:2078-2144`

### TerrainSystem.generateWaterMeshes()
`packages/shared/src/systems/shared/world/TerrainSystem.ts:2050-2063`

### TileMovementManager.isTileWalkable()
`packages/server/src/systems/ServerNetwork/tile-movement.ts:64-68`

### MobTileMovementManager.isTileWalkable()
`packages/server/src/systems/ServerNetwork/mob-tile-movement.ts:117-121`

### WaterSystem.generateWaterMesh()
`packages/shared/src/systems/shared/world/WaterSystem.ts:68-168`

### Biome Configuration
`packages/server/world/assets/manifests/biomes.json`
