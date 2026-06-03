import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@hyperforge/shared";
import { AgentManager } from "../AgentManager";
import { StreamingDuelScheduler } from "../../systems/StreamingDuelScheduler";
import { isDuelFoodItemId } from "../../systems/duelFood";

type SkillData = { level: number; xp: number };

type TestEntity = {
  id: string;
  type: string;
  isAgent?: boolean;
  data: Record<string, any>;
};

type CharacterRecord = {
  id: string;
  accountId: string;
  name: string;
  savedData: Record<string, unknown> | null;
};

type InventoryItem = {
  slot: number;
  itemId: string;
  quantity: number;
};

function createIntegrationWorld(terrainHeight: number) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const entities = new Map<string, TestEntity>();
  const characters = new Map<string, CharacterRecord>();
  const inventories = new Map<
    string,
    { items: InventoryItem[]; coins: number }
  >();
  const combatCalls: Array<{ attackerId: string; targetId: string }> = [];
  const gatherCalls: Array<{ playerId: string; resourceId: string }> = [];

  const recordGather = (playerId: string, resourceId: string) => {
    gatherCalls.push({ playerId, resourceId });
    const player = entities.get(playerId);
    const woodcutting = player?.data.skills?.woodcutting as
      | SkillData
      | undefined;
    if (!woodcutting) {
      return;
    }
    woodcutting.xp += 60;
    while (woodcutting.xp >= 100) {
      woodcutting.xp -= 100;
      woodcutting.level += 1;
    }
  };

  const on = (event: string, fn: (payload: unknown) => void) => {
    const handlers =
      listeners.get(event) ?? new Set<(payload: unknown) => void>();
    handlers.add(fn);
    listeners.set(event, handlers);
  };

  const off = (event: string, fn: (payload: unknown) => void) => {
    listeners.get(event)?.delete(fn);
  };

  const emit = (event: string, payload: unknown) => {
    if (event === EventType.RESOURCE_GATHER) {
      const gatherPayload = payload as {
        playerId?: unknown;
        resourceId?: unknown;
      };
      if (
        typeof gatherPayload.playerId === "string" &&
        typeof gatherPayload.resourceId === "string"
      ) {
        recordGather(gatherPayload.playerId, gatherPayload.resourceId);
      }
    }

    const handlers = listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(payload);
    }
  };

  const getInventoryState = (playerId: string) => {
    const existing = inventories.get(playerId);
    if (existing) {
      return existing;
    }
    const initial = { items: [] as InventoryItem[], coins: 0 };
    inventories.set(playerId, initial);
    return initial;
  };

  const world = {
    entities: {
      items: entities,
      get: (id: string) => entities.get(id),
      add: (entityData: Record<string, unknown>) => {
        const id = String(entityData.id);
        const entity: TestEntity = {
          id,
          type: String(entityData.type ?? "object"),
          isAgent: Boolean(entityData.isAgent),
          data: { ...entityData },
        };
        entities.set(id, entity);
        getInventoryState(id);
        return entity;
      },
      remove: (id: string) => {
        entities.delete(id);
      },
      getAllEntities: () => entities,
    },
    network: {
      send: vi.fn(),
    },
    on,
    off,
    emit,
    getSystem: (name: string) => {
      if (name === "database") {
        return {
          getCharactersAsync: async (accountId: string) =>
            Array.from(characters.values())
              .filter((record) => record.accountId === accountId)
              .map((record) => ({
                id: record.id,
                name: record.name,
                avatar: null,
                wallet: null,
              })),
          getPlayerAsync: async (characterId: string) =>
            characters.get(characterId)?.savedData ?? null,
        };
      }

      if (name === "terrain") {
        return {
          getHeightAt: () => terrainHeight,
        };
      }

      if (name === "movement") {
        return {
          requestMovement: (
            entityId: string,
            target: [number, number, number],
          ) => {
            const entity = entities.get(entityId);
            if (!entity) {
              return;
            }
            entity.data.position = [...target];
          },
          cancelMovement: (_entityId: string) => {},
        };
      }

      if (name === "resource") {
        return {
          startGathering: (playerId: string, resourceId: string) => {
            recordGather(playerId, resourceId);
          },
        };
      }

      if (name === "combat") {
        return {
          startCombat: (
            attackerId: string,
            targetId: string,
            _options?: { attackerType?: string; targetType?: string },
          ) => {
            combatCalls.push({ attackerId, targetId });
            const attacker = entities.get(attackerId);
            const target = entities.get(targetId);
            if (!attacker || !target) {
              return false;
            }
            attacker.data.inCombat = true;
            attacker.data.combatTarget = targetId;
            target.data.inCombat = true;
            target.data.combatTarget = attackerId;
            return true;
          },
        };
      }

      if (name === "inventory") {
        return {
          getInventory: (playerId: string) => {
            const state = getInventoryState(playerId);
            return {
              playerId,
              items: state.items,
              coins: state.coins,
            };
          },
          addItemDirect: async (
            playerId: string,
            item: { itemId: string; quantity: number; slot?: number },
          ) => {
            const state = getInventoryState(playerId);
            const usedSlots = new Set(state.items.map((entry) => entry.slot));
            const slot =
              typeof item.slot === "number"
                ? item.slot
                : Array.from({ length: 28 }, (_, i) => i).find(
                    (candidate) => !usedSlots.has(candidate),
                  );

            if (typeof slot !== "number" || usedSlots.has(slot)) {
              return false;
            }

            state.items.push({
              slot,
              itemId: item.itemId,
              quantity: item.quantity,
            });
            return true;
          },
          removeItem: async (data: {
            playerId: string;
            itemId: string;
            quantity: number;
            slot?: number;
          }) => {
            const state = getInventoryState(data.playerId);
            const index = state.items.findIndex((entry) => {
              if (typeof data.slot === "number") {
                return entry.slot === data.slot && entry.itemId === data.itemId;
              }
              return entry.itemId === data.itemId;
            });

            if (index < 0) {
              return false;
            }

            const existing = state.items[index];
            if (existing.quantity <= data.quantity) {
              state.items.splice(index, 1);
            } else {
              existing.quantity -= data.quantity;
            }
            return true;
          },
          isInventoryReady: (_playerId: string) => true,
        };
      }

      return null;
    },
    settings: {
      avatar: { url: "asset://avatars/test.vrm" },
    },
  };

  const registerCharacter = (
    accountId: string,
    characterId: string,
    name: string,
    savedData: Record<string, unknown> | null,
  ) => {
    characters.set(characterId, {
      id: characterId,
      accountId,
      name,
      savedData,
    });
    getInventoryState(characterId);
  };

  const addResource = (
    id: string,
    position: [number, number, number],
    resourceType: string,
    name: string,
  ) => {
    entities.set(id, {
      id,
      type: "resource",
      data: {
        id,
        type: "resource",
        resourceType,
        name,
        position,
      },
    });
  };

  const countFood = (playerId: string) => {
    return getInventoryState(playerId).items.filter((item) =>
      isDuelFoodItemId(item.itemId),
    ).length;
  };

  return {
    world,
    entities,
    combatCalls,
    gatherCalls,
    registerCharacter,
    addResource,
    countFood,
  };
}

describe("Agent duel arena end-to-end integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("provides integration world helper for future tests", () => {
    const ctx = createIntegrationWorld(10);
    expect(ctx.world).toBeDefined();
    expect(ctx.entities).toBeDefined();
    expect(ctx.combatCalls).toEqual([]);
    expect(ctx.gatherCalls).toEqual([]);
  });
});
