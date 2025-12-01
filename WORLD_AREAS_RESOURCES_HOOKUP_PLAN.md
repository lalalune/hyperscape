# Plan: Hook Up world-areas.json Resources to ResourceSystem

**Status:** NOT YET IMPLEMENTED

## Current State

### How Mobs Spawn (WORKS)

```
world-areas.json
      │ mobSpawns: [{ mobId, position, maxCount }]
      ▼
MobNPCSystem.initializeSpawnPoints()  (line 143)
      │ Iterates ALL_WORLD_AREAS
      │ Reads mobSpawns array
      ▼
Creates spawn points → Emits MOB_NPC_SPAWN_REQUEST
      ▼
EntityManager creates MobEntity
```

### How Resources Spawn (PROCEDURAL - ignores world-areas.json)

```
TerrainSystem.generateTileResources()  (line 1361)
      │ Uses BIOMES (biomes.json) to decide what to spawn
      │ Procedural noise-based placement
      ▼
Emits RESOURCE_SPAWN_POINTS_REGISTERED  (line 885)
      ▼
ResourceSystem.registerTerrainResources()  (line 194)
      │ Looks up template from resources.json
      ▼
Creates Resource entities
```

**world-areas.json `resources` array is currently DEAD CODE.**

## The Plan

### Step 1: Add `initializeWorldAreaResources()` in ResourceSystem.ts

```typescript
private initializeWorldAreaResources(): void {
  for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
    if (area.resources && area.resources.length > 0) {
      const spawnPoints = area.resources.map((r, i) => ({
        id: `${areaId}_resource_${i}`,
        type: r.resourceId,  // e.g., "tree_normal" - references resources.json
        position: r.position,
      }));

      // Use existing registration flow
      this.registerTerrainResources({ spawnPoints });
    }
  }
}
```

### Step 2: Call it in ResourceSystem.init()

```typescript
async init(): Promise<void> {
  // ... existing subscriptions ...

  // Load explicit resource placements from world-areas.json
  if (this.world.isServer) {
    this.initializeWorldAreaResources();
  }
}
```

### Step 3: Update BiomeResource type (if needed)

The `BiomeResource` type in world-areas.ts may need adjustment:

```typescript
interface BiomeResource {
  resourceId: string;  // References resources.json (e.g., "tree_normal")
  position: { x: number; y: number; z: number };
  type?: string;  // Optional, for backwards compatibility
}
```

### Step 4 (Optional): Disable Procedural for Starter Town

If we don't want TerrainSystem's procedural trees overlapping with explicit placements:

```typescript
// In TerrainSystem.generateTreesForTile()
if (tile.biome === "starter_town") {
  return; // Skip procedural - use explicit placements only
}
```

## Files to Change

| File | Change |
|------|--------|
| `ResourceSystem.ts` | Add `initializeWorldAreaResources()` method |
| `ResourceSystem.ts` | Call it in `init()` for server |
| `world-areas.ts` | Possibly update `BiomeResource` type |
| `TerrainSystem.ts` (optional) | Skip procedural for starter_town biome |

## Manifest Structure

world-areas.json resources should ONLY have:
- `resourceId` - References template in resources.json
- `position` - Where to spawn

Everything else (respawnTime, level, harvestYield, model, etc.) comes from resources.json.

```json
"resources": [
  {
    "resourceId": "tree_normal",
    "position": { "x": 15, "y": 0, "z": -10 }
  }
]
```

## Estimated Scope

~20-30 lines of new code, mirrors existing mob spawn pattern.
