# Security & Production Quality Audit
## Inventory, Store, and Banking Systems

**Audit Date:** December 6, 2025
**Auditor:** Claude Code
**Scope:** Economy-critical systems handling player items, currency, and transactions

---

## Executive Summary

The banking system (server-side) demonstrates **production-quality security** with proper transaction handling, row-level locking, and input validation. However, the **store system has critical vulnerabilities** that would allow players to exploit the economy for infinite coins and free items.

| System | Security Rating | Production Ready? |
|--------|----------------|-------------------|
| Bank (server handler) | 8/10 | ✅ Yes |
| Bank (shared system) | 4/10 | ⚠️ Deprecated |
| Store (server handler) | 2/10 | ❌ No |
| Store (shared system) | 2/10 | ❌ No |
| Inventory (shared) | 5/10 | ⚠️ Needs work |

---

## Critical Vulnerabilities

### 1. CRITICAL: Infinite Coins Exploit via Negative Quantity

**Location:** `StoreSystem.ts:143-199` (`buyItem` method)

**Exploit Steps:**
1. Malicious client sends `storeBuy` with `quantity: -100`
2. `totalCost = item.price * (-100) = -1000` (negative)
3. `INVENTORY_REMOVE_COINS` event fires with `amount: -1000`
4. `handleRemoveCoins`: `coins - (-1000) = coins + 1000` (ADDS coins!)
5. `INVENTORY_ITEM_ADDED` event fires with `quantity: -100`
6. `handleInventoryAdd`: Rejected due to `quantity <= 0` check

**Result:** Player gains 1000 coins, no items added. Repeat for infinite money.

**Code Evidence:**
```typescript
// StoreSystem.ts:153 - No quantity validation
const totalCost = item.price * data.quantity;

// StoreSystem.ts:171-174 - Directly uses potentially negative totalCost
this.emitTypedEvent(EventType.INVENTORY_REMOVE_COINS, {
  playerId: data.playerId,
  amount: totalCost,  // Can be negative!
});

// InventorySystem.ts:1289 - Clamped subtraction allows negative removal
inventory.coins = Math.max(0, inventory.coins - data.amount);
// If data.amount is -1000: Math.max(0, coins - (-1000)) = coins + 1000
```

**Severity:** CRITICAL - Complete economy break

---

### 2. CRITICAL: Free Items via Insufficient Coins

**Location:** `StoreSystem.ts:143-199` (`buyItem` method)

**Exploit Steps:**
1. Player has 10 coins, item costs 1000 coins
2. `INVENTORY_REMOVE_COINS` with `amount: 1000`
3. `handleRemoveCoins`: `Math.max(0, 10 - 1000) = 0` (clamped, no error)
4. `INVENTORY_ITEM_ADDED` succeeds, player receives item

**Result:** Player pays 10 coins for 1000-coin item.

**Code Evidence:**
```typescript
// StoreSystem.ts:169-186 - No coin balance check before purchase
// Remove coins from player (fire-and-forget, no verification)
this.emitTypedEvent(EventType.INVENTORY_REMOVE_COINS, {
  playerId: data.playerId,
  amount: totalCost,
});

// Add item to player inventory (always succeeds if inventory has space)
this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
  playerId: data.playerId,
  item: { ... },
});
```

**Severity:** CRITICAL - Free items, economy damage

---

### 3. HIGH: Store Operations Not Atomic

**Location:** `StoreSystem.ts:169-186`

**Issue:** Buy/sell operations use separate events without transactions:
1. Remove coins (Event 1)
2. Add item (Event 2)

If Event 2 fails (inventory full, item invalid), coins are already removed.

**Comparison with Bank (Correct Implementation):**
```typescript
// bank.ts:265-377 - Proper atomic transaction
await db.drizzle.transaction(async (tx) => {
  // All operations in single transaction with row locking
  await tx.execute(sql`SELECT ... FOR UPDATE`);
  // ... modify data ...
  // Commit or rollback as single unit
});
```

**Severity:** HIGH - Data integrity issues

---

### 4. HIGH: No Rate Limiting on Store

