/**
 * Autonomous Multi-Agent Exploration Scenario
 *
 * This scenario spawns multiple autonomous agents in a Hyperfy world
 * and observes their exploration behavior for 1 minute.
 *
 * Prerequisites:
 * - Hyperfy server running locally (cd hyperfy && npm run dev)
 * - Plugin-autonomy and plugin-hyperfy installed
 *
 * To run with observation window:
 * ENABLE_OBSERVATION_WINDOW=true elizaos scenario run scenarios/hyperfy-autonomous-exploration.ts
 */

import { v4 as uuid } from 'uuid';

// Define local types until exported from core
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
    priority?: 'critical' | 'high' | 'medium' | 'low';
    category?: string;
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

// Helper to create explorer agents with different personalities
function createExplorerAgent(
  name: string,
  personality: string,
  systemPrompt: string
): ScenarioActor {
  return {
    id: uuid(),
    name,
    role: 'subject',
    bio: personality,
    system: systemPrompt,
    plugins: ['@elizaos/plugin-autonomy', '@elizaos/plugin-hyperfy'],
    script: {
      steps: [
        {
          type: 'message',
          content: `${name} reporting for exploration duty!`,
          description: 'Initial announcement',
        },
        {
          type: 'wait',
          waitTime: 60000, // Explore for 1 minute
          description: 'Autonomous exploration period',
        },
      ],
    },
  };
}

/**
 * Main Scenario: 10 Autonomous Agents Exploring
 */
