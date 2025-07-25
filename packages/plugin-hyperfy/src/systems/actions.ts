import * as THREE from 'three'
import type {
  WorldInterface as HyperfyWorld,
  Player as HyperfyPlayer,
  SystemInterface as HyperfySystem,
} from '@hyperscape/hyperfy'
import { CONTROLS_CONFIG } from '../config/constants'

interface ActionNode extends THREE.Object3D {
  [key: string]: any
}

export class AgentActions {
  world: any
  private nodes: ActionNode[] = []
  private currentNode: ActionNode | null = null

  constructor(world: any) {
    this.world = world
    this.nodes = []
  }

  // Implement required System interface methods
  async init(options: any): Promise<void> {
    // Initialize the actions system
  }

  start(): void {
    // Start the actions system
  }

  destroy(): void {
    // Cleanup actions system
  }


  register(node: ActionNode) {
    this.nodes.push(node)
  }

  unregister(node: ActionNode) {
    const idx = this.nodes.indexOf(node)
    if (idx !== -1) {
      this.nodes.splice(idx, 1)
    }
  }

  getNearby(maxDistance?: number): ActionNode[] {
    const cameraPos = this.world.rig?.position
    if (!cameraPos) {
      return []
    }

    return this.nodes.filter(node => {
      if (node.finished) {
        return false
      }

      // If no distance provided, return all unfinished nodes
      if (maxDistance === null || maxDistance === undefined) {
        return true
      }

      return node.ctx.entity.root.position.distanceTo(cameraPos) <= maxDistance
    })
  }

  performAction(entityID?: string) {
    if (this.currentNode) {
      console.log('Already interacting with an entity. Release it first.')
      return
    }
    const nearby = this.getNearby()
    if (!nearby.length) {
      return
    }

    let target: ActionNode | undefined

    if (entityID) {
      target = nearby.find(node => node.ctx.entity?.data?.id === entityID)
      if (!target) {
        console.log(`No nearby action node found with entity ID: ${entityID}`)
        return
      }
    } else {
      target = nearby[0]
    }

    const control = this.world.controls
    if (!control) {
      console.log('Controls not available')
      return
    }

    if (control.setKey) {
      control.setKey('keyE', true)
    }

    const player = this.world.entities.player
    if (!player) {
      console.log('Player not available')
      return
    }

    setTimeout(() => {
      if (typeof target._onTrigger === 'function') {
        target._onTrigger({
          playerId: (player as unknown as HyperfyPlayer).data.id,
        })
      }
      if (control.setKey) {
        control.setKey('keyE', false)
      }
      this.currentNode = target
    }, target._duration ?? CONTROLS_CONFIG.ACTION_DEFAULT_DURATION_MS)
  }

  releaseAction() {
    if (!this.currentNode) {
      console.log('No current action to release.')
      return
    }

    console.log('Releasing current action.')
    const control = this.world.controls
    if (!control) {
      console.log('Controls not available')
      return
    }

    if (control.setKey) {
      control.setKey('keyX', true)
    }
    if (control.keyX) {
      control.keyX.pressed = true
      control.keyX.onPress?.()
    }

    if (typeof this.currentNode._onCancel === 'function') {
      this.currentNode._onCancel()
    }

    setTimeout(() => {
      if (control.setKey) {
        control.setKey('keyX', false)
      }
      if (control.keyX) {
        control.keyX.released = false
        control.keyX.onRelease?.()
      }
      this.currentNode = null
    }, 500)
  }

  // Framework stubs
  // init() {} - implemented above
  // start() {} - implemented above  
  preTick(): void {}
  preFixedUpdate(willFixedStep: boolean): void {}
  fixedUpdate(delta: number): void {}
  postFixedUpdate(delta: number): void {}
  preUpdate(alpha: number): void {}
  update(delta: number): void {}
  postUpdate(delta: number): void {}
  lateUpdate(delta: number): void {}
  postLateUpdate(delta: number): void {}
  commit(): void {}
  postTick(): void {}
}
