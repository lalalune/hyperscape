"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpawningSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
const types_1 = require("../types");
// THREE import removed - needs to be provided by runtime
const CircularSpawnArea_1 = require("./spawning/CircularSpawnArea");
const SpatialIndex_1 = require("./spawning/SpatialIndex");
const SpawnConditionChecker_1 = require("./spawning/SpawnConditionChecker");
const RPGEntity_1 = require("../entities/RPGEntity");
class SpawningSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        // Core components
        this.spawners = new Map();
        this.activeSpawns = new Map(); // entityId -> spawnerId
        this.spawnQueue = [];
        this.visualSystem = null;
        // Configuration
        this.DEFAULT_ACTIVATION_RANGE = 50;
        this.DEFAULT_DEACTIVATION_RANGE = 75;
        this.UPDATE_INTERVAL = 1000; // 1 second
        this.lastUpdateTime = 0;
        this.spatialIndex = new SpatialIndex_1.SpatialIndex(50);
        this.conditionChecker = new SpawnConditionChecker_1.SpawnConditionChecker();
    }
    /**
     * Initialize the system
     */
    async init(_options) {
        console.log('[SpawningSystem] Initializing...');
        // Get visual representation system
        this.visualSystem = this.world.getSystem?.('visualRepresentation');
        // Listen for entity death
        this.world.events.on('entity:death', (event) => {
            this.handleEntityDeath(event.entityId);
        });
        // Listen for entity despawn
        this.world.events.on('entity:despawned', (event) => {
            this.handleEntityDespawn(event.entityId);
        });
        // Register default spawners
        this.registerDefaultSpawners(); // Enabled for RPG world
    }
    /**
     * Fixed update cycle
     */
    fixedUpdate(delta) {
        const now = Date.now();
        // Throttle updates
        if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
            return;
        }
        this.lastUpdateTime = now;
        // Process spawn queue
        this.processSpawnQueue(now);
        // Update spawners
        for (const [_id, spawner] of this.spawners) {
            this.updateSpawner(spawner, delta);
        }
        // Clean up destroyed entities
        this.cleanupDestroyedEntities();
    }
    /**
     * Register a spawner
     */
    registerSpawner(config) {
        const id = `spawner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const spawner = {
            id,
            type: config.type,
            position: config.position,
            entityDefinitions: config.entityDefinitions || [],
            maxEntities: config.maxEntities || 1,
            respawnTime: config.respawnTime || 30000,
            activationRange: config.activationRange || this.DEFAULT_ACTIVATION_RANGE,
            deactivationRange: config.deactivationRange || this.DEFAULT_DEACTIVATION_RANGE,
            requiresLineOfSight: config.requiresLineOfSight || false,
            activeEntities: new Set(),
            lastSpawnTime: 0,
            isActive: false,
            spawnArea: config.spawnArea || new CircularSpawnArea_1.CircularSpawnArea(config.position, 5, 1),
            conditions: config.conditions,
        };
        this.spawners.set(id, spawner);
        this.spatialIndex.add(spawner);
        console.log(`[SpawningSystem] Registered spawner ${id} at ${JSON.stringify(config.position)}`);
        return id;
    }
    /**
     * Unregister a spawner
     */
    unregisterSpawner(spawnerId) {
        const spawner = this.spawners.get(spawnerId);
        if (!spawner) {
            return;
        }
        // Despawn all active entities
        for (const entityId of spawner.activeEntities) {
            this.despawnEntity(entityId);
        }
        this.spawners.delete(spawnerId);
        this.spatialIndex.remove(spawner);
        console.log(`[SpawningSystem] Unregistered spawner ${spawnerId}`);
    }
    /**
     * Spawn entity from spawner
     */
    spawnEntity(spawner) {
        // Select entity type to spawn
        const definition = this.selectSpawnDefinition(spawner.entityDefinitions);
        if (!definition) {
            return null;
        }
        // Get spawn position
        const position = this.getSpawnPosition(spawner);
        if (!position) {
            return null;
        }
        // Create entity
        const entity = this.createEntity(definition, position, spawner);
        if (!entity) {
            return null;
        }
        // Register spawn
        this.registerSpawn(spawner, entity);
        // Emit spawn event
        this.world.events.emit('entity:spawned', {
            entityId: entity.id || entity.data?.id,
            spawnerId: spawner.id,
            position,
            entityType: definition.entityType,
        });
        return entity;
    }
    /**
     * Despawn entity
     */
    despawnEntity(entityId) {
        const spawnerId = this.activeSpawns.get(entityId);
        if (!spawnerId) {
            return;
        }
        const spawner = this.spawners.get(spawnerId);
        if (spawner) {
            spawner.activeEntities.delete(entityId);
        }
        this.activeSpawns.delete(entityId);
        // Remove entity from world
        const entity = this.getEntity(entityId);
        if (entity) {
            ;
            this.world.removeEntity?.(entity);
        }
        console.log(`[SpawningSystem] Despawned entity ${entityId}`);
    }
    /**
     * Get active players in range
     */
    getActivePlayersInRange(position, range) {
        const players = [];
        // Get all entities in range
        const entities = this.world.getEntitiesInRange?.(position, range) || [];
        for (const entity of entities) {
            if (entity.data?.type === 'player') {
                players.push(entity);
            }
        }
        return players;
    }
    /**
     * Update spawner
     */
    updateSpawner(spawner, _delta) {
        // Check activation
        const wasActive = spawner.isActive;
        spawner.isActive = this.checkActivation(spawner);
        // Handle activation state change
        if (!wasActive && spawner.isActive) {
            this.onSpawnerActivated(spawner);
        }
        else if (wasActive && !spawner.isActive) {
            this.onSpawnerDeactivated(spawner);
        }
        // Skip inactive spawners
        if (!spawner.isActive) {
            return;
        }
        // Check if should spawn
        if (this.shouldSpawn(spawner)) {
            this.spawnFromSpawner(spawner);
        }
    }
    /**
     * Check spawner activation
     */
    checkActivation(spawner) {
        const players = this.getActivePlayersInRange(spawner.position, spawner.activationRange);
        if (players.length > 0) {
            // Players in activation range - check line of sight if required
            if (spawner.requiresLineOfSight) {
                const hasLOS = players.some(player => {
                    const playerPos = player.data?.position || player.position;
                    const playerVector3 = Array.isArray(playerPos)
                        ? { x: playerPos[0] || 0, y: playerPos[1] || 0, z: playerPos[2] || 0 }
                        : playerPos;
                    return this.hasLineOfSight(playerVector3, spawner.position);
                });
                if (!hasLOS) {
                    return false;
                }
            }
            return true;
        }
        // No players in activation range
        // If spawner is active, check if players are still in deactivation range
        if (spawner.isActive) {
            const deactivationPlayers = this.getActivePlayersInRange(spawner.position, spawner.deactivationRange);
            return deactivationPlayers.length > 0;
        }
        return false;
    }
    /**
     * Check if should spawn
     */
    shouldSpawn(spawner) {
        // Check entity limit
        if (spawner.activeEntities.size >= spawner.maxEntities) {
            return false;
        }
        // Check respawn timer
        const now = Date.now();
        if (now - spawner.lastSpawnTime < spawner.respawnTime) {
            return false;
        }
        // Check spawn conditions
        if (!this.conditionChecker.checkConditions(spawner, this.world)) {
            return false;
        }
        return true;
    }
    /**
     * Spawn from spawner
     */
    spawnFromSpawner(spawner) {
        const entity = this.spawnEntity(spawner);
        if (entity) {
            spawner.lastSpawnTime = Date.now();
            console.log(`[SpawningSystem] Spawned ${entity.data?.type || 'entity'} from spawner ${spawner.id}`);
        }
    }
    /**
     * Select spawn definition based on weights
     */
    selectSpawnDefinition(definitions) {
        if (definitions.length === 0) {
            return null;
        }
        const totalWeight = definitions.reduce((sum, def) => sum + def.weight, 0);
        if (totalWeight === 0) {
            return null;
        }
        let roll = Math.random() * totalWeight;
        for (const definition of definitions) {
            roll -= definition.weight;
            if (roll <= 0) {
                return definition;
            }
        }
        return definitions[0] || null;
    }
    /**
     * Get spawn position
     */
    getSpawnPosition(spawner) {
        const maxAttempts = 10;
        for (let i = 0; i < maxAttempts; i++) {
            const position = spawner.spawnArea.getRandomPosition();
            // Check if position was generated successfully
            if (!position) {
                continue;
            }
            // Validate position
            if (!this.isValidSpawnPosition(position, spawner)) {
                continue;
            }
            // Check spacing from other spawns
            if (spawner.spawnArea.avoidOverlap && position) {
                const nearby = this.getEntitiesNear(position, spawner.spawnArea.minSpacing);
                if (nearby.length > 0) {
                    continue;
                }
            }
            // Adjust Y position to ground level
            position.y = this.getGroundHeight(position);
            return position;
        }
        return null;
    }
    /**
     * Create entity based on type
     */
    createEntity(definition, position, spawner) {
        switch (spawner.type) {
            case types_1.SpawnerType.NPC:
                return this.createNPC(definition, position, spawner);
            case types_1.SpawnerType.RESOURCE:
                return this.spawnResource(definition, position, spawner);
            case types_1.SpawnerType.CHEST:
                return this.spawnChest(definition, position, spawner);
            case types_1.SpawnerType.BOSS:
                return this.spawnBoss(definition, position, spawner);
            default:
                console.warn(`[SpawningSystem] Unknown spawner type: ${spawner.type}`);
                return null;
        }
    }
    /**
     * Create NPC
     */
    createNPC(definition, position, spawner) {
        // Get NPC system
        const npcSystem = this.world.getSystem?.('npc');
        if (!npcSystem) {
            console.warn('[SpawningSystem] NPC system not found');
            return null;
        }
        // Create NPC
        const npc = npcSystem.spawnNPC?.(definition.entityId || 1, position, spawner.id);
        if (npc) {
            console.log(`[SpawningSystem] Successfully created NPC ${npc.id} (entityId: ${definition.entityId}) at position [${position.x}, ${position.y}, ${position.z}]`);
        }
        else {
            console.warn(`[SpawningSystem] Failed to create NPC with entityId ${definition.entityId}. This usually means the NPC definition is missing from the config files.`);
        }
        return npc;
    }
    /**
     * Spawn resource entity (trees, rocks, items, etc.)
     */
    spawnResource(definition, position, spawner) {
        // Handle sword items specifically
        if (definition.entityType === 'sword') {
            return this.spawnSwordItem(definition, position, spawner);
        }
        const resourceId = `resource_${Date.now()}_${Math.random()}`;
        // Create resource entity
        const resource = new RPGEntity_1.RPGEntity(this.world, 'resource', {
            id: resourceId,
            type: 'resource',
            position,
            resourceType: definition.entityType,
            spawnPointId: spawner.id,
            depleted: false,
            respawnTime: spawner.respawnTime || 60000, // 1 minute default
        });
        // Add resource component
        const resourceComponent = {
            type: 'resource',
            resourceType: definition.entityType,
            skillRequired: this.getResourceSkill(definition.entityType),
            levelRequired: definition.minLevel || 1,
            depleted: false,
            harvestTime: 3000, // 3 seconds
            drops: this.getResourceDrops(definition.entityType),
            respawnTime: spawner.respawnTime || 60000,
        };
        resource.components.set('resource', resourceComponent);
        // Add visual component
        resource.components.set('visual', {
            type: 'visual',
            model: this.getResourceModel(definition.entityType),
            scale: definition.metadata?.scale || 1,
        });
        // Add collision
        resource.components.set('collider', {
            type: 'collider',
            shape: 'box',
            size: { x: 1, y: 2, z: 1 },
            blocking: true,
        });
        // Add to world
        if (this.world.entities?.items) {
            ;
            this.world.entities.items.set(resourceId, resource);
        }
        else {
            ;
            this.world.entities = new Map();
            this.world.entities.set(resourceId, resource);
        }
        // Create visual representation
        if (this.visualSystem) {
            this.visualSystem.createVisual(resource, definition.entityType);
        }
        return resource;
    }
    /**
     * Spawn sword item for quest
     */
    spawnSwordItem(definition, position, spawner) {
        const swordId = `sword_${Date.now()}_${Math.random()}`;
        // Create sword entity
        const sword = new RPGEntity_1.RPGEntity(this.world, 'item', {
            id: swordId,
            type: 'item',
            position,
            itemType: 'sword',
            spawnPointId: spawner.id,
            collected: false,
        });
        // Add item component
        const itemComponent = {
            type: 'item',
            itemId: 1001, // Bronze sword
            itemType: 'weapon',
            name: 'Bronze Sword',
            stackable: false,
            maxStack: 1,
            value: 50,
            collected: false,
            interactable: true,
        };
        sword.components.set('item', itemComponent);
        // Add visual component
        sword.components.set('visual', {
            type: 'visual',
            model: 'models/sword_bronze.glb',
            scale: 1,
        });
        // Add interactable component
        sword.components.set('interactable', {
            type: 'interactable',
            interactionType: 'pickup',
            range: 2,
            action: 'pick_up_sword',
        });
        // Add collision
        sword.components.set('collider', {
            type: 'collider',
            shape: 'box',
            size: { x: 0.2, y: 0.1, z: 1.2 },
            blocking: false,
        });
        // Add to world
        if (this.world.entities?.items) {
            ;
            this.world.entities.items.set(swordId, sword);
        }
        else {
            ;
            this.world.entities = new Map();
            this.world.entities.set(swordId, sword);
        }
        // Create visual representation
        if (this.visualSystem) {
            this.visualSystem.createVisual(sword, 'sword');
        }
        console.log(`[SpawningSystem] Spawned sword item ${swordId} at position [${position.x}, ${position.y}, ${position.z}]`);
        return sword;
    }
    /**
     * Get resource skill requirement
     */
    getResourceSkill(resourceType) {
        const skillMap = {
            tree: 'woodcutting',
            oak_tree: 'woodcutting',
            willow_tree: 'woodcutting',
            rock: 'mining',
            iron_rock: 'mining',
            gold_rock: 'mining',
            fishing_spot: 'fishing',
        };
        return skillMap[resourceType] || 'woodcutting';
    }
    /**
     * Get resource drops
     */
    getResourceDrops(resourceType) {
        const dropMap = {
            tree: [{ itemId: 1511, quantity: 1 }], // Logs
            oak_tree: [{ itemId: 1521, quantity: 1 }], // Oak logs
            rock: [{ itemId: 436, quantity: 1 }], // Copper ore
            iron_rock: [{ itemId: 440, quantity: 1 }], // Iron ore
        };
        return dropMap[resourceType] || [];
    }
    /**
     * Get resource model
     */
    getResourceModel(resourceType) {
        const modelMap = {
            tree: 'models/tree_normal.glb',
            oak_tree: 'models/tree_oak.glb',
            rock: 'models/rock_normal.glb',
            iron_rock: 'models/rock_iron.glb',
        };
        return modelMap[resourceType] || 'models/tree_normal.glb';
    }
    /**
     * Spawn chest entity
     */
    spawnChest(definition, position, spawner) {
        const chestId = `chest_${Date.now()}_${Math.random()}`;
        // Create chest entity
        const chest = new RPGEntity_1.RPGEntity(this.world, 'chest', {
            id: chestId,
            type: 'chest',
            position,
            chestType: definition.entityType,
            spawnPointId: spawner.id,
            locked: definition.metadata?.locked || false,
            keyRequired: definition.metadata?.keyRequired || null,
        });
        // Add chest component
        const chestComponent = {
            type: 'chest',
            chestType: definition.entityType,
            lootTable: definition.metadata?.lootTable || 'chest_common',
            locked: definition.metadata?.locked || false,
            keyRequired: definition.metadata?.keyRequired || null,
            opened: false,
            respawnTime: spawner.respawnTime || 300000, // 5 minutes
        };
        chest.components.set('chest', chestComponent);
        // Add visual
        chest.components.set('visual', {
            type: 'visual',
            model: this.getChestModel(definition.entityType),
            scale: definition.metadata?.scale || 1,
        });
        // Add interactable
        chest.components.set('interactable', {
            type: 'interactable',
            interactionType: 'open',
            range: 2,
        });
        // Add to world
        if (this.world.entities?.items) {
            ;
            this.world.entities.items.set(chestId, chest);
        }
        else {
            ;
            this.world.entities = new Map();
            this.world.entities.set(chestId, chest);
        }
        // Create visual representation
        if (this.visualSystem) {
            this.visualSystem.createVisual(chest, 'chest');
        }
        return chest;
    }
    /**
     * Get chest model
     */
    getChestModel(chestType) {
        const modelMap = {
            chest_common: 'models/chest_wooden.glb',
            chest_rare: 'models/chest_ornate.glb',
            chest_epic: 'models/chest_golden.glb',
        };
        return modelMap[chestType] || 'models/chest_wooden.glb';
    }
    /**
     * Spawn boss entity
     */
    spawnBoss(definition, position, spawner) {
        const bossId = `boss_${Date.now()}_${Math.random()}`;
        const bossDef = this.getBossDefinition(definition.entityType);
        if (!bossDef) {
            return null;
        }
        // Create boss entity
        const boss = new RPGEntity_1.RPGEntity(this.world, 'npc', {
            id: bossId,
            type: 'npc',
            position,
            npcId: bossDef.id,
            spawnPointId: spawner.id,
        });
        // Add NPC component with boss stats
        const npcComponent = {
            type: 'npc',
            npcId: bossDef.id,
            name: bossDef.name,
            examine: bossDef.examine,
            npcType: types_1.NPCType.BOSS,
            behavior: types_1.NPCBehavior.AGGRESSIVE,
            faction: bossDef.faction || 'hostile',
            state: types_1.NPCState.IDLE,
            level: bossDef.level,
            combatLevel: bossDef.combatLevel,
            maxHitpoints: bossDef.maxHitpoints,
            currentHitpoints: bossDef.maxHitpoints,
            attackStyle: bossDef.attackStyle || types_1.AttackType.MELEE,
            aggressionLevel: 100,
            aggressionRange: bossDef.aggressionRange || 10,
            attackBonus: bossDef.combat.attackBonus,
            strengthBonus: bossDef.combat.strengthBonus,
            defenseBonus: bossDef.combat.defenseBonus,
            maxHit: bossDef.combat.maxHit,
            attackSpeed: bossDef.combat.attackSpeed,
            respawnTime: spawner.respawnTime || 600000, // 10 minutes
            wanderRadius: 0, // Bosses don't wander
            spawnPoint: position,
            lootTable: bossDef.lootTable,
            currentTarget: null,
            lastInteraction: 0,
        };
        boss.components.set('npc', npcComponent);
        // Add boss-specific component
        boss.components.set('boss', {
            type: 'boss',
            phase: 1,
            maxPhases: bossDef.phases || 1,
            specialAttacks: bossDef.specialAttacks || [],
            immunities: bossDef.immunities || [],
            mechanics: bossDef.mechanics || [],
        });
        // Add stats
        boss.components.set('stats', this.createBossStats(bossDef));
        // Add movement
        boss.components.set('movement', {
            type: 'movement',
            position: { ...position },
            destination: null,
            targetPosition: null,
            path: [],
            currentSpeed: 0,
            moveSpeed: bossDef.moveSpeed || 3,
            isMoving: false,
            canMove: true,
            runEnergy: 100,
            isRunning: false,
            facingDirection: 0,
            pathfindingFlags: 0,
            lastMoveTime: 0,
            teleportDestination: null,
            teleportTime: 0,
            teleportAnimation: '',
        });
        // Add visual
        boss.components.set('visual', {
            type: 'visual',
            model: bossDef.model || 'models/boss_default.glb',
            scale: bossDef.scale || 2,
        });
        // Add to world
        if (this.world.entities?.items) {
            ;
            this.world.entities.items.set(bossId, boss);
        }
        else {
            ;
            this.world.entities = new Map();
            this.world.entities.set(bossId, boss);
        }
        // Create visual representation
        if (this.visualSystem) {
            this.visualSystem.createVisual(boss, definition.entityType);
        }
        // Announce boss spawn
        this.emit('boss:spawned', {
            bossId,
            bossName: bossDef.name,
            position,
        });
        return boss;
    }
    /**
     * Get boss definition
     */
    getBossDefinition(bossType) {
        // In real implementation, load from data files
        const bosses = {
            king_black_dragon: {
                id: 239,
                name: 'King Black Dragon',
                examine: 'The biggest, meanest dragon around!',
                level: 276,
                combatLevel: 276,
                maxHitpoints: 240,
                attackStyle: types_1.AttackType.MAGIC,
                aggressionRange: 15,
                combat: {
                    attackBonus: 240,
                    strengthBonus: 240,
                    defenseBonus: 240,
                    maxHit: 25,
                    attackSpeed: 4,
                },
                lootTable: 'kbd_drops',
                phases: 1,
                specialAttacks: ['dragonfire', 'poison_breath', 'freeze_breath'],
                model: 'models/boss_kbd.glb',
                scale: 3,
            },
        };
        return bosses[bossType];
    }
    /**
     * Create boss stats
     */
    createBossStats(bossDef) {
        return {
            type: 'stats',
            hitpoints: {
                current: bossDef.maxHitpoints,
                max: bossDef.maxHitpoints,
                level: 99,
                xp: 13034431,
            },
            attack: { level: 99, xp: 13034431 },
            strength: { level: 99, xp: 13034431 },
            defense: { level: 99, xp: 13034431 },
            ranged: { level: 99, xp: 13034431 },
            magic: { level: 99, xp: 13034431 },
            prayer: {
                level: 99,
                xp: 13034431,
                points: 99,
                maxPoints: 99,
            },
            combatBonuses: {
                attackStab: bossDef.combat.attackBonus,
                attackSlash: bossDef.combat.attackBonus,
                attackCrush: bossDef.combat.attackBonus,
                attackMagic: bossDef.combat.attackBonus,
                attackRanged: bossDef.combat.attackBonus,
                defenseStab: bossDef.combat.defenseBonus,
                defenseSlash: bossDef.combat.defenseBonus,
                defenseCrush: bossDef.combat.defenseBonus,
                defenseMagic: bossDef.combat.defenseBonus,
                defenseRanged: bossDef.combat.defenseBonus,
                meleeStrength: bossDef.combat.strengthBonus,
                rangedStrength: bossDef.combat.strengthBonus,
                magicDamage: bossDef.combat.strengthBonus,
                prayerBonus: 0,
            },
            combatLevel: bossDef.combatLevel,
            totalLevel: 2277,
        };
    }
    /**
     * Register spawn
     */
    registerSpawn(spawner, entity) {
        const entityId = entity.id || entity.data?.id;
        spawner.activeEntities.add(entityId);
        this.activeSpawns.set(entityId, spawner.id);
    }
    /**
     * Handle entity death
     */
    handleEntityDeath(entityId) {
        const spawnerId = this.activeSpawns.get(entityId);
        if (!spawnerId) {
            return;
        }
        const spawner = this.spawners.get(spawnerId);
        if (!spawner) {
            return;
        }
        // Remove from active entities
        spawner.activeEntities.delete(entityId);
        this.activeSpawns.delete(entityId);
        // Schedule respawn
        this.scheduleRespawn(spawner);
    }
    /**
     * Handle entity despawn
     */
    handleEntityDespawn(entityId) {
        this.handleEntityDeath(entityId);
    }
    /**
     * Schedule respawn
     */
    scheduleRespawn(spawner) {
        const task = {
            spawnerId: spawner.id,
            scheduledTime: Date.now() + spawner.respawnTime,
            priority: 1,
        };
        this.spawnQueue.push(task);
        this.spawnQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    }
    /**
     * Process spawn queue
     */
    processSpawnQueue(now) {
        while (this.spawnQueue.length > 0) {
            const task = this.spawnQueue[0];
            if (!task || task.scheduledTime > now) {
                break;
            }
            this.spawnQueue.shift();
            this.executeSpawnTask(task);
        }
    }
    /**
     * Execute spawn task
     */
    executeSpawnTask(task) {
        const spawner = this.spawners.get(task.spawnerId);
        if (!spawner) {
            return;
        }
        if (spawner.isActive && this.shouldSpawn(spawner)) {
            this.spawnFromSpawner(spawner);
        }
    }
    /**
     * Clean up destroyed entities
     */
    cleanupDestroyedEntities() {
        const toRemove = [];
        for (const [entityId, _spawnerId] of this.activeSpawns) {
            const entity = this.getEntity(entityId);
            if (!entity) {
                toRemove.push(entityId);
            }
        }
        for (const entityId of toRemove) {
            this.handleEntityDeath(entityId);
        }
    }
    /**
     * Get entity by ID
     */
    getEntity(entityId) {
        // Try test world first
        if (this.world.entities?.items) {
            return this.world.entities.items.get(entityId);
        }
        // Handle production environment
        const entity = this.world.entities?.get?.(entityId);
        if (!entity || typeof entity.getComponent !== 'function') {
            return undefined;
        }
        return entity;
    }
    /**
     * Get entities near position
     */
    getEntitiesNear(position, range) {
        // Use spatial query implementation
        const entities = this.spatialQuery(position, range);
        // Convert to RPGEntity array
        const rpgEntities = [];
        for (const entity of entities) {
            // Check if it's an RPGEntity
            if (entity && typeof entity.getComponent === 'function') {
                rpgEntities.push(entity);
            }
        }
        return rpgEntities;
    }
    /**
     * Check if spawn position is valid
     */
    isValidSpawnPosition(position, spawner) {
        // Use terrain/collision checks
        if (!this.isTerrainWalkable(position)) {
            return false;
        }
        // Additional spawner-specific checks
        if (spawner.spawnArea && !spawner.spawnArea.isValidPosition(position)) {
            return false;
        }
        return true;
    }
    /**
     * Get ground height at position
     */
    getGroundHeight(position) {
        // Use terrain height query implementation
        return this.getTerrainHeight(position);
    }
    /**
     * Check line of sight
     */
    hasLineOfSight(from, to) {
        // Use raycast implementation
        const physics = this.world.physics;
        if (!physics) {
            return true;
        } // Assume LOS if no physics
        const rayStart = new THREE.Vector3(from.x, from.y, from.z);
        const rayEnd = new THREE.Vector3(to.x, to.y, to.z);
        const rayDirection = new THREE.Vector3().subVectors(rayEnd, rayStart).normalize();
        const maxDistance = this.getDistance(from, to);
        const hit = physics.raycast(rayStart, rayDirection, maxDistance);
        // If no hit, we have line of sight
        return !hit;
    }
    /**
     * Calculate distance between two positions
     */
    getDistance(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * Handle spawner activation
     */
    onSpawnerActivated(spawner) {
        console.log(`[SpawningSystem] Spawner ${spawner.id} activated`);
        // Spawn initial entities up to maxEntities
        const entitiesToSpawn = spawner.maxEntities - spawner.activeEntities.size;
        for (let i = 0; i < entitiesToSpawn; i++) {
            // For initial spawn, temporarily bypass respawn timer
            const originalLastSpawnTime = spawner.lastSpawnTime;
            spawner.lastSpawnTime = 0;
            if (this.shouldSpawn(spawner)) {
                this.spawnFromSpawner(spawner);
            }
            else {
                // Restore original time if spawn failed
                spawner.lastSpawnTime = originalLastSpawnTime;
                break;
            }
        }
    }
    /**
     * Handle spawner deactivation
     */
    onSpawnerDeactivated(spawner) {
        console.log(`[SpawningSystem] Spawner ${spawner.id} deactivated`);
        // Optionally despawn entities when deactivated
        // This depends on game design choice
    }
    /**
     * Register default spawners for testing
     */
    registerDefaultSpawners() {
        console.log('[SpawningSystem] Registering default spawners near spawn point...');
        // ============ NPC SPAWNERS ============
        // Goblin spawner - close to spawn point
        const goblinSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.NPC,
            position: { x: 5, y: 0, z: 5 },
            entityDefinitions: [
                {
                    entityType: 'npc',
                    entityId: 1, // Goblin ID
                    weight: 100,
                },
            ],
            maxEntities: 2,
            respawnTime: 8000,
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 5, y: 0, z: 5 }, 3, 1),
        });
        // Guard spawner - protective NPCs
        const guardSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.NPC,
            position: { x: -5, y: 0, z: -5 },
            entityDefinitions: [
                {
                    entityType: 'npc',
                    entityId: 2, // Guard ID
                    weight: 100,
                },
            ],
            maxEntities: 1,
            respawnTime: 10000,
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: -5, y: 0, z: -5 }, 2, 1),
        });
        // Quest NPC spawner - gives kill goblin quest
        const questNpcSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.NPC,
            position: { x: 0, y: 0, z: 5 },
            entityDefinitions: [
                {
                    entityType: 'npc',
                    entityId: 100, // Quest Giver ID
                    weight: 100,
                },
            ],
            maxEntities: 1,
            respawnTime: 999999, // Never respawn
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 0, y: 0, z: 5 }, 1, 0),
        });
        // ============ CHEST SPAWNERS ============
        // Common chest spawner
        const chestSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.CHEST,
            position: { x: 8, y: 0, z: -8 },
            entityDefinitions: [
                {
                    entityType: 'chest_common',
                    weight: 100,
                    metadata: {
                        lootTable: 'chest_common',
                        locked: false,
                    },
                },
            ],
            maxEntities: 1,
            respawnTime: 60000, // 1 minute
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 8, y: 0, z: -8 }, 1, 0),
        });
        // Rare chest spawner
        const rareChestSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.CHEST,
            position: { x: -8, y: 0, z: 8 },
            entityDefinitions: [
                {
                    entityType: 'chest_rare',
                    weight: 100,
                    metadata: {
                        lootTable: 'chest_rare',
                        locked: true,
                        keyRequired: 'brass_key',
                    },
                },
            ],
            maxEntities: 1,
            respawnTime: 300000, // 5 minutes
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: -8, y: 0, z: 8 }, 1, 0),
        });
        // ============ ITEM SPAWNERS ============
        // Sword spawner - quest item
        const swordSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.RESOURCE, // Using resource type for items
            position: { x: 0, y: 0, z: 0 },
            entityDefinitions: [
                {
                    entityType: 'sword',
                    weight: 100,
                },
            ],
            maxEntities: 1,
            respawnTime: 10000, // 10 seconds
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 0, y: 0, z: 0 }, 1, 0),
        });
        // ============ RESOURCE SPAWNERS ============
        // Tree spawner - woodcutting
        const treeSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.RESOURCE,
            position: { x: 12, y: 0, z: 0 },
            entityDefinitions: [
                {
                    entityType: 'tree',
                    weight: 70,
                },
                {
                    entityType: 'oak_tree',
                    weight: 30,
                },
            ],
            maxEntities: 3,
            respawnTime: 30000, // 30 seconds
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 12, y: 0, z: 0 }, 5, 2),
        });
        // Rock spawner - mining
        const rockSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.RESOURCE,
            position: { x: -12, y: 0, z: 0 },
            entityDefinitions: [
                {
                    entityType: 'rock',
                    weight: 60,
                },
                {
                    entityType: 'iron_rock',
                    weight: 40,
                },
            ],
            maxEntities: 2,
            respawnTime: 45000, // 45 seconds
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: -12, y: 0, z: 0 }, 4, 2),
        });
        // ============ BOSS SPAWNER ============
        // Boss spawner - rare spawn
        const bossSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.BOSS,
            position: { x: 0, y: 0, z: 20 },
            entityDefinitions: [
                {
                    entityType: 'king_black_dragon',
                    weight: 100,
                },
            ],
            maxEntities: 1,
            respawnTime: 600000, // 10 minutes
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 0, y: 0, z: 20 }, 2, 0),
        });
        // ============ MIXED MOB SPAWNER ============
        // Mixed mob spawner with multiple entity types
        const mixedMobSpawnerId = this.registerSpawner({
            type: types_1.SpawnerType.NPC,
            position: { x: 0, y: 0, z: -15 },
            entityDefinitions: [
                {
                    entityType: 'npc',
                    entityId: 1, // Goblin
                    weight: 50,
                },
                {
                    entityType: 'npc',
                    entityId: 2, // Guard
                    weight: 30,
                },
                {
                    entityType: 'npc',
                    entityId: 3, // Cow
                    weight: 20,
                },
            ],
            maxEntities: 4,
            respawnTime: 12000,
            activationRange: 200,
            spawnArea: new CircularSpawnArea_1.CircularSpawnArea({ x: 0, y: 0, z: -15 }, 8, 2),
        });
        // Store spawner IDs for force activation
        const spawnerIds = [
            goblinSpawnerId,
            guardSpawnerId,
            questNpcSpawnerId,
            chestSpawnerId,
            rareChestSpawnerId,
            swordSpawnerId,
            treeSpawnerId,
            rockSpawnerId,
            bossSpawnerId,
            mixedMobSpawnerId,
        ];
        // Force spawn immediately for testing - override activation logic
        setTimeout(() => {
            console.log('[SpawningSystem] Force activating all test spawners...');
            for (const spawnerId of spawnerIds) {
                const spawner = this.spawners.get(spawnerId);
                if (spawner) {
                    console.log(`[SpawningSystem] Force activating spawner ${spawnerId} (${spawner.type})`);
                    spawner.isActive = true;
                    // Spawn initial entities for immediate testing
                    const entitiesToSpawn = spawner.maxEntities;
                    for (let i = 0; i < entitiesToSpawn; i++) {
                        const originalLastSpawnTime = spawner.lastSpawnTime;
                        spawner.lastSpawnTime = 0; // Bypass respawn timer
                        if (this.shouldSpawn(spawner)) {
                            this.spawnFromSpawner(spawner);
                        }
                        else {
                            spawner.lastSpawnTime = originalLastSpawnTime;
                            break;
                        }
                    }
                }
            }
            console.log('[SpawningSystem] All test spawners activated and initial entities spawned');
        }, 2000); // Wait 2 seconds for systems to initialize
        console.log(`[SpawningSystem] Registered ${spawnerIds.length} test spawners near spawn point`);
    }
    /**
     * Check if position is available for spawning
     */
    isPositionAvailable(position, radius) {
        // Use spatial query to check for nearby entities
        const nearbyEntities = this.spatialQuery(position, radius);
        // Check if any blocking entities exist
        for (const entity of nearbyEntities) {
            const collider = entity.getComponent('collider');
            if (collider && collider.blocking) {
                return false;
            }
        }
        // Add terrain/collision checks
        if (!this.isTerrainWalkable(position)) {
            return false;
        }
        return true;
    }
    /**
     * Perform spatial query to find entities within radius
     */
    spatialQuery(position, radius) {
        const results = [];
        // Check if world has spatial index
        const spatialIndex = this.world.spatialIndex;
        if (spatialIndex) {
            // Use optimized spatial query
            return spatialIndex.query(position, radius);
        }
        // Fallback to brute force search
        const radiusSquared = radius * radius;
        for (const entity of this.world.entities.items.values()) {
            if (!entity.position) {
                continue;
            }
            const dx = entity.position.x - position.x;
            const dy = entity.position.y - position.y;
            const dz = entity.position.z - position.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            if (distanceSquared <= radiusSquared) {
                results.push(entity);
            }
        }
        return results;
    }
    /**
     * Check if terrain is walkable at position
     */
    isTerrainWalkable(position) {
        // Check collision map
        const collisionMap = this.world.collisionMap;
        if (collisionMap) {
            const tileX = Math.floor(position.x);
            const tileZ = Math.floor(position.z);
            if (collisionMap[tileZ] && collisionMap[tileZ][tileX]) {
                return false; // Tile is blocked
            }
        }
        // Check terrain height - ensure spawn is on ground
        const terrainHeight = this.getTerrainHeight(position);
        if (Math.abs(position.y - terrainHeight) > 0.5) {
            return false; // Too far from ground
        }
        return true;
    }
    /**
     * Get terrain height at position
     */
    getTerrainHeight(position) {
        // Use terrain system if available
        const terrain = this.world.terrain;
        if (terrain && terrain.getHeightAt) {
            return terrain.getHeightAt(position.x, position.z);
        }
        // Use raycast to find ground
        const rayHeight = this.raycastGround(position);
        if (rayHeight !== null) {
            return rayHeight;
        }
        // Default to y=0
        return 0;
    }
    /**
     * Raycast to find ground level
     */
    raycastGround(position) {
        const physics = this.world.physics;
        if (!physics) {
            return null;
        }
        // Cast ray downward from high above
        const rayStart = new THREE.Vector3(position.x, position.y + 100, position.z);
        const rayDirection = new THREE.Vector3(0, -1, 0); // Downward direction
        const hit = physics.raycast(rayStart, rayDirection, 200);
        if (hit) {
            return hit.point.y;
        }
        return null;
    }
}
exports.SpawningSystem = SpawningSystem;
//# sourceMappingURL=SpawningSystem.js.map