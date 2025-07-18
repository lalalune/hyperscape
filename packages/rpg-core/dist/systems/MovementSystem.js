"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
class MovementSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.movingEntities = new Map();
        this.spatialIndex = null;
        this.setupEventListeners();
    }
    async init(_options) {
        // Get spatial index system
        this.spatialIndex = this.world.spatialIndex;
        if (!this.spatialIndex) {
            // Only warn if not in test environment
            if (process.env.NODE_ENV !== 'test' && !process.env.BUN_ENV?.includes('test')) {
                console.warn('[MovementSystem] No spatial index available - using fallback collision detection');
            }
        }
    }
    setupEventListeners() {
        this.world.events.on('player:move', this.handlePlayerMove.bind(this));
        this.world.events.on('player:toggleRun', this.handleToggleRun.bind(this));
        this.world.events.on('player:stop', this.handlePlayerStop.bind(this));
    }
    update(deltaTime) {
        // Update all moving entities
        for (const [entityId, moveData] of this.movingEntities) {
            const entity = this.world.entities.get(entityId);
            if (!entity) {
                this.movingEntities.delete(entityId);
                continue;
            }
            const movement = entity.getComponent('movement');
            if (!movement) {
                continue;
            }
            // Update run energy
            if (moveData.isRunning && movement.runEnergy > 0) {
                movement.runEnergy = Math.max(0, movement.runEnergy - MovementSystem.RUN_ENERGY_DRAIN * deltaTime);
                if (movement.runEnergy === 0) {
                    moveData.isRunning = false;
                    movement.isRunning = false;
                }
            }
            else if (!moveData.isRunning && movement.runEnergy < 100) {
                movement.runEnergy = Math.min(100, movement.runEnergy + MovementSystem.RUN_ENERGY_RESTORE * deltaTime);
            }
            // Move entity along path
            this.moveAlongPath(entity, moveData, deltaTime);
        }
    }
    handlePlayerMove(data) {
        const { playerId, targetPosition } = data;
        const player = this.world.entities.get(playerId);
        if (!player) {
            return;
        }
        const movement = player.getComponent('movement');
        if (!movement || !movement.canMove) {
            return;
        }
        // Calculate path using optimized pathfinding
        const path = this.findPathOptimized(player.position, targetPosition);
        if (path.length === 0) {
            this.world.events.emit('player:moveBlocked', { playerId, reason: 'No path found' });
            return;
        }
        // Store movement data
        this.movingEntities.set(playerId, {
            path,
            currentIndex: 0,
            targetPosition,
            isRunning: movement.isRunning && movement.runEnergy > 0,
        });
        // Update movement component
        movement.isMoving = true;
        movement.targetPosition = targetPosition;
        // Emit movement started event
        this.world.events.emit('player:moveStarted', {
            playerId,
            targetPosition,
            path,
            isRunning: movement.isRunning,
        });
    }
    handleToggleRun(data) {
        const { playerId } = data;
        const player = this.world.entities.get(playerId);
        if (!player) {
            return;
        }
        const movement = player.getComponent('movement');
        if (!movement) {
            return;
        }
        movement.isRunning = !movement.isRunning;
        // Update current movement if active
        const moveData = this.movingEntities.get(playerId);
        if (moveData && movement.runEnergy > 0) {
            moveData.isRunning = movement.isRunning;
        }
        this.world.events.emit('player:runToggled', {
            playerId,
            isRunning: movement.isRunning,
        });
    }
    handlePlayerStop(data) {
        const { playerId } = data;
        this.stopMovement(playerId);
    }
    moveAlongPath(entity, moveData, deltaTime) {
        const movement = entity.getComponent('movement');
        if (!movement) {
            return;
        }
        const speed = moveData.isRunning ? MovementSystem.RUN_SPEED : MovementSystem.WALK_SPEED;
        const moveDistance = speed * deltaTime;
        let remainingDistance = moveDistance;
        const oldPosition = { ...entity.position };
        while (remainingDistance > 0 && moveData.currentIndex < moveData.path.length) {
            const targetNode = moveData.path[moveData.currentIndex];
            const direction = this.getDirection(entity.position, targetNode);
            const distanceToNode = this.getDistance(entity.position, targetNode);
            if (distanceToNode <= remainingDistance) {
                // Reach current node
                entity.position = { ...targetNode };
                moveData.currentIndex++;
                remainingDistance -= distanceToNode;
                // Check if reached final destination
                if (moveData.currentIndex >= moveData.path.length) {
                    this.onReachedDestination(entity.id);
                    break;
                }
            }
            else {
                // Move towards current node
                const newPosition = {
                    x: entity.position.x + direction.x * remainingDistance,
                    y: entity.position.y + direction.y * remainingDistance,
                    z: entity.position.z + direction.z * remainingDistance,
                };
                // Check collision at new position using spatial index
                if (this.checkCollisionOptimized(newPosition, entity.id)) {
                    // Collision detected, stop movement and recalculate path
                    this.recalculatePath(entity.id);
                    break;
                }
                entity.position = newPosition;
                remainingDistance = 0;
            }
            // Update facing direction
            if (Math.abs(direction.x) > 0.01 || Math.abs(direction.z) > 0.01) {
                movement.facingDirection = Math.atan2(direction.x, direction.z);
            }
        }
        // Update spatial index if position changed
        if (this.spatialIndex &&
            (Math.abs(entity.position.x - oldPosition.x) > 0.1 || Math.abs(entity.position.z - oldPosition.z) > 0.1)) {
            this.spatialIndex.markDirty(entity);
        }
        // Update movement component
        movement.currentSpeed = speed;
        movement.position = entity.position;
        // Emit position update for network sync
        this.world.events.emit('entity:positionUpdate', {
            entityId: entity.id,
            position: entity.position,
            facingDirection: movement.facingDirection,
            isRunning: moveData.isRunning,
        });
    }
    // Optimized pathfinding using spatial index for collision detection
    findPathOptimized(start, end) {
        // Quick line-of-sight check using spatial index
        if (this.hasLineOfSightOptimized(start, end)) {
            return [end];
        }
        // Fallback to A* pathfinding
        return this.findPath(start, end);
    }
    // Optimized collision detection using spatial index
    checkCollisionOptimized(position, excludeEntityId) {
        if (!this.spatialIndex) {
            return this.checkCollision(position);
        }
        // Use spatial index to efficiently find nearby entities
        const nearbyEntities = this.spatialIndex.query({
            position: new THREE.Vector3(position.x, position.y, position.z),
            radius: MovementSystem.COLLISION_CHECK_RADIUS,
            filter: entity => {
                // Exclude self and non-blocking entities
                if (entity.id === excludeEntityId) {
                    return false;
                }
                const collider = entity.getComponent('collider');
                return collider && collider.blocking;
            },
        });
        // Check collision with nearby entities
        for (const entity of nearbyEntities) {
            const entityPos = entity.position || { x: 0, y: 0, z: 0 };
            const distance = this.getDistance(position, entityPos);
            if (distance < MovementSystem.COLLISION_CHECK_RADIUS) {
                return true;
            }
        }
        // Check terrain collision
        const terrain = this.world.terrain;
        if (terrain && !terrain.isWalkable(position.x, position.z)) {
            return true;
        }
        // Check world bounds
        return !this.isInBounds(position);
    }
    // Optimized line-of-sight check using spatial index
    hasLineOfSightOptimized(start, end) {
        if (!this.spatialIndex) {
            return this.hasLineOfSight(start, end);
        }
        const _direction = this.getDirection(start, end);
        const distance = this.getDistance(start, end);
        const steps = Math.ceil(distance / MovementSystem.PATHFINDING_GRID_SIZE);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
                z: start.z + (end.z - start.z) * t,
            };
            if (this.checkCollisionOptimized(point)) {
                return false;
            }
        }
        return true;
    }
    // Original pathfinding for fallback
    findPath(start, end) {
        // A* pathfinding implementation (existing code)
        const openSet = [];
        const closedSet = new Set();
        const startNode = {
            position: this.snapToGrid(start),
            g: 0,
            h: this.getDistance(start, end),
            f: 0,
        };
        startNode.f = startNode.g + startNode.h;
        openSet.push(startNode);
        while (openSet.length > 0) {
            // Get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const nodeKey = this.getNodeKey(current.position);
            closedSet.add(nodeKey);
            // Check if reached destination
            if (this.getDistance(current.position, end) < MovementSystem.PATHFINDING_GRID_SIZE) {
                return this.reconstructPath(current);
            }
            // Check path length limit
            if (current.g > MovementSystem.MAX_PATH_LENGTH) {
                continue;
            }
            // Check neighbors
            const neighbors = this.getNeighbors(current.position);
            for (const neighborPos of neighbors) {
                const neighborKey = this.getNodeKey(neighborPos);
                if (closedSet.has(neighborKey)) {
                    continue;
                }
                // Check if walkable using optimized collision detection
                if (this.checkCollisionOptimized(neighborPos)) {
                    continue;
                }
                const g = current.g + this.getDistance(current.position, neighborPos);
                const h = this.getDistance(neighborPos, end);
                const f = g + h;
                // Check if neighbor is in open set
                const existingNode = openSet.find(n => this.getNodeKey(n.position) === neighborKey);
                if (!existingNode || g < existingNode.g) {
                    const neighbor = {
                        position: neighborPos,
                        g,
                        h,
                        f,
                        parent: current,
                    };
                    if (existingNode) {
                        // Update existing node
                        const index = openSet.indexOf(existingNode);
                        openSet[index] = neighbor;
                    }
                    else {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        // No path found, return direct path
        return [end];
    }
    // Performance monitoring
    getPerformanceMetrics() {
        let totalPathLength = 0;
        for (const moveData of this.movingEntities.values()) {
            totalPathLength += moveData.path.length;
        }
        return {
            activeMovements: this.movingEntities.size,
            spatialIndexAvailable: this.spatialIndex !== null,
            averagePathLength: this.movingEntities.size > 0 ? totalPathLength / this.movingEntities.size : 0,
        };
    }
    getNeighbors(position) {
        const neighbors = [];
        const gridSize = MovementSystem.PATHFINDING_GRID_SIZE;
        // 8-directional movement
        const offsets = [
            { x: -gridSize, z: 0 },
            { x: gridSize, z: 0 },
            { x: 0, z: -gridSize },
            { x: 0, z: gridSize },
            { x: -gridSize, z: -gridSize },
            { x: -gridSize, z: gridSize },
            { x: gridSize, z: -gridSize },
            { x: gridSize, z: gridSize },
        ];
        for (const offset of offsets) {
            neighbors.push({
                x: position.x + offset.x,
                y: position.y,
                z: position.z + offset.z,
            });
        }
        return neighbors;
    }
    isWalkable(position) {
        return !this.checkCollisionOptimized(position);
    }
    checkCollision(position) {
        // Original collision detection (fallback)
        const physics = this.world.physics;
        if (physics) {
            const rayStart = new THREE.Vector3(position.x, position.y + 1, position.z);
            const rayEnd = new THREE.Vector3(position.x, position.y - 0.1, position.z);
            const rayDirection = new THREE.Vector3().subVectors(rayEnd, rayStart).normalize();
            const hit = physics.raycast(rayStart, rayDirection, 1.1);
            if (hit) {
                const hitEntity = this.world.entities?.get(hit.entityId);
                if (hitEntity) {
                    const blocker = hitEntity.getComponent('blocker');
                    if (blocker && blocker.active) {
                        return true;
                    }
                }
            }
        }
        const tileX = Math.floor(position.x);
        const tileZ = Math.floor(position.z);
        const collisionMap = this.world.collisionMap;
        if (collisionMap && collisionMap[tileZ] && collisionMap[tileZ][tileX]) {
            return true;
        }
        return false;
    }
    isInBounds(position) {
        const worldSettings = this.world.settings;
        const bounds = worldSettings?.worldBounds || {
            min: { x: -1000, y: -100, z: -1000 },
            max: { x: 1000, y: 1000, z: 1000 },
        };
        return (position.x >= bounds.min.x &&
            position.x <= bounds.max.x &&
            position.y >= bounds.min.y &&
            position.y <= bounds.max.y &&
            position.z >= bounds.min.z &&
            position.z <= bounds.max.z);
    }
    reconstructPath(endNode) {
        const path = [];
        let current = endNode;
        while (current) {
            path.unshift(current.position);
            current = current.parent;
        }
        return this.smoothPath(path);
    }
    smoothPath(path) {
        if (path.length <= 2) {
            return path;
        }
        const smoothed = [path[0]];
        let current = 0;
        while (current < path.length - 1) {
            let farthest = current + 1;
            for (let i = current + 2; i < path.length; i++) {
                if (this.hasLineOfSightOptimized(path[current], path[i])) {
                    farthest = i;
                }
                else {
                    break;
                }
            }
            smoothed.push(path[farthest]);
            current = farthest;
        }
        return smoothed;
    }
    hasLineOfSight(start, end) {
        const steps = Math.max(Math.abs(end.x - start.x) / MovementSystem.PATHFINDING_GRID_SIZE, Math.abs(end.z - start.z) / MovementSystem.PATHFINDING_GRID_SIZE);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
                z: start.z + (end.z - start.z) * t,
            };
            if (!this.isWalkable(point)) {
                return false;
            }
        }
        return true;
    }
    onReachedDestination(entityId) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const movement = entity.getComponent('movement');
        if (movement) {
            movement.isMoving = false;
            movement.currentSpeed = 0;
        }
        this.movingEntities.delete(entityId);
        this.world.events.emit('entity:reachedDestination', {
            entityId,
            position: entity.position,
        });
    }
    stopMovement(entityId) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const movement = entity.getComponent('movement');
        if (movement) {
            movement.isMoving = false;
            movement.currentSpeed = 0;
            movement.targetPosition = null;
        }
        this.movingEntities.delete(entityId);
        this.world.events.emit('entity:movementStopped', {
            entityId,
            position: entity.position,
        });
    }
    recalculatePath(entityId) {
        const moveData = this.movingEntities.get(entityId);
        if (!moveData) {
            return;
        }
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const newPath = this.findPathOptimized(entity.position, moveData.targetPosition);
        if (newPath.length > 0) {
            moveData.path = newPath;
            moveData.currentIndex = 0;
        }
        else {
            this.stopMovement(entityId);
            this.world.events.emit('player:moveBlocked', {
                playerId: entityId,
                reason: 'Path blocked',
            });
        }
    }
    getDistance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    getDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;
        const distance = this.getDistance(from, to);
        if (distance === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        return {
            x: dx / distance,
            y: dy / distance,
            z: dz / distance,
        };
    }
    snapToGrid(position) {
        const gridSize = MovementSystem.PATHFINDING_GRID_SIZE;
        return {
            x: Math.round(position.x / gridSize) * gridSize,
            y: position.y,
            z: Math.round(position.z / gridSize) * gridSize,
        };
    }
    getNodeKey(position) {
        return `${position.x.toFixed(1)},${position.z.toFixed(1)}`;
    }
    // Public API methods
    moveEntity(entityId, targetPosition) {
        this.handlePlayerMove({ playerId: entityId, targetPosition });
    }
    stopEntity(entityId) {
        this.stopMovement(entityId);
    }
    setRunning(entityId, isRunning) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const movement = entity.getComponent('movement');
        if (!movement) {
            return;
        }
        movement.isRunning = isRunning;
        const moveData = this.movingEntities.get(entityId);
        if (moveData && movement.runEnergy > 0) {
            moveData.isRunning = isRunning;
        }
    }
    teleportEntity(entityId, position) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const oldPosition = { ...entity.position };
        entity.position = { ...position };
        // Update spatial index
        if (this.spatialIndex) {
            this.spatialIndex.updateEntity(entity);
        }
        // Stop any current movement
        this.stopMovement(entityId);
        this.world.events.emit('entity:teleported', {
            entityId,
            fromPosition: oldPosition,
            toPosition: position,
        });
    }
}
exports.MovementSystem = MovementSystem;
MovementSystem.WALK_SPEED = 4.0; // Units per second
MovementSystem.RUN_SPEED = 8.0; // Units per second
MovementSystem.RUN_ENERGY_DRAIN = 1; // Per second
MovementSystem.RUN_ENERGY_RESTORE = 0.5; // Per second when walking
MovementSystem.PATHFINDING_GRID_SIZE = 0.5;
MovementSystem.MAX_PATH_LENGTH = 100;
MovementSystem.COLLISION_CHECK_RADIUS = 0.5;
//# sourceMappingURL=MovementSystem.js.map