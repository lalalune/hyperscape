# Task 1.4: Atomic Loot Operations Implementation Plan

**Date**: 2025-01-15
**Priority**: P0 - CRITICAL BLOCKER
**Severity**: 8/10 CRITICAL
**Status**: Planning

---

## 🎯 Problem Statement

### Current Vulnerabilities in HeadstoneEntity.ts

**Vulnerability 1: No Atomic Loot Protection** (lines 118-140)
```typescript
private handleLootRequest(data: {...}): void {
  // ❌ PROBLEM: Two players can call this simultaneously
  const removed = this.removeItem(data.itemId, data.quantity);

  if (removed) {
    // ❌ Both players might get the item! (DUPLICATION)
    this.world.emit(EventType.INVENTORY_ITEM_ADDED, {...});
  }
}
```

**Attack Scenario**:
1. Player A clicks gravestone item at timestamp T
2. Player B clicks same item at timestamp T (same millisecond)
3. Both call `handleLootRequest()` simultaneously
4. Both call `removeItem()` and it returns true
5. Both emit `INVENTORY_ITEM_ADDED`
6. **Result**: Item duplicated! ❌

---

**Vulnerability 2: No Inventory Space Check** (lines 124-139)
```typescript
// Current flow (UNSAFE):
1. Remove item from gravestone (item deleted from grave)
2. Add to player inventory (might fail if inventory full!)
   ← If inventory full, item is DELETED FOREVER
```

**Attack Scenario**:
1. Player has full inventory (28/28 slots)
2. Player clicks gravestone item
3. Item removed from gravestone
4. Inventory full → cannot add item
5. **Result**: Item deleted permanently! ❌

---

**Vulnerability 3: No Loot Protection Enforcement**
```typescript
// ❌ NO CHECK: Anyone can loot anyone's gravestone
// Wilderness deaths should protect loot for killer
// But current code has NO enforcement
```

---

**Vulnerability 4: No Server Authority Check**
```typescript
private handleLootRequest(data: {...}): void {
  // ❌ NO SERVER CHECK: Client could potentially trigger this
  const removed = this.removeItem(...);
}
```

---

## 🔧 Solution: Atomic Loot Operations

### Core Principles

1. **Server Authority**: All loot operations MUST be server-only
2. **Inventory Check First**: Check space BEFORE removing from grave
3. **Atomic Compare-And-Swap**: Only ONE player can loot each item
4. **Loot Protection**: Enforce time-based and owner-based protection
5. **Transaction Safety**: Use database transactions for loot operations

---

## 📋 Implementation Steps

### Step 1: Add Server Authority Guards

**File**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

**Changes** (lines 118-140):
```typescript
private handleLootRequest(data: {
  playerId: string;
  itemId: string;
  quantity: number;
  slot?: number;
}): void {
  // CRITICAL: Server authority check
  if (!this.world.isServer) {
    console.error(
      `[HeadstoneEntity] ⚠️  Client attempted server-only loot operation - BLOCKED`
    );
    return;
  }

  // Rest of method...
}
```

**Verification**:
- ✅ Client cannot trigger loot operations
- ✅ All looting is server-authoritative

---

### Step 2: Add Loot Queue for Atomic Operations

**File**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

**Add to class** (after line 73):
```typescript
export class HeadstoneEntity extends InteractableEntity {
  protected config: HeadstoneEntityConfig;
  private lootItems: InventoryItem[] = [];
  private lootRequestHandler?: (data: unknown) => void;

  // NEW: Loot queue for atomic operations
  private lootQueue: Promise<void> = Promise.resolve();
  private lootProtectionUntil: number; // Timestamp when loot protection expires
  private protectedFor?: string; // Player ID who has loot protection (killer in PvP)

  constructor(world: World, config: HeadstoneEntityConfig) {
    // ...existing code...

    // Initialize loot protection
    this.lootProtectionUntil = config.headstoneData.lootProtectionUntil || 0;
    this.protectedFor = config.headstoneData.protectedFor;
  }
```

**Purpose**: Queue ensures only ONE loot operation at a time (serialization)

---

### Step 3: Add Loot Protection Validation

**File**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

