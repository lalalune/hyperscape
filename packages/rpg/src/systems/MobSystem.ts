import {
  RPGMobSystem,
  MobInstance,
  MobDefinition,
  MobType,
  MobBehavior,
  WorldPosition,
  LootEntry,
  GAME_CONSTANTS,
  RPGEventEmitter,
  MobDeathEvent
} from '../types/index.js'

export class RPGMobSystemImpl implements RPGMobSystem {
  public name = 'MobSystem'
  public initialized = false

  private mobs: Map<string, MobInstance> = new Map()
  private mobDefinitions: Map<MobType, MobDefinition> = new Map()
  private nextMobId = 1
  private respawnQueue: Array<{ 
    definition: MobDefinition, 
    position: WorldPosition, 
    respawnTime: number 
  }> = []
  private eventEmitter: RPGEventEmitter | null = null

  constructor(eventEmitter?: RPGEventEmitter) {
    this.eventEmitter = eventEmitter || null
  }

  async init(): Promise<void> {
    console.log('[MobSystem] Initializing mob system...')
    this.initializeMobDefinitions()
    
    // Start respawn check loop
    setInterval(() => {
      this.processRespawnQueue()
    }, 5000) // Check every 5 seconds
    
    this.initialized = true
    console.log('[MobSystem] Mob system initialized with', this.mobDefinitions.size, 'mob types')
  }

  async update(deltaTime: number): Promise<void> {
    // Update all mob AI
    for (const [mobId, mob] of this.mobs) {
      await this.updateMobAI(mobId)
    }
  }

  async cleanup(): Promise<void> {
    console.log('[MobSystem] Cleaning up mob system...')
    this.mobs.clear()
    this.respawnQueue.length = 0
    this.initialized = false
  }

  // ===== PUBLIC API =====

  async spawnMob(definition: MobDefinition, position: WorldPosition): Promise<string> {
    const mobId = `mob_${this.nextMobId++}`
    
    const mob: MobInstance = {
      id: mobId,
      definition,
      currentHealth: definition.health,
      position: { ...position },
      spawnPosition: { ...position },
      state: 'idle',
      target: null,
      lastAttackTime: 0,
      respawnTime: null
    }

    this.mobs.set(mobId, mob)
    
    console.log(`[MobSystem] Spawned ${definition.name} (${mobId}) at (${position.x}, ${position.z})`)
    return mobId
  }

  async despawnMob(mobId: string): Promise<boolean> {
    const mob = this.mobs.get(mobId)
    if (!mob) {
      console.log(`[MobSystem] Mob ${mobId} not found for despawn`)
      return false
    }

    this.mobs.delete(mobId)
    console.log(`[MobSystem] Despawned ${mob.definition.name} (${mobId})`)
    return true
  }

  async updateMobAI(mobId: string): Promise<void> {
    const mob = this.mobs.get(mobId)
    if (!mob || mob.state === 'dead') return

    const now = Date.now()

    switch (mob.state) {
      case 'idle':
        await this.processIdleState(mob)
        break
      case 'aggressive':
        await this.processAggressiveState(mob, now)
        break
      case 'combat':
        await this.processCombatState(mob, now)
        break
      case 'returning':
        await this.processReturningState(mob)
        break
    }
  }

  async processMobCombat(mobId: string): Promise<void> {
    const mob = this.mobs.get(mobId)
    if (!mob || mob.state !== 'combat') return

    // This will be handled by the CombatSystem
    // MobSystem just manages state transitions
  }

  async handleMobDeath(mobId: string, killerId?: string): Promise<void> {
    const mob = this.mobs.get(mobId)
    if (!mob) return

    console.log(`[MobSystem] ${mob.definition.name} (${mobId}) died${killerId ? ` killed by ${killerId}` : ''}`)

    // Set mob as dead
    mob.state = 'dead'
    mob.currentHealth = 0
    mob.target = null

    // Schedule respawn
    const respawnTime = Date.now() + mob.definition.respawnTime
    mob.respawnTime = respawnTime
    
    this.respawnQueue.push({
      definition: mob.definition,
      position: mob.spawnPosition,
      respawnTime
    })

    // Remove mob from active list (it will respawn later)
    this.mobs.delete(mobId)

    // Drop loot
    await this.dropLoot(mob, killerId)

    // Emit death event
    if (this.eventEmitter) {
      await this.eventEmitter.emit({
        type: 'mob:death',
        timestamp: Date.now(),
        data: {
          mobId,
          killerId,
          loot: mob.definition.lootTable,
          experienceReward: mob.definition.experienceReward
        }
      } as MobDeathEvent)
    }
  }

