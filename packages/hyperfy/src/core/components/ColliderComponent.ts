import { Component } from './Component';
import type { Entity } from '../entities/Entity';
import type { Vector3 } from '../../types';
import * as THREE from '../extras/three';

/**
 * Collider Component
 * 
 * Manages physics collision detection for entities.
 * Integrates with the physics system for collision events.
 */
export class ColliderComponent extends Component {
  private physicsHandle?: any;
  
  constructor(entity: Entity, data: {
    type?: 'box' | 'sphere' | 'capsule' | 'mesh';
    size?: Vector3;
    radius?: number;
    height?: number;
    isTrigger?: boolean;
    material?: {
      friction?: number;
      restitution?: number;
      density?: number;
    };
    layers?: string[];
    [key: string]: any;
  } = {}) {
    super('collider', entity, {
      type: 'box',
      size: data.size || new THREE.Vector3(1, 1, 1),
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
    const size = this.get<any>('size');
    if (size instanceof THREE.Vector3) {
      return size;
    }
    // Convert plain object to THREE.Vector3
    return new THREE.Vector3(size?.x || 1, size?.y || 1, size?.z || 1);
  }
  
  set size(value: Vector3) {
    // Ensure we store a THREE.Vector3 instance
    const vec3 = value instanceof THREE.Vector3 
      ? value 
      : new THREE.Vector3(value.x, value.y, value.z);
    this.set('size', vec3);
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
    return this.get<any>('material') || {
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
  getPhysicsHandle(): any {
    return this.physicsHandle;
  }
  
  // Check if collider is currently colliding with another entity
  isCollidingWith(otherEntity: Entity): boolean {
    const otherCollider = otherEntity.getComponent<ColliderComponent>('collider');
    if (!otherCollider || !this.physicsHandle || !otherCollider.physicsHandle) {
      return false;
    }
    
    // Use physics system to check collision (method may not be available)
    const physics = this.entity.world.physics as any;
    return physics?.isColliding?.(this.physicsHandle, otherCollider.physicsHandle) || false;
  }
  
  // Get all entities currently colliding with this one
  getCollidingEntities(): Entity[] {
    if (!this.physicsHandle) return [];
    
    const physics = this.entity.world.physics as any;
    const collisions = physics?.getCollisions?.(this.physicsHandle) || [];
    return collisions
      .map((handle: any) => handle.entity)
      .filter((entity: Entity) => entity && entity !== this.entity);
  }
  
  // Set collision event callbacks
  onCollisionEnter(callback: (other: Entity) => void): void {
    this.entity.world.events?.on(`collision:enter:${this.entity.id}`, callback);
  }
  
  onCollisionExit(callback: (other: Entity) => void): void {
    this.entity.world.events?.on(`collision:exit:${this.entity.id}`, callback);
  }
  
  onTriggerEnter(callback: (other: Entity) => void): void {
    this.entity.world.events?.on(`trigger:enter:${this.entity.id}`, callback);
  }
  
  onTriggerExit(callback: (other: Entity) => void): void {
    this.entity.world.events?.on(`trigger:exit:${this.entity.id}`, callback);
  }
  
  private updatePhysicsShape(): void {
    if (!this.entity.world.physics) return;
    
    // Remove existing physics body
    if (this.physicsHandle) {
      const physics = this.entity.world.physics as any;
      physics?.removeCollider?.(this.physicsHandle);
      this.physicsHandle = undefined;
    }
    
    // Create new physics body based on type
    const transform = this.entity.getComponent('transform') as any;
    const position = transform?.position || { x: 0, y: 0, z: 0 };
    const rotation = transform?.rotation || { x: 0, y: 0, z: 0, w: 1 };
    
    const shapeData = {
      type: this.colliderType,
      size: this.size,
      radius: this.radius,
      height: this.height,
      position,
      rotation,
      entity: this.entity
    };
    
    const physics = this.entity.world.physics as any;
    this.physicsHandle = physics?.createCollider?.(shapeData);
    this.updatePhysicsProperties();
  }
  
  private updatePhysicsProperties(): void {
    if (!this.physicsHandle || !this.entity.world.physics) return;
    
    // Update physics properties
    const physics = this.entity.world.physics as any;
    physics?.updateCollider?.(this.physicsHandle, {
      isTrigger: this.isTrigger,
      material: this.material,
      layers: this.layers
    });
  }
  
  init(): void {
    this.updatePhysicsShape();
  }
  
  destroy(): void {
    if (this.physicsHandle && this.entity.world.physics) {
      this.entity.world.physics.removeCollider(this.physicsHandle);
      this.physicsHandle = undefined;
    }
  }
}