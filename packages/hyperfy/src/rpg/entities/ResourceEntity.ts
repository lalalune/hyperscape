/**
 * ResourceEntity - Harvestable resources like trees and fishing spots
 */

import * as THREE from '../../core/extras/three';
import { RPGEntity, RPGEntityConfig, EntityInteractionData } from './RPGEntity';

export interface ResourceEntityConfig extends RPGEntityConfig {
  resourceType: 'tree' | 'fishing_spot' | 'mining_rock';
  resourceId: string;
  harvestSkill: string;
  requiredLevel: number;
  harvestTime: number;
  respawnTime: number;
  harvestYield: {
    itemId: string;
    quantity: number;
    chance: number;
  }[];
  depleted: boolean;
  lastHarvestTime: number;
}

export class ResourceEntity extends RPGEntity {
  public config: ResourceEntityConfig;

  constructor(world: any, config: ResourceEntityConfig) {
    super(world, config);
    this.config = {
      ...config,
      depleted: config.depleted !== undefined ? config.depleted : false,
      lastHarvestTime: config.lastHarvestTime !== undefined ? config.lastHarvestTime : 0
    };
  }

  protected async onInteract(data: EntityInteractionData): Promise<void> {
    if (data.interactionType !== 'harvest') return;
    
    console.log(`[ResourceEntity] Player ${data.playerId} attempting to harvest ${this.config.resourceType} ${this.config.resourceId}`);
    
    // Check if resource is depleted
    if (this.config.depleted) {
      console.log(`[ResourceEntity] Resource ${this.id} is depleted`);
      return;
    }

    // Send harvest request to resource system
    this.world.emit('resource:harvest_request', {
      playerId: data.playerId,
      entityId: this.id,
      resourceType: this.config.resourceType,
      resourceId: this.config.resourceId,
      harvestSkill: this.config.harvestSkill,
      requiredLevel: this.config.requiredLevel,
      harvestTime: this.config.harvestTime,
      harvestYield: this.config.harvestYield
    });
  }

  public deplete(): void {
    if (!this.world.isServer) return;
    
    this.config.depleted = true;
    this.config.lastHarvestTime = Date.now();
    this.markNetworkDirty();
    
    // Schedule respawn
    setTimeout(() => {
      this.respawn();
    }, this.config.respawnTime);
    
    console.log(`[ResourceEntity] Resource ${this.id} depleted, will respawn in ${this.config.respawnTime}ms`);
  }

  public respawn(): void {
    if (!this.world.isServer) return;
    
    this.config.depleted = false;
    this.markNetworkDirty();
    
    console.log(`[ResourceEntity] Resource ${this.id} respawned`);
  }

  public getNetworkData(): any {
    return {
      ...super.getNetworkData(),
      resourceType: this.config.resourceType,
      resourceId: this.config.resourceId,
      depleted: this.config.depleted,
      harvestSkill: this.config.harvestSkill,
      requiredLevel: this.config.requiredLevel
    };
  }

  public updateFromNetwork(data: any): void {
    if (data.depleted !== undefined) {
      this.config.depleted = data.depleted;
      
      // Update visual state based on depletion
      if (this.mesh) {
        this.mesh.visible = !this.config.depleted;
      }
    }
  }

  protected async createMesh(): Promise<void> {
    // Create basic resource mesh based on type
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    if (this.config.resourceType === 'tree') {
      geometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
      material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown for tree
    } else if (this.config.resourceType === 'fishing_spot') {
      geometry = new THREE.SphereGeometry(0.5, 8, 6);
      material = new THREE.MeshStandardMaterial({ color: 0x4169E1, transparent: true, opacity: 0.7 }); // Blue for water
    } else {
      geometry = new THREE.BoxGeometry(1, 1, 1);
      material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray default
    }
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    if (!this.mesh) return;
    
    // Set visual state based on depletion
    this.mesh.visible = !this.config.depleted;
    
    // Add resource-specific visual properties
    if (this.config.resourceType === 'tree') {
      this.mesh.scale.set(2, 3, 2);
    } else if (this.config.resourceType === 'fishing_spot') {
      this.mesh.scale.set(1, 0.1, 1);
      this.mesh.position.y = -0.4;
    } else if (this.config.resourceType === 'mining_rock') {
      this.mesh.scale.set(1.5, 1.5, 1.5);
    }
  }
}