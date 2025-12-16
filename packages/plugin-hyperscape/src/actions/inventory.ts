/**
 * Inventory actions - EQUIP_ITEM, UNEQUIP_ITEM, USE_ITEM, DROP_ITEM
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { EquipItemCommand, UseItemCommand, DropItemCommand, Equipment } from "../types.js";

/** Equipment slot type */
type EquipSlot = keyof Equipment;

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

export const unequipItemAction: Action = {
  name: "UNEQUIP_ITEM",
  similes: ["UNEQUIP", "REMOVE_EQUIPMENT", "UNWIELD", "TAKE_OFF"],
  description: "Unequip a currently equipped item (weapon, armor, etc.).",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();
    if (!service.isConnected()) return false;

    // Check if player has any equipped items
    const equipment = playerEntity?.equipment;
    if (!equipment) return false;

    const hasEquipped = Object.values(equipment).some((v) => v !== null);
    return hasEquipped;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { slot?: EquipSlot },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Hyperscape service not available") };
    }
    const playerEntity = service.getPlayerEntity();
    const content = message.content.text || "";

    // Determine which slot to unequip
    let slot: EquipSlot | undefined = options?.slot;

    if (!slot) {
      const contentLower = content.toLowerCase();
      if (contentLower.includes("weapon") || contentLower.includes("sword") || contentLower.includes("axe")) {
        slot = "weapon";
      } else if (contentLower.includes("shield")) {
        slot = "shield";
      } else if (contentLower.includes("helmet") || contentLower.includes("helm")) {
        slot = "helmet";
      } else if (contentLower.includes("body") || contentLower.includes("chest") || contentLower.includes("armor")) {
        slot = "body";
      } else if (contentLower.includes("legs") || contentLower.includes("pants")) {
        slot = "legs";
      } else if (contentLower.includes("boots") || contentLower.includes("feet")) {
        slot = "boots";
      }
    }

    if (!slot) {
      await callback?.({ text: "Could not determine which slot to unequip. Specify: weapon, shield, helmet, body, legs, or boots.", error: true });
      return { success: false, error: new Error("Slot not specified") };
    }

    const equipped = playerEntity?.equipment[slot];
    if (!equipped) {
      await callback?.({ text: `No item equipped in ${slot} slot.`, error: true });
      return { success: false, error: new Error(`Nothing equipped in ${slot}`) };
    }

    logger.info(`[UNEQUIP_ITEM] Unequipping ${slot}: ${equipped}`);
    await service.executeUnequipItem(slot);

    await callback?.({ text: `Unequipped ${equipped} from ${slot}`, action: "UNEQUIP_ITEM" });
    return { success: true, text: `Unequipped ${equipped}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Unequip weapon" } },
      {
        name: "agent",
        content: { text: "Unequipped Bronze Sword from weapon", action: "UNEQUIP_ITEM" },
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

      const command: DropItemCommand = { itemId: item.id, quantity: item.quantity };
      await service.executeDropItem(command);

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
