import { describe, expect, it, vi } from "vitest";
import { EmbeddedHyperiaService } from "../EmbeddedHyperiaService";

type TestEntity = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position?: {
    x: number;
    y: number;
    z: number;
    set: (x: number, y: number, z: number) => void;
  };
};

function createMockWorld(options?: {
  inventorySystem?: Record<string, unknown> | null;
  equipmentSystem?: Record<string, unknown> | null;
  extraEntities?: Array<{
    id: string;
    data: Record<string, unknown>;
    position: [number, number, number];
  }>;
}) {
  const entities = new Map<string, TestEntity>();

  for (const ent of options?.extraEntities || []) {
    const pos = {
      x: ent.position[0],
      y: ent.position[1],
      z: ent.position[2],
      set(x: number, y: number, z: number) {
        pos.x = x;
        pos.y = y;
        pos.z = z;
      },
    };
    entities.set(ent.id, {
      id: ent.id,
      type: String(ent.data.type || "object"),
      data: { ...ent.data, position: [...ent.position] },
      position: pos,
    });
  }

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
        const entity: TestEntity = {
          id,
          type: String(entityData.type ?? "object"),
          data: { ...entityData, position: [...rawPosition] },
          position,
        };
        entities.set(id, entity);
        return entity;
      },
      remove: (id: string) => entities.delete(id),
    },
    on: vi.fn(),
    off: vi.fn(),
    emit,
    getSystem: vi.fn((name: string) => {
      if (name === "inventory") return options?.inventorySystem ?? null;
      if (name === "equipment") return options?.equipmentSystem ?? null;
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
// getInventoryItems
// ==========================================================================
describe("getInventoryItems", () => {
  it("returns items from InventorySystem", async () => {
    const { service } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "bronze_sword",
              quantity: 1,
              item: {
                id: "bronze_sword",
                name: "Bronze Sword",
                type: "weapon",
              },
            },
            {
              slot: 1,
              itemId: "shrimp",
              quantity: 5,
              item: { id: "shrimp", name: "Shrimp", type: "consumable" },
            },
          ],
        }),
      },
    });

    const items = service.getInventoryItems();
    expect(items).toHaveLength(2);
    expect(items[0].itemId).toBe("bronze_sword");
    expect(items[1].itemId).toBe("shrimp");
    expect(items[1].quantity).toBe(5);
  });

  it("returns empty array when inventory system unavailable", async () => {
    const { service } = await createInitializedService({
      inventorySystem: null,
    });

    expect(service.getInventoryItems()).toEqual([]);
  });

  it("returns empty array when player has no inventory", async () => {
    const { service } = await createInitializedService({
      inventorySystem: { getInventory: () => undefined },
    });

    expect(service.getInventoryItems()).toEqual([]);
  });

  it("returns empty when service is stopped", async () => {
    const { service } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "sword",
              quantity: 1,
              item: { id: "sword", name: "Sword", type: "weapon" },
            },
          ],
        }),
      },
    });
    await service.stop();
    expect(service.getInventoryItems()).toEqual([]);
  });
});

// ==========================================================================
// getEquippedItems
// ==========================================================================
describe("getEquippedItems", () => {
  it("returns equipped items from EquipmentSystem", async () => {
    const { service } = await createInitializedService({
      equipmentSystem: {
        getPlayerEquipment: () => ({
          weapon: { itemId: "bronze_sword" },
          shield: { itemId: null },
          helmet: { itemId: "bronze_helm" },
          body: { itemId: null },
          legs: { itemId: null },
          boots: { itemId: null },
          gloves: { itemId: null },
          cape: { itemId: null },
          amulet: { itemId: null },
          ring: { itemId: null },
          arrows: { itemId: null },
        }),
      },
    });

    const equipped = service.getEquippedItems();
    expect(equipped.weapon).toBe("bronze_sword");
    expect(equipped.helmet).toBe("bronze_helm");
    expect(equipped.shield).toBeNull();
    expect(equipped.body).toBeNull();
  });

  it("returns empty when equipment system unavailable", async () => {
    const { service } = await createInitializedService({
      equipmentSystem: null,
    });

    expect(service.getEquippedItems()).toEqual({});
  });

  it("returns empty when player has no equipment", async () => {
    const { service } = await createInitializedService({
      equipmentSystem: { getPlayerEquipment: () => undefined },
    });

    expect(service.getEquippedItems()).toEqual({});
  });
});

// categorizeEntity is tested indirectly via getNearbyEntities in the
// EmbeddedHyperiaService.questMethods.test.ts and through integration.
// The categorization fix (tree/rock/fishing_spot → "resource") is verified
// by the resource keyword mapping tests in AgentManager.behavior.test.ts.

// ==========================================================================
// executeUse - fixed to use getInventoryItems
// ==========================================================================
describe("executeUse", () => {
  it("emits INVENTORY_USE with correct slot from InventorySystem", async () => {
    const { service, emit } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({
          items: [
            {
              slot: 3,
              itemId: "shrimp",
              quantity: 1,
              item: { id: "shrimp", name: "Shrimp", type: "consumable" },
            },
          ],
        }),
      },
    });

    await service.executeUse("shrimp");

    const useCall = emit.mock.calls.find(
      (call: unknown[]) => call[0] === "inventory:use",
    );
    expect(useCall).toBeDefined();
    expect(useCall![1]).toMatchObject({
      playerId: "agent-1",
      itemId: "shrimp",
      slot: 3,
    });
  });

  it("does not emit when item not in inventory", async () => {
    const { service, emit } = await createInitializedService({
      inventorySystem: {
        getInventory: () => ({ items: [] }),
      },
    });

    await service.executeUse("nonexistent_item");

    const useCall = emit.mock.calls.find(
      (call: unknown[]) => call[0] === "inventory:use",
    );
    expect(useCall).toBeUndefined();
  });
});
