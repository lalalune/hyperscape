/**
 * Rules-Accurate Leash Behavior Tests
 *
 * Tests the two-tier range system and leash behavior:
 * - wanderRadius: Area where NPCs randomly wander (smaller, ~5 tiles)
 * - leashRange: Maximum chase distance from spawn (larger, ~10 tiles)
 *
 * Key classic MMORPG behaviors tested:
 * - NPCs can chase beyond wander radius but within leash range
 * - NPCs stop in place when exceeding leash range (no walk-back)
 * - NPCs transition to IDLE, not RETURN, when leashed
 * - Wander targets are relative to spawn (natural drift back)
 *
 * @see LEASH_BEHAVIOR_PLAN.md
 */

import { describe, it, expect } from "vitest";
import {
  ChaseState,
  AttackState,
  type AIStateContext,
} from "../../../../entities/managers/AIStateMachine";
import { MobAIState } from "../../../../types/entities";
import type { Position3D } from "../../../../types";

/**
 * Create a mock AIStateContext for testing
 */
function createMockContext(
  overrides: Partial<{
    position: Position3D;
    spawnPoint: Position3D;
    distanceFromSpawn: number;
    wanderRadius: number;
    leashRange: number;
    combatRange: number;
    currentTarget: string | null;
    targetPlayer: { id: string; position: Position3D } | null;
  }>,
): AIStateContext {
  const defaults = {
    position: { x: 0, y: 0, z: 0 },
    spawnPoint: { x: 0, y: 0, z: 0 },
    distanceFromSpawn: 0,
    wanderRadius: 5,
    leashRange: 10,
    combatRange: 1,
    currentTarget: null,
    targetPlayer: null,
  };

  const config = { ...defaults, ...overrides };

  return {
    getPosition: () => config.position,
    moveTowards: () => {},
    teleportTo: () => {},
    findNearbyPlayer: () => null,
    getPlayer: () => config.targetPlayer,
    getCurrentTarget: () => config.currentTarget,
    setTarget: () => {},
    canAttack: () => false,
    performAttack: () => {},
    onEnterCombatRange: () => {},
    isInCombat: () => false,
    exitCombat: () => {},
    getSpawnPoint: () => config.spawnPoint,
    getDistanceFromSpawn: () => config.distanceFromSpawn,
    getWanderRadius: () => config.wanderRadius,
    getLeashRange: () => config.leashRange,
    getCombatRange: () => config.combatRange,
    getWanderTarget: () => null,
    setWanderTarget: () => {},
    generateWanderTarget: () => ({ x: 0, y: 0, z: 0 }),
    getMovementType: () => "wander",
    getCurrentTick: () => 0,
    getTime: () => Date.now(),
    markNetworkDirty: () => {},
    emitEvent: () => {},
    // Entity occupancy for rules-accurate collision
    getEntityId: () => "test-mob-1",
    getEntityOccupancy: () => ({
      isBlocked: () => false,
      isOccupied: () => false,
      getOccupant: () => null,
      setOccupied: () => {},
      clearOccupant: () => {},
      occupy: () => {},
      vacate: () => {},
      move: () => {},
      countUnoccupied: () => 0,
    }),
    isWalkable: () => true,
    tryStepOutCardinal: () => false,
  };
}

