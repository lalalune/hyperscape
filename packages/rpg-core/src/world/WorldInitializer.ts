import { World } from '@hyperfy/sdk'
/**
 * World Initializer - Initializes the game world on startup
 * Coordinates world generation, loads saved data, and spawns initial entities
 */

import type { World } from '../types'
import { WorldGenerator } from './WorldGenerator'

export class WorldInitializer {
  private world: World
  private generator: WorldGenerator
  private initialized: boolean = false
  
  constructor(world: World) {
    this.world = world
    this.generator = new WorldGenerator(world)
  }

  /**
   * Initialize the game world
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[WorldInitializer] World already initialized')
      return
    }

    console.log('[WorldInitializer] Starting world initialization...')
    
    try {
      // Load saved world data
      await this.loadWorldData()
      
      // Generate world if needed
      if (await this.isFirstTimeSetup()) {
        await this.firstTimeSetup()
      } else {
        await this.loadExistingWorld()
      }
      
      // Start world systems
      await this.startWorldSystems()
      
      // Spawn initial players
      await this.spawnInitialPlayers()
      
      // Start world events
      this.startWorldEvents()
      
      this.initialized = true
      console.log('[WorldInitializer] World initialization complete!')
      
    } catch (error) {
      console.error('[WorldInitializer] Failed to initialize world:', error)
      throw error
    }
  }

  /**
   * Check if this is first time setup
   */
  private async isFirstTimeSetup(): Promise<boolean> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return true
    
