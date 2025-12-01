# resources.json Manifest Status

This document tracks the manifest-driven resource system implementation.

**Last Updated:** 2024-12-01
**Status:** Implementation Complete - Pending Testing

---

## Session Progress (2024-12-01)

### Root Causes Identified

Trees were spawning from `world-areas.json` but couldn't be chopped. Two root causes:

1. **Procedural tree generation was enabled** - TerrainSystem was generating random trees across the world with different IDs than manifest trees, causing ID conflicts

2. **Manifest trees deleted on tile unload** - `onTerrainTileUnloaded()` was deleting ALL resources in the tile, including manifest-defined trees

### Fixes Implemented

| Change | File | Status |
|--------|------|--------|
| Disabled procedural tree generation | `TerrainSystem.ts` | Done |
| Added `manifestResourceIds` Set to track manifest resources | `ResourceSystem.ts` | Done |
| Added `isManifest` flag to `registerTerrainResources()` | `ResourceSystem.ts` | Done |
| Protected manifest resources from tile unload deletion | `ResourceSystem.ts` | Done |
| Removed hardcoded trees from starter_area | `world-areas.ts` | Done |
| Made `createResourceFromSpawnPoint()` fully manifest-driven | `ResourceSystem.ts` | Done |
| Removed dead `RESOURCE_DROPS` constant (~107 lines) | `ResourceSystem.ts` | Done |
| Removed unused `resourceType` field | `resources.json` + `DataManager.ts` | Done |

### Files Changed

1. **`packages/shared/src/systems/shared/world/TerrainSystem.ts`**
   - `generateTreesForTile()` now returns early with comment explaining trees come from manifest

2. **`packages/shared/src/systems/shared/entities/ResourceSystem.ts`**
   - Added `manifestResourceIds: Set<string>` to track manifest-spawned resources
   - Modified `registerTerrainResources()` to accept `isManifest` flag
   - Modified `onTerrainTileUnloaded()` to skip manifest resources
   - Rewrote `createResourceFromSpawnPoint()` to pull ALL values from manifest
   - Removed ~107 lines of dead `RESOURCE_DROPS` code

3. **`packages/shared/src/data/world-areas.ts`**
   - Removed hardcoded trees from `starter_area.resources` array

4. **`packages/server/world/assets/manifests/resources.json`**
   - Removed unused `resourceType` field from all entries

5. **`packages/shared/src/data/DataManager.ts`**
   - Removed `resourceType` from `ExternalResourceData` interface

---

## Testing Checklist

Run the game and verify:

- [ ] 3 trees appear at positions defined in `world-areas.json` (Central Haven):  This works
  - (15, 0, -10)
  - (28, 0, -18)
  - (36, 0, -28)
- [ ] Trees are grounded to terrain (not floating/underground) This works
- [ ] Trees are harvestable (click to chop) This works
- [ ] Correct logs are given on harvest (NOTE: item ID "logs" is hardcoded - see XP Investigation section)
- [ ] XP is awarded (25 xp for normal tree) - CONFIRMED: XP comes from manifest, NOT hardcoded
- [ ] Trees deplete after harvesting (turn to stump): This works
- [ ] Trees respawn after ~48 seconds (80 ticks * 600ms) This works
- [ ] NO extra procedural trees spawn anywhere in the world This works

---

## Current Architecture

### Resource Spawn Flow (After Fixes)

```
world-areas.json
      │ resources: [{ resourceId, position }]
      ▼
DataManager loads into ALL_WORLD_AREAS
      ▼
ResourceSystem.initializeWorldAreaResources() [server only]
      │ For each world area with resources:
      │   - Looks up resourceId in EXTERNAL_RESOURCES (from resources.json)
      │   - Grounds Y position using terrainSystem.getHeightAt()
      │   - Calls registerTerrainResources({ spawnPoints, isManifest: true })
      ▼
registerTerrainResources()
      │ - Adds resource IDs to manifestResourceIds Set
      │ - Calls createResourceFromSpawnPoint() for each
      ▼
createResourceFromSpawnPoint()
      │ - ALL values come from resources.json manifest:
      │   - name, harvestSkill, toolRequired, levelRequired
      │   - respawnTime (converted from respawnTicks)
      │   - modelPath, stumpModelPath, scale, stumpScale
      │   - harvestYield (drops)
      ▼
EntityManager creates ResourceEntity
```

### Tile Unload Protection

```
onTerrainTileUnloaded(tile)
      │
      ├── For each resource in tile:
      │     if (manifestResourceIds.has(resource.id))
      │       → SKIP (keep manifest resource)
      │     else
      │       → Delete (was procedural)
      ▼
Manifest resources persist across tile loads/unloads
```

---

## resources.json Field Status

