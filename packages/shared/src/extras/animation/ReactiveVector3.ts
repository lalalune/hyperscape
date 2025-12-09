/**
 * ReactiveVector3.ts - Change-Detecting Vector3
 *
 * A THREE.Vector3 subclass that provides change detection callbacks.
 * Used in Hyperscape's Node system to automatically update transforms when position changes.
 *
 * Why Reactive:
 * - Nodes need to update their matrix when position/scale changes
 * - Without change detection, manual dirty flagging is error-prone
 * - onChange callback automatically marks nodes as needing matrix update
 *
 * Difference from THREE.Vector3:
 * - Adds _onChange callback that fires on set(), copy(), fromArray()
 * - Adds PhysX conversion methods (toPxVec3, toPxTransform)
 * - Otherwise behaves identically to THREE.Vector3
 *
 * Usage:
 * ```ts
 * const pos = new ReactiveVector3(0, 0, 0);
 * pos.onChange(() => {
 *   console.log('Position changed!');
 *   node.setDirty();
 * });
 *
 * pos.set(1, 2, 3);  // onChange fires
 * ```
 *
 * Referenced by: Node.ts (for position and scale properties)
 */

import type { PxTransform, PxVec3 } from "../../types/systems/physics";
import type PhysX from "@hyperscape/physx-js-webidl";
import THREE from "../three/three";
import {
  setTransformPosition,
  vector3ToPxVec3,
} from "../../utils/physics/PhysicsUtils";

/**
 * ReactiveVector3 - Vector3 with Change Detection
 *
 * Extends THREE.Vector3 to provide automatic change callbacks.
 * Used by Nodes to track when transforms need updating.
 */
export class ReactiveVector3 extends THREE.Vector3 {
  /** Optional change callback (fires when vector is modified) */
  _onChange?: () => void;

  constructor(x = 0, y = 0, z = 0) {
    super(x, y, z);
  }

  /** Override set() to fire onChange callback */
  set(x: number, y: number, z: number): this {
    super.set(x, y, z);
    this._onChange?.();
    return this;
  }

  /** Override copy() to fire onChange callback */
  copy(v: THREE.Vector3): this {
    super.copy(v);
    this._onChange?.();
    return this;
  }

  /** Override fromArray() to fire onChange callback */
  fromArray(array: number[] | Float32Array, offset = 0): this {
    super.fromArray(array, offset);
    this._onChange?.();
    return this;
  }

  /**
   * Register onChange callback.
   *
   * @param callback - Function to call when vector changes
   * @returns this (for method chaining)
   */
  onChange(callback: () => void): this {
    this._onChange = callback;
    return this;
  }

  // ============================================================================
  // PhysX Integration Methods
  // ============================================================================

  /** Convert to PhysX PxVec3 (for physics operations) */
  toPxVec3(pxVec3?: PxVec3): PhysX.PxVec3 | null {
    return (vector3ToPxVec3(this, pxVec3) as unknown as PhysX.PxVec3) || null;
  }

  /** Convert to PhysX extended vec3 (for large coordinates) */
  toPxExtVec3(pxExtVec3?: PxVec3): PhysX.PxVec3 | null {
    return (
      (vector3ToPxVec3(this, pxExtVec3) as unknown as PhysX.PxVec3) || null
    );
  }

  /** Set position of a PhysX transform from this vector */
  toPxTransform(pxTransform: PxTransform): void {
    setTransformPosition(pxTransform, this);
  }
}
