/**
 * Coin Pouch Withdrawal Unit Tests
 *
 * Tests the coin pouch to inventory withdrawal logic.
 * Uses mock classes following existing codebase patterns.
 *
 * NOTE: Uses MockCoinPouchManager to test business logic without database.
 *
 * Coin Pouch System Overview:
 * - Money Pouch (characters.coins): Protected storage, no inventory slot
 * - Physical Coins (inventory itemId='coins'): Stackable item, uses slot
 *
 * This tests the withdrawal flow: pouch -> inventory
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Constants (mirror actual constants from @hyperforge/shared)
// ============================================================================

const MAX_COINS = 2147483647; // Max 32-bit signed integer (OSRS cap)
const MAX_INVENTORY_SLOTS = 28;

// ============================================================================
// Types
// ============================================================================

interface InventoryCoinsRow {
  slotIndex: number;
  quantity: number;
}

interface EmittedEvent {
  type: string;
  data: Record<string, unknown>;
}

interface ToastMessage {
  playerId: string;
  message: string;
  type: "success" | "error";
}

// ============================================================================
// Mock Coin Pouch Manager (coin logic between pouch and inventory)
// ============================================================================

class MockCoinPouchManager {
  // Money pouch balances (characters.coins)
  private pouchBalances = new Map<string, number>();

  // Inventory coins storage (inventory table with itemId='coins')
  private inventoryCoins = new Map<string, InventoryCoinsRow>();

  // Inventory slots used (for slot allocation)
  private usedInventorySlots = new Map<string, Set<number>>();

  // Events emitted
  private emittedEvents: EmittedEvent[] = [];

  // Toast messages sent
  private toastMessages: ToastMessage[] = [];

  // ========== Setup Helpers ==========

  setPouchBalance(playerId: string, coins: number): void {
    this.pouchBalances.set(playerId, Math.max(0, Math.min(coins, MAX_COINS)));
  }

  setInventoryCoins(playerId: string, coins: number, slot: number = 0): void {
    if (coins > 0) {
      this.inventoryCoins.set(playerId, { slotIndex: slot, quantity: coins });
      const slots = this.usedInventorySlots.get(playerId) || new Set();
      slots.add(slot);
      this.usedInventorySlots.set(playerId, slots);
    } else {
      this.inventoryCoins.delete(playerId);
    }
  }

  addUsedSlot(playerId: string, slot: number): void {
    const slots = this.usedInventorySlots.get(playerId) || new Set();
    slots.add(slot);
    this.usedInventorySlots.set(playerId, slots);
  }

  // ========== Core Operation ==========

  /**
   * Withdraw coins from money pouch to inventory
   * Mirrors the logic in handleCoinPouchWithdraw
   *
   * @param playerId - Player making the withdrawal
   * @param amount - Amount to withdraw
   * @returns Result object with success status and error if failed
   */
  withdrawToInventory(
    playerId: string,
    amount: number,
  ): { success: boolean; error?: string; newPouchBalance?: number } {
    // Input validation (mirrors isValidQuantity)
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    if (amount > MAX_COINS) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    // Check pouch balance
    const pouchBalance = this.pouchBalances.get(playerId) ?? 0;
    if (pouchBalance < amount) {
      return { success: false, error: "INSUFFICIENT_COINS" };
    }

    // Check inventory for existing coins stack
    const existingStack = this.inventoryCoins.get(playerId);

    if (existingStack) {
      // Check stack overflow (mirrors wouldOverflow)
      if (this.wouldOverflow(existingStack.quantity, amount)) {
        return { success: false, error: "STACK_OVERFLOW" };
      }

      // Add to existing stack
      existingStack.quantity += amount;
    } else {
      // Find empty slot
      const usedSlots = this.usedInventorySlots.get(playerId) || new Set();

      if (usedSlots.size >= MAX_INVENTORY_SLOTS) {
        return { success: false, error: "INVENTORY_FULL" };
      }

      let emptySlot = -1;
      for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
        if (!usedSlots.has(i)) {
          emptySlot = i;
          break;
        }
      }

      // Create new coins stack
      this.inventoryCoins.set(playerId, {
        slotIndex: emptySlot,
        quantity: amount,
      });
      usedSlots.add(emptySlot);
      this.usedInventorySlots.set(playerId, usedSlots);
    }

    // Deduct from pouch
    const newPouchBalance = pouchBalance - amount;
    this.pouchBalances.set(playerId, newPouchBalance);

    // Emit sync events
    this.emittedEvents.push({
      type: "INVENTORY_UPDATE_COINS",
      data: { playerId, coins: newPouchBalance },
    });

    this.toastMessages.push({
      playerId,
      message: `Withdrew ${amount.toLocaleString()} coins to inventory`,
      type: "success",
    });

    return { success: true, newPouchBalance };
  }

  // ========== Helper Methods ==========

  private wouldOverflow(current: number, add: number): boolean {
    return current > MAX_COINS - add;
  }

  // ========== Query Methods (for assertions) ==========

  getPouchBalance(playerId: string): number {
    return this.pouchBalances.get(playerId) ?? 0;
  }

  getInventoryCoins(playerId: string): number {
    return this.inventoryCoins.get(playerId)?.quantity ?? 0;
  }

  getInventoryCoinsSlot(playerId: string): number {
    return this.inventoryCoins.get(playerId)?.slotIndex ?? -1;
  }

  getUsedSlotCount(playerId: string): number {
    return this.usedInventorySlots.get(playerId)?.size ?? 0;
  }

  getEmittedEvents(): EmittedEvent[] {
    return [...this.emittedEvents];
  }

  getToastMessages(): ToastMessage[] {
    return [...this.toastMessages];
  }

  // ========== Reset ==========

  reset(): void {
    this.pouchBalances.clear();
    this.inventoryCoins.clear();
    this.usedInventorySlots.clear();
    this.emittedEvents = [];
    this.toastMessages = [];
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Coin Pouch Withdrawal", () => {
  let manager: MockCoinPouchManager;
  const playerId = "player-123";

  beforeEach(() => {
    manager = new MockCoinPouchManager();
    manager.reset();
  });

  // ==========================================================================
  // Input Validation
  // ==========================================================================

  describe("Input Validation", () => {
    it("should reject zero amount", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_AMOUNT");
      expect(manager.getPouchBalance(playerId)).toBe(1000); // Unchanged
    });

    it("should reject negative amount", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, -100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_AMOUNT");
      expect(manager.getPouchBalance(playerId)).toBe(1000); // Unchanged
    });

    it("should reject non-integer amount (float)", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, 100.5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_AMOUNT");
    });

    it("should reject NaN", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, NaN);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_AMOUNT");
    });

    it("should reject Infinity", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, Infinity);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_AMOUNT");
    });

    it("should reject amount exceeding MAX_COINS", () => {
      manager.setPouchBalance(playerId, MAX_COINS);

      const result = manager.withdrawToInventory(playerId, MAX_COINS + 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_AMOUNT");
    });
  });

  // ==========================================================================
  // Insufficient Coins
  // ==========================================================================

  describe("Insufficient Coins", () => {
    it("should reject when pouch has insufficient coins", () => {
      manager.setPouchBalance(playerId, 100);

      const result = manager.withdrawToInventory(playerId, 200);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_COINS");
      expect(manager.getPouchBalance(playerId)).toBe(100); // Unchanged
      expect(manager.getInventoryCoins(playerId)).toBe(0); // No coins added
    });

    it("should reject when pouch is empty", () => {
      manager.setPouchBalance(playerId, 0);

      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_COINS");
    });

    it("should reject when player has no pouch entry", () => {
      // No setPouchBalance called - player doesn't exist in map

      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INSUFFICIENT_COINS");
    });
  });

  // ==========================================================================
  // Successful Withdrawal - New Stack
  // ==========================================================================

  describe("Successful Withdrawal - New Stack", () => {
    it("should create new coins stack in empty inventory", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, 500);

      expect(result.success).toBe(true);
      expect(result.newPouchBalance).toBe(500);
      expect(manager.getPouchBalance(playerId)).toBe(500);
      expect(manager.getInventoryCoins(playerId)).toBe(500);
    });

    it("should place coins in first available slot (slot 0)", () => {
      manager.setPouchBalance(playerId, 1000);

      manager.withdrawToInventory(playerId, 100);

      expect(manager.getInventoryCoinsSlot(playerId)).toBe(0);
    });

    it("should skip used slots and find first empty", () => {
      manager.setPouchBalance(playerId, 1000);
      // Mark slots 0, 1, 2 as used
      manager.addUsedSlot(playerId, 0);
      manager.addUsedSlot(playerId, 1);
      manager.addUsedSlot(playerId, 2);

      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(true);
      expect(manager.getInventoryCoinsSlot(playerId)).toBe(3);
    });

    it("should withdraw exact amount requested", () => {
      manager.setPouchBalance(playerId, 1000);

      const result = manager.withdrawToInventory(playerId, 1000);

      expect(result.success).toBe(true);
      expect(manager.getPouchBalance(playerId)).toBe(0);
      expect(manager.getInventoryCoins(playerId)).toBe(1000);
    });

    it("should emit INVENTORY_UPDATE_COINS event", () => {
      manager.setPouchBalance(playerId, 1000);

      manager.withdrawToInventory(playerId, 500);

      const events = manager.getEmittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("INVENTORY_UPDATE_COINS");
      expect(events[0].data).toEqual({ playerId, coins: 500 });
    });

    it("should send success toast message", () => {
      manager.setPouchBalance(playerId, 1000);

      manager.withdrawToInventory(playerId, 500);

      const toasts = manager.getToastMessages();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe("success");
      expect(toasts[0].message).toContain("500");
    });
  });

  // ==========================================================================
  // Successful Withdrawal - Existing Stack
  // ==========================================================================

  describe("Successful Withdrawal - Existing Stack", () => {
    it("should add to existing coins stack", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, 500, 5);

      const result = manager.withdrawToInventory(playerId, 300);

      expect(result.success).toBe(true);
      expect(manager.getPouchBalance(playerId)).toBe(700);
      expect(manager.getInventoryCoins(playerId)).toBe(800); // 500 + 300
    });

    it("should not change slot when adding to existing stack", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, 500, 10);

      manager.withdrawToInventory(playerId, 300);

      expect(manager.getInventoryCoinsSlot(playerId)).toBe(10); // Same slot
    });

    it("should not use additional inventory slots", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, 500, 5);
      const initialSlotCount = manager.getUsedSlotCount(playerId);

      manager.withdrawToInventory(playerId, 300);

      expect(manager.getUsedSlotCount(playerId)).toBe(initialSlotCount);
    });
  });

  // ==========================================================================
  // Inventory Full
  // ==========================================================================

  describe("Inventory Full", () => {
    it("should reject when inventory is full (no existing coins)", () => {
      manager.setPouchBalance(playerId, 1000);

      // Fill all 28 slots with other items
      for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
        manager.addUsedSlot(playerId, i);
      }

      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVENTORY_FULL");
      expect(manager.getPouchBalance(playerId)).toBe(1000); // Unchanged
    });

    it("should succeed when inventory full but has existing coins stack", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, 500, 15);

      // Fill remaining 27 slots
      for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
        if (i !== 15) {
          manager.addUsedSlot(playerId, i);
        }
      }

      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(true);
      expect(manager.getInventoryCoins(playerId)).toBe(600);
    });
  });

  // ==========================================================================
  // Stack Overflow
  // ==========================================================================

  describe("Stack Overflow", () => {
    it("should reject when addition would overflow MAX_COINS", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, MAX_COINS - 500, 0);

      const result = manager.withdrawToInventory(playerId, 600);

      expect(result.success).toBe(false);
      expect(result.error).toBe("STACK_OVERFLOW");
      expect(manager.getInventoryCoins(playerId)).toBe(MAX_COINS - 500); // Unchanged
      expect(manager.getPouchBalance(playerId)).toBe(1000); // Unchanged
    });

    it("should allow withdrawal up to exactly MAX_COINS", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, MAX_COINS - 500, 0);

      const result = manager.withdrawToInventory(playerId, 500);

      expect(result.success).toBe(true);
      expect(manager.getInventoryCoins(playerId)).toBe(MAX_COINS);
    });

    it("should reject at boundary (MAX_COINS + 1)", () => {
      manager.setPouchBalance(playerId, 100);
      manager.setInventoryCoins(playerId, MAX_COINS - 99, 0);

      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("STACK_OVERFLOW");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle withdrawal of 1 coin", () => {
      manager.setPouchBalance(playerId, 100);

      const result = manager.withdrawToInventory(playerId, 1);

      expect(result.success).toBe(true);
      expect(manager.getPouchBalance(playerId)).toBe(99);
      expect(manager.getInventoryCoins(playerId)).toBe(1);
    });

    it("should handle withdrawal of MAX_COINS from full pouch", () => {
      manager.setPouchBalance(playerId, MAX_COINS);

      const result = manager.withdrawToInventory(playerId, MAX_COINS);

      expect(result.success).toBe(true);
      expect(manager.getPouchBalance(playerId)).toBe(0);
      expect(manager.getInventoryCoins(playerId)).toBe(MAX_COINS);
    });

    it("should handle multiple withdrawals correctly", () => {
      manager.setPouchBalance(playerId, 1000);

      manager.withdrawToInventory(playerId, 100);
      manager.withdrawToInventory(playerId, 200);
      manager.withdrawToInventory(playerId, 300);

      expect(manager.getPouchBalance(playerId)).toBe(400);
      expect(manager.getInventoryCoins(playerId)).toBe(600);
    });

    it("should work with different player IDs independently", () => {
      const player1 = "player-1";
      const player2 = "player-2";

      manager.setPouchBalance(player1, 1000);
      manager.setPouchBalance(player2, 2000);

      manager.withdrawToInventory(player1, 500);
      manager.withdrawToInventory(player2, 800);

      expect(manager.getPouchBalance(player1)).toBe(500);
      expect(manager.getPouchBalance(player2)).toBe(1200);
      expect(manager.getInventoryCoins(player1)).toBe(500);
      expect(manager.getInventoryCoins(player2)).toBe(800);
    });
  });

  // ==========================================================================
  // Atomicity (simulated - real atomicity is DB-level)
  // ==========================================================================

  describe("Atomicity Simulation", () => {
    it("should not modify pouch if inventory operation fails", () => {
      manager.setPouchBalance(playerId, 1000);
      manager.setInventoryCoins(playerId, MAX_COINS - 100, 0);

      // This should fail due to stack overflow
      const result = manager.withdrawToInventory(playerId, 200);

      expect(result.success).toBe(false);
      // Both should be unchanged
      expect(manager.getPouchBalance(playerId)).toBe(1000);
      expect(manager.getInventoryCoins(playerId)).toBe(MAX_COINS - 100);
    });

    it("should not modify inventory if pouch check fails", () => {
      manager.setPouchBalance(playerId, 50);
      manager.setInventoryCoins(playerId, 100, 0);

      // This should fail due to insufficient coins
      const result = manager.withdrawToInventory(playerId, 100);

      expect(result.success).toBe(false);
      // Both should be unchanged
      expect(manager.getPouchBalance(playerId)).toBe(50);
      expect(manager.getInventoryCoins(playerId)).toBe(100);
    });
  });
});

