# Manifest System Fix - Comprehensive Analysis Report

## Executive Summary

The manifest system has significant gaps between the **type definitions** (what code expects) and **actual manifest files** (what data provides). This report details all mismatches, missing fields, hardcoded values, and cascading dependencies across the NPC and Resource systems.

---

## Part 1: NPC/MOB SYSTEM DEEP DIVE

### 1.1 NPCData Type Definition (Full Structure)

**Source**: `packages/shared/src/types/entities/npc-mob-types.ts`

```typescript
interface NPCData {
  // ========== CORE IDENTITY ==========
  id: string;
  name: string;
  description: string;
  category: NPCCategory; // 'mob' | 'boss' | 'neutral' | 'quest'
  faction: string;

  // ========== STATS (ALL NPCs) ==========
  stats: NPCStats {
    level: number;
    health: number;
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
    ranged: number;
    magic: number;
  };

  // ========== COMBAT (ALL NPCs - use flags to disable) ==========
  combat: NPCCombatConfig {
    attackable: boolean;
    aggressive: boolean;
    retaliates: boolean;
    aggroRange: number;
    combatRange: number;
    attackSpeed: number;
    respawnTime: number;
    xpReward: number;
    poisonous: boolean;
    immuneToPoison: boolean;
  };

  // ========== MOVEMENT (ALL NPCs - use flags to disable) ==========
  movement: NPCMovementConfig {
    type: 'stationary' | 'wander' | 'patrol';
    speed: number;
    wanderRadius: number;
    patrolPath?: Position3D[];
    roaming: boolean;
  };

  // ========== DROPS (ALL NPCs - everyone drops something) ==========
  drops: NPCDrops {
    defaultDrop: DefaultDropConfig {
      itemId: string;
      quantity: number;
      enabled: boolean;
    };
    always: DropTableEntry[];
    common: DropTableEntry[];
    uncommon: DropTableEntry[];
    rare: DropTableEntry[];
    veryRare: DropTableEntry[];
    rareDropTable: boolean;
    rareDropTableChance?: number;
  };

  // ========== SERVICES (Optional - mainly for neutral NPCs) ==========
  services: NPCServicesConfig {
    enabled: boolean;
    types: ('bank' | 'shop' | 'quest' | 'skill_trainer' | 'teleport')[];
    shopInventory?: Array<{
      itemId: string;
      quantity: number;
      price: number;
      stockRefreshTime?: number;
    }>;
    dialogue?: unknown;
    questIds?: string[];
  };

  // ========== BEHAVIOR AI (Optional - for complex behaviors) ==========
  behavior: NPCBehaviorConfig {
    enabled: boolean;
    config?: unknown;
  };

  // ========== APPEARANCE ==========
  appearance: NPCAppearanceConfig {
    modelPath: string;
    iconPath?: string;
    scale: number;
    tint?: string;
  };

  // ========== SPAWN INFO ==========
  position: Position3D;
  spawnBiomes?: string[];
}
```

### 1.2 Current npcs.json Structure vs Required Fields

**File**: `packages/server/world/assets/manifests/npcs.json`

#### Goblin Entry (Current)
```json
{
  "id": "goblin",
  "name": "Goblin",
  "type": "npc",
  "npcType": "mob",
  "description": "A weak goblin creature",
  "modelPath": "asset://models/goblin/goblin_rigged.glb",
  "iconPath": "asset://icons/npcs/goblin.png",
  "category": "mob",
  "stats": {
    "level": 1,
    "constitution": 5,
    "attack": 1,
    "strength": 1,
    "defense": 1,
    "ranged": 1
  },
  "combat": {
    "aggressive": true,
    "attackSpeed": 2400,
    "maxHit": 1,
    "attackRange": 1.5
  },
  "drops": {
    "defaultDrop": { "enabled": false, "itemId": "", "quantity": 0 },
    "always": [],
    "common": [],
    "uncommon": [],
    "rare": [],
    "veryRare": []
  },
  "spawnBiomes": ["forest", "plains"],
  "dialogueLines": []
}
```

#### Type Mismatch Analysis

