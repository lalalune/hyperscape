import { describe, expect, it, vi } from "vitest";
import { EmbeddedHyperscapeService } from "../EmbeddedHyperscapeService";

function createMockWorld() {
  const entities = new Map();
  const systems = new Map();

  const world = {
    entities: {
      get: (id: string) => entities.get(id),
      add: vi.fn().mockReturnValue("new-entity-id"),
      items: entities,
      [Symbol.iterator]: () => entities.entries(),
    },
    getSystem: (name: string) => systems.get(name) ?? null,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isServer: true,
    network: null,
  };

  return { world, entities, systems };
}

function createActiveService() {
  const { world, entities, systems } = createMockWorld();
  entities.set("agent-1", { data: {} });

  const service = new EmbeddedHyperscapeService(
    world as never,
    "agent-1",
    "account-1",
    "TestAgent",
  );
  (service as unknown as { playerEntityId: string }).playerEntityId = "agent-1";
  (service as unknown as { isActive: boolean }).isActive = true;

  return { service, world, entities, systems };
}

describe("EmbeddedHyperscapeService RPG methods", () => {
  describe("banking", () => {
    it("executeBankOpen emits BANK_OPEN event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeBankOpen("bank-lumbridge");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalledWith(
        expect.stringContaining("bank"),
        expect.objectContaining({
          playerId: "agent-1",
          bankId: "bank-lumbridge",
        }),
      );
    });

    it("executeBankDeposit validates itemId", async () => {
      const { service } = createActiveService();
      const result = await service.executeBankDeposit("", 1);
      expect(result).toBe(false);
    });

    it("executeBankDeposit emits BANK_DEPOSIT event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeBankDeposit("shark", 5);
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalledWith(
        expect.stringContaining("bank"),
        expect.objectContaining({
          playerId: "agent-1",
          itemId: "shark",
          quantity: 5,
        }),
      );
    });

    it("executeBankDepositAll emits BANK_DEPOSIT_ALL event", async () => {
      const { service, world, entities } = createActiveService();
      entities.get("agent-1").data.position = [0, 0, 0];
      entities.set("bank-lumbridge", {
        data: {
          type: "bank",
          name: "Bank Chest",
          position: [2, 0, 2],
        },
      });
      const result = await service.executeBankDepositAll();
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalledWith(
        expect.stringContaining("bank"),
        expect.objectContaining({ playerId: "agent-1" }),
      );
    });
  });

  describe("shopping", () => {
    it("executeStoreBuy validates inputs", async () => {
      const { service } = createActiveService();
      expect(await service.executeStoreBuy("", "item", 1)).toBe(false);
      expect(await service.executeStoreBuy("store", "", 1)).toBe(false);
    });

    it("executeStoreBuy emits STORE_BUY event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeStoreBuy(
        "store-1",
        "bronze_sword",
        1,
      );
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalledWith(
        expect.stringContaining("store"),
        expect.objectContaining({
          playerId: "agent-1",
          itemId: "bronze_sword",
        }),
      );
    });
  });

  describe("crafting", () => {
    it("executeCook emits cooking event", async () => {
      const { service, world, entities, systems } = createActiveService();
      entities.get("agent-1").data.position = [0, 0, 0];
      entities.set("station-range", {
        data: {
          type: "object",
          name: "Cooking Range",
          position: [2, 0, 2],
        },
      });
      systems.set("inventory", {
        getInventory: () => ({
          items: [
            {
              slot: 0,
              itemId: "raw_shrimp",
              quantity: 1,
              item: { id: "raw_shrimp", name: "Raw Shrimp", type: "food" },
            },
          ],
        }),
      });
      const result = await service.executeCook("raw_shrimp");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });

    it("executeSmelt emits smelting event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeSmelt("bronze_bar");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });

    it("executeFiremake emits firemaking event", async () => {
      const { service, world, systems } = createActiveService();
      systems.set("inventory", {
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
      });
      const result = await service.executeFiremake();
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });
  });

  describe("quests", () => {
    it("executeNpcInteract validates npcId", async () => {
      const { service } = createActiveService();
      expect(await service.executeNpcInteract("")).toBe(false);
    });

    it("executeNpcInteract emits event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeNpcInteract("npc-guard", "talk");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });
  });

  describe("combat advanced", () => {
    it("executeUnequip validates slot", async () => {
      const { service } = createActiveService();
      expect(await service.executeUnequip("")).toBe(false);
    });

    it("executeUnequip emits event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeUnequip("weapon");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });

    it("executeSetAutoRetaliate sets entity data", async () => {
      const { service, entities } = createActiveService();
      const result = await service.executeSetAutoRetaliate(false);
      expect(result).toBe(true);
      expect(entities.get("agent-1").data.autoRetaliate).toBe(false);
    });
  });

  describe("prayer", () => {
    it("executePrayerDeactivateAll calls system", async () => {
      const { service, systems } = createActiveService();
      const mockDeactivateAll = vi.fn();
      systems.set("prayer", { deactivateAll: mockDeactivateAll });

      const result = await service.executePrayerDeactivateAll();
      expect(result).toBe(true);
      expect(mockDeactivateAll).toHaveBeenCalledWith("agent-1");
    });

    it("executePrayerDeactivateAll returns false when system missing", async () => {
      const { service } = createActiveService();
      const result = await service.executePrayerDeactivateAll();
      expect(result).toBe(false);
    });
  });

  describe("trading", () => {
    it("executeTradeRequest validates target", async () => {
      const { service } = createActiveService();
      expect(await service.executeTradeRequest("")).toBe(false);
    });

    it("executeTradeRequest emits event", async () => {
      const { service, world } = createActiveService();
      const result = await service.executeTradeRequest("player-1");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });
  });

  describe("utility", () => {
    it("executeFollow moves to target entity", async () => {
      const { service, entities, world } = createActiveService();
      entities.set("target-1", {
        data: {
          position: [100, 10, 100],
        },
        position: { x: 100, y: 10, z: 100 },
      });

      const result = await service.executeFollow("target-1");
      expect(result).toBe(true);
    });

    it("executeFollow returns false for nonexistent target", async () => {
      const { service } = createActiveService();
      const result = await service.executeFollow("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("inactive service", () => {
    it("all methods return false when not active", async () => {
      const { world } = createMockWorld();
      const service = new EmbeddedHyperscapeService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );

      expect(await service.executeBankOpen("bank-1")).toBe(false);
      expect(await service.executeStoreBuy("s", "i", 1)).toBe(false);
      expect(await service.executeCook("fish")).toBe(false);
      expect(await service.executeNpcInteract("npc")).toBe(false);
      expect(await service.executeUnequip("weapon")).toBe(false);
      expect(await service.executePrayerDeactivateAll()).toBe(false);
      expect(await service.executeTradeRequest("p")).toBe(false);
    });
  });
});