// ============================================================================
// Input Validation Function Tests (mirrors InputValidation.ts)
// ============================================================================

describe("Input Validation Helpers", () => {
  describe("isValidQuantity (logic mirror)", () => {
    const isValidQuantity = (value: unknown): value is number => {
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value > 0 &&
        value <= MAX_COINS
      );
    };

    it("should accept valid integers", () => {
      expect(isValidQuantity(1)).toBe(true);
      expect(isValidQuantity(100)).toBe(true);
      expect(isValidQuantity(MAX_COINS)).toBe(true);
    });

    it("should reject invalid values", () => {
      expect(isValidQuantity(0)).toBe(false);
      expect(isValidQuantity(-1)).toBe(false);
      expect(isValidQuantity(1.5)).toBe(false);
      expect(isValidQuantity(NaN)).toBe(false);
      expect(isValidQuantity(Infinity)).toBe(false);
      expect(isValidQuantity(MAX_COINS + 1)).toBe(false);
      expect(isValidQuantity("100")).toBe(false);
      expect(isValidQuantity(null)).toBe(false);
      expect(isValidQuantity(undefined)).toBe(false);
    });
  });

  describe("wouldOverflow (logic mirror)", () => {
    const wouldOverflow = (current: number, add: number): boolean => {
      return current > MAX_COINS - add;
    };

    it("should detect overflow correctly", () => {
      expect(wouldOverflow(MAX_COINS - 100, 101)).toBe(true);
      expect(wouldOverflow(MAX_COINS - 100, 100)).toBe(false);
      expect(wouldOverflow(0, MAX_COINS)).toBe(false);
      expect(wouldOverflow(1, MAX_COINS)).toBe(true);
    });
  });
});
