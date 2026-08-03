/**
 * AltarEntity - Prayer altar for recharging prayer points
 *
 * Represents an altar where players can restore prayer points.
 * Rendered as a purple box on the client (placeholder).
 *
 * **Extends**: InteractableEntity (players can interact to pray)
 *
 * **Interaction**:
 * - Left-click: Recharges prayer points to max
 * - Right-click: Context menu with "Pray" and "Examine"
 *
 * **Visual Representation**:
 * - Purple altar-sized box (1 tile)
 *
 * **Runs on**: Server (authoritative), Client (visual)
 */

import THREE, { MeshStandardNodeMaterial } from "../../extras/three/three";
import type { World } from "../../core/World";
import type { EntityInteractionData } from "../../types/entities";
import { EntityType, InteractionType } from "../../types/entities";
import {
  InteractableEntity,
  type InteractableConfig,
} from "../InteractableEntity";
import { EventType } from "../../types/events";
import { stationDataProvider } from "../../data/StationDataProvider";
import { modelCache } from "../../utils/rendering/ModelCache";
import { CollisionFlag } from "../../systems/shared/movement/CollisionFlags";
import {
  worldToTile,
  type TileCoord,
} from "../../systems/shared/movement/TileSystem";
import {
  resolveFootprint,
  type FootprintSpec,
} from "../../types/game/resource-processing-types";

/** Default interaction range for altars (in tiles) */
const ALTAR_INTERACTION_RANGE = 2;

/**
 * Configuration for creating an AltarEntity.
 * Simplified config - full InteractableConfig is built internally.
 */
export interface AltarEntityConfig {
  id: string;
  name?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  /** Collision footprint - predefined ("standard", "large") or custom { width, depth } */
  footprint?: FootprintSpec;
  /** Optional altar ID for tracking */
  altarId?: string;
}

export class AltarEntity extends InteractableEntity {
  public readonly entityType = "altar";
  public readonly isInteractable = true;
  public readonly isPermanent = true;

  /** Display name */
  public displayName: string;

  /** Altar ID for tracking */
  private altarId: string;

  /** Tiles this station occupies for collision (supports multi-tile footprints) */
  private collisionTiles: TileCoord[] = [];

  /** Footprint specification for this station */
  private footprint: FootprintSpec;

  constructor(world: World, config: AltarEntityConfig) {
    // Convert to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      id: config.id,
      name: config.name || "Altar",
      type: EntityType.ALTAR,
      position: config.position,
      rotation: config.rotation
        ? { ...config.rotation, w: 1 }
        : { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.ALTAR,
      interactionDistance: ALTAR_INTERACTION_RANGE,
      description: "An altar to the gods.",
      model: null,
      interaction: {
        prompt: "Pray",
        description: "Pray at the altar to restore prayer points.",
        range: ALTAR_INTERACTION_RANGE,
        cooldown: 0,
        usesRemaining: -1,
        maxUses: -1,
        effect: "altar",
      },
      properties: {
        movementComponent: null,
        combatComponent: null,
        healthComponent: null,
        visualComponent: null,
        health: { current: 1, max: 1 },
        level: 1,
      },
    };

    super(world, interactableConfig);
    this.displayName = config.name || "Altar";
    this.altarId = config.altarId || config.id;

    // Get footprint from manifest (data-driven), allow per-instance override via config
    this.footprint =
      config.footprint ?? stationDataProvider.getFootprint("altar");

    // Register collision for this station (server-side only)
    if (this.world.isServer) {
      const centerTile = worldToTile(config.position.x, config.position.z);
      const size = resolveFootprint(this.footprint);

      // Offset to center the footprint on the model
      const offsetX = Math.floor(size.x / 2);
      const offsetZ = Math.floor(size.z / 2);

      // Calculate all tiles this station occupies (centered on position)
      for (let dx = 0; dx < size.x; dx++) {
        for (let dz = 0; dz < size.z; dz++) {
          const tile = {
            x: centerTile.x + dx - offsetX,
            z: centerTile.z + dz - offsetZ,
          };
          this.collisionTiles.push(tile);
          this.world.collision.addFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
        }
      }
    }
  }

