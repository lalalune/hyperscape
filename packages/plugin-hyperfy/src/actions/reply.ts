import { Content } from '../types/eliza-mock'
import {
  type Action,
  type ActionExample,
  type ActionResult,
  composePromptFromState,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
} from '../types/eliza-mock'

/**
 * Template for generating dialog and actions for a character.
 *
 * @type {string}
 */
/**
 * Template for generating dialog and actions for a character.
 *
 * @type {string}
 */
const replyTemplate = `# Task: Generate dialog for the character {{agentName}}.
{{providers}}
# Instructions: Write the next message for {{agentName}}.
"thought" should be a short description of what the agent is thinking about and planning.
"message" should be the next message for {{agentName}} which they will send to the conversation.

Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "thought": "<string>",
    "message": "<string>"
}
\`\`\`

Your response should include the valid JSON block and nothing else.`

function getFirstAvailableField(
  obj: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (typeof obj[field] === 'string' && obj[field].trim() !== '') {
      return obj[field]
    }
  }
  return null
}

function extractReplyContent(
  response: Memory,
  replyFieldKeys: string[]
): Content | null {
  const hasReplyAction = response.content.actions?.includes('REPLY')
  const text = getFirstAvailableField(response.content, replyFieldKeys)

  if (!hasReplyAction || !text) {
    return null
  }

  return {
    ...response.content,
    thought: response.content.thought,
    text,
    actions: ['REPLY'],
  }
}

/**
 * Represents an action that allows the agent to reply to the current conversation with a generated message.
 *
 * This action can be used as an acknowledgement at the beginning of a chain of actions, or as a final response at the end of a chain of actions.
 *
 * @typedef {Object} replyAction
 * @property {string} name - The name of the action ("REPLY").
 * @property {string[]} similes - An array of similes for the action.
 * @property {string} description - A description of the action and its usage.
 * @property {Function} validate - An asynchronous function for validating the action runtime.
 * @property {Function} handler - An asynchronous function for handling the action logic.
 * @property {ActionExample[][]} examples - An array of example scenarios for the action.
 */
export const replyAction = {
  name: 'REPLY',
  similes: ['GREET', 'REPLY_TO_MESSAGE', 'SEND_REPLY', 'RESPOND', 'RESPONSE'],
  description:
    "Sends a direct message into in-game chat to a player; always use this first when you're speaking in response to someone. Can be chained with other metaverse actions for complex scenarios.",
  validate: async (_runtime: IAgentRuntime) => {
    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: any,
    callback: HandlerCallback,
    responses?: Memory[]
  ): Promise<ActionResult> => {
    const replyFieldKeys = ['message', 'text']

    const existingReplies =
      responses
        ?.map(r => extractReplyContent(r, replyFieldKeys))
        .filter((reply): reply is Content => reply !== null) ?? []

    if (existingReplies.length > 0) {
      for (const reply of existingReplies) {
        await callback(reply)
      }
      return {
        text: existingReplies[0].text || '',
        success: true,
        values: { replied: true, replyText: existingReplies[0].text },
        data: { source: 'hyperfy', action: 'REPLY' },
      }
    }

    // Only generate response using LLM if no suitable response was found
    state = await runtime.composeState(message)

    const prompt = composePromptFromState({
      state,
      template: replyTemplate,
    })

    const response = await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt,
    })

    const responseContent = {
      // @ts-ignore - Response type is unknown
      thought: response.thought,
      // @ts-ignore - Response type is unknown
      text: (response.message as string) || '',
      actions: ['REPLY'],
      source: 'hyperfy',
    }

    await callback(responseContent)

    return {
      text: responseContent.text,
      success: true,
      values: { replied: true, replyText: responseContent.text },
      data: {
        source: 'hyperfy',
        action: 'REPLY',
        thought: responseContent.thought,
      },
    }
  },
  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Hello there!',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Hi! How can I help you today?',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: "What's your favorite color?",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I really like deep shades of blue. They remind me of the ocean and the night sky.',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Can you explain how neural networks work?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Let me break that down for you in simple terms...',
          actions: ['REPLY'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Could you help me solve this math problem?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User needs help with math - I should engage and offer assistance',
          text: "Of course! Let's work through it step by step.",
          actions: ['REPLY'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action
