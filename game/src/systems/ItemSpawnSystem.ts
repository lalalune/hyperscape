/**
 * Item Spawn System - Manages ground items and their persistence
 * Handles item drops, despawn timers, and pickup
 */

import { System } from '../../core/systems/System'
import type { World, Entity } from '../../types'
import type { Vector3 } from '../types'

export interface GroundItem {
  id: string
  itemId: string | number
  quantity: number
  position: Vector3
  droppedBy?: string // Player ID who dropped it
  droppedAt: number
  despawnAt: number
  visibleTo: string[] // Players who can see this item (empty = everyone)
}

export interface ItemSpawnComponent {
  type: 'item_spawn'
  items: Map<string, GroundItem>
}

export class ItemSpawnSystem extends System {
  private groundItems: Map<string, GroundItem> = new Map()
  private itemCounter: number = 0
  private readonly DEFAULT_DESPAWN_TIME = 300000 // 5 minutes
  private readonly PLAYER_DROP_VISIBLE_TIME = 60000 // 1 minute private to dropper
  
  // Persistence
  private pendingSaves: boolean = false
  private saveTimer?: NodeJS.Timeout

  constructor(world: World) {
    super(world)
  }

  async initialize(): Promise<void> {
    console.log('[ItemSpawnSystem] Initializing...')

    // Listen for item events
    this.world.events.on('item:drop', this.handleItemDrop.bind(this))
    this.world.events.on('item:pickup', this.handleItemPickup.bind(this))
    this.world.events.on('player:death', this.handlePlayerDeath.bind(this))
    this.world.events.on('world:shutdown', this.handleShutdown.bind(this))

    // Start auto-save timer
    this.startAutoSave()
    
    // Load existing ground items
    await this.loadGroundItems()

    console.log('[ItemSpawnSystem] Initialized with ground item management')
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    // Save ground items every 30 seconds
    this.saveTimer = setInterval(() => {
      if (this.pendingSaves) {
        this.saveGroundItems()
      }
    }, 30000)
  }

