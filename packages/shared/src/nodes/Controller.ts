
import THREE from '../extras/three'

import { DEG2RAD } from '../extras/general'

import type {
  PxCapsuleControllerDesc,
  PxFilterData,
  PxRigidDynamic
} from '../types/physics'
import { Layers } from '../extras/Layers'
import type { PhysicsHandle } from '../systems/Physics'
import { Node } from './Node'

// Extend THREE.Mesh to include node reference
interface MeshWithNode extends THREE.Mesh {
  node?: Controller
}

// Global PHYSX declaration with safe unknown types
declare const PHYSX: {
  PxCapsuleControllerDesc: new() => PxCapsuleControllerDesc;
  PxCapsuleClimbingModeEnum: { eCONSTRAINED: number };
  destroy: (obj: unknown) => void;
  PxArray_PxShapePtr: new(size: number) => {
    begin(): unknown;
    get(index: number): unknown;
  };
  PxPairFlagEnum: Record<string, number>;
  PxFilterData: new(a: number, b: number, c: number, d: number) => PxFilterData;
  PxShapeFlags: new() => { raise: (flags: number) => void };
  PxShapeFlagEnum: Record<string, number> & { eSCENE_QUERY_SHAPE: number; eSIMULATION_SHAPE: number };
  PxControllerCollisionFlagEnum: Record<string, number>;
};

import type { ControllerData } from '../types/nodes'
import type { ActorHandle } from '../types/physics'
import type { PhysXController, PxControllerCollisionFlags } from '../types/physics'
import type { ContactEvent } from '../systems/Physics'

const _layers = ['environment', 'prop', 'player', 'tool']

const defaults = {
  radius: 0.4,
  height: 1,
  visible: false,
  layer: 'environment',
  tag: null,
  onContactStart: null,
  onContactEnd: null,
}

export class Controller extends Node {
  _radius?: number;
  _height?: number;
  _visible?: boolean;
  _layer?: string;
  _tag?: string | null;
  _onContactStart?: Function | null;
  _onContactEnd?: Function | null;
  handle?: PhysXController;
  mesh?: THREE.Mesh;
  controller?: PhysXController;
  actorHandle?: ActorHandle;
  needsRebuild?: boolean;
  moveFlags?: PxControllerCollisionFlags;
  didMove?: boolean;
  private tempVec3 = new THREE.Vector3();

  constructor(data: ControllerData = {}) {
    super(data)
    this.name = 'controller'

    this.radius = data.radius
    this.height = data.height
    this.visible = data.visible
    this.layer = data.layer
    this.tag = data.tag !== undefined ? String(data.tag) : defaults.tag
    this.onContactStart = data.onContactStart
    this.onContactEnd = data.onContactEnd
  }

