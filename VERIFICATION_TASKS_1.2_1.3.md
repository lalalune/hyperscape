# Verification Plan: Tasks 1.2 & 1.3

**Date**: 2025-01-15
**Purpose**: Verify Server Authority Guards and Database Transactions work correctly
**Status**: Ready for Testing

---

## 🎯 What We Need to Verify

### Task 1.2: Server Authority Guards
1. ✅ Client **cannot** trigger death processing
2. ✅ Client **cannot** spawn gravestones/ground items
3. ✅ Client **cannot** create death locks
4. ✅ Rate limiter blocks death spam (10 second cooldown)
5. ✅ Server-side deaths still work normally

### Task 1.3: Database Transactions
1. ✅ Normal death commits transaction successfully
2. ✅ Gravestone spawn failure rolls back transaction
3. ✅ Inventory **not cleared** if rollback occurs
4. ✅ Death lock created atomically with gravestone
5. ✅ Inventory cleared **last** (after gravestone + death lock)

---

## 📋 Verification Methods

We have **3 options** for verification:

### Option 1: Automated Test Script (Recommended)
- Create a test script that simulates scenarios
- Runs on server startup or via command
- Verifies behavior automatically
- **Pros**: Repeatable, fast, comprehensive
- **Cons**: Requires writing test code

### Option 2: Manual Runtime Testing (Easiest)
- Start game server
- Use browser console to test client-side blocks
- Use admin commands to test server-side flow
- **Pros**: No test code needed, uses real game
- **Cons**: Manual, time-consuming, not repeatable

### Option 3: Log Analysis (Quick Verification)
- Review server logs during normal gameplay
- Look for security warnings and transaction logs
- **Pros**: Passive, no extra work
- **Cons**: Only verifies what naturally occurs

---

## 🧪 Test Scenarios

### Scenario 1: Client Death Block (Task 1.2)

**Objective**: Verify client cannot trigger death processing

**Steps**:
1. Start game server
2. Login as player
3. Open browser console (F12)
4. Try to trigger death from client:
   ```javascript
   // Attempt to access world from client
   const world = window.game?.world || window.world;
   if (world) {
     world.emit('entity:death', {
       entityId: 'your_player_id',
       killedBy: 'hacker',
       entityType: 'player'
     });
   }
   ```

**Expected Result**:
```
[PlayerDeathSystem] ⚠️  Client attempted server-only death processing for your_player_id - BLOCKED
```

**Verification**:
- ✅ Console shows "BLOCKED" message
- ✅ Player does NOT die
- ✅ Inventory NOT cleared
- ✅ No gravestone spawned

---

### Scenario 2: Rate Limiter (Task 1.2)

**Objective**: Verify 10-second death cooldown works

**Steps**:
1. Start game server
2. Kill player (legitimate death)
3. Immediately try to kill same player again (within 10 seconds)

**Method A - Using Admin Command** (if available):
```javascript
// First death
/kill player_id

// Immediate second death (within 10 seconds)
/kill player_id
```

**Method B - Using Server Console**:
```javascript
// In server code, force rapid deaths
const playerDeathSystem = world.getSystem('player-death');
await playerDeathSystem.processPlayerDeath(playerId, position, 'test');
await playerDeathSystem.processPlayerDeath(playerId, position, 'test'); // Immediate retry
```

**Expected Result**:
```
[PlayerDeathSystem] ⚠️  Death spam detected for player_id -
500ms since last death (cooldown: 10000ms) - BLOCKED
```

**Verification**:
- ✅ First death processes normally
- ✅ Second death BLOCKED (within 10 seconds)
- ✅ Log shows death spam warning with timing

---

### Scenario 3: Transaction Success (Task 1.3)

**Objective**: Verify normal death commits transaction

**Steps**:
1. Start game server
2. Give player some items
3. Kill player (legitimate death)
4. Check server logs

**Expected Logs** (in order):
```
[PlayerDeathSystem] ✓ Starting death transaction for player_id
[PlayerDeathSystem] Player has 5 items to drop: bronze_sword x1, health_potion x3, ...
[SafeAreaDeathHandler] Handling safe area death for player_id (in transaction)
[SafeAreaDeathHandler] Spawned gravestone gravestone_player_id_... with 5 items
[DeathStateManager] ✓ Persisted death lock to database for player_id (in transaction)
[PlayerDeathSystem] ✓ Gravestone/ground items spawned, clearing inventory for player_id
[PlayerDeathSystem] ✓ Transaction complete for player_id, committing...
[PlayerDeathSystem] ✓ Death transaction committed successfully for player_id
```

