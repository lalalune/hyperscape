/**
 * Equipment System - Manages player equipment and gear progression
 * Handles equipping, unequipping, stat bonuses, and equipment validation
 */

import { System } from "../types/hyperfy"
import type { World } from '../../../types'
import {
  ItemDefinition,
  EquipmentSlot,
  ItemCategory,
  ItemStats,
  getItemDefinition,
  canPlayerEquipItem,
} from './ItemDefinitions'
import { SkillType } from '../skills/SkillDefinitions'

export interface EquippedItem {
  itemId: string
  slot: EquipmentSlot
  equipped: number // timestamp
}

export interface EquipmentComponent {
  type: 'equipment'
  slots: Record<EquipmentSlot, EquippedItem | null>
  totalWeight: number
  bonuses: ItemStats
  combatLevel: number
}

export interface ItemUseData {
  playerId: string
  itemId: string
  quantity?: number
  targetId?: string
  position?: { x: number; y: number; z: number }
}

export class EquipmentSystem extends System {
  private equipmentUpdates: Map<string, number> = new Map()

  constructor(world: World) {
    super(world)
  }

  async initialize(): Promise<void> {
    console.log('[EquipmentSystem] Initializing...')

    // Listen for equipment events
    this.world.events.on('player:joined', this.handlePlayerJoined.bind(this))
    this.world.events.on('equipment:equip_item', this.handleEquipItem.bind(this))
    this.world.events.on('equipment:unequip_item', this.handleUnequipItem.bind(this))
    this.world.events.on('inventory:use_item', this.handleUseItem.bind(this))
    this.world.events.on('equipment:swap_items', this.handleSwapItems.bind(this))
    this.world.events.on('equipment:auto_equip', this.handleAutoEquip.bind(this))

    console.log('[EquipmentSystem] Initialized')
  }

  private handlePlayerJoined(data: any): void {
    const { entityId } = data
    this.createEquipmentComponent(entityId)
  }

  public createEquipmentComponent(entityId: string): EquipmentComponent | null {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return null
    }

    const equipmentComponent: EquipmentComponent = {
      type: 'equipment',
      slots: {
        [EquipmentSlot.WEAPON]: null,
        [EquipmentSlot.HELMET]: null,
        [EquipmentSlot.BODY]: null,
        [EquipmentSlot.LEGS]: null,
        [EquipmentSlot.BOOTS]: null,
        [EquipmentSlot.GLOVES]: null,
        [EquipmentSlot.SHIELD]: null,
        [EquipmentSlot.RING]: null,
        [EquipmentSlot.AMULET]: null,
        [EquipmentSlot.ARROW]: null,
        [EquipmentSlot.CAPE]: null,
      },
      totalWeight: 0,
      bonuses: {
        attackBonus: 0,
        strengthBonus: 0,
        defenceBonus: 0,
        rangedBonus: 0,
        rangedDefence: 0,
        magicBonus: 0,
        magicDefence: 0,
        prayer: 0,
        weight: 0,
      },
      combatLevel: 3,
    }

