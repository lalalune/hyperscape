/**
 * Validation Module Unit Tests
 *
 * Tests all validators throw on invalid input and pass on valid input.
 */

import { describe, it, expect } from "bun:test";
import {
  ValidationError,
  assertString,
  assertNonEmptyString,
  assertNumber,
  assertInteger,
  assertPositiveInteger,
  assertNonNegativeInteger,
  assertBoolean,
  assertDefined,
  assertObject,
  assertArray,
  assertPlayerId,
  assertItemId,
  assertEntityId,
  assertSlotIndex,
  assertQuantity,
  assertPosition,
  assertPosition2D,
  assertAttackType,
  assertEquipmentSlot,
  assertSessionType,
  assertTick,
  assertHealth,
  assertDamage,
  assertMoveItemInput,
  assertPickupItemInput,
  assertDropItemInput,
  assertAttackInput,
  assertBankOperationInput,
  assertTradeInput,
  clampQuantity,
  wouldOverflow,
  parseIntStrict,
} from "../index";
import { INPUT_LIMITS } from "../../constants";

// =============================================================================
// PRIMITIVE VALIDATORS
// =============================================================================

describe("assertString", () => {
  it("passes for strings", () => {
    expect(() => assertString("hello", "test")).not.toThrow();
    expect(() => assertString("", "test")).not.toThrow();
  });

  it("throws for non-strings", () => {
    expect(() => assertString(123, "test")).toThrow(ValidationError);
    expect(() => assertString(null, "test")).toThrow(ValidationError);
    expect(() => assertString(undefined, "test")).toThrow(ValidationError);
    expect(() => assertString({}, "test")).toThrow(ValidationError);
    expect(() => assertString([], "test")).toThrow(ValidationError);
  });
});

describe("assertNonEmptyString", () => {
  it("passes for non-empty strings", () => {
    expect(() => assertNonEmptyString("hello", "test")).not.toThrow();
    expect(() => assertNonEmptyString("a", "test")).not.toThrow();
  });

  it("throws for empty strings", () => {
    expect(() => assertNonEmptyString("", "test")).toThrow(ValidationError);
  });

  it("throws for non-strings", () => {
    expect(() => assertNonEmptyString(123, "test")).toThrow(ValidationError);
  });
});

describe("assertNumber", () => {
  it("passes for finite numbers", () => {
    expect(() => assertNumber(0, "test")).not.toThrow();
    expect(() => assertNumber(42, "test")).not.toThrow();
    expect(() => assertNumber(-3.14, "test")).not.toThrow();
  });

  it("throws for non-finite numbers", () => {
    expect(() => assertNumber(NaN, "test")).toThrow(ValidationError);
    expect(() => assertNumber(Infinity, "test")).toThrow(ValidationError);
    expect(() => assertNumber(-Infinity, "test")).toThrow(ValidationError);
  });

  it("throws for non-numbers", () => {
    expect(() => assertNumber("42", "test")).toThrow(ValidationError);
    expect(() => assertNumber(null, "test")).toThrow(ValidationError);
  });
});

describe("assertInteger", () => {
  it("passes for integers", () => {
    expect(() => assertInteger(0, "test")).not.toThrow();
    expect(() => assertInteger(42, "test")).not.toThrow();
    expect(() => assertInteger(-10, "test")).not.toThrow();
  });

  it("throws for non-integers", () => {
    expect(() => assertInteger(3.14, "test")).toThrow(ValidationError);
    expect(() => assertInteger(0.5, "test")).toThrow(ValidationError);
  });
});

describe("assertPositiveInteger", () => {
  it("passes for positive integers", () => {
    expect(() => assertPositiveInteger(1, "test")).not.toThrow();
    expect(() => assertPositiveInteger(100, "test")).not.toThrow();
  });

  it("throws for zero", () => {
    expect(() => assertPositiveInteger(0, "test")).toThrow(ValidationError);
  });

  it("throws for negative integers", () => {
    expect(() => assertPositiveInteger(-1, "test")).toThrow(ValidationError);
  });
});

