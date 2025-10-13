/**
 * PhysX Utility Functions
 * 
 * Vector conversions between Three.js and PhysX, transform operations,
 * and Three.js prototype extensions for physics integration.
 */

import type PhysX from '@hyperscape/physx-js-webidl';
import type {
  PxQuat,
  PxTransform,
  PxVec3,
  PxActor,
  PxContactPairHeader,
  PhysXModule
} from '../types/physics';
import THREE from '../extras/three';
import { getPhysX } from '../PhysXManager';

const _v1 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _s1 = new THREE.Vector3()

/**
 * Convert Three.js Vector3 to PhysX PxVec3
 */
export function vector3ToPxVec3(
  vector: THREE.Vector3, 
  target?: PxVec3
): PhysX.PxVec3 {
  const PHYSX = getPhysX()!;

  if (target) {
    target.x = vector.x;
    target.y = vector.y;
    target.z = vector.z;
    return target;
  }

  return new PHYSX.PxVec3(vector.x, vector.y, vector.z);
}

/**
 * Convert PhysX PxVec3 to Three.js Vector3
 */
export function pxVec3ToVector3(
  pxVec3: PxVec3, 
  target?: THREE.Vector3
): THREE.Vector3 {
  if (target) {
    return target.set(pxVec3.x, pxVec3.y, pxVec3.z);
  }
  return new THREE.Vector3(pxVec3.x, pxVec3.y, pxVec3.z);
}

/**
 * Convert Three.js Quaternion to PhysX PxQuat
 */
export function quaternionToPxQuat(
  quaternion: THREE.Quaternion, 
  target?: PxQuat
): PhysX.PxQuat {
  const PHYSX = getPhysX()!;

  if (target) {
    target.x = quaternion.x;
    target.y = quaternion.y;
    target.z = quaternion.z;
    target.w = quaternion.w;
    return target;
  }

  return new PHYSX.PxQuat(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
}

/**
 * Convert PhysX PxQuat to Three.js Quaternion
 */
export function pxQuatToQuaternion(
  pxQuat: PxQuat,
  target?: THREE.Quaternion
): THREE.Quaternion {
  if (target) {
    return target.set(pxQuat.x, pxQuat.y, pxQuat.z, pxQuat.w);
  }
  return new THREE.Quaternion(pxQuat.x, pxQuat.y, pxQuat.z, pxQuat.w);
}

/**
 * Set position component of PxTransform from Three.js Vector3
 */
export function setTransformPosition(
  transform: PxTransform, 
  position: THREE.Vector3
): void {
  transform.p.x = position.x;
  transform.p.y = position.y;
  transform.p.z = position.z;
}

/**
 * Set rotation component of PxTransform from Three.js Quaternion
 */
export function setTransformRotation(
  transform: PxTransform,
  quaternion: THREE.Quaternion
): void {
  transform.q.x = quaternion.x;
  transform.q.y = quaternion.y;
  transform.q.z = quaternion.z;
  transform.q.w = quaternion.w;
}

/**
 * Set PxTransform from Three.js Matrix4
 */
export function setTransformFromMatrix4(
  transform: PxTransform,
  matrix: THREE.Matrix4
): void {
  matrix.decompose(_v1, _q1, _s1)

  setTransformPosition(transform, _v1)
  setTransformRotation(transform, _q1)
}

/**
 * Create a new PxTransform from position and quaternion
 */
export function createTransform(
  position: THREE.Vector3,
  quaternion: THREE.Quaternion
): PhysX.PxTransform {
  const PHYSX = getPhysX()!;

  const pxPosition = vector3ToPxVec3(position);
  const pxQuaternion = quaternionToPxQuat(quaternion);
  
  const transform = new PHYSX.PxTransform(pxPosition, pxQuaternion);
  
  // Clean up temporary vectors
  cleanupPxVec3(pxPosition);
  
  return transform;
}

/**
 * Utility to clean up PhysX vectors
 */
export function cleanupPxVec3(vec: PxVec3 | PhysX.PxVec3): void {
  const maybeAny = vec as unknown as { delete?: () => void };
  if (maybeAny.delete) {
    maybeAny.delete();
  }
}

/**
 * Install THREE.js prototype extensions for physics transformations
 * 
 * This extends Vector3 and Quaternion prototypes with physics transformation methods
 */
export function installThreeJSExtensions(): void {
  // Extend Vector3 prototype with physics transform method
  if (!THREE.Vector3.prototype.toPxTransform) {
    THREE.Vector3.prototype.toPxTransform = function(this: THREE.Vector3, transform: PxTransform): void {
      const PHYSX = getPhysX()!;
      const pxVec = new PHYSX.PxVec3(this.x, this.y, this.z);
      transform.p = pxVec;
    };
  }

  // Extend Quaternion prototype with physics transform method  
  if (!THREE.Quaternion.prototype.toPxTransform) {
    THREE.Quaternion.prototype.toPxTransform = function(this: THREE.Quaternion, transform: PxTransform): void {
      const PHYSX = getPhysX()!;
      const pxQuat = new PHYSX.PxQuat(this.x, this.y, this.z, this.w);
      transform.q = pxQuat;
    };
  }

  // Extend Matrix4 prototype with physics transform method
  if (!THREE.Matrix4.prototype.toPxTransform) {
    THREE.Matrix4.prototype.toPxTransform = function (
      this: THREE.Matrix4,
      transform: PxTransform,
    ): void {
      const PHYSX = getPhysX()!

      this.decompose(_v1, _q1, _s1)

      // Set position
      const pxVec = new PHYSX.PxVec3(_v1.x, _v1.y, _v1.z)
      transform.p = pxVec

      // Set rotation
      const pxQuat = new PHYSX.PxQuat(_q1.x, _q1.y, _q1.z, _q1.w)
      transform.q = pxQuat
    }
  }
}

/**
 * Get actor address directly
 */
export function getActorAddress(actor: PxActor): number | bigint {
  return (actor as PxActor & { _address: number | bigint })._address;
}

/**
 * Create CPU dispatcher
 */
export function createCpuDispatcher(physx: PhysXModule, threads: number): PhysX.PxCpuDispatcher {
  return (physx as PhysXModule & {
    DefaultCpuDispatcherCreate: (numThreads: number) => PhysX.PxDefaultCpuDispatcher;
  }).DefaultCpuDispatcherCreate(threads);
}

/**
 * Get actors from contact pair header
 */
export function getActorsFromHeader(header: PxContactPairHeader): [PxActor, PxActor] {
  const h = header as PxContactPairHeader & { get_actors(index: number): PxActor };
  return [h.get_actors(0), h.get_actors(1)];
}

/**
 * Check if rigid body is kinematic
 */
export function isKinematic(physx: PhysXModule, actor: PxActor): boolean {
  const flags = (actor as PxActor & { getRigidBodyFlags(): { isSet(flag: number): boolean } }).getRigidBodyFlags();
  return flags.isSet(physx.PxRigidBodyFlagEnum!.eKINEMATIC);
}

