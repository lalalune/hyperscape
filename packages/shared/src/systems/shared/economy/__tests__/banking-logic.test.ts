/**
 * Banking Logic Unit Tests
 *
 * Tests all pure banking functions in isolation.
 */

import { describe, it, expect } from "bun:test";
import { ValidationError } from "../../../../validation";
import {
  type BankItem,
  validateBankOpenRequest,
  validateDepositRequest,
  validateWithdrawRequest,
  calculateDistance,
  isWithinBankDistance,
  countBankSlots,
  isBankFull,
  getRemainingSlots,
  findBankItem,
  findBankItemIndex,
  bankHasItem,
  getBankItemQuantity,
  canDeposit,
  calculateDeposit,
  canWithdraw,
  calculateWithdraw,
  calculateDepositAll,
  searchBankItems,
  sortBankItemsByName,
  sortBankItemsByQuantity,
} from "../banking-logic";
import { BANKING_CONSTANTS } from "../../../../constants/BankingConstants";
import { INPUT_LIMITS } from "../../../../constants";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createBankItem(
  id: string,
  name: string = id,
  quantity: number = 1,
  stackable: boolean = true,
): BankItem {
  return { id, name, quantity, stackable };
}

function createEmptyBank(): BankItem[] {
  return [];
}

function createPartialBank(): BankItem[] {
  return [
    createBankItem("coins", "Gold Coins", 10000),
    createBankItem("bronze_sword", "Bronze Sword", 1, false),
    createBankItem("logs", "Logs", 50),
    createBankItem("fish", "Cooked Fish", 25),
  ];
}

