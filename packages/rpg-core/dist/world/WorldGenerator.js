"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldGenerator = exports.RegionType = void 0;
var RegionType;
(function (RegionType) {
    RegionType["CITY"] = "city";
    RegionType["WILDERNESS"] = "wilderness";
    RegionType["DUNGEON"] = "dungeon";
    RegionType["VILLAGE"] = "village";
    RegionType["FOREST"] = "forest";
    RegionType["DESERT"] = "desert";
    RegionType["MOUNTAIN"] = "mountain";
    RegionType["SWAMP"] = "swamp";
})(RegionType || (exports.RegionType = RegionType = {}));
class WorldGenerator {
    constructor(world) {
        this.regions = new Map();
        this.spawnPoints = [];
        this.world = world;
    }
    /**
     * Generate the entire game world
     */
    async generateWorld() {
        console.log('[WorldGenerator] Starting world generation...');
        // Create regions
        this.createRegions();
        // Generate terrain (placeholder for actual terrain generation)
        await this.generateTerrain();
        // Generate cities and villages
        await this.generateCities();
        // Generate wilderness areas
        await this.generateWilderness();
        // Generate dungeons
        await this.generateDungeons();
        // Spawn all entities
        await this.spawnEntities();
        console.log('[WorldGenerator] World generation complete!');
    }
    /**
     * Create world regions
     */
    createRegions() {
        // Main city - Lumbridge equivalent
        this.addRegion({
            id: 'lumbridge',
            name: 'Lumbridge',
            bounds: {
                min: { x: -100, y: 0, z: -100 },
                max: { x: 100, y: 50, z: 100 }
            },
            type: RegionType.CITY,
            level: 1,
            features: ['castle', 'general_store', 'bank', 'church', 'graveyard']
        });
        // Starting village - Tutorial Island equivalent
        this.addRegion({
            id: 'tutorial_island',
            name: 'Tutorial Island',
            bounds: {
                min: { x: -500, y: 0, z: -500 },
                max: { x: -300, y: 30, z: -300 }
            },
            type: RegionType.VILLAGE,
            level: 1,
            features: ['tutorial_npcs', 'training_dummies', 'basic_resources']
        });
        // Varrock - Major city
        this.addRegion({
            id: 'varrock',
            name: 'Varrock',
            bounds: {
                min: { x: 200, y: 0, z: -200 },
                max: { x: 500, y: 60, z: 100 }
            },
            type: RegionType.CITY,
            level: 10,
            features: ['grand_exchange', 'palace', 'museum', 'bank', 'shops']
        });
        // Wilderness
        this.addRegion({
            id: 'wilderness',
            name: 'The Wilderness',
            bounds: {
                min: { x: -200, y: 0, z: 200 },
                max: { x: 200, y: 50, z: 600 }
            },
            type: RegionType.WILDERNESS,
            level: 20,
            features: ['pvp_enabled', 'dangerous_npcs', 'rare_resources']
        });
        // Forest area
        this.addRegion({
            id: 'misthalin_forest',
            name: 'Misthalin Forest',
            bounds: {
                min: { x: -300, y: 0, z: -100 },
                max: { x: -100, y: 40, z: 100 }
            },
            type: RegionType.FOREST,
            level: 5,
            features: ['trees', 'wildlife', 'hidden_paths']
        });
    }
    /**
     * Add a region
     */
    addRegion(region) {
        this.regions.set(region.id, region);
    }
    /**
     * Generate terrain (placeholder)
     */
    async generateTerrain() {
        // In a real implementation, this would generate heightmaps,
        // place terrain textures, create rivers, etc.
        console.log('[WorldGenerator] Generating terrain...');
    }
    /**
     * Generate cities
     */
    async generateCities() {
        console.log('[WorldGenerator] Generating cities...');
        // Generate Lumbridge
        await this.generateLumbridge();
        // Generate Varrock
        await this.generateVarrock();
        // Generate Tutorial Island
        await this.generateTutorialIsland();
    }
    /**
     * Generate Lumbridge
     */
    async generateLumbridge() {
        const region = this.regions.get('lumbridge');
        if (!region)
            return;
        // Castle
        this.addSpawn({
            type: 'building',
            id: 'lumbridge_castle',
            position: { x: 0, y: 0, z: 0 },
            metadata: {
                name: 'Lumbridge Castle',
                floors: 3,
                rooms: ['throne_room', 'kitchen', 'bank', 'courtyard']
            }
        });
        // General Store
        this.addSpawn({
            type: 'building',
            id: 'lumbridge_general_store',
            position: { x: 30, y: 0, z: 20 },
            metadata: {
                name: 'Bob\'s Brilliant Axes',
                shopType: 'general'
            }
        });
        // Bank
        this.addSpawn({
            type: 'building',
            id: 'lumbridge_bank',
            position: { x: 0, y: 0, z: 30 },
            metadata: {
                name: 'Lumbridge Bank',
                bankChests: 5
            }
        });
        // NPCs
        this.addSpawn({
            type: 'npc',
            id: 'duke_horacio',
            position: { x: 0, y: 10, z: 0 },
            metadata: {
                name: 'Duke Horacio',
                level: 2,
                dialogue: 'quest_start',
                quests: ['cooks_assistant']
            }
        });
        this.addSpawn({
            type: 'npc',
            id: 'lumbridge_guide',
            position: { x: 10, y: 0, z: 10 },
            metadata: {
                name: 'Lumbridge Guide',
                level: 2,
                dialogue: 'help',
                topics: ['getting_started', 'controls', 'skills']
            }
        });
        this.addSpawn({
            type: 'npc',
            id: 'hans',
            position: { x: 20, y: 0, z: -10 },
            rotation: 0,
            metadata: {
                name: 'Hans',
                level: 1,
                patrol: true,
                patrolRadius: 50
            }
        });
        // Shop NPCs
        this.addSpawn({
            type: 'npc',
            id: 'bob',
            position: { x: 30, y: 0, z: 20 },
            metadata: {
                name: 'Bob',
                level: 1,
                shop: 'general_store',
                dialogue: 'shop'
            }
        });
        // Resources around Lumbridge
        for (let i = 0; i < 10; i++) {
            this.addSpawn({
                type: 'resource',
                id: 'tree_normal',
                position: {
                    x: -50 + Math.random() * 100,
                    y: 0,
                    z: -50 + Math.random() * 100
                },
                metadata: {
                    resourceType: 'tree',
                    tier: 1,
                    respawnTime: 30000
                }
            });
        }
        // Fishing spots
        for (let i = 0; i < 3; i++) {
            this.addSpawn({
                type: 'resource',
                id: 'fishing_spot_shrimp',
                position: {
                    x: -80 + i * 10,
                    y: 0,
                    z: 50
                },
                metadata: {
                    resourceType: 'fishing_spot',
                    fish: ['shrimp', 'anchovies'],
                    tool: 'small_net'
                }
            });
        }
    }
    /**
     * Generate Varrock
     */
    async generateVarrock() {
        const region = this.regions.get('varrock');
        if (!region)
            return;
        // Grand Exchange
        this.addSpawn({
            type: 'building',
            id: 'grand_exchange',
            position: { x: 350, y: 0, z: -50 },
            metadata: {
                name: 'Grand Exchange',
                clerks: 4,
                bankers: 2
            }
        });
        // Palace
        this.addSpawn({
            type: 'building',
            id: 'varrock_palace',
            position: { x: 350, y: 0, z: 0 },
            metadata: {
                name: 'Varrock Palace',
                floors: 2,
                guards: 8
            }
        });
        // GE Clerks
        for (let i = 0; i < 4; i++) {
            this.addSpawn({
                type: 'npc',
                id: `ge_clerk_${i}`,
                position: {
                    x: 340 + i * 10,
                    y: 0,
                    z: -50
                },
                metadata: {
                    name: 'Grand Exchange Clerk',
                    level: 2,
                    dialogue: 'grand_exchange'
                }
            });
        }
        // More shops and NPCs
        this.addSpawn({
            type: 'npc',
            id: 'aubury',
            position: { x: 300, y: 0, z: 50 },
            metadata: {
                name: 'Aubury',
                level: 41,
                shop: 'rune_shop',
                dialogue: 'shop',
                teleport: 'essence_mine'
            }
        });
    }
    /**
     * Generate Tutorial Island
     */
    async generateTutorialIsland() {
        const region = this.regions.get('tutorial_island');
        if (!region)
            return;
        // Tutorial building
        this.addSpawn({
            type: 'building',
            id: 'tutorial_building',
            position: { x: -400, y: 0, z: -400 },
            metadata: {
                name: 'Tutorial Building',
                rooms: ['main_hall', 'combat_room', 'skill_room']
            }
        });
        // Gielinor Guide (starting NPC)
        this.addSpawn({
            type: 'npc',
            id: 'gielinor_guide',
            position: { x: -400, y: 0, z: -400 },
            metadata: {
                name: 'Gielinor Guide',
                level: 2,
                dialogue: 'tutorial_start',
                tutorialStep: 0
            }
        });
        // Combat Instructor
        this.addSpawn({
            type: 'npc',
            id: 'combat_instructor',
            position: { x: -380, y: 0, z: -400 },
            metadata: {
                name: 'Combat Instructor',
                level: 146,
                dialogue: 'tutorial_combat',
                tutorialStep: 3
            }
        });
        // Training dummies
        for (let i = 0; i < 3; i++) {
            this.addSpawn({
                type: 'npc',
                id: `training_dummy_${i}`,
                position: {
                    x: -380 + i * 5,
                    y: 0,
                    z: -390
                },
                metadata: {
                    name: 'Training Dummy',
                    level: 1,
                    attackable: true,
                    noLoot: true,
                    respawnTime: 1000
                }
            });
        }
    }
    /**
     * Generate wilderness areas
     */
    async generateWilderness() {
        console.log('[WorldGenerator] Generating wilderness...');
        const region = this.regions.get('wilderness');
        if (!region)
            return;
        // Dangerous NPCs
        const monsters = [
            { id: 'skeleton', level: 25, count: 10 },
            { id: 'chaos_druid', level: 13, count: 5 },
            { id: 'hill_giant', level: 28, count: 3 },
            { id: 'moss_giant', level: 42, count: 2 }
        ];
        for (const monster of monsters) {
            for (let i = 0; i < monster.count; i++) {
                this.addSpawn({
                    type: 'npc',
                    id: `${monster.id}_${i}`,
                    position: {
                        x: region.bounds.min.x + Math.random() * (region.bounds.max.x - region.bounds.min.x),
                        y: 0,
                        z: region.bounds.min.z + Math.random() * (region.bounds.max.z - region.bounds.min.z)
                    },
                    metadata: {
                        name: monster.id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        level: monster.level,
                        aggressive: true,
                        aggroRange: 5,
                        drops: 'standard',
                        respawnTime: 60000
                    }
                });
            }
        }
        // Rare resources
        for (let i = 0; i < 5; i++) {
            this.addSpawn({
                type: 'resource',
                id: 'runite_rock',
                position: {
                    x: region.bounds.min.x + Math.random() * (region.bounds.max.x - region.bounds.min.x),
                    y: 0,
                    z: region.bounds.min.z + Math.random() * (region.bounds.max.z - region.bounds.min.z)
                },
                metadata: {
                    resourceType: 'rock',
                    ore: 'runite',
                    levelRequired: 85,
                    respawnTime: 720000 // 12 minutes
                }
            });
        }
    }
    /**
     * Generate dungeons
     */
    async generateDungeons() {
        console.log('[WorldGenerator] Generating dungeons...');
        // Lumbridge dungeon entrance
        this.addSpawn({
            type: 'building',
            id: 'lumbridge_dungeon_entrance',
            position: { x: -50, y: 0, z: -50 },
            metadata: {
                name: 'Dungeon Entrance',
                destination: 'lumbridge_dungeon',
                requirements: []
            }
        });
    }
    /**
     * Add spawn definition
     */
    addSpawn(spawn) {
        this.spawnPoints.push(spawn);
    }
    /**
     * Spawn all entities
     */
    async spawnEntities() {
        console.log(`[WorldGenerator] Spawning ${this.spawnPoints.length} entities...`);
        const spawningSystem = this.world.getSystem('spawning');
        const npcSystem = this.world.getSystem('npc');
        const resourceSpawnSystem = this.world.getSystem('resourceSpawn');
        if (!spawningSystem || !npcSystem) {
            console.error('[WorldGenerator] Required systems not found');
            return;
        }
        for (const spawn of this.spawnPoints) {
            try {
                switch (spawn.type) {
                    case 'npc':
                        await this.spawnNPC(spawn, npcSystem, spawningSystem);
                        break;
                    case 'resource':
                        await this.spawnResource(spawn, resourceSpawnSystem);
                        break;
                    case 'building':
                        await this.spawnBuilding(spawn, spawningSystem);
                        break;
                    case 'item':
                        await this.spawnItem(spawn, spawningSystem);
                        break;
                }
            }
            catch (error) {
                console.error(`[WorldGenerator] Failed to spawn ${spawn.type} ${spawn.id}:`, error);
            }
        }
        console.log('[WorldGenerator] Entity spawning complete');
    }
    /**
     * Spawn NPC
     */
    async spawnNPC(spawn, npcSystem, spawningSystem) {
        const npcData = {
            name: spawn.metadata?.name || spawn.id,
            level: spawn.metadata?.level || 1,
            position: spawn.position,
            rotation: spawn.rotation || 0,
            ...spawn.metadata
        };
        // Create NPC entity
        const npc = spawningSystem.spawnEntity('npc', spawn.position, {
            npcId: spawn.id,
            ...npcData
        });
        if (npc && spawn.metadata?.patrol) {
            // Set up patrol behavior
            npcSystem.setPatrol(npc.id, spawn.position, spawn.metadata.patrolRadius || 10);
        }
        if (npc && spawn.metadata?.shop) {
            // Set up shop
            const shopSystem = this.world.getSystem('shop');
            if (shopSystem) {
                shopSystem.linkNPCToShop(npc.id, spawn.metadata.shop);
            }
        }
        if (npc && spawn.metadata?.dialogue) {
            // Set up dialogue
            npcSystem.setDialogue(npc.id, spawn.metadata.dialogue, spawn.metadata);
        }
    }
    /**
     * Spawn resource
     */
    async spawnResource(spawn, resourceSpawnSystem) {
        if (!resourceSpawnSystem)
            return;
        const resourceData = {
            resourceId: spawn.id,
            position: spawn.position,
            type: spawn.metadata?.resourceType || 'tree',
            ...spawn.metadata
        };
        resourceSpawnSystem.addResource(resourceData);
    }
    /**
     * Spawn building
     */
    async spawnBuilding(spawn, spawningSystem) {
        const building = spawningSystem.spawnEntity('building', spawn.position, {
            buildingId: spawn.id,
            name: spawn.metadata?.name || spawn.id,
            ...spawn.metadata
        });
        // Buildings might have special interactions, portals, etc.
        if (building && spawn.metadata?.destination) {
            // Set up portal/entrance
            const navigationSystem = this.world.getSystem('navigation');
            if (navigationSystem) {
                navigationSystem.addPortal(building.id, spawn.metadata.destination);
            }
        }
    }
    /**
     * Spawn item
     */
    async spawnItem(spawn, spawningSystem) {
        const itemSpawnSystem = this.world.getSystem('itemSpawn');
        if (!itemSpawnSystem)
            return;
        itemSpawnSystem.spawnItem(spawn.id, spawn.metadata?.quantity || 1, spawn.position);
    }
    /**
     * Get region at position
     */
    getRegionAt(position) {
        for (const region of this.regions.values()) {
            if (position.x >= region.bounds.min.x && position.x <= region.bounds.max.x &&
                position.y >= region.bounds.min.y && position.y <= region.bounds.max.y &&
                position.z >= region.bounds.min.z && position.z <= region.bounds.max.z) {
                return region;
            }
        }
        return null;
    }
    /**
     * Get all regions
     */
    getRegions() {
        return Array.from(this.regions.values());
    }
    /**
     * Get spawn points
     */
    getSpawnPoints() {
        return this.spawnPoints;
    }
}
exports.WorldGenerator = WorldGenerator;
//# sourceMappingURL=WorldGenerator.js.map