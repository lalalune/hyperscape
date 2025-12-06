# Implementation Plan: Production-Quality Store System

## Overview

This plan transforms the store system to match the security and quality standards of the bank system. The bank handler (`bank.ts`) serves as the reference implementation for all patterns.

**Goal:** Make store operations atomic, validated, and exploit-proof.

---

## Architecture Decision

### Current Flow (Insecure)
```
Client → store.ts (pass-through) → STORE_BUY event → StoreSystem → INVENTORY events → InventorySystem
         No validation              Fire-and-forget    No transactions   Fire-and-forget
```

### Target Flow (Secure)
```
Client → store.ts (full handler) → Database Transaction → In-Memory Sync
         ↓
         - Input validation
         - Rate limiting
         - Coin balance check
         - Inventory space check
         - Row-level locking
         - Atomic commit/rollback
```

---

## Phase 1: Secure Store Handler (P0 - Critical)

### File: `packages/server/src/systems/ServerNetwork/handlers/store.ts`

**Complete rewrite to mirror `bank.ts` pattern.**

#### 1.1 Add Security Infrastructure

```typescript
// Constants for safety limits
const MAX_INVENTORY_SLOTS = 28;
const MAX_ITEM_QUANTITY = 2147483647;
const MAX_ITEM_ID_LENGTH = 100;
const MAX_STORE_DISTANCE = 5; // meters

// Rate limiting
const lastOperationTime = new Map<string, number>();
const RATE_LIMIT_MS = 50; // 50ms = 20 ops/sec (more restrictive than bank)

// Validation functions (copy from bank.ts)
function isValidItemId(itemId: unknown): itemId is string;
function isValidQuantity(quantity: unknown): quantity is number;
function isValidStoreId(storeId: unknown): storeId is string;
function checkRateLimit(playerId: string): boolean;
function getDatabase(world: World): DrizzleDB | null;
function getPlayerId(socket: ServerSocket): string | null;
function sendToSocket(socket: ServerSocket, packet: string, data: unknown): void;
```

#### 1.2 Implement `handleStoreBuy` with Transactions

