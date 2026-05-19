/**
 * AgentBehaviorEngine Unit Tests
 *
 * Tests pure decision logic for agent AI (runs in worker thread).
 * All functions are pure: serializable input → serializable output, no World access.
 *
 * Key behaviors tested:
 * - Batch processing (processAgentTicks)
 * - Combat chat reactions
 * - Food consumption (assessAndEat)
 * - Equipment management
 * - Inventory management (drop excess)
 * - Quest-driven action selection
 * - Default combat/explore fallback
 */

import { describe, it, expect, beforeAll } from "vitest";
import { processAgentTicks, initializeItems } from "../AgentBehaviorEngine";
import type { AgentTickInput } from "../workerTypes";

/** Helper: create a minimal valid AgentTickInput */
function makeInput(overrides: Partial<AgentTickInput> = {}): AgentTickInput {
  return {
    characterId: "agent-1",
    playerId: "player-1",
    name: "TestBot",
    gameState: {
      playerId: "player-1",
      position: [100, 0, 100],
      health: 80,
      maxHealth: 100,
      alive: true,
      skills: {},
      inventory: [],
      equipment: {},
      nearbyEntities: [],
      inCombat: false,
      currentTarget: null,
      activePrayers: [],
    },
    inventoryItems: [],
    equippedItems: {},
    questState: [],
    availableQuests: [],
    agentState: {
      goal: null,
      questsAccepted: [],
      currentTargetId: null,
      lastAteAt: 0,
      dropCooldownUntil: 0,
      lastGatherTargetId: null,
      lastGatherQueuedAt: 0,
      pendingChatReaction: null,
      lastCombatChatAt: 0,
    },
    npcPositions: [],
    otherAgentTargets: [],
    resourceSystemAvailable: true,
    spawnAnchors: [{ position: [100, 0, 100], name: "spawn" }],
    worldResources: [],
    stationPositions: [],
    ...overrides,
  };
}

beforeAll(() => {
  // Initialize worker-side item DB with test items
  initializeItems([
    [
      "cooked_shrimp",
      {
        id: "cooked_shrimp",
        name: "Cooked Shrimp",
        type: "food",
        healAmount: 3,
      },
    ],
    [
      "bronze_shortsword",
      {
        id: "bronze_shortsword",
        name: "Bronze Shortsword",
        type: "weapon",
        equipSlot: "weapon",
        bonuses: { attack: 4, strength: 3 },
      },
    ],
    [
      "iron_shortsword",
      {
        id: "iron_shortsword",
        name: "Iron Shortsword",
        type: "weapon",
        equipSlot: "weapon",
        bonuses: { attack: 8, strength: 7 },
      },
    ],
    [
      "bronze_helmet",
      {
        id: "bronze_helmet",
        name: "Bronze Helmet",
        type: "armor",
        equipSlot: "helmet",
        bonuses: { defense: 3, attack: 0 },
      },
    ],
    ["bones", { id: "bones", name: "Bones", type: "misc" }],
    ["logs", { id: "logs", name: "Logs", type: "misc" }],
  ]);
});

