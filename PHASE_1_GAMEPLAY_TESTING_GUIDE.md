# Phase 1: Death System Gameplay Testing Guide

**How to verify all security fixes work by actually playing the game**

This guide explains how to test each security feature we implemented (Tasks 1.1-1.5) by playing the game and trying to exploit the system. Each test includes:
- What to do in-game
- What logs to check
- What should happen (success criteria)
- What should NOT happen anymore (blocked exploits)

---

## 🎮 Prerequisites

### 1. Start the Development Server

```bash
# Terminal 1: Start server
cd packages/server
npm run dev

# Terminal 2: Start client
cd packages/client
npm run dev
```

**Wait for**:
- Server log: `[DatabaseSystem] ✓ Connected to Neon PostgreSQL`
- Server log: `[PlayerDeathSystem] Initialized modular death system components`
- Client: Opens browser at http://localhost:3000

### 2. Open Server Logs

Keep the server terminal visible to see security logs in real-time.

**Key logs to watch for**:
- `[PlayerDeathSystem]` - Death processing
- `[DeathStateManager]` - Death lock tracking
- `[HeadstoneEntity]` - Loot operations
- `⚠️` - Security warnings (blocked exploits)
- `✓` - Success confirmations
- `❌` - Errors (should not happen)

### 3. Prepare Test Items

Before dying, fill your inventory with items so you can verify they're protected:

1. Go to a shop or resource
2. Get 5-10 items in inventory
3. Note which items you have (write them down)

---

## Test 1: Database Persistence (Task 1.1)

**What we're testing**: Death locks persist to database, survive server restart

### Steps:

1. **Die in game** (safe zone):
   - Get killed by a mob
   - Items should go to gravestone

2. **Check server logs**:
   ```
   [PlayerDeathSystem] ✓ Starting death transaction for player_<your_id>
   [DeathStateManager] ✓ Persisted death lock to database for player_<your_id> (in transaction)
   [SafeAreaDeathHandler] Spawned gravestone gravestone_<id> with X items
   [PlayerDeathSystem] ✓ Death transaction committed successfully
   ```

3. **DO NOT RESPAWN YET** - Keep death screen open

4. **Restart server**:
   - Kill server (Ctrl+C in server terminal)
   - Restart server (`npm run dev`)
   - Wait for server to fully restart

5. **Reconnect client**:
   - Refresh browser OR wait for auto-reconnect
   - You should see death screen again!

### ✅ Success Criteria:

- Death screen appears again after reconnect
- Gravestone still exists in the world
- Your inventory is still empty (not loaded)
- Server log shows:
  ```
  [PlayerDeathSystem] Player <id> reconnected, checking for active death lock...
  [DeathStateManager] ✓ Restored death lock from database for <id>
  [PlayerDeathSystem] ⚠️  Player <id> reconnected with active death lock!
  [PlayerDeathSystem] ✓ Restored death state for <id> on reconnect
  ```

### ❌ Should NOT Happen:

- ❌ Inventory loads with items (would be duplication!)
- ❌ Death lock lost (would allow you to die again and dupe items)
- ❌ Gravestone despawned (would lose items)

**Result**: Database persistence prevents item duplication on server restart ✅

---

## Test 2: Server Authority Guards (Task 1.2)

**What we're testing**: Client cannot trigger death events

### Steps:

1. **Open browser console** (F12 → Console tab)

2. **Try to trigger death from client**:
   ```javascript
   // Attempt 1: Try to emit death event
   window.world?.emit?.('entity:death', {
     entityId: 'your_player_id',
     killedBy: 'exploit',
     entityType: 'player'
   });

   // Attempt 2: Try to call death system directly
   window.world?.getSystem?.('player-death')?.processPlayerDeath?.(
     'your_player_id',
     { x: 0, y: 0, z: 0 },
     'exploit'
   );
   ```

3. **Check server logs for WARNING**:
   ```
   [PlayerDeathSystem] ⚠️  Client attempted server-only death processing for player_<id> - BLOCKED
   ```

### ✅ Success Criteria:

- Death does NOT happen
- Server logs show `BLOCKED` message
- You remain alive in-game
- No items dropped

