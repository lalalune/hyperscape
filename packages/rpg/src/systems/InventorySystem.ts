import {
  RPGInventorySystem,
  PlayerState,
  Inventory,
  InventorySlot,
  RPGItem,
  GAME_CONSTANTS,
  RPGEventEmitter,
  ItemDropEvent,
  ItemPickupEvent
} from '../types/index.js'
import { getItem } from '../data/items.js'

export class RPGInventorySystemImpl implements RPGInventorySystem {
  public name = 'InventorySystem'
  public initialized = false

  private players: Map<string, PlayerState> = new Map()
  private eventEmitter: RPGEventEmitter | null = null

  constructor(eventEmitter?: RPGEventEmitter) {
    this.eventEmitter = eventEmitter || null
  }

  async init(): Promise<void> {
    console.log('[InventorySystem] Initializing inventory system...')
    this.initialized = true
    console.log('[InventorySystem] Inventory system initialized')
  }

  async update(deltaTime: number): Promise<void> {
    // Inventory system doesn't need per-frame updates
    // All operations are event-driven
  }

  async cleanup(): Promise<void> {
    console.log('[InventorySystem] Cleaning up inventory system...')
    this.players.clear()
    this.initialized = false
  }

  // ===== PUBLIC API =====

  async addItem(playerId: string, itemId: string, quantity: number): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[InventorySystem] Player ${playerId} not found`)
      return false
    }

    const item = getItem(itemId)
    if (!item) {
      console.log(`[InventorySystem] Item ${itemId} not found`)
      return false
    }

    if (quantity <= 0) {
      console.log(`[InventorySystem] Invalid quantity: ${quantity}`)
      return false
    }

    const inventory = player.inventory

    // Try to stack with existing items if stackable
    if (item.stackable) {
      for (let i = 0; i < inventory.slots.length; i++) {
        const slot = inventory.slots[i]
        if (slot && slot.item.id === itemId) {
          const newQuantity = slot.quantity + quantity
          const maxStack = item.maxStack || GAME_CONSTANTS.MAX_STACK_SIZE
          
          if (newQuantity <= maxStack) {
            slot.quantity = newQuantity
            console.log(`[InventorySystem] Added ${quantity} ${item.name} to existing stack (slot ${i})`)
            return true
          } else {
            // Partial stack
            const canAdd = maxStack - slot.quantity
            slot.quantity = maxStack
            quantity -= canAdd
            console.log(`[InventorySystem] Partially stacked ${canAdd} ${item.name} in slot ${i}, ${quantity} remaining`)
            
            // Continue to find more slots for remaining quantity
          }
        }
      }
    }

    // Find empty slots for remaining items
    while (quantity > 0) {
      const emptySlotIndex = this.findEmptySlot(inventory)
      if (emptySlotIndex === -1) {
        console.log(`[InventorySystem] No space in inventory for ${quantity} ${item.name}`)
        return false
      }

      const maxStack = item.maxStack || (item.stackable ? GAME_CONSTANTS.MAX_STACK_SIZE : 1)
      const quantityToAdd = Math.min(quantity, maxStack)

      inventory.slots[emptySlotIndex] = {
        item: item,
        quantity: quantityToAdd
      }

      quantity -= quantityToAdd
      console.log(`[InventorySystem] Added ${quantityToAdd} ${item.name} to slot ${emptySlotIndex}`)
    }

    return true
  }

  async removeItem(playerId: string, itemId: string, quantity: number): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[InventorySystem] Player ${playerId} not found`)
      return false
    }

    if (quantity <= 0) {
      console.log(`[InventorySystem] Invalid quantity: ${quantity}`)
      return false
    }

    const inventory = player.inventory
    let remainingToRemove = quantity

    // Check if player has enough of the item
    const totalQuantity = this.getItemQuantity(playerId, itemId)
    if (totalQuantity < quantity) {
      console.log(`[InventorySystem] Player ${playerId} doesn't have enough ${itemId} (has ${totalQuantity}, needs ${quantity})`)
      return false
    }

    // Remove items from inventory
    for (let i = 0; i < inventory.slots.length && remainingToRemove > 0; i++) {
      const slot = inventory.slots[i]
      if (slot && slot.item.id === itemId) {
        if (slot.quantity <= remainingToRemove) {
          // Remove entire slot
          remainingToRemove -= slot.quantity
          inventory.slots[i] = null
          console.log(`[InventorySystem] Removed ${slot.quantity} ${itemId} from slot ${i} (slot cleared)`)
        } else {
          // Partial removal
          slot.quantity -= remainingToRemove
          console.log(`[InventorySystem] Removed ${remainingToRemove} ${itemId} from slot ${i} (${slot.quantity} remaining)`)
          remainingToRemove = 0
        }
      }
    }

    return remainingToRemove === 0
  }

  async moveItem(playerId: string, fromSlot: number, toSlot: number): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[InventorySystem] Player ${playerId} not found`)
      return false
    }

    const inventory = player.inventory

    if (fromSlot < 0 || fromSlot >= inventory.slots.length ||
        toSlot < 0 || toSlot >= inventory.slots.length) {
      console.log(`[InventorySystem] Invalid slot indices: ${fromSlot} -> ${toSlot}`)
      return false
    }

    if (fromSlot === toSlot) {
      return true // No-op
    }

    const fromSlotItem = inventory.slots[fromSlot]
    const toSlotItem = inventory.slots[toSlot]

    if (!fromSlotItem) {
      console.log(`[InventorySystem] Source slot ${fromSlot} is empty`)
      return false
    }

    // If destination is empty, just move
    if (!toSlotItem) {
      inventory.slots[toSlot] = fromSlotItem
      inventory.slots[fromSlot] = null
      console.log(`[InventorySystem] Moved ${fromSlotItem.item.name} from slot ${fromSlot} to ${toSlot}`)
      return true
    }

    // If same item and stackable, try to stack
    if (fromSlotItem.item.id === toSlotItem.item.id && fromSlotItem.item.stackable) {
      const maxStack = fromSlotItem.item.maxStack || GAME_CONSTANTS.MAX_STACK_SIZE
      const totalQuantity = fromSlotItem.quantity + toSlotItem.quantity

      if (totalQuantity <= maxStack) {
        // Can combine completely
        toSlotItem.quantity = totalQuantity
        inventory.slots[fromSlot] = null
        console.log(`[InventorySystem] Combined ${fromSlotItem.item.name} stacks (total: ${totalQuantity})`)
        return true
      } else {
        // Partial combination
        const canStack = maxStack - toSlotItem.quantity
        if (canStack > 0) {
          toSlotItem.quantity = maxStack
          fromSlotItem.quantity -= canStack
          console.log(`[InventorySystem] Partially combined ${fromSlotItem.item.name} stacks`)
          return true
        }
      }
    }

    // Swap items
    inventory.slots[toSlot] = fromSlotItem
    inventory.slots[fromSlot] = toSlotItem
    console.log(`[InventorySystem] Swapped items between slots ${fromSlot} and ${toSlot}`)
    return true
  }

  async getInventory(playerId: string): Promise<Inventory | null> {
    const player = this.players.get(playerId)
    return player ? player.inventory : null
  }

  async hasSpace(playerId: string, itemId: string, quantity: number): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) return false

    const item = getItem(itemId)
    if (!item) return false

    const inventory = player.inventory
    let remainingQuantity = quantity

    // Check existing stacks if stackable
    if (item.stackable) {
      for (const slot of inventory.slots) {
        if (slot && slot.item.id === itemId) {
          const maxStack = item.maxStack || GAME_CONSTANTS.MAX_STACK_SIZE
          const canAdd = maxStack - slot.quantity
          remainingQuantity -= Math.min(canAdd, remainingQuantity)
          
          if (remainingQuantity <= 0) {
            return true
          }
        }
      }
    }

    // Check empty slots
    const emptySlots = this.getEmptySlotCount(inventory)
    if (!item.stackable) {
      return emptySlots >= remainingQuantity
    } else {
      const maxStack = item.maxStack || GAME_CONSTANTS.MAX_STACK_SIZE
      const slotsNeeded = Math.ceil(remainingQuantity / maxStack)
      return emptySlots >= slotsNeeded
    }
  }

  async dropItem(playerId: string, itemId: string, quantity: number): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[InventorySystem] Player ${playerId} not found`)
      return false
    }

    // Remove item from inventory
    const removed = await this.removeItem(playerId, itemId, quantity)
    if (!removed) {
      return false
    }

    // Emit drop event
    if (this.eventEmitter) {
      await this.eventEmitter.emit({
        type: 'item:drop',
        timestamp: Date.now(),
        data: {
          itemId,
          quantity,
          position: player.position,
          droppedBy: playerId
        }
      } as ItemDropEvent)
    }

    console.log(`[InventorySystem] Player ${playerId} dropped ${quantity} ${itemId}`)
    return true
  }

  // ===== UTILITY METHODS =====

  public registerPlayer(player: PlayerState): void {
    this.players.set(player.id, player)
  }

  public unregisterPlayer(playerId: string): void {
    this.players.delete(playerId)
  }

  public getItemQuantity(playerId: string, itemId: string): number {
    const player = this.players.get(playerId)
    if (!player) return 0

    let totalQuantity = 0
    for (const slot of player.inventory.slots) {
      if (slot && slot.item.id === itemId) {
        totalQuantity += slot.quantity
      }
    }

    return totalQuantity
  }

  public hasItem(playerId: string, itemId: string, quantity = 1): boolean {
    return this.getItemQuantity(playerId, itemId) >= quantity
  }

  public getInventoryWeight(playerId: string): number {
    const player = this.players.get(playerId)
    if (!player) return 0

    let totalWeight = 0
    for (const slot of player.inventory.slots) {
      if (slot) {
        totalWeight += (slot.item.weight || 0) * slot.quantity
      }
    }

    return totalWeight
  }

  public getInventoryValue(playerId: string): number {
    const player = this.players.get(playerId)
    if (!player) return 0

    let totalValue = 0
    for (const slot of player.inventory.slots) {
      if (slot) {
        totalValue += (slot.item.value || 0) * slot.quantity
      }
    }

    return totalValue
  }

  public getEmptySlotCount(inventory: Inventory): number {
    return inventory.slots.filter(slot => slot === null).length
  }

  public getUsedSlotCount(inventory: Inventory): number {
    return inventory.slots.filter(slot => slot !== null).length
  }

  public findEmptySlot(inventory: Inventory): number {
    for (let i = 0; i < inventory.slots.length; i++) {
      if (inventory.slots[i] === null) {
        return i
      }
    }
    return -1
  }

  public findItemSlot(inventory: Inventory, itemId: string): number {
    for (let i = 0; i < inventory.slots.length; i++) {
      const slot = inventory.slots[i]
      if (slot && slot.item.id === itemId) {
        return i
      }
    }
    return -1
  }

  public createEmptyInventory(): Inventory {
    return {
      slots: new Array(GAME_CONSTANTS.INVENTORY_SIZE).fill(null),
      maxSlots: GAME_CONSTANTS.INVENTORY_SIZE
    }
  }

  public getInventorySummary(playerId: string): { [itemId: string]: number } {
    const player = this.players.get(playerId)
    if (!player) return {}

    const summary: { [itemId: string]: number } = {}
    
    for (const slot of player.inventory.slots) {
      if (slot) {
        summary[slot.item.id] = (summary[slot.item.id] || 0) + slot.quantity
      }
    }

    return summary
  }

  public validateInventory(inventory: Inventory): { valid: boolean, errors: string[] } {
    const errors: string[] = []

    if (inventory.slots.length !== inventory.maxSlots) {
      errors.push(`Inventory slot count mismatch: ${inventory.slots.length} vs ${inventory.maxSlots}`)
    }

    for (let i = 0; i < inventory.slots.length; i++) {
      const slot = inventory.slots[i]
      if (slot) {
        if (!slot.item) {
          errors.push(`Slot ${i} has no item`)
        }
        if (slot.quantity <= 0) {
          errors.push(`Slot ${i} has invalid quantity: ${slot.quantity}`)
        }
        if (slot.item && !slot.item.stackable && slot.quantity > 1) {
          errors.push(`Slot ${i} has non-stackable item with quantity > 1: ${slot.quantity}`)
        }
        if (slot.item && slot.item.maxStack && slot.quantity > slot.item.maxStack) {
          errors.push(`Slot ${i} exceeds max stack: ${slot.quantity} > ${slot.item.maxStack}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public sortInventory(playerId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    const inventory = player.inventory
    const items: InventorySlot[] = []

    // Collect all items
    for (const slot of inventory.slots) {
      if (slot) {
        items.push(slot)
      }
    }

    // Sort by item type, then by name
    items.sort((a, b) => {
      if (a.item.type !== b.item.type) {
        return a.item.type.localeCompare(b.item.type)
      }
      return a.item.name.localeCompare(b.item.name)
    })

    // Clear inventory
    inventory.slots.fill(null)

    // Place sorted items back
    for (let i = 0; i < items.length && i < inventory.maxSlots; i++) {
      inventory.slots[i] = items[i]
    }

    console.log(`[InventorySystem] Sorted inventory for player ${playerId}`)
    return true
  }

  public compactInventory(playerId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    const inventory = player.inventory
    const compactedSlots: (InventorySlot | null)[] = []

    // Collect all non-null slots
    for (const slot of inventory.slots) {
      if (slot) {
        compactedSlots.push(slot)
      }
    }

    // Fill remaining slots with null
    while (compactedSlots.length < inventory.maxSlots) {
      compactedSlots.push(null)
    }

    inventory.slots = compactedSlots
    console.log(`[InventorySystem] Compacted inventory for player ${playerId}`)
    return true
  }

  public async transferItem(
    fromPlayerId: string, 
    toPlayerId: string, 
    itemId: string, 
    quantity: number
  ): Promise<boolean> {
    // Check if fromPlayer has the item
    if (!this.hasItem(fromPlayerId, itemId, quantity)) {
      return false
    }

    // Check if toPlayer has space
    const hasSpace = await this.hasSpace(toPlayerId, itemId, quantity)
    if (!hasSpace) {
      return false
    }

    // Remove from source
    const removed = await this.removeItem(fromPlayerId, itemId, quantity)
    if (!removed) {
      return false
    }

    // Add to destination
    const added = await this.addItem(toPlayerId, itemId, quantity)
    if (!added) {
      // Rollback: add back to source
      await this.addItem(fromPlayerId, itemId, quantity)
      return false
    }

    console.log(`[InventorySystem] Transferred ${quantity} ${itemId} from ${fromPlayerId} to ${toPlayerId}`)
    return true
  }
}