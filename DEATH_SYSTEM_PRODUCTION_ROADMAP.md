# Death System Production Hardening Roadmap

**Status**: 🔴 NOT PRODUCTION READY
**Current Rating**: 4/10
**Target Rating**: 9/10 (RuneScape-level quality)
**Estimated Timeline**: 4-6 weeks (single engineer) | 2-3 weeks (team of 3)

---

## 🚨 PHASE 1: CRITICAL SECURITY FIXES (Week 1-2)

### ✅ Task 1.1: Add Database Persistence for Death Locks
**Priority**: P0 - BLOCKER
**Severity**: 10/10 CRITICAL
**Files**: `packages/shared/src/systems/shared/death/DeathStateManager.ts`, `packages/server/src/systems/DatabaseSystem/index.ts`
**Status**: ✅ COMPLETED

- [x] Create `player_deaths` database table schema
- [x] Add `saveDeathLock()` method to DatabaseSystem
- [x] Add `getDeathLock()` method to DatabaseSystem
- [x] Add `deleteDeathLock()` method to DatabaseSystem
- [x] Modify `DeathStateManager.createDeathLock()` to persist to DB
- [x] Modify `DeathStateManager.clearDeathLock()` to delete from DB
- [x] Add `getDeathLock()` to query DB on reconnect
- [ ] Add `validateOnReconnect()` to check for active deaths on login
- [ ] Test: Server restart with active death → items not duplicated

**Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS player_deaths (
  player_id TEXT PRIMARY KEY,
  gravestone_id TEXT,
  ground_item_ids TEXT, -- JSON array
  position TEXT, -- JSON {x, y, z}
  timestamp INTEGER,
  zone_type TEXT,
  item_count INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX idx_player_deaths_timestamp ON player_deaths(timestamp);
```

**Acceptance Criteria**:
- Server restart does NOT duplicate items
- Reconnect after death shows correct death state
- Database queries complete in <10ms

---

### ✅ Task 1.2: Add Server Authority Guards
**Priority**: P0 - BLOCKER
**Severity**: 10/10 CRITICAL
**Files**: `packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts`, `packages/shared/src/systems/shared/death/*.ts`
**Status**: ✅ COMPLETED

- [x] Add `if (!this.world.isServer) return;` to `PlayerDeathSystem.processPlayerDeath()`
- [x] Add server check to `SafeAreaDeathHandler.handleDeath()`
- [x] Add server check to `WildernessDeathHandler.handleDeath()`
- [x] Add server check to `GroundItemManager.spawnGroundItem()`
- [x] Add server check to `GroundItemManager.spawnGroundItems()`
- [x] Add server check to `DeathStateManager.createDeathLock()`
- [x] Add rate limiter: max 1 death per player per 10 seconds
- [ ] Test: Client attempt to trigger death → blocked with warning log

**Implementation Pattern**:
```typescript
async processPlayerDeath(...) {
  // CRITICAL: Server authority check
  if (!this.world.isServer) {
    console.error("[PlayerDeathSystem] Client attempted server-only death processing");
    return;
  }
  // ... rest of method
}
```

**Acceptance Criteria**:
- Client cannot trigger death events
- Rate limiter prevents death spam
- All server-only operations guarded

---

### ✅ Task 1.3: Implement Database Transactions for Death Flow
**Priority**: P0 - BLOCKER
**Severity**: 9/10 CRITICAL
**Files**: `packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts`, `packages/server/src/systems/DatabaseSystem/index.ts`
**Status**: ✅ COMPLETED

- [x] Add transaction support to DatabaseSystem (`executeInTransaction()`)
- [x] Wrap `processPlayerDeath()` in transaction
- [x] Move inventory clear AFTER gravestone creation (rollback safe)
- [x] Add try/catch with automatic rollback on any failure
- [x] Update death handlers to accept and pass transaction context
- [x] Update DeathStateManager to accept and pass transaction context
- [x] Update DeathRepository to use transaction when provided
- [ ] Test: Force failure at each step → verify rollback restores state

**Transaction Flow**:
```typescript
async processPlayerDeath(...) {
  const tx = await db.beginTransaction();
  try {
    // 1. Retrieve inventory (read-only)
    const items = await tx.getInventory(playerId);

    // 2. Create death lock in DB
    await tx.saveDeathLock(playerId, {...});

    // 3. Spawn gravestone/ground items
    await tx.spawnGravestone(...);

    // 4. Clear inventory (last step for safety)
    await tx.clearInventory(playerId);

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    console.error("Death transaction failed, rolled back:", error);
    throw error;
  }
}
```

**Acceptance Criteria**:
- Server crash mid-death does NOT lose items
- Transaction rollback restores inventory
- All operations atomic (all-or-nothing)

---

### ✅ Task 1.4: Add Atomic Loot Operations
**Priority**: P0 - BLOCKER
**Severity**: 8/10 CRITICAL
**Files**: `packages/shared/src/entities/world/HeadstoneEntity.ts`, `packages/shared/src/systems/shared/death/GroundItemManager.ts`
**Status**: ✅ COMPLETED

- [x] Add server authority check to loot operations
- [x] Add server-side loot queue (prevents concurrent pickups)
- [x] Add loot protection fields (time-based + owner-based)
- [x] Modify `HeadstoneEntity.handleLootRequest()` to use atomic queue pattern
- [x] Add inventory space check BEFORE removing item from grave
- [x] Add `canPlayerLoot(playerId)` validation method
- [x] Add `checkInventorySpace()` method to prevent item deletion
- [x] Update HeadstoneData type with loot protection fields
- [x] Update SafeAreaDeathHandler to set loot protection = 0
- [ ] Test: Two players click same item → only one gets it

**Atomic Loot Pattern**:
```typescript
async tryLootItem(playerId: string, itemId: string): Promise<boolean> {
  // Check loot protection
  if (!this.canLoot(playerId, itemId)) return false;

  // Check inventory space FIRST
  const hasSpace = await inventorySystem.hasSpace(playerId);
  if (!hasSpace) {
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: "Your inventory is full!",
      type: "error"
    });
    return false;
  }

  // Atomic remove (compare-and-swap)
  const removed = await this.atomicRemoveItem(itemId);
  if (!removed) return false; // Someone else looted it

  // Now safe to add to inventory
  await inventorySystem.addItem(playerId, itemId);
  return true;
}
```

**Acceptance Criteria**:
- Concurrent loot attempts only succeed for first player
- Full inventory does not delete items
- Loot protection enforced

---

### ✅ Task 1.5: Add Reconnect Validation
**Priority**: P0 - BLOCKER
**Severity**: 8/10 CRITICAL
**Files**: `packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts`, `packages/shared/src/systems/shared/death/DeathStateManager.ts`
**Status**: ✅ COMPLETED

- [x] Improved `hasActiveDeathLock()` to check both memory AND database
- [x] Add `hasActiveDeathLock(playerId)` check at start of `processPlayerDeath()`
- [x] Add reconnect handler: `onPlayerReconnect()` → validate death state
- [x] If death lock exists on reconnect: restore death screen UI
- [x] Prevent multiple simultaneous deaths for same player
- [x] Add PLAYER_JOINED event subscription for automatic reconnect validation
- [ ] Test: Die → disconnect → reconnect → cannot die again until resolved

**Reconnect Handler**:
```typescript
async onPlayerReconnect(playerId: string) {
  const deathLock = await this.deathStateManager.getDeathLock(playerId);

  if (deathLock) {
    console.log(`[PlayerDeathSystem] Player ${playerId} reconnected with active death lock`);

    // Restore death screen UI
    this.emitTypedEvent(EventType.UI_DEATH_SCREEN, {
      playerId,
      message: "You died. Your items are in a gravestone.",
      deathLocation: deathLock.position,
      respawnTime: 0
    });

    // Prevent inventory load until respawn
    return { blockInventoryLoad: true };
  }

  return { blockInventoryLoad: false };
}
```

**Acceptance Criteria**:
- Cannot die twice simultaneously
- Reconnect during death restores correct state
- Death lock prevents duplicate deaths

---

## 🔧 PHASE 2: ADDITIONAL PRODUCTION BLOCKERS (Week 2-3)

### ✅ Task 2.1: Fix Ground Item ID Collision
**Priority**: P1 - HIGH
**Files**: `packages/shared/src/systems/shared/death/GroundItemManager.ts`

- [ ] Replace auto-increment counter with UUID generation
- [ ] Or: Persist counter to database with atomic increment
- [ ] Test: 10,000 ground item spawns → no ID collisions

---

### ✅ Task 2.2: Enforce Loot Protection
**Priority**: P1 - HIGH
**Files**: `packages/shared/src/systems/shared/death/GroundItemManager.ts`

- [ ] Add `canLoot(playerId, itemId)` method that checks `lootProtectionUntil`
- [ ] Modify `removeGroundItem()` to call `canLoot()` before removal
- [ ] Test: Non-owner tries to loot protected item → blocked

---

### ✅ Task 2.3: Hide Loot Data from Other Clients
**Priority**: P1 - SECURITY
**Files**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

- [ ] Modify `getNetworkData()` to only send loot to owner
- [ ] Send `lootItemCount` to other players, not full `lootItems` array
- [ ] Test: Other players cannot see grave contents in network packets

---

### ✅ Task 2.4: Fix Default Zone Type
**Priority**: P1 - HIGH
**Files**: `packages/shared/src/systems/shared/death/ZoneDetectionSystem.ts`

- [ ] Change default zone from `SAFE_AREA` to `WILDERNESS` (line 161)
- [ ] Add warning log when unknown zone detected
- [ ] Test: Death in unmapped area → items drop as ground items (no gravestone)

---

### ✅ Task 2.5: Add Death Event Rate Limiting
**Priority**: P1 - SECURITY
**Files**: `packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts`

- [ ] Add rate limiter map: `lastDeathTime = new Map<string, number>()`
- [ ] Check rate limit in `processPlayerDeath()`: reject if <10s since last death
- [ ] Test: Spam death events → rejected after first

---

## 🚀 PHASE 3: SCALABILITY & PERFORMANCE (Week 3-4)

### ✅ Task 3.1: Add Spatial Indexing
**Priority**: P2 - MEDIUM
**Files**: `packages/shared/src/systems/shared/death/GroundItemManager.ts`, `packages/shared/src/systems/shared/death/ZoneDetectionSystem.ts`

- [ ] Implement quadtree for ground item lookup
- [ ] Implement R-tree for zone detection
- [ ] Benchmark: `getItemsNearPosition()` <5ms for 10,000 items

---

### ✅ Task 3.2: Add Memory Leak Prevention
**Priority**: P2 - MEDIUM
**Files**: All death system files

- [ ] Add TTL cleanup for `deathLocations` map (clear after 15 min)
- [ ] Add TTL cleanup for `gravestoneTimers` map
- [ ] Add max limit for ground items (10,000 items max)
- [ ] Add LRU cache for zone lookups

---

### ✅ Task 3.3: Optimize Network Packets
**Priority**: P2 - MEDIUM
**Files**: `packages/shared/src/systems/shared/death/GroundItemManager.ts`

- [ ] Batch ground item spawns into single packet
- [ ] Only send item count in gravestone network data
- [ ] Test: 50-item death generates <5 network packets

---

## 🎮 PHASE 4: RUNESCAPE FEATURE PARITY (Week 4-6)

### ✅ Task 4.1: Item Protection System
**Priority**: P3 - NICE-TO-HAVE

- [ ] Calculate top 3-4 most valuable items
- [ ] Keep protected items on death (don't drop)
- [ ] Display protected items in death screen UI

---

### ✅ Task 4.2: Gravestone Upgrade System
**Priority**: P3 - NICE-TO-HAVE

- [ ] Bronze gravestone: 5 minutes (free)
- [ ] Silver gravestone: 10 minutes (100k coins)
- [ ] Gold gravestone: 15 minutes (1M coins)
- [ ] Royal gravestone: 30 minutes (premium currency)

---

### ✅ Task 4.3: Instance/Raid Death Handling
**Priority**: P3 - NICE-TO-HAVE

- [ ] Detect if death in instance
- [ ] Spawn items outside instance entrance
- [ ] Or: Add "Death's Office" reclaim system

---

### ✅ Task 4.4: Death Cost Scaling
**Priority**: P3 - NICE-TO-HAVE

- [ ] Calculate reclaim cost based on player level + item value
- [ ] Prevents death as free teleport exploit

---

## 🧪 PHASE 5: TESTING & VALIDATION (Ongoing)

### ✅ Task 5.1: Automated Exploit Tests
- [ ] Test: Concurrent death spam
- [ ] Test: Network disconnect during death
- [ ] Test: Server crash at each step of death flow
- [ ] Test: Concurrent looting
- [ ] Test: Client authority bypass attempts

---

### ✅ Task 5.2: Load Testing
- [ ] Test: 1000 concurrent players online
- [ ] Test: 100 deaths per minute sustained
- [ ] Test: 10,000 ground items in world
- [ ] Monitor: Memory usage, DB connection pool, network bandwidth

---

### ✅ Task 5.3: Beta Testing
- [ ] 2-week closed beta with exploit bounty program
- [ ] Monitor logs for duplication attempts
- [ ] Validate no items lost or duplicated

---

## 📊 PROGRESS TRACKER

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| **Phase 1: Critical Security** | 5 | 5 | ✅ **COMPLETE (100%)** |
| **Phase 2: Production Blockers** | 5 | 0 | 🔴 Not Started |
| **Phase 3: Scalability** | 3 | 0 | ⚪ Blocked |
| **Phase 4: Feature Parity** | 4 | 0 | ⚪ Blocked |
| **Phase 5: Testing** | 3 | 0 | ⚪ Blocked |
| **TOTAL** | 20 | 5 | **25%** |

---

## 🎯 SUCCESS METRICS

**Before Launch**:
- [ ] All Phase 1 tasks completed (100%)
- [ ] All Phase 2 tasks completed (100%)
- [ ] At least 50% of Phase 3 completed
- [ ] 2-week beta test with no critical bugs
- [ ] Exploit bounty program finds no item duplication exploits

**Post-Launch Monitoring**:
- [ ] Item duplication rate: 0 incidents per month
- [ ] Death processing latency: <100ms p99
- [ ] Server crashes do not lose player items
- [ ] Support tickets for "lost items": <1% of deaths

---

## 📝 NOTES & DECISIONS

### Decision Log
- **2025-01-15**: Created roadmap, prioritized database persistence as #1
- _Add decisions as you make them_

### Known Risks
- Database performance under load (mitigate with connection pooling)
- Network latency during death (mitigate with client-side prediction)
- Gravestone timer desync (mitigate with server timestamp authority)

### Dependencies
- Database system must support transactions
- Network layer must support reliable packet delivery
- Client must respect server authority

---

**Last Updated**: 2025-01-15
**Next Review**: After Phase 1 completion
