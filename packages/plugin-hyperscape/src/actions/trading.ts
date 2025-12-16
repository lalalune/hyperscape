/**
 * Trading actions - Player-to-player trading system
 *
 * Actions: TRADE_REQUEST, TRADE_RESPOND, TRADE_OFFER, TRADE_CONFIRM, TRADE_CANCEL
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

/** Check if target player is nearby */
function findNearbyPlayer(
  entities: Entity[],
  targetNameOrId: string,
): Entity | null {
  const search = targetNameOrId.toLowerCase();
  return (
    entities.find((e) => {
      const name = e.name?.toLowerCase() || "";
      const id = e.id?.toLowerCase() || "";
      const isPlayer = "playerName" in e || "playerId" in e;
      return isPlayer && (name.includes(search) || id.includes(search));
    }) ?? null
  );
}

/** Check if any players are nearby */
function hasPlayersNearby(entities: Entity[]): boolean {
  return entities.some((e) => "playerName" in e || "playerId" in e);
}

export const tradeRequestAction: Action = {
  name: "TRADE_REQUEST",
  similes: ["TRADE", "START_TRADE", "TRADE_WITH", "INITIATE_TRADE"],
  description:
    "Request to trade with another player. Must be near the target player.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    return hasPlayersNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { targetId?: string; targetName?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const content = message.content.text || "";
    let targetId = options?.targetId;
    let targetName = options?.targetName || content;

    // Find target player
    if (!targetId) {
      const target = findNearbyPlayer(service.getNearbyEntities(), targetName);
      if (target) {
        targetId = target.id;
        targetName = target.name;
      }
    }

    if (!targetId) {
      await callback?.({
        text: "Could not find player to trade with.",
        error: true,
      });
      return { success: false, error: new Error("Player not found") };
    }

    logger.info(
      `[TRADE_REQUEST] Requesting trade with ${targetName} (${targetId})`,
    );
    await service.executeTradeRequest(targetId);

    await callback?.({
      text: `Requested trade with ${targetName}`,
      action: "TRADE_REQUEST",
    });
    return { success: true, text: `Requested trade with ${targetName}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Trade with Bob" } },
      {
        name: "agent",
        content: { text: "Requested trade with Bob", action: "TRADE_REQUEST" },
      },
    ],
    [
      { name: "user", content: { text: "Start a trade with that player" } },
      {
        name: "agent",
        content: {
          text: "Requested trade with Player123",
          action: "TRADE_REQUEST",
        },
      },
    ],
  ],
};

export const tradeRespondAction: Action = {
  name: "TRADE_RESPOND",
  similes: ["ACCEPT_TRADE", "DECLINE_TRADE", "TRADE_RESPONSE"],
  description: "Accept or decline a trade request from another player.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    return player?.alive === true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { accept?: boolean; requesterId?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const content = (message.content.text || "").toLowerCase();

    // Determine if accepting or declining
    const accept =
      options?.accept ??
      (content.includes("accept") ||
        content.includes("yes") ||
        content.includes("ok") ||
        (!content.includes("decline") &&
          !content.includes("reject") &&
          !content.includes("no")));

    const requesterId = options?.requesterId || "";

    logger.info(
      `[TRADE_RESPOND] ${accept ? "Accepting" : "Declining"} trade request`,
    );
    await service.executeTradeResponse(accept, requesterId);

    const responseText = accept
      ? "Accepted trade request"
      : "Declined trade request";
    await callback?.({ text: responseText, action: "TRADE_RESPOND" });
    return { success: true, text: responseText };
  },

  examples: [
    [
      { name: "user", content: { text: "Accept the trade" } },
      {
        name: "agent",
        content: { text: "Accepted trade request", action: "TRADE_RESPOND" },
      },
    ],
    [
      { name: "user", content: { text: "Decline the trade request" } },
      {
        name: "agent",
        content: { text: "Declined trade request", action: "TRADE_RESPOND" },
      },
    ],
  ],
};

export const tradeOfferAction: Action = {
  name: "TRADE_OFFER",
  similes: ["OFFER_ITEM", "OFFER_TRADE", "ADD_TO_TRADE", "OFFER_COINS"],
  description: "Offer items or coins in the current trade window.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    if (!player?.alive) return false;
    // Must have items or coins to offer
    return (player.items?.length ?? 0) > 0 || (player.coins ?? 0) > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: {
      itemId?: string;
      itemName?: string;
      quantity?: number;
      coins?: number;
    },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const player = service.getPlayerEntity();
    const content = message.content.text || "";

    // Build offer
    const items: Array<{ itemId: string; quantity: number }> = [];
    let coins = options?.coins ?? 0;

    // Parse coins from message
    const coinMatch = content.match(/(\d+)\s*(?:coins?|gold|gp)/i);
    if (coinMatch) {
      coins = parseInt(coinMatch[1], 10);
    }

    // Find item to offer
    let itemId = options?.itemId;
    let itemName = options?.itemName || "";
    let quantity = options?.quantity ?? 1;

    if (!itemId && content) {
      // Parse quantity
      const qtyMatch = content.match(/(\d+)x?\s+/);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
      }

      // Find item in inventory
      const item = player?.items?.find((i) =>
        i.name
          .toLowerCase()
          .includes(content.toLowerCase().replace(/\d+x?\s*/, "")),
      );
      if (item) {
        itemId = item.id;
        itemName = item.name;
        quantity = Math.min(quantity, item.quantity);
      }
    }

    if (itemId) {
      items.push({ itemId, quantity });
    }

    if (items.length === 0 && coins === 0) {
      await callback?.({ text: "Nothing specified to offer.", error: true });
      return { success: false, error: new Error("No offer specified") };
    }

    logger.info(
      `[TRADE_OFFER] Offering ${items.length} items and ${coins} coins`,
    );
    await service.executeTradeOffer(items, coins);

    const offerDesc = [
      items.length > 0 ? `${quantity}x ${itemName || "item"}` : "",
      coins > 0 ? `${coins} coins` : "",
    ]
      .filter(Boolean)
      .join(" and ");

    await callback?.({ text: `Offered ${offerDesc}`, action: "TRADE_OFFER" });
    return { success: true, text: `Offered ${offerDesc}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Offer 5 logs" } },
      {
        name: "agent",
        content: { text: "Offered 5x Oak Logs", action: "TRADE_OFFER" },
      },
    ],
    [
      { name: "user", content: { text: "Offer 100 coins" } },
      {
        name: "agent",
        content: { text: "Offered 100 coins", action: "TRADE_OFFER" },
      },
    ],
  ],
};