```typescript
/**
 * Handle store buy request
 *
 * SECURITY MEASURES:
 * - Input validation (itemId, quantity, storeId)
 * - Rate limiting
 * - Coin balance verification BEFORE deduction
 * - Inventory space verification
 * - Atomic transaction with row-level locking
 * - Distance verification
 */
export async function handleStoreBuy(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Step 1: Get and validate player
  const playerId = getPlayerId(socket);
  if (!playerId) return;

  // Step 2: Rate limiting
  if (!checkRateLimit(playerId)) {
    sendToSocket(socket, "showToast", { message: "Please wait", type: "error" });
    return;
  }

  // Step 3: Input validation
  if (!isValidStoreId(data.storeId)) { /* error */ return; }
  if (!isValidItemId(data.itemId)) { /* error */ return; }
  if (!isValidQuantity(data.quantity)) { /* error */ return; }

  // Step 4: Validate store and item exist
  const store = getStoreById(data.storeId);
  if (!store) { /* error */ return; }

  const storeItem = store.items.find(i => i.itemId === data.itemId);
  if (!storeItem) { /* error */ return; }

  // Step 5: Validate item exists in game database
  const itemData = getItem(data.itemId);
  if (!itemData) { /* error */ return; }

  // Step 6: Distance check (get player position from socket.player.node.position)
  const playerPos = socket.player?.node?.position;
  if (playerPos) {
    const distance = calculateDistance(playerPos, store.location.position);
    if (distance > MAX_STORE_DISTANCE) {
      sendToSocket(socket, "showToast", { message: "Too far from store", type: "error" });
      return;
    }
  }

  // Step 7: Calculate cost
  const totalCost = storeItem.price * data.quantity;

  // Step 8: Check stock (if not unlimited)
  if (storeItem.stockQuantity !== -1 && storeItem.stockQuantity < data.quantity) {
    sendToSocket(socket, "showToast", { message: "Not enough stock", type: "error" });
    return;
  }

  const db = getDatabase(world);
  if (!db) { /* error */ return; }

  // Step 9: Atomic transaction
  try {
    await db.drizzle.transaction(async (tx) => {
      // 9a: Lock player row and check coin balance
      const playerResult = await tx.execute(
        sql`SELECT coins FROM characters WHERE id = ${playerId} FOR UPDATE`
      );

      const playerRow = playerResult.rows[0] as { coins: number } | undefined;
      if (!playerRow) throw new Error("PLAYER_NOT_FOUND");

      if (playerRow.coins < totalCost) {
        throw new Error("INSUFFICIENT_COINS");
      }

      // 9b: Lock inventory and check space
      const inventoryResult = await tx.execute(
        sql`SELECT * FROM inventory WHERE "playerId" = ${playerId} FOR UPDATE`
      );

      const inventoryRows = inventoryResult.rows as Array<{ slotIndex: number }>;
      const usedSlots = new Set(inventoryRows.map(r => r.slotIndex));

      // Calculate slots needed (non-stackable items need N slots)
      const slotsNeeded = itemData.stackable ? 1 : data.quantity;
      const freeSlots: number[] = [];
      for (let i = 0; i < MAX_INVENTORY_SLOTS && freeSlots.length < slotsNeeded; i++) {
        if (!usedSlots.has(i)) freeSlots.push(i);
      }

      if (freeSlots.length < slotsNeeded) {
        throw new Error("INVENTORY_FULL");
      }

      // 9c: Deduct coins
      await tx.execute(
        sql`UPDATE characters SET coins = coins - ${totalCost} WHERE id = ${playerId}`
      );

      // 9d: Add items to inventory
      if (itemData.stackable) {
        // Check for existing stack
        const existingStack = inventoryRows.find(r =>
          (r as { itemId: string }).itemId === data.itemId
        );

        if (existingStack) {
          await tx.execute(
            sql`UPDATE inventory SET quantity = quantity + ${data.quantity}
                WHERE "playerId" = ${playerId} AND "itemId" = ${data.itemId}`
          );
        } else {
          await tx.insert(schema.inventory).values({
            playerId,
            itemId: data.itemId,
            quantity: data.quantity,
            slotIndex: freeSlots[0],
            metadata: null,
          });
        }
      } else {
        // Non-stackable: create N separate rows
        for (let i = 0; i < data.quantity; i++) {
          await tx.insert(schema.inventory).values({
            playerId,
            itemId: data.itemId,
            quantity: 1,
            slotIndex: freeSlots[i],
            metadata: null,
          });
        }
      }
    });

    // Step 10: Transaction succeeded - sync in-memory and send updates
    // Emit events to sync InventorySystem in-memory state
    world.emit(EventType.INVENTORY_COINS_UPDATED, {
      playerId,
      coins: /* fetch new balance */,
    });

    // Send updated inventory to client
    const inventoryRepo = new InventoryRepository(db.drizzle, db.pool);
    const updatedInventory = await inventoryRepo.getPlayerInventoryAsync(playerId);
    sendToSocket(socket, "inventoryUpdated", {
      playerId,
      items: updatedInventory.map(i => ({
        slot: i.slotIndex ?? -1,
        itemId: i.itemId,
        quantity: i.quantity ?? 1,
      })),
    });

    sendToSocket(socket, "showToast", {
      message: `Purchased ${data.quantity}x ${itemData.name}`,
      type: "success",
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg === "INSUFFICIENT_COINS") {
      sendToSocket(socket, "showToast", { message: "Not enough coins", type: "error" });
      return;
    }
    if (errorMsg === "INVENTORY_FULL") {
      sendToSocket(socket, "showToast", { message: "Inventory full", type: "error" });
      return;
    }
    // ... other error cases

    console.error("[StoreHandler] Buy failed:", error);
    sendToSocket(socket, "showToast", { message: "Purchase failed", type: "error" });
  }
}
```

