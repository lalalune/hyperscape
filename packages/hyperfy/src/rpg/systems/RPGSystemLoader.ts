/**
 * RPG System Loader
 * Entry point for Hyperfy to dynamically load all RPG systems
 */

// Import database system conditionally - only on server
import { RPGDatabaseSystem } from './RPGDatabaseSystem';
import { RPGPlayerSystem } from './RPGPlayerSystem';
import { RPGCombatSystem } from './RPGCombatSystem';
import { RPGInventorySystem } from './RPGInventorySystem';
import { RPGXPSystem } from './RPGXPSystem';
import { RPGMobSystem } from './RPGMobSystem';
import { RPGUISystem } from './RPGUISystem';
import { RPGBankingSystem } from './RPGBankingSystem';
import { RPGStoreSystem } from './RPGStoreSystem';
import { RPGResourceSystem } from './RPGResourceSystem';
import { RPGMovementSystem } from './RPGMovementSystem';
import { RPGPathfindingSystem } from './RPGPathfindingSystem';
import { RPGWorldGenerationSystem } from './RPGWorldGenerationSystem';
// UNIFIED TERRAIN SYSTEMS - USING PROCEDURAL TERRAIN
// DYNAMIC WORLD CONTENT SYSTEMS - FULL THREE.JS ACCESS
import { DefaultWorldSystem } from './DefaultWorldSystem';
import { MobSpawnerSystem } from './MobSpawnerSystem';
import { ItemSpawnerSystem } from './ItemSpawnerSystem';
import { TestPhysicsCube } from './TestPhysicsCube';
import { TestUISystem } from './TestUISystem';
// RPGClientInteractionSystem removed - functionality merged into RPGInteractionSystem
import { RPGAggroSystem } from './RPGAggroSystem';
import { RPGEquipmentSystem } from './RPGEquipmentSystem';
import { RPGItemPickupSystem } from './RPGItemPickupSystem';
import { RPGItemActionSystem } from './RPGItemActionSystem';
import { RPGInventoryInteractionSystem } from './RPGInventoryInteractionSystem';
import { RPGPlayerSpawnSystem } from './RPGPlayerSpawnSystem';
import { RPGProcessingSystem } from './RPGProcessingSystem';
import { RPGAttackStyleSystem } from './RPGAttackStyleSystem';
import { RPGEntityManager } from './RPGEntityManager';
import { RPGDeathSystem } from './RPGDeathSystem';
import { EntityCullingSystem } from '../../core/systems/EntityCullingSystem';

// New MMORPG-style Systems
import { RPGLootSystem } from './RPGLootSystem';
import { RPGInteractionSystem } from './RPGInteractionSystem';
import { RPGCameraSystem } from './RPGCameraSystem';
// Removed RPGUIComponents - replaced with React components

// World Content Systems
import { RPGWorldContentSystem } from './RPGWorldContentSystem';
import { RPGNPCSystem } from './RPGNPCSystem';
import { RPGMobAISystem } from './RPGMobAISystem';

// TEST SYSTEMS - Visual Testing Framework
import { RPGCombatTestSystem } from './RPGCombatTestSystem';
import { RPGAggroTestSystem } from './RPGAggroTestSystem';
import { RPGInventoryTestSystem } from './RPGInventoryTestSystem';
import { RPGBankingTestSystem } from './RPGBankingTestSystem';
import { RPGStoreTestSystem } from './RPGStoreTestSystem';
import { RPGResourceGatheringTestSystem } from './RPGResourceGatheringTestSystem';
import { RPGEquipmentTestSystem } from './RPGEquipmentTestSystem';
import { RPGMovementTestSystem } from './RPGMovementTestSystem';
import { RPGVisualTestSystem } from './RPGVisualTestSystem';
import { RPGPhysicsTestSystem } from './RPGPhysicsTestSystem';
import { RPGTestRunner } from './RPGTestRunner';

// NEW COMPREHENSIVE TEST SYSTEMS
import { RPGLootDropTestSystem } from './RPGLootDropTestSystem';
import { RPGCorpseTestSystem } from './RPGCorpseTestSystem';
import { RPGItemActionTestSystem } from './RPGItemActionTestSystem';
import { RPGSystemValidationTestSystem } from './RPGSystemValidationTestSystem';
import { RPGFishingTestSystem } from './RPGFishingTestSystem';
import { RPGCookingTestSystem } from './RPGCookingTestSystem';
import { RPGWoodcuttingTestSystem } from './RPGWoodcuttingTestSystem';
import { RPGFiremakingTestSystem } from './RPGFiremakingTestSystem';
import { RPGXPTestSystem } from './RPGXPTestSystem';
import { RPGDeathTestSystem } from './RPGDeathTestSystem';
import { RPGPersistenceTestSystem } from './RPGPersistenceTestSystem';
import { RPGUITestSystem } from './RPGUITestSystem';

// PHYSICS INTEGRATION TEST SYSTEMS
import { RPGPhysicsIntegrationTestSystem } from './RPGPhysicsIntegrationTestSystem';
import { RPGPrecisionPhysicsTestSystem } from './RPGPrecisionPhysicsTestSystem';

/**
 * Register all RPG systems with a Hyperfy world
 * This is the main entry point called by the bootstrap
 */
