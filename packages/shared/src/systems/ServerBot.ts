import { System } from './System'
import { Logger } from '../utils/Logger'
import * as THREE from 'three'
import type { Entity } from '../entities/Entity'
import { createNodeClientWorld } from '../createNodeClientWorld'
import type { World as ClientWorld } from '../World'

interface BotBehavior {
  name: string
  weight: number // Probability weight
  canExecute: () => boolean
  execute: () => void
  cooldown: number // Milliseconds before can execute again
  lastExecuted: number
}

interface BotStats {
  distanceTraveled: number
  entitiesEncountered: number
  actionsPerformed: number
  startTime: number
  errors: number
}

/**
 * ServerBot - Autonomous bot that moves around and tests interactions
 * Simulates a real player to stress-test server systems
 */
export class ServerBot extends System {
  private bot: Entity | null = null
  private behaviors: BotBehavior[] = []
  private currentBehavior: BotBehavior | null = null
  private isActive: boolean = false
  private stats: BotStats = {
    distanceTraveled: 0,
    entitiesEncountered: 0,
    actionsPerformed: 0,
    startTime: 0,
    errors: 0,
  }
  private lastPosition: THREE.Vector3 = new THREE.Vector3()
  private moveTarget: THREE.Vector3 | null = null
  private updateInterval: number = 100 // Update every 100ms
  private lastUpdate: number = 0
  private dwellUntil: number = 0
  private clientWorld: ClientWorld | null = null
  private _tempVec3 = new THREE.Vector3()
  private _tempVec3_2 = new THREE.Vector3()

  private hasSpawnedBot = false
  
  override start(): void {
    Logger.info('[ServerBot] 🤖 Initializing server bot system...')

    // Allow disabling bots via environment variable if needed
    if (process.env.DISABLE_BOTS === 'true') {
      Logger.info('[ServerBot] Bots disabled via DISABLE_BOTS environment variable')
      return
    }
    
    // Check max bot count
    const maxBots = parseInt(process.env.MAX_BOT_COUNT || '2')
    if (maxBots <= 0) {
      Logger.info('[ServerBot] MAX_BOT_COUNT is 0, bots disabled')
      return
    }

    // Prevent duplicate spawning
    if (this.hasSpawnedBot) {
      Logger.info('[ServerBot] Bot already spawned, skipping')
      return
    }
    
    this.hasSpawnedBot = true

    // Start bot shortly after server start to make tests deterministic
    setTimeout(() => {
      this.spawnBot()
    }, 2000)
  }

  private async spawnBot(): Promise<void> {
    Logger.info('[ServerBot] Spawning autonomous bot (node client)...');
    const port = process.env.PORT || '5555';
    const wsUrl = `ws://127.0.0.1:${port}/ws`;
    const clientWorld = createNodeClientWorld();
    await clientWorld.init({ wsUrl, name: '🤖 Server Bot' });
    this.clientWorld = clientWorld;

    // Get reference to the bot's player entity after connection
    // Note: The player entity is created after the snapshot is received
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for entity creation
    this.bot = this.clientWorld.entities.player as Entity | null;

    this.stats.startTime = Date.now();
    // Initialize behaviors
    this.initializeBehaviors();
    this.isActive = true;
    Logger.info('[ServerBot] Client connected, starting behavior loop');
    // Kick off an immediate movement so observers can see displacement quickly
    this.sprintBehavior();
    this.behaviorLoop();
  }

