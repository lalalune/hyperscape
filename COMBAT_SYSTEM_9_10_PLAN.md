# Combat System 9/10 Production Readiness Plan

**Current Score:** 7.2/10
**Target Score:** 9.0/10
**Scope:** 7,711 lines across 15 files

---

## Executive Summary

This plan addresses all issues identified in the comprehensive technical audit to bring the combat system to production-ready status. The work is organized into 6 phases with clear deliverables and acceptance criteria.

| Phase | Focus | Impact | Effort |
|-------|-------|--------|--------|
| 1 | Critical Test Coverage | +1.2 | High |
| 2 | Remove Debug Logging | +0.3 | Low |
| 3 | Type Safety Fixes | +0.5 | Medium |
| 4 | Memory Hygiene | +0.5 | Medium |
| 5 | Code Quality Polish | +0.3 | Low |
| 6 | Validation & Documentation | +0.2 | Low |

**Total Expected Improvement:** +3.0 points → **9.2/10**

---

## Issue Summary (Verified)

| Issue | Count | Files |
|-------|-------|-------|
| `any` types | 19 | PlayerDeathSystem (18), MobDeathSystem (1) |
| Debug console.logs | 18 | mob-tile-movement (15), CombatSystem (1), MobDeathSystem (2) |
| Untested OSRS functions | 4 | tilesWithinMeleeRange, getBestMeleeTile, tilesCardinallyAdjacent, getBestAdjacentTile |
| Untested components | 3 | PendingAttackManager, AggroSystem, MobDeathSystem |

---

## Phase 1: Critical Test Coverage

**Goal:** Add comprehensive tests for untested OSRS-critical functions
**Impact:** Best Practices 6/10 → 8.5/10
**Files to create/modify:**

### 1.1 TileSystem Melee Function Tests

**File:** `packages/shared/src/systems/shared/movement/__tests__/TileSystem.test.ts`

Add tests for these functions:

#### `tilesWithinMeleeRange()`

```typescript
describe("tilesWithinMeleeRange", () => {
  const center = { x: 5, z: 5 };

  describe("range 1 (standard melee) - CARDINAL ONLY", () => {
    it("returns true for north adjacent", () => {
      expect(tilesWithinMeleeRange(center, { x: 5, z: 6 }, 1)).toBe(true);
    });

    it("returns true for south adjacent", () => {
      expect(tilesWithinMeleeRange(center, { x: 5, z: 4 }, 1)).toBe(true);
    });

    it("returns true for east adjacent", () => {
      expect(tilesWithinMeleeRange(center, { x: 6, z: 5 }, 1)).toBe(true);
    });

    it("returns true for west adjacent", () => {
      expect(tilesWithinMeleeRange(center, { x: 4, z: 5 }, 1)).toBe(true);
    });

    it("returns FALSE for diagonal (NE) - OSRS melee cannot attack diagonally", () => {
      expect(tilesWithinMeleeRange(center, { x: 6, z: 6 }, 1)).toBe(false);
    });

    it("returns FALSE for diagonal (NW)", () => {
      expect(tilesWithinMeleeRange(center, { x: 4, z: 6 }, 1)).toBe(false);
    });

    it("returns FALSE for diagonal (SE)", () => {
      expect(tilesWithinMeleeRange(center, { x: 6, z: 4 }, 1)).toBe(false);
    });

    it("returns FALSE for diagonal (SW)", () => {
      expect(tilesWithinMeleeRange(center, { x: 4, z: 4 }, 1)).toBe(false);
    });

    it("returns false for same tile", () => {
      expect(tilesWithinMeleeRange(center, center, 1)).toBe(false);
    });

    it("returns false for 2 tiles away", () => {
      expect(tilesWithinMeleeRange(center, { x: 7, z: 5 }, 1)).toBe(false);
    });
  });

  describe("range 2 (halberd) - ALLOWS DIAGONAL", () => {
    it("returns true for diagonal adjacent", () => {
      expect(tilesWithinMeleeRange(center, { x: 6, z: 6 }, 2)).toBe(true);
    });

    it("returns true for 2 tiles cardinal", () => {
      expect(tilesWithinMeleeRange(center, { x: 7, z: 5 }, 2)).toBe(true);
    });

    it("returns true for 2 tiles diagonal", () => {
      expect(tilesWithinMeleeRange(center, { x: 7, z: 7 }, 2)).toBe(true);
    });

    it("returns false for 3 tiles away", () => {
      expect(tilesWithinMeleeRange(center, { x: 8, z: 5 }, 2)).toBe(false);
    });
  });
});
```