| Required Field | In npcs.json | Type | Status |
|---|---|---|---|
| `id` | ✓ "goblin" | string | OK |
| `name` | ✓ "Goblin" | string | OK |
| `description` | ✓ "A weak goblin..." | string | OK |
| `category` | ✓ "mob" | enum | OK |
| `faction` | ✗ | string | **MISSING** |
| `stats.level` | ✓ 1 | number | OK |
| `stats.health` | ✗ | number | **MISSING** - Derived from constitution |
| `stats.attack` | ✓ 1 | number | OK |
| `stats.strength` | ✓ 1 | number | OK |
| `stats.defense` | ✓ 1 | number | OK |
| `stats.constitution` | ✓ 5 | number | OK |
| `stats.ranged` | ✓ 1 | number | OK |
| `stats.magic` | ✗ | number | **MISSING** |
| `combat.attackable` | ✗ | boolean | **MISSING** |
| `combat.aggressive` | ✓ true | boolean | OK |
| `combat.retaliates` | ✗ | boolean | **MISSING** |
| `combat.aggroRange` | ✗ | number | **MISSING** |
| `combat.combatRange` | ~ "attackRange": 1.5 | number | **WRONG FIELD NAME** |
| `combat.attackSpeed` | ✓ 2400 | number | OK (but in ms, should be seconds) |
| `combat.respawnTime` | ✗ | number | **MISSING** |
| `combat.xpReward` | ✗ | number | **MISSING** |
| `combat.poisonous` | ✗ | boolean | **MISSING** |
| `combat.immuneToPoison` | ✗ | boolean | **MISSING** |
| `movement.type` | ✗ | enum | **MISSING** |
| `movement.speed` | ✗ | number | **MISSING** |
| `movement.wanderRadius` | ✗ | number | **MISSING** |
| `movement.roaming` | ✗ | boolean | **MISSING** |
| `drops.defaultDrop.enabled` | ✓ false | boolean | OK |
| `drops.defaultDrop.itemId` | ✓ "" | string | OK |
| `drops.defaultDrop.quantity` | ✓ 0 | number | OK |
| `drops.always[]` | ✓ [] | array | OK (empty) |
| `drops.common[]` | ✓ [] | array | OK (empty) |
| `drops.uncommon[]` | ✓ [] | array | OK (empty) |
| `drops.rare[]` | ✓ [] | array | OK (empty) |
| `drops.veryRare[]` | ✓ [] | array | OK (empty) |
| `drops.rareDropTable` | ✗ | boolean | **MISSING** |
| `drops.rareDropTableChance` | ✗ | number | **MISSING** |
| `services.enabled` | ✗ | boolean | **MISSING** |
| `services.types[]` | ✗ | enum[] | **MISSING** |
| `behavior.enabled` | ✗ | boolean | **MISSING** |
| `behavior.config` | ✗ | unknown | **MISSING** |
| `appearance.modelPath` | ✓ "asset://models/goblin/..." | string | OK |
| `appearance.iconPath` | ✓ "asset://icons/npcs/goblin.png" | string | OK |
| `appearance.scale` | ✗ | number | **MISSING** |
| `appearance.tint` | ✗ | string | **MISSING** |
| `position` | ✗ | Position3D | **MISSING** |
| `spawnBiomes` | ✓ ["forest", "plains"] | string[] | OK |

**Critical Issues Found**:
1. **17 required fields MISSING** from npcs.json
2. **2 field name mismatches** (attackRange vs combatRange)
3. **1 type unit mismatch** (attackSpeed in ms vs expected seconds)
4. No position data (NPCs spawned at origin)
5. No movement configuration
6. No XP reward data
7. No respawn timing

---

## Part 2: RESOURCE SYSTEM DEEP DIVE

### 2.1 Resource Type Definition

**Source**: `packages/shared/src/types/game/resource-processing-types.ts` (inferred from ResourceSystem usage)

