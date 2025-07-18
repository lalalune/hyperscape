import { System } from '../../core/systems/System'
import type { World } from '../../types'
import {
  CombatBonuses,
  Equipment,
  EquipmentSlot,
  InventoryComponent,
  ItemStack,
  RPGEntity,
  StatsComponent,
  MovementComponent,
  Vector3,
  // ItemDefinition
} from '../types/index'
import { EquipmentBonusCalculator } from './inventory/EquipmentBonusCalculator'
import { ItemRegistry } from './inventory/ItemRegistry'

export class InventorySystem extends System {
  // Core management
  private inventories: Map<string, InventoryComponent> = new Map()
  private itemRegistry: ItemRegistry
  private equipmentCalculator: EquipmentBonusCalculator

  // Configuration
  private readonly MAX_STACK_SIZE = 2147483647 // Max int32

  // Persistence
  private pendingSaves: Set<string> = new Set()
  private saveTimer?: NodeJS.Timeout

  constructor(world: World) {
    super(world)
    this.itemRegistry = new ItemRegistry()
    this.equipmentCalculator = new EquipmentBonusCalculator(this.itemRegistry)

    // Register default items
    this.itemRegistry.loadDefaults()
  }

  /**
   * Initialize the system
   */
  override async init(_options: any): Promise<void> {
    console.log('[InventorySystem] Initializing...')

    // Listen for entity creation to add inventory components
    this.world.events.on('entity:created', (event: any) => {
      const entity = this.getEntity(event.entityId)
      if (entity && this.shouldHaveInventory(entity)) {
        this.createInventoryInternal(event.entityId)
      }
    })

    // Listen for entity destruction to clean up
    this.world.events.on('entity:destroyed', (event: any) => {
      this.inventories.delete(event.entityId)
    })

    // Listen for player events
    this.world.events.on('player:connect', this.handlePlayerConnect.bind(this))
    this.world.events.on('player:disconnect', this.handlePlayerDisconnect.bind(this))

    // Start auto-save timer
    this.startAutoSave()
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    // Save pending inventories every 10 seconds
    this.saveTimer = setInterval(() => {
      this.savePendingInventories()
    }, 10000)
  }

  /**
   * Handle player connect event
   */
  private async handlePlayerConnect(data: { playerId: string }): Promise<void> {
    await this.loadPlayerInventory(data.playerId)
  }

  /**
   * Handle player disconnect event
   */
  private async handlePlayerDisconnect(data: { playerId: string }): Promise<void> {
    // Save inventory immediately on disconnect
    await this.savePlayerInventory(data.playerId)
    this.pendingSaves.delete(data.playerId)
  }