#### `getBestMeleeTile()`

```typescript
describe("getBestMeleeTile", () => {
  const target = { x: 5, z: 5 };

  describe("range 1 - returns cardinal tiles only", () => {
    it("returns attacker tile if already in melee range (north)", () => {
      const attacker = { x: 5, z: 6 };
      expect(getBestMeleeTile(target, attacker, 1)).toEqual(attacker);
    });

    it("returns closest cardinal tile when approaching from NE", () => {
      const attacker = { x: 10, z: 10 };
      const result = getBestMeleeTile(target, attacker, 1);
      // Should return east or north, NOT diagonal
      expect(
        (result?.x === 6 && result?.z === 5) || // East
        (result?.x === 5 && result?.z === 6)    // North
      ).toBe(true);
    });

    it("returns null if all cardinal tiles are blocked", () => {
      const attacker = { x: 10, z: 10 };
      const isWalkable = () => false;
      expect(getBestMeleeTile(target, attacker, 1, isWalkable)).toBe(null);
    });

    it("skips blocked tiles and returns next best", () => {
      const attacker = { x: 10, z: 5 }; // Coming from east
      const isWalkable = (tile: TileCoord) => {
        // Block east tile
        return !(tile.x === 6 && tile.z === 5);
      };
      const result = getBestMeleeTile(target, attacker, 1, isWalkable);
      // Should return north or south, not the blocked east
      expect(result?.x).not.toBe(6);
    });
  });

  describe("range 2 - includes diagonal tiles", () => {
    it("returns diagonal tile when closest", () => {
      const attacker = { x: 10, z: 10 };
      const result = getBestMeleeTile(target, attacker, 2);
      // Diagonal NE is closer than cardinal
      expect(result).toEqual({ x: 6, z: 6 });
    });
  });
});
```

#### `tilesCardinallyAdjacent()`

```typescript
describe("tilesCardinallyAdjacent", () => {
  const center = { x: 5, z: 5 };

  it("returns true for north", () => {
    expect(tilesCardinallyAdjacent(center, { x: 5, z: 6 })).toBe(true);
  });

  it("returns true for south", () => {
    expect(tilesCardinallyAdjacent(center, { x: 5, z: 4 })).toBe(true);
  });

  it("returns true for east", () => {
    expect(tilesCardinallyAdjacent(center, { x: 6, z: 5 })).toBe(true);
  });

  it("returns true for west", () => {
    expect(tilesCardinallyAdjacent(center, { x: 4, z: 5 })).toBe(true);
  });

  it("returns FALSE for diagonal", () => {
    expect(tilesCardinallyAdjacent(center, { x: 6, z: 6 })).toBe(false);
  });

  it("returns false for same tile", () => {
    expect(tilesCardinallyAdjacent(center, center)).toBe(false);
  });
});
```

### 1.2 PendingAttackManager Tests