export const autonomousMultiAgentExploration: Scenario = {
  id: uuid(),
  name: 'Autonomous Multi-Agent Exploration',
  description: 'Tests 10 autonomous agents exploring a Hyperfy world simultaneously for 1 minute',
  category: 'stress-test',
  tags: ['hyperfy', 'autonomy', 'multi-agent', 'exploration', 'performance'],

  actors: [
    // Create 10 unique explorer agents
    createExplorerAgent(
      'Explorer-Alpha',
      'Lead explorer who loves to discover new areas',
      'You are the lead explorer. Use OODA loop to systematically explore the world. Focus on finding interesting landmarks and mapping the area.'
    ),
    createExplorerAgent(
      'Explorer-Beta',
      'Social explorer who seeks other agents',
      'You are a social explorer. Use OODA loop to find and interact with other agents. When you see another agent, approach them and communicate.'
    ),
    createExplorerAgent(
      'Explorer-Gamma',
      'Builder who marks discoveries',
      'You are a builder explorer. Use OODA loop to explore and occasionally build markers at interesting locations using HYPERFY_EDIT_ENTITY.'
    ),
    createExplorerAgent(
      'Explorer-Delta',
      'Speed explorer covering maximum ground',
      'You are a fast explorer. Use OODA loop to cover as much ground as possible. Prioritize speed and distance over detailed observation.'
    ),
    createExplorerAgent(
      'Explorer-Epsilon',
      'Detail-oriented methodical explorer',
      'You are a methodical explorer. Use OODA loop to carefully examine each area. Take your time to observe details before moving on.'
    ),
    createExplorerAgent(
      'Explorer-Zeta',
      'Vertical explorer seeking heights',
      'You are a climbing explorer. Use OODA loop to find and reach the highest points in the world. Look for mountains, towers, or elevated areas.'
    ),
    createExplorerAgent(
      'Explorer-Eta',
      'Collector searching for items',
      'You are a collector explorer. Use OODA loop to find and collect interesting items using HYPERFY_USE_ITEM. Build a collection.'
    ),
    createExplorerAgent(
      'Explorer-Theta',
      'Performer expressing through emotes',
      'You are an expressive explorer. Use OODA loop to explore while performing emotes at interesting locations. Express your discoveries.'
    ),
    createExplorerAgent(
      'Explorer-Iota',
      'Boundary tester finding limits',
      'You are a boundary explorer. Use OODA loop to find the edges and limits of the world. Test what is possible and what is not.'
    ),
    createExplorerAgent(
      'Explorer-Kappa',
      'Observer documenting discoveries',
      'You are an observer explorer. Use OODA loop to watch other agents and document interesting behaviors. Take notes on what you observe.'
    ),
  ],

  setup: {
    environment: {
      goals: [
        {
          id: uuid(),
          description: 'Explore and map the virtual world',
          priority: 1,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Interact with other agents encountered',
          priority: 2,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Discover and document interesting locations',
          priority: 3,
          progress: 0,
        },
      ],
    },
  },

  execution: {
    maxDuration: 90000, // 1.5 minutes total (including setup/teardown)
    maxSteps: 1000, // Allow many autonomous actions
  },

  verification: {
    rules: [
      {
        id: 'all-agents-connected',
        type: 'llm',
        description: 'Verify all 10 agents connected successfully',
        config: {
          successCriteria:
            'All 10 explorer agents should have successfully connected to the Hyperfy world and announced their presence',
          priority: 'critical',
          category: 'connectivity',
        },
      },
      {
        id: 'autonomous-behavior-active',
        type: 'llm',
        description: 'Verify autonomous OODA loops are functioning',
        config: {
          successCriteria:
            'Each agent should demonstrate autonomous behavior through the OODA loop: Observing (using HYPERFY_SCENE_PERCEPTION), Orienting (processing information), Deciding (choosing actions), and Acting (executing movements or interactions)',
          priority: 'high',
          category: 'autonomy',
        },
      },
      {
        id: 'movement-exploration',
        type: 'llm',
        description: 'Verify agents explored the world',
        config: {
          successCriteria:
            'Agents should have moved to different locations using HYPERFY_GOTO_ENTITY or HYPERFY_WALK_RANDOMLY. They should not remain stationary.',
          priority: 'high',
          category: 'exploration',
        },
      },
      {
        id: 'diverse-behaviors',
        type: 'llm',
        description: 'Verify different agent personalities resulted in different behaviors',
        config: {
          successCriteria:
            'Different agents should exhibit their unique behaviors: Alpha should explore systematically, Beta should seek other agents, Gamma should build markers, Delta should move quickly, etc.',
          priority: 'medium',
          category: 'diversity',
        },
      },
      {
        id: 'multi-agent-interactions',
        type: 'llm',
        description: 'Verify agents interacted with each other',
        config: {
          successCriteria:
            'At least some agents should have noticed and interacted with other agents, especially Explorer-Beta (the social explorer)',
          priority: 'medium',
          category: 'social',
        },
      },
      {
        id: 'performance-stability',
        type: 'llm',
        description: 'Verify system handled 10 concurrent agents',
        config: {
          successCriteria:
            'The system should remain stable with 10 agents running simultaneously. No crashes, disconnections, or severe performance degradation should occur.',
          priority: 'high',
          category: 'performance',
        },
      },
      {
        id: 'action-variety',
        type: 'llm',
        description: 'Verify variety of Hyperfy actions were used',
        config: {
          successCriteria:
            'Agents should have used various Hyperfy actions including movement (GOTO, WALK_RANDOMLY), perception (SCENE_PERCEPTION), and potentially building (EDIT_ENTITY), items (USE_ITEM), or emotes',
          priority: 'medium',
          category: 'actions',
        },
      },
    ],
  },
};

// Export additional test configurations
export const autonomousExplorationWithObservation: Scenario = {
  ...autonomousMultiAgentExploration,
  id: uuid(),
  name: 'Autonomous Exploration with Puppeteer Observation',
  description: 'Same as multi-agent exploration but with visual observation window',
  tags: [...autonomousMultiAgentExploration.tags, 'visual-observation'],
};

// Smaller test with fewer agents for debugging
export const autonomousExplorationSmall: Scenario = {
  ...autonomousMultiAgentExploration,
  id: uuid(),
  name: 'Autonomous Exploration (3 Agents)',
  description: 'Smaller test with only 3 agents for debugging',
  tags: [...autonomousMultiAgentExploration.tags, 'debug'],
  actors: autonomousMultiAgentExploration.actors.slice(0, 3),
};
