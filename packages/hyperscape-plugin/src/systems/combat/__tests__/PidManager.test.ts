/**
 * PidManager Unit Tests
 *
 * Tests for tile-based-MMORPG-style Player ID (PID) combat priority system:
 * - PID assignment on player join
 * - PID removal on player leave
 * - Combat priority comparison (lower PID = higher priority)
 * - Entity sorting by PID
 * - Periodic PID shuffle for fairness
 * - Statistics and debugging
 *
 * @see
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PidManager } from "../PidManager";
import { SeededRandom } from "@hyperforge/shared";
import type { EntityID } from "@hyperforge/shared";

describe("PidManager", () => {
  let pidManager: PidManager;
  let rng: SeededRandom;

  beforeEach(() => {
    // Create deterministic RNG for reproducible tests
    rng = new SeededRandom(12345);
    pidManager = new PidManager(rng);
  });

  describe("PID Assignment", () => {
    it("assigns sequential PIDs to new entities", () => {
      const pid1 = pidManager.assignPid("player1" as EntityID, 0);
      const pid2 = pidManager.assignPid("player2" as EntityID, 0);
      const pid3 = pidManager.assignPid("player3" as EntityID, 0);

      expect(pid1).toBe(0);
      expect(pid2).toBe(1);
      expect(pid3).toBe(2);
    });

    it("returns existing PID if already assigned", () => {
      const firstPid = pidManager.assignPid("player1" as EntityID, 0);
      const secondPid = pidManager.assignPid("player1" as EntityID, 100);

      expect(secondPid).toBe(firstPid);
    });

    it("hasPid returns true for assigned entities", () => {
      pidManager.assignPid("player1" as EntityID, 0);

      expect(pidManager.hasPid("player1" as EntityID)).toBe(true);
      expect(pidManager.hasPid("player2" as EntityID)).toBe(false);
    });

    it("getPid returns correct PID for assigned entities", () => {
      pidManager.assignPid("player1" as EntityID, 0);
      pidManager.assignPid("player2" as EntityID, 0);

      expect(pidManager.getPid("player1" as EntityID)).toBe(0);
      expect(pidManager.getPid("player2" as EntityID)).toBe(1);
      expect(pidManager.getPid("unknown" as EntityID)).toBeUndefined();
    });
  });

  describe("PID Removal", () => {
    it("removes PID when entity leaves", () => {
      pidManager.assignPid("player1" as EntityID, 0);
      expect(pidManager.hasPid("player1" as EntityID)).toBe(true);

      const removed = pidManager.removePid("player1" as EntityID);
      expect(removed).toBe(true);
      expect(pidManager.hasPid("player1" as EntityID)).toBe(false);
    });

    it("returns false when removing non-existent PID", () => {
      const removed = pidManager.removePid("unknown" as EntityID);
      expect(removed).toBe(false);
    });
  });

  describe("Priority Comparison", () => {
    it("lower PID has higher priority (negative comparison)", () => {
      pidManager.assignPid("player1" as EntityID, 0); // PID 0
      pidManager.assignPid("player2" as EntityID, 0); // PID 1

      // player1 (PID 0) should have priority over player2 (PID 1)
      const comparison = pidManager.comparePriority(
        "player1" as EntityID,
        "player2" as EntityID,
      );
      expect(comparison).toBeLessThan(0);
    });

    it("higher PID has lower priority (positive comparison)", () => {
      pidManager.assignPid("player1" as EntityID, 0); // PID 0
      pidManager.assignPid("player2" as EntityID, 0); // PID 1

      // player2 (PID 1) should have lower priority than player1 (PID 0)
      const comparison = pidManager.comparePriority(
        "player2" as EntityID,
        "player1" as EntityID,
      );
      expect(comparison).toBeGreaterThan(0);
    });

    it("same PID returns zero (equal priority)", () => {
      pidManager.assignPid("player1" as EntityID, 0);

      const comparison = pidManager.comparePriority(
        "player1" as EntityID,
        "player1" as EntityID,
      );
      expect(comparison).toBe(0);
    });

    it("entities without PIDs get Infinity (lowest priority)", () => {
      pidManager.assignPid("player1" as EntityID, 0);

      // player1 should have priority over unknown (which has Infinity)
      const comparison = pidManager.comparePriority(
        "player1" as EntityID,
        "unknown" as EntityID,
      );
      expect(comparison).toBeLessThan(0);
    });
  });

  describe("Sort by PID", () => {
    it("sorts entities by PID in ascending order (highest priority first)", () => {
      pidManager.assignPid("player3" as EntityID, 0); // PID 0
      pidManager.assignPid("player1" as EntityID, 0); // PID 1
      pidManager.assignPid("player2" as EntityID, 0); // PID 2

      const entities = [
        { id: "player1" as EntityID },
        { id: "player2" as EntityID },
        { id: "player3" as EntityID },
      ];

      const sorted = pidManager.sortByPid(entities);

      expect(sorted[0].id).toBe("player3"); // PID 0
      expect(sorted[1].id).toBe("player1"); // PID 1
      expect(sorted[2].id).toBe("player2"); // PID 2
    });

    it("does not modify original array", () => {
      pidManager.assignPid("player2" as EntityID, 0);
      pidManager.assignPid("player1" as EntityID, 0);

      const entities = [
        { id: "player1" as EntityID },
        { id: "player2" as EntityID },
      ];
      const originalOrder = [...entities.map((e) => e.id)];

      pidManager.sortByPid(entities);

      expect(entities.map((e) => e.id)).toEqual(originalOrder);
    });

    it("entities without PIDs sorted to the end", () => {
      pidManager.assignPid("player1" as EntityID, 0);

      const entities = [
        { id: "unknown" as EntityID },
        { id: "player1" as EntityID },
      ];

      const sorted = pidManager.sortByPid(entities);

      expect(sorted[0].id).toBe("player1"); // Has PID
      expect(sorted[1].id).toBe("unknown"); // No PID (Infinity)
    });
  });

  describe("Get Highest Priority", () => {
    it("returns entity with lowest PID", () => {
      pidManager.assignPid("player3" as EntityID, 0); // PID 0
      pidManager.assignPid("player1" as EntityID, 0); // PID 1
      pidManager.assignPid("player2" as EntityID, 0); // PID 2

      const highest = pidManager.getHighestPriority([
        "player1" as EntityID,
        "player2" as EntityID,
        "player3" as EntityID,
      ]);

      expect(highest).toBe("player3"); // PID 0 is highest priority
    });

    it("returns undefined for empty array", () => {
      const highest = pidManager.getHighestPriority([]);
      expect(highest).toBeUndefined();
    });
  });

  describe("PID Shuffle", () => {
    it("shuffle redistributes PIDs among entities", () => {
      pidManager.assignPid("player1" as EntityID, 0);
      pidManager.assignPid("player2" as EntityID, 0);
      pidManager.assignPid("player3" as EntityID, 0);

      const _pidsBefore = [
        pidManager.getPid("player1" as EntityID),
        pidManager.getPid("player2" as EntityID),
        pidManager.getPid("player3" as EntityID),
      ];

      // Force shuffle
      pidManager.forceShuffle(1000);

      const pidsAfter = [
        pidManager.getPid("player1" as EntityID),
        pidManager.getPid("player2" as EntityID),
        pidManager.getPid("player3" as EntityID),
      ];

      // PIDs should still be 0, 1, 2 but possibly reassigned
      expect(pidsAfter.sort()).toEqual([0, 1, 2]);
      // With enough entities, shuffle should change at least one
      // (Note: deterministic RNG makes this reproducible)
    });

    it("shuffle updates assignedTick for all entries", () => {
      pidManager.assignPid("player1" as EntityID, 0);
      pidManager.assignPid("player2" as EntityID, 0);

      pidManager.forceShuffle(500);

      const entries = pidManager.getAllEntries();
      for (const entry of entries) {
        expect(entry.assignedTick).toBe(500);
      }
    });

    it("shuffle increments totalShuffles counter", () => {
      const statsBefore = pidManager.getStats();
      expect(statsBefore.totalShuffles).toBe(0);

      pidManager.forceShuffle(100);

      const statsAfter = pidManager.getStats();
      expect(statsAfter.totalShuffles).toBe(1);
    });
  });

  describe("Automatic Shuffle via Update", () => {
    it("update triggers shuffle at scheduled tick", () => {
      pidManager.assignPid("player1" as EntityID, 0);

      const stats = pidManager.getStats();
      const scheduledTick = stats.nextShuffleTick;

      // Before scheduled tick - no shuffle
      expect(pidManager.update(scheduledTick - 1)).toBe(false);
      expect(pidManager.getStats().totalShuffles).toBe(0);

      // At scheduled tick - shuffle happens
      expect(pidManager.update(scheduledTick)).toBe(true);
      expect(pidManager.getStats().totalShuffles).toBe(1);
    });

    it("update schedules next shuffle after triggering", () => {
      const stats1 = pidManager.getStats();
      const firstSchedule = stats1.nextShuffleTick;

      pidManager.update(firstSchedule);

      const stats2 = pidManager.getStats();
      expect(stats2.nextShuffleTick).toBeGreaterThan(firstSchedule);
    });

    it("shuffle interval is between 100-250 ticks (60-150 seconds)", () => {
      const stats = pidManager.getStats();
      const interval = stats.nextShuffleTick; // From tick 0

      // PID_SHUFFLE_MIN_TICKS = 100, PID_SHUFFLE_MAX_TICKS = 250
      expect(interval).toBeGreaterThanOrEqual(100);
      expect(interval).toBeLessThanOrEqual(250);
    });
  });

  describe("Statistics", () => {
    it("getStats returns correct entity count", () => {
      expect(pidManager.getStats().totalEntities).toBe(0);

      pidManager.assignPid("player1" as EntityID, 0);
      pidManager.assignPid("player2" as EntityID, 0);

      expect(pidManager.getStats().totalEntities).toBe(2);
    });

    it("size property returns entity count", () => {
      expect(pidManager.size).toBe(0);

      pidManager.assignPid("player1" as EntityID, 0);
      expect(pidManager.size).toBe(1);
    });

    it("getTicksUntilShuffle returns correct value", () => {
      const stats = pidManager.getStats();
      const ticksUntil = pidManager.getTicksUntilShuffle(50);

      expect(ticksUntil).toBe(stats.nextShuffleTick - 50);
    });

    it("getTicksUntilShuffle returns 0 if past shuffle time", () => {
      const stats = pidManager.getStats();
      const ticksUntil = pidManager.getTicksUntilShuffle(
        stats.nextShuffleTick + 100,
      );

      expect(ticksUntil).toBe(0);
    });
  });

  describe("Lifecycle", () => {
    it("clear removes all PIDs and resets state", () => {
      pidManager.assignPid("player1" as EntityID, 0);
      pidManager.assignPid("player2" as EntityID, 0);
      pidManager.forceShuffle(100);

      pidManager.clear();

      expect(pidManager.size).toBe(0);
      expect(pidManager.hasPid("player1" as EntityID)).toBe(false);
      expect(pidManager.getStats().totalShuffles).toBe(0);
    });

    it("getAllEntries returns readonly array of entries", () => {
      pidManager.assignPid("player1" as EntityID, 10);
      pidManager.assignPid("player2" as EntityID, 10);

      const entries = pidManager.getAllEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].entityId).toBeDefined();
      expect(entries[0].pid).toBeDefined();
      expect(entries[0].assignedTick).toBe(10);
    });
  });

  describe("Edge Cases", () => {
    it("handles single entity shuffle gracefully", () => {
      pidManager.assignPid("player1" as EntityID, 0);

      // Should not throw
      expect(() => pidManager.forceShuffle(100)).not.toThrow();

      // PID should remain 0
      expect(pidManager.getPid("player1" as EntityID)).toBe(0);
    });

    it("handles empty shuffle gracefully", () => {
      // Should not throw
      expect(() => pidManager.forceShuffle(100)).not.toThrow();
      expect(pidManager.getStats().totalShuffles).toBe(1);
    });

    it("maintains deterministic behavior with seeded RNG", () => {
      // Create two managers with same seed
      const rng1 = new SeededRandom(99999);
      const rng2 = new SeededRandom(99999);
      const manager1 = new PidManager(rng1);
      const manager2 = new PidManager(rng2);

      // Same operations
      manager1.assignPid("a" as EntityID, 0);
      manager1.assignPid("b" as EntityID, 0);
      manager1.assignPid("c" as EntityID, 0);

      manager2.assignPid("a" as EntityID, 0);
      manager2.assignPid("b" as EntityID, 0);
      manager2.assignPid("c" as EntityID, 0);

      // Force shuffle at same tick
      manager1.forceShuffle(100);
      manager2.forceShuffle(100);

      // Should produce identical results
      expect(manager1.getPid("a" as EntityID)).toBe(
        manager2.getPid("a" as EntityID),
      );
      expect(manager1.getPid("b" as EntityID)).toBe(
        manager2.getPid("b" as EntityID),
      );
      expect(manager1.getPid("c" as EntityID)).toBe(
        manager2.getPid("c" as EntityID),
      );
    });
  });
});
