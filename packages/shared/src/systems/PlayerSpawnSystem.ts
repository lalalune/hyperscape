
/**
 * Player Spawn System
 * 
 * Handles player spawning with starter equipment as defined in the GDD:
 * - Player starts with bronze sword, helmet, and chest armor equipped
 * - Immediately triggers goblin aggro for combat testing
 * - Integrates with equipment and combat systems
 */

import THREE from '../extras/three';
import type { World } from '../types';
import { EventType } from '../types/events';
import { equipmentRequirements } from '../data/EquipmentRequirements';
import { getRandomSpawnPoint } from '../data/world-areas';
import type { PlayerSpawnData } from '../types/core';
import { PlayerSpawnSystemInfo as SystemInfo } from '../types/system-types';
import { SystemBase } from './SystemBase';
import { TerrainSystem } from './TerrainSystem';

export class PlayerSpawnSystem extends SystemBase {
  private spawnedPlayers = new Map<string, PlayerSpawnData>();
  private _tempVec3_1 = new THREE.Vector3();
  private _tempVec3_2 = new THREE.Vector3();
  private _tempVec3_3 = new THREE.Vector3();
  
  // GDD-compliant starter equipment
  private readonly STARTER_EQUIPMENT = equipmentRequirements.getStarterEquipment();

  constructor(world: World) {
    super(world, { 
      name: 'player-spawn',
      dependencies: {
        required: [],
        optional: []
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Listen for player events via event bus
    this.subscribe(EventType.PLAYER_JOINED, (data: { playerId: string }) => this.handlePlayerJoin(data));
    this.subscribe(EventType.PLAYER_LEFT, (data: { playerId: string }) => this.handlePlayerLeave(data));
    // Listen for spawn completion events
    this.subscribe(EventType.PLAYER_SPAWN_COMPLETE, (data: { playerId: string }) => this.handleSpawnComplete(data));
    
  }

  /**
   * Handle spawn completion
   */
  private async handleSpawnComplete(event: { playerId: string }): Promise<void> {
    // Send welcome message
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: event.playerId,
      message: 'Welcome to the world! You are equipped and ready for battle.',
      type: 'info'
    });
    
    // Additional spawn effects could go here
    // - Tutorial prompts
    // - UI highlighting
    // - Sound effects

    // Debug: add a blue cube above player so we can visually confirm spawn
    const player = this.world.getPlayer(event.playerId)
    if (player && player.node) {
      const debug = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
      )
      debug.name = `SpawnDebugCube_${event.playerId}`
      debug.position.set(player.node.position.x, player.node.position.y + 3, player.node.position.z)
      this.world.stage.scene.add(debug)
    }

    // Equip starter gear and trigger starter aggro pipeline
    // Use a short defer to ensure all dependent systems are ready
    await new Promise<void>(resolve => {
      const onLoad = (e) => {
        if (e.playerId === event.playerId && e.success) {
          this.world.off(EventType.AVATAR_LOAD_COMPLETE, onLoad);
          resolve();
        }
      };
      this.world.on(EventType.AVATAR_LOAD_COMPLETE, onLoad);
      setTimeout(resolve, 5000); // Timeout after 5s
    });

    // Equip each starter item
    for (const item of this.STARTER_EQUIPMENT) {
      // Check if player still exists before each equipment
      if (!this.spawnedPlayers.has(event.playerId)) {
        this.logger.warn(`[PlayerSpawnSystem] Player ${event.playerId} disconnected during equipment process`);
        return;
      }
      
      // Force equip the item (bypass inventory checks for starter equipment)
      this.emitTypedEvent(EventType.EQUIPMENT_EQUIP, {
        playerId: event.playerId,
        itemId: item.itemId, // Pass itemId string directly, not the full item object
        slot: item.slot
      });
      
      // Small delay between equipment
      await this.delay(50);
    }
    
    // Final check before setting the flag
    const finalSpawnData = this.spawnedPlayers.get(event.playerId);
    if (finalSpawnData) {
      finalSpawnData.hasStarterEquipment = true;
    }
    
    
    // Trigger aggro after equipment is ready (only if player still exists)
    if (this.spawnedPlayers.has(event.playerId)) {
      this.triggerGoblinAggro(event.playerId);
    }
    
    // Emit spawn complete event
    this.emitTypedEvent(EventType.PLAYER_SPAWNED, {
      playerId: event.playerId,
      equipment: this.STARTER_EQUIPMENT,
      position: this.spawnedPlayers.get(event.playerId)?.position
    });
    
  }