  /**
   * Clean up collision and resources when destroyed.
   */
  destroy(local?: boolean): void {
    // Unregister all collision tiles (server-side only)
    if (this.world.isServer && this.collisionTiles.length > 0) {
      for (const tile of this.collisionTiles) {
        this.world.collision.removeFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
      }
      this.collisionTiles = [];
    }

    super.destroy(local);
  }

  /**
   * Return tiles occupied by this station for classic MMORPG-style interaction checking.
   * Uses the same tiles registered for collision.
   */
  protected override getOccupiedTiles(): TileCoord[] {
    // Return collision tiles if available, otherwise fall back to single tile
    if (this.collisionTiles.length > 0) {
      return this.collisionTiles;
    }
    // Fallback for client-side (collision tiles only registered on server)
    const pos = this.getPosition();
    return [worldToTile(pos.x, pos.z)];
  }

  protected async createMesh(): Promise<void> {
    // Don't create mesh on server
    if (this.world.isServer) {
      return;
    }

    // Get station data from manifest
    const stationData = stationDataProvider.getStationData("altar");
    const modelPath = stationData?.model ?? null;
    const modelScale = stationData?.modelScale ?? 1.0;
    const modelYOffset = stationData?.modelYOffset ?? 0;

    // Try to load 3D model first
    if (modelPath && this.world.loader) {
      try {
        const { scene } = await modelCache.loadModel(modelPath, this.world);

        this.mesh = scene;
        this.mesh.name = `Altar_${this.id}`;

        // Scale the model from manifest
        this.mesh.scale.set(modelScale, modelScale, modelScale);

        // Offset Y position so model base sits on ground
        this.mesh.position.y = modelYOffset;

        // Enable shadows and set layer for raycasting
        this.mesh.layers.set(1);
        this.mesh.traverse((child) => {
          child.layers.set(1);
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });

        // Set up userData for interaction detection
        this.mesh.userData = {
          type: "altar",
          entityId: this.id,
          name: this.displayName,
          interactable: true,
          altarId: this.altarId,
        };

        // Add to node
        if (this.node) {
          this.node.add(this.mesh);
          this.node.userData.type = "altar";
          this.node.userData.entityId = this.id;
          this.node.userData.interactable = true;
          this.node.userData.altarId = this.altarId;
        }

        // Initialize HLOD impostor support
        await this.initHLOD(`station_altar_${modelPath}`, {
          category: "station",
          atlasSize: 1024,
          hemisphere: true,
        });

        return;
      } catch (error) {
        console.warn(
          `[AltarEntity] Failed to load altar model, using placeholder:`,
          error,
        );
      }
    }

    // FALLBACK: Create a purple box for the altar (1 tile size, altar-like proportions)
    const boxHeight = 0.8;
    const geometry = new THREE.BoxGeometry(0.9, boxHeight, 0.9);
    const material = new MeshStandardNodeMaterial({
      color: 0x9932cc, // Bright purple (DarkOrchid)
      roughness: 0.5,
      metalness: 0.3,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Altar_${this.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // Offset mesh up so it sits on the ground (BoxGeometry is centered at origin)
    mesh.position.y = boxHeight / 2;
    // Set layer for raycasting (required for interaction detection)
    mesh.layers.set(1);
    this.mesh = mesh;

    // Set up userData for interaction detection
    mesh.userData = {
      type: "altar",
      entityId: this.id,
      name: this.displayName,
      interactable: true,
      altarId: this.altarId,
    };

    // Add mesh to the entity's node
    if (this.mesh && this.node) {
      this.node.add(this.mesh);

      // Also set userData on node for easier detection
      this.node.userData.type = "altar";
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;
      this.node.userData.altarId = this.altarId;
    }
  }

  /**
   * Handle altar interaction - emits pray event
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    // Emit event to pray at altar
    this.world.emit(EventType.ALTAR_PRAY, {
      playerId: data.playerId,
      altarId: this.id,
    });
  }

  // PERF: Mutates buffer in-place instead of creating new objects
  getNetworkData(): Record<string, unknown> {
    const buf = super.getNetworkData();
    buf.altarId = this.altarId;
    return buf;
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
    // Altar is static, no animation needed
  }
}
