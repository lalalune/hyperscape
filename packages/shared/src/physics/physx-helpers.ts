/**
 * PhysX Helper Functions
 * 
 * Production-ready PhysX utilities with strong typing and no defensive programming.
 */

import type PhysX from '@hyperscape/physx-js-webidl';
import type {
    PxActor,
    PxContactPairHeader,
    PhysXModule
} from '../types/physics';

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