    entity.addComponent(equipmentComponent)
    return equipmentComponent
  }

  private handleEquipItem(data: any): void {
    const { playerId, itemId, slot } = data
    this.equipItem(playerId, itemId, slot)
  }

  private handleUnequipItem(data: any): void {
    const { playerId, slot } = data
    this.unequipItem(playerId, slot)
  }

  private handleUseItem(data: ItemUseData): void {
    const { playerId, itemId } = data
    this.useItem(playerId, itemId, data)
  }

  private handleSwapItems(data: any): void {
    const { playerId, fromSlot, toSlot } = data
    this.swapEquippedItems(playerId, fromSlot, toSlot)
  }

  private handleAutoEquip(data: any): void {
    const { playerId, itemId } = data
    this.autoEquipItem(playerId, itemId)
  }

  public equipItem(playerId: string, itemId: string, slot?: EquipmentSlot): boolean {
    const entity = this.world.getEntityById(playerId)
    const itemDef = getItemDefinition(itemId)

    if (!entity || !itemDef) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'Item not found or invalid entity',
      })
      return false
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    if (!equipment) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'Equipment component not found',
      })
      return false
    }

    // Check if item is equippable
    if (
      itemDef.category !== ItemCategory.WEAPON &&
      itemDef.category !== ItemCategory.ARMOR &&
      itemDef.category !== ItemCategory.TOOL
    ) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'Item is not equippable',
      })
      return false
    }

    // Determine equipment slot
    const equipmentSlot = slot || itemDef.equipmentSlot
    if (!equipmentSlot) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'Item does not have a valid equipment slot',
      })
      return false
    }

    // Check requirements
    if (!this.canPlayerEquipItem(playerId, itemDef)) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'You do not meet the requirements to equip this item',
      })
      return false
    }

    // Check if player has the item in inventory
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem')
    if (!inventorySystem || !(inventorySystem as any).hasItem(playerId, itemId, 1)) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'You do not have this item in your inventory',
      })
      return false
    }

    // Unequip existing item in slot if any
    if (equipment.slots[equipmentSlot]) {
      this.unequipItem(playerId, equipmentSlot)
    }

    // Remove item from inventory
    ;(inventorySystem as any).removeItem(playerId, itemId, 1)

    // Equip the item
    equipment.slots[equipmentSlot] = {
      itemId,
      slot: equipmentSlot,
      equipped: Date.now(),
    }

    // Update bonuses
    this.updateEquipmentBonuses(playerId)

    this.world.events.emit('equipment:item_equipped', {
      playerId,
      itemId,
      slot: equipmentSlot,
      itemName: itemDef.name,
    })

    return true
  }

  public unequipItem(playerId: string, slot: EquipmentSlot): boolean {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return false
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    if (!equipment || !equipment.slots[slot]) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'No item equipped in that slot',
      })
      return false
    }

    const equippedItem = equipment.slots[slot]
    const itemDef = getItemDefinition(equippedItem.itemId)

    if (!itemDef) {
      return false
    }

    // Check if inventory has space
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem')
    if (!inventorySystem || !(inventorySystem as any).canAddItem(playerId, equippedItem.itemId, 1)) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'Not enough inventory space to unequip item',
      })
      return false
    }

    // Add item back to inventory
    ;(inventorySystem as any).addItem(playerId, equippedItem.itemId, 1)

    // Unequip the item
    equipment.slots[slot] = null

    // Update bonuses
    this.updateEquipmentBonuses(playerId)

    this.world.events.emit('equipment:item_unequipped', {
      playerId,
      itemId: equippedItem.itemId,
      slot,
      itemName: itemDef.name,
    })

    return true
  }

  public useItem(playerId: string, itemId: string, useData: ItemUseData): boolean {
    const itemDef = getItemDefinition(itemId)
    if (!itemDef) {
      return false
    }

    // Handle consumable items
    if (itemDef.category === ItemCategory.CONSUMABLE && itemDef.consumable) {
      return this.consumeItem(playerId, itemId)
    }

    // Handle equippable items (auto-equip)
    if (itemDef.equipmentSlot) {
      return this.autoEquipItem(playerId, itemId)
    }

    // Handle other item uses (tools, etc.)
    this.world.events.emit('equipment:item_used', {
      playerId,
      itemId,
      useData,
    })

    return true
  }

  private consumeItem(playerId: string, itemId: string): boolean {
    const entity = this.world.getEntityById(playerId)
    const itemDef = getItemDefinition(itemId)

    if (!entity || !itemDef || !itemDef.consumable) {
      return false
    }

    // Check if player has the item
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem')
    if (!inventorySystem || !(inventorySystem as any).hasItem(playerId, itemId, 1)) {
      this.world.events.emit('equipment:error', {
        playerId,
        message: 'You do not have this item',
      })
      return false
    }

    // Check if player can consume (not in combat, etc.)
    const combatSystem = this.world.systems.find(s => s.constructor.name === 'AdvancedCombatSystem')
    if (combatSystem) {
      const combatComponent = (combatSystem as any).getCombatComponent(playerId)
      if (combatComponent && combatComponent.inCombat) {
        // Only allow food consumption in combat, not potions
        if (!itemDef.consumable.healAmount) {
          this.world.events.emit('equipment:error', {
            playerId,
            message: 'Cannot use this item in combat',
          })
          return false
        }
      }
    }

    // Consume the item
    ;(inventorySystem as any).removeItem(playerId, itemId, 1)

    // Apply healing
    if (itemDef.consumable.healAmount) {
      if (combatSystem) {
        const combatComponent = (combatSystem as any).getCombatComponent(playerId)
        if (combatComponent) {
          const newHp = Math.min(
            combatComponent.maxHitpoints,
            combatComponent.currentHitpoints + itemDef.consumable.healAmount
          )
          combatComponent.currentHitpoints = newHp

          this.world.events.emit('equipment:healing_applied', {
            playerId,
            healAmount: itemDef.consumable.healAmount,
            currentHp: newHp,
            maxHp: combatComponent.maxHitpoints,
          })
        }
      }
    }

    // Apply temporary effects
    if (itemDef.consumable.effects) {
      for (const effect of itemDef.consumable.effects) {
        this.applyTemporaryEffect(playerId, effect)
      }
    }

    this.world.events.emit('equipment:item_consumed', {
      playerId,
      itemId,
      itemName: itemDef.name,
      healAmount: itemDef.consumable.healAmount,
      effects: itemDef.consumable.effects,
    })

    return true
  }

  private applyTemporaryEffect(playerId: string, effect: any): void {
    // This would integrate with a temporary effects system
    this.world.events.emit('equipment:temporary_effect_applied', {
      playerId,
      skill: effect.skill,
      boost: effect.boost,
      duration: effect.duration,
    })
  }

  public autoEquipItem(playerId: string, itemId: string): boolean {
    const itemDef = getItemDefinition(itemId)
    if (!itemDef || !itemDef.equipmentSlot) {
      return false
    }

    return this.equipItem(playerId, itemId, itemDef.equipmentSlot)
  }

  public swapEquippedItems(playerId: string, fromSlot: EquipmentSlot, toSlot: EquipmentSlot): boolean {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return false
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    if (!equipment) {
      return false
    }

    const fromItem = equipment.slots[fromSlot]
    const toItem = equipment.slots[toSlot]

    // Validate the swap
    if (fromItem && toItem) {
      const fromItemDef = getItemDefinition(fromItem.itemId)
      const toItemDef = getItemDefinition(toItem.itemId)

      // Check if items can be equipped in target slots
      if (fromItemDef && fromItemDef.equipmentSlot !== toSlot) {
        return false
      }
      if (toItemDef && toItemDef.equipmentSlot !== fromSlot) {
        return false
      }
    }

    // Perform the swap
    equipment.slots[fromSlot] = toItem
    equipment.slots[toSlot] = fromItem

    // Update bonuses
    this.updateEquipmentBonuses(playerId)

    this.world.events.emit('equipment:items_swapped', {
      playerId,
      fromSlot,
      toSlot,
      fromItem: fromItem?.itemId,
      toItem: toItem?.itemId,
    })

    return true
  }

  private canPlayerEquipItem(playerId: string, itemDef: ItemDefinition): boolean {
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')
    if (!skillsSystem || !itemDef.requirements) {
      return true
    }

    const playerLevels: Record<SkillType, number> = {
      attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1,
      prayer: 1, hitpoints: 10, mining: 1, smithing: 1,
      fishing: 1, cooking: 1, woodcutting: 1, firemaking: 1,
      fletching: 1,
      crafting: 1, herblore: 1, agility: 1, thieving: 1,
      slayer: 1, farming: 1, runecrafting: 1, hunter: 1,
      construction: 1
    }
    for (const req of itemDef.requirements) {
      playerLevels[req.skill] = (skillsSystem as any).getSkillLevel(playerId, req.skill)
    }

    return canPlayerEquipItem(playerLevels, itemDef)
  }

  private updateEquipmentBonuses(playerId: string): void {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    if (!equipment) {
      return
    }

    // Reset bonuses
    equipment.bonuses = {
      attackBonus: 0,
      strengthBonus: 0,
      defenceBonus: 0,
      rangedBonus: 0,
      rangedDefence: 0,
      magicBonus: 0,
      magicDefence: 0,
      prayer: 0,
      weight: 0,
    }
    equipment.totalWeight = 0

    // Sum bonuses from all equipped items
    for (const equippedItem of Object.values(equipment.slots)) {
      if (!equippedItem) {
        continue
      }

      const itemDef = getItemDefinition(equippedItem.itemId)
      if (!itemDef || !itemDef.stats) {
        continue
      }

      if (itemDef.stats.attackBonus) {
        equipment.bonuses.attackBonus = (equipment.bonuses.attackBonus || 0) + itemDef.stats.attackBonus
      }
      if (itemDef.stats.strengthBonus) {
        equipment.bonuses.strengthBonus = (equipment.bonuses.strengthBonus || 0) + itemDef.stats.strengthBonus
      }
      if (itemDef.stats.defenceBonus) {
        equipment.bonuses.defenceBonus = (equipment.bonuses.defenceBonus || 0) + itemDef.stats.defenceBonus
      }
      if (itemDef.stats.rangedBonus) {
        equipment.bonuses.rangedBonus = (equipment.bonuses.rangedBonus || 0) + itemDef.stats.rangedBonus
      }
      if (itemDef.stats.rangedDefence) {
        equipment.bonuses.rangedDefence = (equipment.bonuses.rangedDefence || 0) + itemDef.stats.rangedDefence
      }
      if (itemDef.stats.magicBonus) {
        equipment.bonuses.magicBonus = (equipment.bonuses.magicBonus || 0) + itemDef.stats.magicBonus
      }
      if (itemDef.stats.magicDefence) {
        equipment.bonuses.magicDefence = (equipment.bonuses.magicDefence || 0) + itemDef.stats.magicDefence
      }
      if (itemDef.stats.prayer) {
        equipment.bonuses.prayer = (equipment.bonuses.prayer || 0) + itemDef.stats.prayer
      }
      if (itemDef.stats.weight) {
        equipment.bonuses.weight = (equipment.bonuses.weight || 0) + itemDef.stats.weight
        equipment.totalWeight += itemDef.stats.weight
      }
    }

    // Update combat level
    this.updateCombatLevel(playerId)

    // Mark for update
    this.equipmentUpdates.set(playerId, Date.now())

    this.world.events.emit('equipment:bonuses_updated', {
      playerId,
      bonuses: equipment.bonuses,
      totalWeight: equipment.totalWeight,
      combatLevel: equipment.combatLevel,
    })
  }

  private updateCombatLevel(playerId: string): void {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')

    if (!equipment || !skillsSystem) {
      return
    }

    // Calculate combat level (RuneScape formula)
    const attack = (skillsSystem as any).getSkillLevel(playerId, SkillType.ATTACK)
    const strength = (skillsSystem as any).getSkillLevel(playerId, SkillType.STRENGTH)
    const defence = (skillsSystem as any).getSkillLevel(playerId, SkillType.DEFENCE)
    const hitpoints = (skillsSystem as any).getSkillLevel(playerId, SkillType.HITPOINTS)
    const ranged = (skillsSystem as any).getSkillLevel(playerId, SkillType.RANGED)
    const magic = (skillsSystem as any).getSkillLevel(playerId, SkillType.MAGIC)
    const prayer = (skillsSystem as any).getSkillLevel(playerId, SkillType.PRAYER)

    const combatLevel = Math.floor(
      (defence + hitpoints + Math.floor(prayer / 2)) * 0.25 +
        Math.max((attack + strength) * 0.325, ranged * 0.65, magic * 0.65)
    )

    equipment.combatLevel = combatLevel
  }

  public getEquippedItem(playerId: string, slot: EquipmentSlot): EquippedItem | null {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return null
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    return equipment ? equipment.slots[slot] : null
  }

  public getAllEquippedItems(playerId: string): Record<EquipmentSlot, EquippedItem | null> {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return {} as Record<EquipmentSlot, EquippedItem | null>
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    return equipment ? equipment.slots : ({} as Record<EquipmentSlot, EquippedItem | null>)
  }

  public getEquipmentBonuses(playerId: string): ItemStats | null {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return null
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    return equipment ? equipment.bonuses : null
  }

  public getEquipmentComponent(playerId: string): EquipmentComponent | null {
    const entity = this.world.getEntityById(playerId)
    return entity ? (entity.getComponent('equipment') as EquipmentComponent) : null
  }

  public isItemEquipped(playerId: string, itemId: string): boolean {
    const equipment = this.getAllEquippedItems(playerId)
    return Object.values(equipment).some(item => item && item.itemId === itemId)
  }

  public getCombatLevel(playerId: string): number {
    const entity = this.world.getEntityById(playerId)
    if (!entity) {
      return 3
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    return equipment ? equipment.combatLevel : 3
  }

  update(deltaTime: number): void {
    // Handle any ongoing equipment-related processes
    // For now, just cleanup old update timestamps
    const now = Date.now()
    for (const [playerId, timestamp] of this.equipmentUpdates) {
      if (now - timestamp > 60000) {
        // 1 minute old
        this.equipmentUpdates.delete(playerId)
      }
    }
  }

  serialize(): any {
    return {
      equipmentUpdates: Object.fromEntries(this.equipmentUpdates),
    }
  }

  deserialize(data: any): void {
    if (data.equipmentUpdates) {
      this.equipmentUpdates = new Map(Object.entries(data.equipmentUpdates))
    }
  }
}
