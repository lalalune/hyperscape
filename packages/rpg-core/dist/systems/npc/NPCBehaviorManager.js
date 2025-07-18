"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPCBehaviorManager = void 0;
const types_1 = require("../types");
class NPCBehaviorManager {
    constructor(world) {
        this.movementSystem = null;
        // Behavior update intervals
        this.BEHAVIOR_UPDATE_INTERVAL = 500; // 500ms
        this.lastBehaviorUpdate = new Map();
        this.world = world;
        // Note: Don't access systems during construction - they may not be initialized yet
    }
    /**
     * Initialize the behavior manager - called after all systems are ready
     */
    init() {
        // Now safely get the movement system
        this.movementSystem = this.world.movement || {
            moveEntity: (id, pos) => {
                // Fallback implementation
                const entity = this.world.entities.get?.(id);
                if (entity) {
                    entity.position = pos;
                }
            },
        };
    }
    /**
     * Update NPC behavior
     */
    updateBehavior(npc, _delta) {
        // Ensure we're initialized
        if (!this.movementSystem) {
            this.init();
        }
        const npcComponent = npc.getComponent('npc');
        if (!npcComponent) {
            return;
        }
        // Check if we should update behavior this frame
        const lastUpdate = this.lastBehaviorUpdate.get(npc.id) || 0;
        const now = Date.now();
        if (now - lastUpdate < this.BEHAVIOR_UPDATE_INTERVAL) {
            return;
        }
        this.lastBehaviorUpdate.set(npc.id, now);
        // Update based on behavior type
        switch (npcComponent.behavior) {
            case types_1.NPCBehavior.AGGRESSIVE:
                this.updateAggressiveBehavior(npc, npcComponent);
                break;
            case types_1.NPCBehavior.DEFENSIVE:
                this.updateDefensiveBehavior(npc, npcComponent);
                break;
            case types_1.NPCBehavior.PASSIVE:
                this.updatePassiveBehavior(npc, npcComponent);
                break;
            case types_1.NPCBehavior.FRIENDLY:
                this.updateFriendlyBehavior(npc, npcComponent);
                break;
            case types_1.NPCBehavior.PATROL:
                this.updatePatrolBehavior(npc, npcComponent);
                break;
            case types_1.NPCBehavior.WANDER:
                this.updateWanderBehavior(npc, npcComponent);
                break;
        }
        // Update movement if needed
        this.updateMovement(npc, npcComponent);
    }
    /**
     * Aggressive behavior - attacks players on sight
     */
    updateAggressiveBehavior(npc, npcComponent) {
        // Check current state
        if (npcComponent.state === types_1.NPCState.COMBAT) {
            // Already in combat, check if target is still valid
            if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
                this.findNewTarget(npc, npcComponent);
            }
            return;
        }
        // Look for players in aggression range
        const npcPos = this.getEntityPosition(npc);
        if (!npcPos) {
            return;
        }
        const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggressionRange);
        for (const player of nearbyPlayers) {
            // Check if we can attack this player
            if (this.canAttackPlayer(npc, player)) {
                const playerId = player.id;
                this.startCombat(npc, npcComponent, playerId);
                break;
            }
        }
        // If no targets, wander
        if (npcComponent.state === types_1.NPCState.IDLE) {
            this.startWandering(npc, npcComponent);
        }
    }
    /**
     * Defensive behavior - only attacks when attacked
     */
    updateDefensiveBehavior(npc, npcComponent) {
        // Check if in combat
        if (npcComponent.state === types_1.NPCState.COMBAT) {
            // Validate target
            if (!this.isValidTarget(npc, npcComponent.currentTarget)) {
                // Return to idle
                npcComponent.state = types_1.NPCState.IDLE;
                npcComponent.currentTarget = null;
            }
            return;
        }
        // Return to spawn point if too far
        const npcPos = this.getEntityPosition(npc);
        if (npcPos && this.getDistance(npcPos, npcComponent.spawnPoint) > npcComponent.wanderRadius * 2) {
            this.moveToPosition(npc, npcComponent.spawnPoint);
        }
    }
    /**
     * Passive behavior - never attacks
     */
    updatePassiveBehavior(npc, npcComponent) {
        // If being attacked, flee
        const combat = npc.getComponent('combat');
        if (combat?.inCombat) {
            this.flee(npc, npcComponent);
            return;
        }
        // Wander peacefully
        if (npcComponent.state === types_1.NPCState.IDLE) {
            this.startWandering(npc, npcComponent);
        }
    }
    /**
     * Friendly behavior - interactable NPCs
     */
    updateFriendlyBehavior(npc, _npcComponent) {
        // Face nearby players
        const npcPos = this.getEntityPosition(npc);
        if (!npcPos) {
            return;
        }
        const nearbyPlayers = this.getPlayersInRange(npcPos, 5);
        if (nearbyPlayers.length > 0) {
            // Face the closest player
            const closest = this.getClosestPlayer(npcPos, nearbyPlayers);
            if (closest) {
                const closestPos = this.getEntityPosition(closest);
                if (closestPos) {
                    this.faceEntity(npc, { position: closestPos });
                }
            }
        }
    }
    /**
     * Patrol behavior - follows waypoints
     */
    updatePatrolBehavior(npc, npcComponent) {
        this.executePatrol(npc, npcComponent);
    }
    /**
     * Wander behavior - random movement
     */
    updateWanderBehavior(npc, npcComponent) {
        const movement = npc.getComponent('movement');
        if (!movement) {
            return;
        }
        // Check if we need a new destination
        if (!movement.destination || this.hasReachedDestination(npc, movement)) {
            // Pick random point within wander radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * npcComponent.wanderRadius;
            const newDestination = {
                x: npcComponent.spawnPoint.x + Math.cos(angle) * distance,
                y: npcComponent.spawnPoint.y,
                z: npcComponent.spawnPoint.z + Math.sin(angle) * distance,
            };
            movement.destination = newDestination;
            npcComponent.state = types_1.NPCState.WANDERING;
        }
    }
    /**
     * Update movement towards destination
     */
    updateMovement(npc, npcComponent) {
        const movement = npc.getComponent('movement');
        if (!movement || !movement.destination) {
            return;
        }
        const npcPos = this.getEntityPosition(npc);
        if (!npcPos) {
            return;
        }
        // Calculate direction
        const dx = movement.destination.x - npcPos.x;
        const dz = movement.destination.z - npcPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        // Check if reached destination
        if (distance < 0.5) {
            movement.destination = null;
            movement.isMoving = false;
            if (npcComponent.state === types_1.NPCState.WANDERING) {
                npcComponent.state = types_1.NPCState.IDLE;
            }
            return;
        }
        // Move towards destination using movement system if available
        if (this.movementSystem && typeof this.movementSystem.moveEntity === 'function') {
            this.movementSystem.moveEntity(npc.id, movement.destination);
        }
        else {
            // Fallback direct movement
            const speed = movement.moveSpeed * 0.016; // Convert to per-frame
            const moveX = (dx / distance) * speed;
            const moveZ = (dz / distance) * speed;
            const newPosition = {
                x: npcPos.x + moveX,
                y: npcPos.y,
                z: npcPos.z + moveZ,
            };
            // Update position
            npc.position = newPosition;
            movement.position = newPosition;
        }
        movement.isMoving = true;
    }
    /**
     * Start combat with a target
     */
    startCombat(npc, npcComponent, targetId) {
        npcComponent.currentTarget = targetId;
        npcComponent.state = types_1.NPCState.COMBAT;
        // Emit combat start event
        this.world.events.emit('combat:start', {
            attackerId: npc.id,
            targetId,
        });
    }
    /**
     * Find a new target
     */
    findNewTarget(npc, npcComponent) {
        const npcPos = this.getEntityPosition(npc);
        if (!npcPos) {
            return;
        }
        const nearbyPlayers = this.getPlayersInRange(npcPos, npcComponent.aggressionRange);
        for (const player of nearbyPlayers) {
            if (this.canAttackPlayer(npc, player)) {
                npcComponent.currentTarget = player.id;
                return;
            }
        }
        // No valid targets
        npcComponent.currentTarget = null;
        npcComponent.state = types_1.NPCState.IDLE;
    }
    /**
     * Make NPC flee from danger
     */
    flee(npc, npcComponent) {
        const combat = npc.getComponent('combat');
        if (!combat || !combat.target) {
            return;
        }
        const attacker = this.getEntity(combat.target);
        if (!attacker) {
            return;
        }
        const npcPos = this.getEntityPosition(npc);
        const attackerPos = this.getEntityPosition(attacker);
        if (!npcPos || !attackerPos) {
            return;
        }
        // Calculate flee direction (opposite of attacker)
        const dx = npcPos.x - attackerPos.x;
        const dz = npcPos.z - attackerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance === 0) {
            return;
        }
        // Flee to a point away from attacker
        const fleeDistance = 10;
        const fleePoint = {
            x: npcPos.x + (dx / distance) * fleeDistance,
            y: npcPos.y,
            z: npcPos.z + (dz / distance) * fleeDistance,
        };
        this.moveToPosition(npc, fleePoint);
        npcComponent.state = types_1.NPCState.FLEEING;
    }
    /**
     * Move to a specific position
     */
    moveToPosition(npc, position) {
        const movement = npc.getComponent('movement');
        if (!movement) {
            return;
        }
        movement.destination = { ...position };
        movement.isMoving = true;
    }
    /**
     * Make NPC face another entity
     */
    faceEntity(npc, target) {
        const npcPos = this.getEntityPosition(npc);
        if (!npcPos) {
            return;
        }
        // Calculate direction to target
        const dx = target.position.x - npcPos.x;
        const dz = target.position.z - npcPos.z;
        // Calculate rotation and apply it
        const angle = Math.atan2(dz, dx);
        // Apply rotation to NPC
        const movement = npc.getComponent('movement');
        if (movement) {
            movement.facingDirection = angle;
        }
    }
    /**
     * Start wandering behavior
     */
    startWandering(npc, npcComponent) {
        // Small chance to start wandering
        if (Math.random() < 0.1) {
            npcComponent.state = types_1.NPCState.WANDERING;
            this.updateWanderBehavior(npc, npcComponent);
        }
    }
    /**
     * Check if target is valid
     */
    isValidTarget(npc, targetId) {
        if (!targetId) {
            return false;
        }
        const target = this.getEntity(targetId);
        if (!target) {
            return false;
        }
        // Check if target is alive
        const stats = target.getComponent('stats');
        if (stats && stats.hitpoints?.current <= 0) {
            return false;
        }
        // Check distance
        const npcPos = this.getEntityPosition(npc);
        const targetPos = this.getEntityPosition(target);
        if (!npcPos || !targetPos) {
            return false;
        }
        const distance = this.getDistance(npcPos, targetPos);
        if (distance > 20) {
            return false;
        } // Max chase distance
        return true;
    }
    /**
     * Check if NPC can attack player
     */
    canAttackPlayer(npc, player) {
        // Check if player is alive
        const stats = player.getComponent('stats');
        if (stats && stats.hitpoints?.current <= 0) {
            return false;
        }
        // Check combat level difference for aggression
        const npcComponent = npc.getComponent('npc');
        if (!npcComponent) {
            return false;
        }
        const playerLevel = stats?.combatLevel || 1;
        const levelDiff = playerLevel - npcComponent.combatLevel;
        // Don't attack players too high level
        if (levelDiff > npcComponent.aggressionLevel * 10) {
            return false;
        }
        return true;
    }
    /**
     * Check if reached destination
     */
    hasReachedDestination(npc, movement) {
        if (!movement.destination) {
            return true;
        }
        const npcPos = this.getEntityPosition(npc);
        if (!npcPos) {
            return true;
        }
        const distance = this.getDistance(npcPos, movement.destination);
        return distance < 0.5;
    }
    /**
     * Get players in range
     */
    getPlayersInRange(position, range) {
        // Use spatial query for efficiency when available
        const nearbyEntities = this.spatialQuery(position, range);
        const players = [];
        for (const entity of nearbyEntities) {
            if (this.isPlayer(entity)) {
                players.push(entity);
            }
        }
        return players;
    }
    /**
     * Get closest player from list
     */
    getClosestPlayer(position, players) {
        let closest = null;
        let minDistance = Infinity;
        for (const player of players) {
            const playerPos = this.getEntityPosition(player);
            if (playerPos) {
                const distance = this.getDistance(position, playerPos);
                if (distance < minDistance) {
                    minDistance = distance;
                    closest = player;
                }
            }
        }
        return closest;
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
    /**
     * Get entity from world
     */
    getEntity(entityId) {
        if (this.world.entities.items instanceof Map) {
            return this.world.entities.items.get(entityId);
        }
        return this.world.entities.get?.(entityId);
    }
    /**
     * Check if entity is a player
     */
    isPlayer(entity) {
        return entity.type === 'player' || entity.data?.type === 'player';
    }
    /**
     * Calculate distance between positions
     */
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * Execute patrol behavior
     */
    executePatrol(npc, component) {
        // Simple patrol implementation
        const movement = npc.getComponent('movement');
        if (!movement) {
            return;
        }
        if (!movement.destination || this.hasReachedDestination(npc, movement)) {
            // Generate simple patrol points around spawn
            const waypoints = this.generateDefaultWaypoints(component.spawnPoint);
            const nextWaypoint = waypoints[Math.floor(Math.random() * waypoints.length)];
            this.moveToPosition(npc, nextWaypoint);
        }
    }
    /**
     * Generate default waypoints for patrol
     */
    generateDefaultWaypoints(spawnPoint) {
        const waypoints = [];
        const radius = 10;
        // Create 4 waypoints in a square pattern
        waypoints.push({ x: spawnPoint.x + radius, y: spawnPoint.y, z: spawnPoint.z });
        waypoints.push({ x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z + radius });
        waypoints.push({ x: spawnPoint.x - radius, y: spawnPoint.y, z: spawnPoint.z });
        waypoints.push({ x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z - radius });
        return waypoints;
    }
    /**
     * Spatial query for nearby entities
     */
    spatialQuery(position, radius) {
        // Try to use spatial index if available
        const spatialIndex = this.world.spatialIndex;
        if (spatialIndex && typeof spatialIndex.query === 'function') {
            return spatialIndex.query({
                position: { x: position.x, y: position.y, z: position.z },
                radius,
            });
        }
        // Fallback: iterate through all entities
        const entities = [];
        const entityMap = this.world.entities.items || new Map();
        for (const entity of entityMap.values()) {
            if (!entity) {
                continue;
            }
            const entityPos = this.getEntityPosition(entity);
            if (entityPos && this.getDistance(position, entityPos) <= radius) {
                entities.push(entity);
            }
        }
        return entities;
    }
}
exports.NPCBehaviorManager = NPCBehaviorManager;
//# sourceMappingURL=NPCBehaviorManager.js.map