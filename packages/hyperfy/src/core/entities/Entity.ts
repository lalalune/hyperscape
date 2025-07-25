import type { EntityData } from '../../types/core';
import type { 
  Vector3,
  Quaternion,
  World,
  Entity as IEntity,
  Component as IComponent
} from '../../types';
import * as THREE from '../extras/three.js';
import { Component, createComponent, TransformComponent } from '../components';

export class Entity implements IEntity {
  world: World;
  data: EntityData;
  id: string;
  name: string;
  type: string;
  node: any; // THREE.Object3D - using any to avoid type conflicts
  components: Map<string, any>;
  velocity: Vector3;
  isPlayer: boolean;
  active: boolean = true;
  destroyed: boolean = false;
  
  // Physics body reference
  private rigidBody?: any;
  
  constructor(world: World, data: EntityData, local?: boolean) {
    this.world = world;
    this.data = data;
    this.id = data.id;
    this.name = data.name || 'entity';
    this.type = data.type || 'generic';
    this.isPlayer = data.type === 'player';
    
    // Initialize components map
    this.components = new Map();
    
    // Create Three.js node
    this.node = new THREE.Object3D();
    this.node.name = this.name;
    this.node.userData.entity = this;
    
    // Set initial transform
    if (data.position) {
      this.node.position.set(data.position[0], data.position[1], data.position[2]);
    }
    if (data.quaternion) {
      this.node.quaternion.set(data.quaternion[0], data.quaternion[1], data.quaternion[2], data.quaternion[3]);
    }
    if (data.scale) {
      this.node.scale.set(data.scale[0], data.scale[1], data.scale[2]);
    }
    
    // Initialize velocity as THREE.Vector3
    this.velocity = new THREE.Vector3(0, 0, 0);
    
    // Add to world scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(this.node);
    }
    
    // Automatically add transform component for ECS architecture
    this.addComponent('transform', {
      position: this.position,
      rotation: this.rotation,
      scale: this.scale
    });
    
