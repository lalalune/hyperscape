/**
 * Banking actions - BANK_DEPOSIT, BANK_WITHDRAW, BANK_DEPOSIT_ALL, BANK_DEPOSIT_COINS, BANK_WITHDRAW_COINS
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

/** Check if player is near a bank booth/banker NPC */
function hasBankNearby(entities: Entity[]): boolean {
  return entities.some((e) => {
    const name = e.name?.toLowerCase() || "";
    return name.includes("bank") || name.includes("banker");
  });
}

export const bankDepositAction: Action = {
  name: "BANK_DEPOSIT",
  similes: ["DEPOSIT", "BANK_ITEM"],
  description: "Deposit a specific item into the bank. Must be near a bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    if ((player?.items?.length ?? 0) === 0) return false;
    return hasBankNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { itemId?: string; quantity?: number },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const player = service.getPlayerEntity();
    const content = message.content.text || "";

    let itemId = options?.itemId;
    let itemName = "item";
    if (!itemId) {
      const item = player?.items.find((i) =>
        i.name.toLowerCase().includes(content.toLowerCase()),
      );
      if (item) {
        itemId = item.id;
        itemName = item.name;
      }
    }

    if (!itemId) {
      await callback?.({ text: "Item not found in inventory.", error: true });
      return { success: false, error: new Error("Item not found") };
    }

    const quantity = options?.quantity || 1;
    logger.info(`[BANK_DEPOSIT] Depositing ${quantity}x ${itemId}`);
    await service.executeBankDeposit(itemId, quantity);

    await callback?.({
      text: `Deposited ${quantity}x ${itemName}`,
      action: "BANK_DEPOSIT",
    });
    return { success: true, text: `Deposited ${quantity}x ${itemName}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Deposit my logs" } },
      {
        name: "agent",
        content: { text: "Deposited 1x Oak Logs", action: "BANK_DEPOSIT" },
      },
    ],
  ],
};

export const bankWithdrawAction: Action = {
  name: "BANK_WITHDRAW",
  similes: ["WITHDRAW", "TAKE_FROM_BANK"],
  description: "Withdraw a specific item from the bank. Must be near a bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    return hasBankNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { itemId?: string; quantity?: number },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const itemId = options?.itemId || message.content.text || "";
    const quantity = options?.quantity || 1;

    if (!itemId) {
      await callback?.({ text: "Specify item to withdraw.", error: true });
      return { success: false, error: new Error("No item specified") };
    }

    logger.info(`[BANK_WITHDRAW] Withdrawing ${quantity}x ${itemId}`);
    await service.executeBankWithdraw(itemId, quantity);

    await callback?.({
      text: `Withdrew ${quantity}x ${itemId}`,
      action: "BANK_WITHDRAW",
    });
    return { success: true, text: `Withdrew ${quantity}x ${itemId}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Withdraw axe" } },
      {
        name: "agent",
        content: { text: "Withdrew 1x axe", action: "BANK_WITHDRAW" },
      },
    ],
  ],
};

export const bankDepositAllAction: Action = {
  name: "BANK_DEPOSIT_ALL",
  similes: ["DEPOSIT_ALL", "BANK_ALL_ITEMS"],
  description:
    "Deposit all items from inventory into the bank. Must be near a bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    if ((player?.items?.length ?? 0) === 0) return false;
    return hasBankNearby(service.getNearbyEntities());
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

    const player = service.getPlayerEntity();
    const itemCount = player?.items?.length ?? 0;

    logger.info(`[BANK_DEPOSIT_ALL] Depositing all ${itemCount} items`);
    await service.executeBankDepositAll();

    await callback?.({
      text: `Deposited all items (${itemCount})`,
      action: "BANK_DEPOSIT_ALL",
    });
    return { success: true, text: `Deposited all items` };
  },

  examples: [
    [
      { name: "user", content: { text: "Deposit everything" } },
      {
        name: "agent",
        content: {
          text: "Deposited all items (5)",
          action: "BANK_DEPOSIT_ALL",
        },
      },
    ],
  ],
};

export const bankDepositCoinsAction: Action = {
  name: "BANK_DEPOSIT_COINS",
  similes: ["DEPOSIT_GOLD", "BANK_COINS", "BANK_GOLD"],
  description: "Deposit coins/gold into the bank. Must be near a bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    const player = service.getPlayerEntity();
    if ((player?.coins ?? 0) === 0) return false;
    return hasBankNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { amount?: number },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const player = service.getPlayerEntity();
    const maxCoins = player?.coins ?? 0;

    // Parse amount from options or message
    let amount = options?.amount;
    if (!amount) {
      const match = message.content.text?.match(/(\d+)/);
      amount = match ? parseInt(match[1], 10) : maxCoins;
    }
    amount = Math.min(amount, maxCoins);

    if (amount <= 0) {
      await callback?.({ text: "No coins to deposit.", error: true });
      return { success: false, error: new Error("No coins") };
    }

    logger.info(`[BANK_DEPOSIT_COINS] Depositing ${amount} coins`);
    await service.executeBankDepositCoins(amount);

    await callback?.({
      text: `Deposited ${amount} coins`,
      action: "BANK_DEPOSIT_COINS",
    });
    return { success: true, text: `Deposited ${amount} coins` };
  },

  examples: [
    [
      { name: "user", content: { text: "Deposit 500 gold" } },
      {
        name: "agent",
        content: { text: "Deposited 500 coins", action: "BANK_DEPOSIT_COINS" },
      },
    ],
  ],
};

export const bankWithdrawCoinsAction: Action = {
  name: "BANK_WITHDRAW_COINS",
  similes: ["WITHDRAW_GOLD", "GET_COINS", "GET_GOLD"],
  description: "Withdraw coins/gold from the bank. Must be near a bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;
    return hasBankNearby(service.getNearbyEntities());
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { amount?: number },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    // Parse amount from options or message
    let amount = options?.amount;
    if (!amount) {
      const match = message.content.text?.match(/(\d+)/);
      amount = match ? parseInt(match[1], 10) : 1;
    }

    if (amount <= 0) {
      await callback?.({ text: "Specify amount to withdraw.", error: true });
      return { success: false, error: new Error("Invalid amount") };
    }

    logger.info(`[BANK_WITHDRAW_COINS] Withdrawing ${amount} coins`);
    await service.executeBankWithdrawCoins(amount);

    await callback?.({
      text: `Withdrew ${amount} coins`,
      action: "BANK_WITHDRAW_COINS",
    });
    return { success: true, text: `Withdrew ${amount} coins` };
  },

  examples: [
    [
      { name: "user", content: { text: "Withdraw 100 gold" } },
      {
        name: "agent",
        content: { text: "Withdrew 100 coins", action: "BANK_WITHDRAW_COINS" },
      },
    ],
  ],
};
