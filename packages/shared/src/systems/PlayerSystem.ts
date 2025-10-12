import { getItem } from '../data/items';
import type { PlayerLocal } from '../entities/PlayerLocal';
import { Position3D } from '../types';
import { AttackType, Player, PlayerMigration, Skills } from '../types/core';
import type { HealthUpdateEvent, PlayerDeathEvent, PlayerEnterEvent, PlayerLeaveEvent, PlayerLevelUpEvent } from '../types/events';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import { Logger } from '../utils/Logger';
import { EntityManager } from './EntityManager';
import { SystemBase } from './SystemBase';
import { WorldGenerationSystem } from './WorldGenerationSystem';
import type { TerrainSystem } from './TerrainSystem';
import { PlayerIdMapper } from './PlayerIdMapper';
import type { DatabaseSystem } from '../types/system-interfaces';
import * as THREE from 'three';

export class PlayerSystem extends SystemBase {
  declare world: World;
  
  private players = new Map<string, Player>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private entityManager?: EntityManager;
  private worldGeneration!: WorldGenerationSystem;
  private databaseSystem?: DatabaseSystem;
  private playerLocalRefs = new Map<string, PlayerLocal>(); // Store PlayerLocal references for integration
  private readonly RESPAWN_TIME = 30000; // 30 seconds per GDD
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds auto-save
  private saveInterval?: NodeJS.Timeout;
  private _tempVec3 = new THREE.Vector3();