export async function registerRPGSystems(world: any): Promise<void> {
  console.log('[RPG Systems] Registering RPG systems with Hyperfy world...');
  console.log('[RPG Systems] World object type:', typeof world);
  console.log('[RPG Systems] World object keys:', Object.keys(world || {}));
  console.log('[RPG Systems] World.register type:', typeof world?.register);

  try {
    const systems: any = {};

    // Core backend systems (server + client)
    console.log('[RPG Systems] Initializing core systems...');
    
    // Register all core systems with world
    console.log('[RPG Systems] Registering all RPG systems...');
    
    // Register database system only on server
    if (world.isServer) {
      try {
        console.log('[RPG Systems] Registering RPGDatabaseSystem on server...');
        console.log('[RPG Systems] Database system constructor:', typeof RPGDatabaseSystem);
        world.register('rpg-database', RPGDatabaseSystem);
        console.log('[RPG Systems] ✅ Database system registered on server');
        
        // Verify registration
        const registeredSystem = world.systems['rpg-database'] || world['rpg-database'];
        console.log('[RPG Systems] Database system verification:', !!registeredSystem);
      } catch (error) {
        console.error('[RPG Systems] ❌ Failed to register database system:', error);
        console.error('[RPG Systems] Error stack:', (error as Error).stack);
        // For now, continue without database system (player system will handle gracefully)
        console.warn('[RPG Systems] ⚠️ Continuing without database system - player data will not persist');
      }
    }
    world.register('rpg-player', RPGPlayerSystem);
    world.register('rpg-combat', RPGCombatSystem);
    world.register('rpg-inventory', RPGInventorySystem);
    world.register('rpg-xp', RPGXPSystem);
    world.register('rpg-mob', RPGMobSystem);
    world.register('rpg-ui', RPGUISystem);
    world.register('rpg-banking', RPGBankingSystem);
    world.register('rpg-store', RPGStoreSystem);
    world.register('rpg-resource', RPGResourceSystem);
    world.register('rpg-movement', RPGMovementSystem);
    world.register('rpg-pathfinding', RPGPathfindingSystem);
    world.register('rpg-world-generation', RPGWorldGenerationSystem);
    world.register('rpg-aggro', RPGAggroSystem);
    world.register('rpg-equipment', RPGEquipmentSystem);
    world.register('rpg-item-pickup', RPGItemPickupSystem);
    world.register('rpg-item-actions', RPGItemActionSystem);
    world.register('rpg-player-spawn', RPGPlayerSpawnSystem);
    world.register('rpg-processing', RPGProcessingSystem);
    world.register('rpg-attack-style', RPGAttackStyleSystem);
    world.register('rpg-entity-manager', RPGEntityManager);
    world.register('rpg-death', RPGDeathSystem);
    
    // Performance optimization systems
    world.register('entity-culling', EntityCullingSystem);
    
    // Client-only interaction systems
    if (world.isClient) {
      world.register('rpg-inventory-interaction', RPGInventoryInteractionSystem);
    }
    
    // New MMORPG-style Systems
    world.register('rpg-loot', RPGLootSystem);
    if (world.isClient) {
      world.register('rpg-interaction', RPGInteractionSystem);
      world.register('rpg-camera', RPGCameraSystem);
      // Removed RPGUIComponents - replaced with React components
    }
    
    // World Content Systems (server only for world management)
    if (world.isServer) {
      world.register('rpg-world-content', RPGWorldContentSystem);
      world.register('rpg-npc', RPGNPCSystem);
      world.register('rpg-mob-ai', RPGMobAISystem);
    }
    
    // VISUAL TEST SYSTEMS - Register for comprehensive testing
    console.log('[RPG Systems] Registering visual test systems...');
    world.register('rpg-visual-test', RPGVisualTestSystem);
    
    if (world.isServer) {
      // Core validation test (always enabled)
      world.register('rpg-system-validation-test', RPGSystemValidationTestSystem);
      
      if (process.env.ENABLE_RPG_TESTS === 'true' || process.env.RPG_ENABLE_ALL_TEST_SYSTEMS === 'true') {
        world.register('rpg-test-combat', RPGCombatTestSystem);
        world.register('rpg-test-aggro', RPGAggroTestSystem);
        world.register('rpg-test-inventory', RPGInventoryTestSystem);
        world.register('rpg-test-banking', RPGBankingTestSystem);
        world.register('rpg-test-store', RPGStoreTestSystem);
        world.register('rpg-test-resource-gathering', RPGResourceGatheringTestSystem);
        world.register('rpg-test-equipment', RPGEquipmentTestSystem);
        world.register('rpg-test-movement', RPGMovementTestSystem);
        world.register('rpg-test-physics', RPGPhysicsTestSystem);
        
        // New comprehensive test systems
        world.register('rpg-loot-drop-test', RPGLootDropTestSystem);
        world.register('rpg-corpse-test', RPGCorpseTestSystem);
        world.register('rpg-item-action-test', RPGItemActionTestSystem);
        
        // All comprehensive test systems with 100% coverage
        world.register('rpg-fishing-test', RPGFishingTestSystem);
        world.register('rpg-cooking-test', RPGCookingTestSystem);
        world.register('rpg-woodcutting-test', RPGWoodcuttingTestSystem);
        world.register('rpg-firemaking-test', RPGFiremakingTestSystem);
        world.register('rpg-xp-test', RPGXPTestSystem);
        world.register('rpg-death-test', RPGDeathTestSystem);
        world.register('rpg-persistence-test', RPGPersistenceTestSystem);
        world.register('rpg-ui-test', RPGUITestSystem);
        
        // Physics integration test systems
        world.register('rpg-physics-integration-test', RPGPhysicsIntegrationTestSystem);
        world.register('rpg-precision-physics-test', RPGPrecisionPhysicsTestSystem);
        
        world.register('rpg-test-runner', RPGTestRunner);
        console.log('[RPG Systems] ✅ All test systems registered (including comprehensive test systems with 100% coverage)');
      } else {
        console.log('[RPG Systems] Advanced test systems disabled (set ENABLE_RPG_TESTS=true or RPG_ENABLE_ALL_TEST_SYSTEMS=true to enable)');
        console.log('[RPG Systems] System validation test enabled by default');
      }
    }
    
    // UNIFIED TERRAIN SYSTEMS - USING PROCEDURAL TERRAIN
    // Note: Client terrain is registered in createClientWorld.ts as 'rpg-client-terrain'
    // Terrain system now unified and registered in createClientWorld/createServerWorld

    // DYNAMIC WORLD CONTENT SYSTEMS - FULL THREE.JS ACCESS, NO SANDBOX
    console.log('[RPG Systems] Registering dynamic world content systems...');
    world.register('default-world', DefaultWorldSystem);
    world.register('mob-spawner', MobSpawnerSystem);
    world.register('item-spawner', ItemSpawnerSystem);
    world.register('test-physics-cube', TestPhysicsCube);
    
    // Only register client-only systems on client side (they need DOM/canvas/browser APIs)
    if (world.isClient) {
        world.register('test-ui', TestUISystem);
        // RPGClientInteractionSystem removed - functionality merged into RPGInteractionSystem
    }

    console.log('[RPG Systems] All core systems registered with world');

    // Get system instances after world initialization
    // Systems are directly available as properties on the world object after registration  
    // Database system is only available on server
    if (world.isServer) {
      systems.database = (world as any)['rpg-database'];
    }
    systems.player = (world as any)['rpg-player']; 
    systems.combat = (world as any)['rpg-combat'];
    systems.inventory = (world as any)['rpg-inventory'];
    systems.xp = (world as any)['rpg-xp'];
    systems.mob = (world as any)['rpg-mob'];
    systems.ui = (world as any)['rpg-ui'];
    systems.banking = (world as any)['rpg-banking'];
    systems.store = (world as any)['rpg-store'];
    systems.resource = (world as any)['rpg-resource'];
    systems.movement = (world as any)['rpg-movement'];
    systems.pathfinding = (world as any)['rpg-pathfinding'];
    systems.worldGeneration = (world as any)['rpg-world-generation'];
    systems.aggro = (world as any)['rpg-aggro'];
    systems.equipment = (world as any)['rpg-equipment'];
    systems.itemPickup = (world as any)['rpg-item-pickup'];
    systems.itemActions = (world as any)['rpg-item-actions'];
    systems.playerSpawn = (world as any)['rpg-player-spawn'];
    systems.processing = (world as any)['rpg-processing'];
    systems.attackStyle = (world as any)['rpg-attack-style'];
    systems.appManager = (world as any)['rpg-app-manager'];
    systems.entityManager = (world as any)['rpg-entity-manager'];
    systems.death = (world as any)['rpg-death'];
    
    // Client-only systems
    if (world.isClient) {
      systems.inventoryInteraction = (world as any)['rpg-inventory-interaction'];
    }
    
    // New MMORPG-style Systems
    systems.loot = (world as any)['rpg-loot'];
    if (world.isClient) {
      systems.interaction = (world as any)['rpg-interaction'];
      systems.camera = (world as any)['rpg-camera'];
      // Removed uiComponents - replaced with React components
    }
    
    // World Content Systems
    if (world.isServer) {
      systems.worldContent = (world as any)['rpg-world-content'];
      systems.npc = (world as any)['rpg-npc'];
      systems.mobAI = (world as any)['rpg-mob-ai'];
    }
    
    // VISUAL TEST SYSTEMS - Get instances 
    systems.visualTest = (world as any)['rpg-visual-test'];
    
    if (world.isServer && (process.env.ENABLE_RPG_TESTS === 'true' || process.env.RPG_ENABLE_ALL_TEST_SYSTEMS === 'true')) {
      systems.testCombat = (world as any)['rpg-test-combat'];
      systems.testAggro = (world as any)['rpg-test-aggro'];
      systems.testInventory = (world as any)['rpg-test-inventory'];
      systems.testBanking = (world as any)['rpg-test-banking'];
      systems.testStore = (world as any)['rpg-test-store'];
      systems.testResourceGathering = (world as any)['rpg-test-resource-gathering'];
      systems.testEquipment = (world as any)['rpg-test-equipment'];
      systems.testMovement = (world as any)['rpg-test-movement'];
      systems.testPhysics = (world as any)['rpg-test-physics'];
      systems.testRunner = (world as any)['rpg-test-runner'];
      
      // New comprehensive test systems
      systems.testLootDrop = (world as any)['rpg-loot-drop-test'];
      systems.testCorpse = (world as any)['rpg-corpse-test'];
      systems.testItemAction = (world as any)['rpg-item-action-test'];
      systems.testFishing = (world as any)['rpg-fishing-test'];
      systems.testCooking = (world as any)['rpg-cooking-test'];
      systems.testWoodcutting = (world as any)['rpg-woodcutting-test'];
      systems.testFiremaking = (world as any)['rpg-firemaking-test'];
      systems.testXP = (world as any)['rpg-xp-test'];
      systems.testDeath = (world as any)['rpg-death-test'];
      systems.testPersistence = (world as any)['rpg-persistence-test'];
      systems.testUI = (world as any)['rpg-ui-test'];
      
      // Physics integration test systems
      systems.testPhysicsIntegration = (world as any)['rpg-physics-integration-test'];
      systems.testPrecisionPhysics = (world as any)['rpg-precision-physics-test'];
    }
    
    // UNIFIED TERRAIN SYSTEM
    systems.unifiedTerrain = (world as any)['unified-terrain'];
    
    // DYNAMIC WORLD CONTENT SYSTEMS
    systems.worldVerification = (world as any)['world-verification'];
    systems.defaultWorld = (world as any)['default-world'];
    systems.mobSpawner = (world as any)['mob-spawner'];
    systems.itemSpawner = (world as any)['item-spawner'];
    systems.testPhysicsCube = (world as any)['test-physics-cube'];
    systems.testUI = (world as any)['test-ui']; // Will be undefined on server, which is fine
    // RPGClientInteractionSystem removed - functionality merged into RPGInteractionSystem

    // Set up API for apps to access RPG functionality
    setupRPGAPI(world, systems);

    console.log('[RPG Systems] ✅ All RPG systems successfully registered and started');

  } catch (error) {
    console.error('[RPG Systems] Failed to register RPG systems:', error);
    throw error;
  }
}

