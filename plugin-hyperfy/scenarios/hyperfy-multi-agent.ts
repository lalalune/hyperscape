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

interface ScenarioSetup {
  environment?: Record<string, any>;
}

interface ScenarioExecution {
  maxDuration?: number;
  maxSteps?: number;
  stopConditions?: Array<{
    type: string;
    value: string;
    description: string;
  }>;
}

interface ScenarioVerificationRule {
  id: string;
  type: 'llm';
  description: string;
  config: {
    successCriteria: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
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
  setup?: ScenarioSetup;
  execution?: ScenarioExecution;
  verification: {
    rules: ScenarioVerificationRule[];
  };
}

export const multiAgentAutonomyScenario: Scenario = {
  id: '5a8c3d2e-7f91-4b3c-9e4a-8b2c6d1f0e3a',
  name: 'Multi-Agent Autonomy Test',
  description: 'Tests 10 agents in a Hyperfy world with autonomy enabled',
  category: 'integration',
  tags: ['multi-agent', 'hyperfy', 'autonomy', 'stress-test'],

  actors: [
    // Primary agent being tested
    {
      id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      name: 'Agent Alpha',
      role: 'subject',
      bio: 'The leader agent who explores and coordinates with others',
      system:
        'You are Agent Alpha, the leader of a group exploring a virtual world. Guide your team, explore the environment, and interact with objects you find.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'message',
            content: "Everyone, let's explore this world together! I'll take the north side.",
            description: 'Initial coordination message',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for other agents to respond',
          },
          {
            type: 'message',
            content: 'I see some interesting structures ahead. Moving to investigate.',
            description: 'Exploration update',
          },
        ],
      },
    },
    // Supporting agents
    {
      id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
      name: 'Agent Beta',
      role: 'assistant',
      bio: 'A curious explorer who loves finding hidden objects',
      system:
        "You are Agent Beta, an explorer in a virtual world. Follow Agent Alpha's lead but also explore on your own. Report any interesting findings.",
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'wait',
            waitTime: 1000,
            description: 'Wait before responding',
          },
          {
            type: 'message',
            content: "Copy that Alpha! I'll check the eastern area.",
            description: 'Acknowledge leader',
          },
          {
            type: 'wait',
            waitTime: 5000,
            description: 'Explore for a bit',
          },
          {
            type: 'message',
            content: 'Found some glowing crystals here! They seem interactive.',
            description: 'Report finding',
          },
        ],
      },
    },
    {
      id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
      name: 'Agent Gamma',
      role: 'assistant',
      bio: 'A technical analyst who examines world mechanics',
      system:
        'You are Agent Gamma, focused on understanding how things work in this virtual world. Test interactions and report your findings.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'wait',
            waitTime: 1500,
            description: 'Wait before responding',
          },
          {
            type: 'message',
            content: "I'll analyze the world mechanics and test interactions.",
            description: 'State purpose',
          },
        ],
      },
    },
    {
      id: '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f90',
      name: 'Agent Delta',
      role: 'assistant',
      bio: 'A social coordinator who keeps the team connected',
      system:
        "You are Agent Delta, responsible for team coordination. Keep track of where everyone is and what they're doing.",
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'wait',
            waitTime: 2000,
            description: 'Wait before responding',
          },
          {
            type: 'message',
            content: "I'll keep track of everyone's positions and findings.",
            description: 'State role',
          },
        ],
      },
    },
    {
      id: '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9012',
      name: 'Agent Epsilon',
      role: 'assistant',
      bio: 'An artist who appreciates the aesthetics of virtual worlds',
      system:
        'You are Agent Epsilon, interested in the visual and aesthetic aspects of the world. Comment on what looks interesting or beautiful.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
    },
    {
      id: '6f7a8b9c-0d1e-2f3a-4b5c-6d7e8f901234',
      name: 'Agent Zeta',
      role: 'assistant',
      bio: 'A builder who wants to create structures',
      system:
        'You are Agent Zeta, a builder. Look for opportunities to build or modify the environment.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
    },
    {
      id: '7a8b9c0d-1e2f-3a4b-5c6d-7e8f90123456',
      name: 'Agent Eta',
      role: 'assistant',
      bio: 'A scout who explores distant areas',
      system:
        'You are Agent Eta, a scout. Explore the far reaches of the world and report back unusual findings.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
    },
    {
      id: '8b9c0d1e-2f3a-4b5c-6d7e-8f9012345678',
      name: 'Agent Theta',
      role: 'assistant',
      bio: 'A researcher documenting the world',
      system:
        "You are Agent Theta, documenting everything you see. Take notes about the world's features.",
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
    },
    {
      id: '9c0d1e2f-3a4b-5c6d-7e8f-901234567890',
      name: 'Agent Iota',
      role: 'assistant',
      bio: 'A guardian watching for dangers',
      system:
        'You are Agent Iota, watching for any dangers or threats in the world. Keep the team safe.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
    },
    {
      id: '0d1e2f3a-4b5c-6d7e-8f90-123456789012',
      name: 'Agent Kappa',
      role: 'assistant',
      bio: 'An entertainer who keeps morale high',
      system: "You are Agent Kappa, keeping the team's spirits up with humor and observations.",
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
    },
  ],

  setup: {
    environment: {
      HYPERFY_WS_URL: 'wss://multi-agent-test.hyperfy.xyz/ws',
      ENABLE_AUTONOMY: 'true',
      AUTONOMY_INTERVAL: '5000',
    },
  },

  execution: {
    maxDuration: 300000, // 5 minutes
    maxSteps: 100,
    stopConditions: [
      {
        type: 'custom',
        value: 'all_agents_explored',
        description: 'Stop when all agents have explored their areas',
      },
    ],
  },

  verification: {
    rules: [
      {
        id: 'multi-agent-connection',
        type: 'llm',
        description: 'Verify all 10 agents successfully connected to the world',
        config: {
          successCriteria:
            'All 10 agents should successfully connect to the Hyperfy world and appear at different spawn positions',
          priority: 'critical',
          category: 'connectivity',
        },
      },
      {
        id: 'autonomous-behavior',
        type: 'llm',
        description: 'Verify agents exhibit autonomous behavior',
        config: {
          successCriteria:
            'Agents should move around, explore, and interact with the world without explicit commands, showing autonomous decision-making',
          priority: 'high',
          category: 'autonomy',
        },
      },
      {
        id: 'agent-coordination',
        type: 'llm',
        description: 'Verify agents coordinate with each other',
        config: {
          successCriteria:
            'Agents should communicate with each other, share findings, and coordinate their exploration efforts',
          priority: 'high',
          category: 'collaboration',
        },
      },
      {
        id: 'world-interaction',
        type: 'llm',
        description: 'Verify agents interact with world objects',
        config: {
          successCriteria:
            'Agents should find and interact with objects in the world, using appropriate actions like goto, use, and perception',
          priority: 'medium',
          category: 'interaction',
        },
      },
      {
        id: 'performance-stability',
        type: 'llm',
        description: 'Verify system remains stable with 10 agents',
        config: {
          successCriteria:
            'The system should remain stable and responsive with 10 agents active, without crashes or significant performance degradation',
          priority: 'high',
          category: 'performance',
        },
      },
      {
        id: 'unique-behaviors',
        type: 'llm',
        description: 'Verify each agent exhibits unique behavior based on their role',
        config: {
          successCriteria:
            'Each agent should act according to their defined role and personality, showing distinct behaviors and interests',
          priority: 'medium',
          category: 'personality',
        },
      },
    ],
  },
};