  private initializeBehaviors(): void {
    this.behaviors = [
      {
        name: 'Wander',
        weight: 5,
        canExecute: () => Date.now() >= this.dwellUntil,
        execute: () => this.wanderBehavior(),
        cooldown: 2000,
        lastExecuted: 0,
      },
      {
        name: 'Explore',
        weight: 3,
        canExecute: () => !this.moveTarget && Date.now() >= this.dwellUntil,
        execute: () => this.exploreBehavior(),
        cooldown: 5000,
        lastExecuted: 0,
      },
      {
        name: 'Sprint',
        weight: 2,
        canExecute: () => Math.random() < 0.3 && Date.now() >= this.dwellUntil,
        execute: () => this.sprintBehavior(),
        cooldown: 10000,
        lastExecuted: 0,
      },
      {
        name: 'Interact',
        weight: 4,
        canExecute: () => this.hasNearbyEntities() && Date.now() >= this.dwellUntil,
        execute: () => this.interactBehavior(),
        cooldown: 3000,
        lastExecuted: 0,
      },
      {
        name: 'Idle',
        weight: 1,
        canExecute: () => true,
        execute: () => this.idleBehavior(),
        cooldown: 1000,
        lastExecuted: 0,
      },
      {
        name: 'Jump',
        weight: 2,
        canExecute: () => Math.random() < 0.2 && Date.now() >= this.dwellUntil,
        execute: () => this.jumpBehavior(),
        cooldown: 2000,
        lastExecuted: 0,
      },
      {
        name: 'Circle',
        weight: 1,
        canExecute: () => Math.random() < 0.1 && Date.now() >= this.dwellUntil,
        execute: () => this.circleBehavior(),
        cooldown: 8000,
        lastExecuted: 0,
      },
    ]
  }

  private behaviorLoop(): void {
    if (!this.isActive || !this.bot) {
      return
    }

    // Select and execute behavior
    const now = Date.now()
    const availableBehaviors = this.behaviors.filter(b => b.canExecute() && now - b.lastExecuted > b.cooldown)

    if (availableBehaviors.length > 0) {
      // Weighted random selection
      const totalWeight = availableBehaviors.reduce((sum, b) => sum + b.weight, 0)
      let random = Math.random() * totalWeight

      for (const behavior of availableBehaviors) {
        random -= behavior.weight
        if (random <= 0) {
          this.currentBehavior = behavior
          behavior.lastExecuted = now
          behavior.execute()
          this.stats.actionsPerformed++
          // Behavior execution logging removed to prevent memory leak
          break
        }
      }
    }

    // Schedule next behavior
    setTimeout(() => this.behaviorLoop(), 3000 + Math.random() * 2000)
  }

  // Behavior implementations
  private wanderBehavior(): void {
    const angle = Math.random() * Math.PI * 2
    const distance = 5 + Math.random() * 10
    const origin = this.getClientPlayerPosition()
    const targetX = origin.x + Math.cos(angle) * distance
    const targetZ = origin.z + Math.sin(angle) * distance
    const target = this._tempVec3.set(targetX, 0, targetZ)
    this.sendMoveRequest(target, false)
    // Wandering logging removed to prevent memory leak
  }

  private exploreBehavior(): void {
    // Move to a distant location
    const origin = this.getClientPlayerPosition()
    const targetX = origin.x + (Math.random() * 100 - 50)
    const targetZ = origin.z + (Math.random() * 100 - 50)
    const target = this._tempVec3.set(targetX, 0, targetZ)
    this.sendMoveRequest(target, false)
    // Exploring logging removed to prevent memory leak
  }

  private sprintBehavior(): void {
    // Move quickly in a direction
    const angle = Math.random() * Math.PI * 2
    const distance = 20 + Math.random() * 20
    const origin = this.getClientPlayerPosition()
    const targetX = origin.x + Math.cos(angle) * distance
    const targetZ = origin.z + Math.sin(angle) * distance
    const target = this._tempVec3.set(targetX, 0, targetZ)
    this.sendMoveRequest(target, true)
    // Sprinting logging removed to prevent memory leak
  }