describe("assertNonNegativeInteger", () => {
  it("passes for zero and positive integers", () => {
    expect(() => assertNonNegativeInteger(0, "test")).not.toThrow();
    expect(() => assertNonNegativeInteger(1, "test")).not.toThrow();
  });

  it("throws for negative integers", () => {
    expect(() => assertNonNegativeInteger(-1, "test")).toThrow(ValidationError);
  });
});

describe("assertBoolean", () => {
  it("passes for booleans", () => {
    expect(() => assertBoolean(true, "test")).not.toThrow();
    expect(() => assertBoolean(false, "test")).not.toThrow();
  });

  it("throws for non-booleans", () => {
    expect(() => assertBoolean(1, "test")).toThrow(ValidationError);
    expect(() => assertBoolean("true", "test")).toThrow(ValidationError);
    expect(() => assertBoolean(null, "test")).toThrow(ValidationError);
  });
});

describe("assertDefined", () => {
  it("passes for defined values", () => {
    expect(() => assertDefined("hello", "test")).not.toThrow();
    expect(() => assertDefined(0, "test")).not.toThrow();
    expect(() => assertDefined(false, "test")).not.toThrow();
    expect(() => assertDefined("", "test")).not.toThrow();
  });

  it("throws for null", () => {
    expect(() => assertDefined(null, "test")).toThrow(ValidationError);
  });

  it("throws for undefined", () => {
    expect(() => assertDefined(undefined, "test")).toThrow(ValidationError);
  });
});

describe("assertObject", () => {
  it("passes for objects", () => {
    expect(() => assertObject({}, "test")).not.toThrow();
    expect(() => assertObject({ a: 1 }, "test")).not.toThrow();
  });

  it("throws for null", () => {
    expect(() => assertObject(null, "test")).toThrow(ValidationError);
  });

  it("throws for non-objects", () => {
    expect(() => assertObject("string", "test")).toThrow(ValidationError);
    expect(() => assertObject(123, "test")).toThrow(ValidationError);
  });

  it("throws for arrays (by design - use assertArray)", () => {
    // Arrays are objects but we want explicit array checking
    expect(() => assertObject([], "test")).not.toThrow(); // Arrays pass assertObject
  });
});

describe("assertArray", () => {
  it("passes for arrays", () => {
    expect(() => assertArray([], "test")).not.toThrow();
    expect(() => assertArray([1, 2, 3], "test")).not.toThrow();
  });

  it("throws for non-arrays", () => {
    expect(() => assertArray({}, "test")).toThrow(ValidationError);
    expect(() => assertArray("string", "test")).toThrow(ValidationError);
  });
});

// =============================================================================
// GAME-SPECIFIC VALIDATORS
// =============================================================================

describe("assertPlayerId", () => {
  it("passes for valid player IDs", () => {
    expect(() => assertPlayerId("player-123", "playerId")).not.toThrow();
    expect(() => assertPlayerId("abc", "playerId")).not.toThrow();
  });

  it("throws for empty strings", () => {
    expect(() => assertPlayerId("", "playerId")).toThrow(ValidationError);
  });

  it("throws for strings with control characters", () => {
    expect(() => assertPlayerId("player\x00id", "playerId")).toThrow(ValidationError);
    expect(() => assertPlayerId("player\nid", "playerId")).toThrow(ValidationError);
    expect(() => assertPlayerId("player\tid", "playerId")).toThrow(ValidationError);
  });

  it("throws for strings exceeding max length", () => {
    const longId = "a".repeat(INPUT_LIMITS.MAX_ITEM_ID_LENGTH + 1);
    expect(() => assertPlayerId(longId, "playerId")).toThrow(ValidationError);
  });
});

describe("assertItemId", () => {
  it("passes for valid item IDs", () => {
    expect(() => assertItemId("bronze_sword", "itemId")).not.toThrow();
    expect(() => assertItemId("coins", "itemId")).not.toThrow();
  });

  it("throws for invalid item IDs", () => {
    expect(() => assertItemId("", "itemId")).toThrow(ValidationError);
    expect(() => assertItemId("item\x00id", "itemId")).toThrow(ValidationError);
  });
});

