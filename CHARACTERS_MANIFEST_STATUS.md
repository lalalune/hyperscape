# characters.json Manifest Status

This document analyzes the `characters.json` manifest and its relationship to `npcs.json`.

**Last Updated:** 2024

## Summary

**`characters.json` IS 100% DEAD CODE** - It is not loaded by any system.

The manifest contains 12 character definitions (4 NPCs + 8 mobs) with sophisticated features like behavior trees and dialogue systems that are completely unimplemented.

## Proof: characters.json Is NOT Loaded

### DataManager Only Loads These Manifests

```typescript
// DataManager.ts:109-216 - loadManifestsFromCDN()
const itemsRes = await fetch(`${baseUrl}/items.json`);      // ✅ Loaded
const npcsRes = await fetch(`${baseUrl}/npcs.json`);        // ✅ Loaded
const resourcesRes = await fetch(`${baseUrl}/resources.json`); // ✅ Loaded
const worldAreasRes = await fetch(`${baseUrl}/world-areas.json`); // ✅ Loaded
const biomesRes = await fetch(`${baseUrl}/biomes.json`);    // ✅ Loaded
const zonesRes = await fetch(`${baseUrl}/zones.json`);      // ✅ Loaded
const banksRes = await fetch(`${baseUrl}/banks.json`);      // ✅ Loaded
const storesRes = await fetch(`${baseUrl}/stores.json`);    // ✅ Loaded

// ❌ characters.json is NOWHERE in this list
```

### Grep Verification

```bash
grep -r "characters.json" packages/  # NO MATCHES
grep -r "ALL_CHARACTERS" packages/   # NO MATCHES
grep -r "CharacterData" packages/    # NO MATCHES
grep -r "loadCharacter" packages/    # NO MATCHES
```

### "characterId" Is Something Else Entirely

The `characterId` string found in the codebase refers to **PLAYER IDs**, not the manifest's `characterId` field:

```typescript
// PersistenceSystem.ts:226 - This is a player's database ID
const characterId = event.userId || event.playerId;

// ClientNetwork.ts:519 - This is a player's selected character
this.send("characterSelected", { characterId });
```

## characters.json vs npcs.json Comparison

### Character Definitions That Overlap

Both manifests define the same mobs with DIFFERENT field structures:

| Character | characters.json | npcs.json |
|-----------|-----------------|-----------|
| `goblin` | ✅ Defined (as `characterId`) | ✅ Defined (as `id`) |
| `bandit` | ✅ Defined | ✅ Defined |
| `hobgoblin` | ✅ Defined | ❌ Not in npcs.json |
| `guard` | ✅ Defined | ❌ Not in npcs.json |
| `barbarian` | ✅ Defined | ❌ Not in npcs.json |
| `dark_warrior` | ✅ Defined | ❌ Not in npcs.json |
| `black_knight` | ✅ Defined | ❌ Not in npcs.json |
| `ice_warrior` | ✅ Defined | ❌ Not in npcs.json |
| `dark_ranger` | ✅ Defined | ❌ Not in npcs.json |
| `bank_clerk` | ✅ Defined | ❌ Not in npcs.json |
| `shopkeeper` | ✅ Defined | ❌ Not in npcs.json |
| `quest_giver` | ✅ Defined | ❌ Not in npcs.json |
| `skill_trainer` | ✅ Defined | ❌ Not in npcs.json |

### Field Structure Comparison

| Aspect | characters.json | npcs.json | Winner |
|--------|-----------------|-----------|--------|
| ID field | `characterId` | `id` | npcs.json (standard) |
| Health | `maxHealth`, `currentHealth` | `stats.health` | npcs.json (cleaner) |
| Attack | `attackPower` | `stats.attack` | npcs.json (OSRS-style) |
| Combat range | `combatRange` | `combat.combatRange` | npcs.json (nested) |
| Drops | `lootTable` array | `drops` object (common/uncommon/rare/veryRare) | npcs.json (tiered) |
| Model | `modelPath` | `appearance.modelPath` | npcs.json (namespaced) |

### Unique Features ONLY in characters.json (ALL DEAD)

#### 1. dialogueTree - Full Dialogue System (NOT IMPLEMENTED)

```json
"dialogueTree": {
  "entryNodeId": "greeting",
  "nodes": [
    {
      "id": "greeting",
      "text": "Welcome to the bank! How may I help you today?",
      "responses": [
        {
          "text": "I'd like to access my bank.",
          "nextNodeId": "open_bank",
          "icon": "bank"
        }
      ]
    }
  ]
}
```

