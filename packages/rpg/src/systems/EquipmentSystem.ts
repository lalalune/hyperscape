import {
  RPGEquipmentSystem,
  PlayerState,
  Equipment,
  InventorySlot,
  RPGItem,
  ItemType,
  WeaponType,
  ArmorSlot,
  ItemBonuses,
  ItemRequirement,
  RPGEventEmitter
} from '../types/index.js'
import { getItem } from '../data/items.js'

export class RPGEquipmentSystemImpl implements RPGEquipmentSystem {
  public name = 'EquipmentSystem'
  public initialized = false

  private players: Map<string, PlayerState> = new Map()
  private skillsSystem: any = null // Will be injected
  private inventorySystem: any = null // Will be injected
  private eventEmitter: RPGEventEmitter | null = null

  constructor(eventEmitter?: RPGEventEmitter) {
    this.eventEmitter = eventEmitter || null
  }

  async init(): Promise<void> {
    console.log('[EquipmentSystem] Initializing equipment system...')
    this.initialized = true
    console.log('[EquipmentSystem] Equipment system initialized')
  }

  async update(deltaTime: number): Promise<void> {
    // Equipment system doesn't need per-frame updates
    // All operations are event-driven
  }

  async cleanup(): Promise<void> {
    console.log('[EquipmentSystem] Cleaning up equipment system...')
    this.players.clear()
    this.initialized = false
  }

  // ===== DEPENDENCY INJECTION =====

  public setSkillsSystem(skillsSystem: any): void {
    this.skillsSystem = skillsSystem
  }

  public setInventorySystem(inventorySystem: any): void {
    this.inventorySystem = inventorySystem
  }

  // ===== PUBLIC API =====

