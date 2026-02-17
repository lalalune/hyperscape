/**
 * RunecraftingAltarEntity - Altar for crafting runes from essence
 *
 * Represents a runecrafting altar where players convert essence into runes.
 * Each altar is tied to a specific rune type (air, water, earth, fire, mind, chaos).
 *
 * **Extends**: InteractableEntity (players can interact to craft runes)
 *
 * **Interaction**:
 * - Left-click: Instantly converts all carried essence into runes
 * - Right-click: Context menu with "Craft-rune" and "Examine"
 *
 * **Runs on**: Server (authoritative), Client (visual)
 *
 * @see RunecraftingSystem for crafting logic
 */

import * as THREE from "../../extras/three/three";
import type { World } from "../../core/World";
import type { EntityInteractionData } from "../../types/entities";
import type { EntityData } from "../../types";
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
import type { ParticleManager } from "../managers/particleManager";

/** Default interaction range for runecrafting altars (in tiles) */
const RUNECRAFTING_ALTAR_INTERACTION_RANGE = 2;

/**
 * Configuration for creating a RunecraftingAltarEntity.
 */
export interface RunecraftingAltarEntityConfig {
  id: string;
  name?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  /** Collision footprint */
  footprint?: FootprintSpec;
  /** Which rune type this altar produces (e.g., "air", "water", "fire") */
  runeType: string;
}

export class RunecraftingAltarEntity extends InteractableEntity {
  public readonly entityType = "runecrafting_altar";
  public readonly isInteractable = true;
  public readonly isPermanent = true;

  /** Display name */
  public displayName: string;

  /** Which rune this altar produces */
  public readonly runeType: string;

  /** Tiles this station occupies for collision */
  private collisionTiles: TileCoord[] = [];

  /** Footprint specification for this station */
  private footprint: FootprintSpec;

  /** Whether this altar has registered its particles with GlowParticleManager */
  private _registeredGlowParticles = false;