#### 1.3 Implement `handleStoreSell` with Transactions

```typescript
/**
 * Handle store sell request
 *
 * SECURITY MEASURES:
 * - Validates player has the items before selling
 * - Atomic transaction prevents selling items player doesn't have
 * - Handles non-stackable items across multiple slots
 */
export async function handleStoreSell(
  socket: ServerSocket,
  data: { storeId: string; itemId: string; quantity: number },
  world: World,
): Promise<void> {
  // Similar pattern to handleStoreBuy:
  // 1. Validate inputs
  // 2. Rate limit
  // 3. Check store accepts buyback
  // 4. Distance check
  // 5. Transaction:
  //    a. Lock inventory rows for this item
  //    b. Verify player has enough quantity across all slots
  //    c. Remove items (delete rows or reduce quantity)
  //    d. Add coins to player
  // 6. Sync in-memory state
  // 7. Send updates to client
}
```

---

## Phase 2: Deprecate Shared StoreSystem Buy/Sell (P1)

### File: `packages/shared/src/systems/shared/economy/StoreSystem.ts`

#### 2.1 Mark Methods as Deprecated

```typescript
/**
 * @deprecated Use server handler handleStoreBuy instead.
 * This method is kept for backwards compatibility but should not be used.
 * Server-side transactions ensure atomicity and prevent exploits.
 */
private buyItem(data: StoreBuyEvent): void {
  console.warn('[StoreSystem] buyItem is deprecated - use server handler');
  // Keep minimal implementation for any edge cases
}
```

#### 2.2 Remove Event Subscriptions for Buy/Sell

```typescript
async init(): Promise<void> {
  // Keep store data initialization
  for (const storeData of Object.values(GENERAL_STORES)) { ... }

  // Keep open/close events (UI state only)
  this.subscribe<StoreOpenEvent>(EventType.STORE_OPEN, (data) => {
    this.openStore(data);
  });
  this.subscribe<StoreCloseEvent>(EventType.STORE_CLOSE, (data) => {
    this.closeStore(data);
  });

  // REMOVE these - now handled by server handler
  // this.subscribe(EventType.STORE_BUY, ...);
  // this.subscribe(EventType.STORE_SELL, ...);
}
```

---

## Phase 3: Add Distance Verification Infrastructure (P1)

### File: `packages/server/src/systems/ServerNetwork/handlers/store.ts`

#### 3.1 Create Distance Calculation Helper

```typescript
import { calculateDistance } from "@hyperscape/shared";

/**
 * Get player position from socket
 */
function getPlayerPosition(socket: ServerSocket): { x: number; y: number; z: number } | null {
  if (socket.player?.node?.position) {
    const pos = socket.player.node.position;
    return { x: pos.x, y: pos.y, z: pos.z };
  }
  return null;
}

/**
 * Check if player is within range of store
 */
function isPlayerNearStore(
  socket: ServerSocket,
  storeId: string,
  maxDistance: number = MAX_STORE_DISTANCE
): boolean {
  const playerPos = getPlayerPosition(socket);
  if (!playerPos) return false;

  const store = getStoreById(storeId);
  if (!store) return false;

  const distance = calculateDistance(playerPos, store.location.position);
  return distance <= maxDistance;
}
```

---

## Phase 4: Sync In-Memory State (P1)

### Problem
After database transaction, the in-memory `InventorySystem` state is stale.

### Solution
Mirror the bank handler pattern - emit events to sync after transaction:

```typescript
// After successful transaction in handleStoreBuy:

// Sync coins to in-memory InventorySystem
world.emit(EventType.INVENTORY_COINS_UPDATED, {
  playerId,
  coins: newCoinBalance, // fetched from DB after transaction
});

// Sync inventory items (for each added slot)
for (const slot of addedSlots) {
  world.emit(EventType.INVENTORY_ITEM_ADDED, {
    playerId,
    item: {
      id: 0,
      itemId: data.itemId,
      quantity: itemData.stackable ? data.quantity : 1,
      slot: slot,
      metadata: null,
    },
  });
}
```