  /**
   * Load player inventory from persistence
   */
  private async loadPlayerInventory(playerId: string): Promise<void> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    try {
      // Load inventory items
      const items = await persistence.loadPlayerInventory(playerId)
      const equipment = await persistence.loadPlayerEquipment(playerId)
      
      // Get or create inventory
      let inventory = this.inventories.get(playerId)
      if (!inventory) {
        this.createInventoryInternal(playerId)
        inventory = this.inventories.get(playerId)
      }
      if (!inventory) return

      // Clear and load items
      inventory.items = new Array(inventory.maxSlots).fill(null)
      for (const item of items) {
        if (item.slot >= 0 && item.slot < inventory.maxSlots) {
          inventory.items[item.slot] = {
            itemId: item.itemId,
            quantity: item.quantity,
            metadata: item.metadata
          }
        }
      }

      // Load equipment
      for (const equipItem of equipment) {
        const slot = equipItem.slot as EquipmentSlot
        const itemDef = this.itemRegistry.get(equipItem.itemId)
        if (itemDef && itemDef.equipment) {
          inventory.equipment[slot] = {
            ...itemDef,
            metadata: equipItem.metadata
          } as Equipment
        }
      }

      // Update weight and bonuses
      this.updateWeight(inventory)
      this.updateEquipmentBonuses(inventory)

      console.log(`[InventorySystem] Loaded inventory for player ${playerId}`)
    } catch (error) {
      console.error(`[InventorySystem] Failed to load inventory for ${playerId}:`, error)
    }
  }

  /**
   * Save player inventory to persistence
   */
  private async savePlayerInventory(playerId: string): Promise<void> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    const inventory = this.inventories.get(playerId)
    if (!inventory) return

    try {
      // Prepare inventory items
      const items: Array<{ slot: number; itemId: number; quantity: number; metadata?: any }> = []
      for (let i = 0; i < inventory.items.length; i++) {
        const item = inventory.items[i]
        if (item) {
          items.push({
            slot: i,
            itemId: item.itemId,
            quantity: item.quantity,
            metadata: item.metadata
          })
        }
      }

      // Prepare equipment
      const equipment: Array<{ slot: string; itemId: number; metadata?: any }> = []
      for (const [slot, equip] of Object.entries(inventory.equipment)) {
        if (equip) {
          equipment.push({
            slot,
            itemId: equip.id,
            metadata: equip.metadata
          })
        }
      }

      // Save to persistence
      await persistence.savePlayerInventory(playerId, items)
      await persistence.savePlayerEquipment(playerId, equipment)

      console.log(`[InventorySystem] Saved inventory for player ${playerId}`)
    } catch (error) {
      console.error(`[InventorySystem] Failed to save inventory for ${playerId}:`, error)
    }
  }

  /**
   * Save all pending inventories
   */
  private async savePendingInventories(): Promise<void> {
    if (this.pendingSaves.size === 0) return

    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    const toSave = Array.from(this.pendingSaves)
    this.pendingSaves.clear()

    for (const entityId of toSave) {
      // Only save if it's a player entity
      const entity = this.getEntity(entityId)
      if (entity && entity.type === 'player') {
        await this.savePlayerInventory(entityId)
      }
    }
  }

  /**
   * Mark entity for saving
   */
  private markForSave(entityId: string): void {
    this.pendingSaves.add(entityId)
  }

  /**
   * Update method
   */
  override update(_delta: number): void {
    // Update weight calculations periodically
    for (const [_entityId, inventory] of Array.from(this.inventories)) {
      this.updateWeight(inventory)
    }
  }

  /**
   * Add item to entity inventory
   */
  addItem(entityId: string, itemId: number, quantity: number): boolean {
    const entity = this.getEntity(entityId)
    if (!entity) {
      return false
    }

    const inventory = entity.getComponent<InventoryComponent>('inventory')
    if (!inventory) {
      return false
    }

    const itemDef = this.itemRegistry.get(itemId)
    if (!itemDef) {
      return false
    }

    // Try to stack with existing items
    if (itemDef.stackable) {
      const existingStack = inventory.items.find(stack => stack?.itemId === itemId)
      if (existingStack) {
        existingStack.quantity += quantity
        this.markForSave(entityId)
        return true
      }
    }

    // Find free slot
    const freeSlot = inventory.items.findIndex(slot => !slot)
    if (freeSlot === -1) {
      return false
    }

    // Add to inventory
    inventory.items[freeSlot] = {
      itemId,
      quantity,
    }

    this.markForSave(entityId)
    return true
  }

  /**
   * Remove item from inventory by slot
   */
  removeItem(entityId: string, slot: number, quantity?: number): ItemStack | null {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      return null
    }

    const item = inventory.items[slot]
    if (!item) {
      return null
    }

    const removeQuantity = quantity || item.quantity

    if (removeQuantity >= item.quantity) {
      // Remove entire stack
      inventory.items[slot] = null
      this.updateWeight(inventory)
      this.syncInventory(entityId)
      this.markForSave(entityId)

      this.world.events.emit('inventory:item-removed', {
        entityId,
        itemId: item.itemId,
        quantity: item.quantity,
        slot,
      })

      return { ...item }
    } else {
      // Remove partial stack
      item.quantity -= removeQuantity
      this.updateWeight(inventory)
      this.syncInventory(entityId)
      this.markForSave(entityId)

      this.world.events.emit('inventory:item-removed', {
        entityId,
        itemId: item.itemId,
        quantity: removeQuantity,
        slot,
      })

      return {
        itemId: item.itemId,
        quantity: removeQuantity,
      }
    }
  }

  /**
   * Remove item from inventory by item ID and quantity
   */
  removeItemById(entityId: string, itemId: number, quantity: number): boolean {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      return false
    }

    let remainingToRemove = quantity

    for (let i = 0; i < inventory.items.length && remainingToRemove > 0; i++) {
      const item = inventory.items[i]
      if (item && item.itemId === itemId) {
        const toRemove = Math.min(item.quantity, remainingToRemove)
        
        if (toRemove === item.quantity) {
          // Remove entire stack
          inventory.items[i] = null
        } else {
          // Reduce quantity
          item.quantity -= toRemove
        }
        
        remainingToRemove -= toRemove
        
        this.world.events.emit('inventory:item-removed', {
          entityId,
          itemId: item.itemId,
          quantity: toRemove,
          slot: i,
        })
      }
    }

    this.updateWeight(inventory)
    this.syncInventory(entityId)
    
    if (remainingToRemove === 0) {
      this.markForSave(entityId)
    }

    return remainingToRemove === 0
  }

  /**
   * Get the total quantity of a specific item in inventory
   */
  getItemQuantity(entityId: string, itemId: number): number {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      // Try getting from entity component as fallback
      const entity = this.getEntity(entityId)
      if (entity) {
        const entityInventory = entity.getComponent<InventoryComponent>('inventory')
        if (entityInventory) {
          let totalQuantity = 0
          for (const item of entityInventory.items) {
            if (item && item.itemId === itemId) {
              totalQuantity += item.quantity
            }
          }
          return totalQuantity
        }
      }
      return 0
    }

    let totalQuantity = 0
    for (const item of inventory.items) {
      if (item && item.itemId === itemId) {
        totalQuantity += item.quantity
      }
    }

    return totalQuantity
  }

  /**
   * Move item between slots
   */
  moveItem(entityId: string, fromSlot: number, toSlot: number): boolean {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      return false
    }

    if (fromSlot < 0 || fromSlot >= inventory.maxSlots || toSlot < 0 || toSlot >= inventory.maxSlots) {
      return false
    }

    const fromItem = inventory.items[fromSlot] || null
    const toItem = inventory.items[toSlot] || null

    // Simple swap
    inventory.items[fromSlot] = toItem
    inventory.items[toSlot] = fromItem

    this.syncInventory(entityId)
    this.markForSave(entityId)

    this.world.events.emit('inventory:item-moved', {
      entityId,
      fromSlot,
      toSlot,
    })

    return true
  }

  /**
   * Equip item to slot
   */
  equipItem(entity: RPGEntity, inventorySlot: number, equipmentSlot: EquipmentSlot): boolean {
    const inventory = entity.getComponent<InventoryComponent>('inventory')
    if (!inventory) {
      return false
    }

    const stack = inventory.items[inventorySlot]
    if (!stack) {
      return false
    }

    const itemDef = this.itemRegistry.get(stack.itemId)
    if (!itemDef || !itemDef.equipment) {
      return false
    }

    // Check if slot matches item type
    if (itemDef.equipment.slot !== equipmentSlot) {
      return false
    }

    // Unequip current item if any
    const currentEquipped = inventory.equipment[equipmentSlot]
    if (currentEquipped) {
      this.unequipItem(entity, equipmentSlot)
    }

    // Remove from inventory
    const removedStack = this.removeFromSlot(inventory, inventorySlot, 1)
    if (!removedStack) {
      return false
    }

    // Equip item (convert ItemDefinition to Equipment)
    const equipment: Equipment = {
      ...itemDef,
      metadata: stack.metadata,
    } as Equipment

    inventory.equipment[equipmentSlot] = equipment

    // Sync network if available
    this.syncEquipNetwork(entity, equipmentSlot, equipment)

    // Update combat bonuses
    this.updateCombatBonuses(entity)
    
    // Mark for save
    this.markForSave(entity.data.id)

    // Emit event
    this.world.events.emit('inventory:item-equipped', {
      entity,
      item: removedStack,
      slot: equipmentSlot,
    })

    return true
  }

  /**
   * Unequip item from slot
   */
  unequipItem(entity: RPGEntity, slot: EquipmentSlot): boolean {
    const inventory = entity.getComponent<InventoryComponent>('inventory')
    if (!inventory) {
      return false
    }

    const equipment = inventory.equipment[slot]
    if (!equipment) {
      return false
    }

    // Add to inventory
    if (!this.addItem(entity.data.id, equipment.id, 1)) {
      // Inventory full
      return false
    }

    // Remove from equipment
    inventory.equipment[slot] = null

    // Sync network if available
    this.syncUnequipNetwork(entity, slot)

    // Update combat bonuses
    this.updateCombatBonuses(entity)
    
    // Mark for save
    this.markForSave(entity.data.id)

    // Emit event
    this.world.events.emit('inventory:item-unequipped', {
      entity,
      item: equipment,
      slot,
    })

    return true
  }

  /**
   * Drop item from inventory
   */
  dropItem(entity: RPGEntity, slotIndex: number, quantity: number = 1): boolean {
    const inventory = entity.getComponent<InventoryComponent>('inventory')
    if (!inventory) {
      return false
    }

    const stack = inventory.items[slotIndex]
    if (!stack) {
      return false
    }

    // Remove from inventory
    const droppedStack = this.removeFromSlot(inventory, slotIndex, quantity)
    if (!droppedStack) {
      return false
    }

    // Get entity position from movement component
    const position = this.getEntityPosition(entity)
    if (!position) {
      // If no position, put item back and fail
      this.addItem(entity.data.id, droppedStack.itemId, droppedStack.quantity)
      return false
    }

    // Create dropped item entity
    const droppedEntity = {
      id: `dropped_${Date.now()}_${Math.random()}`,
      type: 'item',
      itemId: droppedStack.itemId,
      quantity: droppedStack.quantity,
      position: {
        x: position.x + (Math.random() - 0.5) * 2,
        y: position.y,
        z: position.z + (Math.random() - 0.5) * 2,
      },
      droppedBy: entity.data.id,
      droppedAt: Date.now(),
    }

    // Add to world entities
    ;(this.world as any).entities?.set(droppedEntity.id, droppedEntity)

    // Sync network if available
    this.syncDropItemNetwork(entity, droppedStack, droppedEntity)
    
    // Mark for save
    this.markForSave(entity.data.id)

    // Emit event
    this.world.events.emit('inventory:item-dropped', {
      entity,
      item: droppedStack,
      position,
      droppedEntity,
    })

    return true
  }

  /**
   * Get total weight
   */
  getWeight(entityId: string): number {
    const inventory = this.inventories.get(entityId)
    return inventory ? inventory.totalWeight : 0
  }

  /**
   * Get number of free slots
   */
  getFreeSlots(entityId: string): number {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      return 0
    }

    return inventory.items.filter(item => item === null).length
  }

  /**
   * Find item in inventory
   */
  findItem(entityId: string, itemId: number): number | null {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      return null
    }

    for (let i = 0; i < inventory.items.length; i++) {
      if (inventory.items[i]?.itemId === itemId) {
        return i
      }
    }

    return null
  }

  /**
   * Create inventory for entity (private helper)
   */
  private createInventoryInternal(entityId: string): void {
    const entity = this.world.entities.get(entityId)
    if (!entity) {
      return
    }

    const inventory: InventoryComponent = {
      type: 'inventory',
      entity: entity as any,
      data: {},
      items: new Array(28).fill(null),
      maxSlots: 28,
      equipment: {
        [EquipmentSlot.HEAD]: null,
        [EquipmentSlot.CAPE]: null,
        [EquipmentSlot.AMULET]: null,
        [EquipmentSlot.WEAPON]: null,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.SHIELD]: null,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMMO]: null,
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
    }

    // Check if entity is an RPGEntity with addComponent method
    if ('addComponent' in entity && typeof entity.addComponent === 'function') {
      entity.addComponent('inventory', inventory)
    }

    this.inventories.set(entityId, inventory)
  }

  /**
   * Find first free slot
   */
  private findFreeSlot(inventory: InventoryComponent): number {
    for (let i = 0; i < inventory.items.length; i++) {
      if (inventory.items[i] === null) {
        return i
      }
    }
    return -1
  }

  /**
   * Update total weight
   */
  private updateWeight(inventory: InventoryComponent): void {
    let totalWeight = 0

    // Items weight
    for (const item of inventory.items) {
      if (item) {
        const itemDef = this.itemRegistry.get(item.itemId)
        if (itemDef) {
          totalWeight += itemDef.weight * item.quantity
        }
      }
    }

    // Equipment weight
    for (const slot in inventory.equipment) {
      const equipped = inventory.equipment[slot as EquipmentSlot]
      if (equipped) {
        totalWeight += equipped.weight
      }
    }

    inventory.totalWeight = totalWeight
  }

  /**
   * Update equipment bonuses
   */
  private updateEquipmentBonuses(inventory: InventoryComponent): void {
    inventory.equipmentBonuses = this.equipmentCalculator.calculateTotalBonuses(inventory.equipment)

    // Update stats component if exists
    const entity = this.getEntityByInventory(inventory)
    if (entity) {
      const stats = entity.getComponent<StatsComponent>('stats')
      if (stats) {
        stats.combatBonuses = inventory.equipmentBonuses
      }
    }
  }

  /**
   * Sync inventory to client
   */
  private syncInventory(entityId: string): void {
    const inventory = this.inventories.get(entityId)
    if (!inventory) {
      return
    }

    // Network sync if available
    const network = (this.world as any).network
    if (network) {
      network.send(entityId, 'inventory:update', {
        items: inventory.items,
        equipment: inventory.equipment,
        weight: inventory.totalWeight,
        bonuses: inventory.equipmentBonuses,
      })
    }

    // Also emit event for local systems
    this.world.events.emit('inventory:sync', {
      entityId,
      items: inventory.items,
      equipment: inventory.equipment,
      weight: inventory.totalWeight,
      bonuses: inventory.equipmentBonuses,
    })
  }

  /**
   * Send message to entity
   */
  private sendMessage(entityId: string, message: string): void {
    this.world.events.emit('chat:system', {
      targetId: entityId,
      message,
    })
  }

  /**
   * Public method to create inventory for an entity
   */
  public createInventory(entityId: string): InventoryComponent | null {
    this.createInventoryInternal(entityId)
    return this.inventories.get(entityId) || null
  }

  /**
   * Check if entity should have inventory
   */
  private shouldHaveInventory(entity: any): boolean {
    // Players always have inventory
    if (entity.data?.type === 'player' || entity.type === 'player') {
      return true
    }

    // Some NPCs might have inventory (shopkeepers, etc)
    const npcComponent = entity.getComponent?.('npc')
    if (npcComponent && npcComponent.hasInventory) {
      return true
    }

    return false
  }

  /**
   * Get entity from world
   */
  private getEntity(entityId: string): RPGEntity | undefined {
    // Handle test environment where entities are in a Map
    if (this.world.entities.items instanceof Map) {
      const entity = this.world.entities.items.get(entityId)
      if (!entity || typeof entity.getComponent !== 'function') {
        return undefined
      }
      return entity as unknown as RPGEntity
    }

    // Handle production environment
    const entity = this.world.entities.get?.(entityId)
    if (!entity || typeof entity.getComponent !== 'function') {
      return undefined
    }
    return entity as unknown as RPGEntity
  }

  /**
   * Get entity by inventory component
   */
  private getEntityByInventory(inventory: InventoryComponent): RPGEntity | undefined {
    for (const [entityId, inv] of Array.from(this.inventories)) {
      if (inv === inventory) {
        return this.getEntity(entityId)
      }
    }
    return undefined
  }

  /**
   * Create empty combat bonuses
   */
  private createEmptyBonuses(): CombatBonuses {
    return {
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
    }
  }

  /**
   * Register default items
   */
  private registerDefaultItems(): void {
    // Example items
    this.itemRegistry.register({
      id: 1,
      name: 'Coins',
      examine: 'Lovely money!',
      value: 1,
      weight: 0,
      stackable: true,
      equipable: false,
      tradeable: true,
      members: false,
      model: 'coins.glb',
      icon: 'coins.png',
    })

    this.itemRegistry.register({
      id: 1038,
      name: 'Red partyhat',
      examine: 'A nice hat from a cracker.',
      value: 1,
      weight: 0,
      stackable: false,
      equipable: true,
      tradeable: true,
      members: false,
      equipment: {
        slot: EquipmentSlot.HEAD,
        requirements: {},
        bonuses: this.createEmptyBonuses(),
      },
      model: 'red_partyhat.glb',
      icon: 'red_partyhat.png',
    })

    // Add more default items...
  }

  /**
   * Get entity position from movement component
   */
  private getEntityPosition(entity: RPGEntity): Vector3 | null {
    // Try movement component first
    const movement = entity.getComponent<MovementComponent>('movement')
    if (movement?.position) {
      return movement.position
    }

    // Fall back to entity position
    if (entity.position) {
      return entity.position
    }

    // Try data position
    if (entity.data?.position) {
      if (Array.isArray(entity.data.position)) {
        return {
          x: entity.data.position[0] || 0,
          y: entity.data.position[1] || 0,
          z: entity.data.position[2] || 0,
        }
      }
      return entity.data.position
    }

    return null
  }

  /**
   * Sync drop item over network
   */
  private syncDropItemNetwork(entity: RPGEntity, stack: ItemStack, droppedEntity: any): void {
    const network = (this.world as any).network
    if (!network) {
      return
    }

    const itemDef = this.itemRegistry.get(stack.itemId)

    network.broadcast('item_dropped', {
      entityId: entity.data.id,
      item: {
        id: stack.itemId,
        name: itemDef?.name || 'Unknown item',
        quantity: stack.quantity,
      },
      droppedEntityId: droppedEntity.id,
      position: droppedEntity.position,
    })
  }

  /**
   * Sync equip item over network
   */
  private syncEquipNetwork(entity: RPGEntity, slot: EquipmentSlot, equipment: Equipment): void {
    const network = (this.world as any).network
    if (!network) {
      return
    }

    network.broadcast('item_equipped', {
      entityId: entity.data.id,
      slot,
      equipment: {
        id: equipment.id,
        name: equipment.name,
        bonuses: equipment.equipment?.bonuses,
      },
    })
  }

  /**
   * Sync unequip item over network
   */
  private syncUnequipNetwork(entity: RPGEntity, slot: EquipmentSlot): void {
    const network = (this.world as any).network
    if (!network) {
      return
    }

    network.broadcast('item_unequipped', {
      entityId: entity.data.id,
      slot,
    })
  }

  /**
   * Update combat bonuses
   */
  private updateCombatBonuses(entity: RPGEntity): void {
    const inventory = entity.getComponent<InventoryComponent>('inventory')
    const stats = entity.getComponent<StatsComponent>('stats')

    if (!inventory || !stats) {
      return
    }

    // Calculate bonuses from equipment
    const bonuses = this.equipmentCalculator.calculateTotalBonuses(inventory.equipment)

    // Update the inventory's equipment bonuses
    inventory.equipmentBonuses = bonuses

    // Apply to stats
    stats.combatBonuses = bonuses
  }

  /**
   * Remove item from slot
   */
  private removeFromSlot(inventory: InventoryComponent, slot: number, quantity: number): ItemStack | null {
    const stack = inventory.items[slot]
    if (!stack || stack.quantity < quantity) {
      return null
    }

    if (stack.quantity === quantity) {
      // Remove entire stack
      inventory.items[slot] = null
      return stack
    } else {
      // Split stack
      stack.quantity -= quantity
      return {
        itemId: stack.itemId,
        quantity,
      }
    }
  }

  /**
   * Check if item can be equipped to slot
   */
  private canEquipToSlot(itemStack: ItemStack, slot: EquipmentSlot): boolean {
    const itemDef = this.itemRegistry.get(itemStack.itemId)
    if (!itemDef || !itemDef.equipment) {
      return false
    }

    const equipmentSlot = itemDef.equipment.slot
    return equipmentSlot === slot
  }

  /**
   * Add item to specific entity
   */
  private addItemToEntity(entity: RPGEntity, itemStack: ItemStack): boolean {
    const inventory = entity.getComponent<InventoryComponent>('inventory')
    if (!inventory) {
      return false
    }

    // Find free slot
    const freeSlot = inventory.items.findIndex(slot => !slot)
    if (freeSlot === -1) {
      return false
    }

    // Add to inventory
    inventory.items[freeSlot] = itemStack
    return true
  }
}