    // Network sync for local entities
    if (local && (this.world as any).network) {
      (this.world as any).network.send('entityAdded', this.serialize());
    }
  }
  
  // Transform getters - return THREE.Vector3 instances
  get position(): Vector3 {
    return this.node.position;
  }
  
  set position(value: Vector3) {
    this.node.position.set(value.x, value.y, value.z);
    this.syncPhysicsTransform();
  }
  
  get rotation(): Quaternion {
    return {
      x: this.node.quaternion.x,
      y: this.node.quaternion.y,
      z: this.node.quaternion.z,
      w: this.node.quaternion.w
    };
  }
  
  set rotation(value: Quaternion) {
    this.node.quaternion.set(value.x, value.y, value.z, value.w);
    this.syncPhysicsTransform();
  }
  
  get scale(): Vector3 {
    return this.node.scale;
  }
  
  set scale(value: Vector3) {
    this.node.scale.set(value.x, value.y, value.z);
  }
  
  // Component management
  addComponent(type: string, data?: any): any {
    // Check if component already exists
    if (this.components.has(type)) {
      console.warn(`Entity ${this.id} already has component ${type}`);
      return this.components.get(type)!;
    }
    
    // Create component using the registry
    const component = createComponent(type, this, data);
    if (!component) {
      throw new Error(`Failed to create component of type: ${type}`);
    }
    
    // Store component
    this.components.set(type, component);
    
    // Initialize component if it has init method
    if (component.init) {
      component.init();
    }
    
    // Handle special component types (legacy compatibility)
    this.handleSpecialComponent(type, component);
    
    // Emit event
    this.world.events?.emit('entity:component:added', {
      entityId: this.id,
      componentType: type,
      component
    });
    
    return component;
  }
  
  removeComponent(type: string): void {
    const component = this.components.get(type);
    if (!component) return;
    
    // Destroy component if it has destroy method
    if (component.destroy) {
      component.destroy();
    }
    
    // Handle special component cleanup
    this.handleSpecialComponentRemoval(type, component);
    
    // Remove from map
    this.components.delete(type);
    
    // Emit event
    this.world.events?.emit('entity:component:removed', {
      entityId: this.id,
      componentType: type
    });
  }
  
  getComponent<T = any>(type: string): T | null {
    return (this.components.get(type) as T) || null;
  }
  
  hasComponent(type: string): boolean {
    return this.components.has(type);
  }
  
  removeAllComponents(): void {
    // Remove all components
    for (const type of Array.from(this.components.keys())) {
      this.removeComponent(type);
    }
  }
  
  // Physics methods
  applyForce(force: Vector3): void {
    if (!this.rigidBody) return;
    
    if (this.world.physics?.world) {
      const physicsForce = new this.world.physics.world.PxVec3(force.x, force.y, force.z);
      this.rigidBody.addForce(physicsForce);
      physicsForce.delete();
    }
  }
  
  applyImpulse(impulse: Vector3): void {
    if (!this.rigidBody) return;
    
    if (this.world.physics?.world) {
      const physicsImpulse = new this.world.physics.world.PxVec3(impulse.x, impulse.y, impulse.z);
      this.rigidBody.addImpulse(physicsImpulse);
      physicsImpulse.delete();
    }
  }
  
  // Set velocity using THREE.Vector3
  setVelocity(vel: Vector3): void {
    if (vel instanceof THREE.Vector3) {
      (this.velocity as THREE.Vector3).copy(vel);
    } else {
      (this.velocity as THREE.Vector3).set(vel.x, vel.y, vel.z);
    }
    
    // Apply to physics body if available
    if (this.rigidBody && this.world.physics) {
      const physics = this.world.physics as any;
      physics.setLinearVelocity?.(this.rigidBody, this.velocity);
    }
  }
  
  // Get velocity returns the THREE.Vector3 instance
  getVelocity(): Vector3 {
    return this.velocity;
  }
  
  // Update methods
  fixedUpdate?(delta: number): void {
    // Update components with fixedUpdate
    for (const component of this.components.values()) {
      if (component.fixedUpdate) {
        component.fixedUpdate(delta);
      }
    }
  }
  
  update?(delta: number): void {
    // Update components with update
    for (const component of this.components.values()) {
      if (component.update) {
        component.update(delta);
      }
    }
  }
  
  lateUpdate?(delta: number): void {
    // Update components with lateUpdate
    for (const component of this.components.values()) {
      if (component.lateUpdate) {
        component.lateUpdate(delta);
      }
    }
  }
  
  // Event handling
  on(event: string, callback: Function): void {
    // Use world event system with entity namespace
    this.world.events?.emit(`entity:${this.id}:${event}`, callback as any);
  }
  
  off(event: string, callback: Function): void {
    // Remove from world event system
    this.world.events?.emit(`entity:${this.id}:${event}:off`, callback as any);
  }
  
  emit(event: string, data?: any): void {
    // Emit through world event system
    this.world.events?.emit(`entity:${this.id}:${event}`, data);
  }
  
  // Serialization
  serialize(): EntityData {
    const serialized: EntityData = {
      id: this.id,
      name: this.name,
      type: this.type,
      position: [this.position.x, this.position.y, this.position.z],
      quaternion: [this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w]
    };
    
    // Add scale if present in original data or not default
    if (this.data.scale || !this.isDefaultScale()) {
      serialized.scale = [this.scale.x, this.scale.y, this.scale.z];
    }
    
    // Copy any additional data fields
    for (const key in this.data) {
      if (key !== 'id' && key !== 'name' && key !== 'type' && 
          key !== 'position' && key !== 'quaternion' && key !== 'scale' &&
          this.data.hasOwnProperty(key)) {
        (serialized as any)[key] = this.data[key];
      }
    }
    
    return serialized;
  }
  
  // Modification from network/data
  modify(data: Partial<EntityData>): void {
    // Update data
    Object.assign(this.data, data);
    
    // Update transform
    if (data.position) {
      this.node.position.set(data.position[0], data.position[1], data.position[2]);
    }
    if (data.quaternion) {
      this.node.quaternion.set(data.quaternion[0], data.quaternion[1], data.quaternion[2], data.quaternion[3]);
    }
    if (data.scale) {
      this.node.scale.set(data.scale[0], data.scale[1], data.scale[2]);
    }
  }
  
  // Network event handling
  onEvent(version: number, name: string, data: any, networkId: string): void {
    // Handle entity-specific network events
    this.world.events?.emit(`entity:${this.id}:network:${name}`, {
      version,
      data,
      networkId
    });
  }
  
  // Destruction
  destroy(local?: boolean): void {
    // Destroy all components
    for (const type of Array.from(this.components.keys())) {
      this.removeComponent(type);
    }
    
    // Remove from scene
    if (this.node.parent) {
      this.node.parent.remove(this.node);
    }
    
    // Clean up physics
    if (this.rigidBody && this.world.physics?.world) {
      // Remove rigid body from physics world
      // Implementation depends on physics engine
    }
    
    // Network sync
    if (local && (this.world as any).network) {
      (this.world as any).network.send('entityRemoved', this.id);
    }
    
    // Emit destroy event
    this.world.events?.emit('entity:destroyed', {
      entityId: this.id
    });
  }
  
  // Helper methods
  syncPhysicsTransform(): void {
    if (!this.rigidBody || !this.world.physics?.world) return;
    
    // Sync Three.js transform to physics body
    const pos = this.position;
    const rot = this.rotation;
    
    const transform = new this.world.physics.world.PxTransform(
      new this.world.physics.world.PxVec3(pos.x, pos.y, pos.z),
      new this.world.physics.world.PxQuat(rot.x, rot.y, rot.z, rot.w)
    );
    
    this.rigidBody.setGlobalPose(transform);
    
    transform.p.delete();
    transform.q.delete();
    transform.delete();
  }
  
  handleSpecialComponent(type: string, component: Component): void {
    switch (type) {
      case 'rigidbody':
        this.createPhysicsBody(component);
        break;
      case 'collider':
        this.updateCollider(component);
        break;
      case 'mesh':
        this.updateMesh(component);
        break;
    }
  }
  
  private handleSpecialComponentRemoval(type: string, component: Component): void {
    switch (type) {
      case 'rigidbody':
        this.removePhysicsBody();
        break;
      case 'mesh':
        this.removeMesh(component);
        break;
    }
  }
  
  private createPhysicsBody(component: Component): void {
    // Create physics rigid body based on component data
    // Implementation depends on physics engine integration
  }
  
  private removePhysicsBody(): void {
    if (this.rigidBody) {
      // Remove from physics world
      this.rigidBody = undefined;
    }
  }
  
  private updateCollider(component: Component): void {
    // Update physics collider shape
    // Implementation depends on physics engine
  }
  
  private updateMesh(component: Component): void {
    // Add/update Three.js mesh from component data
    const meshData = component.data;
    if (meshData.geometry && meshData.material) {
      // Create or update mesh
    }
  }
  
  private removeMesh(component: Component): void {
    // Remove mesh from node
    // Implementation depends on mesh management
  }
  
  private isDefaultRotation(): boolean {
    return this.rotation.x === 0 && this.rotation.y === 0 && 
           this.rotation.z === 0 && this.rotation.w === 1;
  }
  
  private isDefaultScale(): boolean {
    return this.scale.x === 1 && this.scale.y === 1 && this.scale.z === 1;
  }
}
