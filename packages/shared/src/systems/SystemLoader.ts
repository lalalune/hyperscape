/**
 * System Loader
 * Entry point for Hyperscape to dynamically load all systems
 */
import { Component, ComponentConstructor } from '../components'
import { CombatComponent } from '../components/CombatComponent'
import { DataComponent } from '../components/DataComponent'
import { registerComponent } from '../components/index'
import { InteractionComponent } from '../components/InteractionComponent'
import { StatsComponent } from '../components/StatsComponent'
import { UsageComponent } from '../components/UsageComponent'
import { VisualComponent } from '../components/VisualComponent'
import { dataManager } from '../data/DataManager'
import { Entity } from '../entities/Entity'
import THREE from '../extras/three'
import type {
  Inventory,
  InventorySlotItem,
  Item,
  ItemAction,
  Position3D,
  Skills
} from '../types/core'
import type { PlayerRow } from '../types/database'
import type { EntityConfig } from '../types/entities'
import { EventType } from '../types/events'
import type { AppConfig, TerrainConfig } from '../types/settings-types'
import { getSystem } from '../utils/SystemUtils'
import type { World } from '../World'

// Helper function to check truthy values
function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}


// Import systems
import { AggroSystem } from './AggroSystem'
import { AttackStyleSystem } from './AttackStyleSystem'
import { BankingSystem } from './BankingSystem'
import { CombatSystem } from './CombatSystem'
import type { DatabaseSystem } from '../types/system-interfaces'
import { DeathSystem } from './DeathSystem'
import { EntityCullingSystem } from './EntityCullingSystem'
import { EntityManager } from './EntityManager'
import { EquipmentSystem } from './EquipmentSystem'
import { InventoryInteractionSystem } from './InventoryInteractionSystem'
import { InventorySystem } from './InventorySystem'
import { ItemActionSystem } from './ItemActionSystem'
import { ItemPickupSystem } from './ItemPickupSystem'
import { ItemSpawnerSystem } from './ItemSpawnerSystem'
import { MobSpawnerSystem } from './MobSpawnerSystem'
import { MobSystem } from './MobSystem'
import { PathfindingSystem } from './PathfindingSystem'
import { PersistenceSystem } from './PersistenceSystem'
import { PlayerSpawnSystem } from './PlayerSpawnSystem'
import { PlayerSystem } from './PlayerSystem'
import { ProcessingSystem } from './ProcessingSystem'
import { ResourceSystem } from './ResourceSystem'
import { EntityInteractionSystem } from './EntityInteractionSystem'
import { ResourceVisualizationSystem } from './ResourceVisualizationSystem'
import { StoreSystem } from './StoreSystem'
import { WorldGenerationSystem } from './WorldGenerationSystem'

// New MMO-style Systems
import { InteractionSystem } from './InteractionSystem'
import { LootSystem } from './LootSystem'
// Movement now handled by physics in PlayerLocal
// CameraSystem moved to core ClientCameraSystem
// Removed UIComponents - replaced with React components

// World Content Systems
import { MobAISystem } from './MobAISystem'
import { NPCSystem } from './NPCSystem'

// TEST SYSTEMS - Visual Testing Framework
import { AggroTestSystem } from './AggroTestSystem'
import { BankingTestSystem } from './BankingTestSystem'
import { EquipmentTestSystem } from './EquipmentTestSystem'
import { InventoryTestSystem } from './InventoryTestSystem'
import { ResourceGatheringTestSystem } from './ResourceGatheringTestSystem'
import { StoreTestSystem } from './StoreTestSystem'
import { TestRunner } from './TestRunner'
import { VisualTestSystem } from './VisualTestSystem'

// NEW COMPREHENSIVE TEST SYSTEMS
import { CookingTestSystem } from './CookingTestSystem'
import { CorpseTestSystem } from './CorpseTestSystem'
import { DatabaseTestSystem } from './DatabaseTestSystem'
import { DeathTestSystem } from './DeathTestSystem'
import { FiremakingTestSystem } from './FiremakingTestSystem'
import { FishingTestSystem } from './FishingTestSystem'
import { ItemActionTestSystem } from './ItemActionTestSystem'
import { PersistenceTestSystem } from './PersistenceTestSystem'
import { PlayerTestSystem } from './PlayerTestSystem'
import { SkillsTestSystem } from './SkillsTestSystem'
import { UITestSystem } from './UITestSystem'
import { WoodcuttingTestSystem } from './WoodcuttingTestSystem'

// PERFORMANCE MONITORING

import type { CameraSystem as CameraSystemInterface } from '../types/physics'
import { ActionRegistry } from './ActionRegistry'
import { CombatTestSystem } from './CombatTestSystem'
import { LootDropTestSystem } from './LootDropTestSystem'
import { SkillsSystem } from './SkillsSystem'
import { UISystem } from './UISystem'



// Interface for the systems collection
export interface Systems {
  actionRegistry?: ActionRegistry
  database?: DatabaseSystem
  player?: PlayerSystem
  inventory?: InventorySystem
  combat?: CombatSystem
  skills?: SkillsSystem
  banking?: BankingSystem
  interaction?: InteractionSystem
  mob?: MobSystem
  ui?: UISystem
  store?: StoreSystem
  resource?: ResourceSystem
  pathfinding?: PathfindingSystem
  worldGeneration?: WorldGenerationSystem
  aggro?: AggroSystem
  equipment?: EquipmentSystem
  itemPickup?: ItemPickupSystem
  itemActions?: ItemActionSystem
  playerSpawn?: PlayerSpawnSystem
  processing?: ProcessingSystem
  attackStyle?: AttackStyleSystem
  entityManager?: EntityManager
  death?: DeathSystem
  inventoryInteraction?: InventoryInteractionSystem
  loot?: LootSystem
    cameraSystem?: CameraSystemInterface
  movementSystem?: unknown
  npc?: NPCSystem
  mobAI?: MobAISystem
  visualTest?: VisualTestSystem
  testCombat?: CombatTestSystem
  testAggro?: AggroTestSystem
  testInventory?: InventoryTestSystem
  testBanking?: BankingTestSystem
  testStore?: StoreTestSystem
  testResourceGathering?: ResourceGatheringTestSystem
  testEquipment?: EquipmentTestSystem
  testLootDrop?: LootDropTestSystem
  testCorpse?: CorpseTestSystem
  testItemAction?: ItemActionTestSystem
  testFishing?: FishingTestSystem
  testCooking?: CookingTestSystem
  testWoodcutting?: WoodcuttingTestSystem
  testFiremaking?: FiremakingTestSystem
  testDeath?: DeathTestSystem
  testPersistence?: PersistenceTestSystem
  testSkills?: SkillsTestSystem
  testPlayer?: PlayerTestSystem
  testDatabase?: DatabaseTestSystem
  testRunner?: TestRunner
  mobSpawner?: MobSpawnerSystem
  itemSpawner?: ItemSpawnerSystem
  testUI?: UITestSystem
  worldVerification?: unknown
}

/**
 * Register all systems with a Hyperscape world
 * This is the main entry point called by the bootstrap
 */
