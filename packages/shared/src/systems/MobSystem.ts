
import { AttackType } from '../types/core';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import { SystemBase } from './SystemBase';
// World eliminated - using base World instead
import { ALL_NPCS, NPC_SPAWN_CONSTANTS } from '../data/npcs';
import { ALL_WORLD_AREAS } from '../data/world-areas';
import { MobInstance, MobSpawnConfig } from '../types/core';
import { calculateDistance, groundToTerrain } from '../utils/EntityUtils';
import { EntityManager } from './EntityManager';

/**
 * Mob System - GDD Compliant
 * Handles mob spawning, AI behavior, and lifecycle management per GDD specifications:
 * - 15-minute global respawn cycle
 * - Fixed spawn locations with biome-appropriate mobs
 * - Aggressive vs non-aggressive behavior based on mob type
 * - Level-based aggro (high-level players ignored by low-level aggressive mobs)
 * - Combat integration with player combat system
 */
export class MobSystem extends SystemBase {
  private mobs = new Map<string, MobInstance>();
  private spawnPoints = new Map<string, { config: MobSpawnConfig, position: { x: number; y: number; z: number } }>();
  private respawnTimers = new Map<string, number>(); // Changed to store respawn times instead of timers
  private entityManager?: EntityManager;
  private mobIdCounter = 0;
  
  private readonly GLOBAL_RESPAWN_TIME = MOB_SPAWN_CONSTANTS.GLOBAL_RESPAWN_TIME;
  
  // Mob configurations loaded from externalized data
  private readonly MOB_CONFIGS: Record<string, MobSpawnConfig> = this.createMobConfigs();
  /**
   * Convert externalized MobData to MobSpawnConfig format
   */
  private createMobConfigs(): Record<string, MobSpawnConfig> {
    const configs: Record<string, MobSpawnConfig> = {};
    
    for (const [mobId, mobData] of Object.entries(ALL_MOBS)) {
      configs[mobId] = {
        type: mobId, // Mob ID from mobs.json
        name: mobData.name,
        level: mobData.stats.level,
        stats: {
          attack: mobData.stats.attack,
          strength: mobData.stats.strength,
          defense: mobData.stats.defense,
          constitution: mobData.stats.constitution,
          ranged: mobData.stats.ranged
        },
        equipment: {
        weapon: null,
        armor: null
      }, // Equipment can be added later if needed
        lootTable: `${mobId}_drops`,
        isAggressive: mobData.behavior.aggressive,
        aggroRange: mobData.behavior.aggroRange,
        respawnTime: mobData.respawnTime || this.GLOBAL_RESPAWN_TIME
      };
    }
    
    return configs;
  }

