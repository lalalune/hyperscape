import { ALL_MOBS, getMobsByDifficulty } from '../data/mobs';
import type { MobData, MobSpawnStats } from '../types/core';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import type { EntitySpawnedEvent } from '../types/systems';
import { SystemBase } from './SystemBase';

// Types are now imported from shared type files

/**
 * MobSpawnerSystem
 * 
 * Uses EntityManager to spawn mob entities instead of MobApp objects.
 * Creates and manages all mob instances across the world based on GDD specifications.
 */
export class MobSpawnerSystem extends SystemBase {
  private spawnedMobs = new Map<string, string>(); // mobId -> entityId
  private spawnPoints = new Map<string, { x: number; y: number; z: number }[]>();
  private mobIdCounter = 0;
  
  constructor(world: World) {
    super(world, {
      name: 'mob-spawner',
      dependencies: {
        required: ['entity-manager'], // Depends on EntityManager to spawn mobs
        optional: ['world-generation', 'mob'] // Better with world generation and mob systems
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Set up event subscriptions for mob lifecycle (do not consume MOB_SPAWN_REQUEST to avoid re-emission loops)
    this.subscribe<{ mobId: string }>(EventType.MOB_DESPAWN, (data) => {
      this.despawnMob(data.mobId);
    });
    this.subscribe(EventType.MOB_RESPAWN_ALL, (_event) => this.respawnAllMobs());
    
    this.subscribe(EventType.MOB_SPAWN_POINTS_REGISTERED, (data: { spawnPoints: unknown[] }) => {
        data.spawnPoints.forEach(spawnPoint => {
            const spawn = spawnPoint as { type: string; position: { x: number; y: number; z: number } | [number, number, number] | undefined };
            const mobData = ALL_MOBS[spawn.type as keyof typeof ALL_MOBS];
            if (mobData) {
                // Handle both object {x, y, z} and array [x, y, z] formats
                let position: { x: number; y: number; z: number };
                if (Array.isArray(spawn.position)) {
                    position = { x: spawn.position[0], y: spawn.position[1], z: spawn.position[2] };
                } else if (spawn.position && typeof spawn.position === 'object' && 
                          'x' in spawn.position && 'y' in spawn.position && 'z' in spawn.position) {
                    position = spawn.position;
                } else {
                    console.warn(`[MobSpawnerSystem] Invalid spawn position for ${spawn.type}, using default (0,0,0)`, spawn.position);
                    position = { x: 0, y: 0, z: 0 };
                }
                this.spawnMobFromData(mobData, position);
            }
        });
    });

    // Listen for entity spawned events to track our mobs
    this.subscribe<EntitySpawnedEvent>(EventType.ENTITY_SPAWNED, (data) => {
      // Only handle mob entities
      if (data.entityType === 'mob') {
        this.handleEntitySpawned(data);
      }
    });
    
  }

  start(): void {
    console.log(`[MobSpawnerSystem] start() called on ${this.world.isServer ? 'SERVER' : 'CLIENT'}`);
    
    // On server, proactively spawn mobs from world areas data
    // On client, wait for events from terrain tile generation
    if (this.world.isServer) {
      console.log('[MobSpawnerSystem] Server-side - spawning mobs from world areas...');
      this.spawnMobsFromWorldAreas();
    } else {
      console.log('[MobSpawnerSystem] Client-side - waiting for terrain events');
    }
  }
  
  /**
   * Spawn mobs from world areas data (server only)
   */
  private spawnMobsFromWorldAreas(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, no-undef
    const { ALL_WORLD_AREAS } = require('../data/world-areas');
    
    let spawnedCount = 0;
    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      const worldArea = area as { mobSpawns?: Array<{ mobId: string; position: { x: number; y: number; z: number }; maxCount: number; spawnRadius: number }> };
      if (worldArea.mobSpawns && worldArea.mobSpawns.length > 0) {
        for (const mobSpawn of worldArea.mobSpawns) {
          const mobData = ALL_MOBS[mobSpawn.mobId as keyof typeof ALL_MOBS];
          if (mobData) {
            // Spawn multiple mobs within the spawn radius
            for (let i = 0; i < mobSpawn.maxCount; i++) {
              const angle = Math.random() * Math.PI * 2;
              const distance = Math.random() * mobSpawn.spawnRadius;
              const position = {
                x: mobSpawn.position.x + Math.cos(angle) * distance,
                y: mobSpawn.position.y || 0,
                z: mobSpawn.position.z + Math.sin(angle) * distance
              };
              
              this.spawnMobFromData(mobData, position);
              spawnedCount++;
            }
          } else {
            console.warn(`[MobSpawnerSystem] Unknown mob type: ${mobSpawn.mobId} in area ${areaId}`);
          }
        }
      }
    }
    
    console.log(`[MobSpawnerSystem] ✅ Spawned ${spawnedCount} mobs from ${Object.keys(ALL_WORLD_AREAS).length} world areas`);
  }

  private spawnMobsByDifficulty(difficultyLevel: 1 | 2 | 3, spawnZone: string): void {
    const mobsByDifficulty: { [key: number]: MobData[] } = {
      1: getMobsByDifficulty(1),
      2: getMobsByDifficulty(2),
      3: getMobsByDifficulty(3)
    };

    const spawnPoints = this.spawnPoints.get(spawnZone) || [];
    
    let spawnIndex = 0;
    for (const mobData of mobsByDifficulty[difficultyLevel]) {
      // Spawn multiple instances of each mob type
      const instancesPerType = 2;
      
      for (let i = 0; i < instancesPerType; i++) {
        const spawnPoint = spawnPoints[spawnIndex % spawnPoints.length];
        if (spawnPoint) {
          this.spawnMobFromData(mobData, spawnPoint);
          spawnIndex++;
        }
      }
    }
  }

  private spawnMobFromData(mobData: MobData, position: { x: number; y: number; z: number }): void {
    const mobId = `gdd_${mobData.id}_${this.mobIdCounter++}`;
    
    // Check if we already spawned this mob to prevent duplicates
    if (this.spawnedMobs.has(mobId)) {
      console.log(`[MobSpawnerSystem] Mob ${mobId} already spawned, skipping duplicate`);
      return;
    }
    
    // Track this spawn BEFORE emitting to prevent race conditions
    this.spawnedMobs.set(mobId, mobData.id);
    
    // Use EntityManager to spawn mob via event system
    this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
      mobType: mobData.id,
      level: mobData.stats.level,
      position: position,
      respawnTime: mobData.respawnTime || 300000, // 5 minutes default
      customId: mobId // Pass our custom ID for tracking
    });
  }

