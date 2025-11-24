/**
 * Message API Route for Hyperscape Plugin
 *
 * Provides endpoint for sending messages to agents from the dashboard chat
 */

import type { Route, Memory, UUID } from "@elizaos/core";
import { logger, ModelType } from "@elizaos/core";
import {
  composeContext,
  generateMessageResponse,
  shouldRespond,
} from "../utils/ai-helpers.js";

/**
 * Message route - processes messages from the dashboard chat
 * Endpoint: POST /hyperscape/message
 */
export const messageRoute: Route = {
  type: "POST",
  path: "/hyperscape/message",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const body = req.body as {
        content: string;
        agentId?: string;
        channelId?: string;
        messageId?: string;
        userId?: string;
      };

      // Validate required fields
      if (!body.content) {
        res.status(400).json({
          success: false,
          error: "Missing required field: content",
        });
        return;
      }

      const agentId = body.agentId || runtime.agentId;

      logger.info(
        `[MessageRoute] Processing message for agent ${agentId} (runtime: ${runtime.agentId}): "${body.content}"`,
      );

      // Create memory object from the incoming message
      const memory: Memory = {
        id: (body.messageId || crypto.randomUUID()) as UUID,
        entityId: (body.userId || "dashboard-user") as UUID,
        agentId: runtime.agentId,
        content: {
          text: body.content,
          source: "dashboard_chat",
        },
        roomId: (body.channelId || `dashboard-chat-${agentId}`) as UUID,
        createdAt: Date.now(),
        metadata: {
          type: "message",
          source: "dashboard",
        },
      };

      // Compose state from the memory
      const state = await runtime.composeState(memory);

      // Check if the agent should respond
      const shouldRespondToMessage = await shouldRespond(
        runtime,
        memory,
        state,
      );

      if (!shouldRespondToMessage) {
        logger.debug("[MessageRoute] Agent chose not to respond");
        // Save the message to memory anyway
        await runtime.createMemory(memory, "messages");
        res.json({
          text: "I received your message but don't have anything to say right now.",
        });
        return;
      }

      // Generate response using context
      const context = await composeContext({
        state,
        template: `
# Dashboard Chat Response

You are an AI agent in Hyperscape. A user is messaging you through the dashboard.

## Message
User: {{content.text}}

## Guidelines
- Be helpful and conversational
- Answer questions about your current state or activities
- Execute commands if the user requests actions (like "Move to [x, y, z]" or "Attack goblin")
- Reference your game state when relevant

Generate a natural response.
        `,
        runtime,
      });

      const response = await generateMessageResponse({
        runtime,
        context,
        modelType: ModelType.TEXT_LARGE,
      });

      // Create response memory
      const responseMemory: Memory = {
        id: crypto.randomUUID() as UUID,
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        content: {
          text: response.text,
          source: "agent_response",
        },
        roomId: memory.roomId,
        createdAt: Date.now(),
        metadata: {
          type: "message",
          inReplyTo: memory.id,
        },
      };

      // Save both memories
      await runtime.createMemory(memory, "messages");
      await runtime.createMemory(responseMemory, "messages");

      logger.info(
        `[MessageRoute] Agent response: ${response.text.substring(0, 100)}...`,
      );

      // Return response to dashboard
      res.json([{ text: response.text, content: response.text }]);
    } catch (error) {
      logger.error(
        "[MessageRoute] Error processing message:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
};
