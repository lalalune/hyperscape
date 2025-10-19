/**
 * A2A Agent Card for Hyperscape RPG
 * Exposes game skills via A2A protocol for agent discovery
 */

export interface A2AAgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  preferredTransport: string;
  provider: {
    organization: string;
    url: string;
  };
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2ASkill[];
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

export function generateAgentCard(serverUrl: string): A2AAgentCard {
  return {
    protocolVersion: '0.3.0',
    name: 'Hyperscape RPG Game Master',
    description: 'AI-generated RuneScape-inspired MMORPG with combat, skills, resource gathering, and multiplayer. Built on Hyperscape 3D engine with blockchain integration.',
    url: `${serverUrl}/a2a`,
    preferredTransport: 'JSONRPC',
    provider: {
      organization: 'Hyperscape Network',
      url: serverUrl
    },
    version: '0.13.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    skills: [
      {
        id: 'join-game',
        name: 'Join Game World',
        description: 'Join the Hyperscape RPG world as a player. Creates a character and spawns in a random starter town.',
        tags: ['game', 'join', 'character'],
        examples: [
          'Join the RPG world',
          'Start playing Hyperscape',
          'Create my character',
          'Enter the game'
        ]
      },
      {
        id: 'get-status',
        name: 'Get Player Status',
        description: 'Get comprehensive player state: health, position, skills, inventory, equipment, combat status, and nearby entities.',
        tags: ['status', 'query', 'info'],
        examples: [
          'What is my status?',
          'Show my character stats',
          'Get my current state',
          'Check my health and inventory'
        ]
      },
      {
        id: 'move-to',
        name: 'Move To Position',
        description: 'Move character to a specific 3D position (x, y, z). Player will walk/run to the destination.',
        tags: ['movement', 'navigation'],
        examples: [
          'Move to position 100, 50, 200',
          'Walk to coordinates 50, 0, -30',
          'Go to x:10 y:5 z:20'
        ]
      },
      {
        id: 'attack',
        name: 'Attack Target',
        description: 'Attack a mob or player. Starts auto-combat. Requires weapon equipped. For ranged attacks, arrows required.',
        tags: ['combat', 'attack', 'pve'],
        examples: [
          'Attack the goblin',
          'Fight mob-123',
          'Start combat with dark warrior'
        ]
      },
      {
        id: 'stop-attack',
        name: 'Stop Combat',
        description: 'Stop current auto-combat session.',
        tags: ['combat', 'disengage'],
        examples: ['Stop attacking', 'End combat', 'Disengage']
      },
      {
        id: 'gather-resource',
        name: 'Gather Resource',
        description: 'Gather from a resource node (chop tree, fish). Requires appropriate tool equipped (hatchet for trees, fishing rod for fish).',
        tags: ['skills', 'gathering', 'woodcutting', 'fishing'],
        examples: [
          'Chop the tree',
          'Fish at the lake',
          'Gather from resource-456'
        ]
      },
      {
        id: 'use-item',
        name: 'Use Inventory Item',
        description: 'Use an item from inventory (eat food, light fire, cook fish). Different items have different effects.',
        tags: ['inventory', 'items', 'consume'],
        examples: [
          'Eat cooked fish',
          'Use tinderbox on logs',
          'Consume health potion'
        ]
      },
      {
        id: 'equip-item',
        name: 'Equip Item',
        description: 'Equip a weapon, armor, or tool from inventory. Requires meeting level requirements.',
        tags: ['equipment', 'gear'],
        examples: [
          'Equip bronze sword',
          'Wear steel armor',
          'Equip fishing rod'
        ]
      },
      {
        id: 'unequip-item',
        name: 'Unequip Item',
        description: 'Remove equipped item and return it to inventory.',
        tags: ['equipment', 'unequip'],
        examples: ['Unequip sword', 'Remove helmet', 'Take off armor']
      },
      {
        id: 'pickup-item',
        name: 'Pick Up Ground Item',
        description: 'Pick up an item from the ground. Requires inventory space.',
        tags: ['items', 'loot', 'inventory'],
        examples: [
          'Pick up the coins',
          'Loot the bronze sword',
          'Grab item-789'
        ]
      },
      {
        id: 'drop-item',
        name: 'Drop Item',
        description: 'Drop an item from inventory onto the ground.',
        tags: ['inventory', 'items'],
        examples: [
          'Drop 10 logs',
          'Drop bronze dagger',
          'Throw away raw fish'
        ]
      },
      {
        id: 'open-bank',
        name: 'Open Bank',
        description: 'Open bank interface to access stored items. Must be near a bank in a starter town.',
        tags: ['banking', 'storage'],
        examples: [
          'Open the bank',
          'Access bank storage',
          'Open bank in Brookhaven'
        ]
      },
      {
        id: 'deposit-item',
        name: 'Deposit to Bank',
        description: 'Deposit item from inventory into bank. Unlimited bank storage.',
        tags: ['banking', 'storage'],
        examples: [
          'Deposit 100 logs to bank',
          'Bank my mithril armor',
          'Store these items'
        ]
      },
      {
        id: 'withdraw-item',
        name: 'Withdraw from Bank',
        description: 'Withdraw item from bank to inventory. Requires inventory space.',
        tags: ['banking', 'storage'],
        examples: [
          'Withdraw steel sword',
          'Get 50 arrows from bank',
          'Take out fishing rod'
        ]
      },
      {
        id: 'buy-item',
        name: 'Buy from Store',
        description: 'Purchase item from general store. Requires coins. Stores sell tools (hatchet, fishing rod, tinderbox) and arrows.',
        tags: ['shop', 'economy', 'buy'],
        examples: [
          'Buy bronze hatchet',
          'Purchase 100 arrows',
          'Buy tinderbox'
        ]
      },
      {
        id: 'sell-item',
        name: 'Sell to Store',
        description: 'Sell item from inventory to general store for coins.',
        tags: ['shop', 'economy', 'sell'],
        examples: [
          'Sell 50 logs',
          'Sell bronze sword',
          'Trade cooked fish'
        ]
      },
      {
        id: 'get-skills',
        name: 'Get Skill Levels',
        description: 'Get all skill levels and XP: Attack, Strength, Defense, Constitution, Range, Woodcutting, Fishing, Firemaking, Cooking.',
        tags: ['skills', 'stats', 'query'],
        examples: [
          'Show my skills',
          'What are my skill levels?',
          'Check my stats'
        ]
      },
      {
        id: 'get-inventory',
        name: 'Get Inventory',
        description: 'Get current inventory contents (28 slots max).',
        tags: ['inventory', 'items', 'query'],
        examples: [
          'Show my inventory',
          'What items do I have?',
          'Check my backpack'
        ]
      },
      {
        id: 'get-nearby-entities',
        name: 'Get Nearby Entities',
        description: 'Get all nearby mobs, players, resources, and items within range. Use for situational awareness.',
        tags: ['perception', 'query', 'environment'],
        examples: [
          'What\'s around me?',
          'Show nearby enemies',
          'List nearby resources'
        ]
      },
      {
        id: 'change-attack-style',
        name: 'Change Attack Style',
        description: 'Switch combat style (accurate, aggressive, defensive, controlled). Affects XP distribution.',
        tags: ['combat', 'style', 'settings'],
        examples: [
          'Switch to aggressive style',
          'Use defensive combat',
          'Change to controlled'
        ]
      }
    ]
  };
}

