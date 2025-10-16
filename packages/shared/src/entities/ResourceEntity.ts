/**
 * ResourceEntity - Harvestable Resource Entity
 * 
 * Represents gatherable resources in the world like trees, rocks, and fishing spots.
 * Players can interact with these to gather materials and gain experience.
 * 
 * **Extends**: InteractableEntity (players can harvest resources)
 * 
 * **Key Features**:
 * 
 * **Resource Types**:
 * - **Trees**: Woodcutting skill (logs, wood)
 * - **Rocks**: Mining skill (ores, gems)
 * - **Fish**: Fishing skill (fish, treasure)
 * - **Herbs**: Herbalism skill (herbs, flowers)
 * 
 * **Harvesting System**:
 * - Skill level requirements (can't harvest high-level resources without skill)
 * - Harvest time based on resource and skill level
 * - Resource depletion after harvesting
 * - Respawn timer after depletion
 * - XP rewards based on resource level
 * 
 * **Resource State**:
 * - Available: Can be harvested
 * - Depleted: Recently harvested, waiting to respawn
 * - Respawning: Timer counting down to availability
 * 
 * **Yield System**:
 * - Item drops on successful harvest
 * - Quantity randomization
 * - Quality based on skill level
 * - Rare resource chances
 * 
 * **Visual Feedback**:
 * - Different appearance when depleted
 * - Particle effects on harvest
 * - Interaction prompt shows requirements
 * - Harvest progress bar
 * 
 * **Network Sync**:
 * - Resource state broadcasted to all clients
 * - Depletion events trigger visual changes
 * - Respawn events restore resource
 * 
 * **Runs on**: Server (authoritative), Client (visual + interaction)
 * **Referenced by**: ResourceSystem, InteractionSystem, SkillsSystem
 * 
 * @public
 */

import THREE from '../extras/three';
import type { World } from '../World';
import type { EntityData } from '../types';
import { InteractableEntity, type InteractableConfig } from './InteractableEntity';
import type { EntityInteractionData, ResourceEntityConfig } from '../types/entities';
import { modelCache } from '../utils/ModelCache';
import { EventType } from '../types/events';

// Re-export types for external use
export type { ResourceEntityConfig } from '../types/entities';

export class ResourceEntity extends InteractableEntity {
  public config: ResourceEntityConfig;
  private respawnTimer?: NodeJS.Timeout;

  constructor(world: World, config: ResourceEntityConfig) {
    // Convert ResourceEntityConfig to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      ...config,
      interaction: {
        prompt: `${config.harvestSkill} ${config.resourceType}`,
        description: `${config.resourceType} - Level ${config.requiredLevel} ${config.harvestSkill} required`,
        range: 2.0,
        cooldown: config.harvestTime || 3000,
        usesRemaining: config.depleted ? 0 : -1, // -1 = unlimited uses until depleted
        maxUses: -1,
        effect: 'harvest'
      }
    };
    
    super(world, interactableConfig);
    this.config = {
      ...config,
      depleted: config.depleted !== undefined ? config.depleted : false,
      lastHarvestTime: config.lastHarvestTime !== undefined ? config.lastHarvestTime : 0
    };
    
    // Resources don't have health bars - they're not combatants
    this.health = 0;
    this.maxHealth = 0;
  }

  /**
   * Handle resource interaction - implements InteractableEntity.handleInteraction
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    // Default to harvest interaction if not specified
    if (data.interactionType && data.interactionType !== 'harvest') return;
    
    // Check if resource is depleted
    if (this.config.depleted) {
      return;
    }

    // Send harvest request to resource system
    this.world.emit(EventType.RESOURCE_HARVEST_REQUEST, {
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
    
    // Update interaction component to show as depleted
    const interactionComponent = this.getComponent('interaction');
    if (interactionComponent) {
      interactionComponent.data.interactable = false;
      interactionComponent.data.description = `${this.config.resourceType} - Depleted`;
    }
    
    // Clear any existing timer
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
    }
    
    // Schedule respawn with tracked timer to prevent memory leaks
    this.respawnTimer = setTimeout(() => {
      this.respawn();
      this.respawnTimer = undefined;
    }, this.config.respawnTime);
  }

  public respawn(): void {
    if (!this.world.isServer) return;
    
    this.config.depleted = false;
    this.markNetworkDirty();
    
    // Update interaction component to show as available again
    const interactionComponent = this.getComponent('interaction');
    if (interactionComponent) {
      interactionComponent.data.interactable = true;
      interactionComponent.data.description = `${this.config.resourceType} - Level ${this.config.requiredLevel} ${this.config.harvestSkill} required`;
    }
  }

  // Override serialize() to include all config data for network sync
  serialize(): EntityData {
    const baseData = super.serialize();
    return {
      ...baseData,
      model: this.config.model,
      resourceType: this.config.resourceType,
      resourceId: this.config.resourceId,
      depleted: this.config.depleted,
      harvestSkill: this.config.harvestSkill,
      requiredLevel: this.config.requiredLevel,
      harvestTime: this.config.harvestTime,
      harvestYield: this.config.harvestYield,
      respawnTime: this.config.respawnTime,
      interactionDistance: this.config.interactionDistance || 3,
      description: this.config.description
    } as EntityData;
  }
  
  public getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      model: this.config.model,
      resourceType: this.config.resourceType,
      resourceId: this.config.resourceId,
      depleted: this.config.depleted,
      harvestSkill: this.config.harvestSkill,
      requiredLevel: this.config.requiredLevel,
      harvestTime: this.config.harvestTime,
      harvestYield: this.config.harvestYield,
      respawnTime: this.config.respawnTime
    };
  }

  public updateFromNetwork(data: Record<string, unknown>): void {
    if (data.depleted !== undefined) {
      this.config.depleted = Boolean(data.depleted);
      
      // Update visual state based on depletion
      if (this.mesh) {
        this.mesh.visible = !this.config.depleted;
      }
    }
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }
    
    // Try to load 3D model if available (same approach as ItemEntity)
    if (this.config.model && this.world.loader) {
      try {
        const { scene } = await modelCache.loadModel(this.config.model, this.world);
        
        this.mesh = scene;
        this.mesh.name = `Resource_${this.config.resourceType}`;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.scale.set(5.0, 5.0, 5.0); // Trees are 5x scale (~3-5m tall)
        
        // Set up userData for interaction detection
        this.mesh.userData = {
          type: 'resource',
          entityId: this.id,
          name: this.config.name,
          interactable: true,
          resourceType: this.config.resourceType,
          depleted: this.config.depleted
        };
        
        this.node.add(this.mesh);
        return;
      } catch (error) {
        console.warn(`[ResourceEntity] Failed to load model for ${this.config.resourceType}, using placeholder:`, error);
        // Fall through to placeholder
      }
    }
    
    
    // Create visible placeholder based on resource type
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
    this.mesh.name = `Resource_${this.config.resourceType}`;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = !this.config.depleted;
    
    // Set up userData for interaction detection (placeholder)
    this.mesh.userData = {
      type: 'resource',
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      resourceType: this.config.resourceType,
      depleted: this.config.depleted
    };
    
    // Scale based on resource type
    if (this.config.resourceType === 'tree') {
      this.mesh.scale.set(2, 3, 2);
    } else if (this.config.resourceType === 'fishing_spot') {
      this.mesh.scale.set(1, 0.1, 1);
      this.mesh.position.y = -0.4;
    }
    
    this.node.add(this.mesh);
  }
  
  destroy(local?: boolean): void {
    // Clear respawn timer to prevent memory leaks
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    
    // Call parent destroy
    super.destroy(local);
  }
}