/**
 * HeadstoneEntity - Corpse/Grave Entity
 *
 * Represents corpses and gravestones that contain loot items.
 * Created when players or mobs die, holds their dropped items.
 *
 * **Extends**: InteractableEntity (players can loot corpses)
 *
 * **Key Features**:
 *
 * **Corpse Types**:
 * - **Player Death**: Contains all items from player inventory (if not protected)
 * - **Mob Death**: Contains loot table drops
 * - **PvP Death**: Protected loot for killer only
 *
 * **Loot System**:
 * - Inventory of lootable items
 * - Item quantities
 * - Loot protection (owner-only for first period)
 * - Multi-player looting (items removed as looted)
 *
 * **Interaction**:
 * - "Loot" prompt when player is nearby
 * - Opens loot interface showing available items
 * - Items transferred to player inventory
 * - Empty corpses despawn automatically
 *
 * **Visual Representation**:
 * - Gravestone model (for players)
 * - Corpse model (for mobs)
 * - Name label showing who died
 * - Item count indicator
 * - Glow if valuable loot inside
 *
 * **Loot Protection**:
 * - Player corpses: Protected for owner only (unsafe PvP zones)
 * - Mob corpses: Protected for attacker for 60 seconds
 * - Shared loot after protection expires
 * - Ironman players: Only they can loot their own corpse
 *
 * **Despawning**:
 * - Empty corpses despawn immediately
 * - Player graves persist for 15 minutes
 * - Mob corpses despawn after 2 minutes
 * - Valuable loot extends despawn time
 *
 * **Network Sync**:
 * - Corpse creation broadcast to all
 * - Loot changes sync to all clients
 * - Despawn events trigger removal
 *
 * **Runs on**: Server (authoritative), Client (visual + UI)
 * **Referenced by**: DeathSystem, LootSystem, InteractionSystem
 *
 * @public
 */

import THREE from "../../extras/three/three";
import type { World } from "../../core/World";
import type {
  HeadstoneEntityConfig,
  EntityInteractionData,
} from "../../types/entities";
import type { InventoryItem, EntityData } from "../../types/core/core";
import {
  InteractableEntity,
  type InteractableConfig,
} from "../InteractableEntity";
import { EventType } from "../../types/events";

export class HeadstoneEntity extends InteractableEntity {
  protected config: HeadstoneEntityConfig;
  private lootItems: InventoryItem[] = [];
  private lootRequestHandler?: (data: unknown) => void;

  // Atomic loot operations (prevents concurrent duplication)
  private lootQueue: Promise<void> = Promise.resolve();
  private lootProtectionUntil: number = 0; // Timestamp when loot protection expires
  private protectedFor?: string; // Player ID who has loot protection (killer in PvP)

  constructor(world: World, config: HeadstoneEntityConfig) {
    // Convert HeadstoneEntityConfig to InteractableConfig format
    const interactableConfig: InteractableConfig = {
      ...config,
      interaction: {
        prompt: "Loot",
        description: config.headstoneData.deathMessage || "A corpse",
        range: 2.0,
        cooldown: 0,
        usesRemaining: -1, // Can be looted multiple times until empty
        maxUses: -1,
        effect: "loot",
      },
    };

    super(world, interactableConfig);
    this.config = config;
    this.lootItems = [...(config.headstoneData.items || [])];

    // Initialize loot protection from config
    this.lootProtectionUntil = config.headstoneData.lootProtectionUntil || 0;
    this.protectedFor = config.headstoneData.protectedFor;

    // Listen for loot requests on this specific corpse
    this.lootRequestHandler = (data: unknown) => {
      const lootData = data as {
        corpseId: string;
        playerId: string;
        itemId: string;
        quantity: number;
        slot?: number;
      };
      if (lootData.corpseId === this.id) {
        this.handleLootRequest(lootData);
      }
    };
    this.world.on(EventType.CORPSE_LOOT_REQUEST, this.lootRequestHandler);
  }

  /**
   * Check if player can loot this gravestone
   * Enforces time-based and owner-based loot protection
   */
  private canPlayerLoot(playerId: string): boolean {
    const now = Date.now();

    // Check if loot protection is active
    if (this.lootProtectionUntil && now < this.lootProtectionUntil) {
      // Loot is protected
      if (this.protectedFor && this.protectedFor !== playerId) {
        return false;
      }
    }

    // Player can loot
    return true;
  }

