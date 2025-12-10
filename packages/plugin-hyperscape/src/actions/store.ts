/**
 * Store actions - BUY_ITEM, SELL_ITEM
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
import type { Entity } from "../types.js";

/** Check if any store/shop NPCs are nearby */
function hasStoreNearby(entities: Entity[]): boolean {
  return entities.some((e) => {
    const name = e.name?.toLowerCase() || "";
    return name.includes("shop") || name.includes("store") || name.includes("merchant") || name.includes("vendor");
  });
}

/**
 * BUY_ITEM - Purchase an item from a store
 */
export const buyItemAction: Action = {
  name: "BUY_ITEM",
  similes: ["BUY", "PURCHASE", "BUY_FROM_STORE"],
  description: "Buy an item from a store. Must be near a store NPC.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.alive) return false;

    return hasStoreNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { itemId?: string; quantity?: number; storeId?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const content = message.content.text || "";
    const itemId = options?.itemId || content.toLowerCase();
    const quantity = options?.quantity || 1;

    logger.info(`[BUY_ITEM] Attempting to buy ${quantity}x ${itemId}`);

    // Execute the store buy command
    await service.executeStoreBuy(itemId, quantity);

    await callback?.({
      text: `Buying ${quantity}x ${itemId}`,
      action: "BUY_ITEM",
    });

    return {
      success: true,
      text: `Bought ${quantity}x ${itemId}`,
      data: { action: "BUY_ITEM", itemId, quantity },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Buy a bronze sword" } },
      {
        name: "agent",
        content: {
          text: "Attempting to buy 1x bronze_sword",
          action: "BUY_ITEM",
        },
      },
    ],
  ],
};

/**
 * SELL_ITEM - Sell an item to a store
 */
export const sellItemAction: Action = {
  name: "SELL_ITEM",
  similes: ["SELL", "SELL_TO_STORE"],
  description: "Sell an item from inventory to a store. Must be near a store NPC.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    if (!player.items || player.items.length === 0) return false;

    return hasStoreNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { itemId?: string; quantity?: number; storeId?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const player = service.getPlayerEntity();
    const content = message.content.text || "";

    // Find item in inventory
    let itemId = options?.itemId;
    if (!itemId) {
      const item = player?.items.find((i) =>
        i.name.toLowerCase().includes(content.toLowerCase()),
      );
      if (item) {
        itemId = item.id;
      }
    }

    if (!itemId) {
      await callback?.({ text: "Item not found in inventory.", error: true });
      return { success: false, error: new Error("Item not found") };
    }

    const quantity = options?.quantity || 1;

    logger.info(`[SELL_ITEM] Attempting to sell ${quantity}x ${itemId}`);

    // Execute the store sell command
    await service.executeStoreSell(itemId, quantity);

    await callback?.({
      text: `Selling ${quantity}x ${itemId}`,
      action: "SELL_ITEM",
    });

    return {
      success: true,
      text: `Sold ${quantity}x ${itemId}`,
      data: { action: "SELL_ITEM", itemId, quantity },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Sell the logs" } },
      {
        name: "agent",
        content: {
          text: "Attempting to sell 1x oak_logs",
          action: "SELL_ITEM",
        },
      },
    ],
  ],
};

