/**
 * Tests for EmbeddedHyperiaService firemaking and gather features:
 * - executeFiremake with proper slot resolution and event emission
 * - executeAttack dead target guard
 * - executeGather PendingGatherManager integration
 * - Dead mob filtering in getNearbyEntities
 */
import { describe, expect, it, vi } from "vitest";
import { EmbeddedHyperiaService } from "../EmbeddedHyperiaService";

function createMockWorld(options?: {
  inventorySystem?: Record<string, unknown> | null;
  equipmentSystem?: Record<string, unknown> | null;
  networkSystem?: Record<string, unknown> | null;
}) {
  const entities = new Map();
  const emit = vi.fn();
  const world = {
    entities: {
      items: entities,
      get: (id: string) => entities.get(id),
      add: (entityData: Record<string, unknown>) => {
        const id = String(entityData.id);
        const rawPosition = Array.isArray(entityData.position)
          ? (entityData.position as [number, number, number])
          : [0, 0, 0];
        const position = {
          x: rawPosition[0],
          y: rawPosition[1],
          z: rawPosition[2],
          set(x: number, y: number, z: number) {
            position.x = x;
            position.y = y;
            position.z = z;
          },
        };
        const entity = {
          id,
          type: String(entityData.type ?? "object"),
          data: { ...entityData, position: [...rawPosition] },
          position,
          node: { position },
        };
        entities.set(id, entity);
        return entity;
      },
      remove: (id: string) => entities.delete(id),
    },
    on: vi.fn(),
    off: vi.fn(),
    emit,
    isServer: true,
    getSystem: vi.fn((name: string) => {
      if (name === "inventory") return options?.inventorySystem ?? null;
      if (name === "equipment") return options?.equipmentSystem ?? null;
      if (name === "network") return options?.networkSystem ?? null;
      if (name === "database") {
        return {
          getCharactersAsync: async () => [
            { id: "agent-1", name: "TestAgent", avatar: null, wallet: null },
          ],
          getPlayerAsync: async () => null,
        };
      }
      if (name === "terrain") return { getHeightAt: () => 10 };
      return null;
    }),
    settings: { avatar: { url: "asset://avatars/test.vrm" } },
  };

  return { world, entities, emit };
}

async function createInitializedService(
  worldOptions?: Parameters<typeof createMockWorld>[0],
) {
  const ctx = createMockWorld(worldOptions);
  const service = new EmbeddedHyperiaService(
    ctx.world as never,
    "agent-1",
    "acct-1",
    "TestAgent",
  );
  await service.initialize();
  return { service, ...ctx };
}

// ==========================================================================
// executeFiremake
// ==========================================================================
describe("executeFiremake", () => {
  it("emits PROCESSING_FIREMAKING_REQUEST with correct slots", async () => {
    const { service, emit } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 2,
              itemId: "tinderbox",
              quantity: 1,
              item: { id: "tinderbox", name: "Tinderbox", type: "tool" },
            },
            {
              slot: 5,
              itemId: "logs",
              quantity: 1,
              item: { id: "logs", name: "Logs", type: "resource" },
            },
          ],
        }),
      },
    });

    const result = await service.executeFiremake("logs");

    expect(result).toBe(true);
    const fireCall = emit.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes("firemaking"),
    );
    expect(fireCall).toBeDefined();
    expect(fireCall![1]).toMatchObject({
      playerId: "agent-1",
      logsId: "logs",
      logsSlot: 5,
      tinderboxSlot: 2,
    });
  });

  it("returns false when no tinderbox in inventory", async () => {
    const { service } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "logs",
              quantity: 1,
              item: { id: "logs", name: "Logs", type: "resource" },
            },
          ],
        }),
      },
    });

    const result = await service.executeFiremake();
    expect(result).toBe(false);
  });

  it("returns false when no logs in inventory", async () => {
    const { service } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "tinderbox",
              quantity: 1,
              item: { id: "tinderbox", name: "Tinderbox", type: "tool" },
            },
          ],
        }),
      },
    });

    const result = await service.executeFiremake();
    expect(result).toBe(false);
  });

  it("finds oak_logs when specified", async () => {
    const { service, emit } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "tinderbox",
              quantity: 1,
              item: { id: "tinderbox", name: "Tinderbox", type: "tool" },
            },
            {
              slot: 1,
              itemId: "logs",
              quantity: 1,
              item: { id: "logs", name: "Logs", type: "resource" },
            },
            {
              slot: 2,
              itemId: "oak_logs",
              quantity: 1,
              item: { id: "oak_logs", name: "Oak Logs", type: "resource" },
            },
          ],
        }),
      },
    });

    await service.executeFiremake("oak_logs");

    const fireCall = emit.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes("firemaking"),
    );
    expect(fireCall![1]).toMatchObject({
      logsId: "oak_logs",
      logsSlot: 2,
    });
  });

  it("auto-selects first available logs when no preference", async () => {
    const { service, emit } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "tinderbox",
              quantity: 1,
              item: { id: "tinderbox", name: "Tinderbox", type: "tool" },
            },
            {
              slot: 3,
              itemId: "willow_logs",
              quantity: 1,
              item: {
                id: "willow_logs",
                name: "Willow Logs",
                type: "resource",
              },
            },
          ],
        }),
      },
    });

    await service.executeFiremake();

    const fireCall = emit.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes("firemaking"),
    );
    expect(fireCall![1]).toMatchObject({
      logsId: "willow_logs",
      logsSlot: 3,
    });
  });

  it("returns false when service is not active", async () => {
    const { service } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "tinderbox",
              quantity: 1,
              item: { id: "tinderbox", name: "Tinderbox", type: "tool" },
            },
            {
              slot: 1,
              itemId: "logs",
              quantity: 1,
              item: { id: "logs", name: "Logs", type: "resource" },
            },
          ],
        }),
      },
    });
    await service.stop();
    const result = await service.executeFiremake();
    expect(result).toBe(false);
  });
});