export const tradeConfirmAction: Action = {
  name: "TRADE_CONFIRM",
  similes: [
    "CONFIRM_TRADE",
    "ACCEPT_OFFER",
    "FINALIZE_TRADE",
    "COMPLETE_TRADE",
  ],
  description:
    "Confirm your trade offer. Both players must confirm for trade to complete.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    return player?.alive === true;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    logger.info(`[TRADE_CONFIRM] Confirming trade`);
    await service.executeTradeConfirm();

    await callback?.({
      text: "Confirmed trade offer",
      action: "TRADE_CONFIRM",
    });
    return { success: true, text: "Confirmed trade offer" };
  },

  examples: [
    [
      { name: "user", content: { text: "Confirm the trade" } },
      {
        name: "agent",
        content: { text: "Confirmed trade offer", action: "TRADE_CONFIRM" },
      },
    ],
  ],
};

export const tradeCancelAction: Action = {
  name: "TRADE_CANCEL",
  similes: ["CANCEL_TRADE", "ABORT_TRADE", "EXIT_TRADE", "CLOSE_TRADE"],
  description: "Cancel the current trade.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    return player?.alive === true;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    logger.info(`[TRADE_CANCEL] Cancelling trade`);
    await service.executeTradeCancel();

    await callback?.({ text: "Cancelled trade", action: "TRADE_CANCEL" });
    return { success: true, text: "Cancelled trade" };
  },

  examples: [
    [
      { name: "user", content: { text: "Cancel the trade" } },
      {
        name: "agent",
        content: { text: "Cancelled trade", action: "TRADE_CANCEL" },
      },
    ],
  ],
};
