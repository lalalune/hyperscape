/**
 * Social actions - CHAT_MESSAGE
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { ChatMessageCommand } from "../types.js";

export const chatMessageAction: Action = {
  name: "CHAT_MESSAGE",
  similes: ["CHAT", "SAY", "TALK", "SPEAK"],
  description: "Send a chat message to nearby players.",

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

      const command: ChatMessageCommand = { message: content };
      await service.executeChatMessage(command);

      await callback?.({ text: `Said: "${content}"`, action: "CHAT_MESSAGE" });

      return { success: true, text: `Sent message: ${content}` };
    } catch (error) {
      await callback?.({
        text: `Failed to send message: ${error instanceof Error ? error.message : ""}`,
        error: true,
      });
      return { success: false, error: error as Error };
    }
  },

  examples: [
    [
      { name: "user", content: { text: "Say hello to everyone" } },
      {
        name: "agent",
        content: { text: 'Said: "hello to everyone"', action: "CHAT_MESSAGE" },
      },
    ],
  ],
};