  private interactBehavior(): void {
    // For now, just wander towards a nearby random offset
    const origin = this.getClientPlayerPosition()
    // Use temp vector to avoid memory leak
    this._tempVec3_2.set((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)
    const target = this._tempVec3
      .copy(origin)
      .add(this._tempVec3_2)
    this.sendMoveRequest(target, false)
  }

  private idleBehavior(): void {
    // Idling logging removed to prevent memory leak
    this.moveTarget = null
  }

  private jumpBehavior(): void {
    // Jumping logging removed to prevent memory leak
    // In a real implementation, this would trigger a jump animation/physics

    // Continue current movement
    if (!this.moveTarget) {
      this.wanderBehavior()
    }
  }

  private circleBehavior(): void {
    // Move in a circle pattern around current position
    const radius = 10
    const steps = 8
    const angle = (Math.PI * 2) / steps
    const origin = this.getClientPlayerPosition()
    const currentAngle = Math.atan2(origin.z, origin.x)
    const nextAngle = currentAngle + angle
    const targetX = origin.x + Math.cos(nextAngle) * radius
    const targetZ = origin.z + Math.sin(nextAngle) * radius
    const target = this._tempVec3.set(targetX, 0, targetZ)
    this.sendMoveRequest(target, false)
    // Circle movement logging removed to prevent memory leak
  }

  // Helper methods
  private getClientPlayerPosition(): THREE.Vector3 {
    if (!this.clientWorld?.entities?.player) {
      return this._tempVec3.set(0, 0, 0)
    }
    const player = this.clientWorld.entities.player
    if ('node' in player && player.node && player.node.position) {
      // Use temp vector to avoid memory leak - don't clone
      const pos = player.node.position
      this._tempVec3.set(pos.x, pos.y, pos.z)

      // VALIDATION: Check for invalid Y positions that indicate encoding errors
      if (this._tempVec3.y < -20 && this._tempVec3.y > -22) {
        // This specific range (-20 to -22) is a signature of the bit encoding bug
        Logger.error('[ServerBot] CRITICAL: Detected corrupted Y position!')
        Logger.error(`  Current Y: ${this._tempVec3.y}`)
        Logger.error('  This indicates a network packet encoding error')
        Logger.error('  Expected positive Y value but received negative')
        this.stats.errors++

        // Throw error to fail fast and alert developers
        throw new Error(`ServerBot detected corrupted position Y=${this._tempVec3.y} - likely packet encoding bug!`)
      }

      // Additional validation for reasonable position ranges
      if (this._tempVec3.y < -100 || this._tempVec3.y > 500) {
        Logger.warn(`[ServerBot] Unusual Y position detected: ${this._tempVec3.y}`)
        this.stats.errors++
      }

      return this._tempVec3
    }
    return this._tempVec3.set(0, 0, 0)
  }

  private sendMoveRequest(target: THREE.Vector3, sprint: boolean = false): void {
    if (!this.clientWorld) return

    // Send move command through the client world's network system
    // Try multiple ways to find the network system
    const network =
      this.clientWorld.getSystem('network') ||
      this.clientWorld.getSystem('ClientNetwork') ||
      this.clientWorld.getSystem('Network') ||
      (this.clientWorld as { network?: unknown }).network

    if (!network) {
      Logger.error('[ServerBot] Cannot find network system in client world')
      return
    }

    const net = network as { send?: (method: string, data: unknown) => void }
    if (net.send) {
      // Send the move request
      net.send('moveRequest', {
        target: [target.x, target.y, target.z],
        runMode: sprint,
      })

      // Also send input packet for compatibility
      net.send('input', {
        type: 'click',
        target: [target.x, target.y, target.z],
        runMode: sprint,
      })
    } else {
      Logger.error('[ServerBot] Network system has no send method')
    }

    // Store the move target for tracking - create new vector to avoid sharing temp vectors
    if (!this.moveTarget) {
      this.moveTarget = new THREE.Vector3()
    }
    this.moveTarget.copy(target)
    this.stats.actionsPerformed++
  }

  private hasNearbyEntities(): boolean {
    return this.getNearbyEntities().length > 0
  }

  private getNearbyEntities(): Entity[] {
    // Not implemented for client-driven bot; could be added via server query
    return []
  }

  override update(_delta: number): void {
    if (!this.isActive) return

    // Track actual movement
    if (this.bot && this.lastPosition) {
      const currentPos = this.getClientPlayerPosition()
      const distance = this.lastPosition.distanceTo(currentPos)
      if (distance > 0.01) {
        // Only count significant movement
        this.stats.distanceTraveled += distance
        this.lastPosition.copy(currentPos)

        // Movement logging removed to prevent memory leak
      }
    } else if (this.bot) {
      // Initialize last position
      this.lastPosition = this.getClientPlayerPosition()
    }
  }
  override destroy(): void {
    Logger.info('[ServerBot] Destroying bot system...');
    this.isActive = false;
    
    // Properly clean up the client world to prevent memory leak
    if (this.clientWorld) {
      // ClientWorld has destroy method - call it to clean up
      this.clientWorld.destroy();
      this.clientWorld = null;
    }
    
    this.bot = null;
    this.hasSpawnedBot = false;
  }
}
