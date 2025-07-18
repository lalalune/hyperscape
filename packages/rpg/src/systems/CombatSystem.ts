import { System, World } from "../types/hyperfy"
import {
  CombatSession,
  HitResult,
  CombatComponent,
  StatsComponent,
  CombatStyle,
  AttackType,
  RPGEntity,
  Vector3,
  HitSplat,
  Equipment,
  EquipmentSlot,
  WeaponType,
  InventoryComponent,
  MovementComponent,
} from '../types/index'
import { HitCalculator } from './combat/HitCalculator'
import { DamageCalculator } from './combat/DamageCalculator'
import { CombatAnimationManager } from './combat/CombatAnimationManager'

export class CombatSystem extends System {
  name = 'CombatSystem'
  enabled = true

  // Core components
  private combatSessions: Map<string, CombatSession> = new Map()
  private hitCalculator: HitCalculator
  private damageCalculator: DamageCalculator
  private combatAnimations: CombatAnimationManager

  // Configuration
  private readonly COMBAT_TICK_RATE = 600 // milliseconds
  private readonly COMBAT_TIMEOUT = 10000 // 10 seconds
  private readonly MAX_ATTACK_RANGE = 1 // tiles

  private lastTickTime = 0

  constructor(world: World) {
    super(world)
    this.hitCalculator = new HitCalculator()
    this.damageCalculator = new DamageCalculator()
    this.combatAnimations = new CombatAnimationManager(world)
  }

  /**
   * Initialize the combat system
   */
  override async init(_options: any): Promise<void> {
    console.log('[CombatSystem] Initializing...')

    // Listen for combat-related events
    this.world.events.on('rpg:attack', (event: any) => {
      this.handleAttackEvent(event)
    })

    this.world.events.on('rpg:stop_combat', (event: any) => {
      this.endCombat(event.entityId)
    })

    this.world.events.on('rpg:special_attack', (event: any) => {
      this.handleSpecialAttackEvent(event)
    })

    // Listen for entity death to clean up combat sessions
    this.world.events.on('entity:death', (event: any) => {
      this.handleEntityDeath(event.entityId)
    })

    // Listen for entity destruction to clean up combat sessions
    this.world.events.on('entity:destroyed', (event: any) => {
      this.handleEntityDeath(event.entityId)
    })
  }

  /**
   * Fixed update for combat ticks
   */
  override fixedUpdate(_delta: number): void {
    const now = Date.now()

    // Process combat ticks at fixed intervals
    if (now - this.lastTickTime >= this.COMBAT_TICK_RATE) {
      this.processCombatTick()
      this.lastTickTime = now
    }
  }

  /**
   * Main update for visual effects
   */
  override update(_delta: number): void {
    // Update hit splats
    this.updateHitSplats(_delta)

    // Update combat animations
    this.combatAnimations.update(_delta)

    // Check combat timeouts
    this.checkCombatTimeouts()
  }

  /**
   * Initiate an attack
   */
  initiateAttack(attackerId: string, targetId: string): boolean {
    const attacker = this.getEntity(attackerId)
    const target = this.getEntity(targetId)

    if (!attacker || !target) {
      return false
    }

    if (!this.canAttack(attacker, target)) {
      return false
    }

    // Get or create combat session
    let session = this.combatSessions.get(attackerId)
    if (!session) {
      session = this.createCombatSession(attackerId, targetId)
      this.combatSessions.set(attackerId, session)
    }

    // Update combat components
    const attackerCombat = attacker.getComponent('combat') as any
    if (attackerCombat) {
      attackerCombat.inCombat = true
      attackerCombat.target = targetId
    }

    // Set target to retaliate if auto-retaliate is on
    const targetCombat = target.getComponent('combat') as any
    if (targetCombat && targetCombat.autoRetaliate && !targetCombat.inCombat) {
      this.initiateAttack(targetId, attackerId)
    }

    // Emit combat start event
    this.world.events.emit('combat:start', { session })

    return true
  }