**File:** `packages/server/src/systems/ServerNetwork/__tests__/PendingAttackManager.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PendingAttackManager } from "../PendingAttackManager";

describe("PendingAttackManager", () => {
  let manager: PendingAttackManager;
  let mockWorld: any;
  let mockTileMovement: any;
  let mockGetMobPosition: any;
  let mockIsMobAlive: any;

  beforeEach(() => {
    mockWorld = {
      entities: new Map(),
      emit: vi.fn(),
    };
    mockTileMovement = {
      movePlayerToward: vi.fn(),
    };
    mockGetMobPosition = vi.fn();
    mockIsMobAlive = vi.fn();

    manager = new PendingAttackManager(
      mockWorld,
      mockTileMovement,
      mockGetMobPosition,
      mockIsMobAlive
    );
  });

  describe("queuePendingAttack", () => {
    it("queues attack and starts movement", () => {
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 5 });

      manager.queuePendingAttack("player1", "mob1", 100, 1);

      expect(manager.hasPendingAttack("player1")).toBe(true);
      expect(manager.getPendingAttackTarget("player1")).toBe("mob1");
      expect(mockTileMovement.movePlayerToward).toHaveBeenCalledWith(
        "player1",
        { x: 5, y: 0, z: 5 },
        true,
        1
      );
    });

    it("cancels existing attack when new one queued", () => {
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 5 });

      manager.queuePendingAttack("player1", "mob1", 100, 1);
      manager.queuePendingAttack("player1", "mob2", 101, 1);

      expect(manager.getPendingAttackTarget("player1")).toBe("mob2");
    });

    it("does nothing if mob position not found", () => {
      mockGetMobPosition.mockReturnValue(null);

      manager.queuePendingAttack("player1", "mob1", 100, 1);

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });
  });

  describe("processTick", () => {
    it("emits attack event when player in melee range", () => {
      // Setup: player at (5,5), mob at (5,6) - cardinal adjacent
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 6 });
      mockIsMobAlive.mockReturnValue(true);
      mockWorld.entities.set("player1", { position: { x: 5, y: 0, z: 5 } });

      manager.queuePendingAttack("player1", "mob1", 100, 1);
      manager.processTick(101);

      expect(mockWorld.emit).toHaveBeenCalledWith(
        expect.any(String), // EventType.COMBAT_ATTACK_REQUEST
        expect.objectContaining({
          playerId: "player1",
          targetId: "mob1",
        })
      );
      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("does NOT emit attack when player diagonal (range 1)", () => {
      // Setup: player at (5,5), mob at (6,6) - diagonal
      mockGetMobPosition.mockReturnValue({ x: 6, y: 0, z: 6 });
      mockIsMobAlive.mockReturnValue(true);
      mockWorld.entities.set("player1", { position: { x: 5, y: 0, z: 5 } });

      manager.queuePendingAttack("player1", "mob1", 100, 1);
      manager.processTick(101);

      expect(mockWorld.emit).not.toHaveBeenCalled();
      expect(manager.hasPendingAttack("player1")).toBe(true);
    });

    it("re-paths when mob moves", () => {
      mockIsMobAlive.mockReturnValue(true);
      mockWorld.entities.set("player1", { position: { x: 0, y: 0, z: 0 } });

      // Initial position
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 5 });
      manager.queuePendingAttack("player1", "mob1", 100, 1);

      // Mob moved
      mockGetMobPosition.mockReturnValue({ x: 6, y: 0, z: 6 });
      manager.processTick(101);

      // Should have called movePlayerToward twice (initial + re-path)
      expect(mockTileMovement.movePlayerToward).toHaveBeenCalledTimes(2);
    });

    it("cancels attack if mob dies", () => {
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 5 });
      mockIsMobAlive.mockReturnValue(true);
      mockWorld.entities.set("player1", { position: { x: 0, y: 0, z: 0 } });

      manager.queuePendingAttack("player1", "mob1", 100, 1);

      mockIsMobAlive.mockReturnValue(false);
      manager.processTick(101);

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("has NO timeout - follows indefinitely (OSRS behavior)", () => {
      mockGetMobPosition.mockReturnValue({ x: 100, y: 0, z: 100 });
      mockIsMobAlive.mockReturnValue(true);
      mockWorld.entities.set("player1", { position: { x: 0, y: 0, z: 0 } });

      manager.queuePendingAttack("player1", "mob1", 100, 1);

      // Process many ticks - should NOT timeout
      for (let tick = 101; tick < 1000; tick++) {
        manager.processTick(tick);
      }

      expect(manager.hasPendingAttack("player1")).toBe(true);
    });
  });

  describe("cancelPendingAttack", () => {
    it("removes pending attack", () => {
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 5 });
      manager.queuePendingAttack("player1", "mob1", 100, 1);

      manager.cancelPendingAttack("player1");

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });
  });

  describe("onPlayerDisconnect", () => {
    it("cleans up pending attack", () => {
      mockGetMobPosition.mockReturnValue({ x: 5, y: 0, z: 5 });
      manager.queuePendingAttack("player1", "mob1", 100, 1);

      manager.onPlayerDisconnect("player1");

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });
  });
});
```

### 1.3 AggroSystem Tests