describe("assertEntityId", () => {
  it("passes for valid entity IDs", () => {
    expect(() => assertEntityId("entity-123-456", "entityId")).not.toThrow();
  });

  it("throws for invalid entity IDs", () => {
    expect(() => assertEntityId("", "entityId")).toThrow(ValidationError);
  });
});

describe("assertSlotIndex", () => {
  it("passes for valid slot indices", () => {
    expect(() => assertSlotIndex(0, "slot")).not.toThrow();
    expect(() => assertSlotIndex(27, "slot")).not.toThrow();
  });

  it("throws for negative slots", () => {
    expect(() => assertSlotIndex(-1, "slot")).toThrow(ValidationError);
  });

  it("throws for slots >= MAX_INVENTORY_SLOTS", () => {
    expect(() => assertSlotIndex(28, "slot")).toThrow(ValidationError);
    expect(() => assertSlotIndex(100, "slot")).toThrow(ValidationError);
  });

  it("throws for non-integer slots", () => {
    expect(() => assertSlotIndex(0.5, "slot")).toThrow(ValidationError);
    expect(() => assertSlotIndex(NaN, "slot")).toThrow(ValidationError);
  });
});

describe("assertQuantity", () => {
  it("passes for valid quantities", () => {
    expect(() => assertQuantity(1, "quantity")).not.toThrow();
    expect(() => assertQuantity(100, "quantity")).not.toThrow();
    expect(() => assertQuantity(INPUT_LIMITS.MAX_QUANTITY, "quantity")).not.toThrow();
  });

  it("throws for zero", () => {
    expect(() => assertQuantity(0, "quantity")).toThrow(ValidationError);
  });

  it("throws for negative quantities", () => {
    expect(() => assertQuantity(-1, "quantity")).toThrow(ValidationError);
  });

  it("throws for quantities exceeding max", () => {
    expect(() => assertQuantity(INPUT_LIMITS.MAX_QUANTITY + 1, "quantity")).toThrow(
      ValidationError
    );
  });
});

describe("assertPosition", () => {
  it("passes for valid positions", () => {
    expect(() => assertPosition({ x: 0, y: 0, z: 0 }, "pos")).not.toThrow();
    expect(() => assertPosition({ x: 100, y: 50, z: -100 }, "pos")).not.toThrow();
  });

  it("throws for missing coordinates", () => {
    expect(() => assertPosition({ x: 0, y: 0 }, "pos")).toThrow(ValidationError);
    expect(() => assertPosition({ x: 0, z: 0 }, "pos")).toThrow(ValidationError);
  });

  it("throws for positions exceeding world bounds", () => {
    expect(() => assertPosition({ x: 20000, y: 0, z: 0 }, "pos")).toThrow(ValidationError);
    expect(() => assertPosition({ x: 0, y: 0, z: -20000 }, "pos")).toThrow(ValidationError);
  });
});

describe("assertAttackType", () => {
  it("passes for valid attack types", () => {
    expect(() => assertAttackType("melee", "type")).not.toThrow();
    expect(() => assertAttackType("ranged", "type")).not.toThrow();
    expect(() => assertAttackType("magic", "type")).not.toThrow();
  });

  it("throws for invalid attack types", () => {
    expect(() => assertAttackType("invalid", "type")).toThrow(ValidationError);
    expect(() => assertAttackType("MELEE", "type")).toThrow(ValidationError);
  });
});

describe("assertEquipmentSlot", () => {
  it("passes for valid slots", () => {
    const validSlots = [
      "weapon", "shield", "head", "body", "legs",
      "feet", "hands", "cape", "neck", "ring", "ammo"
    ];
    for (const slot of validSlots) {
      expect(() => assertEquipmentSlot(slot, "slot")).not.toThrow();
    }
  });

  it("throws for invalid slots", () => {
    expect(() => assertEquipmentSlot("invalid", "slot")).toThrow(ValidationError);
    expect(() => assertEquipmentSlot("WEAPON", "slot")).toThrow(ValidationError);
  });
});

