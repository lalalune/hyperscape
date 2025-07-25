import { logger } from '@elizaos/core'
import * as THREE from 'three'
import type {
  WorldInterface as HyperfyWorld,
  Player as HyperfyPlayer,
  EntityInterface as HyperfyEntity,
  SystemInterface as HyperfySystem,
} from '@hyperscape/hyperfy'

const FORWARD = new (THREE as any).Vector3(0, 0, -1)
const v1 = new (THREE as any).Vector3()
const v2 = new (THREE as any).Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const e2 = new THREE.Euler(0, 0, 0, 'YXZ')
const q1 = new THREE.Quaternion()
const q2 = new THREE.Quaternion()

import { CONTROLS_CONFIG } from '../config/constants'

// Define Navigation Constants
const CONTROLS_TICK_INTERVAL = CONTROLS_CONFIG.TICK_INTERVAL_MS
const NAVIGATION_STOP_DISTANCE = CONTROLS_CONFIG.NAVIGATION_STOP_DISTANCE
const FOLLOW_STOP_DISTANCE = CONTROLS_CONFIG.FOLLOW_STOP_DISTANCE
const RANDOM_WALK_DEFAULT_INTERVAL = CONTROLS_CONFIG.TICK_INTERVAL_MS * 50 // 5 seconds default
const RANDOM_WALK_DEFAULT_MAX_DISTANCE = 7 // meters

// Extended player type with additional properties
interface ExtendedPlayer extends HyperfyPlayer {
  base: {
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
  }
  cam: {
    rotation: THREE.Euler
  }
  teleport: (options: { position: THREE.Vector3; rotationY: number }) => void
  walk?: (direction: any, speed?: number) => any
  walkToward?: (targetPosition: any, speed?: number) => any
  move?: (displacement: any) => void
}

function createButtonState() {
  return {
    $button: true,
    down: false,
    pressed: false,
    released: false,
  }
}

class ControlsToken {
  private _isAborted = false
  abort() {
    this._isAborted = true
  }
  get aborted() {
    return this._isAborted
  }
}

export class AgentControls implements HyperfySystem {
  world: any;
  [key: string]: any // Allow dynamic property access
  // Define expected control properties directly on the instance
  scrollDelta = { value: 0 }
  pointer = { locked: false, delta: { x: 0, y: 0 } }
  camera: any = undefined // PlayerLocal checks for this
  screen: any = undefined // PlayerLocal checks for this
  xrLeftStick = { value: { x: 0, y: 0, z: 0 } }
  xrRightStick = { value: { x: 0, y: 0, z: 0 } }
  keyW: any
  keyA: any
  keyS: any
  keyD: any
  space: any
  shiftLeft: any
  shiftRight: any
  controlLeft: any
  keyC: any
  keyF: any
  keyE: any
  arrowUp: any
  arrowDown: any
  arrowLeft: any
  arrowRight: any
  touchA: any
  touchB: any
  xrLeftBtn1: any
  xrLeftBtn2: any
  xrRightBtn1: any
  xrRightBtn2: any

