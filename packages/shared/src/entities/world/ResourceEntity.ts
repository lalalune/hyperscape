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

import * as THREE from "../../extras/three/three";
import type { World } from "../../core/World";
import type { EntityData } from "../../types";
import {
  InteractableEntity,
  type InteractableConfig,
} from "../InteractableEntity";
import type {
  EntityInteractionData,
  ResourceEntityConfig,
} from "../../types/entities";
import { modelCache } from "../../utils/rendering/ModelCache";
import { EventType } from "../../types/events";
import { CollisionFlag } from "../../systems/shared/movement/CollisionFlags";
import {
  worldToTile,
  type TileCoord,
} from "../../systems/shared/movement/TileSystem";
import { FOOTPRINT_SIZES } from "../../types/game/resource-processing-types";
import type { ParticleManager } from "../managers/particleManager";

// Re-export types for external use
export type { ResourceEntityConfig } from "../../types/entities";

export class ResourceEntity extends InteractableEntity {
  public config: ResourceEntityConfig;
  private respawnTimer?: NodeJS.Timeout;
  /** Glow indicator mesh for fishing spot visibility from distance (client-only) */
  private glowMesh?: THREE.Mesh;
  /** Whether this fishing spot has been registered with the centralized particle manager */
  private _registeredWithParticleManager = false;
  /** Cache for DataTextures keyed by generation parameters to avoid duplicates */
  private static textureCache = new Map<string, THREE.DataTexture>();
  /** Dispose shared static resources (texture cache). Call on world teardown. */
  static disposeSharedResources(): void {
    for (const tex of ResourceEntity.textureCache.values()) {
      tex.dispose();
    }
    ResourceEntity.textureCache.clear();
  }

  /** Tiles this resource occupies for collision (cached for cleanup) */
  private collisionTiles: TileCoord[] = [];

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