/**
 * Set up global RPG API for apps to use
 */
function setupRPGAPI(world: any, systems: any): void {
  // Set up comprehensive RPG API for apps
  const rpgAPI = {
    // Database API
    getPlayerData: (playerId: string) => systems.database?.getPlayerData(playerId),
    savePlayerData: (playerId: string, data: any) => systems.database?.savePlayerData(playerId, data),

    // Player API
    getPlayer: (playerId: string) => systems.player?.getPlayer(playerId),
    getAllPlayers: () => systems.player?.getAllPlayers(),
    healPlayer: (playerId: string, amount: number) => systems.player?.healPlayer(playerId, amount),
    damagePlayer: (playerId: string, amount: number) => systems.player?.damagePlayer(playerId, amount),
    isPlayerAlive: (playerId: string) => systems.player?.isPlayerAlive(playerId),
    getPlayerHealth: (playerId: string) => systems.player?.getPlayerHealth(playerId),
    teleportPlayer: (playerId: string, position: any) => systems.player?.teleportPlayer(playerId, position),

    // Combat API  
    startCombat: (attackerId: string, targetId: string) => systems.combat?.startCombat(attackerId, targetId),
    stopCombat: (attackerId: string) => systems.combat?.stopCombat(attackerId),
    canAttack: (attackerId: string, targetId: string) => systems.combat?.canEntityAttack(attackerId, targetId),
    isInCombat: (entityId: string) => systems.combat?.isInCombat(entityId),

    // Inventory API
    getInventory: (playerId: string) => systems.inventory?.getInventory(playerId),
    getEquipment: (playerId: string) => systems.inventory?.getEquipment(playerId),
    hasItem: (playerId: string, itemId: number, quantity?: number) => systems.inventory?.hasItem(playerId, itemId, quantity),
    getArrowCount: (playerId: string) => systems.inventory?.getArrowCount(playerId),
    canAddItem: (playerId: string, item: any) => systems.inventory?.canAddItem(playerId, item),

    // XP API
    getSkills: (playerId: string) => systems.xp?.getSkills(playerId),
    getSkillLevel: (playerId: string, skill: string) => systems.xp?.getSkillLevel(playerId, skill),
    getSkillXP: (playerId: string, skill: string) => systems.xp?.getSkillXP(playerId, skill),
    getCombatLevel: (playerId: string) => systems.xp?.getCombatLevel(playerId),
    getXPToNextLevel: (playerId: string, skill: string) => systems.xp?.getXPToNextLevel(playerId, skill),

    // UI API
    getPlayerUIState: (playerId: string) => systems.ui?.getPlayerUIState(playerId),
    forceUIRefresh: (playerId: string) => systems.ui?.forceUIRefresh(playerId),
    sendUIMessage: (playerId: string, message: string, type?: 'info' | 'warning' | 'error') => systems.ui?.sendUIMessage(playerId, message, type),

    // Mob API
    getMob: (mobId: string) => systems.mob?.getMob(mobId),
    getAllMobs: () => systems.mob?.getAllMobs(),
    getMobsInArea: (center: any, radius: number) => systems.mob?.getMobsInArea(center, radius),
    spawnMob: (type: string, position: any) => systems.mob && world.emit('rpg:mob:spawn:request', { type, position }),

    // Banking API
    getBankData: (playerId: string, bankId: string) => systems.banking?.getBankData(playerId, bankId),
    getAllPlayerBanks: (playerId: string) => systems.banking?.getAllPlayerBanks(playerId),
    getBankLocations: () => systems.banking?.getBankLocations(),
    getItemCountInBank: (playerId: string, bankId: string, itemId: number) => systems.banking?.getItemCount(playerId, bankId, itemId),
    getTotalItemCountInBanks: (playerId: string, itemId: number) => systems.banking?.getTotalItemCount(playerId, itemId),

    // Store API
    getStore: (storeId: string) => systems.store?.getStore(storeId),
    getAllStores: () => systems.store?.getAllStores(),
    getStoreLocations: () => systems.store?.getStoreLocations(),
    getItemPrice: (storeId: string, itemId: number) => systems.store?.getItemPrice(storeId, itemId),
    isItemAvailable: (storeId: string, itemId: number, quantity?: number) => systems.store?.isItemAvailable(storeId, itemId, quantity),

    // Resource API
    getResource: (resourceId: string) => systems.resource?.getResource(resourceId),
    getAllResources: () => systems.resource?.getAllResources(),
    getResourcesByType: (type: 'tree' | 'fishing_spot' | 'ore') => systems.resource?.getResourcesByType(type),
    getResourcesInArea: (center: any, radius: number) => systems.resource?.getResourcesInArea(center, radius),
    isPlayerGathering: (playerId: string) => systems.resource?.isPlayerGathering(playerId),

    // Movement API
    isPlayerMoving: (playerId: string) => systems.movement?.isPlayerMoving(playerId),
    getPlayerMovement: (playerId: string) => systems.movement?.getPlayerMovement(playerId),
    getPlayerStamina: (playerId: string) => systems.movement?.getPlayerStamina(playerId),
    canPlayerRun: (playerId: string) => systems.movement?.canPlayerRun(playerId),

    // Death API
    getDeathLocation: (playerId: string) => systems.death?.getDeathLocation(playerId),
    getAllDeathLocations: () => systems.death?.getAllDeathLocations(),
    isPlayerDead: (playerId: string) => systems.death?.isPlayerDead(playerId),
    getRemainingRespawnTime: (playerId: string) => systems.death?.getRemainingRespawnTime(playerId),
    getRemainingDespawnTime: (playerId: string) => systems.death?.getRemainingDespawnTime(playerId),
    forceRespawn: (playerId: string) => systems.death?.forceRespawn(playerId),

    // Terrain API (Unified Terrain System)
    getHeightAtPosition: (worldX: number, worldZ: number) => systems.unifiedTerrain?.getHeightAtPosition(worldX, worldZ),
    getBiomeAtPosition: (worldX: number, worldZ: number) => systems.unifiedTerrain?.getBiomeAtPosition(worldX, worldZ),
    getTerrainStats: () => systems.unifiedTerrain?.getTerrainStats(),
    getHeightAtWorldPosition: (x: number, z: number) => systems.unifiedTerrain?.getHeightAtPosition(x, z),

    // Dynamic World Content API (Full THREE.js Access)
    getLoadedEntities: () => systems.defaultWorld?.getLoadedEntities(),
    isEntityLoaded: (entityId: string) => systems.defaultWorld?.isEntityLoaded(entityId),
    unloadEntity: (entityId: string) => systems.defaultWorld?.unloadEntity(entityId),
    getSpawnedMobs: () => systems.mobSpawner?.getSpawnedMobs(),
    getMobCount: () => systems.mobSpawner?.getMobCount(),
    getMobsByType: (mobType: string) => systems.mobSpawner?.getMobsByType(mobType),
    getMobStats: () => systems.mobSpawner?.getMobStats(),
    getSpawnedItems: () => systems.itemSpawner?.getSpawnedItems(),
    getItemCount: () => systems.itemSpawner?.getItemCount(),
    getItemsByType: (itemType: string) => systems.itemSpawner?.getItemsByType(itemType),
    getShopItems: () => systems.itemSpawner?.getShopItems(),
    getChestItems: () => systems.itemSpawner?.getChestItems(),
    getItemStats: () => systems.itemSpawner?.getItemStats(),
    getTestCubes: () => systems.testPhysicsCube?.getTestCubes(),
    getCubeCount: () => systems.testPhysicsCube?.getCubeCount(),
    spawnRandomCube: () => systems.testPhysicsCube?.spawnRandomCube(),
    testCubeInteraction: () => systems.testPhysicsCube?.testCubeInteraction(),
    getUIElements: () => systems.testUI?.getUIElements() || new Map(),
    getUICount: () => systems.testUI?.getUICount() || 0,
    createRandomUI: () => systems.testUI?.createRandomUI() || null,

    // World Verification API (Debug and Testing)
    triggerWorldCheck: () => systems.worldVerification?.triggerManualCheck(),
    createRandomTestObject: () => systems.worldVerification?.createRandomTestObject(),
    getVerificationReport: () => systems.worldVerification?.getVerificationReport(),

    // Visual Test Systems API
    getTestCombatResults: () => systems.testCombat?.getTestResults(),
    getTestAggroResults: () => systems.testAggro?.getTestResults(),
    getTestInventoryResults: () => systems.testInventory?.getTestResults(),
    getTestBankingResults: () => systems.testBanking?.getTestResults(),
    getTestStoreResults: () => systems.testStore?.getTestResults(),
    getTestResourceGatheringResults: () => systems.testResourceGathering?.getTestResults(),
    getTestEquipmentResults: () => systems.testEquipment?.getTestResults(),
    getTestMovementResults: () => systems.testMovement?.getTestResults(),
    getTestPhysicsResults: () => systems.testPhysics?.getTestResults(),
    getTestRunnerResults: () => systems.testRunner?.getTestResults(),
    getAllTestResults: () => ({
      combat: systems.testCombat?.getTestResults(),
      aggro: systems.testAggro?.getTestResults(),
      inventory: systems.testInventory?.getTestResults(),
      banking: systems.testBanking?.getTestResults(),
      store: systems.testStore?.getTestResults(),
      resourceGathering: systems.testResourceGathering?.getTestResults(),
      equipment: systems.testEquipment?.getTestResults(),
      movement: systems.testMovement?.getTestResults(),
      physics: systems.testPhysics?.getTestResults(),
      physicsIntegration: systems.testPhysicsIntegration?.getTestResults(),
      precisionPhysics: systems.testPrecisionPhysics?.getTestResults(),
      runner: systems.testRunner?.getTestResults()
    }),
    
    // Physics Integration Test API
    getPhysicsIntegrationResults: () => systems.testPhysicsIntegration?.getTestResults(),
    getPrecisionPhysicsResults: () => systems.testPrecisionPhysics?.getTestResults(),
    runPhysicsIntegrationTests: () => systems.testPhysicsIntegration && world.emit('rpg:physics:test:run_all'),
    runPrecisionPhysicsTests: () => systems.testPrecisionPhysics && world.emit('rpg:physics:precision:run_all'),
    runBallRampTest: () => systems.testPhysicsIntegration && world.emit('rpg:physics:test:ball_ramp'),
    runCubeDropTest: () => systems.testPhysicsIntegration && world.emit('rpg:physics:test:cube_drop'),
    runCharacterCollisionTest: () => systems.testPhysicsIntegration && world.emit('rpg:physics:test:character_collision'),
    runProjectileMotionTest: () => systems.testPrecisionPhysics && world.emit('rpg:physics:precision:projectile'),

    // Test Runner API
    runAllTests: () => systems.testRunner && world.emit('rpg:test:run_all'),
    runSpecificTest: (testName: string) => systems.testRunner?.runSpecificSystem(testName),
    isTestRunning: () => systems.testRunner?.isTestRunning(),
    getErrorLog: () => systems.testRunner?.getErrorLog(),

    // Visual Test System API (Main cube-based testing system)
    getVisualTestReport: () => systems.visualTest?.getTestReport(),
    getVisualEntitiesByType: (type: string) => systems.visualTest?.getEntitiesByType(type),
    getVisualEntitiesByColor: (color: number) => systems.visualTest?.getEntitiesByColor(color),
    verifyEntityExists: (entityId: string, expectedType?: string) => systems.visualTest?.verifyEntityExists(entityId, expectedType),
    verifyPlayerAtPosition: (playerId: string, position: any, tolerance?: number) => systems.visualTest?.verifyPlayerAtPosition(playerId, position, tolerance),
    getAllVisualEntities: () => systems.visualTest?.getAllEntities(),

    // Loot API
    spawnLoot: (mobType: string, position: any, killerId?: string) => systems.loot?.spawnLoot(mobType, position, killerId),
    getLootTable: (mobType: string) => systems.loot?.getLootTable(mobType),
    getDroppedItems: () => systems.loot?.getDroppedItems(),

    // Equipment API
    getPlayerEquipment: (playerId: string) => systems.equipment?.getPlayerEquipment(playerId),
    getEquipmentData: (playerId: string) => systems.equipment?.getEquipmentData(playerId),
    getEquipmentStats: (playerId: string) => systems.equipment?.getEquipmentStats(playerId),
    isItemEquipped: (playerId: string, itemId: number) => systems.equipment?.isItemEquipped(playerId, itemId),
    canEquipItem: (playerId: string, itemId: number) => systems.equipment?.canEquipItem(playerId, itemId),
    consumeArrow: (playerId: string) => systems.equipment?.consumeArrow(playerId),

    // Item Pickup API
    dropItem: (item: any, position: any, droppedBy?: string) => systems.itemPickup?.dropItem(item, position, droppedBy),
    getItemsInRange: (position: any, range?: number) => systems.itemPickup?.getItemsInRange(position, range),
    getGroundItem: (itemId: string) => systems.itemPickup?.getGroundItem(itemId),
    getAllGroundItems: () => systems.itemPickup?.getAllGroundItems(),
    clearAllItems: () => systems.itemPickup?.clearAllItems(),

    // Item Actions API
    registerItemAction: (category: string, action: any) => systems.itemActions?.registerAction(category, action),

    // Inventory Interaction API (client only)
    isDragging: () => systems.inventoryInteraction?.getSystemInfo()?.isDragging || false,
    getDropTargetsCount: () => systems.inventoryInteraction?.getSystemInfo()?.dropTargetsCount || 0,

    // Processing API
    getActiveFires: () => systems.processing?.getActiveFires(),
    getPlayerFires: (playerId: string) => systems.processing?.getPlayerFires(playerId),
    isPlayerProcessing: (playerId: string) => systems.processing?.isPlayerProcessing(playerId),
    getFiresInRange: (position: any, range?: number) => systems.processing?.getFiresInRange(position, range),

    // Attack Style API
    getPlayerAttackStyle: (playerId: string) => systems.attackStyle?.getPlayerAttackStyle(playerId),
    getAllAttackStyles: () => systems.attackStyle?.getAllAttackStyles(),
    canPlayerChangeStyle: (playerId: string) => systems.attackStyle?.canPlayerChangeStyle(playerId),
    getRemainingStyleCooldown: (playerId: string) => systems.attackStyle?.getRemainingCooldown(playerId),
    forceChangeAttackStyle: (playerId: string, styleId: string) => systems.attackStyle?.forceChangeAttackStyle(playerId, styleId),
    getPlayerStyleHistory: (playerId: string) => systems.attackStyle?.getPlayerStyleHistory(playerId),
    getAttackStyleSystemInfo: () => systems.attackStyle?.getSystemInfo(),

    // App Manager API
    createApp: (appType: any, config: any) => systems.appManager?.createApp(appType, config),
    destroyApp: (appId: string) => systems.appManager?.destroyApp(appId),
    getApp: (appId: string) => systems.appManager?.getApp(appId),
    getAllApps: () => systems.appManager?.getAllApps(),
    getAppsByType: (type: string) => systems.appManager?.getAppsByType(type),
    getAppCount: () => systems.appManager?.getAppCount(),

    // Entity Manager API (Server-authoritative)
    spawnEntity: (config: any) => systems.entityManager?.spawnEntity(config),
    destroyEntity: (entityId: string) => systems.entityManager?.destroyEntity(entityId),
    getEntity: (entityId: string) => systems.entityManager?.getEntity(entityId),
    getEntitiesByType: (type: string) => systems.entityManager?.getEntitiesByType(type),
    getEntitiesInRange: (center: any, range: number, type?: string) => systems.entityManager?.getEntitiesInRange(center, range, type),
    getAllEntities: () => systems.entityManager?.getAllEntities(),
    getEntityCount: () => systems.entityManager?.getEntityCount(),
    getEntityDebugInfo: () => systems.entityManager?.getDebugInfo(),

    // Player Spawn API
    hasPlayerCompletedSpawn: (playerId: string) => systems.playerSpawn?.hasPlayerCompletedSpawn(playerId),
    getPlayerSpawnData: (playerId: string) => systems.playerSpawn?.getPlayerSpawnData(playerId),
    forceReequipStarter: (playerId: string) => systems.playerSpawn?.forceReequipStarter(playerId),
    forceTriggerAggro: (playerId: string) => systems.playerSpawn?.forceTriggerAggro(playerId),
    getAllSpawnedPlayers: () => systems.playerSpawn?.getAllSpawnedPlayers(),
    
    
    // Interaction API (Client only)
    registerInteractable: (data: any) => systems.interaction?.registerInteractable && world.emit('rpg:interaction:register', data),
    unregisterInteractable: (appId: string) => systems.interaction?.unregisterInteractable && world.emit('rpg:interaction:unregister', { appId }),
    
    // Camera API (Client only)
    getCameraInfo: () => systems.camera?.getCameraInfo(),
    setCameraEnabled: (enabled: boolean) => systems.camera?.setEnabled(enabled),
    resetCamera: () => systems.camera?.resetCamera(),
    
    // UI Components API (Client only)
    updateHealthBar: (data: any) => systems.uiComponents && world.emit('rpg:ui:update', { component: 'health', data }),
    updateInventory: (data: any) => systems.uiComponents && world.emit('rpg:ui:update', { component: 'inventory', data }),
    addChatMessage: (message: string, type?: string) => systems.uiComponents && world.emit('rpg:ui:message', { message, type }),

    // World Content API (Server only)
    getWorldAreas: () => systems.worldContent?.getAllWorldAreas(),
    getAreaAtPosition: (x: number, z: number) => systems.worldContent?.getAreaAtPosition(x, z),
    getLoadedNPCs: () => systems.worldContent?.getLoadedNPCs(),
    getLoadedMobs: () => systems.worldContent?.getLoadedMobs(),
    spawnPlayerAtRandomSpawn: (playerId: string) => systems.worldContent?.spawnPlayer(playerId),
    getWorldContentInfo: () => systems.worldContent?.getSystemInfo(),

    // NPC API (Server only)
    getPlayerBankContents: (playerId: string) => systems.npc?.getPlayerBankContents(playerId),
    getStoreInventory: () => systems.npc?.getStoreInventory(),
    getTransactionHistory: (playerId?: string) => systems.npc?.getTransactionHistory(playerId),
    getNPCSystemInfo: () => systems.npc?.getSystemInfo(),

    // Mob AI API (Server only)
    getMobAIInfo: () => systems.mobAI?.getSystemInfo(),

    // System references for advanced usage
    systems: systems,

    // Action methods for apps to trigger
    actions: {
      // Player actions
      updatePlayerData: (playerId: string, data: any) => {
        systems.database?.savePlayerData(playerId, data);
        world.emit('rpg:player:updated', { playerId, data });
      },

      // Combat actions
      startAttack: (attackerId: string, targetId: string, attackStyle?: string) => {
        world.emit('rpg:combat:start_attack', { attackerId, targetId, attackStyle });
      },

      stopAttack: (attackerId: string) => {
        world.emit('rpg:combat:stop_attack', { attackerId });
      },

      // XP actions
      grantXP: (playerId: string, skill: string, amount: number) => {
        world.emit('rpg:xp:gain', { playerId, skill, amount });
      },

      // Inventory actions
      giveItem: (playerId: string, item: any) => {
        world.emit('rpg:inventory:add', { playerId, item });
      },

      equipItem: (playerId: string, itemId: number, slot: string) => {
        world.emit('rpg:equipment:try_equip', { playerId, itemId, slot });
      },

      unequipItem: (playerId: string, slot: string) => {
        world.emit('rpg:equipment:unequip', { playerId, slot });
      },

      // Item pickup actions
      dropItemAtPosition: (item: any, position: any, playerId?: string) => {
        world.emit('rpg:item:drop', { item, position, playerId });
      },

      pickupItem: (playerId: string, itemId: string) => {
        world.emit('rpg:item:pickup_request', { playerId, itemId });
      },

      // Item action triggers
      triggerItemAction: (playerId: string, actionId: string, itemId: string, slot?: number) => {
        world.emit('rpg:item:action_selected', { playerId, actionId });
      },

      showItemContextMenu: (playerId: string, itemId: string, position: any, slot?: number) => {
        world.emit('rpg:item:right_click', { playerId, itemId, position, slot });
      },

      // Processing actions
      useItemOnItem: (playerId: string, primaryItemId: number, primarySlot: number, targetItemId: number, targetSlot: number) => {
        world.emit('rpg:item:use_on_item', { playerId, primaryItemId, primarySlot, targetItemId, targetSlot });
      },

      useItemOnFire: (playerId: string, itemId: number, itemSlot: number, fireId: string) => {
        world.emit('rpg:item:use_on_fire', { playerId, itemId, itemSlot, fireId });
      },

      startFiremaking: (playerId: string, logsSlot: number, tinderboxSlot: number) => {
        world.emit('rpg:processing:firemaking:request', { playerId, logsSlot, tinderboxSlot });
      },

      startCooking: (playerId: string, fishSlot: number, fireId: string) => {
        world.emit('rpg:processing:cooking:request', { playerId, fishSlot, fireId });
      },

      // Attack style actions
      changeAttackStyle: (playerId: string, newStyle: string) => {
        world.emit('rpg:combat:attack_style:change', { playerId, newStyle });
      },

      getAttackStyleInfo: (playerId: string, callback: (info: any) => void) => {
        world.emit('rpg:ui:attack_style:get', { playerId, callback });
      },

      // Player spawn actions
      respawnPlayerWithStarter: (playerId: string) => {
        world.emit('rpg:player:spawn_complete', { playerId });
      },

      forceAggroSpawn: (playerId: string) => {
        systems.playerSpawn?.forceTriggerAggro(playerId);
      },

      // Mob actions
      spawnMobAtLocation: (type: string, position: any) => {
        world.emit('rpg:mob:spawn_request', { mobType: type, position });
      },
      
      spawnGDDMob: (mobType: string, position: any) => {
        world.emit('rpg:mob:spawn_request', { mobType, position });
      },
      
      despawnMob: (mobId: string) => {
        world.emit('rpg:mob:despawn', mobId);
      },
      
      respawnAllMobs: () => {
        world.emit('rpg:mob:respawn_all');
      },

      // Item actions
      spawnItemAtLocation: (itemId: string, position: any) => {
        world.emit('rpg:item:spawn_request', { itemId, position });
      },
      
      spawnGDDItem: (itemId: string, position: any, quantity?: number) => {
        world.emit('rpg:item:spawn_request', { itemId, position, quantity });
      },
      
      despawnItem: (itemId: string) => {
        world.emit('rpg:item:despawn', itemId);
      },
      
      respawnShopItems: () => {
        world.emit('rpg:item:respawn_shops');
      },
      
      spawnLootItems: (position: any, lootTable: string[]) => {
        world.emit('rpg:item:spawn_loot', { position, lootTable });
      },

      // Banking actions
      openBank: (playerId: string, bankId: string, position: any) => {
        world.emit('rpg:bank:open', { playerId, bankId, position });
      },
      
      closeBank: (playerId: string, bankId: string) => {
        world.emit('rpg:bank:close', { playerId, bankId });
      },
      
      depositItem: (playerId: string, bankId: string, itemId: number, quantity: number) => {
        world.emit('rpg:bank:deposit', { playerId, bankId, itemId, quantity });
      },
      
      withdrawItem: (playerId: string, bankId: string, itemId: number, quantity: number) => {
        world.emit('rpg:bank:withdraw', { playerId, bankId, itemId, quantity });
      },

      // Store actions
      openStore: (playerId: string, storeId: string, playerPosition: any) => {
        world.emit('rpg:store:open', { playerId, storeId, playerPosition });
      },
      
      buyItem: (playerId: string, storeId: string, itemId: number, quantity: number) => {
        world.emit('rpg:store:buy', { playerId, storeId, itemId, quantity });
      },

      // Resource actions
      startGathering: (playerId: string, resourceId: string, playerPosition: any) => {
        world.emit('rpg:resource:start_gather', { playerId, resourceId, playerPosition });
      },
      
      stopGathering: (playerId: string) => {
        world.emit('rpg:resource:stop_gather', { playerId });
      },

      // Movement actions
      clickToMove: (playerId: string, targetPosition: any, currentPosition: any, isRunning?: boolean) => {
        world.emit('rpg:movement:click_to_move', { playerId, targetPosition, currentPosition, isRunning });
      },
      
      stopMovement: (playerId: string) => {
        world.emit('rpg:movement:stop', { playerId });
      },
      
      toggleRunning: (playerId: string, isRunning: boolean) => {
        world.emit('rpg:movement:toggle_run', { playerId, isRunning });
      },

      // Combat click-to-attack action
      clickToAttack: (attackerId: string, targetId: string) => {
        world.emit('rpg:combat:start_attack', { attackerId, targetId });
      },

      // Terrain actions
      configureTerrain: (config: any) => {
        world.emit('terrain:configure', config);
      },
      
      generateTerrain: (centerX: number, centerZ: number, radius: number) => {
        world.emit('terrain:generate-initial', { centerX, centerZ, radius });
      },
      
      spawnResource: (type: string, subType: string, position: any, requestedBy: string) => {
        world.emit('rpg:terrain:spawn_resource', { type, subType, position, requestedBy });
      },

      // World Content actions
      loadWorldArea: (areaId: string) => {
        world.emit('rpg:world:load_area', { areaId });
      },

      unloadWorldArea: (areaId: string) => {
        world.emit('rpg:world:unload_area', { areaId });
      },

      // NPC actions
      interactWithNPC: (playerId: string, npcId: string) => {
        world.emit('rpg:npc:interact', { playerId, npcId });
      },

      bankDeposit: (playerId: string, itemId: string, quantity: number) => {
        world.emit('rpg:bank:deposit', { playerId, itemId, quantity });
      },

      bankWithdraw: (playerId: string, itemId: string, quantity: number) => {
        world.emit('rpg:bank:withdraw', { playerId, itemId, quantity });
      },

      storeBuy: (playerId: string, itemId: string, quantity: number) => {
        world.emit('rpg:store:buy', { playerId, itemId, quantity });
      },

      storeSell: (playerId: string, itemId: string, quantity: number) => {
        world.emit('rpg:store:sell', { playerId, itemId, quantity });
      },

      // Mob AI actions
      attackMob: (playerId: string, mobId: string, damage: number) => {
        world.emit('rpg:mob:damaged', { mobId, damage, attackerId: playerId });
      },

      killMob: (mobId: string, killerId: string) => {
        world.emit('rpg:mob:killed', { mobId, killerId });
      },

      // App management actions
      createPlayerApp: (playerId: string, config: any) => {
        return systems.appManager?.createApp && world.emit('rpg:app:create_player', { playerId, config });
      },

      createMobApp: (mobId: string, mobType: string, config: any) => {
        return systems.appManager?.createApp && world.emit('rpg:app:create_mob', { mobId, mobType, config });
      },

      destroyPlayerApp: (playerId: string) => {
        world.emit('rpg:app:destroy_player', { playerId });
      },

      destroyMobApp: (mobId: string) => {
        world.emit('rpg:app:destroy_mob', { mobId });
      },

      // Entity management actions (Server-authoritative)
      spawnEntityAtLocation: (type: string, config: any) => {
        world.emit('entity:spawn', { type, config });
      },

      spawnItemEntity: (itemId: string, position: any, quantity?: number) => {
        world.emit('item:spawn', { itemId, position, quantity });
      },

      spawnMobEntity: (mobType: string, position: any, level?: number) => {
        world.emit('mob:spawn', { mobType, position, level });
      },

      destroyEntityById: (entityId: string) => {
        world.emit('entity:destroy', { entityId });
      },

      interactWithEntity: (playerId: string, entityId: string, interactionType: string) => {
        world.emit('entity:interact_request', {
          playerId,
          entityId,
          interactionType,
          playerPosition: world.getPlayer(playerId)?.position
        });
      }
    }
  };

  // Make RPG API globally available on world
  (world as any).rpg = rpgAPI;

  console.log('[RPG Systems] Comprehensive RPG API configured and attached to world');
}