// ==========================================================================
// executeAttack — dead target guard
// ==========================================================================
describe("executeAttack dead target guard", () => {
  it("does not attack dead target (isDead returns true)", async () => {
    const { service, entities, emit } = await createInitializedService();

    const deadMob = {
      id: "goblin-1",
      type: "mob",
      data: { type: "mob", health: 0 },
      node: { position: { x: 5, y: 0, z: 5 } },
      isDead: () => true,
      isAlive: () => false,
    };
    entities.set("goblin-1", deadMob);

    await service.executeAttack("goblin-1");

    const attackCall = emit.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes("attack") ||
        String(call[0]).includes("combat"),
    );
    expect(attackCall).toBeUndefined();
  });

  it("does not attack nonexistent target", async () => {
    const { service, emit } = await createInitializedService();

    await service.executeAttack("nonexistent-mob");

    const attackCall = emit.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes("attack") ||
        String(call[0]).includes("combat"),
    );
    expect(attackCall).toBeUndefined();
  });
});

// ==========================================================================
// executeGather — PendingGatherManager integration
// ==========================================================================
describe("executeGather", () => {
  it("uses PendingGatherManager when available", async () => {
    const queueFn = vi.fn();
    const { service } = await createInitializedService({
      networkSystem: {
        pendingGatherManager: {
          queuePendingGather: queueFn,
        },
        tickSystem: {
          getCurrentTick: () => 42,
        },
      },
    });

    await service.executeGather("tree_23_-10");

    expect(queueFn).toHaveBeenCalledWith("agent-1", "tree_23_-10", 42);
  });

  it("falls back to RESOURCE_GATHER event when no PendingGatherManager", async () => {
    const { service, emit } = await createInitializedService();

    await service.executeGather("tree_23_-10");

    const gatherCall = emit.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes("resource") &&
        String(call[0]).includes("gather"),
    );
    expect(gatherCall).toBeDefined();
    expect(gatherCall![1]).toMatchObject({
      playerId: "agent-1",
      resourceId: "tree_23_-10",
    });
  });

  it("falls back safely when entity lacks node.position", async () => {
    const { service, emit, world } = await createInitializedService();
    const player = world.entities.get("agent-1") as
      | {
          position?: { x?: number; y?: number; z?: number };
          node?: { position?: { x?: number; y?: number; z?: number } };
          data?: { position?: unknown };
        }
      | undefined;

    expect(player).toBeDefined();
    if (!player) return;

    delete player.node;
    delete player.position;
    player.data = { ...(player.data ?? {}), position: [11, 12, 13] };

    await expect(service.executeGather("tree_23_-10")).resolves.toBeUndefined();

    const gatherCall = emit.mock.calls.find(
      (call: unknown[]) =>
        String(call[0]).includes("resource") &&
        String(call[0]).includes("gather"),
    );
    expect(gatherCall).toBeDefined();
    expect(gatherCall![1]).toMatchObject({
      playerId: "agent-1",
      resourceId: "tree_23_-10",
      playerPosition: { x: 11, y: 12, z: 13 },
    });
  });
});

// ==========================================================================
// Entity categorization
// ==========================================================================
describe("entity categorization logic", () => {
  function categorizeEntity(
    data: Record<string, unknown>,
  ): "player" | "mob" | "npc" | "item" | "resource" | "object" {
    if (data.type === "player") return "player";
    if (data.mobType || data.type === "mob") return "mob";
    if (data.npcType || data.type === "npc") return "npc";
    if (data.itemId || data.type === "item" || data.isItem) return "item";
    if (data.resourceType || data.type === "resource") return "resource";
    const typeStr = String(data.type || "").toLowerCase();
    if (
      typeStr === "tree" ||
      typeStr === "rock" ||
      typeStr === "ore" ||
      typeStr === "fishing_spot" ||
      typeStr === "herb_patch"
    ) {
      return "resource";
    }
    return "object";
  }

  it("categorizes trees as resource", () => {
    expect(categorizeEntity({ type: "tree" })).toBe("resource");
  });

  it("categorizes rocks as resource", () => {
    expect(categorizeEntity({ type: "rock" })).toBe("resource");
  });

  it("categorizes fishing_spot as resource", () => {
    expect(categorizeEntity({ type: "fishing_spot" })).toBe("resource");
  });

  it("categorizes by resourceType field", () => {
    expect(categorizeEntity({ resourceType: "tree", type: "resource" })).toBe(
      "resource",
    );
  });

  it("categorizes entities with type=resource", () => {
    expect(categorizeEntity({ type: "resource" })).toBe("resource");
  });

  it("categorizes mobs correctly", () => {
    expect(categorizeEntity({ type: "mob", mobType: "goblin" })).toBe("mob");
  });

  it("categorizes npcs correctly", () => {
    expect(categorizeEntity({ type: "npc", npcType: "shopkeeper" })).toBe(
      "npc",
    );
  });

  it("categorizes items correctly", () => {
    expect(categorizeEntity({ type: "item", itemId: "sword" })).toBe("item");
  });

  it("categorizes players correctly", () => {
    expect(categorizeEntity({ type: "player" })).toBe("player");
  });

  it("categorizes unknown entities as object", () => {
    expect(categorizeEntity({ type: "building" })).toBe("object");
  });

  it("categorizes herb_patch as resource", () => {
    expect(categorizeEntity({ type: "herb_patch" })).toBe("resource");
  });
});
