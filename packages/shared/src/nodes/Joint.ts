import { isBoolean, isNumber } from 'lodash-es'
import THREE from '../extras/three'

import type PhysX from '@hyperscape/physx-js-webidl'
import type {
  PxPhysics
} from '../types/physics'
import type {
  JointData,
  PhysXJoint,
  PhysXController,
  PhysXMoveFlags,
  Vector3WithPxTransform,
  QuaternionWithPxTransform
} from '../types/nodes'
import { getPhysX } from '../PhysXManager'
import { createTransform } from '../physics/vector-conversions'
import { Node } from './Node'
import { RigidBody } from './RigidBody'

import { bindRotations } from '../extras/bindRotations'
import { DEG2RAD } from '../extras/general'

const _v1 = new THREE.Vector3(1, 0, 0)
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()

const defaults = {
  type: 'fixed',
  body0: null,
  body1: null,
  breakForce: Infinity,
  breakTorque: Infinity,
  limitY: null,
  limitZ: null,
  limitMin: null,
  limitMax: null,
  limitStiffness: null,
  limitDamping: null,
  collide: false,
}

const types = ['fixed', 'socket', 'hinge', 'distance']



export class Joint extends Node {
  type: string;
  body0: RigidBody | null;
  offset0: THREE.Vector3;
  quaternion0: THREE.Quaternion;
  rotation0: THREE.Euler;
  body1: RigidBody | null;
  offset1: THREE.Vector3;
  quaternion1: THREE.Quaternion;
  rotation1: THREE.Euler;
  breakForce: number;
  breakTorque: number;
  axis: THREE.Vector3;
  limitY: number | null;
  limitZ: number | null;
  limitMin: number | null;
  limitMax: number | null;
  limitStiffness: number | null;
  limitDamping: number | null;
  collide: boolean;
  frame0: PhysX.PxTransform | null = null;
  frame1: PhysX.PxTransform | null = null;
  joint?: PhysXJoint | null;
  controller?: PhysXController;
  moveFlags?: PhysXMoveFlags;
  didMove?: boolean;
  needsRebuild?: boolean;
  
  constructor(data: JointData = {}) {
    super(data)
    this.name = 'joint'

    this.type = data.type || defaults.type
    this.body0 = null
    this.offset0 = new THREE.Vector3(0, 0, 0)
    this.quaternion0 = new THREE.Quaternion(0, 0, 0, 1)
    this.rotation0 = new THREE.Euler(0, 0, 0, 'YXZ')
    bindRotations(this.quaternion0, this.rotation0)
    this.body1 = null
    this.offset1 = new THREE.Vector3(0, 0, 0)
    this.quaternion1 = new THREE.Quaternion(0, 0, 0, 1)
    this.rotation1 = new THREE.Euler(0, 0, 0, 'YXZ')
    bindRotations(this.quaternion1, this.rotation1)
    this.breakForce = isNumber(data.breakForce) ? data.breakForce : defaults.breakForce
    this.breakTorque = isNumber(data.breakTorque) ? data.breakTorque : defaults.breakTorque
    this.axis = new THREE.Vector3(0, 1, 0)
    this.limitY = isNumber(data.limitY) ? data.limitY : defaults.limitY
    this.limitZ = isNumber(data.limitZ) ? data.limitZ : defaults.limitZ
    this.limitMin = isNumber(data.limitMin) ? data.limitMin : defaults.limitMin
    this.limitMax = isNumber(data.limitMax) ? data.limitMax : defaults.limitMax
    this.limitStiffness = isNumber(data.limitStiffness) ? data.limitStiffness : defaults.limitStiffness
    this.limitDamping = isNumber(data.limitDamping) ? data.limitDamping : defaults.limitDamping
    this.collide = isBoolean(data.collide) ? data.collide : defaults.collide

    this.frame0 = null
    this.frame1 = null
  }