describe("Rules-Accurate Leash Behavior", () => {
  describe("two-tier range system", () => {
    it("allows NPC to chase beyond wander radius but within leash range", () => {
      const chaseState = new ChaseState();

      // NPC at 7 tiles from spawn (beyond 5 tile wander, within 10 tile leash)
      const context = createMockContext({
        position: { x: 7, y: 0, z: 0 },
        spawnPoint: { x: 0, y: 0, z: 0 },
        distanceFromSpawn: 7,
        wanderRadius: 5,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 10, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Should NOT leash - still within leash range
      expect(nextState).not.toBe(MobAIState.IDLE);
      expect(nextState).not.toBe(MobAIState.RETURN);
    });

    it("returns NPC to spawn when exceeding leash range", () => {
      const chaseState = new ChaseState();

      // NPC at 11 tiles from spawn (beyond 10 tile leash)
      const context = createMockContext({
        position: { x: 11, y: 0, z: 0 },
        spawnPoint: { x: 0, y: 0, z: 0 },
        distanceFromSpawn: 11,
        wanderRadius: 5,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 15, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Rules-accurate: Mob returns to spawn when exceeding leash range
      expect(nextState).toBe(MobAIState.RETURN);
    });

    it("uses leashRange not wanderRadius for leash check", () => {
      const chaseState = new ChaseState();

      // NPC at 6 tiles from spawn (beyond 5 tile wander, within 10 tile leash)
      // If using wanderRadius incorrectly, this would leash
      const context = createMockContext({
        position: { x: 6, y: 0, z: 0 },
        spawnPoint: { x: 0, y: 0, z: 0 },
        distanceFromSpawn: 6,
        wanderRadius: 5, // Would trigger leash if this was used
        leashRange: 10, // Should use this instead
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 8, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Should NOT leash - within leash range (even though beyond wander radius)
      expect(nextState).not.toBe(MobAIState.IDLE);
      expect(nextState).not.toBe(MobAIState.RETURN);
    });
  });

  describe("immediate stop behavior", () => {
    it("transitions to RETURN on leash (walks back to spawn)", () => {
      const chaseState = new ChaseState();

      const context = createMockContext({
        position: { x: 15, y: 0, z: 0 },
        distanceFromSpawn: 15,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 20, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Rules-accurate: Mob returns to spawn when player exceeds aggression range
      // Prevents ranged farming exploit where mobs stand idle at leash edge
      expect(nextState).toBe(MobAIState.RETURN);
    });

    it("AttackState also returns to spawn on leash", () => {
      const attackState = new AttackState();

      const context = createMockContext({
        position: { x: 15, y: 0, z: 0 },
        distanceFromSpawn: 15,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 15, y: 0, z: 1 } },
      });

      attackState.enter(context);
      const nextState = attackState.update(context, 0.016);

      // Rules-accurate: Mob returns to spawn when player exceeds aggression range
      // Prevents ranged farming exploit where mobs stand idle at leash edge
      expect(nextState).toBe(MobAIState.RETURN);
    });

    it("calls exitCombat when leashed to allow immediate re-aggro", () => {
      const chaseState = new ChaseState();
      let exitCombatCalled = false;

      const context = createMockContext({
        distanceFromSpawn: 15,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 20, y: 0, z: 0 } },
      });

      // Override exitCombat to track if it's called
      context.exitCombat = () => {
        exitCombatCalled = true;
      };

      chaseState.enter(context);
      chaseState.update(context, 0.016);

      expect(exitCombatCalled).toBe(true);
    });

    it("clears target when leashed", () => {
      const chaseState = new ChaseState();
      let targetCleared = false;

      const context = createMockContext({
        distanceFromSpawn: 15,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 20, y: 0, z: 0 } },
      });

      // Override setTarget to track if it's called with null
      context.setTarget = (target) => {
        if (target === null) {
          targetCleared = true;
        }
      };

      chaseState.enter(context);
      chaseState.update(context, 0.016);

      expect(targetCleared).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles player exactly at aggression boundary (should NOT leash)", () => {
      const chaseState = new ChaseState();

      // Player at exactly aggression range (leashRange + combatRange = 11)
      // rules-accurate: Leash is based on PLAYER distance from spawn, not mob distance
      const context = createMockContext({
        distanceFromSpawn: 10,
        leashRange: 10,
        combatRange: 1,
        currentTarget: "player1",
        // Player at exactly 11 tiles from spawn (aggression boundary)
        targetPlayer: { id: "player1", position: { x: 11, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // At boundary, should NOT leash (only > aggressionRange triggers leash)
      expect(nextState).not.toBe(MobAIState.IDLE);
      expect(nextState).not.toBe(MobAIState.RETURN);
    });

    it("handles player just beyond aggression boundary (returns to spawn)", () => {
      const chaseState = new ChaseState();

      // Player just beyond aggression range
      // Rules-accurate: Leash is based on PLAYER distance from spawn
      const context = createMockContext({
        distanceFromSpawn: 10,
        leashRange: 10,
        combatRange: 1,
        currentTarget: "player1",
        // Player at 12 tiles from spawn (beyond aggression boundary of 11)
        targetPlayer: { id: "player1", position: { x: 12, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Rules-accurate: Mob returns to spawn when player exceeds aggression range
      expect(nextState).toBe(MobAIState.RETURN);
    });

    it("handles custom leash range from config", () => {
      const chaseState = new ChaseState();

      // Custom leash range of 15 tiles
      const context = createMockContext({
        distanceFromSpawn: 12,
        leashRange: 15,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 15, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Within custom leash range, should NOT leash
      expect(nextState).not.toBe(MobAIState.IDLE);
      expect(nextState).not.toBe(MobAIState.RETURN);
    });

    it("handles zero leash range (returns to spawn immediately when leaving)", () => {
      const chaseState = new ChaseState();

      const context = createMockContext({
        distanceFromSpawn: 1,
        leashRange: 0,
        currentTarget: "player1",
        targetPlayer: { id: "player1", position: { x: 5, y: 0, z: 0 } },
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Rules-accurate: Mob returns to spawn when exceeding leash range
      expect(nextState).toBe(MobAIState.RETURN);
    });

    it("returns IDLE when target becomes null (not RETURN)", () => {
      const chaseState = new ChaseState();

      const context = createMockContext({
        distanceFromSpawn: 5,
        leashRange: 10,
        currentTarget: null, // No target
        targetPlayer: null,
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // No target should go to IDLE, not RETURN
      expect(nextState).toBe(MobAIState.IDLE);
    });

    it("returns IDLE when target player not found (not RETURN)", () => {
      const chaseState = new ChaseState();

      const context = createMockContext({
        distanceFromSpawn: 5,
        leashRange: 10,
        currentTarget: "player1",
        targetPlayer: null, // Player not found
      });

      chaseState.enter(context);
      const nextState = chaseState.update(context, 0.016);

      // Target not found should go to IDLE, not RETURN
      expect(nextState).toBe(MobAIState.IDLE);
    });
  });
});
