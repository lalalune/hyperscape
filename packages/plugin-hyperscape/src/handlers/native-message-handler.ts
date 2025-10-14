/**
 * native-message-handler.ts - Self-Contained Message Handler
 *
 * This handler replaces ElizaOS bootstrap plugin's message processing system.
 * It processes messages internally within plugin-hyperscape without relying on
 * the bootstrap plugin's `runtime.processActions()` method.
 *
 * **Architecture**:
 * - Evaluates registered runtime actions (goto, use, reply, etc.)
 * - Generates conversational responses when no actions match
 * - Integrates world context into agent responses
 * - Handles evaluators for determining when to respond
 *
 * **Message Flow**:
 * WebSocket → MessageManager.handleMessage() →
 * NativeMessageHandler.handle() → processRuntimeActions() →
 * Execute matching actions → Callback with response
 *
 * **Key Difference from Bootstrap**:
 * Bootstrap: Uses `runtime.processActions()` - a generic action processor
 * Native: Custom action evaluation with Hyperscape-specific world context
 *
 * CLAUDE.md Compliance:
 * - ✅ Strong typing enforced (no `any` types)
 * - ✅ Proper error handling for LLM calls
 * - ✅ Uses world context for rich responses
 * - ✅ Evaluators properly invoked (not just checked)
 */

import {
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  elizaLogger,
  type Content,
  ModelType,
} from "@elizaos/core";
import type { HyperscapeService } from "../service";

interface MessageHandlerOptions {
  runtime: IAgentRuntime;
  message: Memory;
  callback?: HandlerCallback;
  onComplete?: () => void;
}

/**
 * Native message handler - processes messages internally
 */
export class NativeMessageHandler {
  /**
   * Process an incoming message
   *
   * This replaces ElizaOS bootstrap's processActions with our own implementation.
   * It evaluates runtime actions, generates responses, and handles callbacks.
   */
  static async handle(options: MessageHandlerOptions): Promise<void> {
    const { runtime, message, callback, onComplete } = options;

    try {
      elizaLogger.info(`[NativeMessageHandler] Processing message: ${message.id}`);

      // Compose state from message
      const state = await runtime.composeState(message);

      // Check if we should respond
      const shouldRespond = await this.shouldRespond(runtime, message, state);
      if (!shouldRespond) {
        elizaLogger.debug(`[NativeMessageHandler] Skipping message (should not respond)`);
        onComplete?.();
        return;
      }

      // Process actions - execute only the FIRST matching action
      // This prevents multiple actions from running simultaneously
      const actionResult = await this.processRuntimeActions(runtime, message, state);

      if (actionResult) {
        // An action was executed, use its response
        if (callback && actionResult.content.text) {
          await callback(actionResult.content as Content);
        }
      } else {
        // No action matched, generate a conversational response
        const response = await this.generateResponse(runtime, message, state);

        if (callback && response.content.text) {
          await callback(response.content as Content);
        }
      }

      elizaLogger.success(`[NativeMessageHandler] Message processed successfully`);
    } catch (error) {
      elizaLogger.error(`[NativeMessageHandler] Error processing message:`, error);
    } finally {
      onComplete?.();
    }
  }

