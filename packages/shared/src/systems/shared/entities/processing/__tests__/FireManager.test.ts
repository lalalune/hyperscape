/**
 * Fire Manager Tests
 *
 * Verifies fire lifecycle management:
 * - Fire creation and indexing
 * - classic MMORPG walk-west behavior
 * - Fire expiration
 * - Position-based queries
 * - Player fire limits
 *
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FireManager, resetFireManager } from "../FireManager";
import { PROCESSING_CONSTANTS } from "../../../../../constants/ProcessingConstants";
import type { TileCoord } from "../../../movement/TileSystem";

describe("FireManager", () => {
  let fireManager: FireManager;

  beforeEach(() => {
    resetFireManager();
    fireManager = new FireManager();
  });

  describe("createFire", () => {
    it("creates a fire at specified position", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10.5, y: 0, z: 20.5 },
        100,
      );

      expect(fire).not.toBeNull();
      expect(fire!.position.x).toBe(10.5);
      expect(fire!.position.z).toBe(20.5);
      expect(fire!.playerId).toBe("player1");
      expect(fire!.isActive).toBe(true);
    });

    it("generates unique fire ID", () => {
      const fire1 = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      const fire2 = fireManager.createFire(
        "player1",
        { x: 11, y: 0, z: 20 },
        100,
      );

      expect(fire1!.id).not.toBe(fire2!.id);
      expect(fire1!.id).toMatch(/^fire_/);
    });

    it("calculates tile coordinates from world position", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10.7, y: 0, z: 20.3 },
        100,
      );

      expect(fire!.tile.x).toBe(10);
      expect(fire!.tile.z).toBe(20);
    });

    it("sets expiration tick based on random duration", () => {
      const currentTick = 100;
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        currentTick,
      );

      const { minDurationTicks, maxDurationTicks } = PROCESSING_CONSTANTS.FIRE;
      expect(fire!.expiresAtTick).toBeGreaterThanOrEqual(
        currentTick + minDurationTicks,
      );
      expect(fire!.expiresAtTick).toBeLessThanOrEqual(
        currentTick + maxDurationTicks,
      );
    });

    it("returns null if tile already has a fire", () => {
      fireManager.createFire("player1", { x: 10.5, y: 0, z: 20.5 }, 100);
      const secondFire = fireManager.createFire(
        "player2",
        { x: 10.3, y: 0, z: 20.7 },
        100,
      );

      expect(secondFire).toBeNull();
    });

    it("allows fires on adjacent tiles", () => {
      const fire1 = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      const fire2 = fireManager.createFire(
        "player1",
        { x: 11, y: 0, z: 20 },
        100,
      );

      expect(fire1).not.toBeNull();
      expect(fire2).not.toBeNull();
    });

    it("enforces per-player fire limit", () => {
      const maxFires = PROCESSING_CONSTANTS.FIRE.maxFiresPerPlayer;

      // Create max fires
      for (let i = 0; i < maxFires; i++) {
        fireManager.createFire("player1", { x: i * 2, y: 0, z: 0 }, 100);
      }

      expect(fireManager.getFiresByPlayer("player1").length).toBe(maxFires);

      // Creating another should remove oldest
      const newFire = fireManager.createFire(
        "player1",
        { x: 100, y: 0, z: 0 },
        100,
      );
      expect(newFire).not.toBeNull();
      expect(fireManager.getFiresByPlayer("player1").length).toBe(maxFires);
    });
  });

  describe("getFireAtTile", () => {
    it("returns fire at specified tile", () => {
      const created = fireManager.createFire(
        "player1",
        { x: 10.5, y: 0, z: 20.5 },
        100,
      );

      const found = fireManager.getFireAtTile({ x: 10, z: 20 });
      expect(found).toBe(created);
    });

    it("returns null if no fire at tile", () => {
      const found = fireManager.getFireAtTile({ x: 10, z: 20 });
      expect(found).toBeNull();
    });
  });

  describe("getFireAtPosition", () => {
    it("returns fire at world position", () => {
      const created = fireManager.createFire(
        "player1",
        { x: 10.5, y: 0, z: 20.5 },
        100,
      );

      // Any position on tile 10,20 should return the fire
      const found = fireManager.getFireAtPosition({ x: 10.3, y: 0, z: 20.7 });
      expect(found).toBe(created);
    });
  });

  describe("getFireById", () => {
    it("returns fire by ID", () => {
      const created = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );

      const found = fireManager.getFireById(created!.id);
      expect(found).toBe(created);
    });

    it("returns null for unknown ID", () => {
      const found = fireManager.getFireById("unknown_id");
      expect(found).toBeNull();
    });
  });

  describe("getFiresByPlayer", () => {
    it("returns all fires created by player", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 20 }, 100);
      fireManager.createFire("player1", { x: 12, y: 0, z: 20 }, 100);
      fireManager.createFire("player2", { x: 14, y: 0, z: 20 }, 100);

      const player1Fires = fireManager.getFiresByPlayer("player1");
      expect(player1Fires.length).toBe(2);

      const player2Fires = fireManager.getFiresByPlayer("player2");
      expect(player2Fires.length).toBe(1);
    });

    it("returns empty array for player with no fires", () => {
      const fires = fireManager.getFiresByPlayer("unknown_player");
      expect(fires).toEqual([]);
    });
  });

  describe("getFiresInRange", () => {
    it("returns fires within range", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 10 }, 100);
      fireManager.createFire("player1", { x: 11, y: 0, z: 10 }, 100);
      fireManager.createFire("player1", { x: 15, y: 0, z: 10 }, 100);

      const fires = fireManager.getFiresInRange({ x: 10.5, y: 0, z: 10.5 }, 2);
      expect(fires.length).toBe(2);
    });

    it("uses Chebyshev distance (king-move)", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 10 }, 100);
      // Diagonal: 1 tile away in Chebyshev
      fireManager.createFire("player1", { x: 11, y: 0, z: 11 }, 100);

      const fires = fireManager.getFiresInRange({ x: 10.5, y: 0, z: 10.5 }, 1);
      expect(fires.length).toBe(2);
    });

    it("excludes inactive fires", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 10 },
        100,
      );
      fireManager.extinguishFire(fire!.id);

      const fires = fireManager.getFiresInRange({ x: 10.5, y: 0, z: 10.5 }, 5);
      expect(fires.length).toBe(0);
    });
  });

  describe("findNearestFire", () => {
    it("returns nearest fire within range", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 10 }, 100);
      const nearFire = fireManager.createFire(
        "player1",
        { x: 11, y: 0, z: 10 },
        100,
      );

      const found = fireManager.findNearestFire({ x: 11.5, y: 0, z: 10.5 }, 5);
      expect(found).toBe(nearFire);
    });

    it("returns null if no fires in range", () => {
      fireManager.createFire("player1", { x: 100, y: 0, z: 100 }, 100);

      const found = fireManager.findNearestFire({ x: 0, y: 0, z: 0 }, 5);
      expect(found).toBeNull();
    });
  });

  describe("extinguishFire", () => {
    it("marks fire as inactive", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      fireManager.extinguishFire(fire!.id);

      expect(fire!.isActive).toBe(false);
    });

    it("removes fire from tile index", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      fireManager.extinguishFire(fire!.id);

      const found = fireManager.getFireAtTile({ x: 10, z: 20 });
      expect(found).toBeNull();
    });

    it("removes fire from ID index", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      const fireId = fire!.id;
      fireManager.extinguishFire(fireId);

      const found = fireManager.getFireById(fireId);
      expect(found).toBeNull();
    });

    it("removes fire from player tracking", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      fireManager.extinguishFire(fire!.id);

      const playerFires = fireManager.getFiresByPlayer("player1");
      expect(playerFires.length).toBe(0);
    });

    it("decrements fire count", () => {
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        100,
      );
      expect(fireManager.getFireCount()).toBe(1);

      fireManager.extinguishFire(fire!.id);
      expect(fireManager.getFireCount()).toBe(0);
    });

    it("handles unknown fire ID gracefully", () => {
      expect(() => fireManager.extinguishFire("unknown")).not.toThrow();
    });
  });

  describe("processTick", () => {
    it("expires fires that have reached expiration tick", () => {
      const currentTick = 100;
      const fire = fireManager.createFire(
        "player1",
        { x: 10, y: 0, z: 20 },
        currentTick,
      );

      // Process at expiration tick
      const expiredCount = fireManager.processTick(fire!.expiresAtTick);
      expect(expiredCount).toBe(1);
      expect(fireManager.getFireCount()).toBe(0);
    });

    it("does not expire fires before expiration", () => {
      const currentTick = 100;
      fireManager.createFire("player1", { x: 10, y: 0, z: 20 }, currentTick);

      // Process before expiration
      const expiredCount = fireManager.processTick(currentTick + 50);
      expect(expiredCount).toBe(0);
      expect(fireManager.getFireCount()).toBe(1);
    });

    it("returns count of expired fires", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 20 }, 100);
      fireManager.createFire("player1", { x: 12, y: 0, z: 20 }, 100);

      // Force expire by processing at a very high tick
      const expiredCount = fireManager.processTick(100000);
      expect(expiredCount).toBe(2);
    });
  });

  describe("calculatePostFireTile (walk-west behavior)", () => {
    const alwaysWalkable = (_tile: TileCoord) => true;
    const neverWalkable = (_tile: TileCoord) => false;

    it("prefers west direction first", () => {
      const playerTile: TileCoord = { x: 10, z: 10 };
      const target = fireManager.calculatePostFireTile(
        playerTile,
        alwaysWalkable,
      );

      expect(target).toEqual({ x: 9, z: 10 });
    });

    it("falls back to east if west blocked", () => {
      const playerTile: TileCoord = { x: 10, z: 10 };
      const westBlocked = (tile: TileCoord) => tile.x !== 9;

      const target = fireManager.calculatePostFireTile(playerTile, westBlocked);
      expect(target).toEqual({ x: 11, z: 10 });
    });

    it("falls back to south if west and east blocked", () => {
      const playerTile: TileCoord = { x: 10, z: 10 };
      const westEastBlocked = (tile: TileCoord) =>
        tile.x !== 9 && tile.x !== 11;

      const target = fireManager.calculatePostFireTile(
        playerTile,
        westEastBlocked,
      );
      expect(target).toEqual({ x: 10, z: 9 });
    });

    it("falls back to north if west, east, south blocked", () => {
      const playerTile: TileCoord = { x: 10, z: 10 };
      const onlyNorthWalkable = (tile: TileCoord) =>
        tile.x === 10 && tile.z === 11;

      const target = fireManager.calculatePostFireTile(
        playerTile,
        onlyNorthWalkable,
      );
      expect(target).toEqual({ x: 10, z: 11 });
    });

    it("returns null if all directions blocked", () => {
      const playerTile: TileCoord = { x: 10, z: 10 };
      const target = fireManager.calculatePostFireTile(
        playerTile,
        neverWalkable,
      );

      expect(target).toBeNull();
    });

    it("avoids tiles with existing fires", () => {
      const playerTile: TileCoord = { x: 10, z: 10 };

      // Place fire on west tile
      fireManager.createFire("player1", { x: 9.5, y: 0, z: 10.5 }, 100);

      const target = fireManager.calculatePostFireTile(
        playerTile,
        alwaysWalkable,
      );
      // Should skip west (fire) and go east
      expect(target).toEqual({ x: 11, z: 10 });
    });

    it("follows classic MMORPG priority order: W → E → S → N", () => {
      expect(PROCESSING_CONSTANTS.FIRE_WALK_PRIORITY).toEqual([
        "west",
        "east",
        "south",
        "north",
      ]);
    });
  });

  describe("calculatePostFirePosition", () => {
    const alwaysWalkable = (_tile: TileCoord) => true;

    it("returns world position at center of target tile", () => {
      const playerPos = { x: 10.5, y: 5, z: 20.5 };
      const target = fireManager.calculatePostFirePosition(
        playerPos,
        alwaysWalkable,
      );

      // West tile center
      expect(target).toEqual({ x: 9.5, y: 5, z: 20.5 });
    });

    it("preserves y coordinate", () => {
      const playerPos = { x: 10.5, y: 42, z: 20.5 };
      const target = fireManager.calculatePostFirePosition(
        playerPos,
        alwaysWalkable,
      );

      expect(target!.y).toBe(42);
    });

    it("returns null if all directions blocked", () => {
      const neverWalkable = (_tile: TileCoord) => false;
      const playerPos = { x: 10.5, y: 0, z: 20.5 };

      const target = fireManager.calculatePostFirePosition(
        playerPos,
        neverWalkable,
      );
      expect(target).toBeNull();
    });
  });

  describe("getFireCount", () => {
    it("returns 0 when no fires", () => {
      expect(fireManager.getFireCount()).toBe(0);
    });

    it("returns correct count after adding fires", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 20 }, 100);
      fireManager.createFire("player1", { x: 12, y: 0, z: 20 }, 100);

      expect(fireManager.getFireCount()).toBe(2);
    });
  });

  describe("clearAllFires", () => {
    it("removes all fires", () => {
      fireManager.createFire("player1", { x: 10, y: 0, z: 20 }, 100);
      fireManager.createFire("player2", { x: 12, y: 0, z: 20 }, 100);

      fireManager.clearAllFires();

      expect(fireManager.getFireCount()).toBe(0);
      expect(fireManager.getFiresByPlayer("player1").length).toBe(0);
    });
  });
});