    // Check if we have any saved entities
    try {
      const entities = await persistence.loadWorldEntities()
      return entities.length === 0
    } catch {
      return true
    }
  }

  /**
   * First time world setup
   */
  private async firstTimeSetup(): Promise<void> {
    console.log('[WorldInitializer] First time setup - generating world...')
    
    // Generate the world
    await this.generator.generateWorld()
    
    // Create initial shops
    await this.createInitialShops()
    
    // Create initial quests
    await this.createInitialQuests()
    
    // Set up Grand Exchange
    await this.setupGrandExchange()
    
    // Save initial world state
    await this.saveWorldState()
  }

  /**
   * Load existing world
   */
  private async loadExistingWorld(): Promise<void> {
    console.log('[WorldInitializer] Loading existing world...')
    
    // World entities are loaded by persistence systems
    // Just need to verify critical entities exist
    await this.verifyWorldIntegrity()
  }

  /**
   * Load world data from persistence
   */
  private async loadWorldData(): Promise<void> {
    // This is handled by individual systems with persistence
    console.log('[WorldInitializer] Loading world data...')
  }

  /**
   * Create initial shops
   */
  private async createInitialShops(): Promise<void> {
    const shopSystem = (this.world as any).getSystem('shop')
    if (!shopSystem) return

    console.log('[WorldInitializer] Creating initial shops...')

    // General Store
    shopSystem.createShop({
      id: 'general_store',
      name: 'General Store',
      items: [
        { itemId: 1, stock: 100, price: 1 }, // Bronze dagger
        { itemId: 2, stock: 100, price: 2 }, // Bronze sword
        { itemId: 590, stock: 1000, price: 1 }, // Tinderbox
        { itemId: 1351, stock: 100, price: 20 }, // Bronze axe
        { itemId: 1265, stock: 100, price: 20 }, // Bronze pickaxe
        { itemId: 303, stock: 100, price: 10 }, // Small fishing net
        { itemId: 307, stock: 100, price: 10 }, // Fishing rod
        { itemId: 313, stock: 1000, price: 3 }, // Fishing bait
        { itemId: 1925, stock: 100, price: 4 }, // Bucket
        { itemId: 1931, stock: 100, price: 1 }, // Pot
        { itemId: 2347, stock: 100, price: 13 }, // Hammer
        { itemId: 946, stock: 100, price: 5 }, // Knife
        { itemId: 1755, stock: 100, price: 1 }, // Chisel
        { itemId: 1733, stock: 1000, price: 1 }, // Thread
        { itemId: 1734, stock: 100, price: 1 }, // Needle
      ],
      buyMultiplier: 0.4, // Shops buy at 40% of sell price
      respawnRate: 60000 // Restock every minute
    })

    // Rune Shop
    shopSystem.createShop({
      id: 'rune_shop',
      name: 'Aubury\'s Rune Shop',
      items: [
        { itemId: 554, stock: 1000, price: 4 }, // Fire rune
        { itemId: 555, stock: 1000, price: 4 }, // Water rune
        { itemId: 556, stock: 1000, price: 4 }, // Air rune
        { itemId: 557, stock: 1000, price: 4 }, // Earth rune
        { itemId: 558, stock: 500, price: 6 }, // Mind rune
        { itemId: 559, stock: 500, price: 9 }, // Body rune
        { itemId: 562, stock: 250, price: 25 }, // Chaos rune
        { itemId: 560, stock: 250, price: 40 }, // Death rune
        { itemId: 565, stock: 100, price: 95 }, // Blood rune
        { itemId: 566, stock: 100, price: 105 }, // Soul rune
        { itemId: 1381, stock: 10, price: 150 }, // Staff of air
        { itemId: 1383, stock: 10, price: 150 }, // Staff of water
        { itemId: 1385, stock: 10, price: 150 }, // Staff of earth
        { itemId: 1387, stock: 10, price: 150 }, // Staff of fire
      ],
      buyMultiplier: 0.5,
      respawnRate: 300000 // Restock every 5 minutes
    })

    // Food Shop
    shopSystem.createShop({
      id: 'food_shop',
      name: 'Food Store',
      items: [
        { itemId: 315, stock: 100, price: 4 }, // Shrimp
        { itemId: 2140, stock: 100, price: 10 }, // Cooked chicken
        { itemId: 333, stock: 50, price: 20 }, // Trout
        { itemId: 329, stock: 50, price: 50 }, // Salmon
        { itemId: 361, stock: 25, price: 100 }, // Tuna
        { itemId: 379, stock: 25, price: 200 }, // Lobster
        { itemId: 385, stock: 10, price: 500 }, // Shark
        { itemId: 1965, stock: 100, price: 1 }, // Cabbage
        { itemId: 1957, stock: 100, price: 1 }, // Onion
        { itemId: 1942, stock: 100, price: 2 }, // Potato
      ],
      buyMultiplier: 0.3,
      respawnRate: 120000 // Restock every 2 minutes
    })
  }

  /**
   * Create initial quests
   */
  private async createInitialQuests(): Promise<void> {
    const questSystem = (this.world as any).getSystem('quest')
    if (!questSystem) return

    console.log('[WorldInitializer] Creating initial quests...')

    // Cook's Assistant
    questSystem.registerQuest({
      id: 'cooks_assistant',
      name: 'Cook\'s Assistant',
      description: 'The Lumbridge Castle cook needs help preparing for the Duke\'s birthday.',
      startNPC: 'cook',
      requirements: [],
      objectives: [
        {
          id: 'get_ingredients',
          description: 'Collect ingredients for the cake',
          type: 'collect',
          items: [
            { itemId: 1944, quantity: 1 }, // Egg
            { itemId: 1927, quantity: 1 }, // Bucket of milk
            { itemId: 1933, quantity: 1 }, // Pot of flour
          ]
        },
        {
          id: 'return_to_cook',
          description: 'Return to the cook with the ingredients',
          type: 'talk',
          npc: 'cook'
        }
      ],
      rewards: {
        experience: {
          cooking: 300
        },
        items: [
          { itemId: 995, quantity: 100 } // 100 coins
        ],
        questPoints: 1
      }
    })

    // Sheep Shearer
    questSystem.registerQuest({
      id: 'sheep_shearer',
      name: 'Sheep Shearer',
      description: 'Fred the Farmer needs help shearing his sheep.',
      startNPC: 'fred_the_farmer',
      requirements: [],
      objectives: [
        {
          id: 'collect_wool',
          description: 'Collect 20 balls of wool',
          type: 'collect',
          items: [
            { itemId: 1759, quantity: 20 } // Ball of wool
          ]
        },
        {
          id: 'return_to_fred',
          description: 'Return to Fred with the wool',
          type: 'talk',
          npc: 'fred_the_farmer'
        }
      ],
      rewards: {
        experience: {
          crafting: 150
        },
        items: [
          { itemId: 995, quantity: 60 } // 60 coins
        ],
        questPoints: 1
      }
    })
  }

  /**
   * Set up Grand Exchange
   */
  private async setupGrandExchange(): Promise<void> {
    const grandExchange = (this.world as any).getSystem('grandExchange')
    if (!grandExchange) return

    console.log('[WorldInitializer] Setting up Grand Exchange...')

    // Initialize with some market data
    const initialItems = [
      { itemId: 995, basePrice: 1 }, // Coins
      { itemId: 1, basePrice: 10 }, // Bronze dagger
      { itemId: 2, basePrice: 20 }, // Bronze sword
      { itemId: 554, basePrice: 5 }, // Fire rune
      { itemId: 555, basePrice: 5 }, // Water rune
      { itemId: 556, basePrice: 5 }, // Air rune
      { itemId: 557, basePrice: 5 }, // Earth rune
      { itemId: 440, basePrice: 150 }, // Iron ore
      { itemId: 453, basePrice: 450 }, // Coal
      { itemId: 444, basePrice: 1500 }, // Gold ore
      { itemId: 447, basePrice: 5000 }, // Mithril ore
      { itemId: 449, basePrice: 15000 }, // Adamantite ore
      { itemId: 451, basePrice: 45000 }, // Runite ore
      { itemId: 1515, basePrice: 25 }, // Yew logs
      { itemId: 1513, basePrice: 45 }, // Magic logs
      { itemId: 385, basePrice: 800 }, // Raw shark
      { itemId: 386, basePrice: 1000 }, // Cooked shark
    ]

    for (const item of initialItems) {
      grandExchange.setMarketPrice(item.itemId, item.basePrice)
    }
  }

  /**
   * Start world systems
   */
  private async startWorldSystems(): Promise<void> {
    console.log('[WorldInitializer] Starting world systems...')
    
    // Start NPC behaviors
    const npcSystem = (this.world as any).getSystem('npc')
    if (npcSystem) {
      npcSystem.startBehaviors()
    }

    // Start resource respawning
    const resourceSystem = (this.world as any).getSystem('resourceSpawn')
    if (resourceSystem) {
      resourceSystem.startRespawnTimers()
    }

    // Start shop restocking
    const shopSystem = (this.world as any).getSystem('shop')
    if (shopSystem) {
      shopSystem.startRestockTimers()
    }
  }

  /**
   * Spawn initial players
   */
  private async spawnInitialPlayers(): Promise<void> {
    // Players spawn when they connect
    // This would handle any NPCs that act like players
  }

  /**
   * Start world events
   */
  private startWorldEvents(): void {
    console.log('[WorldInitializer] Starting world events...')
    
    // Random events
    setInterval(() => {
      this.triggerRandomEvent()
    }, 300000) // Every 5 minutes

    // Day/night cycle (if implemented)
    setInterval(() => {
      this.updateDayNightCycle()
    }, 60000) // Every minute
  }

  /**
   * Trigger random event
   */
  private triggerRandomEvent(): void {
    const events = [
      'shooting_star',
      'evil_tree',
      'treasure_imp',
      'double_xp_minute'
    ]

    const event = events[Math.floor(Math.random() * events.length)]
    
    this.world.events.emit('world:random_event', {
      type: event,
      duration: 600000 // 10 minutes
    })
  }

  /**
   * Update day/night cycle
   */
  private updateDayNightCycle(): void {
    const hour = new Date().getHours()
    const isNight = hour < 6 || hour > 20
    
    this.world.events.emit('world:time_update', {
      hour,
      isNight,
      lightLevel: isNight ? 0.3 : 1.0
    })
  }

  /**
   * Save world state
   */
  private async saveWorldState(): Promise<void> {
    console.log('[WorldInitializer] Saving world state...')
    
    // Trigger save on all systems
    this.world.events.emit('world:save_state')
  }

  /**
   * Verify world integrity
   */
  private async verifyWorldIntegrity(): Promise<void> {
    console.log('[WorldInitializer] Verifying world integrity...')
    
    // Check critical entities exist
    const criticalEntities = [
      { type: 'npc', id: 'lumbridge_guide' },
      { type: 'building', id: 'lumbridge_bank' },
      { type: 'building', id: 'grand_exchange' }
    ]

    for (const entity of criticalEntities) {
      // If critical entity missing, respawn it
      // This ensures the world remains playable
    }
  }

  /**
   * Get world statistics
   */
  getWorldStats(): any {
    const regions = this.generator.getRegions()
    const spawnPoints = this.generator.getSpawnPoints()
    
    return {
      initialized: this.initialized,
      regions: regions.length,
      totalSpawns: spawnPoints.length,
      npcs: spawnPoints.filter(s => s.type === 'npc').length,
      resources: spawnPoints.filter(s => s.type === 'resource').length,
      buildings: spawnPoints.filter(s => s.type === 'building').length,
      items: spawnPoints.filter(s => s.type === 'item').length
    }
  }
} 