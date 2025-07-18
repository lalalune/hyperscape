"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPGPublicAPI = void 0;
/**
 * Public API for interacting with the RPG plugin
 * This provides a clean interface for external code to interact with RPG systems
 */
class RPGPublicAPI {
    constructor(world, systems, worldManager) {
        this.world = world;
        this.systems = systems;
        this.worldManager = worldManager;
    }
    /**
     * Player Management
     */
    async spawnPlayer(playerId, options) {
        const spawningSystem = this.systems.get('spawning');
        if (!spawningSystem)
            throw new Error('Spawning system not initialized');
        return await spawningSystem.spawnPlayer(playerId, options);
    }
    getPlayer(playerId) {
        return this.world.entities.items.get(playerId);
    }
    movePlayer(playerId, destination) {
        const movementSystem = this.systems.get('movement');
        if (!movementSystem)
            return false;
        return movementSystem.moveEntity(playerId, destination);
    }
    /**
     * NPC Management
     */
    spawnNPC(npcType, options) {
        const npcSystem = this.systems.get('npc');
        if (!npcSystem)
            throw new Error('NPC system not initialized');
        return npcSystem.spawnNPC(npcType, options);
    }
    getNPC(npcId) {
        return this.world.entities.items.get(npcId);
    }
    /**
     * Combat
     */
    startCombat(attackerId, targetId) {
        const combatSystem = this.systems.get('combat');
        if (!combatSystem)
            return false;
        return combatSystem.startCombat(attackerId, targetId);
    }
    stopCombat(entityId) {
        const combatSystem = this.systems.get('combat');
        if (!combatSystem)
            return false;
        return combatSystem.stopCombat(entityId);
    }
    /**
     * Inventory & Items
     */
    giveItem(playerId, itemId, quantity = 1) {
        const inventorySystem = this.systems.get('inventory');
        if (!inventorySystem)
            return false;
        return inventorySystem.addItem(playerId, itemId, quantity);
    }
    removeItem(playerId, itemId, quantity = 1) {
        const inventorySystem = this.systems.get('inventory');
        if (!inventorySystem)
            return false;
        return inventorySystem.removeItem(playerId, itemId, quantity);
    }
    getInventory(playerId) {
        const inventorySystem = this.systems.get('inventory');
        if (!inventorySystem)
            return [];
        return inventorySystem.getInventory(playerId);
    }
    dropItem(position, itemId, quantity = 1, owner) {
        const lootSystem = this.systems.get('loot');
        if (!lootSystem)
            return null;
        return lootSystem.dropItem(position, itemId, quantity, owner);
    }
    /**
     * Banking
     */
    openBank(playerId) {
        const bankingSystem = this.systems.get('banking');
        if (!bankingSystem)
            return false;
        return bankingSystem.openBank(playerId);
    }
    depositItem(playerId, itemId, quantity = 1) {
        const bankingSystem = this.systems.get('banking');
        if (!bankingSystem)
            return false;
        return bankingSystem.depositItem(playerId, itemId, quantity);
    }
    withdrawItem(playerId, itemId, quantity = 1) {
        const bankingSystem = this.systems.get('banking');
        if (!bankingSystem)
            return false;
        return bankingSystem.withdrawItem(playerId, itemId, quantity);
    }
    /**
     * Skills
     */
    getSkillLevel(playerId, skillName) {
        const statsSystem = this.systems.get('stats');
        if (!statsSystem)
            return 1;
        return statsSystem.getSkillLevel(playerId, skillName);
    }
    addSkillXP(playerId, skillName, xp) {
        const statsSystem = this.systems.get('stats');
        if (!statsSystem)
            return false;
        return statsSystem.addExperience(playerId, skillName, xp);
    }
    /**
     * UI & Interaction
     */
    showInterface(playerId, interfaceId) {
        const uiSystem = this.systems.get('ui');
        if (!uiSystem)
            return false;
        uiSystem.showInterface(playerId, interfaceId);
        return true;
    }
    hideInterface(playerId, interfaceId) {
        const uiSystem = this.systems.get('ui');
        if (!uiSystem)
            return false;
        uiSystem.hideInterface(playerId, interfaceId);
        return true;
    }
    sendMessage(playerId, message, type = 'game') {
        const uiSystem = this.systems.get('ui');
        if (!uiSystem)
            return;
        uiSystem.addChatMessage({
            type,
            text: message,
            timestamp: Date.now()
        });
    }
    /**
     * World & Environment
     */
    getWorldTime() {
        return this.worldManager.getWorldTime();
    }
    isInSafeZone(position) {
        return this.worldManager.isInSafeZone(position);
    }
    getRegionAt(position) {
        return this.worldManager.getRegionAt(position);
    }
    /**
     * Testing & Debug
     */
    getEntityCount() {
        return this.world.entities.items.size;
    }
    getAllEntities() {
        return this.world.entities.items;
    }
    getSystem(systemName) {
        return this.systems.get(systemName);
    }
    /**
     * Events
     */
    on(event, handler) {
        this.world.events.on(event, handler);
    }
    off(event, handler) {
        this.world.events.off(event, handler);
    }
    emit(event, data) {
        this.world.events.emit(event, data);
    }
}
exports.RPGPublicAPI = RPGPublicAPI;
//# sourceMappingURL=RPGPublicAPI.js.map