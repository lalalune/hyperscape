/**
 * Dialogue actions - DIALOGUE_RESPOND, CLOSE_DIALOGUE
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

/**
 * DIALOGUE_RESPOND - Respond to an NPC dialogue option
 */
export const dialogueRespondAction: Action = {
  name: "DIALOGUE_RESPOND",
  similes: ["RESPOND", "ANSWER", "SELECT_OPTION", "DIALOGUE_CHOICE"],
  description:
    "Select a response option in an active NPC dialogue. Specify the option number (1-based).",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    return player?.alive !== false;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: { responseIndex?: number; npcId?: string },
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    const content = message.content.text || "";

    // Parse response index from message or options
    let responseIndex = options?.responseIndex;
    if (responseIndex === undefined) {
      const match = content.match(/(\d+)/);
      responseIndex = match ? parseInt(match[1], 10) - 1 : 0;
    }

    logger.info(`[DIALOGUE_RESPOND] Selecting option ${responseIndex + 1}`);

    // Execute the dialogue response command
    await service.executeDialogueResponse(responseIndex);

    await callback?.({
      text: `Selected dialogue option ${responseIndex + 1}`,
      action: "DIALOGUE_RESPOND",
    });

    return {
      success: true,
      text: `Selected option ${responseIndex + 1}`,
      data: { action: "DIALOGUE_RESPOND", responseIndex },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Select option 2" } },
      {
        name: "agent",
        content: {
          text: "Selected dialogue option 2",
          action: "DIALOGUE_RESPOND",
        },
      },
    ],
  ],
};

/**
 * CLOSE_DIALOGUE - Close the current NPC dialogue
 */
export const closeDialogueAction: Action = {
  name: "CLOSE_DIALOGUE",
  similes: ["END_DIALOGUE", "EXIT_DIALOGUE", "CLOSE_CONVERSATION"],
  description: "Close the current active NPC dialogue.",

  validate: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service?.isConnected()) return false;

    const player = service.getPlayerEntity();
    return player?.alive !== false;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    if (!service) {
      return { success: false, error: new Error("Service not available") };
    }

    logger.info(`[CLOSE_DIALOGUE] Closing dialogue`);

    // Execute the close dialogue command
    await service.executeCloseDialogue();

    await callback?.({
      text: "Closed dialogue",
      action: "CLOSE_DIALOGUE",
    });

    return {
      success: true,
      text: "Dialogue closed",
      data: { action: "CLOSE_DIALOGUE" },
    };
  },

  examples: [
    [
      { name: "user", content: { text: "Close dialogue" } },
      {
        name: "agent",
        content: { text: "Closed dialogue", action: "CLOSE_DIALOGUE" },
      },
    ],
  ],
};
