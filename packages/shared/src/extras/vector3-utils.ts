import THREE from './three';
import type { PxVec3, PxTransform } from '../types/physics';
import { getPhysX } from '../PhysXManager';

/**
 * PhysX Vector3 conversion utilities
 */
export function vector3ToPxVec3(vector: THREE.Vector3, pxVec3?: PxVec3): PxVec3 | undefined {
  const PHYSX = getPhysX();
  if (!pxVec3 && PHYSX) {
    // PxVec3 is structurally compatible; cast the constructor generically
    pxVec3 = new PHYSX.PxVec3() as PxVec3;
  }
  if (pxVec3) {
    pxVec3.x = vector.x;
    pxVec3.y = vector.y;
    pxVec3.z = vector.z;
  }
  return pxVec3;
}

export function pxVec3ToVector3(pxVec3: PxVec3, target?: THREE.Vector3): THREE.Vector3 {
  if (!target) {
    target = new THREE.Vector3();
  }
  target.set(pxVec3.x, pxVec3.y, pxVec3.z);
  return target;
}

export function vector3ToPxExtVec3(vector: THREE.Vector3, pxExtVec3?: PxVec3): PxVec3 | undefined {
  const PHYSX = getPhysX();
  if (!pxExtVec3 && PHYSX) {
    pxExtVec3 = new PHYSX.PxVec3() as PxVec3;
  }
  if (pxExtVec3) {
    pxExtVec3.x = vector.x;
    pxExtVec3.y = vector.y;
    pxExtVec3.z = vector.z;
  }
  return pxExtVec3;
}

export function vector3ToPxTransform(vector: THREE.Vector3, pxTransform: PxTransform): void {
  if (pxTransform && pxTransform.p) {
    pxTransform.p.x = vector.x;
    pxTransform.p.y = vector.y;
    pxTransform.p.z = vector.z;
  }
}

/**
 * Clone a vector to ensure a new instance
 */
export function cloneVector3(vec: THREE.Vector3 | { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(vec.x, vec.y, vec.z)
}

/**
 * Convert to a plain object (useful for serialization)
 */
export function toVector3Object(vec: THREE.Vector3 | { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return { x: vec.x, y: vec.y, z: vec.z }
}

/**
 * Observable Vector3 wrapper for change detection
 */
export class ObservableVector3 {
  private _vector: THREE.Vector3;
  private _onChange?: () => void;
  
  constructor(x = 0, y = 0, z = 0) {
    this._vector = new THREE.Vector3(x, y, z);
  }
  
  get x(): number {
    return this._vector.x;
  }
  
  set x(value: number) {
    this._vector.x = value;
    this._onChange?.();
  }
  
  get y(): number {
    return this._vector.y;
  }
  
  set y(value: number) {
    this._vector.y = value;
    this._onChange?.();
  }
  
  get z(): number {
    return this._vector.z;
  }
  
  set z(value: number) {
    this._vector.z = value;
    this._onChange?.();
  }
  
  set(x: number, y: number, z: number): this {
    this._vector.set(x, y, z);
    this._onChange?.();
    return this;
  }
  
  copy(v: THREE.Vector3): this {
    this._vector.copy(v);
    this._onChange?.();
    return this;
  }
  
  onChange(callback: () => void): this {
    this._onChange = callback;
    return this;
  }
  
  toVector3(): THREE.Vector3 {
    return this._vector.clone();
  }
  
  fromArray(array: number[], offset = 0): this {
    this._vector.fromArray(array, offset);
    this._onChange?.();
    return this;
  }
}