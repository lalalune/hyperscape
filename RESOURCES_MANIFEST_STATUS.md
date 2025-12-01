# resources.json Manifest Status

This document analyzes the `resources.json` manifest and how resources work in the codebase.

**Last Updated:** 2024

## Summary

**`resources.json` IS USED and all fields are hooked up.** This is one of the better-structured manifests.

However, there are some issues:
1. ResourceSystem has HARDCODED `RESOURCE_DROPS` that is dead code
2. Resource spawn LOCATIONS come from TerrainSystem procedural generation, NOT from any manifest
3. world-areas.json `resources` array is completely dead (documented separately)

## How resources.json Is Loaded

```typescript
// DataManager.ts:148-170
const resourcesRes = await fetch(`${baseUrl}/resources.json`);
const resourceList = (await resourcesRes.json()) as Array<ExternalResourceData>;

for (const resource of resourceList) {
  EXTERNAL_RESOURCES.set(resource.id, resource);
}
```

Resources are stored in `globalThis.EXTERNAL_RESOURCES` Map.

## resources.json Field Status

| Field | Status | Used By | Notes |
|-------|--------|---------|-------|
| `id` | ✅ Used | ResourceSystem | Key for EXTERNAL_RESOURCES lookup |
| `name` | ✅ Used | Error messages | Display name |
| `type` | ✅ Used | ResourceSystem | "tree", "fishing_spot", "herb_patch" |
| `resourceType` | ✅ Used | ResourceSystem | Resource category |
| `modelPath` | ✅ Used | `getModelFromManifest()` | 3D model for active resource |
| `stumpModelPath` | ✅ Used | `getStumpModelFromManifest()` | 3D model for depleted resource |
| `scale` | ✅ Used | `getScaleFromManifest()` | Model scale |
| `stumpScale` | ✅ Used | `getStumpScaleFromManifest()` | Stump model scale |
| `harvestSkill` | ✅ Used | ResourceSystem | "woodcutting", "fishing", etc. |
| `toolRequired` | ✅ Used | ResourceSystem | Required tool item ID |
| `levelRequired` | ✅ Used | `getTunedResourceData()` | Minimum skill level |
| `baseCycleTicks` | ✅ Used | `getTunedResourceData()` | Ticks between harvest attempts |
| `depleteChance` | ✅ Used | `getTunedResourceData()` | Chance to deplete on harvest |
| `respawnTicks` | ✅ Used | `getTunedResourceData()` | Ticks until respawn |
| `harvestYield` | ✅ Used | `getDropsFromManifest()` | Items given on harvest |
| `harvestYield[].itemId` | ✅ Used | ResourceSystem | Item to give |
| `harvestYield[].itemName` | ✅ Used | ResourceSystem | Display name |
| `harvestYield[].quantity` | ✅ Used | ResourceSystem | Amount to give |
| `harvestYield[].chance` | ✅ Used | ResourceSystem | Drop chance |
| `harvestYield[].xpAmount` | ✅ Used | ResourceSystem | XP awarded |
| `harvestYield[].stackable` | ✅ Used | ResourceSystem | Item stacking |

**All fields are used!** This manifest is properly wired up.

## Resource Spawn Flow

```
TerrainSystem (procedural generation)
      │
      │ Generates spawn points based on biome
      │
      ▼
RESOURCE_SPAWN_POINTS_REGISTERED event
      │
      ▼
ResourceSystem.registerTerrainResources()
      │
      ├── Looks up resource template from EXTERNAL_RESOURCES (resources.json)
      │   └── Gets: modelPath, scale, harvestYield, respawnTicks, etc.
      │
      └── Creates Resource entity at spawn position
```

**Key Point:** Spawn LOCATIONS come from TerrainSystem procedural generation, NOT from a manifest. The resources.json only defines the resource TEMPLATES (what a tree is, what it drops, how fast it respawns).

## Dead Code in ResourceSystem

### HARDCODED RESOURCE_DROPS (Lines 59-163)

```typescript
private readonly RESOURCE_DROPS = new Map<string, ResourceDrop[]>([
  ["tree_normal", [{ itemId: "logs", ... }]],
  ["tree_oak", [{ itemId: "logs", ... }]],
  // ... etc
]);
```

