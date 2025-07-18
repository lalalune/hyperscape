import { v4 as uuid } from 'uuid';

// RPG-specific scenario types
interface RPGScenarioScript {
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

interface RPGScenarioActor {
  id: string;
  name: string;
  role: 'subject' | 'observer' | 'assistant' | 'adversary';
  bio?: string;
  system?: string;
  plugins?: string[];
  script?: RPGScenarioScript;
}

interface RPGScenarioVerificationRule {
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

interface RPGScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  actors: RPGScenarioActor[];
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
    rules: RPGScenarioVerificationRule[];
  };
}

/**
 * Scenario 1: Basic RPG Connection Test
 * Tests that an agent can connect to the Hyperfy RPG world and perform basic actions
 */
export const basicRPGConnectionScenario: RPGScenario = {
  id: uuid(),
  name: 'Basic RPG Connection Test',
  description: 'Tests agent connection to Hyperfy RPG world and basic action execution',
  category: 'rpg-integration',
  tags: ['hyperfy', 'rpg', 'connection', 'basic'],

  actors: [
    {
      id: uuid(),
      name: 'RPGTestAgent',
      role: 'subject',
      bio: 'I am a brave adventurer starting my journey in the RPG world. I love exploring, fighting monsters, and leveling up my skills.',
      system: `You are an RPG player character in a RuneScape-like world. Your goal is to:
1. Connect to the world and look around
2. Move to a nearby location 
3. Pick up an item
4. Successfully demonstrate basic world interaction

Use the available Hyperfy actions to interact with the world. Be methodical and report what you observe.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I want to start my RPG adventure! Let me look around and see what is in this world.',
            description: 'Initial world perception',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for perception to complete',
          },
          {
            type: 'message',
            content:
              'Now I should move to explore the area. Let me walk around to see what is nearby.',
            description: 'Request basic movement',
          },
          {
            type: 'wait',
            waitTime: 5000,
            description: 'Wait for movement',
          },
          {
            type: 'message',
            content: 'Let me look for any items I can pick up to start my inventory.',
            description: 'Look for items to interact with',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for item search',
          },
          {
            type: 'message',
            content: 'If I see any items, I will try to pick one up.',
            description: 'Attempt item interaction',
          },
        ],
      },
    },
  ],

  execution: {
    maxDuration: 30000, // 30 seconds
    maxSteps: 20,
  },

  verification: {
    rules: [
      {
        id: 'world-connection-check',
        type: 'llm',
        description: 'Verify agent successfully connected to RPG world',
        config: {
          successCriteria:
            'Agent should have successfully connected to the Hyperfy RPG world, demonstrated at least 4 total actions, used HYPERFY_SCENE_PERCEPTION at least twice, and shown either movement or communication capabilities',
          priority: 'high',
          category: 'connection',
        },
      },
      {
        id: 'perception-check',
        type: 'llm',
        description: 'Verify agent used scene perception',
        config: {
          successCriteria:
            'Agent should have used HYPERFY_SCENE_PERCEPTION multiple times to observe entities, NPCs, other agents, and items in the RPG world environment',
          priority: 'high',
          category: 'perception',
        },
      },
      {
        id: 'movement-check',
        type: 'llm',
        description: 'Verify agent moved in the world',
        config: {
          successCriteria:
            'Agent should have attempted movement using HYPERFY_WALK_RANDOMLY, HYPERFY_GOTO_ENTITY, or demonstrated movement by changing position coordinates significantly',
          priority: 'medium',
          category: 'movement',
        },
      },
      {
        id: 'item-interaction-check',
        type: 'llm',
        description: 'Verify agent attempted item interaction',
        config: {
          successCriteria:
            'Agent should have attempted to interact with items using HYPERFY_USE_ITEM if items were available',
          priority: 'medium',
          category: 'interaction',
        },
      },
      {
        id: 'rpg-awareness-check',
        type: 'llm',
        description: 'Verify agent demonstrated RPG game awareness',
        config: {
          successCriteria:
            'Agent should have demonstrated understanding that this is an RPG world with items, movement, and exploration mechanics',
          priority: 'medium',
          category: 'rpg-understanding',
        },
      },
    ],
  },
};

/**
 * Scenario 2: Single Player Level-Up Challenge
 * Agent must reach level 2 within 10 minutes by completing basic tasks
 */
export const singlePlayerLevelUpScenario: RPGScenario = {
  id: uuid(),
  name: 'Single Player Level-Up Challenge',
  description: 'Agent must reach level 2 within 10 minutes through RPG gameplay',
  category: 'rpg-progression',
  tags: ['hyperfy', 'rpg', 'leveling', 'single-player', 'progression'],

  actors: [
    {
      id: uuid(),
      name: 'LevelUpAgent',
      role: 'subject',
      bio: 'I am an ambitious RPG player who wants to level up quickly. I understand that I need to complete quests, fight monsters, and gain experience to advance.',
      system: `You are an RPG player with a specific goal: reach level 2 within 10 minutes.

To level up, you need to:
1. Find and fight monsters (like goblins) for combat experience
2. Complete simple quests for experience rewards
3. Gather resources or items that provide experience
4. Look for NPCs who might give you quests or tasks

Be proactive and strategic. Focus on gaining experience points efficiently. The world has RuneScape-like mechanics, so look for:
- Goblins or other low-level monsters to fight
- NPCs with quests (they might be marked or have dialogue)
- Resources to gather (trees, rocks, etc.)
- Quest items or objectives

You have 10 minutes - be efficient and goal-oriented!`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I need to reach level 2 within 10 minutes! Let me start by exploring to find monsters, NPCs, or quests.',
            description: 'Begin level-up challenge',
          },
          {
            type: 'wait',
            waitTime: 2000,
            description: 'Initial observation',
          },
          {
            type: 'message',
            content: 'Let me look for goblins or other monsters I can fight for experience.',
            description: 'Search for combat targets',
          },
        ],
      },
    },
  ],

  execution: {
    maxDuration: 600000, // 10 minutes
    maxSteps: 200,
  },

  verification: {
    rules: [
      {
        id: 'level-progression-check',
        type: 'llm',
        description: 'Verify agent reached level 2',
        config: {
          successCriteria:
            'Agent should have reached level 2 or gained significant experience points toward level 2',
          priority: 'high',
          category: 'progression',
        },
      },
      {
        id: 'combat-engagement-check',
        type: 'llm',
        description: 'Verify agent engaged in combat',
        config: {
          successCriteria: 'Agent should have found and fought monsters for combat experience',
          priority: 'high',
          category: 'combat',
        },
      },
      {
        id: 'quest-completion-check',
        type: 'llm',
        description: 'Verify agent completed or attempted quests',
        config: {
          successCriteria:
            'Agent should have found and attempted to complete quests for experience',
          priority: 'medium',
          category: 'quests',
        },
      },
      {
        id: 'strategic-gameplay-check',
        type: 'llm',
        description: 'Verify agent demonstrated strategic thinking',
        config: {
          successCriteria:
            'Agent should have shown efficient, goal-oriented behavior focused on gaining experience',
          priority: 'medium',
          category: 'strategy',
        },
      },
      {
        id: 'rpg-mechanics-check',
        type: 'llm',
        description: 'Verify agent understood RPG mechanics',
        config: {
          successCriteria:
            'Agent should have demonstrated understanding of experience, levels, combat, and progression mechanics',
          priority: 'high',
          category: 'rpg-understanding',
        },
      },
    ],
  },
};

// Export scenarios
export const rpgBasicScenarios = [basicRPGConnectionScenario, singlePlayerLevelUpScenario];

export default rpgBasicScenarios;
