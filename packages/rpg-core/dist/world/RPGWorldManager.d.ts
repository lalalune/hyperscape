import { World } from '@hyperfy/sdk';
import { RPGPluginConfig } from '../index';
import { Vector3 } from '../types';
/**
 * Manages the RPG world state and initialization
 */
export declare class RPGWorldManager {
    private world;
    private systems;
    private config;
    private initializer;
    private initialized;
    private playerCount;
    private worldTime;
    private lastSaveTime;
    constructor(world: World, systems: Map<string, any>, config: RPGPluginConfig);
    initialize(): Promise<void>;
    private setupEventListeners;
    private startPeriodicTasks;
    private handlePlayerConnect;
    private handlePlayerDisconnect;
    private getPlayerSpawnPosition;
    private getPlayerSavedPosition;
    private handleAdminSpawn;
    private saveWorld;
    private performCleanup;
    /**
     * Public API methods
     */
    getWorldTime(): number;
    isInSafeZone(position: Vector3): boolean;
    getRegionAt(position: Vector3): string | null;
    getStatus(): any;
    isReady(): boolean;
}
//# sourceMappingURL=RPGWorldManager.d.ts.map