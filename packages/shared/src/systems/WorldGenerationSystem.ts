
import type { World } from '../types/index';
import { ALL_WORLD_AREAS, STARTER_TOWNS } from '../data/world-areas';
import { Town, WorldArea } from '../types/core';
import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import { TerrainSystem } from './TerrainSystem';
import { groundToTerrain } from '../utils/EntityUtils';

/**
 * World Generation System
 * Handles generation of world structures including:
 * - Starter towns with safe zones
 * - Banks and stores
 * - Decorative elements
 * - Zone boundaries
 * - Mob spawn points from authored data
 * Listens to terrain tile generation events to place content.
 */
export class WorldGenerationSystem extends SystemBase {
  private towns = new Map<string, Town>();
  private worldStructures = new Map<string, { type: string; position: { x: number; y: number; z: number }; config: Record<string, unknown> }>();
  private terrainSystem!: TerrainSystem;
  
  constructor(world: World) {
    super(world, {
      name: 'world-generation',
      dependencies: {
        required: ['terrain'],
        optional: ['safezone', 'mob', 'resource', 'banking', 'store']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    this.terrainSystem = this.world.getSystem<TerrainSystem>('terrain')!;
    
    // Set up type-safe event subscriptions for world generation
    this.subscribe<{ tileX: number, tileZ: number, biome: string }>(EventType.TERRAIN_TILE_GENERATED, (data) => this.onTileGenerated(data));
    this.subscribe(EventType.PLAYER_JOINED, (data) => this.onPlayerEnter(data as { playerId: string }));
    this.subscribe(EventType.PLAYER_LEFT, (data) => this.onPlayerLeave(data as { playerId: string }));
    
    // Generate towns immediately as they are static placements
    this.generateTowns();
    
  }

  private onTileGenerated(data: { tileX: number, tileZ: number, biome: string }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    const tileBounds = {
        minX: data.tileX * TILE_SIZE,
        maxX: (data.tileX + 1) * TILE_SIZE,
        minZ: data.tileZ * TILE_SIZE,
        maxZ: (data.tileZ + 1) * TILE_SIZE,
    };

    // Find which world areas overlap with this new tile
    const overlappingAreas: WorldArea[] = [];
    for (const area of Object.values(ALL_WORLD_AREAS)) {
        const areaBounds = area.bounds;
        // Simple bounding box overlap check
        if (tileBounds.minX < areaBounds.maxX && tileBounds.maxX > areaBounds.minX &&
            tileBounds.minZ < areaBounds.maxZ && tileBounds.maxZ > areaBounds.minZ) {
            overlappingAreas.push(area);
        }
    }

    if (overlappingAreas.length > 0) {
        this.generateContentForTile(data, overlappingAreas);
    }
  }

  /**
   * Handle player entering the world
   */
  private onPlayerEnter(_data: { playerId: string }): void {
    // Player entered - could trigger additional world generation
        // Could trigger generation of content around the player's spawn area
  }

  /**
   * Handle player leaving the world
   */
  private onPlayerLeave(_data: { playerId: string }): void {
    // Player left - could clean up player-specific world content
    //     // Could clean up or save player-specific world state
  }

  private generateContentForTile(tileData: { tileX: number, tileZ: number }, areas: WorldArea[]): void {
    for (const area of areas) {
        // Spawn NPCs from world-areas.ts data if they fall within this tile
        this.generateNPCsForArea(area, tileData);

        // Spawn mob spawn points
        this.generateMobSpawnsForArea(area, tileData);

        // NOTE: Procedural resources like trees/rocks are now handled by TerrainSystem.
        // Authored/special resources could be spawned here.
    }
  }

  private generateNPCsForArea(area: WorldArea, tileData: { tileX: number, tileZ: number }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    for (const npc of area.npcs) {
        const npcTileX = Math.floor(npc.position.x / TILE_SIZE);
        const npcTileZ = Math.floor(npc.position.z / TILE_SIZE);

        if (npcTileX === tileData.tileX && npcTileZ === tileData.tileZ) {
            // Ground NPC to terrain - this will throw if terrain not available
            const groundedPosition = groundToTerrain(this.world, npc.position, 0.1, Infinity);
            
            this.emitTypedEvent(EventType.NPC_SPAWN_REQUEST, {
                npcId: npc.id,
                name: npc.name,
                type: npc.type,
                position: groundedPosition,
                services: npc.services,
                modelPath: npc.modelPath,
            });
        }
    }
  }

  private generateMobSpawnsForArea(area: WorldArea, tileData: { tileX: number, tileZ: number }): void {
    const TILE_SIZE = this.terrainSystem.getTileSize();
    for (const spawnPoint of area.mobSpawns) {
        const spawnTileX = Math.floor(spawnPoint.position.x / TILE_SIZE);
        const spawnTileZ = Math.floor(spawnPoint.position.z / TILE_SIZE);

        if (spawnTileX === tileData.tileX && spawnTileZ === tileData.tileZ) {
            // Ground mob spawn to terrain height
            let mobY = spawnPoint.position.y;
            const th = this.terrainSystem.getHeightAt(spawnPoint.position.x, spawnPoint.position.z);
            if (Number.isFinite(th)) mobY = (th as number) + 0.1;
            
            this.emitTypedEvent(EventType.MOB_SPAWN_POINTS_REGISTERED, {
                spawnPoints: [{
                    id: `${spawnPoint.mobId}_${Math.random()}`,
                    type: spawnPoint.mobId,
                    subType: spawnPoint.mobId,
                    position: { x: spawnPoint.position.x, y: mobY, z: spawnPoint.position.z },
                }]
            });
        }
    }
  }

  private getStarterTownConfigs(): Town[] {
    return Object.values(STARTER_TOWNS).map(area => ({
      id: area.id,
      name: area.name,
      position: { 
        x: (area.bounds.minX + area.bounds.maxX) / 2, 
        y: 0, // Y will be grounded to terrain
        z: (area.bounds.minZ + area.bounds.maxZ) / 2 
      },
      safeZoneRadius: Math.max(
        (area.bounds.maxX - area.bounds.minX) / 2,
        (area.bounds.maxZ - area.bounds.minZ) / 2
      ),
      hasBank: area.npcs.some(npc => npc.type === 'bank'),
      hasStore: area.npcs.some(npc => npc.type.includes('store')),
      isRespawnPoint: area.safeZone || false
    }));
  }

  private generateTowns(): void {
    const townConfigs = this.getStarterTownConfigs();
    for (const townConfig of townConfigs) {
      this.generateTown(townConfig);
    }
    
      }

  private generateTown(config: Town): void {
    this.towns.set(config.id, config);
    
    // Create a safe zone
    this.emitTypedEvent(EventType.ENTITY_SPAWNED, {
      entityType: 'safezone',
      entityId: `safezone_${config.id}`,
      position: config.position,
      radius: config.safeZoneRadius,
    });
    
    // Generate town structures, which will in turn spawn NPCs
    this.generateTownStructures(config);
  }

  private generateTownStructures(town: Town): void {
    // Spawning of structures and NPCs is now handled by onTileGenerated
    // But we can still emit events for systems that need to know about banks/stores
    if (town.hasBank) {
      this.emitTypedEvent(EventType.BANK_OPEN, {
        bankId: `bank_${town.id}`,
        position: { x: town.position.x - 8, y: town.position.y, z: town.position.z },
        townId: town.id
      });
    }
    
    if (town.hasStore) {
        // The NPC spawn request will be handled when the tile loads
    }
  }

  // API methods for other systems
  getTowns(): Town[] {
    return [...this.towns.values()];
  }

  private calculateDistance2D(pos1: { x: number; z: number }, pos2: { x: number; z: number }): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  getNearestTown(position: { x: number; z: number }): Town | null {
    let nearestTown: Town | null = null;
    let minDistance = Infinity;
    
    for (const town of this.towns.values()) {
      const distance = this.calculateDistance2D(position, town.position);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestTown = town;
      }
    }
    
    return nearestTown;
  }

  isInSafeZone(position: { x: number; z: number }): boolean {
    for (const town of this.towns.values()) {
      const distance = this.calculateDistance2D(position, town.position);
      
      if (distance <= town.safeZoneRadius) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get mob spawn points (for testing)
   */
  getMobSpawnPoints(): Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> {
    const mobSpawnPoints: Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> = [];
    
    // Iterate through all world areas and collect mob spawn points
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      if (area.mobSpawns && area.mobSpawns.length > 0) {
        for (const spawn of area.mobSpawns) {
          mobSpawnPoints.push({
            id: `${area.id}_mob_${spawn.mobId}`,
            type: spawn.mobId,
            position: spawn.position
          });
        }
      }
    }
    
    return mobSpawnPoints;
  }

  /**
   * Get resource spawn points (for testing)
   */
  getResourceSpawnPoints(): Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> {
    const resourceSpawnPoints: Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> = [];
    
    // Iterate through all world areas and collect resource spawn points
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      if (area.resources && area.resources.length > 0) {
        for (const resource of area.resources) {
          resourceSpawnPoints.push({
            id: `${area.id}_resource_${resource.resourceId}`,
            type: resource.resourceId,
            position: resource.position
          });
        }
      }
    }
    
    return resourceSpawnPoints;
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    this.towns.clear();
    this.worldStructures.clear();
    
        
    super.destroy();
  }
} 