**File:** `packages/shared/src/systems/shared/combat/__tests__/AggroSystem.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AggroSystem } from "../AggroSystem";

describe("AggroSystem", () => {
  let system: AggroSystem;
  let mockWorld: any;

  beforeEach(() => {
    mockWorld = {
      entities: new Map(),
      getPlayer: vi.fn(),
      getSystem: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
    };
    system = new AggroSystem(mockWorld);
  });

  describe("registerMob", () => {
    it("registers mob with correct AI state", () => {
      // Test mob registration
    });

    it("throws if position is missing", () => {
      // Test error handling
    });
  });

  describe("checkPlayerAggro", () => {
    it("ignores players still loading", () => {
      // Test loading immunity
    });

    it("aggros player within detection range", () => {
      // Test detection range
    });

    it("ignores high-level players per GDD", () => {
      // Test level-based aggro
    });
  });

  describe("leashing", () => {
    it("returns mob to home when beyond leash range", () => {
      // Test leash behavior
    });
  });

  describe("combat integration", () => {
    it("starts combat when mob reaches player", () => {
      // Test combat start
    });
  });
});
```

### 1.4 MobDeathSystem Tests

**File:** `packages/shared/src/systems/shared/combat/__tests__/MobDeathSystem.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MobDeathSystem } from "../MobDeathSystem";

describe("MobDeathSystem", () => {
  let system: MobDeathSystem;
  let mockWorld: any;

  beforeEach(() => {
    mockWorld = {
      entities: new Map(),
      emit: vi.fn(),
      on: vi.fn(),
      getSystem: vi.fn(),
    };
    system = new MobDeathSystem(mockWorld);
  });

  describe("handleMobDeath", () => {
    it("only handles mob deaths, ignores player deaths", () => {
      // Test entity type filtering
    });

    it("despawns mob from world", () => {
      // Test despawn logic
    });

    it("emits MOB_NPC_DESPAWN event", () => {
      // Test event emission
    });
  });

  describe("destroy", () => {
    it("clears all respawn timers", () => {
      // Test cleanup
    });
  });
});
```

### 1.5 Integration Tests

**File:** `packages/shared/src/systems/shared/combat/__tests__/CombatMeleeRange.integration.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
// Import actual systems for integration testing

describe("OSRS Melee Range Integration", () => {
  describe("player attacks", () => {
    it("player cannot attack mob diagonally with standard melee (range 1)", () => {
      // Setup: player at (5,5), mob at (6,6)
      // Action: attempt attack
      // Assert: attack is blocked, not in range
    });

    it("player CAN attack mob cardinally with standard melee (range 1)", () => {
      // Setup: player at (5,5), mob at (6,5)
      // Action: attempt attack
      // Assert: attack succeeds
    });

    it("player CAN attack mob diagonally with halberd (range 2)", () => {
      // Setup: player with halberd at (5,5), mob at (6,6)
      // Action: attempt attack
      // Assert: attack succeeds
    });
  });

  describe("mob attacks", () => {
    it("mob cannot attack player diagonally with standard melee", () => {
      // Verify mob-tile-movement uses tilesWithinMeleeRange
    });

    it("mob re-paths to cardinal position when diagonal", () => {
      // Verify mob movement behavior
    });
  });

  describe("pending attack", () => {
    it("player walks to cardinal tile when clicking mob diagonally", () => {
      // Verify PendingAttackManager + getBestMeleeTile integration
    });

    it("player follows indefinitely with no timeout", () => {
      // Verify OSRS infinite follow
    });
  });
});
```

### Acceptance Criteria - Phase 1

- [ ] `tilesWithinMeleeRange` has 12+ test cases covering cardinal/diagonal/edge cases
- [ ] `getBestMeleeTile` has 8+ test cases
- [ ] `tilesCardinallyAdjacent` has 6+ test cases
- [ ] `PendingAttackManager` has 15+ test cases
- [ ] `AggroSystem` has 8+ test cases
- [ ] `MobDeathSystem` has 5+ test cases
- [ ] Integration tests cover player/mob melee range behavior
- [ ] All tests pass: `npm test`
- [ ] Test coverage for new functions > 90%

---

## Phase 2: Remove Debug Logging

**Goal:** Remove all debug `console.log` statements from production code
**Impact:** Production Quality 6.5/10 → 7.5/10

### 2.1 Files to Clean

| File | Lines to Remove | Count |
|------|-----------------|-------|
| `mob-tile-movement.ts` | 178, 188, 198, 216, 235, 271, 280, 360, 370, 378, 416, 492, 499, 562, 577 | 15 |
| `CombatSystem.ts` | 219 | 1 |
| `MobDeathSystem.ts` | 49, 61 | 2 |
| **TOTAL** | | **18** |