  /**
   * Process combat tick for all active sessions
   */
  private processCombatTick(): void {
    const now = Date.now()

    for (const [entityId, session] of Array.from(this.combatSessions)) {
      const attacker = this.getEntity(session.attackerId)
      const target = this.getEntity(session.targetId)

      if (!attacker || !target) {
        this.endCombat(entityId)
        continue
      }

      const combat = attacker.getComponent('combat') as any
      if (!combat || !combat.inCombat) {
        continue
      }

      // Check if it's time to attack
      if (now - combat.lastAttackTime >= this.getAttackSpeed(attacker, combat)) {
        this.performAttack(attacker, target, session)
        combat.lastAttackTime = now
      }
    }
  }

  /**
   * Perform an attack
   */
  private performAttack(attacker: RPGEntity, target: RPGEntity, session: CombatSession): void {
    const hit = this.calculateHit(attacker, target)

    // Add to session history
    session.hits.push(hit)
    session.lastAttackTime = Date.now()

    // Apply damage if hit
    if (hit.damage > 0) {
      this.applyDamage(target, hit.damage, attacker)
    }

    // Queue hit splat
    this.queueHitSplat(target, hit)

    // Play attack animation
    this.combatAnimations.playAttackAnimation(attacker, hit.attackType)

    // Emit hit event
    this.world.events.emit('combat:hit', { hit })
  }

  /**
   * Calculate hit result
   */
  calculateHit(attacker: RPGEntity, target: RPGEntity): HitResult {
    const attackerStats = attacker.getComponent('stats') as any
    const targetStats = target.getComponent('stats') as any
    const attackerCombat = attacker.getComponent('combat') as any

    if (!attackerStats || !targetStats || !attackerCombat) {
      return this.createMissResult(attacker.data.id, target.data.id)
    }

    // Determine attack type
    const attackType = this.getAttackType(attacker)

    // Calculate attack and defense rolls
    const attackRoll = this.hitCalculator.calculateAttackRoll(attackerStats, attackerCombat.combatStyle, attackType)

    const targetCombat = target.getComponent('combat') as any
    const defenseRoll = this.hitCalculator.calculateDefenseRoll(targetStats, attackType, targetCombat || undefined)

    // Calculate hit chance
    const hitChance = this.hitCalculator.calculateHitChance(attackRoll, defenseRoll)
    const hits = Math.random() < hitChance

    if (!hits) {
      return this.createMissResult(attacker.data.id, target.data.id, attackType)
    }

    // Calculate damage
    const maxHit = this.damageCalculator.calculateMaxHit(attackerStats, attackerCombat.combatStyle, attackType)

    const damage = this.damageCalculator.rollDamage(maxHit)

    // Apply damage reductions
    const finalDamage = this.damageCalculator.applyDamageReductions(damage, targetStats, attackType, attackerStats)

    return {
      damage: finalDamage,
      type: 'normal',
      attackType,
      attackerId: attacker.data.id,
      targetId: target.data.id,
      timestamp: Date.now(),
    }
  }

  /**
   * Apply damage to target
   */
  applyDamage(target: RPGEntity, damage: number, source: RPGEntity): void {
    const stats = target.getComponent('stats') as any
    if (!stats) {
      return
    }

    // Apply damage
    stats.hitpoints.current = Math.max(0, stats.hitpoints.current - damage)

    // Check for death
    if (stats.hitpoints.current <= 0) {
      this.handleDeath(target, source)
    }

    // Emit damage event
    this.world.events.emit('combat:damage', {
      targetId: target.data.id,
      damage,
      sourceId: source.data.id,
      remaining: stats.hitpoints.current,
    })
  }

  /**
   * Handle entity death from event system
   */
  private handleEntityDeath(entityId: string): void {
    // End all combat involving this entity
    this.endCombat(entityId)

    // Remove entity from other combat sessions where it's the target
    for (const [sessionId, session] of Array.from(this.combatSessions)) {
      if (session.targetId === entityId) {
        this.endCombat(sessionId)
      }
    }
  }

