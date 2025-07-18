import { Content } from '@elizaos/core';
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
} from '@elizaos/core';

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
\`\`\``;

function getFirstAvailableField(obj: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (typeof obj[field] === 'string' && obj[field].trim() !== '') {
      return obj[field];
    }
  }
  return null;
}

function extractAmbientContent(response: Memory, fieldKeys: string[]): Content | null {
  const hasAmbientAction = response.content.actions?.includes('HYPERFY_AMBIENT_SPEECH');
  const text = getFirstAvailableField(response.content, fieldKeys);
  if (!hasAmbientAction || !text) {
    return null;
  }

  return {
    ...response.content,
    thought: response.content.thought,
    text,
    actions: ['HYPERFY_AMBIENT_SPEECH'],
  };
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
    _options: any,
    callback: HandlerCallback,
    responses?: Memory[]
  ): Promise<ActionResult> => {
    const fieldKeys = ['message', 'text'];

    const existing =
      responses
        ?.map((r) => extractAmbientContent(r, fieldKeys))
        .filter((c): c is Content => c !== null) ?? [];

    if (existing.length > 0) {
      for (const c of existing) {
        await callback(c);
      }
      return {
        text: existing[0].text || '',
        values: { ambientSpoken: true, speechText: existing[0].text },
        data: { source: 'hyperfy', action: 'HYPERFY_AMBIENT_SPEECH' },
      };
    }

    state = await runtime.composeState(message, [
      ...(message.content.providers ?? []),
      'RECENT_MESSAGES',
    ]);

    const prompt = composePromptFromState({
      state,
      template: ambientTemplate,
    });

    const response = await runtime.useModel(ModelType.OBJECT_LARGE, { prompt });

    const responseContent = {
      // @ts-ignore - Response type is unknown
      thought: response.thought,
      // @ts-ignore - Response type is unknown
      text: (response.message as string) || '',
      actions: ['HYPERFY_AMBIENT_SPEECH'],
      source: 'hyperfy',
    };

    await callback(responseContent);

    return {
      text: responseContent.text,
      values: { ambientSpoken: true, speechText: responseContent.text },
      data: {
        source: 'hyperfy',
        action: 'HYPERFY_AMBIENT_SPEECH',
        thought: responseContent.thought,
      },
    };
  },
  examples: [
    [
      {
        name: '{{agent}}',
        content: {},
      },
      {
        name: '{{agent}}',
        content: {
          thought:
            'I notice something intriguing in the environment - I should comment on it aloud',
          text: "That floating crystal looks ancient... wonder what it's guarding.",
          actions: ['HYPERFY_AMBIENT_SPEECH'],
        },
      },
    ],
    [
      {
        name: '{{agent}}',
        content: {},
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'The atmosphere here feels notable - I should make an atmospheric observation',
          text: "It's peaceful here... almost too peaceful.",
          actions: ['HYPERFY_AMBIENT_SPEECH'],
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
