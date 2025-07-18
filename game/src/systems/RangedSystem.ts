import { System } from '../../core/systems/System'
import type { World } from '../../types'
import {
  RPGEntity,
  StatsComponent,
  CombatComponent,
  InventoryComponent,
  AttackType,
  HitResult,
  // Equipment,
  EquipmentSlot,
  CombatStyle,
  Vector3,
} from '../types/index'

export enum WeaponType {
  BOW = 'bow',
  CROSSBOW = 'crossbow',
  DART = 'dart',
  KNIFE = 'knife',
  JAVELIN = 'javelin',
  THROWING_AXE = 'throwing_axe',
}

export interface RangedWeapon {
  itemId: number
  weaponType: WeaponType
  attackSpeed: number
  rangedStrength: number
  attackRange: number
  ammunitionType: AmmunitionType
}

export enum AmmunitionType {
  ARROW = 'arrow',
  BOLT = 'bolt',
  DART = 'dart',
  KNIFE = 'knife',
  JAVELIN = 'javelin',
  THROWING_AXE = 'throwing_axe',
  CHINCHOMPA = 'chinchompa',
}

export interface Ammunition {
  itemId: number
  type: AmmunitionType
  rangedStrength: number
  specialEffect?: string
}

export class RangedSystem extends System {
  private rangedWeapons: Map<number, RangedWeapon> = new Map()
  private ammunition: Map<number, Ammunition> = new Map()
  private autoRetrieveAmmo: Map<string, boolean> = new Map() // Player preferences

  constructor(world: World) {
    super(world)
    this.registerDefaultWeapons()
    this.registerDefaultAmmunition()
  }

  /**
   * Register default ranged weapons
   */
  private registerDefaultWeapons(): void {
    // Bows
    this.registerWeapon({
      itemId: 841, // Shortbow
      weaponType: WeaponType.BOW,
      attackSpeed: 3,
      rangedStrength: 0,
      attackRange: 7,
      ammunitionType: AmmunitionType.ARROW,
    })

    this.registerWeapon({
      itemId: 843, // Oak shortbow
      weaponType: WeaponType.BOW,
      attackSpeed: 3,
      rangedStrength: 0,
      attackRange: 7,
      ammunitionType: AmmunitionType.ARROW,
    })

    this.registerWeapon({
      itemId: 849, // Willow shortbow
      weaponType: WeaponType.BOW,
      attackSpeed: 3,
      rangedStrength: 0,
      attackRange: 7,
      ammunitionType: AmmunitionType.ARROW,
    })

    this.registerWeapon({
      itemId: 853, // Maple shortbow
      weaponType: WeaponType.BOW,
      attackSpeed: 3,
      rangedStrength: 0,
      attackRange: 7,
      ammunitionType: AmmunitionType.ARROW,
    })

    this.registerWeapon({
      itemId: 857, // Yew shortbow
      weaponType: WeaponType.BOW,
      attackSpeed: 3,
      rangedStrength: 0,
      attackRange: 7,
      ammunitionType: AmmunitionType.ARROW,
    })

    this.registerWeapon({
      itemId: 861, // Magic shortbow
      weaponType: WeaponType.BOW,
      attackSpeed: 3,
      rangedStrength: 0,
      attackRange: 7,
      ammunitionType: AmmunitionType.ARROW,
    })

    // Crossbows
    this.registerWeapon({
      itemId: 837, // Bronze crossbow
      weaponType: WeaponType.CROSSBOW,
      attackSpeed: 6,
      rangedStrength: 0,
      attackRange: 8,
      ammunitionType: AmmunitionType.BOLT,
    })

    this.registerWeapon({
      itemId: 9185, // Rune crossbow
      weaponType: WeaponType.CROSSBOW,
      attackSpeed: 6,
      rangedStrength: 0,
      attackRange: 8,
      ammunitionType: AmmunitionType.BOLT,
    })

    // Throwing weapons
    this.registerWeapon({
      itemId: 806, // Bronze dart
      weaponType: WeaponType.DART,
      attackSpeed: 3,
      rangedStrength: 1,
      attackRange: 3,
      ammunitionType: AmmunitionType.DART,
    })

    this.registerWeapon({
      itemId: 863, // Bronze knife
      weaponType: WeaponType.KNIFE,
      attackSpeed: 3,
      rangedStrength: 3,
      attackRange: 4,
      ammunitionType: AmmunitionType.KNIFE,
    })
  }