**Verification**:
- ✅ Logs show transaction started
- ✅ Logs show "(in transaction)" markers
- ✅ Gravestone spawned BEFORE inventory cleared
- ✅ Death lock created BEFORE inventory cleared
- ✅ Inventory cleared LAST
- ✅ Transaction committed
- ✅ Player respawns, gravestone exists in world
- ✅ Database has death lock record

---

### Scenario 4: Transaction Rollback (Task 1.3)

**Objective**: Verify transaction rolls back on failure and inventory NOT cleared

**Setup**: Add temporary error injection to force gravestone spawn failure

**Code Change** (TEMPORARY - for testing only):
```typescript
// File: SafeAreaDeathHandler.ts, line ~100
private async spawnGravestone(...) {
  // TEMPORARY: Force failure for testing
  if (playerId.includes('test')) {
    console.log('[TEST] Simulating gravestone spawn failure');
    return ''; // Force failure
  }

  // ... rest of method
}
```

**Steps**:
1. Apply temporary code change above
2. Restart game server
3. Create player with ID containing 'test' (or modify check)
4. Give player items
5. Kill player
6. Check server logs and player state

**Expected Logs**:
```
[PlayerDeathSystem] ✓ Starting death transaction for test_player_123
[SafeAreaDeathHandler] Handling safe area death for test_player_123 (in transaction)
[TEST] Simulating gravestone spawn failure
[SafeAreaDeathHandler] Failed to spawn gravestone for test_player_123
[PlayerDeathSystem] ❌ Death transaction failed for test_player_123, rolled back:
Error: Failed to spawn gravestone for test_player_123
```

**Verification**:
- ✅ Transaction started
- ✅ Gravestone spawn failed
- ✅ Transaction ROLLED BACK
- ✅ **CRITICAL**: Player inventory NOT cleared (still has items!)
- ✅ No death lock in database
- ✅ No gravestone in world
- ✅ Player can be killed again (retry works)

**Cleanup**: Remove temporary code change after test

---

### Scenario 5: Inventory Clear Order (Task 1.3)

**Objective**: Verify inventory clear happens LAST

**Method**: Add timestamp logging to verify order

**Code Change** (TEMPORARY - for testing only):
```typescript
// File: PlayerDeathSystem.ts
async processPlayerDeath(...) {
  try {
    await databaseSystem.executeInTransaction(async (tx: any) => {
      const t1 = Date.now();
      console.log(`[TEST] T+0ms: Transaction started`);

      // Get inventory
      const items = ...;
      const t2 = Date.now();
      console.log(`[TEST] T+${t2-t1}ms: Inventory retrieved (${items.length} items)`);

      // Delegate to handler
      await this.safeAreaHandler.handleDeath(..., tx);
      const t3 = Date.now();
      console.log(`[TEST] T+${t3-t1}ms: Gravestone spawned + death lock created`);

      // Clear inventory
      await inventorySystem.clearInventoryImmediate(playerId);
      const t4 = Date.now();
      console.log(`[TEST] T+${t4-t1}ms: Inventory cleared (LAST STEP)`);
    });
  } catch (error) {
    // ...
  }
}
```

**Expected Logs**:
```
[TEST] T+0ms: Transaction started
[TEST] T+5ms: Inventory retrieved (5 items)
[TEST] T+120ms: Gravestone spawned + death lock created
[TEST] T+145ms: Inventory cleared (LAST STEP)  ← CRITICAL: This is LAST
```

**Verification**:
- ✅ Inventory clear has highest timestamp
- ✅ Gravestone + death lock created BEFORE inventory clear
- ✅ Order is: retrieve → spawn → lock → clear

**Cleanup**: Remove timestamp logging after test

---

### Scenario 6: Database Death Lock Persistence (Task 1.3)

**Objective**: Verify death lock created in database within transaction

**Steps**:
1. Kill player with items
2. Query database for death lock

**Database Query**:
```sql
SELECT * FROM player_deaths WHERE player_id = 'player_id_here';
```

