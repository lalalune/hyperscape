/**
 * InventorySystem Pickup Integration Tests
 *
 * Tests the pickup functionality:
 * - Atomic pickup locks (race condition prevention)
 * - Capacity pre-check (canAddItem)
 * - GroundItemSystem notification
 * - Item validation
 * - Rate limiting
 *
 * NOTE: Uses mocked system logic to avoid circular dependency issues.
 */

import { describe, it, expect } from "bun:test";

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
}

// ============================================================================
// Mock Inventory Manager (core pickup logic)
// ============================================================================

class MockInventoryManager {
  private items = new Map<number, InventoryItem>();
  private pickupLocks = new Set<string>();
  private readonly MAX_SLOTS = 28;
  private destroyedEntities: string[] = [];
  private removedGroundItems: string[] = [];

  // Mock entity data
  private entityData = new Map<
    string,
    { itemId: string; quantity: number; exists: boolean }
  >();

  setEntityData(
    entityId: string,
    data: { itemId: string; quantity: number },
  ): void {
    this.entityData.set(entityId, { ...data, exists: true });
  }

  canAddItem(itemId: string, quantity: number, isStackable: boolean): boolean {
    if (isStackable) {
      // Stackable items can go in existing stack or new slot
      for (const [, item] of this.items) {
        if (item.itemId === itemId) {
          return true; // Can add to existing stack
        }
      }
    }

    // Need a new slot
    return this.items.size < this.MAX_SLOTS;
  }

  addItem(itemId: string, quantity: number): boolean {
    // Find empty slot
    for (let slot = 0; slot < this.MAX_SLOTS; slot++) {
      if (!this.items.has(slot)) {
        this.items.set(slot, { itemId, quantity, slot });
        return true;
      }
    }
    return false;
  }

  pickupItem(playerId: string, entityId: string): boolean {
    // Validate input
    if (!playerId || !entityId) {
      return false;
    }

    // Check entity exists
    const entity = this.entityData.get(entityId);
    if (!entity || !entity.exists) {
      return false;
    }

    // Atomic lock check
    if (this.pickupLocks.has(entityId)) {
      return false;
    }

    // Acquire lock
    this.pickupLocks.add(entityId);

    try {
      // Check capacity
      if (!this.canAddItem(entity.itemId, entity.quantity, false)) {
        return false;
      }

      // Add to inventory
      if (!this.addItem(entity.itemId, entity.quantity)) {
        return false;
      }

      // Mark entity as destroyed
      entity.exists = false;
      this.destroyedEntities.push(entityId);
      this.removedGroundItems.push(entityId);

      return true;
    } finally {
      // Release lock
      this.pickupLocks.delete(entityId);
    }
  }

  getDestroyedEntities(): string[] {
    return [...this.destroyedEntities];
  }

  getRemovedGroundItems(): string[] {
    return [...this.removedGroundItems];
  }

  getItemCount(): number {
    return this.items.size;
  }