  constructor(world: World) {
    super(world, {
      name: 'mob',
      dependencies: {
        required: ['entity-manager'], // Needs entity manager to spawn/manage mobs
        optional: ['player', 'combat'] // Better with player and combat systems
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Set up type-safe event subscriptions
    // ENTITY_DEATH is in EventMap but only has entityId
    this.subscribe(EventType.ENTITY_DEATH, (data) => {
      const typedData = data as { entityId: string };
      this.handleMobDeath({ entityId: typedData.entityId, killedBy: '', entityType: 'mob' });
    });
    // ENTITY_DAMAGE_TAKEN is not in EventMap, so it receives the full event
    this.subscribe(EventType.ENTITY_DAMAGE_TAKEN, (data) => this.handleMobDamage(data as { entityId: string; damage: number; damageSource: string; entityType: 'player' | 'mob' }));
    this.subscribe<{ playerId: string }>(EventType.PLAYER_REGISTERED, (data) => this.onPlayerEnter(data));
    // Remove MOB_SPAWN_REQUEST subscription to prevent double spawning with EntityManager
    
    // Initialize spawn points (these would normally be loaded from world data)
    this.initializeSpawnPoints();
  }

  start(): void {
    
    // Get reference to EntityManager
    this.entityManager = this.world.getSystem<EntityManager>('entity-manager');
    // DISABLED: MobSpawnerSystem already handles spawning all mobs
    // Having both systems spawn causes duplicates and memory issues
    // if (this.entityManager) {
    //   this.spawnAllMobs();
    // }
  }

  private onPlayerEnter(_data: unknown): void {
    // Handle player entering the world
    // Could spawn mobs around the player or adjust mob behavior
      }

  private initializeSpawnPoints(): void {
    // Load spawn points from externalized world areas data
    let spawnId = 1;
    
    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (area.mobSpawns && area.mobSpawns.length > 0) {
        for (const mobSpawn of area.mobSpawns) {
          const config = this.MOB_CONFIGS[mobSpawn.mobId];
          if (config) {
            // Generate multiple spawn points within the spawn radius
            for (let i = 0; i < mobSpawn.maxCount; i++) {
              // Generate random position within spawn radius
              const angle = Math.random() * Math.PI * 2;
              const distance = Math.random() * mobSpawn.spawnRadius;
              const position = {
                x: mobSpawn.position.x + Math.cos(angle) * distance,
                y: mobSpawn.position.y || 0, // Use specified Y or default to 0 (will be grounded to terrain)
                z: mobSpawn.position.z + Math.sin(angle) * distance
              };

              this.spawnPoints.set(`${areaId}_spawn_${spawnId}`, { config, position });
              spawnId++;
            }
          }
        }
      }
    }
  }

  private spawnAllMobs(): void {
    for (const [spawnId, spawnData] of this.spawnPoints.entries()) {
      // Emit spawn request instead of directly spawning
      // This allows EntityManager to handle the actual entity creation
      this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
        mobType: spawnData.config.type,
        position: spawnData.position,
        level: spawnData.config.level,
        name: spawnData.config.name,
        customId: `mob_${spawnId}_${Date.now()}`
      });
    }
  }

