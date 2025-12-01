# World Areas Manifest Field Status

This document tracks which fields in `world-areas.json` are actually hooked up to game logic.

**Last Updated:** 2024

## Top-Level Structure

| Field | Status | Notes |
|-------|--------|-------|
| `starterTowns` | ✅ Used | Merged into `ALL_WORLD_AREAS` by DataManager |
| `level1Areas` | ✅ Used | Merged into `ALL_WORLD_AREAS` by DataManager |
| `level2Areas` | ✅ Used | Merged into `ALL_WORLD_AREAS` by DataManager |
| `level3Areas` | ✅ Used | Merged into `ALL_WORLD_AREAS` by DataManager |

## WorldArea Fields

| Field | Status | Used By | Notes |
|-------|--------|---------|-------|
| `id` | ✅ Working | MobNPCSpawnerSystem, NPCSystem | Area identifier, used in logs and spawn IDs |
| `name` | ✅ Working | ZoneDetectionSystem, NPCSystem | Display name, returned in zone info |
| `description` | ❌ NOT USED | - | Loaded but never displayed anywhere |
| `difficultyLevel` | ✅ Working | ZoneDetectionSystem | 0=safe, 1-3=combat zones, returned in zone info |
| `bounds` | ✅ Working | ZoneDetectionSystem, NPCSystem, MobNPCSpawnerSystem | Area boundaries for spawn logic and zone detection |
| `biomeType` | ❌ NOT USED | - | Only hardcoded defaults exist, never actually read |
| `safeZone` | ✅ Working | ZoneDetectionSystem, NPCSystem | Disables PvP, marks respawn points |
| `npcs` | ✅ Working | NPCSystem | Non-combat NPCs (bankers, shopkeepers, etc.) |
| `resources` | ❌ NOT USED | - | **Resources come from separate `resources.json`** |
| `mobSpawns` | ⚠️ PARTIAL | MobNPCSystem, MobNPCSpawnerSystem | See details below |
| `connections` | ❌ NOT USED | - | `getConnectedAreas()` helper exists but is never called |
| `specialFeatures` | ❌ NOT USED | - | Only ever set to empty array `[]` |

## NPCLocation Fields (within `npcs` array)

For non-combat NPCs like bankers and shopkeepers.

| Field | Status | Used By | Notes |
|-------|--------|---------|-------|
| `id` | ✅ Working | NPCSystem | NPC identifier, emitted in spawn request |
| `name` | ✅ Working | NPCSystem | Display name |
| `type` | ✅ Working | NPCSystem | `bank`, `general_store`, `skill_trainer`, `quest_giver` |
| `position` | ✅ Working | NPCSystem | World coordinates, grounded to terrain |
| `services` | ✅ Working | NPCSystem | Service types available |
| `modelPath` | ✅ Working | NPCSystem | 3D model path |
| `description` | ✅ Working | NPCSystem | Used in NPC dialogue (`NPCSystem.ts:294`) |

## MobSpawnPoint Fields (within `mobSpawns` array)

| Field | Status | Used By | Notes |
|-------|--------|---------|-------|
| `mobId` | ✅ Working | MobNPCSystem | References NPC ID from `npcs.json` |
| `position` | ✅ Working | MobNPCSystem | Center of spawn area |
| `spawnRadius` | ✅ Working | MobNPCSystem | Mobs scatter randomly within this radius |
| `maxCount` | ✅ Working | MobNPCSystem | Number of mobs to spawn at this point |
| `respawnTime` | ❌ NOT USED | - | **REDUNDANT** - System uses `npcs.json` `combat.respawnTime` instead |

### Respawn Time Redundancy Proof

The `respawnTime` in `mobSpawns` is **completely ignored**. Both spawner systems use the NPC's combat.respawnTime from npcs.json:

```typescript
// MobNPCSpawnerSystem.ts:178
respawnTime: goblinData.combat.respawnTime,  // From npcs.json

// MobNPCSystem.ts:78
respawnTime: npcData.combat.respawnTime || this.GLOBAL_RESPAWN_TIME,  // From npcs.json
```

**Your manifest says:**
- world-areas.json: `"respawnTime": 300000` (5 minutes) - **IGNORED**
- npcs.json: `"respawnTime": 15000` (15 seconds) - **ACTUALLY USED**

## BiomeResource Fields (within `resources` array)

**ENTIRE SECTION NOT USED** - Resources are loaded from a **separate manifest** (`resources.json`), not from world-areas.json.

| Field | Status | Notes |
|-------|--------|-------|
| `type` | ❌ NOT USED | `tree`, `ore`, etc. |
| `position` | ❌ NOT USED | World coordinates |
| `resourceId` | ❌ NOT USED | Resource type ID |
| `respawnTime` | ❌ NOT USED | Respawn delay |
| `level` | ❌ NOT USED | Required level |

## Issues & Recommendations

### 1. Redundant `respawnTime` in mobSpawns
**Problem:** `mobSpawns[].respawnTime` is defined but completely ignored. System uses `npcs.json` `combat.respawnTime`.

