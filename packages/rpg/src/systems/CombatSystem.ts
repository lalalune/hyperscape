import { 
  RPGCombatSystem, 
  PlayerState, 
  MobInstance, 
  CombatResult, 
  CombatSession, 
  CombatStyle,
  RPGSkill,
  GAME_CONSTANTS,
  ItemBonuses,
  RPGEventEmitter,
  CombatStartEvent,
  CombatHitEvent
} from '../types/index.js'

export class RPGCombatSystemImpl implements RPGCombatSystem {
  public name = 'CombatSystem'
  public initialized = false

  private combatSessions: Map<string, CombatSession> = new Map()
  private players: Map<string, PlayerState> = new Map()
  private mobs: Map<string, MobInstance> = new Map()
  private eventEmitter: RPGEventEmitter | null = null

  constructor(eventEmitter?: RPGEventEmitter) {
    this.eventEmitter = eventEmitter || null
  }

  async init(): Promise<void> {
    console.log('[CombatSystem] Initializing combat system...')
    
    // Start combat tick loop
    setInterval(() => {
      this.processCombatTick()
    }, GAME_CONSTANTS.COMBAT_TICK_RATE)
    
    this.initialized = true
    console.log('[CombatSystem] Combat system initialized')
  }

  async update(deltaTime: number): Promise<void> {
    // Combat system updates are handled by the tick loop
    // This method is called by the main game loop for any per-frame updates
  }

  async cleanup(): Promise<void> {
    console.log('[CombatSystem] Cleaning up combat system...')
    this.combatSessions.clear()
    this.players.clear()
    this.mobs.clear()
    this.initialized = false
  }

  // ===== PUBLIC API =====
  
  async startCombat(attackerId: string, targetId: string): Promise<boolean> {
    // Check if attacker exists
    const attacker = this.players.get(attackerId) || this.mobs.get(attackerId)
    if (!attacker) {
      console.log(`[CombatSystem] Attacker ${attackerId} not found`)
      return false
    }

    // Check if target exists
    const target = this.players.get(targetId) || this.mobs.get(targetId)
    if (!target) {
      console.log(`[CombatSystem] Target ${targetId} not found`)
      return false
    }

    // Check if attacker is already in combat
    if (this.combatSessions.has(attackerId)) {
      console.log(`[CombatSystem] Attacker ${attackerId} already in combat`)
      return false
    }

    // Check distance (must be within interaction range)
    const distance = this.calculateDistance(attacker.position, target.position)
    if (distance > GAME_CONSTANTS.INTERACTION_RANGE) {
      console.log(`[CombatSystem] Attacker ${attackerId} too far from target ${targetId}`)
      return false
    }

    // Create combat session
    const session: CombatSession = {
      attackerId,
      targetId,
      startTime: Date.now(),
      lastAttackTime: 0,
      style: CombatStyle.ACCURATE, // Default style
      active: true
    }

    this.combatSessions.set(attackerId, session)

    // Mark entities as in combat
    if ('inCombat' in attacker) {
      attacker.inCombat = true
      attacker.combatTarget = targetId
    }
    if ('inCombat' in target) {
      target.inCombat = true
      target.combatTarget = attackerId
    }

    // Emit combat start event
    if (this.eventEmitter) {
      await this.eventEmitter.emit({
        type: 'combat:start',
        timestamp: Date.now(),
        data: { attackerId, targetId, sessionId: attackerId }
      } as CombatStartEvent)
    }

    console.log(`[CombatSystem] Combat started: ${attackerId} vs ${targetId}`)
    return true
  }

  async endCombat(sessionId: string): Promise<void> {
    const session = this.combatSessions.get(sessionId)
    if (!session) return

    // Mark entities as no longer in combat
    const attacker = this.players.get(session.attackerId) || this.mobs.get(session.attackerId)
    const target = this.players.get(session.targetId) || this.mobs.get(session.targetId)

    if (attacker && 'inCombat' in attacker) {
      attacker.inCombat = false
      attacker.combatTarget = null
    }
    if (target && 'inCombat' in target) {
      target.inCombat = false
      target.combatTarget = null
    }

    this.combatSessions.delete(sessionId)
    console.log(`[CombatSystem] Combat ended: ${sessionId}`)
  }

