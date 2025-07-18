/**
 * RPG Test Helpers - Browser-side utilities for visual testing
 *
 * These helpers are injected into the browser during testing to provide
 * easy access to RPG systems and entity manipulation for visual tests.
 */

import type { World } from '../../types/index.js'
import type { Vector3 } from '../../game/src/types/index.js'
import { RPGEntity } from '../../game/src/entities/RPGEntity.js'
import { SpawningSystem } from '../../game/src/systems/SpawningSystem.js'
import { NPCSystem } from '../../game/src/systems/NPCSystem.js'
import { InventorySystem } from '../../game/src/systems/InventorySystem.js'
import { CombatSystem } from '../../game/src/systems/CombatSystem.js'
import { VisualRepresentationSystem } from '../../game/src/systems/VisualRepresentationSystem.js'
import { LootSystem } from '../../game/src/systems/LootSystem.js'
import { THREE } from '../../core/extras/three'

/**
 * Enhanced test player data with visual overrides
 */
interface TestPlayerData {
  position: Vector3
  stats?: {
    hitpoints?: { current: number; max: number }
    attack?: { level: number; xp: number }
    strength?: { level: number; xp: number }
    defence?: { level: number; xp: number }
    ranged?: { level: number; xp: number }
    magic?: { level: number; xp: number }
    prayer?: { level: number; xp: number; points?: number; maxPoints?: number }
  }
  visualOverride?: {
    color?: string
    size?: { width: number; height: number; depth: number }
    animation?: string
  }
}

/**
 * Test entity configuration
 */
interface TestEntityConfig {
  position?: Vector3
  visualOverride?: {
    color?: string
    size?: { width: number; height: number; depth: number }
  }
  statsOverride?: {
    hitpoints?: { current: number; max: number }
    attack?: { level: number; xp: number }
    strength?: { level: number; xp: number }
    defence?: { level: number; xp: number }
    ranged?: { level: number; xp: number }
    magic?: { level: number; xp: number }
    prayer?: { level: number; xp: number }
  }
  behavior?: {
    type: string
    aggressionRange?: number
    wanderRadius?: number
  }
  aggressionRange?: number
  wanderRadius?: number
}

/**
 * Main RPG test helpers class
 */
export class RPGTestHelpers {
  private world: World
  private spawningSystem: SpawningSystem | null = null
  private npcSystem: NPCSystem | null = null
  private inventorySystem: InventorySystem | null = null
  private combatSystem: CombatSystem | null = null
  private visualSystem: VisualRepresentationSystem | null = null
  private lootSystem: LootSystem | null = null

  // Track test entities for cleanup
  private testEntities: Map<string, RPGEntity> = new Map()
  private testPlayers: Map<string, RPGEntity> = new Map()

  constructor(world: World) {
    this.world = world
    this.initializeSystems()
  }

  /**
   * Initialize references to RPG systems
   */
  private initializeSystems(): void {
    this.spawningSystem = this.world.getSystem('spawning') as SpawningSystem
    this.npcSystem = this.world.getSystem('npc') as NPCSystem
    this.inventorySystem = this.world.getSystem('inventory') as InventorySystem
    this.combatSystem = this.world.getSystem('combat') as CombatSystem
    this.visualSystem = this.world.getSystem('visualRepresentation') as VisualRepresentationSystem
    this.lootSystem = this.world.getSystem('loot') as LootSystem

    console.log('[RPGTestHelpers] Systems initialized:', {
      spawning: !!this.spawningSystem,
      npc: !!this.npcSystem,
      inventory: !!this.inventorySystem,
      combat: !!this.combatSystem,
      visual: !!this.visualSystem,
      loot: !!this.lootSystem,
    })
  }

