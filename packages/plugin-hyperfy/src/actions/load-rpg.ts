import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Content,
  ActionExample,
} from '@elizaos/core'

export const loadRPGAction: Action = {
  name: 'LOAD_RPG',
  description: 'Load an RPG content pack into the current Hyperfy world',
  
  similes: [
    'load rpg',
    'start rpg',
    'activate rpg',
    'enable rpg mode',
    'load game mode',
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    return true; // Basic validation
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      // Mock implementation for testing
      if (callback) {
        callback({
          text: 'RPG content pack loaded successfully',
          type: 'success'
        });
      }
    } catch (error) {
      if (callback) {
        callback({
          text: `Failed to load RPG: ${error.message}`,
          type: 'error'
        });
      }
    }
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Load the RPG game mode' },
      } as ActionExample,
      {
        name: '{{agentName}}',
        content: { text: 'Loading RPG content pack...' },
      } as ActionExample,
    ],
  ],
} 