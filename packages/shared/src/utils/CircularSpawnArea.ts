 
import type { Position3D as Vector3, Position3D } from '../types';
import type { SpawnArea } from '../types/components';
import { calculateDistance2D } from '../utils/EntityUtils';
import THREE from '../extras/three';

const _v1 = new THREE.Vector3()

/**
 * Circular spawn area implementation
 */
export class CircularSpawnArea implements SpawnArea {
  type = 'circular' as const;
  avoidOverlap: boolean;
  minSpacing: number;
  maxHeight: number;
  minHeight: number;
  center: Position3D;
  width: number; // Not used for circular areas but required by interface
  height: number; // Not used for circular areas but required by interface
  
  constructor(
    center: Vector3,
    public radius: number,
    minSpacing: number = 1,
    avoidOverlap: boolean = true,
    maxHeight: number = 0,
    minHeight: number = 0
  ) {
    this.minSpacing = minSpacing;
    this.avoidOverlap = avoidOverlap;
    this.maxHeight = maxHeight;
    this.minHeight = minHeight;
    this.center = { x: center.x, y: center.y, z: center.z };
    // Set width/height to diameter for circular areas
    this.width = radius * 2;
    this.height = radius * 2;
  }
  
  /**
   * Get a random position within the circular area
   */
  getRandomPosition(): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * this.radius;
    
    const yOffset = this.maxHeight > 0 ? (Math.random() - 0.5) * this.maxHeight * 2 : 0;
    
    return _v1.set(
      this.center.x + Math.cos(angle) * distance,
      this.center.y + yOffset,
      this.center.z + Math.sin(angle) * distance
    );
  }

  /**
   * Generate position method required by SpawnArea interface
   */
  generatePosition(): Position3D | null {
    const pos = this.getRandomPosition();
    return { x: pos.x, y: pos.y, z: pos.z };
  }
  
  /**
   * Check if position is valid within the area
   */
  isValidPosition(position: Position3D): boolean {
    const distance = this.distance(position as Vector3, this.center as Vector3);
    return distance <= this.radius;
  }
  
  /**
   * Calculate distance between two positions (2D only)
   */
  private distance(a: Vector3, b: Vector3): number {
    return calculateDistance2D(a, b);
  }
  
  /**
   * Check if position is within bounds (required by SpawnArea interface)
   */
  isWithinBounds(position: Position3D): boolean {
    return this.isValidPosition(position);
  }

  /**
   * Check if position is contained within the area (required by SpawnArea interface)
   */
  contains(position: Position3D): boolean {
    return this.isValidPosition(position);
  }
} 