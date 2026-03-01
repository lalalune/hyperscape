/**
 * StarterChestEntity - One-time lootable chest for new players
 *
 * Provides basic starter tools to new players:
 * - Bronze hatchet (woodcutting)
 * - Bronze pickaxe (mining)
 * - Tinderbox (firemaking)
 * - Small fishing net (fishing)
 * - Bread x5 (food)
 *
 * Each character can only loot this chest once.
 *
 * **Extends**: InteractableEntity
 *
 * **Interaction**:
 * - Left-click: Loots starter items (one-time per character)
 *
 * **Visual Representation**:
 * - Wooden chest with golden trim (distinct from bank's dark metallic chest)
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
import { CollisionFlag } from "../../systems/shared/movement/CollisionFlags";
import {
  worldToTile,
  type TileCoord,
} from "../../systems/shared/movement/TileSystem";

/** Starter items given to new players */
const STARTER_ITEMS = [
  { itemId: "bronze_hatchet", quantity: 1 },
  { itemId: "bronze_pickaxe", quantity: 1 },
  { itemId: "tinderbox", quantity: 1 },
  { itemId: "small_fishing_net", quantity: 1 },
  { itemId: "shrimp", quantity: 5 }, // Cooked shrimp for starter food
];

export interface StarterChestEntityConfig {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  visible?: boolean;
  interactable?: boolean;
  interactionDistance?: number;
  description?: string;
}

export class StarterChestEntity extends InteractableEntity {
  protected chestConfig: StarterChestEntityConfig;

  /** Tiles this chest occupies for collision */
  private collisionTiles: TileCoord[] = [];

  /**
   * Set of character IDs that have already looted this chest (server-side tracking)
   * NOTE: This is in-memory only - resets on server restart.
   * For production, this should be stored in the database.
   */
  private static lootedByCharacters: Set<string> = new Set();

  /**
   * Maximum number of looted character IDs to track before pruning
   * This prevents unbounded memory growth in long-running servers
   */
  private static readonly MAX_LOOTED_TRACKING = 10000;