### 2.2 Implementation

Replace debug logs with one of:
1. **Remove entirely** - if purely for development debugging
2. **Convert to trace level** - if useful for production debugging

```typescript
// BEFORE (remove these)
console.log(`[MobTileMovement] requestMoveTo: ${mobId} moving to ${destTile.x},${destTile.z}`);

// AFTER (if needed for production debugging, use structured logging)
// Option A: Remove entirely
// Option B: Use debug flag
if (this.debugMode) {
  this.logger?.trace("mob_movement", { mobId, destination: destTile });
}
```

### 2.3 Verification

```bash
# Should return 0 results for debug logs
grep -rn "console\.log" packages/shared/src/systems/shared/combat/*.ts \
  packages/server/src/systems/ServerNetwork/mob-tile-movement.ts \
  packages/server/src/systems/ServerNetwork/PendingAttackManager.ts | \
  grep -v test | grep -v "// example" | wc -l
```

### Acceptance Criteria - Phase 2

- [ ] Zero `console.log` statements in production combat code
- [ ] `console.warn` and `console.error` preserved for actual errors
- [ ] Build passes with no regressions

---

## Phase 3: Type Safety Fixes

**Goal:** Eliminate all `any` types from combat system
**Impact:** Production Quality 6.5/10 → 8/10

### 3.1 PlayerDeathSystem.ts Fixes

#### 3.1.1 Create System Interfaces

**File:** `packages/shared/src/types/systems/SystemInterfaces.ts` (NEW or extend existing)

```typescript
/**
 * Type-safe interfaces for system access
 */

export interface PlayerSystemLike {
  getPlayer(id: string): PlayerEntity | null;
  respawnPlayer(id: string, position: Position3D): void;
}

export interface DatabaseSystemLike {
  executeInTransaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T>;
}

export interface DatabaseTransaction {
  run(sql: string, params?: unknown[]): Promise<void>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export interface EquipmentSystemLike {
  getPlayerEquipment(playerId: string): PlayerEquipment | null;
  clearEquipment(playerId: string): Promise<void>;
}

export interface TerrainSystemLike {
  getHeightAt(x: number, z: number): number;
}

export interface InventorySystemLike {
  getInventory(playerId: string): InventoryItem[];
  clearInventory(playerId: string): Promise<void>;
}
```

#### 3.1.2 Update PlayerDeathSystem.ts

```typescript
// BEFORE
const playerSystem = this.world.getSystem?.("player") as any;

// AFTER
import type { PlayerSystemLike } from "../../../types/systems/SystemInterfaces";

const playerSystem = this.world.getSystem?.("player") as PlayerSystemLike | undefined;
if (!playerSystem) {
  console.error("[PlayerDeathSystem] PlayerSystem not found");
  return;
}
```

#### 3.1.3 Fix Entity Property Access

```typescript
// BEFORE
(playerEntity as any).emote = "death";
(playerEntity as any).data.e = "death";

// AFTER - Define interface
interface DeathAnimatableEntity {
  emote?: string;
  data?: { e?: string };
  getMaxHealth?: () => number;
  setHealth?: (health: number) => void;
  node?: { position: THREE.Vector3 };
}

// Use type assertion to specific interface
const animatable = playerEntity as unknown as DeathAnimatableEntity;
if (animatable.emote !== undefined) {
  animatable.emote = "death";
}
```

### 3.2 MobDeathSystem.ts Fixes

```typescript
// BEFORE
(this.world.entities as any).remove(mobId);

// AFTER - Define interface
interface EntityManagerWithRemove {
  get(id: string): Entity | undefined;
  remove(id: string): void;
}

const entityManager = this.world.entities as unknown as EntityManagerWithRemove;
if ("remove" in entityManager) {
  entityManager.remove(mobId);
}
```

### 3.3 Complete List of `any` Types to Fix

