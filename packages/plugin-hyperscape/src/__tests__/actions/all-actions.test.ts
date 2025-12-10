/**
 * Comprehensive Tests for All ElizaOS Agent Actions
 *
 * Tests every action in the Hyperscape plugin for:
 * - Validation logic (validate function)
 * - Handler execution (handler function)
 * - Example coverage
 * - Simile matching
 * - Error handling
 *
 * These tests use mocked services to verify action logic without requiring
 * a live Hyperscape server.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { IAgentRuntime, Memory, State, UUID } from "@elizaos/core";

// Import all actions
import { moveToAction, followEntityAction, stopMovementAction } from "../../actions/movement.js";
import { attackEntityAction as combatAttackAction, changeCombatStyleAction } from "../../actions/combat.js";
import { equipItemAction, unequipItemAction, useItemAction, dropItemAction } from "../../actions/inventory.js";
import {
  bankDepositAction,
  bankWithdrawAction,
  bankDepositAllAction,
  bankDepositCoinsAction,
  bankWithdrawCoinsAction,
} from "../../actions/banking.js";
import { interactNpcAction, lootCorpseAction, pickupItemAction, respawnAction, emoteAction, eatFoodAction } from "../../actions/interactions.js";
import { chatMessageAction, localChatAction, whisperAction } from "../../actions/social.js";
import { setGoalAction, navigateToAction } from "../../actions/goals.js";
import { exploreAction, fleeAction, idleAction, approachEntityAction, attackEntityAction as autonomousAttackAction } from "../../actions/autonomous.js";
import { chopTreeAction, catchFishAction, lightFireAction, cookFoodAction } from "../../actions/skills.js";
import { buyItemAction, sellItemAction } from "../../actions/store.js";
import { dialogueRespondAction, closeDialogueAction } from "../../actions/dialogue.js";
import { examineEntityAction, examineInventoryItemAction } from "../../actions/examine.js";

// Mock helpers
function generateUUID(): UUID {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as UUID;
}

function createMockMemory(text: string = "test"): Memory {
  return {
    id: generateUUID(),
    entityId: generateUUID(),
    agentId: generateUUID(),
    roomId: generateUUID(),
    content: { text },
    createdAt: Date.now(),
  } as Memory;
}

function createMockState(overrides: Partial<State> = {}): State {
  return {
    values: {},
    data: {},
    text: "",
    ...overrides,
  } as State;
}

interface MockServiceOptions {
  isConnected?: boolean;
  hasPlayer?: boolean;
  playerAlive?: boolean;
  playerHealth?: number;
  playerMaxHealth?: number;
  playerPosition?: [number, number, number];
  playerInCombat?: boolean;
  playerItems?: Array<{ id: string; name: string; quantity: number }>;
  playerCoins?: number;
  playerEquipment?: {
    weapon: string | null;
    shield: string | null;
    helmet: string | null;
    body: string | null;
    legs: string | null;
    boots: string | null;
  };
  nearbyEntities?: Array<{
    id: string;
    name: string;
    type?: string;
    mobType?: string;
    resourceType?: string;
    position?: [number, number, number];
    alive?: boolean;
  }>;
  hasBehaviorManager?: boolean;
  hasGoal?: boolean;
  goalLocation?: string;
}

function createMockService(options: MockServiceOptions = {}) {
  const {
    isConnected = true,
    hasPlayer = true,
    playerAlive = true,
    playerHealth = 100,
    playerMaxHealth = 100,
    playerPosition = [0, 0, 0],
    playerInCombat = false,
    playerItems = [],
    playerCoins = 0,
    playerEquipment = { weapon: null, shield: null, helmet: null, body: null, legs: null, boots: null },
    nearbyEntities = [],
    hasBehaviorManager = false,
    hasGoal = false,
    goalLocation,
  } = options;

  const player = hasPlayer
    ? {
        id: "player-1",
        playerName: "TestPlayer",
        position: playerPosition,
        alive: playerAlive,
        health: { current: playerHealth, max: playerMaxHealth },
        inCombat: playerInCombat,
        items: playerItems,
        coins: playerCoins,
        equipment: playerEquipment,
        skills: {
          attack: { level: 10, xp: 1000 },
          strength: { level: 10, xp: 1000 },
          defence: { level: 10, xp: 1000 },
          woodcutting: { level: 5, xp: 500 },
        },
      }
    : null;

  const behaviorManager = hasBehaviorManager
    ? {
        hasGoal: () => hasGoal,
        getGoal: () =>
          hasGoal
            ? {
                type: "combat_training",
                description: "Train attack",
                target: 10,
                progress: 5,
                location: goalLocation || "spawn",
              }
            : null,
        setGoal: vi.fn(),
        clearGoal: vi.fn(),
        updateGoalProgress: vi.fn(),
      }
    : null;

  return {
    isConnected: vi.fn(() => isConnected),
    getPlayerEntity: vi.fn(() => player),
    getNearbyEntities: vi.fn(() => nearbyEntities),
    getWorld: vi.fn(() => ({
      chat: { add: vi.fn() },
      entities: { player },
    })),
    getBehaviorManager: vi.fn(() => behaviorManager),
    executeMove: vi.fn(),
    executeAttack: vi.fn(),
    executeEquipItem: vi.fn(),
    executeUseItem: vi.fn(),
    executeDropItem: vi.fn(),
    executePickupItem: vi.fn(),
    executeNpcInteract: vi.fn(),
    executeLootCorpse: vi.fn(),
    executeRespawn: vi.fn(),
    executeEmote: vi.fn(),
    executeEatFood: vi.fn(),
    executeChatMessage: vi.fn(),
    executeGatherResource: vi.fn(),
    executeBankAction: vi.fn(),
    executeChangeCombatStyle: vi.fn(),
    syncGoalToServer: vi.fn(),
    currentWorldId: "world-1",
    runtime: { agentId: generateUUID() },
    getMessageManager: vi.fn(),
  };
}

function createMockRuntime(service: ReturnType<typeof createMockService>): IAgentRuntime {
  return {
    agentId: generateUUID(),
    character: { name: "TestAgent" },
    getService: vi.fn((name: string) => {
      if (name === "hyperscapeService" || name === "hyperscape") {
        return service;
      }
      return null;
    }),
    createMemory: vi.fn(),
    composeState: vi.fn(() => Promise.resolve(createMockState())),
    useModel: vi.fn(() => Promise.resolve("EXPLORE")),
    evaluate: vi.fn(() => Promise.resolve([])),
  } as unknown as IAgentRuntime;
}

// ============================================================================
// MOVEMENT ACTIONS TESTS
// ============================================================================

describe("Movement Actions", () => {
  describe("moveToAction", () => {
    it("should have correct metadata", () => {
      expect(moveToAction.name).toBe("MOVE_TO");
      expect(moveToAction.similes).toContain("WALK_TO");
      expect(moveToAction.similes).toContain("GO_TO");
      expect(moveToAction.description).toBeDefined();
      expect(moveToAction.examples.length).toBeGreaterThan(0);
    });

    it("should validate when service is connected and player exists", async () => {
      const service = createMockService({ isConnected: true, hasPlayer: true });
      const runtime = createMockRuntime(service);
      const result = await moveToAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when not connected", async () => {
      const service = createMockService({ isConnected: false });
      const runtime = createMockRuntime(service);
      const result = await moveToAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });

    it("should fail validation when no player", async () => {
      const service = createMockService({ hasPlayer: false });
      const runtime = createMockRuntime(service);
      const result = await moveToAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });

    it("should execute movement command with proper coordinates", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      // Movement action requires coordinates in [x, y, z] format
      await moveToAction.handler(
        runtime,
        createMockMemory("Move to coordinates [10, 0, 20]"),
        createMockState(),
        undefined,
        callback
      );

      expect(service.executeMove).toHaveBeenCalledWith({
        target: [10, 0, 20],
        runMode: false,
      });
    });
    
    it("should fail gracefully with invalid coordinates", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await moveToAction.handler(
        runtime,
        createMockMemory("move to somewhere"),
        createMockState(),
        undefined,
        callback
      );

      expect(result.success).toBe(false);
      expect(service.executeMove).not.toHaveBeenCalled();
    });
  });

  describe("followEntityAction", () => {
    it("should have correct metadata", () => {
      expect(followEntityAction.name).toBe("FOLLOW_ENTITY");
      expect(followEntityAction.description).toBeDefined();
    });

    it("should validate when entity is nearby", async () => {
      const service = createMockService({
        nearbyEntities: [{ id: "player-2", name: "OtherPlayer", position: [5, 0, 5] }],
      });
      const runtime = createMockRuntime(service);
      const result = await followEntityAction.validate(runtime, createMockMemory("follow OtherPlayer"));
      expect(result).toBe(true);
    });
  });

  describe("stopMovementAction", () => {
    it("should have correct metadata", () => {
      expect(stopMovementAction.name).toBe("STOP_MOVEMENT");
      expect(stopMovementAction.similes).toContain("STOP");
    });

    it("should validate when connected", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const result = await stopMovementAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// COMBAT ACTIONS TESTS
// ============================================================================

describe("Combat Actions", () => {
  describe("attackEntityAction (combat)", () => {
    it("should have correct metadata", () => {
      expect(combatAttackAction.name).toBe("ATTACK_ENTITY");
      expect(combatAttackAction.similes).toContain("ATTACK");
      expect(combatAttackAction.similes).toContain("FIGHT");
    });

    it("should validate when mobs nearby and healthy", async () => {
      const service = createMockService({
        playerHealth: 80,
        playerInCombat: false,
        nearbyEntities: [
          { id: "mob-1", name: "Goblin", mobType: "goblin", position: [5, 0, 5], alive: true },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await combatAttackAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when no attackable mobs nearby", async () => {
      const service = createMockService({
        nearbyEntities: [],
      });
      const runtime = createMockRuntime(service);
      const result = await combatAttackAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });

    it("should fail validation when already in combat", async () => {
      const service = createMockService({
        playerHealth: 80,
        playerInCombat: true, // Already fighting
        nearbyEntities: [
          { id: "mob-1", name: "Goblin", mobType: "goblin", position: [5, 0, 5], alive: true },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await combatAttackAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });

    it("should execute attack on named mob", async () => {
      const service = createMockService({
        nearbyEntities: [
          { id: "mob-1", name: "Goblin", mobType: "goblin", position: [2, 0, 2], alive: true },
        ],
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      // Combat action finds mob by checking if message content is contained in mob name (lowercase)
      // e.g., "goblin" in "Goblin".toLowerCase() = true
      await combatAttackAction.handler(
        runtime, 
        createMockMemory("Goblin"), // Message content must be findable in entity names
        createMockState(), 
        undefined, 
        callback
      );

      expect(service.executeAttack).toHaveBeenCalledWith({ targetEntityId: "mob-1" });
    });
  });

  describe("changeCombatStyleAction", () => {
    it("should have correct metadata", () => {
      expect(changeCombatStyleAction.name).toBe("CHANGE_COMBAT_STYLE");
    });

    it("should validate when connected and not dead", async () => {
      const service = createMockService({ playerAlive: true });
      const runtime = createMockRuntime(service);
      const result = await changeCombatStyleAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// INVENTORY ACTIONS TESTS
// ============================================================================

describe("Inventory Actions", () => {
  describe("equipItemAction", () => {
    it("should have correct metadata", () => {
      expect(equipItemAction.name).toBe("EQUIP_ITEM");
      expect(equipItemAction.similes).toContain("EQUIP");
      expect(equipItemAction.similes).toContain("WEAR");
    });

    it("should validate when item in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Bronze Sword", quantity: 1 }],
      });
      const runtime = createMockRuntime(service);
      const result = await equipItemAction.validate(runtime, createMockMemory("equip bronze sword"));
      expect(result).toBe(true);
    });

    it("should fail validation when inventory empty", async () => {
      const service = createMockService({ playerItems: [] });
      const runtime = createMockRuntime(service);
      const result = await equipItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("useItemAction", () => {
    it("should have correct metadata", () => {
      expect(useItemAction.name).toBe("USE_ITEM");
      expect(useItemAction.similes).toContain("EAT");
      expect(useItemAction.similes).toContain("CONSUME");
    });

    it("should validate with items in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Potion", quantity: 1 }],
      });
      const runtime = createMockRuntime(service);
      const result = await useItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("dropItemAction", () => {
    it("should have correct metadata", () => {
      expect(dropItemAction.name).toBe("DROP_ITEM");
      expect(dropItemAction.similes).toContain("DROP");
    });

    it("should validate with items in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Logs", quantity: 5 }],
      });
      const runtime = createMockRuntime(service);
      const result = await dropItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// BANKING ACTIONS TESTS
// ============================================================================

describe("Banking Actions", () => {
  const bankNearby = { id: "bank-1", name: "Bank Booth", type: "npc", position: [2, 0, 2] as [number, number, number] };

  describe("bankDepositAction", () => {
    it("should have correct metadata", () => {
      expect(bankDepositAction.name).toBe("BANK_DEPOSIT");
    });

    it("should validate when near bank with items", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Logs", quantity: 10 }],
        nearbyEntities: [bankNearby],
      });
      const runtime = createMockRuntime(service);
      const result = await bankDepositAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when no bank nearby", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Logs", quantity: 10 }],
        nearbyEntities: [],
      });
      const runtime = createMockRuntime(service);
      const result = await bankDepositAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("bankWithdrawAction", () => {
    it("should have correct metadata", () => {
      expect(bankWithdrawAction.name).toBe("BANK_WITHDRAW");
    });

    it("should validate when near bank", async () => {
      const service = createMockService({
        nearbyEntities: [bankNearby],
      });
      const runtime = createMockRuntime(service);
      const result = await bankWithdrawAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when no bank nearby", async () => {
      const service = createMockService({ nearbyEntities: [] });
      const runtime = createMockRuntime(service);
      const result = await bankWithdrawAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("bankDepositAllAction", () => {
    it("should have correct metadata", () => {
      expect(bankDepositAllAction.name).toBe("BANK_DEPOSIT_ALL");
    });

    it("should validate when near bank with items", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Logs", quantity: 10 }],
        nearbyEntities: [bankNearby],
      });
      const runtime = createMockRuntime(service);
      const result = await bankDepositAllAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation with empty inventory", async () => {
      const service = createMockService({ playerItems: [], nearbyEntities: [bankNearby] });
      const runtime = createMockRuntime(service);
      const result = await bankDepositAllAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("bankDepositCoinsAction", () => {
    it("should have correct metadata", () => {
      expect(bankDepositCoinsAction.name).toBe("BANK_DEPOSIT_COINS");
    });

    it("should validate when near bank with coins", async () => {
      const service = createMockService({ playerCoins: 100, nearbyEntities: [bankNearby] });
      const runtime = createMockRuntime(service);
      const result = await bankDepositCoinsAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation with no coins", async () => {
      const service = createMockService({ playerCoins: 0, nearbyEntities: [bankNearby] });
      const runtime = createMockRuntime(service);
      const result = await bankDepositCoinsAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("bankWithdrawCoinsAction", () => {
    it("should have correct metadata", () => {
      expect(bankWithdrawCoinsAction.name).toBe("BANK_WITHDRAW_COINS");
    });

    it("should validate when near bank", async () => {
      const service = createMockService({ nearbyEntities: [bankNearby] });
      const runtime = createMockRuntime(service);
      const result = await bankWithdrawCoinsAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when no bank nearby", async () => {
      const service = createMockService({ nearbyEntities: [] });
      const runtime = createMockRuntime(service);
      const result = await bankWithdrawCoinsAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// INTERACTION ACTIONS TESTS
// ============================================================================

describe("Interaction Actions", () => {
  describe("interactNpcAction", () => {
    it("should have correct metadata", () => {
      expect(interactNpcAction.name).toBe("INTERACT_NPC");
      expect(interactNpcAction.similes).toContain("TALK_TO");
    });

    it("should validate when NPC nearby", async () => {
      const service = createMockService({
        nearbyEntities: [{ id: "npc-1", name: "Shopkeeper", type: "npc", position: [3, 0, 3] }],
      });
      const runtime = createMockRuntime(service);
      const result = await interactNpcAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("lootCorpseAction", () => {
    it("should have correct metadata", () => {
      expect(lootCorpseAction.name).toBe("LOOT_CORPSE");
      expect(lootCorpseAction.similes).toContain("LOOT");
    });

    it("should validate when corpse nearby", async () => {
      const service = createMockService({
        nearbyEntities: [{ id: "corpse-1", name: "Goblin Corpse", type: "corpse", position: [2, 0, 2] }],
      });
      const runtime = createMockRuntime(service);
      const result = await lootCorpseAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("pickupItemAction", () => {
    it("should have correct metadata", () => {
      expect(pickupItemAction.name).toBe("PICKUP_ITEM");
      expect(pickupItemAction.similes).toContain("TAKE");
      expect(pickupItemAction.similes).toContain("GRAB");
    });

    it("should validate when ground items nearby", async () => {
      const service = createMockService({
        // Ground items have names starting with "item:" prefix
        nearbyEntities: [{ id: "item-1", name: "item:Gold Coins", type: "ground_item", position: [1, 0, 1] }],
      });
      const runtime = createMockRuntime(service);
      const result = await pickupItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("respawnAction", () => {
    it("should have correct metadata", () => {
      expect(respawnAction.name).toBe("RESPAWN");
      expect(respawnAction.similes).toContain("REVIVE");
    });

    it("should validate when player is dead", async () => {
      const service = createMockService({ playerAlive: false });
      const runtime = createMockRuntime(service);
      const result = await respawnAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when player is alive", async () => {
      const service = createMockService({ playerAlive: true });
      const runtime = createMockRuntime(service);
      const result = await respawnAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("emoteAction", () => {
    it("should have correct metadata", () => {
      expect(emoteAction.name).toBe("EMOTE");
      expect(emoteAction.similes).toContain("WAVE");
      expect(emoteAction.similes).toContain("DANCE");
    });

    it("should validate when connected and alive", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const result = await emoteAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("eatFoodAction", () => {
    it("should have correct metadata", () => {
      expect(eatFoodAction.name).toBe("EAT_FOOD");
      expect(eatFoodAction.similes).toContain("EAT");
    });

    it("should validate when food in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "food-1", name: "Cooked Fish", quantity: 3 }],
      });
      const runtime = createMockRuntime(service);
      const result = await eatFoodAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// SOCIAL ACTIONS TESTS
// ============================================================================

describe("Social Actions", () => {
  describe("chatMessageAction", () => {
    it("should have correct metadata", () => {
      expect(chatMessageAction.name).toBe("CHAT_MESSAGE");
      expect(chatMessageAction.similes).toContain("CHAT");
      expect(chatMessageAction.similes).toContain("SAY");
    });

    it("should validate when connected", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const result = await chatMessageAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should execute chat message", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await chatMessageAction.handler(
        runtime,
        createMockMemory("Hello everyone!"),
        createMockState(),
        undefined,
        callback
      );

      expect(service.executeChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Hello everyone!", chatType: "global" })
      );
    });
  });

  describe("localChatAction", () => {
    it("should have correct metadata", () => {
      expect(localChatAction.name).toBe("LOCAL_CHAT");
    });

    it("should execute local chat message", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await localChatAction.handler(
        runtime,
        createMockMemory("Hello nearby!"),
        createMockState(),
        undefined,
        callback
      );

      expect(service.executeChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ chatType: "local" })
      );
    });
  });

  describe("whisperAction", () => {
    it("should have correct metadata", () => {
      expect(whisperAction.name).toBe("WHISPER");
      expect(whisperAction.similes).toContain("DM");
      expect(whisperAction.similes).toContain("PRIVATE_MESSAGE");
    });

    it("should fail without target", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      const result = await whisperAction.handler(
        runtime,
        createMockMemory("secret message"),
        createMockState(),
        undefined,
        callback
      );

      expect(result.success).toBe(false);
    });

    it("should execute whisper with target", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await whisperAction.handler(
        runtime,
        createMockMemory("secret message"),
        createMockState(),
        { targetId: "player-2" },
        callback
      );

      expect(service.executeChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ chatType: "whisper", targetId: "player-2" })
      );
    });
  });
});

// ============================================================================
// GOAL ACTIONS TESTS
// ============================================================================

describe("Goal Actions", () => {
  describe("setGoalAction", () => {
    it("should have correct metadata", () => {
      expect(setGoalAction.name).toBe("SET_GOAL");
      expect(setGoalAction.similes).toContain("CHOOSE_GOAL");
    });

    it("should validate when no current goal", async () => {
      const service = createMockService({
        hasBehaviorManager: true,
        hasGoal: false,
      });
      const runtime = createMockRuntime(service);
      const result = await setGoalAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when goal exists", async () => {
      const service = createMockService({
        hasBehaviorManager: true,
        hasGoal: true,
      });
      const runtime = createMockRuntime(service);
      const result = await setGoalAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("navigateToAction", () => {
    it("should have correct metadata", () => {
      expect(navigateToAction.name).toBe("NAVIGATE_TO");
      expect(navigateToAction.similes).toContain("GO_TO");
    });

    it("should validate when goal has location and player is far", async () => {
      const service = createMockService({
        hasBehaviorManager: true,
        hasGoal: true,
        goalLocation: "forest",
        playerPosition: [0, 0, 0], // Far from forest at [-130, 30, 400]
      });
      const runtime = createMockRuntime(service);
      const result = await navigateToAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when no goal location", async () => {
      const service = createMockService({
        hasBehaviorManager: true,
        hasGoal: true,
        goalLocation: undefined,
      });
      const runtime = createMockRuntime(service);
      const result = await navigateToAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// AUTONOMOUS ACTIONS TESTS
// ============================================================================

describe("Autonomous Actions", () => {
  describe("exploreAction", () => {
    it("should have correct metadata", () => {
      expect(exploreAction.name).toBe("EXPLORE");
      expect(exploreAction.similes).toContain("WANDER");
    });

    it("should validate when safe and not in combat", async () => {
      const service = createMockService({
        playerHealth: 80,
        playerInCombat: false,
      });
      const runtime = createMockRuntime(service);
      const result = await exploreAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when in combat", async () => {
      const service = createMockService({
        playerInCombat: true,
      });
      const runtime = createMockRuntime(service);
      const result = await exploreAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });

    it("should fail validation when health low", async () => {
      const service = createMockService({
        playerHealth: 20,
        playerMaxHealth: 100,
      });
      const runtime = createMockRuntime(service);
      const result = await exploreAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("fleeAction", () => {
    it("should have correct metadata", () => {
      expect(fleeAction.name).toBe("FLEE");
      expect(fleeAction.similes).toContain("RUN_AWAY");
    });

    it("should validate when health critical and threats nearby", async () => {
      const service = createMockService({
        playerHealth: 15,
        playerMaxHealth: 100,
        playerInCombat: true,
      });
      const runtime = createMockRuntime(service);
      const state = createMockState({
        survivalAssessment: { urgency: "critical", threats: ["Goblin"] },
      });
      const result = await fleeAction.validate(runtime, createMockMemory(), state);
      expect(result).toBe(true);
    });

    it("should fail validation when healthy", async () => {
      const service = createMockService({
        playerHealth: 80,
        playerMaxHealth: 100,
      });
      const runtime = createMockRuntime(service);
      const result = await fleeAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("idleAction", () => {
    it("should have correct metadata", () => {
      expect(idleAction.name).toBe("IDLE");
      expect(idleAction.similes).toContain("WAIT");
    });

    it("should always validate when alive", async () => {
      const service = createMockService();
      const runtime = createMockRuntime(service);
      const result = await idleAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("approachEntityAction", () => {
    it("should have correct metadata", () => {
      expect(approachEntityAction.name).toBe("APPROACH_ENTITY");
      expect(approachEntityAction.similes).toContain("WALK_TO");
    });
  });

  describe("attackEntityAction (autonomous)", () => {
    it("should have correct metadata", () => {
      expect(autonomousAttackAction.name).toBe("ATTACK_ENTITY");
      expect(autonomousAttackAction.similes).toContain("COMBAT");
    });

    it("should move towards mob if not in range then attack", async () => {
      const service = createMockService({
        playerPosition: [0, 0, 0],
        nearbyEntities: [
          { id: "mob-1", name: "Goblin", mobType: "goblin", position: [10, 0, 10], alive: true },
        ],
      });
      const runtime = createMockRuntime(service);
      const callback = vi.fn();

      await autonomousAttackAction.handler(runtime, createMockMemory(), createMockState(), undefined, callback);

      // Should move towards mob since distance > 3
      expect(service.executeMove).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// SKILL ACTIONS TESTS
// ============================================================================

describe("Skill Actions", () => {
  describe("chopTreeAction", () => {
    it("should have correct metadata", () => {
      expect(chopTreeAction.name).toBe("CHOP_TREE");
      expect(chopTreeAction.similes).toContain("CHOP");
      expect(chopTreeAction.similes).toContain("WOODCUT");
    });

    it("should validate when axe and trees nearby", async () => {
      const service = createMockService({
        playerItems: [{ id: "axe-1", name: "Bronze Hatchet", quantity: 1 }],
        nearbyEntities: [
          { id: "tree-1", name: "Oak Tree", resourceType: "tree", position: [5, 0, 5] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await chopTreeAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation without axe", async () => {
      const service = createMockService({
        playerItems: [],
        nearbyEntities: [
          { id: "tree-1", name: "Oak Tree", resourceType: "tree", position: [5, 0, 5] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await chopTreeAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });

    it("should fail validation without trees", async () => {
      const service = createMockService({
        playerItems: [{ id: "axe-1", name: "Bronze Axe", quantity: 1 }],
        nearbyEntities: [],
      });
      const runtime = createMockRuntime(service);
      const result = await chopTreeAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("catchFishAction", () => {
    it("should have correct metadata", () => {
      expect(catchFishAction.name).toBe("CATCH_FISH");
      expect(catchFishAction.similes).toContain("FISH");
    });

    it("should validate when rod and fishing spot nearby", async () => {
      const service = createMockService({
        playerItems: [{ id: "rod-1", name: "Fishing Rod", quantity: 1 }],
        nearbyEntities: [
          { id: "spot-1", name: "Fishing Spot", resourceType: "fishing_spot", position: [3, 0, 3] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await catchFishAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("lightFireAction", () => {
    it("should have correct metadata", () => {
      expect(lightFireAction.name).toBe("LIGHT_FIRE");
      expect(lightFireAction.similes).toContain("FIREMAKING");
    });

    it("should validate when tinderbox and logs in inventory", async () => {
      const service = createMockService({
        playerItems: [
          { id: "tinder-1", name: "Tinderbox", quantity: 1 },
          { id: "logs-1", name: "Oak Logs", quantity: 5 },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await lightFireAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("cookFoodAction", () => {
    it("should have correct metadata", () => {
      expect(cookFoodAction.name).toBe("COOK_FOOD");
      expect(cookFoodAction.similes).toContain("COOK");
    });

    it("should validate when raw food in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "fish-1", name: "Raw Fish", quantity: 3 }],
      });
      const runtime = createMockRuntime(service);
      const result = await cookFoodAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// NEW ACTIONS TESTS (Store, Dialogue, Examine, Unequip)
// ============================================================================

describe("Store Actions", () => {
  describe("buyItemAction", () => {
    it("should have correct metadata", () => {
      expect(buyItemAction.name).toBe("BUY_ITEM");
      expect(buyItemAction.similes).toContain("BUY");
      expect(buyItemAction.similes).toContain("PURCHASE");
    });

    it("should validate when store NPC nearby", async () => {
      const service = createMockService({
        nearbyEntities: [
          { id: "npc-1", name: "General Store", type: "npc", position: [5, 0, 5] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await buyItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when no store nearby", async () => {
      const service = createMockService({
        nearbyEntities: [
          { id: "npc-1", name: "Guard", type: "npc", position: [5, 0, 5] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await buyItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });

  describe("sellItemAction", () => {
    it("should have correct metadata", () => {
      expect(sellItemAction.name).toBe("SELL_ITEM");
      expect(sellItemAction.similes).toContain("SELL");
    });

    it("should validate when store nearby and items in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Logs", quantity: 5 }],
        nearbyEntities: [
          { id: "npc-1", name: "Shop Keeper", type: "npc", position: [5, 0, 5] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await sellItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation with empty inventory", async () => {
      const service = createMockService({
        playerItems: [],
        nearbyEntities: [
          { id: "npc-1", name: "Shop Keeper", type: "npc", position: [5, 0, 5] },
        ],
      });
      const runtime = createMockRuntime(service);
      const result = await sellItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });
});

describe("Dialogue Actions", () => {
  describe("dialogueRespondAction", () => {
    it("should have correct metadata", () => {
      expect(dialogueRespondAction.name).toBe("DIALOGUE_RESPOND");
      expect(dialogueRespondAction.similes).toContain("RESPOND");
      expect(dialogueRespondAction.similes).toContain("ANSWER");
    });

    it("should validate when connected and alive", async () => {
      const service = createMockService({});
      const runtime = createMockRuntime(service);
      const result = await dialogueRespondAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("closeDialogueAction", () => {
    it("should have correct metadata", () => {
      expect(closeDialogueAction.name).toBe("CLOSE_DIALOGUE");
      expect(closeDialogueAction.similes).toContain("END_DIALOGUE");
    });

    it("should validate when connected and alive", async () => {
      const service = createMockService({});
      const runtime = createMockRuntime(service);
      const result = await closeDialogueAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });
});

describe("Examine Actions", () => {
  describe("examineEntityAction", () => {
    it("should have correct metadata", () => {
      expect(examineEntityAction.name).toBe("EXAMINE_ENTITY");
      expect(examineEntityAction.similes).toContain("EXAMINE");
      expect(examineEntityAction.similes).toContain("INSPECT");
    });

    it("should validate when connected and alive", async () => {
      const service = createMockService({});
      const runtime = createMockRuntime(service);
      const result = await examineEntityAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });
  });

  describe("examineInventoryItemAction", () => {
    it("should have correct metadata", () => {
      expect(examineInventoryItemAction.name).toBe("EXAMINE_INVENTORY_ITEM");
      expect(examineInventoryItemAction.similes).toContain("EXAMINE_ITEM");
    });

    it("should validate when items in inventory", async () => {
      const service = createMockService({
        playerItems: [{ id: "item-1", name: "Bronze Sword", quantity: 1 }],
      });
      const runtime = createMockRuntime(service);
      const result = await examineInventoryItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation with empty inventory", async () => {
      const service = createMockService({
        playerItems: [],
      });
      const runtime = createMockRuntime(service);
      const result = await examineInventoryItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });
});

describe("Unequip Action", () => {
  describe("unequipItemAction", () => {
    it("should have correct metadata", () => {
      expect(unequipItemAction.name).toBe("UNEQUIP_ITEM");
      expect(unequipItemAction.similes).toContain("UNEQUIP");
      expect(unequipItemAction.similes).toContain("REMOVE_EQUIPMENT");
    });

    it("should validate when item equipped", async () => {
      const service = createMockService({
        playerEquipment: { weapon: "Bronze Sword", shield: null, helmet: null, body: null, legs: null, boots: null },
      });
      const runtime = createMockRuntime(service);
      const result = await unequipItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(true);
    });

    it("should fail validation when nothing equipped", async () => {
      const service = createMockService({
        playerEquipment: { weapon: null, shield: null, helmet: null, body: null, legs: null, boots: null },
      });
      const runtime = createMockRuntime(service);
      const result = await unequipItemAction.validate(runtime, createMockMemory());
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// ACTION COVERAGE SUMMARY
// ============================================================================

describe("Action Coverage Summary", () => {
  const allActions = [
    // Movement
    moveToAction,
    followEntityAction,
    stopMovementAction,
    // Combat
    combatAttackAction,
    changeCombatStyleAction,
    // Inventory
    equipItemAction,
    unequipItemAction,
    useItemAction,
    dropItemAction,
    // Banking
    bankDepositAction,
    bankWithdrawAction,
    bankDepositAllAction,
    bankDepositCoinsAction,
    bankWithdrawCoinsAction,
    // Store
    buyItemAction,
    sellItemAction,
    // Dialogue
    dialogueRespondAction,
    closeDialogueAction,
    // Examine
    examineEntityAction,
    examineInventoryItemAction,
    // Interactions
    interactNpcAction,
    lootCorpseAction,
    pickupItemAction,
    respawnAction,
    emoteAction,
    eatFoodAction,
    // Social
    chatMessageAction,
    localChatAction,
    whisperAction,
    // Goals
    setGoalAction,
    navigateToAction,
    // Autonomous
    exploreAction,
    fleeAction,
    idleAction,
    approachEntityAction,
    autonomousAttackAction,
    // Skills
    chopTreeAction,
    catchFishAction,
    lightFireAction,
    cookFoodAction,
  ];

  it("should have all required action properties", () => {
    for (const action of allActions) {
      expect(action.name).toBeDefined();
      expect(action.description).toBeDefined();
      expect(action.validate).toBeDefined();
      expect(typeof action.validate).toBe("function");
      expect(action.handler).toBeDefined();
      expect(typeof action.handler).toBe("function");
      expect(action.examples).toBeDefined();
      expect(Array.isArray(action.examples)).toBe(true);
    }
  });

  it("should have similes for discoverability", () => {
    for (const action of allActions) {
      expect(action.similes).toBeDefined();
      expect(Array.isArray(action.similes)).toBe(true);
      expect(action.similes.length).toBeGreaterThan(0);
    }
  });

  it("should have at least one example per action", () => {
    for (const action of allActions) {
      expect(action.examples.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should cover all 40 expected actions", () => {
    expect(allActions.length).toBe(40);
  });
});

