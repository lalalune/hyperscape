# NPC Manifest Field Status

This document tracks which fields from `npcs.json` manifests are properly wired up through the spawn chain to affect mob behavior.

**Data Flow**: `npcs.json` → `DataManager.loadManifestsFromCDN()` → `ALL_NPCS` Map → `MobNPCSpawnerSystem` → `EntityManager.spawnEntity()` → `MobEntity`

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully working - field flows from manifest to behavior |
| ⚠️ | Partially working - normalized but not fully used |
| ❌ | Not working - field is ignored |

---

## Critical Missing Fields (High Impact)

### 1. `combat.retaliates` ✅ FIXED
- **Purpose**: Controls if mob fights back when attacked
- **Expected**: `false` = peaceful mob that doesn't fight back (like chickens)
- **Status**: WORKING - Mob checks `retaliates` flag before fighting back
- **Fixed in**:
  - `types/entities/entities.ts` - Added to MobEntityConfig
  - `systems/shared/entities/MobNPCSpawnerSystem.ts` - Passed from manifest
  - `systems/shared/entities/Entities.ts` - Added default (true)
  - `systems/shared/entities/EntityManager.ts` - Added default (true)
  - `systems/shared/combat/CombatSystem.ts` - Checks flag before setting up retaliation
  - `entities/npc/MobEntity.ts` - Checks flag in takeDamage() before targeting attacker

### 2. `movement.type` ✅ FIXED
- **Purpose**: Controls movement behavior ("stationary" | "wander" | "patrol")
- **Expected**: `"stationary"` = mob stands still, `"wander"` = random movement
- **Status**: WORKING - Stationary mobs stay in IDLE, wander mobs roam
- **Fixed in**:
  - `types/entities/entities.ts` - Added movementType to MobEntityConfig
  - `systems/shared/entities/MobNPCSpawnerSystem.ts` - Passed from manifest
  - `systems/shared/entities/Entities.ts` - Added default ("wander")
  - `systems/shared/entities/EntityManager.ts` - Added default ("wander")
  - `entities/managers/AIStateMachine.ts` - Added getMovementType() to context, IdleState checks it
  - `entities/npc/MobEntity.ts` - Exposed in createAIContext(), fixed clearTargetAndExitCombat()

### 3. `drops.defaultDrop` ✅ FIXED
- **Purpose**: Guaranteed drop every mob has (bones, ashes, etc.)
- **Expected**: Every goblin drops bones on death
- **Status**: WORKING - Uses calculateNPCDrops() which handles defaultDrop
- **Fixed in**:
  - `entities/npc/MobEntity.ts` - Rewrote dropLoot() to use calculateNPCDrops()

### 4. `drops.always/uncommon/rare/veryRare` ✅ FIXED
- **Purpose**: RuneScape-style tiered drop system
- **Expected**: Different rarity tiers with appropriate drop rates
- **Status**: WORKING - calculateNPCDrops() processes all tiers
- **Fixed in**:
  - `entities/npc/MobEntity.ts` - Same fix as defaultDrop (uses existing npcs.ts function)

### 5. `appearance.scale` ✅ FIXED
- **Purpose**: Scale mob model (e.g., 2.0 for big boss, 0.5 for small critter)
- **Expected**: Manifest scale affects visual size
- **Status**: WORKING - Manifest scale is applied to GLB, VRM, and placeholder models
- **Fixed in**:
  - `systems/shared/entities/MobNPCSpawnerSystem.ts` - Passes scale from manifest (both spawn methods)
  - `entities/npc/MobEntity.ts` - GLB: multiplies cm→m conversion by config.scale
  - `entities/npc/MobEntity.ts` - VRM: multiplies VRM's height normalization by config.scale
  - `entities/npc/MobEntity.ts` - Placeholder: applies config.scale to capsule mesh

---

## Medium Impact Missing Fields

### 6. `combat.attackable` ✅ FIXED
- **Purpose**: Controls if players can attack this NPC
- **Expected**: `false` = friendly NPC that can't be attacked
- **Status**: WORKING - CombatSystem checks attackable before allowing attack
- **Fixed in**:
  - `types/entities/entities.ts` - Added to MobEntityConfig
  - `systems/shared/entities/MobNPCSpawnerSystem.ts` - Passed from manifest
  - `systems/shared/entities/EntityManager.ts` - Added default (true)
  - `systems/shared/entities/Entities.ts` - Added default (true)
  - `systems/shared/combat/CombatSystem.ts` - Checks flag in handleMeleeAttack() and handleRangedAttack()