function createFullBank(): BankItem[] {
  const items: BankItem[] = [];
  for (let i = 0; i < BANKING_CONSTANTS.MAX_BANK_SLOTS; i++) {
    items.push(createBankItem(`item_${i}`, `Item ${i}`, 1));
  }
  return items;
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe("validateBankOpenRequest", () => {
  it("validates correct input", () => {
    const result = validateBankOpenRequest("player-1", "bank-central");
    expect(result.playerId).toBe("player-1");
    expect(result.bankId).toBe("bank-central");
  });

  it("throws for empty playerId", () => {
    expect(() => validateBankOpenRequest("", "bank-1")).toThrow(
      ValidationError,
    );
  });

  it("throws for empty bankId", () => {
    expect(() => validateBankOpenRequest("player-1", "")).toThrow(
      ValidationError,
    );
  });

  it("throws when player is too far from bank", () => {
    const playerPos = { x: 0, y: 0, z: 0 };
    const bankPos = { x: 100, y: 0, z: 0 };

    expect(() =>
      validateBankOpenRequest("player-1", "bank-1", playerPos, bankPos),
    ).toThrow(ValidationError);
  });

  it("passes when player is within distance", () => {
    const playerPos = { x: 0, y: 0, z: 0 };
    const bankPos = { x: 2, y: 0, z: 0 };

    expect(() =>
      validateBankOpenRequest("player-1", "bank-1", playerPos, bankPos),
    ).not.toThrow();
  });
});

describe("validateDepositRequest", () => {
  it("validates correct input", () => {
    const result = validateDepositRequest("player-1", "coins", 100);
    expect(result.playerId).toBe("player-1");
    expect(result.itemId).toBe("coins");
    expect(result.quantity).toBe(100);
  });

  it("throws for invalid quantity", () => {
    expect(() => validateDepositRequest("player-1", "coins", 0)).toThrow(
      ValidationError,
    );
    expect(() => validateDepositRequest("player-1", "coins", -1)).toThrow(
      ValidationError,
    );
  });

  it("throws for quantity exceeding max", () => {
    expect(() =>
      validateDepositRequest(
        "player-1",
        "coins",
        INPUT_LIMITS.MAX_QUANTITY + 1,
      ),
    ).toThrow(ValidationError);
  });
});

describe("validateWithdrawRequest", () => {
  it("validates correct input", () => {
    const result = validateWithdrawRequest("player-1", "coins", 50);
    expect(result.playerId).toBe("player-1");
    expect(result.itemId).toBe("coins");
    expect(result.quantity).toBe(50);
  });

  it("throws for invalid quantity", () => {
    expect(() => validateWithdrawRequest("player-1", "coins", 0)).toThrow(
      ValidationError,
    );
  });
});

// =============================================================================
// DISTANCE TESTS
// =============================================================================

describe("calculateDistance", () => {
  it("calculates distance correctly", () => {
    const pos1 = { x: 0, y: 0, z: 0 };
    const pos2 = { x: 3, y: 4, z: 0 };
    expect(calculateDistance(pos1, pos2)).toBe(5);
  });

  it("returns 0 for same position", () => {
    const pos = { x: 10, y: 20, z: 30 };
    expect(calculateDistance(pos, pos)).toBe(0);
  });
});

describe("isWithinBankDistance", () => {
  it("returns true when within distance", () => {
    const player = { x: 0, y: 0, z: 0 };
    const bank = { x: 2, y: 0, z: 0 };
    expect(isWithinBankDistance(player, bank)).toBe(true);
  });

  it("returns false when outside distance", () => {
    const player = { x: 0, y: 0, z: 0 };
    const bank = { x: 100, y: 0, z: 0 };
    expect(isWithinBankDistance(player, bank)).toBe(false);
  });
});

// =============================================================================
// BANK STATE TESTS
// =============================================================================

describe("countBankSlots", () => {
  it("returns 0 for empty bank", () => {
    expect(countBankSlots([])).toBe(0);
  });

  it("counts items correctly", () => {
    const items = createPartialBank();
    expect(countBankSlots(items)).toBe(4);
  });
});

describe("isBankFull", () => {
  it("returns false for empty bank", () => {
    expect(isBankFull([])).toBe(false);
  });

  it("returns false for partial bank", () => {
    expect(isBankFull(createPartialBank())).toBe(false);
  });

  it("returns true for full bank", () => {
    expect(isBankFull(createFullBank())).toBe(true);
  });

  it("respects custom maxSlots", () => {
    const items = [createBankItem("a"), createBankItem("b")];
    expect(isBankFull(items, 2)).toBe(true);
    expect(isBankFull(items, 3)).toBe(false);
  });
});

describe("getRemainingSlots", () => {
  it("returns max for empty bank", () => {
    expect(getRemainingSlots([])).toBe(BANKING_CONSTANTS.MAX_BANK_SLOTS);
  });

  it("calculates remaining correctly", () => {
    const items = createPartialBank();
    expect(getRemainingSlots(items)).toBe(BANKING_CONSTANTS.MAX_BANK_SLOTS - 4);
  });

  it("returns 0 for full bank", () => {
    expect(getRemainingSlots(createFullBank())).toBe(0);
  });
});

describe("findBankItem", () => {
  it("finds existing item", () => {
    const items = createPartialBank();
    const found = findBankItem(items, "coins");
    expect(found?.name).toBe("Gold Coins");
    expect(found?.quantity).toBe(10000);
  });

  it("returns undefined for missing item", () => {
    const items = createPartialBank();
    expect(findBankItem(items, "nonexistent")).toBeUndefined();
  });
});

describe("findBankItemIndex", () => {
  it("finds existing item index", () => {
    const items = createPartialBank();
    expect(findBankItemIndex(items, "coins")).toBe(0);
    expect(findBankItemIndex(items, "logs")).toBe(2);
  });

  it("returns -1 for missing item", () => {
    const items = createPartialBank();
    expect(findBankItemIndex(items, "nonexistent")).toBe(-1);
  });
});

describe("bankHasItem", () => {
  it("returns true for existing item", () => {
    const items = createPartialBank();
    expect(bankHasItem(items, "coins")).toBe(true);
  });

  it("returns false for missing item", () => {
    const items = createPartialBank();
    expect(bankHasItem(items, "nonexistent")).toBe(false);
  });

  it("checks quantity correctly", () => {
    const items = createPartialBank();
    expect(bankHasItem(items, "coins", 5000)).toBe(true);
    expect(bankHasItem(items, "coins", 10000)).toBe(true);
    expect(bankHasItem(items, "coins", 10001)).toBe(false);
  });
});

describe("getBankItemQuantity", () => {
  it("returns quantity for existing item", () => {
    const items = createPartialBank();
    expect(getBankItemQuantity(items, "coins")).toBe(10000);
  });

  it("returns 0 for missing item", () => {
    const items = createPartialBank();
    expect(getBankItemQuantity(items, "nonexistent")).toBe(0);
  });
});

// =============================================================================
// DEPOSIT TESTS
// =============================================================================

describe("canDeposit", () => {
  it("allows deposit to empty bank", () => {
    const result = canDeposit([], "coins", 100, true);
    expect(result.canDeposit).toBe(true);
  });

  it("allows deposit to existing stack", () => {
    const items = createPartialBank();
    const result = canDeposit(items, "coins", 100, true);
    expect(result.canDeposit).toBe(true);
  });

  it("rejects if would exceed max stack", () => {
    const items = [
      createBankItem("coins", "Coins", INPUT_LIMITS.MAX_QUANTITY - 10),
    ];
    const result = canDeposit(items, "coins", 20, true);
    expect(result.canDeposit).toBe(false);
    expect(result.reason).toContain("max stack");
  });

  it("rejects if bank is full and item is new", () => {
    const items = createFullBank();
    const result = canDeposit(items, "new_item", 1, true);
    expect(result.canDeposit).toBe(false);
    expect(result.reason).toBe("Bank is full");
  });
});

describe("calculateDeposit", () => {
  it("adds new item to empty bank", () => {
    const result = calculateDeposit([], "coins", "Gold Coins", 100, true);

    expect(result.success).toBe(true);
    expect(result.newBankItems.length).toBe(1);
    expect(result.newBankItems[0].id).toBe("coins");
    expect(result.newBankItems[0].quantity).toBe(100);
    expect(result.itemDeposited?.quantity).toBe(100);
  });

  it("adds to existing stack", () => {
    const items = [createBankItem("coins", "Gold Coins", 500)];
    const result = calculateDeposit(items, "coins", "Gold Coins", 100, true);

    expect(result.success).toBe(true);
    expect(result.newBankItems.length).toBe(1);
    expect(result.newBankItems[0].quantity).toBe(600);
  });

  it("does not mutate original array", () => {
    const items = [createBankItem("coins", "Gold Coins", 500)];
    const originalQuantity = items[0].quantity;

    calculateDeposit(items, "coins", "Gold Coins", 100, true);

    expect(items[0].quantity).toBe(originalQuantity);
  });

  it("returns error for full bank", () => {
    const items = createFullBank();
    const result = calculateDeposit(items, "new_item", "New Item", 1, true);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Bank is full");
  });
});

// =============================================================================
// WITHDRAW TESTS
// =============================================================================

describe("canWithdraw", () => {
  it("allows withdraw for existing item", () => {
    const items = createPartialBank();
    const result = canWithdraw(items, "coins", 1000);
    expect(result.canWithdraw).toBe(true);
  });

  it("rejects withdraw for missing item", () => {
    const items = createPartialBank();
    const result = canWithdraw(items, "nonexistent", 1);
    expect(result.canWithdraw).toBe(false);
    expect(result.reason).toBe("Item not found in bank");
  });

  it("rejects withdraw for insufficient quantity", () => {
    const items = createPartialBank();
    const result = canWithdraw(items, "coins", 20000);
    expect(result.canWithdraw).toBe(false);
    expect(result.reason).toContain("Only 10000 available");
  });
});

describe("calculateWithdraw", () => {
  it("withdraws partial stack", () => {
    const items = [createBankItem("coins", "Gold Coins", 1000)];
    const result = calculateWithdraw(items, "coins", 300);

    expect(result.success).toBe(true);
    expect(result.newBankItems.length).toBe(1);
    expect(result.newBankItems[0].quantity).toBe(700);
    expect(result.itemWithdrawn?.quantity).toBe(300);
  });

  it("removes item when withdrawing entire stack", () => {
    const items = [createBankItem("coins", "Gold Coins", 100)];
    const result = calculateWithdraw(items, "coins", 100);

    expect(result.success).toBe(true);
    expect(result.newBankItems.length).toBe(0);
  });

  it("does not mutate original array", () => {
    const items = [createBankItem("coins", "Gold Coins", 1000)];
    const originalQuantity = items[0].quantity;
    const originalLength = items.length;

    calculateWithdraw(items, "coins", 300);

    expect(items[0].quantity).toBe(originalQuantity);
    expect(items.length).toBe(originalLength);
  });

  it("returns error for missing item", () => {
    const items = createPartialBank();
    const result = calculateWithdraw(items, "nonexistent", 1);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Item not found in bank");
  });
});

// =============================================================================
// DEPOSIT ALL TESTS
// =============================================================================

describe("calculateDepositAll", () => {
  it("deposits all items from empty bank", () => {
    const inventoryItems = [
      { itemId: "coins", name: "Coins", quantity: 100, stackable: true },
      { itemId: "logs", name: "Logs", quantity: 50, stackable: true },
    ];

    const result = calculateDepositAll([], inventoryItems);

    expect(result.depositedCount).toBe(2);
    expect(result.newBankItems.length).toBe(2);
    expect(result.failedItems.length).toBe(0);
  });

  it("stacks with existing items", () => {
    const bankItems = [createBankItem("coins", "Coins", 500)];
    const inventoryItems = [
      { itemId: "coins", name: "Coins", quantity: 100, stackable: true },
    ];

    const result = calculateDepositAll(bankItems, inventoryItems);

    expect(result.depositedCount).toBe(1);
    expect(result.newBankItems.length).toBe(1);
    expect(result.newBankItems[0].quantity).toBe(600);
  });

  it("handles full bank gracefully", () => {
    const bankItems = createFullBank();
    const inventoryItems = [
      { itemId: "new_item", name: "New Item", quantity: 1, stackable: true },
    ];

    const result = calculateDepositAll(bankItems, inventoryItems);

    expect(result.depositedCount).toBe(0);
    expect(result.failedItems.length).toBe(1);
    expect(result.failedItems[0]).toBe("new_item");
  });

  it("deposits partial when bank fills up", () => {
    const bankItems: BankItem[] = [];
    // Create items to fill bank plus extras
    const inventoryItems = [];
    for (let i = 0; i < BANKING_CONSTANTS.MAX_BANK_SLOTS + 5; i++) {
      inventoryItems.push({
        itemId: `item_${i}`,
        name: `Item ${i}`,
        quantity: 1,
        stackable: true,
      });
    }

    const result = calculateDepositAll(bankItems, inventoryItems);

    expect(result.depositedCount).toBe(BANKING_CONSTANTS.MAX_BANK_SLOTS);
    expect(result.failedItems.length).toBe(5);
  });
});

// =============================================================================
// SEARCH AND SORT TESTS
// =============================================================================

describe("searchBankItems", () => {
  it("finds items by name", () => {
    const items = createPartialBank();
    const results = searchBankItems(items, "sword");

    expect(results.length).toBe(1);
    expect(results[0].id).toBe("bronze_sword");
  });

  it("is case insensitive", () => {
    const items = createPartialBank();
    const results = searchBankItems(items, "SWORD");

    expect(results.length).toBe(1);
  });

  it("finds partial matches", () => {
    const items = createPartialBank();
    const results = searchBankItems(items, "co"); // "Coins" and "Cooked"

    expect(results.length).toBe(2);
  });

  it("returns empty for no matches", () => {
    const items = createPartialBank();
    const results = searchBankItems(items, "xyz");

    expect(results.length).toBe(0);
  });
});

describe("sortBankItemsByName", () => {
  it("sorts alphabetically ascending", () => {
    const items = createPartialBank();
    const sorted = sortBankItemsByName(items, true);

    expect(sorted[0].name).toBe("Bronze Sword");
    expect(sorted[sorted.length - 1].name).toBe("Logs");
  });

  it("sorts alphabetically descending", () => {
    const items = createPartialBank();
    const sorted = sortBankItemsByName(items, false);

    expect(sorted[0].name).toBe("Logs");
  });

  it("does not mutate original", () => {
    const items = createPartialBank();
    const originalFirst = items[0].name;

    sortBankItemsByName(items);

    expect(items[0].name).toBe(originalFirst);
  });
});

describe("sortBankItemsByQuantity", () => {
  it("sorts by quantity ascending", () => {
    const items = createPartialBank();
    const sorted = sortBankItemsByQuantity(items, true);

    expect(sorted[0].quantity).toBe(1); // Bronze Sword
    expect(sorted[sorted.length - 1].quantity).toBe(10000); // Coins
  });

  it("sorts by quantity descending", () => {
    const items = createPartialBank();
    const sorted = sortBankItemsByQuantity(items, false);

    expect(sorted[0].quantity).toBe(10000);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  it("handles empty search term", () => {
    const items = createPartialBank();
    const results = searchBankItems(items, "");
    expect(results.length).toBe(items.length);
  });

  it("handles deposit of exact max quantity", () => {
    const items: BankItem[] = [];
    const result = calculateDeposit(
      items,
      "coins",
      "Coins",
      INPUT_LIMITS.MAX_QUANTITY,
      true,
    );

    expect(result.success).toBe(true);
    expect(result.newBankItems[0].quantity).toBe(INPUT_LIMITS.MAX_QUANTITY);
  });

  it("handles withdraw of exact quantity", () => {
    const items = [createBankItem("coins", "Coins", 500)];
    const result = calculateWithdraw(items, "coins", 500);

    expect(result.success).toBe(true);
    expect(result.newBankItems.length).toBe(0);
  });

  it("handles single item bank operations", () => {
    const items = [createBankItem("single", "Single Item", 1)];

    const depositResult = calculateDeposit(
      items,
      "single",
      "Single Item",
      1,
      true,
    );
    expect(depositResult.success).toBe(true);
    expect(depositResult.newBankItems[0].quantity).toBe(2);

    const withdrawResult = calculateWithdraw(items, "single", 1);
    expect(withdrawResult.success).toBe(true);
    expect(withdrawResult.newBankItems.length).toBe(0);
  });
});