**Location:** `store.ts` server handler

**Issue:** Store handler has no rate limiting, unlike bank handler.

**Bank (Protected):**
```typescript
// bank.ts:37-38
const RATE_LIMIT_MS = 10; // Allows ~100 ops/sec

// bank.ts:117-138 - Rate limit check
function checkRateLimit(playerId: string): boolean {
  const now = Date.now();
  const lastOp = lastOperationTime.get(playerId) ?? 0;
  if (now - lastOp < RATE_LIMIT_MS) return false;
  // ...
}
```

**Store (Unprotected):**
```typescript
// store.ts:75-91 - No rate limiting at all
export async function handleStoreSell(socket, data, world) {
  const playerId = getPlayerId(socket);
  // Immediately emits event, no rate check
  world.emit(EventType.STORE_SELL, { ... });
}
```

**Severity:** HIGH - Enables rapid exploitation

---

### 5. MEDIUM: Distance Check Only on Open

**Location:** `StoreSystem.ts:117-125`

**Issue:** Distance is verified when opening store, but not on buy/sell.

```typescript
// Only checked on openStore, not on buyItem/sellItem
const distance = calculateDistance(data.playerPosition, store.position);
if (distance > 3) {
  // Error - too far
  return;
}
```

**Exploit:** Open store near NPC, teleport/walk away, continue trading remotely.

**Severity:** MEDIUM - Game design violation

---

### 6. MEDIUM: Non-Null Assertions on Store Lookups

**Location:** `StoreSystem.ts:145`

```typescript
const store = this.stores.get(storeId)!; // Assumes store exists
```

If `storeId` is manipulated to reference non-existent store, this throws an unhandled exception crashing the operation.

**Severity:** MEDIUM - Potential DoS via malformed requests

---

## OWASP Top 10 Compliance

| Category | Status | Notes |
|----------|--------|-------|
| A01: Broken Access Control | ⚠️ PARTIAL | No per-action authorization, trusts socket.player |
| A02: Cryptographic Failures | ✅ PASS | Privy JWT authentication is solid |
| A03: Injection | ✅ PASS | Drizzle ORM uses parameterized queries |
| A04: Insecure Design | ❌ FAIL | Store lacks transaction atomicity |
| A05: Security Misconfiguration | ⚠️ PARTIAL | Inconsistent rate limiting |
| A06: Vulnerable Components | ❓ UNKNOWN | Requires dependency audit |
| A07: Authentication Failures | ✅ PASS | Privy integration is secure |
| A08: Data Integrity Failures | ❌ FAIL | Store operations not atomic |
| A09: Security Logging | ⚠️ PARTIAL | Has logging but not security-focused |
| A10: SSRF | ✅ PASS | No user-controlled URLs |

---

## Comparison: Bank vs Store Architecture

### Bank Handler (Secure)
```
Client → Server Handler → Database Transaction → In-Memory Sync
         ↓
         - Input validation (isValidQuantity, isValidItemId)
         - Rate limiting (10ms)
         - Row-level locking (SELECT FOR UPDATE)
         - Atomic transaction (commit/rollback)
         - Overflow checking
         - Retry logic for conflicts
```

### Store Handler (Insecure)
```
Client → Server Handler → Event Emitter → Shared System → Events
         ↓                                      ↓
         - No validation                        - No validation
         - No rate limiting                     - No coin check
         - No transactions                      - Fire-and-forget events
         - Pass-through only                    - Not atomic
```

---

## Detailed Ratings

### 1. Security (OWASP Compliance): 5/10

**Strengths:**
- SQL injection protected via Drizzle ORM
- JWT authentication via Privy
- Bank handler has excellent security

**Weaknesses:**
- Critical exploits in store system
- Inconsistent security across systems
- Missing input validation in store

---

### 2. Best Practices: 6/10

**Strengths:**
- TypeScript with branded types (PlayerID, ItemID)
- Event-driven architecture
- Dependency injection via SystemBase
- Proper cleanup in destroy() methods

**Weaknesses:**
- Non-null assertions (`!`) instead of proper checks
- Inconsistent error handling patterns
- Magic numbers (distance: 3, rate limit: 10ms)
- Mixed async patterns (callbacks vs promises)