**PlayerDeathSystem.ts (18 instances):**
| Line | Code | Fix |
|------|------|-----|
| 254 | `getSystem?.("player") as any` | Use `PlayerSystemLike` |
| 278 | `equipment: any` | Use `PlayerEquipment` |
| 342 | `getSystem("database") as any` | Use `DatabaseSystemLike` |
| 358 | `getSystem("equipment") as any` | Use `EquipmentSystemLike` |
| 364 | `async (tx: any)` | Use `DatabaseTransaction` |
| 500-504 | `(playerEntity as any).emote` | Use `DeathAnimatableEntity` |
| 552 | `(playerEntity.data as any).name` | Use typed player data |
| 620 | `(deathData as any).headstoneId` | Extend `DeathLocationData` type |
| 667-668 | `getMaxHealth()`, `setHealth()` | Use `HealthEntity` interface |
| 688 | `getSystem("terrain") as any` | Use `TerrainSystemLike` |
| 719 | `(playerEntity.node as any).position` | Use `NodeEntity` interface |
| 758 | `(this.world.network as any).sendTo` | Use `NetworkSystemLike` |
| 1046, 1146 | `(deathData as any).headstoneId` | Extend type |

**MobDeathSystem.ts (1 instance):**
| Line | Code | Fix |
|------|------|-----|
| 68 | `(this.world.entities as any).remove` | Use `EntityManagerWithRemove` |

### 3.4 Verification

```bash
# Should return 0 results
grep -rn "as any\|: any" packages/shared/src/systems/shared/combat/*.ts | \
  grep -v test | grep -v "\.d\.ts" | wc -l
```

### Acceptance Criteria - Phase 3

- [ ] Zero `any` types in combat system files (19 → 0)
- [ ] All system access uses typed interfaces
- [ ] ESLint passes with no `@typescript-eslint/no-explicit-any` violations
- [ ] Build passes with `strict: true`

---

## Phase 4: Memory Hygiene

**Goal:** Eliminate allocations in hot paths
**Impact:** Memory Hygiene 7/10 → 9/10

### 4.1 Create TileCoordPool

**File:** `packages/shared/src/utils/pools/TileCoordPool.ts` (NEW)

```typescript
/**
 * TileCoordPool - Object pool for tile coordinates
 *
 * Eliminates allocations in hot paths like combat range checks.
 * Same pattern as QuaternionPool.
 */

import type { TileCoord } from "../../systems/shared/movement/TileSystem";

interface PooledTileCoord extends TileCoord {
  _poolIndex: number;
}

class TileCoordPoolImpl {
  private pool: PooledTileCoord[] = [];
  private available: number[] = [];
  private readonly INITIAL_SIZE = 64;
  private readonly GROW_SIZE = 32;

  constructor() {
    this.grow(this.INITIAL_SIZE);
  }

  private grow(count: number): void {
    const startIndex = this.pool.length;
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      this.pool.push({ x: 0, z: 0, _poolIndex: index });
      this.available.push(index);
    }
  }

  acquire(): PooledTileCoord {
    if (this.available.length === 0) {
      this.grow(this.GROW_SIZE);
    }
    return this.pool[this.available.pop()!];
  }

  release(coord: PooledTileCoord): void {
    coord.x = 0;
    coord.z = 0;
    this.available.push(coord._poolIndex);
  }

  /**
   * Set tile coordinate from world position (replaces worldToTile allocation)
   */
  setFromWorld(coord: PooledTileCoord, worldX: number, worldZ: number): void {
    coord.x = Math.floor(worldX);
    coord.z = Math.floor(worldZ);
  }

  /**
   * Copy values from another tile coordinate
   */
  copy(target: PooledTileCoord, source: TileCoord): void {
    target.x = source.x;
    target.z = source.z;
  }

  getStats(): { total: number; available: number; inUse: number } {
    return {
      total: this.pool.length,
      available: this.available.length,
      inUse: this.pool.length - this.available.length,
    };
  }
}

export const tileCoordPool = new TileCoordPoolImpl();
```

### 4.2 Update Hot Paths to Use Pool

**File:** `packages/shared/src/systems/shared/combat/CombatSystem.ts`