**Search Results:**
```bash
grep -r "dialogueTree" packages/  # NO MATCHES
grep -r "entryNodeId" packages/   # NO MATCHES
```

**Status:** Complete dialogue tree system defined but ZERO implementation exists.

#### 2. behaviorConfig - Behavior Tree AI (NOT IMPLEMENTED)

```json
"behaviorConfig": {
  "mainBehavior": {
    "rootNode": "root",
    "nodes": [
      { "id": "root", "type": "selector", "children": ["check_combat", "wander"] },
      { "id": "check_combat", "type": "condition", "condition": { "type": "in_combat" } },
      { "id": "wander", "type": "action", "action": { "type": "wander", "radius": 8 } }
    ]
  },
  "onAttacked": { ... },
  "onLowHealth": { ... }
}
```

**Reality Check:**
The `behaviorConfig` variable in `AggroSystem.ts` is **NOT from this manifest** - it's from hardcoded `AGGRO_CONSTANTS.MOB_BEHAVIORS`:

```typescript
// AggroSystem.ts:293-295 - Uses hardcoded config, NOT manifest
const behaviorConfig =
  AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] ||
  AGGRO_CONSTANTS.MOB_BEHAVIORS.default;

// CombatConstants.ts:83-108 - HARDCODED behavior, not from JSON
MOB_BEHAVIORS: {
  default: { behavior: "passive", detectionRange: 5, leashRange: 10 },
  goblin: { behavior: "aggressive", detectionRange: 8, leashRange: 15 },
}
```

**Status:** Full behavior tree system defined but actual AI uses hardcoded constants in CombatConstants.ts.

#### 3. shopInventory - Per-NPC Shop Inventory (PARTIALLY TYPED)

```json
"shopInventory": [
  { "itemId": "bronze_sword", "quantity": 10, "price": 50 },
  { "itemId": "bronze_helmet", "quantity": 10, "price": 30 }
]
```

**Type Exists But Always Empty:**
```typescript
// npc-mob-types.ts:268
shopInventory?: Array<{ itemId: string; quantity: number; price: number }>;

// EntityManager.ts:1289 - Always initialized to empty
shopInventory: [],
```

**Status:** Type exists but never populated from any manifest.

## Current AI Implementation vs characters.json Vision

| Feature | characters.json Design | Actual Implementation |
|---------|------------------------|----------------------|
| AI State Machine | Behavior tree with selector/condition/action nodes | Simple state machine: IDLE → WANDER → CHASE → ATTACK → RETURN |
| Dialogue | Full tree with conditions, effects, responses | Single description string used in NPCSystem |
| Shop System | Per-NPC inventory with prices | Global stores.json manifest |
| Flee Behavior | Defined in `onLowHealth` behavior tree | Not implemented |
| Level-Based Aggro | Not in characters.json | Hardcoded in AGGRO_CONSTANTS |

---

## What About Non-Mob NPCs?

The question arises: **Does characters.json make sense for non-combat NPCs like bankers, shopkeepers, and quest givers?**

### Current State for Non-Mob NPCs

| Data Source | What It Provides |
|-------------|------------------|
| `world-areas.json` NPCLocation | id, name, type, position, services, description |
| `stores.json` | Global shop inventories (not per-NPC) |
| `banks.json` | Bank locations |

**The current system is minimal** - NPCs are just spawn points with a type and services list.

### What characters.json Would Add for NPCs

The DATA STRUCTURE in characters.json is actually well-designed for non-mob NPCs:

| Feature | Benefit |
|---------|---------|
| `dialogueTree` | Full conversations with branching responses, conditions, effects |
| `shopInventory` | Per-NPC shop items (Shopkeeper Bob sells different stuff than Shopkeeper Alice) |
| `behaviorConfig` | NPCs that wander, have schedules, or react to events |

### The Problem: Two Competing Manifests

Rather than maintaining characters.json as a SEPARATE file, the better approach is:

1. **Add non-mob NPCs to npcs.json** with `category: "neutral"` or `category: "quest"`
2. **Add optional dialogueTree field** to NPCData type
3. **Move shopInventory into services config** in npcs.json

This keeps ONE unified NPC manifest rather than two competing ones.

### Example: bank_clerk as npcs.json Entry

