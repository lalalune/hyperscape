import { v4 as uuid } from 'uuid';
import { VisualCheckpoint } from '../src/testing/visual-verifier';

/**
 * Comprehensive RPG Test Scenarios with Visual Verification
 * Tests all aspects of the Runescape-like RPG in Hyperfy using actual visual checks
 */

interface ComprehensiveRPGScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  observerConfig?: {
    enabled: boolean;
    followAgent?: boolean;
    recordSession?: boolean;
    showThoughts?: boolean;
  };
  actors: any[];
  setup?: any;
  execution?: any;
  verification: {
    type: 'visual' | 'llm' | 'hybrid';
    visualCheckpoints?: VisualCheckpoint[];
    rules?: any[];
  };
}

/**
 * Combat System Test with Visual Verification
 */
export const combatSystemTest: ComprehensiveRPGScenario = {
  id: uuid(),
  name: 'RPG Combat System Test',
  description: 'Comprehensive test of all combat mechanics with visual verification',
  category: 'rpg-combat',
  tags: ['combat', 'pvp', 'pve', 'skills', 'visual-test'],

  observerConfig: {
    enabled: true,
    followAgent: true,
    recordSession: true,
    showThoughts: true
  },

  actors: [
    {
      id: uuid(),
      name: 'CombatTestAgent',
      role: 'subject',
      bio: 'I am a combat specialist testing all fighting mechanics. I understand melee, ranged, and magic combat styles.',
      system: `You are testing the RPG combat system comprehensively. Your tasks:

1. MELEE COMBAT TEST:
   - Find and equip a melee weapon (sword, axe, etc.)
   - Attack training dummies or weak enemies
   - Test different attack styles (aggressive, defensive, accurate)
   - Monitor damage output and accuracy

2. RANGED COMBAT TEST:
   - Equip a bow and arrows
   - Test ranged combat on different targets
   - Check ammunition consumption
   - Test special ranged abilities

3. MAGIC COMBAT TEST:
   - Learn and cast combat spells
   - Test different spell types (damage, debuff, area)
   - Monitor mana consumption
   - Test spell accuracy and damage

4. DEFENSIVE MECHANICS:
   - Test blocking and dodging
   - Monitor damage reduction from armor
   - Test defensive abilities and prayers

5. PVP COMBAT:
   - Engage other players in combat
   - Test combat styles against human opponents
   - Monitor PvP-specific mechanics

Report your findings at each stage. Be specific about damage numbers, accuracy rates, and any issues.`,
      plugins: ['@elizaos/plugin-hyperfy']
    }
  ],

  execution: {
    maxDuration: 1200000, // 20 minutes
    maxSteps: 500,
  },

  verification: {
    type: 'visual',
    visualCheckpoints: [
      // Melee combat checkpoints
      {
        name: 'Player has sword equipped',
        entityType: 'sword',
        expectedColor: '#FF6B44',
        shouldExist: true,
        tolerance: 30
      },
      {
        name: 'Goblin enemy spawned',
        entityType: 'goblin',
        expectedColor: '#228822',
        shouldExist: true,
        expectedPosition: { x: 100, y: 100, range: 200 }
      },
      {
        name: 'Combat damage indicator',
        entityType: 'damage_indicator',
        expectedColor: '#FF4500',
        shouldExist: true
      },
      {
        name: 'Player health bar changed',
        entityType: 'health_bar',
        expectedColor: '#FF0000',
        shouldExist: true
      },
      // Ranged combat checkpoints
      {
        name: 'Player has bow equipped',
        entityType: 'bow',
        expectedColor: '#8B6813',
        shouldExist: true
      },
      {
        name: 'Arrow projectile visible',
        entityType: 'arrow',
        expectedColor: '#654321',
        shouldExist: true
      },
      // Magic combat checkpoints
      {
        name: 'Player has staff equipped',
        entityType: 'staff',
        expectedColor: '#9400D3',
        shouldExist: true
      },
      {
        name: 'Spell effect visible',
        entityType: 'spell_effect',
        expectedColor: '#00FFFF',
        shouldExist: true
      },
      {
        name: 'Mana bar changed',
        entityType: 'mana_bar',
        expectedColor: '#0000FF',
        shouldExist: true
      }
    ]
  }
};