  /**
   * Spawn a test player with enhanced visual representation
   */
  spawnPlayer(playerId: string, data: TestPlayerData): any | null {
    try {
      console.log(`[RPGTestHelpers] Spawning test player: ${playerId}`)

      // Create player entity using the world's entity system directly (like RealTestScenario)
      if (!this.world.entities) {
        throw new Error('Entities system not available')
      }

      // Create a basic entity without triggering physics systems
      const player = this.world.entities.create(playerId)
      if (!player) {
        throw new Error('Failed to create player entity')
      }

      // Ensure the entity is properly registered in the world's entity system
      if (!this.world.entities.items.has(playerId)) {
        this.world.entities.items.set(playerId, player)
        console.log(`[RPGTestHelpers] Manually registered player ${playerId} in world entities`)
      }

      // Set basic properties
      player.type = 'test_player' // Use test_player to avoid PlayerLocal instantiation
      player.name = `Test Player ${playerId}`
      player.position = data.position || { x: 0, y: 0, z: 0 }

      // Add standard player components (simplified version from RealTestScenario)
      const defaultStats = {
        hitpoints: { current: 100, max: 100, level: 10, xp: 0 },
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 1, xp: 0 },
        prayer: { level: 1, xp: 0, points: 10, maxPoints: 10 },
        combatBonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 0,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0,
        },
        combatLevel: 3,
        totalLevel: 32,
        ...data.stats,
      }

      player.addComponent('stats', defaultStats)

      player.addComponent('inventory', {
        items: new Array(28).fill(null),
        maxSlots: 28,
        equipment: {
          head: null,
          cape: null,
          amulet: null,
          weapon: null,
          body: null,
          shield: null,
          legs: null,
          gloves: null,
          boots: null,
          ring: null,
          ammo: null,
        },
        totalWeight: 0,
        equipmentBonuses: {
          attackStab: 0,
          attackSlash: 0,
          attackCrush: 0,
          attackMagic: 0,
          attackRanged: 0,
          defenseStab: 0,
          defenseSlash: 0,
          defenseCrush: 0,
          defenseMagic: 0,
          defenseRanged: 0,
          meleeStrength: 0,
          rangedStrength: 0,
          magicDamage: 0,
          prayerBonus: 0,
        },
      })

      player.addComponent('combat', {
        inCombat: false,
        target: null,
        lastAttackTime: 0,
        attackSpeed: 4,
        combatStyle: 'accurate',
        autoRetaliate: true,
        hitSplatQueue: [],
        animationQueue: [],
        specialAttackEnergy: 100,
        specialAttackActive: false,
        protectionPrayers: { melee: false, ranged: false, magic: false },
      })

      player.addComponent('movement', {
        position: data.position || { x: 0, y: 0, z: 0 },
        destination: null,
        moveSpeed: 10,
        isMoving: false,
        facingDirection: 0,
      })

      // Cast to RPGEntity for type safety
      const rpgPlayer = player as RPGEntity

      // Store visual override for later use
      if (data.visualOverride) {
        rpgPlayer.visualOverride = data.visualOverride
      }

      // Create enhanced visual representation
      if (this.visualSystem && data.visualOverride) {
        try {
          this.visualSystem.addVisual(rpgPlayer)
        } catch (error) {
          console.warn(`[RPGTestHelpers] Failed to create visual for ${playerId}:`, error)
        }
      }

      // Store for tracking
      this.testPlayers.set(playerId, rpgPlayer)
      this.testEntities.set(playerId, rpgPlayer)

