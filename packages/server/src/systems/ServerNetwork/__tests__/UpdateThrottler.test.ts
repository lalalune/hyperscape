/**
 * Update Throttler Tests
 *
 * Tests for distance-based update rate limiting.
 *
 * NO MOCKS - Tests actual throttling logic
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  UpdateThrottler,
  UpdatePriority,
  distance2D,
  distance2DSquared,
} from "../UpdateThrottler";

describe("UpdateThrottler", () => {
  let throttler: UpdateThrottler;

  beforeEach(() => {
    throttler = new UpdateThrottler();
  });

  describe("shouldUpdate", () => {
    it("should always allow first update", () => {
      throttler.setCurrentTick(0);
      expect(throttler.shouldUpdate("entity1", "player1", 50)).toBe(true);
    });

    it("should always allow CRITICAL priority", () => {
      throttler.setCurrentTick(0);
      throttler.shouldUpdate("entity1", "player1", 100);

      // Same tick, should normally be throttled, but CRITICAL bypasses
      expect(
        throttler.shouldUpdate(
          "entity1",
          "player1",
          100,
          UpdatePriority.CRITICAL,
        ),
      ).toBe(true);
    });

    it("should throttle based on distance tiers", () => {
      throttler.setCurrentTick(0);

      // Near entity (0-25m) - every tick
      throttler.shouldUpdate("near", "player1", 10);
      throttler.setCurrentTick(1);
      expect(throttler.shouldUpdate("near", "player1", 10)).toBe(true);

      // Medium entity (25-50m) - every 2nd tick
      throttler.setCurrentTick(0);
      throttler.shouldUpdate("medium", "player1", 35);
      throttler.setCurrentTick(1);
      expect(throttler.shouldUpdate("medium", "player1", 35)).toBe(false);
      throttler.setCurrentTick(2);
      expect(throttler.shouldUpdate("medium", "player1", 35)).toBe(true);

      // Far entity (50-100m) - every 4th tick
      throttler.setCurrentTick(0);
      throttler.shouldUpdate("far", "player1", 75);
      throttler.setCurrentTick(1);
      expect(throttler.shouldUpdate("far", "player1", 75)).toBe(false);
      throttler.setCurrentTick(2);
      expect(throttler.shouldUpdate("far", "player1", 75)).toBe(false);
      throttler.setCurrentTick(3);
      expect(throttler.shouldUpdate("far", "player1", 75)).toBe(false);
      throttler.setCurrentTick(4);
      expect(throttler.shouldUpdate("far", "player1", 75)).toBe(true);
    });

    it("should respect HIGH priority for faster updates", () => {
      throttler.setCurrentTick(0);

      // Far entity with HIGH priority should update every 2nd tick instead of 4th
      throttler.shouldUpdate("entity1", "player1", 75, UpdatePriority.HIGH);
      throttler.setCurrentTick(1);
      expect(
        throttler.shouldUpdate("entity1", "player1", 75, UpdatePriority.HIGH),
      ).toBe(false);
      throttler.setCurrentTick(2);
      expect(
        throttler.shouldUpdate("entity1", "player1", 75, UpdatePriority.HIGH),
      ).toBe(true);
    });

    it("should respect LOW priority for slower updates", () => {
      throttler.setCurrentTick(0);

      // Medium entity with LOW priority should update every 4th tick instead of 2nd
      throttler.shouldUpdate("entity1", "player1", 35, UpdatePriority.LOW);
      throttler.setCurrentTick(1);
      expect(
        throttler.shouldUpdate("entity1", "player1", 35, UpdatePriority.LOW),
      ).toBe(false);
      throttler.setCurrentTick(2);
      expect(
        throttler.shouldUpdate("entity1", "player1", 35, UpdatePriority.LOW),
      ).toBe(false);
      throttler.setCurrentTick(3);
      expect(
        throttler.shouldUpdate("entity1", "player1", 35, UpdatePriority.LOW),
      ).toBe(false);
      throttler.setCurrentTick(4);
      expect(
        throttler.shouldUpdate("entity1", "player1", 35, UpdatePriority.LOW),
      ).toBe(true);
    });

    it("should track separate state per player-entity pair", () => {
      throttler.setCurrentTick(0);

      // Entity1 updates for player1
      throttler.shouldUpdate("entity1", "player1", 50);

      // Entity1 should also allow first update for player2
      expect(throttler.shouldUpdate("entity1", "player2", 50)).toBe(true);

      // Entity2 should also allow first update for player1
      expect(throttler.shouldUpdate("entity2", "player1", 50)).toBe(true);
    });
  });

  describe("forceUpdate", () => {
    it("should mark last update time", () => {
      throttler.setCurrentTick(10);
      throttler.forceUpdate("entity1", "player1");

      // Next tick should check from tick 10
      throttler.setCurrentTick(11);
      // Medium distance (every 2 ticks) should not update yet
      expect(throttler.shouldUpdate("entity1", "player1", 35)).toBe(false);

      throttler.setCurrentTick(12);
      expect(throttler.shouldUpdate("entity1", "player1", 35)).toBe(true);
    });
  });

  describe("removePlayer", () => {
    it("should clear all state for player", () => {
      throttler.setCurrentTick(0);
      throttler.shouldUpdate("entity1", "player1", 50);
      throttler.shouldUpdate("entity2", "player1", 50);

      throttler.removePlayer("player1");

      // After removal, should allow first update again
      throttler.setCurrentTick(0);
      expect(throttler.shouldUpdate("entity1", "player1", 50)).toBe(true);
    });
  });

  describe("removeEntity", () => {
    it("should clear all state for entity", () => {
      throttler.setCurrentTick(0);
      throttler.shouldUpdate("entity1", "player1", 50);
      throttler.shouldUpdate("entity1", "player2", 50);

      throttler.removeEntity("entity1");

      // After removal, should allow first update again
      throttler.setCurrentTick(0);
      expect(throttler.shouldUpdate("entity1", "player1", 50)).toBe(true);
      expect(throttler.shouldUpdate("entity1", "player2", 50)).toBe(true);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      throttler.setCurrentTick(5);
      throttler.shouldUpdate("entity1", "player1", 10);
      throttler.shouldUpdate("entity2", "player1", 50);
      throttler.shouldUpdate("entity1", "player2", 100);

      const stats = throttler.getStats();

      expect(stats.currentTick).toBe(5);
      expect(stats.trackedPairs).toBe(3);
      expect(stats.tierDistribution.length).toBeGreaterThan(0);
    });
  });

  describe("clear", () => {
    it("should clear all state", () => {
      throttler.setCurrentTick(5);
      throttler.shouldUpdate("entity1", "player1", 50);

      throttler.clear();

      const stats = throttler.getStats();
      expect(stats.trackedPairs).toBe(0);
      expect(stats.currentTick).toBe(0);
    });
  });
});

describe("distance utilities", () => {
  describe("distance2D", () => {
    it("should calculate correct 2D distance", () => {
      expect(distance2D(0, 0, 3, 4)).toBe(5);
      expect(distance2D(0, 0, 0, 0)).toBe(0);
      expect(distance2D(-5, -5, 5, 5)).toBeCloseTo(14.14, 1);
    });
  });

  describe("distance2DSquared", () => {
    it("should calculate correct squared distance", () => {
      expect(distance2DSquared(0, 0, 3, 4)).toBe(25);
      expect(distance2DSquared(0, 0, 0, 0)).toBe(0);
      expect(distance2DSquared(-5, -5, 5, 5)).toBe(200);
    });
  });
});
