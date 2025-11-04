import { ALL_NPCS } from '../data/npcs';
import { ALL_WORLD_AREAS } from '../data/world-areas';
import type { NPCData, MobSpawnStats } from '../types/core';
import { EventType } from '../types/events';
import type { World } from '../types/index';
import type { EntitySpawnedEvent } from '../types/system-interfaces';
import { SystemBase } from './SystemBase';
import { TerrainSystem } from './TerrainSystem';

// Types are now imported from shared type files

/**
 * Mob NPC Spawner System
 *
 * Uses EntityManager to spawn mob entities instead of MobApp objects.
 * Creates and manages all combat NPC instances (mobs, bosses, quest enemies)
 * across the world based on GDD specifications.
 */
export class MobNPCSpawnerSystem extends SystemBase {
  private spawnedMobs = new Map<string, string>(); // mobId -> entityId
  private mobIdCounter = 0;
  private terrainSystem!: TerrainSystem;
  private lastSpawnTime = 0;
  private readonly SPAWN_COOLDOWN = 5000; // 5 seconds between spawns

  constructor(world: World) {
    super(world, {
      name: 'mob-npc-spawner',
      dependencies: {
        required: ['entity-manager', 'terrain'], // Depends on EntityManager and terrain for placement
        optional: ['mob-npc'] // Better with mob NPC system
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Get terrain system reference
    this.terrainSystem = this.world.getSystem<TerrainSystem>('terrain')!;

    // Set up event subscriptions for mob lifecycle (do not consume MOB_NPC_SPAWN_REQUEST to avoid re-emission loops)
    this.subscribe<{ mobId: string }>(EventType.MOB_NPC_DESPAWN, (data) => {
      this.despawnMob(data.mobId);
    });
    this.subscribe(EventType.MOB_NPC_RESPAWN_ALL, (_event) => this.respawnAllMobs());

    // Subscribe to terrain generation to spawn mobs for new tiles
    this.subscribe(EventType.TERRAIN_TILE_GENERATED, (data) => this.onTileGenerated(data as { tileX: number; tileZ: number; biome: string }));

    // Listen for entity spawned events to track our mobs
    this.subscribe<EntitySpawnedEvent>(EventType.ENTITY_SPAWNED, (data) => {
      // Only handle mob entities
      if (data.entityType === 'mob') {
        this.handleEntitySpawned(data);
      }
    });

  }

  async start(): Promise<void> {

    // Spawn a default test mob near origin BEFORE accepting connections (server-only)
    if (this.world.isServer) {
      await this.spawnDefaultMob();
    }

    // Mobs are now spawned reactively as terrain tiles generate
    // No need to spawn all mobs at startup - tiles will trigger spawning
  }

  /**
   * Spawn a default test mob for initial world content
   */
  private async spawnDefaultMob(): Promise<void> {

    // Wait for EntityManager to be ready
    let entityManager = this.world.getSystem('entity-manager') as { spawnEntity?: (config: unknown) => Promise<unknown> } | null;
    let attempts = 0;

    while ((!entityManager || !entityManager.spawnEntity) && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      entityManager = this.world.getSystem('entity-manager') as { spawnEntity?: (config: unknown) => Promise<unknown> } | null;
      attempts++;

      if (attempts % 10 === 0) {
      }
    }

    if (!entityManager?.spawnEntity) {
      console.error('[MobNPCSpawnerSystem] ❌ EntityManager never became available after 10 seconds!');
      return;
    }


    // Use fixed Y position for simplicity
    const y = 43;

    const mobConfig = {
      id: 'default_goblin_1',
      type: 'mob' as const,
      name: 'Goblin',
      position: { x: 5, y: y + 1.0, z: 15 },  // Raised Y to be clearly above terrain
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 3, y: 3, z: 3 },  // Scale up rigged model
      visible: true,
      interactable: true,
      interactionType: 'attack',
      interactionDistance: 10,
      description: 'A hostile goblin',
      model: 'asset://models/goblin/goblin_rigged.glb',
      properties: {},
      // MobEntity specific
      mobType: 'goblin',
      level: 2,
      currentHealth: 30,
      maxHealth: 30,
      attackPower: 5,
      defense: 2,
      attackSpeed: 2000,
      moveSpeed: 2,
      xpReward: 15,
      lootTable: [
        { itemId: 'coins', minQuantity: 5, maxQuantity: 15, chance: 1.0 }
      ],
      spawnPoint: { x: 5, y: y + 0.1, z: 15 },
      aggroRange: 8,
      combatRange: 1.5,
      aiState: 'idle',
      targetPlayerId: null,
      lastAttackTime: 0,
      deathTime: null,
      respawnTime: 60000 // 1 minute
    };


    try {
      const spawnedEntity = await entityManager.spawnEntity(mobConfig) as { id?: string } | null;

      // Verify it's in the world
      const verify = this.world.entities.get('default_goblin_1');
    } catch (err) {
      console.error('[MobNPCSpawnerSystem] ❌ Error spawning default goblin:', err);
    }
  }


  private spawnMobFromData(mobData: NPCData, position: { x: number; y: number; z: number }): void {
    const mobId = `gdd_${mobData.id}_${this.mobIdCounter++}`;

    // Check if we already spawned this mob to prevent duplicates
    if (this.spawnedMobs.has(mobId)) {
      return;
    }

    // Track this spawn BEFORE emitting to prevent race conditions
    this.spawnedMobs.set(mobId, mobData.id);

    // Use EntityManager to spawn mob via event system
    this.emitTypedEvent(EventType.MOB_NPC_SPAWN_REQUEST, {
      mobType: mobData.id,
      level: mobData.stats.level,
      position: position,
      respawnTime: mobData.combat.respawnTime || 300000, // 5 minutes default
      customId: mobId // Pass our custom ID for tracking
    });
  }

  private handleEntitySpawned(data: EntitySpawnedEvent): void {
    // Track mobs spawned by the EntityManager
    if (data.entityType === 'mob' && data.entityData?.mobType) {
      // Find matching request based on mob type and position
      for (const [mobId] of this.spawnedMobs) {
        if (!this.spawnedMobs.get(mobId) && mobId.includes(data.entityData.mobType as string)) {
          this.spawnedMobs.set(mobId, data.entityId!);
          break;
        }
      }
    }
  }

  // Note: This system intentionally does not handle MOB_NPC_SPAWN_REQUEST events to prevent
  // recursive re-emission loops. It only produces spawn requests via spawnMobFromData.

  private despawnMob(mobId: string): void {
    const entityId = this.spawnedMobs.get(mobId);
    if (entityId) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
      this.spawnedMobs.delete(mobId);

    }
  }

  private respawnAllMobs(): void {

    // Kill all existing mobs
    for (const [_mobId, entityId] of this.spawnedMobs) {
      this.emitTypedEvent(EventType.ENTITY_DEATH, { entityId });
    }
    this.spawnedMobs.clear();

    // Mobs will respawn naturally as terrain tiles remain loaded
    // TerrainSystem will re-emit TERRAIN_TILE_GENERATED which will trigger mob spawning
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
      for (const mobType of ALL_NPCS.keys()) {
        if (mobId.includes(mobType)) {
          stats.byType[mobType] = (stats.byType[mobType] || 0) + 1;
        }
      }
    }

    return stats;
  }

