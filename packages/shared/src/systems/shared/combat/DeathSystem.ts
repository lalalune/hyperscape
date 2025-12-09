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
 * Death and Respawn System - GDD Compliant
 * Handles player death, item dropping, and respawn mechanics per GDD specifications:
 * - Items dropped at death location (headstone)
 * - Player respawns at nearest starter town
 * - 30-second respawn timer
 * - Items despawn after 5 minutes if not retrieved
 * - Must retrieve items from death location
 */
export class DeathSystem extends SystemBase {
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
      name: "death",
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
    if (data.entityType !== "player") return;

    const playerId = data.entityId;

    // Get player's current position (reactive pattern)
    const position = this.playerPositions.get(playerId);
    if (!position) {
      throw new Error(`[DeathSystem] Player ${playerId} has no position`);
    }

    this.processPlayerDeath(playerId, position, data.killedBy);
  }

  private processPlayerDeath(
    playerId: string,
    deathPosition: { x: number; y: number; z: number },
    killedBy: string,
  ): void {
    // Create death location record
    const deathData: DeathLocationData = {
      playerId,
      deathPosition,
      timestamp: Date.now(),
      items: [],
    };

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

    // Start respawn timer (30 seconds per GDD)
    const respawnTimer = setTimeout(() => {
      this.initiateRespawn(playerId);
    }, WORLD_STRUCTURE_CONSTANTS.RESPAWN_TIME);

    this.respawnTimers.set(playerId, respawnTimer);

    // Notify player of death
    this.emitTypedEvent(EventType.UI_DEATH_SCREEN, {
      playerId,
      message: `You have died! You will respawn in ${WORLD_STRUCTURE_CONSTANTS.RESPAWN_TIME / 1000} seconds.`,
      deathLocation: deathPosition,
      killedBy,
      respawnTime: WORLD_STRUCTURE_CONSTANTS.RESPAWN_TIME,
    });
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

    // Get nearest starter town per GDD
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) {
      throw new Error(
        `[DeathSystem] No death data found for player ${playerId}`,
      );
    }

    const nearestTown: ZoneData | null = getNearestTown(
      deathData.deathPosition,
    );
    let spawnPosition: { x: number; y: number; z: number } = {
      x: 0,
      y: 0,
      z: 0,
    }; // Default spawn
    let townName: string = "Unknown Town"; // Default town name

    // Get nearest town/zone for respawn
    if (nearestTown) {
      // Find a player spawn point in the zone
      const playerSpawnPoint = nearestTown.spawnPoints.find(
        (sp) => sp.type === "player",
      );
      if (playerSpawnPoint && playerSpawnPoint.position) {
        spawnPosition = playerSpawnPoint.position;
        townName = nearestTown.name;
      }
    }

    // Respawn player at starter town
    this.respawnPlayer(playerId, spawnPosition, townName);
  }

  private respawnPlayer(
    playerId: string,
    spawnPosition: { x: number; y: number; z: number },
    townName: string,
  ): void {
    // Restore player to alive state
    this.emitTypedEvent(EventType.PLAYER_SET_DEAD, {
      playerId,
      isDead: false,
    });

    // Teleport player to spawn position
    this.emitTypedEvent(EventType.PLAYER_TELEPORT_REQUEST, {
      playerId,
      position: spawnPosition,
    });

    // Restore health to full per GDD
    this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
      playerId,
      amount: 999, // Full heal
      source: "respawn",
    });

    // Notify player of respawn
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId,
      message: `You have respawned in ${townName}. Your items remain at your death location.`,
      type: "info",
    });

    // Close death screen
    this.emitTypedEvent(EventType.UI_DEATH_SCREEN_CLOSE, { playerId });

    // Emit respawn event for other systems
    this.emitTypedEvent(EventType.PLAYER_RESPAWNED, {
      playerId,
      spawnPosition,
      townName,
      deathLocation: this.deathLocations.get(playerId)?.deathPosition,
    });
  }

  private handleRespawnRequest(data: { playerId: string }): void {
    // Allow immediate respawn if timer is still active (e.g., clicked respawn button)
    const timer = this.respawnTimers.get(data.playerId);
    if (timer) {
      clearTimeout(timer);
      this.respawnTimers.delete(data.playerId);
      this.initiateRespawn(data.playerId);
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