  /**
   * Handle entity death (internal combat death)
   */
  private handleDeath(entity: RPGEntity, killer: RPGEntity): void {
    // End all combat involving this entity
    this.endCombat(entity.data.id)

    // Remove entity from other combat sessions
    for (const [sessionId, session] of Array.from(this.combatSessions)) {
      if (session.targetId === entity.data.id) {
        this.endCombat(sessionId)
      }
    }

    // Emit death event
    this.world.events.emit('entity:death', {
      entityId: entity.data.id,
      killerId: killer.data.id,
    })
  }

  /**
   * End combat for an entity
   */
  endCombat(entityId: string): void {
    const session = this.combatSessions.get(entityId)
    if (!session) {
      return
    }

    // Update combat component
    const entity = this.getEntity(entityId)
    if (entity) {
      const combat = entity.getComponent('combat') as any
      if (combat) {
        combat.inCombat = false
        combat.target = null
      }
    }

    // Remove session
    this.combatSessions.delete(entityId)

    // Emit end event
    this.world.events.emit('combat:end', { session })
  }

  /**
   * Check if attacker can attack target
   */
  private canAttack(attacker: RPGEntity | undefined, target: RPGEntity | undefined): boolean {
    if (!attacker || !target) {
      return false
    }

    // Check if entities are alive
    const attackerStats = attacker.getComponent('stats') as any
    const targetStats = target.getComponent('stats') as any

    if (!attackerStats || !targetStats) {
      return false
    }

    if (!attackerStats.hitpoints || !targetStats.hitpoints) {
      return false
    }

    if (attackerStats.hitpoints.current <= 0 || targetStats.hitpoints.current <= 0) {
      return false
    }

    // Check range
    const distance = this.getDistance(attacker, target)
    const attackRange = this.getAttackRange(attacker)

    if (distance > attackRange) {
      return false
    }

    // Check if in safe zone
    if (this.isInSafeZone(attacker) || this.isInSafeZone(target)) {
      this.world.events.emit('combat:denied', {
        reason: 'safe_zone',
        attackerId: attacker.data.id,
        targetId: target.data.id,
      })
      return false
    }

    // Check if target is attackable in wilderness
    if (this.isInWilderness(attacker) && this.isInWilderness(target)) {
      const attackerWildLevel = this.getWildernessLevel(attacker)
      const targetWildLevel = this.getWildernessLevel(target)
      const combatLevelDiff = Math.abs(attackerStats.combatLevel - targetStats.combatLevel)

      // Wilderness level restriction
      const maxLevelDiff = Math.min(attackerWildLevel, targetWildLevel)
      if (combatLevelDiff > maxLevelDiff) {
        this.world.events.emit('combat:denied', {
          reason: 'wilderness_level',
          attackerId: attacker.data.id,
          targetId: target.data.id,
        })
        return false
      }
    }

    // Check multi-combat area
    const inMulti = this.isInMultiCombat(attacker)
    if (!inMulti) {
      // Single combat - check if either is already in combat with someone else
      const attackerSession = this.combatSessions.get(attacker.data.id)
      const targetSession = this.getTargetSession(target.data.id)

      if (attackerSession && attackerSession.targetId !== target.data.id) {
        return false
      }
      if (targetSession && targetSession.attackerId !== attacker.data.id) {
        return false
      }
    }

    return true
  }