**Expected Result**:
```
player_id       | gravestone_id              | ground_item_ids | position          | timestamp     | zone_type  | item_count
----------------|----------------------------|-----------------|-------------------|---------------|------------|------------
player_id_here  | gravestone_player_id_...   | []              | {"x":0,"y":0,"z":0} | 1736967000000 | safe_area  | 5
```

**Verification**:
- ✅ Death lock exists in database
- ✅ `gravestone_id` is set (safe zone death)
- ✅ `item_count` matches items dropped
- ✅ `zone_type` is correct
- ✅ `timestamp` is recent

---

## 🚀 Quick Verification Script

Here's a script to run automated tests (create as `scripts/verify-death-security.ts`):

```typescript
/**
 * Verification script for Tasks 1.2 and 1.3
 * Run with: npx tsx scripts/verify-death-security.ts
 */

import { describe, test, expect } from './test-utils'; // Pseudo-code

describe('Task 1.2: Server Authority Guards', () => {
  test('Client cannot trigger death processing', async () => {
    // Simulate client-side death trigger
    const world = createMockWorld({ isServer: false });
    const deathSystem = new PlayerDeathSystem(world);

    // Should be blocked
    const consoleSpy = spyOnConsole();
    await deathSystem.processPlayerDeath('test_player', {x:0,y:0,z:0}, 'test');

    expect(consoleSpy).toHaveWarning('Client attempted server-only death processing');
    // Player should NOT be dead
    expect(deathSystem.isPlayerDead('test_player')).toBe(false);
  });

  test('Rate limiter blocks rapid deaths', async () => {
    const world = createMockWorld({ isServer: true });
    const deathSystem = new PlayerDeathSystem(world);

    // First death should succeed
    await deathSystem.processPlayerDeath('test_player', {x:0,y:0,z:0}, 'test');
    expect(deathSystem.isPlayerDead('test_player')).toBe(true);

    // Immediate second death should be BLOCKED
    const consoleSpy = spyOnConsole();
    await deathSystem.processPlayerDeath('test_player', {x:0,y:0,z:0}, 'test');
    expect(consoleSpy).toHaveWarning('Death spam detected');
  });
});

describe('Task 1.3: Database Transactions', () => {
  test('Normal death commits transaction', async () => {
    const { world, db } = await setupTestEnvironment();
    const deathSystem = world.getSystem('player-death');

    // Give player items
    const inventory = world.getSystem('inventory');
    inventory.addItem('test_player', { itemId: 'sword', quantity: 1 });

    // Kill player
    await deathSystem.processPlayerDeath('test_player', {x:0,y:0,z:0}, 'test');

    // Verify transaction committed
    const deathLock = await db.getDeathLockAsync('test_player');
    expect(deathLock).toBeDefined();
    expect(deathLock.itemCount).toBe(1);

    // Verify inventory cleared
    const inv = inventory.getInventory('test_player');
    expect(inv.items).toHaveLength(0);
  });

  test('Gravestone failure rolls back transaction', async () => {
    const { world, db } = await setupTestEnvironment();

    // Inject failure
    const entityManager = world.getSystem('entity-manager');
    jest.spyOn(entityManager, 'spawnEntity').mockResolvedValue(null); // Force failure

    const deathSystem = world.getSystem('player-death');
    const inventory = world.getSystem('inventory');
    inventory.addItem('test_player', { itemId: 'sword', quantity: 1 });

    // Kill player (should fail)
    try {
      await deathSystem.processPlayerDeath('test_player', {x:0,y:0,z:0}, 'test');
    } catch (error) {
      // Expected to fail
    }

    // CRITICAL: Verify inventory NOT cleared (rollback worked!)
    const inv = inventory.getInventory('test_player');
    expect(inv.items).toHaveLength(1); // Still has sword!

    // Verify no death lock
    const deathLock = await db.getDeathLockAsync('test_player');
    expect(deathLock).toBeNull();
  });
});
```

---

## ✅ Acceptance Checklist

### Task 1.2: Server Authority Guards

- [ ] **Test 1**: Client death attempt blocked (Scenario 1)
- [ ] **Test 2**: Rate limiter blocks spam (Scenario 2)
- [ ] **Test 3**: Server deaths work normally
- [ ] **Logs**: See "BLOCKED" warnings when client attempts death
- [ ] **Logs**: See rate limiter warnings on spam