  /**
   * Handle player leave
   */
  private handlePlayerLeave(event: { playerId: string }): void {
    // Clean up spawn data
    this.spawnedPlayers.delete(event.playerId);
    
    // Cleanup any starter goblins that were spawned for this player
    this.cleanupPlayerMobs(event.playerId);
  }

  /**
   * Handle player join - start spawn process
   */
  private async handlePlayerJoin(event: { playerId: string }): Promise<void> {
    this.logger.info(`handlePlayerJoin called: ${JSON.stringify(event)}`);
    
    if (!event?.playerId) {
      this.logger.error(`ERROR: playerId is undefined in event! ${JSON.stringify(event)}`);
      return;
    }

    // Check if entity already exists (character-select mode spawns entity before PLAYER_JOINED)
    const entity = this.world.entities.get(event.playerId)
    if (entity && entity.position) {
      // Entity already spawned by ServerNetwork with loaded position, skip spawn system logic
      this.logger.info(`[PlayerSpawnSystem] Entity ${event.playerId} already spawned, skipping spawn point generation`)
      
      // Still create spawn data to track this player
      const spawnData: PlayerSpawnData = {
        playerId: event.playerId,
        position: new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z),
        hasStarterEquipment: false,
        aggroTriggered: false,
        spawnTime: Date.now()
      }
      this.spawnedPlayers.set(event.playerId, spawnData)
      
      // Emit spawn complete immediately since entity is already in world
      this.emitTypedEvent(EventType.PLAYER_SPAWN_COMPLETE, { playerId: event.playerId })
      return
    }

    const terrain = this.world.getSystem<TerrainSystem>('terrain');
    if (terrain) {
      let attempts = 0;
      while (!terrain.isReady() && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      if (attempts >= 100) {
        console.error('[PlayerSpawnSystem] Terrain not ready after timeout');
      }
    }

    // 2. Determine Spawn Point and ground it to terrain
    const spawnPoint = getRandomSpawnPoint();
    
    // Ground the spawn point to terrain if available
    if (terrain && terrain.getHeightAt) {
      const terrainHeight = terrain.getHeightAt(spawnPoint.x, spawnPoint.z);
      if (Number.isFinite(terrainHeight)) {
        spawnPoint.y = terrainHeight + 0.1;
        this.logger.info(`[PlayerSpawnSystem] Grounded spawn point to terrain: Y=${spawnPoint.y}`);
      }
    }
    
    // 3. Emit Spawn Request for PlayerSystem to handle data and initial placement
    this.emitTypedEvent(EventType.PLAYER_SPAWN_REQUEST, {
      playerId: event.playerId,
      position: spawnPoint,
    });
    
    // 4. Create spawn data for this system to track equipment/aggro state
    const spawnData: PlayerSpawnData = {
      playerId: event.playerId,
      position: new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z),
      hasStarterEquipment: false,
      aggroTriggered: false,
      spawnTime: Date.now()
    };
    this.spawnedPlayers.set(event.playerId, spawnData);

