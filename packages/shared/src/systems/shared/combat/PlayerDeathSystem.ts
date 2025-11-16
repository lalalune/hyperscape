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
import { calculateDistance } from "../../../utils/game/EntityUtils";

/**
 * Player Death and Respawn System - GDD Compliant
 * Handles ONLY player death, item dropping, and respawn mechanics per GDD specifications:
 * - Items dropped at death location (headstone)
 * - Player respawns at Central Haven (0, 0) like Lumbridge in OSRS
 * - Instant respawn on button click (RuneScape-style)
 * - Items despawn after 5 minutes if not retrieved
 * - Must retrieve items from death location
 *
 * NOTE: Mob deaths are handled by MobDeathSystem (separate file)
 */
export class PlayerDeathSystem extends SystemBase {
  private deathLocations = new Map<string, DeathLocationData>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private itemDespawnTimers = new Map<string, NodeJS.Timeout>();
  private headstones = new Map<string, HeadstoneApp>();
  private playerPositions = new Map<
    string,
    { x: number; y: number; z: number }
  >();
  private playerInventories = new Map<
    string,
    { items: InventoryItem[]; coins: number }
  >();

  constructor(world: World) {
    super(world, {
      name: "player-death",
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
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
    // Clear all timers
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.itemDespawnTimers.values()) {
      clearTimeout(timer);
    }

    // Destroy all headstones
    for (const headstone of this.headstones.values()) {
      headstone.destroy();
    }
    this.headstones.clear();
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

  private processPlayerDeath(
    playerId: string,
    deathPosition: { x: number; y: number; z: number },
    killedBy: string,
  ): void {
    console.log(
      `[PlayerDeathSystem] processPlayerDeath starting for ${playerId} at position:`,
      deathPosition,
    );

    // Create death location record
    const deathData: DeathLocationData = {
      playerId,
      deathPosition,
      timestamp: Date.now(),
      items: [],
    };

    console.log(`[PlayerDeathSystem] Created death data for ${playerId}`);

    // Get all items to drop from cached inventory (reactive pattern)
    const inventory = this.playerInventories.get(playerId) || {
      items: [],
      coins: 0,
    };
    const droppableItems = inventory.items.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
    }));

    deathData.items = droppableItems.map((item, index) => ({
      id: `death_${playerId}_${Date.now()}_${index}`,
      itemId: item.itemId,
      quantity: item.quantity,
      slot: index,
      metadata: null, // Death items have no special metadata
    }));

    // Store death location
    this.deathLocations.set(playerId, deathData);

    // Drop all items at death location per GDD
    this.emitTypedEvent(EventType.INVENTORY_DROP_ALL, {
      playerId,
      position: deathPosition,
    });

    // Create visual headstone/grave marker in world
    this.createHeadstone(playerId, deathPosition, deathData.items, killedBy);

    // Start item despawn timer (5 minutes per GDD)
    const despawnTimer = setTimeout(() => {
      this.despawnDeathItems(playerId);
    }, WORLD_STRUCTURE_CONSTANTS.DEATH_ITEM_DESPAWN_TIME);

    this.itemDespawnTimers.set(playerId, despawnTimer);

    // Set player as dead and disable movement
    this.emitTypedEvent(EventType.PLAYER_SET_DEAD, {
      playerId,
      isDead: true,
      deathPosition,
    });

    // Make player fall down (rotate 90 degrees) to visualize death
    // VRM models don't have a "death" animation, so we rotate them to lie flat
    const playerEntity = this.world.entities?.get?.(playerId);
    if (playerEntity && "data" in playerEntity) {
      const entityData = playerEntity.data as { e?: string; visible?: boolean };

      // Option 1: Just hide the player (cleanest for now)
      entityData.visible = false;

      // Mark network dirty to sync to clients
      if ("markNetworkDirty" in playerEntity) {
        (playerEntity as { markNetworkDirty: () => void }).markNetworkDirty();
      }
      console.log(`[PlayerDeathSystem] Hid player ${playerId} (dead)`);
    }