  /**
   * Process runtime actions (replacement for runtime.processActions)
   * Evaluates registered actions and executes the FIRST matching one
   *
   * This matches bootstrap behavior: only one action executes per message
   */
  private static async processRuntimeActions(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<Memory | null> {
    const actions = runtime.actions || [];

    for (const action of actions) {
      try {
        // Validate if action should run
        const isValid = await action.validate(runtime, message, state);
        if (!isValid) continue;

        elizaLogger.debug(`[NativeMessageHandler] Executing action: ${action.name}`);

        let actionResponse: Memory | null = null;

        // Execute action handler
        const result = await action.handler(runtime, message, state, {}, async (content: Content) => {
          // Action callback - convert to memory
          actionResponse = {
            id: crypto.randomUUID(),
            agentId: runtime.agentId,
            entityId: runtime.agentId,
            roomId: message.roomId,
            content,
            createdAt: Date.now(),
          };
          return [];
        });

        // If handler returned a result directly, use it
        if (result && typeof result === 'object' && 'text' in result) {
          actionResponse = {
            id: crypto.randomUUID(),
            agentId: runtime.agentId,
            entityId: runtime.agentId,
            roomId: message.roomId,
            content: {
              text: (result as { text: string }).text,
              action: 'action' in result ? (result as { action: string }).action : undefined,
            } as Content,
            createdAt: Date.now(),
          };
        }

        // Return first successful action result
        if (actionResponse) {
          elizaLogger.success(`[NativeMessageHandler] Action ${action.name} executed successfully`);
          return actionResponse;
        }
      } catch (error) {
        elizaLogger.error(`[NativeMessageHandler] Action ${action.name} failed:`, error);
        // Continue to next action on error
      }
    }

    // No actions matched or executed successfully
    return null;
  }

  /**
   * Determine if agent should respond to message
   */
  private static async shouldRespond(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<boolean> {
    // Basic heuristics for responding
    const text = message.content.text?.toLowerCase() || "";
    const agentName = runtime.character.name;
    const nameToCheck = Array.isArray(agentName) ? agentName[0].toLowerCase() : agentName.toLowerCase();

    // Always respond if mentioned by name
    if (text.includes(nameToCheck)) {
      return true;
    }

    // Always respond to direct messages
    if (message.content.userName && text.length > 0) {
      return true;
    }

    // Use runtime's evaluators if available
    try {
      const evaluators = runtime.evaluators || [];
      if (evaluators.length === 0) return true; // Default to responding

      // Actually run the first evaluator to determine if we should respond
      const shouldRespond = await evaluators[0].handler(runtime, message, state);
      return Boolean(shouldRespond);
    } catch (error) {
      elizaLogger.error('[NativeMessageHandler] Evaluator error:', error);
      return false;
    }
  }

  /**
   * Generate response content
   */
  private static async generateResponse(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<Memory> {
    // Get Hyperscape service for context
    const service = runtime.getService<HyperscapeService>("HyperscapeService");
    const world = service?.getWorld();

    // Build context from state and world
    const context = this.buildContext(runtime, message, state, world);

    try {
      // Generate text response using LLM
      const responseText = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: context,
        max_tokens: 1000,
        temperature: 0.8,
        stop: [],
      });

      // Ensure responseText is a string before parsing
      const textContent = typeof responseText === 'string'
        ? responseText
        : (responseText && typeof responseText === 'object' && 'text' in responseText)
          ? String((responseText as { text: unknown }).text)
          : String(responseText);

      // Parse response for actions/emotes
      const parsedResponse = this.parseResponse(textContent);

      // Create response memory
      const responseMemory: Memory = {
        id: crypto.randomUUID(),
        agentId: runtime.agentId,
        entityId: runtime.agentId,
        roomId: message.roomId,
        content: {
          text: parsedResponse.text,
          action: parsedResponse.action,
          emote: parsedResponse.emote,
          inReplyTo: message.id,
          name: runtime.character.name,
        } as Content,
        createdAt: Date.now(),
      };

      // Save to memory
      await runtime.createMemory(responseMemory, "messages");

      return responseMemory;
    } catch (error) {
      elizaLogger.error('[NativeMessageHandler] Failed to generate response:', error);

      // Create error response memory
      const errorMemory: Memory = {
        id: crypto.randomUUID(),
        agentId: runtime.agentId,
        entityId: runtime.agentId,
        roomId: message.roomId,
        content: {
          text: "I'm having trouble responding right now.",
          inReplyTo: message.id,
          name: runtime.character.name,
        } as Content,
        createdAt: Date.now(),
      };

      await runtime.createMemory(errorMemory, "messages");
      return errorMemory;
    }
  }

  /**
   * Build context string for LLM
   */
  private static buildContext(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    world: unknown,
  ): string {
    const characterName = Array.isArray(runtime.character.name)
      ? runtime.character.name[0]
      : runtime.character.name;

    const characterBio = Array.isArray(runtime.character.bio)
      ? runtime.character.bio.join(" ")
      : runtime.character.bio;

    let context = `You are ${characterName}. ${characterBio}\n\n`;

    // Add world context if available
    if (world && typeof world === 'object' && 'entities' in world) {
      const worldObj = world as {
        entities?: {
          player?: {
            position?: { x: number; y: number; z: number };
            data?: Record<string, unknown>;
          };
        };
        getNearbyEntities?: (position: { x: number; y: number; z: number }, radius: number) => unknown[];
      };

      const player = worldObj.entities?.player;
      if (player?.position) {
        const { x, y, z } = player.position;
        context += `Your Position: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})\n`;

        // Add nearby entities count if available
        if (worldObj.getNearbyEntities) {
          const nearbyEntities = worldObj.getNearbyEntities(player.position, 10);
          if (nearbyEntities && nearbyEntities.length > 0) {
            context += `Nearby Entities: ${nearbyEntities.length}\n`;
          }
        }
        context += '\n';
      }
    }

    // Add state context
    if (state.text) {
      context += `Current Context:\n${state.text}\n\n`;
    }

    // Add recent message
    context += `Message from ${message.content.userName || "User"}:\n${message.content.text}\n\n`;

    // Add response instructions
    context += `Generate a response as ${characterName}. Keep it natural and in-character.\n`;
    context += `You can optionally include actions like: [action: walk], [action: emote], etc.\n`;

    return context;
  }

  /**
   * Parse response text for actions and emotes
   */
  private static parseResponse(text: string): {
    text: string;
    action?: string;
    emote?: string;
  } {
    let cleanText = text;
    let action: string | undefined;
    let emote: string | undefined;

    // Extract [action: ...] tags
    const actionMatch = text.match(/\[action:\s*([^\]]+)\]/i);
    if (actionMatch) {
      action = actionMatch[1].trim();
      cleanText = cleanText.replace(actionMatch[0], "").trim();
    }

    // Extract [emote: ...] tags
    const emoteMatch = text.match(/\[emote:\s*([^\]]+)\]/i);
    if (emoteMatch) {
      emote = emoteMatch[1].trim().toUpperCase();
      cleanText = cleanText.replace(emoteMatch[0], "").trim();
    }

    return { text: cleanText, action, emote };
  }
}

/**
 * Convenience function for handling messages
 */
export async function handleMessage(options: MessageHandlerOptions): Promise<void> {
  return NativeMessageHandler.handle(options);
}
