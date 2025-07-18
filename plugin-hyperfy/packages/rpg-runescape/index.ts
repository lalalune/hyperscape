import { IContentPack, IGameSystem, IVisualConfig, IStateManager } from '../../src/types/content-pack';
import { Action, Provider, IAgentRuntime } from '@elizaos/core';

// Import RPG actions
import { attackAction } from './actions/attack';
import { pickupItemAction } from './actions/pickup';
import { mineResourceAction } from './actions/mine';
import { acceptQuestAction } from './actions/quest';
import { buyItemAction } from './actions/trade';

// Import RPG providers
import { rpgStateProvider } from './providers/rpg-state';
import { rpgQuestProvider } from './providers/rpg-quest';
import { rpgCombatProvider } from './providers/rpg-combat';

// Import RPG systems
import { CombatSystem } from './systems/combat';
import { InventorySystem } from './systems/inventory';
import { SkillsSystem } from './systems/skills';
import { QuestSystem } from './systems/quest';
import { TradingSystem } from './systems/trading';

// Import state manager
import { RunescapeStateManager } from './state/state-manager';

/**
 * Visual configuration for Runescape-like RPG
 */
const runescapeVisuals: IVisualConfig = {
  entityColors: {
    // Items
    'items.sword': { color: 16729156, hex: '#FF4444' },
    'items.bow': { color: 9127187, hex: '#8B4513' },
    'items.staff': { color: 9699539, hex: '#9400D3' },
    'items.potion': { color: 16724736, hex: '#FF3300' },
    'items.food': { color: 16753920, hex: '#FFA500' },
    
    // NPCs
    'npcs.goblin': { color: 2263842, hex: '#228822' },
    'npcs.skeleton': { color: 16119260, hex: '#F5F5DC' },
    'npcs.guard': { color: 4356961, hex: '#427361' },
    'npcs.merchant': { color: 8421504, hex: '#808080' },
    'npcs.quest_giver': { color: 16776960, hex: '#FFFF00' },
    
    // Resources
    'resources.tree': { color: 2263842, hex: '#228822' },
    'resources.iron_rock': { color: 4210752, hex: '#404040' },
    'resources.gold_rock': { color: 16766720, hex: '#FFD700' },
    'resources.fishing_spot': { color: 255, hex: '#0000FF' },
    
    // Special effects
    'effects.damage': { color: 16711680, hex: '#FF0000' },
    'effects.heal': { color: 65280, hex: '#00FF00' },
    'effects.levelup': { color: 16776960, hex: '#FFFF00' }
  },
  
  uiTheme: {
    primaryColor: '#8B4513',
    secondaryColor: '#FFD700',
    fonts: {
      runescape: 'RuneScape-Chat-07'
    }
  },
  
  assets: {
    models: [
      '/assets/rpg/models/weapons/',
      '/assets/rpg/models/armor/',
      '/assets/rpg/models/resources/'
    ],
    sounds: [
      '/assets/rpg/sounds/combat/',
      '/assets/rpg/sounds/skills/',
      '/assets/rpg/sounds/ui/'
    ]
  }
};

/**
 * Runescape-like RPG Content Pack
 */
export const RunescapeRPGPack: IContentPack = {
  id: 'runescape-rpg',
  name: 'Runescape RPG Module',
  description: 'A Runescape-like RPG experience for Hyperfy with all classic mechanics',
  version: '1.0.0',
  
  // RPG Actions
  actions: [
    attackAction,
    pickupItemAction,
    mineResourceAction,
    acceptQuestAction,
    buyItemAction
  ],
  
  // RPG Providers
  providers: [
    rpgStateProvider,
    rpgQuestProvider,
    rpgCombatProvider
  ],
  
  // Game Systems
  systems: [
    new CombatSystem(),
    new InventorySystem(),
    new SkillsSystem(),
    new QuestSystem(),
    new TradingSystem()
  ],
  
  // Visual Configuration
  visuals: runescapeVisuals,
  
  // State Management
  stateManager: new RunescapeStateManager(),
  
  // Lifecycle Hooks
  async onLoad(runtime: IAgentRuntime, world: any): Promise<void> {
    console.log('[RunescapeRPG] Loading Runescape RPG module...');
    
    // Initialize RPG-specific world features
    if (world) {
      // Add RPG UI overlay
      world.ui?.addOverlay('rpg-hud', {
        position: 'top-left',
        component: 'RPGStatsDisplay'
      });
      
      // Register RPG-specific commands
      world.commands?.register('/stats', 'Show player stats');
      world.commands?.register('/inventory', 'Open inventory');
      world.commands?.register('/quests', 'Show quest log');
    }
    
    // Initialize skill calculators
    initializeSkillCalculators();
    
    console.log('[RunescapeRPG] Module loaded successfully');
  },
  
  async onUnload(runtime: IAgentRuntime, world: any): Promise<void> {
    console.log('[RunescapeRPG] Unloading Runescape RPG module...');
    
    // Remove RPG UI elements
    world.ui?.removeOverlay('rpg-hud');
    
    // Unregister commands
    world.commands?.unregister('/stats');
    world.commands?.unregister('/inventory');
    world.commands?.unregister('/quests');
    
    console.log('[RunescapeRPG] Module unloaded');
  }
};

/**
 * Helper function to initialize skill calculators
 */
function initializeSkillCalculators(): void {
  // XP formula: XP = Σ(L + 300 × 2^(L/7)) / 4 for L from 1 to level
  // This matches Runescape's XP curve
}

/**
 * Export for easy importing
 */
export default RunescapeRPGPack; 