/**
 * Skills and Crafting Test with Visual Verification
 */
export const skillsSystemTest: ComprehensiveRPGScenario = {
  id: uuid(),
  name: 'RPG Skills System Test',
  description: 'Tests all gathering, processing, and crafting skills with visual checks',
  category: 'rpg-skills',
  tags: ['skills', 'crafting', 'gathering', 'economy', 'visual-test'],

  observerConfig: {
    enabled: true,
    recordSession: true
  },

  actors: [
    {
      id: uuid(),
      name: 'SkillsTestAgent',
      role: 'subject',
      bio: 'I am a master crafter testing all skill systems. I love gathering resources and creating items.',
      system: `You are testing the complete skills system. Test each skill category:

1. GATHERING SKILLS:
   - Mining: Mine different ores, track experience gains
   - Woodcutting: Cut various trees, note respawn times
   - Fishing: Fish in different spots, catch various fish
   - Farming: Plant and harvest crops if available

2. PROCESSING SKILLS:
   - Smithing: Smelt ores and create equipment
   - Cooking: Cook food items, note healing values
   - Fletching: Create arrows and bows
   - Herblore: Create potions if available

3. CRAFTING SKILLS:
   - Crafting: Create armor from hides/materials
   - Construction: Build items if available
   - Runecrafting: Create runes for magic if available

4. OTHER SKILLS:
   - Agility: Test movement bonuses
   - Thieving: Pickpocket NPCs if available
   - Slayer: Test creature-specific combat

For each skill:
- Note starting level and experience
- Perform the skill action multiple times
- Track experience gains per action
- Note any level-up messages
- Test skill-specific equipment bonuses

Document all findings with specific numbers.`,
      plugins: ['@elizaos/plugin-hyperfy']
    }
  ],

  execution: {
    maxDuration: 1800000, // 30 minutes
    maxSteps: 600
  },

  verification: {
    type: 'visual',
    visualCheckpoints: [
      // Mining checkpoints
      {
        name: 'Rock resource exists',
        entityType: 'rock',
        expectedColor: '#808080',
        shouldExist: true
      },
      {
        name: 'Mining animation active',
        entityType: 'mining_animation',
        expectedColor: '#696969',
        shouldExist: true
      },
      {
        name: 'Ore in inventory',
        entityType: 'iron_ore',
        expectedColor: '#4B0000',
        shouldExist: true
      },
      // Woodcutting checkpoints
      {
        name: 'Tree resource exists',
        entityType: 'tree',
        expectedColor: '#228822',
        shouldExist: true
      },
      {
        name: 'Woodcutting animation',
        entityType: 'chop_animation',
        expectedColor: '#8B4513',
        shouldExist: true
      },
      {
        name: 'Logs in inventory',
        entityType: 'logs',
        expectedColor: '#8B4513',
        shouldExist: true
      },
      // Smithing checkpoints
      {
        name: 'Furnace available',
        entityType: 'furnace',
        expectedColor: '#FF4500',
        shouldExist: true
      },
      {
        name: 'Smelting animation',
        entityType: 'smelt_animation',
        expectedColor: '#FFA500',
        shouldExist: true
      },
      {
        name: 'Crafted item created',
        entityType: 'iron_sword',
        expectedColor: '#C0C0C0',
        shouldExist: true
      },
      // Experience gain checkpoint
      {
        name: 'XP popup visible',
        entityType: 'xp_popup',
        expectedColor: '#FFFF00',
        shouldExist: true
      }
    ]
  }
};

/**
 * Quest System Test with Visual Verification
 */
