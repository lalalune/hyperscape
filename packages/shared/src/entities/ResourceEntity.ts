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

import THREE from "../extras/three";
import type { World } from "../World";
import type { EntityData } from "../types";
import {
  InteractableEntity,
  type InteractableConfig,
} from "./InteractableEntity";
import type {
  EntityInteractionData,
  ResourceEntityConfig,
} from "../types/entities";
import { modelCache } from "../utils/ModelCache";
import { EventType } from "../types/events";

// Re-export types for external use
export type { ResourceEntityConfig } from "../types/entities";

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
        effect: "harvest",
      },
    };

    super(world, interactableConfig);
    this.config = {
      ...config,
      depleted: config.depleted !== undefined ? config.depleted : false,
      lastHarvestTime:
        config.lastHarvestTime !== undefined ? config.lastHarvestTime : 0,
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
    if (data.interactionType && data.interactionType !== "harvest") return;

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
      harvestYield: this.config.harvestYield,
    });
  }

  public deplete(): void {
    if (!this.world.isServer) return;

    this.config.depleted = true;
    this.config.lastHarvestTime = Date.now();
    this.markNetworkDirty();

    // Update interaction component to show as depleted
    const interactionComponent = this.getComponent("interaction");
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
    const interactionComponent = this.getComponent("interaction");
    if (interactionComponent) {
      interactionComponent.data.interactable = true;
      interactionComponent.data.description = `${this.config.resourceType} - Level ${this.config.requiredLevel} ${this.config.harvestSkill} required`;
    }
  }

  private async swapToStump(): Promise<void> {
    if (this.world.isServer || !this.node) return;

    // Only trees have stumps
    if (this.config.resourceType !== "tree") {
      // For other resources, just hide the mesh
      if (this.mesh) {
        this.mesh.visible = false;
      }
      return;
    }

    console.log("[ResourceEntity] 🪵 Swapping to stump model");

    // Remove current tree mesh
    if (this.mesh) {
      this.node.remove(this.mesh);
      this.mesh = null;
    }

    // Load stump model
    const stumpModelPath =
      "asset://models/basic-tree-stump/basic-tree-stump.glb";
    try {
      const { scene } = await modelCache.loadModel(stumpModelPath, this.world);

      this.mesh = scene;
      this.mesh.name = `ResourceStump_${this.config.resourceType}`;

      // Stump model is much larger than tree model, use smaller scale
      const modelScale = 0.3; // Much smaller than tree (3.0)
      this.mesh.scale.set(modelScale, modelScale, modelScale);
      this.mesh.updateMatrix();
      this.mesh.updateMatrixWorld(true);

      // Enable shadows
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Set up userData
      this.mesh.userData = {
        type: "resource",
        entityId: this.id,
        name: "Tree Stump",
        interactable: false,
        resourceType: this.config.resourceType,
        depleted: true,
      };

      this.node.add(this.mesh);
      console.log("[ResourceEntity] ✅ Stump model loaded");
    } catch (error) {
      console.error("[ResourceEntity] Failed to load stump model:", error);
      // Fallback: just hide the original mesh
      if (this.mesh) {
        this.mesh.visible = false;
      }
    }
  }

  private async swapToFullModel(): Promise<void> {
    if (this.world.isServer || !this.node) return;

    console.log("[ResourceEntity] 🌳 Swapping to full tree model");

    // Remove current stump mesh
    if (this.mesh) {
      this.node.remove(this.mesh);
      this.mesh = null;
    }

    // Reload the original model
    await this.createMesh();
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
      description: this.config.description,
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
      respawnTime: this.config.respawnTime,
    };
  }

  public updateFromNetwork(data: Record<string, unknown>): void {
    if (data.depleted !== undefined) {
      const wasDepleted = this.config.depleted;
      this.config.depleted = Boolean(data.depleted);

      // Update visual state based on depletion - swap to stump for trees
      if (this.config.depleted && !wasDepleted) {
        // Just became depleted - swap to stump
        this.swapToStump();
      } else if (!this.config.depleted && wasDepleted) {
        // Just respawned - swap back to full tree
        this.swapToFullModel();
      }
    }

    // CRITICAL: Enforce uniform node scale to prevent stretching
    // Some network updates might try to apply non-uniform scale
    if (
      this.node &&
      (this.node.scale.x !== 1 ||
        this.node.scale.y !== 1 ||
        this.node.scale.z !== 1)
    ) {
      this.node.scale.set(1, 1, 1);
    }
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }

    // Try to load 3D model if available (same approach as MobEntity for Meshy models)
    if (this.config.model && this.world.loader) {
      try {
        const { scene } = await modelCache.loadModel(
          this.config.model,
          this.world,
        );

        this.mesh = scene;
        this.mesh.name = `Resource_${this.config.resourceType}`;

        // CRITICAL: Force node scale to be uniform (prevent stretching)
        // Some systems might try to apply non-uniform scale - prevent this
        this.node.scale.set(1, 1, 1);

        // CRITICAL: Scale and orient based on resource type
        // Different Meshy models have different base scales and orientations
        // ALWAYS use uniform scaling to preserve model proportions
        let modelScale = 1.0;
        let needsXRotation = false; // Some models are exported lying flat

        if (this.config.resourceType === "tree") {
          modelScale = 3.0; // Scale up from base size (uniform scaling only)
          // Trees from Meshy are typically exported standing upright, no rotation needed
        }

        // Apply UNIFORM scale only (x=y=z to prevent stretching)
        this.mesh.scale.set(modelScale, modelScale, modelScale);

        // Apply base rotation if model is exported lying flat
        if (needsXRotation) {
          this.mesh.rotation.x = Math.PI / 2; // 90 degrees to stand upright
        }

        this.mesh.updateMatrix();
        this.mesh.updateMatrixWorld(true);

        // Handle skeletal meshes if present (most trees won't have these, but future resources might)
        this.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            child.updateMatrix();
            child.updateMatrixWorld(true);
            child.bindMode = THREE.DetachedBindMode;
            child.bindMatrix.copy(child.matrixWorld);
            child.bindMatrixInverse.copy(child.bindMatrix).invert();
          }

          // Enable shadows on all meshes
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Set up userData for interaction detection
        this.mesh.userData = {
          type: "resource",
          entityId: this.id,
          name: this.config.name,
          interactable: true,
          resourceType: this.config.resourceType,
          depleted: this.config.depleted,
        };

        // Calculate bounding box to position mesh correctly on ground
        // The model's pivot might be at center, so we need to offset it
        const bbox = new THREE.Box3().setFromObject(this.mesh);
        const minY = bbox.min.y;

        // Offset mesh so the bottom (minY) is at Y=0 (ground level)
        // Node position is already at terrain height, so mesh Y is relative to that
        this.mesh.position.set(0, -minY, 0);
        // Note: Don't reset quaternion if we applied base rotation above

        this.node.add(this.mesh);
        return;
      } catch (error) {
        console.warn(
          `[ResourceEntity] Failed to load model for ${this.config.resourceType}, using placeholder:`,
          error,
        );
        // Fall through to placeholder
      }
    }

    // Create visible placeholder based on resource type
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    if (this.config.resourceType === "tree") {
      geometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
      material = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Brown for tree
    } else if (this.config.resourceType === "fishing_spot") {
      geometry = new THREE.SphereGeometry(0.5, 8, 6);
      material = new THREE.MeshStandardMaterial({
        color: 0x4169e1,
        transparent: true,
        opacity: 0.7,
      }); // Blue for water
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
      type: "resource",
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      resourceType: this.config.resourceType,
      depleted: this.config.depleted,
    };

    // Scale based on resource type
    if (this.config.resourceType === "tree") {
      this.mesh.scale.set(2, 3, 2);
    } else if (this.config.resourceType === "fishing_spot") {
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
