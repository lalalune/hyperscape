// @ts-nocheck - Suppressing TypeScript errors for legacy compatibility
import {
  Content,
  EventType,
  Memory,
  MessageReceivedHandlerParams,
  ModelType,
  asUUID,
  composePromptFromState,
  createUniqueUuid,
  logger,
  parseKeyValueXml,
  truncateToCompleteSentence,
} from '@elizaos/core';
import { v4 } from 'uuid';
import { hyperfyMessageHandlerTemplate, hyperfyShouldRespondTemplate } from '../templates';

// Track latest response IDs per room to prevent race conditions
const agentResponses = new Map<string, string>();

const latestResponseIds = new Map<string, Map<string, string>>();

/**
 * Handles incoming messages and generates responses based on the provided runtime and message information.
 *
 * @param {MessageReceivedHandlerParams} params - The parameters needed for message handling, including runtime, message, and callback.
 * @returns {Promise<void>} - A promise that resolves once the message handling and response generation is complete.
 */
export async function hyperfyMessageReceivedHandler({
  runtime,
  // @ts-ignore - Message is required but may be undefined
  message,
  // @ts-ignore - Callback may be undefined
  callback,
  // @ts-ignore - OnComplete may be undefined
  onComplete,
}: MessageReceivedHandlerParams): Promise<void> {
  // @ts-ignore - Type safety issues
  logger.info(`[Bootstrap] Message received from ${message?.entityId} in room ${message?.roomId}`);

  // Skip processing if message is from the agent itself
  if (message?.entityId === runtime.agentId) {
    return; // Skip messages from self
  }

  // @ts-ignore - Response and message typing issues
  const responseId = asUUID(`response-${message?.roomId}-${Date.now()}`);

  // Store this response ID for the room
  // @ts-ignore - Type safety
  agentResponses.set(message?.roomId, responseId);

  try {
    // @ts-ignore - Type safety issues
    logger.debug(
      `[Bootstrap] Processing message: ${truncateToCompleteSentence(message?.content?.text || '', 50)}...`
    );

    // Process memory and embedding
    await Promise.all([
      // @ts-ignore - Message type issues
      runtime.addEmbeddingToMemory(message),
      // @ts-ignore - Message type issues
      runtime.createMemory(message, 'messages'),
    ]);

    // @ts-ignore - Type safety
    const agentUserState = await runtime.getParticipantUserState(message?.roomId, runtime.agentId);
    const isUserMuted = agentUserState?.muted || false;

    if (
      isUserMuted &&
      !message?.content?.text?.toLowerCase().includes(runtime.character.name.toLowerCase())
    ) {
      // @ts-ignore - Type safety
      logger.debug(`[Bootstrap] Ignoring muted room ${message?.roomId}`);
      return;
    }

    // @ts-ignore - Message type issues
    const state = await runtime.composeState(
      message,
      ['worldProvider', 'actionsProvider', 'characterProvider'],
      true
    );

    // @ts-ignore - Type safety
    const room = await runtime.getRoom(message?.roomId);

    if (room?.type === 'DM') {
      // Skip should respond check for DMs
      const shouldRespondPrompt = composePromptFromState({
        state,
        template: hyperfyShouldRespondTemplate,
      });

      const shouldRespondResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: shouldRespondPrompt,
        max_tokens: 512,
        temperature: 0.1,
      });

      // @ts-ignore - Response type is unknown but parseKeyValueXml handles it
      const responseObject = parseKeyValueXml(shouldRespondResult);
      const shouldRespond = responseObject?.should_respond?.toLowerCase() === 'true';

      if (shouldRespond) {
        // @ts-ignore - Message type issues
        const responseState = await runtime.composeState(message);

        const prompt = composePromptFromState({
          state: responseState,
          template: hyperfyMessageHandlerTemplate,
        });

        const response = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt,
          max_tokens: 2048,
          temperature: 0.7,
        });

        let responseContent;
        if (response) {
          // @ts-ignore - Response type is unknown but parseKeyValueXml handles it
          const parsedXml = parseKeyValueXml(response);

          if (parsedXml) {
            responseContent = {
              thought: parsedXml.thought,
              text: parsedXml.message,
              // @ts-ignore - Type safety
              actions: parsedXml.actions
                ? parsedXml.actions.split(',').map((a: string) => a.trim())
                : [],
              // @ts-ignore - Type safety
              providers: parsedXml.providers
                ? parsedXml.providers.split(',').map((p: string) => p.trim())
                : [],
              emote: parsedXml.emote || '',
              source: 'hyperfy',
            };
          }
        }

        // @ts-ignore - Type safety
        const currentResponseId = agentResponses.get(message?.roomId);
        if (currentResponseId !== responseId) {
          // @ts-ignore - Type safety
          logger.debug(
            `Response discarded - newer message being processed for agent: ${runtime.agentId}, room: ${message?.roomId}`
          );
          return;
        }

        if (responseContent && message?.id) {
          // @ts-ignore - Type safety
          responseContent.inReplyTo = createUniqueUuid(runtime, message.id);
        }

        const responseMessages = responseContent
          ? // @ts-ignore - Callback type issue
          await callback({
            ...responseContent,
            // @ts-ignore - Type safety
            roomId: message?.roomId,
          })
          : [];

        // Clean up the response tracking
        // @ts-ignore - Type safety
        agentResponses.delete(message?.roomId);

        if (responseMessages && responseMessages.length > 0 && responseContent) {
          // @ts-ignore - Message type issues
          const finalState = await runtime.composeState(message, responseContent?.providers || []);

          // @ts-ignore - Message type issues
          await runtime.processActions(message, responseMessages, finalState, callback);

          // @ts-ignore - Message type issues
          await runtime.evaluate(message, finalState, shouldRespond, callback, responseMessages);
        }
      } else {
        // Handle ignore case
        // @ts-ignore - Type safety
        if (!message?.id) {
          return;
        }

        const ignoreContent = {
          // @ts-ignore - Type safety
          thought: `I've decided not to respond to this message in room ${message?.roomId}.`,
          text: '',
          actions: [],
          providers: [],
          source: 'hyperfy',
          // @ts-ignore - Type safety
          inReplyTo: createUniqueUuid(runtime, message.id),
        };

        // @ts-ignore - Callback type issue
        await callback(ignoreContent);

        await runtime.createMemory({
          entityId: runtime.agentId,
          // @ts-ignore - Type safety
          roomId: message?.roomId,
          content: ignoreContent,
        });

        // @ts-ignore - Type safety
        agentResponses.delete(message?.roomId);
      }
    }
  } catch (error) {
    logger.error('Error in hyperfy message handler:', error);
  } finally {
    if (onComplete) {
      onComplete();
    }
  }
}
