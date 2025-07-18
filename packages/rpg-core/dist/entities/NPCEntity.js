"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPCEntity = void 0;
const RPGEntity_1 = require("./RPGEntity");
/**
 * NPC Entity class for all non-player characters
 */
class NPCEntity extends RPGEntity_1.RPGEntity {
    constructor(world, id, data) {
        super(world, 'npc', {
            id,
            position: data.position,
            definition: data.definition,
        });
        this.lastInteraction = 0;
        this.currentTarget = null;
        this.deathTime = 0;
        this.aiState = 'idle';
        this.stateTimer = 0;
        this.spawnPoint = { ...data.position };
    }
    /**
     * Get the NPC component
     */
    getNPCComponent() {
        return this.getComponent('npc');
    }
    /**
     * Update position
     */
    setPosition(position) {
        this.position = { ...position };
        // Update movement component if exists
        const movement = this.getComponent('movement');
        if (movement) {
            movement.position = { ...position };
        }
        // Update world position
        this.data.position = position;
    }
    /**
     * Check if NPC is alive
     */
    isAlive() {
        const npc = this.getNPCComponent();
        return npc ? npc.currentHitpoints > 0 : false;
    }
    /**
     * Take damage
     */
    takeDamage(damage) {
        const npc = this.getNPCComponent();
        if (!npc) {
            return;
        }
        npc.currentHitpoints = Math.max(0, npc.currentHitpoints - damage);
        if (npc.currentHitpoints <= 0) {
            this.die();
        }
    }
    /**
     * Handle death
     */
    die() {
        const npc = this.getNPCComponent();
        if (!npc) {
            return;
        }
        // Update state
        npc.state = 'dead'; // NPCState.DEAD
        // Emit death event
        this.world.events.emit('entity:death', {
            entityId: this.id,
            entityType: 'npc',
            position: this.position,
        });
    }
    /**
     * Respawn the NPC
     */
    respawn() {
        const npc = this.getNPCComponent();
        if (!npc) {
            return;
        }
        // Reset health
        npc.currentHitpoints = npc.maxHitpoints;
        npc.state = 'idle'; // NPCState.IDLE
        // Reset position to spawn point
        if (npc.spawnPoint) {
            this.setPosition(npc.spawnPoint);
        }
        // Clear target
        npc.currentTarget = null;
    }
    /**
     * Check if player is in interaction range
     */
    isInInteractionRange(playerPosition, range = 3) {
        const dx = this.position.x - playerPosition.x;
        const dy = this.position.y - playerPosition.y;
        const dz = this.position.z - playerPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return distance <= range;
    }
}
exports.NPCEntity = NPCEntity;
//# sourceMappingURL=NPCEntity.js.map