### ❌ Should NOT Happen:

- ❌ You die (would mean client can trigger death!)
- ❌ Items drop
- ❌ No warning log (means security check missing)

**Result**: Client cannot fake death events ✅

---

## Test 3: Database Transactions (Task 1.3)

**What we're testing**: If death fails mid-process, inventory is NOT cleared

### ⚠️ Advanced Test - Requires Code Modification

**Option A: Simple Verification (Just check logs)**

1. Die normally in game
2. Check server logs for transaction markers:
   ```
   [PlayerDeathSystem] ✓ Starting death transaction for player_<id>
   [SafeAreaDeathHandler] Handling safe area death for player_<id> (in transaction)
   [DeathStateManager] ✓ Persisted death lock to database for player_<id> (in transaction)
   [PlayerDeathSystem] ✓ Gravestone/ground items spawned, clearing inventory
   [PlayerDeathSystem] ✓ Transaction complete for player_<id>, committing...
   [PlayerDeathSystem] ✓ Death transaction committed successfully
   ```

3. All steps should show `(in transaction)` OR happen between "Starting" and "committed"

**Option B: Failure Test (Requires code change)**

See `VERIFICATION_TASKS_1.2_1.3.md` for detailed instructions on testing transaction rollback.

### ✅ Success Criteria:

- All death operations happen in transaction
- Logs show `(in transaction)` markers
- If transaction fails, inventory NOT cleared (rollback works)

**Result**: Atomic death processing prevents item loss ✅

---

## Test 4: Atomic Loot Operations (Task 1.4)

**What we're testing**:
1. Only one player can loot each item
2. Full inventory doesn't delete items
3. Loot protection works

### Test 4A: Concurrent Loot (Need 2 Players)

**Setup**: Two players, one gravestone

1. **Player 1**: Die with items → gravestone spawns
2. **Player 2**: Walk to gravestone
3. **Both players**: Click the SAME item at the EXACT same time
4. **Check server logs**:
   ```
   [HeadstoneEntity] Processing loot request from player_A for sword_123
   [HeadstoneEntity] ✓ player_A looted sword_123 x1
   [HeadstoneEntity] Processing loot request from player_B for sword_123
   [HeadstoneEntity] Item sword_123 not found (already looted by another player)
   ```

5. **Check client messages**:
   - Player A: No message (got item)
   - Player B: "Item already looted!" error message

### ✅ Success Criteria:

- Only ONE player gets the item
- Second player sees "already looted" message
- Server logs show "not found" for second request
- No item duplication

---

### Test 4B: Full Inventory Protection

1. **Fill your inventory completely** (28/28 slots)
2. **Die and create gravestone**
3. **Walk back to gravestone without freeing inventory**
4. **Try to loot an item**
5. **Check for error message**: "Your inventory is full!"
6. **Check gravestone**: Item STILL in gravestone (not deleted)
7. **Drop one item from inventory**
8. **Try to loot again**: Now it works!

### ✅ Success Criteria:

- Full inventory blocks looting
- Item NOT deleted from gravestone
- Error message appears
- After freeing space, can loot successfully

### ❌ Should NOT Happen:

- ❌ Item deleted when inventory full (old bug!)
- ❌ Item appears in full inventory (would be bad UX)

**Result**: Items never deleted due to full inventory ✅

---

### Test 4C: Loot Protection (Safe Zone)

1. **Die in safe zone** (most areas)
2. **Create gravestone**
3. **Have another player try to loot immediately**

**Expected**: No protection in safe zones - anyone can loot immediately

**Server log**:
```
[HeadstoneEntity] Loot protection active for 0s, protected for player: undefined
```

### ✅ Success Criteria:

- Any player can loot gravestone in safe zones
- No "loot is protected" message
- Loot protection = 0 seconds

**Result**: Safe zone mechanics work correctly ✅

---

## Test 5: Reconnect Validation (Task 1.5)

**What we're testing**:
1. Death state restored on reconnect
2. Cannot die twice
3. Inventory blocked until respawn

### Test 5A: Reconnect During Death