  async respawnMobs(): Promise<void> {
    this.processRespawnQueue()
  }

  async getMob(mobId: string): Promise<MobInstance | null> {
    return this.mobs.get(mobId) || null
  }

  // ===== UTILITY METHODS =====

  public getAllMobs(): Map<string, MobInstance> {
    return new Map(this.mobs)
  }

  public getMobsByType(type: MobType): MobInstance[] {
    return Array.from(this.mobs.values()).filter(mob => mob.definition.type === type)
  }

  public getMobsInRange(center: WorldPosition, radius: number): MobInstance[] {
    return Array.from(this.mobs.values()).filter(mob => {
      const distance = this.calculateDistance(center, mob.position)
      return distance <= radius
    })
  }

  public getMobDefinition(type: MobType): MobDefinition | null {
    return this.mobDefinitions.get(type) || null
  }

  public spawnMobOfType(type: MobType, position: WorldPosition): Promise<string> {
    const definition = this.mobDefinitions.get(type)
    if (!definition) {
      throw new Error(`No definition found for mob type: ${type}`)
    }
    return this.spawnMob(definition, position)
  }

  // ===== PRIVATE METHODS =====

  private initializeMobDefinitions(): void {
    // Level 1 Mobs - Beginner
    this.mobDefinitions.set(MobType.GOBLIN, {
      id: 'goblin',
      name: 'Goblin',
      type: MobType.GOBLIN,
      level: 2,
      health: 25,
      combat: {
        attack: 1,
        strength: 1,
        defense: 1,
        range: 1,
        constitution: 3
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 8,
      respawnTime: 30000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 5) + 3, chance: 1.0 },
        { itemId: 'bronze_sword', quantity: 1, chance: 0.1 }
      ],
      experienceReward: 20,
      color: 'green'
    })

    this.mobDefinitions.set(MobType.BANDIT, {
      id: 'bandit',
      name: 'Bandit',
      type: MobType.BANDIT,
      level: 3,
      health: 35,
      combat: {
        attack: 2,
        strength: 2,
        defense: 1,
        range: 1,
        constitution: 4
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 6,
      respawnTime: 35000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 8) + 5, chance: 1.0 },
        { itemId: 'bronze_sword', quantity: 1, chance: 0.08 }
      ],
      experienceReward: 30,
      color: 'orange'
    })

    this.mobDefinitions.set(MobType.BARBARIAN, {
      id: 'barbarian',
      name: 'Barbarian',
      type: MobType.BARBARIAN,
      level: 4,
      health: 45,
      combat: {
        attack: 3,
        strength: 3,
        defense: 2,
        range: 1,
        constitution: 5
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 7,
      respawnTime: 40000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 12) + 8, chance: 1.0 },
        { itemId: 'bronze_sword', quantity: 1, chance: 0.10 }
      ],
      experienceReward: 40,
      color: 'brown'
    })

    // Level 2 Mobs - Intermediate
    this.mobDefinitions.set(MobType.HOBGOBLIN, {
      id: 'hobgoblin',
      name: 'Hobgoblin',
      type: MobType.HOBGOBLIN,
      level: 8,
      health: 70,
      combat: {
        attack: 6,
        strength: 6,
        defense: 5,
        range: 2,
        constitution: 8
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 10,
      respawnTime: 45000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 20) + 15, chance: 1.0 },
        { itemId: 'steel_sword', quantity: 1, chance: 0.15 },
        { itemId: 'bronze_shield', quantity: 1, chance: 0.10 }
      ],
      experienceReward: 80,
      color: 'darkgreen'
    })

    this.mobDefinitions.set(MobType.GUARD, {
      id: 'guard',
      name: 'Guard',
      type: MobType.GUARD,
      level: 12,
      health: 100,
      combat: {
        attack: 8,
        strength: 8,
        defense: 10,
        range: 3,
        constitution: 12
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 12,
      respawnTime: 50000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 30) + 20, chance: 1.0 },
        { itemId: 'steel_sword', quantity: 1, chance: 0.20 },
        { itemId: 'steel_shield', quantity: 1, chance: 0.15 }
      ],
      experienceReward: 120,
      color: 'blue'
    })

    this.mobDefinitions.set(MobType.DARK_WARRIOR, {
      id: 'dark_warrior',
      name: 'Dark Warrior',
      type: MobType.DARK_WARRIOR,
      level: 15,
      health: 140,
      combat: {
        attack: 12,
        strength: 12,
        defense: 8,
        range: 3,
        constitution: 15
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 15,
      respawnTime: 60000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 40) + 25, chance: 1.0 },
        { itemId: 'steel_sword', quantity: 1, chance: 0.25 },
        { itemId: 'steel_helmet', quantity: 1, chance: 0.10 }
      ],
      experienceReward: 150,
      color: 'darkred'
    })

    // Level 3 Mobs - Advanced
    this.mobDefinitions.set(MobType.BLACK_KNIGHT, {
      id: 'black_knight',
      name: 'Black Knight',
      type: MobType.BLACK_KNIGHT,
      level: 25,
      health: 250,
      combat: {
        attack: 20,
        strength: 20,
        defense: 18,
        range: 5,
        constitution: 25
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 20,
      respawnTime: 90000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 100) + 75, chance: 1.0 },
        { itemId: 'mithril_sword', quantity: 1, chance: 0.20 },
        { itemId: 'mithril_shield', quantity: 1, chance: 0.15 }
      ],
      experienceReward: 250,
      color: 'black'
    })

    this.mobDefinitions.set(MobType.ICE_WARRIOR, {
      id: 'ice_warrior',
      name: 'Ice Warrior',
      type: MobType.ICE_WARRIOR,
      level: 30,
      health: 350,
      combat: {
        attack: 18,
        strength: 18,
        defense: 25,
        range: 4,
        constitution: 30
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 15,
      respawnTime: 120000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 150) + 100, chance: 1.0 },
        { itemId: 'mithril_sword', quantity: 1, chance: 0.25 },
        { itemId: 'mithril_helmet', quantity: 1, chance: 0.15 }
      ],
      experienceReward: 300,
      color: 'lightblue'
    })

    this.mobDefinitions.set(MobType.DARK_RANGER, {
      id: 'dark_ranger',
      name: 'Dark Ranger',
      type: MobType.DARK_RANGER,
      level: 28,
      health: 280,
      combat: {
        attack: 15,
        strength: 15,
        defense: 12,
        range: 25,
        constitution: 28
      },
      behavior: MobBehavior.AGGRESSIVE,
      aggroRange: 25, // Longer range for archer
      respawnTime: 90000,
      lootTable: [
        { itemId: 'coins', quantity: () => Math.floor(Math.random() * 120) + 80, chance: 1.0 },
        { itemId: 'willow_bow', quantity: 1, chance: 0.20 },
        { itemId: 'arrows', quantity: () => Math.floor(Math.random() * 50) + 25, chance: 0.80 }
      ],
      experienceReward: 280,
      color: 'purple'
    })

    console.log('[MobSystem] Initialized', this.mobDefinitions.size, 'mob definitions')
  }

  private async processIdleState(mob: MobInstance): Promise<void> {
    if (mob.definition.behavior !== MobBehavior.AGGRESSIVE) return

    // Look for nearby players (this would need to be injected or accessed somehow)
    // For now, we'll assume other systems handle player detection
    
    // Random idle movement
    if (Math.random() < 0.01) { // 1% chance per update
      const moveDistance = 2
      const angle = Math.random() * Math.PI * 2
      const newX = mob.spawnPosition.x + Math.cos(angle) * moveDistance
      const newZ = mob.spawnPosition.z + Math.sin(angle) * moveDistance
      
      // Don't move too far from spawn
      const distanceFromSpawn = this.calculateDistance(mob.spawnPosition, { x: newX, z: newZ })
      if (distanceFromSpawn <= mob.definition.aggroRange) {
        mob.position.x = newX
        mob.position.z = newZ
      }
    }
  }

  private async processAggressiveState(mob: MobInstance, now: number): Promise<void> {
    if (!mob.target) {
      mob.state = 'idle'
      return
    }

    // Check if target is still valid and in range
    // This would need access to player system
    
    // For now, transition to combat if we have a target
    mob.state = 'combat'
  }

  private async processCombatState(mob: MobInstance, now: number): Promise<void> {
    if (!mob.target) {
      mob.state = 'idle'
      return
    }

    // Combat is handled by CombatSystem
    // MobSystem just manages the state
  }

  private async processReturningState(mob: MobInstance): Promise<void> {
    const distanceToSpawn = this.calculateDistance(mob.position, mob.spawnPosition)
    
    if (distanceToSpawn <= 1) {
      // Arrived at spawn
      mob.state = 'idle'
      mob.position = { ...mob.spawnPosition }
      mob.currentHealth = mob.definition.health // Heal to full
      return
    }

    // Move towards spawn
    const direction = {
      x: mob.spawnPosition.x - mob.position.x,
      z: mob.spawnPosition.z - mob.position.z
    }
    
    const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z)
    if (distance > 0) {
      const speed = 3 // units per second
      const normalized = {
        x: direction.x / distance,
        z: direction.z / distance
      }
      
      // Simple movement (in real implementation, this would use proper delta time)
      mob.position.x += normalized.x * speed * 0.1
      mob.position.z += normalized.z * speed * 0.1
    }
  }

  private async dropLoot(mob: MobInstance, killerId?: string): Promise<void> {
    const drops: { itemId: string, quantity: number }[] = []

    // Process loot table
    for (const lootEntry of mob.definition.lootTable) {
      if (Math.random() < lootEntry.chance) {
        const quantity = typeof lootEntry.quantity === 'function' 
          ? lootEntry.quantity() 
          : lootEntry.quantity
        
        drops.push({
          itemId: lootEntry.itemId,
          quantity
        })
      }
    }

    // Create visual loot drops or add to player inventory
    // This would interact with the world system to create pickup items
    
    console.log(`[MobSystem] ${mob.definition.name} dropped:`, drops)
  }

  private processRespawnQueue(): void {
    const now = Date.now()
    const toRespawn = this.respawnQueue.filter(entry => now >= entry.respawnTime)
    
    for (const entry of toRespawn) {
      this.spawnMob(entry.definition, entry.position)
      console.log(`[MobSystem] Respawned ${entry.definition.name} at (${entry.position.x}, ${entry.position.z})`)
    }
    
    // Remove respawned entries
    this.respawnQueue = this.respawnQueue.filter(entry => now < entry.respawnTime)
  }

  private calculateDistance(pos1: WorldPosition, pos2: WorldPosition): number {
    const dx = pos1.x - pos2.x
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  // ===== INTEGRATION METHODS =====

  public setPlayerTarget(mobId: string, playerId: string): boolean {
    const mob = this.mobs.get(mobId)
    if (!mob) return false

    mob.target = playerId
    if (mob.state === 'idle') {
      mob.state = 'aggressive'
    }
    return true
  }

  public clearTarget(mobId: string): boolean {
    const mob = this.mobs.get(mobId)
    if (!mob) return false

    mob.target = null
    if (mob.state === 'combat' || mob.state === 'aggressive') {
      // Check if should return to spawn
      const distanceFromSpawn = this.calculateDistance(mob.position, mob.spawnPosition)
      if (distanceFromSpawn > mob.definition.aggroRange) {
        mob.state = 'returning'
      } else {
        mob.state = 'idle'
      }
    }
    return true
  }

  public takeDamage(mobId: string, damage: number): boolean {
    const mob = this.mobs.get(mobId)
    if (!mob) return false

    mob.currentHealth -= damage
    
    if (mob.currentHealth <= 0) {
      this.handleMobDeath(mobId)
    }
    
    return true
  }
}