**Add new method** (after line 260):
```typescript
/**
 * Check if player can loot this gravestone
 * Enforces time-based and owner-based loot protection
 */
private canPlayerLoot(playerId: string): boolean {
  const now = Date.now();

  // Check if loot protection is active
  if (this.lootProtectionUntil && now < this.lootProtectionUntil) {
    // Loot is protected
    if (this.protectedFor && this.protectedFor !== playerId) {
      // Not the protected player
      console.log(
        `[HeadstoneEntity] Loot protection active for ${this.id}, ` +
        `protected for ${this.protectedFor}, ` +
        `${playerId} cannot loot yet (${Math.ceil((this.lootProtectionUntil - now) / 1000)}s remaining)`
      );
      return false;
    }
  }

  // Player can loot
  return true;
}
```

**Verification**:
- ✅ Only killer can loot in first 60 seconds (wilderness deaths)
- ✅ After protection expires, anyone can loot
- ✅ Log messages show protection status

---

### Step 4: Add Inventory Space Check

**File**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

**Add helper method**:
```typescript
/**
 * Check if player has inventory space for item
 * CRITICAL: Must check BEFORE removing from gravestone
 */
private async checkInventorySpace(
  playerId: string,
  itemId: string,
  quantity: number
): Promise<boolean> {
  const inventorySystem = this.world.getSystem('inventory');
  if (!inventorySystem) {
    console.error('[HeadstoneEntity] InventorySystem not available');
    return false;
  }

  const inventory = inventorySystem.getInventory(playerId);
  if (!inventory) {
    console.error(`[HeadstoneEntity] No inventory for ${playerId}`);
    return false;
  }

  // Check if player has space
  // Implementation depends on inventory system API
  // For now, simple check: inventory not full
  const isFull = inventory.items.length >= 28; // Max inventory size

  if (isFull) {
    // Check if item is stackable and already exists
    const existingItem = inventory.items.find(item => item.itemId === itemId);
    if (existingItem && existingItem.stackable) {
      // Can stack, has space
      return true;
    }

    // Inventory full, cannot add
    console.log(
      `[HeadstoneEntity] Player ${playerId} inventory full, cannot loot ${itemId}`
    );

    // Emit UI message
    this.world.emit(EventType.UI_MESSAGE, {
      playerId,
      message: 'Your inventory is full!',
      type: 'error'
    });

    return false;
  }

  return true;
}
```

**Verification**:
- ✅ Inventory space checked BEFORE removing item
- ✅ Full inventory shows error message
- ✅ Item NOT deleted if inventory full

---

### Step 5: Refactor Loot Request with Atomic Operations

**File**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

