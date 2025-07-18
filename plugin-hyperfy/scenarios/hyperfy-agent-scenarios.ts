import { v4 as uuid } from 'uuid';

// Define Scenario types locally until they're exported from core
interface ScenarioScript {
  steps: Array<{
    type: 'message' | 'wait' | 'action' | 'assert' | 'condition';
    content?: string;
    waitTime?: number;
    actionName?: string;
    actionParams?: any;
    assertion?: any;
    condition?: string;
    description: string;
  }>;
}

interface ScenarioActor {
  id: string;
  name: string;
  role: 'subject' | 'observer' | 'assistant' | 'adversary';
  bio?: string;
  system?: string;
  plugins?: string[];
  script?: ScenarioScript;
}

interface ScenarioVerificationRule {
  id: string;
  type: 'llm';
  description: string;
  config: {
    successCriteria: string;
    priority: 'high' | 'medium' | 'low';
    category?: string;
    context?: any;
  };
  weight?: number;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  actors: ScenarioActor[];
  setup?: {
    environment?: {
      goals?: Array<{
        id: string;
        description: string;
        priority: number;
        progress: number;
      }>;
    };
  };
  execution?: {
    maxDuration?: number;
    maxSteps?: number;
  };
  verification: {
    rules: ScenarioVerificationRule[];
  };
}

/**
 * Scenario 1: Agent Movement and Navigation
 * Tests the agent's ability to move around the 3D world
 */
export const agentMovementScenario: Scenario = {
  id: uuid(),
  name: 'Hyperfy Agent Movement Test',
  description: 'Tests agent movement, navigation, and pathfinding in a 3D world',
  category: 'integration',
  tags: ['hyperfy', 'movement', '3d-navigation'],

  actors: [
    {
      id: uuid(),
      name: 'NavigatorAgent',
      role: 'subject',
      bio: 'I am an explorer who loves to navigate 3D worlds and find interesting places.',
      system:
        'You are in a 3D virtual world. Use movement actions to explore and navigate to specific locations or entities.',
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content: 'I want to explore this world. Let me look around first.',
            description: 'Initial exploration request',
          },
          {
            type: 'wait',
            waitTime: 2000,
            description: 'Wait for perception',
          },
          {
            type: 'message',
            content: 'Can you go to the glowing crystal over there?',
            description: 'Request navigation to specific object',
          },
          {
            type: 'wait',
            waitTime: 5000,
            description: 'Wait for navigation',
          },
          {
            type: 'message',
            content: 'Now walk around randomly for a bit.',
            description: 'Test random walking',
          },
        ],
      },
    },
  ],

  verification: {
    rules: [
      {
        id: 'perception-check',
        type: 'llm',
        description: 'Verify agent used HYPERFY_SCENE_PERCEPTION to look around',
        config: {
          successCriteria:
            'Agent should have used the HYPERFY_SCENE_PERCEPTION action to observe the environment',
          priority: 'high',
        },
      },
      {
        id: 'navigation-check',
        type: 'llm',
        description: 'Verify agent navigated to requested location',
        config: {
          successCriteria: 'Agent should have used HYPERFY_GOTO_ENTITY to move to the crystal',
          priority: 'high',
        },
      },
      {
        id: 'random-walk-check',
        type: 'llm',
        description: 'Verify agent can walk randomly',
        config: {
          successCriteria: 'Agent should have used HYPERFY_WALK_RANDOMLY action',
          priority: 'medium',
        },
      },
    ],
  },
};

/**
 * Scenario 2: Agent Building and World Editing
 * Tests the agent's ability to modify the 3D world
 */