**Recommendation:** Remove `respawnTime` from world-areas.json mobSpawns to avoid confusion.

### 2. Resources Array is Dead Code
**Problem:** The `resources` array in world-areas.json is completely ignored. Resources are spawned from `resources.json`.

**Recommendation:** Remove the `resources` array from world-areas.json entirely.

### 3. Unused Fields to Remove
The following fields can be safely removed from WorldArea:
- `description` (area-level, not NPCLocation-level)
- `biomeType`
- `resources[]` (entire array)
- `connections`
- `specialFeatures`

## Data Flow Summary

```
world-areas.json
      │
      ▼
  DataManager.loadExternalData()
      │
      ├──► ALL_WORLD_AREAS (merged from all area categories)
      │
      ▼
  Systems read from ALL_WORLD_AREAS:
      │
      ├── MobNPCSystem.initializeSpawnPoints()
      │   └── Uses: mobSpawns.mobId, position, spawnRadius, maxCount
      │   └── IGNORES: mobSpawns.respawnTime (uses npcs.json value)
      │
      ├── MobNPCSpawnerSystem.spawnMobsForArea()
      │   └── Uses: bounds, mobSpawns.mobId, position, spawnRadius, maxCount
      │   └── IGNORES: mobSpawns.respawnTime
      │
      ├── NPCSystem.generateNPCsForArea()
      │   └── Uses: npcs[] array fields
      │   └── id, name, type, position, services, modelPath, description
      │
      ├── ZoneDetectionSystem.getCurrentZone()
      │   └── Uses: bounds, safeZone, difficultyLevel, name
      │
      └── NPCSystem.getStarterTownConfigs()
          └── Uses: id, name, bounds, npcs, safeZone
```

## Minimal Working Manifest

Based on what's actually used:

```json
{
  "starterTowns": {
    "lumbridge": {
      "id": "lumbridge",
      "name": "Lumbridge",
      "difficultyLevel": 0,
      "bounds": { "minX": -20, "maxX": 20, "minZ": -20, "maxZ": 20 },
      "safeZone": true,
      "npcs": [
        {
          "id": "banker_bob",
          "name": "Banker Bob",
          "type": "bank",
          "position": { "x": 10, "y": 0, "z": 5 },
          "services": ["bank"],
          "description": "A friendly banker"
        }
      ],
      "mobSpawns": [
        {
          "mobId": "goblin",
          "position": { "x": 5, "y": 0, "z": 5 },
          "spawnRadius": 5,
          "maxCount": 3
        }
      ]
    }
  },
  "level1Areas": {},
  "level2Areas": {},
  "level3Areas": {}
}
```

**Removed (unused):**
- `description` (area level)
- `biomeType`
- `resources[]` (entire array - use resources.json instead)
- `connections`
- `specialFeatures`
- `mobSpawns[].respawnTime` (uses npcs.json value)

---

# CRITICAL: zones.json vs world-areas.json Redundancy

**There are TWO zone manifest systems doing similar things!**

## The Two Systems

| Manifest | Loaded Into | Primary Use |
|----------|-------------|-------------|
| `world-areas.json` | `ALL_WORLD_AREAS` | Mob spawns, NPCs, zone detection (PRIMARY) |
| `zones.json` | `WORLD_ZONES` | Zone detection (FALLBACK), player respawn |

## How ZoneDetectionSystem Uses Both

```typescript
// ZoneDetectionSystem.ts lines 97-157

// Check world areas FIRST (from data/world-areas.ts)
for (const area of Object.values(ALL_WORLD_AREAS)) { ... }

// Check zones SECOND as FALLBACK (from data/world-structure.ts)
const zone = getZoneByPosition(position);
```

## zones.json Field Status

| Field | Status | Notes |
|-------|--------|-------|
| `id` | ⚠️ Fallback | Only used if no world-area matches |
| `name` | ⚠️ Fallback | Only used if no world-area matches |
| `biome` | ❌ NOT USED | Never read |
| `bounds` | ⚠️ Fallback | Format: `{x, z, width, height}` (different from world-areas!) |
| `difficultyLevel` | ⚠️ Fallback | Only used if no world-area matches |
| `isTown` | ✅ Used | Used by `getNearestTown()` for respawn |
| `hasBank` | ✅ Used | Used by `getNearestTown()` |
| `hasGeneralStore` | ✅ Used | Used by `getNearestTown()` |
| `spawnPoints[type="player"]` | ✅ Used | Used for respawn location by `getNearestTown()` |
| `spawnPoints[type="mob"]` | ❌ **DEAD CODE** | MobNPCSystem only reads world-areas.json |
| `spawnPoints[type="resource"]` | ❌ **DEAD CODE** | ResourceSystem uses resources.json |

## The Problem

**zones.json has 40+ mob spawn entries that do NOTHING:**
- `MobNPCSystem` only reads `ALL_WORLD_AREAS`
- `MobNPCSpawnerSystem` only reads `ALL_WORLD_AREAS`
- All those goblin, bandit, hobgoblin spawns in zones.json are completely ignored