```typescript
interface Resource {
  id: string;
  type: 'tree' | 'fishing_spot' | 'ore' | 'herb_patch';
  name: string;
  position: Position3D;
  skillRequired: string; // 'woodcutting', 'fishing', 'mining', 'herbalism'
  levelRequired: number;
  toolRequired: string;
  respawnTime: number; // milliseconds
  isAvailable: boolean;
  lastDepleted: number; // timestamp
  drops: ResourceDrop[];
}

interface ResourceDrop {
  itemId: string;
  itemName: string;
  quantity: number;
  chance: number; // 0-1
  xpAmount: number;
  stackable: boolean;
}
```

### 2.2 Current resources.json Structure

**File**: `packages/server/world/assets/manifests/resources.json`

```json
[
  {
    "id": "tree_normal",
    "name": "Tree",
    "type": "tree",
    "resourceType": "tree",
    "modelPath": "asset://models/tree/tree.glb",
    "harvestSkill": "woodcutting",
    "requiredLevel": 1,
    "harvestTime": 3000,
    "respawnTime": 60000,
    "harvestYield": [
      { "itemId": "logs", "quantity": 1, "chance": 1.0 }
    ]
  }
]
```

#### Type Mismatch Analysis

| Required by Code | In resources.json | Type | Status |
|---|---|---|---|
| `id` | ✓ "tree_normal" | string | OK |
| `name` | ✓ "Tree" | string | OK |
| `type` | ✓ "tree" | enum | OK |
| `position` | ✗ | Position3D | **MISSING** |
| `skillRequired` | ✓ "woodcutting" | string | OK |
| `levelRequired` | ✓ 1 | number | OK |
| `toolRequired` | ✗ | string | **MISSING** |
| `respawnTime` | ✓ 60000 | number | OK (ms) |
| `drops[].itemId` | ✓ "logs" | string | OK |
| `drops[].itemName` | ✗ | string | **MISSING** |
| `drops[].quantity` | ✓ 1 | number | OK |
| `drops[].chance` | ✓ 1.0 | number | OK |
| `drops[].xpAmount` | ✗ | number | **MISSING** |
| `drops[].stackable` | ✗ | boolean | **MISSING** |

**Critical Issues Found**:
1. **5 required fields MISSING** from resources.json
2. Resources don't have position data (spawned procedurally by terrain)
3. No tool requirement data
4. No XP reward data in manifest
5. No stackable flag

### 2.3 Hardcoded Resource Drop Tables

**Location**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts:57-162`

Hardcoded trees in code instead of manifest:
- tree_normal (25 XP)
- tree_oak (38 XP, level 15)
- tree_willow (68 XP, level 30)
- tree_maple (100 XP, level 45)
- tree_yew (175 XP, level 60)
- tree_magic (250 XP, level 75)
- herb_patch_normal (20 XP)
- fishing_spot_normal (10 XP)

**What needs to move to manifest**:
- XP per resource type
- Level requirements per tree variant
- Respawn times (in ticks, not ms)
- Depletion chances
- Drop definitions with quantities

---

## Part 3: CASCADING SYSTEM DEPENDENCIES

### 3.1 NPC Load Chain

```
DataManager.loadManifestsFromCDN()
    ↓
Loads npcs.json → ALL_NPCS Map
    ↓
Systems that depend on getNPCById():
    ├→ EntityManager.handleMobSpawn()
    │   ├→ Reads: appearance.modelPath
    │   ├→ Reads: stats (level, attack, defense, etc.)
    │   ├→ Reads: combat (aggroRange, combatRange, attackSpeed, xpReward)
    │   └→ Reads: drops (all drop tables)
    │
    ├→ MobNPCSpawnerSystem.spawnMobFromData()
    │   ├→ Reads: stats.level
    │   └→ Reads: combat.respawnTime
    │
    └→ MobNPCSystem.createMobConfigs()
        ├→ Reads: stats (all)
        ├→ Reads: combat (aggressive, aggroRange, respawnTime)
        └→ Reads: drops (all)

MobEntity.ts (constructor):
    ├→ Needs: mobType (from config)
    ├→ Needs: level, health, maxHealth
    ├→ Needs: attackPower, defense
    ├→ Needs: attackSpeed, moveSpeed
    └→ Needs: aggroRange, combatRange