  /**
   * Check if player has inventory space for item
   * CRITICAL: Must check BEFORE removing from gravestone to prevent item deletion
   */
  private checkInventorySpace(
    playerId: string,
    itemId: string,
    _quantity: number,
  ): boolean {
    const inventorySystem = this.world.getSystem("inventory") as unknown as {
      getInventory: (id: string) => { items: Array<{ itemId: string }> } | null;
    } | null;
    if (!inventorySystem) {
      console.error("[HeadstoneEntity] InventorySystem not available");
      return false;
    }

    const inventory = inventorySystem.getInventory(playerId);
    if (!inventory) {
      console.error(`[HeadstoneEntity] No inventory for ${playerId}`);
      return false;
    }

    // Check if inventory is full (28 max slots - standard RuneScape inventory)
    const isFull = inventory.items.length >= 28;

    if (isFull) {
      // Check if item is stackable and already exists
      const existingItem = inventory.items.find(
        (item) => item.itemId === itemId,
      );

      // If item exists and is stackable, we can add to existing stack
      if (existingItem) {
        return true;
      }

      // Emit UI message to player
      this.world.emit(EventType.UI_MESSAGE, {
        playerId,
        message: "Your inventory is full!",
        type: "error",
      });

      return false;
    }

    // Has space
    return true;
  }

