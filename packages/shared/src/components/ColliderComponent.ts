import type { PxRigidBody, PxShape } from '../types/physics';
import type { Entity } from '../entities/Entity';
import THREE from '../extras/three';
import { Component } from './Component';

// Use THREE types directly since they are the actual instances
type Vector3 = THREE.Vector3;

/**
 * Collider Component
 * 
 * Manages physics collision detection for entities.
 * Integrates with the physics system for collision events.
 */
export class ColliderComponent extends Component {
  private physicsHandle?: PxRigidBody | PxShape;
  
  constructor(entity: Entity, data: {
    type?: 'box' | 'sphere' | 'capsule' | 'mesh';
    size?: Vector3 | { x?: number; y?: number; z?: number };
    radius?: number;
    height?: number;
    isTrigger?: boolean;
    material?: {
      friction?: number;
      restitution?: number;
      density?: number;
    };
    layers?: string[];
    [key: string]: unknown;
  } = {}) {
    const sizeInput = data.size || { x: 1, y: 1, z: 1 };
    // Convert to Vector3 - both types have x, y, z properties
    const sizeVector = new THREE.Vector3(
      sizeInput.x !== undefined ? sizeInput.x : 1,
      sizeInput.y !== undefined ? sizeInput.y : 1,
      sizeInput.z !== undefined ? sizeInput.z : 1
    );
    super('collider', entity, {
      type: 'box',
      size: sizeVector,
      radius: 0.5,
      height: 1,
      isTrigger: false,
      material: {
        friction: 0.5,
        restitution: 0.3,
        density: 1.0
      },
      layers: ['default'],
      ...data
    });
  }
  
  get colliderType(): 'box' | 'sphere' | 'capsule' | 'mesh' {
    return this.get<'box' | 'sphere' | 'capsule' | 'mesh'>('type') || 'box';
  }
  
  set colliderType(value: 'box' | 'sphere' | 'capsule' | 'mesh') {
    this.set('type', value);
    this.updatePhysicsShape();
  }
  
  get size(): Vector3 {
    return this.get<Vector3>('size')!;
  }
  
  set size(value: Vector3 | { x: number; y: number; z: number }) {
    const currentSize = this.get<Vector3>('size');
    // Both types have x, y, z properties - use them directly
    if (currentSize) {
      currentSize.set(value.x, value.y, value.z);
    } else {
      this.set('size', new THREE.Vector3(value.x, value.y, value.z));
    }
    this.updatePhysicsShape();
  }
  
  get radius(): number {
    return this.get<number>('radius') || 0.5;
  }
  
  set radius(value: number) {
    this.set('radius', Math.max(0, value));
    this.updatePhysicsShape();
  }
  
  get height(): number {
    return this.get<number>('height') || 1;
  }
  
  set height(value: number) {
    this.set('height', Math.max(0, value));
    this.updatePhysicsShape();
  }
  
  get isTrigger(): boolean {
    return this.get<boolean>('isTrigger') || false;
  }
  
  set isTrigger(value: boolean) {
    this.set('isTrigger', value);
    this.updatePhysicsProperties();
  }
  
  get material(): { friction: number; restitution: number; density: number } {
    return this.get<{ friction: number; restitution: number; density: number }>('material') || {
      friction: 0.5,
      restitution: 0.3,
      density: 1.0
    };
  }
  
  set material(value: { friction?: number; restitution?: number; density?: number }) {
    const current = this.material;
    this.set('material', {
      ...current,
      ...value
    });
    this.updatePhysicsProperties();
  }
  
  get layers(): string[] {
    return this.get<string[]>('layers') || ['default'];
  }
  
  set layers(value: string[]) {
    this.set('layers', value);
    this.updatePhysicsProperties();
  }
  
  // Get physics handle (for advanced use)
  getPhysicsHandle(): PxRigidBody | PxShape | undefined {
    return this.physicsHandle;
  }
  
  // Check if collider is currently colliding with another entity
  isCollidingWith(otherEntity: Entity): boolean {
    const otherCollider = otherEntity.getComponent<ColliderComponent>('collider');
    if (!otherCollider || !this.physicsHandle || !otherCollider.physicsHandle) {
      return false;
    }
    
    // TODO: Implement collision checking using physics system events
    // The Physics system doesn't expose direct collision checking methods
    console.warn('isCollidingWith is not yet implemented - use collision events instead');
    return false;
  }
  
  // Get all entities currently colliding with this one
  getCollidingEntities(): Entity[] {
    if (!this.physicsHandle) return [];
    
    // TODO: Implement collision tracking using physics system events
    // The Physics system doesn't expose direct collision querying methods
    console.warn('getCollidingEntities is not yet implemented - track collisions through events');
    return [];
  }
  
  // Set collision event callbacks
  onCollisionEnter(callback: (other: Entity) => void): void {
    this.entity.world.on(`collision:enter:${this.entity.id}`, (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    });
  }
  
  onCollisionExit(callback: (other: Entity) => void): void {
    this.entity.world.on(`collision:exit:${this.entity.id}`, (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    });
  }
  
  onTriggerEnter(callback: (other: Entity) => void): void {
    this.entity.world.on(`trigger:enter:${this.entity.id}`, (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    });
  }
  
  onTriggerExit(callback: (other: Entity) => void): void {
    this.entity.world.on(`trigger:exit:${this.entity.id}`, (...args: unknown[]) => {
      const other = args[0] as Entity;
      callback(other);
    });
  }
  
  private updatePhysicsShape(): void {
    if (!this.entity.world.physics) return;
    
    // TODO: Implement proper physics shape creation
    // The current Physics system doesn't expose createCollider method
    // Need to work with RigidBody nodes instead
    console.warn('updatePhysicsShape is not implemented - ColliderComponent needs refactoring');
  }
  
  private updatePhysicsProperties(): void {
    if (!this.physicsHandle || !this.entity.world.physics) return;
    
    // TODO: Implement proper physics properties update
    // The current Physics system doesn't expose updateCollider method
    console.warn('updatePhysicsProperties is not implemented - ColliderComponent needs refactoring');
  }
  
  init(): void {
    this.updatePhysicsShape();
  }
  
  destroy(): void {
    // TODO: Implement proper cleanup
    // The current removeCollider method expects PxShape, not PxRigidBody
    if (this.physicsHandle) {
      console.warn('ColliderComponent cleanup not implemented');
      this.physicsHandle = undefined;
    }
  }
}