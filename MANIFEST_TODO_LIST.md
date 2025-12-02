# Manifest TODO List

This document tracks manifest inconsistencies and improvements needed for OSRS-style game tick standardization.

---

## 1. NPCs: attackSpeed/respawnTime should use game ticks

**File:** `packages/server/world/assets/manifests/npcs.json`

**Status:** ✅ COMPLETED

**What was fixed:**
- Changed `attackSpeed: 2400` → `attackSpeedTicks: 4` in npcs.json
- Changed `respawnTime: 15000` → `respawnTicks: 25` in npcs.json
- Updated all code references to use `attackSpeedTicks` directly (no conversion)
- Fixed the bug where mobs attacked once every 4,000,000 ticks instead of 4 ticks
- DataManager converts `respawnTicks` to `respawnTime` (ms) for internal use

**Files modified for attackSpeedTicks:**
1. `npcs.json` - Field rename
2. `DataManager.ts` - Field mapping
3. `MobEntity.ts` - Use ticks directly
4. `MobNPCSpawnerSystem.ts` - Field references
5. `CombatSystem.ts` - getAttackSpeedTicks for mobs
6. `EntityManager.ts` - getMobAttackSpeedTicks method
7. `npc-mob-types.ts` - Type definitions
8. `entities.ts` - Type definitions
9. `Entities.ts` - Default value

**Files modified for respawnTicks:**
1. `npcs.json` - Field rename (`respawnTime` → `respawnTicks`)
2. `DataManager.ts` - Converts ticks to ms: `(npc.combat?.respawnTicks ?? 25) * 600`
3. `npc-mob-types.ts` - Added `respawnTicks?: number` to NPCCombatConfig

---

## 2. Resources: stumpModelPath should be depletedModelPath

**File:** `packages/server/world/assets/manifests/resources.json`

**Current state:**
```json
{
  "id": "tree_normal",
  "stumpModelPath": "asset://models/basic-reg-tree-stump/basic-tree-stump.glb",
  "stumpScale": 0.3
}
```

**Problem:**
- `stumpModelPath` is tree-specific terminology
- For mining rocks, the depleted state is an "empty rock", not a "stump"
- For fishing spots, `stumpModelPath: null` reads awkwardly
- Same issue applies to `stumpScale`

**Code references:**
- `ResourceEntity.ts:187-188`: uses `config.stumpModelPath`
- `DataManager.ts:64-66`: `stumpModelPath: string | null`, `stumpScale: number`
- `entities.ts:236`: type definition `stumpModelPath?: string | null`
- `ResourceSystem.ts:428,499,535`: `stumpModelPath`, `stumpScale` usage

**Solution:** Rename to generic terminology:
```json
{
  "id": "tree_normal",
  "depletedModelPath": "asset://models/basic-reg-tree-stump/basic-tree-stump.glb",
  "depletedScale": 0.3
}
```

**Required code changes:**
1. Update `resources.json` field names
2. Update `ExternalResourceData` interface in `DataManager.ts`
3. Update `ResourceEntity.ts` config property names
4. Update type definitions in `entities.ts`
5. Update `ResourceSystem.ts` getter methods
6. Consider backwards compatibility (support both names during transition)

**Status:** ❌ Not started

---

## 3. Items: weight field not used in client UI

**File:** `packages/client/src/game/panels/InventoryPanel.tsx`

**Current state in manifest (items.json):**
```json
{
  "id": "bronze_sword",
  "weight": 2
}
```

**Current state in client code (lines 323-328):**
```typescript
const totalWeight = items.reduce((sum, item) => {
  // Estimate weight based on item type (since we don't have full item data)
  const baseWeight = 0.5;
  const quantity = item.quantity || 1;
  return sum + baseWeight * quantity;
}, 0);
```

**Problem:**
- Client UI hardcodes `0.5kg` for ALL items instead of using the actual `weight` from the manifest
- The server-side `InventorySystem.getTotalWeight()` correctly uses `itemData?.weight`
- This causes inventory weight display to be inaccurate

**Code references:**
- `InventoryPanel.tsx:323-328`: hardcoded 0.5kg weight
- `InventorySystem.ts:986-988`: correctly uses `itemData?.weight`
- `DataManager.ts:265`: `weight: item.weight ?? 0.1` (default is 0.1, not 0.5)

**Solution:** Fetch actual item weight from shared data:
```typescript
import { getItem } from "@hyperscape/shared";

const totalWeight = items.reduce((sum, item) => {
  const itemData = getItem(item.itemId);
  const weight = itemData?.weight ?? 0.1;
  const quantity = item.quantity || 1;
  return sum + weight * quantity;
}, 0);
```

**Status:** ❌ Not started

---

## 4. Consistent tick-based timing across all manifests

**Goal:** All time-based values should use game ticks (600ms per tick) for OSRS authenticity.

| Manifest | Field | Current | Target | Status |
|----------|-------|---------|--------|--------|
| npcs.json | attackSpeedTicks | 4 (ticks) | ✅ Fixed | ✅ |
| npcs.json | respawnTicks | 25 (ticks) | ✅ Fixed | ✅ |
| items.json | attackSpeed | 4 (ticks) | ✅ Already correct | ✅ |
| resources.json | baseCycleTicks | 4 (ticks) | ✅ Already correct | ✅ |
| resources.json | respawnTicks | 80 (ticks) | ✅ Already correct | ✅ |

**Status:** ✅ All tick-based timing is now consistent across manifests!

---

## Notes

### Game Tick Reference (OSRS-style)
- 1 tick = 600ms
- Standard sword attack speed = 4 ticks (2400ms)
- Mob respawn = ~25 ticks (15 seconds) minimum
- Resource respawn = varies (trees ~80 ticks = 48 seconds)

### Priority
1. ~~**HIGH:** Fix npcs.json attackSpeed bug~~ ✅ DONE
2. **MEDIUM:** Fix client weight display to use manifest weights
3. **LOW:** Rename stumpModelPath for clarity
4. ~~**LOW:** Standardize npcs.json respawnTime to respawnTicks~~ ✅ DONE
