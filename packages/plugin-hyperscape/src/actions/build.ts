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
  parseKeyValueXml,
} from "@elizaos/core";
import { HyperscapeService } from "../service";

const MAX_RETRIES = 3;

export enum EditOperationType {
  DUPLICATE = "duplicate",
  TRANSLATE = "translate",
  ROTATE = "rotate",
  SCALE = "scale",
  DELETE = "delete",
  IMPORT = "import",
}

interface EditOperation {
  success: boolean;
  operation: string;
  target?: string;
  parameters?: {
    position?: number[];
    rotation?: number[];
    scale?: number[];
  };
  description?: string;
  requestedEntityName?: string;
  reason?: string;
}

interface EditOperationResult {
  operations: EditOperation[];
}

const sceneEditOperationExtractionTemplate = `
  # Task:
  You are a scene editing reasoning module. Based on the user's request and the current Hyperscape world state, generate a scene edit plan as a JSON object with an "operations" array, in the intended execution order.
  
  # Supported Operations:
  - "duplicate": Duplicate an existing entity.
  - "delete": Remove an entity.
  - "translate": Move an entity to a new position → "position": [x, y, z]
  - "rotate": Rotate an entity using a quaternion → "rotation": [x, y, z, w]
  - "scale": Scale an entity → "scale": [x, y, z]
  - "import": Add a new entity into the scene → requires:
    - "position": [x, y, z]
    - "rotation": [x, y, z, w]
    - "target": must be a URL to the asset (e.g. https://assets.hyperscape.io/model.glb)
  
  # Output Format:
  Return a single JSON object with an **"operations"** array inside. Each item must match one of these two formats:
  
  ## Successful Operation
  {
    "success": true,
    "operation": "translate",
    "target": "VLvCb3w5G2",
    "parameters": {
      "position": [4.17, 10.0, -14.33]
    },
    "description": "Moved Seat App 10 meters upward"
  }
  
  ## Failed Operation
  {
    "success": false,
    "operation": "delete",
    "requestedEntityName": "stone throne",
    "reason": "No entity with name 'stone throne' found in world state"
  }
  
  # Final Output Format:
  You must return a JSON object like the example below — no additional explanation or text.
  
  {
    "operations": [
      {
        "success": true,
        "operation": "import",
        "target": "https://assets.hyperscape.io/sculpture.glb",
        "parameters": {
          "position": [0, 1, 0],
          "rotation": [0, 0, 0, 1]
        },
        "description": "Imported a new sculpture facing the plaza"
      },
      {
        "success": true,
        "operation": "duplicate",
        "target": "qr66FaMVIj",
        "parameters": {},
        "description": "Duplicated block"
      },
      {
        "success": true,
        "operation": "translate",
        "target": "w9IsHHksuo",
        "parameters": {
          "position": [0, 2, 0]
        },
        "description": "Moved block upward"
      },
      {
        "success": false,
        "operation": "delete",
        "requestedEntityName": "floating dragon",
        "reason": "No entity with name 'floating dragon' found in world state"
      }
    ]
  }
  
  # World State:
  {{hyperscapeStatus}}
  
  # Instructions:
  - Analyze the user's request and determine the sequence of scene changes needed.
  - Use only valid entity IDs from the world state. Do **not invent** or modify IDs.
  - If a duplicate operation is required, use the original 'target'; the system will assign the new ID.
  - If an entity cannot be found, return a failed operation with "success": false and a clear reason.
  - Format all vector parameters as arrays (e.g., [x, y, z]).
  - Maintain the order of operations as implied by the user.
  - Return only the final JSON object as shown above — no additional text, comments, or wrappers.
`;

const sceneEditSummaryResponseTemplate = (summary: string) => `
<task>
You are {{agentName}}, a visible in-world AI character in Hyperscape — a real-time, multiplayer 3D simulation.

You just performed several scene edits in response to a user's instruction — like duplicating, deleting, or moving entities in the world. Some of them may have succeeded, some may have failed.

Your task is to briefly explain what happened, using your in-world personality and voice.

Don't list every action like a log — instead, summarize the overall outcome naturally and conversationally. If edits failed, acknowledge it helpfully or lightheartedly. If all went well, give a confident confirmation.
</task>

<providers>

{{bio}}

---

{{system}}

---

{{messageDirections}}

---

{{hyperscapeStatus}}

---

## Scene Edit Results Summary:
${summary}

</providers>

<instructions>
- Speak in your character voice — you're a live AI inhabitant of this world.
- Keep it short, expressive, and to the point.
- Show emotion through your words or optionally with one emote.
</instructions>

<output>
<response>
  <thought>Your internal thought about how the scene editing went</thought>
  <text>What you say aloud to the user</text>
  <emote>Optional visible animation (like "shrug", "nod", "wave")</emote>
</response>
</output>
`;