  /**
   * Register default ammunition
   */
  private registerDefaultAmmunition(): void {
    // Arrows
    this.registerAmmunition({
      itemId: 882, // Bronze arrow
      type: AmmunitionType.ARROW,
      rangedStrength: 7,
    })

    this.registerAmmunition({
      itemId: 884, // Iron arrow
      type: AmmunitionType.ARROW,
      rangedStrength: 10,
    })

    this.registerAmmunition({
      itemId: 886, // Steel arrow
      type: AmmunitionType.ARROW,
      rangedStrength: 16,
    })

    this.registerAmmunition({
      itemId: 888, // Mithril arrow
      type: AmmunitionType.ARROW,
      rangedStrength: 22,
    })

    this.registerAmmunition({
      itemId: 890, // Adamant arrow
      type: AmmunitionType.ARROW,
      rangedStrength: 31,
    })

    this.registerAmmunition({
      itemId: 892, // Rune arrow
      type: AmmunitionType.ARROW,
      rangedStrength: 49,
    })

    // Bolts
    this.registerAmmunition({
      itemId: 877, // Bronze bolts
      type: AmmunitionType.BOLT,
      rangedStrength: 10,
    })

    this.registerAmmunition({
      itemId: 9144, // Runite bolts
      type: AmmunitionType.BOLT,
      rangedStrength: 115,
    })
  }

  /**
   * Register a ranged weapon
   */
  public registerWeapon(weapon: RangedWeapon): void {
    this.rangedWeapons.set(weapon.itemId, weapon)
  }

  /**
   * Register ammunition
   */
  public registerAmmunition(ammo: Ammunition): void {
    this.ammunition.set(ammo.itemId, ammo)
  }

  /**
   * Perform ranged attack
   */
  public performRangedAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.world.entities.get(attackerId)
    const target = this.world.entities.get(targetId)

    if (!attacker || !target) {
      return false
    }

    const inventory = attacker.getComponent('inventory') as any
    if (!inventory) {
      return false
    }

    // Check if attacker has ranged weapon equipped
    const weapon = inventory.equipment[EquipmentSlot.WEAPON]
    if (!weapon) {
      this.sendMessage(attackerId, 'You need a ranged weapon to attack.')
      return false
    }

    const rangedWeapon = this.rangedWeapons.get(weapon.id)
    if (!rangedWeapon) {
      this.sendMessage(attackerId, 'You need a ranged weapon to attack.')
      return false
    }

    // Check ammunition
    const ammo = this.getEquippedAmmunition(inventory, rangedWeapon.ammunitionType)
    if (!ammo && rangedWeapon.ammunitionType !== AmmunitionType.CHINCHOMPA) {
      this.sendMessage(attackerId, 'You have run out of ammunition.')
      return false
    }

    // Check range
    const distance = this.getDistance(attacker as RPGEntity, target as RPGEntity)
    if (distance > rangedWeapon.attackRange) {
      this.sendMessage(attackerId, 'Your target is too far away.')
      return false
    }

    // Consume ammunition
    if (ammo && rangedWeapon.ammunitionType !== AmmunitionType.CHINCHOMPA) {
      this.consumeAmmunition(attackerId, ammo.itemId)
    }

    // Calculate hit and damage
    const hit = this.calculateRangedHit(attacker as RPGEntity, target as RPGEntity, rangedWeapon, ammo)

