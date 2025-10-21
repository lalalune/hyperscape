/**
 * Action Handler Types
 * 
 * Defines all available action handlers from the game's plugin-hyperscape system.
 * These action handlers correspond to actual game actions that ElizaOS agents can perform.
 * 
 * Each action handler has metadata including:
 * - Category: Type of action (combat, gathering, etc.)
 * - Description: What the action does
 * - Required Items: Items needed to perform the action
 * - Target Types: Valid targets for the action (mob, npc, resource, item)
 * 
 * Referenced by: QuestBuilder, ActionHandlerSelector, Quest Validation
 */

export type ActionHandlerName =
  // Combat actions
  | 'ATTACK_MOB'
  | 'DEFEND'
  | 'FLEE_COMBAT'
  // Gathering actions
  | 'CHOP_TREE'
  | 'CATCH_FISH'
  | 'MINE_ROCK'
  // Processing actions
  | 'LIGHT_FIRE'
  | 'COOK_FOOD'
  | 'SMELT_ORE'
  // Economy actions
  | 'BANK_ITEMS'
  | 'BUY_FROM_SHOP'
  | 'SELL_TO_SHOP'
  // Navigation actions
  | 'GOTO'
  | 'WALK_RANDOMLY'
  // Social actions
  | 'TALK_TO_NPC'
  | 'ACCEPT_QUEST'
  | 'COMPLETE_QUEST'

export type ActionCategory = 
  | 'combat' 
  | 'gathering' 
  | 'processing' 
  | 'economy' 
  | 'navigation' 
  | 'social'

export interface ActionHandlerMetadata {
  name: ActionHandlerName
  category: ActionCategory
  description: string
  requiredItems?: string[] // Item IDs required (e.g., 'axe' for CHOP_TREE)
  targetTypes?: Array<'mob' | 'npc' | 'resource' | 'item'>
  icon?: string
}

export const ACTION_HANDLERS: Record<ActionHandlerName, ActionHandlerMetadata> = {
  // Combat Actions
  ATTACK_MOB: {
    name: 'ATTACK_MOB',
    category: 'combat',
    description: 'Attack and kill a specific mob',
    targetTypes: ['mob'],
    icon: '⚔️'
  },
  DEFEND: {
    name: 'DEFEND',
    category: 'combat',
    description: 'Defend against enemy attacks',
    icon: '🛡️'
  },
  FLEE_COMBAT: {
    name: 'FLEE_COMBAT',
    category: 'combat',
    description: 'Escape from combat',
    icon: '🏃'
  },
  
  // Gathering Actions
  CHOP_TREE: {
    name: 'CHOP_TREE',
    category: 'gathering',
    description: 'Chop down trees to gather logs',
    requiredItems: ['axe', 'hatchet'],
    targetTypes: ['resource'],
    icon: '🪓'
  },
  CATCH_FISH: {
    name: 'CATCH_FISH',
    category: 'gathering',
    description: 'Catch fish from fishing spots',
    requiredItems: ['fishing_rod', 'net'],
    targetTypes: ['resource'],
    icon: '🎣'
  },
  MINE_ROCK: {
    name: 'MINE_ROCK',
    category: 'gathering',
    description: 'Mine rocks and ore deposits',
    requiredItems: ['pickaxe'],
    targetTypes: ['resource'],
    icon: '⛏️'
  },
  
  // Processing Actions
  LIGHT_FIRE: {
    name: 'LIGHT_FIRE',
    category: 'processing',
    description: 'Light a fire using tinderbox and logs',
    requiredItems: ['tinderbox', 'logs'],
    icon: '🔥'
  },
  COOK_FOOD: {
    name: 'COOK_FOOD',
    category: 'processing',
    description: 'Cook raw food on a fire',
    requiredItems: ['raw_food'],
    targetTypes: ['resource'],
    icon: '🍖'
  },
  SMELT_ORE: {
    name: 'SMELT_ORE',
    category: 'processing',
    description: 'Smelt ore into bars at a furnace',
    requiredItems: ['ore'],
    targetTypes: ['resource'],
    icon: '⚒️'
  },
  
  // Economy Actions
  BANK_ITEMS: {
    name: 'BANK_ITEMS',
    category: 'economy',
    description: 'Deposit items into bank storage',
    targetTypes: ['npc'],
    icon: '🏦'
  },
  BUY_FROM_SHOP: {
    name: 'BUY_FROM_SHOP',
    category: 'economy',
    description: 'Purchase items from a shop',
    targetTypes: ['npc', 'item'],
    icon: '🛒'
  },
  SELL_TO_SHOP: {
    name: 'SELL_TO_SHOP',
    category: 'economy',
    description: 'Sell items to a shop',
    targetTypes: ['npc', 'item'],
    icon: '💰'
  },
  
  // Navigation Actions
  GOTO: {
    name: 'GOTO',
    category: 'navigation',
    description: 'Navigate to a specific location',
    icon: '🧭'
  },
  WALK_RANDOMLY: {
    name: 'WALK_RANDOMLY',
    category: 'navigation',
    description: 'Walk around randomly',
    icon: '🚶'
  },
  
  // Social Actions
  TALK_TO_NPC: {
    name: 'TALK_TO_NPC',
    category: 'social',
    description: 'Initiate dialogue with an NPC',
    targetTypes: ['npc'],
    icon: '💬'
  },
  ACCEPT_QUEST: {
    name: 'ACCEPT_QUEST',
    category: 'social',
    description: 'Accept a quest from an NPC',
    targetTypes: ['npc'],
    icon: '📜'
  },
  COMPLETE_QUEST: {
    name: 'COMPLETE_QUEST',
    category: 'social',
    description: 'Turn in a completed quest',
    targetTypes: ['npc'],
    icon: '✅'
  }
}

export const ACTION_CATEGORIES: Record<ActionCategory, { name: string; description: string; icon: string }> = {
  combat: {
    name: 'Combat',
    description: 'Fighting mobs and enemies',
    icon: '⚔️'
  },
  gathering: {
    name: 'Gathering',
    description: 'Collecting resources from the world',
    icon: '🌲'
  },
  processing: {
    name: 'Processing',
    description: 'Crafting and transforming materials',
    icon: '🔨'
  },
  economy: {
    name: 'Economy',
    description: 'Trading and banking',
    icon: '💰'
  },
  navigation: {
    name: 'Navigation',
    description: 'Moving around the world',
    icon: '🧭'
  },
  social: {
    name: 'Social',
    description: 'Interacting with NPCs',
    icon: '💬'
  }
}

// Helper function to get actions by category
export function getActionsByCategory(category: ActionCategory): ActionHandlerMetadata[] {
  return Object.values(ACTION_HANDLERS).filter(action => action.category === category)
}

// Helper function to check if action requires a target
export function actionRequiresTarget(actionName: ActionHandlerName): boolean {
  const action = ACTION_HANDLERS[actionName]
  return !!(action.targetTypes && action.targetTypes.length > 0)
}