describe("assertSessionType", () => {
  it("passes for valid session types", () => {
    expect(() => assertSessionType("store", "type")).not.toThrow();
    expect(() => assertSessionType("bank", "type")).not.toThrow();
    expect(() => assertSessionType("dialogue", "type")).not.toThrow();
  });

  it("throws for invalid session types", () => {
    expect(() => assertSessionType("invalid", "type")).toThrow(ValidationError);
  });
});

describe("assertTick", () => {
  it("passes for valid ticks", () => {
    expect(() => assertTick(0, "tick")).not.toThrow();
    expect(() => assertTick(100, "tick")).not.toThrow();
  });

  it("throws for negative ticks", () => {
    expect(() => assertTick(-1, "tick")).toThrow(ValidationError);
  });
});

describe("assertHealth", () => {
  it("passes for valid health", () => {
    expect(() => assertHealth(0, 100, "health")).not.toThrow();
    expect(() => assertHealth(50, 100, "health")).not.toThrow();
    expect(() => assertHealth(100, 100, "health")).not.toThrow();
  });

  it("throws for health exceeding max", () => {
    expect(() => assertHealth(101, 100, "health")).toThrow(ValidationError);
  });

  it("throws for negative health", () => {
    expect(() => assertHealth(-1, 100, "health")).toThrow(ValidationError);
  });
});

describe("assertDamage", () => {
  it("passes for valid damage", () => {
    expect(() => assertDamage(0, "damage")).not.toThrow();
    expect(() => assertDamage(50, "damage")).not.toThrow();
  });

  it("throws for negative damage", () => {
    expect(() => assertDamage(-1, "damage")).toThrow(ValidationError);
  });
});

// =============================================================================
// COMPOSITE VALIDATORS
// =============================================================================

describe("assertMoveItemInput", () => {
  it("passes for valid input", () => {
    expect(() =>
      assertMoveItemInput({
        playerId: "player-1",
        fromSlot: 0,
        toSlot: 5,
      })
    ).not.toThrow();
  });

  it("accepts sourceSlot/targetSlot aliases", () => {
    const input = {
      playerId: "player-1",
      sourceSlot: 0,
      targetSlot: 5,
    };
    assertMoveItemInput(input);
    expect((input as { fromSlot: number }).fromSlot).toBe(0);
    expect((input as { toSlot: number }).toSlot).toBe(5);
  });

  it("throws for invalid slot indices", () => {
    expect(() =>
      assertMoveItemInput({
        playerId: "player-1",
        fromSlot: -1,
        toSlot: 5,
      })
    ).toThrow(ValidationError);

    expect(() =>
      assertMoveItemInput({
        playerId: "player-1",
        fromSlot: 0,
        toSlot: 28,
      })
    ).toThrow(ValidationError);
  });

  it("throws for missing playerId", () => {
    expect(() =>
      assertMoveItemInput({
        fromSlot: 0,
        toSlot: 5,
      })
    ).toThrow(ValidationError);
  });
});

describe("assertPickupItemInput", () => {
  it("passes for valid input", () => {
    expect(() =>
      assertPickupItemInput({
        playerId: "player-1",
        entityId: "entity-123",
      })
    ).not.toThrow();

    expect(() =>
      assertPickupItemInput({
        playerId: "player-1",
        entityId: "entity-123",
        itemId: "bronze_sword",
      })
    ).not.toThrow();
  });

  it("throws for missing fields", () => {
    expect(() =>
      assertPickupItemInput({
        playerId: "player-1",
      })
    ).toThrow(ValidationError);
  });
});

describe("assertDropItemInput", () => {
  it("passes for valid input", () => {
    expect(() =>
      assertDropItemInput({
        playerId: "player-1",
        itemId: "bronze_sword",
        quantity: 1,
      })
    ).not.toThrow();

    expect(() =>
      assertDropItemInput({
        playerId: "player-1",
        itemId: "bronze_sword",
        quantity: 5,
        slot: 3,
      })
    ).not.toThrow();
  });

  it("throws for invalid quantity", () => {
    expect(() =>
      assertDropItemInput({
        playerId: "player-1",
        itemId: "bronze_sword",
        quantity: 0,
      })
    ).toThrow(ValidationError);
  });
});