1. **Die in game** (gravestone spawns)
2. **Immediately close browser** (before clicking respawn)
3. **Wait 5 seconds**
4. **Reopen browser / reconnect**

**Expected behavior**:
- Death screen appears automatically
- You are invisible/dead
- Inventory is EMPTY (not loaded)
- Can click respawn button

**Server logs**:
```
[PlayerDeathSystem] Player <id> reconnected, checking for active death lock...
[DeathStateManager] ✓ Restored death lock from database for <id> (hasActiveDeathLock check)
[PlayerDeathSystem] ⚠️  Player <id> reconnected with active death lock!
[PlayerDeathSystem] ✓ Restored death state for <id> on reconnect
```

### ✅ Success Criteria:

- Death screen appears on reconnect
- Inventory does NOT load (blocked)
- Gravestone still exists
- Can respawn normally

### ❌ Should NOT Happen:

- ❌ Inventory loads (would duplicate items with gravestone!)
- ❌ Death screen does NOT appear
- ❌ Can walk around while dead

**Result**: Reconnect duplication prevented ✅

---

### Test 5B: Duplicate Death Prevention

1. **Get to low health** (1-2 HP)
2. **Stand next to multiple mobs**
3. **Let them all hit you at once** (multiple damage sources)
4. **Check server logs for duplicate death attempt**:

**Expected logs**:
```
[PlayerDeathSystem] processPlayerDeath starting for player_<id>
[PlayerDeathSystem] ✓ Starting death transaction
[PlayerDeathSystem] processPlayerDeath starting for player_<id>  (second event)
[PlayerDeathSystem] ⚠️  Player <id> already has active death lock - cannot die again until resolved - BLOCKED
```

### ✅ Success Criteria:

- Only ONE gravestone spawned
- Only ONE "death transaction" committed
- Second death BLOCKED with warning
- No item duplication or loss

**Result**: Duplicate death events prevented ✅

---

## 🎯 Quick Verification Checklist

Run through this quick checklist to verify all features:

### Normal Death Flow (Safe Zone)
- [ ] Die → gravestone spawns
- [ ] Items cleared from inventory
- [ ] Death screen appears
- [ ] Logs show transaction success
- [ ] Logs show death lock persisted to DB
- [ ] Can click respawn
- [ ] Respawn at Central Haven (0, 0)
- [ ] Gravestone still visible at death location
- [ ] Can walk back and loot items

### Security Features
- [ ] Server restart → death lock restored
- [ ] Reconnect → death screen restored
- [ ] Client console death attempt → BLOCKED
- [ ] Full inventory loot → item NOT deleted
- [ ] Concurrent loot → only one player gets item
- [ ] Double death event → second BLOCKED

### Error Messages
- [ ] "Your inventory is full!" when looting with full inventory
- [ ] "Item already looted!" when item taken by another player
- [ ] NO "Your inventory is full!" when item is stackable and exists

---

## 📋 Log Patterns to Look For

### ✅ Good Logs (Everything Working)

```
[PlayerDeathSystem] ✓ Starting death transaction
[DeathStateManager] ✓ Persisted death lock to database for player_X (in transaction)
[SafeAreaDeathHandler] Spawned gravestone gravestone_X with 5 items
[PlayerDeathSystem] ✓ Death transaction committed successfully
[HeadstoneEntity] ✓ player_A looted sword x1 from gravestone_X
[DeathStateManager] ✓ Restored death lock from database for player_X
[PlayerDeathSystem] ✓ Restored death state for player_X on reconnect
```

### ⚠️ Security Logs (Exploits Blocked)

```
[PlayerDeathSystem] ⚠️  Client attempted server-only death processing - BLOCKED
[PlayerDeathSystem] ⚠️  Death spam detected - BLOCKED
[PlayerDeathSystem] ⚠️  Player X already has active death lock - BLOCKED
[HeadstoneEntity] ⚠️  Client attempted server-only loot operation - BLOCKED
```

### ❌ Bad Logs (Something Wrong - Report if You See These)

```
[PlayerDeathSystem] ❌ Death transaction failed, rolled back
[DeathStateManager] ❌ Failed to persist death lock
[DatabaseSystem] ❌ Connection failed
[HeadstoneEntity] Item deleted due to full inventory  (should NEVER happen now)
```