```typescript
// BEFORE
const attackerTile = worldToTile(attackerPos.x, attackerPos.z);
const targetTile = worldToTile(targetPos.x, targetPos.z);

// AFTER
import { tileCoordPool } from "../../../utils/pools/TileCoordPool";

// At class level - reusable coords
private readonly _attackerTile = tileCoordPool.acquire();
private readonly _targetTile = tileCoordPool.acquire();

// In hot path method
private checkRangeAndFollow(combatState: CombatData, tickNumber: number): void {
  // ... get positions ...

  tileCoordPool.setFromWorld(this._attackerTile, attackerPos.x, attackerPos.z);
  tileCoordPool.setFromWorld(this._targetTile, targetPos.x, targetPos.z);

  if (!tilesWithinMeleeRange(this._attackerTile, this._targetTile, combatRangeTiles)) {
    // ...
  }
}

// In destroy()
destroy(): void {
  tileCoordPool.release(this._attackerTile);
  tileCoordPool.release(this._targetTile);
  // ...
}
```

### 4.3 Pre-allocate Event Payloads

```typescript
// At class level
private readonly _followEventPayload: CombatFollowTargetPayload = {
  playerId: "",
  targetId: "",
  targetPosition: { x: 0, y: 0, z: 0 },
  meleeRange: 1,
};

// In method
this._followEventPayload.playerId = attackerId;
this._followEventPayload.targetId = targetId;
this._followEventPayload.targetPosition.x = targetPos.x;
this._followEventPayload.targetPosition.y = targetPos.y;
this._followEventPayload.targetPosition.z = targetPos.z;
this._followEventPayload.meleeRange = combatRangeTiles;

this.emitTypedEvent(EventType.COMBAT_FOLLOW_TARGET, this._followEventPayload);
```

### 4.4 Apply to All Hot Path Files

| File | Changes |
|------|---------|
| `CombatSystem.ts` | Pool tile coords, pre-alloc event payloads |
| `PendingAttackManager.ts` | Pool tile coords |
| `mob-tile-movement.ts` | Pool tile coords |
| `tile-movement.ts` | Pool tile coords |

### Acceptance Criteria - Phase 4

- [ ] TileCoordPool created and tested
- [ ] All `worldToTile()` calls in hot paths use pooled coords
- [ ] Event payloads pre-allocated and reused
- [ ] Memory profile shows no GC spikes during combat

---

## Phase 5: Code Quality Polish

**Goal:** Final polish for AAA-studio quality
**Impact:** Game Studio Audit 7/10 → 8.5/10

### 5.1 Consolidate Weapon Range Lookup

Currently duplicated in:
- `CombatSystem.ts`
- `ServerNetwork/index.ts`
- `CombatUtils.ts`

**Solution:** Single source of truth

```typescript
// packages/shared/src/utils/game/CombatUtils.ts

/**
 * Get player's current weapon melee range
 * Single source of truth for weapon range
 */
export function getPlayerMeleeRange(
  world: World,
  playerId: string
): number {
  const equipmentSystem = world.getSystem("equipment") as EquipmentSystemLike | undefined;
  if (!equipmentSystem?.getPlayerEquipment) {
    return 1; // Default unarmed range
  }

  const equipment = equipmentSystem.getPlayerEquipment(playerId);
  return equipment?.weapon?.item?.attackRange ?? 1;
}
```

### 5.2 Add Missing JSDoc

Ensure all public methods have JSDoc:

```typescript
/**
 * Check if two tiles are within OSRS-accurate melee range.
 *
 * OSRS melee attack rules:
 * - Range 1 (standard melee): CARDINAL ONLY (N/S/E/W)
 * - Range 2+ (halberd, spear): Can attack diagonally
 *
 * @param attacker - Attacker's tile position
 * @param target - Target's tile position
 * @param meleeRange - Weapon's melee range (1 = standard, 2 = halberd)
 * @returns true if target is within melee attack range
 *
 * @see https://oldschool.runescape.wiki/w/Attack_range
 *
 * @example
 * ```typescript
 * // Standard melee - cardinal only
 * tilesWithinMeleeRange({x:5,z:5}, {x:6,z:5}, 1); // true (east)
 * tilesWithinMeleeRange({x:5,z:5}, {x:6,z:6}, 1); // false (diagonal)
 *
 * // Halberd - allows diagonal
 * tilesWithinMeleeRange({x:5,z:5}, {x:6,z:6}, 2); // true
 * ```
 */
export function tilesWithinMeleeRange(...) { ... }
```

### 5.3 Extract Magic Numbers to Constants

