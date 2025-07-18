import { World } from '@hyperfy/sdk';
import type { Vector3 } from '../types';
export interface WorldRegion {
    id: string;
    name: string;
    bounds: {
        min: Vector3;
        max: Vector3;
    };
    type: RegionType;
    level: number;
    features: string[];
}
export declare enum RegionType {
    CITY = "city",
    WILDERNESS = "wilderness",
    DUNGEON = "dungeon",
    VILLAGE = "village",
    FOREST = "forest",
    DESERT = "desert",
    MOUNTAIN = "mountain",
    SWAMP = "swamp"
}
export interface SpawnDefinition {
    type: 'npc' | 'resource' | 'item' | 'building';
    id: string;
    position: Vector3;
    rotation?: number;
    metadata?: any;
}
export declare class WorldGenerator {
    private world;
    private regions;
    private spawnPoints;
    constructor(world: World);
    /**
     * Generate the entire game world
     */
    generateWorld(): Promise<void>;
    /**
     * Create world regions
     */
    private createRegions;
    /**
     * Add a region
     */
    private addRegion;
    /**
     * Generate terrain (placeholder)
     */
    private generateTerrain;
    /**
     * Generate cities
     */
    private generateCities;
    /**
     * Generate Lumbridge
     */
    private generateLumbridge;
    /**
     * Generate Varrock
     */
    private generateVarrock;
    /**
     * Generate Tutorial Island
     */
    private generateTutorialIsland;
    /**
     * Generate wilderness areas
     */
    private generateWilderness;
    /**
     * Generate dungeons
     */
    private generateDungeons;
    /**
     * Add spawn definition
     */
    private addSpawn;
    /**
     * Spawn all entities
     */
    private spawnEntities;
    /**
     * Spawn NPC
     */
    private spawnNPC;
    /**
     * Spawn resource
     */
    private spawnResource;
    /**
     * Spawn building
     */
    private spawnBuilding;
    /**
     * Spawn item
     */
    private spawnItem;
    /**
     * Get region at position
     */
    getRegionAt(position: Vector3): WorldRegion | null;
    /**
     * Get all regions
     */
    getRegions(): WorldRegion[];
    /**
     * Get spawn points
     */
    getSpawnPoints(): SpawnDefinition[];
}
//# sourceMappingURL=WorldGenerator.d.ts.map