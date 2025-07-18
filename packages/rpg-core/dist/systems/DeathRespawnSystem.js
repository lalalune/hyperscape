"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeathRespawnSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
const index_1 = require("../types/index");
class DeathRespawnSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.gravestones = new Map();
        this.deathTimers = new Map();
        this.gravestoneEntities = new Map();
        // Initialize configuration
        this.config = {
            defaultRespawnPoint: { x: 3200, y: 0, z: 3200 }, // Lumbridge
            respawnPoints: new Map([
                [
                    'lumbridge',
                    {
                        id: 'lumbridge',
                        name: 'Lumbridge',
                        position: { x: 3200, y: 0, z: 3200 },
                        isDefault: true,
                    },
                ],
                [
                    'edgeville',
                    {
                        id: 'edgeville',
                        name: 'Edgeville',
                        position: { x: 3090, y: 0, z: 3490 },
                        requirements: { questId: 'death_to_the_dorgeshuun' },
                    },
                ],
                [
                    'falador',
                    {
                        id: 'falador',
                        name: 'Falador',
                        position: { x: 2960, y: 0, z: 3380 },
                    },
                ],
                [
                    'varrock',
                    {
                        id: 'varrock',
                        name: 'Varrock',
                        position: { x: 3210, y: 0, z: 3424 },
                    },
                ],
                [
                    'camelot',
                    {
                        id: 'camelot',
                        name: 'Camelot',
                        position: { x: 2757, y: 0, z: 3477 },
                        requirements: { questId: 'king_arthurs_realm' },
                    },
                ],
            ]),
            itemsKeptOnDeath: 3,
            protectItemPrayer: true,
            skullItemsKept: 0,
            gravestoneEnabled: true,
            gravestoneBaseDuration: 5 * 60 * 1000, // 5 minutes
            gravestoneTierMultipliers: new Map([
                [index_1.GravestoneTier.WOODEN, 1],
                [index_1.GravestoneTier.STONE, 2],
                [index_1.GravestoneTier.ORNATE, 3],
                [index_1.GravestoneTier.ANGEL, 4],
                [index_1.GravestoneTier.MYSTIC, 6],
            ]),
            safeZones: [
                {
                    id: 'lumbridge',
                    name: 'Lumbridge',
                    bounds: {
                        min: { x: 3150, y: 0, z: 3150 },
                        max: { x: 3250, y: 100, z: 3250 },
                    },
                    allowPvP: false,
                },
                {
                    id: 'edgeville_bank',
                    name: 'Edgeville Bank',
                    bounds: {
                        min: { x: 3090, y: 0, z: 3488 },
                        max: { x: 3098, y: 10, z: 3499 },
                    },
                    allowPvP: false,
                },
            ],
            freeReclaimThreshold: 100000, // 100k GP
            reclaimFeePercentage: 5, // 5% of item value
        };
    }
    /**
     * Initialize the system
     */
    async init(_options) {
        console.log('[DeathRespawnSystem] Initializing...');
        // Listen for death events
        this.world.events.on('entity:death', this.handleDeath.bind(this));
        // Listen for respawn requests
        this.world.events.on('player:respawn', this.handleRespawnRequest.bind(this));
        // Listen for gravestone interactions
        this.world.events.on('gravestone:interact', this.handleGravestoneInteraction.bind(this));
        // Listen for gravestone blessing
        this.world.events.on('gravestone:bless', this.handleGravestoneBless.bind(this));
    }
    /**
     * Handle entity death
     */
    handleDeath(event) {
        const entity = this.world.entities.get(event.entityId);
        if (!entity) {
            return;
        }
        // Handle based on entity type
        if (entity.type === 'player') {
            this.handlePlayerDeath(entity, event.killerId);
        }
        else if (entity.type === 'npc') {
            this.handleNPCDeath(entity, event.killerId);
        }
    }
    /**
     * Handle player death
     */
    handlePlayerDeath(player, killerId) {
        const inventory = player.getComponent('inventory');
        const movement = player.getComponent('movement');
        const combat = player.getComponent('combat');
        const stats = player.getComponent('stats');
        if (!inventory || !movement || !stats) {
            return;
        }
        // Access position from the component's data structure
        const position = movement.data?.position;
        if (!position) {
            return;
        }
        // Create or update death component
        let death = player.getComponent('death');
        if (!death) {
            // The component system will wrap this in a data property automatically
            death = {
                type: 'death',
                isDead: true,
                deathTime: Date.now(),
                deathLocation: { ...position },
                killer: killerId || null,
                gravestoneId: null,
                gravestoneTimer: 0,
                respawnPoint: null,
                respawnTimer: 5000, // 5 seconds
                itemsKeptOnDeath: [],
                itemsLostOnDeath: [],
                deathCount: 1,
                lastDeathTime: Date.now(),
            };
            player.addComponent('death', death);
        }
        else {
            // Access the data that was wrapped by the component system
            const deathData = death.data;
            if (deathData) {
                deathData.isDead = true;
            }
        }
        // Get the death component again to access wrapped data
        const currentDeath = player.getComponent('death');
        let deathData = currentDeath.data;
        if (!deathData) {
            deathData = currentDeath;
        }
        deathData.deathTime = Date.now();
        deathData.deathLocation = { ...position };
        deathData.killer = killerId || null;
        deathData.deathCount = (deathData.deathCount || 0) + 1;
        deathData.lastDeathTime = Date.now();
        // Check if in safe zone
        if (this.isInSafeZone(position)) {
            // Safe death - keep all items
            const items = inventory.data?.items || inventory.items || [];
            deathData.itemsKeptOnDeath = [...items.filter((item) => item !== null)];
            deathData.itemsLostOnDeath = [];
        }
        else {
            // Calculate kept and lost items
            const isSkull = player.skullTimer && player.skullTimer > 0;
            const protectItem = false; // TODO: Add protect item prayer
            let itemsToKeep = isSkull ? this.config.skullItemsKept : this.config.itemsKeptOnDeath;
            if (protectItem && this.config.protectItemPrayer) {
                itemsToKeep += 1;
            }
            const { kept, lost } = this.calculateItemsKeptOnDeath(inventory, itemsToKeep);
            deathData.itemsKeptOnDeath = kept;
            deathData.itemsLostOnDeath = lost;
            // Create gravestone if items were lost
            if (lost.length > 0 && this.config.gravestoneEnabled) {
                const gravestone = this.createGravestone(player, lost, position);
                deathData.gravestoneId = gravestone.id;
            }
        }
        // Clear inventory except kept items
        const inventoryItems = inventory.data?.items || inventory.items;
        if (inventoryItems) {
            inventoryItems.fill(null);
            deathData.itemsKeptOnDeath.forEach((item, index) => {
                if (index < inventoryItems.length) {
                    inventoryItems[index] = item;
                }
            });
        }
        // Clear equipment
        const equipment = inventory.data?.equipment || inventory.equipment;
        if (equipment) {
            Object.keys(equipment).forEach(slot => {
                equipment[slot] = null;
            });
        }
        // Reset combat
        if (combat) {
            const combatData = combat.data || combat;
            combatData.inCombat = false;
            combatData.target = null;
        }
        // Reset skull timer on player
        if (player.skullTimer) {
            ;
            player.skullTimer = 0;
        }
        // Emit death event
        this.world.events.emit('player:died', {
            playerId: player.id,
            killerId,
            position,
            keptItems: deathData.itemsKeptOnDeath,
            lostItems: deathData.itemsLostOnDeath,
            gravestoneId: deathData.gravestoneId,
        });
        // Schedule auto-respawn (disabled for testing)
        // Uncomment the below code to enable auto-respawn:
        // Uncomment this for auto-respawn:
        // const timerId = setTimeout(() => {
        //   this.respawn(player);
        // }, (death as any).data.respawnTimer);
        // this.deathTimers.set(player.id, timerId);
    }
    /**
     * Handle NPC death
     */
    handleNPCDeath(npc, killerId) {
        // NPCs don't have gravestones, just emit event for loot system
        this.world.events.emit('npc:died', {
            npcId: npc.id,
            killerId,
            position: npc.position,
        });
    }
    /**
     * Calculate items kept on death
     */
    calculateItemsKeptOnDeath(inventory, itemsToKeep) {
        const allItems = [];
        // Collect all items from inventory and equipment - handle component data structure
        const items = inventory.data?.items || inventory.items || [];
        for (const item of items) {
            if (item) {
                allItems.push({ ...item });
            }
        }
        const equipment = inventory.data?.equipment || inventory.equipment;
        if (equipment) {
            for (const slot of Object.values(equipment)) {
                if (slot) {
                    allItems.push({ itemId: slot.id, quantity: 1 });
                }
            }
        }
        // Sort by value (descending)
        const sortedItems = allItems.sort((a, b) => {
            const valueA = this.getItemValue(a.itemId) * a.quantity;
            const valueB = this.getItemValue(b.itemId) * b.quantity;
            return valueB - valueA;
        });
        const kept = [];
        const lost = [];
        let keptStacks = 0;
        for (const item of sortedItems) {
            if (keptStacks < itemsToKeep) {
                // Keep the entire stack (this represents one "item slot")
                kept.push({ ...item });
                keptStacks += 1;
            }
            else {
                // Lose the entire stack
                lost.push({ ...item });
            }
        }
        return { kept, lost };
    }
    /**
     * Create gravestone
     */
    createGravestone(player, items, position) {
        const tier = this.getPlayerGravestoneTier(player);
        const multiplier = this.config.gravestoneTierMultipliers.get(tier) || 1;
        const duration = this.config.gravestoneBaseDuration * multiplier;
        const gravestone = {
            id: `gravestone_${player.id}_${Date.now()}`,
            ownerId: player.id,
            position: { ...position },
            items,
            createdAt: Date.now(),
            expiresAt: Date.now() + duration,
            tier,
            model: this.getGravestoneModel(tier),
            isBlessed: false,
        };
        this.gravestones.set(gravestone.id, gravestone);
        // Create gravestone entity in world
        const gravestoneEntity = {
            id: gravestone.id,
            type: 'gravestone',
            position: { ...position },
            components: new Map(),
            getComponent(type) {
                return this.components.get(type) || null;
            },
            hasComponent(type) {
                return this.components.has(type);
            },
            addComponent(type, component) {
                this.components.set(type, component);
            },
        };
        // Add visual component
        gravestoneEntity.addComponent('visual', {
            type: 'visual',
            model: gravestone.model || 'gravestone_wooden',
            scale: 1,
        });
        // Add interaction component
        gravestoneEntity.addComponent('interaction', {
            type: 'interaction',
            interactType: 'gravestone',
            ownerId: player.id,
            data: gravestone,
        });
        // Add to world
        if (this.world.entities?.items) {
            ;
            this.world.entities.items.set(gravestone.id, gravestoneEntity);
        }
        else {
            ;
            this.world.entities = new Map();
            this.world.entities.set(gravestone.id, gravestoneEntity);
        }
        this.gravestoneEntities.set(gravestone.id, gravestoneEntity);
        // Schedule expiration
        setTimeout(() => {
            this.expireGravestone(gravestone.id);
        }, duration);
        return gravestone;
    }
    /**
     * Respawn player
     */
    respawn(player, respawnPoint) {
        const death = player.getComponent('death');
        const stats = player.getComponent('stats');
        const movement = player.getComponent('movement');
        if (!death || !stats || !movement) {
            return;
        }
        // Clear death timer
        const timerId = this.deathTimers.get(player.id);
        if (timerId) {
            clearTimeout(timerId);
            this.deathTimers.delete(player.id);
        }
        // Get respawn location
        const location = this.getRespawnLocation(player, respawnPoint);
        // Restore health and prayer - handle stats component structure
        const statsData = stats.data || stats;
        if (statsData.hitpoints) {
            statsData.hitpoints.current = statsData.hitpoints.max;
        }
        if (statsData.prayer) {
            statsData.prayer.points = Math.floor(statsData.prayer.maxPoints * 0.5); // 50% prayer
        }
        // Reset death state
        const deathData = death.data;
        deathData.isDead = false;
        deathData.respawnTimer = 5000;
        movement.data.position = { ...location };
        movement.data.teleportDestination = { ...location };
        movement.data.teleportTime = Date.now();
        movement.data.teleportAnimation = 'respawn';
        // Emit respawn event
        this.world.events.emit('player:respawned', {
            playerId: player.id,
            position: location,
            gravestoneId: deathData.gravestoneId,
        });
    }
    /**
     * Handle respawn request
     */
    handleRespawnRequest(event) {
        const player = this.world.entities.get(event.playerId);
        if (!player) {
            return;
        }
        const death = player.getComponent('death');
        if (!death || !death.data?.isDead) {
            return;
        }
        this.respawn(player, event.respawnPoint);
    }
    /**
     * Get respawn location
     */
    getRespawnLocation(player, customPoint) {
        // Check for custom respawn point
        if (customPoint) {
            const point = this.config.respawnPoints.get(customPoint);
            if (point && this.canUseRespawnPoint(player, point)) {
                return { ...point.position };
            }
        }
        // Check for saved respawn point
        const death = player.getComponent('death');
        if (death?.data?.respawnPoint) {
            const point = this.config.respawnPoints.get(death.data.respawnPoint);
            if (point && this.canUseRespawnPoint(player, point)) {
                return { ...point.position };
            }
        }
        // Default respawn
        return { ...this.config.defaultRespawnPoint };
    }
    /**
     * Check if player can use respawn point
     */
    canUseRespawnPoint(player, point) {
        if (!point.requirements) {
            return true;
        }
        // Check quest requirement
        if (point.requirements.questId) {
            // TODO: Check quest completion
            return false;
        }
        // Check skill requirement
        if (point.requirements.skillLevel) {
            const stats = player.getComponent('stats');
            if (!stats) {
                return false;
            }
            const skill = stats[point.requirements.skillLevel.skill];
            if (skill && skill.level >= point.requirements.skillLevel.level) {
                return true;
            }
            return false;
        }
        return true;
    }
    /**
     * Handle gravestone interaction
     */
    handleGravestoneInteraction(event) {
        const gravestone = this.gravestones.get(event.gravestoneId);
        if (!gravestone) {
            return;
        }
        const player = this.world.entities.get(event.playerId);
        if (!player) {
            return;
        }
        // Check ownership
        if (gravestone.ownerId !== event.playerId) {
            // Check if gravestone is expired
            if (Date.now() < gravestone.expiresAt) {
                this.sendMessage(event.playerId, 'This is not your gravestone.');
                return;
            }
        }
        // Calculate reclaim fee
        const totalValue = this.calculateGravestoneValue(gravestone);
        const fee = totalValue > this.config.freeReclaimThreshold
            ? Math.floor((totalValue * this.config.reclaimFeePercentage) / 100)
            : 0;
        // Show options
        this.world.events.emit('gravestone:options', {
            playerId: event.playerId,
            gravestoneId: event.gravestoneId,
            items: gravestone.items,
            fee,
            isOwner: gravestone.ownerId === event.playerId,
        });
    }
    /**
     * Reclaim items from gravestone
     */
    reclaimItems(playerId, gravestoneId, payFee = true) {
        const gravestone = this.gravestones.get(gravestoneId);
        const player = this.world.entities.get(playerId);
        if (!gravestone || !player) {
            return false;
        }
        // Check ownership
        if (gravestone.ownerId !== playerId && Date.now() < gravestone.expiresAt) {
            return false;
        }
        // Calculate and check fee
        if (payFee && gravestone.ownerId === playerId) {
            const totalValue = this.calculateGravestoneValue(gravestone);
            const fee = totalValue > this.config.freeReclaimThreshold
                ? Math.floor((totalValue * this.config.reclaimFeePercentage) / 100)
                : 0;
            if (fee > 0) {
                const inventory = player.getComponent('inventory');
                if (!inventory) {
                    return false;
                }
                // Check if player has enough gold
                const goldAmount = this.getPlayerGold(inventory);
                if (goldAmount < fee) {
                    this.sendMessage(playerId, `You need ${fee} coins to reclaim your items.`);
                    return false;
                }
                // Remove gold
                if (!this.removePlayerGold(player, fee)) {
                    return false;
                }
            }
        }
        // Transfer items
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return false;
        }
        for (const item of gravestone.items) {
            inventorySystem.addItem(playerId, item.itemId, item.quantity);
        }
        // Remove gravestone
        this.removeGravestone(gravestoneId);
        // Update death component
        const death = player.getComponent('death');
        if (death) {
            ;
            death.data.gravestoneId = null;
        }
        this.sendMessage(playerId, 'You have reclaimed your items.');
        return true;
    }
    /**
     * Handle gravestone blessing
     */
    handleGravestoneBless(event) {
        const gravestone = this.gravestones.get(event.gravestoneId);
        if (!gravestone || gravestone.isBlessed) {
            return;
        }
        // Extend timer by 1 hour
        gravestone.expiresAt += 60 * 60 * 1000;
        gravestone.isBlessed = true;
        // Update visual
        const entity = this.gravestoneEntities.get(event.gravestoneId);
        if (entity) {
            const visual = entity.getComponent('visual');
            if (visual) {
                visual.effect = 'blessed';
            }
        }
        this.sendMessage(event.playerId, 'The gravestone has been blessed and will last longer.');
    }
    /**
     * Expire gravestone
     */
    expireGravestone(gravestoneId) {
        const gravestone = this.gravestones.get(gravestoneId);
        if (!gravestone) {
            return;
        }
        // Drop items on ground
        const lootSystem = this.world.getSystem('loot');
        if (lootSystem && gravestone.items.length > 0) {
            lootSystem.createLootPile(gravestone.position, gravestone.items, null);
        }
        // Remove gravestone
        this.removeGravestone(gravestoneId);
    }
    /**
     * Remove gravestone
     */
    removeGravestone(gravestoneId) {
        this.gravestones.delete(gravestoneId);
        const entity = this.gravestoneEntities.get(gravestoneId);
        if (entity) {
            ;
            this.world.entities?.items?.delete(gravestoneId);
            this.gravestoneEntities.delete(gravestoneId);
        }
    }
    /**
     * Check if position is in safe zone
     */
    isInSafeZone(position) {
        if (!position) {
            return false;
        }
        for (const zone of this.config.safeZones) {
            if (position.x >= zone.bounds.min.x &&
                position.x <= zone.bounds.max.x &&
                position.y >= zone.bounds.min.y &&
                position.y <= zone.bounds.max.y &&
                position.z >= zone.bounds.min.z &&
                position.z <= zone.bounds.max.z) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get player gravestone tier
     */
    getPlayerGravestoneTier(_player) {
        // TODO: Check player's unlocked gravestone tier
        // For now, return wooden
        return index_1.GravestoneTier.WOODEN;
    }
    /**
     * Get gravestone model
     */
    getGravestoneModel(tier) {
        const models = {
            [index_1.GravestoneTier.BASIC]: 'gravestone_basic',
            [index_1.GravestoneTier.WOODEN]: 'gravestone_wooden',
            [index_1.GravestoneTier.STONE]: 'gravestone_stone',
            [index_1.GravestoneTier.ORNATE]: 'gravestone_ornate',
            [index_1.GravestoneTier.ANGEL]: 'gravestone_angel',
            [index_1.GravestoneTier.MYSTIC]: 'gravestone_mystic',
            [index_1.GravestoneTier.ROYAL]: 'gravestone_royal',
        };
        return models[tier];
    }
    /**
     * Calculate gravestone value
     */
    calculateGravestoneValue(gravestone) {
        let total = 0;
        for (const item of gravestone.items) {
            total += this.getItemValue(item.itemId) * item.quantity;
        }
        return total;
    }
    /**
     * Get item value
     */
    getItemValue(itemId) {
        // Try to get from InventorySystem's item registry
        const inventorySystem = this.world.getSystem('inventory');
        if (inventorySystem && inventorySystem.itemRegistry && typeof inventorySystem.itemRegistry.getItem === 'function') {
            const item = inventorySystem.itemRegistry.getItem(itemId);
            if (item && item.value) {
                return item.value;
            }
        }
        // Fallback item values for common items
        const fallbackValues = {
            1: 15, // Bronze sword
            995: 1, // Coins
            315: 5, // Shrimps
            526: 1, // Bones
        };
        return fallbackValues[itemId] || 1;
    }
    /**
     * Get player gold amount
     */
    getPlayerGold(inventory) {
        let total = 0;
        const items = inventory.data?.items || inventory.items || [];
        for (const item of items) {
            if (item && item.itemId === 995) {
                // Coins
                total += item.quantity;
            }
        }
        return total;
    }
    /**
     * Remove gold from player
     */
    removePlayerGold(player, amount) {
        const inventorySystem = this.world.getSystem('inventory');
        if (!inventorySystem) {
            return false;
        }
        return inventorySystem.removeItem(player.id, 995, amount);
    }
    /**
     * Send message to player
     */
    sendMessage(playerId, message) {
        this.world.events.emit('chat:message', {
            playerId,
            message,
            type: 'system',
        });
    }
    /**
     * Update system
     */
    update(_delta) {
        // Check for expired gravestones
        const now = Date.now();
        for (const [id, gravestone] of this.gravestones) {
            if (now >= gravestone.expiresAt) {
                this.expireGravestone(id);
            }
        }
    }
}
exports.DeathRespawnSystem = DeathRespawnSystem;
//# sourceMappingURL=DeathRespawnSystem.js.map