---

## Phase 5: Code Quality Improvements (P2)

### 5.1 Extract Shared Validation Utilities

#### New File: `packages/server/src/systems/ServerNetwork/handlers/validation.ts`

```typescript
/**
 * Shared validation utilities for all handlers
 *
 * Extracted from bank.ts to be reused by store.ts and future handlers.
 */

export const MAX_INVENTORY_SLOTS = 28;
export const MAX_ITEM_QUANTITY = 2147483647;
export const MAX_ITEM_ID_LENGTH = 100;

export function isValidItemId(itemId: unknown): itemId is string { ... }
export function isValidQuantity(quantity: unknown): quantity is number { ... }
export function isValidPlayerId(playerId: unknown): playerId is string { ... }

export function createRateLimiter(limitMs: number) {
  const lastOperationTime = new Map<string, number>();

  return {
    check(playerId: string): boolean { ... },
    cleanup(): void { ... },
  };
}
```

### 5.2 Update bank.ts to Use Shared Utilities

```typescript
import {
  isValidItemId,
  isValidQuantity,
  createRateLimiter,
  MAX_INVENTORY_SLOTS,
} from "./validation";

const rateLimiter = createRateLimiter(10); // 10ms for bank

// Replace inline functions with imports
```

### 5.3 Deprecate Shared BankingSystem

The shared `BankingSystem.ts` is already noted as deprecated in comments. Formalize this:

```typescript
/**
 * @deprecated This system is deprecated. All banking operations are now
 * handled server-side via network packets (bankOpen, bankDeposit, bankWithdraw)
 * with proper database transactions. See: packages/server/src/systems/ServerNetwork/handlers/bank.ts
 *
 * This file is kept for backwards compatibility but should not be modified.
 * Future development should use the server handlers exclusively.
 */
export class BankingSystem extends SystemBase { ... }
```

---

## Phase 6: Testing (P1)

### 6.1 Security Test Cases

```typescript
describe('Store Security', () => {
  it('rejects negative quantity', async () => {
    const result = await handleStoreBuy(socket, {
      storeId: 'central_store',
      itemId: 'logs',
      quantity: -5,
    }, world);

    expect(socket.lastMessage).toContain('Invalid quantity');
  });

  it('rejects purchase with insufficient coins', async () => {
    // Set player coins to 10
    // Try to buy item costing 100
    expect(socket.lastMessage).toContain('Not enough coins');
  });

  it('rejects purchase when inventory full', async () => {
    // Fill inventory to 28 slots
    // Try to buy more items
    expect(socket.lastMessage).toContain('Inventory full');
  });

  it('rejects purchase when too far from store', async () => {
    // Set player position 100m from store
    expect(socket.lastMessage).toContain('Too far');
  });

  it('handles concurrent purchases atomically', async () => {
    // Simulate race condition with two simultaneous purchases
    // Verify no duplication or coin loss
  });
});
```

---

## File Changes Summary

| File | Action | Priority |
|------|--------|----------|
| `packages/server/src/systems/ServerNetwork/handlers/store.ts` | **Complete Rewrite** | P0 |
| `packages/server/src/systems/ServerNetwork/handlers/validation.ts` | **New File** | P2 |
| `packages/server/src/systems/ServerNetwork/handlers/bank.ts` | Refactor to use validation.ts | P2 |
| `packages/shared/src/systems/shared/economy/StoreSystem.ts` | Deprecate buy/sell methods | P1 |
| `packages/shared/src/systems/shared/economy/BankingSystem.ts` | Add deprecation notice | P2 |
| `packages/shared/src/systems/shared/character/InventorySystem.ts` | No changes needed | - |

---

## Implementation Order

### Week 1: Critical Security (P0)
1. [ ] Implement `handleStoreBuy` with full transaction support
2. [ ] Implement `handleStoreSell` with full transaction support
3. [ ] Add input validation functions
4. [ ] Add rate limiting
5. [ ] Add distance verification
6. [ ] Test all exploit scenarios