```typescript
// packages/shared/src/constants/CombatConstants.ts

export const OSRS_COMBAT = {
  /** Standard melee range (unarmed, swords) */
  MELEE_RANGE_STANDARD: 1,

  /** Extended melee range (halberds, spears) */
  MELEE_RANGE_HALBERD: 2,

  /** Default attack speed in ticks */
  ATTACK_SPEED_DEFAULT: 4,

  /** Combat timeout in ticks after last attack */
  COMBAT_TIMEOUT_TICKS: 8,

  /** Retaliation delay in ticks */
  RETALIATION_DELAY_TICKS: 1,
} as const;
```

### Acceptance Criteria - Phase 5

- [ ] Single `getPlayerMeleeRange()` function used everywhere
- [ ] All public functions have JSDoc with examples
- [ ] Magic numbers extracted to constants
- [ ] No duplicate code patterns

---

## Phase 6: Validation & Documentation

**Goal:** Verify all improvements and document
**Impact:** Final validation

### 6.1 Run Full Test Suite

```bash
npm test
npm run lint
npm run build
```

### 6.2 Memory Profile

```bash
# Run combat stress test
node --expose-gc scripts/combat-memory-test.js

# Verify no memory leaks
# - Stable heap size after 1000 combat sessions
# - No GC pauses > 10ms during combat
```

### 6.3 Update Documentation

**File:** `packages/shared/src/systems/shared/combat/README.md` (recreate)

```markdown
# Combat System

OSRS-accurate combat implementation with server authority.

## Architecture

- `CombatSystem.ts` - Main orchestrator
- `CombatStateService.ts` - Combat state CRUD
- `CombatAnimationManager.ts` - Emote timing
- `CombatRotationManager.ts` - Entity facing
- `CombatAntiCheat.ts` - Violation monitoring
- `PendingAttackManager.ts` - Walk-to-attack

## OSRS Accuracy

### Melee Range
- Range 1: Cardinal only (N/S/E/W)
- Range 2+: Allows diagonal

### Movement
- Infinite follow (no timeout)
- Path to adjacent tile (not truncate)
- Re-path every tick when target moves

## Testing

```bash
npm test -- packages/shared/src/systems/shared/combat
npm test -- packages/shared/src/systems/shared/movement
```
```

### 6.4 Final Audit

Re-run technical audit with same criteria:

| Category | Target | Verify |
|----------|--------|--------|
| Production Quality | 8.5/10 | No any, no debug logs |
| Best Practices | 8.5/10 | >80% test coverage |
| OWASP Security | 8.5/10 | Maintained |
| Game Studio Audit | 8.5/10 | Would pass QA |
| Memory Hygiene | 9/10 | Pooled hot paths |
| SOLID Principles | 8.5/10 | Maintained |
| **OVERALL** | **9.0/10** | |

### Acceptance Criteria - Phase 6

- [ ] All tests pass
- [ ] Lint passes with no warnings
- [ ] Build succeeds
- [ ] Memory profile shows no issues
- [ ] Documentation updated
- [ ] Final audit score >= 9.0/10

---

## Implementation Order

```
Week 1:
├── Phase 1.1: TileSystem melee tests (Day 1-2)
├── Phase 1.2: PendingAttackManager tests (Day 2-3)
├── Phase 2: Remove debug logging (Day 3)
└── Verify: npm test, npm run build

Week 2:
├── Phase 3: Type safety fixes (Day 1-2)
├── Phase 4: Memory hygiene (Day 2-3)
└── Verify: npm test, npm run lint

Week 3:
├── Phase 5: Code quality polish (Day 1)
├── Phase 6: Validation & documentation (Day 2)
└── Final audit and sign-off
```

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Test coverage (new functions) | 0% | >90% | 90% |
| `any` types | 19 | 0 | 0 |
| Debug console.logs | 18 | 0 | 0 |
| Untested components | 7 | 0 | 0 |
| Hot path allocations | ~15/tick | ~2/tick | <5/tick |
| Overall score | 7.2/10 | 9.2/10 | 9.0/10 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tests reveal bugs in melee logic | Fix bugs as found - that's the point |
| Type fixes break runtime | Run full test suite after each change |
| Pool changes affect performance | Benchmark before/after |
| Time overrun | Prioritize Phase 1-2 (highest impact) |

---

**Document Version:** 1.0
**Created:** 2024-12-14
**Author:** Claude (Technical Audit)
**Status:** Ready for Implementation