  constructor(world: World) {
    super(world, {
      name: 'player',
      dependencies: {
        optional: ['entity-manager', 'database', 'world-generation', 'ui']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Subscribe to player events using strongly typed event system
    this.subscribe(EventType.PLAYER_JOINED, (data) => {
      this.onPlayerEnter(data);
    });
    this.subscribe(EventType.PLAYER_SPAWN_REQUEST, (data) => this.onPlayerSpawnRequest(data as { playerId: string, position: Position3D }));
    this.subscribe(EventType.PLAYER_LEFT, (data) => {
      this.onPlayerLeave(data);
    });
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => {
      this.onPlayerRegister(data);
    });
    this.subscribe(EventType.PLAYER_DAMAGE, (data) => {
      this.damagePlayer(data.playerId, data.damage, data.source);
    });
    this.subscribe(EventType.PLAYER_DIED, (data) => {
      this.handleDeath(data);
    });
    this.subscribe(EventType.PLAYER_RESPAWN_REQUEST, (data) => {
      this.respawnPlayer(data.playerId);
    });
    this.subscribe(EventType.PLAYER_LEVEL_UP, (data) => {
      this.updateCombatLevel(data);
    });
    
    // Handle consumable item usage
    this.subscribe(EventType.ITEM_USED, (data) => {
      this.handleItemUsed(data);
    });

    // Get system references using the type-safe getSystem method
    this.entityManager = this.world.getSystem<EntityManager>('entity-manager');
    // Get database system if available (server only)
    this.databaseSystem = this.world.getSystem<DatabaseSystem>('database');
    this.worldGeneration = this.world.getSystem<WorldGenerationSystem>('world-generation')!;

    // Start auto-save
    this.startAutoSave();
  }

  private async onPlayerSpawnRequest(data: { playerId: string, position: Position3D }): Promise<void> {
    const player = this.players.get(data.playerId);
    if (!player) {
      Logger.error('PlayerSystem', new Error(`Player ${data.playerId} not found for spawn request.`));
      return;
    }
    
    // --- NEW: Wait for Terrain Physics ---
    const terrainSystem = this.world.getSystem<TerrainSystem>('terrain')
    const finalPosition = this._tempVec3.set(data.position.x, data.position.y, data.position.z);
    
    // Reduced logging - only log errors, not every spawn
    // console.log(`[PlayerSystem] Spawn request received for ${data.playerId} at:`, data.position);
    
    if (!terrainSystem) {
      console.error('[PlayerSystem] CRITICAL: TerrainSystem not found!');
      throw new Error('TerrainSystem not available during player spawn');
    }
    
    let attempts = 0;
    const maxAttempts = 100; // Wait up to 5 seconds
    while (attempts < maxAttempts) {
      // We need a method isPhysicsReadyAt on TerrainSystem
      // Assuming it exists for now. If not, this will need to be added.
      if (terrainSystem.isPhysicsReadyAt(data.position.x, data.position.z)) {
        // console.log(`[PlayerSystem] Terrain physics is ready for player ${data.playerId}.`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
    if (attempts >= maxAttempts) {
      this.logger.error(`Timed out waiting for terrain physics for player ${data.playerId}.`);
    }
    
    const height = terrainSystem.getHeightAt(data.position.x, data.position.z);
    // console.log(`[PlayerSystem] Terrain height at (${data.position.x}, ${data.position.z}):`, height);
    
    if (typeof height === 'number' && isFinite(height)) {
      const _oldY = finalPosition.y;
      // Spawn well above terrain to avoid clipping
      finalPosition.y = height + 2.0;
      // console.log(`[PlayerSystem] Adjusted spawn height from Y=${oldY} to Y=${finalPosition.y} (terrain=${height})`);
    } else {
      console.error(`[PlayerSystem] Invalid terrain height: ${height} - using safe default Y=50`);
      finalPosition.y = 50; // Safe height above most terrain
    }
    
    // console.log(`[PlayerSystem] Final spawn position for ${data.playerId}:`, { x: finalPosition.x, y: finalPosition.y, z: finalPosition.z });

    // Server-authoritative: clamp to terrain height map explicitly
    const terrainHeight = terrainSystem.getHeightAt(finalPosition.x, finalPosition.z)
    const groundedY = Number.isFinite(terrainHeight) ? (terrainHeight as number) + 2.0 : finalPosition.y
    player.position = { x: finalPosition.x, y: groundedY, z: finalPosition.z };
    
    // CRITICAL: Also update the entity's node position directly!
    const entity = this.world.entities.get(data.playerId);
    if (entity) {
      entity.node.position.set(finalPosition.x, groundedY, finalPosition.z);
      // console.log(`[PlayerSystem] Directly set entity node position to Y=${finalPosition.y}`);
      
      // Force update data.position for serialization
      if (entity.data && Array.isArray(entity.data.position)) {
        entity.data.position[0] = finalPosition.x;
        entity.data.position[1] = groundedY;
        entity.data.position[2] = finalPosition.z;
        // console.log(`[PlayerSystem] Updated entity.data.position to:`, entity.data.position);
      }
    } else {
      console.error(`[PlayerSystem] CRITICAL: Entity ${data.playerId} not found in entities system!`);
    }

    // Teleport the player to the final, grounded position
    this.emitTypedEvent(EventType.PLAYER_TELEPORT_REQUEST, {
      playerId: data.playerId,
      position: player.position
    });

    // Announce that the spawn is complete, so PlayerSpawnSystem can proceed
    this.emitTypedEvent(EventType.PLAYER_SPAWN_COMPLETE, {
      playerId: data.playerId,
    });
  }

  private onPlayerRegister(data: { playerId: string }): void {
    // For now, just log the registration - PlayerLocal reference will be handled elsewhere
    // console.log('[PlayerSystem] onPlayerRegister called with data:', data, 'playerId:', data?.playerId);
    if (!data?.playerId) {
      console.error('[PlayerSystem] ERROR: playerId is undefined in registration data!', data);
    }
      }

  async onPlayerEnter(data: PlayerEnterEvent): Promise<void> {
    try {
      console.log(`[PlayerSystem] onPlayerEnter called for playerId: ${data.playerId}`)
      
      // Check if player already exists in our system
      if (this.players.has(data.playerId)) {
        console.log(`[PlayerSystem] Player ${data.playerId} already exists in system`)
        return;
      }

    // Determine which ID to use for database lookups
    // Use userId (persistent account ID) if available, otherwise use playerId (session ID)
    const databaseId = data.userId || data.playerId;
    console.log(`[PlayerSystem] Player entering - playerId: ${data.playerId}, userId: ${data.userId}, databaseId: ${databaseId}`);

    // Load player data from database using persistent userId
    let playerData: Player | undefined;
    if (this.databaseSystem) {
      const dbData = this.databaseSystem.getPlayer(databaseId);
      if (dbData) {
        console.log(`[PlayerSystem] Loaded player from DB:`, {
          playerId: data.playerId,
          userId: databaseId,
          name: dbData.name,
          attackLevel: dbData.attackLevel,
          coins: dbData.coins,
          positionX: dbData.positionX,
          positionY: dbData.positionY
        })
        playerData = PlayerMigration.fromPlayerRow(dbData, data.playerId);
      } else {
        console.log(`[PlayerSystem] No DB data found for userId: ${databaseId}, creating new player`)
      }
    }

    // Create new player if not found in database
    if (!playerData) {
      const playerLocal = this.playerLocalRefs.get(data.playerId);
      const playerName = playerLocal?.name || `Player_${databaseId.substring(0, 8)}`;
      playerData = PlayerMigration.createNewPlayer(data.playerId, data.playerId, playerName);

      // Ground initial spawn to terrain height on server
      const terrain = this.world.getSystem<TerrainSystem>('terrain');
      if (terrain) {
        const px = playerData.position.x;
        const pz = playerData.position.z;
        const h = terrain.getHeightAt(px, pz);
        if (Number.isFinite(h)) {
          playerData.position.y = h + 0.1;
        }
      }

      // Save new player to database using persistent userId
      if (this.databaseSystem) {
        console.log(`[PlayerSystem] Creating new player in database with userId: ${databaseId}`);
        this.databaseSystem.savePlayer(databaseId, {
          name: playerData.name,
          combatLevel: playerData.combat.combatLevel,
          attackLevel: playerData.skills.attack.level,
        strengthLevel: playerData.skills.strength.level,
        defenseLevel: playerData.skills.defense.level,
        constitutionLevel: playerData.skills.constitution.level,
        rangedLevel: playerData.skills.ranged.level,
        health: playerData.health.current,
        maxHealth: playerData.health.max,
        positionX: playerData.position.x,
        positionY: playerData.position.y,
        positionZ: playerData.position.z,
      });
      }
    }

    // Register userId mapping for database persistence (critical!)
    if (data.userId) {
      PlayerIdMapper.register(data.playerId, data.userId);
      (playerData as Player & { userId?: string }).userId = data.userId;
    }

    // Add to our system using entity ID for runtime lookups
    this.players.set(data.playerId, playerData);

    // Emit player ready event, but DO NOT set position here anymore.
    // Position will be set by onPlayerSpawnRequest.
    this.emitTypedEvent(EventType.PLAYER_UPDATED, {
      playerId: data.playerId,
      playerData: {
        id: playerData.id,
        name: playerData.name,
        level: playerData.combat.combatLevel,
        health: playerData.health.current,
        maxHealth: playerData.health.max,
        alive: playerData.alive
      },
    });

    // Update UI
    this.emitPlayerUpdate(data.playerId);
    
        } catch (error) {
      Logger.systemError('PlayerSystem', `Error handling player enter for ${data.playerId}`, 
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  async onPlayerLeave(data: PlayerLeaveEvent): Promise<void> {
      console.log(`[PlayerSystem] onPlayerLeave called for playerId: ${data.playerId}`)
      // Save player data before removal
      if (this.databaseSystem && this.players.has(data.playerId)) {
        await this.savePlayerToDatabase(data.playerId);
        console.log(`[PlayerSystem] Saved player ${data.playerId} on disconnect`)
      }

    // Clean up
    this.players.delete(data.playerId);
    this.playerLocalRefs.delete(data.playerId);
    
    // Unregister userId mapping
    PlayerIdMapper.unregister(data.playerId);
    
    // Clear any respawn timers
    const timer = this.respawnTimers.get(data.playerId);
    if (timer) {
      clearTimeout(timer);
      this.respawnTimers.delete(data.playerId);
    }
  }

  async updateHealth(data: HealthUpdateEvent): Promise<void> {
    const player = this.players.get(data.entityId);
    if (!player) {
            return;
    }

    player.health.current = Math.max(0, Math.min(data.currentHealth, data.maxHealth));
    player.health.max = data.maxHealth;

    // Check for death
    if (player.health.current <= 0 && player.alive) {
      this.handleDeath({ 
        playerId: data.entityId, 
        deathLocation: player.position, 
        cause: 'health_depletion' 
      });
    }

    this.emitPlayerUpdate(data.entityId);
  }

  private handleDeath(data: PlayerDeathEvent): void {
    const player = this.players.get(data.playerId)!;

    player.alive = false;
    player.death.deathLocation = { ...player.position };
    player.death.respawnTime = Date.now() + this.RESPAWN_TIME;

    // Start respawn timer
    const timer = this.createTimer(() => {
      this.respawnPlayer(data.playerId);
      this.respawnTimers.delete(data.playerId);
    }, this.RESPAWN_TIME);

    this.respawnTimers.set(data.playerId, timer!);

    // Emit death event
    this.emitTypedEvent(EventType.PLAYER_DIED, {
      playerId: data.playerId,
      deathLocation: {
        x: player.death.deathLocation?.x ?? 0,
        y: player.death.deathLocation?.y ?? 2,
        z: player.death.deathLocation?.z ?? 0
      }
    });
    
    // Also emit ENTITY_DEATH for the death system
    this.emitTypedEvent(EventType.ENTITY_DEATH, {
      entityId: data.playerId,
      killedBy: 'unknown', // Could be passed in if we track the source
      entityType: 'player' as const
    });

    this.emitPlayerUpdate(data.playerId);
  }

  private respawnPlayer(playerId: string): void {
    const player = this.players.get(playerId)!;

    // Get spawn position - default to origin then ground to terrain
    const spawnPosition = { x: 0, y: 0.1, z: 0 };
    const terrain = this.world.getSystem<TerrainSystem>('terrain');
    if (terrain) {
      const h = terrain.getHeightAt(spawnPosition.x, spawnPosition.z);
      if (Number.isFinite(h)) {
        spawnPosition.y = h + 0.1;
      }
    }

    // Reset player state
    player.alive = true;
    player.health.current = player.health.max;
    player.position = spawnPosition;
    player.death.respawnTime = 0;

    // Clear respawn timer
    const timer = this.respawnTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.respawnTimers.delete(playerId);
    }

    // Update PlayerLocal position if available
    const playerLocal = this.playerLocalRefs.get(playerId);
    if (playerLocal) {
      playerLocal.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
    }

    // Force client snap to server-grounded respawn
    this.emitTypedEvent(EventType.PLAYER_TELEPORT_REQUEST, {
      playerId,
      position: spawnPosition
    });

    // Emit respawn event
    this.emitTypedEvent(EventType.PLAYER_RESPAWNED, {
      playerId,
      spawnPosition,
      townName: 'Lumbridge' // Default town
    });

    this.emitPlayerUpdate(playerId);
    
      }

  private updateCombatLevel(data: PlayerLevelUpEvent): void {
    const player = this.players.get(data.playerId)!;

    // Recalculate combat level based on current stats
    player.combat.combatLevel = this.calculateCombatLevel(player.skills);
    this.emitPlayerUpdate(data.playerId);
  }

  private emitPlayerUpdate(playerId: string): void {
    const player = this.players.get(playerId)!;

    const playerData = {
      id: player.id,
      playerId: playerId,
      name: player.name,
      level: player.combat.combatLevel,
      health: {
        current: player.health.current,
        max: player.health.max
      },
      alive: player.alive,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      },
      skills: player.skills,
      stamina: player.stamina?.current || 100,
      maxStamina: player.stamina?.max || 100,
      coins: player.coins || 0,
      combatStyle: player.combat.combatStyle || 'attack'
    };

    // Emit PLAYER_UPDATED for systems
    this.emitTypedEvent(EventType.PLAYER_UPDATED, {
      playerId,
      component: 'player',
      data: playerData
    });
    
    // Emit STATS_UPDATE for UI
    this.emitTypedEvent(EventType.STATS_UPDATE, playerData);
  }

  // Public API methods
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  isPlayerAlive(playerId: string): boolean {
    const player = this.players.get(playerId);
    return !!player?.alive;
  }

  getPlayerHealth(playerId: string): { current: number; max: number } | undefined {
    const player = this.players.get(playerId);
    return player ? { current: player.health.current, max: player.health.max } : undefined;
  }

  healPlayer(playerId: string, amount: number): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return false;

    const oldHealth = player.health.current;
    player.health.current = Math.min(player.health.max, player.health.current + amount);

    if (player.health.current !== oldHealth) {
      this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
        playerId,
        health: player.health.current,
        maxHealth: player.health.max
      });
      this.emitPlayerUpdate(playerId);
      return true;
    }
    
    return false;
  }
  
  private handleItemUsed(data: { playerId: string; itemId: string; slot: number; itemData: { id: string; name: string; type: string } }): void {
    // Check if this is a consumable item
    if (data.itemData.type !== 'consumable' && data.itemData.type !== 'food') {
      return;
    }
    
    // Get the full item data to check for healing properties
    const itemData = getItem(data.itemId);
    if (!itemData || !itemData.healAmount || itemData.healAmount <= 0) {
      return;
    }
    
    // Apply healing
    const healed = this.healPlayer(data.playerId, itemData.healAmount);
    
    if (healed) {
      // Emit healing event with source for tests
      this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
        playerId: data.playerId,
        amount: itemData.healAmount,
        source: 'food'
      });
      
      // Show message to player
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `You eat the ${itemData.name} and heal ${itemData.healAmount} HP.`,
        type: 'success' as const
      });
    }
  }

  async updatePlayerPosition(playerId: string, position: Position3D): Promise<void> {
    const player = this.players.get(playerId);
    if (!player) {
      // In test scenarios, players might not be registered through normal flow
      // Only warn if this seems like a real player ID (not a test ID)
      if (!playerId.startsWith('test-')) {
              // Real player not found - already logged above
              }
      return;
    }

    player.position = { ...position };
    
    // Emit position update event for reactive systems
    this.emitTypedEvent(EventType.PLAYER_POSITION_UPDATED, {
      playerId,
      position
    });
    
    // Position updates are frequent, don't save immediately
  }

  async updatePlayerStats(playerId: string, stats: Partial<Player['skills']>): Promise<void> {
    const player = this.players.get(playerId)!;

    // Update stats
    Object.assign(player.skills, stats);
    
    // Recalculate combat level
    player.combat.combatLevel = this.calculateCombatLevel(player.skills);

    // Save to database
    if (this.databaseSystem) {
      this.databaseSystem.savePlayer(playerId, {
        attackLevel: player.skills.attack.level,
        strengthLevel: player.skills.strength.level,
        defenseLevel: player.skills.defense.level,
        constitutionLevel: player.skills.constitution.level,
        rangedLevel: player.skills.ranged.level,
        combatLevel: player.combat.combatLevel
      });
    }
    
    this.emitPlayerUpdate(playerId);
  }

  async updatePlayerEquipment(playerId: string, equipment: Partial<Player['equipment']>): Promise<void> {
    const player = this.players.get(playerId)!;

    // Update equipment
    Object.assign(player.equipment, equipment);
    
    this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_UPDATED, {
      playerId,
      equipment: {
        helmet: player.equipment.helmet ? player.equipment.helmet.id : null,
        body: player.equipment.body ? player.equipment.body.id : null,
        legs: player.equipment.legs ? player.equipment.legs.id : null,
        weapon: player.equipment.weapon ? player.equipment.weapon.id : null,
        shield: player.equipment.shield ? player.equipment.shield.id : null,
      }
    });
    
    this.emitPlayerUpdate(playerId);
  }

  getPlayerStats(playerId: string): Skills | undefined {
    const player = this.players.get(playerId);
    return player?.skills;
  }

  getPlayerEquipment(playerId: string): Player['equipment'] | undefined {
    const player = this.players.get(playerId);
    return player?.equipment;
  }

  hasWeaponEquipped(playerId: string): boolean {
    const equipment = this.getPlayerEquipment(playerId);
    return !!equipment?.weapon;
  }

  canPlayerUseRanged(playerId: string): boolean {
    const equipment = this.getPlayerEquipment(playerId);
    return !!equipment?.weapon && equipment.weapon.attackType === AttackType.RANGED && !!equipment.arrows;
  }

  damagePlayer(playerId: string, amount: number, _source?: string): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return false;

    player.health.current = Math.max(0, player.health.current - amount);

    this.emitTypedEvent(EventType.PLAYER_HEALTH_UPDATED, {
      playerId,
      health: player.health.current,
      maxHealth: player.health.max
    });

    if (player.health.current <= 0) {
      this.handleDeath({ 
        playerId, 
        deathLocation: player.position, 
        cause: _source || 'damage' 
      });
    }
    
    this.emitPlayerUpdate(playerId);
    return true;
  }

  destroy(): void {
    // Clear all timers
    this.respawnTimers.forEach(timer => clearTimeout(timer));
    this.respawnTimers.clear();

    // Clear auto-save
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Clear references
    this.players.clear();
    this.playerLocalRefs.clear();
  }

  private startAutoSave(): void {
    this.saveInterval = this.createInterval(() => {
      this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL)!;
  }

  update(_dt: number): void {
    // Sync player positions from entities each frame (server only)
    if (!this.world.network?.isServer) return;
    
    for (const [playerId, player] of this.players) {
      const entity = this.world.entities.get(playerId);
      if (entity && entity.position) {
        // Update player object position from entity
        player.position.x = entity.position.x;
        player.position.y = entity.position.y;
        player.position.z = entity.position.z;
      }
    }
  }

  private async performAutoSave(): Promise<void> {
    if (!this.databaseSystem) return;

    console.log(`[PlayerSystem] Auto-save: saving ${this.players.size} players`)
    // Save all players
    for (const playerId of this.players.keys()) {
      try {
        await this.savePlayerToDatabase(playerId);
      } catch (error) {
        Logger.systemError('PlayerSystem', `Error saving player data during auto-save for ${playerId}`, 
          error instanceof Error ? error : new Error('Unknown error')
        );
      }
    }
  }

  private async savePlayerToDatabase(playerId: string): Promise<void> {
    const player = this.players.get(playerId);
    if (!player || !this.databaseSystem) return;

    // Use userId for database persistence if available
    const databaseId = PlayerIdMapper.getDatabaseId(playerId);
    
    if (databaseId !== playerId) {
      console.log(`[PlayerSystem] Saving player to database - playerId: ${playerId}, userId: ${databaseId}`);
    }

    // NEVER save invalid Y positions to database
    let safeY = player.position.y;
    if (safeY < -5 || safeY > 200 || !Number.isFinite(safeY)) {
      console.error(`[PlayerSystem] WARNING: Refusing to save invalid Y position to DB: ${safeY}, saving Y=10 instead`);
      safeY = 10; // Safe default
    }

    this.databaseSystem.savePlayer(databaseId, {
      name: player.name,
      combatLevel: player.combat.combatLevel,
      attackLevel: player.skills.attack.level,
      strengthLevel: player.skills.strength.level,
      defenseLevel: player.skills.defense.level,
      constitutionLevel: player.skills.constitution.level,
      rangedLevel: player.skills.ranged.level,
      health: player.health.current,
      maxHealth: player.health.max,
      positionX: player.position.x,
      positionY: safeY,
      positionZ: player.position.z
    });
  }

  private calculateCombatLevel(skills: Skills): number {
    // Formula from GDD: (Attack + Strength + Defense + Constitution + Ranged) / 4
    const totalLevel =
      skills.attack.level +
      skills.strength.level +
      skills.defense.level +
      skills.constitution.level +
      skills.ranged.level;
    return Math.floor(totalLevel / 4);
  }

}