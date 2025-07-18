import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  composePromptFromState,
  ModelType,
} from '@elizaos/core';
import { HyperfyService } from '../service';
import { AgentActions } from '../systems/actions';
import { AgentControls } from '../systems/controls';

// Template to extract entity to interact with
const useItemTemplate = `
# Task: Decide if the agent should interact with an entity (e.g. pick up or activate) based on recent context.
# DO NOT assume the last message has a command. Look at overall context.
# ONLY return entity IDs that exist in the Hyperfy World State.

{{providers}}

# Instructions:
Decide if the agent should use/interact with a specific entity based on the conversation and world state.

Response format:
\`\`\`json
{
  "entityId": "<string>" // or null if none
}
\`\`\`
`;

export const hyperfyUseItemAction: Action = {
  name: 'HYPERFY_USE_ITEM',
  similes: ['INTERACT_WITH_ITEM', 'USE_NEARBY_OBJECT', 'PICK_UP_ITEM'],
  description:
    'Walks to and interacts with a nearby usable item (like picking it up); use when a player asks you to use or grab something. Can be chained with GOTO actions for complex interaction sequences.',
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld();
    return !!service && service.isConnected() && !!world?.controls && !!world?.actions;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, _state?: State, options?: { entityId?: string }, callback?: HandlerCallback): Promise<ActionResult> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld();
    const controls = world?.controls as unknown as AgentControls;
    const actions = world?.actions as unknown as AgentActions | undefined;

    if (!service || !world || !actions || !callback) {
      logger.error(
        '[USE Action] Hyperfy service, world, or actions not found for HYPERFY_USE_ITEM action.'
      );
      if (callback) {
        await callback({ text: 'Error: Cannot use item. Agent action system unavailable.' });
      }
      return {
        text: 'Error: Cannot use item. Agent action system unavailable.',
        values: { success: false, error: 'action_system_unavailable' },
        data: { action: 'HYPERFY_USE_ITEM' },
      };
    }

    let targetEntityId = options?.entityId;

    if (!targetEntityId) {
      logger.info('[USE ITEM] No entityId provided, attempting LLM extraction...');
      try {
        const useState = await runtime.composeState(
          message,
          ['HYPERFY_WORLD_STATE', 'RECENT_MESSAGES'],
          true
        );
        const prompt = composePromptFromState({ state: useState, template: useItemTemplate });
        const response = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt,
          max_tokens: 512,
          temperature: 0.1,
        });

        // @ts-ignore - Response type is unknown
        if (response?.entityId && typeof response.entityId === 'string') {
          // @ts-ignore - Response type is unknown
          targetEntityId = response.entityId;
          logger.info(`[USE ITEM] Extracted entity ID: ${targetEntityId}`);
        } else {
          logger.warn('[USE ITEM] No valid entityId extracted.');
        }
      } catch (err) {
        logger.error('[USE ITEM] Extraction failed:', err);
      }
    }

    if (!targetEntityId) {
      logger.warn('[USE ITEM] No suitable item found to use based on the context.');
      return {
        text: 'No suitable item found to use based on the context.',
        values: { success: false, error: 'no_item_found' },
        data: { action: 'HYPERFY_USE_ITEM' },
      };
    }

    const entity = world.entities.items.get(targetEntityId);
    const targetPosition = entity?.root?.position;
    if (!targetPosition) {
      if (callback) {
        const errorResponse = {
          text: `Could not locate entity ${targetEntityId}.`,
          metadata: { error: 'entity_not_found' },
        };
        await callback(errorResponse);
      }
      return {
        text: `Could not locate entity ${targetEntityId}.`,
        values: { success: false, error: 'entity_not_found', targetEntityId },
        data: { action: 'HYPERFY_USE_ITEM' },
      };
    }

    await controls.goto(targetPosition.x, targetPosition.z);

    logger.info(`[USE ITEM] Attempting to use item with entity ID: ${targetEntityId}`);
    actions.performAction(targetEntityId);

    if (callback) {
      const successResponse = {
        text: `Using item: ${targetEntityId}`,
        actions: ['HYPERFY_USE_ITEM'],
        source: 'hyperfy',
        metadata: { targetEntityId, status: 'triggered' },
      };
      await callback(successResponse);
    }

    return {
      text: `Using item: ${targetEntityId}`,
      values: { success: true, targetEntityId, status: 'triggered' },
      data: {
        action: 'HYPERFY_USE_ITEM',
        targetEntityId,
        position: { x: targetPosition.x, z: targetPosition.z },
      },
    };
  },
  examples: [
    [
      { name: '{{user}}', content: { text: 'Pick up the book.' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to pick up a book - I need to find the book entity and interact with it',
          text: 'Using item: book123',
          actions: ['HYPERFY_USE_ITEM'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Interact with the glowing orb.' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'The user wants me to interact with a glowing orb - I should navigate to it and activate it',
          text: 'Using item: orb888',
          actions: ['HYPERFY_USE_ITEM'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Do we need to pick something up?' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            "The user is asking if there's something to pick up, but I don't see any obvious interactive items nearby",
          text: 'No suitable item found to use based on the context.',
        },
      },
    ],
  ],
};