**Proof:**
```bash
# Neither system imports WORLD_ZONES or world-structure
grep -r "WORLD_ZONES\|world-structure" MobNPCSystem.ts       # No matches
grep -r "WORLD_ZONES\|world-structure" MobNPCSpawnerSystem.ts # No matches
```

## Bounds Format Mismatch

| Manifest | Bounds Format |
|----------|---------------|
| `world-areas.json` | `{ minX, maxX, minZ, maxZ }` |
| `zones.json` | `{ x, z, width, height }` |

This inconsistency makes consolidation harder.

## Recommendation: Consolidate to ONE System

**Option A: Keep world-areas.json (recommended)**
1. Add player spawn points to world-areas.json
2. Delete zones.json entirely
3. Update `getNearestTown()` to use ALL_WORLD_AREAS

**Option B: Keep zones.json**
1. Wire up zones.json mob spawns to MobNPCSystem
2. Delete world-areas.json
3. Standardize bounds format

**Current State:** Both manifests are loaded, causing confusion and 40+ dead mob spawn definitions in zones.json.

---

# biomes.json - Partially Used with Many Dead Fields

**biomes.json IS used by TerrainSystem** for procedural terrain generation, but has significant field redundancy.

## How It's Loaded

```typescript
// DataManager.ts:193-196
const biomesRes = await fetch(`${baseUrl}/biomes.json`);
const biomeList = (await biomesRes.json()) as Array<BiomeData>;
for (const biome of biomeList) {
  BIOMES[biome.id] = biome;
}
```

## Fields Actually Used by TerrainSystem

| Field | Status | Used For |
|-------|--------|----------|
| `id` | ✅ Used | Biome lookup key |
| `color` | ✅ Used | Terrain vertex coloring (`TerrainSystem.ts:983`) |
| `resources` | ✅ Used | Tree/resource generation (`TerrainSystem.ts:1382-1383`) |
| `maxSlope` | ✅ Used | Terrain traversability check (`TerrainSystem.ts:1923`) |
| `difficulty` | ✅ Used | Mob spawn decisions (`TerrainSystem.ts:2157`) |
| `mobTypes` | ✅ Used | Which mobs spawn in biome (`TerrainSystem.ts:2206`) |

## Fields NOT Used (Dead Code)

| Field | Status | Notes |
|-------|--------|-------|
| `name` | ❌ NOT USED | Never displayed |
| `description` | ❌ NOT USED | Never displayed |
| `difficultyLevel` | ❌ **DUPLICATE** | Use `difficulty` instead |
| `terrain` | ❌ NOT USED | Never read |
| `mobs` | ❌ **DUPLICATE** | Use `mobTypes` instead |
| `fogIntensity` | ❌ NOT USED | No fog system implemented |
| `ambientSound` | ❌ NOT USED | No ambient sound system |
| `colorScheme` | ❌ NOT USED | Uses `color` (single int) instead |
| `heightRange` | ❌ NOT USED | Never read |
| `terrainMultiplier` | ❌ NOT USED | Never read |
| `waterLevel` | ❌ NOT USED | Never read |
| `baseHeight` | ❌ NOT USED | Never read |
| `heightVariation` | ❌ NOT USED | Never read |
| `resourceDensity` | ❌ NOT USED | Never read |
| `resourceTypes` | ❌ **DUPLICATE** | Use `resources` instead |

## Duplicate Fields Problem

biomes.json has THREE pairs of duplicate fields:

| Used Field | Ignored Duplicate |
|------------|-------------------|
| `difficulty` | `difficultyLevel` |
| `mobTypes` | `mobs` |
| `resources` | `resourceTypes` |

## Minimal Working Biome Entry

```json
{
  "id": "forest",
  "color": 3046706,
  "resources": ["trees", "fishing_spots"],
  "maxSlope": 0.8,
  "difficulty": 1,
  "mobTypes": ["goblin", "bandit"]
}
```

**Removed (unused):**
- `name`, `description`
- `difficultyLevel` (duplicate of `difficulty`)
- `terrain`
- `mobs` (duplicate of `mobTypes`)
- `fogIntensity`, `ambientSound`
- `colorScheme` (use `color` instead)
- `heightRange`, `terrainMultiplier`, `waterLevel`
- `baseHeight`, `heightVariation`
- `resourceDensity`
- `resourceTypes` (duplicate of `resources`)

---

# Summary: Three Manifests with Major Redundancy

| Manifest | Primary Purpose | Dead Code % |
|----------|----------------|-------------|
| `world-areas.json` | Zone detection, mob spawns, NPCs | ~40% unused fields |
| `zones.json` | Player respawn only | ~80% dead (mob spawns ignored) |
| `biomes.json` | Terrain generation | ~60% unused fields |

## Recommended Cleanup

1. **Consolidate zones.json into world-areas.json** - Add player spawn points to world-areas, delete zones.json
2. **Remove duplicate fields from biomes.json** - Keep only `id`, `color`, `resources`, `maxSlope`, `difficulty`, `mobTypes`
3. **Remove dead fields from world-areas.json** - Remove `description`, `biomeType`, `resources[]`, `connections`, `specialFeatures`, `mobSpawns[].respawnTime`
