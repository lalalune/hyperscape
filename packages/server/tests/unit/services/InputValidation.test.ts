/**
 * InputValidation Unit Tests
 *
 * Tests for server-side input validation utilities.
 * Verifies:
 * - Item ID validation
 * - Store ID validation
 * - Quantity validation
 * - Slot validation (inventory, bank)
 * - NPC ID validation
 * - Timestamp validation (replay attack prevention)
 * - Bank-specific validations
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidItemId,
  isValidStoreId,
  isValidQuantity,
  wouldOverflow,
  isValidInventorySlot,
  isValidBankSlot,
  isValidBankMoveMode,
  isValidBankTabIndex,
  isValidCustomBankTabIndex,
  isValidNpcId,
  isValidResponseIndex,
  validateRequestTimestamp,
  isValidSlotIndex,
} from "../../../src/systems/ServerNetwork/services/InputValidation";
import { INPUT_LIMITS } from "@hyperscape/shared";

describe("InputValidation", () => {
  describe("isValidItemId", () => {
    it("accepts valid item IDs", () => {
      expect(isValidItemId("bronze_sword")).toBe(true);
      expect(isValidItemId("iron_pickaxe")).toBe(true);
      expect(isValidItemId("coins")).toBe(true);
      expect(isValidItemId("item123")).toBe(true);
    });

    it("rejects empty strings", () => {
      expect(isValidItemId("")).toBe(false);
    });

    it("rejects strings exceeding max length", () => {
      const longId = "a".repeat(INPUT_LIMITS.MAX_ITEM_ID_LENGTH + 1);
      expect(isValidItemId(longId)).toBe(false);

      const maxLengthId = "a".repeat(INPUT_LIMITS.MAX_ITEM_ID_LENGTH);
      expect(isValidItemId(maxLengthId)).toBe(true);
    });

    it("rejects control characters", () => {
      expect(isValidItemId("item\x00id")).toBe(false);
      expect(isValidItemId("item\x1fid")).toBe(false);
      expect(isValidItemId("\x00")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isValidItemId(null)).toBe(false);
      expect(isValidItemId(undefined)).toBe(false);
      expect(isValidItemId(123)).toBe(false);
      expect(isValidItemId({})).toBe(false);
      expect(isValidItemId([])).toBe(false);
    });
  });

  describe("isValidStoreId", () => {
    it("accepts valid store IDs", () => {
      expect(isValidStoreId("general_store")).toBe(true);
      expect(isValidStoreId("bank")).toBe(true);
      expect(isValidStoreId("shop_123")).toBe(true);
    });

    it("rejects empty strings", () => {
      expect(isValidStoreId("")).toBe(false);
    });

    it("rejects strings exceeding max length", () => {
      const longId = "a".repeat(INPUT_LIMITS.MAX_STORE_ID_LENGTH + 1);
      expect(isValidStoreId(longId)).toBe(false);
    });

    it("rejects control characters", () => {
      expect(isValidStoreId("store\x00id")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isValidStoreId(null)).toBe(false);
      expect(isValidStoreId(undefined)).toBe(false);
      expect(isValidStoreId(123)).toBe(false);
    });
  });

  describe("isValidQuantity", () => {
    it("accepts positive integers within limit", () => {
      expect(isValidQuantity(1)).toBe(true);
      expect(isValidQuantity(100)).toBe(true);
      expect(isValidQuantity(1000000)).toBe(true);
    });

    it("accepts max quantity", () => {
      expect(isValidQuantity(INPUT_LIMITS.MAX_QUANTITY)).toBe(true);
    });

    it("rejects zero", () => {
      expect(isValidQuantity(0)).toBe(false);
    });

    it("rejects negative numbers", () => {
      expect(isValidQuantity(-1)).toBe(false);
      expect(isValidQuantity(-100)).toBe(false);
    });

    it("rejects quantities over max", () => {
      expect(isValidQuantity(INPUT_LIMITS.MAX_QUANTITY + 1)).toBe(false);
    });

    it("rejects non-integers", () => {
      expect(isValidQuantity(1.5)).toBe(false);
      expect(isValidQuantity(10.1)).toBe(false);
    });

    it("rejects non-numbers", () => {
      expect(isValidQuantity("10" as unknown as number)).toBe(false);
      expect(isValidQuantity(null)).toBe(false);
      expect(isValidQuantity(undefined)).toBe(false);
    });
  });

  describe("wouldOverflow", () => {
    it("returns false when sum is within limit", () => {
      expect(wouldOverflow(100, 100)).toBe(false);
      expect(wouldOverflow(0, 1000)).toBe(false);
    });

    it("returns false at exactly max quantity", () => {
      expect(wouldOverflow(INPUT_LIMITS.MAX_QUANTITY - 100, 100)).toBe(false);
    });

    it("returns true when sum exceeds limit", () => {
      expect(wouldOverflow(INPUT_LIMITS.MAX_QUANTITY, 1)).toBe(true);
      expect(wouldOverflow(INPUT_LIMITS.MAX_QUANTITY - 50, 100)).toBe(true);
    });
  });

  describe("isValidInventorySlot", () => {
    it("accepts valid slot indices", () => {
      expect(isValidInventorySlot(0)).toBe(true);
      expect(isValidInventorySlot(10)).toBe(true);
      expect(isValidInventorySlot(INPUT_LIMITS.MAX_INVENTORY_SLOTS - 1)).toBe(
        true,
      );
    });

    it("rejects negative slots", () => {
      expect(isValidInventorySlot(-1)).toBe(false);
    });

    it("rejects slots at or above max", () => {
      expect(isValidInventorySlot(INPUT_LIMITS.MAX_INVENTORY_SLOTS)).toBe(
        false,
      );
      expect(isValidInventorySlot(INPUT_LIMITS.MAX_INVENTORY_SLOTS + 1)).toBe(
        false,
      );
    });

    it("rejects non-integers", () => {
      expect(isValidInventorySlot(1.5)).toBe(false);
      expect(isValidInventorySlot(NaN)).toBe(false);
    });

    it("rejects non-numbers", () => {
      expect(isValidInventorySlot("5" as unknown as number)).toBe(false);
      expect(isValidInventorySlot(null)).toBe(false);
    });
  });

  describe("isValidBankSlot", () => {
    it("accepts valid slot indices", () => {
      expect(isValidBankSlot(0)).toBe(true);
      expect(isValidBankSlot(100)).toBe(true);
      expect(isValidBankSlot(INPUT_LIMITS.MAX_BANK_SLOTS - 1)).toBe(true);
    });

    it("rejects negative slots", () => {
      expect(isValidBankSlot(-1)).toBe(false);
    });

    it("rejects slots at or above max", () => {
      expect(isValidBankSlot(INPUT_LIMITS.MAX_BANK_SLOTS)).toBe(false);
    });
  });

  describe("isValidBankMoveMode", () => {
    it("accepts 'swap' mode", () => {
      expect(isValidBankMoveMode("swap")).toBe(true);
    });

    it("accepts 'insert' mode", () => {
      expect(isValidBankMoveMode("insert")).toBe(true);
    });

    it("rejects other strings", () => {
      expect(isValidBankMoveMode("move")).toBe(false);
      expect(isValidBankMoveMode("SWAP")).toBe(false);
      expect(isValidBankMoveMode("")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isValidBankMoveMode(null)).toBe(false);
      expect(isValidBankMoveMode(undefined)).toBe(false);
      expect(isValidBankMoveMode(1)).toBe(false);
    });
  });

  describe("isValidBankTabIndex", () => {
    it("accepts main tab (0)", () => {
      expect(isValidBankTabIndex(0)).toBe(true);
    });

    it("accepts custom tabs (1-9)", () => {
      for (let i = 1; i <= 9; i++) {
        expect(isValidBankTabIndex(i)).toBe(true);
      }
    });

    it("rejects tab indices above 9", () => {
      expect(isValidBankTabIndex(10)).toBe(false);
      expect(isValidBankTabIndex(100)).toBe(false);
    });

    it("rejects negative tab indices", () => {
      expect(isValidBankTabIndex(-1)).toBe(false);
    });

    it("rejects non-integers", () => {
      expect(isValidBankTabIndex(1.5)).toBe(false);
    });
  });

  describe("isValidCustomBankTabIndex", () => {
    it("accepts custom tabs (1-9)", () => {
      for (let i = 1; i <= 9; i++) {
        expect(isValidCustomBankTabIndex(i)).toBe(true);
      }
    });

    it("rejects main tab (0)", () => {
      expect(isValidCustomBankTabIndex(0)).toBe(false);
    });

    it("rejects tab indices above 9", () => {
      expect(isValidCustomBankTabIndex(10)).toBe(false);
    });
  });

  describe("isValidNpcId", () => {
    it("accepts valid NPC IDs", () => {
      expect(isValidNpcId("goblin")).toBe(true);
      expect(isValidNpcId("guard_123")).toBe(true);
      expect(isValidNpcId("mob_skeleton_warrior")).toBe(true);
    });

    it("rejects empty strings", () => {
      expect(isValidNpcId("")).toBe(false);
    });

    it("rejects control characters", () => {
      expect(isValidNpcId("npc\x00id")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isValidNpcId(null)).toBe(false);
      expect(isValidNpcId(123)).toBe(false);
    });
  });

  describe("isValidResponseIndex", () => {
    it("accepts valid response indices (0-9)", () => {
      for (let i = 0; i < 10; i++) {
        expect(isValidResponseIndex(i)).toBe(true);
      }
    });

    it("rejects index 10 and above", () => {
      expect(isValidResponseIndex(10)).toBe(false);
      expect(isValidResponseIndex(100)).toBe(false);
    });

    it("rejects negative indices", () => {
      expect(isValidResponseIndex(-1)).toBe(false);
    });
  });

  describe("validateRequestTimestamp", () => {
    it("accepts valid recent timestamps", () => {
      const now = Date.now();
      const result = validateRequestTimestamp(now, now);
      expect(result.valid).toBe(true);
    });

    it("accepts timestamps within max age", () => {
      const now = Date.now();
      const oldTimestamp = now - INPUT_LIMITS.MAX_REQUEST_AGE_MS + 1000;
      const result = validateRequestTimestamp(oldTimestamp, now);
      expect(result.valid).toBe(true);
    });

    it("rejects timestamps too old (replay attack)", () => {
      const now = Date.now();
      const oldTimestamp = now - INPUT_LIMITS.MAX_REQUEST_AGE_MS - 1;
      const result = validateRequestTimestamp(oldTimestamp, now);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("too old");
    });

    it("accepts timestamps within clock skew tolerance", () => {
      const now = Date.now();
      const futureTimestamp = now + INPUT_LIMITS.MAX_CLOCK_SKEW_MS - 100;
      const result = validateRequestTimestamp(futureTimestamp, now);
      expect(result.valid).toBe(true);
    });

    it("rejects timestamps too far in future (clock manipulation)", () => {
      const now = Date.now();
      const futureTimestamp = now + INPUT_LIMITS.MAX_CLOCK_SKEW_MS + 1000;
      const result = validateRequestTimestamp(futureTimestamp, now);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("future");
    });

    it("rejects non-number timestamps", () => {
      const result = validateRequestTimestamp("12345");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid timestamp format");
    });

    it("rejects NaN timestamps", () => {
      const result = validateRequestTimestamp(NaN);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid timestamp format");
    });

    it("rejects Infinity timestamps", () => {
      const result = validateRequestTimestamp(Infinity);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid timestamp format");
    });

    it("uses current time as default server time", () => {
      const now = Date.now();
      const result = validateRequestTimestamp(now);
      expect(result.valid).toBe(true);
    });
  });

  describe("isValidSlotIndex", () => {
    it("accepts valid indices within max", () => {
      expect(isValidSlotIndex(0, 10)).toBe(true);
      expect(isValidSlotIndex(5, 10)).toBe(true);
      expect(isValidSlotIndex(9, 10)).toBe(true);
    });

    it("rejects index at max", () => {
      expect(isValidSlotIndex(10, 10)).toBe(false);
    });

    it("rejects index above max", () => {
      expect(isValidSlotIndex(11, 10)).toBe(false);
    });

    it("rejects negative indices", () => {
      expect(isValidSlotIndex(-1, 10)).toBe(false);
    });

    it("rejects non-integers", () => {
      expect(isValidSlotIndex(1.5, 10)).toBe(false);
    });
  });
});