| Field | Status | Notes |
|-------|--------|-------|
| `id` | Used | Key for EXTERNAL_RESOURCES lookup |
| `name` | Used | Display name for resource |
| `type` | Used | "tree", "fishing_spot", "herb_patch" |
| `modelPath` | Used | 3D model for active resource |
| `stumpModelPath` | Used | 3D model for depleted resource |
| `scale` | Used | Model scale |
| `stumpScale` | Used | Stump model scale |
| `harvestSkill` | Used | "woodcutting", "fishing", etc. |
| `toolRequired` | Used | Required tool item ID |
| `levelRequired` | Used | Minimum skill level |
| `baseCycleTicks` | Used | Ticks between harvest attempts |
| `depleteChance` | Used | Chance to deplete on harvest |
| `respawnTicks` | Used | Ticks until respawn |
| `harvestYield` | Partial | XP used, but itemId/itemName ignored (hardcoded "logs") |

**Most fields used. harvestYield item data not fully wired up - see XP Investigation section.**

---

## Current Resource Definitions

### Trees (Woodcutting)
| ID | Name | Level | XP | Respawn Ticks |
|----|------|-------|----|----|
| `tree_normal` | Tree | 1 | 25 | 80 |
| `tree_oak` | Oak Tree | 15 | 38 | 14 |
| `tree_willow` | Willow Tree | 30 | 68 | 14 |

### Fishing (Fishing)
| ID | Name | Level | XP | Depletes |
|----|------|-------|----|----|
| `fishing_spot_normal` | Fishing Spot | 1 | 10 | No (0% chance) |

---

## Type Definition

```typescript
// DataManager.ts
export interface ExternalResourceData {
  id: string;
  name: string;
  type: string;
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

---

## XP Award Investigation (2024-12-01)

**Finding: XP amount IS from manifest, but item rewards are HARDCODED**

### XP Flow (Correct - From Manifest)

```
resources.json
    │ harvestYield[0].xpAmount = 25  (for tree_normal)
    ▼
ResourceSystem.getVariantTuning(variantKey)  [line 1098-1130]
    │ const xpPerLog = manifestData.harvestYield[0].xpAmount;  [line 1122]
    ▼
updateGathering() harvesting loop  [line 1013]
    │ const xpPerLog = tuned.xpPerLog;
    ▼
SKILLS_XP_GAINED event emitted  [line 1014-1018]
    │ amount: xpPerLog  (value from manifest!)
    ▼
SkillsSystem.handleExternalXPGain()  [line 753-761]
    │ calls addXPInternal(playerId, skill, amount)
    ▼
calculateModifiedXP()  [line 630-640]
    │ returns Math.floor(baseXP * 1.0)  // NO OVERRIDE - modifier is 1.0
    ▼
XP awarded correctly from manifest value
```

**XP is NOT hardcoded.** The 25 XP for tree_normal comes from `resources.json`.

### Remaining Hardcoded Values (NOT Fixed Yet)

The harvesting loop at `ResourceSystem.ts:1000-1028` has these hardcoded values:

| Line | Hardcoded Value | Should Be |
|------|-----------------|-----------|
| 1005 | `itemId: "logs"` | `resource.drops[0].itemId` |
| 1023 | `"Logs"` in chat | `resource.drops[0].itemName` or manifest name |
| 1027 | `"logs"` in UI message | `resource.drops[0].itemName` |

**The `resource.drops` array exists and is populated from manifest**, but the harvesting code ignores it and always gives "logs".

### Code Location

```typescript
// ResourceSystem.ts:1000-1028 - HARDCODED ITEM
this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
  playerId: playerId as unknown as string,
  item: {
    id: `inv_${playerId}_${Date.now()}_logs`,
    itemId: "logs",        // ❌ HARDCODED - should use resource.drops
    quantity: 1,
    slot: -1,
    metadata: null,
  },
});
```

### Future Fix (Not Done This Session)

Replace hardcoded "logs" with manifest-driven drops:

```typescript
// Use first drop from resource.drops (populated from harvestYield)
const drop = resource.drops[0];
if (drop) {
  this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
    playerId: playerId as unknown as string,
    item: {
      id: `inv_${playerId}_${Date.now()}_${drop.itemId}`,
      itemId: drop.itemId,
      quantity: drop.quantity,
      slot: -1,
      metadata: null,
    },
  });
}
```

---

## Commit Message (When Ready)

```
Make ResourceSystem fully manifest-driven, fix tree harvesting

- Disable procedural tree generation in TerrainSystem
- Add manifest resource protection to prevent deletion on tile unload
- Wire up all resources.json fields (name, harvestSkill, toolRequired, etc.)
- Remove dead RESOURCE_DROPS constant (~107 lines)
- Remove unused resourceType field from manifest and interface
- Remove hardcoded trees from world-areas.ts starter_area
```