export async function registerSystems(world: World): Promise<void> {
  // Use a centralized logger
  const _logger = (world as { logger?: { system: (msg: string) => void } }).logger;
  
  // Helper for env var checks
  const serverEnv = (typeof process !== 'undefined' ? (process.env || {}) : {}) as Record<string, string | undefined>;
  
  // Allow disabling all RPG registrations via env flag to debug core systems only
  // Supports both server-side (process.env) and client-side (globalThis.env) flags
  const disableRPGViaProcess = (typeof process !== 'undefined' && typeof process.env !== 'undefined')
    ? (process.env.DISABLE_RPG === '1' || process.env.DISABLE_RPG === 'true' || process.env.DISABLE_RPG === 'yes' || process.env.DISABLE_RPG === 'on')
    : false;
  const globalEnv = (typeof globalThis !== 'undefined'
    ? (globalThis as unknown as { env?: Record<string, string> }).env
    : undefined);
  const disableRPGViaGlobal = globalEnv ? (isTruthy(globalEnv.DISABLE_RPG) || isTruthy(globalEnv.PUBLIC_DISABLE_RPG)) : false;
  const disableRPG = disableRPGViaProcess || disableRPGViaGlobal;
  
  // Check if tests are enabled (via env flags)
  const testsEnabled = isTruthy(serverEnv.ENABLE_TESTS) || isTruthy(serverEnv.PUBLIC_ENABLE_TESTS);
  
  // Register -specific components FIRST, before any systems
  registerComponent(
    'combat',
    CombatComponent as ComponentConstructor
  )
  registerComponent(
    'visual',
    VisualComponent as ComponentConstructor
  )
  registerComponent(
    'interaction',
    InteractionComponent as ComponentConstructor
  )
  registerComponent('usage', UsageComponent as ComponentConstructor)

  // Register data components using the generic DataComponent class
  // Include commonly used pure-data components so entity construction never fails
  const dataComponents = [
    'stats',
    'inventory',
    'equipment',
    'movement',
    'stamina',
    'ai',
    'respawn'
  ]
  for (const componentType of dataComponents) {
    registerComponent(
      componentType,
      DataComponent as ComponentConstructor
    )
  }

  // Initialize centralized data manager
  const dataValidation = await dataManager.initialize()

  if (!dataValidation.isValid) {
    throw new Error('Failed to initialize game data: ' + dataValidation.errors.join(', '))
  }

  const systems: Systems = {}

  // === FOUNDATIONAL SYSTEMS ===
  // These must be registered first as other systems depend on them

  // 1. Action Registry - Creates world.actionRegistry for action discovery
  world.register('action-registry', ActionRegistry)

  // 2. Entity Manager - Core entity management system
  world.register('entity-manager', EntityManager)

  // 3. Database system - For persistence (server only)
  // Note: The actual DatabaseSystem is registered by the server package before world.init()
  // The stub in ./DatabaseSystem.ts is just for type compatibility
  if (world.isServer && !world.getSystem('database')) {
    // Only register stub if server hasn't already registered the real DatabaseSystem
    const { DatabaseSystem } = await import('./DatabaseSystem');
    world.register('database', DatabaseSystem)
  }

  // 4. Persistence system - Core data management
  world.register('persistence', PersistenceSystem)

  // === CORE ENTITY SYSTEMS ===
  // These systems manage the primary game entities

  // 5. Player system - Core player management (depends on database & persistence)
  world.register('player', PlayerSystem)

  // 22. Pathfinding system - AI movement (depends on mob system)
  world.register('pathfinding', PathfindingSystem)

  // 23. Player spawn system - Player spawning logic (depends on player & world systems)
  world.register('player-spawn', PlayerSpawnSystem)
  
  systems.player = getSystem(world, 'player') as PlayerSystem
  systems.playerSpawn = getSystem(world, 'player-spawn') as PlayerSpawnSystem
  systems.pathfinding = getSystem(world, 'pathfinding') as PathfindingSystem
  systems.entityManager = getSystem(world, 'entity-manager') as EntityManager

  if (world.isClient) {
    world.register('interaction', InteractionSystem)
    world.register('ui', UISystem)
    // CameraSystem moved to core ClientCameraSystem
    // Removed UIComponents - replaced with React components
    systems.interaction = getSystem(world, 'interaction') as InteractionSystem
    systems.ui = getSystem(world, 'ui') as UISystem
    systems.cameraSystem = getSystem(world, 'client-camera-system') as unknown as CameraSystemInterface
    systems.movementSystem = getSystem(world, 'client-movement-system') as unknown
    // Register movement validation system for runtime testing
    // world.register('movement-validation', MovementValidationSystem) // This line is removed
  }

  if (disableRPG) {
    // Skip registering any RPG systems/components/APIs
    return;
  }

  // 6. Mob system - Core mob management
  world.register('mob', MobSystem)

  // 7. World generation - Terrain and world structure
  world.register('world-generation', WorldGenerationSystem)

  // === INTERACTION SYSTEMS ===
  // These systems handle player-world interactions

  // 8. Combat system - Core combat mechanics (depends on player & mob systems)
  world.register('combat', CombatSystem)

  // 9. Inventory system - Item management (depends on player system)
    world.register('inventory', InventorySystem)

    // 11. Equipment system - Item equipping (depends on inventory system)
    world.register('equipment', EquipmentSystem)

    // 12. XP system - Experience and leveling (depends on player system)
    world.register('skills', SkillsSystem)

    // 12a. XP system alias for backward compatibility with test framework
    world.register('xp', SkillsSystem)

    // === SPECIALIZED SYSTEMS ===
    // These systems provide specific game features

    // 13. Banking system - Item storage (depends on inventory system)
    world.register('banking', BankingSystem)

    // 14. Store system - Item trading (depends on inventory system)
    world.register('store', StoreSystem)

    // 15. Resource system - Gathering mechanics (depends on inventory system)
    world.register('resource', ResourceSystem)

    // Client-only interaction systems (context menus, UI)
    if (world.isClient) {
      // 15a. Entity Interaction system - Single context menu handler for ALL entity types
      world.register('entity-interaction', EntityInteractionSystem)
      
      // 15b. Resource visualization system - Creates visible meshes for resources
      world.register('resource-visualization', ResourceVisualizationSystem)
    }

    // 16. Item pickup system - Ground item management (depends on inventory system)
    // NOTE: DISABLED - ItemPickupSystem conflicts with new EntityManager + InventorySystem architecture
    // The new architecture uses:
    //   - EntityManager to create/destroy ItemEntity objects (3D visuals)
    //   - InventorySystem to handle ITEM_PICKUP and ITEM_DROP (inventory data)
    // ItemPickupSystem is legacy and creates duplicate event handlers
    // world.register('item-pickup', ItemPickupSystem)

    // 17. Item actions system - Item usage mechanics (depends on inventory system)
    world.register('item-actions', ItemActionSystem)

    // 18. Processing system - Crafting and item processing (depends on inventory system)
    world.register('processing', ProcessingSystem)

    // === GAMEPLAY SYSTEMS ===
    // These systems provide advanced gameplay mechanics

    // 19. Death system - Death and respawn mechanics (depends on player system)
    world.register('death', DeathSystem)

    // 20. Attack style system - Combat style management (depends on combat system)
    world.register('attack-style', AttackStyleSystem)

    // 21. Aggro system - AI aggression management (depends on mob & combat systems)
    world.register('aggro', AggroSystem)

    // 24. Movement system - unified client movement handles movement; remove server RPG movement

    // Performance optimization systems
    world.register('entity-culling', EntityCullingSystem)

    // Client-only inventory drag & drop (already registered above)
    if (world.isClient) {
      world.register('inventory-interaction', InventoryInteractionSystem)
      // NOTE: entity-interaction already registered above (line 329)
    }

    // New MMO-style Systems
    world.register('loot', LootSystem)

    // World Content Systems (server only for world management)
    if (world.isServer) {
      world.register('npc', NPCSystem)
      world.register('mob-ai', MobAISystem)
    }

    // VISUAL TEST SYSTEMS - PERMANENTLY DISABLED
    // These create colored cube proxies which interfere with actual 3D models
    // DO NOT ENABLE unless specifically testing with cube proxies
    // if (testsEnabled) {
    //   world.register('visual-test', VisualTestSystem)
    //   world.register('performance-monitor', PerformanceMonitor)
    // }

    // Server-only systems
    if (world.isServer) {
      // Core validation test (only when tests enabled)
      if (testsEnabled) {
        // DISABLED: These test systems cause continuous spawning and memory leaks
        // world.register('system-validation-test', SystemValidationTestSystem)
        // world.register('database-test', DatabaseTestSystem)
      }
    }

    // UNIFIED TERRAIN SYSTEMS - USING PROCEDURAL TERRAIN
    // Note: Client terrain is registered in createClientWorld.ts as 'client-terrain'
    // Terrain system now unified and registered in createClientWorld/createServerWorld

    // DYNAMIC WORLD CONTENT SYSTEMS - FULL THREE.JS ACCESS, NO SANDBOX
    // world.register('default-world', DefaultWorldSystem)
    world.register('mob-spawner', MobSpawnerSystem)
    world.register('item-spawner', ItemSpawnerSystem)

    // Only register client-only systems on client side (they need DOM/canvas/browser APIs)
    const isClientEnvironment = world.isClient

    if (isClientEnvironment) {
      // Removed console.log('[SystemLoader] Registering client-only systems')
      // DISABLED: TestUISystem may also cause issues
      // world.register('test-ui', TestUISystem)

      // TEST SYSTEMS - DISABLED FOR PRODUCTION
      // These create visual cube proxies that interfere with actual 3D models
      // Tests should be run separately in a test environment, not during normal gameplay
      if (testsEnabled) {
        console.log('[SystemLoader] ⚠️  Test systems DISABLED - they create visual cubes that clutter the scene');
        console.log('[SystemLoader] To run tests, use a dedicated test environment');
        
        // DISABLED: All test systems create visual cubes for validation
        // They are useful for automated testing but interfere with normal gameplay
        // 
        // world.register('test-combat', CombatTestSystem)
        // world.register('test-aggro', AggroTestSystem)
        // world.register('test-inventory', InventoryTestSystem)
        // world.register('test-banking', BankingTestSystem)
        // world.register('test-store', StoreTestSystem)
        // world.register('test-resource-gathering', ResourceGatheringTestSystem)
        // world.register('test-equipment', EquipmentTestSystem)
        // world.register('loot-drop-test', LootDropTestSystem)
        // world.register('corpse-test', CorpseTestSystem)
        // world.register('item-action-test', ItemActionTestSystem)
        // world.register('fishing-test', FishingTestSystem)
        // world.register('cooking-test', CookingTestSystem)
        // world.register('woodcutting-test', WoodcuttingTestSystem)
        // world.register('firemaking-test', FiremakingTestSystem)
        // world.register('death-test', DeathTestSystem)
        // world.register('persistence-test', PersistenceTestSystem)
        // world.register('skills-test', SkillsTestSystem)
        // world.register('player-test', PlayerTestSystem)
        // world.register('test-runner', TestRunner)
        // world.register('ui-test', UITestSystem)
      }
    } else {
      // Removed console.log('[SystemLoader] Server mode - skipping client-only systems')
    }

    // Get system instances after world initialization
    // Systems are directly available as properties on the world object after registration
    // Database system is only available on server
    systems.database = getSystem(world, 'database') as DatabaseSystem
    systems.combat = getSystem(world, 'combat') as CombatSystem
    systems.inventory = getSystem(world, 'inventory') as InventorySystem
    systems.skills = getSystem(world, 'skills') as SkillsSystem
    systems.mob = getSystem(world, 'mob') as MobSystem
    systems.ui = getSystem(world, 'ui') as UISystem
    systems.banking = getSystem(world, 'banking') as BankingSystem
    systems.store = getSystem(world, 'store') as StoreSystem
    systems.resource = getSystem(world, 'resource') as ResourceSystem
    // Movement now handled by physics in PlayerLocal

    systems.worldGeneration = getSystem(world, 'world-generation') as WorldGenerationSystem
    systems.aggro = getSystem(world, 'aggro') as AggroSystem
    systems.equipment = getSystem(world, 'equipment') as EquipmentSystem
    systems.itemPickup = getSystem(world, 'item-pickup') as ItemPickupSystem
    systems.itemActions = getSystem(world, 'item-actions') as ItemActionSystem
    systems.processing = getSystem(world, 'processing') as ProcessingSystem
    systems.attackStyle = getSystem(world, 'attack-style') as AttackStyleSystem
    systems.death = getSystem(world, 'death') as DeathSystem

    // Client-only systems
    if (world.isClient) {
      systems.inventoryInteraction = getSystem(world, 'inventory-interaction') as InventoryInteractionSystem
    }

    // New MMO-style Systems
    systems.loot = getSystem(world, 'loot') as LootSystem
    if (world.isClient) {

      // Removed uiComponents - replaced with React components
    }

    // World Content Systems
    if (world.isServer) {
      systems.npc = getSystem(world, 'npc') as NPCSystem
      systems.mobAI = getSystem(world, 'mob-ai') as MobAISystem
    }
    // Server-only test system instances
    if (world.isServer && testsEnabled) {
      systems.testDatabase = getSystem(world, 'database-test') as DatabaseTestSystem
    }
    
    // Client-only test system instances (they require PhysX)
    if (world.isClient && testsEnabled) {
      systems.testCombat = getSystem(world, 'test-combat') as CombatTestSystem
      systems.testAggro = getSystem(world, 'test-aggro') as AggroTestSystem
      systems.testInventory = getSystem(world, 'test-inventory') as InventoryTestSystem
      systems.testBanking = getSystem(world, 'test-banking') as BankingTestSystem
      systems.testStore = getSystem(world, 'test-store') as StoreTestSystem
      systems.testResourceGathering = getSystem(world, 'test-resource-gathering') as ResourceGatheringTestSystem
      systems.testEquipment = getSystem(world, 'test-equipment') as EquipmentTestSystem

      // New comprehensive test systems
      systems.testLootDrop = getSystem(world, 'loot-drop-test') as LootDropTestSystem
      systems.testCorpse = getSystem(world, 'corpse-test') as CorpseTestSystem
      systems.testItemAction = getSystem(world, 'item-action-test') as ItemActionTestSystem
      systems.testFishing = getSystem(world, 'fishing-test') as FishingTestSystem
      systems.testCooking = getSystem(world, 'cooking-test') as CookingTestSystem
      systems.testWoodcutting = getSystem(world, 'woodcutting-test') as WoodcuttingTestSystem
      systems.testFiremaking = getSystem(world, 'firemaking-test') as FiremakingTestSystem
      systems.testDeath = getSystem(world, 'death-test') as DeathTestSystem
      systems.testPersistence = getSystem(world, 'persistence-test') as PersistenceTestSystem
      systems.testSkills = getSystem(world, 'skills-test') as SkillsTestSystem
      systems.testPlayer = getSystem(world, 'player-test') as PlayerTestSystem
    }

    // DYNAMIC WORLD CONTENT SYSTEMS
    // World verification system removed
    systems.mobSpawner = getSystem(world, 'mob-spawner') as MobSpawnerSystem
    systems.itemSpawner = getSystem(world, 'item-spawner') as ItemSpawnerSystem
    systems.testUI = getSystem(world, 'test-ui') as UITestSystem // Will be undefined on server, which is fine


  // Set up API for apps to access functionality
  setupAPI(world, systems)
}

