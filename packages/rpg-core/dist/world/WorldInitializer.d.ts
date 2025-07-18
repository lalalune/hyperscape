import { World } from '@hyperfy/sdk';
export declare class WorldInitializer {
    private world;
    private generator;
    private initialized;
    constructor(world: World);
    /**
     * Initialize the game world
     */
    initialize(): Promise<void>;
    /**
     * Check if this is first time setup
     */
    private isFirstTimeSetup;
    /**
     * First time world setup
     */
    private firstTimeSetup;
    /**
     * Load existing world
     */
    private loadExistingWorld;
    /**
     * Load world data from persistence
     */
    private loadWorldData;
    /**
     * Create initial shops
     */
    private createInitialShops;
    /**
     * Create initial quests
     */
    private createInitialQuests;
    /**
     * Set up Grand Exchange
     */
    private setupGrandExchange;
    /**
     * Start world systems
     */
    private startWorldSystems;
    /**
     * Spawn initial players
     */
    private spawnInitialPlayers;
    /**
     * Start world events
     */
    private startWorldEvents;
    /**
     * Trigger random event
     */
    private triggerRandomEvent;
    /**
     * Update day/night cycle
     */
    private updateDayNightCycle;
    /**
     * Save world state
     */
    private saveWorldState;
    /**
     * Verify world integrity
     */
    private verifyWorldIntegrity;
    /**
     * Get world statistics
     */
    getWorldStats(): any;
}
//# sourceMappingURL=WorldInitializer.d.ts.map