export const agentBuildingScenario: Scenario = {
  id: uuid(),
  name: 'Hyperfy Agent Building Test',
  description: 'Tests agent ability to build, edit, and modify objects in the world',
  category: 'integration',
  tags: ['hyperfy', 'building', 'world-editing'],

  actors: [
    {
      id: uuid(),
      name: 'BuilderAgent',
      role: 'subject',
      bio: 'I am a creative builder who loves to construct and modify virtual worlds.',
      system:
        'You are a builder in a 3D world. Use building actions to create, modify, and delete objects.',
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content: 'I want to build something. Can you duplicate that block over there?',
            description: 'Request object duplication',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for duplication',
          },
          {
            type: 'message',
            content: 'Now move it 5 meters to the left.',
            description: 'Request object translation',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for movement',
          },
          {
            type: 'message',
            content: 'Can you import a new sculpture at position 10, 0, 10?',
            description: 'Test importing new objects',
          },
        ],
      },
    },
  ],

  verification: {
    rules: [
      {
        id: 'duplication-check',
        type: 'llm',
        description: 'Verify agent duplicated an object',
        config: {
          successCriteria: 'Agent should have used HYPERFY_EDIT_ENTITY with duplicate operation',
          priority: 'high',
        },
      },
      {
        id: 'translation-check',
        type: 'llm',
        description: 'Verify agent moved the object',
        config: {
          successCriteria: 'Agent should have used HYPERFY_EDIT_ENTITY with translate operation',
          priority: 'high',
        },
      },
      {
        id: 'import-check',
        type: 'llm',
        description: 'Verify agent imported new object',
        config: {
          successCriteria:
            'Agent should have used HYPERFY_EDIT_ENTITY with import operation at specified position',
          priority: 'high',
        },
      },
    ],
  },
};

/**
 * Scenario 3: Agent Social Interaction
 * Tests the agent's ability to interact with other entities
 */
export const agentSocialScenario: Scenario = {
  id: uuid(),
  name: 'Hyperfy Agent Social Interaction',
  description: 'Tests agent communication, emotes, and social behaviors',
  category: 'integration',
  tags: ['hyperfy', 'social', 'communication', 'emotes'],

  actors: [
    {
      id: uuid(),
      name: 'SocialAgent',
      role: 'subject',
      bio: 'I am a friendly agent who loves to meet people and express emotions.',
      system:
        'You are a social agent in a 3D world. Use emotes and communication to interact naturally.',
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content: 'Hello everyone! *waves enthusiastically*',
            description: 'Greeting with emote',
          },
          {
            type: 'wait',
            waitTime: 2000,
            description: 'Wait for wave emote',
          },
          {
            type: 'message',
            content: 'I am so happy to be here! Let me dance!',
            description: 'Express joy with dance',
          },
          {
            type: 'wait',
            waitTime: 5000,
            description: 'Wait for dance emote',
          },
          {
            type: 'message',
            content: 'Sometimes I like to talk to myself when exploring...',
            description: 'Test ambient speech',
          },
        ],
      },
    },
    {
      id: uuid(),
      name: 'TestUser',
      role: 'assistant',
      bio: 'A user interacting with the agent',
      script: {
        steps: [
          {
            type: 'wait',
            waitTime: 1000,
            description: 'Initial wait',
          },
          {
            type: 'message',
            content: 'Hello! Nice to meet you!',
            description: 'Respond to greeting',
          },
          {
            type: 'wait',
            waitTime: 8000,
            description: 'Watch agent actions',
          },
          {
            type: 'message',
            content: 'Your dance was amazing!',
            description: 'Compliment the agent',
          },
        ],
      },
    },
  ],

  verification: {
    rules: [
      {
        id: 'wave-emote-check',
        type: 'llm',
        description: 'Verify agent used wave emote',
        config: {
          successCriteria: 'Agent should have played a waving emote when greeting',
          priority: 'high',
        },
      },
      {
        id: 'dance-emote-check',
        type: 'llm',
        description: 'Verify agent used dance emote',
        config: {
          successCriteria: 'Agent should have played a dance emote when expressing happiness',
          priority: 'high',
        },
      },
      {
        id: 'ambient-speech-check',
        type: 'llm',
        description: 'Verify agent used ambient speech',
        config: {
          successCriteria: 'Agent should have used HYPERFY_AMBIENT_SPEECH for self-directed speech',
          priority: 'medium',
        },
      },
      {
        id: 'social-response-check',
        type: 'llm',
        description: 'Verify agent responded appropriately to social cues',
        config: {
          successCriteria:
            'Agent should have responded to compliments and maintained natural conversation',
          priority: 'high',
        },
      },
    ],
  },
};

/**
 * Scenario 4: Agent Item Interaction
 * Tests the agent's ability to use and interact with items
 */
