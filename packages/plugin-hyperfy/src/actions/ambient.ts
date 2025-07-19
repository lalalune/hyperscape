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

const ambientTemplate = `# Task: Generate ambient speech for the character {{agentName}}.
{{providers}}

# Instructions:
"thought" should describe what the agent is internally noticing, thinking about, or reacting to.
"message" should be a short, self-directed or environment-facing comment. It should NOT be addressed to any user.

Only output a valid JSON block:

\`\`\`json
{
  "thought": "<string>",
  "message": "<string>"
}
\`\`\``

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

function extractAmbientContent(
  response: Memory,
  fieldKeys: string[]
): Content | null {
  const hasAmbientAction = response.content.actions?.includes(
    'HYPERFY_AMBIENT_SPEECH'
  )
  const text = getFirstAvailableField(response.content, fieldKeys)
  if (!hasAmbientAction || !text) {
    return null
  }

  return {
    ...response.content,
    thought: response.content.thought,
    text,
    actions: ['HYPERFY_AMBIENT_SPEECH'],
  }
}

export const hyperfyAmbientSpeechAction = {
  name: 'HYPERFY_AMBIENT_SPEECH',
  similes: ['MONOLOGUE', 'OBSERVE', 'SELF_TALK', 'ENVIRONMENTAL_REMARK'],
  description:
    'Says something aloud without addressing anyone; use for idle thoughts, atmosphere, or commentary when not in conversation. Can be chained with PERCEPTION actions for immersive environmental reactions.',
  validate: async (_runtime: IAgentRuntime) => true,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const fieldKeys = ['message', 'text']

    // Handle any responses if provided (simplified for now)
    
    // Always generate new ambient speech

    state = await runtime.composeState(message, [
      ...(message.content.providers ?? []),
      'RECENT_MESSAGES',
    ])

    const prompt = composePromptFromState({
      state,
      template: ambientTemplate,
    })

    const response = await runtime.useModel(ModelType.OBJECT_LARGE, { prompt })

    const responseContent = {
      thought: (response as { thought?: string }).thought || '',
      text: (response as { message?: string }).message || '',
      actions: ['HYPERFY_AMBIENT_SPEECH'],
      source: 'hyperfy',
    }

    if (callback) {
      await callback(responseContent)
    }

    return {
      text: responseContent.text,
      success: true,
      values: { ambientSpoken: true, speechText: responseContent.text },
      data: {
        source: 'hyperfy',
        action: 'HYPERFY_AMBIENT_SPEECH',
        thought: responseContent.thought,
      },
    }
  },
  examples: [
    [
      {
        user: "I notice there's something intriguing here",
        assistant: "That floating crystal looks ancient... wonder what it's guarding.",
        content: {
          text: "That floating crystal looks ancient... wonder what it's guarding.",
          action: 'HYPERFY_AMBIENT_SPEECH',
          thought: 'I notice something intriguing in the environment - I should comment on it aloud'
        },
      },
    ],
    [
      {
        user: "The atmosphere feels notable",
        assistant: "It's peaceful here... almost too peaceful.",
        content: {
          text: "It's peaceful here... almost too peaceful.",
          action: 'HYPERFY_AMBIENT_SPEECH',
          thought: 'The atmosphere here feels notable - I should make an atmospheric observation'
        },
      },
    ],
  ] as ActionExample[][],
} as Action