```

### 3.2 Resource Load Chain

```
TerrainSystem generates spawn points
    ↓
ResourceSystem.registerTerrainResources()
    ├→ Calls: createResourceFromSpawnPoint()
    │   ├→ Hardcoded skillRequired by resource type
    │   ├→ Hardcoded toolRequired by resource type
    │   └→ Hardcoded respawnTime by resource type
    │
    └→ Creates ResourceEntityConfig
        ├→ model: this.getModelPathForResource() → HARDCODED PATHS
        ├→ harvestTime: HARDCODED (3000ms)
        ├→ harvestYield: this.RESOURCE_DROPS.get() → HARDCODED IN CODE
        └→ respawnTime: this.ticksToMs(tuned.respawnTicks) → HARDCODED TUNING

ResourceEntity.ts (constructor):
    └→ Uses provided ResourceEntityConfig

ResourceSystem tuning data (HARDCODED):
    ├→ getVariantTuning()
    │   ├→ levelRequired per variant (tree_oak=15, tree_willow=30, etc.)
    │   ├→ xpPerLog per variant (oak=38, willow=68, etc.)
    │   ├→ baseCycleTicks (ALL = 4 ticks)
    │   ├→ depleteChance (ALL = 0.125)
    │   └→ respawnTicks (oak=14, willow=14, maple=59, yew=99, magic=199)
    │
    └→ getModelPathForResource()
        ├→ tree → "asset://models/basic-reg-tree/basic-tree.glb"
        ├→ fishing_spot → ""
        ├→ ore/rock → ""
        └→ herb_patch → ""