---

## 🐛 How to Test for Specific Bugs (Now Fixed)

### Old Bug 1: Item Duplication on Server Restart
**How to test (should NOT work anymore)**:
1. Die → items to gravestone
2. Restart server (Ctrl+C, npm run dev)
3. Reconnect
4. **Expected**: Death screen appears, inventory EMPTY
5. **Old bug**: Inventory would load with items (duplication!)
6. **Fixed**: Inventory blocked until respawn ✅

---

### Old Bug 2: Item Deletion on Full Inventory
**How to test (should NOT work anymore)**:
1. Fill inventory (28/28)
2. Die → gravestone
3. Try to loot item
4. **Expected**: "Inventory full!" error, item STAYS in grave
5. **Old bug**: Item would be deleted forever
6. **Fixed**: Item protected ✅

---

### Old Bug 3: Item Duplication via Concurrent Loot
**How to test (should NOT work anymore)**:
1. Need 2 players
2. Both click same gravestone item at same time
3. **Expected**: Only one player gets item
4. **Old bug**: Both would get item (duplication!)
5. **Fixed**: Loot queue prevents duplication ✅

---

### Old Bug 4: Duplicate Death Events
**How to test (should NOT work anymore)**:
1. Low HP (1-2 HP)
2. Multiple enemies hit at once
3. **Expected**: One gravestone, one death
4. **Old bug**: Multiple gravestones or item loss
5. **Fixed**: Death lock prevents duplicate ✅

---

## 🚨 If Something Doesn't Work

### Problem: Death screen doesn't restore on reconnect

**Check**:
1. Is server running?
2. Did death lock persist to DB? (check logs for "Persisted death lock")
3. Is Neon PostgreSQL connected? (check logs for "Connected to Neon")

**Fix**:
- Check database connection
- See `VERIFICATION_TASKS_1.2_1.3.md` for detailed debugging

---

### Problem: Items duplicated

**Check**:
1. What exact steps caused duplication?
2. Check server logs for transaction failure
3. Was it concurrent loot? (should be blocked now)

**Report**:
- Exact reproduction steps
- Server logs from when it happened
- Which task's protection failed

---

### Problem: Items deleted

**Check**:
1. Was inventory full? (should show error now)
2. Did transaction fail and rollback? (should restore inventory)
3. Check server logs for transaction markers

---

## 📊 Testing Summary

After running all tests above, you should have verified:

✅ **Task 1.1**: Death locks persist to database, survive restart
✅ **Task 1.2**: Client cannot trigger death events
✅ **Task 1.3**: Death operations are atomic (transaction protected)
✅ **Task 1.4**: Loot operations are atomic, inventory checked first
✅ **Task 1.5**: Reconnect restores death state, blocks duplication

**All bugs fixed**:
- ✅ No item duplication (server restart, concurrent loot, duplicate death)
- ✅ No item deletion (full inventory, transaction failure)
- ✅ No client authority exploits
- ✅ Death state persistent and validated

---

## 🎮 Recommended Test Session Flow

**Full test session** (30-45 minutes):

1. **Start** (5 min):
   - Start server + client
   - Load game
   - Get test items

2. **Normal Death** (5 min):
   - Die in safe zone
   - Verify gravestone spawns
   - Respawn
   - Loot items back

3. **Database Persistence** (10 min):
   - Die again
   - Restart server
   - Reconnect
   - Verify death screen restored

4. **Loot Protection** (10 min):
   - Fill inventory
   - Die and try to loot with full inventory
   - Verify error message
   - Free space and loot

5. **Client Security** (5 min):
   - Try to trigger death from console
   - Verify BLOCKED in logs

6. **Edge Cases** (10 min):
   - Low HP + multiple enemies (duplicate death test)
   - Reconnect during active death
   - Any other scenarios you can think of

**Result**: Comprehensive verification of all Phase 1 security features ✅

---

**Last Updated**: 2025-01-17
**Phase 1 Status**: 100% Complete (5/5 tasks)
**Next**: Phase 2 Production Blockers