  /**
   * Handle terrain tile generation - spawn mobs for new tiles
   */
  private onTileGenerated(tileData: { tileX: number; tileZ: number; biome: string }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    const tileBounds = {
      minX: tileData.tileX * TILE_SIZE,
      maxX: (tileData.tileX + 1) * TILE_SIZE,
      minZ: tileData.tileZ * TILE_SIZE,
      maxZ: (tileData.tileZ + 1) * TILE_SIZE,
    };

    // Find which world areas overlap with this new tile
    const overlappingAreas: Array<typeof ALL_WORLD_AREAS[keyof typeof ALL_WORLD_AREAS]> = [];
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      const areaBounds = area.bounds;
      // Simple bounding box overlap check
      if (tileBounds.minX < areaBounds.maxX && tileBounds.maxX > areaBounds.minX &&
          tileBounds.minZ < areaBounds.maxZ && tileBounds.maxZ > areaBounds.minZ) {
        overlappingAreas.push(area);
      }
    }

    if (overlappingAreas.length > 0) {
      this.generateContentForTile(tileData, overlappingAreas);
    }
  }

  /**
   * Generate mobs for overlapping world areas
   */
  private generateContentForTile(tileData: { tileX: number; tileZ: number }, areas: Array<typeof ALL_WORLD_AREAS[keyof typeof ALL_WORLD_AREAS]>): void {
    for (const area of areas) {
      // Spawn mobs from world-areas.ts data if they fall within this tile
      this.generateMobSpawnsForArea(area, tileData);
    }
  }

  /**
   * Spawn mobs from a world area when its tile generates
   */
  private generateMobSpawnsForArea(area: typeof ALL_WORLD_AREAS[keyof typeof ALL_WORLD_AREAS], tileData: { tileX: number; tileZ: number }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    for (const spawnPoint of area.mobSpawns) {
      const spawnTileX = Math.floor(spawnPoint.position.x / TILE_SIZE);
      const spawnTileZ = Math.floor(spawnPoint.position.z / TILE_SIZE);

      if (spawnTileX === tileData.tileX && spawnTileZ === tileData.tileZ) {
        // Ground mob spawn to terrain height
        let mobY = spawnPoint.position.y;
        const th = this.terrainSystem.getHeightAt(spawnPoint.position.x, spawnPoint.position.z);
        if (Number.isFinite(th)) mobY = (th as number) + 0.1;

        // Directly spawn the mob instead of emitting an event back to ourselves
        const mobData = ALL_NPCS.get(spawnPoint.mobId);
        if (mobData) {
          this.spawnMobFromData(mobData, {
            x: spawnPoint.position.x,
            y: mobY,
            z: spawnPoint.position.z
          });
        }
      }
    }
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

    // Reset counter
    this.mobIdCounter = 0;

    // Call parent cleanup
    super.destroy();
  }
}
