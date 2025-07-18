import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import type { PlayerEntity, Vector3 } from '../types';
import { SpawnArea, SpawnerType } from '../types';
import { RPGEntity } from '../entities/RPGEntity';
type SpawnConditions = {
    timeOfDay?: {
        start: number;
        end: number;
    };
    minPlayers?: number;
    maxPlayers?: number;
    playerLevel?: {
        min: number;
        max: number;
    };
    customCondition?: (spawner: any, world: World) => boolean;
};
interface Spawner {
    id: string;
    type: SpawnerType;
    position: Vector3;
    entityDefinitions: SpawnDefinition[];
    maxEntities: number;
    respawnTime: number;
    activationRange: number;
    deactivationRange: number;
    requiresLineOfSight: boolean;
    activeEntities: Set<string>;
    lastSpawnTime: number;
    isActive: boolean;
    spawnArea: SpawnArea;
    conditions?: SpawnConditions;
}
interface SpawnDefinition {
    entityType: string;
    entityId?: number;
    weight: number;
    minLevel?: number;
    maxLevel?: number;
    metadata?: any;
}
export declare class SpawningSystem extends System {
    private spawners;
    private activeSpawns;
    private spawnQueue;
    private spatialIndex;
    private conditionChecker;
    private visualSystem;
    private readonly DEFAULT_ACTIVATION_RANGE;
    private readonly DEFAULT_DEACTIVATION_RANGE;
    private readonly UPDATE_INTERVAL;
    private lastUpdateTime;
    constructor(world: World);
    /**
     * Initialize the system
     */
    init(_options: any): Promise<void>;
    /**
     * Fixed update cycle
     */
    fixedUpdate(delta: number): void;
    /**
     * Register a spawner
     */
    registerSpawner(config: Partial<Spawner> & {
        position: Vector3;
        type: SpawnerType;
    }): string;
    /**
     * Unregister a spawner
     */
    unregisterSpawner(spawnerId: string): void;
    /**
     * Spawn entity from spawner
     */
    spawnEntity(spawner: Spawner): RPGEntity | null;
    /**
     * Despawn entity
     */
    despawnEntity(entityId: string): void;
    /**
     * Get active players in range
     */
    getActivePlayersInRange(position: Vector3, range: number): PlayerEntity[];
    /**
     * Update spawner
     */
    private updateSpawner;
    /**
     * Check spawner activation
     */
    private checkActivation;
    /**
     * Check if should spawn
     */
    private shouldSpawn;
    /**
     * Spawn from spawner
     */
    private spawnFromSpawner;
    /**
     * Select spawn definition based on weights
     */
    private selectSpawnDefinition;
    /**
     * Get spawn position
     */
    private getSpawnPosition;
    /**
     * Create entity based on type
     */
    private createEntity;
    /**
     * Create NPC
     */
    private createNPC;
    /**
     * Spawn resource entity (trees, rocks, items, etc.)
     */
    private spawnResource;
    /**
     * Spawn sword item for quest
     */
    private spawnSwordItem;
    /**
     * Get resource skill requirement
     */
    private getResourceSkill;
    /**
     * Get resource drops
     */
    private getResourceDrops;
    /**
     * Get resource model
     */
    private getResourceModel;
    /**
     * Spawn chest entity
     */
    private spawnChest;
    /**
     * Get chest model
     */
    private getChestModel;
    /**
     * Spawn boss entity
     */
    private spawnBoss;
    /**
     * Get boss definition
     */
    private getBossDefinition;
    /**
     * Create boss stats
     */
    private createBossStats;
    /**
     * Register spawn
     */
    private registerSpawn;
    /**
     * Handle entity death
     */
    private handleEntityDeath;
    /**
     * Handle entity despawn
     */
    private handleEntityDespawn;
    /**
     * Schedule respawn
     */
    private scheduleRespawn;
    /**
     * Process spawn queue
     */
    private processSpawnQueue;
    /**
     * Execute spawn task
     */
    private executeSpawnTask;
    /**
     * Clean up destroyed entities
     */
    private cleanupDestroyedEntities;
    /**
     * Get entity by ID
     */
    private getEntity;
    /**
     * Get entities near position
     */
    private getEntitiesNear;
    /**
     * Check if spawn position is valid
     */
    private isValidSpawnPosition;
    /**
     * Get ground height at position
     */
    private getGroundHeight;
    /**
     * Check line of sight
     */
    private hasLineOfSight;
    /**
     * Calculate distance between two positions
     */
    private getDistance;
    /**
     * Handle spawner activation
     */
    private onSpawnerActivated;
    /**
     * Handle spawner deactivation
     */
    private onSpawnerDeactivated;
    /**
     * Register default spawners for testing
     */
    registerDefaultSpawners(): void;
    /**
     * Check if position is available for spawning
     */
    private isPositionAvailable;
    /**
     * Perform spatial query to find entities within radius
     */
    private spatialQuery;
    /**
     * Check if terrain is walkable at position
     */
    private isTerrainWalkable;
    /**
     * Get terrain height at position
     */
    private getTerrainHeight;
    /**
     * Raycast to find ground level
     */
    private raycastGround;
}
export {};
//# sourceMappingURL=SpawningSystem.d.ts.map