  async processCombatTick(): Promise<void> {
    const now = Date.now()

    for (const [sessionId, session] of this.combatSessions) {
      if (!session.active) continue

      // Check if enough time has passed since last attack
      if (now - session.lastAttackTime < GAME_CONSTANTS.COMBAT_TICK_RATE) {
        continue
      }

      const attacker = this.players.get(session.attackerId) || this.mobs.get(session.attackerId)
      const target = this.players.get(session.targetId) || this.mobs.get(session.targetId)

      if (!attacker || !target) {
        await this.endCombat(sessionId)
        continue
      }

      // Check if target is dead
      if (target.health.current <= 0) {
        await this.endCombat(sessionId)
        continue
      }

      // Check distance - end combat if too far
      const distance = this.calculateDistance(attacker.position, target.position)
      if (distance > GAME_CONSTANTS.INTERACTION_RANGE + 2) {
        await this.endCombat(sessionId)
        continue
      }

      // Perform attack
      await this.performAttack(attacker, target, session)
      session.lastAttackTime = now
    }
  }

  async calculateDamage(
    attacker: PlayerState | MobInstance, 
    target: PlayerState | MobInstance
  ): Promise<CombatResult> {
    // Get attacker's combat stats
    const attackerStats = this.getCombatStats(attacker)
    const targetStats = this.getCombatStats(target)

    // Get equipment bonuses (only for players)
    const attackBonus = this.getAttackBonus(attacker)
    const strengthBonus = this.getStrengthBonus(attacker)
    const defenseBonus = this.getDefenseBonus(target)

    // Calculate effective levels
    const effectiveAttack = attackerStats.attack + attackBonus + 8
    const effectiveStrength = attackerStats.strength + strengthBonus + 8
    const effectiveDefense = targetStats.defense + defenseBonus + 8

    // Calculate max hit
    const maxHit = Math.floor(0.5 + effectiveStrength * 0.325 + effectiveStrength / 10)

    // Calculate accuracy
    const attackRoll = Math.floor(Math.random() * (effectiveAttack * 2))
    const defenseRoll = Math.floor(Math.random() * (effectiveDefense * 2))

    const hit = attackRoll > defenseRoll
    let damage = 0
    let critical = false

    if (hit) {
      damage = Math.floor(Math.random() * (maxHit + 1))
      
      // Critical hit chance (5%)
      if (Math.random() < 0.05) {
        damage = Math.floor(damage * 1.2)
        critical = true
      }
    }

    // Apply damage
    if (hit && damage > 0) {
      target.health.current = Math.max(0, target.health.current - damage)
    }

    // Calculate experience gained
    const experienceGained: { [skill in RPGSkill]?: number } = {}
    if (hit && damage > 0) {
      const baseXP = damage * 4 // RuneScape style XP
      
      // XP distribution based on combat style (for players)
      if ('skills' in attacker) {
        const session = this.combatSessions.get(attacker.id)
        const style = session?.style || CombatStyle.ACCURATE

        switch (style) {
          case CombatStyle.ACCURATE:
            experienceGained[RPGSkill.ATTACK] = baseXP
            break
          case CombatStyle.AGGRESSIVE:
            experienceGained[RPGSkill.STRENGTH] = baseXP
            break
          case CombatStyle.DEFENSIVE:
            experienceGained[RPGSkill.DEFENSE] = baseXP
            break
          case CombatStyle.CONTROLLED:
            const splitXP = Math.floor(baseXP / 3)
            experienceGained[RPGSkill.ATTACK] = splitXP
            experienceGained[RPGSkill.STRENGTH] = splitXP
            experienceGained[RPGSkill.DEFENSE] = splitXP
            break
        }

        // Always grant constitution XP
        experienceGained[RPGSkill.CONSTITUTION] = Math.floor(baseXP / 3)
      }
    }

    return {
      damage,
      hit,
      critical,
      experienceGained
    }
  }

  applyCombatStyle(style: CombatStyle): { attack: number, strength: number, defense: number } {
    switch (style) {
      case CombatStyle.ACCURATE:
        return { attack: 3, strength: 0, defense: 0 }
      case CombatStyle.AGGRESSIVE:
        return { attack: 0, strength: 3, defense: 0 }
      case CombatStyle.DEFENSIVE:
        return { attack: 0, strength: 0, defense: 3 }
      case CombatStyle.CONTROLLED:
        return { attack: 1, strength: 1, defense: 1 }
      default:
        return { attack: 0, strength: 0, defense: 0 }
    }
  }

  // ===== UTILITY METHODS =====

  public registerPlayer(player: PlayerState): void {
    this.players.set(player.id, player)
  }

  public unregisterPlayer(playerId: string): void {
    this.players.delete(playerId)
    
    // End any combat sessions this player was in
    for (const [sessionId, session] of this.combatSessions) {
      if (session.attackerId === playerId || session.targetId === playerId) {
        this.endCombat(sessionId)
      }
    }
  }