    // 5. The rest of the spawn logic will proceed once PLAYER_SPAWN_COMPLETE is received
    // This ensures player data is loaded and they are in the world before we equip items.
    setTimeout(() => {
      if (!this.spawnedPlayers.has(event.playerId)) {
        this.world.emit('spawn_error', { playerId: event.playerId, reason: 'timeout' });
      }
    }, 5000);
  }

  /**
   * Trigger goblin aggro near player spawn
   */
  private triggerGoblinAggro(playerId: string): void {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (!spawnData || spawnData.aggroTriggered) return;
    
    const player = this.world.getPlayer(playerId);
    if (!player) {
      this.logger.warn(`[PlayerSpawnSystem] Player ${playerId} not found when triggering aggro`);
      return;
    }
    
    // Spawn a few goblins near the player for immediate combat
    const playerPos = player.node.position;
    
    const goblinSpawnPositions = [
      this._tempVec3_1.set(playerPos.x + 3, playerPos.y, playerPos.z + 2),
      this._tempVec3_2.set(playerPos.x - 2, playerPos.y, playerPos.z + 4),
      this._tempVec3_3.set(playerPos.x + 1, playerPos.y, playerPos.z - 3)
    ];
    
    goblinSpawnPositions.forEach((position, index) => {
      setTimeout(() => {
        this.spawnAggroGoblin(playerId, position, index);
      }, index * 500); // Stagger spawns by 500ms
    });
    
    spawnData.aggroTriggered = true;
    
  }

  /**
   * Spawn an aggressive goblin that will attack the player
   */
  private spawnAggroGoblin(playerId: string, position: { x: number; y: number; z: number }, index: number): void {
    const goblinId = `starter_goblin_${playerId}_${index}`;
    
    // Spawn goblin mob
    this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
      mobType: 'goblin',
      position: position,
      level: 1,
      mobId: goblinId
    });
    
    // Force aggro toward the specific player
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      mobId: goblinId,
      targetId: playerId,
      aggroAmount: 100,
      reason: 'starter_spawn'
    });
    
  }

  // Duplicate methods removed - proper implementations exist above

  /**
   * Clean up mobs spawned for a specific player
   */
  private cleanupPlayerMobs(playerId: string): void {
    // Find and despawn any starter goblins for this player
    for (let i = 0; i < 3; i++) {
      const goblinId = `starter_goblin_${playerId}_${i}`;
      this.emitTypedEvent(EventType.MOB_DESPAWN, { mobId: goblinId });
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if player has completed spawn process
   */
  public hasPlayerCompletedSpawn(playerId: string): boolean {
    const spawnData = this.spawnedPlayers.get(playerId);
    return !!(spawnData?.hasStarterEquipment && spawnData?.aggroTriggered);
  }

  /**
   * Get spawn data for player
   */
  public getPlayerSpawnData(playerId: string): PlayerSpawnData | undefined {
    return this.spawnedPlayers.get(playerId);
  }

  /**
   * Manually trigger goblin aggro (for testing)
   */
  public forceTriggerAggro(playerId: string): void {
    const spawnData = this.spawnedPlayers.get(playerId);
    if (!spawnData) return;
    
    spawnData.aggroTriggered = false; // Reset flag
    this.triggerGoblinAggro(playerId);
  }

  /**
   * Get all spawned players
   */
  public getAllSpawnedPlayers(): PlayerSpawnData[] {
    return Array.from(this.spawnedPlayers.values());
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): SystemInfo {
    return {
      totalSpawnedPlayers: this.spawnedPlayers.size,
      playersWithEquipment: Array.from(this.spawnedPlayers.values()).filter(p => p.hasStarterEquipment).length,
      playersWithAggro: Array.from(this.spawnedPlayers.values()).filter(p => p.aggroTriggered).length,
      starterEquipmentItems: this.STARTER_EQUIPMENT.length,
      playerSpawnData: Object.fromEntries(
        Array.from(this.spawnedPlayers.entries()).map(([playerId, data]) => [
          playerId,
          {
            hasStarterEquipment: data.hasStarterEquipment,
            aggroTriggered: data.aggroTriggered,
            spawnTime: data.spawnTime,
            position: data.position
          }
        ])
      )
    };
  }

  destroy(): void {
    // Clean up all spawned player data
    for (const playerId of this.spawnedPlayers.keys()) {
      this.cleanupPlayerMobs(playerId);
    }
    this.spawnedPlayers.clear();
  }
}