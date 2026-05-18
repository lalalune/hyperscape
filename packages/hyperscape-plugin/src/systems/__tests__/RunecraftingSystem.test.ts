/**
 * RunecraftingSystem Unit Tests
 *
 * Tests for the runecrafting system covering:
 * - Instant essence-to-rune conversion (no ticks)
 * - Level requirement enforcement
 * - Essence type validation (rune_essence vs pure_essence)
 * - Multi-rune multiplier at higher levels
 * - XP granting
 * - No essence / invalid recipe edge cases
 * - Player disconnect cleanup
 * - Client-side no-op
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RunecraftingSystem } from "../RunecraftingSystem";
import { EventBus } from "@hyperforge/shared";
import { EventType } from "@hyperforge/shared";
import type { World } from "../../../../types/index";
import {
  processingDataProvider,
  type RunecraftingManifest,
} from "@hyperforge/shared";
import * as fs from "fs";
import * as path from "path";

// ─── Helpers ──────────────────────────────────────────────────────────

interface MockInventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  slot: number;
  metadata: null;
}

function createItem(
  itemId: string,
  quantity = 1,
  slot = -1,
): MockInventoryItem {
  return {
    id: `inv_test_${itemId}_${slot}`,
    itemId,
    quantity,
    slot,
    metadata: null,
  };
}

function createMockWorld(
  options: {
    inventory?: MockInventoryItem[];
    skills?: Record<string, { level: number; xp: number }>;
  } = {},
) {
  const eventBus = new EventBus();
  const inventory = options.inventory || [];

  const world = {
    isServer: true,
    currentTick: 100,
    $eventBus: eventBus,
    entities: new Map(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    getSystem: vi.fn(() => undefined),
    getPlayer: vi.fn((id: string) => {
      if (!options.skills) return undefined;
      return {
        id,
        skills: options.skills,
      };
    }),
    getInventory: vi.fn(() => inventory),
    network: { send: vi.fn() },
  };

  return { world, eventBus };
}

function emitEvent(
  eventBus: EventBus,
  type: EventType | string,
  data: Record<string, unknown>,
) {
  eventBus.emitEvent(type, data, "test");
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("RunecraftingSystem", () => {
  let system: RunecraftingSystem;
  let eventBus: EventBus;
  let mockWorld: ReturnType<typeof createMockWorld>["world"];

  // Track emitted events
  const emittedEvents: Array<{ type: string; data: unknown }> = [];

  beforeEach(async () => {
    emittedEvents.length = 0;

    // Ensure runecrafting recipes are loaded (test environment may not auto-load them)
    const candidatePaths = [
      path.resolve(
        process.cwd(),
        "packages/server/world/assets/manifests/recipes/runecrafting.json",
      ),
      path.resolve(
        __dirname,
        "../../../..",
        "server/world/assets/manifests/recipes/runecrafting.json",
      ),
    ];

    const recipePath = candidatePaths.find((p) => fs.existsSync(p));
    if (recipePath) {
      const manifest = JSON.parse(
        fs.readFileSync(recipePath, "utf-8"),
      ) as RunecraftingManifest;
      processingDataProvider.loadRunecraftingRecipes(manifest);
      processingDataProvider.rebuild();
    } else {
      console.warn(
        "Runecrafting manifest not found, using minimal mock for tests.",
      );
      const mockManifest: RunecraftingManifest = {
        version: "1.0",
        recipes: [
          {
            runeType: "air",
            runeItemId: "air_rune",
            levelRequired: 1,
            xpPerEssence: 5,
            essenceTypes: ["rune_essence", "pure_essence"],
            multiRuneLevels: [11, 22, 33, 44, 55, 66, 77, 88, 99],
          },
          {
            runeType: "water",
            runeItemId: "water_rune",
            levelRequired: 5,
            xpPerEssence: 5.5,
            essenceTypes: ["rune_essence", "pure_essence"],
            multiRuneLevels: [19, 38, 57, 76, 95],
          },
          {
            runeType: "earth",
            runeItemId: "earth_rune",
            levelRequired: 9,
            xpPerEssence: 6.5,
            essenceTypes: ["rune_essence", "pure_essence"],
            multiRuneLevels: [26, 52, 78],
          },
          {
            runeType: "fire",
            runeItemId: "fire_rune",
            levelRequired: 14,
            xpPerEssence: 7,
            essenceTypes: ["rune_essence", "pure_essence"],
            multiRuneLevels: [33, 67],
          },
          {
            runeType: "chaos",
            runeItemId: "chaos_rune",
            levelRequired: 35,
            xpPerEssence: 8.5,
            essenceTypes: ["pure_essence"],
            multiRuneLevels: [74, 82, 90],
          },
        ],
      };
      processingDataProvider.loadRunecraftingRecipes(mockManifest);
      processingDataProvider.rebuild();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (system) {
      system.destroy();
    }
  });

  /**
   * Initialize system with given options and capture all emitted events.
   */
  async function setupSystem(
    options: Parameters<typeof createMockWorld>[0] = {},
  ) {
    const mock = createMockWorld(options);
    mockWorld = mock.world;
    eventBus = mock.eventBus;

    // Capture all events by wrapping emitEvent BEFORE system.init()
    // so that both the system's subscriptions AND our capture work correctly
    const originalEmit = eventBus.emitEvent.bind(eventBus);
    eventBus.emitEvent = (type: string, data: unknown, source?: string) => {
      emittedEvents.push({ type, data });
      return originalEmit(type, data, source);
    };

    system = new RunecraftingSystem(mockWorld as unknown as World);
    await system.init();
  }

  function findEmitted(type: string) {
    return emittedEvents.filter((e) => e.type === type);
  }

  // ─── Basic crafting ─────────────────────────────────────────────────

  describe("instant crafting", () => {
    it("converts all rune_essence into air runes at level 1", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("air");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
        skills: { runecrafting: { level: 1, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      // Essence removed
      const removed = findEmitted(EventType.INVENTORY_ITEM_REMOVED);
      expect(removed.length).toBe(1);
      expect((removed[0].data as { itemId: string }).itemId).toBe(
        "rune_essence",
      );
      expect((removed[0].data as { quantity: number }).quantity).toBe(5);

      // Runes added
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(1);
      expect((added[0].data as { item: { itemId: string } }).item.itemId).toBe(
        "air_rune",
      );
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(5);

      // XP granted
      const xp = findEmitted(EventType.SKILLS_XP_GAINED);
      expect(xp.length).toBe(1);
      expect((xp[0].data as { skill: string }).skill).toBe("runecrafting");
      expect((xp[0].data as { amount: number }).amount).toBe(
        5 * recipe.xpPerEssence,
      );

      // Completion event
      const complete = findEmitted(EventType.RUNECRAFTING_COMPLETE);
      expect(complete.length).toBe(1);
    });

    it("converts pure_essence into water runes", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("water");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("pure_essence", 10)],
        skills: { runecrafting: { level: 5, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "water_altar",
        runeType: "water",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(1);
      expect((added[0].data as { item: { itemId: string } }).item.itemId).toBe(
        "water_rune",
      );
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(10);
    });

    it("consumes both rune_essence and pure_essence together", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("air");
      if (!recipe) return;

      await setupSystem({
        inventory: [
          createItem("rune_essence", 3),
          createItem("pure_essence", 2),
        ],
        skills: { runecrafting: { level: 1, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      // Both essence types removed
      const removed = findEmitted(EventType.INVENTORY_ITEM_REMOVED);
      expect(removed.length).toBe(2);

      // 5 total runes produced (3 + 2)
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(5);

      // XP for all 5 essence
      const xp = findEmitted(EventType.SKILLS_XP_GAINED);
      expect((xp[0].data as { amount: number }).amount).toBe(
        5 * recipe.xpPerEssence,
      );
    });
  });

  // ─── Level requirements ─────────────────────────────────────────────

  describe("level requirements", () => {
    it("blocks earth runes at level 1 (requires 9)", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("earth");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
        skills: { runecrafting: { level: 1, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "earth_altar",
        runeType: "earth",
      });

      // No items removed or added
      const removed = findEmitted(EventType.INVENTORY_ITEM_REMOVED);
      expect(removed.length).toBe(0);
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);

      // Error message sent
      const messages = findEmitted(EventType.UI_MESSAGE);
      expect(messages.length).toBe(1);
      expect((messages[0].data as { type: string }).type).toBe("error");
      expect((messages[0].data as { message: string }).message).toContain("9");
    });

    it("blocks chaos runes at level 34 (requires 35)", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("chaos");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("pure_essence", 5)],
        skills: { runecrafting: { level: 34, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "chaos_altar",
        runeType: "chaos",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);
    });

    it("allows chaos runes at exactly level 35", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("chaos");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("pure_essence", 5)],
        skills: { runecrafting: { level: 35, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "chaos_altar",
        runeType: "chaos",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(1);
      expect((added[0].data as { item: { itemId: string } }).item.itemId).toBe(
        "chaos_rune",
      );
    });

    it("allows fire runes at level 14 (exact requirement)", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("fire");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("rune_essence", 3)],
        skills: { runecrafting: { level: 14, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "fire_altar",
        runeType: "fire",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(1);
      expect((added[0].data as { item: { itemId: string } }).item.itemId).toBe(
        "fire_rune",
      );
    });
  });

  // ─── Essence type validation ────────────────────────────────────────

  describe("essence type validation", () => {
    it("chaos altar rejects rune_essence (only accepts pure_essence)", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("chaos");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("rune_essence", 10)],
        skills: { runecrafting: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "chaos_altar",
        runeType: "chaos",
      });

      // No runes produced — rune_essence is invalid for chaos
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);

      // "no essence" error message
      const messages = findEmitted(EventType.UI_MESSAGE);
      expect(messages.length).toBe(1);
      expect((messages[0].data as { message: string }).message).toContain(
        "essence",
      );
    });

    it("ignores non-essence items in inventory", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("air");
      if (!recipe) return;

      await setupSystem({
        inventory: [
          createItem("bronze_shortsword", 1),
          createItem("logs", 5),
          createItem("rune_essence", 2),
        ],
        skills: { runecrafting: { level: 1, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      // Only 2 runes from the 2 essence, non-essence items untouched
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(2);

      // Only essence removed, not other items
      const removed = findEmitted(EventType.INVENTORY_ITEM_REMOVED);
      expect(removed.length).toBe(1);
      expect((removed[0].data as { itemId: string }).itemId).toBe(
        "rune_essence",
      );
    });
  });

  // ─── Multi-rune multiplier ──────────────────────────────────────────

  describe("multi-rune multiplier", () => {
    it("produces 2x air runes at level 11", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("air");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
        skills: { runecrafting: { level: 11, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      // 5 essence * 2x multiplier = 10 runes
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(10);

      // XP is still based on essence count, not runes produced
      const xp = findEmitted(EventType.SKILLS_XP_GAINED);
      expect((xp[0].data as { amount: number }).amount).toBe(
        5 * recipe.xpPerEssence,
      );
    });

    it("produces 3x air runes at level 22", async () => {
      const recipe = processingDataProvider.getRunecraftingRecipe("air");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("rune_essence", 4)],
        skills: { runecrafting: { level: 22, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(1);
      // 4 essence * 3x multiplier = 12 runes
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(12);
    });

    it("produces 1x at level 10 (just below first air multiplier threshold)", async () => {
      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
        skills: { runecrafting: { level: 10, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      // 5 essence * 1x = 5 runes
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(5);
    });

    it("produces 10x air runes at level 99", async () => {
      await setupSystem({
        inventory: [createItem("rune_essence", 3)],
        skills: { runecrafting: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      // 3 essence * 10x = 30 runes (air has 9 thresholds: 11,22,33,44,55,66,77,88,99)
      expect(
        (added[0].data as { item: { quantity: number } }).item.quantity,
      ).toBe(30);
    });

    it("completion event includes correct multiplier", async () => {
      await setupSystem({
        inventory: [createItem("rune_essence", 2)],
        skills: { runecrafting: { level: 11, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const complete = findEmitted(EventType.RUNECRAFTING_COMPLETE);
      expect(complete.length).toBe(1);
      const payload = complete[0].data as {
        multiplier: number;
        essenceConsumed: number;
        runesProduced: number;
      };
      expect(payload.multiplier).toBe(2);
      expect(payload.essenceConsumed).toBe(2);
      expect(payload.runesProduced).toBe(4);
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("sends error when no essence in inventory", async () => {
      await setupSystem({
        inventory: [createItem("bronze_shortsword", 1)],
        skills: { runecrafting: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const messages = findEmitted(EventType.UI_MESSAGE);
      expect(messages.length).toBe(1);
      expect((messages[0].data as { type: string }).type).toBe("error");
      expect((messages[0].data as { message: string }).message).toContain(
        "essence",
      );

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);
    });

    it("sends error when empty inventory", async () => {
      await setupSystem({
        inventory: [],
        skills: { runecrafting: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "air_altar",
        runeType: "air",
      });

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);
    });

    it("sends error for invalid runeType", async () => {
      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
        skills: { runecrafting: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "fake_altar",
        runeType: "nonexistent_rune",
      });

      const messages = findEmitted(EventType.UI_MESSAGE);
      expect(messages.length).toBe(1);
      expect((messages[0].data as { type: string }).type).toBe("error");

      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);
    });
  });

  // ─── Skill level caching ───────────────────────────────────────────

  describe("skill level caching", () => {
    it("uses cached skills from SKILLS_UPDATED event", async () => {
      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
        // No skills on player entity — will rely on cache
      });

      // Simulate SKILLS_UPDATED event (fired by SkillsSystem on login)
      emitEvent(eventBus, EventType.SKILLS_UPDATED, {
        playerId: "player1",
        skills: {
          runecrafting: { level: 14, xp: 0 },
        },
      });

      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "fire_altar",
        runeType: "fire",
      });

      // Fire requires level 14 — should succeed via cached level
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(1);
      expect((added[0].data as { item: { itemId: string } }).item.itemId).toBe(
        "fire_rune",
      );
    });
  });

  // ─── Player disconnect cleanup ─────────────────────────────────────

  describe("player disconnect", () => {
    it("cleans up cached skills on player unregister", async () => {
      await setupSystem({
        inventory: [createItem("rune_essence", 5)],
      });

      // Cache skills
      emitEvent(eventBus, EventType.SKILLS_UPDATED, {
        playerId: "player1",
        skills: { runecrafting: { level: 99, xp: 0 } },
      });

      // Player disconnects
      emitEvent(eventBus, EventType.PLAYER_UNREGISTERED, {
        playerId: "player1",
      });

      // Try to craft — should fall back to player entity (undefined) → level 1
      emitEvent(eventBus, EventType.RUNECRAFTING_INTERACT, {
        playerId: "player1",
        altarId: "earth_altar",
        runeType: "earth",
      });

      // Earth requires level 9, player defaults to level 1 after cache cleared
      const added = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(added.length).toBe(0);
    });
  });

  // ─── Client-side no-op ─────────────────────────────────────────────

  describe("client-side", () => {
    it("does not register event handlers on client", async () => {
      const mock = createMockWorld();
      mock.world.isServer = false;
      const clientSystem = new RunecraftingSystem(
        mock.world as unknown as World,
      );
      await clientSystem.init();

      // Should not crash
      clientSystem.update(0);
      clientSystem.destroy();
    });
  });
});