  private handleLootRequest(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
  }): void {
    // CRITICAL: Server authority check - prevent client from looting
    if (!this.world.isServer) {
      console.error(
        `[HeadstoneEntity] ⚠️  Client attempted server-only loot operation for ${this.id} - BLOCKED`,
      );
      return;
    }

    // Queue loot operation to ensure atomicity
    // Only ONE loot operation can execute at a time (prevents duplication)
    this.lootQueue = this.lootQueue
      .then(() => this.processLootRequest(data))
      .catch((error) => {
        console.error(`[HeadstoneEntity] Loot request failed:`, error);
      });
  }

  /**
   * Process loot request atomically
   * Queued to prevent concurrent access and item duplication
   */
  private async processLootRequest(data: {
    playerId: string;
    itemId: string;
    quantity: number;
    slot?: number;
  }): Promise<void> {
    // Step 1: Check loot protection
    if (!this.canPlayerLoot(data.playerId)) {
      this.world.emit(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "This loot is protected!",
        type: "error",
      });
      return;
    }

    // Step 2: Check if item exists in gravestone
    const itemIndex = this.lootItems.findIndex(
      (item) => item.itemId === data.itemId,
    );

    if (itemIndex === -1) {
      this.world.emit(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "Item already looted!",
        type: "warning",
      });
      return;
    }

    const item = this.lootItems[itemIndex];

    // Validate quantity
    const quantityToLoot = Math.min(data.quantity, item.quantity);
    if (quantityToLoot <= 0) {
      console.warn(`[HeadstoneEntity] Invalid quantity: ${data.quantity}`);
      return;
    }

    // Step 3: CRITICAL - Check inventory space BEFORE removing item
    // This prevents item deletion if inventory is full
    const hasSpace = this.checkInventorySpace(
      data.playerId,
      data.itemId,
      quantityToLoot,
    );

    if (!hasSpace) {
      // Inventory full - item NOT removed from gravestone
      // This prevents permanent item loss!
      return;
    }

    // Step 4: Atomic remove from gravestone (compare-and-swap pattern)
    const removed = this.removeItem(data.itemId, quantityToLoot);

    if (!removed) {
      this.world.emit(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "Item already looted!",
        type: "warning",
      });
      return;
    }

    // Step 5: Add to player inventory (safe now, space already checked)
    this.world.emit(EventType.INVENTORY_ITEM_ADDED, {
      playerId: data.playerId,
      item: {
        id: `loot_${data.playerId}_${Date.now()}`,
        itemId: data.itemId,
        quantity: quantityToLoot,
        slot: -1, // Auto-assign slot
        metadata: null,
      },
    });
  }

  protected async createMesh(): Promise<void> {
    // Don't create mesh on server
    if (this.world.isServer) {
      return;
    }

    // Create a tombstone/pile visual for the corpse
    const geometry = new THREE.BoxGeometry(1.5, 0.5, 1.0);
    const material = new THREE.MeshLambertMaterial({
      color: 0x4a4a4a, // Gray for corpse
      transparent: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Corpse_${this.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;

    // Set up userData
    mesh.userData = {
      type: "corpse",
      entityId: this.id,
      name: this.config.name,
      interactable: true,
      corpseData: {
        id: this.id,
        playerName: this.config.headstoneData.playerName,
        deathMessage: this.config.headstoneData.deathMessage,
        itemCount: this.lootItems.length,
      },
    };

    // Add mesh to the entity's node
    if (this.mesh && this.node) {
      this.node.add(this.mesh);

      // Also set userData on node for easier detection
      this.node.userData.type = "corpse";
      this.node.userData.entityId = this.id;
      this.node.userData.interactable = true;

      // Add text label above corpse
      this.createNameLabel();
    }
  }

  private createNameLabel(): void {
    if (!this.mesh || this.world.isServer) return;

    // Text will be handled by a nametag system
    // For now, just ensure userData has the name
    if (this.mesh.userData) {
      this.mesh.userData.showLabel = true;
      this.mesh.userData.labelText = this.config.headstoneData.playerName
        ? `${this.config.headstoneData.playerName}'s corpse`
        : "Corpse";
    }
  }

  /**
   * Handle corpse interaction - shows loot interface
   */
  public async handleInteraction(data: EntityInteractionData): Promise<void> {
    const lootData = {
      corpseId: this.id,
      playerId: data.playerId,
      lootItems: this.lootItems,
      position: this.getPosition(),
    };

    // Emit local event for server-side systems
    // NOTE: No loot protection needed - gravestone spawns AFTER respawn (RuneScape-style)
    this.world.emit(EventType.CORPSE_CLICK, lootData);

    // Send to specific client over network (opens loot UI immediately)
    if (this.world.isServer && this.world.network) {
      const network = this.world.network as {
        sendTo?: (playerId: string, event: string, data: unknown) => void;
      };
      if (network.sendTo) {
        network.sendTo(data.playerId, "corpseLoot", lootData);
      }
    }
  }

  /**
   * Remove an item from the corpse loot
   */
  public removeItem(itemId: string, quantity: number): boolean {
    const itemIndex = this.lootItems.findIndex(
      (item) => item.itemId === itemId,
    );
    if (itemIndex === -1) {
      return false;
    }

    const item = this.lootItems[itemIndex];

    if (item.quantity > quantity) {
      item.quantity -= quantity;
    } else {
      this.lootItems.splice(itemIndex, 1);
    }

    // Update userData
    if (this.mesh?.userData?.corpseData) {
      this.mesh.userData.corpseData.itemCount = this.lootItems.length;
    }

    // If no items left, mark for despawn
    if (this.lootItems.length === 0) {
      this.world.emit(EventType.CORPSE_EMPTY, {
        corpseId: this.id,
        playerId: this.config.headstoneData.playerId,
      });

      // Despawn almost immediately after all items taken (RuneScape-style)
      setTimeout(() => {
        // Use EntityManager to properly remove entity (sends entityRemoved packet to clients)
        const entityManager = this.world.getSystem("entity-manager") as {
          destroyEntity?: (id: string) => void;
        } | null;
        if (entityManager?.destroyEntity) {
          entityManager.destroyEntity(this.id);
        } else {
          this.world.entities.remove(this.id);
        }
      }, 500);
    }

    this.markNetworkDirty();
    return true;
  }

  /**
   * Get all loot items
   */
  public getLootItems(): InventoryItem[] {
    return [...this.lootItems];
  }

  /**
   * Check if corpse has loot
   */
  public hasLoot(): boolean {
    return this.lootItems.length > 0;
  }

  /**
   * Network data override - MUST include lootItems for client LootWindow
   */
  getNetworkData(): Record<string, unknown> {
    const baseData = super.getNetworkData();
    return {
      ...baseData,
      lootItemCount: this.lootItems.length,
      lootItems: this.lootItems, // CRITICAL: Send actual items to client for LootWindow
      despawnTime: this.config.headstoneData.despawnTime,
      playerId: this.config.headstoneData.playerId,
      deathMessage: this.config.headstoneData.deathMessage,
    };
  }

  /**
   * Override serialize() to include lootItems in network packet
   * CRITICAL: Base Entity.serialize() only copies this.data, but lootItems is a private field
   */
  serialize(): EntityData {
    const baseData = super.serialize();
    return {
      ...baseData,
      headstoneData: {
        playerId: this.config.headstoneData.playerId,
        playerName: this.config.headstoneData.playerName,
        deathTime: this.config.headstoneData.deathTime,
        deathMessage: this.config.headstoneData.deathMessage,
        position: this.config.headstoneData.position,
        items: this.lootItems, // CRITICAL: Include actual loot items for client
        itemCount: this.lootItems.length,
        despawnTime: this.config.headstoneData.despawnTime,
      },
      lootItems: this.lootItems, // Also include at root level for easy access
      lootItemCount: this.lootItems.length,
    } as unknown as EntityData;
  }

  protected serverUpdate(deltaTime: number): void {
    super.serverUpdate(deltaTime);

    // Check if corpse should despawn
    if (this.world.getTime() > this.config.headstoneData.despawnTime) {
      this.world.entities.remove(this.id);
    }
  }

  protected clientUpdate(deltaTime: number): void {
    super.clientUpdate(deltaTime);

    // Slight floating animation
    if (this.mesh) {
      const time = this.world.getTime() * 0.001;
      this.mesh.position.y = 0.25 + Math.sin(time * 1) * 0.05;
    }
  }

  public destroy(): void {
    // Clean up event listener
    if (this.lootRequestHandler) {
      this.world.off(EventType.CORPSE_LOOT_REQUEST, this.lootRequestHandler);
      this.lootRequestHandler = undefined;
    }
    super.destroy();
  }
}
