"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPCSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
const NPCEntity_1 = require("../entities/NPCEntity");
const index_1 = require("../types/index");
const NPCBehaviorManager_1 = require("./npc/NPCBehaviorManager");
const NPCDialogueManager_1 = require("./npc/NPCDialogueManager");
const NPCSpawnManager_1 = require("./npc/NPCSpawnManager");
const ConfigLoader_1 = require("../config/ConfigLoader");
class NPCSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        // Core management
        this.npcs = new Map();
        this.npcDefinitions = new Map();
        this.visualSystem = null;
        // Configuration
        this.INTERACTION_RANGE = 3;
        // Add counter for unique IDs
        this.npcIdCounter = 0;
        // Logger
        this.logger = createLogger('NPCSystem');
        this.behaviorManager = new NPCBehaviorManager_1.NPCBehaviorManager(world);
        this.dialogueManager = new NPCDialogueManager_1.NPCDialogueManager(world);
        this.spawnManager = new NPCSpawnManager_1.NPCSpawnManager(world, this);
    }
    /**
     * Initialize the system
     */
    async init(_options) {
        this.console.info('Initializing...');
        // Get visual representation system
        this.visualSystem = this.world.getSystem?.('visualRepresentation');
        // Initialize sub-managers
        this.behaviorManager.init();
        // Load NPC definitions from config
        const configLoader = ConfigLoader_1.ConfigLoader.getInstance();
        if (!configLoader.isConfigLoaded()) {
            await configLoader.loadAllConfigurations();
        }
        // Register all NPCs from config
        const npcConfigs = configLoader.getAllNPCs();
        this.console.debug(`Found ${Object.keys(npcConfigs).length} NPC configs`);
        for (const config of Object.values(npcConfigs)) {
            const definition = this.convertConfigToDefinition(config);
            this.registerNPCDefinition(definition);
            this.console.debug(`Registered NPC: ${definition.name} (ID: ${definition.id})`);
        }
        this.console.info(`Loaded ${this.npcDefinitions.size} NPC definitions from config`);
        // Listen for entity events
        this.world.events.on('entity:created', (event) => {
            const entity = this.getEntity(event.entityId);
            if (entity && this.isNPCEntity(entity)) {
                this.onNPCCreated(entity);
            }
        });
        this.world.events.on('entity:destroyed', (event) => {
            this.npcs.delete(event.entityId);
        });
        // Listen for combat events
        this.world.events.on('entity:death', (event) => {
            const npc = this.npcs.get(event.entityId);
            if (npc) {
                this.onNPCDeath(npc, event.killerId);
            }
        });
    }
    /**
     * Fixed update for AI and behavior
     */
    fixedUpdate(_delta) {
        // Update NPC behaviors
        for (const [_npcId, npc] of this.npcs) {
            this.behaviorManager.updateBehavior(npc, _delta);
        }
        // Update spawn points
        this.spawnManager.update(_delta);
    }
    /**
     * Regular update for animations and visuals
     */
    update(_delta) {
        // Update dialogue sessions
        this.dialogueManager.update(_delta);
    }
    /**
     * Convert NPCConfig to NPCDefinition
     */
    convertConfigToDefinition(config) {
        // Map type string to NPCType enum
        const npcTypeMap = {
            monster: index_1.NPCType.MONSTER,
            guard: index_1.NPCType.GUARD,
            quest_giver: index_1.NPCType.QUEST_GIVER,
            shop: index_1.NPCType.SHOPKEEPER,
            shopkeeper: index_1.NPCType.SHOPKEEPER,
            banker: index_1.NPCType.BANKER,
            boss: index_1.NPCType.BOSS,
            animal: index_1.NPCType.ANIMAL,
            citizen: index_1.NPCType.CITIZEN,
        };
        // Map behavior string to NPCBehavior enum
        const behaviorMap = {
            aggressive: index_1.NPCBehavior.AGGRESSIVE,
            passive: index_1.NPCBehavior.PASSIVE,
            defensive: index_1.NPCBehavior.DEFENSIVE,
            friendly: index_1.NPCBehavior.FRIENDLY,
            shop: index_1.NPCBehavior.SHOP,
            quest: index_1.NPCBehavior.QUEST,
            banker: index_1.NPCBehavior.BANKER,
            wander: index_1.NPCBehavior.WANDER,
            patrol: index_1.NPCBehavior.PATROL,
            follow: index_1.NPCBehavior.FOLLOW,
        };
        return {
            id: config.id,
            name: config.name,
            examine: config.examine || `A ${config.name}.`,
            npcType: npcTypeMap[config.type?.toLowerCase()] || index_1.NPCType.CITIZEN,
            behavior: behaviorMap[config.behavior?.toLowerCase()] || index_1.NPCBehavior.PASSIVE,
            faction: config.faction || 'neutral',
            level: config.level,
            combatLevel: config.combatLevel,
            maxHitpoints: config.stats?.hitpoints,
            attackStyle: index_1.AttackType.MELEE, // Default to melee
            aggressionLevel: config.aggressionLevel,
            aggressionRange: config.aggressionRange,
            combat: config.stats
                ? {
                    attackBonus: config.stats.attack || 0,
                    strengthBonus: config.stats.strength || 0,
                    defenseBonus: config.stats.defence || 0,
                    maxHit: Math.floor((config.stats.strength || 0) / 4) + 1,
                    attackSpeed: config.attackSpeed || 4000,
                }
                : undefined,
            lootTable: config.dropTable,
            respawnTime: 60000, // Default 1 minute
            wanderRadius: config.wanderRadius,
            moveSpeed: config.stats?.speed || 1,
            dialogue: config.dialogue ? { text: config.dialogue } : undefined,
        };
    }
    /**
     * Register an NPC definition
     */
    registerNPCDefinition(definition) {
        this.console.debug(`Registering NPC definition: ${definition.id} - ${definition.name}`);
        this.npcDefinitions.set(definition.id, definition);
    }
    /**
     * Spawn an NPC at a position
     */
    spawnNPC(definitionId, position, spawnerId) {
        // Check if the system is properly initialized
        if (this.npcDefinitions.size === 0) {
            // Try to initialize the config loader if not already done
            const configLoader = ConfigLoader_1.ConfigLoader.getInstance();
            try {
                if (!configLoader.isConfigLoaded()) {
                    configLoader.enableTestMode(); // For tests
                }
                const npcConfigs = configLoader.getAllNPCs();
                for (const config of Object.values(npcConfigs)) {
                    const definition = this.convertConfigToDefinition(config);
                    this.registerNPCDefinition(definition);
                }
                this.console.debug(`Loaded ${this.npcDefinitions.size} NPC definitions on-demand`);
            }
            catch (error) {
                this.console.error(`Failed to load NPC definitions: ${error}`);
                return null;
            }
        }
        const definition = this.npcDefinitions.get(definitionId);
        if (!definition) {
            this.console.warn(`[NPCSystem] Unknown NPC definition: ${definitionId}. Available definitions: ${Array.from(this.npcDefinitions.keys()).join(', ')}`);
            // Additional debugging information
            this.console.debug(`[NPCSystem] Total loaded definitions: ${this.npcDefinitions.size}`);
            this.console.debug(`[NPCSystem] Config loader status: ${ConfigLoader_1.ConfigLoader.getInstance().isConfigLoaded() ? 'loaded' : 'not loaded'}`);
            return null;
        }
        // Create NPC entity
        const npc = this.createNPCEntity(definition, position);
        // Set spawner reference
        if (spawnerId) {
            npc.spawnerId = spawnerId;
        }
        // Add to world
        this.addNPCToWorld(npc);
        return npc;
    }
    /**
     * Despawn an NPC
     */
    despawnNPC(npcId) {
        const npc = this.npcs.get(npcId);
        if (!npc) {
            return;
        }
        // Clean up
        this.npcs.delete(npcId);
        // Emit event
        this.world.events.emit('npc:despawned', {
            npcId,
            position: npc.position,
        });
        // Remove from world
        this.world.entities.destroyEntity(npcId);
    }
    /**
     * Handle player interaction with NPC
     */
    interactWithNPC(playerId, npcId) {
        const player = this.getEntity(playerId);
        const npc = this.npcs.get(npcId);
        if (!player || !npc) {
            return;
        }
        // Check distance
        const playerPos = this.getEntityPosition(player);
        const npcPos = this.getEntityPosition(npc);
        if (!playerPos || !npcPos) {
            return;
        }
        const distance = this.getDistance(playerPos, npcPos);
        if (distance > this.INTERACTION_RANGE) {
            this.sendMessage(playerId, "You're too far away.");
            return;
        }
        // Check if NPC is in combat
        const npcCombat = npc.getComponent('combat');
        if (npcCombat?.inCombat && npc.npcType !== index_1.NPCType.BOSS) {
            this.sendMessage(playerId, 'The NPC is busy fighting!');
            return;
        }
        // Handle based on NPC type
        switch (npc.npcType) {
            case index_1.NPCType.QUEST_GIVER:
                this.handleQuestGiverInteraction(playerId, npc);
                break;
            case index_1.NPCType.SHOPKEEPER:
                this.handleShopInteraction(playerId, npc);
                break;
            case index_1.NPCType.BANKER:
                this.handleBankerInteraction(playerId, npc);
                break;
            case index_1.NPCType.SKILL_MASTER:
                this.handleSkillMasterInteraction(playerId, npc);
                break;
            default:
                this.handleGenericInteraction(playerId, npc);
        }
        // Update last interaction time
        npc.lastInteraction = Date.now();
    }
    /**
     * Get NPC by ID
     */
    getNPC(npcId) {
        return this.npcs.get(npcId);
    }
    /**
     * Get all NPCs
     */
    getAllNPCs() {
        return Array.from(this.npcs.values());
    }
    /**
     * Get NPCs in range of a position
     */
    getNPCsInRange(position, range) {
        const npcsInRange = [];
        for (const npc of this.npcs.values()) {
            const distance = this.getDistance(position, npc.position);
            if (distance <= range) {
                npcsInRange.push(npc);
            }
        }
        return npcsInRange;
    }
    /**
     * Create NPC entity from definition
     */
    createNPCEntity(definition, position) {
        const npc = new NPCEntity_1.NPCEntity(this.world, `npc_${definition.id}_${Date.now()}_${this.npcIdCounter++}`, {
            position,
            definition,
        });
        // Add NPC component
        const npcComponent = {
            type: 'npc',
            entity: npc, // Will be set by addComponent
            data: {}, // Will be set by addComponent
            npcId: definition.id,
            name: definition.name,
            examine: definition.examine,
            npcType: definition.npcType,
            behavior: definition.behavior,
            faction: definition.faction || 'neutral',
            state: index_1.NPCState.IDLE,
            level: definition.level || 1,
            // Combat stats
            combatLevel: definition.combatLevel || 1,
            maxHitpoints: definition.maxHitpoints || 10,
            currentHitpoints: definition.maxHitpoints || 10,
            attackStyle: definition.attackStyle || index_1.AttackType.MELEE,
            aggressionLevel: definition.aggressionLevel || 0,
            aggressionRange: definition.aggressionRange || 5,
            // Combat abilities
            attackBonus: definition.combat?.attackBonus || 0,
            strengthBonus: definition.combat?.strengthBonus || 0,
            defenseBonus: definition.combat?.defenseBonus || 0,
            maxHit: definition.combat?.maxHit || 1,
            attackSpeed: definition.combat?.attackSpeed || 4,
            // Spawning
            respawnTime: definition.respawnTime || 60000,
            wanderRadius: definition.wanderRadius || 5,
            spawnPoint: { ...position },
            // Interaction
            lootTable: definition.lootTable,
            dialogue: definition.dialogue,
            shop: definition.shop,
            questGiver: definition.questGiver ? true : false,
            // State
            currentTarget: null,
            lastInteraction: 0,
        };
        npc.addComponent('npc', npcComponent);
        // Add stats component if combat NPC
        if (this.isCombatNPC(definition)) {
            const stats = {
                type: 'stats',
                entity: npc, // Will be set by addComponent
                data: {}, // Will be set by addComponent
                hitpoints: {
                    current: definition.maxHitpoints || 10,
                    max: definition.maxHitpoints || 10,
                    level: definition.combatLevel || 1,
                    xp: 0,
                },
                attack: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
                strength: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
                defense: { level: definition.combatLevel || 1, xp: 0, bonus: 0 },
                ranged: { level: 1, xp: 0, bonus: 0 },
                magic: { level: 1, xp: 0, bonus: 0 },
                prayer: { level: 1, xp: 0, points: 0, maxPoints: 0 },
                combatBonuses: {
                    attackStab: 0,
                    attackSlash: 0,
                    attackCrush: 0,
                    attackMagic: 0,
                    attackRanged: 0,
                    defenseStab: 0,
                    defenseSlash: 0,
                    defenseCrush: 0,
                    defenseMagic: 0,
                    defenseRanged: 0,
                    meleeStrength: definition.combat?.strengthBonus || 0,
                    rangedStrength: 0,
                    magicDamage: 0,
                    prayerBonus: 0,
                },
                combatLevel: definition.combatLevel || 1,
                totalLevel: definition.combatLevel || 1,
            };
            npc.addComponent('stats', stats);
            // Add combat component for combat NPCs
            const combat = {
                type: 'combat',
                entity: npc, // Will be set by addComponent
                data: {}, // Will be set by addComponent
                inCombat: false,
                target: null,
                lastAttackTime: 0,
                attackSpeed: definition.combat?.attackSpeed || 4,
                combatStyle: index_1.CombatStyle.ACCURATE,
                autoRetaliate: definition.behavior === index_1.NPCBehavior.AGGRESSIVE || definition.behavior === index_1.NPCBehavior.DEFENSIVE,
                hitSplatQueue: [],
                animationQueue: [],
                specialAttackEnergy: 100,
                specialAttackActive: false,
                protectionPrayers: {
                    melee: false,
                    ranged: false,
                    magic: false,
                },
            };
            npc.addComponent('combat', combat);
        }
        // Add movement component
        const movement = {
            type: 'movement',
            entity: npc, // Will be set by addComponent
            data: {}, // Will be set by addComponent
            position: { ...position },
            destination: null,
            targetPosition: null,
            path: [],
            moveSpeed: definition.moveSpeed || 1,
            isMoving: false,
            canMove: true,
            runEnergy: 100,
            isRunning: false,
            currentSpeed: 0,
            facingDirection: 0,
            pathfindingFlags: 0,
            lastMoveTime: 0,
            teleportDestination: null,
            teleportTime: 0,
            teleportAnimation: '',
        };
        npc.addComponent('movement', movement);
        return npc;
    }
    /**
     * Add NPC to world
     */
    addNPCToWorld(npc) {
        this.npcs.set(npc.id, npc);
        this.world.entities.items.set(npc.id, npc);
        // Create visual representation
        if (this.visualSystem) {
            const npcComponent = npc.getComponent('npc');
            if (npcComponent) {
                // Use the NPC name to determine visual type
                this.visualSystem.createVisual(npc, npcComponent.name.toLowerCase());
            }
        }
        // Emit event
        this.world.events.emit('npc:spawned', {
            npcId: npc.id,
            definitionId: npc.getComponent('npc')?.npcId,
            position: npc.position,
        });
    }
    /**
     * Handle NPC creation
     */
    onNPCCreated(npc) {
        this.npcs.set(npc.id, npc);
    }
    /**
     * Handle NPC death
     */
    onNPCDeath(npc, killerId) {
        const npcComponent = npc.getComponent('npc');
        if (!npcComponent) {
            return;
        }
        // Drop loot
        if (npcComponent.lootTable && killerId) {
            this.world.events.emit('npc:death:loot', {
                npcId: npc.id,
                killerId,
                lootTable: npcComponent.lootTable,
                position: npc.position,
            });
        }
        // Schedule respawn
        if (npcComponent.respawnTime > 0 && npc.spawnerId) {
            this.spawnManager.scheduleRespawn(npc.spawnerId, npcComponent.npcId, npcComponent.respawnTime);
        }
        // Remove from active NPCs
        this.npcs.delete(npc.id);
    }
    /**
     * Handle quest giver interaction
     */
    handleQuestGiverInteraction(playerId, npc) {
        this.dialogueManager.startDialogue(playerId, npc.id);
        this.world.events.emit('quest:interact', {
            playerId,
            npcId: npc.id,
        });
    }
    /**
     * Handle shop interaction
     */
    handleShopInteraction(playerId, npc) {
        const npcComponent = npc.getComponent('npc');
        if (!npcComponent?.shop) {
            return;
        }
        this.world.events.emit('shop:open', {
            playerId,
            npcId: npc.id,
            shop: npcComponent.shop,
        });
    }
    /**
     * Handle banker interaction
     */
    handleBankerInteraction(playerId, npc) {
        this.world.events.emit('bank:open', {
            playerId,
            npcId: npc.id,
        });
    }
    /**
     * Handle skill master interaction
     */
    handleSkillMasterInteraction(playerId, npc) {
        this.dialogueManager.startDialogue(playerId, npc.id);
    }
    /**
     * Handle generic interaction
     */
    handleGenericInteraction(playerId, npc) {
        const npcComponent = npc.getComponent('npc');
        if (!npcComponent) {
            return;
        }
        // Show examine text or start dialogue
        if (npcComponent.dialogue) {
            this.dialogueManager.startDialogue(playerId, npc.id);
        }
        else {
            this.sendMessage(playerId, npcComponent.examine);
        }
    }
    /**
     * Check if entity is an NPC
     */
    isNPCEntity(entity) {
        return entity.hasComponent?.('npc') || entity.getComponent?.('npc') !== null;
    }
    /**
     * Check if NPC is combat-capable
     */
    isCombatNPC(definition) {
        return (definition.npcType === index_1.NPCType.MONSTER ||
            definition.npcType === index_1.NPCType.BOSS ||
            definition.npcType === index_1.NPCType.GUARD);
    }
    /**
     * Get entity from world
     */
    getEntity(entityId) {
        if (this.world.entities.items instanceof Map) {
            const entity = this.world.entities.items.get(entityId);
            if (!entity || typeof entity.getComponent !== 'function') {
                return undefined;
            }
            return entity;
        }
        const entity = this.world.entities.get?.(entityId);
        if (!entity || typeof entity.getComponent !== 'function') {
            return undefined;
        }
        return entity;
    }
    /**
     * Calculate distance between two positions
     */
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * Send message to player
     */
    sendMessage(playerId, message) {
        this.world.events.emit('chat:system', {
            targetId: playerId,
            message,
        });
    }
    /**
     * Get entity position
     */
    getEntityPosition(entity) {
        // Try different ways to get position
        if (entity.position && typeof entity.position === 'object') {
            return entity.position;
        }
        if (entity.data?.position) {
            // If position is an array, convert to Vector3
            if (Array.isArray(entity.data.position)) {
                return {
                    x: entity.data.position[0] || 0,
                    y: entity.data.position[1] || 0,
                    z: entity.data.position[2] || 0,
                };
            }
            return entity.data.position;
        }
        return null;
    }
}
exports.NPCSystem = NPCSystem;
//# sourceMappingURL=NPCSystem.js.map