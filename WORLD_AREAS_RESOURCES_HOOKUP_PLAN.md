# Plan: Hook Up world-areas.json Resources to ResourceSystem

**Status:** ✅ IMPLEMENTED
**Last Updated:** 2024-11-30

## Critical Issues Found in Original Plan

### Issue 1: ResourceId Parsing Bug
**Original (WRONG):**
```typescript
const parts = r.resourceId.split('_');
const baseType = parts[0]; // "tree"
```

**Problem:** Multi-word types break this:
- `"fishing_spot_normal"` → `["fishing", "spot", "normal"]` → type=`"fishing"` ✗ WRONG!
- `"herb_patch_normal"` → `["herb", "patch", "normal"]` → type=`"herb"` ✗ WRONG!

**Solution:** Look up resourceId in EXTERNAL_RESOURCES to get the authoritative type.

### Issue 2: Type Mismatch
**resources.json types:** `"tree"`, `"fishing_spot"`, `"herb_patch"`
**TerrainResourceSpawnPoint types:** `"tree" | "rock" | "ore" | "herb" | "fish" | "gem" | "rare_ore"`

**Mapping needed:**
- `"tree"` → `"tree"` ✓
- `"fishing_spot"` → `"fish"` (must map!)
- `"herb_patch"` → `"herb"` (must map!)

### Issue 3: Y Position Not Grounded
- world-areas.json has `y: 0` for all resources
- TerrainSystem uses `getHeightAt()` to ground procedural resources (line 1418)
- ResourceSystem does NOT ground Y - uses position directly (line 402)
- **Must ground Y before calling registerTerrainResources**

---

## Current State

### How Mobs Spawn (WORKS - Reference Pattern)

```
world-areas.json
      │ mobSpawns: [{ mobId, position, maxCount }]
      ▼
MobNPCSpawnerSystem subscribes to TERRAIN_TILE_GENERATED
      │ Finds overlapping world areas
      │ Grounds Y using terrainSystem.getHeightAt()
      ▼
Calls spawnMobFromData() for each mob
```

### How Resources Spawn (PROCEDURAL - ignores world-areas.json)

```
TerrainSystem generates tile
      │ Procedural placement with getHeightAt() for Y grounding
      │ Creates tile.resources array with correct positions
      ▼
Emits RESOURCE_SPAWN_POINTS_REGISTERED
      ▼
ResourceSystem.registerTerrainResources()
      │ Uses position.y directly (already grounded by TerrainSystem)
      ▼
EntityManager creates ResourceEntity
```

---

## The Corrected Plan

### Step 1: Add imports to ResourceSystem.ts

```typescript
import { ALL_WORLD_AREAS } from "../../../data/world-areas";
import { getExternalResource } from "../../../utils/ExternalAssetUtils";
```

### Step 2: Get TerrainSystem reference in init()

```typescript
private terrainSystem: TerrainSystem | null = null;

async init(): Promise<void> {
  // Get terrain system for height lookups
  this.terrainSystem = this.world.getSystem("terrain") as TerrainSystem | null;

  // ... existing subscriptions ...

  // Load explicit resource placements from world-areas.json (server only)
  if (this.world.isServer) {
    this.initializeWorldAreaResources();
  }
}
```

### Step 3: Add initializeWorldAreaResources() method

```typescript
/**
 * Initialize resources from world-areas.json manifest
 * Called once on server startup after terrain system is available
 */
private initializeWorldAreaResources(): void {
  // Type mapping: resources.json type → TerrainResourceSpawnPoint type
  const typeMap: Record<string, TerrainResourceSpawnPoint['type']> = {
    'tree': 'tree',
    'fishing_spot': 'fish',
    'herb_patch': 'herb',
    'rock': 'rock',
    'ore': 'ore',
  };

  for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
    if (!area.resources || area.resources.length === 0) continue;

    const spawnPoints: TerrainResourceSpawnPoint[] = [];

    for (const r of area.resources) {
      // Look up resource in manifest to get authoritative type
      const resourceData = getExternalResource(r.resourceId);
      if (!resourceData) {
        console.warn(`[ResourceSystem] Unknown resource ID in world-areas: ${r.resourceId}`);
        continue;
      }

      // Map type (e.g., "fishing_spot" → "fish")
      const mappedType = typeMap[resourceData.type] || resourceData.type;

      // Extract subType by removing type prefix from resourceId
      // "tree_oak" - "tree_" = "oak"
      // "tree_normal" - "tree_" = "normal" → undefined
      const suffix = r.resourceId.replace(resourceData.type + '_', '');
      const subType = suffix === 'normal' ? undefined : suffix;

      // Ground Y position to terrain height
      let groundedY = r.position.y;
      if (this.terrainSystem) {
        const terrainHeight = this.terrainSystem.getHeightAt(r.position.x, r.position.z);
        if (Number.isFinite(terrainHeight)) {
          groundedY = terrainHeight + 0.1; // Slight offset above ground
        }
      }

      spawnPoints.push({
        position: { x: r.position.x, y: groundedY, z: r.position.z },
        type: mappedType as TerrainResourceSpawnPoint['type'],
        subType: subType as TerrainResourceSpawnPoint['subType'],
      });
    }

    if (spawnPoints.length > 0) {
      console.log(
        `[ResourceSystem] Spawning ${spawnPoints.length} explicit resources for area "${areaId}"`
      );
      this.registerTerrainResources({ spawnPoints });
    }
  }
}
```

---

## Files to Change

| File | Change | Lines |
|------|--------|-------|
| `ResourceSystem.ts` | Add import for `ALL_WORLD_AREAS` | +1 |
| `ResourceSystem.ts` | Add `terrainSystem` property | +1 |
| `ResourceSystem.ts` | Get terrain system in `init()` | +3 |
| `ResourceSystem.ts` | Call `initializeWorldAreaResources()` in `init()` | +3 |
| `ResourceSystem.ts` | Add `initializeWorldAreaResources()` method | +45 |

**Total: ~53 lines of new code**

---

## Optional Cleanup (Later)

### Simplify BiomeResource type
Remove redundant fields since resources.json provides them:
```typescript
export interface BiomeResource {
  resourceId: string;           // References resources.json
  position: WorldPosition;
}
```

### Clean up world-areas.json
Remove redundant `type`, `respawnTime`, `level` fields:
```json
"resources": [
  { "resourceId": "tree_normal", "position": { "x": 15, "y": 0, "z": -10 } }
]
```

### Disable procedural for starter_town (if overlap is a problem)
```typescript
// In TerrainSystem tree generation
if (biome === "starter_town") return;
```

---

## Testing Checklist

1. [ ] Resources appear at positions defined in world-areas.json
2. [ ] Resources are grounded to terrain (not floating/underground)
3. [ ] Resources are harvestable (correct type recognized)
4. [ ] Resources use correct model from resources.json template
5. [ ] Resources respawn after harvesting
6. [ ] No overlap issues with procedural resources (or acceptable)

---

## Potential Issues to Watch

1. **Timing:** If `init()` runs before terrain mesh is generated, `getHeightAt()` might return incorrect values. TerrainSystem should be ready since it's initialized before ResourceSystem processes.

2. **Starter town tile:** Central Haven resources are at (15, -10), (18, -8), (12, -12) - all within tile (0, 0) which generates first. Should work fine.

3. **Type validation:** If a resourceId in world-areas.json doesn't match any entry in resources.json, we log a warning and skip it.