export const questSystemTest: ComprehensiveRPGScenario = {
  id: uuid(),
  name: 'RPG Quest System Test',
  description: 'Tests complete quest chains with visual indicators',
  category: 'rpg-quests',
  tags: ['quests', 'npcs', 'story', 'rewards', 'visual-test'],

  observerConfig: {
    enabled: true,
    followAgent: true,
    showThoughts: true
  },

  actors: [
    {
      id: uuid(),
      name: 'QuestTestAgent',
      role: 'subject',
      bio: 'I am a quest completionist who tests every aspect of quest systems.',
      system: `You are testing the complete quest system. Your objectives:

1. QUEST DISCOVERY:
   - Find all available quest givers (NPCs with ! or ?)
   - Talk to each NPC to discover quests
   - Document all available quests

2. QUEST TYPES:
   - Fetch quests: Collect and deliver items
   - Kill quests: Defeat specific enemies
   - Escort quests: Guide NPCs to locations
   - Puzzle quests: Solve riddles or puzzles

3. QUEST MECHANICS:
   - Accept quests and track objectives
   - Monitor quest progress updates
   - Complete objectives in order
   - Turn in completed quests
   - Receive and document rewards

4. QUEST CHAINS:
   - Complete multi-part quest chains
   - Note how quests unlock other quests
   - Track story progression

5. DAILY/REPEATABLE QUESTS:
   - Find and complete daily quests
   - Test quest reset mechanics

Document each quest with:
- Quest name and giver
- Objectives and requirements
- Rewards received
- Any bugs or issues`,
      plugins: ['@elizaos/plugin-hyperfy']
    }
  ],

  execution: {
    maxDuration: 1500000, // 25 minutes
    maxSteps: 400
  },

  verification: {
    type: 'visual',
    visualCheckpoints: [
      // Quest discovery
      {
        name: 'Quest giver with exclamation mark',
        entityType: 'quest_giver',
        expectedColor: '#FFD700',
        shouldExist: true
      },
      {
        name: 'Quest dialogue window',
        entityType: 'dialogue_window',
        expectedColor: '#D2691E',
        shouldExist: true
      },
      // Quest tracking
      {
        name: 'Quest tracker UI',
        entityType: 'quest_tracker',
        expectedColor: '#F0E68C',
        shouldExist: true
      },
      {
        name: 'Quest objective marker',
        entityType: 'objective_marker',
        expectedColor: '#00FF00',
        shouldExist: true
      },
      // Quest completion
      {
        name: 'Quest complete effect',
        entityType: 'quest_complete',
        expectedColor: '#FFD700',
        shouldExist: true
      },
      {
        name: 'Reward popup',
        entityType: 'reward_popup',
        expectedColor: '#FFD700',
        shouldExist: true
      },
      // Quest items
      {
        name: 'Quest item in inventory',
        entityType: 'quest_item',
        expectedColor: '#FF69B4',
        shouldExist: true
      }
    ]
  }
};

/**
 * Economy and Trading Test
 * Tests shops, player trading, and economy
 */
export const economySystemTest: ComprehensiveRPGScenario = {
  id: uuid(),
  name: 'RPG Economy System Test',
  description: 'Tests shops, trading, and economic systems',
  category: 'rpg-economy',
  tags: ['trading', 'shops', 'economy', 'multiplayer'],

  observerConfig: {
    enabled: true,
    recordSession: true
  },

  actors: [
    {
      id: uuid(),
      name: 'TraderTestAgent',
      role: 'subject',
      bio: 'I am an economic analyst testing all trade and shop systems.',
      system: `You are testing the complete economy system:

1. NPC SHOPS:
   - Find all shops in the area
   - Check shop inventories and prices
   - Buy items from shops
   - Sell items to shops
   - Note price differences (buy vs sell)

2. PLAYER TRADING:
   - Find other players to trade with
   - Initiate trade requests
   - Offer items in trade window
   - Complete successful trades
   - Test trade cancellation

3. AUCTION HOUSE/GRAND EXCHANGE:
   - List items for sale
   - Buy items from other players
   - Check market prices
   - Test buy/sell orders

4. CURRENCY:
   - Track gold gains/losses
   - Test currency drops from monsters
   - Check quest gold rewards
   - Monitor repair costs

5. ITEM VALUES:
   - Document item rarity tiers
   - Check high-value items
   - Test item stacking
   - Monitor inventory limits

Record all transactions with specific values.`,
      plugins: ['@elizaos/plugin-hyperfy']
    },
    {
      id: uuid(),
      name: 'TradePartnerAgent',
      role: 'assistant',
      bio: 'I help test trading systems by being a trade partner.',
      system: 'You assist in testing trading by accepting trade requests and exchanging items. Be cooperative and help document the trading process.',
      plugins: ['@elizaos/plugin-hyperfy']
    }
  ],

  execution: {
    maxDuration: 900000, // 15 minutes
    maxSteps: 300
  },

  verification: {
    rules: [
      {
        id: 'shop-system-test',
        type: 'llm',
        description: 'Verify NPC shops work',
        config: {
          successCriteria: 'Agent should have bought and sold items from NPC shops with documented prices',
          priority: 'high'
        }
      },
      {
        id: 'player-trading-test',
        type: 'llm',
        description: 'Verify player trading',
        config: {
          successCriteria: 'Agents should have successfully completed player-to-player trades',
          priority: 'high'
        }
      },
      {
        id: 'economy-balance-test',
        type: 'llm',
        description: 'Verify economic balance',
        config: {
          successCriteria: 'Agent should have documented buy/sell price ratios and economic balance',
          priority: 'medium'
        }
      }
    ]
  }
};