---

### 3. Code Quality: 6/10

**Strengths:**
- Clear separation of concerns (client/server/shared)
- Well-documented functions
- Consistent naming conventions

**Weaknesses:**
- InventorySystem at 1,481 lines (should be split)
- Duplicate logic between shared BankingSystem and server bank.ts
- Dead code in BankingSystem (comment says "handled server-side")
- Inconsistent quality between bank (excellent) and store (poor)

---

### 4. Transaction Safety: 4/10

| Operation | Transactional | Row Locking | Atomic |
|-----------|--------------|-------------|--------|
| Bank Deposit | ✅ | ✅ FOR UPDATE | ✅ |
| Bank Withdraw | ✅ | ✅ FOR UPDATE | ✅ |
| Store Buy | ❌ | ❌ | ❌ |
| Store Sell | ❌ | ❌ | ❌ |
| Inventory Add | ❌ | ❌ | ❌ |
| Inventory Remove | ❌ | ❌ | ❌ |

---

### 5. Game Studio Audit Readiness: 4/10

**Would FAIL:**
- Economy exploits (infinite coins, free items)
- Inconsistent security architecture
- Race conditions in store operations
- Missing rate limiting

**Would PASS:**
- Authentication system
- SQL injection protection
- Bank system security
- Basic TypeScript patterns

---

## Recommended Fixes (Priority Order)

### P0 - Critical (Fix Immediately)

1. **Add quantity validation in StoreSystem**
```typescript
// Add at start of buyItem and sellItem
if (!Number.isInteger(data.quantity) || data.quantity <= 0 || data.quantity > 10000) {
  this.emitTypedEvent(EventType.UI_MESSAGE, {
    playerId: data.playerId,
    message: "Invalid quantity.",
    type: "error",
  });
  return;
}
```

2. **Verify coins before purchase**
```typescript
// Before removing coins in buyItem
const inventory = this.world.getSystem('inventory').getInventory(data.playerId);
if (!inventory || inventory.coins < totalCost) {
  this.emitTypedEvent(EventType.UI_MESSAGE, {
    playerId: data.playerId,
    message: "Not enough coins.",
    type: "error",
  });
  return;
}
```

### P1 - High Priority

3. **Move store operations to server handler with transactions** (like bank.ts)
4. **Add rate limiting to store handler**
5. **Add distance verification on buy/sell operations**

### P2 - Medium Priority

6. **Remove dead BankingSystem code or fully deprecate**
7. **Replace non-null assertions with proper validation**
8. **Add per-action authorization checks**

### P3 - Low Priority

9. **Split InventorySystem into smaller focused systems**
10. **Standardize error handling patterns**
11. **Add security-focused logging**

---

## Conclusion

The codebase shows a **split quality pattern**: the bank system demonstrates production-ready security practices, while the store system has critical vulnerabilities that could destroy the game economy.

**The store system should NOT be deployed to production** without implementing at least the P0 fixes. The recommended approach is to refactor the store server handler to follow the same pattern as the bank handler, with proper database transactions, input validation, and rate limiting.

**Overall Rating: 5/10** - Not production ready due to critical store exploits.

---

## Files Analyzed

| File | Lines | Role |
|------|-------|------|
| `packages/shared/src/systems/shared/character/InventorySystem.ts` | 1,481 | Core inventory management |
| `packages/shared/src/systems/shared/economy/StoreSystem.ts` | 343 | Store buy/sell logic |
| `packages/shared/src/systems/shared/economy/BankingSystem.ts` | 524 | In-memory bank (deprecated) |
| `packages/server/src/systems/ServerNetwork/handlers/bank.ts` | 1,011 | Bank server handler (secure) |
| `packages/server/src/systems/ServerNetwork/handlers/store.ts` | 113 | Store server handler (pass-through) |
| `packages/server/src/database/repositories/InventoryRepository.ts` | 120 | Inventory persistence |
| `packages/server/src/database/repositories/BankRepository.ts` | 260 | Bank persistence |
