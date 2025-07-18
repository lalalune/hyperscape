import type { World } from '../../../types'
import type { NPCSystem } from '../NPCSystem'
import type { Vector3 } from '../../types'

interface SpawnPoint {
  id: string
  position: Vector3
  npcId: number
  maxCount: number
  respawnTime: number
  radius: number
  active: boolean
  currentCount: number
  lastSpawnTime: number
}

interface RespawnTask {
  spawnerId: string
  npcId: number
  respawnTime: number
  scheduledTime: number
}

export class NPCSpawnManager {
  private world: World
  private npcSystem: NPCSystem
  private spawnPoints: Map<string, SpawnPoint> = new Map()
  private respawnQueue: RespawnTask[] = []
  
  // Persistence
  private pendingSaves: boolean = false
  private saveTimer?: NodeJS.Timeout
  private lastSaveTime: number = 0

  constructor(world: World, npcSystem: NPCSystem) {
    this.world = world
    this.npcSystem = npcSystem
    this.setupEventListeners()
    this.startAutoSave()
    this.loadSpawnData()
    this.registerDefaultSpawnPoints()
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Save on server shutdown
    this.world.events.on('world:shutdown', this.handleShutdown.bind(this))
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    // Save spawn data every 30 seconds
    this.saveTimer = setInterval(() => {
      if (this.pendingSaves) {
        this.saveSpawnData()
      }
    }, 30000)
  }

