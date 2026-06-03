/**
 * Shopping actions for ElizaOS agents
 *
 * BUY_ITEM - Buy items from NPC shops (opens store, matches item, transacts)
 * SELL_ITEM - Sell items to NPC shops (opens store, sells item, closes)
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";
import type { Entity } from "../types.js";

function getDistance2D(
  posA: [number, number, number] | null | undefined,
  posB: [number, number, number] | null | undefined,
): number | null {
  if (!posA || !posB) return null;
  const dx = posA[0] - posB[0];
  const dz = posA[2] - posB[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function isShopkeeper(entity: Entity): boolean {
  const entityType = (entity.entityType || "").toLowerCase();
  const type = (entity.type || "").toLowerCase();
  const name = (entity.name || "").toLowerCase();
  return (
    entityType === "shopkeeper" ||
    entityType === "store" ||
    entityType === "npc" ||
    type === "npc" ||
    name.includes("shop") ||
    name.includes("store") ||
    name.includes("merchant") ||
    name.includes("trader")
  );
}

function findNearestShopkeeper(
  entities: Entity[],
  playerPos: [number, number, number],
): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = Infinity;

  for (const entity of entities) {
    if (!isShopkeeper(entity)) continue;
    const dist = getDistance2D(playerPos, entity.position);
    if (dist !== null && dist < nearestDist) {
      nearest = entity;
      nearestDist = dist;
    }
  }

  return nearest;
}

/** Extract the desired item name from the message text */
function extractItemName(text: string): string {
  // Strip common prefixes like "buy a", "buy me a", "purchase", etc.
  const cleaned = text
    .toLowerCase()
    .replace(/^(buy|purchase|get|grab)\s+(me\s+)?(a\s+|an\s+|some\s+)?/i, "")
    .replace(/^(sell|dump)\s+(my\s+)?(all\s+)?/i, "")
    .trim();
  return cleaned;
}

/** Match requested item name against store inventory */
function findStoreItem(
  storeItems: Array<{
    itemId?: string;
    id?: string;
    name?: string;
    price: number;
  }>,
  requestedName: string,
): { itemId: string; name: string; price: number } | null {
  const needle = requestedName.toLowerCase().replace(/\s+/g, "_");

  for (const item of storeItems) {
    const itemId = (item.itemId || item.id || "").toLowerCase();
    const itemName = (item.name || "").toLowerCase();

    // Exact match on id or name
    if (itemId === needle || itemName === requestedName.toLowerCase()) {
      return {
        itemId: item.itemId || item.id || "",
        name: item.name || itemId,
        price: item.price,
      };
    }

    // Partial match (e.g. "fishing rod" matches "fishing_rod")
    if (
      itemId.includes(needle) ||
      needle.includes(itemId) ||
      itemName.includes(requestedName.toLowerCase()) ||
      requestedName.toLowerCase().includes(itemName)
    ) {
      return {
        itemId: item.itemId || item.id || "",
        name: item.name || itemId,
        price: item.price,
      };
    }
  }

  return null;
}

