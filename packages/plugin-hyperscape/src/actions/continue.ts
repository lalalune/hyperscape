import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type HandlerOptions,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  composePromptFromState,
} from "@elizaos/core";

/**
 * Template for generating follow-up messages
 */
const continueTemplate = `# Task: Generate a follow-up message for {{agentName}}.
{{providers}}

# Instructions: Write a natural follow-up response that continues the conversation.
"thought" should describe what the agent is thinking about for the follow-up.
"message" should be the follow-up message that keeps the conversation flowing.

The follow-up should:
- Build on previous context
- Ask clarifying questions or provide additional information
- Keep the user engaged
- Feel natural and conversational

Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "thought": "<string>",
    "message": "<string>"
}
\`\`\`

Your response should include the valid JSON block and nothing else.`;

/**
 * CONTINUE Action - Generates follow-up messages to keep conversations flowing
 *
 * This action is used when the agent wants to continue a conversation by:
 * - Asking follow-up questions
 * - Providing additional context
 * - Keeping engagement high
 * - Transitioning between topics smoothly
 */
export const continueAction: Action = {
  name: "CONTINUE",
  similes: [
    "FOLLOW_UP",
    "KEEP_TALKING",
    "ASK_MORE",
    "ELABORATE",
    "EXPAND",
    "CONTINUE_CONVERSATION",
  ],
  description:
    "Use this action to continue or follow up on a conversation. Ideal for asking clarifying questions, providing additional information, or keeping the discussion flowing naturally. Use when you want to maintain engagement without ending the conversation.",
  validate: async (_runtime: IAgentRuntime) => {
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    __options?: HandlerOptions,
    callback?: HandlerCallback,
    responses?: Memory[],
  ): Promise<ActionResult> => {
    logger.info("[CONTINUE] Generating follow-up message");

    // Compose state with conversation context
    let composedState =
      state ||
      (await runtime.composeState(message, [
        "RECENT_MESSAGES",
        "CHARACTER",
        "ENTITIES",
      ]));

    // Check if we already have a continue response in the response chain
    const existingContinue = responses?.find((r) =>
      r.content.actions?.includes("CONTINUE"),
    );

    if (existingContinue && existingContinue.content.text) {
      const result: ActionResult = {
        text: existingContinue.content.text,
        success: true,
        values: {
          continued: true,
          continueText: existingContinue.content.text,
        },
        data: { source: "hyperscape", action: "CONTINUE" },
      };

      if (callback) {
        await callback({
          text: result.text,
          actions: ["CONTINUE"],
          source: "hyperscape",
        });
      }

      return result;
    }

    // Generate follow-up using LLM
    const prompt = composePromptFromState({
      state: composedState,
      template: continueTemplate,
    });

    const response = await runtime.useModel("object_large", {
      prompt,
    });

    const responseText = (response.message as string) || "";

    if (callback) {
      await callback({
        text: responseText,
        thought: response.thought,
        actions: ["CONTINUE"],
        source: "hyperscape",
      });
    }

    return {
      text: responseText,
      success: true,
      values: {
        continued: true,
        continueText: responseText,
        thought: response.thought,
      },
      data: {
        source: "hyperscape",
        action: "CONTINUE",
        thought: response.thought,
      },
    };
  },
  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "I really enjoy playing this game.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "That's great! What aspects of the game do you enjoy the most?",
          actions: ["CONTINUE"],
          thought:
            "User expressed enjoyment - I should ask a follow-up question to learn more",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "I've been working on leveling up my woodcutting skill.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Nice progress! Woodcutting is really useful. What level are you at now?",
          actions: ["CONTINUE"],
          thought:
            "User is working on a skill - I should show interest and ask about their progress",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "I found a really cool spot in the world.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "That sounds interesting! What makes it special? Any unique resources there?",
          actions: ["CONTINUE"],
          thought:
            "User discovered something - I should express interest and ask for details",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Just completed my first quest!",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Congratulations on your first quest! How did it go? What did you earn as a reward?",
          actions: ["CONTINUE"],
          thought:
            "User achieved something - I should congratulate them and ask about their experience",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "I'm not sure what to do next in the game.",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "I can help with that! What are your current skills and goals? Let's figure out a good path forward.",
          actions: ["CONTINUE"],
          thought:
            "User needs guidance - I should offer help and ask clarifying questions",
        },
      },
    ],
  ] as ActionExample[][],
};
