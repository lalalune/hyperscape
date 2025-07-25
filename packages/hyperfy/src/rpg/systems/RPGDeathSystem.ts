import { System } from '../../core/systems/System';
import { getNearestStarterTown, WORLD_CONSTANTS, type DeathLocationData, type HeadstoneData } from '../data/world-structure';
import { RPGWorldGenerationSystem } from './RPGWorldGenerationSystem';
import { RPGEntityManager } from './RPGEntityManager';

// Interface for headstone app
interface RPGHeadstoneApp {
  init(): Promise<void>;
  destroy(): void;
  update(dt: number): void;
  getHeadstoneData(): HeadstoneData;
}

/**
 * RPG Death and Respawn System - GDD Compliant
 * Handles player death, item dropping, and respawn mechanics per GDD specifications:
 * - Items dropped at death location (headstone)
 * - Player respawns at nearest starter town
 * - 30-second respawn timer
 * - Items despawn after 5 minutes if not retrieved
 * - Must retrieve items from death location
 */
export class RPGDeathSystem extends System {
  private deathLocations = new Map<string, DeathLocationData>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private itemDespawnTimers = new Map<string, NodeJS.Timeout>();
  private headstones = new Map<string, RPGHeadstoneApp>();
  private worldGeneration?: RPGWorldGenerationSystem;
  private entityManager?: RPGEntityManager;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGDeathSystem] Initializing GDD-compliant death and respawn system...');
    
    // Listen for death events
    this.world.on?.('rpg:entity:death', this.handlePlayerDeath.bind(this));
    this.world.on?.('rpg:player:respawn:request', this.handleRespawnRequest.bind(this));
    this.world.on?.('rpg:death:loot:collect', this.handleLootCollection.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupPlayerDeath.bind(this));
    this.world.on?.('rpg:death:headstone:expired', this.handleHeadstoneExpired.bind(this));
    
    console.log('[RPGDeathSystem] Death system initialized with 30s respawn timer and headstone mechanics');
  }

  start(): void {
    console.log('[RPGDeathSystem] Death system started');
    
    // Get reference to World Generation System for better respawn point selection
    this.worldGeneration = (this.world as any)['rpg-world-generation'];
    if (!this.worldGeneration) {
      console.warn('[RPGDeathSystem] RPGWorldGenerationSystem not found! Using fallback respawn logic.');
    }
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
    
    console.log('[RPGDeathSystem] Death system destroyed');
  }

  private handlePlayerDeath(data: { entityId: string; killedBy: string; entityType: 'player' | 'mob' }): void {
    if (data.entityType !== 'player') return;
    
    const playerId = data.entityId;
    console.log(`[RPGDeathSystem] Player ${playerId} died, killed by ${data.killedBy}`);
    
    // Get player's current position and inventory
    this.world.emit?.('rpg:player:get_state', {
      playerId,
      callback: (playerState: any) => {
        if (!playerState) {
          console.error(`[RPGDeathSystem] Could not get state for player ${playerId}`);
          return;
        }
        
        this.processPlayerDeath(playerId, playerState, data.killedBy);
      }
    });
  }

  private async processPlayerDeath(playerId: string, playerState: any, killedBy: string): Promise<void> {
    const deathPosition = { ...playerState.position };
    
    // Create death location record
    const deathData: DeathLocationData = {
      playerId,
      deathPosition,
      timestamp: Date.now(),
      items: []
    };

    // Get all items to drop (inventory + equipped items except starting weapon per some interpretations)
    this.world.emit?.('rpg:inventory:get_all_droppable', {
      playerId,
      callback: async (droppableItems: any[]) => {
        deathData.items = droppableItems;
        
        // Store death location
        this.deathLocations.set(playerId, deathData);
        
        // Drop all items at death location per GDD
        this.world.emit?.('rpg:inventory:drop_all', {
          playerId,
          position: deathPosition
        });

        // Create visual headstone/grave marker in world
        await this.createHeadstone(playerId, deathPosition, droppableItems);
        
        // Start item despawn timer (5 minutes per GDD)
        const despawnTimer = setTimeout(() => {
          this.despawnDeathItems(playerId);
        }, WORLD_CONSTANTS.DEATH_ITEM_DESPAWN_TIME);
        
        this.itemDespawnTimers.set(playerId, despawnTimer);
        
        // Set player as dead and disable movement
        this.world.emit?.('rpg:player:set_dead', {
          playerId,
          isDead: true,
          deathPosition
        });
        
        // Start respawn timer (30 seconds per GDD)
        const respawnTimer = setTimeout(() => {
          this.initiateRespawn(playerId);
        }, WORLD_CONSTANTS.RESPAWN_TIME);
        
        this.respawnTimers.set(playerId, respawnTimer);
        
        // Notify player of death
        this.world.emit?.('rpg:ui:death_screen', {
          playerId,
          message: `You have died! You will respawn in ${WORLD_CONSTANTS.RESPAWN_TIME / 1000} seconds.`,
          deathLocation: deathPosition,
          killedBy,
          respawnTime: WORLD_CONSTANTS.RESPAWN_TIME
        });
        
        console.log(`[RPGDeathSystem] Processed death for ${playerId}: ${droppableItems.length} items dropped at ${JSON.stringify(deathPosition)}`);
      }
    });
  }

  private async createHeadstone(playerId: string, position: { x: number; y: number; z: number }, items: any[]): Promise<void> {
    // Create headstone ID
    const headstoneId = `headstone_${playerId}_${Date.now()}`;
    
    // Get player name (fallback to playerId if not available)
    const playerName = playerId; // In full implementation, get from player system
    
    // Create headstone data
    const headstoneData: HeadstoneData = {
      playerId,
      playerName,
      deathTime: Date.now(),
      itemCount: items.length,
      items: [...items],
      despawnTime: Date.now() + WORLD_CONSTANTS.DEATH_ITEM_DESPAWN_TIME
    };

    // Create headstone entity in world
    this.world.emit?.('rpg:entity:create_headstone', {
      id: headstoneId,
      name: `${playerName}'s Grave`,
      position: { x: position.x, y: position.y, z: position.z },
      data: headstoneData
    });
    
    // Track headstone for later reference
    this.headstones.set(headstoneId, {
      init: async () => Promise.resolve(),
      destroy: () => {
        this.world.emit?.('rpg:entity:remove', { entityId: headstoneId });
      },
      update: (dt: number) => {},
      getHeadstoneData: () => headstoneData
    } as RPGHeadstoneApp);
    
    console.log(`[RPGDeathSystem] Created headstone entity for ${playerId} with ${items.length} items`);
  }

  private initiateRespawn(playerId: string): void {
    // Clear respawn timer
    this.respawnTimers.delete(playerId);
    
    // Get nearest starter town per GDD
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) {
      console.error(`[RPGDeathSystem] No death data found for player ${playerId}`);
      return;
    }
    
    let nearestTown: any;
    let spawnPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }; // Default spawn
    let townName: string = 'Unknown Town'; // Default town name
    
    // Try to use world generation system first for better integration
    if (this.worldGeneration) {
      nearestTown = this.worldGeneration.getNearestStarterTown(deathData.deathPosition);
      if (nearestTown) {
        spawnPosition = nearestTown.position;
        townName = nearestTown.name;
        console.log(`[RPGDeathSystem] Player ${playerId} respawning at ${townName} via WorldGenerationSystem`);
      }
    }
    
    // Fallback to world structure data if world generation system not available
    if (!nearestTown) {
      try {
        nearestTown = getNearestStarterTown(deathData.deathPosition);
        const spawnPoint = nearestTown.spawnPoints.find((sp: any) => sp.type === 'player');
        
        if (!spawnPoint) {
          console.error(`[RPGDeathSystem] No spawn point found in starter town ${nearestTown.id}`);
          // Use default spawn position
          spawnPosition = { x: 0, y: 0, z: 0 };
          townName = 'Default Spawn';
        } else {
          spawnPosition = spawnPoint.position;
          townName = nearestTown.name;
        }
        console.log(`[RPGDeathSystem] Player ${playerId} respawning at ${townName} via fallback system`);
      } catch (error) {
        console.error(`[RPGDeathSystem] Error finding nearest town, using default spawn:`, error);
        spawnPosition = { x: 0, y: 0, z: 0 };
        townName = 'Emergency Spawn';
      }
    }

    // Respawn player at starter town
    this.respawnPlayer(playerId, spawnPosition, townName);
  }

  private respawnPlayer(playerId: string, spawnPosition: { x: number; y: number; z: number }, townName: string): void {
    // Restore player to alive state
    this.world.emit?.('rpg:player:set_dead', {
      playerId,
      isDead: false
    });

    // Teleport player to spawn position
    this.world.emit?.('rpg:player:teleport', {
      playerId,
      position: spawnPosition
    });

    // Restore health to full per GDD
    this.world.emit?.('rpg:player:heal', {
      playerId,
      amount: 999, // Full heal
      source: 'respawn'
    });

    // Notify player of respawn
    this.world.emit?.('rpg:ui:message', {
      playerId,
      message: `You have respawned in ${townName}. Your items remain at your death location.`,
      type: 'info'
    });
    
    // Close death screen
    this.world.emit?.('rpg:ui:death_screen:close', { playerId });

    console.log(`[RPGDeathSystem] Respawned player ${playerId} at ${townName}: ${JSON.stringify(spawnPosition)}`);

    // Emit respawn event for other systems
    this.world.emit?.('rpg:player:respawned', {
      playerId,
      spawnPosition,
      townName,
      deathLocation: this.deathLocations.get(playerId)?.deathPosition
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
      console.log(`[RPGDeathSystem] No death loot found for player: ${data.playerId}`);
      return;  
    }

    // Check if player is near their death location (within 3 meters)
    this.world.emit?.('rpg:player:get_position', {
      playerId: data.playerId,
      callback: (playerPosition: { x: number; y: number; z: number }) => {
        const distance = Math.sqrt(
          Math.pow(playerPosition.x - deathData.deathPosition.x, 2) +
          Math.pow(playerPosition.y - deathData.deathPosition.y, 2) +
          Math.pow(playerPosition.z - deathData.deathPosition.z, 2)
        );

        if (distance > 3) {
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: 'You need to be closer to your grave to collect your items.',
            type: 'error'
          });
          return;
        }

        // Return all items to player
        let returnedItems = 0;
        for (const item of deathData.items) {
          this.world.emit?.('rpg:inventory:can_add', {
            playerId: data.playerId,
            item: item,
            callback: (canAdd: boolean) => {
              if (canAdd) {
                this.world.emit?.('rpg:inventory:add', {
                  playerId: data.playerId,
                  item: item
                });
                returnedItems++;
              } else {
                // If inventory full, create ground item
                this.world.emit?.('rpg:world:create_ground_item', {
                  position: playerPosition,
                  item: item
                });
              }
            }
          });
        }

        // Clear death location and timers
        this.clearDeathLocation(data.playerId);

        this.world.emit?.('rpg:ui:message', {
          playerId: data.playerId,
          message: `Retrieved ${returnedItems} items from your grave.`,
          type: 'success'
        });

        console.log(`[RPGDeathSystem] Player ${data.playerId} collected ${returnedItems} items from death location`);
      }
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
    this.world.emit?.('rpg:ui:message', {
      playerId,
      message: 'Your death items have despawned due to timeout.',
      type: 'warning'
    });

    console.log(`[RPGDeathSystem] Death items despawned for player ${playerId} after timeout`);
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

  private cleanupPlayerDeath(playerId: string): void {
    this.clearDeathLocation(playerId);
    console.log(`[RPGDeathSystem] Cleaned up death data for player: ${playerId}`);
  }

  private handleHeadstoneExpired(data: { headstoneId: string; playerId: string }): void {
    console.log(`[RPGDeathSystem] Headstone expired: ${data.headstoneId} for player ${data.playerId}`);
    
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
    return Math.max(0, WORLD_CONSTANTS.RESPAWN_TIME - elapsed);
  }

  getRemainingDespawnTime(playerId: string): number {
    const deathData = this.deathLocations.get(playerId);
    if (!deathData) return 0;
    
    const elapsed = Date.now() - deathData.timestamp;
    return Math.max(0, WORLD_CONSTANTS.DEATH_ITEM_DESPAWN_TIME - elapsed);
  }

  forceRespawn(playerId: string): void {
    this.handleRespawnRequest({ playerId });
  }

  // Headstone API
  getHeadstones(): Map<string, RPGHeadstoneApp> {
    return new Map(this.headstones);
  }

  getHeadstone(headstoneId: string): RPGHeadstoneApp | undefined {
    return this.headstones.get(headstoneId);
  }

  getPlayerHeadstone(playerId: string): RPGHeadstoneApp | undefined {
    for (const [id, headstone] of this.headstones) {
      if (headstone.getHeadstoneData().playerId === playerId) {
        return headstone;
      }
    }
    return undefined;
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Update all headstones
    for (const headstone of this.headstones.values()) {
      if (headstone && typeof headstone.update === 'function') {
        try {
          headstone.update(dt);
        } catch (error) {
          console.error('[RPGDeathSystem] Error updating headstone:', error);
        }
      }
    }
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}