      console.log(`[RPGTestHelpers] Player spawned successfully: ${playerId} at`, data.position)
      return player
    } catch (error) {
      console.error(`[RPGTestHelpers] Failed to spawn player ${playerId}:`, error)
      return null
    }
  }

  /**
   * Add standard player components
   */
  private addPlayerComponents(player: RPGEntity, data: TestPlayerData): void {
    // Stats component
    const defaultStats = {
      hitpoints: { current: 100, max: 100 },
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defence: { level: 1, xp: 0 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0 },
      combatLevel: 3,
    }

    const stats = { ...defaultStats, ...data.stats }
    player.addComponent('stats', {
      type: 'stats',
      entity: player,
      data: {},
      ...stats,
    })

    // Inventory component
    player.addComponent('inventory', {
      type: 'inventory',
      entity: player,
      data: {},
      items: new Array(28).fill(null),
      capacity: 28,
    })

    // Combat component
    player.addComponent('combat', {
      type: 'combat',
      entity: player,
      data: {},
      inCombat: false,
      target: null,
      lastAttackTime: 0,
      attackSpeed: 4,
      combatStyle: 'accurate',
      autoRetaliate: true,
      hitSplatQueue: [],
      animationQueue: [],
      specialAttackEnergy: 100,
      specialAttackActive: false,
      protectionPrayers: { melee: false, ranged: false, magic: false },
    })

    // Movement component
    player.addComponent('movement', {
      type: 'movement',
      entity: player,
      data: {},
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      speed: 5,
      destination: null,
      isMoving: false,
      path: [],
    })
  }

  /**
   * Apply visual overrides for enhanced testing visibility
   */
  private applyVisualOverride(entity: RPGEntity, override: any): void {
    if (!this.visualSystem) {
      return
    }

    const visual = this.visualSystem.getVisual(entity.id)
    if (!visual) {
      return
    }

    try {
      const threeMesh = (visual.mesh as any)._threeMesh
      if (!threeMesh) {
        return
      }

      // Color override - force flat unshaded material for testing
      if (override.color) {
        // THREE is imported at module level
        const color = new THREE.Color(override.color)

        // Replace with flat unshaded material for perfect color detection
        threeMesh.material = new THREE.MeshBasicMaterial({
          color,
          transparent: false,
          opacity: 1.0,
          side: THREE.DoubleSide, // Visible from both sides
        })

        console.log(`[RPGTestHelpers] Applied flat color override: ${override.color} to ${entity.id}`)
      }

      // Size override
      if (override.size) {
        threeMesh.scale.set(override.size.width || 1, override.size.height || 1, override.size.depth || 1)
        console.log(`[RPGTestHelpers] Applied size override to ${entity.id}:`, override.size)
      }

      // Animation override
      if (override.animation) {
        this.visualSystem.playAnimation(entity.id, override.animation, true)
        console.log(`[RPGTestHelpers] Applied animation override: ${override.animation} to ${entity.id}`)
      }
    } catch (error) {
      console.error(`[RPGTestHelpers] Failed to apply visual override to ${entity.id}:`, error)
    }
  }

  /**
   * Move player to target position with animation
   */
  movePlayer(playerId: string, targetPosition: Vector3): boolean {
    try {
      const player = this.testPlayers.get(playerId)
      if (!player) {
        console.error(`[RPGTestHelpers] Player not found: ${playerId}`)
        return false
      }

      console.log(`[RPGTestHelpers] Moving player ${playerId} to`, targetPosition)

      // Update position
      player.position = targetPosition
      if (player.data) {
        player.data.position = targetPosition
      }

      // Trigger visual movement
      if (this.visualSystem) {
        this.visualSystem.playAnimation(playerId, 'walk', false, 2000)

        // Update visual position
        const visual = this.visualSystem.getVisual(playerId)
        if (visual) {
          visual.group.position.set(targetPosition.x, targetPosition.y, targetPosition.z)
        }
      }

      // Update movement component
      const movement = player.getComponent('movement')
      if (movement) {
        ; (movement as any).destination = targetPosition
          ; (movement as any).isMoving = true
      }

      return true
    } catch (error) {
      console.error(`[RPGTestHelpers] Failed to move player ${playerId}:`, error)
      return false
    }
  }

  /**
   * Spawn an NPC for testing
   */
  spawnNPC(npcType: string, config: TestEntityConfig): RPGEntity | null {
    try {
      console.log(`[RPGTestHelpers] Spawning NPC: ${npcType}`)

      if (!this.spawningSystem) {
        console.error('[RPGTestHelpers] Spawning system not available')
        return null
      }

      // Create NPC entity using the same method as player
      const npcEntityId = `test_npc_${npcType}_${Date.now()}`
      const npc = this.world.entities.create(npcEntityId)
      if (!npc) {
        throw new Error('Failed to create NPC entity')
      }

      // Ensure the entity is properly registered in the world's entity system
      if (!this.world.entities.items.has(npcEntityId)) {
        this.world.entities.items.set(npcEntityId, npc)
        console.log(`[RPGTestHelpers] Manually registered NPC ${npcEntityId} in world entities`)
      }

      // Set basic properties
      npc.type = 'npc'
      npc.name = npcType
      npc.position = config.position || { x: 0, y: 0, z: 0 }

      // Get NPC definition ID for stats
      const npcDefinitionId = this.getNPCIdByType(npcType)

      // Cast to RPGEntity for type safety
      const rpgNpc = npc as RPGEntity

      // Add NPC components
      this.addNPCComponents(rpgNpc, npcType, npcDefinitionId, config)

      // Create visual
      if (this.visualSystem) {
        this.visualSystem.createVisual(rpgNpc, npcType)

        if (config.visualOverride) {
          this.applyVisualOverride(rpgNpc, config.visualOverride)
        }
      }

      // Store for tracking
      this.testEntities.set(rpgNpc.id, rpgNpc)

      return rpgNpc

      console.log(`[RPGTestHelpers] NPC spawned: ${npcType} (${rpgNpc.id})`)
    } catch (error) {
      console.error(`[RPGTestHelpers] Failed to spawn NPC ${npcType}:`, error)
      return null
    }
  }

  /**
   * Get NPC ID by type name
   */
  private getNPCIdByType(type: string): number {
    const npcIds: Record<string, number> = {
      goblin: 1,
      skeleton: 5,
      guard: 100,
      merchant: 200,
      quest_giver: 300,
      hill_giant: 10,
    }
    return npcIds[type] || 1
  }

  /**
   * Add NPC components
   */
  private addNPCComponents(npc: RPGEntity, npcType: string, npcId: number, config?: TestEntityConfig): void {
    // Default NPC stats
    const defaultStats = {
      hitpoints: { current: 50, max: 50, level: 10, xp: 0 },
      attack: { level: 20, xp: 0 },
      strength: { level: 20, xp: 0 },
      defence: { level: 15, xp: 0 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
      combatBonuses: {
        attackStab: 5,
        attackSlash: 5,
        attackCrush: 5,
        attackMagic: 0,
        attackRanged: 0,
        defenseStab: 5,
        defenseSlash: 5,
        defenseCrush: 5,
        defenseMagic: 0,
        defenseRanged: 0,
        meleeStrength: 5,
        rangedStrength: 0,
        magicDamage: 0,
        prayerBonus: 0,
      },
      combatLevel: 25,
      totalLevel: 50,
    }

    // Apply stats overrides from config
    const npcStats = { ...defaultStats, ...(config?.statsOverride || {}) }

    // Add stats component (required for combat)
    npc.addComponent('stats', npcStats)

    // NPC component
    npc.addComponent('npc', {
      type: 'npc',
      entity: npc,
      data: {},
      npcId,
      name: npcType,
      combatLevel: npcStats.combatLevel,
      maxHitpoints: npcStats.hitpoints.max,
      currentHitpoints: npcStats.hitpoints.current,
      behavior: config?.behavior || 'passive',
      spawnPosition: npc.position,
      respawnTime: 30000,
      lootTable: [],
      aggroRadius: config?.aggressionRange || 5,
      wanderRadius: config?.wanderRadius || 10,
      lastAggroCheck: 0,
      isAggressive:
        (typeof config?.behavior === 'string'
          ? config.behavior === 'aggressive'
          : config?.behavior?.type === 'aggressive') || false,
    })

    // Combat component for NPCs
    npc.addComponent('combat', {
      inCombat: false,
      target: null,
      lastAttackTime: 0,
      attackSpeed: 4,
      combatStyle: 'accurate',
      autoRetaliate: true,
      hitSplatQueue: [],
      animationQueue: [],
      specialAttackEnergy: 0,
      specialAttackActive: false,
      protectionPrayers: { melee: false, ranged: false, magic: false },
    })

    // Movement component for NPCs
    npc.addComponent('movement', {
      position: npc.position,
      destination: null,
      moveSpeed: 1.0,
      isMoving: false,
      facingDirection: 0,
    })
  }

  /**
   * Spawn an item for testing
   */
  spawnItem(itemType: string, config: TestEntityConfig): RPGEntity | null {
    try {
      console.log(`[RPGTestHelpers] Spawning item: ${itemType}`)

      // Create item entity using the same method as player/NPC
      const itemEntityId = `test_item_${itemType}_${Date.now()}`
      const item = this.world.entities.create(itemEntityId)
      if (!item) {
        throw new Error('Failed to create item entity')
      }

      // Ensure the entity is properly registered
      if (!this.world.entities.items.has(itemEntityId)) {
        this.world.entities.items.set(itemEntityId, item)
      }

      // Set basic properties
      item.type = 'item'
      item.name = itemType
      item.position = config.position || { x: 0, y: 0, z: 0 }

      // Cast to RPGEntity
      const rpgItem = item as RPGEntity

      // Add item component
      rpgItem.addComponent('item', {
        type: 'item',
        entity: rpgItem,
        data: {},
        itemId: this.getItemIdByType(itemType),
        itemType,
        quantity: 1,
        stackable: itemType === 'coin',
      })

      // Create visual
      if (this.visualSystem) {
        this.visualSystem.createVisual(rpgItem, itemType)

        if (config.visualOverride) {
          this.applyVisualOverride(rpgItem, config.visualOverride)
        }
      }

      // Store for tracking
      this.testEntities.set(rpgItem.id, rpgItem)

      console.log(`[RPGTestHelpers] Item spawned: ${itemType} (${rpgItem.id})`)
      return rpgItem
    } catch (error) {
      console.error(`[RPGTestHelpers] Failed to spawn item ${itemType}:`, error)
      return null
    }
  }

  /**
   * Get item ID by type
   */
  private getItemIdByType(type: string): number {
    const itemIds: Record<string, number> = {
      sword: 1,
      bow: 2,
      staff: 3,
      shield: 4,
      potion: 5,
      coin: 995,
      gem: 6,
    }
    return itemIds[type] || 1
  }

  /**
   * Spawn a chest for testing
   */
  spawnChest(chestType: string, config: TestEntityConfig): RPGEntity | null {
    try {
      console.log(`[RPGTestHelpers] Spawning chest: ${chestType}`)

      // Create chest entity using the same method as other entities
      const chestEntityId = `test_chest_${chestType}_${Date.now()}`
      const chest = this.world.entities.create(chestEntityId)
      if (!chest) {
        throw new Error('Failed to create chest entity')
      }

      // Ensure the entity is properly registered
      if (!this.world.entities.items.has(chestEntityId)) {
        this.world.entities.items.set(chestEntityId, chest)
      }

      // Set basic properties
      chest.type = 'chest'
      chest.name = chestType
      chest.position = config.position || { x: 0, y: 0, z: 0 }

      // Cast to RPGEntity
      const rpgChest = chest as RPGEntity

      // Add chest component
      rpgChest.addComponent('chest', {
        type: 'chest',
        entity: rpgChest,
        data: {},
        isOpen: false,
        items: [],
        capacity: 10,
        lockLevel: 0,
        respawnTime: 300000,
      })

      // Create visual
      if (this.visualSystem) {
        this.visualSystem.createVisual(rpgChest, chestType)

        if (config.visualOverride) {
          this.applyVisualOverride(rpgChest, config.visualOverride)
        }
      }

      // Store for tracking
      this.testEntities.set(rpgChest.id, rpgChest)

      console.log(`[RPGTestHelpers] Chest spawned: ${chestType} (${rpgChest.id})`)
      return rpgChest
    } catch (error) {
      console.error(`[RPGTestHelpers] Failed to spawn chest ${chestType}:`, error)
      return null
    }
  }

  /**
   * Start combat between two entities
   */
  startCombat(attackerId: string, targetId: string): boolean {
    try {
      const attacker = this.testEntities.get(attackerId) || this.testPlayers.get(attackerId)
      const target = this.testEntities.get(targetId)

      if (!attacker || !target) {
        console.error(`[RPGTestHelpers] Combat entities not found: ${attackerId}, ${targetId}`)
        return false
      }

      if (!this.combatSystem) {
        console.error('[RPGTestHelpers] Combat system not available')
        return false
      }

      console.log(`[RPGTestHelpers] Starting combat: ${attackerId} vs ${targetId}`)

      // Trigger combat animations
      if (this.visualSystem) {
        this.visualSystem.playAnimation(attackerId, 'attack', false, 1000)

        // Schedule damage and death animation
        setTimeout(() => {
          this.visualSystem?.playAnimation(targetId, 'die', false, 2000)

          // Drop loot after death
          setTimeout(() => {
            this.dropLoot([{ type: 'coin', position: { x: target.position.x + 2, y: 0, z: target.position.z } }])
          }, 2000)
        }, 1000)
      }

      return true
    } catch (error) {
      console.error('[RPGTestHelpers] Failed to start combat:', error)
      return false
    }
  }

  /**
   * Open a chest and trigger loot
   */
  openChest(chestId: string): boolean {
    try {
      const chest = this.testEntities.get(chestId)
      if (!chest) {
        console.error(`[RPGTestHelpers] Chest not found: ${chestId}`)
        return false
      }

      console.log(`[RPGTestHelpers] Opening chest: ${chestId}`)

      // Play open animation
      if (this.visualSystem) {
        this.visualSystem.playAnimation(chestId, 'open', false, 1000)
      }

      // Update chest component
      const chestComponent = chest.getComponent('chest')
      if (chestComponent) {
        ; (chestComponent as any).isOpen = true
      }

      return true
    } catch (error) {
      console.error('[RPGTestHelpers] Failed to open chest:', error)
      return false
    }
  }

  /**
   * Drop loot items at specified positions
   */
  dropLoot(lootItems: Array<{ type: string; position: Vector3 }>): boolean {
    try {
      console.log(`[RPGTestHelpers] Dropping ${lootItems.length} loot items`)

      for (const loot of lootItems) {
        const lootEntity = this.spawnItem(loot.type, {
          position: loot.position,
          visualOverride: {
            color: '#FF69B4', // Hot pink for loot drops
          },
        })

        if (lootEntity && this.visualSystem) {
          // Play sparkle animation for dropped loot
          this.visualSystem.playAnimation(lootEntity.id, 'sparkle', true)
        }
      }

      return true
    } catch (error) {
      console.error('[RPGTestHelpers] Failed to drop loot:', error)
      return false
    }
  }

  /**
   * Equip an item on a player
   */
  equipItem(playerId: string, itemType: string): boolean {
    try {
      const player = this.testPlayers.get(playerId)
      if (!player) {
        console.error(`[RPGTestHelpers] Player not found: ${playerId}`)
        return false
      }

      console.log(`[RPGTestHelpers] Equipping ${itemType} on ${playerId}`)

      // Create equipment visual near player
      const equipmentEntity = this.spawnItem(itemType, {
        position: {
          x: player.position.x + 1,
          y: player.position.y + 0.5,
          z: player.position.z,
        },
      })

      if (equipmentEntity && this.visualSystem) {
        // Play equip animation
        this.visualSystem.playAnimation(equipmentEntity.id, 'swing_down', false, 500)
      }

      return true
    } catch (error) {
      console.error('[RPGTestHelpers] Failed to equip item:', error)
      return false
    }
  }

  /**
   * Get test summary data
   */
  getTestSummary(): any {
    return {
      entitiesSpawned: this.testEntities.size,
      playersSpawned: this.testPlayers.size,
      systemsAvailable: {
        spawning: !!this.spawningSystem,
        npc: !!this.npcSystem,
        inventory: !!this.inventorySystem,
        combat: !!this.combatSystem,
        visual: !!this.visualSystem,
        loot: !!this.lootSystem,
      },
      worldState: {
        frame: this.world.frame || 0,
        time: this.world.time || 0,
      },
    }
  }

  /**
   * Get test entity by ID
   */
  getTestEntity(entityId: string): any {
    return this.testEntities.get(entityId) || this.testPlayers.get(entityId)
  }

  /**
   * Remove a specific test entity
   */
  removeTestEntity(entityId: string): boolean {
    try {
      console.log(`[RPGTestHelpers] Removing test entity: ${entityId}`)

      // Check if it's a player or regular entity
      const entity = this.testPlayers.get(entityId) || this.testEntities.get(entityId)
      if (!entity) {
        console.warn(`[RPGTestHelpers] Entity not found: ${entityId}`)
        return false
      }

      // Remove visual representation
      if (this.visualSystem) {
        this.visualSystem.removeVisual(entityId)
      }

      // Remove from world
      try {
        ; (this.world.entities as any).remove(entity)
      } catch (error) {
        console.warn(`[RPGTestHelpers] Failed to remove entity ${entityId} from world:`, error)
      }

      // Remove from tracking maps
      this.testEntities.delete(entityId)
      this.testPlayers.delete(entityId)

      console.log(`[RPGTestHelpers] Successfully removed entity: ${entityId}`)
      return true
    } catch (error) {
      console.error(`[RPGTestHelpers] Error removing entity ${entityId}:`, error)
      return false
    }
  }

  /**
   * Update visual properties of an entity
   */
  updateEntityVisual(
    entityId: string,
    visualUpdate: { color?: string; size?: { width: number; height: number; depth: number } }
  ): boolean {
    try {
      console.log(`[RPGTestHelpers] Updating entity visual: ${entityId}`)

      const entity = this.testPlayers.get(entityId) || this.testEntities.get(entityId)
      if (!entity) {
        console.warn(`[RPGTestHelpers] Entity not found: ${entityId}`)
        return false
      }

      // Update visual system if available
      if (this.visualSystem) {
        try {
          // Remove old visual
          this.visualSystem.removeVisual(entityId)

          // Update visual override on entity
          if (!entity.visualOverride) {
            entity.visualOverride = {}
          }
          Object.assign(entity.visualOverride, visualUpdate)

          // Recreate visual with updated properties
          this.visualSystem.createVisual(entity)
          console.log(`[RPGTestHelpers] Successfully updated visual for: ${entityId}`)
          return true
        } catch (error) {
          console.warn(`[RPGTestHelpers] Failed to update visual for ${entityId}:`, error)
        }
      }

      // Store visual properties on entity for reference
      if (!entity.visualOverride) {
        entity.visualOverride = {}
      }
      Object.assign(entity.visualOverride, visualUpdate)

      console.log(`[RPGTestHelpers] Updated entity properties for: ${entityId}`)
      return true
    } catch (error) {
      console.error(`[RPGTestHelpers] Error updating entity visual ${entityId}:`, error)
      return false
    }
  }

  /**
   * Clean up all test entities
   */
  cleanup(): void {
    console.log(`[RPGTestHelpers] Cleaning up ${this.testEntities.size} test entities`)

    // Remove visuals
    if (this.visualSystem) {
      for (const [entityId] of this.testEntities) {
        this.visualSystem.removeVisual(entityId)
      }
    }

    // Remove entities from world
    for (const [entityId, entity] of this.testEntities) {
      try {
        ; (this.world.entities as any).remove(entity)
      } catch (error) {
        console.warn(`[RPGTestHelpers] Failed to remove entity ${entityId}:`, error)
      }
    }

    // Clear tracking maps
    this.testEntities.clear()
    this.testPlayers.clear()

    console.log('[RPGTestHelpers] Cleanup complete')
  }
}