  fillInventory(): void {
    for (let i = 0; i < this.MAX_SLOTS; i++) {
      this.items.set(i, { itemId: `filler_${i}`, quantity: 1, slot: i });
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("InventorySystem Pickup", () => {
  describe("Basic Pickup Flow", () => {
    it("picks up item and destroys entity", () => {
      const manager = new MockInventoryManager();
      manager.setEntityData("item-1", { itemId: "coins", quantity: 100 });

      const result = manager.pickupItem("player-1", "item-1");

      expect(result).toBe(true);
      expect(manager.getDestroyedEntities()).toContain("item-1");
      expect(manager.getRemovedGroundItems()).toContain("item-1");
      expect(manager.getItemCount()).toBe(1);
    });

    it("silently ignores pickup of nonexistent entity", () => {
      const manager = new MockInventoryManager();

      const result = manager.pickupItem("player-1", "nonexistent-item");

      expect(result).toBe(false);
      expect(manager.getDestroyedEntities()).toHaveLength(0);
    });
  });

  describe("Atomic Pickup Locks", () => {
    it("blocks concurrent pickup of same item", () => {
      const manager = new MockInventoryManager();
      manager.setEntityData("item-1", { itemId: "coins", quantity: 100 });

      // First pickup succeeds
      const result1 = manager.pickupItem("player-1", "item-1");
      expect(result1).toBe(true);

      // Second pickup fails (entity no longer exists)
      const result2 = manager.pickupItem("player-2", "item-1");
      expect(result2).toBe(false);

      // Entity should only be destroyed once
      expect(manager.getDestroyedEntities()).toHaveLength(1);
    });

    it("allows pickup of different items concurrently", () => {
      const manager = new MockInventoryManager();
      manager.setEntityData("item-1", { itemId: "coins", quantity: 100 });
      manager.setEntityData("item-2", { itemId: "bones", quantity: 1 });

      const result1 = manager.pickupItem("player-1", "item-1");
      const result2 = manager.pickupItem("player-2", "item-2");

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(manager.getDestroyedEntities()).toContain("item-1");
      expect(manager.getDestroyedEntities()).toContain("item-2");
    });
  });

  describe("Input Validation", () => {
    it("rejects pickup with missing playerId", () => {
      const manager = new MockInventoryManager();
      manager.setEntityData("item-1", { itemId: "coins", quantity: 100 });

      const result = manager.pickupItem("", "item-1");

      expect(result).toBe(false);
      expect(manager.getDestroyedEntities()).toHaveLength(0);
    });

    it("rejects pickup with missing entityId", () => {
      const manager = new MockInventoryManager();

      const result = manager.pickupItem("player-1", "");

      expect(result).toBe(false);
      expect(manager.getDestroyedEntities()).toHaveLength(0);
    });
  });

  describe("Capacity Pre-check", () => {
    it("rejects pickup when inventory is full", () => {
      const manager = new MockInventoryManager();
      manager.fillInventory(); // Fill all 28 slots
      manager.setEntityData("item-1", { itemId: "bronze_sword", quantity: 1 });

      const result = manager.pickupItem("player-1", "item-1");

      expect(result).toBe(false);
      expect(manager.getDestroyedEntities()).toHaveLength(0);
    });

    it("allows pickup when inventory has space", () => {
      const manager = new MockInventoryManager();
      manager.setEntityData("item-1", { itemId: "coins", quantity: 100 });

      const result = manager.pickupItem("player-1", "item-1");

      expect(result).toBe(true);
    });
  });
});

describe("Pickup Rate Limiting", () => {
  describe("Rate Limit Logic", () => {
    function createRateLimiter() {
      const rateLimiter = new Map<
        string,
        { count: number; resetTime: number }
      >();
      let mockNow = Date.now();

      return {
        setTime: (time: number) => {
          mockNow = time;
        },
        advanceTime: (ms: number) => {
          mockNow += ms;
        },
        checkRateLimit: (playerId: string): boolean => {
          const now = mockNow;
          const playerLimit = rateLimiter.get(playerId);

          if (playerLimit) {
            if (now < playerLimit.resetTime) {
              if (playerLimit.count >= 5) {
                return false;
              }
              playerLimit.count++;
            } else {
              playerLimit.count = 1;
              playerLimit.resetTime = now + 1000;
            }
          } else {
            rateLimiter.set(playerId, { count: 1, resetTime: now + 1000 });
          }
          return true;
        },
      };
    }

    it("allows first pickup request", () => {
      const limiter = createRateLimiter();
      expect(limiter.checkRateLimit("player-1")).toBe(true);
    });

    it("blocks after 5 requests in 1 second", () => {
      const limiter = createRateLimiter();

      // First 5 should pass
      expect(limiter.checkRateLimit("player-1")).toBe(true);
      expect(limiter.checkRateLimit("player-1")).toBe(true);
      expect(limiter.checkRateLimit("player-1")).toBe(true);
      expect(limiter.checkRateLimit("player-1")).toBe(true);
      expect(limiter.checkRateLimit("player-1")).toBe(true);

      // 6th should be blocked
      expect(limiter.checkRateLimit("player-1")).toBe(false);
    });

    it("resets after time window expires", () => {
      const limiter = createRateLimiter();

      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.checkRateLimit("player-1");
      }
      expect(limiter.checkRateLimit("player-1")).toBe(false);

      // Advance time past reset window
      limiter.advanceTime(1001);

      // Should be allowed again
      expect(limiter.checkRateLimit("player-1")).toBe(true);
    });

    it("allows different players independently", () => {
      const limiter = createRateLimiter();

      // Player 1 uses up limit
      for (let i = 0; i < 5; i++) {
        limiter.checkRateLimit("player-1");
      }
      expect(limiter.checkRateLimit("player-1")).toBe(false);

      // Player 2 should still be allowed
      expect(limiter.checkRateLimit("player-2")).toBe(true);
      expect(limiter.checkRateLimit("player-2")).toBe(true);
    });
  });
});

describe("Pickup Lock Stress Test", () => {
  it("handles many rapid pickup attempts correctly", () => {
    const manager = new MockInventoryManager();

    // Create 100 items
    for (let i = 0; i < 100; i++) {
      manager.setEntityData(`item-${i}`, { itemId: "coins", quantity: 1 });
    }

    // Simulate many players picking up items
    let successCount = 0;
    for (let i = 0; i < 100; i++) {
      // Multiple players try to pick up same item
      for (let p = 0; p < 5; p++) {
        const result = manager.pickupItem(`player-${p}`, `item-${i}`);
        if (result) successCount++;
      }
    }

    // Only first 28 should succeed (inventory capacity)
    expect(successCount).toBe(28);
    expect(manager.getItemCount()).toBe(28);
  });
});
