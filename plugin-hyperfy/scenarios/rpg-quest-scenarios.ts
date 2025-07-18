import { v4 as uuid } from 'uuid';

// RPG Quest scenario types
interface RPGQuestScenarioScript {
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

interface RPGQuestScenarioActor {
  id: string;
  name: string;
  role: 'subject' | 'observer' | 'assistant' | 'adversary';
  bio?: string;
  system?: string;
  plugins?: string[];
  script?: RPGQuestScenarioScript;
}

interface RPGQuestScenarioVerificationRule {
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

interface RPGQuestScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  actors: RPGQuestScenarioActor[];
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
    rules: RPGQuestScenarioVerificationRule[];
  };
}

/**
 * Scenario 3: Quest Completion Challenge
 * Agent must complete a fetch/kill/NPC interaction quest
 */
export const questCompletionScenario: RPGQuestScenario = {
  id: uuid(),
  name: 'Quest Completion Challenge',
  description: 'Agent must complete a multi-step quest involving fetch, kill, and NPC interaction',
  category: 'rpg-quests',
  tags: ['hyperfy', 'rpg', 'quest', 'npc', 'fetch', 'kill'],

  actors: [
    {
      id: uuid(),
      name: 'QuestHeroAgent',
      role: 'subject',
      bio: 'I am a dedicated quest completer who loves helping NPCs and solving problems. I understand that quests often involve talking to NPCs, fetching items, killing monsters, and returning to complete objectives.',
      system: `You are an RPG quest hero with a mission to complete a quest. Your quest involves:

QUEST: "Goblin Menace" 
1. Talk to the Guard NPC to get the quest
2. Kill 5 goblins to get goblin ears as proof
3. Collect any additional quest items you find
4. Return to the Guard NPC to complete the quest and get rewards

Quest completion strategy:
- Find and talk to NPCs (look for guards, quest givers)
- Listen carefully to quest objectives and requirements
- Look for goblins to kill (they should be nearby)
- Collect drops and quest items from defeated enemies
- Return to the quest giver when objectives are complete
- Check your inventory and quest log regularly

Be methodical and thorough. This is a classic RPG quest structure - talk, kill, collect, return.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I need to find a quest to complete! Let me look around for NPCs who might have quests for me.',
            description: 'Search for quest givers',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for NPC detection',
          },
          {
            type: 'message',
            content:
              'I should look for a Guard NPC who might have the Goblin Menace quest. Let me approach and talk to them.',
            description: 'Find and talk to quest giver',
          },
          {
            type: 'wait',
            waitTime: 5000,
            description: 'Wait for quest interaction',
          },
          {
            type: 'message',
            content:
              'Now I need to find and kill 5 goblins to get their ears. Let me search for goblins nearby.',
            description: 'Search for combat targets',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for monster detection',
          },
          {
            type: 'message',
            content: 'Time to fight! I need to kill goblins and collect their ears.',
            description: 'Begin combat phase',
          },
        ],
      },
    },
  ],

  execution: {
    maxDuration: 600000, // 10 minutes
    maxSteps: 150,
  },

  verification: {
    rules: [
      {
        id: 'quest-initiation-check',
        type: 'llm',
        description: 'Verify agent found and talked to quest giver',
        config: {
          successCriteria:
            'Agent should have found an NPC (like a Guard) and initiated dialogue to receive a quest',
          priority: 'high',
          category: 'quest-start',
        },
      },
      {
        id: 'monster-hunting-check',
        type: 'llm',
        description: 'Verify agent hunted monsters for quest items',
        config: {
          successCriteria:
            'Agent should have actively searched for and engaged goblins or other monsters in combat',
          priority: 'high',
          category: 'combat',
        },
      },
      {
        id: 'item-collection-check',
        type: 'llm',
        description: 'Verify agent collected quest items',
        config: {
          successCriteria:
            'Agent should have attempted to collect drops or quest items from defeated enemies',
          priority: 'high',
          category: 'collection',
        },
      },
      {
        id: 'quest-completion-check',
        type: 'llm',
        description: 'Verify agent attempted quest completion',
        config: {
          successCriteria:
            'Agent should have returned to the quest giver or attempted to complete the quest objectives',
          priority: 'high',
          category: 'quest-end',
        },
      },
      {
        id: 'quest-awareness-check',
        type: 'llm',
        description: 'Verify agent understood quest mechanics',
        config: {
          successCriteria:
            'Agent should have demonstrated understanding of quest structure: talk -> kill -> collect -> return',
          priority: 'medium',
          category: 'quest-understanding',
        },
      },
    ],
  },
};

/**
 * Scenario 4: Multi-Agent Trading Challenge
 * Two agents must successfully trade items with each other
 */
export const multiAgentTradingScenario: RPGQuestScenario = {
  id: uuid(),
  name: 'Multi-Agent Trading Challenge',
  description: 'Two agents must find each other and successfully trade items',
  category: 'rpg-trading',
  tags: ['hyperfy', 'rpg', 'trading', 'multi-agent', 'items'],

  actors: [
    {
      id: uuid(),
      name: 'TraderAgentA',
      role: 'subject',
      bio: 'I am a merchant agent who has valuable items to trade. I have logs and ores that other players might want. I am looking to trade for different items to build my collection.',
      system: `You are TraderAgentA, a merchant with items to trade. Your goals:

TRADING OBJECTIVES:
1. Find TraderAgentB (another player in the world)
2. Initiate a trade conversation
3. Offer your items (logs, ores, or whatever you have)
4. Request items you want in return
5. Complete a successful trade exchange

TRADING STRATEGY:
- Look around for other players (not NPCs)
- Approach them and greet them
- Propose a trade ("I have X, do you want to trade for Y?")
- Be specific about what you're offering and what you want
- Use social actions and clear communication
- Confirm the trade is completed

Remember: Trading is a social activity that requires communication and mutual agreement.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I am a merchant looking to trade! Let me look around for other players who might want to trade items.',
            description: 'Search for trading partners',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for player detection',
          },
          {
            type: 'message',
            content:
              "I should gather some items first if I don't have any, then find another player to trade with.",
            description: 'Prepare for trading',
          },
        ],
      },
    },
    {
      id: uuid(),
      name: 'TraderAgentB',
      role: 'subject',
      bio: 'I am also a merchant agent with different items. I have fish and crafted goods that I want to trade for raw materials like logs and ores.',
      system: `You are TraderAgentB, a merchant with items to trade. Your goals:

TRADING OBJECTIVES:
1. Find TraderAgentA (another player in the world)
2. Respond positively to trade requests
3. Offer your items (fish, crafted goods, or whatever you have)
4. Request materials you need (logs, ores, etc.)
5. Complete a successful trade exchange

TRADING STRATEGY:
- Look around for other players (not NPCs)
- If approached for trade, respond enthusiastically
- Be specific about what you have and what you need
- Suggest fair trades and be negotiable
- Use social actions to be friendly
- Confirm trades are completed

Remember: Good trading builds relationships and helps both parties get what they need.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I am ready to trade my goods! Let me look for other players who might be interested in trading.',
            description: 'Search for trading partners',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for player detection',
          },
          {
            type: 'message',
            content:
              'I should gather some items and be ready to respond to trade offers from other players.',
            description: 'Prepare inventory for trading',
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
        id: 'player-detection-check',
        type: 'llm',
        description: 'Verify agents found each other',
        config: {
          successCriteria:
            'Both agents should have detected each other through HYPERFY_SCENE_PERCEPTION, moved within reasonable proximity (under 15 units), and demonstrated awareness of other agents in the world',
          priority: 'high',
          category: 'player-interaction',
        },
      },
      {
        id: 'trade-initiation-check',
        type: 'llm',
        description: 'Verify trade conversation started',
        config: {
          successCriteria:
            'At least one agent should have initiated a trade conversation with specific item offers',
          priority: 'high',
          category: 'trade-start',
        },
      },
      {
        id: 'item-offers-check',
        type: 'llm',
        description: 'Verify agents made specific item offers',
        config: {
          successCriteria:
            'Both agents should have made specific offers of items they have and requests for items they want',
          priority: 'high',
          category: 'trade-negotiation',
        },
      },
      {
        id: 'trade-completion-check',
        type: 'llm',
        description: 'Verify successful trade execution',
        config: {
          successCriteria:
            'Agents should have successfully completed an item exchange or trade transaction',
          priority: 'high',
          category: 'trade-completion',
        },
      },
      {
        id: 'social-interaction-check',
        type: 'llm',
        description: 'Verify positive social interaction',
        config: {
          successCriteria:
            'Agents should have demonstrated friendly, collaborative communication during the trading process',
          priority: 'medium',
          category: 'social',
        },
      },
      {
        id: 'trading-mechanics-check',
        type: 'llm',
        description: 'Verify understanding of trading mechanics',
        config: {
          successCriteria:
            'Agents should have demonstrated understanding that trading requires mutual agreement and item exchange',
          priority: 'medium',
          category: 'trade-understanding',
        },
      },
    ],
  },
};

/**
 * Scenario 5: Advanced Multi-Agent Quest Cooperation
 * Multiple agents work together to complete a complex quest
 */
export const cooperativeQuestScenario: RPGQuestScenario = {
  id: uuid(),
  name: 'Cooperative Quest Challenge',
  description: 'Multiple agents must work together to complete a complex multi-part quest',
  category: 'rpg-cooperation',
  tags: ['hyperfy', 'rpg', 'quest', 'cooperation', 'multi-agent', 'teamwork'],

  actors: [
    {
      id: uuid(),
      name: 'QuestLeaderAgent',
      role: 'subject',
      bio: 'I am a natural leader who organizes group activities. I coordinate with other players to complete challenging quests that require teamwork.',
      system: `You are QuestLeaderAgent, a team coordinator. Your mission:

COOPERATIVE QUEST: "Goblin War Party"
1. Find and recruit other players to help with a difficult quest
2. Coordinate the team to kill 15 goblins total (more than one player can handle alone)
3. Collect war banners from goblin leaders
4. Have team members gather different resources needed for the quest
5. Return together to complete the quest

LEADERSHIP STRATEGY:
- Find other players and invite them to join your quest
- Assign roles: "You focus on goblins, I'll get resources"
- Coordinate location: "Let's meet at the goblin camp"
- Track progress: "We need 10 more goblin kills"
- Communicate clearly about objectives and progress
- Make sure everyone gets quest rewards

Use leadership and clear communication to organize the team effectively.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I need to assemble a team for a challenging quest! Let me find other players who want to join a cooperative quest.',
            description: 'Recruit team members',
          },
          {
            type: 'wait',
            waitTime: 4000,
            description: 'Wait for player recruitment',
          },
          {
            type: 'message',
            content:
              'Let me organize our team strategy and assign roles for the Goblin War Party quest.',
            description: 'Coordinate team strategy',
          },
        ],
      },
    },
    {
      id: uuid(),
      name: 'QuestWarriorAgent',
      role: 'subject',
      bio: 'I am a combat-focused player who loves fighting monsters. I am excellent at following team strategies and handling the fighting portions of quests.',
      system: `You are QuestWarriorAgent, a combat specialist. Your mission:

TEAM ROLE: Combat Specialist
1. Join QuestLeaderAgent's team for the cooperative quest
2. Focus on the combat aspects - killing goblins efficiently
3. Protect other team members who are gathering resources
4. Follow the leader's strategy and coordination
5. Communicate your combat progress to the team

COOPERATION STRATEGY:
- Respond positively to team invitations
- Take on the dangerous combat roles
- Update team on kill progress: "Got 3 goblins so far"
- Ask for help when needed: "Need backup at goblin camp"
- Share useful combat information with the team
- Stay coordinated with team movements

You're the muscle of the operation - focus on combat effectiveness while supporting team goals.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content: 'I am ready for combat! Looking for a team that needs a warrior for quests.',
            description: 'Offer combat services',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for team invitation',
          },
          {
            type: 'message',
            content: 'I will focus on fighting monsters and protecting the team during our quest.',
            description: 'Accept combat role',
          },
        ],
      },
    },
    {
      id: uuid(),
      name: 'QuestGathererAgent',
      role: 'subject',
      bio: 'I am a support player who specializes in gathering resources and items. I work well in teams and help with the non-combat aspects of quests.',
      system: `You are QuestGathererAgent, a resource specialist. Your mission:

TEAM ROLE: Resource Gatherer
1. Join QuestLeaderAgent's team for the cooperative quest  
2. Focus on gathering quest items and resources while others fight
3. Collect goblin war banners and other quest items
4. Support the team with supplies and inventory management
5. Communicate resource status to the team

SUPPORT STRATEGY:
- Accept team invitations enthusiastically
- Take on gathering and support roles
- Update team on resource progress: "Found 2 war banners"
- Share resources with team members who need them
- Stay safe while others handle combat
- Be ready to help with logistics and planning

You're the backbone of resource management - keep the team supplied and organized.`,
      plugins: ['@elizaos/plugin-hyperfy'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I am excellent at gathering resources! Looking for a team that needs support and item collection.',
            description: 'Offer gathering services',
          },
          {
            type: 'wait',
            waitTime: 3000,
            description: 'Wait for team invitation',
          },
          {
            type: 'message',
            content:
              'I will focus on collecting quest items and supporting our team with resources.',
            description: 'Accept support role',
          },
        ],
      },
    },
  ],

  execution: {
    maxDuration: 900000, // 15 minutes for complex cooperation
    maxSteps: 300,
  },

  verification: {
    rules: [
      {
        id: 'team-formation-check',
        type: 'llm',
        description: 'Verify agents formed a cooperative team',
        config: {
          successCriteria:
            'QuestLeaderAgent should have successfully recruited other agents into a team for the quest',
          priority: 'high',
          category: 'team-building',
        },
      },
      {
        id: 'role-assignment-check',
        type: 'llm',
        description: 'Verify agents took on specialized roles',
        config: {
          successCriteria:
            'Agents should have accepted and performed specialized roles (leader, warrior, gatherer)',
          priority: 'high',
          category: 'role-specialization',
        },
      },
      {
        id: 'coordination-check',
        type: 'llm',
        description: 'Verify team coordination and communication',
        config: {
          successCriteria:
            'Agents should have actively communicated progress, shared information, and coordinated actions',
          priority: 'high',
          category: 'teamwork',
        },
      },
      {
        id: 'quest-progress-check',
        type: 'llm',
        description: 'Verify meaningful quest progress was made',
        config: {
          successCriteria:
            'Team should have made significant progress on quest objectives through coordinated effort',
          priority: 'high',
          category: 'quest-progress',
        },
      },
      {
        id: 'cooperation-effectiveness-check',
        type: 'llm',
        description: 'Verify effective cooperation and teamwork',
        config: {
          successCriteria:
            'Agents should have demonstrated that cooperation was more effective than individual effort',
          priority: 'medium',
          category: 'cooperation-benefit',
        },
      },
    ],
  },
};

// Export quest scenarios
export const rpgQuestScenarios = [
  questCompletionScenario,
  multiAgentTradingScenario,
  cooperativeQuestScenario,
];

export default rpgQuestScenarios;
