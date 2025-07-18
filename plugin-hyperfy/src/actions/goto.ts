import {
  type Action,
  type ActionResult,
  type ActionExample,
  composePromptFromState,
  ModelType,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  EventType,
  type EventHandler,
} from '@elizaos/core';
import { HyperfyService } from '../service';
import { AgentControls } from '../systems/controls'; // Import AgentControls type
// Import THREE types if needed, e.g., for metadata typing
// import type * as THREE from 'three';

export enum NavigationType {
  ENTITY = 'entity',
  POSITION = 'position',
}

const navigationTargetExtractionTemplate = (thoughts?: string) => {
  return `
# Task:
Decide whether the agent should navigate to a specific **Entity** or a direct **Position** in the Hyperfy world.

# Navigation Types:
- "entity": Navigate to a known entity by its ID.
- "position": Navigate to a specific X,Z coordinate (e.g., from user input like "go to the fountain at 5, 10").

# Constraints:
- Only use **Entity IDs** listed in the current world state.
- Positions must be 2D coordinates in the format { "x": <number>, "z": <number> }.
- Never invent or assume entities that are not in the world state.
- Use "position" only if a direct coordinate is clearly specified or derivable.

# Agent Thought:
${thoughts || 'None'}

# World State:
{{hyperfyStatus}}

# Instructions:
You are **{{agentName}}**, a virtual agent in a Hyperfy world. Analyze the conversation and determine the most appropriate navigation type and target.

Return your answer as a JSON object in **one** of the following forms:

\`\`\`json
{
  "navigationType": "${NavigationType.ENTITY}",
  "parameter": { "entityId": "<string>" }
}
\`\`\`

or

\`\`\`json
{
  "navigationType": "${NavigationType.POSITION}",
  "parameter": { "position": { "x": 5, "z": 10 } }
}
\`\`\`

Only return the JSON object. Do not include any extra text or comments.
  `.trim();
};

