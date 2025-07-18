// RPG plugin export
export * from './systems/ConstructionSystem'
export * from './types'

import type { World } from '../types'

// Import all RPG systems
import { CombatSystem } from './systems/CombatSystem'
import { InventorySystem } from './systems/InventorySystem'
import { QuestSystem } from './systems/QuestSystem'
import { SkillsSystem } from './systems/SkillsSystem'
import { BankingSystem } from './systems/BankingSystem'
import { TradingSystem } from './systems/TradingSystem'
import { NavigationSystem } from './systems/NavigationSystem'
import { LootSystem } from './systems/LootSystem'
import { SpawningSystem } from './systems/SpawningSystem'
import { NPCSystem } from './systems/NPCSystem'
import { StatsSystem } from './systems/StatsSystem'
import { MovementSystem } from './systems/MovementSystem'
import { DeathRespawnSystem } from './systems/DeathRespawnSystem'
import { PvPSystem } from './systems/PvPSystem'
import { ShopSystem } from './systems/ShopSystem'
import { GrandExchangeSystem } from './systems/GrandExchangeSystem'
import { PrayerSystem } from './systems/PrayerSystem'
import { MagicSystem } from './systems/MagicSystem'
import { ConstructionSystem } from './systems/ConstructionSystem'
import { MinigameSystem } from './systems/MinigameSystem'
import { ClanSystem } from './systems/ClanSystem'
import { VisualRepresentationSystem } from './systems/VisualRepresentationSystem'
import { AgentPlayerSystem } from './systems/AgentPlayerSystem'
import { ItemSpawnSystem } from './systems/ItemSpawnSystem'
import { ResourceSpawnSystem } from './systems/ResourceSpawnSystem'
import { UISystem } from './ui/UISystem'

// Plugin definition
export const HyperfyRPGPlugin = {
  name: 'hyperfy-rpg',
  description: 'RuneScape-style RPG mechanics for Hyperfy',
  systems: [],
  
  /**
   * Initialize the RPG plugin with the given world
   */
  async init(world: World, config?: any): Promise<void> {
    console.log('[HyperfyRPGPlugin] Initializing RPG plugin...', {
      worldType: config?.worldType || 'unknown',
      isServer: config?.isServer || false,
      systems: config?.systems || []
    })
    
    // Register all RPG systems
    const systems = [
      { name: 'stats', system: StatsSystem },
      { name: 'movement', system: MovementSystem },
      { name: 'combat', system: CombatSystem },
      { name: 'inventory', system: InventorySystem },
      { name: 'quest', system: QuestSystem },
      { name: 'skills', system: SkillsSystem },
      { name: 'banking', system: BankingSystem },
      { name: 'trading', system: TradingSystem },
      { name: 'navigation', system: NavigationSystem },
      { name: 'loot', system: LootSystem },
      { name: 'spawning', system: SpawningSystem },
      { name: 'npc', system: NPCSystem },
      { name: 'deathRespawn', system: DeathRespawnSystem },
      { name: 'pvp', system: PvPSystem },
      { name: 'shop', system: ShopSystem },
      { name: 'grandExchange', system: GrandExchangeSystem },
      { name: 'prayer', system: PrayerSystem },
      { name: 'magic', system: MagicSystem },
      { name: 'construction', system: ConstructionSystem },
      { name: 'minigame', system: MinigameSystem },
      { name: 'clan', system: ClanSystem },
      { name: 'visualRepresentation', system: VisualRepresentationSystem },
      { name: 'agentPlayer', system: AgentPlayerSystem },
      { name: 'itemSpawn', system: ItemSpawnSystem },
      { name: 'resourceSpawn', system: ResourceSpawnSystem },
      { name: 'ui', system: UISystem }
    ]
    
    // Register each system with the world
    for (const { name, system } of systems) {
      try {
        (world as any).register?.(name, system)
        console.log(`[HyperfyRPGPlugin] Registered ${name} system`)
      } catch (error) {
        console.error(`[HyperfyRPGPlugin] Failed to register ${name} system:`, error)
      }
    }
    
    // Store RPG systems on the world for easy access
    ;(world as any).rpgSystems = {}
    for (const { name } of systems) {
      const systemInstance = (world as any).getSystem?.(name)
      if (systemInstance) {
        ;(world as any).rpgSystems[name] = systemInstance
      }
    }
    
    console.log('[HyperfyRPGPlugin] RPG plugin initialized successfully with', Object.keys((world as any).rpgSystems || {}).length, 'systems')
  }
}

// Add world manager export
export { RPGWorldManager } from './RPGWorldManager'

// Main RPG app setup - now with world initialization
export const setupRPGWorld = async (world: World): Promise<void> => {
  console.log('Setting up RPG World...')
  
  // Import world manager
  const { RPGWorldManager } = await import('./RPGWorldManager')
  
  // Create and store world manager
  const worldManager = new RPGWorldManager(world)
  ;(world as any).rpgManager = worldManager
  
  // Initialize the RPG world
  await worldManager.initialize()
}

// Helper to check if RPG is ready
export const isRPGReady = (world: World): boolean => {
  const worldManager = (world as any).rpgManager
  return worldManager ? worldManager.isReady() : false
}

// Helper to get RPG status
export const getRPGStatus = (world: World): any => {
  const worldManager = (world as any).rpgManager
  return worldManager ? worldManager.getStatus() : null
}