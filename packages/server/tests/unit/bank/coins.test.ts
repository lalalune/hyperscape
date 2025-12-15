/**
 * Bank Coin Handler Unit Tests
 *
 * Tests the coin deposit/withdraw logic between money pouch and bank.
 * Uses mock classes following the existing codebase pattern.
 *
 * NOTE: Uses MockCoinBankManager to test business logic without database.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Constants (mirror actual constants)
// ============================================================================

const MAX_COINS = 2147483647; // Max 32-bit signed integer (OSRS cap)
const MAX_BANK_SLOTS = 1200;

// ============================================================================
// Types
// ============================================================================

interface BankCoinRow {
  id: number;
  playerId: string;
  itemId: "coins";
  quantity: number;
  slot: number;
}

interface EmittedEvent {
  type: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Mock Coin Bank Manager (coin logic between pouch and bank)
// ============================================================================

class MockCoinBankManager {
  // Money pouch (in-memory)
  private pouchBalances = new Map<string, number>();

  // Bank coins storage
  private bankCoins = new Map<string, BankCoinRow>();

  // Bank slots used (for slot allocation)
  private usedBankSlots = new Map<string, Set<number>>();

  // Events emitted
  private emittedEvents: EmittedEvent[] = [];

  // Toast messages sent
  private toastMessages: Array<{
    playerId: string;
    message: string;
    type: string;
  }> = [];

  // ========== Setup Helpers ==========

  setPouchBalance(playerId: string, coins: number): void {
    this.pouchBalances.set(playerId, Math.max(0, Math.min(coins, MAX_COINS)));
  }

  setBankCoins(playerId: string, coins: number, slot: number = 0): void {
    if (coins > 0) {
      this.bankCoins.set(playerId, {
        id: Math.floor(Math.random() * 10000),
        playerId,
        itemId: "coins",
        quantity: coins,
        slot,
      });
      const slots = this.usedBankSlots.get(playerId) || new Set();
      slots.add(slot);
      this.usedBankSlots.set(playerId, slots);
    } else {
      this.bankCoins.delete(playerId);
    }
  }

  addUsedSlot(playerId: string, slot: number): void {
    const slots = this.usedBankSlots.get(playerId) || new Set();
    slots.add(slot);
    this.usedBankSlots.set(playerId, slots);
  }

  // ========== Core Operations ==========

  /**
   * Deposit coins from money pouch to bank
   * @returns Result object with success status and error if failed
   */
  depositCoins(
    playerId: string,
    amount: number,
  ): { success: boolean; error?: string; newPouchBalance?: number } {
    // Input validation
    if (amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    if (amount > MAX_COINS) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    // Check pouch balance
    const pouchBalance = this.pouchBalances.get(playerId) ?? 0;
    if (pouchBalance < amount) {
      return { success: false, error: "INSUFFICIENT_POUCH_COINS" };
    }

    // Check bank overflow
    const bankRow = this.bankCoins.get(playerId);
    const currentBankCoins = bankRow?.quantity ?? 0;

    if (this.wouldOverflow(currentBankCoins, amount)) {
      return { success: false, error: "QUANTITY_OVERFLOW" };
    }

    // Check bank slot availability if no existing coins
    if (!bankRow) {
      const usedSlots = this.usedBankSlots.get(playerId) || new Set();
      if (usedSlots.size >= MAX_BANK_SLOTS) {
        return { success: false, error: "BANK_FULL" };
      }
    }

    // Execute deposit
    const newPouchBalance = pouchBalance - amount;
    this.pouchBalances.set(playerId, newPouchBalance);

    if (bankRow) {
      // Add to existing
      bankRow.quantity += amount;
    } else {
      // Create new bank row
      const usedSlots = this.usedBankSlots.get(playerId) || new Set();
      let nextSlot = 0;
      while (usedSlots.has(nextSlot) && nextSlot < MAX_BANK_SLOTS) {
        nextSlot++;
      }

      this.bankCoins.set(playerId, {
        id: Math.floor(Math.random() * 10000),
        playerId,
        itemId: "coins",
        quantity: amount,
        slot: nextSlot,
      });
      usedSlots.add(nextSlot);
      this.usedBankSlots.set(playerId, usedSlots);
    }

    // Emit sync event
    this.emittedEvents.push({
      type: "INVENTORY_UPDATE_COINS",
      data: { playerId, coins: newPouchBalance },
    });

    this.toastMessages.push({
      playerId,
      message: `Deposited ${amount.toLocaleString()} coins`,
      type: "success",
    });

    return { success: true, newPouchBalance };
  }

  /**
   * Withdraw coins from bank to money pouch
   * @returns Result object with success status and error if failed
   */
  withdrawCoins(
    playerId: string,
    amount: number,
  ): { success: boolean; error?: string; newPouchBalance?: number } {
    // Input validation
    if (amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    if (amount > MAX_COINS) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    // Check bank balance
    const bankRow = this.bankCoins.get(playerId);
    if (!bankRow) {
      return { success: false, error: "NO_COINS_IN_BANK" };
    }

    const bankBalance = bankRow.quantity;
    if (bankBalance < amount) {
      return { success: false, error: "INSUFFICIENT_BANK_COINS" };
    }

    // Check pouch overflow
    const pouchBalance = this.pouchBalances.get(playerId) ?? 0;
    if (this.wouldOverflow(pouchBalance, amount)) {
      return { success: false, error: "COIN_OVERFLOW" };
    }

    // Execute withdrawal
    const newBankBalance = bankBalance - amount;

    if (newBankBalance === 0) {
      // Remove bank row entirely
      const slot = bankRow.slot;
      this.bankCoins.delete(playerId);

      // Remove from used slots
      const usedSlots = this.usedBankSlots.get(playerId);
      if (usedSlots) {
        usedSlots.delete(slot);
      }
    } else {
      bankRow.quantity = newBankBalance;
    }

    // Add to pouch
    const newPouchBalance = pouchBalance + amount;
    this.pouchBalances.set(playerId, newPouchBalance);

    // Emit sync event
    this.emittedEvents.push({
      type: "INVENTORY_UPDATE_COINS",
      data: { playerId, coins: newPouchBalance },
    });

    this.toastMessages.push({
      playerId,
      message: `Withdrew ${amount.toLocaleString()} coins`,
      type: "success",
    });

    return { success: true, newPouchBalance };
  }

  // ========== Helper Methods ==========

  private wouldOverflow(current: number, add: number): boolean {
    return current + add > MAX_COINS;
  }

  // ========== Query Methods ==========

  getPouchBalance(playerId: string): number {
    return this.pouchBalances.get(playerId) ?? 0;
  }

  getBankCoins(playerId: string): number {
    return this.bankCoins.get(playerId)?.quantity ?? 0;
  }

  getBankCoinSlot(playerId: string): number | null {
    return this.bankCoins.get(playerId)?.slot ?? null;
  }

  getEmittedEvents(): EmittedEvent[] {
    return [...this.emittedEvents];
  }

  getToastMessages(): Array<{
    playerId: string;
    message: string;
    type: string;
  }> {
    return [...this.toastMessages];
  }

  // ========== Reset ==========

  reset(): void {
    this.pouchBalances.clear();
    this.bankCoins.clear();
    this.usedBankSlots.clear();
    this.emittedEvents = [];
    this.toastMessages = [];
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Bank Coin Handlers", () => {
  let manager: MockCoinBankManager;

  beforeEach(() => {
    manager = new MockCoinBankManager();
    manager.reset();
  });

  describe("depositCoins", () => {
    describe("Success Cases", () => {
      it("deposits coins from pouch to new bank slot", () => {
        manager.setPouchBalance("player-1", 1000);

        const result = manager.depositCoins("player-1", 500);

        expect(result.success).toBe(true);
        expect(result.newPouchBalance).toBe(500);
        expect(manager.getPouchBalance("player-1")).toBe(500);
        expect(manager.getBankCoins("player-1")).toBe(500);
      });

      it("deposits coins to existing bank coins (stacks)", () => {
        manager.setPouchBalance("player-1", 1000);
        manager.setBankCoins("player-1", 500);

        const result = manager.depositCoins("player-1", 300);

        expect(result.success).toBe(true);
        expect(manager.getPouchBalance("player-1")).toBe(700);
        expect(manager.getBankCoins("player-1")).toBe(800); // 500 + 300
      });

      it("deposits exact pouch balance", () => {
        manager.setPouchBalance("player-1", 1000);

        const result = manager.depositCoins("player-1", 1000);

        expect(result.success).toBe(true);
        expect(manager.getPouchBalance("player-1")).toBe(0);
        expect(manager.getBankCoins("player-1")).toBe(1000);
      });

      it("deposits small amount (1 coin)", () => {
        manager.setPouchBalance("player-1", 100);

        const result = manager.depositCoins("player-1", 1);

        expect(result.success).toBe(true);
        expect(manager.getPouchBalance("player-1")).toBe(99);
        expect(manager.getBankCoins("player-1")).toBe(1);
      });

      it("emits coin sync event after deposit", () => {
        manager.setPouchBalance("player-1", 1000);

        manager.depositCoins("player-1", 500);

        const events = manager.getEmittedEvents();
        expect(events.length).toBe(1);
        expect(events[0].type).toBe("INVENTORY_UPDATE_COINS");
        expect(events[0].data.playerId).toBe("player-1");
        expect(events[0].data.coins).toBe(500);
      });

      it("shows success toast after deposit", () => {
        manager.setPouchBalance("player-1", 1000);

        manager.depositCoins("player-1", 500);

        const toasts = manager.getToastMessages();
        expect(toasts.length).toBe(1);
        expect(toasts[0].type).toBe("success");
        expect(toasts[0].message).toContain("500");
      });
    });

    describe("Insufficient Funds", () => {
      it("fails when pouch balance is less than amount", () => {
        manager.setPouchBalance("player-1", 100);

        const result = manager.depositCoins("player-1", 500);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INSUFFICIENT_POUCH_COINS");
        expect(manager.getPouchBalance("player-1")).toBe(100); // Unchanged
        expect(manager.getBankCoins("player-1")).toBe(0); // Unchanged
      });

      it("fails when pouch is empty", () => {
        manager.setPouchBalance("player-1", 0);

        const result = manager.depositCoins("player-1", 1);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INSUFFICIENT_POUCH_COINS");
      });
    });

    describe("Overflow Protection", () => {
      it("fails when deposit would overflow bank coins", () => {
        manager.setPouchBalance("player-1", 1000);
        manager.setBankCoins("player-1", MAX_COINS - 500);

        const result = manager.depositCoins("player-1", 600);

        expect(result.success).toBe(false);
        expect(result.error).toBe("QUANTITY_OVERFLOW");
        expect(manager.getPouchBalance("player-1")).toBe(1000); // Unchanged
        expect(manager.getBankCoins("player-1")).toBe(MAX_COINS - 500); // Unchanged
      });

      it("succeeds at exactly max coins limit", () => {
        manager.setPouchBalance("player-1", 500);
        manager.setBankCoins("player-1", MAX_COINS - 500);

        const result = manager.depositCoins("player-1", 500);

        expect(result.success).toBe(true);
        expect(manager.getBankCoins("player-1")).toBe(MAX_COINS);
      });
    });

    describe("Bank Full", () => {
      it("fails when bank is full and no existing coins", () => {
        manager.setPouchBalance("player-1", 1000);

        // Fill all bank slots
        for (let i = 0; i < MAX_BANK_SLOTS; i++) {
          manager.addUsedSlot("player-1", i);
        }

        const result = manager.depositCoins("player-1", 500);

        expect(result.success).toBe(false);
        expect(result.error).toBe("BANK_FULL");
      });

      it("succeeds when bank is full but coins already exist", () => {
        manager.setPouchBalance("player-1", 1000);
        manager.setBankCoins("player-1", 500, 0);

        // Fill remaining slots
        for (let i = 1; i < MAX_BANK_SLOTS; i++) {
          manager.addUsedSlot("player-1", i);
        }

        const result = manager.depositCoins("player-1", 200);

        expect(result.success).toBe(true);
        expect(manager.getBankCoins("player-1")).toBe(700);
      });
    });

    describe("Input Validation", () => {
      it("fails for zero amount", () => {
        manager.setPouchBalance("player-1", 1000);

        const result = manager.depositCoins("player-1", 0);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });

      it("fails for negative amount", () => {
        manager.setPouchBalance("player-1", 1000);

        const result = manager.depositCoins("player-1", -100);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });

      it("fails for non-integer amount", () => {
        manager.setPouchBalance("player-1", 1000);

        const result = manager.depositCoins("player-1", 50.5);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });

      it("fails for amount exceeding MAX_COINS", () => {
        manager.setPouchBalance("player-1", MAX_COINS);

        const result = manager.depositCoins("player-1", MAX_COINS + 1);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });
    });
  });

  describe("withdrawCoins", () => {
    describe("Success Cases", () => {
      it("withdraws coins from bank to pouch", () => {
        manager.setPouchBalance("player-1", 100);
        manager.setBankCoins("player-1", 1000);

        const result = manager.withdrawCoins("player-1", 500);

        expect(result.success).toBe(true);
        expect(result.newPouchBalance).toBe(600);
        expect(manager.getPouchBalance("player-1")).toBe(600);
        expect(manager.getBankCoins("player-1")).toBe(500);
      });

      it("withdraws all coins from bank", () => {
        manager.setPouchBalance("player-1", 100);
        manager.setBankCoins("player-1", 500);

        const result = manager.withdrawCoins("player-1", 500);

        expect(result.success).toBe(true);
        expect(manager.getPouchBalance("player-1")).toBe(600);
        expect(manager.getBankCoins("player-1")).toBe(0);
      });

      it("removes bank row when withdrawing all coins", () => {
        manager.setPouchBalance("player-1", 0);
        manager.setBankCoins("player-1", 1000, 5);

        manager.withdrawCoins("player-1", 1000);

        expect(manager.getBankCoinSlot("player-1")).toBe(null);
      });

      it("withdraws small amount (1 coin)", () => {
        manager.setPouchBalance("player-1", 0);
        manager.setBankCoins("player-1", 100);

        const result = manager.withdrawCoins("player-1", 1);

        expect(result.success).toBe(true);
        expect(manager.getPouchBalance("player-1")).toBe(1);
        expect(manager.getBankCoins("player-1")).toBe(99);
      });

      it("emits coin sync event after withdrawal", () => {
        manager.setPouchBalance("player-1", 100);
        manager.setBankCoins("player-1", 500);

        manager.withdrawCoins("player-1", 200);

        const events = manager.getEmittedEvents();
        expect(events.length).toBe(1);
        expect(events[0].type).toBe("INVENTORY_UPDATE_COINS");
        expect(events[0].data.coins).toBe(300);
      });

      it("shows success toast after withdrawal", () => {
        manager.setPouchBalance("player-1", 0);
        manager.setBankCoins("player-1", 1000);

        manager.withdrawCoins("player-1", 500);

        const toasts = manager.getToastMessages();
        expect(toasts.length).toBe(1);
        expect(toasts[0].type).toBe("success");
        expect(toasts[0].message).toContain("500");
      });
    });

    describe("No Coins in Bank", () => {
      it("fails when no coins in bank", () => {
        manager.setPouchBalance("player-1", 100);
        // No bank coins set

        const result = manager.withdrawCoins("player-1", 50);

        expect(result.success).toBe(false);
        expect(result.error).toBe("NO_COINS_IN_BANK");
      });
    });

    describe("Insufficient Funds", () => {
      it("fails when bank balance is less than amount", () => {
        manager.setPouchBalance("player-1", 0);
        manager.setBankCoins("player-1", 100);

        const result = manager.withdrawCoins("player-1", 500);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INSUFFICIENT_BANK_COINS");
        expect(manager.getBankCoins("player-1")).toBe(100); // Unchanged
      });
    });

    describe("Overflow Protection", () => {
      it("fails when withdrawal would overflow pouch", () => {
        manager.setPouchBalance("player-1", MAX_COINS - 100);
        manager.setBankCoins("player-1", 500);

        const result = manager.withdrawCoins("player-1", 200);

        expect(result.success).toBe(false);
        expect(result.error).toBe("COIN_OVERFLOW");
        expect(manager.getPouchBalance("player-1")).toBe(MAX_COINS - 100); // Unchanged
        expect(manager.getBankCoins("player-1")).toBe(500); // Unchanged
      });

      it("succeeds at exactly max coins limit", () => {
        manager.setPouchBalance("player-1", MAX_COINS - 500);
        manager.setBankCoins("player-1", 500);

        const result = manager.withdrawCoins("player-1", 500);

        expect(result.success).toBe(true);
        expect(manager.getPouchBalance("player-1")).toBe(MAX_COINS);
      });
    });

    describe("Input Validation", () => {
      it("fails for zero amount", () => {
        manager.setBankCoins("player-1", 1000);

        const result = manager.withdrawCoins("player-1", 0);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });

      it("fails for negative amount", () => {
        manager.setBankCoins("player-1", 1000);

        const result = manager.withdrawCoins("player-1", -100);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });

      it("fails for non-integer amount", () => {
        manager.setBankCoins("player-1", 1000);

        const result = manager.withdrawCoins("player-1", 50.5);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVALID_AMOUNT");
      });
    });
  });

  describe("Multi-Player Isolation", () => {
    it("deposit does not affect other players", () => {
      manager.setPouchBalance("player-1", 1000);
      manager.setPouchBalance("player-2", 500);

      manager.depositCoins("player-1", 300);

      expect(manager.getPouchBalance("player-1")).toBe(700);
      expect(manager.getPouchBalance("player-2")).toBe(500); // Unchanged
      expect(manager.getBankCoins("player-2")).toBe(0); // Unchanged
    });

    it("withdrawal does not affect other players", () => {
      manager.setPouchBalance("player-1", 0);
      manager.setPouchBalance("player-2", 0);
      manager.setBankCoins("player-1", 1000);
      manager.setBankCoins("player-2", 500);

      manager.withdrawCoins("player-1", 300);

      expect(manager.getPouchBalance("player-1")).toBe(300);
      expect(manager.getBankCoins("player-1")).toBe(700);
      expect(manager.getPouchBalance("player-2")).toBe(0); // Unchanged
      expect(manager.getBankCoins("player-2")).toBe(500); // Unchanged
    });
  });

  describe("Large Transaction Handling", () => {
    it("handles deposit of 1 billion coins", () => {
      const billion = 1_000_000_000;
      manager.setPouchBalance("player-1", billion);

      const result = manager.depositCoins("player-1", billion);

      expect(result.success).toBe(true);
      expect(manager.getBankCoins("player-1")).toBe(billion);
    });

    it("handles withdrawal of 1 billion coins", () => {
      const billion = 1_000_000_000;
      manager.setBankCoins("player-1", billion);

      const result = manager.withdrawCoins("player-1", billion);

      expect(result.success).toBe(true);
      expect(manager.getPouchBalance("player-1")).toBe(billion);
    });

    it("handles MAX_COINS correctly", () => {
      manager.setPouchBalance("player-1", MAX_COINS);

      const result = manager.depositCoins("player-1", MAX_COINS);

      expect(result.success).toBe(true);
      expect(manager.getBankCoins("player-1")).toBe(MAX_COINS);
    });
  });
});