/**
 * Initialize global test helpers when in test mode
 */
export function initializeRPGTestHelpers(world: World): void {
  if (typeof window !== 'undefined') {
    // Make test helpers available globally for browser access
    ; (window as any).world = world
      ; (window as any).rpgTestHelpers = new RPGTestHelpers(world)

      // Convenience methods for test scripts
      ; (window as any).world.rpgTest = {
        spawnPlayer: (id: string, data: TestPlayerData) => (window as any).rpgTestHelpers.spawnPlayer(id, data),
        movePlayer: (id: string, pos: Vector3) => (window as any).rpgTestHelpers.movePlayer(id, pos),
        spawnNPC: (type: string, config: TestEntityConfig) => (window as any).rpgTestHelpers.spawnNPC(type, config),
        spawnItem: (type: string, config: TestEntityConfig) => (window as any).rpgTestHelpers.spawnItem(type, config),
        spawnChest: (type: string, config: TestEntityConfig) => (window as any).rpgTestHelpers.spawnChest(type, config),
        startCombat: (attackerId: string, targetId: string) =>
          (window as any).rpgTestHelpers.startCombat(attackerId, targetId),
        openChest: (chestId: string) => (window as any).rpgTestHelpers.openChest(chestId),
        dropLoot: (items: Array<{ type: string; position: Vector3 }>) => (window as any).rpgTestHelpers.dropLoot(items),
        equipItem: (playerId: string, itemType: string) => (window as any).rpgTestHelpers.equipItem(playerId, itemType),
        getTestSummary: () => (window as any).rpgTestHelpers.getTestSummary(),
        cleanup: () => (window as any).rpgTestHelpers.cleanup(),
      }

    console.log('[RPGTestHelpers] Test helpers initialized and available globally')
  }
}

// Auto-initialize when in browser and world becomes available
if (typeof window !== 'undefined') {
  console.log('[RPGTestHelpers] Setting up auto-initialization...')

  const checkForWorld = () => {
    try {
      const world = (window as any).world
      if (world && world.getSystem) {
        console.log('[RPGTestHelpers] World detected, initializing test helpers...')
        initializeRPGTestHelpers(world)
      } else {
        setTimeout(checkForWorld, 100)
      }
    } catch (error) {
      console.warn('[RPGTestHelpers] Error during auto-initialization:', error)
      // Don't retry on errors, just log them
    }
  }

  // Only check if not in Cypress test environment
  if (!(window as any).Cypress) {
    checkForWorld()
  }
}
