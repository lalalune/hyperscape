import type { World } from '../../types'
import { createLogger } from '../../core/logger'

const logger = createLogger('DefaultRPGWorld')

export interface CubeVisualConfig {
  size: { x: number; y: number; z: number }
  color: string
  emissive?: string
  emissiveIntensity?: number
}

// Visual configurations for different entity types
export const ENTITY_VISUALS: Record<string, CubeVisualConfig> = {
  // NPCs
  goblin: { size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#00ff00', emissive: '#004400' },
  guard: { size: { x: 1.2, y: 2.0, z: 1.2 }, color: '#4444ff', emissive: '#000044' },
  skeleton: { size: { x: 1.0, y: 1.8, z: 0.6 }, color: '#ffffff', emissive: '#444444' },

  // Weapons
  sword: { size: { x: 0.2, y: 1.5, z: 0.1 }, color: '#cccccc', emissive: '#666666' },
  bow: { size: { x: 0.1, y: 1.2, z: 0.3 }, color: '#8b4513' },
  staff: { size: { x: 0.15, y: 2.0, z: 0.15 }, color: '#4b0082', emissive: '#1a001a' },

  // Items
  coin: { size: { x: 0.3, y: 0.05, z: 0.3 }, color: '#ffd700', emissive: '#ffaa00', emissiveIntensity: 0.5 },
  potion: { size: { x: 0.3, y: 0.5, z: 0.3 }, color: '#ff0000', emissive: '#440000' },
  food: { size: { x: 0.4, y: 0.3, z: 0.4 }, color: '#8b4513' },
  bones: { size: { x: 0.6, y: 0.2, z: 0.2 }, color: '#f0f0f0' },

  // Loot drops
  loot_pile: { size: { x: 0.8, y: 0.4, z: 0.8 }, color: '#ffaa00', emissive: '#442200' },

  // Environment
  spawn_point: { size: { x: 2, y: 0.1, z: 2 }, color: '#ff00ff', emissive: '#440044' },
  bank_chest: { size: { x: 1.5, y: 1.0, z: 1.0 }, color: '#8b7355' },
  shop_stall: { size: { x: 3, y: 2.5, z: 2 }, color: '#daa520' },
}

export class DefaultRPGWorld {
  private world: World

  constructor(world: World) {
    this.world = world
  }

  /**
   * Initialize the default RPG world with test content
   */
  async initialize(): Promise<void> {
    logger.info('Initializing default RPG world...')

    // Wait for all systems to be ready
    await this.waitForSystems()

    // Create spawn area
    await this.createSpawnArea()

    // Spawn NPCs
    await this.spawnTestNPCs()

    // Create shops and banks
    await this.createServices()

    // Add some items on the ground
    await this.spawnGroundItems()

    logger.info('Default RPG world initialized!')
  }

  private async waitForSystems(): Promise<void> {
    // Wait for required systems
    const requiredSystems = ['npc', 'spawning', 'inventory', 'loot']

    for (let i = 0; i < 50; i++) {
      // Max 5 seconds
      const allReady = requiredSystems.every(name => (this.world as any)[name])
      if (allReady) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.warn('Some systems may not be ready')
  }

  private async createSpawnArea(): Promise<void> {
    logger.info('Creating spawn area...')

    // Create a visible spawn platform
    const spawnPlatform = this.world.entities.create('spawn_platform')
    if (spawnPlatform) {
      spawnPlatform.position = { x: 0, y: -0.5, z: 0 }

      // Add visual component for spawn area
      this.addCubeVisual(spawnPlatform, ENTITY_VISUALS.spawn_point)

      // Add name tag
      this.addNameTag(spawnPlatform, 'Spawn Point')
    }
  }

  private async spawnTestNPCs(): Promise<void> {
    logger.info('Spawning test NPCs...')

    const npcSystem = (this.world as any).npc
    if (!npcSystem) {
      logger.error('NPC system not available')
      return
    }

    // Spawn configurations
    const spawns = [
      // Goblins in a group
      { id: 1, position: { x: 5, y: 0, z: 5 }, name: 'goblin' },
      { id: 1, position: { x: 7, y: 0, z: 5 }, name: 'goblin' },
      { id: 1, position: { x: 6, y: 0, z: 7 }, name: 'goblin' },

      // Guards near spawn
      { id: 2, position: { x: -5, y: 0, z: 0 }, name: 'guard' },
      { id: 2, position: { x: 5, y: 0, z: 0 }, name: 'guard' },

      // Mixed enemies
      { id: 1, position: { x: 10, y: 0, z: 10 }, name: 'goblin' },
      { id: 1, position: { x: -10, y: 0, z: 10 }, name: 'goblin' },
    ]

    for (const spawn of spawns) {
      const npc = npcSystem.spawnNPC(spawn.id, spawn.position)
      if (npc) {
        // Add cube visual
        this.addCubeVisual(npc, ENTITY_VISUALS[spawn.name])

        // Add name tag
        const npcComponent = npc.getComponent('npc')
        if (npcComponent) {
          this.addNameTag(npc, npcComponent.name)
        }

        logger.debug(`Spawned ${spawn.name} at ${JSON.stringify(spawn.position)}`)
      }
    }
  }

  private async createServices(): Promise<void> {
    logger.info('Creating services...')

    // Bank
    const bank = this.world.entities.create('bank')
    if (bank) {
      bank.position = { x: -10, y: 0, z: -10 }
      this.addCubeVisual(bank, ENTITY_VISUALS.bank_chest)
      this.addNameTag(bank, 'Bank')

      // Make it interactable
      bank.addComponent('interactable', {
        type: 'bank',
        range: 3,
        action: 'Open Bank',
      })
    }

    // Shop
    const shop = this.world.entities.create('shop')
    if (shop) {
      shop.position = { x: 10, y: 0, z: -10 }
      this.addCubeVisual(shop, ENTITY_VISUALS.shop_stall)
      this.addNameTag(shop, 'General Store')

      // Make it interactable
      shop.addComponent('interactable', {
        type: 'shop',
        range: 3,
        action: 'Browse Shop',
      })
    }
  }

  private async spawnGroundItems(): Promise<void> {
    logger.info('Spawning ground items...')

    const lootSystem = (this.world as any).loot
    if (!lootSystem) {
      logger.error('Loot system not available')
      return
    }

    // Spawn some test items on the ground
    const groundItems = [
      { itemId: 995, quantity: 100, position: { x: 2, y: 0, z: 2 }, visual: 'coin' }, // Coins
      { itemId: 1, quantity: 1, position: { x: -2, y: 0, z: 2 }, visual: 'sword' }, // Bronze sword
      { itemId: 2, quantity: 5, position: { x: 2, y: 0, z: -2 }, visual: 'food' }, // Bread
      { itemId: 3, quantity: 3, position: { x: -2, y: 0, z: -2 }, visual: 'bones' }, // Bones
    ]

    for (const item of groundItems) {
      const lootEntity = this.world.entities.create(`loot_${Date.now()}_${Math.random()}`)
      if (lootEntity) {
        lootEntity.position = item.position

        // Add loot component
        lootEntity.addComponent('loot', {
          items: [{ itemId: item.itemId, quantity: item.quantity }],
          owner: null,
          spawnTime: Date.now(),
        })

        // Add visual
        this.addCubeVisual(lootEntity, ENTITY_VISUALS[item.visual] || ENTITY_VISUALS.loot_pile)

        // Add name tag
        const itemDef = this.getItemDefinition(item.itemId)
        if (itemDef) {
          this.addNameTag(lootEntity, `${itemDef.name} (${item.quantity})`)
        }
      }
    }
  }

  /**
   * Add cube visual to entity
   */
  private addCubeVisual(entity: any, config: CubeVisualConfig): void {
    entity.addComponent('mesh', {
      type: 'box',
      size: config.size,
      material: {
        type: 'basic',
        color: config.color,
        emissive: config.emissive,
        emissiveIntensity: config.emissiveIntensity || 0.2,
      },
    })

    // Add slight hover animation for items
    if (config === ENTITY_VISUALS.coin || config === ENTITY_VISUALS.loot_pile) {
      entity.addComponent('animation', {
        type: 'hover',
        amplitude: 0.1,
        speed: 2,
      })
    }
  }

  /**
   * Add name tag to entity
   */
  private addNameTag(entity: any, text: string): void {
    entity.addComponent('nameTag', {
      text,
      offset: { x: 0, y: 2, z: 0 },
      size: 0.5,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
    })
  }

  /**
   * Get item definition
   */
  private getItemDefinition(itemId: number): any {
    const itemRegistry = (this.world as any).inventory?.itemRegistry
    if (itemRegistry) {
      return itemRegistry.getItem(itemId)
    }

    // Fallback definitions
    const items: Record<number, any> = {
      995: { name: 'Coins' },
      1: { name: 'Bronze Sword' },
      2: { name: 'Bread' },
      3: { name: 'Bones' },
    }

    return items[itemId]
  }
}

/**
 * Initialize default RPG world on server start
 */
export async function initializeDefaultRPGWorld(world: World): Promise<void> {
  const defaultWorld = new DefaultRPGWorld(world)
  await defaultWorld.initialize()
}
