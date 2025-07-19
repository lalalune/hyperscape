// Main RPG Package Export
// This is the entry point for the RPG package

// Export all types and interfaces
export * from './types/index.js'

// Export all systems
export * from './systems/index.js'

// Export main RPG World class
export { RPGWorld } from './RPGWorld.js'

// Export Hyperfy integration
export { HyperfyRPGIntegration } from './HyperfyRPGIntegration.js'

// Export data
export * from './data/items.js'

// Export tests
export * from './tests/index.js'

// Export version and package info
export const RPG_VERSION = '1.0.0'
export const RPG_PACKAGE_NAME = 'hyperscape-rpg'

// Export default configuration
export const DEFAULT_RPG_CONFIG = {
  world: {
    tickRate: 50, // 20 FPS
    saveInterval: 30000, // 30 seconds
    maxPlayers: 100,
    startingTowns: ['brookhaven', 'millharbor', 'crosshill']
  },
  combat: {
    autoAttackInterval: 600, // 600ms between attacks
    combatTimeout: 10000, // 10 seconds
    maxDamage: 99,
    criticalChance: 0.05 // 5%
  },
  progression: {
    baseExperience: 100,
    experienceMultiplier: 1.0,
    maxLevel: 99
  },
  inventory: {
    maxSlots: 28,
    maxBankSlots: 500,
    maxStack: 2147483647 // Max int32
  },
  mobs: {
    respawnTime: 30000, // 30 seconds
    aggroRange: 10,
    returnToSpawnRange: 15,
    despawnTime: 300000 // 5 minutes
  },
  resources: {
    respawnTime: 60000, // 1 minute
    depletionChance: 0.1 // 10%
  }
}

// Export system factory function
export function createRPGSystems(worldState: any, db?: any) {
  const { 
    RPGCombatSystemImpl, 
    RPGSkillsSystemImpl, 
    RPGInventorySystemImpl, 
    RPGEquipmentSystemImpl, 
    RPGWorldSystemImpl, 
    RPGMobSystemImpl, 
    RPGPersistenceSystemImpl 
  } = require('./systems/index.js')
  
  return {
    CombatSystem: new RPGCombatSystemImpl(worldState),
    SkillsSystem: new RPGSkillsSystemImpl(worldState),
    InventorySystem: new RPGInventorySystemImpl(worldState),
    EquipmentSystem: new RPGEquipmentSystemImpl(worldState),
    WorldSystem: new RPGWorldSystemImpl(worldState),
    MobSystem: new RPGMobSystemImpl(worldState),
    PersistenceSystem: new RPGPersistenceSystemImpl(worldState, db)
  }
}

// Export utility functions
export function calculateCombatLevel(stats: any): number {
  const attack = stats.attack || 1
  const strength = stats.strength || 1
  const defense = stats.defense || 1
  const constitution = stats.constitution || 10
  const range = stats.range || 1

  // Simplified RuneScape combat level formula
  return Math.floor(
    (defense + constitution + Math.floor(0.5 * 1)) / 4 + // Prayer = 1 for now
    Math.max(attack + strength, Math.floor(1.5 * range)) / 4 // Magic = 1 for now
  )
}

export function calculateExperienceForLevel(level: number): number {
  // Use the experience table from types
  const { EXPERIENCE_TABLE } = await import('./types/index.js')
  
  if (level < 1) return 0
  if (level > 99) return EXPERIENCE_TABLE[EXPERIENCE_TABLE.length - 1]
  
  return EXPERIENCE_TABLE[level - 1]
}

export function calculateLevelFromExperience(experience: number): number {
  // Use the experience table from types
  const { EXPERIENCE_TABLE, RPG_CONSTANTS } = await import('./types/index.js')
  
  for (let level = RPG_CONSTANTS.MAX_LEVEL; level >= 1; level--) {
    if (experience >= EXPERIENCE_TABLE[level - 1]) {
      return level
    }
  }
  
  return 1
}