/**
 * Social actions - CHAT_MESSAGE, WHISPER, LOCAL_CHAT
 * 
 * Supports multiple chat types:
 * - global: Broadcast to all players
 * - local: Only players within proximity
 * - whisper: Direct message to specific player
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

/**
 * Global chat action - broadcasts to all players
 */
export const chatMessageAction: Action = {
  name: "CHAT_MESSAGE",
  similes: ["CHAT", "SAY", "TALK", "SPEAK", "BROADCAST"],
  description: "Send a global chat message to all players in the world.",

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
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return {
        success: false,
        error: new Error("Hyperscape service not available"),
      };
    }
    const content = message.content.text || "";

    const command: ChatMessageCommand = { message: content, chatType: "global" };
    await service.executeChatMessage(command);

    await callback?.({ text: `Said: "${content}"`, action: "CHAT_MESSAGE" });

    return { success: true, text: `Sent message: ${content}` };
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

/**
 * Local chat action - only players within proximity can hear
 */
export const localChatAction: Action = {
  name: "LOCAL_CHAT",
  similes: ["SAY_NEARBY", "TALK_LOCAL", "SPEAK_LOCAL"],
  description: "Send a message to nearby players only (within proximity range).",

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
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return {
        success: false,
        error: new Error("Hyperscape service not available"),
      };
    }
    const content = message.content.text || "";

    const command: ChatMessageCommand = { message: content, chatType: "local" };
    await service.executeChatMessage(command);

    await callback?.({ text: `Said locally: "${content}"`, action: "LOCAL_CHAT" });

    return { success: true, text: `Said locally: ${content}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Say hello to nearby players" } },
      {
        name: "agent",
        content: { text: 'Said locally: "hello"', action: "LOCAL_CHAT" },
      },
    ],
  ],
};

/**
 * Whisper action - direct message to a specific player
 */
export const whisperAction: Action = {
  name: "WHISPER",
  similes: ["DM", "DIRECT_MESSAGE", "PRIVATE_MESSAGE", "PM", "TELL"],
  description: "Send a private message directly to a specific player.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) return false;
    return service.isConnected();
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
      return {
        success: false,
        error: new Error("Hyperscape service not available"),
      };
    }
    
    const content = message.content.text || "";
    const targetId = (options as { targetId?: string })?.targetId;
    
    if (!targetId) {
      await callback?.({ text: "Whisper requires a target player ID", error: true });
      return { success: false, error: new Error("No target specified") };
    }

    const command: ChatMessageCommand = { 
      message: content, 
      chatType: "whisper",
      targetId,
    };
    await service.executeChatMessage(command);

    await callback?.({ text: `Whispered to ${targetId}: "${content}"`, action: "WHISPER" });

    return { success: true, text: `Whispered: ${content}` };
  },

  examples: [
    [
      { name: "user", content: { text: "Whisper hello to player abc123" } },
      {
        name: "agent",
        content: { text: 'Whispered to abc123: "hello"', action: "WHISPER" },
      },
    ],
  ],
};

/** All social actions */
export const socialActions = [chatMessageAction, localChatAction, whisperAction];
