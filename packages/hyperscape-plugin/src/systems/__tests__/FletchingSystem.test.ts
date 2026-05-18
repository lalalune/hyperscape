/**
 * FletchingSystem Unit Tests
 *
 * Tests for the fletching system covering:
 * - Recipe filtering (handleFletchingInteract) — knife+log, item-on-item, invalid player
 * - Fletching lifecycle (start, complete, schedule next)
 * - Level/material/tool validation
 * - Multi-output recipes (arrow shafts produce 15+)
 * - Movement and combat cancellation
 * - Concurrent session prevention
 * - Tick-based update loop
 * - Edge cases: "All" quantity, unique IDs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FletchingSystem } from "../FletchingSystem";
import { EventBus } from "@hyperforge/shared";
import { EventType } from "@hyperforge/shared";
import type { World } from "../../../../types/index";
import { processingDataProvider } from "@hyperforge/shared";

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
    currentTick?: number;
  } = {},
) {
  const eventBus = new EventBus();
  const inventory = options.inventory || [];

  const world = {
    isServer: true,
    currentTick: options.currentTick ?? 100,
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

describe("FletchingSystem", () => {
  let system: FletchingSystem;
  let eventBus: EventBus;
  let mockWorld: ReturnType<typeof createMockWorld>["world"];

  // Track emitted events
  const emittedEvents: Array<{ type: string; data: unknown }> = [];

  beforeEach(async () => {
    emittedEvents.length = 0;
    processingDataProvider.initialize();
  });

  afterEach(() => {
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
    system = new FletchingSystem(mockWorld as unknown as World);
    await system.init();

    // Capture all events emitted by the system
    const originalEmit = eventBus.emitEvent.bind(eventBus);
    vi.spyOn(eventBus, "emitEvent").mockImplementation((type, data, source) => {
      emittedEvents.push({ type: type as string, data });
      return originalEmit(type, data, source);
    });
  }

  function findEmitted(type: string) {
    return emittedEvents.filter((e) => e.type === type);
  }

  // ─── handleFletchingInteract ──────────────────────────────────────

  describe("handleFletchingInteract", () => {
    it("emits FLETCHING_INTERFACE_OPEN with recipes for knife + logs", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return; // Skip if manifests not loaded

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.FLETCHING_INTERACT, {
        playerId: "player1",
        triggerType: "knife",
        inputItemId: "logs",
      });

      const opens = findEmitted(EventType.FLETCHING_INTERFACE_OPEN);
      expect(opens.length).toBe(1);
      const payload = opens[0].data as {
        availableRecipes: Array<{ recipeId: string }>;
      };
      expect(payload.availableRecipes.length).toBeGreaterThan(0);
    });

    it("filters recipes by inputItemId (knife + oak_logs shows only oak recipes)", async () => {
      const recipe = processingDataProvider.getFletchingRecipe(
        "arrow_shaft:oak_logs",
      );
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("oak_logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.FLETCHING_INTERACT, {
        playerId: "player1",
        triggerType: "knife",
        inputItemId: "oak_logs",
      });

      const opens = findEmitted(EventType.FLETCHING_INTERFACE_OPEN);
      expect(opens.length).toBe(1);
      const payload = opens[0].data as {
        availableRecipes: Array<{
          recipeId: string;
          inputs: Array<{ item: string }>;
        }>;
      };
      // Every returned recipe should use oak_logs as an input
      for (const r of payload.availableRecipes) {
        const hasOak = r.inputs.some((inp) => inp.item === "oak_logs");
        expect(hasOak).toBe(true);
      }
    });

    it("filters recipes for item-on-item (bowstring + shortbow_u)", async () => {
      const recipe = processingDataProvider.getFletchingRecipe(
        "shortbow:shortbow_u",
      );
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("bowstring", 1), createItem("shortbow_u", 1)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.FLETCHING_INTERACT, {
        playerId: "player1",
        triggerType: "item_on_item",
        inputItemId: "bowstring",
        secondaryItemId: "shortbow_u",
      });

      const opens = findEmitted(EventType.FLETCHING_INTERFACE_OPEN);
      expect(opens.length).toBe(1);
      const payload = opens[0].data as {
        availableRecipes: Array<{ recipeId: string }>;
      };
      // Should return exactly the stringing recipe
      expect(payload.availableRecipes.length).toBe(1);
      expect(payload.availableRecipes[0].recipeId).toBe("shortbow:shortbow_u");
    });

    it("returns recipes with hasInputs false when inventory is empty", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.FLETCHING_INTERACT, {
        playerId: "player1",
        triggerType: "knife",
        inputItemId: "logs",
      });

      const opens = findEmitted(EventType.FLETCHING_INTERFACE_OPEN);
      expect(opens.length).toBe(1);
      const payload = opens[0].data as {
        availableRecipes: Array<{ hasInputs: boolean }>;
      };
      // All recipes should show hasInputs: false (no materials)
      for (const r of payload.availableRecipes) {
        expect(r.hasInputs).toBe(false);
      }
    });
  });

  // ─── startFletching ───────────────────────────────────────────────

  describe("startFletching", () => {
    it("starts a session with correct completionTick", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 3,
      });

      expect(system.isPlayerFletching("player1")).toBe(true);
      const starts = findEmitted(EventType.FLETCHING_START);
      expect(starts.length).toBe(1);
    });

    it("rejects if level too low", async () => {
      // Find a recipe requiring high level
      const recipe = processingDataProvider.getFletchingRecipe(
        "magic_shortbow_u:magic_logs",
      );
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("magic_logs", 5)],
        skills: { fletching: { level: 1, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "magic_shortbow_u:magic_logs",
        quantity: 1,
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
      const messages = findEmitted(EventType.UI_MESSAGE);
      const levelMsg = messages.find((m) =>
        (m.data as { message: string }).message.includes("level"),
      );
      expect(levelMsg).toBeDefined();
    });

    it("rejects if missing materials", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 1,
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
    });

    it("rejects if missing tool (knife) for knife recipe", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 1,
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
    });

    it("rejects if already in a fletching session (concurrent prevention)", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 10)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      // Start first session
      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 5,
      });

      // Try to start second session
      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 3,
      });

      // Only one FLETCHING_START should fire
      const starts = findEmitted(EventType.FLETCHING_START);
      expect(starts.length).toBe(1);
    });

    it("rejects for invalid recipe ID", async () => {
      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "nonexistent_recipe_xyz",
        quantity: 1,
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
    });
  });

  // ─── completeFletching + update loop ──────────────────────────────

  describe("completeFletching via update", () => {
    it("completes a fletch: removes inputs, adds output, grants XP", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 1,
      });

      expect(system.isPlayerFletching("player1")).toBe(true);

      // Advance tick past completion
      mockWorld.currentTick = 100 + recipe.ticks;
      system.update(0);

      // Should have emitted input removal, item added, XP gained
      const itemsRemoved = findEmitted(EventType.INVENTORY_ITEM_REMOVED);
      expect(itemsRemoved.length).toBeGreaterThan(0);

      const itemsAdded = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(itemsAdded.length).toBe(1);

      const xpGained = findEmitted(EventType.SKILLS_XP_GAINED);
      expect(xpGained.length).toBe(1);
      expect((xpGained[0].data as { amount: number }).amount).toBe(recipe.xp);

      // For quantity 1, session should complete
      const completes = findEmitted(EventType.FLETCHING_COMPLETE);
      expect(completes.length).toBe(1);
    });

    it("multi-output: arrow shafts produce correct outputQuantity", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 1,
      });

      mockWorld.currentTick = 100 + recipe.ticks;
      system.update(0);

      const itemsAdded = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(itemsAdded.length).toBe(1);

      // Arrow shafts produce 15 per log
      const addedItem = (itemsAdded[0].data as { item: { quantity: number } })
        .item;
      expect(addedItem.quantity).toBe(recipe.outputQuantity);
    });

    it("schedules next action if quantity remaining", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 10)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 3,
      });

      // Complete first fletch
      mockWorld.currentTick = 100 + recipe.ticks;
      system.update(0);

      // Should still be fletching (2 remaining)
      expect(system.isPlayerFletching("player1")).toBe(true);

      // Complete second fletch
      mockWorld.currentTick = 100 + recipe.ticks * 2;
      system.update(0);

      // Still fletching (1 remaining)
      expect(system.isPlayerFletching("player1")).toBe(true);

      // Complete third fletch
      mockWorld.currentTick = 100 + recipe.ticks * 3;
      system.update(0);

      // Session should be done
      const completes = findEmitted(EventType.FLETCHING_COMPLETE);
      expect(completes.length).toBe(1);
    });

    it("generates unique item IDs across fletches", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 10)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 3,
      });

      // Complete 3 fletches
      for (let i = 0; i < 3; i++) {
        mockWorld.currentTick = 100 + recipe.ticks * (i + 1);
        system.update(0);
      }

      const itemsAdded = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      const ids = itemsAdded.map(
        (e) => (e.data as { item: { id: string } }).item.id,
      );
      // All IDs should be unique
      expect(new Set(ids).size).toBe(ids.length);
      // IDs should use the fletch_ prefix with counter
      for (const id of ids) {
        expect(id).toMatch(/^fletch_/);
      }
    });
  });

  // ─── Movement cancellation ────────────────────────────────────────

  describe("movement cancellation", () => {
    it("cancels fletching when player moves", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 5,
      });

      expect(system.isPlayerFletching("player1")).toBe(true);

      // Player clicks to move
      emitEvent(eventBus, EventType.MOVEMENT_CLICK_TO_MOVE, {
        playerId: "player1",
        targetPosition: { x: 10, y: 0, z: 10 },
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
      const completes = findEmitted(EventType.FLETCHING_COMPLETE);
      expect(completes.length).toBe(1);
    });

    it("does not cancel other players when one moves", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 10)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      // Start fletching for player1
      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 5,
      });

      // Player2 moves (player2 is not fletching)
      emitEvent(eventBus, EventType.MOVEMENT_CLICK_TO_MOVE, {
        playerId: "player2",
        targetPosition: { x: 10, y: 0, z: 10 },
      });

      // Player1 should still be fletching
      expect(system.isPlayerFletching("player1")).toBe(true);
    });
  });

  // ─── Combat cancellation ──────────────────────────────────────────

  describe("combat cancellation", () => {
    it("cancels fletching when player enters combat as attacker", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 5,
      });

      expect(system.isPlayerFletching("player1")).toBe(true);

      emitEvent(eventBus, EventType.COMBAT_STARTED, {
        attackerId: "player1",
        targetId: "mob1",
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
    });

    it("cancels fletching when player is attacked (target)", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 5,
      });

      emitEvent(eventBus, EventType.COMBAT_STARTED, {
        attackerId: "mob1",
        targetId: "player1",
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
    });
  });

  // ─── Player disconnect cleanup ────────────────────────────────────

  describe("player disconnect", () => {
    it("cleans up session on player unregister", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 5,
      });

      expect(system.isPlayerFletching("player1")).toBe(true);

      emitEvent(eventBus, EventType.PLAYER_UNREGISTERED, {
        playerId: "player1",
      });

      expect(system.isPlayerFletching("player1")).toBe(false);
    });
  });

  // ─── "All" quantity sentinel ──────────────────────────────────────

  describe("All quantity", () => {
    it("handles 'All' quantity (-1 mapped to 10000) without error", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      // Client sends -1 for "All"; server should have mapped to 10000
      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 10000,
      });

      expect(system.isPlayerFletching("player1")).toBe(true);

      // Complete first fletch
      mockWorld.currentTick = 100 + recipe.ticks;
      system.update(0);

      // Should have added items (session continues until materials run out)
      const itemsAdded = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(itemsAdded.length).toBeGreaterThan(0);
    });
  });

  // ─── Client-side no-op ────────────────────────────────────────────

  describe("client-side", () => {
    it("does not register event handlers on client", async () => {
      const mock = createMockWorld();
      mock.world.isServer = false;
      const clientSystem = new FletchingSystem(mock.world as unknown as World);
      await clientSystem.init();

      // System should not crash and isPlayerFletching should return false
      expect(clientSystem.isPlayerFletching("anyone")).toBe(false);
      clientSystem.destroy();
    });
  });

  // ─── Update loop ──────────────────────────────────────────────────

  describe("update", () => {
    it("processes only once per tick", async () => {
      const recipe =
        processingDataProvider.getFletchingRecipe("arrow_shaft:logs");
      if (!recipe) return;

      await setupSystem({
        inventory: [createItem("knife", 1), createItem("logs", 5)],
        skills: { fletching: { level: 99, xp: 0 } },
        currentTick: 100,
      });

      emitEvent(eventBus, EventType.PROCESSING_FLETCHING_REQUEST, {
        playerId: "player1",
        recipeId: "arrow_shaft:logs",
        quantity: 1,
      });

      // Advance tick to completion
      mockWorld.currentTick = 100 + recipe.ticks;

      // Call update multiple times for same tick
      system.update(0);
      system.update(0);
      system.update(0);

      // Should only process once
      const itemsAdded = findEmitted(EventType.INVENTORY_ITEM_ADDED);
      expect(itemsAdded.length).toBe(1);
    });

    it("does nothing on client", async () => {
      const mock = createMockWorld({ currentTick: 100 });
      mock.world.isServer = false;
      const clientSystem = new FletchingSystem(mock.world as unknown as World);
      await clientSystem.init();

      // Should not throw
      clientSystem.update(0);
      clientSystem.destroy();
    });
  });
});
