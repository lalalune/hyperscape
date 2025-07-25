// Core Systems (database system only exported on server via dynamic import)
// Note: RPGDatabaseSystem is not exported here to avoid client-side import of better-sqlite3
// It's dynamically imported in createServerWorld.ts instead
export { RPGPlayerSystem } from './RPGPlayerSystem.js'
export { RPGCombatSystem } from './RPGCombatSystem.js'
export { RPGInventorySystem } from './RPGInventorySystem.js'
export { RPGXPSystem } from './RPGXPSystem.js'
export { RPGUISystem } from './RPGUISystem.js'
export { RPGMobSystem } from './RPGMobSystem.js'
export { RPGBankingSystem } from './RPGBankingSystem.js'
export { RPGStoreSystem } from './RPGStoreSystem.js'
export { RPGResourceSystem } from './RPGResourceSystem.js'
export { RPGMovementSystem } from './RPGMovementSystem.js'
export { RPGWorldGenerationSystem } from './RPGWorldGenerationSystem.js'
export { ExampleMobSpawner } from './ExampleMobSpawner';
export { RPGEntityManager } from './RPGEntityManager';
// Export as RPGAppManager for backward compatibility
export { RPGEntityManager as RPGAppManager } from './RPGEntityManager';

// New MMORPG-style Systems
export { RPGLootSystem } from './RPGLootSystem';
export { RPGInteractionSystem } from './RPGInteractionSystem';
export { RPGCameraSystem } from './RPGCameraSystem';
export { RPGEquipmentSystem } from './RPGEquipmentSystem';
export { RPGItemPickupSystem } from './RPGItemPickupSystem';
export { RPGProcessingSystem } from './RPGProcessingSystem';
export { RPGItemActionSystem } from './RPGItemActionSystem';
export { RPGInventoryInteractionSystem } from './RPGInventoryInteractionSystem';
// Removed RPGUIComponents - replaced with React components

// World Content Systems
export { RPGWorldContentSystem } from './RPGWorldContentSystem';
export { RPGNPCSystem } from './RPGNPCSystem';
export { RPGMobAISystem } from './RPGMobAISystem';
export { RPGBiomeVisualizationSystem } from './RPGBiomeVisualizationSystem';

// Item and Mob Management
export { ItemSpawnerSystem } from './ItemSpawnerSystem';
export { MobSpawnerSystem } from './MobSpawnerSystem';
export { DefaultWorldSystem } from './DefaultWorldSystem';

// Movement and Physics

// Terrain systems now unified into core TerrainSystem

// World Verification Systems

// UI Systems (client-side) - Temporarily excluded for core systems build
// export { RPGPlayerStatsUI } from './ui/RPGPlayerStatsUI'
// export { RPGInventoryUI } from './ui/RPGInventoryUI'
// export { RPGMinimapUI } from './ui/RPGMinimapUI'
// export { RPGCombatUI } from './ui/RPGCombatui'
// export { RPGSkillsUI } from './ui/RPGSkillsUI'

// Visual Testing System
export { RPGVisualTestSystem } from './RPGVisualTestSystem';

// Comprehensive Test Systems
export { RPGLootDropTestSystem } from './RPGLootDropTestSystem';
export { RPGCorpseTestSystem } from './RPGCorpseTestSystem';
export { RPGItemActionTestSystem } from './RPGItemActionTestSystem';

// Existing Test Systems  
export { RPGCombatTestSystem } from './RPGCombatTestSystem';
export { RPGAggroTestSystem } from './RPGAggroTestSystem';
export { RPGInventoryTestSystem } from './RPGInventoryTestSystem';
export { RPGBankingTestSystem } from './RPGBankingTestSystem';
export { RPGStoreTestSystem } from './RPGStoreTestSystem';
export { RPGResourceGatheringTestSystem } from './RPGResourceGatheringTestSystem';
export { RPGMovementTestSystem } from './RPGMovementTestSystem';
export { RPGEquipmentTestSystem } from './RPGEquipmentTestSystem';
export { RPGPhysicsTestSystem } from './RPGPhysicsTestSystem';

// New Comprehensive Test Systems for Every RPG Feature
export { RPGFishingTestSystem } from './RPGFishingTestSystem';
export { RPGCookingTestSystem } from './RPGCookingTestSystem';
export { RPGWoodcuttingTestSystem } from './RPGWoodcuttingTestSystem';
export { RPGFiremakingTestSystem } from './RPGFiremakingTestSystem';
export { RPGXPTestSystem } from './RPGXPTestSystem';
export { RPGDeathTestSystem } from './RPGDeathTestSystem';
export { RPGPersistenceTestSystem } from './RPGPersistenceTestSystem';
export { RPGUITestSystem } from './RPGUITestSystem';

// System Loader (entry point for Hyperfy)
export { registerRPGSystems } from './RPGSystemLoader.js'