    // Start auto-respawn timer (5 minutes as fallback if player doesn't click)
    // Player can click "Respawn" button for instant respawn (RuneScape-style)
    const AUTO_RESPAWN_FALLBACK_TIME = 5 * 60 * 1000; // 5 minutes
    const respawnTimer = setTimeout(() => {
      console.log(
        `[PlayerDeathSystem] Auto-respawn fallback triggered for ${playerId} (didn't click button)`,
      );
      this.initiateRespawn(playerId);
    }, AUTO_RESPAWN_FALLBACK_TIME);

    this.respawnTimers.set(playerId, respawnTimer);

    // Notify player of death
    console.log(`[PlayerDeathSystem] Emitting UI_DEATH_SCREEN for ${playerId}`);
    this.emitTypedEvent(EventType.UI_DEATH_SCREEN, {
      playerId,
      message: `Click the button below to respawn at Central Haven.`,
      deathLocation: deathPosition,
      killedBy,
      respawnTime: 0, // No forced wait time
    });
    console.log(`[PlayerDeathSystem] UI_DEATH_SCREEN emitted for ${playerId}`);
  }

  private createHeadstone(
    playerId: string,
    position: { x: number; y: number; z: number },
    items: InventoryItem[],
    killedBy: string,
  ): void {
    const headstoneId = `headstone_${playerId}_${Date.now()}`;

    const playerName = playerId;

    // Create headstone data
    const headstoneData: HeadstoneData = {
      playerId,
      playerName,
      position: { x: position.x, y: position.y, z: position.z },
      deathTime: Date.now(),
      deathMessage: `Killed by ${killedBy}`,
      itemCount: items.length,
      items: [...items],
      despawnTime:
        Date.now() + WORLD_STRUCTURE_CONSTANTS.DEATH_ITEM_DESPAWN_TIME,
    };

    // Create headstone entity in world
    this.emitTypedEvent(EventType.ENTITY_CREATE_HEADSTONE, {
      id: headstoneId,
      name: `${playerName}'s Grave`,
      position: { x: position.x, y: position.y, z: position.z },
      data: headstoneData,
    });

    // Create proper headstone app
    const headstoneApp: HeadstoneApp = {
      init: async () => {
        // Headstone initialization if needed
        return Promise.resolve();
      },
      destroy: () => {
        this.emitTypedEvent(EventType.ENTITY_REMOVE, { entityId: headstoneId });
      },
      update: (_dt: number) => {
        // Update headstone state if needed
        const remaining = this.getRemainingDespawnTime(playerId);
        if (remaining <= 0 && this.deathLocations.has(playerId)) {
          this.emitTypedEvent(EventType.DEATH_HEADSTONE_EXPIRED, {
            headstoneId,
            playerId,
          });
        }
      },
      getHeadstoneData: () => headstoneData,
    };

    this.headstones.set(headstoneId, headstoneApp);
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

  private despawnDeathItems(playerId: string): void {
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return;

    // Find and destroy the headstone
    const headstoneId = `headstone_${playerId}_${deathData.timestamp}`;
    const headstone = this.headstones.get(headstoneId);
    if (headstone) {
      headstone.destroy();
      this.headstones.delete(headstoneId);
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

    const despawnTimer = this.itemDespawnTimers.get(playerId);
    if (despawnTimer) {
      clearTimeout(despawnTimer);
      this.itemDespawnTimers.delete(playerId);
    }
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
    // Remove headstone from tracking
    const headstone = this.headstones.get(data.headstoneId);
    if (headstone) {
      headstone.destroy();
      this.headstones.delete(data.headstoneId);
    }

    // Trigger normal despawn process
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

  // Headstone API
  getHeadstones(): Map<string, HeadstoneApp> {
    return new Map(this.headstones);
  }

  getHeadstone(headstoneId: string): HeadstoneApp | undefined {
    return this.headstones.get(headstoneId);
  }

  getPlayerHeadstone(playerId: string): HeadstoneApp | undefined {
    // Find headstone by player ID more efficiently
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return undefined;

    const headstoneId = `headstone_${playerId}_${deathData.timestamp}`;
    return this.headstones.get(headstoneId);
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Update all headstones
    for (const headstone of this.headstones.values()) {
      headstone.update(dt);
    }
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}