**This is 100% dead code.** The actual drops come from `getDropsFromManifest()` which reads `harvestYield` from resources.json.

**Proof:**
```bash
grep -n "this.RESOURCE_DROPS" ResourceSystem.ts  # NO MATCHES
```

**Recommendation:** Delete the hardcoded `RESOURCE_DROPS` Map.

## Related Dead Code

### world-areas.json `resources` Array

The `resources` array in world-areas.json is completely dead:

```json
"resources": [
  {
    "type": "tree",
    "position": { "x": 15, "y": 0, "z": -10 },
    "resourceId": "logs",
    "respawnTime": 60000,  // ❌ REDUNDANT - already in resources.json as respawnTicks
    "level": 1             // ❌ REDUNDANT - already in resources.json as levelRequired
  }
]
```

- `getResourcesInArea()` helper exists but is **never called**
- Resources spawn from TerrainSystem procedural generation, not world-areas.json
- **Recommendation:** Remove the `resources` array from world-areas.json

**If we ever wire up world-areas.json for resource spawns, it should ONLY have:**
```json
"resources": [
  {
    "resourceId": "tree_normal",  // References resources.json
    "position": { "x": 15, "y": 0, "z": -10 }
  }
]
```

All other fields (`respawnTime`, `level`, `harvestYield`, etc.) come from resources.json - no duplication.

### ItemSpawnerSystem.spawnResourceItems()

```typescript
private async spawnResourceItems(): Promise<void> {
  const resourceSpawns = [
    { itemId: "logs", x: 2, y: 0, z: 2 },
    { itemId: "oak_logs", x: 3, y: 0, z: 2 },
    // ...
  ];
```

This spawns **harvested ITEMS** (logs, fish) as ground items near spawn, NOT harvestable resources (trees, fishing spots). The naming is confusing but this is working as intended for testing purposes.

## Current Resource Definitions

resources.json contains 8 resource templates:

### Trees (Woodcutting)
| ID | Name | Level | XP | Respawn Ticks |
|----|------|-------|----|----|
| `tree_normal` | Tree | 1 | 25 | 80 |
| `tree_oak` | Oak Tree | 15 | 38 | 14 |
| `tree_willow` | Willow Tree | 30 | 68 | 14 |
| `tree_maple` | Maple Tree | 45 | 100 | 59 |
| `tree_yew` | Yew Tree | 60 | 175 | 99 |
| `tree_magic` | Magic Tree | 75 | 250 | 199 |

### Fishing (Fishing)
| ID | Name | Level | XP | Depletes |
|----|------|-------|----|----|
| `fishing_spot_normal` | Fishing Spot | 1 | 10 | No (0% chance) |

### Herbs (Herblore)
| ID | Name | Level | XP | Respawn Ticks |
|----|------|-------|----|----|
| `herb_patch_normal` | Herb Patch | 1 | 20 | 50 |

## Missing: Manifest-Driven Spawn Locations

Currently, resource spawn LOCATIONS are procedurally generated by TerrainSystem. If you want to place specific resources at specific locations (like a special oak tree at a landmark), you would need to:

1. **Option A:** Add spawn location support to world-areas.json and wire it up
2. **Option B:** Create a new `resource-spawns.json` manifest
3. **Option C:** Keep procedural generation (current state)

For "minimal goblin, solid foundation" - the current procedural system works fine.

## Recommendations

### Immediate (Low Risk)
1. **Delete `RESOURCE_DROPS` hardcoded Map** in ResourceSystem.ts (dead code)

### Future (When Expanding)
1. Consider adding manifest-driven spawn locations if you want hand-placed resources
2. Add more resource types (ores for mining, etc.)

## Type Definition

```typescript
// DataManager.ts:58-81
export interface ExternalResourceData {
  id: string;
  name: string;
  type: string;
  resourceType: string;
  modelPath: string | null;
  stumpModelPath: string | null;
  scale: number;
  stumpScale: number;
  harvestSkill: string;
  toolRequired: string | null;
  levelRequired: number;
  baseCycleTicks: number;
  depleteChance: number;
  respawnTicks: number;
  harvestYield: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    chance: number;
    xpAmount: number;
    stackable: boolean;
  }>;
}
```
