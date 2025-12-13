# Combat System Hardening Plan

**Target**: Raise combat system quality from 4.3/10 to 9.0/10
**Scope**: Melee-only MVP (ranged combat deferred)
**Phases**: 7 phases (0-6)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Audit](#current-state-audit)
3. [Phase 0: Remove Ranged Combat](#phase-0-remove-ranged-combat)
4. [Phase 1: Security Hardening](#phase-1-security-hardening)
5. [Phase 2: Type Safety & Production Quality](#phase-2-type-safety--production-quality)
6. [Phase 3: Comprehensive Testing](#phase-3-comprehensive-testing)
7. [Phase 4: Memory Optimization](#phase-4-memory-optimization)
8. [Phase 5: Comprehensive Modularization](#phase-5-comprehensive-modularization)
9. [Phase 6: Game Studio Hardening](#phase-6-game-studio-hardening)
10. [Implementation Order](#implementation-order)
11. [Deliverables Summary](#deliverables-summary)
12. [Expected Final Scores](#expected-final-scores)

---

## Executive Summary

This plan outlines a systematic approach to harden the combat system across 6 audit criteria:

| Criteria | Current | Target |
|----------|---------|--------|
| Production Quality | 5/10 | 9/10 |
| Best Practices | 4/10 | 9/10 |
| OWASP Security | 3/10 | 9/10 |
| Game Studio Audit | 6/10 | 9/10 |
| Memory Hygiene | 4/10 | 9/10 |
| SOLID Principles | 4/10 | 9/10 |
| **Overall** | **4.3/10** | **9.0/10** |

### Key Decisions

1. **Melee-only MVP**: Remove ranged combat to reduce complexity (~305 lines removed)
2. **Comprehensive modularization**: Split 1,600-line CombatSystem.ts into 7 focused modules
3. **Security-first**: Address critical OWASP vulnerabilities before other improvements
4. **Test coverage**: Add ~65 unit tests for combat system

---

## Current State Audit

### Files Analyzed (18 files, ~8,000+ lines)

| File | Lines | Purpose |
|------|-------|---------|
| CombatSystem.ts | 1,894 | Main combat orchestration |
| PlayerDeathSystem.ts | 1,182 | Player death/respawn handling |
| AggroSystem.ts | 634 | Mob AI/aggro mechanics |
| CombatantEntity.ts | 444 | Base combat entity class |
| action-queue.ts | 379 | OSRS-style input queuing |
| CombatUtils.ts | 372 | Combat utility functions |
| CombatCalculations.ts | 366 | Damage/accuracy formulas |
| HealthComponent.ts | 234 | Health management component |
| HealthRegenSystem.ts | 230 | Passive HP regen |
| AggroManager.ts | 226 | Mob target management |
| TickSystem.ts | 211 | Server tick loop |
| CombatStateManager.ts | 209 | Mob combat state tracking |
| CombatConstants.ts | 118 | OSRS-accurate constants |
| combat-types.ts | 88 | Type definitions |
| MobDeathSystem.ts | 81 | Mob death handling |
| combat.ts handler | 71 | Network combat handler |
| CombatComponent.ts | 51 | Combat ECS component |

### Critical Issues Found

#### 1. Security (OWASP) - CRITICAL

```typescript
// combat.ts:21-22 - NO INPUT VALIDATION
const payload = data as { mobId?: string; attackType?: string };
if (!payload.mobId) { return; }  // ONLY NULL CHECK!

// Problems:
// - No UUID format validation
// - No mob existence validation
// - No attackType enum validation
// - No rate limiting
```

#### 2. Type Safety Violations

```typescript
// 50+ instances of (playerEntity as any) in CombatSystem.ts
(playerEntity as any).combat.inCombat = true;
(playerEntity as any).data.c = true;
(playerEntity as any).markNetworkDirty?.();
```

#### 3. Debug Logging in Production

```typescript
// CombatCalculations.ts ~100 - Random logging in hot path
if (Math.random() < 0.1) {
  console.log(`[Accuracy] Attack: ${attackerAttackLevel}...`);
}
```

#### 4. Memory Allocations in Hot Paths

```typescript
// CombatSystem.ts:1048-1053 - New object every rotation
const tempQuat = {  // NEW ALLOCATION EVERY ATTACK
  x: 0,
  y: Math.sin(angle / 2),
  z: 0,
  w: Math.cos(angle / 2),
};
```

#### 5. No Unit Tests

```
Glob for **/*combat*.test.ts returned: No files found
```

#### 6. Monolithic Architecture (SRP Violation)

- CombatSystem.ts: 1,894 lines handling 10+ responsibilities
- PlayerDeathSystem.ts: 1,182 lines

---

## Phase 0: Remove Ranged Combat

### Rationale

- Reduces code complexity by ~30%
- Eliminates ranged-specific bugs and edge cases
- Simplifies range checking (only tile-adjacent needed)
- Faster path to 9/10 quality score
- Ranged can be re-added later with proper architecture

### 0.1 Simplify AttackType Enum

**File**: `packages/shared/src/types/game/item-types.ts` (line 40)

```typescript
// BEFORE:
export enum AttackType {
  MELEE = 'melee',
  RANGED = 'ranged',
  MAGIC = 'magic',
}

// AFTER (MVP):
export enum AttackType {
  MELEE = 'melee',
  // RANGED = 'ranged',  // Removed for MVP
  // MAGIC = 'magic',    // Future
}
```

### 0.2 Remove Ranged Attack Handler

**File**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
// REMOVE entire method (~100 lines):
// private handleRangedAttack(data: {...}): void { ... }

// REMOVE from init() subscription:
// this.subscribe(EventType.COMBAT_RANGED_ATTACK, ...);

// SIMPLIFY handleAttack():
private handleAttack(data: CombatAttackData): void {
  // Remove: if (data.attackType === AttackType.RANGED) { ... }
  this.handleMeleeAttack(data);
}
```

### 0.3 Remove Ranged Damage Calculation

**File**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
// REMOVE entire method (~100 lines):
// private calculateRangedDamage(...): number { ... }

// RENAME for clarity:
// calculateMeleeDamage() → calculateDamage()
```

### 0.4 Simplify Range Checking (Melee-Only)

**File**: `packages/shared/src/utils/game/CombatUtils.ts`

```typescript
// BEFORE (40 lines handling both types):
export function isInCombatRange(
  world: World,
  attackerId: string,
  targetId: string,
  combatType: "melee" | "ranged" = "melee",
): boolean { ... }

// AFTER (melee-only, simplified):
/**
 * Check if attacker is in melee range of target
 * OSRS-style: Must be on adjacent tile (Chebyshev distance = 1)
 */
export function isInMeleeRange(
  world: World,
  attackerId: string,
  targetId: string,
): boolean {
  const attackerPos = getEntityPosition(world, attackerId);
  const targetPos = getEntityPosition(world, targetId);

  if (!attackerPos || !targetPos) {
    return false;
  }

  const attackerTile = worldToTile(attackerPos.x, attackerPos.z);
  const targetTile = worldToTile(targetPos.x, targetPos.z);

  return tilesAdjacent(attackerTile, targetTile);
}
```

### 0.5 Remove Ranged Utility Functions

**File**: `packages/shared/src/utils/game/CombatUtils.ts`

```typescript
// REMOVE:
// export function canUseRanged(player: Player): boolean { ... }

// SIMPLIFY:
export function getPlayerWeaponRange(_player: Player): number {
  return 1; // Melee only for MVP - always 1 tile
}
```

### 0.6 Simplify Combat Handler

**File**: `packages/server/src/systems/ServerNetwork/handlers/combat.ts`

```typescript
// AFTER:
world.emit(EventType.COMBAT_ATTACK_REQUEST, {
  playerId: playerEntity.id,
  targetId: validation.data.mobId,
  attackerType: "player",
  targetType: "mob",
  attackType: AttackType.MELEE,  // Always melee for MVP
});
```

### 0.7 Update Combat Calculations

**File**: `packages/shared/src/utils/game/CombatCalculations.ts`

```typescript
// SIMPLIFY signature - remove attackType parameter:
export function calculateMeleeDamage(
  attackerData: CombatantData,
  targetData: CombatantData,
  equipmentStats?: MeleeEquipmentStats,
): DamageResult {
  // Only melee formula - no attackType branching
}
```

### Phase 0 Deliverables

| Item | File | Action | Lines Changed |
|------|------|--------|---------------|
| Simplify AttackType | core.ts | MODIFY | -5 |
| Remove ranged handler | CombatSystem.ts | DELETE | -100 |
| Remove ranged damage | CombatSystem.ts | DELETE | -100 |
| Simplify range check | CombatUtils.ts | REWRITE | -30 |
| Remove canUseRanged | CombatUtils.ts | DELETE | -15 |
| Simplify handler | combat.ts | MODIFY | -5 |
| Simplify calculations | CombatCalculations.ts | MODIFY | -50 |
| **Total Removed** | | | **~305 lines** |

### Deprecation Markers

When removing ranged code, add markers for future re-implementation:

```typescript
/**
 * @deprecated RANGED_REMOVED_MVP
 * Ranged combat removed for MVP. To re-add:
 * 1. Uncomment AttackType.RANGED in core.ts
 * 2. Implement handleRangedAttack() with proper validation
 * 3. Add arrow consumption system
 * 4. Update range checking to support 10-tile distance
 * 5. Add ranged-specific tests
 *
 * See git history for original ranged implementation
 */
```

---

## Phase 1: Security Hardening

### 1.1 Create Input Validation Utilities

**New File**: `packages/shared/src/utils/validation/CombatValidation.ts`

```typescript
/**
 * Combat Input Validation
 *
 * Centralized validation for all combat-related inputs.
 * Prevents injection attacks, validates entity IDs, and sanitizes display names.
 */

// Entity ID validation regex
const ENTITY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validate entity ID format
 */
export function validateEntityId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (id.length === 0 || id.length > 128) return false;
  return ENTITY_ID_PATTERN.test(id);
}

/**
 * Validate attack type (melee only for MVP)
 */
export function validateAttackType(type: unknown): type is 'melee' {
  return type === 'melee' || type === undefined;
}

/**
 * Validate complete combat request
 */
export interface CombatRequestValidation {
  valid: boolean;
  error?: string;
  data?: {
    mobId: string;
    attackType: 'melee';
  };
}

export function validateCombatRequest(data: unknown): CombatRequestValidation {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request format' };
  }

  const payload = data as Record<string, unknown>;

  // Validate mobId
  if (!validateEntityId(payload.mobId)) {
    return { valid: false, error: 'Invalid mob ID format' };
  }

  return {
    valid: true,
    data: {
      mobId: payload.mobId as string,
      attackType: 'melee',
    },
  };
}

/**
 * Sanitize display name (prevents XSS)
 */
export function sanitizeDisplayName(name: string): string {
  if (typeof name !== 'string') return 'Unknown';

  // Truncate to max length
  const truncated = name.slice(0, 50);

  // Escape HTML entities
  return truncated
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### 1.2 Add Rate Limiting to Combat Requests

**Modify**: `packages/server/src/systems/ServerNetwork/action-queue.ts`

```typescript
// Add to PlayerQueueState interface:
interface PlayerQueueState {
  // ... existing fields
  combatRequestsThisTick: number;
  combatThrottleUntilTick: number;
}

// Constants
const MAX_COMBAT_REQUESTS_PER_TICK = 2;
const THROTTLE_LOCKOUT_TICKS = 5; // 3 second lockout

// Add to queueCombat():
queueCombat(socket: ServerSocket, data: unknown): void {
  const playerId = socket.player?.id;
  if (!playerId) return;

  const state = this.getOrCreateState(playerId);
  const currentTick = this.getCurrentTick();

  // Check throttle lockout
  if (currentTick < state.combatThrottleUntilTick) {
    console.warn(`[ActionQueue] Player ${playerId} throttled for combat spam`);
    return;
  }

  // Reset count on new tick
  if (state.lastProcessedTick < currentTick) {
    state.combatRequestsThisTick = 0;
  }

  // Check request count
  state.combatRequestsThisTick++;
  if (state.combatRequestsThisTick > MAX_COMBAT_REQUESTS_PER_TICK) {
    state.combatThrottleUntilTick = currentTick + THROTTLE_LOCKOUT_TICKS;
    console.warn(`[ActionQueue] Player ${playerId} exceeded combat request limit`);
    return;
  }

  // ... existing queue logic
}
```

### 1.3 Validate Combat Handler Inputs

**Modify**: `packages/server/src/systems/ServerNetwork/handlers/combat.ts`

```typescript
import { validateCombatRequest } from '@hyperscape/shared';

export function handleAttackMob(
  socket: ServerSocket,
  data: unknown,
  world: World,
): void {
  const playerEntity = socket.player;
  if (!playerEntity) {
    return;
  }

  // 1. Validate input structure and types
  const validation = validateCombatRequest(data);
  if (!validation.valid) {
    console.warn(`[Combat] Invalid request from ${playerEntity.id}: ${validation.error}`);
    return;
  }

  // 2. Validate target exists
  const targetEntity = world.entities.get(validation.data.mobId);
  if (!targetEntity) {
    return;
  }

  // 3. Validate target is a mob
  if ((targetEntity as any).type !== 'mob' &&
      typeof (targetEntity as any).getMobData !== 'function') {
    return;
  }

  // 4. Forward validated request
  world.emit(EventType.COMBAT_ATTACK_REQUEST, {
    playerId: playerEntity.id,
    targetId: validation.data.mobId,
    attackerType: "player",
    targetType: "mob",
    attackType: AttackType.MELEE,
  });
}
```

### 1.4 Sanitize UI Messages

**Modify**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
import { sanitizeDisplayName } from '../../../utils/validation/CombatValidation';

private getTargetName(entity: Entity | MobEntity | null): string {
  if (!entity) return "Unknown";
  const mobEntity = entity as MobEntity;
  if (mobEntity.getMobData) {
    const rawName = mobEntity.getMobData().name;
    return sanitizeDisplayName(rawName); // SANITIZE before display
  }
  return sanitizeDisplayName(entity.name || "Enemy");
}
```

### 1.5 Add Entity Existence Validation

**Modify**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
private handleMeleeAttack(data: {...}): void {
  // Add early validation BEFORE any processing:

  // 1. Validate IDs are proper format
  if (!validateEntityId(attackerId) || !validateEntityId(targetId)) {
    return;
  }

  // 2. Get entities with existence check
  const attacker = this.getEntity(attackerId, attackerType);
  const target = this.getEntity(targetId, targetType);

  if (!attacker || !target) {
    return;
  }

  // ... rest of logic
}
```

### Phase 1 Deliverables

| Item | File | Action |
|------|------|--------|
| Validation utilities | CombatValidation.ts | CREATE |
| Rate limiting | action-queue.ts | MODIFY |
| Input validation | combat.ts | MODIFY |
| XSS prevention | CombatSystem.ts | MODIFY |
| Entity validation | CombatSystem.ts | MODIFY |

---

## Phase 2: Type Safety & Production Quality

### 2.1 Create Combat Type Interfaces

**New File**: `packages/shared/src/types/combat/CombatInterfaces.ts`

```typescript
/**
 * Combat Type Interfaces
 *
 * Proper TypeScript interfaces to replace all `as any` casts.
 */

export interface CombatPlayerEntity {
  id: string;
  emote?: string;
  combat?: {
    inCombat: boolean;
    combatTarget: string | null;
  };
  data?: CombatPlayerData;
  base?: {
    quaternion: QuaternionLike;
  };
  node?: {
    quaternion: QuaternionLike;
    position: Vector3Like;
  };
  position?: Vector3Like;
  markNetworkDirty?: () => void;
  getPosition?: () => Vector3Like;
}

export interface CombatPlayerData {
  c?: boolean;           // inCombat (abbreviated for network)
  ct?: string | null;    // combatTarget
  e?: string;            // emote
  isLoading?: boolean;
  visible?: boolean;
  position?: number[];
}

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
  set?(x: number, y: number, z: number, w: number): void;
  copy?(q: QuaternionLike): void;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface CombatStats {
  attackLevel: number;
  strengthLevel: number;
  defenseLevel: number;
  attackBonus: number;
  strengthBonus: number;
  defenseBonus: number;
  baseDamage: number;
  attackSpeedTicks: number;
}

export interface DamageResult {
  damage: number;
  hit: boolean;
  critical: boolean;
  blocked: boolean;
}
```

### 2.2 Replace All `as any` Casts

**Modify**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
import type { CombatPlayerEntity } from '../../../types/combat/CombatInterfaces';

// Add type guard:
private isCombatPlayerEntity(entity: unknown): entity is CombatPlayerEntity {
  return entity !== null &&
         typeof entity === 'object' &&
         'id' in entity;
}

// BEFORE (bad):
(playerEntity as any).combat.inCombat = true;

// AFTER (good):
private syncCombatStateToEntity(entityId: string, targetId: string): void {
  const playerEntity = this.world.getPlayer?.(entityId);
  if (!playerEntity || !this.isCombatPlayerEntity(playerEntity)) {
    return;
  }

  if (playerEntity.combat) {
    playerEntity.combat.inCombat = true;
    playerEntity.combat.combatTarget = targetId;
  }

  if (playerEntity.data) {
    playerEntity.data.c = true;
    playerEntity.data.ct = targetId;
  }

  playerEntity.markNetworkDirty?.();
}
```

### 2.3 Remove Debug Logging from Hot Paths

**Modify**: `packages/shared/src/utils/game/CombatCalculations.ts`

```typescript
// REMOVE this block entirely:
// if (Math.random() < 0.1) {
//   console.log(`[Accuracy] Attack: ${attackerAttackLevel}...`);
// }
```

**Modify**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
// REMOVE or convert to debug-only (lines 1733, 1743, 1753, 1769, 1777):
const DEBUG_COMBAT = process.env.NODE_ENV === 'development' &&
                     process.env.DEBUG_COMBAT === 'true';

if (DEBUG_COMBAT) {
  console.log(`[CombatSystem] Debug info...`);
}
```

### 2.4 Remove Deprecated Code

**Modify**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
// REMOVE empty deprecated method:
// update(_dt: number): void {
//   // Combat logic moved to processCombatTick()
// }
```

### 2.5 Add Proper Error Handling

```typescript
enum CombatError {
  ATTACKER_NOT_FOUND = 'attacker_not_found',
  TARGET_NOT_FOUND = 'target_not_found',
  ATTACKER_DEAD = 'attacker_dead',
  TARGET_DEAD = 'target_dead',
  OUT_OF_RANGE = 'out_of_range',
  ON_COOLDOWN = 'on_cooldown',
}

private handleMeleeAttack(data: {...}): CombatError | null {
  if (!attacker) return CombatError.ATTACKER_NOT_FOUND;
  if (!target) return CombatError.TARGET_NOT_FOUND;
  // ...
  return null; // Success
}
```

### Phase 2 Deliverables

| Item | File | Action |
|------|------|--------|
| Combat interfaces | CombatInterfaces.ts | CREATE |
| Replace `as any` | CombatSystem.ts | MODIFY (~50 changes) |
| Replace `as any` | PlayerDeathSystem.ts | MODIFY (~15 changes) |
| Remove debug logs | CombatCalculations.ts | MODIFY |
| Remove debug logs | CombatSystem.ts | MODIFY |
| Remove deprecated | CombatSystem.ts | MODIFY |

---

## Phase 3: Comprehensive Testing

### 3.1 CombatSystem Tests

**New File**: `packages/shared/src/systems/shared/combat/__tests__/CombatSystem.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatSystem } from '../CombatSystem';

describe('CombatSystem', () => {
  describe('Damage Calculation', () => {
    it('calculates melee damage correctly with base stats', () => {});
    it('applies equipment bonuses to damage', () => {});
    it('caps damage at target current health', () => {});
    it('returns 0 damage on miss', () => {});
  });

  describe('Attack Cooldowns', () => {
    it('prevents attack when on cooldown', () => {});
    it('allows attack after cooldown expires', () => {});
    it('uses weapon attack speed for cooldown', () => {});
    it('uses default 4 tick cooldown for unarmed', () => {});
  });

  describe('Range Checking', () => {
    it('allows melee attack on adjacent tile', () => {});
    it('blocks melee attack on non-adjacent tile', () => {});
  });

  describe('Combat State', () => {
    it('enters combat state on attack', () => {});
    it('sets combat timeout to 8 ticks', () => {});
    it('ends combat after 8 ticks of no activity', () => {});
    it('resets combat timeout on new attack', () => {});
  });

  describe('Retaliation', () => {
    it('calculates retaliation delay as ceil(speed/2) + 1', () => {});
    it('mob retaliates after delay', () => {});
  });

  describe('Death Handling', () => {
    it('does not process attack on dead target', () => {});
    it('does not allow dead attacker to attack', () => {});
    it('clears combat state when target dies', () => {});
  });

  describe('Edge Cases', () => {
    it('handles self-attack attempt gracefully', () => {});
    it('handles invalid entity IDs gracefully', () => {});
    it('handles concurrent attacks on same target', () => {});
  });
});
```

### 3.2 CombatStateService Tests

**New File**: `packages/shared/src/systems/shared/combat/__tests__/CombatStateService.test.ts`

```typescript
describe('CombatStateService', () => {
  describe('enterCombat', () => {
    it('creates new combat state', () => {});
    it('updates existing combat state with new target', () => {});
  });

  describe('exitCombat', () => {
    it('removes combat state and returns it', () => {});
    it('returns null if not in combat', () => {});
  });

  describe('canAttack', () => {
    it('returns true when not in combat', () => {});
    it('returns true when cooldown expired', () => {});
    it('returns false when on cooldown', () => {});
  });

  describe('processTick', () => {
    it('removes timed out combat states', () => {});
    it('returns list of timed out entity IDs', () => {});
  });
});
```

### 3.3 CombatValidation Tests

**New File**: `packages/shared/src/utils/validation/__tests__/CombatValidation.test.ts`

```typescript
describe('CombatValidation', () => {
  describe('validateEntityId', () => {
    it('accepts valid alphanumeric IDs', () => {
      expect(validateEntityId('player_123')).toBe(true);
      expect(validateEntityId('mob-456')).toBe(true);
    });

    it('rejects IDs with special characters', () => {
      expect(validateEntityId('player<script>')).toBe(false);
      expect(validateEntityId('../../../etc/passwd')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(validateEntityId('')).toBe(false);
    });

    it('rejects IDs exceeding max length', () => {
      expect(validateEntityId('a'.repeat(129))).toBe(false);
    });
  });

  describe('sanitizeDisplayName', () => {
    it('escapes HTML entities', () => {
      expect(sanitizeDisplayName('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('preserves normal text', () => {
      expect(sanitizeDisplayName('Goblin')).toBe('Goblin');
    });

    it('truncates extremely long names', () => {
      expect(sanitizeDisplayName('A'.repeat(100)).length).toBeLessThanOrEqual(50);
    });
  });
});
```

### 3.4 CombatCalculations Tests

**New File**: `packages/shared/src/utils/game/__tests__/CombatCalculations.test.ts`

```typescript
describe('CombatCalculations', () => {
  describe('calculateAccuracy', () => {
    it('returns true when attack roll > defense roll', () => {});
    it('returns false when attack roll < defense roll', () => {});
    it('uses OSRS effective level formula', () => {});
  });

  describe('calculateMeleeDamage', () => {
    it('calculates max hit from strength and equipment', () => {});
    it('returns random damage between 0 and max hit', () => {});
  });

  describe('calculateRetaliationDelay', () => {
    it('returns ceil(speed/2) + 1 for 4-tick weapon', () => {
      expect(calculateRetaliationDelay(4)).toBe(3);
    });
    it('returns ceil(speed/2) + 1 for 5-tick weapon', () => {
      expect(calculateRetaliationDelay(5)).toBe(4);
    });
  });
});
```

### Phase 3 Deliverables

| File | Tests |
|------|-------|
| CombatSystem.test.ts | ~20 |
| CombatStateService.test.ts | ~15 |
| CombatDamageService.test.ts | ~10 |
| CombatCalculations.test.ts | ~10 |
| CombatValidation.test.ts | ~10 |
| **Total** | **~65** |

---

## Phase 4: Memory Optimization

### 4.1 Create Quaternion Pool

**New File**: `packages/shared/src/utils/pools/QuaternionPool.ts`

```typescript
/**
 * Quaternion Pool
 *
 * Object pool for quaternions used in combat rotation.
 * Eliminates allocations in hot path (rotateTowardsTarget).
 */

interface PooledQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  _poolIndex: number;
}

class QuaternionPool {
  private pool: PooledQuaternion[] = [];
  private available: number[] = [];
  private readonly INITIAL_SIZE = 32;
  private readonly GROW_SIZE = 16;

  constructor() {
    this.grow(this.INITIAL_SIZE);
  }

  private grow(count: number): void {
    const startIndex = this.pool.length;
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      this.pool.push({ x: 0, y: 0, z: 0, w: 1, _poolIndex: index });
      this.available.push(index);
    }
  }

  acquire(): PooledQuaternion {
    if (this.available.length === 0) {
      this.grow(this.GROW_SIZE);
    }
    const index = this.available.pop()!;
    return this.pool[index];
  }

  release(quat: PooledQuaternion): void {
    quat.x = 0;
    quat.y = 0;
    quat.z = 0;
    quat.w = 1;
    this.available.push(quat._poolIndex);
  }

  setYRotation(quat: PooledQuaternion, angle: number): void {
    quat.x = 0;
    quat.y = Math.sin(angle / 2);
    quat.z = 0;
    quat.w = Math.cos(angle / 2);
  }
}

export const quaternionPool = new QuaternionPool();
```

### 4.2 Use Pooled Quaternions

**Modify**: `packages/shared/src/systems/shared/combat/CombatRotationManager.ts`

```typescript
import { quaternionPool } from '../../../utils/pools/QuaternionPool';

private applyRotation(entity: CombatPlayerEntity, angle: number): void {
  const quat = quaternionPool.acquire();
  quaternionPool.setYRotation(quat, angle);

  try {
    if (entity.base?.quaternion) {
      entity.base.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      entity.node?.quaternion?.copy?.(entity.base.quaternion);
    } else if (entity.node?.quaternion) {
      entity.node.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    }
  } finally {
    quaternionPool.release(quat);
  }

  entity.markNetworkDirty?.();
}
```

### 4.3 Optimize processCombatTick Iteration

```typescript
// Add reusable array at class level:
private combatStateBuffer: Array<[string, CombatState]> = [];

public processCombatTick(tickNumber: number): void {
  // BEFORE: Created new array every tick
  // const states = Array.from(this.combatStates.entries());

  // AFTER: Reuse buffer array
  this.combatStateBuffer.length = 0;
  for (const entry of this.stateService.getAllCombatStates().entries()) {
    this.combatStateBuffer.push(entry);
  }

  for (const [entityId, state] of this.combatStateBuffer) {
    // ... process
  }
}
```

### Phase 4 Deliverables

| Item | File | Action |
|------|------|--------|
| Quaternion pool | QuaternionPool.ts | CREATE |
| Use quaternion pool | CombatRotationManager.ts | MODIFY |
| Reuse iteration buffer | CombatSystem.ts | MODIFY |

---

## Phase 5: Comprehensive Modularization

### Current Problem

```
CombatSystem.ts (1,600 lines after ranged removal)
├── Attack handling
├── Damage calculation
├── Combat state tracking
├── Animation/emote management
├── Entity rotation
├── Equipment stats caching
├── Combat timeout handling
├── Retaliation logic
├── Event emission
└── Network sync
```

**This violates SRP.** One file doing 10+ responsibilities.

### Target Architecture

```
CombatSystem.ts (~250 lines) - THIN ORCHESTRATOR
│
├── CombatStateService.ts (~200 lines)
│   ├── enterCombat()
│   ├── exitCombat()
│   ├── isInCombat()
│   ├── canAttack()
│   └── processTick()
│
├── CombatDamageService.ts (~150 lines)
│   ├── calculateDamage()
│   ├── applyDamage()
│   └── rollAccuracy()
│
├── CombatAnimationManager.ts (~150 lines)
│   ├── setCombatEmote()
│   └── processEmoteResets()
│
├── CombatRotationManager.ts (~100 lines)
│   └── rotateToFaceTarget()
│
├── CombatEquipmentCache.ts (~120 lines)
│   ├── getPlayerCombatStats()
│   └── invalidateCache()
│
├── CombatRangeService.ts (~80 lines)
│   └── isInMeleeRange()
│
└── CombatValidation.ts (~120 lines)
    ├── validateAttackRequest()
    └── sanitizeDisplayName()
```

### 5.1 CombatStateService

**New File**: `packages/shared/src/systems/shared/combat/CombatStateService.ts`

```typescript
/**
 * CombatStateService - Manages all combat state tracking
 *
 * Single Responsibility: Track who is fighting whom and when they can attack
 */

import { COMBAT_CONSTANTS } from '../../../constants/CombatConstants';

export interface CombatState {
  entityId: string;
  targetId: string;
  entityType: 'player' | 'mob';
  targetType: 'player' | 'mob';
  startTick: number;
  lastActivityTick: number;
  nextAttackTick: number;
}

export class CombatStateService {
  private combatStates = new Map<string, CombatState>();
  private readonly COMBAT_TIMEOUT_TICKS = COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;

  enterCombat(
    entityId: string,
    targetId: string,
    entityType: 'player' | 'mob',
    targetType: 'player' | 'mob',
    currentTick: number,
  ): void {
    const existing = this.combatStates.get(entityId);

    if (existing) {
      existing.targetId = targetId;
      existing.targetType = targetType;
      existing.lastActivityTick = currentTick;
    } else {
      this.combatStates.set(entityId, {
        entityId,
        targetId,
        entityType,
        targetType,
        startTick: currentTick,
        lastActivityTick: currentTick,
        nextAttackTick: currentTick,
      });
    }
  }

  exitCombat(entityId: string): CombatState | null {
    const state = this.combatStates.get(entityId);
    this.combatStates.delete(entityId);
    return state || null;
  }

  isInCombat(entityId: string): boolean {
    return this.combatStates.has(entityId);
  }

  getCombatTarget(entityId: string): string | null {
    return this.combatStates.get(entityId)?.targetId || null;
  }

  canAttack(entityId: string, currentTick: number): boolean {
    const state = this.combatStates.get(entityId);
    if (!state) return true;
    return currentTick >= state.nextAttackTick;
  }

  recordAttack(entityId: string, currentTick: number, attackSpeedTicks: number): void {
    const state = this.combatStates.get(entityId);
    if (state) {
      state.lastActivityTick = currentTick;
      state.nextAttackTick = currentTick + attackSpeedTicks;
    }
  }

  setRetaliationTiming(entityId: string, currentTick: number, attackSpeedTicks: number): void {
    const state = this.combatStates.get(entityId);
    if (!state) return;

    const retaliationDelay = Math.ceil(attackSpeedTicks / 2) + 1;
    const retaliationTick = currentTick + retaliationDelay;

    if (retaliationTick < state.nextAttackTick) {
      state.nextAttackTick = retaliationTick;
    }
  }

  processTick(currentTick: number): string[] {
    const timedOut: string[] = [];

    for (const [entityId, state] of this.combatStates) {
      if (currentTick - state.lastActivityTick >= this.COMBAT_TIMEOUT_TICKS) {
        timedOut.push(entityId);
      }
    }

    for (const entityId of timedOut) {
      this.combatStates.delete(entityId);
    }

    return timedOut;
  }

  removeEntity(entityId: string): void {
    this.combatStates.delete(entityId);

    for (const [id, state] of this.combatStates) {
      if (state.targetId === entityId) {
        this.combatStates.delete(id);
      }
    }
  }

  clear(): void {
    this.combatStates.clear();
  }
}
```

### 5.2 CombatDamageService

**New File**: `packages/shared/src/systems/shared/combat/CombatDamageService.ts`

```typescript
/**
 * CombatDamageService - Handles damage calculation and application
 *
 * Single Responsibility: Calculate and apply combat damage
 */

import { calculateMeleeDamage, calculateAccuracy } from '../../../utils/game/CombatCalculations';
import type { World } from '../../../core/World';
import type { CombatEquipmentCache } from './CombatEquipmentCache';
import { EventType } from '../../../types/events';
import type { DamageResult, CombatStats } from '../../../types/combat/CombatInterfaces';

export class CombatDamageService {
  private world: World;
  private equipmentCache: CombatEquipmentCache;

  constructor(world: World, equipmentCache: CombatEquipmentCache) {
    this.world = world;
    this.equipmentCache = equipmentCache;
  }

  calculateDamage(
    attackerId: string,
    targetId: string,
    attackerType: 'player' | 'mob',
    targetType: 'player' | 'mob',
  ): DamageResult {
    const attackerStats = this.getEntityCombatStats(attackerId, attackerType);
    const targetStats = this.getEntityCombatStats(targetId, targetType);

    if (!attackerStats || !targetStats) {
      return { damage: 0, hit: false, critical: false, blocked: true };
    }

    const hit = calculateAccuracy(
      attackerStats.attackLevel,
      attackerStats.attackBonus,
      targetStats.defenseLevel,
      targetStats.defenseBonus,
    );

    if (!hit) {
      return { damage: 0, hit: false, critical: false, blocked: false };
    }

    const damage = calculateMeleeDamage(
      attackerStats.strengthLevel,
      attackerStats.strengthBonus,
      attackerStats.baseDamage,
    );

    return { damage, hit: true, critical: false, blocked: false };
  }

  applyDamage(
    targetId: string,
    targetType: 'player' | 'mob',
    damage: number,
    attackerId: string,
  ): { newHealth: number; killed: boolean } {
    const targetEntity = this.getEntity(targetId, targetType);
    if (!targetEntity) {
      return { newHealth: 0, killed: false };
    }

    const currentHealth = this.getEntityHealth(targetEntity);
    const newHealth = Math.max(0, currentHealth - damage);
    const killed = newHealth <= 0;

    this.setEntityHealth(targetEntity, newHealth);

    this.world.emit(EventType.COMBAT_DAMAGE_DEALT, {
      attackerId,
      targetId,
      damage,
      newHealth,
      killed,
    });

    return { newHealth, killed };
  }

  private getEntityCombatStats(entityId: string, entityType: 'player' | 'mob'): CombatStats | null {
    if (entityType === 'player') {
      return this.equipmentCache.getPlayerCombatStats(entityId);
    }
    return this.getMobCombatStats(entityId);
  }

  private getMobCombatStats(mobId: string): CombatStats | null {
    const mob = this.world.entities.get(mobId);
    if (!mob || typeof (mob as any).getMobData !== 'function') {
      return null;
    }

    const mobData = (mob as any).getMobData();
    return {
      attackLevel: mobData.attack || 1,
      strengthLevel: mobData.strength || 1,
      defenseLevel: mobData.defense || 1,
      attackBonus: mobData.attackBonus || 0,
      strengthBonus: mobData.strengthBonus || 0,
      defenseBonus: mobData.defenseBonus || 0,
      baseDamage: mobData.attackPower || 1,
      attackSpeedTicks: mobData.attackSpeed || 4,
    };
  }

  // ... helper methods
}
```

### 5.3 CombatEquipmentCache

**New File**: `packages/shared/src/systems/shared/combat/CombatEquipmentCache.ts`

```typescript
/**
 * CombatEquipmentCache - Caches player equipment stats
 *
 * Single Responsibility: Fast access to player combat stats
 */

import type { World } from '../../../core/World';
import { EventType } from '../../../types/events';
import type { CombatStats } from '../../../types/combat/CombatInterfaces';

export class CombatEquipmentCache {
  private cache = new Map<string, CombatStats>();
  private world: World;

  constructor(world: World) {
    this.world = world;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.world.on(EventType.EQUIPMENT_CHANGED, (data: { playerId: string }) => {
      this.invalidateCache(data.playerId);
    });

    this.world.on(EventType.PLAYER_LEVEL_CHANGED, (data: { playerId: string }) => {
      this.invalidateCache(data.playerId);
    });

    this.world.on(EventType.PLAYER_UNREGISTERED, (data: { id: string }) => {
      this.cache.delete(data.id);
    });
  }

  getPlayerCombatStats(playerId: string): CombatStats | null {
    const cached = this.cache.get(playerId);
    if (cached) return cached;

    const stats = this.calculatePlayerStats(playerId);
    if (stats) {
      this.cache.set(playerId, stats);
    }
    return stats;
  }

  invalidateCache(playerId: string): void {
    this.cache.delete(playerId);
  }

  getAttackSpeedTicks(playerId: string): number {
    return this.getPlayerCombatStats(playerId)?.attackSpeedTicks ?? 4;
  }

  private calculatePlayerStats(playerId: string): CombatStats | null {
    const player = this.world.getPlayer?.(playerId);
    if (!player) return null;

    const skills = player.skills || {};
    const attackLevel = skills.attack?.level ?? 1;
    const strengthLevel = skills.strength?.level ?? 1;
    const defenseLevel = skills.defense?.level ?? 1;

    const equipmentSystem = this.world.getSystem('equipment') as any;
    const equipment = equipmentSystem?.getPlayerEquipment?.(playerId);

    let attackBonus = 0;
    let strengthBonus = 0;
    let defenseBonus = 0;
    let attackSpeedTicks = 4;

    if (equipment?.weapon) {
      attackBonus += equipment.weapon.attackBonus ?? 0;
      strengthBonus += equipment.weapon.strengthBonus ?? 0;
      attackSpeedTicks = equipment.weapon.attackSpeed ?? 4;
    }

    const armorSlots = ['helmet', 'body', 'legs', 'shield'];
    for (const slot of armorSlots) {
      const item = equipment?.[slot];
      if (item) {
        defenseBonus += item.defenseBonus ?? 0;
      }
    }

    return {
      attackLevel,
      strengthLevel,
      defenseLevel,
      attackBonus,
      strengthBonus,
      defenseBonus,
      baseDamage: strengthLevel + strengthBonus,
      attackSpeedTicks,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 5.4 CombatRangeService

**New File**: `packages/shared/src/systems/shared/combat/CombatRangeService.ts`

```typescript
/**
 * CombatRangeService - Combat range checking
 *
 * Single Responsibility: Determine if entities are in attack range
 * MVP: Melee only (adjacent tiles)
 */

import { worldToTile, tilesAdjacent, tileChebyshevDistance } from '../movement/TileSystem';
import type { World } from '../../../core/World';
import type { Position3D } from '../../../types';

export class CombatRangeService {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  isInMeleeRange(attackerId: string, targetId: string): boolean {
    const attackerPos = this.getEntityPosition(attackerId);
    const targetPos = this.getEntityPosition(targetId);

    if (!attackerPos || !targetPos) return false;

    const attackerTile = worldToTile(attackerPos.x, attackerPos.z);
    const targetTile = worldToTile(targetPos.x, targetPos.z);

    return tilesAdjacent(attackerTile, targetTile);
  }

  getDistanceInTiles(entityId1: string, entityId2: string): number {
    const pos1 = this.getEntityPosition(entityId1);
    const pos2 = this.getEntityPosition(entityId2);

    if (!pos1 || !pos2) return Infinity;

    const tile1 = worldToTile(pos1.x, pos1.z);
    const tile2 = worldToTile(pos2.x, pos2.z);

    return tileChebyshevDistance(tile1, tile2);
  }

  private getEntityPosition(entityId: string): Position3D | null {
    const player = this.world.getPlayer?.(entityId);
    if (player) {
      return player.position || player.node?.position || null;
    }

    const entity = this.world.entities.get(entityId);
    if (entity) {
      return (entity as any).position || (entity as any).getPosition?.() || null;
    }

    return null;
  }
}
```

### 5.5 CombatAnimationManager

**New File**: `packages/shared/src/systems/shared/combat/CombatAnimationManager.ts`

```typescript
/**
 * CombatAnimationManager - Combat emotes and animations
 *
 * Single Responsibility: Manage combat animations and emote timing
 */

import type { World } from '../../../core/World';

interface EmoteResetData {
  tick: number;
  entityType: 'player' | 'mob';
}

export class CombatAnimationManager {
  private emoteResetTicks = new Map<string, EmoteResetData>();
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  setCombatEmote(entityId: string, entityType: 'player' | 'mob', currentTick: number): void {
    if (entityType === 'player') {
      this.setPlayerCombatEmote(entityId);
    } else {
      this.setMobCombatEmote(entityId);
    }

    this.emoteResetTicks.set(entityId, {
      tick: currentTick + 2,
      entityType,
    });
  }

  processEmoteResets(currentTick: number): void {
    for (const [entityId, resetData] of this.emoteResetTicks.entries()) {
      if (currentTick >= resetData.tick) {
        this.resetEmote(entityId, resetData.entityType);
        this.emoteResetTicks.delete(entityId);
      }
    }
  }

  cancelEmoteReset(entityId: string): void {
    this.emoteResetTicks.delete(entityId);
  }

  private setPlayerCombatEmote(entityId: string): void {
    const player = this.world.getPlayer?.(entityId);
    if (!player) return;

    // Set punch/attack emote
    if ((player as any).emote !== undefined) {
      (player as any).emote = 'punch';
    }
    if ((player as any).data) {
      (player as any).data.e = 'punch';
    }
    (player as any).markNetworkDirty?.();
  }

  private setMobCombatEmote(entityId: string): void {
    const mob = this.world.entities.get(entityId);
    if (!mob) return;

    if ((mob as any).setEmote) {
      (mob as any).setEmote('attack');
    }
  }

  private resetEmote(entityId: string, entityType: 'player' | 'mob'): void {
    if (entityType === 'player') {
      const player = this.world.getPlayer?.(entityId);
      if (player) {
        if ((player as any).emote !== undefined) {
          (player as any).emote = 'idle';
        }
        if ((player as any).data) {
          (player as any).data.e = 'idle';
        }
        (player as any).markNetworkDirty?.();
      }
    } else {
      const mob = this.world.entities.get(entityId);
      if (mob && (mob as any).setEmote) {
        (mob as any).setEmote('idle');
      }
    }
  }

  destroy(): void {
    this.emoteResetTicks.clear();
  }
}
```

### 5.6 CombatRotationManager

**New File**: `packages/shared/src/systems/shared/combat/CombatRotationManager.ts`

```typescript
/**
 * CombatRotationManager - Entity rotation during combat
 *
 * Single Responsibility: Rotate entities to face targets
 * Uses object pooling for quaternions
 */

import { quaternionPool } from '../../../utils/pools/QuaternionPool';
import type { World } from '../../../core/World';
import type { CombatPlayerEntity, Vector3Like } from '../../../types/combat/CombatInterfaces';

export class CombatRotationManager {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  rotateToFaceTarget(
    entityId: string,
    targetId: string,
    entityType: 'player' | 'mob',
    targetType: 'player' | 'mob',
  ): void {
    const entity = this.getEntity(entityId, entityType);
    const target = this.getEntity(targetId, targetType);

    if (!entity || !target) return;

    const entityPos = this.getPosition(entity);
    const targetPos = this.getPosition(target);

    if (!entityPos || !targetPos) return;

    const angle = this.calculateFacingAngle(entityPos, targetPos);
    this.applyRotation(entity, entityType, angle);
  }

  private calculateFacingAngle(from: Vector3Like, to: Vector3Like): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return Math.atan2(dx, dz) + Math.PI;
  }

  private applyRotation(
    entity: CombatPlayerEntity,
    entityType: string,
    angle: number,
  ): void {
    const quat = quaternionPool.acquire();
    quaternionPool.setYRotation(quat, angle);

    try {
      if (entityType === 'player' && entity.base?.quaternion) {
        entity.base.quaternion.set?.(quat.x, quat.y, quat.z, quat.w);
        entity.node?.quaternion?.copy?.(entity.base.quaternion);
      } else if (entity.node?.quaternion) {
        entity.node.quaternion.set?.(quat.x, quat.y, quat.z, quat.w);
      }
    } finally {
      quaternionPool.release(quat);
    }

    entity.markNetworkDirty?.();
  }

  private getEntity(id: string, type: string): CombatPlayerEntity | null {
    if (type === 'player') {
      return this.world.getPlayer?.(id) as CombatPlayerEntity | null;
    }
    return this.world.entities.get(id) as CombatPlayerEntity | null;
  }

  private getPosition(entity: CombatPlayerEntity): Vector3Like | null {
    return entity.position || entity.node?.position || entity.getPosition?.() || null;
  }
}
```

### 5.7 Refactored CombatSystem (Thin Orchestrator)

**Modify**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
/**
 * CombatSystem - Combat Orchestrator
 *
 * THIN orchestrator that delegates to specialized services.
 * Handles event routing and coordination only.
 */

import { SystemBase } from '..';
import type { World } from '../../../core/World';
import { EventType } from '../../../types/events';
import { CombatStateService } from './CombatStateService';
import { CombatDamageService } from './CombatDamageService';
import { CombatEquipmentCache } from './CombatEquipmentCache';
import { CombatRangeService } from './CombatRangeService';
import { CombatAnimationManager } from './CombatAnimationManager';
import { CombatRotationManager } from './CombatRotationManager';
import { validateAttackRequest } from '../../../utils/validation/CombatValidation';

export class CombatSystem extends SystemBase {
  private stateService: CombatStateService;
  private damageService: CombatDamageService;
  private equipmentCache: CombatEquipmentCache;
  private rangeService: CombatRangeService;
  private animationManager: CombatAnimationManager;
  private rotationManager: CombatRotationManager;

  constructor(world: World) {
    super(world, {
      name: 'combat',
      dependencies: {
        required: [],
        optional: ['player', 'equipment', 'mob-npc'],
      },
      autoCleanup: true,
    });

    this.equipmentCache = new CombatEquipmentCache(world);
    this.stateService = new CombatStateService();
    this.damageService = new CombatDamageService(world, this.equipmentCache);
    this.rangeService = new CombatRangeService(world);
    this.animationManager = new CombatAnimationManager(world);
    this.rotationManager = new CombatRotationManager(world);
  }

  async init(): Promise<void> {
    this.subscribe(EventType.COMBAT_ATTACK_REQUEST, (data) => {
      this.handleAttackRequest(data);
    });

    this.subscribe(EventType.PLAYER_UNREGISTERED, (data: { id: string }) => {
      this.cleanupEntity(data.id);
    });

    this.subscribe(EventType.MOB_NPC_DESPAWN, (data: { mobId: string }) => {
      this.cleanupEntity(data.mobId);
    });
  }

  private handleAttackRequest(data: {
    playerId: string;
    targetId: string;
    attackerType: 'player' | 'mob';
    targetType: 'player' | 'mob';
  }): void {
    const { playerId: attackerId, targetId, attackerType, targetType } = data;
    const currentTick = this.world.currentTick ?? 0;

    // 1. Validate
    const validation = validateAttackRequest({ mobId: targetId });
    if (!validation.valid) return;

    // 2. Check cooldown
    if (!this.stateService.canAttack(attackerId, currentTick)) return;

    // 3. Check target valid
    if (!this.isValidTarget(targetId, targetType)) return;

    // 4. Check range
    if (!this.rangeService.isInMeleeRange(attackerId, targetId)) return;

    // 5. Execute
    this.executeAttack(attackerId, targetId, attackerType, targetType, currentTick);
  }

  private executeAttack(
    attackerId: string,
    targetId: string,
    attackerType: 'player' | 'mob',
    targetType: 'player' | 'mob',
    currentTick: number,
  ): void {
    // Enter combat
    this.stateService.enterCombat(attackerId, targetId, attackerType, targetType, currentTick);

    // Get attack speed
    const attackSpeed = attackerType === 'player'
      ? this.equipmentCache.getAttackSpeedTicks(attackerId)
      : 4;

    // Record timing
    this.stateService.recordAttack(attackerId, currentTick, attackSpeed);

    // Rotate
    this.rotationManager.rotateToFaceTarget(attackerId, targetId, attackerType, targetType);
    this.rotationManager.rotateToFaceTarget(targetId, attackerId, targetType, attackerType);

    // Animate
    this.animationManager.setCombatEmote(attackerId, attackerType, currentTick);

    // Calculate damage
    const result = this.damageService.calculateDamage(attackerId, targetId, attackerType, targetType);

    if (result.hit && result.damage > 0) {
      const { newHealth, killed } = this.damageService.applyDamage(
        targetId, targetType, result.damage, attackerId
      );

      this.emitCombatHit(attackerId, targetId, result.damage, newHealth, killed);

      if (targetType === 'mob' && !killed) {
        this.handleRetaliation(targetId, attackerId, currentTick);
      }

      if (killed) {
        this.handleTargetKilled(attackerId, targetId, attackerType, targetType);
      }
    } else {
      this.emitCombatMiss(attackerId, targetId);
    }
  }

  public processCombatTick(tickNumber: number): void {
    this.animationManager.processEmoteResets(tickNumber);

    const timedOut = this.stateService.processTick(tickNumber);
    for (const entityId of timedOut) {
      this.emitCombatEnded(entityId, 'timeout');
    }
  }

  public isInCombat(entityId: string): boolean {
    return this.stateService.isInCombat(entityId);
  }

  public endCombat(entityId: string, reason: string): void {
    const state = this.stateService.exitCombat(entityId);
    if (state) {
      this.emitCombatEnded(entityId, reason);
    }
  }

  destroy(): void {
    this.stateService.clear();
    this.equipmentCache.clear();
    this.animationManager.destroy();
    super.destroy();
  }

  private cleanupEntity(entityId: string): void {
    this.stateService.removeEntity(entityId);
    this.equipmentCache.invalidateCache(entityId);
    this.animationManager.cancelEmoteReset(entityId);
  }

  // Helper methods...
  private isValidTarget(targetId: string, targetType: string): boolean { /* ... */ }
  private handleRetaliation(mobId: string, attackerId: string, tick: number): void { /* ... */ }
  private handleTargetKilled(attackerId: string, targetId: string, aType: string, tType: string): void { /* ... */ }
  private emitCombatHit(attackerId: string, targetId: string, damage: number, health: number, killed: boolean): void { /* ... */ }
  private emitCombatMiss(attackerId: string, targetId: string): void { /* ... */ }
  private emitCombatEnded(entityId: string, reason: string): void { /* ... */ }
}
```

### Phase 5 Comparison

| Metric | Before | After |
|--------|--------|-------|
| CombatSystem.ts lines | 1,600 | 250 |
| Number of files | 1 | 7 |
| Largest file | 1,600 lines | 250 lines |
| Avg file size | 1,600 lines | 150 lines |
| Testability | Poor | Excellent |
| SRP compliance | ❌ | ✅ |

---

## Phase 6: Game Studio Hardening

### 6.1 Combat Request Throttling

**Modify**: `packages/server/src/systems/ServerNetwork/action-queue.ts`

```typescript
interface PlayerQueueState {
  // ... existing
  combatRequestsThisTick: number;
  combatThrottleUntilTick: number;
}

const MAX_COMBAT_REQUESTS_PER_TICK = 2;
const THROTTLE_LOCKOUT_TICKS = 5;

queueCombat(socket: ServerSocket, data: unknown): void {
  const state = this.getOrCreateState(playerId);
  const currentTick = this.getCurrentTick();

  if (currentTick < state.combatThrottleUntilTick) {
    console.warn(`[ActionQueue] Player ${playerId} throttled`);
    return;
  }

  if (state.lastProcessedTick < currentTick) {
    state.combatRequestsThisTick = 0;
  }

  state.combatRequestsThisTick++;
  if (state.combatRequestsThisTick > MAX_COMBAT_REQUESTS_PER_TICK) {
    state.combatThrottleUntilTick = currentTick + THROTTLE_LOCKOUT_TICKS;
    return;
  }

  // ... continue
}
```

### 6.2 Pre-Validation in CombatSystem

Already implemented in Phase 5 refactored CombatSystem - validates before any processing.

### 6.3 Spatial Indexing (Optional for MVP)

Can be deferred - current player counts don't require spatial optimization.

---

## Implementation Order

```
Phase 0: Remove Ranged Combat
├── Simplify AttackType enum
├── Remove ranged handlers
├── Simplify range checking
└── ~305 lines removed

Phase 1: Security Hardening
├── CombatValidation.ts
├── Rate limiting
├── Input validation
└── XSS prevention

Phase 2: Type Safety
├── CombatInterfaces.ts
├── Replace `as any` casts
├── Remove debug logging
└── Error handling

Phase 3: Testing (~65 tests)
├── CombatSystem.test.ts
├── CombatStateService.test.ts
├── CombatDamageService.test.ts
├── CombatCalculations.test.ts
└── CombatValidation.test.ts

Phase 4: Memory Optimization
├── QuaternionPool.ts
├── Pooled quaternions
└── Iteration buffers

Phase 5: Modularization
├── CombatStateService.ts
├── CombatDamageService.ts
├── CombatEquipmentCache.ts
├── CombatRangeService.ts
├── CombatAnimationManager.ts
├── CombatRotationManager.ts
└── CombatSystem.ts (thin)

Phase 6: Game Studio Hardening
├── Combat throttling
└── Pre-validation
```

---

## Deliverables Summary

### New Files (10)

| File | Purpose | Lines |
|------|---------|-------|
| CombatValidation.ts | Input validation | ~120 |
| CombatInterfaces.ts | TypeScript interfaces | ~80 |
| QuaternionPool.ts | Object pooling | ~80 |
| CombatStateService.ts | State management | ~200 |
| CombatDamageService.ts | Damage calculation | ~150 |
| CombatEquipmentCache.ts | Equipment caching | ~120 |
| CombatRangeService.ts | Range checking | ~80 |
| CombatAnimationManager.ts | Animations | ~150 |
| CombatRotationManager.ts | Rotation | ~100 |
| **Total** | | **~1,080** |

### Test Files (5)

| File | Tests |
|------|-------|
| CombatSystem.test.ts | ~20 |
| CombatStateService.test.ts | ~15 |
| CombatDamageService.test.ts | ~10 |
| CombatCalculations.test.ts | ~10 |
| CombatValidation.test.ts | ~10 |
| **Total** | **~65** |

### Modified Files

| File | Changes |
|------|---------|
| core.ts | Simplify AttackType |
| CombatSystem.ts | Major rewrite (~250 lines) |
| CombatCalculations.ts | Remove ranged, debug logs |
| CombatUtils.ts | Simplify to melee-only |
| combat.ts handler | Add validation |
| action-queue.ts | Add rate limiting |
| PlayerDeathSystem.ts | Type safety fixes |

### Net Change

| Category | Lines |
|----------|-------|
| Removed (ranged) | -305 |
| New code | +1,080 |
| Test code | +1,500 |
| Refactored (reduction) | -1,350 |
| **Net production code** | **-575** |

---

## Expected Final Scores

| Category | Before | After | Improvement |
|----------|--------|-------|-------------|
| Production Quality | 5/10 | 9/10 | +4 |
| Best Practices | 4/10 | 9/10 | +5 |
| OWASP Security | 3/10 | 9/10 | +6 |
| Game Studio Audit | 6/10 | 9/10 | +3 |
| Memory Hygiene | 4/10 | 9/10 | +5 |
| SOLID Principles | 4/10 | 9/10 | +5 |
| **OVERALL** | **4.3/10** | **9.0/10** | **+4.7** |

---

## Checklist

### Phase 0: Remove Ranged
- [ ] Simplify AttackType enum in core.ts
- [ ] Remove handleRangedAttack() from CombatSystem.ts
- [ ] Remove calculateRangedDamage() from CombatSystem.ts
- [ ] Simplify isInCombatRange() to isInMeleeRange() in CombatUtils.ts
- [ ] Remove canUseRanged() from CombatUtils.ts
- [ ] Update combat.ts handler to always use melee
- [ ] Remove ranged branches from CombatCalculations.ts
- [ ] Build and verify melee combat works

### Phase 1: Security
- [ ] Create CombatValidation.ts
- [ ] Add rate limiting to action-queue.ts
- [ ] Add input validation to combat.ts handler
- [ ] Add sanitizeDisplayName() usage in CombatSystem.ts
- [ ] Add entity existence checks

### Phase 2: Type Safety
- [ ] Create CombatInterfaces.ts
- [ ] Replace ~50 `as any` casts in CombatSystem.ts
- [ ] Replace ~15 `as any` casts in PlayerDeathSystem.ts
- [ ] Remove debug console.log from CombatCalculations.ts
- [ ] Remove debug console.log from CombatSystem.ts
- [ ] Remove deprecated update() method

### Phase 3: Testing
- [ ] Create CombatSystem.test.ts (~20 tests)
- [ ] Create CombatStateService.test.ts (~15 tests)
- [ ] Create CombatDamageService.test.ts (~10 tests)
- [ ] Create CombatCalculations.test.ts (~10 tests)
- [ ] Create CombatValidation.test.ts (~10 tests)
- [ ] All tests passing

### Phase 4: Memory
- [ ] Create QuaternionPool.ts
- [ ] Use pooled quaternions in rotation
- [ ] Add iteration buffer reuse

### Phase 5: Modularization
- [ ] Create CombatStateService.ts
- [ ] Create CombatDamageService.ts
- [ ] Create CombatEquipmentCache.ts
- [ ] Create CombatRangeService.ts
- [ ] Create CombatAnimationManager.ts
- [ ] Create CombatRotationManager.ts
- [ ] Refactor CombatSystem.ts to thin orchestrator
- [ ] Update all imports
- [ ] Build and verify combat works

### Phase 6: Game Studio
- [ ] Add combat request throttling
- [ ] Verify pre-validation working
- [ ] Final integration test

---

*Document created: Combat System Hardening Plan*
*Target: 4.3/10 → 9.0/10*
*Scope: Melee-only MVP*