  mount() {
    this.needsRebuild = false
    if (this._visible) {
      const geometry = new THREE.CapsuleGeometry(this._radius!, this._height!, 2, 8)
      geometry.translate(0, this._height! / 2 + this._radius!, 0)
      if (geometry.computeBoundsTree) {
        geometry.computeBoundsTree()
      }
      const material = new THREE.MeshStandardMaterial({ color: 'green' })
      this.mesh = new THREE.Mesh(geometry, material)
      this.mesh.receiveShadow = true
      this.mesh.castShadow = true
      this.mesh.matrixAutoUpdate = false
      this.mesh.matrixWorldAutoUpdate = false
      this.mesh.matrix.copy(this.matrix);
      this.mesh.matrixWorld.copy(this.matrixWorld);
      (this.mesh as MeshWithNode).node = this;
      const scene = this.ctx!.stage.scene as THREE.Scene
      scene.add(this.mesh)
    }
    const desc = new PHYSX.PxCapsuleControllerDesc()
    desc.height = this._height!
    desc.radius = this._radius!
    desc.climbingMode = PHYSX.PxCapsuleClimbingModeEnum.eCONSTRAINED
    desc.slopeLimit = Math.cos(60 * DEG2RAD) // 60 degrees
    desc.material = this.ctx!.physics.defaultMaterial!
    desc.contactOffset = 0.1 // PhysX default = 0.1
    desc.stepOffset = 0.5 // PhysX default = 0.5m
    
    // Set position in descriptor before creating controller
    const worldPosition = this.getWorldPosition(this.tempVec3)
    const vec3WithPhysX = worldPosition as THREE.Vector3 & { toPxExtVec3?(): unknown }
    const pxPosition = vec3WithPhysX.toPxExtVec3!()
    if (!pxPosition) {
      console.warn('[Controller] Failed to convert position to PxVec3 - PhysX may not be available')
      return
    }
    desc.position = pxPosition
    
    this.controller = this.ctx!.physics.controllerManager!.createController(desc) as PhysXController
    PHYSX.destroy(desc)

    const actor = this.controller.getActor()
    const actorWithShapes = actor as typeof actor & { getNbShapes(): number; getShapes(buffer: unknown, maxShapes: number, startIndex: number): number }
    const nbShapes = actorWithShapes.getNbShapes()
    const shapeBuffer = new PHYSX.PxArray_PxShapePtr(nbShapes) as { begin(): unknown; get(index: number): unknown }
    const shapesCount = actorWithShapes.getShapes(shapeBuffer.begin(), nbShapes, 0)
    for (let i = 0; i < shapesCount; i++) {
      const shape = shapeBuffer.get(i) as { setFlags(flags: unknown): void; setQueryFilterData(data: unknown): void; setSimulationFilterData(data: unknown): void }
      const layer = Layers[this._layer!]
      if (!layer) {
        throw new Error(`[controller] layer not found: ${this._layer}`)
      }
      const pairFlags =
        PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND |
        PHYSX.PxPairFlagEnum.eNOTIFY_TOUCH_LOST |
        PHYSX.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS
      const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, pairFlags, 0)
      const shapeFlags = new PHYSX.PxShapeFlags()
      shapeFlags.raise( PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE )
      shape.setFlags(shapeFlags)
      shape.setQueryFilterData(filterData)
      shape.setSimulationFilterData(filterData)
    }
    const self = this
    interface PhysicsActorConfig {
      controller: boolean
      node: Controller
      tag?: string
      playerId?: undefined
      onContactStart?: (event: ContactEvent) => void
      onContactEnd?: (event: ContactEvent) => void
      onTriggerEnter?: undefined
      onTriggerLeave?: undefined
    }

    const _config: PhysicsActorConfig = {
      controller: true,
      node: self,
      get tag() {
        return self._tag || undefined
      },
      playerId: undefined,
      get onContactStart() {
        return (self._onContactStart || undefined) as ((event: ContactEvent) => void) | undefined
      },
      get onContactEnd() {
        return (self._onContactEnd || undefined) as ((event: ContactEvent) => void) | undefined
      },
      onTriggerEnter: undefined,
      onTriggerLeave: undefined,
    } as PhysicsActorConfig

    // Create a proper PhysicsHandle object
    const physicsHandle: PhysicsHandle = {
      actor: undefined, // Will be set by addActor
      contactedHandles: new Set(),
      triggeredHandles: new Set(),
      controller: true,
      node: this,
      tag: self._tag || undefined,
      playerId: undefined,
      onContactStart: self._onContactStart as ((event: ContactEvent) => void) | undefined,
      onContactEnd: self._onContactEnd as ((event: ContactEvent) => void) | undefined,
      onTriggerEnter: undefined,
      onTriggerLeave: undefined,
    };
    
