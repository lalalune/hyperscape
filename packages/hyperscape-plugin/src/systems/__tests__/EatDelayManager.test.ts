/**
 * EatDelayManager Unit Tests
 *
 * Tests for tile-based-MMORPG-accurate eating cooldown functionality:
 * - 3-tick (1.8s) eat delay between foods
 * - Cooldown state management per player
 * - Player cleanup on death/disconnect
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EatDelayManager } from "../EatDelayManager";
import { COMBAT_CONSTANTS } from "@hyperforge/shared";

describe("EatDelayManager", () => {
  let eatDelayManager: EatDelayManager;

  beforeEach(() => {
    eatDelayManager = new EatDelayManager();
  });

  describe("canEat", () => {
    it("returns true when player has never eaten", () => {
      const result = eatDelayManager.canEat("player-1", 100);
      expect(result).toBe(true);
    });

    it("returns false within 3 ticks of last eat", () => {
      eatDelayManager.recordEat("player-1", 100);

      // At tick 100, 101, 102 - should be on cooldown
      expect(eatDelayManager.canEat("player-1", 100)).toBe(false);
      expect(eatDelayManager.canEat("player-1", 101)).toBe(false);
      expect(eatDelayManager.canEat("player-1", 102)).toBe(false);
    });

    it("returns true after 3+ ticks since last eat", () => {
      eatDelayManager.recordEat("player-1", 100);

      // At tick 103 - cooldown should be expired
      expect(eatDelayManager.canEat("player-1", 103)).toBe(true);
      expect(eatDelayManager.canEat("player-1", 104)).toBe(true);
    });

    it("returns true exactly at 3 tick boundary (tile-based-MMORPG-accurate)", () => {
      eatDelayManager.recordEat("player-1", 100);

      // classic MMORPG behavior: can eat exactly at 3 ticks elapsed
      // elapsed = current - last = 103 - 100 = 3
      // 3 >= EAT_DELAY_TICKS (3) = true
      expect(eatDelayManager.canEat("player-1", 103)).toBe(true);
    });

    it("tracks multiple players independently", () => {
      eatDelayManager.recordEat("player-1", 100);
      eatDelayManager.recordEat("player-2", 102);

      // At tick 103:
      // player-1: elapsed = 3, can eat
      // player-2: elapsed = 1, cannot eat
      expect(eatDelayManager.canEat("player-1", 103)).toBe(true);
      expect(eatDelayManager.canEat("player-2", 103)).toBe(false);
    });
  });

  describe("getRemainingCooldown", () => {
    it("returns 0 when ready to eat (never eaten)", () => {
      const result = eatDelayManager.getRemainingCooldown("player-1", 100);
      expect(result).toBe(0);
    });

    it("returns 0 when cooldown expired", () => {
      eatDelayManager.recordEat("player-1", 100);

      const result = eatDelayManager.getRemainingCooldown("player-1", 103);
      expect(result).toBe(0);
    });

    it("returns correct remaining ticks during cooldown", () => {
      eatDelayManager.recordEat("player-1", 100);

      // At tick 100: elapsed = 0, remaining = 3 - 0 = 3
      expect(eatDelayManager.getRemainingCooldown("player-1", 100)).toBe(
        COMBAT_CONSTANTS.EAT_DELAY_TICKS,
      );

      // At tick 101: elapsed = 1, remaining = 3 - 1 = 2
      expect(eatDelayManager.getRemainingCooldown("player-1", 101)).toBe(2);

      // At tick 102: elapsed = 2, remaining = 3 - 2 = 1
      expect(eatDelayManager.getRemainingCooldown("player-1", 102)).toBe(1);
    });

    it("never returns negative values", () => {
      eatDelayManager.recordEat("player-1", 100);

      // Far in the future
      const result = eatDelayManager.getRemainingCooldown("player-1", 1000);
      expect(result).toBe(0);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("recordEat", () => {
    it("stores current tick for player", () => {
      eatDelayManager.recordEat("player-1", 100);

      // Verify by checking cooldown state
      expect(eatDelayManager.canEat("player-1", 100)).toBe(false);
      expect(eatDelayManager.canEat("player-1", 103)).toBe(true);
    });

    it("updates existing entry for same player", () => {
      eatDelayManager.recordEat("player-1", 100);
      expect(eatDelayManager.canEat("player-1", 103)).toBe(true);

      // Eat again at tick 103
      eatDelayManager.recordEat("player-1", 103);

      // Now cooldown resets - cannot eat until tick 106
      expect(eatDelayManager.canEat("player-1", 103)).toBe(false);
      expect(eatDelayManager.canEat("player-1", 106)).toBe(true);
    });
  });

  describe("clearPlayer", () => {
    it("removes player from tracking map", () => {
      eatDelayManager.recordEat("player-1", 100);
      expect(eatDelayManager.getTrackedCount()).toBe(1);

      eatDelayManager.clearPlayer("player-1");
      expect(eatDelayManager.getTrackedCount()).toBe(0);
    });

    it("allows immediate eating after clear", () => {
      eatDelayManager.recordEat("player-1", 100);

      // On cooldown
      expect(eatDelayManager.canEat("player-1", 101)).toBe(false);

      // Clear (simulating death/disconnect)
      eatDelayManager.clearPlayer("player-1");

      // Can now eat immediately
      expect(eatDelayManager.canEat("player-1", 101)).toBe(true);
    });

    it("handles clearing non-existent player gracefully", () => {
      // Should not throw
      expect(() => eatDelayManager.clearPlayer("nonexistent")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("clears all player state", () => {
      eatDelayManager.recordEat("player-1", 100);
      eatDelayManager.recordEat("player-2", 100);
      eatDelayManager.recordEat("player-3", 100);
      expect(eatDelayManager.getTrackedCount()).toBe(3);

      eatDelayManager.clear();
      expect(eatDelayManager.getTrackedCount()).toBe(0);
    });
  });

  describe("getTrackedCount", () => {
    it("returns 0 initially", () => {
      expect(eatDelayManager.getTrackedCount()).toBe(0);
    });

    it("returns correct count after tracking players", () => {
      eatDelayManager.recordEat("player-1", 100);
      expect(eatDelayManager.getTrackedCount()).toBe(1);

      eatDelayManager.recordEat("player-2", 100);
      expect(eatDelayManager.getTrackedCount()).toBe(2);
    });
  });

  describe("classic MMORPG timing accuracy", () => {
    it("uses exactly 3 ticks for eat delay (1.8 seconds)", () => {
      // Verify constant matches classic MMORPG wiki
      expect(COMBAT_CONSTANTS.EAT_DELAY_TICKS).toBe(3);
    });

    it("allows eating on tick 3 (not tick 4)", () => {
      eatDelayManager.recordEat("player-1", 0);

      // Cannot eat on ticks 0, 1, 2
      expect(eatDelayManager.canEat("player-1", 0)).toBe(false);
      expect(eatDelayManager.canEat("player-1", 1)).toBe(false);
      expect(eatDelayManager.canEat("player-1", 2)).toBe(false);

      // CAN eat on tick 3 (3 ticks elapsed: 0->1->2->3)
      expect(eatDelayManager.canEat("player-1", 3)).toBe(true);
    });
  });
});