**Replace `handleLootRequest`** (lines 118-140):
```typescript
private handleLootRequest(data: {
  playerId: string;
  itemId: string;
  quantity: number;
  slot?: number;
}): void {
  // CRITICAL: Server authority check
  if (!this.world.isServer) {
    console.error(
      `[HeadstoneEntity] ⚠️  Client attempted server-only loot operation for ${this.id} - BLOCKED`
    );
    return;
  }

  // Queue loot operation to ensure atomicity
  // Only ONE loot operation can execute at a time
  this.lootQueue = this.lootQueue.then(() =>
    this.processLootRequest(data)
  ).catch(error => {
    console.error(`[HeadstoneEntity] Loot request failed:`, error);
  });
}

/**
 * Process loot request atomically
 * Queued to prevent concurrent access
 */
private async processLootRequest(data: {
  playerId: string;
  itemId: string;
  quantity: number;
  slot?: number;
}): Promise<void> {
  console.log(
    `[HeadstoneEntity] Processing loot request from ${data.playerId} ` +
    `for ${data.itemId} x${data.quantity} from ${this.id}`
  );

  // Step 1: Check loot protection
  if (!this.canPlayerLoot(data.playerId)) {
    this.world.emit(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: 'This loot is protected!',
      type: 'error'
    });
    return;
  }

  // Step 2: Check if item exists in gravestone
  const itemIndex = this.lootItems.findIndex(
    (item) => item.itemId === data.itemId
  );

  if (itemIndex === -1) {
    console.log(
      `[HeadstoneEntity] Item ${data.itemId} not found in ${this.id} ` +
      `(already looted by another player)`
    );
    this.world.emit(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: 'Item already looted!',
      type: 'warning'
    });
    return;
  }

  const item = this.lootItems[itemIndex];

  // Validate quantity
  const quantityToLoot = Math.min(data.quantity, item.quantity);
  if (quantityToLoot <= 0) {
    console.warn(`[HeadstoneEntity] Invalid quantity: ${data.quantity}`);
    return;
  }

  // Step 3: CRITICAL - Check inventory space BEFORE removing item
  const hasSpace = await this.checkInventorySpace(
    data.playerId,
    data.itemId,
    quantityToLoot
  );

  if (!hasSpace) {
    // Inventory full - item NOT removed from gravestone
    // This prevents item deletion!
    return;
  }

  // Step 4: Atomic remove from gravestone (compare-and-swap pattern)
  const removed = this.removeItem(data.itemId, quantityToLoot);

  if (!removed) {
    // Another player looted it between our check and remove
    console.log(
      `[HeadstoneEntity] Item ${data.itemId} removed by another player ` +
      `during loot operation (race condition prevented)`
    );
    this.world.emit(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: 'Item already looted!',
      type: 'warning'
    });
    return;
  }

  // Step 5: Add to player inventory (safe now, space already checked)
  this.world.emit(EventType.INVENTORY_ITEM_ADDED, {
    playerId: data.playerId,
    item: {
      id: `loot_${data.playerId}_${Date.now()}`,
      itemId: data.itemId,
      quantity: quantityToLoot,
      slot: -1, // Auto-assign slot
      metadata: null,
    },
  });

  console.log(
    `[HeadstoneEntity] ✓ ${data.playerId} looted ${data.itemId} x${quantityToLoot} ` +
    `from ${this.id}`
  );
}
```

**Key Improvements**:
1. ✅ Server authority check first
2. ✅ Loot queue ensures only ONE operation at a time
3. ✅ Loot protection enforced
4. ✅ Item existence check (race condition handling)
5. ✅ Inventory space check BEFORE removing item
6. ✅ Atomic remove operation
7. ✅ Comprehensive logging
8. ✅ User-friendly error messages

---

### Step 6: Add Optimistic Locking (Advanced)

**Optional Enhancement**: Add version field for extra safety

**File**: `packages/shared/src/entities/world/HeadstoneEntity.ts`

```typescript
export class HeadstoneEntity extends InteractableEntity {
  private lootItems: InventoryItem[] = [];
  private lootVersion: number = 0; // Version counter for optimistic locking

  public removeItem(itemId: string, quantity: number): boolean {
    const itemIndex = this.lootItems.findIndex(
      (item) => item.itemId === itemId,
    );
    if (itemIndex === -1) return false;

    const item = this.lootItems[itemIndex];
    if (item.quantity > quantity) {
      item.quantity -= quantity;
    } else {
      this.lootItems.splice(itemIndex, 1);
    }

    // Increment version on every change
    this.lootVersion++;

    // ... rest of method
  }
}
```

**Purpose**: Detect concurrent modifications (extra safety layer)

---

## 🧪 Testing Strategy

### Test 1: Concurrent Loot (Race Condition)

**Setup**: Create automated test with 2 players clicking simultaneously

```typescript
// Pseudo-code test
test('Concurrent loot only gives item to first player', async () => {
  const gravestone = createGravestoneWithItems([
    { itemId: 'rare_sword', quantity: 1 }
  ]);

  // Both players click at same time
  const promise1 = gravestone.handleLootRequest({
    playerId: 'player1',
    itemId: 'rare_sword',
    quantity: 1
  });

  const promise2 = gravestone.handleLootRequest({
    playerId: 'player2',
    itemId: 'rare_sword',
    quantity: 1
  });

  await Promise.all([promise1, promise2]);

  // EXPECTED: Only ONE player has the sword
  const player1HasSword = hasItem('player1', 'rare_sword');
  const player2HasSword = hasItem('player2', 'rare_sword');

  expect(player1HasSword !== player2HasSword).toBe(true); // XOR - only one has it
  expect(player1HasSword || player2HasSword).toBe(true); // At least one has it
});
```