  mount() {
    const actor0 = this.body0?.actor as PhysX.PxRigidActor | null | undefined
    const actor1 = this.body1?.actor as PhysX.PxRigidActor | null | undefined
    if (!actor0 && !actor1) return // at least one required
    // Create PxTransform objects if they don't exist
    const PHYSX = getPhysX();
    if (!PHYSX) return; // PhysX not available
    
    if (!this.frame0) {
      // Use createTransform helper that handles the creation properly
      this.frame0 = createTransform(new THREE.Vector3(), new THREE.Quaternion());
    }
    if (!this.frame1) {
      this.frame1 = createTransform(new THREE.Vector3(), new THREE.Quaternion());
    }
    
    // Ensure frames are not null
    if (!this.frame0 || !this.frame1) return;
    
    const frame0 = this.frame0;
    const frame1 = this.frame1;

    if (this.type === 'fixed') {
      // add offsets to transform
      const offset0 = this.offset0 as Vector3WithPxTransform
      if (offset0.toPxTransform) {
        offset0.toPxTransform(frame0)
      }
      const offset1 = this.offset1 as Vector3WithPxTransform
      if (offset1.toPxTransform) {
        offset1.toPxTransform(frame1)
      }
      // add orientations to transform (note: dont think fixed joints even need these)
      const quat0 = this.quaternion0 as QuaternionWithPxTransform
      if (quat0.toPxTransform) {
        quat0.toPxTransform(frame0)
      }
      const quat1 = this.quaternion1 as QuaternionWithPxTransform
      if (quat1.toPxTransform) {
        quat1.toPxTransform(frame1)
      }
      // make joint - ensure actors are valid
      const world = this.ctx;
      const worldPhysics = world?.physics as { physics?: PxPhysics } | undefined;
      if (worldPhysics?.physics && (actor0 || actor1)) {
        if ('PxFixedJointCreate' in PHYSX) {
        this.joint = (PHYSX as { PxFixedJointCreate: (physics: PxPhysics, actor0: PhysX.PxRigidActor | null, frame0: PhysX.PxTransform, actor1: PhysX.PxRigidActor | null, frame1: PhysX.PxTransform) => PhysXJoint }).PxFixedJointCreate(worldPhysics.physics, actor0 as PhysX.PxRigidActor | null, frame0, actor1 as PhysX.PxRigidActor | null, frame1);
        }
      }
    }

    if (this.type === 'socket') {
      // add offsets to transform
      const offset0 = this.offset0 as Vector3WithPxTransform
      if (offset0.toPxTransform) {
        offset0.toPxTransform(frame0)
      }
      const offset1 = this.offset1 as Vector3WithPxTransform  
      if (offset1.toPxTransform) {
        offset1.toPxTransform(frame1)
      }
      const alignRotation = _q1.setFromUnitVectors(_v1, this.axis)
      const q1 = _q2.copy(this.quaternion0).multiply(alignRotation) as QuaternionWithPxTransform
      const q2 = _q2.copy(this.quaternion1).multiply(alignRotation) as QuaternionWithPxTransform
      if (q1.toPxTransform) {
        q1.toPxTransform(frame0)
      }
      if (q2.toPxTransform) {
        q2.toPxTransform(frame1)
      }
      // make joint - ensure actors are valid
      const world = this.ctx;  
      const worldPhysics = world?.physics as { physics?: PxPhysics } | undefined;
      if (worldPhysics?.physics && (actor0 || actor1)) {
        if ('PxSphericalJointCreate' in PHYSX) {
        this.joint = (PHYSX as { PxSphericalJointCreate: (physics: PxPhysics, actor0: PhysX.PxRigidActor | null, frame0: PhysX.PxTransform, actor1: PhysX.PxRigidActor | null, frame1: PhysX.PxTransform) => PhysXJoint }).PxSphericalJointCreate(worldPhysics.physics, actor0 as PhysX.PxRigidActor | null, frame0, actor1 as PhysX.PxRigidActor | null, frame1);
        }
      }
      // apply cone limit
      if (isNumber(this.limitY) && isNumber(this.limitZ)) {
        let spring
        if (isNumber(this.limitStiffness) && isNumber(this.limitDamping)) {
          spring = new PHYSX.PxSpring(this.limitStiffness, this.limitDamping)
        }
        const cone = new PHYSX.PxJointLimitCone(this.limitY * DEG2RAD, this.limitZ * DEG2RAD, spring)
        if (this.joint) {
          this.joint.setLimitCone!(cone)
          this.joint.setSphericalJointFlag!(PHYSX.PxSphericalJointFlagEnum.eLIMIT_ENABLED, true)
        }
        if (PHYSX.destroy) {
          PHYSX.destroy(cone)
          if (spring) PHYSX.destroy(spring)
        }
      }
    }

    if (this.type === 'hinge') {
      // add offsets to transform
      const offset0 = this.offset0 as Vector3WithPxTransform
      if (offset0.toPxTransform) {
        offset0.toPxTransform(frame0)
      }
      const offset1 = this.offset1 as Vector3WithPxTransform
      if (offset1.toPxTransform) {
        offset1.toPxTransform(frame1)
      }
      const alignRotation = _q1.setFromUnitVectors(_v1, this.axis)
      const q1 = _q2.copy(this.quaternion0).multiply(alignRotation) as QuaternionWithPxTransform
      const q2 = _q2.copy(this.quaternion1).multiply(alignRotation) as QuaternionWithPxTransform
      if (q1.toPxTransform) {
        q1.toPxTransform(frame0)
      }
      if (q2.toPxTransform) {
        q2.toPxTransform(frame1)
      }
      // make joint - ensure actors are valid
      const world = this.ctx;
      const worldPhysics = world?.physics as { physics?: PxPhysics } | undefined;
      if (worldPhysics?.physics && (actor0 || actor1)) {
        if ('PxRevoluteJointCreate' in PHYSX) {
        this.joint = (PHYSX as { PxRevoluteJointCreate: (physics: PxPhysics, actor0: PhysX.PxRigidActor | null, frame0: PhysX.PxTransform, actor1: PhysX.PxRigidActor | null, frame1: PhysX.PxTransform) => PhysXJoint }).PxRevoluteJointCreate(worldPhysics.physics, actor0 as PhysX.PxRigidActor | null, frame0, actor1 as PhysX.PxRigidActor | null, frame1);
        }
      }
      // apply limits
      if (isNumber(this.limitMin) && isNumber(this.limitMax)) {
        let spring
        if (isNumber(this.limitStiffness) && isNumber(this.limitDamping)) {
          spring = new PHYSX.PxSpring(this.limitStiffness, this.limitDamping)
        }
        const limit = new PHYSX.PxJointAngularLimitPair(this.limitMin * DEG2RAD, this.limitMax * DEG2RAD, spring)
        if (this.joint) {
          this.joint.setLimit!(limit)
          this.joint.setRevoluteJointFlag!(PHYSX.PxRevoluteJointFlagEnum.eLIMIT_ENABLED, true)
        }
        if (PHYSX.destroy) {
          PHYSX.destroy(limit)
          if (spring) PHYSX.destroy(spring)
        }
      }
    }

    if (this.type === 'distance') {
      // add offsets to transform
      const offset0 = this.offset0 as Vector3WithPxTransform
      const offset1 = this.offset1 as Vector3WithPxTransform
      if (offset0.toPxTransform) {
        offset0.toPxTransform(frame0)
      }
      if (offset1.toPxTransform) {
        offset1.toPxTransform(frame1)
      }
      // create rotation to align X-axis with desired axis and apply
      // const alignRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.axis)
      // _q1.copy(this.quaternion0).multiply(alignRotation).toPxTransform(frame0)
      // _q2.copy(this.quaternion1).multiply(alignRotation).toPxTransform(frame1)
      // make joint - ensure actors are valid
      const world = this.ctx;
      const worldPhysics = world?.physics as { physics?: PxPhysics } | undefined;
      if (worldPhysics?.physics && (actor0 || actor1)) {
        if ('PxDistanceJointCreate' in PHYSX) {
        this.joint = (PHYSX as { PxDistanceJointCreate: (physics: PxPhysics, actor0: PhysX.PxRigidActor | null, frame0: PhysX.PxTransform, actor1: PhysX.PxRigidActor | null, frame1: PhysX.PxTransform) => PhysXJoint }).PxDistanceJointCreate(worldPhysics.physics, actor0 as PhysX.PxRigidActor | null, frame0, actor1 as PhysX.PxRigidActor | null, frame1);
        }
      }
      // apply limits
      if (this.joint?.setMinDistance) {
        this.joint.setMinDistance(this.limitMin)
      }
      if (this.joint?.setMaxDistance) {
        this.joint.setMaxDistance(this.limitMax)
      }
      if (PHYSX.PxDistanceJointFlagEnum) {
        if (this.joint?.setDistanceJointFlag) {
          this.joint.setDistanceJointFlag(PHYSX.PxDistanceJointFlagEnum.eMIN_DISTANCE_ENABLED, true)
          this.joint.setDistanceJointFlag(PHYSX.PxDistanceJointFlagEnum.eMAX_DISTANCE_ENABLED, true)
        }
      }
      if (this.limitStiffness != null && this.limitDamping != null && this.joint) {
        this.joint.setStiffness!(this.limitStiffness)
        this.joint.setDamping!(this.limitDamping)
        if (PHYSX.PxDistanceJointFlagEnum && this.joint.setDistanceJointFlag) {
          this.joint.setDistanceJointFlag(PHYSX.PxDistanceJointFlagEnum.eSPRING_ENABLED, true)
        }
      }
    }

    if (this.collide && PHYSX.PxConstraintFlagEnum && this.joint) {
      this.joint.setConstraintFlag!(PHYSX.PxConstraintFlagEnum.eCOLLISION_ENABLED, true)
    }
    this.joint?.setBreakForce(this.breakForce, this.breakTorque)
    this.needsRebuild = false
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      // ...
    }
  }

  unmount() {
    this.joint?.release()
    this.joint = null
  }

  copy(source: Joint, recursive: boolean) {
    super.copy(source, recursive)
    this.type = source.type
    this.body0 = source.body0
    this.offset0.copy(source.offset0)
    this.quaternion0.copy(source.quaternion0)
    this.body1 = source.body1
    this.offset1.copy(source.offset1)
    this.quaternion1.copy(source.quaternion1)
    this.breakForce = source.breakForce
    this.breakTorque = source.breakTorque
    this.axis.copy(source.axis)
    this.limitY = source.limitY
    this.limitZ = source.limitZ
    this.limitMin = source.limitMin
    this.limitMax = source.limitMax
    this.limitStiffness = source.limitStiffness
    this.limitDamping = source.limitDamping
    this.collide = source.collide
    return this
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get type() {
          return self.type
        },
        set type(value) {
          if (self.type === value) return
          if (!types.includes(value)) throw new Error(`[joint] invalid type: ${value}`)
          self.type = value
          self.needsRebuild = true
          self.setDirty()
        },
        get body0() {
          return self.body0?.getProxy() || null
        },
        set body0(value: unknown) {
          if (value) {
            // Handle ref objects
            const refValue = (value as { _ref?: RigidBody })?._ref;
            self.body0 = refValue || (value as RigidBody);
          } else {
            self.body0 = null;
          }
          self.needsRebuild = true
          self.setDirty()
        },
        get offset0() {
          return self.offset0
        },
        get quaternion0() {
          return self.quaternion0
        },
        get rotation0() {
          return self.rotation0
        },
        get body1() {
          return self.body1?.getProxy() || null
        },
        set body1(value: unknown) {
          if (value) {
            // Handle ref objects
            const refValue = (value as { _ref?: RigidBody })?._ref;
            self.body1 = refValue || (value as RigidBody);
          } else {
            self.body1 = null;
          }
          self.needsRebuild = true
          self.setDirty()
        },
        get offset1() {
          return self.offset1
        },
        get quaternion1() {
          return self.quaternion1
        },
        get rotation1() {
          return self.rotation1
        },
        get breakForce() {
          return self.breakForce
        },
        set breakForce(value) {
          self.breakForce = isNumber(value) ? value : defaults.breakForce
          self.needsRebuild = true
          self.setDirty()
        },
        get breakTorque() {
          return self.breakTorque
        },
        set breakTorque(value) {
          self.breakTorque = isNumber(value) ? value : defaults.breakTorque
          self.needsRebuild = true
          self.setDirty()
        },
        get limitY() {
          return self.limitY
        },
        set limitY(value) {
          self.limitY = value
          self.needsRebuild = true
          self.setDirty()
        },
        get axis() {
          return self.axis
        },
        get limitZ() {
          return self.limitZ
        },
        set limitZ(value) {
          self.limitZ = value
          self.needsRebuild = true
          self.setDirty()
        },
        get limitMin() {
          return self.limitMin
        },
        set limitMin(value) {
          self.limitMin = value
          self.needsRebuild = true
          self.setDirty()
        },
        get limitMax() {
          return self.limitMax
        },
        set limitMax(value) {
          self.limitMax = value
          self.needsRebuild = true
          self.setDirty()
        },
        get limitStiffness() {
          return self.limitStiffness
        },
        set limitStiffness(value) {
          self.limitStiffness = value
          self.needsRebuild = true
          self.setDirty()
        },
        get limitDamping() {
          return self.limitDamping
        },
        set limitDamping(value) {
          self.limitDamping = value
          self.needsRebuild = true
          self.setDirty()
        },
        get collide() {
          return self.collide
        },
        set collide(value) {
          self.collide = value
          self.needsRebuild = true
          self.setDirty()
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