```

### 3.3 What Systems Call getNPCById()

Files that access ALL_NPCS:
1. **EntityManager.ts** (6 methods):
   - `getMobMaxHealth()` - reads stats.health, stats.level
   - `getMobAttackPower()` - reads stats.attack
   - `getMobDefense()` - reads stats.defense
   - `getMobAttackSpeed()` - reads combat.attackSpeed
   - `getMobMoveSpeed()` - reads movement.speed
   - `getMobAggroRange()` - reads combat.aggroRange
   - `getMobCombatRange()` - reads combat.combatRange
   - `getMobXPReward()` - reads combat.xpReward
   - `getMobLootTable()` - reads all drops

2. **MobNPCSpawnerSystem.ts**:
   - `generateMobSpawnsForArea()` - calls ALL_NPCS.get()
   
3. **MobNPCSystem.ts**:
   - `createMobConfigs()` - iterates ALL_NPCS.entries()

4. **npcs.ts** (data/npcs.ts):
   - `canNPCDropItem()` - checks all drop tiers
   - Various query functions (getNPCsByCategory, getNPCsByBiome, etc.)

---

## Part 4: HARDCODED VALUES INVENTORY

### 4.1 In MobNPCSpawnerSystem (Lines 104-140)

```typescript
// Default goblin spawn config (HARDCODED)
const mobConfig = {
  mobType: "goblin",
  level: 2,
  currentHealth: 5,
  maxHealth: 5,
  attackPower: 2,
  defense: 1,
  attackSpeed: 2400,    // ← HARDCODED (should be from NPCs)
  moveSpeed: 2,         // ← HARDCODED
  xpReward: 15,         // ← HARDCODED
  lootTable: [{ itemId: "coins", minQuantity: 5, maxQuantity: 15, chance: 1.0 }],
  aggroRange: 8,        // ← HARDCODED
  combatRange: 1.5,     // ← HARDCODED
  wanderRadius: 10,     // ← HARDCODED
  respawnTime: 15000,   // ← HARDCODED (15 seconds)
};
```

### 4.2 In ResourceSystem (Lines 57-162)

Hardcoded RESOURCE_DROPS Map:
```typescript
private readonly RESOURCE_DROPS = new Map<string, ResourceDrop[]>([
  // tree_normal: 25 XP
  // tree_oak: 38 XP, level 15 requirement
  // tree_willow: 68 XP, level 30 requirement
  // tree_maple: 100 XP, level 45 requirement
  // tree_yew: 175 XP, level 60 requirement
  // tree_magic: 250 XP, level 75 requirement
  // herb_patch_normal: 20 XP
  // fishing_spot_normal: 10 XP
]);
```

Hardcoded in getVariantTuning() (Lines 1033-1099):
- Level requirements per tree variant
- XP per log per variant
- Base cycle ticks (always 4)
- Deplete chance (always 0.125)
- Respawn ticks per variant

Hardcoded in getModelPathForResource() (Lines 449-466):
- tree → "asset://models/basic-reg-tree/basic-tree.glb"
- All others → empty string

Hardcoded in createResourceFromSpawnPoint() (Lines 481-513):
- skillRequired per resource type
- toolRequired per resource type (bronze_hatchet for wood, fishing_rod for fish, etc.)
- respawnTime per resource type (10s for trees, 30s for fish, 120s for ore, 45s for herbs)
- levelRequired for some types

### 4.3 In EntityManager

Default fallback values (Lines 966-1029):
```typescript
// If getNPCById returns null:
getMobMaxHealth() → 100 + (level - 1) * 10
getMobAttackPower() → 5 + (level - 1) * 2
getMobDefense() → 2 + (level - 1)
getMobAttackSpeed() → 1.5
getMobMoveSpeed() → 3.0
getMobAggroRange() → 15.0
getMobCombatRange() → 1.5
getMobXPReward() → 10 * level
getMobLootTable() → [{ itemId: "coins", chance: 0.5, minQuantity: 1, maxQuantity: 5 }]
```

Hardcoded in handleMobSpawn() (Line 717):
```typescript
wanderRadius: 10  // 10 meter wander radius
respawnTime: 300000  // 5 minutes default
```

---

## Part 5: FILES REQUIRING MODIFICATION

### 5.1 Manifest Files (Data Layer)

1. **packages/server/world/assets/manifests/npcs.json**
   - ADD: faction
   - ADD: stats.health, stats.magic
   - ADD: combat.attackable, retaliates, aggroRange, combatRange (rename), respawnTime, xpReward, poisonous, immuneToPoison
   - ADD: movement.type, speed, wanderRadius, roaming, patrolPath
   - ADD: drops.rareDropTable, rareDropTableChance
   - ADD: services (full config)
   - ADD: behavior (full config)
   - ADD: appearance.scale, tint
   - ADD: position

2. **packages/server/world/assets/manifests/resources.json**
   - ADD: toolRequired
   - ADD: harvestYield[].itemName, xpAmount, stackable
   - MODIFY: structure to support multiple resource variants (tree_oak, tree_willow, etc.)
   - ADD: variant-specific: levelRequired, xpPerGather, respawnTicks, depleteChance

### 5.2 Type Definition Files

1. **packages/shared/src/types/entities/npc-mob-types.ts**
   - Already complete (no changes needed)

2. **packages/shared/src/types/game/resource-processing-types.ts**
   - Verify Resource and ResourceDrop types match manifest structure

### 5.3 System Files (Code Layer)

1. **packages/shared/src/systems/shared/entities/EntityManager.ts**
   - REMOVE: Default fallback values in getMob*() methods (require manifest data)
   - MODIFY: handleMobSpawn() to read respawnTime, wanderRadius from NPCData
   - MODIFY: spawnResource() to read from manifest instead of hardcoding

2. **packages/shared/src/systems/shared/entities/ResourceSystem.ts**
   - REMOVE: RESOURCE_DROPS hardcoded Map (load from manifest)
   - REMOVE: getVariantTuning() hardcoded values (load from manifest)
   - REMOVE: getModelPathForResource() hardcoded paths (load from manifest)
   - MODIFY: createResourceFromSpawnPoint() to read from manifest

3. **packages/shared/src/systems/shared/entities/MobNPCSpawnerSystem.ts**
   - REMOVE: spawnDefaultMob() hardcoded config (use manifest)

4. **packages/shared/src/systems/shared/entities/MobNPCSystem.ts**
   - MODIFY: createMobConfigs() to handle fallback gracefully if manifest missing fields

5. **packages/shared/src/data/npcs.ts**
   - Update helper functions to work with complete NPCData

6. **packages/shared/src/data/DataManager.ts**
   - MODIFY: loadManifestsFromCDN() to load resources.json
   - ADD: Resource data loading and validation
   - ADD: Variant-specific resource data loading

### 5.4 Entity Files (Rendering/Logic)

1. **packages/shared/src/entities/npc/MobEntity.ts**
   - No changes needed (uses config passed from EntityManager)

2. **packages/shared/src/entities/world/ResourceEntity.ts**
   - No changes needed (uses config passed from ResourceSystem)

---

## Part 6: VALIDATION CHECKLIST

### Before Implementation

- [ ] All required NPCData fields defined in npcs.json
- [ ] All required Resource fields defined in resources.json
- [ ] Entity types match between manifests and code
- [ ] All position data is valid Position3D {x, y, z}
- [ ] All references to modelPath are asset:// URLs or valid paths
- [ ] Drop tables have all required fields with correct types

### After Implementation

- [ ] getNPCById() never returns data missing required fields
- [ ] getResourceById() (new function) never returns data missing required fields
- [ ] All hardcoded values removed from systems
- [ ] Default fallback values in EntityManager are graceful degradation only
- [ ] Tests pass with real manifest data
- [ ] No runtime errors when spawning mobs/resources

---

## Part 7: IMPLEMENTATION PRIORITY

### Phase 1: Foundation (Blocking)
1. Update npcs.json with all required fields
2. Update resources.json with all required fields
3. Update DataManager to validate and load both manifests

### Phase 2: System Updates (Core)
1. Remove hardcoded fallbacks from EntityManager
2. Remove hardcoded RESOURCE_DROPS from ResourceSystem
3. Remove hardcoded model paths from ResourceSystem
4. Update MobNPCSpawnerSystem to use manifest data

### Phase 3: Cleanup (Refinement)
1. Update helper functions in npcs.ts
2. Add resource query helpers to data layer
3. Update tests to use real manifest data
4. Remove temporary fallback values

---

## Summary Table: Missing Fields

### NPCData Missing from npcs.json

| Field | Type | Used By | Impact |
|---|---|---|---|
| faction | string | (future) | Service organization |
| stats.health | number | EntityManager | Mob health calculation |
| stats.magic | number | (future) | Magic combat |
| combat.attackable | boolean | Combat system | Prevent player attacks |
| combat.retaliates | boolean | AggroSystem | NPC behavior |
| combat.aggroRange | number | EntityManager, MobNPCSystem | Detection range |
| combat.combatRange | number | EntityManager | Attack distance |
| combat.respawnTime | number | MobNPCSpawnerSystem | Respawn timing |
| combat.xpReward | number | EntityManager | XP on kill |
| combat.poisonous | boolean | Combat system | Damage type |
| combat.immuneToPoison | boolean | Combat system | Defense |
| movement.type | enum | MobEntity | AI behavior |
| movement.speed | number | EntityManager | Walk speed |
| movement.wanderRadius | number | EntityManager | Patrol area |
| movement.patrolPath | Position3D[] | MobEntity | Fixed patrol points |
| movement.roaming | boolean | MobEntity | Leash behavior |
| drops.rareDropTable | boolean | Loot system | RDT access |
| appearance.scale | number | MobEntity | Model scaling |
| appearance.tint | string | Rendering | Color modification |
| position | Position3D | Spawn system | NPC spawn location |

### Resource Fields Missing from resources.json

| Field | Type | Used By | Impact |
|---|---|---|---|
| position | Position3D | Spawning | Resource location |
| toolRequired | string | Interaction | Harvest requirements |
| drops[].itemName | string | UI display | Item name |
| drops[].xpAmount | number | Skill system | XP reward |
| drops[].stackable | boolean | Inventory | Stack behavior |

---

## Recommendations

1. **Immediate**: Generate missing fields in manifests with sensible defaults
2. **Short-term**: Remove all hardcoded values from systems (use manifest exclusively)
3. **Medium-term**: Add schema validation to DataManager (JSON Schema or TypeScript)
4. **Long-term**: Build admin UI to modify manifests without code changes
