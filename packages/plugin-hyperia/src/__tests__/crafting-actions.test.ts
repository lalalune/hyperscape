import { describe, expect, it, vi } from "vitest";

vi.mock("@elizaos/core", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  smeltOreAction,
  smithItemAction,
  fletchItemAction,
  tanHideAction,
  runecraftAction,
} from "../actions/crafting";

function createMockRuntime(overrides?: Record<string, unknown>) {
  const service = {
    isConnected: vi.fn().mockReturnValue(true),
    getPlayerEntity: vi.fn().mockReturnValue({
      position: [100, 10, 100] as [number, number, number],
      items: [
        { itemId: "copper_ore", name: "Copper ore", quantity: 1 },
        { itemId: "tin_ore", name: "Tin ore", quantity: 1 },
      ],
      equipment: {},
    }),
    getNearbyEntities: vi.fn().mockReturnValue([
      {
        id: "furnace-1",
        name: "Furnace",
        type: "furnace",
        entityType: "furnace",
        position: [102, 10, 100] as [number, number, number],
      },
      {
        id: "anvil-1",
        name: "Anvil",
        type: "anvil",
        entityType: "anvil",
        position: [104, 10, 100] as [number, number, number],
      },
    ]),
    executeMove: vi.fn().mockResolvedValue(undefined),
    interactWithEntity: vi.fn(),
    ...overrides,
  };

  return {
    getService: vi.fn().mockReturnValue(service),
    service,
  };
}

describe("crafting actions", () => {
  describe("smeltOreAction", () => {
    it("validates when connected with ore in inventory", async () => {
      const runtime = createMockRuntime();
      const result = await smeltOreAction.validate(runtime as never);
      expect(result).toBe(true);
    });

    it("fails validation when not connected", async () => {
      const runtime = createMockRuntime({
        isConnected: vi.fn().mockReturnValue(false),
      });
      const result = await smeltOreAction.validate(runtime as never);
      expect(result).toBe(false);
    });
  });

  describe("smithItemAction", () => {
    it("validates when connected with bars in inventory", async () => {
      const runtime = createMockRuntime();
      runtime.service.getPlayerEntity.mockReturnValue({
        position: [100, 10, 100],
        items: [{ itemId: "bronze_bar", name: "Bronze bar", quantity: 1 }],
        equipment: {},
      });
      const result = await smithItemAction.validate(runtime as never);
      expect(result).toBe(true);
    });
  });

  describe("fletchItemAction", () => {
    it("fails validation without knife and logs", async () => {
      const runtime = createMockRuntime();
      const result = await fletchItemAction.validate(runtime as never);
      expect(result).toBe(false);
    });

    it("validates with knife and logs in inventory", async () => {
      const runtime = createMockRuntime();
      runtime.service.getPlayerEntity.mockReturnValue({
        position: [100, 10, 100],
        items: [
          { itemId: "knife", name: "Knife", quantity: 1 },
          { itemId: "logs", name: "Logs", quantity: 1 },
        ],
        equipment: { weapon: { item: { itemId: "knife" } } },
      });
      const result = await fletchItemAction.validate(runtime as never);
      expect(result).toBe(true);
    });
  });

  describe("tanHideAction", () => {
    it("fails validation without hides", async () => {
      const runtime = createMockRuntime();
      const result = await tanHideAction.validate(runtime as never);
      expect(result).toBe(false);
    });
  });

  describe("runecraftAction", () => {
    it("fails validation without essence", async () => {
      const runtime = createMockRuntime();
      const result = await runecraftAction.validate(runtime as never);
      expect(result).toBe(false);
    });
  });
});
