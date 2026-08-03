/**
 * AnvilEntity - Permanent smithing station
 *
 * Represents an anvil that players can use to smith bars into items.
 * Anvils are permanent fixtures in the world, typically found near furnaces.
 *
 * **Extends**: InteractableEntity (players can interact to smith)
 *
 * **Interaction**:
 * - Left-click: Opens smithing interface (if player has bars + hammer)
 * - Right-click: Context menu with "Smith" and "Examine" options
 *
 * **Visual Representation**:
 * - Classic iron anvil shape
 *
 * **Requirements**:
 * - Player must have a hammer in inventory to smith
 * - Player must have appropriate bars for recipes
 *
 * **Runs on**: Server (authoritative), Client (visual)
 *
 * @see SmithingSystem for smithing logic
 * @see ProcessingDataProvider for smithing recipes
 */

import THREE, { MeshStandardNodeMaterial } from "../../extras/three/three";
import type { World } from "../../core/World";
import { EntityType, InteractionType } from "../../types/entities";
import type { EntityInteractionData } from "../../types/entities";
import {
  InteractableEntity,
  type InteractableConfig,
} from "../InteractableEntity";
import { EventType } from "../../types/events";
import { modelCache } from "../../utils/rendering/ModelCache";
import { stationDataProvider } from "../../data/StationDataProvider";
import { CollisionFlag } from "../../systems/shared/movement/CollisionFlags";
import {
  worldToTile,
  type TileCoord,
} from "../../systems/shared/movement/TileSystem";
import {
  resolveFootprint,
  type FootprintSpec,
} from "../../types/game/resource-processing-types";

/** Default interaction range for anvils (in tiles) */
const ANVIL_INTERACTION_RANGE = 2;

/**
 * Configuration for creating an AnvilEntity.
 */
export interface AnvilEntityConfig {
  id: string;
  name?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  /** Collision footprint - predefined ("standard", "large") or custom { width, depth } */
  footprint?: FootprintSpec;
}

export class AnvilEntity extends InteractableEntity {
  public readonly entityType = "anvil";
  public readonly isInteractable = true;
  public readonly isPermanent = true;

  /** Display name */
  public displayName: string;

  /** Tiles this station occupies for collision (supports multi-tile footprints) */
  private collisionTiles: TileCoord[] = [];

  /** Footprint specification for this station */
  private footprint: FootprintSpec;

  constructor(world: World, config: AnvilEntityConfig) {
    // Convert to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      id: config.id,
      name: config.name || "Anvil",
      type: EntityType.ANVIL,
      position: config.position,
      rotation: config.rotation
        ? { ...config.rotation, w: 1 }
        : { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.SMITHING,
      interactionDistance: ANVIL_INTERACTION_RANGE,
      description: "An anvil for smithing metal bars into items.",
      model: null,
      interaction: {
        prompt: "Smith",
        description: "Smith bars into items",
        range: ANVIL_INTERACTION_RANGE,
        cooldown: 0,
        usesRemaining: -1,
        maxUses: -1,
        effect: "smithing",
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

    this.displayName = config.name || "Anvil";
    // Get footprint from manifest (data-driven), allow per-instance override via config
    this.footprint =
      config.footprint ?? stationDataProvider.getFootprint("anvil");

    // Register collision for this station (server-side only)
    // Supports multi-tile footprints (e.g., "large" = 2x2 or { width: 2, depth: 1 })
    // Collision is CENTERED on the model position, not starting from it
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
    const stationData = stationDataProvider.getStationData("anvil");
    const modelPath = stationData?.model ?? null;
    const modelScale = stationData?.modelScale ?? 0.5;
    const modelYOffset = stationData?.modelYOffset ?? 0.4;

    // Try to load 3D model first
    if (modelPath && this.world.loader) {
      try {
        const { scene } = await modelCache.loadModel(modelPath, this.world);

        this.mesh = scene;
        this.mesh.name = `Anvil_${this.id}`;

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
          type: "anvil",
          entityId: this.id,
          name: this.displayName,
          interactable: true,
        };

        // Add to node
        if (this.node) {
          this.node.add(this.mesh);
          this.node.userData.type = "anvil";
          this.node.userData.entityId = this.id;
          this.node.userData.interactable = true;
        }

        // Initialize HLOD impostor support
        await this.initHLOD(`station_anvil_${modelPath}`, {
          category: "station",
          atlasSize: 1024,
          hemisphere: true,
        });

        return;
      } catch (error) {
        console.warn(
          `[AnvilEntity] Failed to load anvil model, using placeholder:`,
          error,
        );
      }
    }

    // FALLBACK: Create anvil visual (blue box proxy)
    const geometry = new THREE.BoxGeometry(1.0, 0.8, 0.6);
    const material = new MeshStandardNodeMaterial({
      color: 0x0066ff, // Blue for anvil
      roughness: 0.5,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Anvil_${this.id}`;
    mesh.position.y = 0.4; // Raise so bottom is at ground level
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    // Set up userData for interaction detection
    mesh.userData = {
      type: "anvil",
      entityId: this.id,
      name: this.displayName,
      interactable: true,
    };

    // Store mesh
    this.mesh = mesh;

    // Add to node
    if (this.node) {
      this.node.add(mesh);
      this.node.userData.type = "anvil";
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;
    }
  }

  /**
   * Handle anvil interaction - opens smithing interface.
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    // Emit event to start smithing interaction
    this.world.emit(EventType.SMITHING_INTERACT, {
      playerId: data.playerId,
      anvilId: this.id,
      position: this.position,
    });
  }

  /**
   * Get context menu actions for this anvil.
   */
  public getContextMenuActions(playerId: string): Array<{
    id: string;
    label: string;
    priority: number;
    handler: () => void;
  }> {
    const actions: Array<{
      id: string;
      label: string;
      priority: number;
      handler: () => void;
    }> = [];

    // Add "Smith" action
    actions.push({
      id: "smith",
      label: "Smith",
      priority: 1,
      handler: () => {
        this.world.emit(EventType.SMITHING_INTERACT, {
          playerId,
          anvilId: this.id,
          position: this.position,
        });
      },
    });

    // Add "Examine" action
    actions.push({
      id: "examine",
      label: "Examine",
      priority: 100,
      handler: () => {
        this.world.emit(EventType.UI_MESSAGE, {
          playerId,
          message: "An anvil for smithing metal bars into weapons and tools.",
        });
      },
    });

    return actions;
  }

  // PERF: Mutates buffer in-place instead of creating new objects
  getNetworkData(): Record<string, unknown> {
    const buf = super.getNetworkData();
    buf.displayName = this.displayName;
    buf.isPermanent = this.isPermanent;
    return buf;
  }

  /**
   * Client update - anvils are static.
   */
  protected clientUpdate(_deltaTime: number): void {
    // Anvil is static, no animation needed
  }
}
