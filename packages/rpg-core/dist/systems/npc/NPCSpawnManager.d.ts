import { World } from '@hyperfy/sdk';
import type { NPCSystem } from '../NPCSystem';
import type { Vector3 } from '../types';
interface SpawnPoint {
    id: string;
    position: Vector3;
    npcId: number;
    maxCount: number;
    respawnTime: number;
    radius: number;
    active: boolean;
    currentCount: number;
    lastSpawnTime: number;
}
export declare class NPCSpawnManager {
    private world;
    private npcSystem;
    private spawnPoints;
    private respawnQueue;
    private pendingSaves;
    private saveTimer?;
    private lastSaveTime;
    constructor(world: World, npcSystem: NPCSystem);
    /**
     * Setup event listeners
     */
    private setupEventListeners;
    /**
     * Start auto-save timer
     */
    private startAutoSave;
    /**
     * Handle world shutdown
     */
    private handleShutdown;
    /**
     * Load spawn data from persistence
     */
    private loadSpawnData;
    /**
     * Save spawn data to persistence
     */
    private saveSpawnData;
    /**
     * Mark for save
     */
    private markForSave;
    /**
     * Update spawn points and respawn queue
     */
    update(_delta: number): void;
    /**
     * Register a spawn point
     */
    registerSpawnPoint(config: {
        id: string;
        position: Vector3;
        npcId: number;
        maxCount?: number;
        respawnTime?: number;
        radius?: number;
    }): void;
    /**
     * Schedule a respawn
     */
    scheduleRespawn(spawnerId: string, npcId: number, respawnTime: number): void;
    /**
     * Activate/deactivate spawn point
     */
    setSpawnPointActive(spawnerId: string, active: boolean): void;
    /**
     * Get all spawn points
     */
    getSpawnPoints(): SpawnPoint[];
    /**
     * Spawn NPC at spawn point
     */
    private spawnAtPoint;
    /**
     * Process respawn task
     */
    private processRespawn;
    /**
     * Register default spawn points
     */
    private registerDefaultSpawnPoints;
}
export {};
//# sourceMappingURL=NPCSpawnManager.d.ts.map