import { SystemBase } from "..";
import type { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import {
  getNearestTown,
  WORLD_STRUCTURE_CONSTANTS,
} from "../../../data/world-structure";
import type { HeadstoneData } from "../../../types/entities";
import type {
  ZoneData,
  InventoryItem,
  HeadstoneApp,
  DeathLocationData,
} from "../../../types/core/core";
import {
  calculateDistance,
  groundToTerrain,
} from "../../../utils/game/EntityUtils";
import { EntityType, InteractionType } from "../../../types/entities";
import type { HeadstoneEntityConfig } from "../../../types/entities";
import type { EntityManager } from "..";
import { ZoneDetectionSystem } from "../death/ZoneDetectionSystem";
import { GroundItemManager } from "../death/GroundItemManager";
import { DeathStateManager } from "../death/DeathStateManager";
import { SafeAreaDeathHandler } from "../death/SafeAreaDeathHandler";
import { WildernessDeathHandler } from "../death/WildernessDeathHandler";
import { ZoneType } from "../../../types/death";
import type { InventorySystem } from "../character/InventorySystem";

/**
 * Player Death and Respawn System - Orchestrator Pattern
 * Coordinates death mechanics using modular handlers:
 * - ZoneDetectionSystem: Determines safe vs wilderness zones
 * - SafeAreaDeathHandler: Handles gravestone → ground items (5min → 2min)
 * - WildernessDeathHandler: Handles immediate ground item drops (2min)
 * - DeathStateManager: Database death locks (anti-duplication)
 * - GroundItemManager: Ground item lifecycle management
 *
 * RuneScape-style mechanics:
 * - Safe zones: Items → gravestone (5min) → ground items (2min) → despawn
 * - Wilderness: Items → ground items immediately (2min) → despawn
 * - Player respawns at Central Haven (0, 0) instantly on button click
 *
 * NOTE: Mob deaths are handled by MobDeathSystem (separate file)
 */
export class PlayerDeathSystem extends SystemBase {
  private deathLocations = new Map<string, DeathLocationData>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private playerPositions = new Map<
    string,
    { x: number; y: number; z: number }
  >();
  private playerInventories = new Map<
    string,
    { items: InventoryItem[]; coins: number }
  >();

  // Modular death system components
  private zoneDetection!: ZoneDetectionSystem;
  private groundItemManager!: GroundItemManager;
  private deathStateManager!: DeathStateManager;
  private safeAreaHandler!: SafeAreaDeathHandler;
  private wildernessHandler!: WildernessDeathHandler;

  constructor(world: World) {
    super(world, {
      name: "player-death",
      dependencies: { required: [], optional: ["inventory", "entity-manager"] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Initialize modular death system components
    this.zoneDetection = new ZoneDetectionSystem(this.world);
    await this.zoneDetection.init();

    const entityManager =
      this.world.getSystem<EntityManager>("entity-manager")!;
    this.groundItemManager = new GroundItemManager(this.world, entityManager);
    this.deathStateManager = new DeathStateManager(this.world);
    await this.deathStateManager.init();

    this.safeAreaHandler = new SafeAreaDeathHandler(
      this.world,
      this.groundItemManager,
      this.deathStateManager,
    );

    this.wildernessHandler = new WildernessDeathHandler(
      this.world,
      this.groundItemManager,
      this.deathStateManager,
    );

    console.log(
      "[PlayerDeathSystem] Initialized modular death system components",
    );

    // Event subscriptions
    // Listen for death events via event bus
    this.subscribe(
      EventType.ENTITY_DEATH,
      (data: {
        entityId: string;
        killedBy: string;
        entityType: "player" | "mob";
      }) => this.handlePlayerDeath(data),
    );
    this.subscribe(
      EventType.PLAYER_RESPAWN_REQUEST,
      (data: { playerId: string }) => this.handleRespawnRequest(data),
    );
    this.subscribe(EventType.DEATH_LOOT_COLLECT, (data: { playerId: string }) =>
      this.handleLootCollection(data),
    );
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data: { id: string }) =>
      this.cleanupPlayerDeath(data),
    );
    this.subscribe(
      EventType.DEATH_HEADSTONE_EXPIRED,
      (data: { headstoneId: string; playerId: string }) =>
        this.handleHeadstoneExpired(data),
    );

    // Listen to position updates for reactive patterns
    this.subscribe(
      EventType.PLAYER_POSITION_UPDATED,
      (data: {
        playerId: string;
        position: { x: number; y: number; z: number };
      }) => {
        this.playerPositions.set(data.playerId, data.position);
      },
    );

    // Listen to inventory updates for reactive patterns
    this.subscribe(
      EventType.INVENTORY_UPDATED,
      (data: { playerId: string; items: InventoryItem[]; coins: number }) => {
        const inventory = this.playerInventories.get(data.playerId) || {
          items: [],
          coins: 0,
        };
        inventory.items = data.items;
        this.playerInventories.set(data.playerId, inventory);
      },
    );

    this.subscribe(
      EventType.INVENTORY_COINS_UPDATED,
      (data: { playerId: string; newAmount: number }) => {
        const inventory = this.playerInventories.get(data.playerId) || {
          items: [],
          coins: 0,
        };
        inventory.coins = data.newAmount;
        this.playerInventories.set(data.playerId, inventory);
      },
    );

    // Clean up inventory cache when player unregisters
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data: { id: string }) => {
      this.playerInventories.delete(data.id);
    });
  }

  destroy(): void {
    // Clean up modular death system components
    if (this.safeAreaHandler) {
      this.safeAreaHandler.destroy();
    }
    if (this.wildernessHandler) {
      this.wildernessHandler.destroy();
    }
    if (this.groundItemManager) {
      this.groundItemManager.destroy();
    }

    // Clear all respawn timers
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    this.respawnTimers.clear();

    // Clear death locations
    this.deathLocations.clear();

    console.log("[PlayerDeathSystem] Cleaned up all death system resources");
  }

  private handlePlayerDeath(data: {
    entityId: string;
    killedBy: string;
    entityType: "player" | "mob";
  }): void {
    console.log(
      `[PlayerDeathSystem] handlePlayerDeath called, entityId: ${data.entityId}, type: ${data.entityType}, killedBy: ${data.killedBy}`,
    );

    // Only handle player deaths - mob deaths are handled by MobDeathSystem
    if (data.entityType !== "player") {
      return;
    }

    const playerId = data.entityId;
    console.log(`[PlayerDeathSystem] Processing player death for ${playerId}`);

    // Get player's current position - try multiple sources for robustness
    let position = this.playerPositions.get(playerId);

    if (!position) {
      // Fallback 1: Try to get position from player entity
      const playerEntity = this.world.entities?.get?.(playerId);
      if (playerEntity) {
        const entityPos = playerEntity.position || playerEntity.getPosition?.();
        if (entityPos) {
          position = { x: entityPos.x, y: entityPos.y, z: entityPos.z };
        }
      }
    }

    if (!position) {
      // Fallback 2: Try to get from player system
      const playerSystem = this.world.getSystem?.("player") as any;
      if (playerSystem) {
        const player = playerSystem.players?.get?.(playerId);
        if (player?.position) {
          position = { ...player.position };
        }
      }
    }

    if (!position) {
      // Ultimate fallback: Use spawn location
      console.warn(
        `[PlayerDeathSystem] Could not find position for player ${playerId}, using default spawn`,
      );
      position = { x: 0, y: 10, z: 0 };
    }

    this.processPlayerDeath(playerId, position, data.killedBy);
  }

  private async processPlayerDeath(
    playerId: string,
    deathPosition: { x: number; y: number; z: number },
    killedBy: string,
  ): Promise<void> {
    console.log(
      `[PlayerDeathSystem] processPlayerDeath starting for ${playerId} at position:`,
      deathPosition,
    );

    // Get inventory system for immediate clearing
    const inventorySystem = this.world.getSystem<InventorySystem>("inventory");
    if (!inventorySystem) {
      console.error("[PlayerDeathSystem] InventorySystem not available");
      return;
    }

    // Get all items directly from InventorySystem BEFORE clearing (production-quality: don't rely on cache)
    const inventory = inventorySystem.getInventory(playerId);
    if (!inventory) {
      console.warn(
        `[PlayerDeathSystem] No inventory found for ${playerId}, cannot drop items`,
      );
      // Still need to handle death even if no inventory (respawn, etc.)
    }

    const itemsToDrop: InventoryItem[] =
      inventory?.items.map((item, index) => ({
        id: `death_${playerId}_${Date.now()}_${index}`,
        itemId: item.itemId,
        quantity: item.quantity,
        slot: item.slot,
        metadata: null,
      })) || [];

    console.log(
      `[PlayerDeathSystem] Player has ${itemsToDrop.length} items to drop:`,
      itemsToDrop
        .map((item) => `${item.itemId} x${item.quantity}`)
        .join(", ") || "(none)",
    );

    // CRITICAL: Clear inventory IMMEDIATELY with database persist (anti-duplication)
    console.log(
      `[PlayerDeathSystem] Clearing inventory immediately for ${playerId}`,
    );
    await inventorySystem.clearInventoryImmediate(playerId);

    // Detect zone type (safe vs wilderness)
    const zoneType = this.zoneDetection.getZoneType(deathPosition);
    console.log(`[PlayerDeathSystem] Death in zone type: ${zoneType}`);

    // Delegate to appropriate handler based on zone type
    if (zoneType === ZoneType.SAFE_AREA) {
      // Safe area: Spawn gravestone
      console.log(`[PlayerDeathSystem] Delegating to SafeAreaDeathHandler`);
      await this.safeAreaHandler.handleDeath(
        playerId,
        deathPosition,
        itemsToDrop,
        killedBy,
      );
    } else {
      // Wilderness/PvP: Immediate ground item drop
      console.log(`[PlayerDeathSystem] Delegating to WildernessDeathHandler`);
      await this.wildernessHandler.handleDeath(
        playerId,
        deathPosition,
        itemsToDrop,
        killedBy,
        zoneType,
      );
    }

    // Store death location for tracking
    const deathData: DeathLocationData = {
      playerId,
      deathPosition,
      timestamp: Date.now(),
      items: itemsToDrop,
    };
    this.deathLocations.set(playerId, deathData);

    // Set player as dead and disable movement
    this.emitTypedEvent(EventType.PLAYER_SET_DEAD, {
      playerId,
      isDead: true,
      deathPosition,
    });

    // Hide player visually (dead state)
    const playerEntity = this.world.entities?.get?.(playerId);
    if (playerEntity && "data" in playerEntity) {
      const entityData = playerEntity.data as { e?: string; visible?: boolean };
      entityData.visible = false;

      if ("markNetworkDirty" in playerEntity) {
        (playerEntity as { markNetworkDirty: () => void }).markNetworkDirty();
      }
      console.log(`[PlayerDeathSystem] Hid player ${playerId} (dead)`);
    }

    // Start auto-respawn timer (5 minutes as fallback)
    const AUTO_RESPAWN_FALLBACK_TIME = 5 * 60 * 1000;
    const respawnTimer = setTimeout(() => {
      console.log(
        `[PlayerDeathSystem] Auto-respawn fallback triggered for ${playerId}`,
      );
      this.initiateRespawn(playerId);
    }, AUTO_RESPAWN_FALLBACK_TIME);

    this.respawnTimers.set(playerId, respawnTimer);

    // Notify player of death (show death screen)
    console.log(`[PlayerDeathSystem] Emitting UI_DEATH_SCREEN for ${playerId}`);
    this.emitTypedEvent(EventType.UI_DEATH_SCREEN, {
      playerId,
      message: `Click the button below to respawn at Central Haven.`,
      deathLocation: deathPosition,
      killedBy,
      respawnTime: 0, // Instant respawn on button click
    });
    console.log(
      `[PlayerDeathSystem] Death processing completed for ${playerId}`,
    );
  }

  /**
   * Create headstone entity with items using EntityManager
   * Follows same pattern as LootSystem for mob corpses
   */
  private async createHeadstoneEntity(
    playerId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
    killedBy: string,
  ): Promise<void> {
    const headstoneId = `headstone_${playerId}_${Date.now()}`;

    // Get player's name from entity or use playerId
    const playerEntity = this.world.entities?.get?.(playerId);
    const playerName =
      (playerEntity &&
        "data" in playerEntity &&
        (playerEntity.data as any).name) ||
      playerId;

    // Get EntityManager to spawn headstone
    const entityManager = this.world.getSystem<EntityManager>("entity-manager");
    if (!entityManager) {
      console.error(
        "[PlayerDeathSystem] EntityManager not found, cannot spawn headstone",
      );
      return;
    }

    // Ground headstone to terrain (same as LootSystem does)
    const groundedPosition = groundToTerrain(
      this.world,
      position,
      0.2,
      Infinity,
    );

    // Create headstone entity config (same format as LootSystem uses for mob corpses)
    const headstoneConfig: HeadstoneEntityConfig = {
      id: headstoneId,
      name: `${playerName}'s Grave`,
      type: EntityType.HEADSTONE,
      position: groundedPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      interactable: true,
      interactionType: InteractionType.LOOT,
      interactionDistance: 2,
      description: `${playerName}'s grave`,
      model: null,
      headstoneData: {
        playerId,
        playerName,
        deathTime: Date.now(),
        deathMessage: `Killed by ${killedBy}`,
        position: groundedPosition,
        items: [...items],
        itemCount: items.length,
        despawnTime:
          Date.now() + WORLD_STRUCTURE_CONSTANTS.DEATH_ITEM_DESPAWN_TIME, // 5 minutes for player graves
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

    // Spawn the headstone entity
    const headstoneEntity = await entityManager.spawnEntity(headstoneConfig);
    if (!headstoneEntity) {
      console.error(
        "[PlayerDeathSystem] Failed to spawn headstone entity for player",
        playerId,
      );
      return;
    }

    console.log(
      `[PlayerDeathSystem] Spawned headstone entity ${headstoneId} at (${groundedPosition.x}, ${groundedPosition.y}, ${groundedPosition.z}) with ${items.length} items`,
    );

    // Store headstone entity ID for tracking
    const deathData = this.deathLocations.get(playerId);
    if (deathData) {
      (deathData as any).headstoneId = headstoneId;
    }
  }

  private initiateRespawn(playerId: string): void {
    // Clear respawn timer
    this.respawnTimers.delete(playerId);

    const deathData = this.deathLocations.get(playerId);
    if (!deathData) {
      throw new Error(
        `[PlayerDeathSystem] No death data found for player ${playerId}`,
      );
    }

    // RuneScape-style: Always respawn at dedicated death spawn (like Lumbridge)
    // Central Haven (0, 0) is our death respawn location
    // Y coordinate will be properly grounded by PlayerSystem's spawn logic
    const DEATH_RESPAWN_POSITION = { x: 0, y: 0, z: 0 };
    const DEATH_RESPAWN_TOWN = "Central Haven";

    console.log(
      `[PlayerDeathSystem] Respawning player ${playerId} at death spawn: ${DEATH_RESPAWN_TOWN} (${DEATH_RESPAWN_POSITION.x}, ${DEATH_RESPAWN_POSITION.z})`,
    );

    // Respawn player at death spawn location (handles terrain grounding internally)
    this.respawnPlayer(playerId, DEATH_RESPAWN_POSITION, DEATH_RESPAWN_TOWN);
  }

  private respawnPlayer(
    playerId: string,
    spawnPosition: { x: number; y: number; z: number },
    townName: string,
  ): void {
    console.log(
      `[PlayerDeathSystem] respawnPlayer called for ${playerId} at (${spawnPosition.x}, ${spawnPosition.y}, ${spawnPosition.z})`,
    );

    // Restore player entity health and visibility FIRST
    const playerEntity = this.world.entities?.get?.(playerId);
    if (playerEntity) {
      console.log(`[PlayerDeathSystem] Found player entity for ${playerId}`);

      // Restore health
      if ("setHealth" in playerEntity && "getMaxHealth" in playerEntity) {
        const maxHealth = (playerEntity as any).getMaxHealth();
        (playerEntity as any).setHealth(maxHealth);
        console.log(`[PlayerDeathSystem] Restored health to ${maxHealth}`);
      }

      // Make visible and reset emote
      if ("data" in playerEntity) {
        const entityData = playerEntity.data as {
          e?: string;
          visible?: boolean;
        };

        entityData.e = "idle";
        entityData.visible = true;

        if ("markNetworkDirty" in playerEntity) {
          (playerEntity as { markNetworkDirty: () => void }).markNetworkDirty();
        }
        console.log(`[PlayerDeathSystem] Made player visible and set to idle`);
      }
    } else {
      console.warn(
        `[PlayerDeathSystem] Could not find player entity for ${playerId}!`,
      );
    }

    // Ground to terrain (use same logic as initial player spawn)
    const terrainSystem = this.world.getSystem("terrain") as any;
    let groundedY = spawnPosition.y;

    if (terrainSystem && terrainSystem.isReady && terrainSystem.isReady()) {
      // Get terrain height at respawn position
      const terrainHeight = terrainSystem.getHeightAt(
        spawnPosition.x,
        spawnPosition.z,
      );
      if (Number.isFinite(terrainHeight)) {
        // Use +0.1 offset like initial spawn (not +2.0)
        groundedY = terrainHeight + 0.1;
        console.log(
          `[PlayerDeathSystem] Grounded player at terrain height ${terrainHeight}, Y=${groundedY}`,
        );
      } else {
        groundedY = 10; // Fallback safe height
        console.warn(
          `[PlayerDeathSystem] Invalid terrain height, using fallback Y=${groundedY}`,
        );
      }
    } else {
      // Terrain not ready; use safe height
      groundedY = 10;
      console.warn(
        `[PlayerDeathSystem] Terrain not ready, using safe height Y=${groundedY}`,
      );
    }

    const groundedPosition = {
      x: spawnPosition.x,
      y: groundedY,
      z: spawnPosition.z,
    };

    // Update server-side entity position directly (no PLAYER_SPAWN_REQUEST to avoid triggering goblin spawns)
    // Reuse playerEntity from above
    if (playerEntity) {
      // Update Three.js node position (server-side authoritative position)
      if ("node" in playerEntity && playerEntity.node) {
        (playerEntity.node as any).position.set(
          groundedPosition.x,
          groundedPosition.y,
          groundedPosition.z,
        );
        console.log(
          `[PlayerDeathSystem] Updated entity.node.position to (${groundedPosition.x}, ${groundedPosition.y}, ${groundedPosition.z})`,
        );
      }

      // Update entity.data.position array (network sync data)
      if ("data" in playerEntity) {
        const entityData = playerEntity.data as {
          position?: number[];
        };

        if (Array.isArray(entityData.position)) {
          entityData.position[0] = groundedPosition.x;
          entityData.position[1] = groundedPosition.y;
          entityData.position[2] = groundedPosition.z;
          console.log(`[PlayerDeathSystem] Updated entity.data.position`);
        }

        if ("markNetworkDirty" in playerEntity) {
          (playerEntity as { markNetworkDirty: () => void }).markNetworkDirty();
        }
      }

      // Update entity.position if it exists
      if ("position" in playerEntity && playerEntity.position) {
        const pos = playerEntity.position as {
          x: number;
          y: number;
          z: number;
        };
        pos.x = groundedPosition.x;
        pos.y = groundedPosition.y;
        pos.z = groundedPosition.z;
        console.log(`[PlayerDeathSystem] Updated entity.position`);
      }
    }

    // Send teleport packet to client
    if (this.world.network && "sendTo" in this.world.network) {
      (this.world.network as any).sendTo(playerId, "playerTeleport", {
        playerId,
        position: [groundedPosition.x, groundedPosition.y, groundedPosition.z],
      });
      console.log(`[PlayerDeathSystem] Sent playerTeleport packet to client`);
    }

    // Emit PLAYER_RESPAWNED for PlayerSystem to update player data
    this.emitTypedEvent(EventType.PLAYER_RESPAWNED, {
      playerId,
      spawnPosition: groundedPosition,
      townName,
      deathLocation: this.deathLocations.get(playerId)?.deathPosition,
    });
    console.log(`[PlayerDeathSystem] Emitted PLAYER_RESPAWNED event`);

    // Restore player to alive state
    this.emitTypedEvent(EventType.PLAYER_SET_DEAD, {
      playerId,
      isDead: false,
    });
    console.log(`[PlayerDeathSystem] Set player alive state`);

    // Notify player of respawn
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You have respawned in ${townName}. Your items remain at your death location.`,
      type: "info",
    });

    // Close death screen
    this.emitTypedEvent(EventType.UI_DEATH_SCREEN_CLOSE, { playerId });
    console.log(`[PlayerDeathSystem] Emitted UI_DEATH_SCREEN_CLOSE`);
  }

  private handleRespawnRequest(data: { playerId: string }): void {
    console.log(
      `[PlayerDeathSystem] Respawn request received for player ${data.playerId}`,
    );
    // Allow immediate respawn if timer is still active (e.g., clicked respawn button)
    const timer = this.respawnTimers.get(data.playerId);
    if (timer) {
      console.log(
        `[PlayerDeathSystem] Clearing auto-respawn timer, respawning ${data.playerId} immediately`,
      );
      clearTimeout(timer);
      this.respawnTimers.delete(data.playerId);
      this.initiateRespawn(data.playerId);
    } else {
      console.log(
        `[PlayerDeathSystem] No active respawn timer for ${data.playerId} (already respawned?)`,
      );
    }
  }

  private handleLootCollection(data: { playerId: string }): void {
    const deathData = this.deathLocations.get(data.playerId);
    if (!deathData) {
      return;
    }

    // Check if player is near their death location (within 3 meters) - reactive pattern
    const playerPosition = this.playerPositions.get(data.playerId);
    if (!playerPosition) {
      this.logger.error(`Could not get position for player ${data.playerId}`);
      return;
    }

    const distance = calculateDistance(playerPosition, deathData.deathPosition);

    if (distance > 3) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: "You need to be closer to your grave to collect your items.",
        type: "error",
      });
      return;
    }

    // Return all items to player
    let returnedItems = 0;
    for (const item of deathData.items) {
      this.emitTypedEvent(EventType.INVENTORY_CAN_ADD, {
        playerId: data.playerId,
        item: item,
        callback: (canAdd: boolean) => {
          if (canAdd) {
            this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
              playerId: data.playerId,
              item: item,
            });
            returnedItems++;
          } else {
            // If inventory full, create ground item
            this.emitTypedEvent(EventType.WORLD_CREATE_GROUND_ITEM, {
              position: playerPosition,
              item: item,
            });
          }
        },
      });
    }

    // Clear death location and timers
    this.clearDeathLocation(data.playerId);

    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: `Retrieved ${returnedItems} items from your grave.`,
      type: "success",
    });
  }

  /**
   * Despawn death items after 5 minutes
   * Destroys the headstone entity using EntityManager
   */
  private despawnDeathItems(playerId: string): void {
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return;

    // Get headstone ID from death data
    const headstoneId = (deathData as any).headstoneId;
    if (headstoneId) {
      // Destroy headstone entity via EntityManager
      const entityManager =
        this.world.getSystem<EntityManager>("entity-manager");
      if (entityManager) {
        entityManager.destroyEntity(headstoneId);
        console.log(
          `[PlayerDeathSystem] Despawned headstone ${headstoneId} for player ${playerId}`,
        );
      }
    }

    // Clear death location
    this.clearDeathLocation(playerId);

    // Notify player if online
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: "Your death items have despawned due to timeout.",
      type: "warning",
    });
  }

  private clearDeathLocation(playerId: string): void {
    // Clear all data and timers for this player's death
    this.deathLocations.delete(playerId);

    const respawnTimer = this.respawnTimers.get(playerId);
    if (respawnTimer) {
      clearTimeout(respawnTimer);
      this.respawnTimers.delete(playerId);
    }

    // Item despawn is now handled by GroundItemManager
  }

  private cleanupPlayerDeath(data: { id: string }): void {
    const playerId = data.id;
    this.clearDeathLocation(playerId);
    this.playerPositions.delete(playerId);
  }

  private handleHeadstoneExpired(data: {
    headstoneId: string;
    playerId: string;
  }): void {
    // Trigger normal despawn process (destroys headstone entity)
    this.despawnDeathItems(data.playerId);
  }

  // Public API for apps
  getDeathLocation(playerId: string): DeathLocationData | undefined {
    return this.deathLocations.get(playerId);
  }

  getAllDeathLocations(): DeathLocationData[] {
    return Array.from(this.deathLocations.values());
  }

  isPlayerDead(playerId: string): boolean {
    return this.deathLocations.has(playerId);
  }

  getRemainingRespawnTime(playerId: string): number {
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return 0;

    const elapsed = Date.now() - deathData.timestamp;
    return Math.max(0, WORLD_STRUCTURE_CONSTANTS.RESPAWN_TIME - elapsed);
  }

  getRemainingDespawnTime(playerId: string): number {
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return 0;

    const elapsed = Date.now() - deathData.timestamp;
    return Math.max(
      0,
      WORLD_STRUCTURE_CONSTANTS.DEATH_ITEM_DESPAWN_TIME - elapsed,
    );
  }

  forceRespawn(playerId: string): void {
    this.handleRespawnRequest({ playerId });
  }

  // Headstone API (now uses EntityManager instead of HeadstoneApp objects)
  getPlayerHeadstoneId(playerId: string): string | undefined {
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return undefined;
    return (deathData as any).headstoneId;
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {
    // HeadstoneEntity handles its own updates via EntityManager
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}