### Week 2: Architecture Cleanup (P1)
1. [ ] Deprecate StoreSystem buy/sell methods
2. [ ] Remove event subscriptions for STORE_BUY/STORE_SELL
3. [ ] Add in-memory sync after transactions
4. [ ] Write security test suite

### Week 3: Code Quality (P2)
1. [ ] Extract shared validation utilities
2. [ ] Refactor bank.ts to use shared utilities
3. [ ] Add deprecation notices to BankingSystem
4. [ ] Update documentation

---

## Verification Checklist

After implementation, verify these security requirements:

- [ ] **Negative quantity rejected** - Cannot pass negative values
- [ ] **Zero quantity rejected** - Cannot pass zero
- [ ] **Overflow prevented** - Bounded by MAX_ITEM_QUANTITY
- [ ] **Coin balance verified** - Cannot buy without enough coins
- [ ] **Inventory space verified** - Cannot buy if full
- [ ] **Distance verified** - Must be near store
- [ ] **Rate limited** - Cannot spam requests
- [ ] **Atomic transactions** - No partial operations
- [ ] **Row locking** - No race conditions
- [ ] **In-memory sync** - UI reflects DB state

---

## Verified Assumptions

After deep code review, the following have been verified:

| Assumption | Status | Evidence |
|------------|--------|----------|
| Coins stored in `characters.coins` | ✅ Verified | schema.ts:214 |
| Inventory in `inventory` table | ✅ Verified | schema.ts:337-346 |
| Bank uses `FOR UPDATE` locking | ✅ Verified | bank.ts:272, 301 |
| Bank emits events for in-memory sync | ✅ Verified | bank.ts:405-412 |
| `inventoryUpdated` packet exists | ✅ Verified | packets.ts:129 |
| `coinsUpdated` packet exists | ✅ Verified | packets.ts:130 |
| Store data from JSON manifests | ✅ Verified | stores.json, banks-stores.ts |
| Bank doesn't check distance either | ✅ Verified | bank.ts (no distance check) |

### Important Notes from Verification

1. **Coins in `inventoryUpdated`**: Bank sends `coins: 0` because bank ops don't change coins. Store MUST fetch and include actual coin balance since buy/sell affects coins.

2. **Distance Check Gap**: Neither bank.ts nor store.ts currently verify distance at the server handler level. Distance is only checked in shared systems on "open" operations. This is a security gap in BOTH systems (P1 for store, should also be addressed for bank later).

3. **Stock Management**: Store stock is in-memory only (not persisted). Acceptable for MVP since all items have unlimited stock (-1). Future enhancement if limited stock is needed.

4. **Event Sync Pattern**: Must emit:
   - `INVENTORY_ITEM_ADDED` for each slot when buying
   - `INVENTORY_ITEM_REMOVED` for each slot when selling
   - `INVENTORY_COINS_UPDATED` with new balance for both buy/sell

---

## Expected Outcome

After implementation:

| Metric | Before | After |
|--------|--------|-------|
| Security Rating | 2/10 | 8/10 |
| OWASP Compliance | FAIL | PASS |
| Transaction Safety | None | Full |
| Rate Limiting | None | 20 ops/sec |
| Input Validation | None | Complete |
| Distance Verification | Open only | Every transaction |
| Game Studio Audit | FAIL | PASS |

---

## Risk Mitigation

1. **Backwards Compatibility**: Keep old StoreSystem methods but log warnings
2. **Rollback Plan**: Feature flag to switch between old/new handlers
3. **Gradual Rollout**: Test on staging before production
4. **Monitoring**: Add metrics for transaction failures, rate limit hits

---

## References

- **Gold Standard Implementation**: `packages/server/src/systems/ServerNetwork/handlers/bank.ts`
- **Database Schema**: `packages/server/src/database/schema.ts`
- **Store Data**: `packages/server/world/assets/manifests/stores.json`
- **Security Audit**: `SECURITY_AUDIT_INVENTORY_STORE.md`
