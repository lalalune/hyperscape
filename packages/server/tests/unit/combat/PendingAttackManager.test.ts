/**
 * PendingAttackManager Unit Tests
 *
 * Tests the server-authoritative walk-to-attack system.
 *
 * Key behaviors tested:
 * - Queuing and canceling pending attacks
 * - Processing ticks with range checks
 * - Re-pathing when target moves
 * - Infinite follow (no timeout)
 * - Combat event emission when in range
 * - Cleanup on player disconnect
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PendingAttackManager } from "../../../src/systems/ServerNetwork/PendingAttackManager";
import { EventType } from "@hyperscape/shared";

// Mock the World class
function createMockWorld() {
  const entities = new Map<
    string,
    { position: { x: number; y: number; z: number } }
  >();
  const emitFn = vi.fn();

  return {
    entities,
    emit: emitFn,
    setPlayerPosition: (playerId: string, x: number, y: number, z: number) => {
      entities.set(playerId, { position: { x, y, z } });
    },
    _emit: emitFn, // Exposed for assertions
  };
}

// Mock TileMovementManager
function createMockTileMovementManager() {
  const movePlayerTowardFn = vi.fn();
  return {
    movePlayerToward: movePlayerTowardFn,
    _movePlayerToward: movePlayerTowardFn,
  };
}

describe("PendingAttackManager", () => {
  let world: ReturnType<typeof createMockWorld>;
  let tileMovementManager: ReturnType<typeof createMockTileMovementManager>;
  let mobPositions: Map<string, { x: number; y: number; z: number }>;
  let aliveMobs: Set<string>;
  let manager: PendingAttackManager;

  const getMobPosition = (mobId: string) => mobPositions.get(mobId) ?? null;
  const isMobAlive = (mobId: string) => aliveMobs.has(mobId);

  beforeEach(() => {
    world = createMockWorld();
    tileMovementManager = createMockTileMovementManager();
    mobPositions = new Map();
    aliveMobs = new Set();

    manager = new PendingAttackManager(
      world as never, // Type assertion for mock
      tileMovementManager as never,
      getMobPosition,
      isMobAlive,
    );
  });

  describe("queuePendingAttack", () => {
    it("stores pending attack for player", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);

      expect(manager.hasPendingAttack("player1")).toBe(true);
      expect(manager.getPendingAttackTarget("player1")).toBe("mob1");
    });

    it("initiates movement toward target", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);

      expect(tileMovementManager._movePlayerToward).toHaveBeenCalledWith(
        "player1",
        { x: 5.5, y: 0, z: 5.5 },
        true,
        1, // default melee range
      );
    });

    it("accepts custom melee range for halberd", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0, 2);

      expect(tileMovementManager._movePlayerToward).toHaveBeenCalledWith(
        "player1",
        { x: 5.5, y: 0, z: 5.5 },
        true,
        2, // halberd range
      );
    });

    it("cancels existing pending attack when queuing new one", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      mobPositions.set("mob2", { x: 10.5, y: 0, z: 10.5 });
      aliveMobs.add("mob1");
      aliveMobs.add("mob2");

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.getPendingAttackTarget("player1")).toBe("mob1");

      manager.queuePendingAttack("player1", "mob2", 0);
      expect(manager.getPendingAttackTarget("player1")).toBe("mob2");
      expect(manager.size).toBe(1);
    });

    it("does not queue if target position unavailable", () => {
      // No mob position set
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });
  });

  describe("cancelPendingAttack", () => {
    it("removes pending attack for player", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.hasPendingAttack("player1")).toBe(true);

      manager.cancelPendingAttack("player1");
      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("is safe to call on non-existent player", () => {
      expect(() => manager.cancelPendingAttack("nonexistent")).not.toThrow();
    });
  });

  describe("hasPendingAttack", () => {
    it("returns false for player without pending attack", () => {
      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("returns true for player with pending attack", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.hasPendingAttack("player1")).toBe(true);
    });
  });

  describe("getPendingAttackTarget", () => {
    it("returns null for player without pending attack", () => {
      expect(manager.getPendingAttackTarget("player1")).toBeNull();
    });

    it("returns target ID for player with pending attack", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.getPendingAttackTarget("player1")).toBe("mob1");
    });
  });

  describe("processTick", () => {
    it("cancels pending attack when target dies", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      world.setPlayerPosition("player1", 10.5, 0, 10.5);

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.hasPendingAttack("player1")).toBe(true);

      // Kill the mob
      aliveMobs.delete("mob1");
      manager.processTick(1);

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("cancels pending attack when player entity is removed", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      world.setPlayerPosition("player1", 10.5, 0, 10.5);

      manager.queuePendingAttack("player1", "mob1", 0);

      // Remove player entity
      world.entities.delete("player1");
      manager.processTick(1);

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("cancels pending attack when target position unavailable", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      world.setPlayerPosition("player1", 10.5, 0, 10.5);

      manager.queuePendingAttack("player1", "mob1", 0);

      // Remove mob position
      mobPositions.delete("mob1");
      manager.processTick(1);

      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("emits combat attack request when player reaches melee range", () => {
      // Place mob at tile (5, 5)
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      // Place player cardinally adjacent at tile (5, 6) - north of mob
      world.setPlayerPosition("player1", 5.5, 0, 6.5);

      manager.queuePendingAttack("player1", "mob1", 0);
      manager.processTick(1);

      expect(world._emit).toHaveBeenCalledWith(
        EventType.COMBAT_ATTACK_REQUEST,
        {
          playerId: "player1",
          targetId: "mob1",
          attackerType: "player",
          targetType: "mob",
          attackType: "melee",
        },
      );

      // Pending attack should be removed after successful attack
      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("does NOT emit combat when player is diagonal with range 1 (OSRS rule)", () => {
      // Place mob at tile (5, 5)
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      // Place player diagonally adjacent at tile (6, 6) - northeast of mob
      world.setPlayerPosition("player1", 6.5, 0, 6.5);

      manager.queuePendingAttack("player1", "mob1", 0, 1);
      manager.processTick(1);

      // Combat should NOT be emitted - diagonal not valid for range 1
      expect(world._emit).not.toHaveBeenCalled();
      // Pending attack should still be active
      expect(manager.hasPendingAttack("player1")).toBe(true);
    });

    it("emits combat when player is diagonal with range 2 (halberd)", () => {
      // Place mob at tile (5, 5)
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      // Place player diagonally adjacent at tile (6, 6) - northeast of mob
      world.setPlayerPosition("player1", 6.5, 0, 6.5);

      manager.queuePendingAttack("player1", "mob1", 0, 2);
      manager.processTick(1);

      // Combat SHOULD be emitted - diagonal valid for range 2
      expect(world._emit).toHaveBeenCalledWith(
        EventType.COMBAT_ATTACK_REQUEST,
        {
          playerId: "player1",
          targetId: "mob1",
          attackerType: "player",
          targetType: "mob",
          attackType: "melee",
        },
      );
    });

    it("re-paths when target moves to new tile", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      world.setPlayerPosition("player1", 10.5, 0, 10.5);

      manager.queuePendingAttack("player1", "mob1", 0);
      tileMovementManager._movePlayerToward.mockClear();

      // Move mob to different tile
      mobPositions.set("mob1", { x: 8.5, y: 0, z: 8.5 });
      manager.processTick(1);

      // Should have called movePlayerToward again with new position
      expect(tileMovementManager._movePlayerToward).toHaveBeenCalledWith(
        "player1",
        { x: 8.5, y: 0, z: 8.5 },
        true,
        1,
      );
    });

    it("does NOT re-path when target stays on same tile", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");
      world.setPlayerPosition("player1", 10.5, 0, 10.5);

      manager.queuePendingAttack("player1", "mob1", 0);
      tileMovementManager._movePlayerToward.mockClear();

      // Move mob within same tile (different world position, same tile)
      mobPositions.set("mob1", { x: 5.7, y: 0, z: 5.3 });
      manager.processTick(1);

      // Should NOT have called movePlayerToward
      expect(tileMovementManager._movePlayerToward).not.toHaveBeenCalled();
    });

    it("follows indefinitely - no timeout (OSRS behavior)", () => {
      mobPositions.set("mob1", { x: 100.5, y: 0, z: 100.5 });
      aliveMobs.add("mob1");
      world.setPlayerPosition("player1", 0.5, 0, 0.5);

      manager.queuePendingAttack("player1", "mob1", 0);

      // Process many ticks
      for (let tick = 1; tick <= 1000; tick++) {
        manager.processTick(tick);
      }

      // Pending attack should still be active - no timeout
      expect(manager.hasPendingAttack("player1")).toBe(true);
    });
  });

  describe("onPlayerDisconnect", () => {
    it("removes pending attack for disconnected player", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      aliveMobs.add("mob1");

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.hasPendingAttack("player1")).toBe(true);

      manager.onPlayerDisconnect("player1");
      expect(manager.hasPendingAttack("player1")).toBe(false);
    });

    it("is safe to call on player without pending attack", () => {
      expect(() => manager.onPlayerDisconnect("nonexistent")).not.toThrow();
    });
  });

  describe("size", () => {
    it("returns 0 when empty", () => {
      expect(manager.size).toBe(0);
    });

    it("returns correct count of pending attacks", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      mobPositions.set("mob2", { x: 10.5, y: 0, z: 10.5 });
      aliveMobs.add("mob1");
      aliveMobs.add("mob2");

      manager.queuePendingAttack("player1", "mob1", 0);
      expect(manager.size).toBe(1);

      manager.queuePendingAttack("player2", "mob2", 0);
      expect(manager.size).toBe(2);
    });
  });

  describe("destroy", () => {
    it("clears all pending attacks", () => {
      mobPositions.set("mob1", { x: 5.5, y: 0, z: 5.5 });
      mobPositions.set("mob2", { x: 10.5, y: 0, z: 10.5 });
      aliveMobs.add("mob1");
      aliveMobs.add("mob2");

      manager.queuePendingAttack("player1", "mob1", 0);
      manager.queuePendingAttack("player2", "mob2", 0);
      expect(manager.size).toBe(2);

      manager.destroy();
      expect(manager.size).toBe(0);
    });
  });
});