  /**
   * Handle world shutdown
   */
  private async handleShutdown(): Promise<void> {
    // Save immediately on shutdown
    await this.saveSpawnData()
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
    }
  }

  /**
   * Load spawn data from persistence
   */
  private async loadSpawnData(): Promise<void> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    try {
      const entities = await persistence.loadWorldEntities()
      
      // Restore spawn point states
      for (const entity of entities) {
        if (entity.entityType === 'spawn_point') {
          const metadata = entity.metadata || {}
          const spawnPoint = this.spawnPoints.get(entity.entityId)
          if (spawnPoint) {
            spawnPoint.currentCount = metadata.currentCount || 0
            spawnPoint.lastSpawnTime = metadata.lastSpawnTime ? new Date(metadata.lastSpawnTime).getTime() : 0
            spawnPoint.active = metadata.active !== false
          }
        } else if (entity.entityType === 'respawn_task') {
          const metadata = entity.metadata || {}
          const task: RespawnTask = {
            spawnerId: metadata.spawnerId,
            npcId: metadata.npcId,
            respawnTime: metadata.respawnTime,
            scheduledTime: new Date(metadata.scheduledTime).getTime()
          }
          // Only add if still in future
          if (task.scheduledTime > Date.now()) {
            this.respawnQueue.push(task)
          }
        }
      }

      console.log(`[NPCSpawnManager] Loaded ${this.respawnQueue.length} pending respawns`)
    } catch (error) {
      console.error(`[NPCSpawnManager] Failed to load spawn data:`, error)
    }
  }

  /**
   * Save spawn data to persistence
   */
  private async saveSpawnData(): Promise<void> {
    const persistence = (this.world as any).getSystem('persistence')
    if (!persistence) return

    const now = Date.now()
    // Throttle saves to once per minute max
    if (now - this.lastSaveTime < 60000) return

    try {
      const entities: any[] = []
      
      // Save spawn point states
      for (const [id, spawnPoint] of this.spawnPoints) {
        entities.push({
          entityId: id,
          worldId: (this.world as any).id || 'default',
          entityType: 'spawn_point',
          position: JSON.stringify(spawnPoint.position),
          metadata: {
            currentCount: spawnPoint.currentCount,
            lastSpawnTime: new Date(spawnPoint.lastSpawnTime).toISOString(),
            active: spawnPoint.active
          }
        })
      }

      // Save respawn queue
      for (let i = 0; i < this.respawnQueue.length; i++) {
        const task = this.respawnQueue[i]
        entities.push({
          entityId: `respawn_task_${i}`,
          worldId: (this.world as any).id || 'default',
          entityType: 'respawn_task',
          position: JSON.stringify({ x: 0, y: 0, z: 0 }),
          metadata: {
            spawnerId: task.spawnerId,
            npcId: task.npcId,
            respawnTime: task.respawnTime,
            scheduledTime: new Date(task.scheduledTime).toISOString()
          }
        })
      }

      await persistence.saveWorldEntities(entities)
      this.pendingSaves = false
      this.lastSaveTime = now
      console.log(`[NPCSpawnManager] Saved spawn data`)
    } catch (error) {
      console.error(`[NPCSpawnManager] Failed to save spawn data:`, error)
    }
  }

  /**
   * Mark for save
   */
  private markForSave(): void {
    this.pendingSaves = true
  }

  /**
   * Update spawn points and respawn queue
   */
  update(_delta: number): void {
    const now = Date.now()

    // Process respawn queue
    const tasksToProcess = this.respawnQueue.filter(task => now >= task.scheduledTime)
    for (const task of tasksToProcess) {
      this.processRespawn(task)
    }

    // Remove processed tasks
    const oldQueueLength = this.respawnQueue.length
    this.respawnQueue = this.respawnQueue.filter(task => now < task.scheduledTime)
    if (this.respawnQueue.length !== oldQueueLength) {
      this.markForSave()
    }

    // Check spawn points
    for (const [_id, spawnPoint] of this.spawnPoints) {
      if (!spawnPoint.active) {
        continue
      }

      // Check if we need to spawn more NPCs
      if (spawnPoint.currentCount < spawnPoint.maxCount) {
        // Check if enough time has passed
        if (now - spawnPoint.lastSpawnTime >= spawnPoint.respawnTime) {
          this.spawnAtPoint(spawnPoint)
        }
      }
    }
  }

  /**
   * Register a spawn point
   */
  registerSpawnPoint(config: {
    id: string
    position: Vector3
    npcId: number
    maxCount?: number
    respawnTime?: number
    radius?: number
  }): void {
    const spawnPoint: SpawnPoint = {
      id: config.id,
      position: config.position,
      npcId: config.npcId,
      maxCount: config.maxCount || 1,
      respawnTime: config.respawnTime || 60000, // 1 minute default
      radius: config.radius || 5,
      active: true,
      currentCount: 0,
      lastSpawnTime: 0,
    }

    this.spawnPoints.set(config.id, spawnPoint)

    // Initial spawn
    for (let i = 0; i < spawnPoint.maxCount; i++) {
      this.spawnAtPoint(spawnPoint)
    }
  }

  /**
   * Schedule a respawn
   */
  scheduleRespawn(spawnerId: string, npcId: number, respawnTime: number): void {
    const task: RespawnTask = {
      spawnerId,
      npcId,
      respawnTime,
      scheduledTime: Date.now() + respawnTime,
    }

    this.respawnQueue.push(task)
    this.markForSave()

    // Update spawn point count
    const spawnPoint = this.spawnPoints.get(spawnerId)
    if (spawnPoint) {
      spawnPoint.currentCount = Math.max(0, spawnPoint.currentCount - 1)
      this.markForSave()
    }
  }

  /**
   * Activate/deactivate spawn point
   */
  setSpawnPointActive(spawnerId: string, active: boolean): void {
    const spawnPoint = this.spawnPoints.get(spawnerId)
    if (spawnPoint) {
      spawnPoint.active = active
      this.markForSave()
    }
  }

  /**
   * Get all spawn points
   */
  getSpawnPoints(): SpawnPoint[] {
    return Array.from(this.spawnPoints.values())
  }

  /**
   * Spawn NPC at spawn point
   */
  private spawnAtPoint(spawnPoint: SpawnPoint): void {
    // Calculate random position within radius
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * spawnPoint.radius

    const position: Vector3 = {
      x: spawnPoint.position.x + Math.cos(angle) * distance,
      y: spawnPoint.position.y,
      z: spawnPoint.position.z + Math.sin(angle) * distance,
    }

    // Spawn NPC
    const npc = this.npcSystem.spawnNPC(spawnPoint.npcId, position, spawnPoint.id)

    if (npc) {
      spawnPoint.currentCount++
      spawnPoint.lastSpawnTime = Date.now()
      this.markForSave()

      // Emit spawn event
      this.world.events.emit('spawn:npc', {
        spawnerId: spawnPoint.id,
        npcId: (npc as any).id || npc.data?.id,
        position,
      })
    }
  }

  /**
   * Process respawn task
   */
  private processRespawn(task: RespawnTask): void {
    const spawnPoint = this.spawnPoints.get(task.spawnerId)
    if (!spawnPoint || !spawnPoint.active) {
      return
    }

    // Spawn the NPC
    this.spawnAtPoint(spawnPoint)
  }

  /**
   * Register default spawn points
   */
  private registerDefaultSpawnPoints(): void {
    // Goblin spawns
    this.registerSpawnPoint({
      id: 'goblin_spawn_1',
      position: { x: 100, y: 0, z: 100 },
      npcId: 1, // Goblin
      maxCount: 3,
      respawnTime: 30000, // 30 seconds
      radius: 10,
    })

    this.registerSpawnPoint({
      id: 'goblin_spawn_2',
      position: { x: 150, y: 0, z: 120 },
      npcId: 1, // Goblin
      maxCount: 2,
      respawnTime: 30000,
      radius: 8,
    })

    // Guard posts
    this.registerSpawnPoint({
      id: 'guard_post_1',
      position: { x: 0, y: 0, z: 50 },
      npcId: 2, // Guard
      maxCount: 2,
      respawnTime: 60000, // 1 minute
      radius: 2,
    })

    this.registerSpawnPoint({
      id: 'guard_post_2',
      position: { x: 0, y: 0, z: -50 },
      npcId: 2, // Guard
      maxCount: 2,
      respawnTime: 60000,
      radius: 2,
    })

    // Shopkeeper spawn (doesn't respawn)
    this.registerSpawnPoint({
      id: 'shop_spawn',
      position: { x: -20, y: 0, z: 0 },
      npcId: 100, // Bob the shopkeeper
      maxCount: 1,
      respawnTime: 300000, // 5 minutes
      radius: 0,
    })

    // Quest giver spawn
    this.registerSpawnPoint({
      id: 'quest_giver_spawn',
      position: { x: 10, y: 0, z: 10 },
      npcId: 200, // Elder Grimwald
      maxCount: 1,
      respawnTime: 300000,
      radius: 0,
    })
  }
}