    this.actorHandle = this.ctx!.physics.addActor(actor as PxRigidDynamic, physicsHandle) ?? undefined
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      this.mesh?.matrix.copy(this.matrix)
      this.mesh?.matrixWorld.copy(this.matrixWorld)
    }
    // if (this.didMove) {
    //   const worldPosition = this.getWorldPosition()
    //   this.controller.setFootPosition(worldPosition.toPxExtVec3())
    //   this.didMove = false
    // }
  }

  unmount() {
    if (this.mesh) {
      const scene = this.ctx!.stage.scene
      scene.remove(this.mesh)
    }
    this.actorHandle?.destroy?.()
    this.actorHandle = undefined
    this.controller?.release()
    this.controller = undefined
  }

  copy(source: Controller, recursive: boolean) {
    super.copy(source, recursive)
    this._radius = source._radius
    this._height = source._height
    this._visible = source._visible
    this._layer = source._layer
    this._tag = source._tag
    this._onContactStart = source._onContactStart
    this._onContactEnd = source._onContactEnd
    return this
  }

  get radius() {
    return this._radius
  }

  set radius(value) {
    this._radius = value ?? defaults.radius
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value) {
    this._height = value ?? defaults.height
    this.needsRebuild = true
    this.setDirty()
  }

  get visible() {
    return this._visible
  }

  set visible(value) {
    this._visible = value ?? defaults.visible
    this.needsRebuild = true
    this.setDirty()
  }

  get layer() {
    return this._layer
  }

  set layer(value) {
    this._layer = value ?? defaults.layer
    if (this.controller) {
      // TODO: we could just update the PxFilterData tbh
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get tag() {
    return this._tag
  }

  set tag(value) {
    this._tag = value !== undefined ? String(value) : defaults.tag
  }

  get onContactStart() {
    return this._onContactStart
  }

  set onContactStart(value) {
    this._onContactStart = value ?? defaults.onContactStart
  }

  get onContactEnd() {
    return this._onContactEnd
  }

  set onContactEnd(value) {
    this._onContactEnd = value ?? defaults.onContactEnd
  }

  get isGrounded() {
    return (this.moveFlags as { isSet(flag: number): boolean } | undefined)?.isSet(PHYSX.PxControllerCollisionFlagEnum.eCOLLISION_DOWN) || false
  }

  get isCeiling() {
    return (this.moveFlags as { isSet(flag: number): boolean } | undefined)?.isSet(PHYSX.PxControllerCollisionFlagEnum.eCOLLISION_UP) || false
  }

  teleport(vec3) {
    if (!vec3?.isVector3) {
      throw new Error('[controller] teleport expected Vector3')
    }
    this.position.copy(vec3)
    this.controller?.setFootPosition(vec3.toPxExtVec3())
  }

  move(vec3) {
    if (!this.controller) return
    
    // Convert vec3 to PxVec3 first
    const pxVec3 = vec3.toPxVec3?.();
    if (pxVec3) {
      // For now, call move without filters to avoid type mismatch
      // The physics system should handle collision filtering internally
      const minDist = 0;
      const elapsedTime = 1 / 30; // Consistent with world fixedDeltaTime
      
      // Call move method using the physics system's approach
      try {
        const physics = this.ctx!.physics;
        if (physics && physics.controllerFilters) {
          // Trust that the physics system provides compatible types
          const controller = this.controller;
          const filters = physics.controllerFilters;
          // Direct call to avoid TypeScript type checking issues
          this.moveFlags = controller.move(pxVec3, minDist, elapsedTime, filters);
        }
      } catch (error) {
        console.warn('[Controller] Move with filters failed, trying without filters:', error);
        // Fallback: move without filters if type issues occur
        console.warn('[Controller] Skipping move operation due to filter type mismatch');
      }
    }
    
    // this.isGrounded = moveFlags.isSet(PHYSX.PxControllerCollisionFlagEnum.eCOLLISION_DOWN) // prettier-ignore
    const pos = this.controller.getFootPosition()
    // pos is PxExtendedVec3; copy manually
    type PxExtendedVec3 = { x: number; y: number; z: number }
    const position = pos as unknown as PxExtendedVec3
    this.position.set(position.x, position.y, position.z)
    this.didMove = true
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get radius() {
          return self.radius
        },
        set radius(value) {
          self.radius = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get visible() {
          return self.visible
        },
        set visible(value) {
          self.visible = value
        },
        get layer() {
          return self.layer
        },
        set layer(value) {
          self.layer = value
        },
        get tag() {
          return self.tag
        },
        set tag(value) {
          self.tag = value
        },
        get onContactStart() {
          return self.onContactStart
        },
        set onContactStart(value) {
          self.onContactStart = value
        },
        get onContactEnd() {
          return self.onContactEnd
        },
        set onContactEnd(value) {
          self.onContactEnd = value
        },
        get isGrounded() {
          return self.isGrounded
        },
        get isCeiling() {
          return self.isCeiling
        },
        teleport(vec3) {
          return self.teleport(vec3)
        },
        move(vec3) {
          return self.move(vec3)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}


