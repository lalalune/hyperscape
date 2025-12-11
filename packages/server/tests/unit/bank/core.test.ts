/**
 * Bank Core Handler Unit Tests
 *
 * Tests the core deposit/withdraw item logic.
 * Uses MockBankItemManager following the existing codebase pattern.
 *
 * NOTE: These tests focus on the business logic, not database/socket operations.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Constants (mirror actual constants)
// ============================================================================

const MAX_INVENTORY_SLOTS = 28;
const MAX_BANK_SLOTS = 1200;
const MAX_QUANTITY = 2147483647;

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  id: number;
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
}

interface BankItem {
  id: number;
  playerId: string;
  itemId: string;
  quantity: number;
  slot: number;
  tabIndex: number;
}

interface ItemDefinition {
  id: string;
  name: string;
  stackable: boolean;
  tradeable: boolean;
  notedId?: string;
  baseId?: string; // For noted items, the base item ID
}

// ============================================================================
// Mock Item Database
// ============================================================================

const MOCK_ITEMS: Record<string, ItemDefinition> = {
  // Normal items (non-stackable)
  logs: {
    id: "logs",
    name: "Logs",
    stackable: false,
    tradeable: true,
    notedId: "logs_noted",
  },
  bronze_sword: {
    id: "bronze_sword",
    name: "Bronze sword",
    stackable: false,
    tradeable: true,
    notedId: "bronze_sword_noted",
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron ore",
    stackable: false,
    tradeable: true,
    notedId: "iron_ore_noted",
  },
  cooked_shrimp: {
    id: "cooked_shrimp",
    name: "Cooked shrimp",
    stackable: false,
    tradeable: true,
    notedId: "cooked_shrimp_noted",
  },

  // Noted variants
  logs_noted: {
    id: "logs_noted",
    name: "Logs (noted)",
    stackable: true,
    tradeable: true,
    baseId: "logs",
  },
  bronze_sword_noted: {
    id: "bronze_sword_noted",
    name: "Bronze sword (noted)",
    stackable: true,
    tradeable: true,
    baseId: "bronze_sword",
  },
  iron_ore_noted: {
    id: "iron_ore_noted",
    name: "Iron ore (noted)",
    stackable: true,
    tradeable: true,
    baseId: "iron_ore",
  },
  cooked_shrimp_noted: {
    id: "cooked_shrimp_noted",
    name: "Cooked shrimp (noted)",
    stackable: true,
    tradeable: true,
    baseId: "cooked_shrimp",
  },

  // Always stackable items
  coins: { id: "coins", name: "Coins", stackable: true, tradeable: true },
  arrows: { id: "arrows", name: "Arrows", stackable: true, tradeable: true },
  runes: { id: "runes", name: "Runes", stackable: true, tradeable: true },

  // Untradeable (cannot be noted)
  quest_item: {
    id: "quest_item",
    name: "Quest item",
    stackable: false,
    tradeable: false,
  },
};

function isNotedItemId(itemId: string): boolean {
  return itemId.endsWith("_noted");
}

function getBaseItemId(itemId: string): string {
  const item = MOCK_ITEMS[itemId];
  return item?.baseId || itemId;
}

function canBeNoted(itemId: string): boolean {
  const item = MOCK_ITEMS[itemId];
  return (
    item?.tradeable === true &&
    item?.stackable === false &&
    item?.notedId !== undefined
  );
}

function isStackable(itemId: string): boolean {
  const item = MOCK_ITEMS[itemId];
  return item?.stackable === true;
}

function getNotedItemId(itemId: string): string | null {
  const item = MOCK_ITEMS[itemId];
  return item?.notedId || null;
}

// ============================================================================
// Mock Bank Item Manager
// ============================================================================

class MockBankItemManager {
  private nextId = 1;
  private inventory: InventoryItem[] = [];
  private bank: BankItem[] = [];
  private alwaysSetPlaceholder = new Map<string, boolean>();

  // ========== Setup Helpers ==========

  addInventoryItem(
    playerId: string,
    itemId: string,
    quantity: number,
    slotIndex: number,
  ): void {
    this.inventory.push({
      id: this.nextId++,
      playerId,
      itemId,
      quantity,
      slotIndex,
    });
  }

  addBankItem(
    playerId: string,
    itemId: string,
    quantity: number,
    slot: number,
    tabIndex: number = 0,
  ): void {
    this.bank.push({
      id: this.nextId++,
      playerId,
      itemId,
      quantity,
      slot,
      tabIndex,
    });
  }

  setAlwaysPlaceholder(playerId: string, value: boolean): void {
    this.alwaysSetPlaceholder.set(playerId, value);
  }

  // ========== Core Operations ==========

  /**
   * Deposit item from inventory to bank
   * Mirrors handleBankDeposit logic
   */
  depositItem(
    playerId: string,
    itemId: string,
    quantity: number,
    targetTabIndex: number = 0,
  ): { success: boolean; error?: string } {
    // Auto-unnote if depositing noted item
    const inventoryItemId = itemId;
    const bankItemId = isNotedItemId(itemId) ? getBaseItemId(itemId) : itemId;

    // Find inventory items
    const invItems = this.inventory.filter(
      (i) => i.playerId === playerId && i.itemId === inventoryItemId,
    );

    if (invItems.length === 0) {
      return { success: false, error: "ITEM_NOT_FOUND" };
    }

    // Calculate total available
    let totalAvailable = 0;
    for (const item of invItems) {
      totalAvailable += item.quantity;
    }

    if (totalAvailable < quantity) {
      return { success: false, error: "INSUFFICIENT_QUANTITY" };
    }

    // Check bank overflow
    const existingBankItem = this.bank.find(
      (b) => b.playerId === playerId && b.itemId === bankItemId,
    );

    if (existingBankItem) {
      if (existingBankItem.quantity + quantity > MAX_QUANTITY) {
        return { success: false, error: "QUANTITY_OVERFLOW" };
      }
    }

    // Check bank slots if new item
    if (!existingBankItem) {
      const usedSlots = new Set(
        this.bank
          .filter(
            (b) => b.playerId === playerId && b.tabIndex === targetTabIndex,
          )
          .map((b) => b.slot),
      );
      if (usedSlots.size >= MAX_BANK_SLOTS) {
        return { success: false, error: "BANK_FULL" };
      }
    }

    // Remove from inventory
    let remaining = quantity;
    for (const item of invItems) {
      if (remaining <= 0) break;

      if (item.quantity <= remaining) {
        remaining -= item.quantity;
        this.inventory = this.inventory.filter((i) => i.id !== item.id);
      } else {
        item.quantity -= remaining;
        remaining = 0;
      }
    }

    // Add to bank
    if (existingBankItem) {
      existingBankItem.quantity += quantity;
    } else {
      const usedSlots = new Set(
        this.bank
          .filter(
            (b) => b.playerId === playerId && b.tabIndex === targetTabIndex,
          )
          .map((b) => b.slot),
      );
      let nextSlot = 0;
      while (usedSlots.has(nextSlot)) {
        nextSlot++;
      }

      this.bank.push({
        id: this.nextId++,
        playerId,
        itemId: bankItemId,
        quantity,
        slot: nextSlot,
        tabIndex: targetTabIndex,
      });
    }

    return { success: true };
  }

  /**
   * Withdraw item from bank to inventory
   * Mirrors handleBankWithdraw logic
   */
  withdrawItem(
    playerId: string,
    itemId: string,
    quantity: number,
    asNote: boolean = false,
  ): { success: boolean; error?: string; actualWithdrawn?: number } {
    // Find bank item
    const bankItem = this.bank.find(
      (b) => b.playerId === playerId && b.itemId === itemId,
    );

    if (!bankItem || bankItem.quantity === 0) {
      return { success: false, error: "ITEM_NOT_IN_BANK" };
    }

    // Calculate free inventory slots
    const usedInvSlots = new Set(
      this.inventory
        .filter((i) => i.playerId === playerId)
        .map((i) => i.slotIndex),
    );
    const freeSlots: number[] = [];
    for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
      if (!usedInvSlots.has(i)) {
        freeSlots.push(i);
      }
    }

    if (freeSlots.length === 0) {
      return { success: false, error: "INVENTORY_FULL" };
    }

    // Determine withdraw mode
    const withdrawAsNote = asNote && canBeNoted(itemId);
    const itemIsStackable = isStackable(itemId);

    // Stackable items and noted items only need 1 slot
    const slotsNeeded =
      withdrawAsNote || itemIsStackable
        ? 1
        : Math.min(quantity, freeSlots.length);
    const actualWithdrawQty =
      withdrawAsNote || itemIsStackable
        ? Math.min(quantity, bankItem.quantity)
        : Math.min(quantity, freeSlots.length, bankItem.quantity);

    if (actualWithdrawQty === 0) {
      return { success: false, error: "INSUFFICIENT_QUANTITY" };
    }

    // Check for existing noted item in inventory (for stacking)
    const notedItemId = getNotedItemId(itemId);
    const existingNotedInv =
      withdrawAsNote && notedItemId
        ? this.inventory.find(
            (i) => i.playerId === playerId && i.itemId === notedItemId,
          )
        : null;

    // Remove from bank
    const newBankQty = bankItem.quantity - actualWithdrawQty;
    const alwaysPlaceholder = this.alwaysSetPlaceholder.get(playerId) ?? false;

    if (newBankQty <= 0) {
      if (alwaysPlaceholder) {
        // Keep as placeholder (qty=0)
        bankItem.quantity = 0;
      } else {
        // Delete and compact
        const slot = bankItem.slot;
        const tabIndex = bankItem.tabIndex;
        this.bank = this.bank.filter((b) => b.id !== bankItem.id);
        this.compactSlots(playerId, slot, tabIndex);
      }
    } else {
      bankItem.quantity = newBankQty;
    }

    // Add to inventory
    if (withdrawAsNote && notedItemId) {
      if (existingNotedInv) {
        // Stack with existing
        existingNotedInv.quantity += actualWithdrawQty;
      } else {
        // Create new noted stack
        this.inventory.push({
          id: this.nextId++,
          playerId,
          itemId: notedItemId,
          quantity: actualWithdrawQty,
          slotIndex: freeSlots[0],
        });
      }
    } else if (itemIsStackable) {
      // Stackable items: single stack in one slot
      // Check for existing stack first
      const existingStack = this.inventory.find(
        (i) => i.playerId === playerId && i.itemId === itemId,
      );
      if (existingStack) {
        existingStack.quantity += actualWithdrawQty;
      } else {
        this.inventory.push({
          id: this.nextId++,
          playerId,
          itemId,
          quantity: actualWithdrawQty,
          slotIndex: freeSlots[0],
        });
      }
    } else {
      // Non-stackable: one item per slot
      for (let i = 0; i < actualWithdrawQty; i++) {
        this.inventory.push({
          id: this.nextId++,
          playerId,
          itemId,
          quantity: 1,
          slotIndex: freeSlots[i],
        });
      }
    }

    return { success: true, actualWithdrawn: actualWithdrawQty };
  }

  /**
   * Deposit all inventory items to bank
   * Mirrors handleBankDepositAll logic
   */
  depositAll(
    playerId: string,
    targetTabIndex: number = 0,
  ): { success: boolean; error?: string; depositedCount?: number } {
    const invItems = this.inventory.filter((i) => i.playerId === playerId);

    if (invItems.length === 0) {
      return { success: false, error: "INVENTORY_EMPTY" };
    }

    // Group by base item ID (auto-unnote)
    const itemGroups = new Map<
      string,
      { total: number; items: InventoryItem[] }
    >();
    for (const item of invItems) {
      const bankItemId = isNotedItemId(item.itemId)
        ? getBaseItemId(item.itemId)
        : item.itemId;
      const group = itemGroups.get(bankItemId) || { total: 0, items: [] };
      group.total += item.quantity;
      group.items.push(item);
      itemGroups.set(bankItemId, group);
    }

    // Check overflow for existing items
    for (const [itemId, group] of itemGroups) {
      const existingBank = this.bank.find(
        (b) => b.playerId === playerId && b.itemId === itemId,
      );
      if (existingBank && existingBank.quantity + group.total > MAX_QUANTITY) {
        return { success: false, error: "QUANTITY_OVERFLOW" };
      }
    }

    // Check bank slots for new items
    const existingBankItemIds = new Set(
      this.bank.filter((b) => b.playerId === playerId).map((b) => b.itemId),
    );
    let newItemTypes = 0;
    for (const itemId of itemGroups.keys()) {
      if (!existingBankItemIds.has(itemId)) {
        newItemTypes++;
      }
    }

    const usedSlots = this.bank.filter(
      (b) => b.playerId === playerId && b.tabIndex === targetTabIndex,
    ).length;
    if (newItemTypes > MAX_BANK_SLOTS - usedSlots) {
      return { success: false, error: "BANK_FULL" };
    }

    // Execute deposit
    // Remove all inventory items
    this.inventory = this.inventory.filter((i) => i.playerId !== playerId);

    // Add to bank
    let nextSlot = usedSlots;
    for (const [itemId, group] of itemGroups) {
      const existingBank = this.bank.find(
        (b) => b.playerId === playerId && b.itemId === itemId,
      );

      if (existingBank) {
        existingBank.quantity += group.total;
      } else {
        this.bank.push({
          id: this.nextId++,
          playerId,
          itemId,
          quantity: group.total,
          slot: nextSlot++,
          tabIndex: targetTabIndex,
        });
      }
    }

    return { success: true, depositedCount: invItems.length };
  }

  // ========== Helper Methods ==========

  private compactSlots(
    playerId: string,
    deletedSlot: number,
    tabIndex: number,
  ): void {
    const itemsToShift = this.bank.filter(
      (b) =>
        b.playerId === playerId &&
        b.tabIndex === tabIndex &&
        b.slot > deletedSlot,
    );
    for (const item of itemsToShift) {
      item.slot -= 1;
    }
  }

  // ========== Query Methods ==========

  getInventory(playerId: string): InventoryItem[] {
    return this.inventory.filter((i) => i.playerId === playerId);
  }

  getInventoryCount(playerId: string, itemId: string): number {
    return this.inventory
      .filter((i) => i.playerId === playerId && i.itemId === itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  getBank(playerId: string): BankItem[] {
    return this.bank.filter((b) => b.playerId === playerId);
  }

  getBankItem(playerId: string, itemId: string): BankItem | undefined {
    return this.bank.find(
      (b) => b.playerId === playerId && b.itemId === itemId,
    );
  }

  getBankCount(playerId: string, itemId: string): number {
    const item = this.getBankItem(playerId, itemId);
    return item?.quantity ?? 0;
  }

  getFreeInventorySlots(playerId: string): number {
    const usedSlots = new Set(
      this.inventory
        .filter((i) => i.playerId === playerId)
        .map((i) => i.slotIndex),
    );
    return MAX_INVENTORY_SLOTS - usedSlots.size;
  }

  // ========== Reset ==========

  reset(): void {
    this.inventory = [];
    this.bank = [];
    this.alwaysSetPlaceholder.clear();
    this.nextId = 1;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Bank Core Handlers", () => {
  let manager: MockBankItemManager;

  beforeEach(() => {
    manager = new MockBankItemManager();
    manager.reset();
  });

  describe("depositItem", () => {
    describe("Success Cases", () => {
      it("deposits single item to empty bank", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);

        const result = manager.depositItem("player-1", "logs", 1);

        expect(result.success).toBe(true);
        expect(manager.getInventoryCount("player-1", "logs")).toBe(0);
        expect(manager.getBankCount("player-1", "logs")).toBe(1);
      });

      it("deposits multiple items (one row)", () => {
        // Non-stackable: each item in separate slot
        manager.addInventoryItem("player-1", "logs", 1, 0);
        manager.addInventoryItem("player-1", "logs", 1, 1);
        manager.addInventoryItem("player-1", "logs", 1, 2);

        const result = manager.depositItem("player-1", "logs", 3);

        expect(result.success).toBe(true);
        expect(manager.getInventory("player-1").length).toBe(0);
        expect(manager.getBankCount("player-1", "logs")).toBe(3);
      });

      it("deposits to existing bank stack", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);
        manager.addBankItem("player-1", "logs", 10, 0);

        const result = manager.depositItem("player-1", "logs", 1);

        expect(result.success).toBe(true);
        expect(manager.getBankCount("player-1", "logs")).toBe(11);
      });

      it("deposits partial inventory quantity", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);
        manager.addInventoryItem("player-1", "logs", 1, 1);
        manager.addInventoryItem("player-1", "logs", 1, 2);

        const result = manager.depositItem("player-1", "logs", 2);

        expect(result.success).toBe(true);
        expect(manager.getInventoryCount("player-1", "logs")).toBe(1);
        expect(manager.getBankCount("player-1", "logs")).toBe(2);
      });

      it("deposits stackable item", () => {
        manager.addInventoryItem("player-1", "arrows", 500, 0);

        const result = manager.depositItem("player-1", "arrows", 300);

        expect(result.success).toBe(true);
        expect(manager.getInventoryCount("player-1", "arrows")).toBe(200);
        expect(manager.getBankCount("player-1", "arrows")).toBe(300);
      });

      it("deposits to specified tab", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);

        manager.depositItem("player-1", "logs", 1, 2);

        const bankItem = manager.getBankItem("player-1", "logs");
        expect(bankItem?.tabIndex).toBe(2);
      });
    });

    describe("Note Auto-Conversion", () => {
      it("converts noted item to base item in bank", () => {
        manager.addInventoryItem("player-1", "logs_noted", 100, 0);

        const result = manager.depositItem("player-1", "logs_noted", 50);

        expect(result.success).toBe(true);
        // Should be stored as base item "logs", not "logs_noted"
        expect(manager.getBankCount("player-1", "logs")).toBe(50);
        expect(manager.getBankCount("player-1", "logs_noted")).toBe(0);
        // Noted stack in inventory should be reduced
        expect(manager.getInventoryCount("player-1", "logs_noted")).toBe(50);
      });

      it("stacks with existing base item when depositing notes", () => {
        manager.addInventoryItem("player-1", "logs_noted", 100, 0);
        manager.addBankItem("player-1", "logs", 50, 0);

        const result = manager.depositItem("player-1", "logs_noted", 30);

        expect(result.success).toBe(true);
        expect(manager.getBankCount("player-1", "logs")).toBe(80);
      });
    });

    describe("Placeholder Behavior", () => {
      it("fills placeholder (qty=0) when depositing", () => {
        // Placeholder is a bank item with qty=0
        manager.addBankItem("player-1", "logs", 0, 5); // Placeholder at slot 5
        manager.addInventoryItem("player-1", "logs", 1, 0);

        const result = manager.depositItem("player-1", "logs", 1);

        expect(result.success).toBe(true);
        const bankItem = manager.getBankItem("player-1", "logs");
        expect(bankItem?.quantity).toBe(1);
        expect(bankItem?.slot).toBe(5); // Same slot as placeholder
      });
    });

    describe("Error Cases", () => {
      it("fails when item not in inventory", () => {
        const result = manager.depositItem("player-1", "logs", 1);

        expect(result.success).toBe(false);
        expect(result.error).toBe("ITEM_NOT_FOUND");
      });

      it("fails when insufficient quantity", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);

        const result = manager.depositItem("player-1", "logs", 5);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INSUFFICIENT_QUANTITY");
      });

      it("fails when bank quantity would overflow", () => {
        manager.addInventoryItem("player-1", "arrows", 1000, 0);
        manager.addBankItem("player-1", "arrows", MAX_QUANTITY - 500, 0);

        const result = manager.depositItem("player-1", "arrows", 600);

        expect(result.success).toBe(false);
        expect(result.error).toBe("QUANTITY_OVERFLOW");
      });
    });
  });

  describe("withdrawItem", () => {
    describe("Success Cases - Base Items", () => {
      it("withdraws single item to inventory", () => {
        manager.addBankItem("player-1", "logs", 10, 0);

        const result = manager.withdrawItem("player-1", "logs", 1);

        expect(result.success).toBe(true);
        expect(result.actualWithdrawn).toBe(1);
        expect(manager.getBankCount("player-1", "logs")).toBe(9);
        expect(manager.getInventoryCount("player-1", "logs")).toBe(1);
      });

      it("withdraws multiple items (one per slot for non-stackable)", () => {
        manager.addBankItem("player-1", "logs", 10, 0);

        const result = manager.withdrawItem("player-1", "logs", 5);

        expect(result.success).toBe(true);
        expect(result.actualWithdrawn).toBe(5);
        expect(manager.getInventory("player-1").length).toBe(5); // 5 separate slots
      });

      it("withdraws limited by free inventory slots", () => {
        manager.addBankItem("player-1", "logs", 100, 0);
        // Fill 26 slots, leaving 2 free
        for (let i = 0; i < 26; i++) {
          manager.addInventoryItem("player-1", "bronze_sword", 1, i);
        }

        const result = manager.withdrawItem("player-1", "logs", 10);

        expect(result.success).toBe(true);
        expect(result.actualWithdrawn).toBe(2); // Only 2 free slots
      });

      it("withdraws stackable items to single slot", () => {
        manager.addBankItem("player-1", "arrows", 1000, 0);

        const result = manager.withdrawItem("player-1", "arrows", 500);

        expect(result.success).toBe(true);
        expect(result.actualWithdrawn).toBe(500);
        expect(manager.getBankCount("player-1", "arrows")).toBe(500);
        // Stackable items (arrows) go into a single inventory slot
        expect(manager.getInventory("player-1").length).toBe(1);
        expect(manager.getInventoryCount("player-1", "arrows")).toBe(500);
      });
    });

    describe("Success Cases - Noted Withdrawal", () => {
      it("withdraws as note when asNote=true and item is noteable", () => {
        manager.addBankItem("player-1", "logs", 100, 0);

        const result = manager.withdrawItem("player-1", "logs", 50, true);

        expect(result.success).toBe(true);
        expect(result.actualWithdrawn).toBe(50);
        // Should be noted version in inventory
        expect(manager.getInventoryCount("player-1", "logs_noted")).toBe(50);
        expect(manager.getInventoryCount("player-1", "logs")).toBe(0);
      });

      it("noted withdrawal uses single inventory slot", () => {
        manager.addBankItem("player-1", "logs", 1000, 0);

        manager.withdrawItem("player-1", "logs", 500, true);

        expect(manager.getInventory("player-1").length).toBe(1);
      });

      it("stacks with existing noted item in inventory", () => {
        manager.addBankItem("player-1", "logs", 100, 0);
        manager.addInventoryItem("player-1", "logs_noted", 50, 0);

        const result = manager.withdrawItem("player-1", "logs", 30, true);

        expect(result.success).toBe(true);
        expect(manager.getInventoryCount("player-1", "logs_noted")).toBe(80);
        expect(manager.getInventory("player-1").length).toBe(1); // Still single stack
      });

      it("withdraws as base item if item cannot be noted", () => {
        manager.addBankItem("player-1", "quest_item", 5, 0);

        // quest_item is untradeable, cannot be noted
        const result = manager.withdrawItem("player-1", "quest_item", 3, true);

        expect(result.success).toBe(true);
        // Should withdraw as base item, not noted
        expect(manager.getInventoryCount("player-1", "quest_item")).toBe(3);
      });
    });

    describe("Placeholder Behavior", () => {
      it("creates placeholder when alwaysSetPlaceholder is ON", () => {
        manager.setAlwaysPlaceholder("player-1", true);
        manager.addBankItem("player-1", "logs", 5, 3);

        manager.withdrawItem("player-1", "logs", 5);

        // Item should still exist with qty=0 (placeholder)
        const bankItem = manager.getBankItem("player-1", "logs");
        expect(bankItem).toBeDefined();
        expect(bankItem?.quantity).toBe(0);
        expect(bankItem?.slot).toBe(3); // Same slot preserved
      });

      it("removes bank row when alwaysSetPlaceholder is OFF", () => {
        manager.setAlwaysPlaceholder("player-1", false);
        manager.addBankItem("player-1", "logs", 5, 3);

        manager.withdrawItem("player-1", "logs", 5);

        const bankItem = manager.getBankItem("player-1", "logs");
        expect(bankItem).toBeUndefined();
      });

      it("compacts slots after removal when alwaysSetPlaceholder is OFF", () => {
        manager.setAlwaysPlaceholder("player-1", false);
        manager.addBankItem("player-1", "logs", 5, 0);
        manager.addBankItem("player-1", "iron_ore", 10, 1);
        manager.addBankItem("player-1", "bronze_sword", 1, 2);

        // Withdraw all logs (slot 0)
        manager.withdrawItem("player-1", "logs", 5);

        // Remaining items should shift
        const ironOre = manager.getBankItem("player-1", "iron_ore");
        const sword = manager.getBankItem("player-1", "bronze_sword");
        expect(ironOre?.slot).toBe(0); // Was 1, now 0
        expect(sword?.slot).toBe(1); // Was 2, now 1
      });
    });

    describe("Error Cases", () => {
      it("fails when item not in bank", () => {
        const result = manager.withdrawItem("player-1", "logs", 1);

        expect(result.success).toBe(false);
        expect(result.error).toBe("ITEM_NOT_IN_BANK");
      });

      it("fails when bank item is placeholder (qty=0)", () => {
        manager.addBankItem("player-1", "logs", 0, 0); // Placeholder

        const result = manager.withdrawItem("player-1", "logs", 1);

        expect(result.success).toBe(false);
        expect(result.error).toBe("ITEM_NOT_IN_BANK");
      });

      it("fails when inventory is full", () => {
        manager.addBankItem("player-1", "logs", 10, 0);
        // Fill all 28 slots
        for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
          manager.addInventoryItem("player-1", "bronze_sword", 1, i);
        }

        const result = manager.withdrawItem("player-1", "logs", 1);

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVENTORY_FULL");
      });
    });
  });

  describe("depositAll", () => {
    describe("Success Cases", () => {
      it("deposits all items from inventory", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);
        manager.addInventoryItem("player-1", "logs", 1, 1);
        manager.addInventoryItem("player-1", "iron_ore", 1, 2);
        manager.addInventoryItem("player-1", "bronze_sword", 1, 3);

        const result = manager.depositAll("player-1");

        expect(result.success).toBe(true);
        expect(result.depositedCount).toBe(4);
        expect(manager.getInventory("player-1").length).toBe(0);
        expect(manager.getBankCount("player-1", "logs")).toBe(2);
        expect(manager.getBankCount("player-1", "iron_ore")).toBe(1);
        expect(manager.getBankCount("player-1", "bronze_sword")).toBe(1);
      });

      it("stacks with existing bank items", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);
        manager.addBankItem("player-1", "logs", 50, 0);

        const result = manager.depositAll("player-1");

        expect(result.success).toBe(true);
        expect(manager.getBankCount("player-1", "logs")).toBe(51);
      });

      it("auto-converts noted items to base", () => {
        manager.addInventoryItem("player-1", "logs_noted", 100, 0);
        manager.addInventoryItem("player-1", "iron_ore_noted", 50, 1);

        const result = manager.depositAll("player-1");

        expect(result.success).toBe(true);
        expect(manager.getBankCount("player-1", "logs")).toBe(100);
        expect(manager.getBankCount("player-1", "iron_ore")).toBe(50);
        expect(manager.getBankCount("player-1", "logs_noted")).toBe(0);
      });

      it("deposits to specified tab for new items", () => {
        manager.addInventoryItem("player-1", "logs", 1, 0);

        manager.depositAll("player-1", 3);

        const bankItem = manager.getBankItem("player-1", "logs");
        expect(bankItem?.tabIndex).toBe(3);
      });
    });

    describe("Error Cases", () => {
      it("fails when inventory is empty", () => {
        const result = manager.depositAll("player-1");

        expect(result.success).toBe(false);
        expect(result.error).toBe("INVENTORY_EMPTY");
      });

      it("fails when bank quantity would overflow", () => {
        manager.addInventoryItem("player-1", "arrows", 1000, 0);
        manager.addBankItem("player-1", "arrows", MAX_QUANTITY - 500, 0);

        const result = manager.depositAll("player-1");

        expect(result.success).toBe(false);
        expect(result.error).toBe("QUANTITY_OVERFLOW");
      });
    });
  });

  describe("Multi-Player Isolation", () => {
    it("deposit does not affect other players", () => {
      manager.addInventoryItem("player-1", "logs", 1, 0);
      manager.addInventoryItem("player-2", "logs", 1, 0);

      manager.depositItem("player-1", "logs", 1);

      expect(manager.getInventoryCount("player-1", "logs")).toBe(0);
      expect(manager.getInventoryCount("player-2", "logs")).toBe(1); // Unchanged
    });

    it("withdraw does not affect other players", () => {
      manager.addBankItem("player-1", "logs", 10, 0);
      manager.addBankItem("player-2", "logs", 10, 0);

      manager.withdrawItem("player-1", "logs", 5);

      expect(manager.getBankCount("player-1", "logs")).toBe(5);
      expect(manager.getBankCount("player-2", "logs")).toBe(10); // Unchanged
    });
  });
});