export const agentItemInteractionScenario: Scenario = {
  id: uuid(),
  name: 'Hyperfy Agent Item Interaction',
  description: 'Tests agent ability to pick up, use, and release items',
  category: 'integration',
  tags: ['hyperfy', 'items', 'interaction'],

  actors: [
    {
      id: uuid(),
      name: 'InteractionAgent',
      role: 'subject',
      bio: 'I am curious about objects and love to interact with things in the world.',
      system:
        'You are an agent who can interact with items. Use item actions to pick up and use objects.',
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content: 'I see some interesting items nearby. Let me check what is around.',
            description: 'Initial observation',
          },
          {
            type: 'wait',
            waitTime: 2000,
            description: 'Wait for perception',
          },
          {
            type: 'message',
            content: 'I want to pick up that glowing orb.',
            description: 'Request item pickup',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for item use',
          },
          {
            type: 'message',
            content: 'This is heavy, I should put it down.',
            description: 'Request item release',
          },
        ],
      },
    },
  ],

  verification: {
    rules: [
      {
        id: 'item-detection-check',
        type: 'llm',
        description: 'Verify agent detected nearby items',
        config: {
          successCriteria: 'Agent should have identified interactable items in the environment',
          priority: 'high',
        },
      },
      {
        id: 'item-use-check',
        type: 'llm',
        description: 'Verify agent picked up item',
        config: {
          successCriteria: 'Agent should have used HYPERFY_USE_ITEM to pick up the orb',
          priority: 'high',
        },
      },
      {
        id: 'item-release-check',
        type: 'llm',
        description: 'Verify agent released item',
        config: {
          successCriteria: 'Agent should have used HYPERFY_UNUSE_ITEM to release the orb',
          priority: 'high',
        },
      },
    ],
  },
};

/**
 * Scenario 5: Agent Autonomy Integration
 * Tests integration with plugin-autonomy for autonomous behaviors
 */
export const agentAutonomyScenario: Scenario = {
  id: uuid(),
  name: 'Hyperfy Agent Autonomy Integration',
  description: 'Tests autonomous agent behaviors with OODA loop integration',
  category: 'integration',
  tags: ['hyperfy', 'autonomy', 'ooda-loop'],

  actors: [
    {
      id: uuid(),
      name: 'AutonomousAgent',
      role: 'subject',
      bio: 'I am an autonomous agent with my own goals and decision-making capabilities.',
      system:
        'You are an autonomous agent with goals. Use the OODA loop to observe, orient, decide, and act in the world.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'wait',
            waitTime: 30000,
            description: 'Let autonomy system run for 30 seconds',
          },
        ],
      },
    },
  ],

  setup: {
    environment: {
      goals: [
        {
          id: uuid(),
          description: 'Explore the virtual world and catalog interesting objects',
          priority: 1,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Build a small structure in an empty area',
          priority: 2,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Interact with other entities in the world',
          priority: 3,
          progress: 0,
        },
      ],
    },
  },

  execution: {
    maxDuration: 60000,
    maxSteps: 50,
  },

  verification: {
    rules: [
      {
        id: 'autonomy-observation-check',
        type: 'llm',
        description: 'Verify agent autonomously observed environment',
        config: {
          successCriteria:
            'Agent should have used perception actions without explicit user commands',
          priority: 'high',
        },
      },
      {
        id: 'autonomy-decision-check',
        type: 'llm',
        description: 'Verify agent made autonomous decisions',
        config: {
          successCriteria: 'Agent should have decided on actions based on goals and observations',
          priority: 'high',
        },
      },
      {
        id: 'autonomy-action-check',
        type: 'llm',
        description: 'Verify agent executed autonomous actions',
        config: {
          successCriteria:
            'Agent should have performed movement, building, or interaction actions autonomously',
          priority: 'high',
        },
      },
      {
        id: 'goal-progress-check',
        type: 'llm',
        description: 'Verify agent made progress on goals',
        config: {
          successCriteria:
            'Agent should have made measurable progress on at least one defined goal',
          priority: 'medium',
        },
      },
    ],
  },
};

// Export all scenarios
export const hyperfyScenarios = [
  agentMovementScenario,
  agentBuildingScenario,
  agentSocialScenario,
  agentItemInteractionScenario,
  agentAutonomyScenario,
];

// Import autonomous exploration scenarios
export {
  autonomousMultiAgentExploration,
  autonomousExplorationWithObservation,
  autonomousExplorationSmall,
} from './hyperfy-autonomous-exploration';

// Import RPG scenarios
import {
  allRPGScenarios,
  rpgBasicScenarios,
  rpgQuestScenarios,
  rpgSelfImprovementScenarios,
} from './rpg-scenarios-index';

// Export RPG scenarios for external use
export { allRPGScenarios, rpgBasicScenarios, rpgQuestScenarios, rpgSelfImprovementScenarios };

// Combined scenario collection
const allHyperfyScenarios = [...hyperfyScenarios, ...allRPGScenarios];

export default allHyperfyScenarios;