  private async spawnMobInternal(spawnId: string, config: MobSpawnConfig, position: { x: number; y: number; z: number }): Promise<string | null> {
    if (!this.entityManager) {
      return null;
    }
    
    // Ground mob to terrain - use Infinity to allow any initial height difference
    const groundedPosition = groundToTerrain(this.world, position, 0.5, Infinity);
    
    const mobId = `mob_${spawnId}_${Date.now()}`;
    
    const mobData: MobInstance = {
      id: mobId,
      type: config.type,
      name: config.name,
      description: config.description || `A ${config.name}`,
      difficultyLevel: config.difficultyLevel || 1,
      mobType: config.type,
      behavior: config.behavior || {
        aggressive: config.isAggressive,
        aggroRange: config.aggroRange,
        chaseRange: config.aggroRange * 2,
        returnToSpawn: true,
        ignoreLowLevelPlayers: false,
        levelThreshold: 10
      },
      drops: config.drops || [],
      spawnBiomes: config.spawnBiomes || ['plains'],
      modelPath: config.modelPath || `/models/mobs/${config.type}.glb`,
      animationSet: config.animationSet || {
        idle: 'idle',
        walk: 'walk', 
        attack: 'attack',
        death: 'death'
      },
      respawnTime: config.respawnTime,
      xpReward: config.xpReward || config.level * 10,
      level: config.level,
      health: (config.stats?.constitution || 10) * 10, // Health = Constitution * 10 per GDD
      maxHealth: (config.stats?.constitution || 10) * 10,
      position: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
      isAlive: true,
      isAggressive: config.isAggressive,
      aggroRange: config.aggroRange,
      aiState: 'idle' as const,
      homePosition: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
      spawnLocation: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
      equipment: {
        weapon: config.equipment?.weapon ? {
          id: 1,
          name: config.equipment.weapon.name || 'Basic Weapon',
          type: config.equipment.weapon.type === 'ranged' ? AttackType.RANGED : AttackType.MELEE
        } : null,
        armor: config.equipment?.armor ? {
          id: 1,
          name: config.equipment.armor.name || 'Basic Armor'
        } : null
      },
      lootTable: config.lootTable,
      lastAI: Date.now(),
      stats: {
        level: config.level, 
        health: (config.stats?.constitution || 10) * 10,
        attack: config.stats?.attack || 1, 
        strength: config.stats?.strength || 1, 
        defense: config.stats?.defense || 1, 
        constitution: config.stats?.constitution || 10, 
        ranged: config.stats?.ranged || 1 
      },
      target: null,
      wanderRadius: 5 // Default wander radius
    };

    this.mobs.set(mobId, mobData);
    
    // EntityManager will emit MOB_SPAWNED after creating the entity
    // We don't need to emit it here anymore
    
    // Wait for entity to be created by EntityManager
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const entity = this.world.entities.get(mobId);
        if (entity) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 2000);
    });
    
    return mobId;
  }

  private spawnMobAtLocation(data: { mobType: string; position: { x: number; y: number; z: number } }): void {
    const config = this.MOB_CONFIGS[data.mobType];
    if (!config) {
      return;
    }

    const spawnId = `custom_${Date.now()}_${++this.mobIdCounter}`;
    this.spawnMobInternal(spawnId, config, data.position);
  }

  private handleMobDamage(data: { entityId: string; damage: number; damageSource: string; entityType: 'player' | 'mob' }): void {
    console.log(`[MobSystem] handleMobDamage called for ${data.entityId}: ${data.damage} damage from ${data.damageSource}`);
    if (data.entityType !== 'mob') return;
    
    // Validate entityId is defined
    if (!data.entityId) {
      console.warn('[MobSystem] handleMobDamage called with undefined entityId');
      return;
    }
    
    const mob = this.mobs.get(data.entityId);
    if (!mob || !mob.isAlive) return;

    // Apply damage
    mob.health = Math.max(0, mob.health - data.damage);
    
    // Emit damage event for AI system
    this.emitTypedEvent(EventType.MOB_ATTACKED, {
      mobId: data.entityId,
      damage: data.damage,
      attackerId: data.damageSource
    });
    
    // Check if mob died from damage
    if (mob.health <= 0) {
      // Let handleMobDeath emit the proper event with all data
      this.handleMobDeath({
        entityId: data.entityId,
        killedBy: data.damageSource,
        entityType: 'mob'
      });
    }
  }

  private handleMobDeath(data: { entityId: string; killedBy: string; entityType: 'player' | 'mob' }): void {
    if (data.entityType !== 'mob') return;
    
    const mob = this.mobs.get(data.entityId);
    if (!mob) return;

    mob.isAlive = false;
    mob.aiState = 'dead';
    mob.health = 0;
    
    // Loot generation is now handled by LootSystem via mob:died event
            // this.generateLoot(mob);
    
    // Schedule respawn per GDD (15-minute global cycle)
    const respawnTime = Date.now() + mob.respawnTime;
    this.respawnTimers.set(data.entityId, respawnTime);
    
    // Don't emit MOB_DIED here - let MobEntity.die() handle it
  }

  private respawnMob(mobId: string): void {
    const mob = this.mobs.get(mobId);
    if (!mob) return;

    // Ground spawn location to terrain before respawning - use Infinity to allow any initial height difference
    const groundedPosition = groundToTerrain(this.world, mob.spawnLocation, 0.5, Infinity);

    // Reset mob to spawn state
    mob.isAlive = true;
    mob.health = mob.maxHealth;
    mob.position = { ...groundedPosition };
    mob.homePosition = { ...groundedPosition };
    mob.aiState = 'idle';
    mob.target = null;
    mob.lastAI = Date.now();

    // Clear respawn timer
    this.respawnTimers.delete(mobId);
    
    // Request mob respawn via EntityManager
    if (this.entityManager) {
      const config = this.MOB_CONFIGS[mob.type];
      if (config) {
        // Emit a spawn request - EntityManager will create the entity and emit MOB_SPAWNED
        this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
          mobType: config.type,
          position: { x: groundedPosition.x, y: groundedPosition.y, z: groundedPosition.z },
          level: config.level,
          name: config.name,
          customId: mobId
        });
      }
    }
  }

  // Loot generation removed - now handled entirely by LootSystem
  // LootSystem loads loot tables from mobs.json dynamically

  // Public API methods for integration tests
  public getAllMobs(): MobInstance[] {
    return Array.from(this.mobs.values());
  }

  public getMob(mobId: string): MobInstance | undefined {
    return this.mobs.get(mobId);
  }

  public getMobsInArea(center: { x: number; y: number; z: number }, radius: number): MobInstance[] {
    return Array.from(this.mobs.values()).filter(mob => {
      if (!mob.isAlive) return false;
      const distance = calculateDistance(mob.position, center);
      return distance <= radius;
    });
  }

  /**
   * Public method to spawn a mob for testing/dynamic purposes
   */
  public async spawnMob(config: MobSpawnConfig, position: { x: number; y: number; z: number }): Promise<string | null> {


    // Convert the config to the internal MobSpawnConfig format
    const mobConfig: MobSpawnConfig = {
      type: config.type,
      name: config.name,
      level: config.level,
      stats: config.stats ?? {
        attack: config.level,
        strength: config.level,
        defense: config.level,
        constitution: 30,
        ranged: 1
      },
      equipment: {
        weapon: null,
        armor: null
      },
      lootTable: 'default',
      isAggressive: config.isAggressive !== false, // Default to true if not specified
      aggroRange: config.aggroRange ?? 5,
      respawnTime: config.respawnTime ?? 0
    };

    const timestamp = Date.now();
    const spawnId = `test_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // spawnMobInternal now returns the actual mob ID
    const mobId = await this.spawnMobInternal(spawnId, mobConfig, position);
    
    return mobId;
  }



  /**
   * Despawn a mob immediately
   * Used by test systems and cleanup operations
   */
  public despawnMob(mobId: string): boolean {
    if (!mobId) {
      return false;
    }

    const mob = this.mobs.get(mobId);
    if (!mob) {
      return false;
    }

    // Mark as dead and remove from active mobs
    mob.isAlive = false;
    mob.aiState = 'dead';
    
    // Clear any respawn timer
    const respawnTimer = this.respawnTimers.get(mobId);
    if (respawnTimer) {
      this.respawnTimers.delete(mobId);
    }

    // Remove from mobs collection
    this.mobs.delete(mobId);

    // Emit despawn event for cleanup
    this.emitTypedEvent(EventType.MOB_DESPAWN, {
      mobId,
      mobType: mob.type,
      position: { x: mob.position.x, y: mob.position.y, z: mob.position.z }
    });

    return true;
  }

  /**
   * Despawn all mobs (used for cleanup)
   */
  public despawnAllMobs(): number {
    const mobIds = Array.from(this.mobs.keys());
    let despawnedCount = 0;

    for (const mobId of mobIds) {
      if (this.despawnMob(mobId)) {
        despawnedCount++;
      }
    }

    return despawnedCount;
  }

  /**
   * Force kill a mob without loot or respawn
   */
  public killMob(mobId: string): boolean {
    const mob = this.mobs.get(mobId);
    if (!mob) {
      return false;
    }
    
    if (!mob.isAlive) {
      return false;
    }

    // Don't emit MOB_DIED here - let MobEntity.die() handle it
    return true;
  }


  /**
   * Main update loop - respawn logic only
   * AI is now handled by MobEntity.serverUpdate()
   */
  update(_dt: number): void {
    const now = Date.now();
    
    // Check respawn timers
    for (const [mobId, respawnTime] of this.respawnTimers.entries()) {
      if (now >= respawnTime) {
        this.respawnTimers.delete(mobId);
        this.respawnMob(mobId);
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all respawn timers
    this.respawnTimers.clear();
    
    // Despawn all mobs
    this.despawnAllMobs();
    
    // Clear all mob data
    this.mobs.clear();
    this.spawnPoints.clear();
    
    // Clear system references
    this.entityManager = undefined;
    
    // Call parent cleanup
    super.destroy();
  }
}