export const hyperfyGotoEntityAction: Action = {
  name: 'HYPERFY_GOTO_ENTITY',
  similes: ['GO_TO_ENTITY_IN_WORLD', 'MOVE_TO_ENTITY', 'NAVIGATE_TO_ENTITY'],
  description:
    'Moves your character to a specified player, object, or world position; use when you need to approach something or go somewhere before interacting. Can be chained with USE_ITEM or PERCEPTION actions for complex navigation scenarios.',
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    // Check if connected and if controls are available
    return !!service && service.isConnected() && !!service.getWorld()?.controls;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { entityId?: string },
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<ActionResult> => {
    const thoughtSnippets =
      responses
        ?.map((res) => res.content?.thought)
        .filter(Boolean)
        .join('\n') ?? '';

    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld(); // Use the getter
    const controls = world?.controls as unknown as AgentControls | undefined; // Get controls and cast type
    const player = world?.entities?.player;

    if (!service || !world || !controls || !callback) {
      logger.error('[GOTO Action] Hyperfy service, world, controls, or callback not found.');
      return {
        text: 'Error: Cannot navigate. Hyperfy connection/controls unavailable.',
        values: { success: false, error: 'service_unavailable' },
        data: { action: 'HYPERFY_GOTO_ENTITY' },
      };
    }

    let navigationResult: any = null;

    try {
      const extractionState = await runtime.composeState(message);
      const prompt = composePromptFromState({
        state: extractionState,
        template: navigationTargetExtractionTemplate(thoughtSnippets),
      });

      navigationResult = await runtime.useModel(ModelType.OBJECT_LARGE, { prompt });
      logger.info('[GOTO Action] Navigation target extracted:', navigationResult);
    } catch (error) {
      logger.error('[GOTO Action] Error during navigation target extraction:', error);
      const errorResponse = {
        thought: 'Failed to extract navigation target.',
        text: 'Action failed: Could not determine a navigation target.',
        metadata: { error: 'extraction_failed' },
      };
      await callback(errorResponse);
      return {
        text: errorResponse.text,
        values: { success: false, error: 'extraction_failed' },
        data: { action: 'HYPERFY_GOTO_ENTITY', thought: errorResponse.thought },
      };
    }

    if (!navigationResult || !navigationResult.navigationType || !navigationResult.parameter) {
      const invalidResponse = {
        thought: 'Navigation target missing or malformed.',
        text: 'Action failed: Invalid navigation target.',
        metadata: { error: 'invalid_navigation_target' },
      };
      await callback(invalidResponse);
      return {
        text: invalidResponse.text,
        values: { success: false, error: 'invalid_navigation_target' },
        data: { action: 'HYPERFY_GOTO_ENTITY', thought: invalidResponse.thought },
      };
    }

    const { navigationType, parameter } = navigationResult;

    try {
      switch (navigationType) {
        case NavigationType.ENTITY: {
          const entityId = parameter?.entityId;
          if (!entityId) {
            throw new Error('Missing entityId in parameter.');
          }

          logger.info(`Navigating to entity ${entityId}`);
          await controls.followEntity(entityId);

          const targetEntity = world.entities.items.get(parameter.entityId);
          const entityName =
            targetEntity?.data?.name || targetEntity?.blueprint?.name || `entity ${entityId}`;

          const successResponse = {
            text: `Arrived at ${entityName}.`,
            actions: ['HYPERFY_GOTO_ENTITY'],
            source: 'hyperfy',
          };
          await callback(successResponse);

          return {
            text: successResponse.text,
            values: { success: true, navigationType: 'entity', targetEntity: entityId, entityName },
            data: { action: 'HYPERFY_GOTO_ENTITY', targetEntityId: entityId },
          };
          break;
        }

        case NavigationType.POSITION: {
          const pos = parameter?.position;
          if (!pos || typeof pos.x !== 'number' || typeof pos.z !== 'number') {
            throw new Error('Invalid position coordinates.');
          }

          logger.info(`Navigating to position (${pos.x}, ${pos.z})`);
          await controls.goto(pos.x, pos.z);

          const positionResponse = {
            text: `Reached position (${pos.x}, ${pos.z}).`,
            actions: ['HYPERFY_GOTO_ENTITY'],
            source: 'hyperfy',
          };
          await callback(positionResponse);

          return {
            text: positionResponse.text,
            values: { success: true, navigationType: 'position', targetPosition: pos },
            data: { action: 'HYPERFY_GOTO_ENTITY', targetX: pos.x, targetZ: pos.z },
          };
          break;
        }

        default:
          throw new Error(`Unsupported navigation type: ${navigationType}`);
      }
    } catch (error: any) {
      logger.error('[GOTO Action] Navigation failed:', error);
      const navigationErrorResponse = {
        text: `Navigation failed: ${error.message}`,
        metadata: { error: 'navigation_error', detail: error.message },
      };
      await callback(navigationErrorResponse);

      return {
        text: navigationErrorResponse.text,
        values: { success: false, error: 'navigation_error', detail: error.message },
        data: { action: 'HYPERFY_GOTO_ENTITY' },
      };
    }
  },
  examples: [
    // Example assumes an entity "Bob" exists with ID "entity123"
    [
      { name: '{{user}}', content: { text: 'Go to Bob' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            "User wants me to go to Bob - I need to find Bob's entity in the world and navigate there",
          text: 'Navigating towards Bob...',
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Find entity abcdef' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User is asking me to navigate to a specific entity ID - I should move to that location',
          text: 'Navigating towards entity abcdef...',
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        },
      },
    ],
    // Example for failure (entity not found)
    [
      { name: '{{user}}', content: { text: 'Go to the missing chair' } },
      {
        name: '{{agent}}',
        content: {
          thought: 'I cannot find any chair entity in the current world state',
          text: 'Error: Cannot navigate. Could not find location for entity chair999.',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Go to the fountain at 12, 8' } },
      {
        name: '{{agent}}',
        content: {
          thought: 'User gave me specific coordinates - I should navigate to position x:12, z:8',
          text: 'Navigating to position (12, 8)...',
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Walk to coordinate x: 5 z: -3' } },
      {
        name: '{{agent}}',
        content: {
          thought: 'Clear coordinates provided - moving to x:5, z:-3',
          text: 'Navigating to position (5, -3)...',
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'Move to 0, 0 in the world' } },
      {
        name: '{{agent}}',
        content: {
          thought: 'Going to the world origin point at coordinates 0,0',
          text: 'Navigating to position (0, 0)...',
          actions: ['HYPERFY_GOTO_ENTITY'],
          source: 'hyperfy',
        },
      },
    ],
  ],
};