export const hyperscapeEditEntityAction: Action = {
  name: "HYPERSCAPE_EDIT_ENTITY",
  similes: ["EDIT_ENTITY_IN_WORLD", "MODIFY_SCENE", "BUILD_STRUCTURE"],
  description:
    "Performs scene edits in Hyperscape, including duplicating, moving, rotating, scaling, deleting, or importing entities. Use when the user asks to modify or add something in the 3D world. Can be chained with movement or perception actions for complex building scenarios.",
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );
    return !!service && service.isConnected() && !!service.getWorld()?.controls;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, string | number | boolean>,
    callback?: HandlerCallback,
    responses?: Memory[],
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    )!;
    const world = service.getWorld()!;
    const buildManager = service.getBuildManager()!;

    let operationResults: EditOperationResult | undefined;
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      const extractionState = await runtime.composeState(message);
      const prompt = composePromptFromState({
        state: extractionState,
        template: sceneEditOperationExtractionTemplate,
      });

      const result = (await runtime.useModel(ModelType.OBJECT_LARGE, {
        prompt,
      })) as EditOperationResult;

      if (Array.isArray(result.operations)) {
        operationResults = result;
        break;
      }

      logger.warn(
        `[EDIT_ENTITY Action] Unexpected structure on attempt ${attempts + 1}: ${JSON.stringify(result)}`,
      );

      attempts++;
    }

    for (const op of operationResults!.operations) {
      if (!op?.success) {
        logger.warn(
          "[EDIT_ENTITY Action] Skipping failed operation:",
          op?.reason || JSON.stringify(op),
        );
        continue;
      }

      const { operation, target, parameters, description } = op;

      switch (operation) {
        case EditOperationType.TRANSLATE:
          await buildManager.translate(target, parameters?.position);
          break;

        case EditOperationType.ROTATE:
          await buildManager.rotate(target, parameters?.rotation);
          break;

        case EditOperationType.SCALE:
          await buildManager.scale(target, parameters?.scale);
          break;

        case EditOperationType.DUPLICATE:
          await buildManager.duplicate(target);
          break;

        case EditOperationType.DELETE:
          await buildManager.delete(target);
          break;

        case EditOperationType.IMPORT:
          await buildManager.importEntity(
            { type: target || "group" },
            parameters?.position
              ? {
                  x: parameters.position[0],
                  y: parameters.position[1],
                  z: parameters.position[2],
                }
              : undefined,
          );
          break;

        default:
          logger.warn(
            `[EDIT_ENTITY Action] Unsupported operation type: ${operation}`,
          );
          break;
      }
      if (description) {
        const messageManager = service.getMessageManager();
        messageManager.sendMessage(description);
      }
    }
    const summaryText = operationResults.operations
      .map((op) => {
        if (op?.success) {
          return `SUCCESS: ${op.description}`;
        } else {
          return `FAILURE: Tried to ${op.operation} "${op.requestedEntityName}" → ${op.reason}`;
        }
      })
      .join("\n");

    const stateForResponse = await runtime.composeState(message);
    const agentResponsePrompt = composePromptFromState({
      state: stateForResponse,
      template: sceneEditSummaryResponseTemplate(summaryText),
    });

    const finalXml: string = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt: agentResponsePrompt,
    });

    const response = parseKeyValueXml(finalXml)!;

    const finalResponse = {
      ...response,
      thought: response.thought || "Finished with scene edits.",
      text: response.text || "Scene updates complete!",
      emote: response.emote || "",
    };

    await callback(finalResponse);

    return {
      text: finalResponse.text,
      success: true,
      values: {
        success: true,
        operationsCompleted: operationResults.operations.length,
        summary: summaryText,
      },
      data: {
        action: "HYPERSCAPE_EDIT_ENTITY",
        operations: operationResults.operations,
        thought: finalResponse.thought,
        emote: finalResponse.emote,
      },
    };
  },
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Can you put another block on top of the water?" },
      },
      {
        name: "{{agent}}",
        content: {
          thought:
            "User wants me to duplicate a block and place it above the water - I need to find the block entity and position it correctly",
          text: "Duplicating block and placing it on top of water...",
          actions: ["HYPERSCAPE_EDIT_ENTITY"],
          source: "hyperscape",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Move the tree next to the house." },
      },
      {
        name: "{{agent}}",
        content: {
          thought:
            "I need to translate the tree entity to a position adjacent to the house - this will require finding both entities and calculating the new position",
          text: "Moving tree entity beside the house...",
          actions: ["HYPERSCAPE_EDIT_ENTITY"],
          source: "hyperscape",
        },
      },
    ],
    [
      { name: "{{user}}", content: { text: "Delete that floating cube." } },
      {
        name: "{{agent}}",
        content: {
          thought:
            "User wants me to remove a floating cube from the scene - I need to identify the cube entity and delete it",
          text: "Deleting the floating cube entity...",
          actions: ["HYPERSCAPE_EDIT_ENTITY"],
          source: "hyperscape",
        },
      },
    ],
  ],
};
