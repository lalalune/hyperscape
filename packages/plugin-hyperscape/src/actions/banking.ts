/**
 * Banking actions - BANK_DEPOSIT, BANK_WITHDRAW
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { BankCommand } from "../types.js";

export const bankDepositAction: Action = {
  name: "BANK_DEPOSIT",
  similes: ["DEPOSIT", "BANK_ITEMS", "STORE"],
  description: "Deposit items or coins into the bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    const playerEntity = service.getPlayerEntity();

    return (
      service.isConnected() &&
      ((playerEntity?.items.length ?? 0) > 0 || (playerEntity?.coins ?? 0) > 0)
    );
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

      const command: BankCommand = {
        action: "deposit",
        itemId: item?.id,
        amount: item?.quantity || 1,
      };

      await service.executeBankAction(command);

      await callback?.({
        text: `Deposited ${item ? item.name : "items"}`,
        action: "BANK_DEPOSIT",
      });

      return { success: true, text: `Deposited ${item ? item.name : "items"}` };
    } catch (error) {
      await callback?.({
        text: `Failed to deposit: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Deposit all logs" } },
      {
        name: "agent",
        content: { text: "Deposited Logs", action: "BANK_DEPOSIT" },
      },
    ],
  ],
};

export const bankWithdrawAction: Action = {
  name: "BANK_WITHDRAW",
  similes: ["WITHDRAW", "TAKE_FROM_BANK"],
  description: "Withdraw items or coins from the bank.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    return service.isConnected();
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
      const content = message.content.text || "";

      const command: BankCommand = {
        action: "withdraw",
        itemId: undefined, // Would need to lookup from bank
        amount: 1,
      };

      await service.executeBankAction(command);

      await callback?.({
        text: `Withdrew items from bank`,
        action: "BANK_WITHDRAW",
      });

      return { success: true, text: `Withdrew items` };
    } catch (error) {
      await callback?.({
        text: `Failed to withdraw: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Withdraw axe" } },
      {
        name: "agent",
        content: { text: "Withdrew items from bank", action: "BANK_WITHDRAW" },
      },
    ],
  ],
};