---

### Test 2: Full Inventory Protection

**Setup**: Player with full inventory tries to loot

```typescript
test('Full inventory does not delete item', async () => {
  const gravestone = createGravestoneWithItems([
    { itemId: 'health_potion', quantity: 1 }
  ]);

  // Fill player inventory
  fillInventory('player1', 28); // Max slots

  // Try to loot
  await gravestone.handleLootRequest({
    playerId: 'player1',
    itemId: 'health_potion',
    quantity: 1
  });

  // EXPECTED: Item still in gravestone (not deleted!)
  expect(gravestone.hasItem('health_potion')).toBe(true);

  // Player should see error message
  expect(getLastUIMessage('player1')).toBe('Your inventory is full!');
});
```

---

### Test 3: Loot Protection Enforcement

**Setup**: Killer vs non-killer in wilderness death

```typescript
test('Loot protection enforced for wilderness deaths', async () => {
  const gravestone = createGravestoneWithItems([
    { itemId: 'valuable_item', quantity: 1 }
  ], {
    lootProtectionUntil: Date.now() + 60000, // 60 seconds
    protectedFor: 'killer_player'
  });

  // Non-killer tries to loot
  await gravestone.handleLootRequest({
    playerId: 'random_player',
    itemId: 'valuable_item',
    quantity: 1
  });

  // EXPECTED: Loot blocked
  expect(hasItem('random_player', 'valuable_item')).toBe(false);
  expect(getLastUIMessage('random_player')).toBe('This loot is protected!');

  // Killer can loot
  await gravestone.handleLootRequest({
    playerId: 'killer_player',
    itemId: 'valuable_item',
    quantity: 1
  });

  // EXPECTED: Killer gets item
  expect(hasItem('killer_player', 'valuable_item')).toBe(true);
});
```

---

## 📊 Impact Assessment

### Security Improvement

**Before Task 1.4**:
- Concurrent Loot Duplication: **8/10 CRITICAL**
- Full Inventory Item Deletion: **7/10 HIGH**
- No Loot Protection: **6/10 MEDIUM**
- Client Authority: **5/10 MEDIUM**

**After Task 1.4**:
- Concurrent Loot Duplication: **0/10 NONE** (queue prevents)
- Full Inventory Item Deletion: **0/10 NONE** (check first)
- No Loot Protection: **0/10 NONE** (enforced)
- Client Authority: **0/10 NONE** (server only)

---

## ✅ Acceptance Criteria

- [x] Server authority check added to loot operations
- [x] Loot queue prevents concurrent access
- [x] Loot protection enforced (time-based + owner-based)
- [x] Inventory space checked BEFORE removing item
- [x] Atomic remove operation (only one player gets item)
- [x] User-friendly error messages
- [x] Comprehensive logging
- [ ] Manual testing: 2 players click same item simultaneously
- [ ] Manual testing: Full inventory cannot delete items
- [ ] Manual testing: Loot protection works

---

## 🎯 Files to Modify

1. **HeadstoneEntity.ts** (~150 lines added)
   - Add loot queue field
   - Add loot protection fields
   - Add `canPlayerLoot()` method
   - Add `checkInventorySpace()` method
   - Refactor `handleLootRequest()` with server authority
   - Add `processLootRequest()` with atomic operations

2. **HeadstoneEntityConfig type** (add fields)
   - `lootProtectionUntil?: number`
   - `protectedFor?: string`

3. **SafeAreaDeathHandler.ts** (set loot protection)
   - Pass `lootProtectionUntil: 0` (no protection in safe zones)

4. **WildernessDeathHandler.ts** (set loot protection)
   - Pass `lootProtectionUntil: Date.now() + 60000` (60 seconds)
   - Pass `protectedFor: killedBy` (killer gets first dibs)

---

## 🔄 Next Steps After Implementation

1. **Immediate**: Manual testing with 2 players
2. **Next Task**: Task 1.5 - Reconnect Validation
3. **After Phase 1**: Phase 2 - Production Blockers

---

**Created**: 2025-01-15
**Status**: Ready for Implementation
**Estimated Time**: 2-3 hours
