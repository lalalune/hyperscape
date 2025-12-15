/**
 * SlidingWindowRateLimiter Unit Tests
 *
 * Tests for the rate limiting infrastructure used by combat and other handlers.
 * Verifies:
 * - Per-player rate limiting
 * - Sliding window behavior
 * - Automatic stale entry cleanup
 * - Pre-configured singleton instances
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createRateLimiter,
  getPickupRateLimiter,
  getMoveRateLimiter,
  getDropRateLimiter,
  getEquipRateLimiter,
  getTileMovementRateLimiter,
  getPathfindRateLimiter,
  getCombatRateLimiter,
  destroyAllRateLimiters,
  type RateLimiter,
} from "../../../src/systems/ServerNetwork/services/SlidingWindowRateLimiter";

describe("SlidingWindowRateLimiter", () => {
  describe("createRateLimiter", () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = createRateLimiter({
        maxPerSecond: 5,
        name: "test-limiter",
        cleanupInterval: 60000,
        staleThreshold: 60000,
      });
    });

    afterEach(() => {
      limiter.destroy();
    });

    it("allows requests within limit", () => {
      const playerId = "player-1";

      // Should allow 5 requests per second
      expect(limiter.check(playerId)).toBe(true);
      expect(limiter.check(playerId)).toBe(true);
      expect(limiter.check(playerId)).toBe(true);
      expect(limiter.check(playerId)).toBe(true);
      expect(limiter.check(playerId)).toBe(true);
    });

    it("blocks requests over limit", () => {
      const playerId = "player-1";

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(playerId);
      }

      // 6th request should be blocked
      expect(limiter.check(playerId)).toBe(false);
    });

    it("tracks separate limits per player", () => {
      const player1 = "player-1";
      const player2 = "player-2";

      // Use up player 1's limit
      for (let i = 0; i < 5; i++) {
        limiter.check(player1);
      }

      // Player 2 should still have their full limit
      expect(limiter.check(player2)).toBe(true);
      expect(limiter.check(player2)).toBe(true);
      expect(limiter.check(player2)).toBe(true);
    });

    it("resets window after 1 second", async () => {
      const playerId = "player-1";

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(playerId);
      }
      expect(limiter.check(playerId)).toBe(false);

      // Wait for window to reset (1100ms to be safe)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      expect(limiter.check(playerId)).toBe(true);
    });

    it("returns correct count via getCount", () => {
      const playerId = "player-1";

      expect(limiter.getCount(playerId)).toBe(0);

      limiter.check(playerId);
      expect(limiter.getCount(playerId)).toBe(1);

      limiter.check(playerId);
      limiter.check(playerId);
      expect(limiter.getCount(playerId)).toBe(3);
    });

    it("returns 0 count after window expires", async () => {
      const playerId = "player-1";

      limiter.check(playerId);
      limiter.check(playerId);
      expect(limiter.getCount(playerId)).toBe(2);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(limiter.getCount(playerId)).toBe(0);
    });

    it("resets player limit via reset method", () => {
      const playerId = "player-1";

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(playerId);
      }
      expect(limiter.check(playerId)).toBe(false);

      // Reset the player
      limiter.reset(playerId);

      // Should be allowed again
      expect(limiter.check(playerId)).toBe(true);
      expect(limiter.getCount(playerId)).toBe(1);
    });

    it("tracks size correctly", () => {
      expect(limiter.size).toBe(0);

      limiter.check("player-1");
      expect(limiter.size).toBe(1);

      limiter.check("player-2");
      expect(limiter.size).toBe(2);

      limiter.check("player-1"); // Same player
      expect(limiter.size).toBe(2);

      limiter.reset("player-1");
      expect(limiter.size).toBe(1);
    });

    it("exposes name property", () => {
      expect(limiter.name).toBe("test-limiter");
    });

    it("cleans up on destroy", () => {
      limiter.check("player-1");
      limiter.check("player-2");

      limiter.destroy();

      expect(limiter.size).toBe(0);
    });
  });

  describe("Pre-configured Rate Limiters", () => {
    afterEach(() => {
      destroyAllRateLimiters();
    });

    it("getCombatRateLimiter returns singleton with 3/sec limit", () => {
      const limiter1 = getCombatRateLimiter();
      const limiter2 = getCombatRateLimiter();

      // Should be same instance
      expect(limiter1).toBe(limiter2);
      expect(limiter1.name).toBe("combat-attack");

      // Should allow 3 requests
      expect(limiter1.check("player")).toBe(true);
      expect(limiter1.check("player")).toBe(true);
      expect(limiter1.check("player")).toBe(true);
      expect(limiter1.check("player")).toBe(false);
    });

    it("getPickupRateLimiter returns singleton with 5/sec limit", () => {
      const limiter = getPickupRateLimiter();
      expect(limiter.name).toBe("inventory-pickup");

      for (let i = 0; i < 5; i++) {
        expect(limiter.check("player")).toBe(true);
      }
      expect(limiter.check("player")).toBe(false);
    });

    it("getMoveRateLimiter returns singleton with 10/sec limit", () => {
      const limiter = getMoveRateLimiter();
      expect(limiter.name).toBe("inventory-move");

      for (let i = 0; i < 10; i++) {
        expect(limiter.check("player")).toBe(true);
      }
      expect(limiter.check("player")).toBe(false);
    });

    it("getDropRateLimiter returns singleton with 5/sec limit", () => {
      const limiter = getDropRateLimiter();
      expect(limiter.name).toBe("inventory-drop");

      for (let i = 0; i < 5; i++) {
        expect(limiter.check("player")).toBe(true);
      }
      expect(limiter.check("player")).toBe(false);
    });

    it("getEquipRateLimiter returns singleton with 5/sec limit", () => {
      const limiter = getEquipRateLimiter();
      expect(limiter.name).toBe("inventory-equip");

      for (let i = 0; i < 5; i++) {
        expect(limiter.check("player")).toBe(true);
      }
      expect(limiter.check("player")).toBe(false);
    });

    it("getTileMovementRateLimiter returns singleton with 15/sec limit", () => {
      const limiter = getTileMovementRateLimiter();
      expect(limiter.name).toBe("tile-movement");

      for (let i = 0; i < 15; i++) {
        expect(limiter.check("player")).toBe(true);
      }
      expect(limiter.check("player")).toBe(false);
    });

    it("getPathfindRateLimiter returns singleton with 5/sec limit", () => {
      const limiter = getPathfindRateLimiter();
      expect(limiter.name).toBe("pathfinding");

      for (let i = 0; i < 5; i++) {
        expect(limiter.check("player")).toBe(true);
      }
      expect(limiter.check("player")).toBe(false);
    });

    it("destroyAllRateLimiters cleans up all singletons", () => {
      const combat = getCombatRateLimiter();
      const pickup = getPickupRateLimiter();
      const move = getMoveRateLimiter();

      combat.check("player");
      pickup.check("player");
      move.check("player");

      destroyAllRateLimiters();

      // Getting new instances should be fresh
      const newCombat = getCombatRateLimiter();
      expect(newCombat.size).toBe(0);
    });

    it("rate limiters track different players independently", () => {
      const limiter = getCombatRateLimiter();

      // Player 1 uses up their limit
      for (let i = 0; i < 3; i++) {
        limiter.check("player1");
      }
      expect(limiter.check("player1")).toBe(false);

      // Player 2 should still have full limit
      expect(limiter.check("player2")).toBe(true);
      expect(limiter.check("player2")).toBe(true);
      expect(limiter.check("player2")).toBe(true);
      expect(limiter.check("player2")).toBe(false);
    });
  });
});
