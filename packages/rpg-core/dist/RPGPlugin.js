"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPGPlugin = void 0;
const RPGWorldManager_1 = require("./world/RPGWorldManager");
const RPGPublicAPI_1 = require("./api/RPGPublicAPI");
// Import all systems
const CombatSystem_1 = require("./systems/CombatSystem");
const InventorySystem_1 = require("./systems/InventorySystem");
const MovementSystem_1 = require("./systems/MovementSystem");
const BankingSystem_1 = require("./systems/BankingSystem");
const TradingSystem_1 = require("./systems/TradingSystem");
const SkillsSystem_1 = require("./systems/SkillsSystem");
const NPCSystem_1 = require("./systems/NPCSystem");
const LootSystem_1 = require("./systems/LootSystem");
const SpawningSystem_1 = require("./systems/SpawningSystem");
const VisualRepresentationSystem_1 = require("./systems/VisualRepresentationSystem");
const UISystem_1 = require("./ui/UISystem");
const StatsSystem_1 = require("./systems/StatsSystem");
const DeathRespawnSystem_1 = require("./systems/DeathRespawnSystem");
/**
 * Main RPG Plugin implementation
 */
class RPGPlugin {
    constructor(config) {
        this.systems = new Map();
        this.config = {
            debug: false,
            worldGen: {
                generateDefault: true,
                customSpawns: []
            },
            systems: {
                combat: true,
                banking: true,
                trading: true,
                skills: true,
                quests: true
            },
            visuals: {
                enableShadows: true,
                maxViewDistance: 100
            },
            ...config
        };
    }
    /**
     * Initialize the plugin
     */
    async init(world) {
        console.log('[RPGPlugin] Initializing RPG systems...');
        try {
            // Initialize core systems
            await this.initializeSystems(world);
            // Initialize world manager
            this.worldManager = new RPGWorldManager_1.RPGWorldManager(world, this.systems, this.config);
            await this.worldManager.initialize();
            // Create public API
            this.publicAPI = new RPGPublicAPI_1.RPGPublicAPI(world, this.systems, this.worldManager)(world).rpg = this.publicAPI;
            console.log('[RPGPlugin] RPG systems initialized successfully');
        }
        catch (error) {
            console.error('[RPGPlugin] Failed to initialize:', error);
            throw error;
        }
    }
    /**
     * Initialize all game systems
     */
    async initializeSystems(world) {
        // Core systems (always enabled)
        const coreSystems = [
            { name: 'stats', system: new StatsSystem_1.StatsSystem(world) },
            { name: 'movement', system: new MovementSystem_1.MovementSystem(world) },
            { name: 'inventory', system: new InventorySystem_1.InventorySystem(world) },
            { name: 'visual', system: new VisualRepresentationSystem_1.VisualRepresentationSystem(world, this.config.visuals) },
            { name: 'ui', system: new UISystem_1.UISystem(world) },
            { name: 'spawning', system: new SpawningSystem_1.SpawningSystem(world) },
            { name: 'npc', system: new NPCSystem_1.NPCSystem(world) },
            { name: 'loot', system: new LootSystem_1.LootSystem(world) },
            { name: 'deathRespawn', system: new DeathRespawnSystem_1.DeathRespawnSystem(world) }
        ];
        // Optional systems
        const optionalSystems = [
            { name: 'combat', system: new CombatSystem_1.CombatSystem(world), configKey: 'combat' },
            { name: 'banking', system: new BankingSystem_1.BankingSystem(world), configKey: 'banking' },
            { name: 'trading', system: new TradingSystem_1.TradingSystem(world), configKey: 'trading' },
            { name: 'skills', system: new SkillsSystem_1.SkillsSystem(world), configKey: 'skills' }
        ];
        // Initialize core systems
        for (const { name, system } of coreSystems) {
            await this.initializeSystem(world, name, system);
        }
        // Initialize optional systems based on config
        for (const { name, system, configKey } of optionalSystems) {
            if (this.config.systems?.[configKey]) {
                await this.initializeSystem(world, name, system);
            }
        }
    }
    /**
     * Initialize a single system
     */
    async initializeSystem(world, name, system) {
        if (this.config.debug) {
            console.log(`[RPGPlugin] Initializing ${name} system...`);
        }
        this.systems.set(name, system);
        world.systems.push(system);
        if (system.initialize) {
            await system.initialize();
        }
    }
    /**
     * Update loop
     */
    update(delta) {
        // Plugin update logic if needed
    }
    /**
     * Cleanup on plugin removal
     */
    destroy() {
        if (this.worldManager) {
            // Cleanup world manager
        }
        this.systems.clear();
        console.log('[RPGPlugin] RPG plugin destroyed');
    }
    /**
     * Get the public API
     */
    getAPI() {
        return this.publicAPI;
    }
}
exports.RPGPlugin = RPGPlugin;
//# sourceMappingURL=RPGPlugin.js.map