/** Wait for store state to arrive after opening */
async function waitForStoreState(
  service: HyperiaService,
  timeoutMs = 3000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (service.getCachedStoreState()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export const buyItemAction: Action = {
  name: "BUY_ITEM",
  similes: ["PURCHASE", "BUY_FROM_SHOP", "SHOP_BUY"],
  description:
    "Buy an item from a nearby NPC shop. Requires coins and a shopkeeper nearby.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position || player.inCombat) return false;
    if ((player.coins ?? 0) <= 0) return false;

    const nearbyEntities = service.getNearbyEntities();
    const shop = findNearestShopkeeper(nearbyEntities, player.position);
    return shop !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      const nearbyEntities = service.getNearbyEntities();
      const shopkeeper = findNearestShopkeeper(nearbyEntities, player.position);
      if (!shopkeeper) {
        await callback?.({ text: "No shop nearby.", action: "BUY_ITEM" });
        return { success: false, error: "No shop nearby" };
      }

      // Walk to shopkeeper if too far
      const distance = getDistance2D(player.position, shopkeeper.position);
      if (distance !== null && distance > 8) {
        await service.executeMove({
          target: shopkeeper.position,
          runMode: false,
        });
        await service.waitForMovementComplete(10000);
      }

      // Open store via server protocol
      const npcId = shopkeeper.name || shopkeeper.id;
      service.storeOpen(npcId, shopkeeper.id);

      // Wait for storeState packet
      const gotStore = await waitForStoreState(service);
      if (!gotStore) {
        logger.warn("[BUY_ITEM] Timed out waiting for store state");
        await callback?.({
          text: "Shop didn't respond in time.",
          action: "BUY_ITEM",
        });
        return { success: false, error: "Store state timeout" };
      }

      const storeState = service.getCachedStoreState();
      if (!storeState) {
        await callback?.({
          text: "Could not read shop inventory.",
          action: "BUY_ITEM",
        });
        return { success: false, error: "No store state" };
      }

      // Match requested item
      const text = message.content.text || "";
      const requestedName = extractItemName(text);
      const match = findStoreItem(storeState.items, requestedName);

      if (!match) {
        service.storeClose();
        const itemList = storeState.items
          .slice(0, 5)
          .map((i) => i.name || i.itemId || i.id)
          .join(", ");
        await callback?.({
          text: `Couldn't find "${requestedName}" in ${storeState.storeName}. Available: ${itemList}...`,
          action: "BUY_ITEM",
        });
        return {
          success: false,
          error: `Item "${requestedName}" not found in store`,
        };
      }

      // Check if player can afford it
      const coins = player.coins ?? 0;
      if (coins < match.price) {
        service.storeClose();
        await callback?.({
          text: `Can't afford ${match.name} (costs ${match.price} coins, have ${coins}).`,
          action: "BUY_ITEM",
        });
        return { success: false, error: "Insufficient coins" };
      }

      // Execute purchase
      service.storeBuy(storeState.storeId, match.itemId, 1);
      await new Promise((r) => setTimeout(r, 300));

      // Verify purchase via inventory update
      const verified = await service.waitForInventoryUpdate(2000);
      if (!verified) {
        logger.warn("[BUY_ITEM] Inventory update not received after purchase");
      }

      service.storeClose();

      const responseText = `Bought ${match.name} for ${match.price} coins from ${storeState.storeName}.`;
      await callback?.({ text: responseText, action: "BUY_ITEM" });
      logger.info(`[BUY_ITEM] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: {
          action: "BUY_ITEM",
          shopName: storeState.storeName,
          itemId: match.itemId,
          itemName: match.name,
          price: match.price,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[BUY_ITEM] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Buy a fishing rod" } },
      {
        name: "agent",
        content: {
          text: "Bought Fishing Rod for 5 coins from General Store.",
          action: "BUY_ITEM",
        },
      },
    ],
  ],
};

export const sellItemAction: Action = {
  name: "SELL_ITEM",
  similes: ["SELL", "SELL_TO_SHOP", "SHOP_SELL"],
  description:
    "Sell items to a nearby NPC shop for coins. Requires items in inventory and a shopkeeper nearby.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperiaService>("hyperiaService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    if (!player?.position || player.inCombat) return false;
    if ((player.items?.length ?? 0) === 0) return false;

    const nearbyEntities = service.getNearbyEntities();
    const shop = findNearestShopkeeper(nearbyEntities, player.position);
    return shop !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    try {
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (!service) return { success: false, error: "Service not available" };

      const player = service.getPlayerEntity();
      if (!player?.position)
        return { success: false, error: "No player position" };

      const nearbyEntities = service.getNearbyEntities();
      const shopkeeper = findNearestShopkeeper(nearbyEntities, player.position);
      if (!shopkeeper) {
        await callback?.({ text: "No shop nearby.", action: "SELL_ITEM" });
        return { success: false, error: "No shop nearby" };
      }

      // Walk to shopkeeper if too far
      const distance = getDistance2D(player.position, shopkeeper.position);
      if (distance !== null && distance > 8) {
        await service.executeMove({
          target: shopkeeper.position,
          runMode: false,
        });
        await service.waitForMovementComplete(10000);
      }

      // Open store
      const npcId = shopkeeper.name || shopkeeper.id;
      service.storeOpen(npcId, shopkeeper.id);

      const gotStore = await waitForStoreState(service);
      if (!gotStore) {
        logger.warn("[SELL_ITEM] Timed out waiting for store state");
        await callback?.({
          text: "Shop didn't respond in time.",
          action: "SELL_ITEM",
        });
        return { success: false, error: "Store state timeout" };
      }

      const storeState = service.getCachedStoreState();
      if (!storeState) {
        await callback?.({
          text: "Could not read shop inventory.",
          action: "SELL_ITEM",
        });
        return { success: false, error: "No store state" };
      }

      // Determine what to sell from message context
      const text = message.content.text || "";
      const requestedName = extractItemName(text);
      const inventory = player.items || [];

      // Find matching item in inventory
      const invItem = inventory.find(
        (item: { name?: string; itemId?: string }) => {
          const name = (item.name || item.itemId || "").toLowerCase();
          return name.includes(requestedName) || requestedName.includes(name);
        },
      ) as { name?: string; itemId?: string; quantity?: number } | undefined;

      if (!invItem) {
        service.storeClose();
        await callback?.({
          text: `Don't have "${requestedName}" in inventory to sell.`,
          action: "SELL_ITEM",
        });
        return {
          success: false,
          error: `Item "${requestedName}" not in inventory`,
        };
      }

      const itemId = invItem.itemId || invItem.name || "";
      const qty = invItem.quantity ?? 1;

      // Sell the item
      service.storeSell(storeState.storeId, itemId, qty);
      await new Promise((r) => setTimeout(r, 300));

      // Verify via inventory update
      const verified = await service.waitForInventoryUpdate(2000);
      if (!verified) {
        logger.warn("[SELL_ITEM] Inventory update not received after sale");
      }

      service.storeClose();

      const responseText = `Sold ${qty}x ${invItem.name || itemId} at ${storeState.storeName}.`;
      await callback?.({ text: responseText, action: "SELL_ITEM" });
      logger.info(`[SELL_ITEM] ${responseText}`);

      return {
        success: true,
        text: responseText,
        data: {
          action: "SELL_ITEM",
          shopName: storeState.storeName,
          itemId,
          quantity: qty,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[SELL_ITEM] Failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Sell my extra logs" } },
      {
        name: "agent",
        content: {
          text: "Sold 5x Logs at General Store.",
          action: "SELL_ITEM",
        },
      },
    ],
  ],
};

export const shoppingActions = [buyItemAction, sellItemAction];