  constructor(world: World, config: StarterChestEntityConfig) {
    const interactableConfig: InteractableConfig = {
      id: config.id,
      name: config.name || "Starter Chest",
      type: EntityType.STARTER_CHEST,
      position: config.position,
      rotation: config.rotation || { x: 0, y: 0, z: 0, w: 1 },
      scale: config.scale || { x: 1, y: 1, z: 1 },
      visible: config.visible !== false,
      interactable: config.interactable !== false,
      interactionType: InteractionType.LOOT,
      interactionDistance: config.interactionDistance || 2,
      description:
        config.description ||
        "A chest containing starter equipment for new adventurers.",
      model: null,
      interaction: {
        prompt: "Search",
        description: "Search the chest for starter equipment",
        range: config.interactionDistance || 2,
        cooldown: 0,
        usesRemaining: -1,
        maxUses: -1,
        effect: "loot_starter",
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
    this.chestConfig = config;

    // Register collision (server-side only)
    if (this.world.isServer) {
      const tile = worldToTile(config.position.x, config.position.z);
      this.collisionTiles.push(tile);
      this.world.collision.addFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
    }
  }

  /**
   * Check if a character has already looted this chest
   */
  static hasLooted(characterId: string): boolean {
    return StarterChestEntity.lootedByCharacters.has(characterId);
  }

  /**
   * Mark a character as having looted this chest
   * Automatically prunes oldest entries if max tracking limit is reached
   */
  static markLooted(characterId: string): void {
    // Check if we need to prune before adding
    if (
      StarterChestEntity.lootedByCharacters.size >=
      StarterChestEntity.MAX_LOOTED_TRACKING
    ) {
      // Remove roughly 10% of oldest entries (Sets iterate in insertion order)
      const pruneCount = Math.floor(
        StarterChestEntity.MAX_LOOTED_TRACKING * 0.1,
      );
      let removed = 0;
      for (const id of StarterChestEntity.lootedByCharacters) {
        if (removed >= pruneCount) break;
        StarterChestEntity.lootedByCharacters.delete(id);
        removed++;
      }
      console.warn(
        `[StarterChest] Pruned ${removed} old looted entries (reached max tracking limit)`,
      );
    }
    StarterChestEntity.lootedByCharacters.add(characterId);
  }

  /**
   * Clear all looted character tracking
   * Used for server shutdown cleanup
   */
  static clearLootedTracking(): void {
    StarterChestEntity.lootedByCharacters.clear();
  }

  /**
   * Get the number of characters being tracked
   * Useful for monitoring memory usage
   */
  static getLootedCount(): number {
    return StarterChestEntity.lootedByCharacters.size;
  }

  /**
   * Get the list of starter items
   */
  static getStarterItems(): Array<{ itemId: string; quantity: number }> {
    return [...STARTER_ITEMS];
  }

  /**
   * Clean up collision when destroyed
   */
  destroy(local?: boolean): void {
    if (this.world.isServer && this.collisionTiles.length > 0) {
      for (const tile of this.collisionTiles) {
        this.world.collision.removeFlags(tile.x, tile.z, CollisionFlag.BLOCKED);
      }
      this.collisionTiles = [];
    }
    super.destroy(local);
  }

  /**
   * Return tiles occupied by this chest
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

    // Create a wooden chest with golden trim
    const boxHeight = 0.6;
    const boxWidth = 0.8;
    const boxDepth = 0.6;

    // Main chest body (wood brown)
    const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    const material = new MeshStandardNodeMaterial({
      color: 0x8b4513, // Saddle brown (wood color)
      roughness: 0.7,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `StarterChest_${this.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = boxHeight / 2;

    // Add golden trim on top (lid edge)
    const trimGeometry = new THREE.BoxGeometry(
      boxWidth + 0.05,
      0.05,
      boxDepth + 0.05,
    );
    const trimMaterial = new MeshStandardNodeMaterial({
      color: 0xffd700, // Gold
      roughness: 0.3,
      metalness: 0.8,
    });
    const trim = new THREE.Mesh(trimGeometry, trimMaterial);
    trim.position.y = boxHeight;
    mesh.add(trim);

    // Add golden lock on front
    const lockGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.05);
    const lock = new THREE.Mesh(lockGeometry, trimMaterial);
    lock.position.set(0, boxHeight * 0.4, boxDepth / 2 + 0.025);
    mesh.add(lock);

    this.mesh = mesh;

    // Set up userData for interaction detection
    mesh.userData = {
      type: "starter_chest",
      entityId: this.id,
      name: this.chestConfig.name,
      interactable: true,
    };

    if (this.mesh && this.node) {
      this.node.add(this.mesh);
      this.node.userData.type = "starter_chest";
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;
    }
  }

  /**
   * Handle chest interaction - gives starter items to player (once per character)
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    console.log(
      `[StarterChest] handleInteraction called: playerId=${data.playerId}, isServer=${this.world.isServer}`,
    );

    if (!this.world.isServer) {
      console.log("[StarterChest] Not server, returning early");
      return;
    }

    const playerId = data.playerId;

    // Check if this character has already looted
    const alreadyLooted = StarterChestEntity.hasLooted(playerId);
    console.log(
      `[StarterChest] Player ${playerId} alreadyLooted=${alreadyLooted}`,
    );

    if (alreadyLooted) {
      // Send message to player that they've already looted
      if (this.world.network) {
        const network = this.world.network as {
          sendTo?: (playerId: string, packet: string, data: unknown) => void;
        };
        if (network.sendTo) {
          network.sendTo(playerId, "chatMessage", {
            message:
              "You have already taken the starter equipment from this chest.",
            type: "game",
          });
        }
      }
      return;
    }

    // Mark as looted
    StarterChestEntity.markLooted(playerId);
    console.log(`[StarterChest] Marked player ${playerId} as looted`);

    // Give starter items to player
    const items = StarterChestEntity.getStarterItems();
    console.log(
      `[StarterChest] Emitting STARTER_CHEST_LOOTED with ${items.length} items`,
    );

    // Emit event to add items to player inventory
    this.world.emit(EventType.STARTER_CHEST_LOOTED, {
      playerId,
      items,
    });

    // Send success message
    if (this.world.network) {
      const network = this.world.network as {
        sendTo?: (playerId: string, packet: string, data: unknown) => void;
      };
      if (network.sendTo) {
        network.sendTo(playerId, "chatMessage", {
          message: "You found some starter equipment! Check your inventory.",
          type: "game",
        });
      }
    }

    console.log(`[StarterChest] Player ${playerId} looted starter chest`);
  }

  /**
   * Network data
   */
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      chestType: "starter",
    };
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);
  }
}
