import { System, World, Entity } from '../types/core-types'
import type { Player } from '@hyperscape/shared'
import type { Control, InputState } from '../types/core-types'
import { THREE } from '@hyperscape/shared'

const _FORWARD = new THREE.Vector3(0, 0, -1)
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const _e2 = new THREE.Euler(0, 0, 0, 'YXZ')
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()

import { CONTROLS_CONFIG } from '../config/constants'
import { logger } from '@elizaos/core'

interface ControllablePlayer extends Player {
  walkToward: (
    targetPosition: { x: number; y: number; z: number },
    speed?: number
  ) => void
  walk: (direction: { x: number; z: number }, speed?: number) => void
  teleport: (options: { position: THREE.Vector3; rotationY: number }) => void
}

// Define Navigation Constants
const CONTROLS_TICK_INTERVAL = CONTROLS_CONFIG.TICK_INTERVAL_MS
const NAVIGATION_STOP_DISTANCE = CONTROLS_CONFIG.NAVIGATION_STOP_DISTANCE
const FOLLOW_STOP_DISTANCE = CONTROLS_CONFIG.FOLLOW_STOP_DISTANCE
const _RANDOM_WALK_DEFAULT_INTERVAL = CONTROLS_CONFIG.TICK_INTERVAL_MS * 50 // 5 seconds default
const _RANDOM_WALK_DEFAULT_MAX_DISTANCE = 7 // meters

// Extend shared InputState with additional properties needed by controls
interface ButtonState {
  $button: boolean
  down: boolean
  pressed: boolean
  released: boolean
  onRelease?: () => void
}

function createButtonState(): ButtonState {
  return {
    $button: true,
    down: false,
    pressed: false,
    released: false,
  }
}

function isButtonState(value: unknown): value is ButtonState {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$button' in value &&
    'down' in value &&
    'pressed' in value &&
    'released' in value
  )
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

// Use simplified camera and screen types compatible with Control interface
type CameraState = {
  position?: THREE.Vector3
  quaternion?: THREE.Quaternion
  zoom?: number
  [key: string]: unknown
}

type ScreenState = {
  width?: number
  height?: number
  [key: string]: unknown
}

export class AgentControls extends System {
  [key: string]: unknown // Allow dynamic property access
  // Define expected control properties directly on the instance
  scrollDelta = { value: 0 }
  pointer = { locked: false, delta: { x: 0, y: 0 } }
  camera: CameraState | undefined = undefined // PlayerLocal checks for this
  screen: ScreenState | undefined = undefined // PlayerLocal checks for this
  xrLeftStick = { value: { x: 0, y: 0, z: 0 } }
  xrRightStick = { value: { x: 0, y: 0, z: 0 } }
  keyW: ButtonState
  keyA: ButtonState
  keyS: ButtonState
  keyD: ButtonState
  space: ButtonState
  shiftLeft: ButtonState
  shiftRight: ButtonState
  controlLeft: ButtonState
  keyC: ButtonState
  keyF: ButtonState
  keyE: ButtonState
  keyX: ButtonState
  arrowUp: ButtonState
  arrowDown: ButtonState
  arrowLeft: ButtonState
  arrowRight: ButtonState
  touchA: ButtonState
  touchB: ButtonState
  xrLeftBtn1: ButtonState
  xrLeftBtn2: ButtonState
  xrRightBtn1: ButtonState
  xrRightBtn2: ButtonState

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
  private _tempVec3 = new THREE.Vector3()

  constructor(world: World) {
    super(world)
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

    // Camera will be set by PlayerLocal
  }

