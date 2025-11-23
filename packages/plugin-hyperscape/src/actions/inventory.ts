/**
 * Inventory actions - EQUIP_ITEM, USE_ITEM, DROP_ITEM
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { EquipItemCommand, UseItemCommand, Equipment } from "../types.js";

export const equipItemAction: Action = {
  name: "EQUIP_ITEM",
  similes: ["EQUIP", "WIELD", "WEAR"],
  description: "Equip a weapon or armor from inventory.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    return service.isConnected() && (playerEntity?.items.length ?? 0) > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const playerEntity = service.getPlayerEntity();
      const content = message.content.text || "";

      const item = playerEntity?.items.find((i) =>
        i.name.toLowerCase().includes(content.toLowerCase()),
      );

      if (!item) {
        await callback?.({ text: "Item not found in inventory.", error: true });
        return { success: false };
      }

      // Determine equip slot based on item name
      let equipSlot: keyof Equipment = "weapon";
      if (item.name.toLowerCase().includes("shield")) equipSlot = "shield";
      else if (item.name.toLowerCase().includes("helmet")) equipSlot = "helmet";
      else if (
        item.name.toLowerCase().includes("body") ||
        item.name.toLowerCase().includes("platebody")
      )
        equipSlot = "body";
      else if (item.name.toLowerCase().includes("legs")) equipSlot = "legs";
      else if (item.name.toLowerCase().includes("boots")) equipSlot = "boots";

      const command: EquipItemCommand = { itemId: item.id, equipSlot };
      await service.executeEquipItem(command);

      await callback?.({ text: `Equipped ${item.name}`, action: "EQUIP_ITEM" });

      return { success: true, text: `Equipped ${item.name}` };
    } catch (error) {
      await callback?.({
        text: `Failed to equip: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Equip bronze sword" } },
      {
        name: "agent",
        content: { text: "Equipped Bronze Sword", action: "EQUIP_ITEM" },
      },
    ],
  ],
};

export const useItemAction: Action = {
  name: "USE_ITEM",
  similes: ["EAT", "DRINK", "CONSUME"],
  description: "Use an item from inventory (eat food, drink potion, etc.).",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    return service.isConnected() && (playerEntity?.items.length ?? 0) > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const playerEntity = service.getPlayerEntity();
      const content = message.content.text || "";

      const item = playerEntity?.items.find((i) =>
        i.name.toLowerCase().includes(content.toLowerCase()),
      );

      if (!item) {
        await callback?.({ text: "Item not found in inventory.", error: true });
        return { success: false };
      }

      const command: UseItemCommand = { itemId: item.id };
      await service.executeUseItem(command);

      await callback?.({ text: `Used ${item.name}`, action: "USE_ITEM" });

      return { success: true, text: `Used ${item.name}` };
    } catch (error) {
      await callback?.({
        text: `Failed to use item: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Eat the bread" } },
      { name: "agent", content: { text: "Used Bread", action: "USE_ITEM" } },
    ],
  ],
};

export const dropItemAction: Action = {
  name: "DROP_ITEM",
  similes: ["DROP", "DISCARD"],
  description: "Drop an item from inventory.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    return service.isConnected() && (playerEntity?.items.length ?? 0) > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    try {
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (!service) {
        return {
          success: false,
          error: new Error("Hyperscape service not available"),
        };
      }
      const playerEntity = service.getPlayerEntity();
      const content = message.content.text || "";

      const item = playerEntity?.items.find((i) =>
        i.name.toLowerCase().includes(content.toLowerCase()),
      );

      if (!item) {
        await callback?.({ text: "Item not found in inventory.", error: true });
        return { success: false };
      }

      const command: UseItemCommand = { itemId: item.id };
      await service.executeUseItem(command); // Assumes dropping uses similar command

      await callback?.({ text: `Dropped ${item.name}`, action: "DROP_ITEM" });

      return { success: true, text: `Dropped ${item.name}` };
    } catch (error) {
      await callback?.({
        text: `Failed to drop: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Drop the junk" } },
      { name: "agent", content: { text: "Dropped Junk", action: "DROP_ITEM" } },
    ],
  ],
};
