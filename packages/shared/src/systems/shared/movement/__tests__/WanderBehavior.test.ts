/**
 * WanderBehavior Unit Tests
 *
 * Tests rules-accurate probabilistic wandering behavior.
 *
 * Key behaviors tested:
 * - Probabilistic wander chance (~26% per tick)
 * - Wander target generation within radius
 * - State management (active wander path)
 * - Movement type restrictions (stationary)
 *
 * @see MOB_AGGRO_IMPLEMENTATION_PLAN.md Phase 3.1
 */

import { describe, it, expect, beforeEach } from "vitest";
import { WanderBehavior } from "../WanderBehavior";
import type { TileCoord } from "../TileSystem";

describe("WanderBehavior", () => {
  describe("constructor", () => {
    it("uses default values when not specified", () => {
      const behavior = new WanderBehavior({ movementType: "wander" });

      expect(behavior.getMovementType()).toBe("wander");
      expect(behavior.getWanderRadius()).toBe(5);
    });

    it("uses custom wander radius when specified", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderRadius: 3,
      });

      expect(behavior.getWanderRadius()).toBe(3);
    });

    it("uses custom wander chance when specified", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 0.5,
      });

      // Can't directly test wanderChance, but shouldStartWander will use it
      expect(behavior.getMovementType()).toBe("wander");
    });
  });

  describe("shouldStartWander", () => {
    it("returns false for stationary NPCs", () => {
      const behavior = new WanderBehavior({ movementType: "stationary" });

      // Even with 100% chance, stationary should never wander
      const result = behavior.shouldStartWander(false, false, false, 1);

      expect(result).toBe(false);
    });

    it("returns false when NPC has target", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0, // 100% chance
      });

      const result = behavior.shouldStartWander(true, false, false, 1);

      expect(result).toBe(false);
    });

    it("returns false when NPC is in combat", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0,
      });

      const result = behavior.shouldStartWander(false, true, false, 1);

      expect(result).toBe(false);
    });

    it("returns false when already has wander path", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0,
      });

      const result = behavior.shouldStartWander(false, false, true, 1);

      expect(result).toBe(false);
    });

    it("returns false when same tick checked twice", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0,
      });

      // First check succeeds (might return true due to 100% chance)
      behavior.shouldStartWander(false, false, false, 1);

      // Second check on same tick should fail
      const result = behavior.shouldStartWander(false, false, false, 1);

      expect(result).toBe(false);
    });

    it("returns true with 100% wander chance when conditions are met", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0,
      });

      const result = behavior.shouldStartWander(false, false, false, 1);

      expect(result).toBe(true);
    });

    it("returns false with 0% wander chance", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 0.0,
      });

      const result = behavior.shouldStartWander(false, false, false, 1);

      expect(result).toBe(false);
    });

    it("respects probabilistic chance (~26% default)", () => {
      const behavior = new WanderBehavior({ movementType: "wander" });

      // Run many iterations to check probability distribution
      let trueCount = 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const result = behavior.shouldStartWander(false, false, false, i);
        if (result) trueCount++;
      }

      // Should be roughly 26% with some variance (24-28% acceptable)
      const percentage = trueCount / iterations;
      expect(percentage).toBeGreaterThan(0.22);
      expect(percentage).toBeLessThan(0.3);
    });
  });

  describe("generateWanderTarget", () => {
    let behavior: WanderBehavior;

    beforeEach(() => {
      behavior = new WanderBehavior({
        movementType: "wander",
        wanderRadius: 5,
      });
    });

    it("generates target within wander radius", () => {
      const spawnTile: TileCoord = { x: 50, z: 50 };

      // Generate many targets and verify all are within radius
      for (let i = 0; i < 100; i++) {
        const target = behavior.generateWanderTarget(spawnTile);

        const dx = Math.abs(target.x - spawnTile.x);
        const dz = Math.abs(target.z - spawnTile.z);

        expect(dx).toBeLessThanOrEqual(5);
        expect(dz).toBeLessThanOrEqual(5);
      }
    });

    it("can generate target at spawn (0,0 offset)", () => {
      const spawnTile: TileCoord = { x: 50, z: 50 };

      // With many iterations, should eventually generate spawn position
      let foundSpawn = false;
      for (let i = 0; i < 1000; i++) {
        const target = behavior.generateWanderTarget(spawnTile);
        if (target.x === spawnTile.x && target.z === spawnTile.z) {
          foundSpawn = true;
          break;
        }
      }

      // Statistically very likely to find spawn (1 in 121 per iteration)
      expect(foundSpawn).toBe(true);
    });

    it("can generate target at maximum radius", () => {
      const spawnTile: TileCoord = { x: 50, z: 50 };

      // Check that extreme corners are possible
      let foundMax = false;
      for (let i = 0; i < 1000; i++) {
        const target = behavior.generateWanderTarget(spawnTile);
        const dx = Math.abs(target.x - spawnTile.x);
        const dz = Math.abs(target.z - spawnTile.z);

        if (dx === 5 || dz === 5) {
          foundMax = true;
          break;
        }
      }

      expect(foundMax).toBe(true);
    });

    it("respects custom wander radius", () => {
      const customBehavior = new WanderBehavior({
        movementType: "wander",
        wanderRadius: 3,
      });
      const spawnTile: TileCoord = { x: 50, z: 50 };

      for (let i = 0; i < 100; i++) {
        const target = customBehavior.generateWanderTarget(spawnTile);

        const dx = Math.abs(target.x - spawnTile.x);
        const dz = Math.abs(target.z - spawnTile.z);

        expect(dx).toBeLessThanOrEqual(3);
        expect(dz).toBeLessThanOrEqual(3);
      }
    });

    it("sets current wander target after generation", () => {
      const spawnTile: TileCoord = { x: 50, z: 50 };

      expect(behavior.hasWanderPath()).toBe(false);

      const target = behavior.generateWanderTarget(spawnTile);

      expect(behavior.hasWanderPath()).toBe(true);

      const storedTarget = behavior.getWanderTarget();
      expect(storedTarget).not.toBeNull();
      expect(storedTarget!.x).toBe(target.x);
      expect(storedTarget!.z).toBe(target.z);
    });

    it("handles negative spawn coordinates", () => {
      const spawnTile: TileCoord = { x: -50, z: -50 };

      for (let i = 0; i < 50; i++) {
        const target = behavior.generateWanderTarget(spawnTile);

        const dx = Math.abs(target.x - spawnTile.x);
        const dz = Math.abs(target.z - spawnTile.z);

        expect(dx).toBeLessThanOrEqual(5);
        expect(dz).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("wander path management", () => {
    let behavior: WanderBehavior;

    beforeEach(() => {
      behavior = new WanderBehavior({ movementType: "wander" });
    });

    it("hasWanderPath returns false initially", () => {
      expect(behavior.hasWanderPath()).toBe(false);
    });

    it("hasWanderPath returns true after generating target", () => {
      behavior.generateWanderTarget({ x: 50, z: 50 });
      expect(behavior.hasWanderPath()).toBe(true);
    });

    it("clearWanderPath removes wander target", () => {
      behavior.generateWanderTarget({ x: 50, z: 50 });
      expect(behavior.hasWanderPath()).toBe(true);

      behavior.clearWanderPath();

      expect(behavior.hasWanderPath()).toBe(false);
      expect(behavior.getWanderTarget()).toBeNull();
    });

    it("getWanderTarget returns null when no target", () => {
      expect(behavior.getWanderTarget()).toBeNull();
    });

    it("getWanderTarget returns stored target", () => {
      const spawnTile: TileCoord = { x: 50, z: 50 };
      const generated = behavior.generateWanderTarget(spawnTile);
      const stored = behavior.getWanderTarget();

      expect(stored).not.toBeNull();
      expect(stored!.x).toBe(generated.x);
      expect(stored!.z).toBe(generated.z);
    });
  });

  describe("isWanderComplete", () => {
    let behavior: WanderBehavior;

    beforeEach(() => {
      behavior = new WanderBehavior({ movementType: "wander" });
    });

    it("returns true when no wander target", () => {
      expect(behavior.isWanderComplete({ x: 5, z: 5 })).toBe(true);
    });

    it("returns true when at wander target", () => {
      // Generate target and mock the stored target
      behavior.generateWanderTarget({ x: 50, z: 50 });
      const target = behavior.getWanderTarget()!;

      expect(behavior.isWanderComplete(target)).toBe(true);
    });

    it("returns false when not at wander target", () => {
      behavior.generateWanderTarget({ x: 50, z: 50 });
      const target = behavior.getWanderTarget()!;

      // Different position
      const current: TileCoord = { x: target.x + 1, z: target.z };

      expect(behavior.isWanderComplete(current)).toBe(false);
    });
  });

  describe("updateWanderState", () => {
    let behavior: WanderBehavior;

    beforeEach(() => {
      behavior = new WanderBehavior({ movementType: "wander" });
    });

    it("clears wander path when at destination", () => {
      behavior.generateWanderTarget({ x: 50, z: 50 });
      const target = behavior.getWanderTarget()!;

      expect(behavior.hasWanderPath()).toBe(true);

      behavior.updateWanderState(target);

      expect(behavior.hasWanderPath()).toBe(false);
    });

    it("keeps wander path when not at destination", () => {
      behavior.generateWanderTarget({ x: 50, z: 50 });
      const target = behavior.getWanderTarget()!;

      expect(behavior.hasWanderPath()).toBe(true);

      behavior.updateWanderState({ x: target.x + 1, z: target.z });

      expect(behavior.hasWanderPath()).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      const behavior = new WanderBehavior({ movementType: "wander" });

      behavior.generateWanderTarget({ x: 50, z: 50 });
      behavior.shouldStartWander(false, false, false, 100); // Set lastWanderTick

      expect(behavior.hasWanderPath()).toBe(true);

      behavior.reset();

      expect(behavior.hasWanderPath()).toBe(false);
      expect(behavior.getWanderTarget()).toBeNull();

      // Should allow wander check on tick 100 again after reset
      const behavior2 = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0,
      });
      behavior2.shouldStartWander(false, false, false, 100);
      behavior2.reset();
      const canWander = behavior2.shouldStartWander(false, false, false, 100);
      expect(canWander).toBe(true);
    });
  });

  describe("movement types", () => {
    it("wander type can wander", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0,
      });

      expect(behavior.shouldStartWander(false, false, false, 1)).toBe(true);
    });

    it("stationary type never wanders", () => {
      const behavior = new WanderBehavior({
        movementType: "stationary",
        wanderChance: 1.0, // Even 100% chance
      });

      expect(behavior.shouldStartWander(false, false, false, 1)).toBe(false);
    });

    it("patrol type can wander (treated like wander)", () => {
      const behavior = new WanderBehavior({
        movementType: "patrol",
        wanderChance: 1.0,
      });

      // Patrol is not stationary, so should be able to wander
      expect(behavior.shouldStartWander(false, false, false, 1)).toBe(true);
    });
  });
});