  /**
   * Check if entity is in a safe zone
   */
  private isInSafeZone(entity: RPGEntity): boolean {
    const position = this.getEntityPosition(entity)
    if (!position) {
      return false
    }

    // Check configured safe zones
    const safeZones = (this.world as any).safeZones || [
      // Default safe zones
      { type: 'rectangle', min: { x: -50, y: -10, z: -50 }, max: { x: 50, y: 50, z: 50 } }, // Spawn area
      { type: 'circle', center: { x: 0, y: 0, z: 0 }, radius: 100 }, // Town center
    ]

    for (const zone of safeZones) {
      if (this.isPositionInZone(position, zone)) {
        return true
      }
    }

    // Check entity-specific safe zone flag
    const zoneComponent = entity.getComponent('zone')
    if ((zoneComponent as any)?.isSafe) {
      return true
    }

    return false
  }

  /**
   * Check if entity is in wilderness
   */
  private isInWilderness(entity: RPGEntity): boolean {
    const position = this.getEntityPosition(entity)
    if (!position) {
      return false
    }

    // Wilderness starts at y > 3520 in OSRS coordinates
    // Adjust for your world coordinates
    const wildernessStart = (this.world as any).wildernessStart || { x: -1000, y: 0, z: 1000 }
    return position.z > wildernessStart.z
  }

  /**
   * Get wilderness level for entity
   */
  private getWildernessLevel(entity: RPGEntity): number {
    const position = this.getEntityPosition(entity)
    if (!position || !this.isInWilderness(entity)) {
      return 0
    }

    const wildernessStart = (this.world as any).wildernessStart || { x: -1000, y: 0, z: 1000 }
    const level = Math.floor((position.z - wildernessStart.z) / 8) + 1
    return Math.min(Math.max(level, 1), 56) // Max wilderness level is 56
  }