  async equipItem(playerId: string, itemId: string): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[EquipmentSystem] Player ${playerId} not found`)
      return false
    }

    const item = getItem(itemId)
    if (!item) {
      console.log(`[EquipmentSystem] Item ${itemId} not found`)
      return false
    }

    // Check if player has the item in inventory
    if (!this.inventorySystem?.hasItem(playerId, itemId, 1)) {
      console.log(`[EquipmentSystem] Player ${playerId} doesn't have ${itemId} in inventory`)
      return false
    }

    // Check if player meets requirements
    const meetsRequirements = await this.meetsEquipmentRequirements(playerId, item)
    if (!meetsRequirements) {
      console.log(`[EquipmentSystem] Player ${playerId} doesn't meet requirements for ${itemId}`)
      return false
    }

    // Determine which equipment slot this item goes in
    const slot = this.getEquipmentSlot(item)
    if (!slot) {
      console.log(`[EquipmentSystem] Item ${itemId} is not equippable`)
      return false
    }

    // Unequip existing item in that slot
    const existingItem = player.equipment[slot]
    if (existingItem) {
      const unequipped = await this.unequipItem(playerId, slot)
      if (!unequipped) {
        console.log(`[EquipmentSystem] Failed to unequip existing item in ${slot}`)
        return false
      }
    }

    // Remove item from inventory
    const removed = await this.inventorySystem?.removeItem(playerId, itemId, 1)
    if (!removed) {
      console.log(`[EquipmentSystem] Failed to remove ${itemId} from inventory`)
      return false
    }

    // Equip the item
    player.equipment[slot] = {
      item: item,
      quantity: 1
    }

    console.log(`[EquipmentSystem] Player ${playerId} equipped ${itemId} in ${slot} slot`)
    return true
  }

  async unequipItem(playerId: string, slot: keyof Equipment): Promise<boolean> {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[EquipmentSystem] Player ${playerId} not found`)
      return false
    }

    const equippedItem = player.equipment[slot]
    if (!equippedItem) {
      console.log(`[EquipmentSystem] No item equipped in ${slot} slot`)
      return false
    }

    // Check if player has inventory space
    const hasSpace = await this.inventorySystem?.hasSpace(playerId, equippedItem.item.id, 1)
    if (!hasSpace) {
      console.log(`[EquipmentSystem] Player ${playerId} doesn't have inventory space to unequip ${equippedItem.item.id}`)
      return false
    }

    // Add item back to inventory
    const added = await this.inventorySystem?.addItem(playerId, equippedItem.item.id, 1)
    if (!added) {
      console.log(`[EquipmentSystem] Failed to add ${equippedItem.item.id} to inventory`)
      return false
    }

    // Remove from equipment
    player.equipment[slot] = null

    console.log(`[EquipmentSystem] Player ${playerId} unequipped ${equippedItem.item.id} from ${slot} slot`)
    return true
  }

  async getEquipment(playerId: string): Promise<Equipment | null> {
    const player = this.players.get(playerId)
    return player ? player.equipment : null
  }

  calculateBonuses(equipment: Equipment): ItemBonuses {
    const totalBonuses: ItemBonuses = {
      attack: 0,
      strength: 0,
      defense: 0,
      range: 0,
      magic: 0,
      prayer: 0
    }

    // Sum up bonuses from all equipped items
    for (const slot of Object.values(equipment)) {
      if (slot && slot.item.bonuses) {
        const bonuses = slot.item.bonuses
        totalBonuses.attack = (totalBonuses.attack || 0) + (bonuses.attack || 0)
        totalBonuses.strength = (totalBonuses.strength || 0) + (bonuses.strength || 0)
        totalBonuses.defense = (totalBonuses.defense || 0) + (bonuses.defense || 0)
        totalBonuses.range = (totalBonuses.range || 0) + (bonuses.range || 0)
        totalBonuses.magic = (totalBonuses.magic || 0) + (bonuses.magic || 0)
        totalBonuses.prayer = (totalBonuses.prayer || 0) + (bonuses.prayer || 0)
      }
    }

    return totalBonuses
  }

  async meetsEquipmentRequirements(playerId: string, item: RPGItem): Promise<boolean> {
    if (!item.requirements) {
      return true // No requirements
    }

    if (!this.skillsSystem) {
      console.warn('[EquipmentSystem] SkillsSystem not injected, cannot check requirements')
      return true // Allow equipping if we can't check
    }

    return await this.skillsSystem.meetsRequirement(playerId, item.requirements)
  }

  // ===== UTILITY METHODS =====

  public registerPlayer(player: PlayerState): void {
    this.players.set(player.id, player)
  }

  public unregisterPlayer(playerId: string): void {
    this.players.delete(playerId)
  }

  public getEquippedItem(playerId: string, slot: keyof Equipment): InventorySlot | null {
    const player = this.players.get(playerId)
    return player ? player.equipment[slot] : null
  }

  public isEquipped(playerId: string, itemId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    for (const slot of Object.values(player.equipment)) {
      if (slot && slot.item.id === itemId) {
        return true
      }
    }

    return false
  }

  public getEquipmentSlot(item: RPGItem): keyof Equipment | null {
    switch (item.type) {
      case ItemType.WEAPON:
        if (item.weaponType === WeaponType.SHIELD) {
          return 'shield'
        }
        return 'weapon'
      
      case ItemType.ARMOR:
        switch (item.armorSlot) {
          case ArmorSlot.HELMET:
            return 'helmet'
          case ArmorSlot.BODY:
            return 'body'
          case ArmorSlot.LEGS:
            return 'legs'
          default:
            return null
        }
      
      case ItemType.AMMUNITION:
        return 'arrows'
      
      default:
        return null
    }
  }

  public canEquipTogether(item1: RPGItem, item2: RPGItem): boolean {
    // Check if two items can be equipped at the same time
    // For example, two-handed weapons can't be equipped with shields
    
    if (item1.type === ItemType.WEAPON && item2.type === ItemType.WEAPON) {
      // Can't equip two weapons unless one is a shield
      if (item1.weaponType !== WeaponType.SHIELD && item2.weaponType !== WeaponType.SHIELD) {
        return false
      }
    }

    // TODO: Add more complex equipment interaction rules
    return true
  }

  public getEquipmentStats(playerId: string): {
    attack: number,
    strength: number,
    defense: number,
    range: number,
    weight: number
  } {
    const player = this.players.get(playerId)
    if (!player) {
      return { attack: 0, strength: 0, defense: 0, range: 0, weight: 0 }
    }

    const bonuses = this.calculateBonuses(player.equipment)
    let totalWeight = 0

    // Calculate total weight
    for (const slot of Object.values(player.equipment)) {
      if (slot) {
        totalWeight += (slot.item.weight || 0) * slot.quantity
      }
    }

    return {
      attack: bonuses.attack || 0,
      strength: bonuses.strength || 0,
      defense: bonuses.defense || 0,
      range: bonuses.range || 0,
      weight: totalWeight
    }
  }

  public createEmptyEquipment(): Equipment {
    return {
      weapon: null,
      shield: null,
      helmet: null,
      body: null,
      legs: null,
      arrows: null
    }
  }

  public getEquipmentSummary(playerId: string): { [slot: string]: string } {
    const player = this.players.get(playerId)
    if (!player) return {}

    const summary: { [slot: string]: string } = {}
    
    for (const [slotName, slot] of Object.entries(player.equipment)) {
      if (slot) {
        summary[slotName] = `${slot.item.name} (${slot.quantity})`
      } else {
        summary[slotName] = 'Empty'
      }
    }

    return summary
  }

  public validateEquipment(equipment: Equipment): { valid: boolean, errors: string[] } {
    const errors: string[] = []

    // Check each slot
    for (const [slotName, slot] of Object.entries(equipment)) {
      if (slot) {
        // Validate item is appropriate for slot
        const expectedSlot = this.getEquipmentSlot(slot.item)
        if (expectedSlot !== slotName) {
          errors.push(`Item ${slot.item.name} in wrong slot: expected ${expectedSlot}, got ${slotName}`)
        }

        // Validate quantity (should be 1 for all equipment)
        if (slot.quantity !== 1) {
          errors.push(`Equipment slot ${slotName} has invalid quantity: ${slot.quantity}`)
        }
      }
    }

    // Check for conflicting items
    const weapon = equipment.weapon
    const shield = equipment.shield

    if (weapon && shield) {
      // Check if weapon and shield can be equipped together
      if (!this.canEquipTogether(weapon.item, shield.item)) {
        errors.push(`Cannot equip ${weapon.item.name} with ${shield.item.name}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public getArmorValue(playerId: string): number {
    const player = this.players.get(playerId)
    if (!player) return 0

    let totalArmor = 0

    // Only count armor pieces, not weapons
    const armorSlots: (keyof Equipment)[] = ['helmet', 'body', 'legs']
    
    for (const slotName of armorSlots) {
      const slot = player.equipment[slotName]
      if (slot && slot.item.bonuses?.defense) {
        totalArmor += slot.item.bonuses.defense
      }
    }

    return totalArmor
  }

  public getWeaponDamage(playerId: string): { min: number, max: number } {
    const player = this.players.get(playerId)
    if (!player) return { min: 0, max: 0 }

    const weapon = player.equipment.weapon
    if (!weapon) {
      return { min: 1, max: 2 } // Unarmed combat
    }

    const strengthBonus = weapon.item.bonuses?.strength || 0
    const attackBonus = weapon.item.bonuses?.attack || 0

    // Calculate weapon damage based on bonuses
    const baseDamage = Math.floor((strengthBonus + attackBonus) / 2) + 1
    
    return {
      min: Math.max(1, baseDamage - 2),
      max: baseDamage + 3
    }
  }

  public hasRequiredAmmo(playerId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    const weapon = player.equipment.weapon
    if (!weapon || weapon.item.weaponType !== WeaponType.BOW) {
      return true // No ammo required for non-ranged weapons
    }

    const arrows = player.equipment.arrows
    return arrows !== null && arrows.quantity > 0
  }

  public consumeAmmo(playerId: string, quantity = 1): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    const arrows = player.equipment.arrows
    if (!arrows || arrows.quantity < quantity) {
      return false
    }

    arrows.quantity -= quantity
    
    // Remove arrows if quantity reaches 0
    if (arrows.quantity <= 0) {
      player.equipment.arrows = null
    }

    console.log(`[EquipmentSystem] Player ${playerId} consumed ${quantity} arrows (${arrows?.quantity || 0} remaining)`)
    return true
  }

  public autoEquipBestItem(playerId: string, slot: keyof Equipment): boolean {
    const player = this.players.get(playerId)
    if (!player || !this.inventorySystem) return false

    const inventory = player.inventory
    let bestItem: { item: RPGItem, slotIndex: number } | null = null
    let bestValue = 0

    // Find best item for this slot in inventory
    for (let i = 0; i < inventory.slots.length; i++) {
      const slot_item = inventory.slots[i]
      if (!slot_item) continue

      const itemSlot = this.getEquipmentSlot(slot_item.item)
      if (itemSlot !== slot) continue

      // Calculate item value (sum of all bonuses)
      const bonuses = slot_item.item.bonuses || {}
      const itemValue = (bonuses.attack || 0) + (bonuses.strength || 0) + (bonuses.defense || 0) + (bonuses.range || 0)
      
      if (itemValue > bestValue) {
        bestItem = { item: slot_item.item, slotIndex: i }
        bestValue = itemValue
      }
    }

    if (bestItem) {
      // Try to equip the best item
      this.equipItem(playerId, bestItem.item.id)
      return true
    }

    return false
  }
}