### Task 1.3: Database Transactions

- [ ] **Test 1**: Normal death commits (Scenario 3)
- [ ] **Test 2**: Failure rolls back (Scenario 4)
- [ ] **Test 3**: Inventory NOT cleared on rollback (Scenario 4)
- [ ] **Test 4**: Inventory cleared LAST (Scenario 5)
- [ ] **Test 5**: Death lock in database (Scenario 6)
- [ ] **Logs**: See "(in transaction)" markers
- [ ] **Logs**: See "✓ Transaction committed successfully"
- [ ] **Logs**: See "❌ Transaction failed, rolled back" on errors

---

## 🎯 Recommended Verification Approach

**Phase 1: Quick Log Analysis** (5 minutes)
1. Start game server
2. Kill a player (normal death)
3. Review logs for transaction markers
4. Verify order: gravestone → death lock → inventory clear

**Phase 2: Manual Client Test** (10 minutes)
1. Login to game
2. Open browser console
3. Try to trigger death from client
4. Verify "BLOCKED" message appears
5. Try rapid deaths (rate limiter test)

**Phase 3: Transaction Failure Test** (15 minutes)
1. Add temporary error injection (Scenario 4)
2. Kill player
3. Verify inventory NOT cleared
4. Verify no death lock in database
5. Remove error injection

**Phase 4: Database Verification** (5 minutes)
1. Kill player
2. Query database for death lock
3. Verify all fields correct
4. Verify death lock deleted after respawn

**Total Time**: ~35 minutes for comprehensive verification

---

## 📝 Quick Manual Test Commands

If you have admin/debug commands available:

```javascript
// In game console or admin panel

// Test 1: Try to die from client (should fail)
world.emit('entity:death', { entityId: myPlayerId, killedBy: 'test', entityType: 'player' });
// Expected: "BLOCKED" message

// Test 2: Rapid deaths (rate limit test)
/kill
// Wait 5 seconds
/kill
// Expected: Second death blocked

// Test 3: Normal death
/kill
// Expected: Works normally, see transaction logs

// Test 4: Check death lock in DB
// Run SQL: SELECT * FROM player_deaths WHERE player_id = 'your_id';
// Expected: Record exists
```

---

## 🔍 What to Look For in Logs

### Success Indicators

**Task 1.2 (Server Authority)**:
```
✅ "[PlayerDeathSystem] ⚠️  Client attempted server-only death processing - BLOCKED"
✅ "[PlayerDeathSystem] ⚠️  Death spam detected - 500ms since last death - BLOCKED"
✅ "[SafeAreaDeathHandler] ⚠️  Client attempted server-only death handling - BLOCKED"
```

**Task 1.3 (Transactions)**:
```
✅ "[PlayerDeathSystem] ✓ Starting death transaction for player_id"
✅ "[SafeAreaDeathHandler] Handling safe area death (in transaction)"
✅ "[DeathStateManager] ✓ Persisted death lock to database (in transaction)"
✅ "[PlayerDeathSystem] ✓ Gravestone/ground items spawned, clearing inventory"
✅ "[PlayerDeathSystem] ✓ Transaction complete, committing..."
✅ "[PlayerDeathSystem] ✓ Death transaction committed successfully"
```

### Failure Indicators (These are BAD)

```
❌ No "BLOCKED" messages when client tries to die
❌ Client successfully triggers death
❌ Rapid deaths not blocked by rate limiter
❌ No "(in transaction)" markers in logs
❌ Inventory cleared before gravestone spawned
❌ No rollback on gravestone failure
❌ Inventory cleared even though transaction failed
```

---

## 📊 Expected Results Summary

| Test | Expected Behavior | Verification |
|------|-------------------|--------------|
| Client death attempt | BLOCKED with warning | Check console logs |
| Death spam (rate limit) | BLOCKED after 10s cooldown | Check console logs |
| Normal death | Transaction commits | Check logs + DB |
| Gravestone failure | Transaction rolls back | Check logs + inventory |
| Inventory clear timing | Happens LAST | Check log timestamps |
| Death lock persistence | Exists in database | Query DB |

---

**Created**: 2025-01-15
**Status**: Ready for Testing
**Estimated Time**: 35 minutes for full verification