```json
{
  "id": "bank_clerk",
  "name": "Bank Clerk",
  "description": "A helpful bank clerk who manages deposits and withdrawals",
  "category": "neutral",
  "faction": "town",
  "stats": {
    "level": 1,
    "health": 100,
    "attack": 1,
    "strength": 1,
    "defense": 1,
    "ranged": 1,
    "magic": 1
  },
  "combat": {
    "attackable": false,
    "aggressive": false,
    "retaliates": false,
    "aggroRange": 0,
    "combatRange": 1,
    "attackSpeed": 2400,
    "respawnTime": 60000
  },
  "movement": {
    "type": "stationary",
    "speed": 0,
    "wanderRadius": 0
  },
  "services": {
    "enabled": true,
    "types": ["bank"]
  },
  "appearance": {
    "modelPath": "asset://models/human/human_rigged.glb",
    "scale": 1.0
  }
}
```

**Note:** The actual spawn LOCATION still comes from `world-areas.json` NPCLocation entries. The npcs.json entry defines the NPC's properties, not where it spawns.

### Summary: Extend npcs.json, Don't Keep characters.json

| Approach | Pros | Cons |
|----------|------|------|
| Keep characters.json | Already has dialogue/shop data | Dead code, duplicate definitions, different field names |
| Extend npcs.json | Single source of truth, already hooked up | Need to add dialogueTree/shopInventory fields |

**Recommendation:** Extend npcs.json with non-mob NPC entries. Delete characters.json.

---

## Recommendations

### Option A: Delete characters.json Entirely (Recommended)

1. The file is 100% dead code
2. npcs.json already defines the mobs/NPCs that are actually used
3. Reduces confusion and maintenance burden

### Option B: Migrate Unique Content to npcs.json

If the vision of behavior trees and dialogue trees is desired for the future:

1. **Add missing mobs to npcs.json:** hobgoblin, guard, barbarian, dark_warrior, black_knight, ice_warrior, dark_ranger
2. **Add missing NPCs to npcs.json:** bank_clerk, shopkeeper, quest_giver, skill_trainer (though these may be in world-areas.json)
3. **Delete characters.json**
4. **Future work:** Implement dialogueTree and behaviorConfig support when needed

### Option C: Wire Up characters.json (Not Recommended)

Would require:
- Adding DataManager.loadManifestsFromCDN() to fetch characters.json
- Creating ALL_CHARACTERS data structure
- Implementing dialogueTree system (significant work)
- Implementing behaviorConfig behavior tree system (significant work)
- Resolving conflicts with existing npcs.json definitions

**This is significant engineering effort for no current benefit.**

## Data Flow Summary

```
characters.json
      │
      └── NOT LOADED BY ANYTHING
          (Completely orphaned manifest file)

npcs.json
      │
      ▼
  DataManager.loadManifestsFromCDN()
      │
      ▼
  ALL_NPCS (Map<string, NPCData>)
      │
      ├── MobNPCSystem - creates mob entities
      ├── NPCSystem - creates NPC entities
      └── CombatSystem - uses combat stats
```

---

## Appendix: Full characters.json Contents

**12 character definitions:**

### NPCs (characterType: "npc")
- `bank_clerk` - Bank services, dialogueTree
- `shopkeeper` - Shop services, shopInventory, dialogueTree
- `quest_giver` - Quest services, dialogueTree
- `skill_trainer` - Training services, dialogueTree

### Mobs (characterType: "mob")
- `goblin` - Level 2, behaviorConfig with wander/aggro/attack
- `bandit` - Level 3, complex behaviorConfig with flee behavior, has dialogueTree (!)
- `barbarian` - Level 4, behaviorConfig
- `hobgoblin` - Level 8, behaviorConfig
- `guard` (Corrupted Guard) - Level 10, behaviorConfig
- `dark_warrior` - Level 12, behaviorConfig with onLowHealth flee
- `black_knight` - Level 20, behaviorConfig
- `ice_warrior` - Level 18, behaviorConfig
- `dark_ranger` - Level 22, ranged combatRange 8.0, kiting behaviorConfig

---

## Conclusion

**characters.json is completely unused dead code.** The actual game uses:
- `npcs.json` for mob/NPC definitions
- Hardcoded `AGGRO_CONSTANTS.MOB_BEHAVIORS` for AI behavior
- `AIStateMachine` class for state machine AI (not behavior trees)
- Simple description strings instead of dialogueTree
- Global `stores.json` instead of per-NPC shopInventory

The manifest appears to be an aspirational design document that was never implemented.