/**
 * RPG Swarm Test
 * Tests multiple agents playing simultaneously
 */
export const rpgSwarmTest: ComprehensiveRPGScenario = {
  id: uuid(),
  name: 'RPG Agent Swarm Test',
  description: 'Tests system performance with multiple agents playing the RPG simultaneously',
  category: 'rpg-swarm',
  tags: ['swarm', 'performance', 'multiplayer', 'stress-test'],

  observerConfig: {
    enabled: true,
    followAgent: false, // Don't follow specific agent
    recordSession: true
  },

  actors: [
    // Combat-focused agent
    {
      id: uuid(),
      name: 'SwarmWarrior',
      role: 'subject',
      bio: 'I am a warrior in the swarm, focused on combat and leveling.',
      system: 'Focus on combat activities: kill monsters, level up combat skills, and collect combat gear.',
      plugins: ['@elizaos/plugin-hyperfy']
    },
    // Gathering-focused agent
    {
      id: uuid(),
      name: 'SwarmGatherer',
      role: 'subject',
      bio: 'I am a resource gatherer in the swarm.',
      system: 'Focus on gathering skills: mine ores, cut trees, fish, and collect resources.',
      plugins: ['@elizaos/plugin-hyperfy']
    },
    // Crafting-focused agent
    {
      id: uuid(),
      name: 'SwarmCrafter',
      role: 'subject',
      bio: 'I am a master crafter in the swarm.',
      system: 'Focus on crafting: create items, process resources, and supply other players.',
      plugins: ['@elizaos/plugin-hyperfy']
    },
    // Quest-focused agent
    {
      id: uuid(),
      name: 'SwarmQuester',
      role: 'subject',
      bio: 'I complete quests for the swarm.',
      system: 'Focus on questing: find and complete as many quests as possible.',
      plugins: ['@elizaos/plugin-hyperfy']
    },
    // Trading-focused agent
    {
      id: uuid(),
      name: 'SwarmTrader',
      role: 'subject',
      bio: 'I am the swarm merchant.',
      system: 'Focus on trading: buy low, sell high, facilitate trades between players.',
      plugins: ['@elizaos/plugin-hyperfy']
    }
  ],

  execution: {
    maxDuration: 1800000, // 30 minutes
    maxSteps: 1000
  },

  verification: {
    rules: [
      {
        id: 'swarm-connection-test',
        type: 'llm',
        description: 'Verify all agents connected',
        config: {
          successCriteria: 'All 5 agents should have successfully connected and started their activities',
          priority: 'high'
        }
      },
      {
        id: 'swarm-activity-test',
        type: 'llm',
        description: 'Verify diverse activities',
        config: {
          successCriteria: 'Each agent should be performing their specialized role without conflicts',
          priority: 'high'
        }
      },
      {
        id: 'swarm-interaction-test',
        type: 'llm',
        description: 'Verify agent interactions',
        config: {
          successCriteria: 'Agents should have interacted with each other (trading, helping, etc.)',
          priority: 'medium'
        }
      },
      {
        id: 'system-stability-test',
        type: 'llm',
        description: 'Verify system stability',
        config: {
          successCriteria: 'System should remain stable with 5 active agents for 30 minutes',
          priority: 'high'
        }
      }
    ]
  }
};

