/**
 * AOI (Area of Interest) Manager Tests
 *
 * Tests for the spatial partitioning system that determines which entities
 * are visible to which players.
 *
 * NO MOCKS - Tests actual AOI logic
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { AOIManager } from "../AOIManager";

describe("AOIManager", () => {
  let aoi: AOIManager;

  beforeEach(() => {
    aoi = new AOIManager(50, 2); // 50m cells, 2 cell view distance (5x5 = 250m view)
  });

  describe("getCellKey", () => {
    it("should return correct cell for origin", () => {
      expect(aoi.getCellKey(0, 0)).toBe("0,0");
    });

    it("should return correct cell for positive position", () => {
      expect(aoi.getCellKey(25, 75)).toBe("0,1");
      expect(aoi.getCellKey(100, 100)).toBe("2,2");
    });

    it("should return correct cell for negative position", () => {
      expect(aoi.getCellKey(-25, -25)).toBe("-1,-1");
      expect(aoi.getCellKey(-100, -150)).toBe("-2,-3");
    });

    it("should handle cell boundaries correctly", () => {
      // Just inside cell (0,0)
      expect(aoi.getCellKey(49.9, 49.9)).toBe("0,0");
      // Just inside cell (1,1)
      expect(aoi.getCellKey(50, 50)).toBe("1,1");
    });
  });

  describe("updateEntityPosition", () => {
    it("should add entity to correct cell", () => {
      aoi.updateEntityPosition("entity1", 25, 25);

      // Subscribe a player to see the entity
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");

      const subscribers = aoi.getSubscribersForEntity("entity1");
      expect(subscribers.has("socket1")).toBe(true);
    });

    it("should return true when entity changes cells", () => {
      aoi.updateEntityPosition("entity1", 25, 25);
      const changed = aoi.updateEntityPosition("entity1", 75, 75);
      expect(changed).toBe(true);
    });

    it("should return false when entity stays in same cell", () => {
      aoi.updateEntityPosition("entity1", 25, 25);
      const changed = aoi.updateEntityPosition("entity1", 30, 30);
      expect(changed).toBe(false);
    });

    it("should move entity between cells correctly", () => {
      // Add player at origin
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");

      // Add entity in same cell
      aoi.updateEntityPosition("entity1", 25, 25);
      expect(aoi.getSubscribersForEntity("entity1").has("socket1")).toBe(true);

      // Move entity far away (outside view distance)
      aoi.updateEntityPosition("entity1", 500, 500);
      expect(aoi.getSubscribersForEntity("entity1").has("socket1")).toBe(false);
    });
  });

  describe("removeEntity", () => {
    it("should remove entity from tracking", () => {
      aoi.updateEntityPosition("entity1", 25, 25);
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");

      aoi.removeEntity("entity1");

      const subscribers = aoi.getSubscribersForEntity("entity1");
      expect(subscribers.size).toBe(0);
    });

    it("should handle removing non-existent entity", () => {
      expect(() => aoi.removeEntity("nonexistent")).not.toThrow();
    });
  });

  describe("updatePlayerSubscriptions", () => {
    it("should subscribe player to surrounding cells", () => {
      const changes = aoi.updatePlayerSubscriptions(
        "player1",
        25,
        25,
        "socket1",
      );

      // With view distance 2, should subscribe to 5x5 = 25 cells
      expect(changes.entered.length).toBe(25);
      expect(changes.exited.length).toBe(0);
    });

    it("should detect entered and exited cells on move", () => {
      // Initial position
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");

      // Move one cell to the right
      const changes = aoi.updatePlayerSubscriptions(
        "player1",
        75,
        25,
        "socket1",
      );

      // Should enter new column and exit old column
      expect(changes.entered.length).toBe(5); // 5 new cells on right edge
      expect(changes.exited.length).toBe(5); // 5 old cells on left edge
    });

    it("should not change subscriptions for small movement within cell", () => {
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      const changes = aoi.updatePlayerSubscriptions(
        "player1",
        30,
        30,
        "socket1",
      );

      expect(changes.entered.length).toBe(0);
      expect(changes.exited.length).toBe(0);
    });
  });

  describe("removePlayer", () => {
    it("should remove player from all subscriptions", () => {
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      aoi.updateEntityPosition("entity1", 25, 25);

      aoi.removePlayer("player1");

      // Entity should have no subscribers now
      const subscribers = aoi.getSubscribersForEntity("entity1");
      expect(subscribers.size).toBe(0);
    });
  });

  describe("getSubscribersForEntity", () => {
    it("should return all players subscribed to entity cell", () => {
      // Add entity
      aoi.updateEntityPosition("entity1", 25, 25);

      // Add multiple players in range
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      aoi.updatePlayerSubscriptions("player2", 30, 30, "socket2");
      aoi.updatePlayerSubscriptions("player3", 500, 500, "socket3"); // Too far

      const subscribers = aoi.getSubscribersForEntity("entity1");

      expect(subscribers.has("socket1")).toBe(true);
      expect(subscribers.has("socket2")).toBe(true);
      expect(subscribers.has("socket3")).toBe(false);
    });

    it("should return empty set for untracked entity", () => {
      const subscribers = aoi.getSubscribersForEntity("nonexistent");
      expect(subscribers.size).toBe(0);
    });
  });

  describe("getVisibleEntities", () => {
    it("should return all entities visible to player", () => {
      // Add player
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");

      // Add entities at various distances
      aoi.updateEntityPosition("near1", 25, 25);
      aoi.updateEntityPosition("near2", 50, 50);
      aoi.updateEntityPosition("far1", 500, 500);

      const visible = aoi.getVisibleEntities("player1");

      expect(visible.has("near1")).toBe(true);
      expect(visible.has("near2")).toBe(true);
      expect(visible.has("far1")).toBe(false);
    });

    it("should return empty set for untracked player", () => {
      const visible = aoi.getVisibleEntities("nonexistent");
      expect(visible.size).toBe(0);
    });
  });

  describe("getEntitiesInCells", () => {
    it("should return entities in specified cells", () => {
      aoi.updateEntityPosition("entity1", 25, 25); // Cell 0,0
      aoi.updateEntityPosition("entity2", 75, 75); // Cell 1,1
      aoi.updateEntityPosition("entity3", 125, 125); // Cell 2,2

      const entities = aoi.getEntitiesInCells(["0,0", "1,1"]);

      expect(entities.has("entity1")).toBe(true);
      expect(entities.has("entity2")).toBe(true);
      expect(entities.has("entity3")).toBe(false);
    });
  });

  describe("canPlayerSeeEntity", () => {
    it("should return true when entity is in player view", () => {
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      aoi.updateEntityPosition("entity1", 30, 30);

      expect(aoi.canPlayerSeeEntity("player1", "entity1")).toBe(true);
    });

    it("should return false when entity is out of view", () => {
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      aoi.updateEntityPosition("entity1", 500, 500);

      expect(aoi.canPlayerSeeEntity("player1", "entity1")).toBe(false);
    });

    it("should return false for untracked player or entity", () => {
      expect(aoi.canPlayerSeeEntity("player1", "entity1")).toBe(false);
    });
  });

  describe("getDebugInfo", () => {
    it("should return correct statistics", () => {
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      aoi.updatePlayerSubscriptions("player2", 100, 100, "socket2");
      aoi.updateEntityPosition("entity1", 25, 25);
      aoi.updateEntityPosition("entity2", 50, 50);

      const info = aoi.getDebugInfo();

      expect(info.playerCount).toBe(2);
      expect(info.entityCount).toBe(2);
      expect(info.cellCount).toBeGreaterThan(0);
    });
  });

  describe("clear", () => {
    it("should clear all data", () => {
      aoi.updatePlayerSubscriptions("player1", 25, 25, "socket1");
      aoi.updateEntityPosition("entity1", 25, 25);

      aoi.clear();

      const info = aoi.getDebugInfo();
      expect(info.playerCount).toBe(0);
      expect(info.entityCount).toBe(0);
      expect(info.cellCount).toBe(0);
    });
  });

  describe("scalability", () => {
    it("should handle many entities efficiently", () => {
      const startTime = performance.now();

      // Add 1000 entities
      for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 1000;
        const z = (Math.random() - 0.5) * 1000;
        aoi.updateEntityPosition(`entity${i}`, x, z);
      }

      // Add 100 players
      for (let i = 0; i < 100; i++) {
        const x = (Math.random() - 0.5) * 1000;
        const z = (Math.random() - 0.5) * 1000;
        aoi.updatePlayerSubscriptions(`player${i}`, x, z, `socket${i}`);
      }

      const setupTime = performance.now() - startTime;

      // Query subscribers for all entities
      const queryStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        aoi.getSubscribersForEntity(`entity${i}`);
      }
      const queryTime = performance.now() - queryStart;

      // Should complete in reasonable time
      expect(setupTime).toBeLessThan(1000); // < 1s for setup
      expect(queryTime).toBeLessThan(100); // < 100ms for 1000 queries
    });
  });
});
