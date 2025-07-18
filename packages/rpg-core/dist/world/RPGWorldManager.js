"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPGWorldManager = void 0;
const WorldInitializer_1 = require("./WorldInitializer");
/**
 * Manages the RPG world state and initialization
 */
class RPGWorldManager {
    constructor(world, systems, config) {
        this.initialized = false;
        this.playerCount = 0;
        this.worldTime = 0;
        this.lastSaveTime = 0;
        this.world = world;
        this.systems = systems;
        this.config = config;
        this.initializer = new WorldInitializer_1.WorldInitializer(world);
    }
    async initialize() {
        if (this.initialized) {
            console.warn('[RPGWorldManager] Already initialized');
            return;
        }
        console.log('[RPGWorldManager] Initializing RPG world...');
        try {
            // Setup event listeners
            this.setupEventListeners();
            // Initialize world if needed
            if (this.config.worldGen?.generateDefault) {
                await this.initializer.initialize();
            }
            // Start periodic tasks
            this.startPeriodicTasks();
            this.initialized = true;
            console.log('[RPGWorldManager] RPG world initialized successfully');
        }
        catch (error) {
            console.error('[RPGWorldManager] Failed to initialize:', error);
            throw error;
        }
    }
    setupEventListeners() {
        // Player connection handling
        this.world.events.on('player:connect', (data) => this.handlePlayerConnect(data));
        this.world.events.on('player:disconnect', (data) => this.handlePlayerDisconnect(data));
        // Admin commands
        this.world.events.on('admin:save', () => this.saveWorld());
        this.world.events.on('admin:spawn', (data) => this.handleAdminSpawn(data));
    }
    startPeriodicTasks() {
        // Auto-save every 5 minutes
        setInterval(() => this.saveWorld(), 5 * 60 * 1000);
        // Update world time
        setInterval(() => {
            this.worldTime += 1;
            this.world.events.emit('world:time', { time: this.worldTime });
        }, 1000);
        // Cleanup tasks every minute
        setInterval(() => this.performCleanup(), 60 * 1000);
    }
    async handlePlayerConnect(data) {
        console.log(`[RPGWorldManager] Player connecting: ${data.playerId}`);
        this.playerCount++;
        // Emit event for other systems
        this.world.events.emit('player:connected', {
            playerId: data.playerId,
            username: data.username || data.playerId,
            position: this.getPlayerSpawnPosition(data.playerId),
            timestamp: Date.now()
        });
    }
    async handlePlayerDisconnect(data) {
        console.log(`[RPGWorldManager] Player disconnecting: ${data.playerId}`);
        this.playerCount--;
        // Emit event for other systems
        this.world.events.emit('player:disconnected', {
            playerId: data.playerId,
            timestamp: Date.now()
        });
    }
    getPlayerSpawnPosition(playerId) {
        // Check for saved position
        const savedPos = this.getPlayerSavedPosition(playerId);
        if (savedPos)
            return savedPos;
        // Return default spawn
        return { x: 3232, y: 1, z: 3232 }; // Lumbridge spawn
    }
    getPlayerSavedPosition(playerId) {
        // TODO: Load from persistence
        return null;
    }
    async handleAdminSpawn(data) {
        const spawningSystem = this.systems.get('spawning');
        if (!spawningSystem)
            return;
        switch (data.type) {
            case 'npc':
                await spawningSystem.spawnNPC(data.id, {
                    position: data.position,
                    ...data.metadata
                });
                break;
            case 'item':
                await spawningSystem.spawnItem(data.id, {
                    position: data.position,
                    quantity: data.metadata?.quantity || 1
                });
                break;
        }
    }
    async saveWorld() {
        const now = Date.now();
        if (now - this.lastSaveTime < 30000)
            return; // Minimum 30s between saves
        console.log('[RPGWorldManager] Saving world state...');
        this.lastSaveTime = now;
        // Emit save event
        this.world.events.emit('world:save', {
            timestamp: now,
            entityCount: this.world.entities.items.size,
            playerCount: this.playerCount
        });
    }
    async performCleanup() {
        // Clean up expired items
        const lootSystem = this.systems.get('loot');
        if (lootSystem && lootSystem.cleanup) {
            lootSystem.cleanup();
        }
        // Clean up disconnected players
        // TODO: Implement player cleanup
    }
    /**
     * Public API methods
     */
    getWorldTime() {
        return this.worldTime;
    }
    isInSafeZone(position) {
        // Lumbridge safe zone
        if (position.x >= 3200 && position.x <= 3260 &&
            position.z >= 3200 && position.z <= 3260) {
            return true;
        }
        // Varrock safe zone
        if (position.x >= 3180 && position.x <= 3250 &&
            position.z >= 3420 && position.z <= 3500) {
            return true;
        }
        return false;
    }
    getRegionAt(position) {
        // Simple region detection based on coordinates
        if (position.x >= 3200 && position.x <= 3260 &&
            position.z >= 3200 && position.z <= 3260) {
            return 'lumbridge';
        }
        if (position.x >= 3180 && position.x <= 3250 &&
            position.z >= 3420 && position.z <= 3500) {
            return 'varrock';
        }
        if (position.y < 0) {
            return 'underground';
        }
        return 'wilderness';
    }
    getStatus() {
        return {
            initialized: this.initialized,
            playerCount: this.playerCount,
            entityCount: this.world.entities.items.size,
            worldTime: this.worldTime,
            uptime: Date.now() - (this.worldTime * 1000)
        };
    }
    isReady() {
        return this.initialized;
    }
}
exports.RPGWorldManager = RPGWorldManager;
//# sourceMappingURL=RPGWorldManager.js.map