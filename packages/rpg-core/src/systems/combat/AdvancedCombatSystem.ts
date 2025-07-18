/**
 * Advanced Combat System - Full RuneScape-style combat mechanics
 * Handles melee, ranged, and magic combat with proper timing, range, and damage
 */

import { System } from '@hyperfy/sdk'
import type { World } from '../../../types'
import {
  CombatStyle,
  AttackStyle,
  WeaponType,
  WEAPON_DEFINITIONS,
  ARMOR_DEFINITIONS,
  COMBAT_TRIANGLE,
  RESPAWN_LOCATIONS,
  calculateAccuracy,
  calculateMaxDamage,
  applyCombatTriangle,
  CombatStats,
} from './CombatDefinitions'
import { SkillType } from '../skills/SkillDefinitions'

interface CombatComponent {
  type: 'combat'
  currentHitpoints: number
  maxHitpoints: number
  combatLevel: number
  attackStyle: AttackStyle
  autoRetaliate: boolean
  inCombat: boolean
  lastAttackTime: number
  target?: string
  specialAttackEnergy: number
  poisoned: boolean
  stunned: boolean
  frozen: boolean
}

interface EquipmentComponent {
  type: 'equipment'
  slots: Record<string, any> // ArmorSlot -> equipped item
  totalWeight: number
  bonuses: {
    attackBonus: number
    strengthBonus: number
    defenceBonus: number
    rangedBonus: number
    rangedDefence: number
    magicBonus: number
    magicDefence: number
    prayer: number
  }
}

interface AttackData {
  id: string
  attackerId: string
  targetId: string
  weapon: any
  combatStyle: CombatStyle
  attackStyle: AttackStyle
  startTime: number
  attackSpeed: number // ticks
  range: number
  damage: number
  accuracy: number
  completed: boolean
}

export class AdvancedCombatSystem extends System {
  private activeAttacks: Map<string, AttackData> = new Map()
  private combatQueue: AttackData[] = []
  private attackCounter: number = 0
  private readonly TICK_RATE = 600 // 0.6 seconds per game tick

  constructor(world: World) {
    super(world)
  }

  async initialize(): Promise<void> {
    console.log('[AdvancedCombatSystem] Initializing...')

    // Listen for combat events
    this.world.events.on('player:joined', this.handlePlayerJoined.bind(this))
    this.world.events.on('combat:attack_initiated', this.handleAttackInitiated.bind(this))
    this.world.events.on('combat:target_selected', this.handleTargetSelected.bind(this))
    this.world.events.on('combat:special_attack', this.handleSpecialAttack.bind(this))
    this.world.events.on('magic:spell_cast', this.handleMagicAttack.bind(this))

    console.log('[AdvancedCombatSystem] Initialized')
  }

  private handlePlayerJoined(data: any): void {
    const { entityId } = data
    this.createCombatComponent(entityId)
    this.createEquipmentComponent(entityId)
  }

  public createCombatComponent(entityId: string): CombatComponent | null {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return null
    }

    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')
    const hpLevel = skillsSystem ? (skillsSystem as any).getSkillLevel(entityId, SkillType.HITPOINTS) : 10
    const combatLevel = skillsSystem ? (skillsSystem as any).getCombatLevel(entityId) : 3

    const combatComponent: CombatComponent = {
      type: 'combat',
      currentHitpoints: hpLevel,
      maxHitpoints: hpLevel,
      combatLevel,
      attackStyle: AttackStyle.ACCURATE,
      autoRetaliate: true,
      inCombat: false,
      lastAttackTime: 0,
      specialAttackEnergy: 100,
      poisoned: false,
      stunned: false,
      frozen: false,
    }

