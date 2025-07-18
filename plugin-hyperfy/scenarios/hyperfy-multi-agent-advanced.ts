import { v4 as uuidv4 } from 'uuid';

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

export const hyperfyMultiAgentAdvancedScenario: Scenario = {
  id: uuidv4(),
  name: 'Hyperfy Multi-Agent Advanced Test',
  description: 'Tests 10 agents with autonomy plugin engaged in a Hyperfy world',
  category: 'integration',
  tags: ['hyperfy', 'multi-agent', 'autonomy', 'stress-test'],

  actors: [
    // Primary test agent with full plugins
    {
      id: uuidv4(),
      name: 'Lead Agent',
      role: 'subject',
      bio: 'I am the lead agent coordinating the group activities in the Hyperfy world.',
      system:
        'You are the lead agent in a Hyperfy virtual world. You should coordinate with other agents, explore the environment, and demonstrate autonomous behavior.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'message',
            content: "Hello everyone! I am the lead agent. Let's explore this world together.",
            description: 'Initial greeting',
          },
          {
            type: 'wait',
            waitTime: 2000,
            description: 'Wait for others to join',
          },
          {
            type: 'action',
            actionName: 'HYPERFY_SCENE_PERCEPTION',
            actionParams: {},
            description: 'Perceive the environment',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Process perception',
          },
          {
            type: 'message',
            content:
              "I can see several interesting objects around us. Let's spread out and explore!",
            description: 'Share perception results',
          },
          {
            type: 'action',
            actionName: 'HYPERFY_WALK_RANDOMLY',
            actionParams: { command: 'start' },
            description: 'Start autonomous movement',
          },
        ],
      },
    },
    // 9 autonomous agents
    ...Array.from({ length: 9 }, (_, i) => ({
      id: uuidv4(),
      name: `Agent ${i + 2}`,
      role: 'assistant' as const,
      bio: `I am agent number ${i + 2}, exploring the Hyperfy world autonomously.`,
      system:
        'You are an autonomous agent in a Hyperfy virtual world. Explore, interact with objects and other agents, and demonstrate emergent behaviors.',
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autonomy'],
      script: {
        steps: [
          {
            type: 'wait' as const,
            waitTime: 1000 + i * 500, // Staggered join times
            description: 'Wait before joining',
          },
          {
            type: 'message' as const,
            content: `Agent ${i + 2} has joined the world!`,
            description: 'Announce arrival',
          },
          {
            type: 'action' as const,
            actionName: 'HYPERFY_SCENE_PERCEPTION',
            actionParams: {},
            description: 'Initial perception',
          },
          {
            type: 'wait' as const,
            waitTime: 2000,
            description: 'Process environment',
          },
          {
            type: 'action' as const,
            actionName: 'HYPERFY_WALK_RANDOMLY',
            actionParams: { command: 'start', interval: 5000 + i * 1000 },
            description: 'Start autonomous exploration',
          },
          {
            type: 'condition' as const,
            condition: 'Math.random() > 0.5',
            description: 'Randomly decide to interact',
          },
          {
            type: 'action' as const,
            actionName: 'HYPERFY_AMBIENT_SPEECH',
            actionParams: {},
            description: 'Speak autonomously',
          },
        ],
      },
    })),
  ],

  setup: {
    environment: {
      HYPERFY_WS_URL: process.env.HYPERFY_TEST_URL || 'wss://test.hyperfy.xyz/ws',
      ENABLE_AUTONOMY: 'true',
      MAX_AGENTS: '10',
    },
  },

  execution: {
    maxDuration: 300000, // 5 minutes
    maxSteps: 500,
    stopConditions: [
      {
        type: 'custom',
        value: 'all_agents_moving',
        description: 'Stop when all agents are moving autonomously',
      },
    ],
  },

  verification: {
    rules: [
      {
        id: 'all-agents-connected',
        type: 'llm',
        description: 'Verify all 10 agents successfully connected to the world',
        config: {
          successCriteria:
            'All 10 agents should successfully connect to the Hyperfy world and appear as entities',
          priority: 'critical',
          category: 'functionality',
        },
        weight: 2.0,
      },
      {
        id: 'autonomous-movement',
        type: 'llm',
        description: 'Verify agents are moving autonomously',
        config: {
          successCriteria:
            'Each agent should demonstrate autonomous movement patterns using HYPERFY_WALK_RANDOMLY',
          priority: 'high',
          category: 'functionality',
        },
        weight: 1.5,
      },
      {
        id: 'perception-working',
        type: 'llm',
        description: 'Verify scene perception is functioning',
        config: {
          successCriteria:
            'Agents should successfully perceive their environment and describe what they see',
          priority: 'high',
          category: 'functionality',
        },
        weight: 1.5,
      },
      {
        id: 'agent-interactions',
        type: 'llm',
        description: 'Verify agents interact with each other',
        config: {
          successCriteria:
            "Agents should acknowledge each other's presence and potentially engage in conversations",
          priority: 'medium',
          category: 'integration',
        },
        weight: 1.0,
      },
      {
        id: 'no-collisions',
        type: 'llm',
        description: 'Verify agents avoid collisions',
        config: {
          successCriteria:
            'Agents should navigate the world without getting stuck or colliding excessively',
          priority: 'medium',
          category: 'performance',
        },
        weight: 1.0,
      },
      {
        id: 'avatar-changes',
        type: 'llm',
        description: 'Verify avatar system is working',
        config: {
          successCriteria:
            'At least some agents should have unique avatars or appearance characteristics',
          priority: 'low',
          category: 'functionality',
        },
        weight: 0.5,
      },
      {
        id: 'performance-stable',
        type: 'llm',
        description: 'Verify system remains stable with 10 agents',
        config: {
          successCriteria:
            'The system should handle 10 concurrent agents without crashes or significant lag',
          priority: 'high',
          category: 'performance',
        },
        weight: 2.0,
      },
      {
        id: 'emergent-behaviors',
        type: 'llm',
        description: 'Verify emergent autonomous behaviors',
        config: {
          successCriteria:
            'Agents should demonstrate emergent behaviors beyond scripted actions, showing true autonomy',
          priority: 'medium',
          category: 'integration',
          context: {
            expectedBehaviors: [
              'Agents forming groups',
              'Agents exploring different areas',
              "Agents reacting to each other's actions",
              'Agents making independent decisions',
            ],
          },
        },
        weight: 1.5,
      },
    ],
  },
};
