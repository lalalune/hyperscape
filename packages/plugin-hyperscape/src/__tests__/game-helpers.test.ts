/**
 * Game Helpers Unit Tests
 * Tests shared game helper functions for A2A, MCP, and providers
 */

import { describe, it, expect } from "bun:test";
import {
  determineArea,
  calculateDistance,
  getDirection,
  directionToOffset,
  calculateCombatLevel,
  assessThreat,
  categorizeEntities,
  getPlayerStatus,
  generateSceneDescription
} from "../shared/game-helpers.js";
import type { Skills, PlayerEntity, Entity } from "../types.js";

describe("Game Helpers", () => {
  describe("determineArea", () => {
    it("should identify Brookhaven spawn area", () => {
      const area = determineArea([0, 0, 0]);
      expect(area.name).toBe("Brookhaven");
      expect(area.safeZone).toBe(true);
    });

    it("should identify Mistwood Valley", () => {
      const area = determineArea([-150, 0, 0]);
      expect(area.name).toBe("Mistwood Valley");
    });

    it("should identify Goblin Wastes", () => {
      const area = determineArea([150, 0, 0]);
      expect(area.name).toBe("The Goblin Wastes");
    });

    it("should identify Darkwood Forest", () => {
      const area = determineArea([100, 0, 300]);
      expect(area.name).toBe("Darkwood Forest");
    });

    it("should identify Great Lakes", () => {
      const area = determineArea([0, 0, -300]);
      expect(area.name).toBe("The Great Lakes");
    });

    it("should return Wilderness for unknown areas", () => {
      // Position between defined areas (x=50, z=150 not covered by any area)
      const area = determineArea([50, 0, 150]);
      expect(area.name).toBe("The Wilderness");
    });
  });

  describe("calculateDistance", () => {
    it("should calculate distance between two points", () => {
      const dist = calculateDistance([0, 0, 0], [3, 0, 4]);
      expect(dist).toBe(5);
    });

    it("should handle negative coordinates", () => {
      const dist = calculateDistance([-5, 0, 0], [5, 0, 0]);
      expect(dist).toBe(10);
    });

    it("should ignore Y axis", () => {
      const dist = calculateDistance([0, 0, 0], [0, 100, 0]);
      expect(dist).toBe(0);
    });
  });

  describe("getDirection", () => {
    it("should return north for negative Z", () => {
      const dir = getDirection([0, 0, 0], [0, 0, -20]);
      expect(dir).toBe("north");
    });

    it("should return south for positive Z", () => {
      const dir = getDirection([0, 0, 0], [0, 0, 20]);
      expect(dir).toBe("south");
    });

    it("should return east for positive X", () => {
      const dir = getDirection([0, 0, 0], [20, 0, 0]);
      expect(dir).toBe("east");
    });

    it("should return west for negative X", () => {
      const dir = getDirection([0, 0, 0], [-20, 0, 0]);
      expect(dir).toBe("west");
    });

    it("should return compound directions", () => {
      const dir = getDirection([0, 0, 0], [20, 0, -20]);
      expect(dir).toBe("northeast");
    });

    it("should return nearby for close positions", () => {
      const dir = getDirection([0, 0, 0], [2, 0, 2]);
      expect(dir).toBe("nearby");
    });
  });

  describe("directionToOffset", () => {
    it("should calculate north offset", () => {
      const { dx, dz } = directionToOffset("north", 10);
      expect(dx).toBe(0);
      expect(dz).toBe(-10);
    });

    it("should calculate northeast offset", () => {
      const { dx, dz } = directionToOffset("northeast", 10);
      expect(dx).toBe(10);
      expect(dz).toBe(-10);
    });

    it("should handle case insensitivity", () => {
      const { dx, dz } = directionToOffset("SOUTH", 5);
      expect(dx).toBe(0);
      expect(dz).toBe(5);
    });
  });

  describe("calculateCombatLevel", () => {
    it("should calculate combat level from skills", () => {
      const skills: Skills = {
        attack: { level: 10, xp: 1000 },
        strength: { level: 10, xp: 1000 },
        defense: { level: 10, xp: 1000 },
        constitution: { level: 10, xp: 1000 },
        ranged: { level: 1, xp: 0 }
      };
      const combatLevel = calculateCombatLevel(skills);
      expect(combatLevel).toBeGreaterThan(0);
    });

    it("should return base level for empty skills", () => {
      const skills: Skills = {};
      const combatLevel = calculateCombatLevel(skills);
      expect(combatLevel).toBeGreaterThan(0);
    });
  });

  describe("assessThreat", () => {
    it("should assess goblins as safe", () => {
      expect(assessThreat("Goblin", 10)).toBe("safe");
    });

    it("should assess dark warriors as high threat for low levels", () => {
      expect(assessThreat("Dark Warrior", 5)).toBe("high");
    });

    it("should assess dark warriors as medium threat for high levels", () => {
      expect(assessThreat("Dark Warrior", 25)).toBe("medium");
    });

    it("should assess black knights as dangerous for low levels", () => {
      expect(assessThreat("Black Knight", 10)).toBe("dangerous");
    });

    it("should assess unknown mobs as low threat", () => {
      expect(assessThreat("Unknown Mob", 10)).toBe("low");
    });
  });

  describe("categorizeEntities", () => {
    const playerPos: [number, number, number] = [0, 0, 0];
    
    it("should categorize mobs correctly", () => {
      const entities: Entity[] = [
        { id: "goblin-1", name: "Goblin", position: [10, 0, 10], mobType: "goblin" } as Entity
      ];
      const result = categorizeEntities(entities, playerPos, "player-1", 10);
      expect(result.mobs.length).toBe(1);
      expect(result.mobs[0].name).toBe("Goblin");
    });

    it("should categorize resources correctly", () => {
      const entities: Entity[] = [
        { id: "tree-1", name: "Oak Tree", position: [20, 0, 20], resourceType: "tree" } as Entity
      ];
      const result = categorizeEntities(entities, playerPos);
      expect(result.resources.length).toBe(1);
    });

    it("should exclude player from results", () => {
      const entities: Entity[] = [
        { id: "player-1", name: "Player", position: [0, 0, 0], playerId: "player-1" } as Entity
      ];
      const result = categorizeEntities(entities, playerPos, "player-1");
      expect(result.players.length).toBe(0);
    });

    it("should sort by distance", () => {
      const entities: Entity[] = [
        { id: "goblin-far", name: "Goblin", position: [100, 0, 100], mobType: "goblin" } as Entity,
        { id: "goblin-near", name: "Goblin", position: [10, 0, 10], mobType: "goblin" } as Entity
      ];
      const result = categorizeEntities(entities, playerPos);
      expect(result.mobs[0].id).toBe("goblin-near");
    });
  });

  describe("getPlayerStatus", () => {
    const mockPlayer: PlayerEntity = {
      id: "player-1",
      name: "TestPlayer",
      playerName: "TestPlayer",
      position: [100, 0, 200] as [number, number, number],
      health: { current: 80, max: 100 },
      stamina: { current: 50, max: 100 },
      alive: true,
      inCombat: false,
      skills: {
        attack: { level: 10, xp: 1000 },
        strength: { level: 10, xp: 1000 },
        defense: { level: 10, xp: 1000 }
      },
      items: [],
      coins: 500
    };

    it("should return complete player status", () => {
      const status = getPlayerStatus(mockPlayer);
      expect(status.id).toBe("player-1");
      expect(status.alive).toBe(true);
      expect(status.health.current).toBe(80);
      expect(status.health.max).toBe(100);
      expect(status.health.percent).toBe(80);
      expect(status.position).toEqual([100, 0, 200]);
    });

    it("should handle missing health", () => {
      const playerNoHealth = { ...mockPlayer, health: undefined };
      const status = getPlayerStatus(playerNoHealth as PlayerEntity);
      expect(status.health.current).toBe(100);
      expect(status.health.max).toBe(100);
    });

    it("should calculate combat level", () => {
      const status = getPlayerStatus(mockPlayer);
      expect(status.combatLevel).toBeGreaterThan(0);
    });
  });

  describe("generateSceneDescription", () => {
    const mockPlayer: PlayerEntity = {
      id: "player-1",
      name: "TestPlayer",
      position: [0, 0, 0] as [number, number, number],
      health: { current: 100, max: 100 },
      stamina: { current: 100, max: 100 },
      alive: true,
      inCombat: false,
      skills: {},
      items: [],
      coins: 0
    };

    it("should generate basic scene description", () => {
      const description = generateSceneDescription(mockPlayer, []);
      expect(description).toContain("Brookhaven");
      expect(description).toContain("SAFE ZONE");
    });

    it("should include nearby mobs", () => {
      const entities: Entity[] = [
        { id: "goblin-1", name: "Goblin", position: [10, 0, 10], mobType: "goblin" } as Entity
      ];
      const description = generateSceneDescription(mockPlayer, entities);
      expect(description).toContain("Goblin");
    });

    it("should include status when enabled", () => {
      const description = generateSceneDescription(mockPlayer, [], { includeStatus: true });
      expect(description).toContain("Health: 100%");
    });

    it("should include suggestions when enabled", () => {
      const description = generateSceneDescription(mockPlayer, [], { includeSuggestions: true });
      expect(description).toContain("SUGGESTIONS");
    });

    it("should respect maxMobs option", () => {
      const entities: Entity[] = Array(10).fill(null).map((_, i) => ({
        id: `goblin-${i}`,
        name: "Goblin",
        position: [10 + i, 0, 10] as [number, number, number],
        mobType: "goblin"
      })) as Entity[];
      
      const description = generateSceneDescription(mockPlayer, entities, { maxMobs: 3 });
      const goblinCount = (description.match(/Goblin/g) ?? []).length;
      expect(goblinCount).toBeLessThanOrEqual(4); // maxMobs + potentially one in suggestions
    });
  });
});