    entity.addComponent(combatComponent)
    return combatComponent
  }

  public createEquipmentComponent(entityId: string): EquipmentComponent | null {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return null
    }

    const equipmentComponent: EquipmentComponent = {
      type: 'equipment',
      slots: {},
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
      },
    }

    entity.addComponent(equipmentComponent)
    return equipmentComponent
  }

  public equipItem(entityId: string, itemId: string, slot: string): boolean {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return false
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    if (!equipment) {
      return false
    }

    // Get item definition
    const weaponDef = WEAPON_DEFINITIONS[itemId]
    const armorDef = ARMOR_DEFINITIONS[itemId]
    const itemDef = weaponDef || armorDef

    if (!itemDef) {
      return false
    }

    // Check requirements
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')
    if (skillsSystem && itemDef.requirements) {
      for (const [skill, level] of Object.entries(itemDef.requirements)) {
        const playerLevel = (skillsSystem as any).getSkillLevel(entityId, skill)
        if (playerLevel < level) {
          this.world.events.emit('combat:equipment_requirement_not_met', {
            entityId,
            itemId,
            skill,
            required: level,
            current: playerLevel,
          })
          return false
        }
      }
    }

    // Unequip existing item in slot
    if (equipment.slots[slot]) {
      this.unequipItem(entityId, slot)
    }

    // Equip new item
    equipment.slots[slot] = itemDef
    this.recalculateBonuses(entityId)

    this.world.events.emit('combat:item_equipped', {
      entityId,
      itemId,
      slot,
    })

    return true
  }

  public unequipItem(entityId: string, slot: string): boolean {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return false
    }

    const equipment = entity.getComponent('equipment') as EquipmentComponent
    if (!equipment || !equipment.slots[slot]) {
      return false
    }

    const item = equipment.slots[slot]
    delete equipment.slots[slot]

    this.recalculateBonuses(entityId)

    this.world.events.emit('combat:item_unequipped', {
      entityId,
      itemId: item.id,
      slot,
    })

    return true
  }

  private recalculateBonuses(entityId: string): void {
    const entity = this.world.getEntityById(entityId)
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
    }
    equipment.totalWeight = 0

    // Sum bonuses from all equipped items
    for (const item of Object.values(equipment.slots)) {
      if (item.bonuses) {
        equipment.bonuses.attackBonus += item.bonuses.attackBonus || 0
        equipment.bonuses.strengthBonus += item.bonuses.strengthBonus || 0
        equipment.bonuses.defenceBonus += item.bonuses.defenceBonus || 0
        equipment.bonuses.rangedBonus += item.bonuses.rangedBonus || 0
        equipment.bonuses.rangedDefence += item.bonuses.rangedDefence || 0
        equipment.bonuses.magicBonus += item.bonuses.magicBonus || 0
        equipment.bonuses.magicDefence += item.bonuses.magicDefence || 0
        equipment.bonuses.prayer += item.bonuses.prayer || 0
      }
      equipment.totalWeight += item.weight || 0
    }
  }

  private handleAttackInitiated(data: any): void {
    const { attackerId, targetId } = data
    this.startAttack(attackerId, targetId)
  }

  private handleTargetSelected(data: any): void {
    const { attackerId, targetId } = data

    const attacker = this.world.getEntityById(attackerId)
    if (!attacker) {
      return
    }

    const combat = attacker.getComponent('combat') as CombatComponent
    if (!combat) {
      return
    }

    combat.target = targetId

    // Start auto-attacking if not in combat
    if (!combat.inCombat) {
      this.startAttack(attackerId, targetId)
    }
  }

  private handleSpecialAttack(data: any): void {
    const { attackerId, targetId } = data
    this.executeSpecialAttack(attackerId, targetId)
  }

  private handleMagicAttack(data: any): void {
    const { casterId, targetId, spellType, damage } = data
    if (targetId && damage > 0) {
      this.dealDamage(casterId, targetId, damage, CombatStyle.MAGIC)
    }
  }

  public startAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.world.getEntityById(attackerId)
    const target = this.world.getEntityById(targetId)

    if (!attacker || !target) {
      return false
    }

    const attackerCombat = attacker.getComponent('combat') as CombatComponent
    const targetCombat = target.getComponent('combat') as CombatComponent

    if (!attackerCombat || !targetCombat) {
      return false
    }

    // Check if target is alive
    if (targetCombat.currentHitpoints <= 0) {
      return false
    }

    // Check if attacker can attack (not stunned, etc.)
    if (attackerCombat.stunned || attackerCombat.frozen) {
      return false
    }

    // Get weapon and combat style
    const equipment = attacker.getComponent('equipment') as EquipmentComponent
    const weapon = equipment?.slots['weapon'] || WEAPON_DEFINITIONS.unarmed

    if (!weapon) {
      console.error(`[AdvancedCombatSystem] No weapon found for ${attackerId}`)
      return false
    }

    // Check range
    const distance = this.getDistance(attacker, target)
    if (distance > weapon.attackRange) {
      this.world.events.emit('combat:out_of_range', {
        attackerId,
        targetId,
        distance,
        requiredRange: weapon.attackRange,
      })
      return false
    }

    // Check attack speed cooldown
    const timeSinceLastAttack = Date.now() - attackerCombat.lastAttackTime
    const requiredCooldown = weapon.attackSpeed * this.TICK_RATE

    if (timeSinceLastAttack < requiredCooldown) {
      return false // Still on cooldown
    }

    // Create attack data
    const attackId = `attack_${this.attackCounter++}`
    const attackData: AttackData = {
      id: attackId,
      attackerId,
      targetId,
      weapon,
      combatStyle: weapon.combatStyle,
      attackStyle: attackerCombat.attackStyle,
      startTime: Date.now(),
      attackSpeed: weapon.attackSpeed,
      range: weapon.attackRange,
      damage: 0, // Calculated when attack lands
      accuracy: 0, // Calculated when attack lands
      completed: false,
    }

    this.activeAttacks.set(attackId, attackData)
    attackerCombat.lastAttackTime = Date.now()
    attackerCombat.inCombat = true
    attackerCombat.target = targetId
    targetCombat.inCombat = true

    // Start combat animation
    this.world.events.emit('combat:attack_started', {
      attackerId,
      targetId,
      weaponType: weapon.type,
      combatStyle: weapon.combatStyle,
      attackSpeed: weapon.attackSpeed,
    })

    // Schedule attack completion
    setTimeout(() => {
      this.completeAttack(attackId)
    }, this.getAttackDelay(weapon.combatStyle))

    console.log(`[AdvancedCombatSystem] Attack ${attackId} started: ${attackerId} -> ${targetId} with ${weapon.name}`)

    return true
  }

  private getAttackDelay(combatStyle: CombatStyle): number {
    // Different combat styles have different visual delays before damage
    switch (combatStyle) {
      case CombatStyle.MELEE:
        return 300 // 0.3 seconds for swing to connect
      case CombatStyle.RANGED:
        return 600 // 0.6 seconds for projectile travel
      case CombatStyle.MAGIC:
        return 800 // 0.8 seconds for spell travel
      default:
        return 300
    }
  }

  private completeAttack(attackId: string): void {
    const attack = this.activeAttacks.get(attackId)
    if (!attack || attack.completed) {
      return
    }

    const attacker = this.world.getEntityById(attack.attackerId)
    const target = this.world.getEntityById(attack.targetId)

    if (!attacker || !target) {
      this.activeAttacks.delete(attackId)
      return
    }

    const targetCombat = target.getComponent('combat') as CombatComponent
    if (!targetCombat || targetCombat.currentHitpoints <= 0) {
      this.activeAttacks.delete(attackId)
      return
    }

    attack.completed = true

    // Calculate hit or miss
    const accuracy = this.calculateHitChance(attacker, target, attack.combatStyle)
    const hit = Math.random() < accuracy

    if (hit) {
      // Calculate damage
      const maxDamage = this.calculateDamage(attacker, target, attack.combatStyle)
      const actualDamage = Math.floor(Math.random() * (maxDamage + 1))

      // Apply combat triangle
      const defenderStyle = this.getDefenderCombatStyle(target)
      const triangleDamage = applyCombatTriangle(actualDamage, attack.combatStyle, defenderStyle)

      this.dealDamage(attack.attackerId, attack.targetId, triangleDamage, attack.combatStyle)
    } else {
      // Miss
      this.world.events.emit('combat:attack_missed', {
        attackerId: attack.attackerId,
        targetId: attack.targetId,
        combatStyle: attack.combatStyle,
      })
    }

    // Handle auto-retaliate
    this.handleAutoRetaliate(attack.targetId, attack.attackerId)

    // Continue auto-attacking if target is still alive and in range
    this.scheduleNextAttack(attack.attackerId, attack.targetId)

    this.activeAttacks.delete(attackId)
  }

  private calculateHitChance(attacker: Entity, target: Entity, combatStyle: CombatStyle): number {
    const attackerStats = this.getCombatStats(attacker)
    const defenderStats = this.getCombatStats(target)

    const attackerEquipment = this.getEquipmentComponent(attacker)
    const defenderEquipment = this.getEquipmentComponent(target)

    // Ensure defence is set (handle both defense and defence spellings)
    const attackerStatsFixed = {
      ...attackerStats,
      defence: attackerStats.defence || (attackerStats as any).defense || attackerStats.defence || 1
    }
    const defenderStatsFixed = {
      ...defenderStats,
      defence: defenderStats.defence || (defenderStats as any).defense || defenderStats.defence || 1
    }

    return calculateAccuracy(
      attackerStatsFixed as any,
      attackerEquipment?.bonuses,
      defenderStatsFixed as any,
      defenderEquipment?.bonuses,
      combatStyle
    )
  }

  private calculateDamage(attacker: Entity, target: Entity, combatStyle: CombatStyle): number {
    const attackerStats = this.getCombatStats(attacker)
    const attackerEquipment = this.getEquipmentComponent(attacker)

    return calculateMaxDamage(attackerStats, attackerEquipment?.bonuses, combatStyle)
  }

  private getCombatStats(entity: Entity): CombatStats {
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')

    if (!skillsSystem) {
      return {
        attack: 1,
        strength: 1,
        defence: 1,
        ranged: 1,
        magic: 1,
        hitpoints: 10,
        prayer: 1,
      }
    }

    return {
      attack: (skillsSystem as any).getSkillLevel(entity.id, SkillType.ATTACK),
      strength: (skillsSystem as any).getSkillLevel(entity.id, SkillType.STRENGTH),
      defence: (skillsSystem as any).getSkillLevel(entity.id, SkillType.DEFENCE),
      ranged: (skillsSystem as any).getSkillLevel(entity.id, SkillType.RANGED),
      magic: (skillsSystem as any).getSkillLevel(entity.id, SkillType.MAGIC),
      hitpoints: (skillsSystem as any).getSkillLevel(entity.id, SkillType.HITPOINTS),
      prayer: (skillsSystem as any).getSkillLevel(entity.id, SkillType.PRAYER),
    }
  }

  /**
   * Safely get equipment component from entity
   */
  private getEquipmentComponent(entity: Entity): EquipmentComponent | null {
    const component = entity.getComponent('equipment')
    if (component && typeof component === 'object' && component.type === 'equipment') {
      return component as unknown as EquipmentComponent
    }
    return null
  }

  /**
   * Safely get movement component from entity
   */
  private getMovementComponent(entity: Entity): any {
    const component = entity.getComponent('movement')
    if (component && typeof component === 'object' && component.type === 'movement') {
      return component
    }
    return null
  }

  private getDefenderCombatStyle(defender: Entity): CombatStyle {
    const equipment = this.getEquipmentComponent(defender)
    const weapon = equipment?.slots['weapon']

    if (weapon && weapon.combatStyle) {
      return weapon.combatStyle
    }

    return CombatStyle.MELEE // Default to melee
  }

  public dealDamage(
    attackerId: string,
    targetId: string,
    damage: number,
    damageType: CombatStyle,
    source?: string
  ): void {
    const target = this.world.getEntityById(targetId)
    if (!target) {
      return
    }

    const targetCombat = target.getComponent('combat') as CombatComponent
    if (!targetCombat) {
      return
    }

    // Apply damage
    const actualDamage = Math.min(damage, targetCombat.currentHitpoints)
    targetCombat.currentHitpoints -= actualDamage

    this.world.events.emit('combat:damage_dealt', {
      attackerId,
      targetId,
      damage: actualDamage,
      damageType,
      remainingHp: targetCombat.currentHitpoints,
      source,
    })

    // Award experience to attacker
    if (attackerId && actualDamage > 0) {
      this.awardCombatExperience(attackerId, actualDamage, damageType)
    }

    // Check for death
    if (targetCombat.currentHitpoints <= 0) {
      this.handleDeath(targetId, attackerId)
    }
  }

  private awardCombatExperience(entityId: string, damage: number, combatStyle: CombatStyle): void {
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')
    if (!skillsSystem) {
      return
    }

    const baseXp = damage * 4 // 4 XP per damage point

    switch (combatStyle) {
      case CombatStyle.MELEE:
        // Split between attack/strength based on attack style
        const combat = this.world.getEntityById(entityId)?.getComponent('combat') as CombatComponent
        if (combat) {
          switch (combat.attackStyle) {
            case AttackStyle.ACCURATE:
              ;(skillsSystem as any).addExperience(entityId, SkillType.ATTACK, baseXp)
              break
            case AttackStyle.AGGRESSIVE:
              ;(skillsSystem as any).addExperience(entityId, SkillType.STRENGTH, baseXp)
              break
            case AttackStyle.DEFENSIVE:
              ;(skillsSystem as any).addExperience(entityId, SkillType.DEFENCE, baseXp)
              break
            case AttackStyle.CONTROLLED:
              ;(skillsSystem as any).addExperience(entityId, SkillType.ATTACK, baseXp / 3)
              ;(skillsSystem as any).addExperience(entityId, SkillType.STRENGTH, baseXp / 3)
              ;(skillsSystem as any).addExperience(entityId, SkillType.DEFENCE, baseXp / 3)
              break
          }
        }
        break
      case CombatStyle.RANGED:
        ;(skillsSystem as any).addExperience(entityId, SkillType.RANGED, baseXp)
        break
      case CombatStyle.MAGIC:
        // Magic XP is already awarded by the magic system
        break
    }

    // Always award hitpoints XP (1/3 of combat XP)
    ;(skillsSystem as any).addExperience(entityId, SkillType.HITPOINTS, baseXp / 3)
  }

  private handleDeath(deadEntityId: string, killerId?: string): void {
    const deadEntity = this.world.getEntityById(deadEntityId)
    if (!deadEntity) {
      return
    }

    const deadCombat = deadEntity.getComponent('combat') as CombatComponent
    if (!deadCombat) {
      return
    }

    deadCombat.inCombat = false
    deadCombat.target = undefined

    this.world.events.emit('combat:entity_died', {
      entityId: deadEntityId,
      killerId,
      deathTime: Date.now(),
    })

    // Handle respawn
    setTimeout(() => {
      this.respawnEntity(deadEntityId)
    }, 3000) // 3 second death delay
  }

  private respawnEntity(entityId: string): void {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return
    }

    const combat = entity.getComponent('combat') as CombatComponent
    const movement = entity.getComponent('movement')

    if (!combat || !movement) {
      return
    }

    // Restore full hitpoints
    combat.currentHitpoints = combat.maxHitpoints
    combat.inCombat = false
    combat.target = undefined

    // Move to respawn location
    const respawnLocation = RESPAWN_LOCATIONS['lumbridge']
    movement.position = { ...respawnLocation }

    this.world.events.emit('combat:entity_respawned', {
      entityId,
      respawnLocation,
      respawnTime: Date.now(),
    })
  }

  private handleAutoRetaliate(defenderId: string, attackerId: string): void {
    const defender = this.world.getEntityById(defenderId)
    if (!defender) {
      return
    }

    const defenderCombat = defender.getComponent('combat') as CombatComponent
    if (!defenderCombat || !defenderCombat.autoRetaliate) {
      return
    }

    // Only retaliate if not already targeting someone
    if (!defenderCombat.target) {
      defenderCombat.target = attackerId

      // Schedule retaliation attack
      setTimeout(() => {
        this.startAttack(defenderId, attackerId)
      }, 300) // Small delay for retaliation
    }
  }

  private scheduleNextAttack(attackerId: string, targetId: string): void {
    const attacker = this.world.getEntityById(attackerId)
    const target = this.world.getEntityById(targetId)

    if (!attacker || !target) {
      return
    }

    const attackerCombat = attacker.getComponent('combat') as CombatComponent
    const targetCombat = target.getComponent('combat') as CombatComponent

    if (!attackerCombat || !targetCombat) {
      return
    }

    // Continue attacking if target is still alive and in range
    if (targetCombat.currentHitpoints > 0 && attackerCombat.target === targetId) {
      const equipment = attacker.getComponent('equipment') as EquipmentComponent
      const weapon = equipment?.slots['weapon'] || WEAPON_DEFINITIONS.unarmed

      const cooldown = weapon.attackSpeed * this.TICK_RATE

      setTimeout(() => {
        // Check if still should be attacking
        const currentCombat = attacker.getComponent('combat') as CombatComponent
        if (currentCombat && currentCombat.target === targetId) {
          this.startAttack(attackerId, targetId)
        }
      }, cooldown)
    } else {
      // End combat
      attackerCombat.inCombat = false
      attackerCombat.target = undefined
    }
  }

  private executeSpecialAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.world.getEntityById(attackerId)
    if (!attacker) {
      return false
    }

    const combat = attacker.getComponent('combat') as CombatComponent
    const equipment = attacker.getComponent('equipment') as EquipmentComponent

    if (!combat || !equipment) {
      return false
    }

    const weapon = equipment.slots['weapon']
    if (!weapon || !weapon.specialAttack) {
      return false
    }

    // Check special attack energy
    if (combat.specialAttackEnergy < weapon.specialAttack.energyCost) {
      this.world.events.emit('combat:insufficient_special_energy', {
        attackerId,
        required: weapon.specialAttack.energyCost,
        current: combat.specialAttackEnergy,
      })
      return false
    }

    // Consume special energy
    combat.specialAttackEnergy -= weapon.specialAttack.energyCost

    // Execute special attack (enhanced damage/accuracy)
    const target = this.world.getEntityById(targetId)
    if (target) {
      const baseDamage = this.calculateDamage(attacker, target, weapon.combatStyle)
      const specialDamage = Math.floor(baseDamage * weapon.specialAttack.damageMultiplier)

      this.dealDamage(attackerId, targetId, specialDamage, weapon.combatStyle, 'special_attack')
    }

    this.world.events.emit('combat:special_attack_used', {
      attackerId,
      targetId,
      weaponId: weapon.id,
      energyCost: weapon.specialAttack.energyCost,
      remainingEnergy: combat.specialAttackEnergy,
    })

    return true
  }

  private getDistance(entity1: Entity, entity2: Entity): number {
    const movement1 = this.getMovementComponent(entity1)
    const movement2 = this.getMovementComponent(entity2)
    
    const pos1 = movement1?.position
    const pos2 = movement2?.position

    if (!pos1 || !pos2) {
      return Infinity
    }

    const dx = pos1.x - pos2.x
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  public stopCombat(entityId: string): void {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return
    }

    const combat = entity.getComponent('combat') as CombatComponent
    if (!combat) {
      return
    }

    combat.inCombat = false
    combat.target = undefined

    // Cancel any active attacks
    for (const [attackId, attack] of this.activeAttacks) {
      if (attack.attackerId === entityId) {
        this.activeAttacks.delete(attackId)
      }
    }

    this.world.events.emit('combat:combat_stopped', { entityId })
  }

  public getCombatComponent(entityId: string): CombatComponent | null {
    const entity = this.world.getEntityById(entityId)
    return entity ? (entity.getComponent('combat') as CombatComponent) : null
  }


  update(deltaTime: number): void {
    // Regenerate special attack energy over time
    const entities = (this.world.entities as any)?.items
    if (entities instanceof Map) {
      for (const [entityId, entity] of entities) {
        const combat = entity.getComponent && (entity.getComponent('combat') as CombatComponent)
        if (combat && combat.specialAttackEnergy < 100) {
          // Regenerate 1% every 30 seconds
          const regenRate = 100 / (30 * 1000) // per millisecond
          combat.specialAttackEnergy = Math.min(100, combat.specialAttackEnergy + regenRate * deltaTime)
        }
      }
    }

    // Handle poison damage
    if (entities instanceof Map) {
      for (const [entityId, entity] of entities) {
        const combat = entity.getComponent && (entity.getComponent('combat') as CombatComponent)
        if (combat && combat.poisoned) {
          // Poison damage every 18 seconds (30 game ticks)
          const poisonInterval = 18000
          if (Date.now() - combat.lastAttackTime > poisonInterval) {
            this.dealDamage('poison', entity.id, 1, CombatStyle.MELEE, 'poison')
            combat.lastAttackTime = Date.now()
          }
        }
      }
    }
  }

  serialize(): any {
    return {
      activeAttacks: Object.fromEntries(this.activeAttacks),
      attackCounter: this.attackCounter,
    }
  }

  deserialize(data: any): void {
    if (data.activeAttacks) {
      this.activeAttacks = new Map(Object.entries(data.activeAttacks))
    }
    if (data.attackCounter) {
      this.attackCounter = data.attackCounter
    }
  }
}