### 7. `stats.attack` ✅ FIXED
- **Purpose**: Affects hit accuracy (OSRS-style)
- **Expected**: Higher attack = more accurate hits
- **Status**: WORKING - Attack stat now used in accuracy calculation
- **Fixed in**:
  - `types/entities/entities.ts` - Added `attack` to MobEntityConfig
  - `types/entities/npc-mob-types.ts` - Added `attack` to MobEntityData
  - `systems/shared/entities/MobNPCSpawnerSystem.ts` - Passes `stats.attack`
  - `systems/shared/entities/EntityManager.ts` - Fixed bug (was using attack for strength), added getMobAttack()
  - `systems/shared/entities/Entities.ts` - Added default
  - `entities/npc/MobEntity.ts` - Added to getMobData()
  - `systems/shared/combat/CombatSystem.ts` - Passes attack stat to calculateDamage()

---

## Working Fields ✅

These fields are properly wired up from manifest to behavior:

| Field | Status | Notes |
|-------|--------|-------|
| `id` | ✅ | Used as mobType |
| `name` | ✅ | Displayed in UI |
| `description` | ✅ | Used for examine |
| `stats.level` | ✅ | Combat level |
| `stats.health` | ✅ | Max/current health |
| `stats.attack` | ✅ | Fixed! Attack level for accuracy |
| `stats.strength` | ✅ | Used as attackPower (max hit) |
| `stats.defense` | ✅ | Defense rating |
| `combat.aggressive` | ✅ | Fixed! Controls if mob attacks on sight |
| `combat.retaliates` | ✅ | Fixed! Controls if mob fights back when attacked |
| `combat.attackable` | ✅ | Fixed! Controls if players can attack this mob |
| `movement.type` | ✅ | Fixed! Controls idle movement (stationary/wander/patrol) |
| `combat.aggroRange` | ✅ | Detection range |
| `combat.combatRange` | ✅ | Attack range |
| `combat.attackSpeed` | ✅ | Attack cooldown |
| `combat.respawnTime` | ✅ | Respawn delay |
| `combat.xpReward` | ✅ | XP on kill |
| `movement.speed` | ✅ | Fixed! Move speed (tiles per tick) |
| `movement.wanderRadius` | ✅ | Fixed! Wander distance from spawn |
| `drops.defaultDrop` | ✅ | Fixed! Guaranteed drop (bones/ashes) |
| `drops.always` | ✅ | Fixed! 100% drop rate items |
| `drops.common` | ✅ | Common drop table |
| `drops.uncommon` | ✅ | Fixed! Uncommon drops now work |
| `drops.rare` | ✅ | Fixed! Rare drops now work |
| `drops.veryRare` | ✅ | Fixed! Very rare drops now work |
| `appearance.modelPath` | ✅ | 3D model path |
| `appearance.scale` | ✅ | Fixed! Model scale multiplier |

---

## Fix Progress

- [x] `combat.aggressive` - Fixed
- [x] `combat.retaliates` - Fixed (MobEntityConfig, spawner, CombatSystem check, MobEntity.takeDamage)
- [x] `movement.type` - Fixed (MobEntityConfig, spawner, AIStateMachine, MobEntity)
- [x] `drops.defaultDrop` - Fixed (MobEntity.dropLoot() now uses calculateNPCDrops())
- [x] `drops.always/uncommon/rare/veryRare` - Fixed (same as above - one fix for all!)
- [x] `appearance.scale` - Fixed (spawner passes from manifest, MobEntity applies to GLB/VRM/placeholder)
- [x] `combat.attackable` - Fixed (MobEntityConfig, spawner, EntityManager, Entities.ts, CombatSystem check)
- [x] `stats.attack` - Fixed (MobEntityConfig, MobEntityData, spawner, EntityManager bug fix, CombatSystem)
- [x] `movement.wanderRadius` - Fixed (EntityManager was hardcoded, now uses getMobWanderRadius helper)
- [x] `movement.speed` - Fixed (Server calculates tilesPerTick from config.moveSpeed, sends to client in tileMovementStart, TileInterpolator uses per-entity speed)

---

## Testing Checklist

For each field fix, test with these manifest changes:

### combat.retaliates
```json
"combat": { "retaliates": false }
```
Expected: Mob doesn't fight back when attacked

### movement.type
```json
"movement": { "type": "stationary" }
```
Expected: Mob stands still, doesn't wander

### drops.defaultDrop
```json
"drops": { "defaultDrop": { "enabled": true, "itemId": "bones", "quantity": 1 } }
```
Expected: Mob always drops bones on death

### appearance.scale
```json
"appearance": { "scale": 2.0 }
```
Expected: Mob appears twice as large

### combat.attackable
```json
"combat": { "attackable": false }
```
Expected: Player cannot attack this mob (attack fails with "target_not_attackable" reason)

### stats.attack (accuracy)
```json
"stats": { "attack": 50, "strength": 1 }
```
Expected: Mob hits often but for low damage (high accuracy, low max hit)

```json
"stats": { "attack": 1, "strength": 50 }
```
Expected: Mob misses often but hits hard when landing (low accuracy, high max hit)

### movement.speed
```json
"movement": { "speed": 5 }
```
Expected: Mob moves faster (3 tiles per tick instead of default 2)

```json
"movement": { "speed": 1.5 }
```
Expected: Mob moves slower (1 tile per tick)