  // --- Navigation State --- >
  private _navigationTarget: THREE.Vector3 | null = null
  private _isNavigating: boolean = false
  private _currentNavKeys: {
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
  } = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  }
  private _navigationResolve: (() => void) | null = null
  // <------------------------

  private _currentWalkToken: ControlsToken | null = null
  private _isRandomWalking: boolean = false

  private _isRotating = false
  private _rotationTarget: THREE.Quaternion | null = null
  private _rotationAbortController: ControlsToken | null = null

  constructor(world: any) {
    this.world = world

    const commonKeys = [
      'keyW',
      'keyA',
      'keyS',
      'keyD',
      'space',
      'shiftLeft',
      'shiftRight',
      'controlLeft',
      'keyC',
      'keyF',
      'keyE',
      'keyX',
      'arrowUp',
      'arrowDown',
      'arrowLeft',
      'arrowRight',
      'touchA',
      'touchB',
      'xrLeftStick',
      'xrRightStick',
      'xrLeftBtn1',
      'xrLeftBtn2',
      'xrRightBtn1',
      'xrRightBtn2',
    ]
    commonKeys.forEach(key => {
      this[key] = createButtonState()
    })

    this.camera = this.createCamera(this)
  }

  // Implement required System interface methods
  async init(options: any): Promise<void> {
    // Initialize the controls system
  }

  start(): void {
    // Start the controls system
  }

  destroy(): void {
    // Cleanup controls system
  }

  // Required System interface update cycle methods
  preTick(): void {}
  preFixedUpdate(willFixedStep: boolean): void {}
  fixedUpdate(delta: number): void {}
  postFixedUpdate(delta: number): void {}
  preUpdate(alpha: number): void {}
  update(delta: number): void {}
  postUpdate(delta: number): void {}
  lateUpdate(delta: number): void {}
  commit(): void {}
  postTick(): void {}

  // Method for the agent script to set a key state
  setKey(keyName: string, isDown: boolean) {
    if (!this[keyName] || !this[keyName].$button) {
      // If the key doesn't exist or isn't a button state, log a warning or initialize
      logger.warn(
        `[Controls] Attempted to set unknown or non-button key: ${keyName}. Initializing.`
      )
      this[keyName] = createButtonState() // Create if missing
    }
    const state = this[keyName]

    // Check if the state actually changed to avoid redundant updates
    const changed = state.down !== isDown

    if (isDown && !state.down) {
      state.pressed = true
      state.released = false
    } else if (!isDown && state.down) {
      state.released = true
      state.pressed = false
    }
    state.down = isDown

    // Optional: Log the key press/release
    // if (changed) {
    //     logger.debug(`[Controls] setKey: ${keyName} = ${isDown}`);
    // }
  }

  // Reset pressed/released flags at the end of the frame
  // This is important for detecting single presses/releases
  postLateUpdate(delta: number): void {
    for (const key in this) {
      if (
        Object.prototype.hasOwnProperty.call(this, key) &&
        this[key] &&
        (this[key] as any).$button
      ) {
        ;(this[key] as any).pressed = false
      }
    }
  }

  // Navigation methods that are called by actions
  private navigationTarget: { x: number, z: number } | null = null
  private followTargetId: string | null = null
  private isNavigating = false
  private navigationToken: ControlsToken | null = null

  /**
   * Navigate to a specific position in the world
   */
  async goto(x: number, z: number): Promise<boolean> {
    try {
      logger.info(`[AgentControls] Starting navigation to position (${x}, ${z})`)
      
      // Stop any existing navigation
      this.stopNavigation()
      
      // Set navigation target
      this.navigationTarget = { x, z }
      this.isNavigating = true
      this.navigationToken = new ControlsToken()
      
      // Get player
      const player = this.world?.entities?.player as ExtendedPlayer
      if (!player) {
        logger.error('[AgentControls] No player entity available for navigation')
        return false
      }

      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isNavigating || this.navigationToken?.aborted) {
            clearInterval(checkInterval)
            resolve(false)
            return
          }

          if (!this.navigationTarget || !player.base?.position) {
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(false)
            return
          }

          const currentPos = player.base.position
          const targetPos = this.navigationTarget
          
          // Move towards target
          const direction = {
            x: targetPos.x - currentPos.x,
            z: targetPos.z - currentPos.z
          }
          
          // Calculate distance to target
          const distance = Math.sqrt(
            Math.pow(currentPos.x - targetPos.x, 2) + 
            Math.pow(currentPos.z - targetPos.z, 2)
          )

          // Check if we've reached the target
          if (distance <= NAVIGATION_STOP_DISTANCE) {
            logger.info('[AgentControls] Reached navigation target')
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(true)
            return
          }
          
          // Normalize direction
          const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z)
          if (length > 0) {
            direction.x /= length
            direction.z /= length
          }

          // Use physics-based movement if available, otherwise fallback to teleport
          if (player.walkToward) {
            // Use physics-based walking toward target
            const targetPosition = { x: targetPos.x, y: currentPos.y, z: targetPos.z }
            player.walkToward(targetPosition, 2.0) // 2 m/s walking speed
          } else if (player.walk) {
            // Use physics-based directional walking
            player.walk(direction, 2.0)
          } else if (player.teleport) {
            // Fallback to teleport-based movement for compatibility
            const moveDistance = Math.min(1.0, distance)
            const newX = currentPos.x + direction.x * moveDistance
            const newZ = currentPos.z + direction.z * moveDistance
            
            player.teleport({
              position: new THREE.Vector3(newX, currentPos.y, newZ),
              rotationY: Math.atan2(direction.x, direction.z)
            })
          }
        }, CONTROLS_TICK_INTERVAL)
      })
    } catch (error) {
      logger.error('[AgentControls] Error during navigation:', error)
      this.stopNavigation()
      return false
    }
  }

  /**
   * Follow a specific entity by ID
   */
  async followEntity(entityId: string): Promise<boolean> {
    try {
      logger.info(`[AgentControls] Starting to follow entity: ${entityId}`)
      
      // Stop any existing navigation
      this.stopNavigation()
      
      // Set follow target
      this.followTargetId = entityId
      this.isNavigating = true
      this.navigationToken = new ControlsToken()

      // Get player and target entity
      const player = this.world?.entities?.player as ExtendedPlayer
      const targetEntity = this.world?.entities?.items?.get(entityId) || 
                          this.world?.entities?.players?.get(entityId)
      
      if (!player) {
        logger.error('[AgentControls] No player entity available for following')
        return false
      }

      if (!targetEntity) {
        logger.error(`[AgentControls] Target entity not found: ${entityId}`)
        return false
      }

      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isNavigating || this.navigationToken?.aborted) {
            clearInterval(checkInterval)
            resolve(false)
            return
          }

          // Re-get target entity in case it moved
          const currentTarget = this.world?.entities?.items?.get(entityId) || 
                               this.world?.entities?.players?.get(entityId)
          
          if (!currentTarget || !player.base?.position) {
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(false)
            return
          }

          const currentPos = player.base.position
          const targetPos = currentTarget.base?.position || currentTarget.position
          
          if (!targetPos) {
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(false)
            return
          }

          // Calculate distance to target
          const distance = Math.sqrt(
            Math.pow(currentPos.x - targetPos.x, 2) + 
            Math.pow(currentPos.z - targetPos.z, 2)
          )

          // Check if we're close enough to the target
          if (distance <= FOLLOW_STOP_DISTANCE) {
            logger.info('[AgentControls] Close enough to follow target')
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(true)
            return
          }

          // Move towards target
          const direction = {
            x: targetPos.x - currentPos.x,
            z: targetPos.z - currentPos.z
          }
          
          // Normalize direction
          const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z)
          if (length > 0) {
            direction.x /= length
            direction.z /= length
          }

          // Use physics-based movement for following
          if (player.walkToward) {
            // Calculate target position that maintains follow distance
            const followDistance = FOLLOW_STOP_DISTANCE + 0.5 // Stay just outside the follow distance
            const targetDistance = Math.max(followDistance, distance - 1.0)
            const followX = targetPos.x - direction.x * targetDistance
            const followZ = targetPos.z - direction.z * targetDistance
            
            player.walkToward({ x: followX, y: currentPos.y, z: followZ }, 2.5)
          } else if (player.walk) {
            // Use directional physics walking
            player.walk(direction, 2.5)
          } else if (player.teleport) {
            // Fallback to teleport-based movement
            const moveDistance = Math.min(2.0, distance - FOLLOW_STOP_DISTANCE)
            if (moveDistance > 0) {
              const newX = currentPos.x + direction.x * moveDistance
              const newZ = currentPos.z + direction.z * moveDistance
              
              player.teleport({
                position: new THREE.Vector3(newX, currentPos.y, newZ),
                rotationY: Math.atan2(direction.x, direction.z)
              })
            }
          }
        }, CONTROLS_TICK_INTERVAL)
      })
    } catch (error) {
      logger.error('[AgentControls] Error during entity following:', error)
      this.stopNavigation()
      return false
    }
  }

  /**
   * Stop all navigation actions
   */
  stopNavigation(): void {
    if (this.navigationToken) {
      this.navigationToken.abort()
      this.navigationToken = null
    }
    this.isNavigating = false
    this.navigationTarget = null
    this.followTargetId = null
    logger.info('[AgentControls] Navigation stopped')
  }

  /**
   * Stop all agent actions (navigation, random walk, etc.)
   */
  stopAllActions(): void {
    this.stopNavigation()
    // Stop random walk if implemented
    // Stop any other ongoing actions
    logger.info('[AgentControls] All agent actions stopped')
  }

  /**
   * Start random walk behavior
   */
  startRandomWalk(): void {
    // TODO: Implement random walk behavior
    logger.info('[AgentControls] Random walk started (not yet implemented)')
  }

  /**
   * Stop random walk behavior  
   */
  stopRandomWalk(): void {
    // TODO: Implement random walk stop
    logger.info('[AgentControls] Random walk stopped (not yet implemented)')
  }
}