  /**
   * Handle world shutdown
   */
  private async handleShutdown(): Promise<void> {
    // Save immediately on shutdown
    await this.saveGroundItems()
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
    }
  }

  /**
   * Load ground items from persistence
   */
  private async loadGroundItems(): Promise<void> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    try {
      const items = await persistence.loadWorldItems()
      
      for (const itemData of items) {
        const groundItem: GroundItem = {
          id: itemData.itemId,
          itemId: itemData.itemType,
          quantity: itemData.quantity,
          position: JSON.parse(itemData.position),
          droppedBy: itemData.droppedBy || undefined,
          droppedAt: new Date(itemData.droppedAt).getTime(),
          despawnAt: new Date(itemData.despawnAt).getTime(),
          visibleTo: itemData.visibleTo ? JSON.parse(itemData.visibleTo) : []
        }
        
        // Only load if not expired
        if (groundItem.despawnAt > Date.now()) {
          this.groundItems.set(groundItem.id, groundItem)
        }
      }

      console.log(`[ItemSpawnSystem] Loaded ${this.groundItems.size} ground items`)
    } catch (error) {
      console.error(`[ItemSpawnSystem] Failed to load ground items:`, error)
    }
  }

  /**
   * Save ground items to persistence
   */
  private async saveGroundItems(): Promise<void> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    try {
      const items: any[] = []
      
      for (const [id, item] of this.groundItems) {
        items.push({
          itemId: id,
          worldId: (this.world as any).id || 'default',
          itemType: item.itemId.toString(),
          quantity: item.quantity,
          position: JSON.stringify(item.position),
          droppedBy: item.droppedBy,
          droppedAt: new Date(item.droppedAt).toISOString(),
          despawnAt: new Date(item.despawnAt).toISOString(),
          visibleTo: JSON.stringify(item.visibleTo)
        })
      }

      await persistence.saveWorldItems(items)
      this.pendingSaves = false
      console.log(`[ItemSpawnSystem] Saved ${items.length} ground items`)
    } catch (error) {
      console.error(`[ItemSpawnSystem] Failed to save ground items:`, error)
    }
  }

  /**
   * Mark for save
   */
  private markForSave(): void {
    this.pendingSaves = true
  }

  private handleItemDrop(data: any): void {
    const { playerId, itemId, quantity, position } = data
    this.dropItem(playerId, itemId, quantity, position)
  }

  private handleItemPickup(data: any): void {
    const { playerId, groundItemId } = data
    this.pickupItem(playerId, groundItemId)
  }

  private handlePlayerDeath(data: any): void {
    const { playerId, position, items } = data
    // Drop all items on death
    if (items && Array.isArray(items)) {
      for (const item of items) {
        this.dropItem(playerId, item.itemId, item.quantity, position, false)
      }
    }
  }

  /**
   * Drop an item on the ground
   */
  public dropItem(
    droppedBy: string, 
    itemId: string | number, 
    quantity: number, 
    position: Vector3,
    privateToDropper: boolean = true
  ): string {
    const groundItemId = `ground_item_${this.itemCounter++}_${Date.now()}`
    const now = Date.now()

    const groundItem: GroundItem = {
      id: groundItemId,
      itemId,
      quantity,
      position: { ...position }, // Clone position
      droppedBy,
      droppedAt: now,
      despawnAt: now + this.DEFAULT_DESPAWN_TIME,
      visibleTo: privateToDropper ? [droppedBy] : []
    }

    this.groundItems.set(groundItemId, groundItem)
    this.markForSave()

    // Schedule visibility change if private
    if (privateToDropper) {
      setTimeout(() => {
        const item = this.groundItems.get(groundItemId)
        if (item) {
          item.visibleTo = [] // Make visible to all
          this.markForSave()
          this.world.events.emit('item:visibility_changed', {
            groundItemId,
            visibleToAll: true
          })
        }
      }, this.PLAYER_DROP_VISIBLE_TIME)
    }

    // Emit drop event
    this.world.events.emit('item:dropped', {
      groundItemId,
      itemId,
      quantity,
      position,
      droppedBy,
      visibleTo: groundItem.visibleTo
    })

    return groundItemId
  }

  /**
   * Pickup a ground item
   */
  public pickupItem(playerId: string, groundItemId: string): boolean {
    const groundItem = this.groundItems.get(groundItemId)
    if (!groundItem) {
      this.world.events.emit('item:error', {
        playerId,
        message: 'Item not found'
      })
      return false
    }

    // Check visibility
    if (groundItem.visibleTo.length > 0 && !groundItem.visibleTo.includes(playerId)) {
      this.world.events.emit('item:error', {
        playerId,
        message: 'You cannot see this item yet'
      })
      return false
    }

    // Try to add to inventory
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem')
    if (!inventorySystem) {
      return false
    }

    const added = (inventorySystem as any).addItem(playerId, groundItem.itemId, groundItem.quantity)
    if (!added) {
      this.world.events.emit('item:error', {
        playerId,
        message: 'Inventory full'
      })
      return false
    }

    // Remove from ground
    this.groundItems.delete(groundItemId)
    this.markForSave()

    this.world.events.emit('item:picked_up', {
      playerId,
      groundItemId,
      itemId: groundItem.itemId,
      quantity: groundItem.quantity
    })

    return true
  }

  /**
   * Get visible ground items for a player
   */
  public getVisibleItems(playerId: string, position: Vector3, range: number = 50): GroundItem[] {
    const visibleItems: GroundItem[] = []

    for (const item of this.groundItems.values()) {
      // Check visibility
      if (item.visibleTo.length > 0 && !item.visibleTo.includes(playerId)) {
        continue
      }

      // Check range
      const dx = item.position.x - position.x
      const dz = item.position.z - position.z
      const distance = Math.sqrt(dx * dx + dz * dz)

      if (distance <= range) {
        visibleItems.push(item)
      }
    }

    return visibleItems
  }

  /**
   * Spawn an item at a position (not player-dropped)
   */
  public spawnItem(itemId: string | number, quantity: number, position: Vector3, despawnTime?: number): string {
    const groundItemId = `spawn_item_${this.itemCounter++}_${Date.now()}`
    const now = Date.now()

    const groundItem: GroundItem = {
      id: groundItemId,
      itemId,
      quantity,
      position: { ...position },
      droppedAt: now,
      despawnAt: now + (despawnTime || this.DEFAULT_DESPAWN_TIME),
      visibleTo: [] // Visible to all
    }

    this.groundItems.set(groundItemId, groundItem)
    this.markForSave()

    this.world.events.emit('item:spawned', {
      groundItemId,
      itemId,
      quantity,
      position
    })

    return groundItemId
  }

  /**
   * Update system - clean up despawned items
   */
  update(_deltaTime: number): void {
    const now = Date.now()
    const itemsToRemove: string[] = []

    for (const [id, item] of this.groundItems) {
      if (now >= item.despawnAt) {
        itemsToRemove.push(id)
      }
    }

    if (itemsToRemove.length > 0) {
      for (const id of itemsToRemove) {
        this.groundItems.delete(id)
        this.world.events.emit('item:despawned', { groundItemId: id })
      }
      this.markForSave()
    }
  }

  serialize(): any {
    return {
      groundItems: Object.fromEntries(this.groundItems),
      itemCounter: this.itemCounter
    }
  }

  deserialize(data: any): void {
    if (data.groundItems) {
      this.groundItems = new Map(Object.entries(data.groundItems))
    }
    if (data.itemCounter) {
      this.itemCounter = data.itemCounter
    }
  }
} 