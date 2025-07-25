import { System } from '../../core/systems/System';
import { ALL_MOBS, MobData, getMobsByDifficulty } from '../data/mobs';

/**
 * MobSpawnerSystem
 * 
 * Uses EntityManager to spawn mob entities instead of RPGMobApp objects.
 * Creates and manages all mob instances across the world based on GDD specifications.
 */
export class MobSpawnerSystem extends System {
  private spawnedMobs = new Map<string, string>(); // mobId -> entityId
  private spawnPoints = new Map<string, { x: number; y: number; z: number }[]>();
  private mobIdCounter = 0;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[MobSpawnerSystem] Initializing GDD-compliant mob spawner...');
    
    // Listen for mob spawning events
    this.world.on?.('rpg:mob:spawn_request', this.spawnMobAtLocation.bind(this));
    this.world.on?.('rpg:mob:despawn', this.despawnMob.bind(this));
    this.world.on?.('rpg:mob:respawn_all', this.respawnAllMobs.bind(this));
    
    // Listen for entity spawned events to track our mobs
    this.world.on?.('entity:spawned', this.handleEntitySpawned.bind(this));
    
    console.log('[MobSpawnerSystem] Mob spawner system initialized');
  }

  start(): void {
    console.log('[MobSpawnerSystem] Starting GDD mob spawning...');
    
    // Initialize spawn points for all difficulty zones
    this.initializeSpawnPoints();
    
    // Spawn all 9 mob types across their appropriate zones
    this.spawnAllMobTypes();
    
    console.log('[MobSpawnerSystem] All GDD mobs spawned successfully');
  }

  private initializeSpawnPoints(): void {
    console.log('[MobSpawnerSystem] Initializing spawn points for all difficulty levels...');
    
    // Test zone near origin (0,0,0) for easy testing
    this.spawnPoints.set('test_zone_origin', [
      { x: 5, y: 2, z: 5 },      // Near origin
      { x: -5, y: 2, z: 5 },     // Near origin
      { x: 5, y: 2, z: -5 },     // Near origin
      { x: -5, y: 2, z: -5 },    // Near origin
      { x: 0, y: 2, z: 10 },     // North of origin
      { x: 0, y: 2, z: -10 },    // South of origin
      { x: 10, y: 2, z: 0 },     // East of origin
      { x: -10, y: 2, z: 0 },    // West of origin
    ]);
    
    // Level 1 zones (Beginner areas)
    this.spawnPoints.set('level_1_zone', [
      { x: 20, y: 2, z: 10 },   // Goblin area
      { x: 25, y: 2, z: 15 },   // Goblin area
      { x: -30, y: 2, z: 20 },  // Bandit area
      { x: -25, y: 2, z: 25 },  // Bandit area
      { x: 40, y: 2, z: -10 },  // Barbarian area
      { x: 45, y: 2, z: -15 },  // Barbarian area
    ]);
    
    // Level 2 zones (Intermediate areas)  
    this.spawnPoints.set('level_2_zone', [
      { x: 80, y: 2, z: 80 },   // Hobgoblin area
      { x: 85, y: 2, z: 85 },   // Hobgoblin area
      { x: -60, y: 2, z: 60 },  // Corrupted Guard area
      { x: -65, y: 2, z: 65 },  // Corrupted Guard area
      { x: 100, y: 2, z: -50 }, // Dark Warrior area
      { x: 105, y: 2, z: -55 }, // Dark Warrior area
    ]);
    
    // Level 3 zones (Advanced areas)
    this.spawnPoints.set('level_3_zone', [
      { x: 200, y: 2, z: 150 }, // Black Knight area
      { x: 205, y: 2, z: 155 }, // Black Knight area
      { x: -150, y: 2, z: 200 }, // Ice Warrior area
      { x: -155, y: 2, z: 205 }, // Ice Warrior area
      { x: 180, y: 2, z: -120 }, // Dark Ranger area
      { x: 185, y: 2, z: -125 }, // Dark Ranger area
    ]);
    
    console.log('[MobSpawnerSystem] Spawn points initialized for all difficulty levels');
  }

  private spawnAllMobTypes(): void {
    console.log('[MobSpawnerSystem] Spawning all 9 GDD mob types...');
    
    // Spawn test mobs near origin (0,0,0) for easy access
    console.log('[MobSpawnerSystem] Spawning test mobs near origin...');
    this.spawnMobsByDifficulty(1, 'test_zone_origin');
    
    // Spawn Level 1 mobs (Goblin, Bandit, Barbarian)
    this.spawnMobsByDifficulty(1, 'level_1_zone');
    
    // Spawn Level 2 mobs (Hobgoblin, Guard, Dark Warrior)
    this.spawnMobsByDifficulty(2, 'level_2_zone');
    
    // Spawn Level 3 mobs (Black Knight, Ice Warrior, Dark Ranger)
    this.spawnMobsByDifficulty(3, 'level_3_zone');
    
    console.log(`[MobSpawnerSystem] Successfully spawned ${this.spawnedMobs.size} mobs from GDD data`);
  }

  private spawnMobsByDifficulty(difficultyLevel: 1 | 2 | 3, spawnZone: string): void {
    const mobs = getMobsByDifficulty(difficultyLevel);
    const spawnPoints = this.spawnPoints.get(spawnZone) || [];
    
    console.log(`[MobSpawnerSystem] Spawning ${mobs.length} Level ${difficultyLevel} mobs...`);
    
    let spawnIndex = 0;
    for (const mobData of mobs) {
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
    
    console.log(`[MobSpawnerSystem] Spawning ${mobData.name} (Level ${mobData.stats.level}) at (${position.x}, ${position.y}, ${position.z})`);
    
    try {
      // Use EntityManager to spawn mob via event system
      this.world.emit('mob:spawn', {
        mobType: mobData.id,
        level: mobData.stats.level,
        position: position,
        respawnTime: mobData.respawnTime || 300000, // 5 minutes default
        customId: mobId // Pass our custom ID for tracking
      });
      
      console.log(`[MobSpawnerSystem] ✅ Requested spawn for ${mobData.name} with ID: ${mobId}`);
      
    } catch (error) {
      console.error(`[MobSpawnerSystem] ❌ Failed to spawn ${mobData.name}:`, error);
    }
  }

  private handleEntitySpawned(data: { entityId: string; entityType: string; entityData: any }): void {
    // Track mobs spawned by the EntityManager
    if (data.entityType === 'mob' && data.entityData?.mobType) {
      // Find matching request based on mob type and position
      for (const [mobId] of this.spawnedMobs) {
        if (!this.spawnedMobs.get(mobId) && mobId.includes(data.entityData.mobType)) {
          this.spawnedMobs.set(mobId, data.entityId);
          console.log(`[MobSpawnerSystem] Tracked spawned mob: ${mobId} -> ${data.entityId}`);
          break;
        }
      }
    }
  }

  private spawnMobAtLocation(data: { mobType: string; position: { x: number; y: number; z: number }; level?: number }): void {
    const mobData = ALL_MOBS[data.mobType];
    if (!mobData) {
      console.error(`[MobSpawnerSystem] Unknown mob type: ${data.mobType}`);
      return;
    }
    
    this.spawnMobFromData(mobData, data.position);
  }

  private despawnMob(mobId: string): void {
    const entityId = this.spawnedMobs.get(mobId);
    if (entityId) {
      this.world.emit('entity:destroy', { entityId });
      this.spawnedMobs.delete(mobId);
      
      console.log(`[MobSpawnerSystem] Despawned mob: ${mobId}`);
    }
  }

  private respawnAllMobs(): void {
    console.log('[MobSpawnerSystem] Respawning all mobs...');
    
    // Clear existing mobs
    for (const [mobId, entityId] of this.spawnedMobs) {
      this.world.emit('entity:destroy', { entityId });
    }
    this.spawnedMobs.clear();
    
    // Respawn all mobs
    this.spawnAllMobTypes();
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

  getMobStats(): any {
    const stats = {
      totalMobs: this.spawnedMobs.size,
      level1Mobs: 0,
      level2Mobs: 0,
      level3Mobs: 0,
      byType: {} as Record<string, number>
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
  update(dt: number): void {
    // Update mob behaviors, check for respawns, etc.
  }

  destroy(): void {
    // Clean up all spawned mobs
    for (const [mobId, entityId] of this.spawnedMobs) {
      this.world.emit('entity:destroy', { entityId });
    }
    this.spawnedMobs.clear();
    console.log('[MobSpawnerSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}