  // Implement required System interface methods
  async init(_options?: unknown): Promise<void> {
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
  preFixedUpdate(_willFixedStep: boolean): void {}
  fixedUpdate(_delta: number): void {}
  postFixedUpdate(_delta: number): void {}
  preUpdate(_alpha: number): void {}
  update(_delta: number): void {}
  postUpdate(_delta: number): void {}
  lateUpdate(_delta: number): void {}
  commit(): void {}
  postTick(): void {}

  // Method for the agent script to set a key state
  setKey(keyName: string, isDown: boolean) {
    const keyValue = this[keyName]
    if (!keyValue || typeof keyValue !== 'object' || !('$button' in keyValue)) {
      // If the key doesn't exist or isn't a button state, log a warning or initialize
      logger.warn(
        `[Controls] Attempted to set unknown or non-button key: ${keyName}. Initializing.`
      )
      this[keyName] = createButtonState() // Create if missing
    }
    const state = this[keyName] as ButtonState

    // Check if the state actually changed to avoid redundant updates
    const _changed = state.down !== isDown

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
  postLateUpdate(_delta: number): void {
    for (const key in this) {
      if (
        Object.prototype.hasOwnProperty.call(this, key) &&
        isButtonState(this[key])
      ) {
        this[key].pressed = false
      }
    }
  }

  // Navigation methods that are called by actions
  private navigationTarget: { x: number; z: number } | null = null
  private followTargetId: string | null = null
  private isNavigating = false
  private navigationToken: ControlsToken | null = null

  /**
   * Navigate to a specific position in the world
   */
  async goto(x: number, z: number): Promise<boolean> {
    try {
      logger.info(
        `[AgentControls] Starting navigation to position (${x}, ${z})`
      )

      // Stop any existing navigation
      this.stopNavigation()

      // Set navigation target
      this.navigationTarget = { x, z }
      this.isNavigating = true
      this.navigationToken = new ControlsToken()

      // Get player
      const player = this.world.entities.player
      if (!player) {
        logger.error(
          '[AgentControls] No player entity available for navigation'
        )
        return false
      }

      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isNavigating || this.navigationToken?.aborted) {
            clearInterval(checkInterval)
            resolve(false)
            return
          }

          if (!this.navigationTarget || !player.node.position) {
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(false)
            return
          }

          const currentPos = player.node.position
          const targetPos = this.navigationTarget

          // Move towards target
          const direction = {
            x: targetPos.x - currentPos.x,
            z: targetPos.z - currentPos.z,
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
          const length = Math.sqrt(
            direction.x * direction.x + direction.z * direction.z
          )
          if (length > 0) {
            direction.x /= length
            direction.z /= length
          }

          // Use physics-based movement if available, otherwise fallback to teleport
          const controllablePlayer = player as ControllablePlayer
          if (controllablePlayer.walkToward) {
            // Use physics-based walking toward target
            const targetPosition = {
              x: targetPos.x,
              y: currentPos.y,
              z: targetPos.z,
            }
            controllablePlayer.walkToward(targetPosition, 2.0) // 2 m/s walking speed
          } else if (controllablePlayer.walk) {
            // Use physics-based directional walking
            controllablePlayer.walk(direction, 2.0)
          } else if (controllablePlayer.teleport) {
            // Fallback to teleport-based movement for compatibility
            const moveDistance = Math.min(1.0, distance)
            const newX = currentPos.x + direction.x * moveDistance
            const newZ = currentPos.z + direction.z * moveDistance

            controllablePlayer.teleport({
              position: this._tempVec3.set(newX, currentPos.y, newZ),
              rotationY: Math.atan2(direction.x, direction.z),
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
      const player = this.world.entities.player
      const targetEntity =
        this.world.entities.items?.get(entityId) ||
        this.world.entities.players?.get(entityId)

      if (!player) {
        logger.error('[AgentControls] No player entity available for following')
        return false
      }

      if (!targetEntity) {
        logger.error(`[AgentControls] Target entity not found: ${entityId}`)
        return false
      }

      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isNavigating || this.navigationToken?.aborted) {
            clearInterval(checkInterval)
            resolve(false)
            return
          }

          // Re-get target entity in case it moved
          const currentTarget =
            this.world?.entities?.items?.get(entityId) ||
            this.world?.entities?.players?.get(entityId)

          if (!currentTarget || !player.node.position) {
            clearInterval(checkInterval)
            this.stopNavigation()
            resolve(false)
            return
          }

          const currentPos = player.node.position
          const targetPos =
            (
              currentTarget as Entity & {
                base?: { position?: { x: number; y: number; z: number } }
              }
            )?.position || currentTarget.position

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
            z: targetPos.z - currentPos.z,
          }

          // Normalize direction
          const length = Math.sqrt(
            direction.x * direction.x + direction.z * direction.z
          )
          if (length > 0) {
            direction.x /= length
            direction.z /= length
          }

          // Use physics-based movement for following
          const controllablePlayer = player as ControllablePlayer
          if (controllablePlayer.walkToward) {
            // Calculate target position that maintains follow distance
            const followDistance = FOLLOW_STOP_DISTANCE + 0.5 // Stay just outside the follow distance
            const targetDistance = Math.max(followDistance, distance - 1.0)
            const followX = targetPos.x - direction.x * targetDistance
            const followZ = targetPos.z - direction.z * targetDistance

            controllablePlayer.walkToward(
              { x: followX, y: currentPos.y, z: followZ },
              2.5
            )
          } else if (controllablePlayer.walk) {
            // Use directional physics walking
            controllablePlayer.walk(direction, 2.5)
          } else if (controllablePlayer.teleport) {
            // Fallback to teleport-based movement
            const moveDistance = Math.min(2.0, distance - FOLLOW_STOP_DISTANCE)
            if (moveDistance > 0) {
              const newX = currentPos.x + direction.x * moveDistance
              const newZ = currentPos.z + direction.z * moveDistance

              controllablePlayer.teleport({
                position: this._tempVec3.set(newX, currentPos.y, newZ),
                rotationY: Math.atan2(direction.x, direction.z),
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
    // Random walk behavior implementation needed
    logger.info('[AgentControls] Random walk started (not yet implemented)')
  }

  /**
   * Stop random walk behavior
   */
  stopRandomWalk(): void {
    // Random walk stop implementation needed
    logger.info('[AgentControls] Random walk stopped (not yet implemented)')
  }

  /**
   * Check if currently walking randomly
   */
  getIsWalkingRandomly(): boolean {
    return this._isRandomWalking
  }
}
