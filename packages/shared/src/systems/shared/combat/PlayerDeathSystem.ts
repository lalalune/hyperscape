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

  // Rate limiter to prevent death spam exploits
  private lastDeathTime = new Map<string, number>();
  private readonly DEATH_COOLDOWN = 10000; // 10 seconds

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
    // CRITICAL: Validate death state on player reconnect
    // Prevents item duplication when player disconnects during death
    this.subscribe(EventType.PLAYER_JOINED, (data: { playerId: string }) =>
      this.handlePlayerReconnect(data),
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
    // CRITICAL: Server authority check - prevent client from triggering death events
    if (!this.world.isServer) {
      console.error(
        `[PlayerDeathSystem] ⚠️  Client attempted server-only death processing for ${playerId} - BLOCKED`,
      );
      return;
    }

    // CRITICAL: Rate limiter - prevent death spam exploits
    const lastDeath = this.lastDeathTime.get(playerId) || 0;
    const timeSinceDeath = Date.now() - lastDeath;

    if (timeSinceDeath < this.DEATH_COOLDOWN) {
      console.warn(
        `[PlayerDeathSystem] ⚠️  Death spam detected for ${playerId} - ` +
          `${timeSinceDeath}ms since last death (cooldown: ${this.DEATH_COOLDOWN}ms) - BLOCKED`,
      );
      return;
    }

    // CRITICAL: Check for active death lock - prevents duplicate deaths
    // This checks both in-memory AND database (for reconnect scenarios)
    const hasActiveDeathLock =
      await this.deathStateManager.hasActiveDeathLock(playerId);
    if (hasActiveDeathLock) {
      console.warn(
        `[PlayerDeathSystem] ⚠️  Player ${playerId} already has active death lock - ` +
          `cannot die again until resolved - BLOCKED`,
      );
      return;
    }

    // Update last death time
    this.lastDeathTime.set(playerId, Date.now());

    console.log(
      `[PlayerDeathSystem] processPlayerDeath starting for ${playerId} at position:`,
      deathPosition,
    );

    // Get database system for transaction support
    const databaseSystem = this.world.getSystem("database") as any;
    if (!databaseSystem || !databaseSystem.executeInTransaction) {
      console.error(
        "[PlayerDeathSystem] DatabaseSystem not available - cannot use transaction!",
      );
      return;
    }

    // Get inventory system
    const inventorySystem = this.world.getSystem<InventorySystem>("inventory");
    if (!inventorySystem) {
      console.error("[PlayerDeathSystem] InventorySystem not available");
      return;
    }

    let itemsToDrop: InventoryItem[] = [];

    try {
      // CRITICAL: Wrap entire death flow in transaction for atomicity
      await databaseSystem.executeInTransaction(async (tx: any) => {
        console.log(
          `[PlayerDeathSystem] ✓ Starting death transaction for ${playerId}`,
        );

        // Step 1: Get inventory items (read-only, non-destructive)
        const inventory = inventorySystem.getInventory(playerId);
        if (!inventory) {
          console.warn(
            `[PlayerDeathSystem] No inventory found for ${playerId}, cannot drop items`,
          );
          // Continue with empty items - still need to process death
        }

        itemsToDrop =
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

        // Step 2: Detect zone type (safe vs wilderness)
        const zoneType = this.zoneDetection.getZoneType(deathPosition);
        console.log(`[PlayerDeathSystem] Death in zone type: ${zoneType}`);

        // Step 3: Delegate to appropriate handler (spawn gravestone/ground items + create death lock)
        if (zoneType === ZoneType.SAFE_AREA) {
          console.log(
            `[PlayerDeathSystem] Delegating to SafeAreaDeathHandler (with transaction)`,
          );
          await this.safeAreaHandler.handleDeath(
            playerId,
            deathPosition,
            itemsToDrop,
            killedBy,
            tx, // Pass transaction context
          );
        } else {
          console.log(
            `[PlayerDeathSystem] Delegating to WildernessDeathHandler (with transaction)`,
          );
          await this.wildernessHandler.handleDeath(
            playerId,
            deathPosition,
            itemsToDrop,
            killedBy,
            zoneType,
            tx, // Pass transaction context
          );
        }

        // Step 4: CRITICAL - Clear inventory LAST (safest point for destructive operation)
        // If we crash before this point, transaction rolls back and inventory is NOT cleared
        console.log(
          `[PlayerDeathSystem] ✓ Gravestone/ground items spawned, clearing inventory for ${playerId}`,
        );
        await inventorySystem.clearInventoryImmediate(playerId);

        console.log(
          `[PlayerDeathSystem] ✓ Transaction complete for ${playerId}, committing...`,
        );
        // Transaction will auto-commit here if all succeeded
      });

      console.log(
        `[PlayerDeathSystem] ✓ Death transaction committed successfully for ${playerId}`,
      );

      // Post-transaction cleanup (memory-only operations, not part of transaction)
      this.postDeathCleanup(playerId, deathPosition, itemsToDrop, killedBy);
    } catch (error) {
      console.error(
        `[PlayerDeathSystem] ❌ Death transaction failed for ${playerId}, rolled back:`,
        error,
      );
      // Transaction automatically rolled back
      // Inventory NOT cleared - player keeps items
      // Can retry death processing
      throw error;
    }
  }

  /**
   * Post-death cleanup (memory-only operations)
   * Called after successful death transaction commit
   * NOT part of transaction - these are local state updates
   */
  private postDeathCleanup(
    playerId: string,
    deathPosition: { x: number; y: number; z: number },
    itemsToDrop: InventoryItem[],
    killedBy: string,
  ): void {
    console.log(
      `[PlayerDeathSystem] Running post-death cleanup for ${playerId}`,
    );

    // Store death location for tracking (memory only)
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

    // Play death animation (same as mobs) - keep player VISIBLE during animation
    const playerEntity = this.world.entities?.get?.(playerId);
    if (playerEntity && "data" in playerEntity) {
      const entityData = playerEntity.data as { e?: string; visible?: boolean };
      // IMPORTANT: Keep visible during death animation
      entityData.visible = true;

      // Set emote STRING KEY (players use 'death' string which gets mapped to URL)
      // This matches how CombatSystem sets 'combat' emote
      if ((playerEntity as any).emote !== undefined) {
        (playerEntity as any).emote = "death";
      }
      if ((playerEntity as any).data) {
        (playerEntity as any).data.e = "death";
      }

      if ("markNetworkDirty" in playerEntity) {
        (playerEntity as { markNetworkDirty: () => void }).markNetworkDirty();
      }
      console.log(
        `[PlayerDeathSystem] Playing death animation for ${playerId}`,
      );
    }

    // RuneScape-style: Just play animation, then teleport to spawn
    // NO loading screen - player sees the death animation, then they're at spawn
    // Death animation is 4.5 seconds (same as mobs)
    const DEATH_ANIMATION_DURATION = 4500; // 4.5 seconds to match mob death animation
    const respawnTimer = setTimeout(() => {
      console.log(
        `[PlayerDeathSystem] Death animation complete, respawning ${playerId} (RuneScape-style)`,
      );

      // Hide player after death animation completes
      if (playerEntity && "data" in playerEntity) {
        const entityData = playerEntity.data as {
          e?: string;
          visible?: boolean;
        };
        entityData.visible = false;
        if ("markNetworkDirty" in playerEntity) {
          (playerEntity as { markNetworkDirty: () => void }).markNetworkDirty();
        }
      }

      this.initiateRespawn(playerId);
    }, DEATH_ANIMATION_DURATION);

    this.respawnTimers.set(playerId, respawnTimer);

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

    // Notify player of respawn (RuneScape-style message)
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You have respawned in ${townName}. Your items are where you died.`,
      type: "info",
    });

    // CRITICAL: Clear death lock after successful respawn
    // This prevents stale death locks from blocking future logins
    this.deathStateManager.clearDeathLock(playerId);
    console.log(
      `[PlayerDeathSystem] ✓ Cleared death lock for ${playerId} after respawn`,
    );
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

  /**
   * Handle PLAYER_JOINED event (player reconnect)
   * Delegates to onPlayerReconnect for death state validation
   */
  private async handlePlayerReconnect(data: {
    playerId: string;
  }): Promise<void> {
    if (!this.world.isServer) {
      return; // Only server validates death state
    }

    await this.onPlayerReconnect(data.playerId);
  }

  /**
   * Handle player reconnect - validate death state
   * CRITICAL: Prevents item duplication when player disconnects during death
   *
   * Called when player reconnects to server
   * - Checks for active death lock in database
   * - Restores death screen UI if death lock exists
   * - Prevents inventory load until respawn
   *
   * Can be called by other systems (e.g., PlayerSystem) to validate death state
   */
  async onPlayerReconnect(playerId: string): Promise<{
    blockInventoryLoad: boolean;
  }> {
    console.log(
      `[PlayerDeathSystem] Player ${playerId} reconnected, checking for active death lock...`,
    );

    // Check for active death lock (checks both memory and database)
    const deathLock = await this.deathStateManager.getDeathLock(playerId);

    if (deathLock) {
      // Check if death lock is stale (older than 1 hour)
      // Stale death locks should be cleared, not restored
      const MAX_DEATH_LOCK_AGE = 60 * 60 * 1000; // 1 hour
      const deathAge = Date.now() - deathLock.timestamp;

      if (deathAge > MAX_DEATH_LOCK_AGE) {
        console.log(
          `[PlayerDeathSystem] ⚠️  Found STALE death lock for ${playerId} (age: ${Math.round(deathAge / 1000 / 60)} minutes)`,
        );
        console.log(
          `[PlayerDeathSystem] ✓ Clearing stale death lock and allowing normal login`,
        );
        await this.deathStateManager.clearDeathLock(playerId);
        return { blockInventoryLoad: false };
      }

      console.log(
        `[PlayerDeathSystem] ⚠️  Player ${playerId} reconnected with active death lock!`,
      );
      console.log(
        `[PlayerDeathSystem] Death location: (${deathLock.position.x}, ${deathLock.position.y}, ${deathLock.position.z})`,
      );
      console.log(
        `[PlayerDeathSystem] Zone: ${deathLock.zoneType}, Items: ${deathLock.itemCount}, Age: ${Math.round(deathAge / 1000)}s`,
      );

      // Restore death location to memory
      this.deathLocations.set(playerId, {
        playerId,
        deathPosition: deathLock.position,
        timestamp: deathLock.timestamp,
        items: [], // Items are in gravestone/ground, not in memory
      });

      // Immediately trigger respawn (RuneScape-style - no waiting, no screen)
      console.log(
        `[PlayerDeathSystem] ✓ Triggering immediate respawn for ${playerId} on reconnect`,
      );

      // Very short delay, then auto-respawn (just enough for world to load)
      setTimeout(() => {
        this.initiateRespawn(playerId);
      }, 500); // 0.5 second delay

      // CRITICAL: Block inventory load until respawn
      // This prevents inventory items from appearing when player is dead
      return { blockInventoryLoad: true };
    }

    console.log(
      `[PlayerDeathSystem] ✓ No active death lock for ${playerId}, normal login`,
    );
    return { blockInventoryLoad: false };
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
