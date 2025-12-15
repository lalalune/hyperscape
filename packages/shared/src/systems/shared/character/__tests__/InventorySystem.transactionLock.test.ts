/**
 * InventorySystem Transaction Lock Tests
 *
 * Tests the Lock + Flush + Transaction + Reload pattern:
 * - Transaction lock acquisition and release
 * - Pickup blocking during lock
 * - Auto-save skip during lock
 * - Lock contention handling
 *
 * NOTE: Uses mocked system logic to avoid circular dependency issues.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
}

// ============================================================================
// Mock Inventory System (transaction lock logic)
// ============================================================================

class MockInventorySystemWithLocks {
  private items = new Map<number, InventoryItem>();
  private transactionLocks = new Set<string>();
  private persistTimers = new Map<string, NodeJS.Timeout>();
  private readonly MAX_SLOTS = 28;

  // Track events for testing
  private toastEvents: Array<{ playerId: string; message: string }> = [];
  private autoSaveSkipped: string[] = [];
  private persistedPlayers: string[] = [];

  // ========== Transaction Lock API ==========

  lockForTransaction(playerId: string): boolean {
    if (this.transactionLocks.has(playerId)) {
      return false;
    }

    this.transactionLocks.add(playerId);

    // Cancel any pending debounced save
    const existing = this.persistTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
      this.persistTimers.delete(playerId);
    }

    return true;
  }

  unlockTransaction(playerId: string): void {
    this.transactionLocks.delete(playerId);
  }

  isLockedForTransaction(playerId: string): boolean {
    return this.transactionLocks.has(playerId);
  }

  // ========== Item Operations ==========

  addItem(playerId: string, itemId: string, quantity: number): boolean {
    // CRITICAL: Reject adds during transaction lock
    if (this.transactionLocks.has(playerId)) {
      this.toastEvents.push({
        playerId,
        message: "Close bank/store first to pick up items",
      });
      return false;
    }

    // Find empty slot
    for (let slot = 0; slot < this.MAX_SLOTS; slot++) {
      if (!this.items.has(slot)) {
        this.items.set(slot, { itemId, quantity, slot });
        this.schedulePersist(playerId);
        return true;
      }
    }
    return false;
  }

  // ========== Persistence ==========

  schedulePersist(playerId: string): void {
    const existing = this.persistTimers.get(playerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.persist(playerId);
    }, 300);
    this.persistTimers.set(playerId, timer);
  }

  persist(playerId: string): void {
    this.persistedPlayers.push(playerId);
  }

  async performAutoSave(playerIds: string[]): Promise<void> {
    for (const playerId of playerIds) {
      // Skip players locked for transaction
      if (this.transactionLocks.has(playerId)) {
        this.autoSaveSkipped.push(playerId);
        continue;
      }
      this.persist(playerId);
    }
  }

  // ========== Test Helpers ==========

  getToastEvents(): Array<{ playerId: string; message: string }> {
    return [...this.toastEvents];
  }

  getAutoSaveSkipped(): string[] {
    return [...this.autoSaveSkipped];
  }

  getPersistedPlayers(): string[] {
    return [...this.persistedPlayers];
  }

  getItemCount(): number {
    return this.items.size;
  }

  hasPendingPersist(playerId: string): boolean {
    return this.persistTimers.has(playerId);
  }

  clearTimers(): void {
    for (const timer of this.persistTimers.values()) {
      clearTimeout(timer);
    }
    this.persistTimers.clear();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("InventorySystem Transaction Lock", () => {
  let system: MockInventorySystemWithLocks;

  beforeEach(() => {
    system = new MockInventorySystemWithLocks();
  });

  afterEach(() => {
    system.clearTimers();
  });

  describe("Lock Acquisition", () => {
    it("acquires lock successfully when not locked", () => {
      const result = system.lockForTransaction("player-1");

      expect(result).toBe(true);
      expect(system.isLockedForTransaction("player-1")).toBe(true);
    });

    it("fails to acquire lock when already locked", () => {
      system.lockForTransaction("player-1");

      const result = system.lockForTransaction("player-1");

      expect(result).toBe(false);
    });

    it("allows different players to lock independently", () => {
      const result1 = system.lockForTransaction("player-1");
      const result2 = system.lockForTransaction("player-2");

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(system.isLockedForTransaction("player-1")).toBe(true);
      expect(system.isLockedForTransaction("player-2")).toBe(true);
    });

    it("releases lock correctly", () => {
      system.lockForTransaction("player-1");
      expect(system.isLockedForTransaction("player-1")).toBe(true);

      system.unlockTransaction("player-1");

      expect(system.isLockedForTransaction("player-1")).toBe(false);
    });

    it("allows re-acquiring lock after release", () => {
      system.lockForTransaction("player-1");
      system.unlockTransaction("player-1");

      const result = system.lockForTransaction("player-1");

      expect(result).toBe(true);
    });
  });

  describe("Lock Cancels Pending Persist", () => {
    it("cancels pending debounced save when lock acquired", () => {
      // Schedule a persist
      system.addItem("player-1", "coins", 100);
      expect(system.hasPendingPersist("player-1")).toBe(true);

      // Acquire lock
      system.lockForTransaction("player-1");

      // Pending persist should be cancelled
      expect(system.hasPendingPersist("player-1")).toBe(false);
    });
  });

  describe("Pickup Blocking During Lock", () => {
    it("blocks addItem when player is locked", () => {
      system.lockForTransaction("player-1");

      const result = system.addItem("player-1", "coins", 100);

      expect(result).toBe(false);
      expect(system.getItemCount()).toBe(0);
    });

    it("emits toast when pickup blocked by lock", () => {
      system.lockForTransaction("player-1");

      system.addItem("player-1", "coins", 100);

      const toasts = system.getToastEvents();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].playerId).toBe("player-1");
      expect(toasts[0].message).toContain("Close bank/store");
    });

    it("allows addItem when player is not locked", () => {
      const result = system.addItem("player-1", "coins", 100);

      expect(result).toBe(true);
      expect(system.getItemCount()).toBe(1);
    });

    it("allows addItem after lock is released", () => {
      system.lockForTransaction("player-1");
      system.unlockTransaction("player-1");

      const result = system.addItem("player-1", "coins", 100);

      expect(result).toBe(true);
    });

    it("blocks addItem for locked player but allows for unlocked player", () => {
      system.lockForTransaction("player-1");

      const result1 = system.addItem("player-1", "coins", 100);
      const result2 = system.addItem("player-2", "coins", 100);

      expect(result1).toBe(false);
      expect(result2).toBe(true);
      expect(system.getItemCount()).toBe(1);
    });
  });

  describe("Auto-Save Skip During Lock", () => {
    it("skips locked players during auto-save", async () => {
      system.lockForTransaction("player-1");

      await system.performAutoSave(["player-1", "player-2"]);

      const skipped = system.getAutoSaveSkipped();
      expect(skipped).toContain("player-1");
      expect(skipped).not.toContain("player-2");
    });

    it("saves unlocked players during auto-save", async () => {
      system.lockForTransaction("player-1");

      await system.performAutoSave(["player-1", "player-2"]);

      const persisted = system.getPersistedPlayers();
      expect(persisted).toContain("player-2");
      expect(persisted).not.toContain("player-1");
    });

    it("saves player after lock is released", async () => {
      system.lockForTransaction("player-1");
      system.unlockTransaction("player-1");

      await system.performAutoSave(["player-1"]);

      const persisted = system.getPersistedPlayers();
      expect(persisted).toContain("player-1");
    });
  });
});

describe("executeInventoryTransaction Pattern", () => {
  /**
   * Simulates the Lock + Flush + Transaction + Reload pattern
   */
  async function executeInventoryTransaction<T>(
    system: MockInventorySystemWithLocks,
    playerId: string,
    operation: () => Promise<T>,
    reload: () => Promise<void>,
    flush: () => Promise<void>,
  ): Promise<T | null> {
    // Step 1: LOCK
    const locked = system.lockForTransaction(playerId);
    if (!locked) {
      return null;
    }

    try {
      // Step 2: FLUSH
      await flush();

      // Step 3: EXECUTE
      const result = await operation();

      // Step 4: RELOAD
      await reload();

      return result;
    } finally {
      // Step 5: UNLOCK (always)
      system.unlockTransaction(playerId);
    }
  }

  it("executes full lock-flush-transaction-reload-unlock cycle", async () => {
    const system = new MockInventorySystemWithLocks();
    const events: string[] = [];

    const result = await executeInventoryTransaction(
      system,
      "player-1",
      async () => {
        events.push("execute");
        return { success: true };
      },
      async () => {
        events.push("reload");
      },
      async () => {
        events.push("flush");
      },
    );

    expect(result).toEqual({ success: true });
    expect(events).toEqual(["flush", "execute", "reload"]);
    expect(system.isLockedForTransaction("player-1")).toBe(false);
  });

  it("releases lock even on error", async () => {
    const system = new MockInventorySystemWithLocks();

    await expect(
      executeInventoryTransaction(
        system,
        "player-1",
        async () => {
          throw new Error("Transaction failed");
        },
        async () => {},
        async () => {},
      ),
    ).rejects.toThrow("Transaction failed");

    // Lock should still be released
    expect(system.isLockedForTransaction("player-1")).toBe(false);
  });

  it("returns null if lock already held", async () => {
    const system = new MockInventorySystemWithLocks();
    system.lockForTransaction("player-1");

    const result = await executeInventoryTransaction(
      system,
      "player-1",
      async () => ({ success: true }),
      async () => {},
      async () => {},
    );

    expect(result).toBeNull();
  });

  it("blocks pickups during transaction", async () => {
    const system = new MockInventorySystemWithLocks();
    let pickupAttempted = false;

    await executeInventoryTransaction(
      system,
      "player-1",
      async () => {
        // Try to pickup during transaction
        const result = system.addItem("player-1", "coins", 100);
        pickupAttempted = true;
        expect(result).toBe(false);
        return { success: true };
      },
      async () => {},
      async () => {},
    );

    expect(pickupAttempted).toBe(true);
    expect(system.getItemCount()).toBe(0);
  });

  it("allows pickups after transaction completes", async () => {
    const system = new MockInventorySystemWithLocks();

    await executeInventoryTransaction(
      system,
      "player-1",
      async () => ({ success: true }),
      async () => {},
      async () => {},
    );

    const result = system.addItem("player-1", "coins", 100);
    expect(result).toBe(true);
    expect(system.getItemCount()).toBe(1);

    system.clearTimers();
  });
});