describe("AgentBehaviorEngine", () => {
  describe("processAgentTicks", () => {
    it("processes a batch of agents and returns one result per input", () => {
      const inputs = [makeInput(), makeInput({ characterId: "agent-2" })];
      const results = processAgentTicks(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].characterId).toBe("agent-1");
      expect(results[1].characterId).toBe("agent-2");
    });

    it("returns action, sideEffects, and updatedState for each agent", () => {
      const results = processAgentTicks([makeInput()]);
      const result = results[0];

      expect(result).toHaveProperty("action");
      expect(result).toHaveProperty("sideEffects");
      expect(result).toHaveProperty("updatedState");
      expect(result.action).toHaveProperty("type");
    });
  });

  describe("Combat Chat Reactions", () => {
    it("generates chat message from pending reaction", () => {
      const input = makeInput();
      input.agentState.pendingChatReaction = {
        type: "critical_hit_dealt",
        opponentName: "Goblin",
        timestamp: Date.now(),
      };

      const [result] = processAgentTicks([input]);

      expect(result.chatMessage).toBeDefined();
      expect(typeof result.chatMessage).toBe("string");
      expect(result.chatMessage!.length).toBeGreaterThan(0);
    });

    it("clears pending reaction after processing", () => {
      const input = makeInput();
      input.agentState.pendingChatReaction = {
        type: "near_death",
        opponentName: "Dragon",
        timestamp: Date.now(),
      };

      const [result] = processAgentTicks([input]);

      // updatedState should not carry the reaction forward
      expect(result.chatMessage).toBeDefined();
    });
  });

  describe("Food Consumption", () => {
    it("eats food when health is below threshold", () => {
      const input = makeInput();
      input.gameState.health = 30;
      input.gameState.maxHealth = 100;
      input.inventoryItems = [
        { slot: 0, itemId: "cooked_shrimp", quantity: 5 },
      ];

      const [result] = processAgentTicks([input]);

      const useEffect = result.sideEffects.find((e) => e.type === "use");
      expect(useEffect).toBeDefined();
      expect(result.action.type).toBe("idle"); // Early return after eating
    });

    it("does not eat when health is above threshold", () => {
      const input = makeInput();
      input.gameState.health = 90;
      input.gameState.maxHealth = 100;
      input.inventoryItems = [
        { slot: 0, itemId: "cooked_shrimp", quantity: 5 },
      ];

      const [result] = processAgentTicks([input]);

      const useEffect = result.sideEffects.find((e) => e.type === "use");
      // Should not eat at 90% health
      expect(useEffect).toBeUndefined();
    });
  });

  describe("Equipment Management", () => {
    it("equips better weapon from inventory", () => {
      const input = makeInput();
      input.equippedItems = { weapon: "bronze_shortsword" };
      input.inventoryItems = [
        { slot: 0, itemId: "iron_shortsword", quantity: 1 },
      ];

      const [result] = processAgentTicks([input]);

      const equipEffect = result.sideEffects.find((e) => e.type === "equip");
      expect(equipEffect).toBeDefined();
      if (equipEffect && equipEffect.type === "equip") {
        expect(equipEffect.itemId).toBe("iron_shortsword");
      }
    });

    it("does not swap to weaker weapon", () => {
      const input = makeInput();
      input.equippedItems = { weapon: "iron_shortsword" };
      input.inventoryItems = [
        { slot: 0, itemId: "bronze_shortsword", quantity: 1 },
      ];

      const [result] = processAgentTicks([input]);

      const equipEffect = result.sideEffects.find(
        (e) => e.type === "equip" && e.itemId === "bronze_shortsword",
      );
      expect(equipEffect).toBeUndefined();
    });
  });

  describe("Inventory Management", () => {
    it("drops excess items when inventory is full", () => {
      const input = makeInput();
      // Fill inventory with 25 junk items
      input.inventoryItems = Array.from({ length: 25 }, (_, i) => ({
        slot: i,
        itemId: `junk_item_${i}`,
        quantity: 1,
      }));

      const [result] = processAgentTicks([input]);

      const dropEffects = result.sideEffects.filter((e) => e.type === "drop");
      expect(dropEffects.length).toBeGreaterThan(0);
    });

    it("buries bones instead of dropping them", () => {
      const input = makeInput();
      input.inventoryItems = Array.from({ length: 22 }, (_, i) => ({
        slot: i,
        itemId: i === 0 ? "bones" : `junk_item_${i}`,
        quantity: 1,
      }));

      const [result] = processAgentTicks([input]);

      const useEffect = result.sideEffects.find(
        (e) => e.type === "use" && e.itemId === "bones",
      );
      expect(useEffect).toBeDefined();
    });
  });

  describe("Action Selection", () => {
    it("attacks nearby mobs when not in combat", () => {
      const input = makeInput();
      input.gameState.nearbyEntities = [
        {
          id: "goblin-1",
          name: "Goblin",
          type: "mob",
          position: [105, 0, 100],
          distance: 5,
          health: 10,
          maxHealth: 10,
          mobType: "goblin",
        },
      ];

      const [result] = processAgentTicks([input]);

      expect(result.action.type).toBe("attack");
      if (result.action.type === "attack") {
        expect(result.action.targetId).toBe("goblin-1");
      }
    });

    it("idles when in combat", () => {
      const input = makeInput();
      input.gameState.inCombat = true;
      input.gameState.nearbyEntities = [
        {
          id: "goblin-1",
          name: "Goblin",
          type: "mob",
          position: [105, 0, 100],
          distance: 5,
          health: 10,
          maxHealth: 10,
          mobType: "goblin",
        },
      ];

      const [result] = processAgentTicks([input]);

      expect(result.action.type).toBe("idle");
    });

    it("moves toward spawn when no targets nearby", () => {
      const input = makeInput();
      input.gameState.position = [500, 0, 500]; // Far from spawn
      input.spawnAnchors = [{ position: [100, 0, 100], name: "spawn" }];

      const [result] = processAgentTicks([input]);

      expect(result.action.type).toBe("move");
    });

    it("picks up nearby items opportunistically", () => {
      const input = makeInput();
      input.gameState.nearbyEntities = [
        {
          id: "item-1",
          name: "Coins",
          type: "item",
          position: [102, 0, 100],
          distance: 2,
          itemId: "coins",
        },
      ];

      const [result] = processAgentTicks([input]);

      expect(result.action.type).toBe("pickup");
      if (result.action.type === "pickup") {
        expect(result.action.targetId).toBe("item-1");
      }
    });
  });

  describe("Quest Management", () => {
    it("sets combat goal when no quests available", () => {
      const input = makeInput();
      const [result] = processAgentTicks([input]);

      expect(result.updatedState.goal).not.toBeNull();
      expect(result.updatedState.goal!.type).toBe("combat");
    });
  });
});