  private handleEntitySpawned(data: EntitySpawnedEvent): void {
    // Track mobs spawned by the EntityManager  
    if (data.entityType === 'mob' && data.entityData?.mobType) {
      // Find matching request based on mob type and position
      for (const [mobId] of this.spawnedMobs) {
        if (!this.spawnedMobs.get(mobId) && mobId.includes(data.entityData.mobType as string)) {
          this.spawnedMobs.set(mobId, data.entityId);
          break;
        }
      }
    }
  }

  // Note: This system intentionally does not handle MOB_SPAWN_REQUEST events to prevent
  // recursive re-emission loops. It only produces spawn requests via spawnMobFromData.

  private despawnMob(mobId: string): void {
    const entityId = this.spawnedMobs.get(mobId);
    if (entityId) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
      this.spawnedMobs.delete(mobId);
      
    }
  }

  private respawnAllMobs(): void {
    
    // Clear existing mobs
    for (const [_mobId, entityId] of this.spawnedMobs) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
    }
    this.spawnedMobs.clear();
    
    // Respawn all mobs
    this.spawnMobsByDifficulty(1, 'default'); // Example: respawn all level 1 mobs in default zone
    this.spawnMobsByDifficulty(2, 'default'); // Example: respawn all level 2 mobs in default zone
    this.spawnMobsByDifficulty(3, 'default'); // Example: respawn all level 3 mobs in default zone
  }

  // Public API
  getSpawnedMobs(): Map<string, string> {
    return this.spawnedMobs;
  }

  getMobCount(): number {
    return this.spawnedMobs.size;
  }

  getMobsByType(mobType: string): string[] {
    const mobEntityIds: string[] = [];
    for (const [id, entityId] of this.spawnedMobs) {
      if (id.includes(mobType)) {
        mobEntityIds.push(entityId);
      }
    }
    return mobEntityIds;
  }

  getMobStats(): MobSpawnStats {
    const stats = {
      totalMobs: this.spawnedMobs.size,
      level1Mobs: 0,
      level2Mobs: 0,
      level3Mobs: 0,
      byType: {} as Record<string, number>,
      spawnedMobs: this.spawnedMobs.size
    };
    
    for (const [mobId] of this.spawnedMobs) {
      if (mobId.includes('goblin') || mobId.includes('bandit') || mobId.includes('barbarian')) {
        stats.level1Mobs++;
      } else if (mobId.includes('hobgoblin') || mobId.includes('guard') || mobId.includes('dark_warrior')) {
        stats.level2Mobs++;
      } else if (mobId.includes('black_knight') || mobId.includes('ice_warrior') || mobId.includes('dark_ranger')) {
        stats.level3Mobs++;
      }
      
      // Count by type
      for (const mobType of Object.keys(ALL_MOBS)) {
        if (mobId.includes(mobType)) {
          stats.byType[mobType] = (stats.byType[mobType] || 0) + 1;
        }
      }
    }
    
    return stats;
  }

  // Required System lifecycle methods
  update(_dt: number): void {
    // Update mob behaviors, check for respawns, etc.
  }



  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all spawn tracking
    this.spawnedMobs.clear();
    this.spawnPoints.clear();
    
    // Reset counter
    this.mobIdCounter = 0;
    

    
    // Call parent cleanup
    super.destroy();
  }
}