  /**
   * Check if position is in multi-combat area
   */
  private isInMultiCombat(entity: RPGEntity): boolean {
    const position = this.getEntityPosition(entity)
    if (!position) {
      return false
    }

    // Check configured multi-combat zones
    const multiZones = (this.world as any).multiCombatZones || [
      // Default multi-combat zones
      { type: 'rectangle', min: { x: 100, y: -10, z: 100 }, max: { x: 200, y: 50, z: 200 } }, // Boss area
    ]

    for (const zone of multiZones) {
      if (this.isPositionInZone(position, zone)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if position is within a zone
   */
  private isPositionInZone(position: Vector3, zone: any): boolean {
    if (zone.type === 'rectangle') {
      return (
        position.x >= zone.min.x &&
        position.x <= zone.max.x &&
        position.y >= zone.min.y &&
        position.y <= zone.max.y &&
        position.z >= zone.min.z &&
        position.z <= zone.max.z
      )
    } else if (zone.type === 'circle') {
      const distance = Math.sqrt(
        Math.pow(position.x - zone.center.x, 2) +
        Math.pow(position.y - zone.center.y, 2) +
        Math.pow(position.z - zone.center.z, 2)
      )
      return distance <= zone.radius
    }
    return false
  }

  /**
   * Get session where entity is the target
   */
  private getTargetSession(targetId: string): CombatSession | null {
    for (const [_, session] of this.combatSessions) {
      if (session.targetId === targetId) {
        return session
      }
    }
    return null
  }

  /**
   * Create combat session
   */
  private createCombatSession(attackerId: string, targetId: string): CombatSession {
    return {
      id: `combat_${attackerId}_${Date.now()}`,
      attackerId,
      targetId,
      startTime: Date.now(),
      lastAttackTime: Date.now(),
      combatTimer: this.COMBAT_TIMEOUT,
      hits: [],
    }
  }

  /**
   * Create miss result
   */
  private createMissResult(attackerId: string, targetId: string, attackType: AttackType = AttackType.MELEE): HitResult {
    return {
      damage: 0,
      type: 'miss',
      attackType,
      attackerId,
      targetId,
      timestamp: Date.now(),
    }
  }

  /**
   * Queue hit splat for display
   */
  private queueHitSplat(target: RPGEntity, hit: HitResult): void {
    const combat = target.getComponent('combat') as any
    const movement = target.getComponent('movement') as any // MovementComponent

    if (!combat || !movement) {
      return
    }

    const hitSplat: HitSplat = {
      damage: hit.damage,
      type: hit.type === 'miss' ? 'miss' : 'normal',
      position: { ...movement.position },
      timestamp: Date.now(),
      duration: 1000,
    }

    combat.hitSplatQueue.push(hitSplat)
  }

  /**
   * Update hit splats
   */
  private updateHitSplats(_delta: number): void {
    const now = Date.now()

    // Update all entities with combat components
    for (const [_entityId, entity] of Array.from(this.world.entities.items)) {
      const rpgEntity = this.asRPGEntity(entity)
      if (!rpgEntity) {
        continue
      }

      const combat = rpgEntity.getComponent('combat') as any

      if (!combat) {
        continue
      }

      // Remove expired hit splats
      combat.hitSplatQueue = combat.hitSplatQueue.filter(splat => now - splat.timestamp < splat.duration)
    }
  }

  /**
   * Check for combat timeouts
   */
  private checkCombatTimeouts(): void {
    const now = Date.now()
    const toRemove: string[] = []

    for (const [entityId, session] of Array.from(this.combatSessions)) {
      if (now - session.lastAttackTime > this.COMBAT_TIMEOUT) {
        toRemove.push(entityId)
      }
    }

    toRemove.forEach(id => this.endCombat(id))
  }

  /**
   * Get attack speed in milliseconds
   */
  private getAttackSpeed(entity: RPGEntity, combat: CombatComponent): number {
    // Base attack speed (4 ticks = 2.4 seconds)
    let speed = combat.attackSpeed * this.COMBAT_TICK_RATE

    // Apply weapon speed modifiers
    const weapon = this.getEquippedWeapon(entity)
    if (weapon?.equipment?.attackSpeed) {
      speed = weapon.equipment.attackSpeed * this.COMBAT_TICK_RATE
    }

    // Apply combat style modifiers
    if (combat.combatStyle === CombatStyle.RAPID) {
      // Rapid style reduces attack interval by 1 tick
      speed = Math.max(this.COMBAT_TICK_RATE, speed - this.COMBAT_TICK_RATE)
    }

    // Apply haste effects (e.g., from prayers or potions)
    const effects = entity.getComponent('effects')
    if ((effects as any)?.haste) {
      speed *= 0.9 // 10% faster attacks
    }

    return speed
  }

  /**
   * Get attack type based on equipment
   */
  private getAttackType(entity: RPGEntity): AttackType {
    const weapon = this.getEquippedWeapon(entity)

    if (!weapon) {
      // Unarmed is melee
      return AttackType.MELEE
    }

    // Check weapon type
    const weaponType = weapon.equipment?.weaponType
    switch (weaponType) {
      case WeaponType.BOW:
      case WeaponType.CROSSBOW:
        return AttackType.RANGED
      case WeaponType.STAFF:
      case WeaponType.WAND:
        return AttackType.MAGIC
      default:
        return AttackType.MELEE
    }
  }

  /**
   * Get attack range based on weapon
   */
  private getAttackRange(entity: RPGEntity): number {
    const weapon = this.getEquippedWeapon(entity)

    if (!weapon) {
      // Unarmed melee range
      return this.MAX_ATTACK_RANGE
    }

    // Get weapon-specific range
    const weaponType = weapon.equipment?.weaponType
    switch (weaponType) {
      case WeaponType.HALBERD:
        return 2 // Halberds can attack 2 tiles away
      case WeaponType.BOW:
        return 7 // Shortbow range
      case WeaponType.CROSSBOW:
        return 8 // Crossbow range
      case WeaponType.STAFF:
      case WeaponType.WAND:
        return 10 // Magic range
      default:
        return this.MAX_ATTACK_RANGE // Standard melee
    }
  }

  /**
   * Get equipped weapon
   */
  private getEquippedWeapon(entity: RPGEntity): Equipment | null {
    const inventory = entity.getComponent('inventory') as any
    if (!inventory) {
      return null
    }

    return inventory.equipment[EquipmentSlot.WEAPON]
  }

  /**
   * Calculate distance between entities
   */
  private getDistance(entity1: RPGEntity, entity2: RPGEntity): number {
    const pos1 = this.getEntityPosition(entity1)
    const pos2 = this.getEntityPosition(entity2)

    if (!pos1 || !pos2) {
      return Infinity
    }

    // Use grid-based distance for tile-based combat
    const dx = Math.abs(pos1.x - pos2.x)
    const dy = Math.abs(pos1.y - pos2.y)
    const dz = Math.abs(pos1.z - pos2.z)

    // Chebyshev distance (king's move in chess) for tile-based games
    return Math.max(dx, dy, dz)
  }

  /**
   * Get entity position from movement component
   */
  private getEntityPosition(entity: RPGEntity): Vector3 | null {
    // Try movement component first
    const movement = entity.getComponent('movement') as any
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
   * Get entity from world and cast to RPGEntity
   */
  private getEntity(entityId: string): RPGEntity | undefined {
    // Check items map first
    let entity = this.world.entities.items?.get(entityId)

    // If not found, check players map (for tests)
    if (!entity && this.world.entities.players) {
      entity = this.world.entities.players.get(entityId)
    }

    if (!entity) {
      return undefined
    }

    // For now, assume all entities are RPGEntities
    // In a real implementation, we'd check if it has the required methods
    return this.asRPGEntity(entity)
  }

  /**
   * Safely cast entity to RPGEntity
   */
  private asRPGEntity(entity: any): RPGEntity | undefined {
    // Check if entity has required RPGEntity methods
    if (entity && typeof entity.getComponent === 'function') {
      return entity as RPGEntity
    }
    return undefined
  }

  /**
   * Check if entity is in combat
   */
  isInCombat(entityId: string): boolean {
    return this.combatSessions.has(entityId)
  }

  /**
   * Get combat session for entity
   */
  getCombatSession(entityId: string): CombatSession | null {
    return this.combatSessions.get(entityId) || null
  }

  /**
   * Force end combat (admin command)
   */
  forceEndCombat(entityId: string): void {
    this.endCombat(entityId)
  }

  /**
   * Get or create combat component for entity
   */
  getOrCreateCombatComponent(entityId: string): CombatComponent {
    const entity = this.getEntity(entityId)
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`)
    }

    let combat = entity.getComponent('combat')
    if (!combat) {
      // Create default combat component
      const defaultCombat: CombatComponent = {
        type: 'combat',
        entity: entity,
        data: {},
        entityId,
        inCombat: false,
        target: null,
        lastAttackTime: 0,
        attackSpeed: 4,
        combatStyle: CombatStyle.ACCURATE,
        autoRetaliate: true,
        hitSplatQueue: [],
        animationQueue: [],
        specialAttackEnergy: 100,
        specialAttackActive: false,
        protectionPrayers: {
          melee: false,
          ranged: false,
          magic: false,
        },
      }

      // Add component to entity
      const addedComponent = (entity as any).addComponent('combat', defaultCombat)
      combat = addedComponent
    }

    return combat as any
  }

  /**
   * Calculate maximum hit damage
   */
  calculateMaxHit(stats: StatsComponent, attackType: string, style: string): number {
    return this.damageCalculator.calculateMaxHit(
      stats,
      style as CombatStyle,
      attackType as AttackType
    )
  }

  /**
   * Calculate effective level with bonuses
   */
  calculateEffectiveLevel(baseLevel: number, prayerBonus: number, potionBonus: number, style: string): number {
    let styleBonus = 0

    switch (style) {
      case 'accurate':
      case 'aggressive':
      case 'defensive':
        styleBonus = 3
        break
      case 'controlled':
        styleBonus = 1
        break
    }

    return baseLevel + prayerBonus + potionBonus + styleBonus
  }

  /**
   * Grant combat XP based on damage and attack type
   */
  grantCombatXP(entityId: string, damage: number, attackType: string): void {
    const baseXp = damage * 4
    const hpXp = damage * 1.33
    const defenseXp = damage * 1.33

    switch (attackType) {
      case 'melee':
        // Melee grants attack, strength, and HP XP
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'attack',
          amount: baseXp,
          source: 'combat',
        })
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'strength',
          amount: baseXp,
          source: 'combat',
        })
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'hitpoints',
          amount: hpXp,
          source: 'combat',
        })
        break

      case 'ranged':
        // Ranged grants ranged, defense, and HP XP
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'ranged',
          amount: baseXp,
          source: 'combat',
        })
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'defence',
          amount: defenseXp,
          source: 'combat',
        })
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'hitpoints',
          amount: hpXp,
          source: 'combat',
        })
        break

      case 'magic':
        // Magic grants magic and HP XP
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'magic',
          amount: damage * 2,
          source: 'combat',
        })
        this.world.events.emit('rpg:xp_gain', {
          playerId: entityId,
          skill: 'hitpoints',
          amount: hpXp,
          source: 'combat',
        })
        break
    }
  }

  /**
   * Handle entity death with proper event emission
   */
  handleEntityDeathWithKiller(deadEntityId: string, killerId: string): void {
    this.world.events.emit('rpg:entity_death', {
      deadEntityId,
      killerId,
      timestamp: Date.now(),
    })

    // Also handle cleanup
    this.handleEntityDeath(deadEntityId)
  }

  /**
   * Regenerate special attack energy
   */
  regenerateSpecialAttack(): void {
    // For testing, always regenerate 10% special attack
    const allMaps = [this.world.entities.items, this.world.entities.players].filter(Boolean)

    for (const entityMap of allMaps) {
      for (const [entityId] of entityMap) {
        const entity = this.getEntity(entityId)
        if (!entity) continue

        const combat = entity.getComponent('combat') as any
        if (!combat) continue

        if (combat.specialAttackEnergy < 100) {
          combat.specialAttackEnergy = Math.min(100, combat.specialAttackEnergy + 10)
        }
      }
    }
  }

  /**
   * Handle attack event
   */
  private handleAttackEvent(event: any): void {
    const { attackerId, targetId } = event
    this.initiateAttack(attackerId, targetId)
  }

  /**
   * Handle special attack event
   */
  private handleSpecialAttackEvent(event: any): void {
    const { attackerId, targetId } = event
    this.performSpecialAttack(attackerId, targetId)
  }

  /**
   * Perform special attack
   */
  private performSpecialAttack(attackerId: string, targetId: string): void {
    const attacker = this.getEntity(attackerId)
    const target = this.getEntity(targetId)

    if (!attacker || !target) {
      return
    }

    const combat = attacker.getComponent('combat') as any
    if (!combat || combat.specialAttackEnergy < 25) {
      return // Not enough special attack energy
    }

    // Drain special attack energy
    combat.specialAttackEnergy -= 25

    // Perform enhanced attack
    const hit = this.calculateSpecialHit(attacker, target)

    // Apply damage if hit
    if (hit.damage > 0) {
      this.applyDamage(target, hit.damage, attacker)
    }

    // Queue hit splat
    this.queueHitSplat(target, hit)

    // Play special attack animation
    this.combatAnimations.playAttackAnimation(attacker, hit.attackType)

    // Emit special hit event
    this.world.events.emit('combat:special_hit', { hit })
  }

  /**
   * Calculate special attack hit
   */
  private calculateSpecialHit(attacker: RPGEntity, target: RPGEntity): HitResult {
    // Enhanced hit calculation for special attacks
    const hit = this.calculateHit(attacker, target)

    // Special attacks typically have higher accuracy and damage
    hit.damage = Math.floor(hit.damage * 1.2) // 20% damage boost
    hit.type = 'critical'

    return hit
  }
}
