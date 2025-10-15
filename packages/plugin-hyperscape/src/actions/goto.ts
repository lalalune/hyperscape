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
} from "@elizaos/core";
import { HyperscapeService } from "../service";
// Import THREE types if needed, e.g., for metadata typing
// import type THREE from 'three';

export enum NavigationType {
  ENTITY = "entity",
  POSITION = "position",
}

const navigationTargetExtractionTemplate = (thoughts?: string) => {
  return `
# Task:
Decide whether the agent should navigate to a specific **Entity** or a direct **Position** in the Hyperscape world.

# Navigation Types:
- "entity": Navigate to a known entity by its ID.
- "position": Navigate to a specific X,Z coordinate (e.g., from user input like "go to the fountain at 5, 10").

# Constraints:
- Only use **Entity IDs** listed in the current world state.
- Positions must be 2D coordinates in the format { "x": <number>, "z": <number> }.
- Never invent or assume entities that are not in the world state.
- Use "position" only if a direct coordinate is clearly specified or derivable.

# Agent Thought:
${thoughts || "None"}

# World State:
{{hyperscapeStatus}}

# Instructions:
You are **{{agentName}}**, a virtual agent in a Hyperscape world. Analyze the conversation and determine the most appropriate navigation type and target.

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

export const hyperscapeGotoEntityAction: Action = {
  name: "HYPERSCAPE_GOTO_ENTITY",
  similes: ["GO_TO_ENTITY_IN_WORLD", "MOVE_TO_ENTITY", "NAVIGATE_TO_ENTITY"],
  description:
    "Moves your character to a specified player, object, or world position; use when you need to approach something or go somewhere before interacting. Can be chained with USE_ITEM or PERCEPTION actions for complex navigation scenarios.",
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    // Check if connected and if controls are available
    return !!service && service.isConnected() && !!service.getWorld()?.controls;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { entityId?: string },
    callback?: HandlerCallback,
    responses?: Memory[],
  ): Promise<ActionResult> => {
    const thoughtSnippets =
      responses
        ?.map((res) => res.content?.thought)
        .filter(Boolean)
        .join("\n") ?? "";

    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    )!;
    const world = service.getWorld()!; // Use the getter
    const controls = world.controls!; // Controls are typed correctly in World interface
    const player = world.entities.player;

    const extractionState = await runtime.composeState(message);
    const prompt = composePromptFromState({
      state: extractionState,
      template: navigationTargetExtractionTemplate(thoughtSnippets),
    });

    const navigationResult = await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt,
    });
    logger.info("[GOTO Action] Navigation target extracted:", navigationResult);

    const { navigationType, parameter } = navigationResult;

    switch (navigationType) {
      case NavigationType.ENTITY: {
        const entityId = parameter.entityId;

        logger.info(`Navigating to entity ${entityId}`);
        await controls.followEntity(entityId);

        const targetEntity = world.entities.items.get(parameter.entityId)!;
        const entityName =
          targetEntity.data.name ||
          (
            targetEntity.data as {
              metadata?: { hyperscape?: { name?: string } };
            }
          )?.metadata?.hyperscape?.name ||
          `entity ${entityId}`;

        const successResponse = {
          text: `Arrived at ${entityName}.`,
          actions: ["HYPERSCAPE_GOTO_ENTITY"],
          source: "hyperscape",
        };
        await callback!(successResponse);

        return {
          text: successResponse.text,
          success: true,
          values: {
            success: true,
            navigationType: "entity",
            targetEntity: entityId,
            entityName,
          },
          data: {
            action: "HYPERSCAPE_GOTO_ENTITY",
            targetEntityId: entityId,
          },
        };
      }

      case NavigationType.POSITION: {
        const pos = parameter.position;

        logger.info(`Navigating to position (${pos.x}, ${pos.z})`);
        await controls.goto(pos.x, pos.z);

        const positionResponse = {
          text: `Reached position (${pos.x}, ${pos.z}).`,
          actions: ["HYPERSCAPE_GOTO_ENTITY"],
          source: "hyperscape",
        };
        await callback!(positionResponse);

        return {
          text: positionResponse.text,
          success: true,
          values: {
            success: true,
            navigationType: "position",
            targetPosition: pos,
          },
          data: {
            action: "HYPERSCAPE_GOTO_ENTITY",
            targetX: pos.x,
            targetZ: pos.z,
          },
        };
      }

      default:
        throw new Error(`Unsupported navigation type: ${navigationType}`);
    }
  },
  examples: [
    [
      {
        name: "user",
        content: {
          text: "Go to Bob",
        },
      },
      {
        name: "agent",
        content: {
          text: "Navigating towards Bob...",
          actions: ["HYPERSCAPE_GOTO_ENTITY"],
          thought:
            "User wants me to go to Bob - I need to find Bob's entity in the world and navigate there",
        },
      },
    ],
    [
      {
        name: "user",
        content: {
          text: "Find entity abcdef",
        },
      },
      {
        name: "agent",
        content: {
          text: "Navigating towards entity abcdef...",
          actions: ["HYPERSCAPE_GOTO_ENTITY"],
          thought:
            "User is asking me to navigate to a specific entity ID - I should move to that location",
        },
      },
    ],
  ] as ActionExample[][],
};
