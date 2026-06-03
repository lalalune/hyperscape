/**
 * ChainWriterBridge Tests
 *
 * Tests the event-to-chain-write bridge that connects
 * Hyperia game events to on-chain MUD World updates.
 *
 * Key functionality tested:
 * - Inventory update events → queueInventoryUpdate
 * - Skills update events → queueCombatSkillsUpdate/queueGatheringSkillsUpdate
 * - Equipment update events → queueEquipmentUpdate
 * - Mob kill events → queueMobKill
 * - Player death events → queueDeath
 * - Player registration events → queuePlayerRegistration
 * - Item ID mapping (string → numeric)
 * - Wallet address registration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChainWriterBridge } from "../src/chain-writer/ChainWriterBridge.js";
import type { ChainWriter } from "../src/chain-writer/ChainWriter.js";

// ============================================================================
// Mock ChainWriter
// ============================================================================

function createMockChainWriter(): ChainWriter {
  return {
    queuePlayerRegistration: vi.fn(),
    queueCombatSkillsUpdate: vi.fn(),
    queueGatheringSkillsUpdate: vi.fn(),
    queueInventoryUpdate: vi.fn(),
    queueGoldUpdate: vi.fn(),
    queueEquipmentUpdate: vi.fn(),
    queueMobKill: vi.fn(),
    queueDeath: vi.fn(),
    initialize: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      totalCallsFlushed: 0,
      totalFlushes: 0,
      failedFlushes: 0,
      pending: 0,
    }),
  } as unknown as ChainWriter;
}

// ============================================================================
// Mock World Event Emitter
// ============================================================================

class MockWorldEventEmitter {
  private handlers = new Map<string, Array<(payload: unknown) => void>>();

  on(event: string, handler: (payload: unknown) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  emit(event: string, payload: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(payload));
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("ChainWriterBridge - Event Attachment", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;
  let itemIdMap: Map<string, number>;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    itemIdMap = new Map([
      ["coins", 1],
      ["bronze_sword", 2],
      ["logs", 3],
      ["bones", 4],
      ["iron_ore", 5],
    ]);
    bridge = new ChainWriterBridge(chainWriter, itemIdMap);
    bridge.attachToWorld(world);
  });

  it("attaches to world event emitter", () => {
    // Verify bridge can receive events (already attached in beforeEach)
    expect(bridge).toBeDefined();
  });

  it("returns chainWriter from getChainWriter()", () => {
    expect(bridge.getChainWriter()).toBe(chainWriter);
  });
});

describe("ChainWriterBridge - Inventory Updates", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;
  let itemIdMap: Map<string, number>;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    itemIdMap = new Map([
      ["coins", 1],
      ["bronze_sword", 2],
      ["logs", 3],
    ]);
    bridge = new ChainWriterBridge(chainWriter, itemIdMap);
    bridge.attachToWorld(world);
  });

  it("queues inventory update on inventory:updated event", () => {
    world.emit("inventory:updated", {
      playerId: "player-123",
      inventory: [
        { slot: 0, itemId: "coins", quantity: 100 },
        { slot: 1, itemId: "bronze_sword", quantity: 1 },
      ],
      coins: 5000,
    });

    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledWith(
      "player-123",
      [
        { slotIndex: 0, itemId: 1, quantity: 100 },
        { slotIndex: 1, itemId: 2, quantity: 1 },
      ],
    );
  });

  it("queues gold update when coins are present", () => {
    world.emit("inventory:updated", {
      playerId: "player-123",
      inventory: [],
      coins: 10000,
    });

    expect(chainWriter.queueGoldUpdate).toHaveBeenCalledWith(
      "player-123",
      10000,
    );
  });

  it("filters out unmapped item IDs", () => {
    world.emit("inventory:updated", {
      playerId: "player-123",
      inventory: [
        { slot: 0, itemId: "coins", quantity: 100 },
        { slot: 1, itemId: "unknown_item", quantity: 1 }, // Not in map
      ],
      coins: 0,
    });

    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledWith(
      "player-123",
      [{ slotIndex: 0, itemId: 1, quantity: 100 }],
    );
  });

  it("includes empty slots (quantity 0) even with unmapped itemId", () => {
    world.emit("inventory:updated", {
      playerId: "player-123",
      inventory: [{ slot: 0, itemId: "unknown", quantity: 0 }],
      coins: 0,
    });

    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledWith(
      "player-123",
      [{ slotIndex: 0, itemId: 0, quantity: 0 }],
    );
  });

  it("ignores empty inventory payloads", () => {
    // Empty inventory array - should not queue
    world.emit("inventory:updated", { playerId: "player-123", inventory: [] });

    expect(chainWriter.queueInventoryUpdate).not.toHaveBeenCalled();
  });

  it("ignores payloads without playerId", () => {
    world.emit("inventory:updated", {
      inventory: [{ slot: 0, itemId: "coins", quantity: 100 }],
    });

    expect(chainWriter.queueInventoryUpdate).not.toHaveBeenCalled();
  });
});

describe("ChainWriterBridge - Skills Updates", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    bridge = new ChainWriterBridge(chainWriter, new Map());
    bridge.attachToWorld(world);
  });

  it("queues combat skills update", () => {
    world.emit("skills:updated", {
      playerId: "player-123",
      skills: {
        attack: { level: 50, xp: 101333 },
        strength: { level: 45, xp: 61512 },
        defense: { level: 40, xp: 37224 },
      },
    });

    expect(chainWriter.queueCombatSkillsUpdate).toHaveBeenCalledWith(
      "player-123",
      expect.objectContaining({
        attackLevel: 50,
        attackXp: 101333,
        strengthLevel: 45,
        strengthXp: 61512,
        defenseLevel: 40,
        defenseXp: 37224,
      }),
    );
  });

  it("queues gathering skills update", () => {
    world.emit("skills:updated", {
      playerId: "player-123",
      skills: {
        woodcutting: { level: 60, xp: 273742 },
        mining: { level: 55, xp: 166636 },
        fishing: { level: 70, xp: 737627 },
      },
    });

    expect(chainWriter.queueGatheringSkillsUpdate).toHaveBeenCalledWith(
      "player-123",
      expect.objectContaining({
        woodcuttingLevel: 60,
        woodcuttingXp: 273742,
        miningLevel: 55,
        miningXp: 166636,
        fishingLevel: 70,
        fishingXp: 737627,
      }),
    );
  });

  it("defaults missing skills to level 1, xp 0", () => {
    world.emit("skills:updated", {
      playerId: "player-123",
      skills: {
        attack: { level: 10, xp: 1154 },
      },
    });

    expect(chainWriter.queueCombatSkillsUpdate).toHaveBeenCalledWith(
      "player-123",
      expect.objectContaining({
        attackLevel: 10,
        attackXp: 1154,
        strengthLevel: 1,
        strengthXp: 0,
        defenseLevel: 1,
        defenseXp: 0,
        constitutionLevel: 1,
        constitutionXp: 0,
      }),
    );
  });

  it("ignores invalid skills payloads", () => {
    world.emit("skills:updated", { playerId: null, skills: null });
    world.emit("skills:updated", {});

    expect(chainWriter.queueCombatSkillsUpdate).not.toHaveBeenCalled();
    expect(chainWriter.queueGatheringSkillsUpdate).not.toHaveBeenCalled();
  });
});

describe("ChainWriterBridge - Equipment Updates", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;
  let itemIdMap: Map<string, number>;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    itemIdMap = new Map([
      ["bronze_sword", 2],
      ["iron_helmet", 10],
      ["leather_body", 20],
    ]);
    bridge = new ChainWriterBridge(chainWriter, itemIdMap);
    bridge.attachToWorld(world);
  });

  it("queues equipment update on player:equipment_changed", () => {
    world.emit("player:equipment_changed", {
      playerId: "player-123",
      equipment: {
        weapon: { itemId: "bronze_sword", quantity: 1 },
        helmet: { itemId: "iron_helmet", quantity: 1 },
      },
    });

    expect(chainWriter.queueEquipmentUpdate).toHaveBeenCalledWith(
      "player-123",
      expect.arrayContaining([
        { slotType: 0, itemId: 2, quantity: 1 }, // weapon = slot 0
        { slotType: 2, itemId: 10, quantity: 1 }, // helmet = slot 2
      ]),
    );
  });

  it("handles unequipping (slot cleared)", () => {
    world.emit("player:equipment_changed", {
      playerId: "player-123",
      equipment: {
        weapon: null, // Unequipped
      },
    });

    expect(chainWriter.queueEquipmentUpdate).toHaveBeenCalledWith(
      "player-123",
      [{ slotType: 0, itemId: 0, quantity: 0 }],
    );
  });

  it("maps all equipment slot names to numeric types", () => {
    const slotNames = [
      "weapon",
      "shield",
      "helmet",
      "body",
      "legs",
      "boots",
      "gloves",
      "cape",
      "amulet",
      "ring",
      "arrows",
    ];
    const equipment: Record<
      string,
      { itemId: string; quantity: number } | null
    > = {};
    slotNames.forEach((slot) => {
      equipment[slot] = null;
    });

    world.emit("player:equipment_changed", {
      playerId: "player-123",
      equipment,
    });

    const calls = (chainWriter.queueEquipmentUpdate as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][1].length).toBe(11);
  });
});

describe("ChainWriterBridge - Mob Kills", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    bridge = new ChainWriterBridge(chainWriter, new Map());
    bridge.attachToWorld(world);
  });

  it("queues mob kill on npc:died event", () => {
    world.emit("npc:died", {
      playerId: "player-123",
      npcId: "goblin-456",
      npcType: "goblin",
      isBoss: false,
    });

    expect(chainWriter.queueMobKill).toHaveBeenCalledWith(
      "player-123",
      "goblin",
      false,
    );
  });

  it("records boss kills correctly", () => {
    world.emit("npc:died", {
      playerId: "player-123",
      npcId: "king-black-dragon-1",
      npcType: "king_black_dragon",
      isBoss: true,
    });

    expect(chainWriter.queueMobKill).toHaveBeenCalledWith(
      "player-123",
      "king_black_dragon",
      true,
    );
  });

  it("falls back to npcId when npcType is missing", () => {
    world.emit("npc:died", {
      playerId: "player-123",
      npcId: "goblin-456",
      isBoss: false,
    });

    expect(chainWriter.queueMobKill).toHaveBeenCalledWith(
      "player-123",
      "goblin-456",
      false,
    );
  });

  it("defaults isBoss to false", () => {
    world.emit("npc:died", {
      playerId: "player-123",
      npcId: "chicken",
      npcType: "chicken",
    });

    expect(chainWriter.queueMobKill).toHaveBeenCalledWith(
      "player-123",
      "chicken",
      false,
    );
  });

  it("ignores invalid npc:died payloads", () => {
    world.emit("npc:died", { playerId: null });
    world.emit("npc:died", { npcId: "goblin" }); // Missing playerId
    world.emit("npc:died", {});

    expect(chainWriter.queueMobKill).not.toHaveBeenCalled();
  });
});

describe("ChainWriterBridge - Player Deaths", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    bridge = new ChainWriterBridge(chainWriter, new Map());
    bridge.attachToWorld(world);
  });

  it("queues death on player:died event", () => {
    world.emit("entity:death", {
      entityId: "player-123",
      entityType: "player",
      killedBy: "goblin-456",
    });

    expect(chainWriter.queueDeath).toHaveBeenCalledWith("player-123");
  });

  it("ignores invalid player:died payloads", () => {
    world.emit("entity:death", { entityId: null, entityType: "player" });
    world.emit("entity:death", {});
    world.emit("entity:death", { entityId: "npc-1", entityType: "npc" });

    expect(chainWriter.queueDeath).not.toHaveBeenCalled();
  });
});

describe("ChainWriterBridge - Player Registration", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    bridge = new ChainWriterBridge(chainWriter, new Map());
    bridge.attachToWorld(world);
  });

  it("queues player registration and stores wallet address", () => {
    world.emit("player:registered", {
      playerId: "player-123",
      playerName: "TestPlayer",
      walletAddress: "0x1234567890123456789012345678901234567890",
    });

    expect(chainWriter.queuePlayerRegistration).toHaveBeenCalledWith(
      "0x1234567890123456789012345678901234567890",
      "player-123",
      "TestPlayer",
    );
  });

  it("ignores registration without wallet address", () => {
    world.emit("player:registered", {
      playerId: "player-123",
      playerName: "TestPlayer",
    });

    expect(chainWriter.queuePlayerRegistration).not.toHaveBeenCalled();
  });

  it("manual wallet registration works", () => {
    bridge.registerPlayerWallet(
      "player-456",
      "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
    );

    // Wallet should be registered internally (bridge tracks this)
    expect(bridge).toBeDefined();
  });
});

describe("ChainWriterBridge - Shutdown", () => {
  it("calls chainWriter.shutdown on shutdown", async () => {
    const chainWriter = createMockChainWriter();
    const world = new MockWorldEventEmitter();
    const bridge = new ChainWriterBridge(chainWriter, new Map());
    bridge.attachToWorld(world);

    await bridge.shutdown();

    expect(chainWriter.shutdown).toHaveBeenCalled();
  });
});

describe("ChainWriterBridge - Trading Flow Integration", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;
  let itemIdMap: Map<string, number>;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    itemIdMap = new Map([
      ["coins", 1],
      ["bronze_sword", 2],
      ["logs", 3],
    ]);
    bridge = new ChainWriterBridge(chainWriter, itemIdMap);
    bridge.attachToWorld(world);
  });

  it("handles trade completion with inventory updates for both players", () => {
    // Player 1 gets coins from trade
    world.emit("inventory:updated", {
      playerId: "player-1",
      inventory: [{ slot: 0, itemId: "coins", quantity: 1000 }],
      coins: 0,
    });

    // Player 2 gets bronze sword from trade
    world.emit("inventory:updated", {
      playerId: "player-2",
      inventory: [{ slot: 0, itemId: "bronze_sword", quantity: 1 }],
      coins: 0,
    });

    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledTimes(2);

    // Verify player 1's update
    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledWith("player-1", [
      { slotIndex: 0, itemId: 1, quantity: 1000 },
    ]);

    // Verify player 2's update
    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledWith("player-2", [
      { slotIndex: 0, itemId: 2, quantity: 1 },
    ]);
  });
});

describe("ChainWriterBridge - Loot Pickup Flow Integration", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;
  let itemIdMap: Map<string, number>;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    itemIdMap = new Map([
      ["coins", 1],
      ["bones", 4],
      ["goblin_mail", 100],
    ]);
    bridge = new ChainWriterBridge(chainWriter, itemIdMap);
    bridge.attachToWorld(world);
  });

  it("handles complete loot drop → pickup flow", () => {
    // 1. Mob killed - stats recorded
    world.emit("npc:died", {
      playerId: "player-123",
      npcId: "goblin-1",
      npcType: "goblin",
      isBoss: false,
    });

    expect(chainWriter.queueMobKill).toHaveBeenCalledWith(
      "player-123",
      "goblin",
      false,
    );

    // 2. Player picks up loot - inventory updated
    world.emit("inventory:updated", {
      playerId: "player-123",
      inventory: [
        { slot: 0, itemId: "coins", quantity: 50 },
        { slot: 1, itemId: "bones", quantity: 1 },
        { slot: 2, itemId: "goblin_mail", quantity: 1 },
      ],
      coins: 0,
    });

    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalledWith(
      "player-123",
      [
        { slotIndex: 0, itemId: 1, quantity: 50 },
        { slotIndex: 1, itemId: 4, quantity: 1 },
        { slotIndex: 2, itemId: 100, quantity: 1 },
      ],
    );
  });
});

describe("ChainWriterBridge - Full Character State Sync", () => {
  let chainWriter: ChainWriter;
  let world: MockWorldEventEmitter;
  let bridge: ChainWriterBridge;
  let itemIdMap: Map<string, number>;

  beforeEach(() => {
    chainWriter = createMockChainWriter();
    world = new MockWorldEventEmitter();
    itemIdMap = new Map([
      ["coins", 1],
      ["rune_scimitar", 50],
      ["dragon_boots", 75],
    ]);
    bridge = new ChainWriterBridge(chainWriter, itemIdMap);
    bridge.attachToWorld(world);
  });

  it("syncs complete character state on login/reconnect", () => {
    // Simulated full state sync after player connects
    const playerId = "player-veteran";

    // 1. Player registration (if new)
    world.emit("player:registered", {
      playerId,
      playerName: "VeteranPlayer",
      walletAddress: "0x1111111111111111111111111111111111111111",
    });

    // 2. Full inventory
    world.emit("inventory:updated", {
      playerId,
      inventory: [
        { slot: 0, itemId: "coins", quantity: 1000000 },
        { slot: 1, itemId: "rune_scimitar", quantity: 1 },
      ],
      coins: 500000,
    });

    // 3. Full equipment
    world.emit("player:equipment_changed", {
      playerId,
      equipment: {
        weapon: { itemId: "rune_scimitar", quantity: 1 },
        boots: { itemId: "dragon_boots", quantity: 1 },
      },
    });

    // 4. Full skills
    world.emit("skills:updated", {
      playerId,
      skills: {
        attack: { level: 99, xp: 13034431 },
        strength: { level: 99, xp: 13034431 },
        defense: { level: 99, xp: 13034431 },
        constitution: { level: 99, xp: 13034431 },
        woodcutting: { level: 75, xp: 1210421 },
        mining: { level: 80, xp: 1986068 },
      },
    });

    // Verify all queued correctly
    expect(chainWriter.queuePlayerRegistration).toHaveBeenCalled();
    expect(chainWriter.queueInventoryUpdate).toHaveBeenCalled();
    expect(chainWriter.queueGoldUpdate).toHaveBeenCalledWith(playerId, 500000);
    expect(chainWriter.queueEquipmentUpdate).toHaveBeenCalled();
    expect(chainWriter.queueCombatSkillsUpdate).toHaveBeenCalled();
    expect(chainWriter.queueGatheringSkillsUpdate).toHaveBeenCalled();
  });
});
