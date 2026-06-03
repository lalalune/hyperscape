/**
 * localChatProvider - Supplies recent chat messages from nearby players
 *
 * Provides:
 * - Recent chat messages within 50m radius
 * - Sender name, message text, distance, and time ago
 * - Last 10 messages, newest first
 *
 * This enables agents to see and respond to nearby player chat,
 * creating a more social and immersive experience.
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperiaService } from "../services/HyperiaService.js";

/**
 * Structure for a local chat message
 */
export interface LocalChatMessage {
  from: string; // Player/agent name
  fromId: string; // Player/agent ID
  text: string; // Message content
  timestamp: number; // When message was received
  distance: number; // Distance from agent when received
}

/**
 * Format time difference in human-readable form
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return "a while ago";
}

/**
 * Format distance in human-readable form
 */
function formatDistance(distance: number): string {
  if (distance < 5) return "right next to you";
  if (distance < 15) return `${Math.round(distance)}m away`;
  if (distance < 30) return `${Math.round(distance)}m away`;
  return `${Math.round(distance)}m away`;
}

export const localChatProvider: Provider = {
  name: "localChat",
  description:
    "Provides recent chat messages from nearby players and agents within 50m",
  dynamic: true,
  position: 8, // After most other providers but available for social decisions

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperiaService>("hyperiaService");

    // Get local chat messages from service
    // This method will be implemented in EmbeddedHyperiaService and HyperiaService
    const localMessages: LocalChatMessage[] =
      (
        service as { getLocalChatMessages?: () => LocalChatMessage[] }
      )?.getLocalChatMessages?.() || [];

    // No messages to report
    if (localMessages.length === 0) {
      return {
        text: "## Nearby Chat\n\n(No recent messages from nearby players)",
        values: { messageCount: 0 },
        data: {},
      };
    }

    // Format messages for agent context (newest first, already sorted by service)
    const formattedMessages = localMessages
      .slice(0, 10) // Ensure max 10 messages
      .map((msg) => {
        const timeAgo = formatTimeAgo(msg.timestamp);
        const dist = formatDistance(msg.distance);
        return `  - [${msg.from}] (${dist}, ${timeAgo}): "${msg.text}"`;
      })
      .join("\n");

    const text = `## Nearby Chat

Recent messages from players within earshot (${localMessages.length} messages):
${formattedMessages}

You can respond using CHAT_MESSAGE if you want to engage. Keep responses SHORT (under 50 chars) like real MMO players - brief and punchy!`;

    return {
      text,
      values: {
        messageCount: localMessages.length,
        hasRecentChat: localMessages.length > 0,
        newestMessageAge:
          localMessages.length > 0
            ? Math.floor((Date.now() - localMessages[0].timestamp) / 1000)
            : null,
      },
      data: {
        messages: localMessages,
      },
    };
  },
};