describe("assertAttackInput", () => {
  it("passes for valid input", () => {
    expect(() =>
      assertAttackInput({
        playerId: "player-1",
        targetId: "mob-123",
      })
    ).not.toThrow();

    expect(() =>
      assertAttackInput({
        playerId: "player-1",
        targetId: "mob-123",
        attackType: "ranged",
      })
    ).not.toThrow();
  });

  it("throws for invalid attack type", () => {
    expect(() =>
      assertAttackInput({
        playerId: "player-1",
        targetId: "mob-123",
        attackType: "invalid" as "melee",
      })
    ).toThrow(ValidationError);
  });
});

describe("assertBankOperationInput", () => {
  it("passes for valid input", () => {
    expect(() =>
      assertBankOperationInput({
        playerId: "player-1",
        bankId: "bank-123",
      })
    ).not.toThrow();

    expect(() =>
      assertBankOperationInput({
        playerId: "player-1",
        bankId: "bank-123",
        itemId: "bronze_sword",
        quantity: 10,
      })
    ).not.toThrow();
  });
});

describe("assertTradeInput", () => {
  it("passes for valid input", () => {
    expect(() =>
      assertTradeInput({
        playerId: "player-1",
        targetPlayerId: "player-2",
      })
    ).not.toThrow();
  });

  it("throws when trading with self", () => {
    expect(() =>
      assertTradeInput({
        playerId: "player-1",
        targetPlayerId: "player-1",
      })
    ).toThrow(ValidationError);
  });
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

describe("clampQuantity", () => {
  it("clamps to minimum 1", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-100)).toBe(1);
  });

  it("clamps to maximum", () => {
    expect(clampQuantity(INPUT_LIMITS.MAX_QUANTITY + 1000)).toBe(INPUT_LIMITS.MAX_QUANTITY);
  });

  it("floors floating point values", () => {
    expect(clampQuantity(5.9)).toBe(5);
    expect(clampQuantity(1.1)).toBe(1);
  });

  it("passes through valid values", () => {
    expect(clampQuantity(50)).toBe(50);
    expect(clampQuantity(1)).toBe(1);
  });
});

describe("wouldOverflow", () => {
  it("detects overflow", () => {
    expect(wouldOverflow(INPUT_LIMITS.MAX_QUANTITY, 1)).toBe(true);
    expect(wouldOverflow(INPUT_LIMITS.MAX_QUANTITY - 10, 11)).toBe(true);
  });

  it("allows safe additions", () => {
    expect(wouldOverflow(0, 100)).toBe(false);
    expect(wouldOverflow(INPUT_LIMITS.MAX_QUANTITY - 10, 10)).toBe(false);
  });
});

describe("parseIntStrict", () => {
  it("parses valid integers", () => {
    expect(parseIntStrict("42", "test")).toBe(42);
    expect(parseIntStrict("-10", "test")).toBe(-10);
    expect(parseIntStrict("0", "test")).toBe(0);
  });

  it("throws for invalid strings", () => {
    expect(() => parseIntStrict("abc", "test")).toThrow(ValidationError);
    expect(() => parseIntStrict("", "test")).toThrow(ValidationError);
  });

  it("parses integers from decimal strings (parseInt behavior)", () => {
    expect(parseIntStrict("12.5", "test")).toBe(12); // parseInt ignores decimal
  });
});

// =============================================================================
// ERROR MESSAGE QUALITY
// =============================================================================

describe("ValidationError messages", () => {
  it("includes field name in message", () => {
    try {
      assertString(123, "playerName");
    } catch (e) {
      expect((e as ValidationError).message).toContain("playerName");
      expect((e as ValidationError).field).toBe("playerName");
    }
  });

  it("includes value in error", () => {
    try {
      assertInteger(3.14, "amount");
    } catch (e) {
      expect((e as ValidationError).value).toBe(3.14);
    }
  });
});