/**
 * End-to-End RPG Experience Test
 * Complete playthrough from character creation to high level
 */
export const endToEndRPGTest: ComprehensiveRPGScenario = {
  id: uuid(),
  name: 'End-to-End RPG Experience',
  description: 'Complete RPG playthrough from new character to experienced player',
  category: 'rpg-complete',
  tags: ['complete', 'progression', 'long-running'],

  observerConfig: {
    enabled: true,
    followAgent: true,
    recordSession: true,
    showThoughts: true
  },

  actors: [
    {
      id: uuid(),
      name: 'CompleteTestAgent',
      role: 'subject',
      bio: 'I am playing through the entire RPG experience from start to finish.',
      system: `You are playing through the complete RPG experience. Follow this progression:

1. TUTORIAL/STARTING AREA (0-10 min):
   - Complete any tutorial quests
   - Learn basic controls and mechanics
   - Get starting equipment
   - Reach level 3

2. EARLY GAME (10-20 min):
   - Complete beginner quests
   - Train combat on weak enemies
   - Start gathering skills
   - Reach level 10

3. MID GAME (20-40 min):
   - Complete quest chains
   - Diversify skills
   - Upgrade equipment
   - Join player activities
   - Reach level 25

4. LATE GAME (40-60 min):
   - Complete advanced quests
   - Master chosen skills
   - Acquire rare items
   - Participate in high-level content
   - Reach level 40+

Document your progression at each stage. Make decisions as a real player would.`,
      plugins: ['@elizaos/plugin-hyperfy']
    }
  ],

  execution: {
    maxDuration: 3600000, // 60 minutes
    maxSteps: 2000
  },

  verification: {
    rules: [
      {
        id: 'character-progression-test',
        type: 'llm',
        description: 'Verify character progression',
        config: {
          successCriteria: 'Agent should have progressed from level 1 to at least level 25 with natural gameplay',
          priority: 'high'
        }
      },
      {
        id: 'content-variety-test',
        type: 'llm',
        description: 'Verify content variety',
        config: {
          successCriteria: 'Agent should have experienced combat, skilling, questing, and social aspects',
          priority: 'high'
        }
      },
      {
        id: 'natural-gameplay-test',
        type: 'llm',
        description: 'Verify natural gameplay',
        config: {
          successCriteria: 'Agent should have played like a real player with realistic decision-making',
          priority: 'medium'
        }
      },
      {
        id: 'endgame-readiness-test',
        type: 'llm',
        description: 'Verify endgame readiness',
        config: {
          successCriteria: 'Agent should be equipped and skilled for high-level content',
          priority: 'medium'
        }
      }
    ]
  }
};

// Export all comprehensive tests
export const comprehensiveRPGTests = [
  combatSystemTest,
  skillsSystemTest,
  questSystemTest,
  economySystemTest,
  rpgSwarmTest,
  endToEndRPGTest
];

// Test suite metadata
export const comprehensiveTestMetadata = {
  totalTests: comprehensiveRPGTests.length,
  estimatedTotalDuration: '3-4 hours',
  categories: {
    combat: [combatSystemTest],
    skills: [skillsSystemTest],
    quests: [questSystemTest],
    economy: [economySystemTest],
    performance: [rpgSwarmTest],
    complete: [endToEndRPGTest]
  },
  requirements: {
    plugins: ['@elizaos/plugin-hyperfy'],
    features: ['dynamic-actions', 'rpg-state', 'observer-mode'],
    minAgents: 1,
    maxAgents: 5
  }
};

export default comprehensiveRPGTests; 