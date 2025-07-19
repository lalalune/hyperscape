import { logger } from '../types/eliza-mock'
import * as THREE from 'three'
import type {
  HyperfyWorld,
  HyperfyPlayer,
  HyperfyEntity,
  HyperfySystem,
} from '../types/hyperfy.js'

const FORWARD = new THREE.Vector3(0, 0, -1)
const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const e2 = new THREE.Euler(0, 0, 0, 'YXZ')
const q1 = new THREE.Quaternion()
const q2 = new THREE.Quaternion()

// Define Navigation Constants
const CONTROLS_TICK_INTERVAL = 100 // ms
const NAVIGATION_STOP_DISTANCE = 0.5 // meters
const FOLLOW_STOP_DISTANCE = 2.5 // meters
const RANDOM_WALK_DEFAULT_INTERVAL = 5000 // ms <-- SET TO 5 SECONDS
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
  postLateUpdate() {
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
}