/**
 * Set up global API for apps to use
 */
function setupAPI(world: World, systems: Systems): void {
  // Set up comprehensive API for apps
  const rpgAPI = {
    // Actions - convert to Record format expected by World interface
    rpgActions: (() => {
      const actionsRecord: Record<
        string,
        { name: string; execute: (params: Record<string, unknown>) => Promise<unknown>; [key: string]: unknown }
      > = {}

      // Basic actions for compatibility
      actionsRecord['attack'] = {
        name: 'attack',
        requiresAmmunition: false,
        execute: async _params => {
          return { success: true }
        },
      }

      actionsRecord['attack_ranged'] = {
        name: 'attack',
        requiresAmmunition: true,
        execute: async _params => {
          return { success: true }
        },
      }

      actionsRecord['chop'] = {
        name: 'chop',
        skillRequired: 'woodcutting',
        execute: async _params => {
          return { success: true }
        },
      }

      actionsRecord['fish'] = {
        name: 'fish',
        skillRequired: 'fishing',
        execute: async _params => {
          return { success: true }
        },
      }

      return actionsRecord
    })(),

    // Database API
    getRPGPlayer: (playerId: string) => systems.database?.getPlayer(playerId),
    savePlayer: (playerId: string, data: Partial<PlayerRow>) => systems.database?.savePlayer(playerId, data),

    getAllPlayers: () => systems.player?.getAllPlayers(),
    healPlayer: (playerId: string, amount: number) => systems.player?.healPlayer(playerId, amount),
    damagePlayer: (playerId: string, amount: number) => systems.player?.damagePlayer(playerId, amount),
    isPlayerAlive: (playerId: string) => systems.player?.isPlayerAlive(playerId),
    getPlayerHealth: (playerId: string) => {
      return systems.player?.getPlayerHealth(playerId) ?? { current: 100, max: 100 }
    },
    teleportPlayer: (playerId: string, position: Position3D) =>
      (systems.movementSystem as unknown as { teleportPlayer?: (id: string, pos: Position3D) => boolean | Promise<boolean> })?.teleportPlayer?.(playerId, position),

    // Combat API
    startCombat: (attackerId: string, targetId: string) => systems.combat?.startCombat(attackerId, targetId),
    stopCombat: (attackerId: string) => systems.combat?.forceEndCombat(attackerId),
    canAttack: (_attackerId: string, _targetId: string) => true, // Combat system doesn't have canAttack method
    isInCombat: (entityId: string) => systems.combat?.isInCombat(entityId),

    // Inventory API
    getInventory: (playerId: string) => {
      const inventory = systems.inventory?.getInventory(playerId)
      if (!inventory) return []
      return inventory.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        slot: item.slot,
        name: item.item?.name || item.itemId,
        stackable: item.item?.stackable || false,
      }))
    },
    getEquipment: (playerId: string) => {
      const equipment = systems.equipment?.getEquipmentData(playerId)
      if (!equipment) return {}
      // Convert equipment data to expected format
      const result: Record<string, { itemId: string; [key: string]: unknown }> = {}
      for (const [slot, item] of Object.entries(equipment)) {
        if (item && typeof item === 'object') {
          const itemObj = item as { id: unknown; name?: unknown; count?: unknown }
          result[slot] = {
            itemId: String(itemObj.id),
            name: itemObj.name as string | undefined,
            count: (itemObj.count as number) || 1,
          }
        }
      }
      return result
    },
    hasItem: (playerId: string, itemId: string | number, quantity?: number) =>
      systems.inventory?.hasItem(playerId, String(itemId), quantity),
    getArrowCount: (playerId: string) => {
      const inventory = systems.inventory?.getInventory(playerId)
      if (!inventory) return 0
      const arrows = inventory.items.find(
        (item: InventorySlotItem) => item.itemId === 'bronze_arrows' || item.itemId === 'arrows'
      )
      return arrows?.quantity || 0
    },
    canAddItem: (playerId: string, _item: Item | InventorySlotItem) => {
      const inventory = systems.inventory?.getInventory(playerId)
      return inventory ? inventory.items.length < 28 : false // Default inventory capacity
    },

    getSkills: (playerId: string) => {
      // Get all skills for a player by getting the entity's stats component
      const entity = world.entities.get(playerId)
      if (!entity) return {}
      const stats = (entity as Entity).getComponent<Component>('stats') as Skills | null
      return stats || {}
    },
    getSkillLevel: (playerId: string, skill: string) => {
      const skillData = systems.skills?.getSkillData(playerId, skill as keyof Skills)
      return skillData?.level || 1
    },
    getSkillXP: (playerId: string, skill: string) => {
      const skillData = systems.skills?.getSkillData(playerId, skill as keyof Skills)
      return skillData?.xp || 0
    },
    getCombatLevel: (playerId: string) => {
      const entity = world.entities.get(playerId)
      if (!entity) return 1
      const stats = (entity as Entity).getComponent<Component>('stats') as StatsComponent | null
      if (!stats) return 1
      return systems.skills?.getCombatLevel(stats) ?? 1
    },
    getXPToNextLevel: (playerId: string, skill: string) => {
      const skillData = systems.skills?.getSkillData(playerId, skill as keyof Skills)
      if (!skillData) return 0
      return systems.skills?.getXPToNextLevel(skillData) ?? 0
    },

    // UI API
    getPlayerUIState: (playerId: string) => systems.ui?.getPlayerUIState(playerId),
    forceUIRefresh: (playerId: string) => systems.ui?.forceUIRefresh(playerId),
    sendUIMessage: (playerId: string, message: string, type?: 'info' | 'warning' | 'error') =>
      systems.ui?.sendUIMessage(playerId, message, type),

    // Mob API
    getMob: (mobId: string) => systems.mob?.getMob(mobId),
    getAllMobs: () => systems.mob?.getAllMobs(),
    getMobsInArea: (center: Position3D, radius: number) => systems.mob?.getMobsInArea(center, radius),
    spawnMob: (type: string, position: Position3D) =>
      systems.mob && world.emit(EventType.MOB_SPAWN_REQUEST, { mobType: type, position }),

    // Banking API
    getBankData: (_playerId: string, _bankId: string) => null, // Banking system doesn't expose public methods
    getAllPlayerBanks: (_playerId: string) => [], // Banking system doesn't expose public methods
    getBankLocations: () => [], // Banking system doesn't expose public methods
    getItemCountInBank: (_playerId: string, _bankId: string, _itemId: number) => 0,
    getTotalItemCountInBanks: (_playerId: string, _itemId: number) => 0,

    // Store API
    getStore: (storeId: string) => systems.store?.getStore(storeId),
    getAllStores: () => systems.store?.getAllStores(),
    getStoreLocations: () => systems.store?.getStoreLocations(),
    getItemPrice: (_storeId: string, _itemId: number) => 0, // Store system doesn't expose this method
    isItemAvailable: (_storeId: string, _itemId: number, _quantity?: number) => false, // Store system doesn't expose this method

    // Resource API
    getResource: (resourceId: string) => systems.resource?.getResource(resourceId),
    getAllResources: () => systems.resource?.getAllResources(),
    getResourcesByType: (type: 'tree' | 'fishing_spot' | 'ore') => systems.resource?.getResourcesByType(type),
    getResourcesInArea: (_center: Position3D, _radius: number) => [], // Resource system doesn't expose this method
    isPlayerGathering: (_playerId: string) => false, // Resource system doesn't expose this method

    // Movement API (Physics-based in PlayerLocal)
    isPlayerMoving: (playerId: string) =>
      (systems.movementSystem as unknown as { isMoving?: (id: string) => boolean })?.isMoving?.(playerId),
    getPlayerStamina: (_playerId: string) => ({ current: 100, max: 100, regenerating: true }), // MovementSystem doesn't have stamina
    movePlayer: (playerId: string, targetPosition: Position3D) =>
      (systems.movementSystem as unknown as { movePlayer?: (id: string, pos: Position3D) => void })?.movePlayer?.(playerId, targetPosition),

    // Death API
    getDeathLocation: (playerId: string) => systems.death?.getDeathLocation(playerId),
    getAllDeathLocations: () => systems.death?.getAllDeathLocations(),
    isPlayerDead: (playerId: string) => systems.death?.isPlayerDead(playerId),
    getRemainingRespawnTime: (playerId: string) => systems.death?.getRemainingRespawnTime(playerId),
    getRemainingDespawnTime: (playerId: string) => systems.death?.getRemainingDespawnTime(playerId),
    forceRespawn: (playerId: string) => systems.death?.forceRespawn(playerId),

    // Terrain API (Terrain System)
    getHeightAtPosition: (_worldX: number, _worldZ: number) => 0, // Terrain system doesn't expose this method
    getBiomeAtPosition: (_worldX: number, _worldZ: number) => 'plains', // Terrain system doesn't expose this method
    getTerrainStats: () => ({}), // Terrain system doesn't expose this method
    getHeightAtWorldPosition: (_x: number, _z: number) => 0, // Terrain system doesn't expose this method

    // Dynamic World Content API (Full THREE.js Access)
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

    // Visual Test Systems API
    getTestCombatResults: () => null, // Test systems don't expose getTestResults method
    getTestAggroResults: () => null, // Test systems don't expose getTestResults method
    getTestInventoryResults: () => null, // Test systems don't expose getTestResults method
    getTestBankingResults: () => null, // Test systems don't expose getTestResults method
    getTestStoreResults: () => null, // Test systems don't expose getTestResults method
    getTestResourceGatheringResults: () => null, // Test systems don't expose getTestResults method
    getTestEquipmentResults: () => null, // Test systems don't expose getTestResults method
    getTestMovementResults: () => null, // Test systems don't expose getTestResults method
    getTestPhysicsResults: () => null, // Test systems don't expose getTestResults method
    getTestRunnerResults: () => systems.testRunner?.getTestResults(),
    getAllTestResults: () => ({
      combat: null,
      aggro: null,
      inventory: null,
      banking: null,
      store: null,
      resourceGathering: null,
      equipment: null,
      movement: null,
      runner: systems.testRunner?.getTestResults(),
    }),

    // Test Runner API
    runAllTests: () => systems.testRunner && world.emit(EventType.TEST_RUN_ALL),
    runSpecificTest: (testName: string) => systems.testRunner?.runSpecificSystem(testName),
    isTestRunning: () => systems.testRunner?.isTestRunning(),
    getErrorLog: () => systems.testRunner?.getErrorLog(),

    // Visual Test System API (Main cube-based testing system)
    getVisualTestReport: () => null,
    getVisualEntitiesByType: (type: string) => (systems.visualTest as VisualTestSystem)?.getEntitiesByType(type),
    getVisualEntitiesByColor: (color: number) => (systems.visualTest as VisualTestSystem)?.getEntitiesByColor(color),
    verifyEntityExists: (entityId: string, expectedType?: string) =>
      (systems.visualTest as VisualTestSystem)?.verifyEntityExists(entityId, expectedType),
    verifyPlayerAtPosition: (playerId: string, position: Position3D, tolerance?: number) =>
      (systems.visualTest as VisualTestSystem)?.verifyPlayerAtPosition(playerId, position, tolerance),
    getAllVisualEntities: () => (systems.visualTest as VisualTestSystem)?.getAllEntities(),

    // Loot API
    spawnLoot: (_mobType: string, _position: Position3D, _killerId?: string) => null, // Loot system doesn't expose this method
    getLootTable: (_mobType: string) => [], // Loot system doesn't expose this method
    getDroppedItems: () => [], // Loot system doesn't expose this method

    // Equipment API
    getPlayerEquipment: (playerId: string) => systems.equipment?.getPlayerEquipment(playerId),
    getEquipmentData: (playerId: string) => systems.equipment?.getEquipmentData(playerId),
    getEquipmentStats: (playerId: string) => systems.equipment?.getEquipmentStats(playerId),
    isItemEquipped: (playerId: string, itemId: number) => systems.equipment?.isItemEquipped(playerId, itemId),
    canEquipItem: (playerId: string, itemId: number) => systems.equipment?.canEquipItem(playerId, itemId),
    consumeArrow: (playerId: string) => systems.equipment?.consumeArrow(playerId),

    // Item Pickup API
    dropItem: (item: Item, position: Position3D, droppedBy?: string) =>
      droppedBy
        ? systems.itemPickup?.dropItem(item, position, droppedBy)
        : systems.itemPickup?.dropItem(item, position, ''),
    getItemsInRange: (position: Position3D, range?: number) =>
      systems.itemPickup?.getItemsInRange(position, range || 5),
    getGroundItem: (itemId: string) => systems.itemPickup?.getGroundItem(itemId),
    getAllGroundItems: () => systems.itemPickup?.getAllGroundItems(),
    clearAllItems: () => systems.itemPickup?.clearAllItems(),

    // Item Actions API
    registerItemAction: (category: string, action: ItemAction) => systems.itemActions?.registerAction(category, action),

    // Inventory Interaction API (client only)
    isDragging: () => systems.inventoryInteraction?.getSystemInfo()?.isDragging || false,
    getDropTargetsCount: () => systems.inventoryInteraction?.getSystemInfo()?.dropTargetsCount || 0,

    // Processing API
    getActiveFires: () => systems.processing?.getActiveFires(),
    getPlayerFires: (playerId: string) => systems.processing?.getPlayerFires(playerId),
    isPlayerProcessing: (playerId: string) => systems.processing?.isPlayerProcessing(playerId),
    getFiresInRange: (position: Position3D, range?: number) =>
      systems.processing?.getFiresInRange(position, range || 5),

    // Attack Style API
    getPlayerAttackStyle: (playerId: string) => systems.attackStyle?.getPlayerAttackStyle(playerId),
    getAllAttackStyles: () => systems.attackStyle?.getAllAttackStyles(),
    canPlayerChangeStyle: (playerId: string) => systems.attackStyle?.canPlayerChangeStyle(playerId),
    getRemainingStyleCooldown: (playerId: string) => systems.attackStyle?.getRemainingCooldown(playerId),
    forceChangeAttackStyle: (playerId: string, styleId: string) =>
      systems.attackStyle?.forceChangeAttackStyle(playerId, styleId),
    getPlayerStyleHistory: (playerId: string) => systems.attackStyle?.getPlayerStyleHistory(playerId),
    getAttackStyleSystemInfo: () => systems.attackStyle?.getSystemInfo(),

    // App Manager API
    createApp: (_appType: string, _config: AppConfig) => null,
    destroyApp: (_appId: string) => {},
    getApp: (_appId: string) => null,
    getAllApps: () => [],
    getAppsByType: (_type: string) => [],
    getAppCount: () => 0,

    // Entity Manager API (Server-authoritative)
    spawnEntity: (config: EntityConfig) => systems.entityManager?.spawnEntity(config),
    destroyEntity: (entityId: string) => systems.entityManager?.destroyEntity(entityId),
    getEntity: (entityId: string) => systems.entityManager?.getEntity(entityId),
    getEntitiesByType: (type: string) => systems.entityManager?.getEntitiesByType(type),
    getEntitiesInRange: (center: Position3D, range: number, type?: string) =>
      systems.entityManager?.getEntitiesInRange(center, range, type),
    getAllEntities: () => [], // Entity manager doesn't expose this method
    getEntityCount: () => 0, // Entity manager doesn't expose this method
    getEntityDebugInfo: () => systems.entityManager?.getDebugInfo(),

    // Player Spawn API
    hasPlayerCompletedSpawn: (playerId: string) => systems.playerSpawn?.hasPlayerCompletedSpawn(playerId),
    getPlayerSpawnData: (playerId: string) => systems.playerSpawn?.getPlayerSpawnData(playerId),
    forceTriggerAggro: (playerId: string) => systems.playerSpawn?.forceTriggerAggro(playerId),
    getAllSpawnedPlayers: () => systems.playerSpawn?.getAllSpawnedPlayers(),

    // Interaction API (Client only)
    registerInteractable: (data: Record<string, unknown>) =>
      systems.interaction && world.emit(EventType.INTERACTION_REGISTER, data),
    unregisterInteractable: (appId: string) =>
      systems.interaction && world.emit(EventType.INTERACTION_UNREGISTER, { appId }),

    // Camera API (Core ClientCameraSystem)
    getCameraInfo: () => (systems.cameraSystem && 'getCameraInfo' in systems.cameraSystem
      ? (systems.cameraSystem as unknown as { getCameraInfo: () => unknown }).getCameraInfo()
      : undefined),
    setCameraTarget: (_target: THREE.Object3D | null) => {}, // setTarget is private
    setCameraEnabled: (_enabled: boolean) => undefined,
    resetCamera: () => {}, // resetCamera is private

    // UI Components API (Client only)
    updateHealthBar: (data: { health: number; maxHealth: number }) =>
      world.emit(EventType.UI_UPDATE, { component: 'health', data }),
    updateInventory: (data: Inventory) => world.emit(EventType.UI_UPDATE, { component: 'inventory', data }),
    addChatMessage: (message: string, type?: string) => world.emit(EventType.UI_MESSAGE, { 
      playerId: 'system', 
      message, 
      type: (type || 'info') as 'info' | 'warning' | 'error' | 'success' 
    }),

    // World Content API (Server only)
    getWorldAreas: () => [], // World content system doesn't expose getAllWorldAreas method

    // NPC API (Server only)
    getPlayerBankContents: (playerId: string) => systems.npc?.getPlayerBankContents(playerId),
    getStoreInventory: () => systems.npc?.getStoreInventory(),
    getTransactionHistory: (playerId?: string) => systems.npc?.getTransactionHistory(playerId),
    getNPCSystemInfo: () => systems.npc?.getSystemInfo(),

    // Mob AI API (Server only)
    getMobAIInfo: () => systems.mobAI?.getSystemInfo(),

    // System references for advanced usage - convert to Record format
    rpgSystems: Object.entries(systems).reduce(
      (acc, [key, system]) => {
        if (system) {
          acc[key] = {
            name: key,
            ...system,
          }
        }
        return acc
      },
      {} as Record<string, { name: string; [key: string]: unknown }>
    ),

    // Action methods for apps to trigger
    actionMethods: {
      // Player actions
      updatePlayer: (playerId: string, data: Partial<PlayerRow>) => {
        systems.database?.savePlayer(playerId, data)
        world.emit(EventType.PLAYER_UPDATED, { playerId, data })
      },

      // Combat actions
      startAttack: (attackerId: string, targetId: string, attackStyle?: string) => {
        world.emit(EventType.COMBAT_START_ATTACK, { attackerId, targetId, attackStyle })
      },

      stopAttack: (attackerId: string) => {
        world.emit(EventType.COMBAT_STOP_ATTACK, { attackerId })
      },

      // XP actions
      grantXP: (playerId: string, skill: string, amount: number) => {
        world.emit(EventType.SKILLS_XP_GAINED, { playerId, skill, amount })
      },

      // Inventory actions
      giveItem: (playerId: string, item: Item | { itemId: string; quantity: number }) => {
        const inventoryItem = {
          id: `${playerId}_${'itemId' in item ? item.itemId : item.id}_${Date.now()}`,
          itemId: 'itemId' in item ? item.itemId : item.id,
          quantity: 'quantity' in item ? item.quantity : 1,
          slot: -1, // Let inventory system assign slot
          metadata: null
        }
        world.emit(EventType.INVENTORY_ITEM_ADDED, { playerId, item: inventoryItem })
      },

      equipItem: (playerId: string, itemId: number, slot: string) => {
        world.emit(EventType.EQUIPMENT_TRY_EQUIP, { playerId, itemId, slot })
      },

      unequipItem: (playerId: string, slot: string) => {
        world.emit(EventType.EQUIPMENT_UNEQUIP, { playerId, slot })
      },

      // Item pickup actions
      dropItemAtPosition: (item: Item, position: Position3D, _playerId?: string) => {
        // Emit ITEM_SPAWN directly instead of ITEM_DROP (which is for inventory operations)
        world.emit(EventType.ITEM_SPAWN, { 
          itemId: item.id, 
          quantity: item.quantity || 1,
          position 
        })
      },

      pickupItem: (playerId: string, itemId: string) => {
        world.emit(EventType.ITEM_PICKUP_REQUEST, { playerId, itemId })
      },

      // Item action triggers
      triggerItemAction: (playerId: string, actionId: string, _itemId: string, _slot?: number) => {
        world.emit(EventType.ITEM_ACTION_SELECTED, { playerId, actionId })
      },

      showItemContextMenu: (playerId: string, itemId: string, position: { x: number; y: number }, slot?: number) => {
        world.emit(EventType.ITEM_RIGHT_CLICK, { playerId, itemId, position, slot })
      },

      // Processing actions
      useItemOnItem: (
        playerId: string,
        primaryItemId: number,
        primarySlot: number,
        targetItemId: number,
        targetSlot: number
      ) => {
        world.emit(EventType.ITEM_USE_ON_ITEM, { playerId, primaryItemId, primarySlot, targetItemId, targetSlot })
      },

      useItemOnFire: (playerId: string, itemId: number, itemSlot: number, fireId: string) => {
        world.emit(EventType.ITEM_USE_ON_FIRE, { playerId, itemId, itemSlot, fireId })
      },

      startFiremaking: (playerId: string, logsSlot: number, tinderboxSlot: number) => {
        world.emit(EventType.PROCESSING_FIREMAKING_REQUEST, { playerId, logsSlot, tinderboxSlot })
      },

      startCooking: (playerId: string, fishSlot: number, fireId: string) => {
        world.emit(EventType.PROCESSING_COOKING_REQUEST, { playerId, fishSlot, fireId })
      },

      // Attack style actions
      changeAttackStyle: (playerId: string, newStyle: string) => {
        world.emit(EventType.COMBAT_ATTACK_STYLE_CHANGE, { playerId, newStyle })
      },

      getAttackStyleInfo: (playerId: string, callback: (info: { style: string; cooldown?: number }) => void) => {
        world.emit(EventType.UI_ATTACK_STYLE_GET, { playerId, callback })
      },

      // Player spawn actions
      respawnPlayerWithStarter: (playerId: string) => {
        world.emit(EventType.PLAYER_SPAWN_COMPLETE, { playerId })
      },

      forceAggroSpawn: (playerId: string) => {
        systems.playerSpawn?.forceTriggerAggro(playerId)
      },

      // Mob actions
      spawnMobAtLocation: (type: string, position: Position3D) => {
        world.emit(EventType.MOB_SPAWN_REQUEST, { mobType: type, position })
      },

      spawnGDDMob: (mobType: string, position: Position3D) => {
        world.emit(EventType.MOB_SPAWN_REQUEST, { mobType, position })
      },

      despawnMob: (mobId: string) => {
        world.emit(EventType.MOB_DESPAWN, mobId)
      },

      respawnAllMobs: () => {
        world.emit(EventType.MOB_RESPAWN_ALL)
      },

      // Item actions
      spawnItemAtLocation: (itemId: string, position: Position3D) => {
        world.emit(EventType.ITEM_SPAWN_REQUEST, { itemId, position })
      },

      spawnGDDItem: (itemId: string, position: Position3D, quantity?: number) => {
        world.emit(EventType.ITEM_SPAWN_REQUEST, { itemId, position, quantity })
      },

      despawnItem: (itemId: string) => {
        world.emit(EventType.ITEM_DESPAWN, itemId)
      },

      respawnShopItems: () => {
        world.emit(EventType.ITEM_RESPAWN_SHOPS)
      },

      spawnLootItems: (position: Position3D, lootTable: string[]) => {
        world.emit(EventType.ITEM_SPAWN_LOOT, { position, lootTable })
      },

      // Banking actions
      openBank: (playerId: string, bankId: string, position: Position3D) => {
        world.emit(EventType.BANK_OPEN, { playerId, bankId, position })
      },

      closeBank: (playerId: string, bankId: string) => {
        world.emit(EventType.BANK_CLOSE, { playerId, bankId })
      },

      depositItem: (playerId: string, bankId: string, itemId: string, quantity: number) => {
        world.emit(EventType.BANK_DEPOSIT, { playerId, bankId, itemId, quantity })
      },

      withdrawItem: (playerId: string, bankId: string, itemId: string, quantity: number) => {
        world.emit(EventType.BANK_WITHDRAW, { playerId, bankId, itemId, quantity })
      },

      // Store actions
      openStore: (playerId: string, storeId: string, playerPosition: Position3D) => {
        world.emit(EventType.STORE_OPEN, { playerId, storeId, playerPosition })
      },

      buyItem: (playerId: string, storeId: string, itemId: number, quantity: number) => {
        world.emit(EventType.STORE_BUY, { playerId, storeId, itemId, quantity })
      },

      // Resource actions
      startGathering: (playerId: string, resourceId: string, playerPosition: Position3D) => {
        world.emit(EventType.RESOURCE_GATHERING_STARTED, { playerId, resourceId, playerPosition })
      },

      stopGathering: (playerId: string) => {
        world.emit(EventType.RESOURCE_GATHERING_STOPPED, { playerId })
      },

      // Movement actions (Physics-based in PlayerLocal)
      clickToMove: (
        playerId: string,
        targetPosition: Position3D,
        _currentPosition: Position3D,
        _isRunning?: boolean
      ) => {
        (systems.movementSystem as unknown as { movePlayer?: (id: string, pos: Position3D) => void })?.movePlayer?.(
          playerId,
          targetPosition
        )
      },

      stopMovement: (playerId: string) => {
        world.emit(EventType.MOVEMENT_STOP, { playerId })
      },

      toggleRunning: (playerId: string, isRunning: boolean) => {
        world.emit(EventType.MOVEMENT_TOGGLE_RUN, { playerId, isRunning })
      },

      // Combat click-to-attack action
      clickToAttack: (attackerId: string, targetId: string) => {
        world.emit(EventType.COMBAT_START_ATTACK, { attackerId, targetId })
      },

      // Terrain actions
      configureTerrain: (config: TerrainConfig) => {
        world.emit(EventType.TERRAIN_CONFIGURE, config)
      },

      generateTerrain: (centerX: number, centerZ: number, radius: number) => {
        world.emit('terrain:generate-initial', { centerX, centerZ, radius })
      },

      spawnResource: (type: string, subType: string, position: Position3D, requestedBy: string) => {
        world.emit(EventType.TERRAIN_SPAWN_RESOURCE, { type, subType, position, requestedBy })
      },

      // World Content actions
      loadWorldArea: (areaId: string) => {
        world.emit(EventType.WORLD_LOAD_AREA, { areaId })
      },

      unloadWorldArea: (areaId: string) => {
        world.emit(EventType.WORLD_UNLOAD_AREA, { areaId })
      },

      // NPC actions
      interactWithNPC: (playerId: string, npcId: string) => {
        world.emit(EventType.NPC_INTERACTION, { playerId, npcId })
      },

      bankDeposit: (playerId: string, itemId: string, quantity: number) => {
        world.emit(EventType.BANK_DEPOSIT, { playerId, itemId, quantity })
      },

      bankWithdraw: (playerId: string, itemId: string, quantity: number) => {
        world.emit(EventType.BANK_WITHDRAW, { playerId, itemId, quantity })
      },

      storeBuy: (playerId: string, itemId: string, quantity: number) => {
        world.emit(EventType.STORE_BUY, { playerId, itemId, quantity })
      },

      storeSell: (playerId: string, itemId: string, quantity: number) => {
        world.emit(EventType.STORE_SELL, { playerId, itemId, quantity })
      },

      // Mob AI actions
      attackMob: (playerId: string, mobId: string, damage: number) => {
        world.emit(EventType.MOB_DAMAGED, { mobId, damage, attackerId: playerId })
      },

      killMob: (mobId: string, killerId: string) => {
        world.emit(EventType.MOB_DIED, { mobId, killerId })
      },

      // App management actions
      createPlayerApp: (playerId: string, config: AppConfig) => {
        world.emit(EventType.PLAYER_CREATE, { playerId, config })
      },

      createMobApp: (mobId: string, mobType: string, config: AppConfig) => {
        world.emit(EventType.MOB_SPAWN_REQUEST, { mobId, mobType, config })
      },

      destroyPlayerApp: (playerId: string) => {
        world.emit(EventType.PLAYER_DESTROY, { playerId })
      },

      destroyMobApp: (mobId: string) => {
        world.emit(EventType.MOB_DESTROY, { mobId })
      },

      // Entity management actions (Server-authoritative)
      spawnEntityAtLocation: (type: string, config: EntityConfig) => {
        world.emit(EventType.ENTITY_SPAWNED, { type, config })
      },

      spawnItemEntity: (itemId: string, position: Position3D, quantity?: number) => {
        world.emit(EventType.ITEM_SPAWN, { itemId, position, quantity })
      },

      spawnMobEntity: (mobType: string, position: Position3D, _level?: number) => {
        world.emit(EventType.MOB_SPAWN_REQUEST, { mobType, position })
      },

      destroyEntityById: (entityId: string) => {
        world.emit(EventType.ENTITY_DEATH, { entityId })
      },

      interactWithEntity: (playerId: string, entityId: string, interactionType: string) => {
        world.emit('entity:interact_request', {
          playerId,
          entityId,
          interactionType,
          playerPosition: world.getPlayer?.(playerId)?.position,
        })
      },

      // Test helper functions for gameplay testing framework
      spawnTestPlayer: (x: number, z: number, color = '#FF0000') => {
        try {
          // Only work on client side where THREE.js scene is available
          if (world.isServer) {
            // Removed console.log('[API] spawnTestPlayer only works on client side')
            return null
          }

          if (!world.stage.scene) {
            throw new Error('World stage not available for spawnTestPlayer')
          }

          // Use global THREE or stage THREE
          if (!THREE) {
            throw new Error('THREE.js not available')
          }

          const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6)
          const material = new THREE.MeshBasicMaterial({ color })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.name = `TestPlayer_${Date.now()}`
          mesh.position.set(x, 0.9, z)
          mesh.userData = {
            type: 'player',
            health: 100,
            maxHealth: 100,
            level: 1,
            inventory: [],
            equipment: {},
          }
          world.stage.scene.add(mesh)
          return mesh
        } catch (_error) {
          return null
        }
      },

      spawnTestGoblin: (x: number, z: number, color = '#00FF00') => {
        try {
          // Only work on client side where THREE.js scene is available
          if (world.isServer) {
            // Removed console.log('[API] spawnTestGoblin only works on client side')
            return null
          }

          if (!world.stage.scene) {
            throw new Error('World stage not available for spawnTestGoblin')
          }

          const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8)
          const material = new THREE.MeshBasicMaterial({ color })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.name = `TestGoblin_${Date.now()}`
          mesh.position.set(x, 0.8, z)
          mesh.userData = {
            type: 'mob',
            mobType: 'goblin',
            health: 50,
            maxHealth: 50,
            level: 1,
          }
          world.stage.scene.add(mesh)
          return mesh
        } catch (_error) {
          // Removed console.error('[API] Failed to spawn test goblin:', _error)
          return null
        }
      },

      spawnTestItem: (x: number, z: number, itemType = 'bronze_sword', color = '#0000FF') => {
        try {
          // Only work on client side where THREE.js scene is available
          if (world.isServer) {
            // Removed console.log('[API] spawnTestItem only works on client side')
            return null
          }

          if (!world.stage.scene) {
            throw new Error('World stage not available for spawnTestItem')
          }
          
          if (!THREE) {
            throw new Error('THREE.js not available')
          }

          const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
          const material = new THREE.MeshBasicMaterial({ color })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.name = `TestItem_${itemType}_${Date.now()}`
          mesh.position.set(x, 0.25, z)
          mesh.userData = {
            type: 'item',
            itemType: itemType,
            quantity: 1,
          }
          world.stage.scene.add(mesh)
          return mesh
        } catch (_error) {
          // Removed console.error('[API] Failed to spawn test item:', _error)
          return null
        }
      },

      simulateCombat: (attacker: THREE.Object3D, target: THREE.Object3D) => {
        try {
          if (!attacker || !target) {
            return { error: 'Invalid attacker or target' }
          }

          const damage = Math.floor(Math.random() * 10) + 5

          const targetEntity = target as THREE.Object3D & { userData?: { health?: number } }

          if (targetEntity.userData?.health !== undefined) {
            targetEntity.userData.health -= damage
          }

          // Removed console.log: [Test Combat] attack result

          if (targetEntity.userData?.health !== undefined && targetEntity.userData.health <= 0) {
            // Target dies - remove from scene and spawn loot
            // Strong type assumption - world has stage with scene
            const worldStage = world.stage as { scene?: { remove: (obj: THREE.Object3D) => void } } | undefined
            if (worldStage?.scene && targetEntity.parent === worldStage.scene) {
              worldStage.scene.remove(target)
            }
            // Removed console.log(`[Test Combat] ${targetEntity.name || 'Unknown'} died`)
            return { killed: true, damage: damage }
          }

          return { killed: false, damage: damage }
        } catch (error) {
          // Removed console.error('[API] Combat simulation failed:', error)
          return { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      },
    },
  }

  // Attach all RPG API methods directly to the world object
  Object.assign(world, rpgAPI)
}