  public registerMob(mob: MobInstance): void {
    this.mobs.set(mob.id, mob)
  }

  public unregisterMob(mobId: string): void {
    this.mobs.delete(mobId)
    
    // End any combat sessions this mob was in
    for (const [sessionId, session] of this.combatSessions) {
      if (session.attackerId === mobId || session.targetId === mobId) {
        this.endCombat(sessionId)
      }
    }
  }

  public setCombatStyle(playerId: string, style: CombatStyle): boolean {
    const session = this.combatSessions.get(playerId)
    if (session) {
      session.style = style
      return true
    }
    return false
  }

  public isInCombat(entityId: string): boolean {
    return this.combatSessions.has(entityId)
  }

  public getCombatSession(entityId: string): CombatSession | null {
    return this.combatSessions.get(entityId) || null
  }

  // ===== PRIVATE METHODS =====

  private async performAttack(
    attacker: PlayerState | MobInstance, 
    target: PlayerState | MobInstance, 
    session: CombatSession
  ): Promise<void> {
    const result = await this.calculateDamage(attacker, target)

    // Emit combat hit event
    if (this.eventEmitter) {
      await this.eventEmitter.emit({
        type: 'combat:hit',
        timestamp: Date.now(),
        data: {
          attackerId: attacker.id,
          targetId: target.id,
          damage: result.damage,
          experienceGained: result.experienceGained
        }
      } as CombatHitEvent)
    }

    console.log(`[CombatSystem] ${attacker.id} ${result.hit ? 'hit' : 'missed'} ${target.id} for ${result.damage} damage${result.critical ? ' (CRITICAL!)' : ''}`)

    // Apply experience to attacker (if player)
    if ('skills' in attacker && result.experienceGained) {
      for (const [skill, xp] of Object.entries(result.experienceGained)) {
        if (xp && xp > 0) {
          attacker.skills[skill as RPGSkill].experience += xp
          console.log(`[CombatSystem] ${attacker.id} gained ${xp} ${skill} XP`)
        }
      }
    }

    // Check if target died
    if (target.health.current <= 0) {
      console.log(`[CombatSystem] ${target.id} has been defeated!`)
      await this.handleDeath(target, attacker)
      await this.endCombat(session.attackerId)
    }
  }

  private async handleDeath(deceased: PlayerState | MobInstance, killer?: PlayerState | MobInstance): Promise<void> {
    console.log(`[CombatSystem] Handling death of ${deceased.id}`)
    
    if ('skills' in deceased) {
      // Player death
      console.log(`[CombatSystem] Player ${deceased.id} died`)
      // TODO: Handle player death (drop items, set respawn location, etc.)
    } else {
      // Mob death  
      console.log(`[CombatSystem] Mob ${deceased.id} died`)
      deceased.state = 'dead'
      deceased.respawnTime = Date.now() + deceased.definition.respawnTime
      
      // TODO: Drop loot, grant additional XP, etc.
    }
  }

  private getCombatStats(entity: PlayerState | MobInstance): {
    attack: number
    strength: number
    defense: number
    range: number
    constitution: number
  } {
    if ('skills' in entity) {
      // Player
      return {
        attack: entity.skills.attack.level,
        strength: entity.skills.strength.level,
        defense: entity.skills.defense.level,
        range: entity.skills.range.level,
        constitution: entity.skills.constitution.level
      }
    } else {
      // Mob
      return entity.definition.combat
    }
  }

  private getAttackBonus(entity: PlayerState | MobInstance): number {
    if ('equipment' in entity && entity.equipment.weapon) {
      const weapon = entity.equipment.weapon.item
      return weapon.bonuses?.attack || 0
    }
    return 0
  }

  private getStrengthBonus(entity: PlayerState | MobInstance): number {
    if ('equipment' in entity && entity.equipment.weapon) {
      const weapon = entity.equipment.weapon.item
      return weapon.bonuses?.strength || 0
    }
    return 0
  }

  private getDefenseBonus(entity: PlayerState | MobInstance): number {
    if ('equipment' in entity) {
      let totalDefense = 0
      
      // Add up all equipment defense bonuses
      for (const slot of Object.values(entity.equipment)) {
        if (slot && slot.item.bonuses?.defense) {
          totalDefense += slot.item.bonuses.defense
        }
      }
      
      return totalDefense
    }
    return 0
  }

  private calculateDistance(pos1: { x: number, z: number }, pos2: { x: number, z: number }): number {
    const dx = pos1.x - pos2.x
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dz * dz)
  }
}