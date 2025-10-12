import { Component } from './Component';
import type { Entity } from '../entities/Entity';
import THREE from '../extras/three';

/**
 * Transform Component
 * 
 * Stores position, rotation, and scale data for an entity.
 * This is automatically synced with the entity's Three.js node.
 */
export class TransformComponent extends Component {
  constructor(entity: Entity, data: {
    position?: THREE.Vector3 | { x?: number; y?: number; z?: number };
    rotation?: THREE.Quaternion | { x?: number; y?: number; z?: number; w?: number };
    scale?: THREE.Vector3 | { x?: number; y?: number; z?: number };
  } = {}) {
    const position = data.position || { x: 0, y: 0, z: 0 };
    const rotation = data.rotation || { x: 0, y: 0, z: 0, w: 1 };
    const scale = data.scale || { x: 1, y: 1, z: 1 };
    
    // Create THREE objects from provided data - both types have the required properties
    super('transform', entity, {
      position: new THREE.Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0),
      rotation: new THREE.Quaternion(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0, (rotation as { w?: number }).w ?? 1),
      scale: new THREE.Vector3(scale.x ?? 1, scale.y ?? 1, scale.z ?? 1),
    });
  }
  
  get position(): THREE.Vector3 {
    return this.get<THREE.Vector3>('position')!;
  }
  
  set position(value: THREE.Vector3 | { x: number; y: number; z: number }) {
    const currentPosition = this.get<THREE.Vector3>('position');
    // Both types have x, y, z properties - use them directly
    if (currentPosition) {
      currentPosition.set(value.x, value.y, value.z);
    } else {
      this.set('position', new THREE.Vector3(value.x, value.y, value.z));
    }
    this.syncToNode();
  }
  
  get rotation(): THREE.Quaternion {
    return this.get<THREE.Quaternion>('rotation')!;
  }
  
  set rotation(value: THREE.Quaternion | { x: number; y: number; z: number; w: number }) {
    const currentRotation = this.get<THREE.Quaternion>('rotation');
    // Both types have x, y, z, w properties - use them directly
    if (currentRotation) {
      currentRotation.set(value.x, value.y, value.z, value.w);
    } else {
      this.set('rotation', new THREE.Quaternion(value.x, value.y, value.z, value.w));
    }
    this.syncToNode();
  }
  
  get scale(): THREE.Vector3 {
    return this.get<THREE.Vector3>('scale')!;
  }
  
  set scale(value: THREE.Vector3 | { x: number; y: number; z: number }) {
    const currentScale = this.get<THREE.Vector3>('scale');
    // Both types have x, y, z properties - use them directly
    if (currentScale) {
      currentScale.set(value.x, value.y, value.z);
    } else {
      this.set('scale', new THREE.Vector3(value.x, value.y, value.z));
    }
    this.syncToNode();
  }
  
  // Sync component data to the entity's Three.js node
  private syncToNode(): void {
    if (this.entity.node) {
      const pos = this.position;
      const rot = this.rotation;
      const scale = this.scale;
      
      this.entity.node.position.set(pos.x, pos.y, pos.z);
      this.entity.node.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      this.entity.node.scale.set(scale.x, scale.y, scale.z);
    }
  }
  
  init(): void {
    // Initial sync to node
    this.syncToNode();
  }
}