    // Register collision for this resource (server-side only)
    // Fishing spots don't block movement - they're in water
    if (this.world.isServer && config.resourceType !== "fishing_spot") {
      this.registerCollision();
    }
  }

  /**
   * Register this resource's tiles in the collision matrix.
   * Called on construction, tiles remain blocked even when depleted (OSRS-accurate).
   * Uses center-based registration (footprint centered on entity position) for
   * consistency with station entities and tilesWithinRangeOfFootprint() checks.
   */
  private registerCollision(): void {
    // Get center tile from world position
    const centerTile = worldToTile(this.position.x, this.position.z);

    // Get footprint size (defaults to standard 1x1)
    const footprint = this.config.footprint || "standard";
    const size = FOOTPRINT_SIZES[footprint];

    // Calculate offset to center the footprint on the entity
    const offsetX = Math.floor(size.x / 2);
    const offsetZ = Math.floor(size.z / 2);

    // Calculate all tiles this resource occupies (centered on position)
    this.collisionTiles = [];
    for (let dx = 0; dx < size.x; dx++) {
      for (let dz = 0; dz < size.z; dz++) {
        this.collisionTiles.push({
          x: centerTile.x + dx - offsetX,
          z: centerTile.z + dz - offsetZ,
        });
      }
    }

    // Store in config for potential serialization
    this.config.anchorTile = centerTile;
    this.config.occupiedTiles = this.collisionTiles;

    // Add BLOCKED flag to all tiles
    for (const tile of this.collisionTiles) {
      this.world.collision.addFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
    }
  }

  /**
   * Unregister this resource's tiles from the collision matrix.
   * Called on destroy.
   */
  private unregisterCollision(): void {
    for (const tile of this.collisionTiles) {
      this.world.collision.removeFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
    }
    this.collisionTiles = [];
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

    // Check if this resource has a depleted model configured
    // Trees have stumps, rocks have depleted rock models, etc.
    const depletedModelPath = this.config.depletedModelPath;

    // If no depleted model path, just hide the current mesh
    if (!depletedModelPath) {
      if (this.mesh) {
        this.mesh.visible = false;
      }
      return;
    }

    // Remove current mesh
    if (this.mesh) {
      this.node.remove(this.mesh);
      this.mesh = null;
    }
    try {
      const { scene } = await modelCache.loadModel(
        depletedModelPath,
        this.world,
      );

      this.mesh = scene;
      this.mesh.name = `ResourceDepleted_${this.config.resourceType}`;

      // Use scale from config (set by manifest) or fallback to default
      // Apply uniform scale directly (simplified approach matching FurnaceEntity)
      const modelScale = this.config.depletedModelScale ?? 0.3;
      this.mesh.scale.set(modelScale, modelScale, modelScale);

      // Set layers and enable shadows (simple traverse, no scale manipulation)
      this.mesh.layers.set(1);
      this.mesh.traverse((child) => {
        child.layers.set(1);
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Set up userData
      this.mesh.userData = {
        type: "resource",
        entityId: this.id,
        name: `${this.config.name} (Depleted)`,
        interactable: false,
        resourceType: this.config.resourceType,
        depleted: true,
      };

      // Align depleted model to ground (same as createMesh)
      const bbox = new THREE.Box3().setFromObject(this.mesh);
      const minY = bbox.min.y;
      this.mesh.position.set(0, -minY, 0);

      this.node.add(this.mesh);
    } catch (_error) {
      // Fallback: just hide the original mesh
      if (this.mesh) {
        this.mesh.visible = false;
      }
    }
  }

  private async swapToFullModel(): Promise<void> {
    if (this.world.isServer || !this.node) return;

    // Remove current depleted mesh
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
      modelScale: this.config.modelScale,
      depletedModelScale: this.config.depletedModelScale,
      depletedModelPath: this.config.depletedModelPath,
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
      modelScale: this.config.modelScale,
      depletedModelScale: this.config.depletedModelScale,
      depletedModelPath: this.config.depletedModelPath,
    };
  }

  public updateFromNetwork(data: Record<string, unknown>): void {
    if (data.depleted !== undefined) {
      const wasDepleted = this.config.depleted;
      this.config.depleted = Boolean(data.depleted);

      // Update visual state based on depletion - swap to depleted model
      if (this.config.depleted && !wasDepleted) {
        // Just became depleted - swap to depleted model
        this.swapToStump();
      } else if (!this.config.depleted && wasDepleted) {
        // Just respawned - swap back to full model
        this.swapToFullModel();
      }
    }
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }

    // Try to load 3D model if available
    if (this.config.model && this.world.loader) {
      try {
        const { scene } = await modelCache.loadModel(
          this.config.model,
          this.world,
        );

        this.mesh = scene;
        this.mesh.name = `Resource_${this.config.resourceType}`;

        // Use scale from manifest config, with fallback defaults per resource type
        let modelScale = this.config.modelScale ?? 1.0;

        // Fallback defaults if manifest doesn't specify scale
        if (this.config.modelScale === undefined) {
          if (this.config.resourceType === "tree") {
            modelScale = 3.0;
          }
        }

        // Apply uniform scale directly to mesh (same as FurnaceEntity)
        // Do NOT manipulate internal node scales - this causes issues
        this.mesh.scale.set(modelScale, modelScale, modelScale);

        // Set layer for minimap exclusion and enable shadows
        // (Same simple traverse as FurnaceEntity - only for layers/shadows, no scale manipulation)
        this.mesh.layers.set(1);
        this.mesh.traverse((child) => {
          child.layers.set(1);
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

        this.node.add(this.mesh);
        return;
      } catch (error) {
        // Log failure and fall through to placeholder
        console.warn(
          `Failed to load model for ${this.config.resourceType}:`,
          error,
        );
      }
    }

    // For fishing spots, create particle-based visual instead of placeholder
    if (this.config.resourceType === "fishing_spot") {
      this.createFishingSpotVisual();
      return;
    }

    // Create visible placeholder based on resource type
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    if (this.config.resourceType === "tree") {
      geometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
      material = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Brown for tree
    } else {
      geometry = new THREE.BoxGeometry(1, 1, 1);
      material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray default
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `Resource_${this.config.resourceType}`;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = !this.config.depleted;

    // PERFORMANCE: Set placeholder to layer 1 (main camera only, not minimap)
    this.mesh.layers.set(1);

    // Set up userData for interaction detection (placeholder)
    this.mesh.userData = {
      type: "resource",
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      resourceType: this.config.resourceType,
      depleted: this.config.depleted,
    };

    // Scale for tree - use UNIFORM scale to prevent squishing
    if (this.config.resourceType === "tree") {
      this.mesh.scale.set(3, 3, 3);
    }

    this.node.add(this.mesh);
  }

  /**
   * Create animated visual for fishing spots.
   * Glow indicator stays on entity node for interaction detection.
   * All particle/ripple effects handled by centralized ParticleManager → WaterParticleManager.
   */
  private createFishingSpotVisual(): void {
    // Create the glow indicator (interaction hitbox + distant visibility)
    this.createGlowIndicator();

    // Try to register with centralized particle manager (may not exist yet)
    this.tryRegisterWithParticleManager();

    // Register for frame updates (glow pulse + lazy particle registration)
    this.world.setHot(this, true);
  }

  /**
   * Attempt to register this fishing spot with the centralized particle manager.
   * Called initially from createFishingSpotVisual, and retried from clientUpdate
   * if the manager wasn't available yet (timing/lifecycle issue where entity init
   * runs before ResourceSystem.start() creates the manager).
   */
  public tryRegisterWithParticleManager(): boolean {
    if (this._registeredWithParticleManager) return true;

    const pm = this.getParticleManager();
    if (!pm) return false;

    const pos = this.getPosition();
    pm.register(this.id, {
      type: "water",
      position: { x: pos.x, y: pos.y, z: pos.z },
      resourceId: this.config.resourceId || "",
    });
    this._registeredWithParticleManager = true;
    return true;
  }

  /** Access the centralized ParticleManager from the ResourceSystem. */
  private getParticleManager(): ParticleManager | undefined {
    const sys = this.world.getSystem("resource") as {
      particleManager?: ParticleManager;
    } | null;
    return sys?.particleManager;
  }

  /**
   * Create a DataTexture with a radial glow pattern and baked-in color.
   * WebGPU compatible — no material.color tinting needed.
   */
  private static createColoredGlowTexture(
    colorHex: number,
    size: number,
    sharpness: number,
  ): THREE.DataTexture {
    const key = `glow:${colorHex}:${size}:${sharpness}`;
    const cached = ResourceEntity.textureCache.get(key);
    if (cached) return cached;

    const r = (colorHex >> 16) & 0xff;
    const g = (colorHex >> 8) & 0xff;
    const b = colorHex & 0xff;
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - half) / half;
        const dy = (y + 0.5 - half) / half;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - dist);
        const strength = Math.pow(falloff, sharpness);
        const idx = (y * size + x) * 4;
        data[idx] = Math.round(r * strength);
        data[idx + 1] = Math.round(g * strength);
        data[idx + 2] = Math.round(b * strength);
        data[idx + 3] = Math.round(255 * strength);
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    ResourceEntity.textureCache.set(key, tex);
    return tex;
  }

  /**
   * Per-frame animation for fishing spot glow pulse.
   * Particles and ripples are handled by the centralized ParticleManager → WaterParticleManager.
   */
  protected clientUpdate(_deltaTime: number): void {
    super.clientUpdate(_deltaTime);

    // Lazy registration: retry if particle manager wasn't ready during createFishingSpotVisual
    if (
      !this._registeredWithParticleManager &&
      this.config.resourceType === "fishing_spot"
    ) {
      if (this.tryRegisterWithParticleManager()) {
        console.log(`[FishingSpot] Late registration succeeded for ${this.id}`);
      }
    }

    // Organic glow pulse — two frequencies layered for natural breathing
    if (this.glowMesh) {
      const now = Date.now();
      const slow = Math.sin(now * 0.0015) * 0.04;
      const fast = Math.sin(now * 0.004 + 1.3) * 0.02;
      const pulse = 0.18 + slow + fast;
      (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  }

  /**
   * Create subtle glow indicator visible from distance when particles aren't.
   */
  private createGlowIndicator(): void {
    const geometry = new THREE.CircleGeometry(0.6, 16);
    const tex = ResourceEntity.createColoredGlowTexture(0x55aaff, 64, 1.0);
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });

    this.glowMesh = new THREE.Mesh(geometry, material);
    this.glowMesh.rotation.x = -Math.PI / 2; // Horizontal
    this.glowMesh.position.y = 0.05; // Just above water
    this.glowMesh.name = "FishingSpotGlow";

    // Set up userData for interaction detection
    this.glowMesh.userData = {
      type: "resource",
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      resourceType: this.config.resourceType,
      depleted: this.config.depleted,
    };

    this.node.add(this.glowMesh);
  }

  destroy(local?: boolean): void {
    // Unregister collision tiles (server-side only)
    if (this.world.isServer && this.collisionTiles.length > 0) {
      this.unregisterCollision();
    }

    // Clear respawn timer to prevent memory leaks
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }

    // Clean up fishing spot resources
    if (this.config.resourceType === "fishing_spot") {
      // Unregister from centralized particle manager
      if (this._registeredWithParticleManager) {
        const pm = this.getParticleManager();
        if (pm) {
          pm.unregister(this.id);
        }
        this._registeredWithParticleManager = false;
      }

      // Unregister from frame updates (glow pulse)
      this.world.setHot(this, false);
    }

    // Clean up glow mesh (fishing spots, node-local)
    if (this.glowMesh) {
      this.glowMesh.geometry.dispose();
      (this.glowMesh.material as THREE.Material).dispose();
      this.node.remove(this.glowMesh);
      this.glowMesh = undefined;
    }

    // Call parent destroy
    super.destroy(local);
  }
}