describe("Concurrent Operation Handling", () => {
  it("serializes concurrent bank operations from same player", async () => {
    const system = new MockInventorySystemWithLocks();
    const results: (boolean | null)[] = [];

    // Simulate two concurrent bank operations
    const op1 = (async () => {
      const locked = system.lockForTransaction("player-1");
      if (!locked) {
        results.push(null);
        return;
      }
      await new Promise((r) => setTimeout(r, 10)); // Simulate work
      system.unlockTransaction("player-1");
      results.push(true);
    })();

    const op2 = (async () => {
      await new Promise((r) => setTimeout(r, 1)); // Slight delay
      const locked = system.lockForTransaction("player-1");
      if (!locked) {
        results.push(null);
        return;
      }
      await new Promise((r) => setTimeout(r, 10));
      system.unlockTransaction("player-1");
      results.push(true);
    })();

    await Promise.all([op1, op2]);

    // One should succeed, one should fail (null)
    expect(results).toContain(true);
    expect(results).toContain(null);
  });

  it("allows concurrent operations from different players", async () => {
    const system = new MockInventorySystemWithLocks();
    const results: boolean[] = [];

    const op1 = (async () => {
      const locked = system.lockForTransaction("player-1");
      expect(locked).toBe(true);
      await new Promise((r) => setTimeout(r, 10));
      system.unlockTransaction("player-1");
      results.push(true);
    })();

    const op2 = (async () => {
      const locked = system.lockForTransaction("player-2");
      expect(locked).toBe(true);
      await new Promise((r) => setTimeout(r, 10));
      system.unlockTransaction("player-2");
      results.push(true);
    })();

    await Promise.all([op1, op2]);

    expect(results).toEqual([true, true]);
  });
});

describe("Edge Cases", () => {
  it("handles unlock of never-locked player gracefully", () => {
    const system = new MockInventorySystemWithLocks();

    // Should not throw
    expect(() => system.unlockTransaction("player-1")).not.toThrow();
    expect(system.isLockedForTransaction("player-1")).toBe(false);
  });

  it("handles multiple unlocks gracefully", () => {
    const system = new MockInventorySystemWithLocks();
    system.lockForTransaction("player-1");

    system.unlockTransaction("player-1");
    system.unlockTransaction("player-1");
    system.unlockTransaction("player-1");

    expect(system.isLockedForTransaction("player-1")).toBe(false);
  });
});