  constructor(world: World, config: RunecraftingAltarEntityConfig) {
    const defaultName = `${config.runeType.charAt(0).toUpperCase()}${config.runeType.slice(1)} Altar`;
    const interactableConfig: InteractableConfig = {
      id: config.id,
      name: config.name || defaultName,
      type: EntityType.RUNECRAFTING_ALTAR,
      position: config.position,
      rotation: config.rotation
        ? { ...config.rotation, w: 1 }
        : { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.RUNECRAFTING,
      interactionDistance: RUNECRAFTING_ALTAR_INTERACTION_RANGE,
      description: "A mysterious altar pulsing with runic energy.",
      model: null,
      interaction: {
        prompt: "Craft-rune",
        description: "Craft runes from essence.",
        range: RUNECRAFTING_ALTAR_INTERACTION_RANGE,
        cooldown: 0,
        usesRemaining: -1,
        maxUses: -1,
        effect: "runecrafting",
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
    this.displayName = config.name || defaultName;
    this.runeType = config.runeType;

    // Get footprint from manifest (data-driven), allow per-instance override
    this.footprint =
      config.footprint ??
      stationDataProvider.getFootprint("runecrafting_altar");

    // Register collision (server-side only)
    if (this.world.isServer) {
      const centerTile = worldToTile(config.position.x, config.position.z);
      const size = resolveFootprint(this.footprint);

      const offsetX = Math.floor(size.x / 2);
      const offsetZ = Math.floor(size.z / 2);

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
   * Clean up collision and particles when destroyed.
   */
  destroy(local?: boolean): void {
    // Unregister from centralized GlowParticleManager
    if (this._registeredGlowParticles) {
      const pm = this.getParticleManager();
      if (pm) {
        pm.unregister(this.id);
      }
      this._registeredGlowParticles = false;
    }
    if (this.world.isServer && this.collisionTiles.length > 0) {
      for (const tile of this.collisionTiles) {
        this.world.collision.removeFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
      }
      this.collisionTiles = [];
    }
    super.destroy(local);
  }

  /**
   * Return tiles occupied by this station for OSRS-style interaction checking.
   */
  protected override getOccupiedTiles(): TileCoord[] {
    if (this.collisionTiles.length > 0) {
      return this.collisionTiles;
    }
    const pos = this.getPosition();
    return [worldToTile(pos.x, pos.z)];
  }

  protected async createMesh(): Promise<void> {
    if (this.world.isServer) {
      return;
    }

    // Get station data from manifest
    const stationData =
      stationDataProvider.getStationData("runecrafting_altar");
    const modelPath = stationData?.model ?? null;
    const modelScale = stationData?.modelScale ?? 1.0;
    const modelYOffset = stationData?.modelYOffset ?? 0;

    // Try to load 3D model
    if (modelPath && this.world.loader) {
      try {
        const { scene } = await modelCache.loadModel(modelPath, this.world);

        this.mesh = scene;
        this.mesh.name = `RunecraftingAltar_${this.id}`;
        this.mesh.scale.set(modelScale, modelScale, modelScale);
        this.mesh.position.y = modelYOffset;

        this.mesh.layers.set(1);
        this.mesh.traverse((child) => {
          child.layers.set(1);
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.mesh.userData = {
          type: "runecrafting_altar",
          entityId: this.id,
          name: this.displayName,
          interactable: true,
          runeType: this.runeType,
        };

        if (this.node) {
          this.node.add(this.mesh);
          this.node.userData.type = "runecrafting_altar";
          this.node.userData.entityId = this.id;
          this.node.userData.interactable = true;
        }

        // Register instanced glow particles via centralized GlowParticleManager
        this.registerGlowParticles(modelYOffset, scene, modelScale);

        return;
      } catch (error) {
        console.warn(
          `[RunecraftingAltarEntity] Failed to load model, using placeholder:`,
          error,
        );
      }
    }

    // FALLBACK: Teal box placeholder
    const boxHeight = 1.0;
    const geometry = new THREE.BoxGeometry(1.0, boxHeight, 1.0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x008080, // Teal for runecrafting
      roughness: 0.4,
      metalness: 0.4,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `RunecraftingAltar_${this.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = boxHeight / 2;
    mesh.layers.set(1);
    this.mesh = mesh;

    mesh.userData = {
      type: "runecrafting_altar",
      entityId: this.id,
      name: this.displayName,
      interactable: true,
      runeType: this.runeType,
    };

    if (this.mesh && this.node) {
      this.node.add(this.mesh);
      this.node.userData.type = "runecrafting_altar";
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;
    }
  }

  /**
   * Get color palette for a given rune type.
   */
  private static getRuneColors(runeType: string): {
    core: number;
    mid: number;
    outer: number;
  } {
    switch (runeType) {
      case "air":
        return { core: 0xffffff, mid: 0xe0e8f0, outer: 0xc8d8e8 };
      case "water":
        return { core: 0x80d0ff, mid: 0x2090e0, outer: 0x1060c0 };
      case "earth":
        return { core: 0x80ff80, mid: 0x30a030, outer: 0x208020 };
      case "fire":
        return { core: 0xff6040, mid: 0xe02020, outer: 0xb01010 };
      case "mind":
        return { core: 0xe879f9, mid: 0xa855f7, outer: 0x7c3aed };
      case "body":
        return { core: 0x60a5fa, mid: 0x3080d0, outer: 0x2060a0 };
      case "cosmic":
        return { core: 0xffff80, mid: 0xc0c020, outer: 0x808010 };
      case "chaos":
        return { core: 0xff6b6b, mid: 0xdc2626, outer: 0x991b1b };
      case "nature":
        return { core: 0x60e060, mid: 0x20a020, outer: 0x108010 };
      case "law":
        return { core: 0x8080ff, mid: 0x4040e0, outer: 0x2020b0 };
      case "death":
        return { core: 0xd0d0d0, mid: 0x606060, outer: 0x303030 };
      case "blood":
        return { core: 0xff4040, mid: 0xc01010, outer: 0x800808 };
      default:
        return { core: 0xc4b5fd, mid: 0x8b5cf6, outer: 0x60a5fa };
    }
  }

  /** Access the centralized ParticleManager from the ResourceSystem. */
  private getParticleManager(): ParticleManager | undefined {
    const sys = this.world.getSystem("resource") as {
      particleManager?: ParticleManager;
    } | null;
    return sys?.particleManager;
  }

  /**
   * Register instanced glow particles via the "altar" preset.
   * All layer construction, per-particle randomisation, mesh-geometry
   * sampling, and GPU animation are handled by GlowParticleManager.
   */
  private registerGlowParticles(
    modelYOffset: number,
    meshRoot?: THREE.Object3D,
    modelScale?: number,
  ): void {
    const pm = this.getParticleManager();
    if (!pm) return;

    const colors = RunecraftingAltarEntity.getRuneColors(this.runeType);

    pm.register(this.id, {
      type: "glow",
      preset: "altar",
      position: this.getPosition(),
      color: colors,
      meshRoot,
      modelScale,
      modelYOffset,
    });

    this._registeredGlowParticles = true;
  }

  /**
   * Handle altar interaction - emits runecrafting interact event.
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    this.world.emit(EventType.RUNECRAFTING_INTERACT, {
      playerId: data.playerId,
      altarId: this.id,
      runeType: this.runeType,
    });
  }

  /**
   * Get context menu actions.
   */
  public getContextMenuActions(playerId: string): Array<{
    id: string;
    label: string;
    priority: number;
    handler: () => void;
  }> {
    return [
      {
        id: "craft_rune",
        label: "Craft-rune",
        priority: 1,
        handler: () => {
          this.world.emit(EventType.RUNECRAFTING_INTERACT, {
            playerId,
            altarId: this.id,
            runeType: this.runeType,
          });
        },
      },
      {
        id: "examine",
        label: "Examine",
        priority: 100,
        handler: () => {
          this.world.emit(EventType.UI_MESSAGE, {
            playerId,
            message: "A mysterious altar pulsing with runic energy.",
          });
        },
      },
    ];
  }

  /**
   * Override serialize() to include runeType in the initial snapshot.
   * Base Entity.serialize() only copies this.data properties — runeType
   * is an instance property so it must be added explicitly.
   */
  serialize(): EntityData {
    const baseData = super.serialize();
    return {
      ...baseData,
      runeType: this.runeType,
    };
  }

  /**
   * Network data for syncing to clients.
   */
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      runeType: this.runeType,
    };
  }
}