    // Apply damage
    const combatSystem = this.world.getSystem<any>('combat')
    if (combatSystem) {
      combatSystem.applyDamage(target, hit)
    }

    // Drop ammunition on ground (with chance)
    if (ammo && this.shouldDropAmmunition(ammo)) {
      this.dropAmmunition(target.position, ammo.itemId)
    }

    // Grant ranged experience
    this.grantRangedExperience(attackerId, hit)

    // Emit event
    this.world.events.emit('ranged:attack', {
      attackerId,
      targetId,
      weaponId: weapon.id,
      ammoId: ammo?.itemId,
      damage: hit.damage,
    })

    return true
  }

  /**
   * Calculate ranged hit
   */
  private calculateRangedHit(
    attacker: RPGEntity,
    target: RPGEntity,
    weapon: RangedWeapon,
    ammo: Ammunition | null
  ): HitResult {
    const attackerStats = attacker.getComponent('stats') as any
    const attackerCombat = attacker.getComponent('combat') as any
    const targetStats = target.getComponent('stats') as any

    if (!attackerStats || !attackerCombat || !targetStats) {
      return {
        damage: 0,
        type: 'miss',
        attackType: AttackType.RANGED,
        attackerId: attacker.id,
        targetId: target.id,
        timestamp: Date.now(),
      }
    }

    // Calculate accuracy
    const rangedLevel = attackerStats.ranged.level
    const rangedBonus = attackerStats.combatBonuses.attackRanged

    let effectiveLevel = rangedLevel

    // Apply combat style bonuses
    switch (attackerCombat.combatStyle) {
      case CombatStyle.ACCURATE:
        effectiveLevel += 3
        break
      case CombatStyle.RAPID:
        // No accuracy bonus, but faster attack speed
        break
      case CombatStyle.LONGRANGE:
        effectiveLevel += 1
        break
    }

    effectiveLevel += 8 // Stance bonus

    const attackRoll = effectiveLevel * (rangedBonus + 64)

    // Target defense roll
    const defenseLevel = targetStats.defense.level
    const defenseBonus = targetStats.combatBonuses.defenseRanged
    const defenseRoll = (defenseLevel + 8) * (defenseBonus + 64)

    // Check if hit lands
    const hitChance =
      attackRoll > defenseRoll ? 1 - (defenseRoll + 2) / (2 * (attackRoll + 1)) : attackRoll / (2 * (defenseRoll + 1))

    const isHit = Math.random() < hitChance

    if (!isHit) {
      return {
        damage: 0,
        type: 'miss',
        attackType: AttackType.RANGED,
        attackerId: attacker.id,
        targetId: target.id,
        timestamp: Date.now(),
      }
    }

    // Calculate damage
    const maxHit = this.calculateMaxRangedHit(attackerStats, attackerCombat, weapon, ammo)
    const damage = Math.floor(Math.random() * (maxHit + 1))

    return {
      damage,
      type: 'normal',
      attackType: AttackType.RANGED,
      attackerId: attacker.id,
      targetId: target.id,
      timestamp: Date.now(),
    }
  }

  /**
   * Calculate max ranged hit
   */
  private calculateMaxRangedHit(
    stats: StatsComponent,
    combat: CombatComponent,
    weapon: RangedWeapon,
    ammo: Ammunition | null
  ): number {
    const rangedLevel = stats.ranged.level
    let rangedStrength = stats.combatBonuses.rangedStrength

    // Add weapon and ammo ranged strength
    rangedStrength += weapon.rangedStrength
    if (ammo) {
      rangedStrength += ammo.rangedStrength
    }

    let effectiveStrength = rangedLevel

    // Apply combat style bonuses
    if (combat.combatStyle === CombatStyle.ACCURATE) {
      effectiveStrength += 3
    }

    effectiveStrength += 8 // Stance bonus

    // Calculate max hit
    const maxHit = 0.5 + (effectiveStrength * (rangedStrength + 64)) / 640

    // Apply prayer bonuses (if any)
    // maxHit *= prayerBonus;

    return Math.floor(maxHit)
  }

  /**
   * Get equipped ammunition
   */
  private getEquippedAmmunition(inventory: InventoryComponent, requiredType: AmmunitionType): Ammunition | null {
    const equippedAmmo = inventory.equipment[EquipmentSlot.AMMO]
    if (!equippedAmmo) {
      return null
    }

    const ammo = this.ammunition.get(equippedAmmo.id)
    if (!ammo || ammo.type !== requiredType) {
      return null
    }

    return ammo
  }

  /**
   * Consume ammunition
   */
  private consumeAmmunition(entityId: string, _ammoId: number): void {
    const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem')
    if (!inventorySystem) {
      return
    }

    // Remove 1 ammo from equipment slot
    const entity = this.world.entities.get(entityId)
    if (!entity) {
      return
    }

    const inventory = entity.getComponent('inventory') as any
    if (!inventory) {
      return
    }

    const ammoStack = inventory.equipment[EquipmentSlot.AMMO]
    if (ammoStack && ammoStack.metadata?.quantity) {
      ammoStack.metadata.quantity--
      if (ammoStack.metadata.quantity <= 0) {
        // Unequip if out of ammo
        ;(inventorySystem as any).unequip(entityId, EquipmentSlot.AMMO)
      }
    }
  }

  /**
   * Should drop ammunition (based on chance)
   */
  private shouldDropAmmunition(ammo: Ammunition): boolean {
    // Higher tier ammo has higher chance to break
    // Bronze: 80% recovery, Rune: 20% recovery
    const breakChance = ammo.rangedStrength / 100 // Simple formula
    return Math.random() > breakChance
  }

  /**
   * Drop ammunition on ground
   */
  private dropAmmunition(position: Vector3, ammoId: number): void {
    this.world.events.emit('item:drop', {
      itemId: ammoId,
      quantity: 1,
      position,
      source: 'ranged_combat',
    })
  }

  /**
   * Grant ranged experience
   */
  private grantRangedExperience(entityId: string, hit: HitResult): void {
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'SkillsSystem')
    if (!skillsSystem) {
      return
    }

    // 4 XP per damage in ranged
    const rangedXP = hit.damage * 4

    // Also grant HP experience
    const hpXP = hit.damage * 1.33

    ;(skillsSystem as any).grantXP(entityId, 'ranged', rangedXP)
    ;(skillsSystem as any).grantXP(entityId, 'hitpoints', hpXP)
  }

  /**
   * Toggle auto-retrieve ammunition
   */
  public toggleAutoRetrieve(entityId: string): void {
    const current = this.autoRetrieveAmmo.get(entityId) || false
    this.autoRetrieveAmmo.set(entityId, !current)

    this.sendMessage(entityId, `Auto-retrieve ammunition: ${!current ? 'ON' : 'OFF'}`)
  }

  /**
   * Check if weapon is ranged
   */
  public isRangedWeapon(itemId: number): boolean {
    return this.rangedWeapons.has(itemId)
  }

  /**
   * Get ranged weapon data
   */
  public getRangedWeapon(itemId: number): RangedWeapon | undefined {
    return this.rangedWeapons.get(itemId)
  }

  /**
   * Get ammunition data
   */
  public getAmmunition(itemId: number): Ammunition | undefined {
    return this.ammunition.get(itemId)
  }

  /**
   * Helper methods
   */
  private getDistance(entity1: RPGEntity, entity2: RPGEntity): number {
    const pos1 = entity1.position
    const pos2 = entity2.position

    const dx = pos1.x - pos2.x
    const dz = pos1.z - pos2.z

    return Math.sqrt(dx * dx + dz * dz)
  }

  private sendMessage(entityId: string, message: string): void {
    this.world.events.emit('chat:system', {
      targetId: entityId,
      message,
    })
  }
}
