"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpawnConditionChecker = void 0;
/**
 * Checks spawn conditions for spawners
 */
class SpawnConditionChecker {
    /**
     * Check if all conditions are met for spawning
     */
    checkConditions(spawner, world) {
        const conditions = spawner.conditions;
        if (!conditions) {
            return true;
        }
        // Check time of day
        if (conditions.timeOfDay) {
            const currentTime = this.getTimeOfDay(world);
            const { start, end } = conditions.timeOfDay;
            if (start <= end) {
                if (currentTime < start || currentTime > end) {
                    return false;
                }
            }
            else {
                // Handles overnight periods
                if (currentTime < start && currentTime > end) {
                    return false;
                }
            }
        }
        // Check player count
        if (conditions.minPlayers !== undefined || conditions.maxPlayers !== undefined) {
            const playerCount = this.getPlayersInRange(spawner, world).length;
            if (conditions.minPlayers !== undefined && playerCount < conditions.minPlayers) {
                return false;
            }
            if (conditions.maxPlayers !== undefined && playerCount > conditions.maxPlayers) {
                return false;
            }
        }
        // Check player level
        if (conditions.playerLevel) {
            const players = this.getPlayersInRange(spawner, world);
            if (players.length === 0) {
                return false;
            }
            const avgLevel = this.getAveragePlayerLevel(players);
            const { min, max } = conditions.playerLevel;
            if (min !== undefined && avgLevel < min) {
                return false;
            }
            if (max !== undefined && avgLevel > max) {
                return false;
            }
        }
        // Check custom condition
        if (conditions.customCondition) {
            if (!conditions.customCondition(spawner, world)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Get current time of day (0-24)
     */
    getTimeOfDay(world) {
        // Check if world has time system
        const timeSystem = world.timeSystem;
        if (timeSystem && typeof timeSystem.getHour === 'function') {
            return timeSystem.getHour();
        }
        // Check if world has day/night cycle
        const dayNightCycle = world.dayNightCycle;
        if (dayNightCycle && typeof dayNightCycle.getCurrentHour === 'function') {
            return dayNightCycle.getCurrentHour();
        }
        // Fallback to real time
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
    }
    /**
     * Get players in range of spawner
     */
    getPlayersInRange(spawner, world) {
        const players = [];
        // Get all entities in range
        const entities = world.getEntitiesInRange?.(spawner.position, spawner.activationRange) || [];
        for (const entity of entities) {
            // Check both entity.type and entity.data.type for compatibility
            if (entity.type === 'player' || entity.data?.type === 'player') {
                players.push(entity);
            }
        }
        return players;
    }
    /**
     * Get average level of players
     */
    getAveragePlayerLevel(players) {
        if (players.length === 0) {
            return 0;
        }
        let totalLevel = 0;
        for (const player of players) {
            const stats = player.getComponent?.('stats');
            if (stats?.combatLevel) {
                totalLevel += stats.combatLevel;
            }
        }
        return totalLevel / players.length;
    }
}
exports.SpawnConditionChecker = SpawnConditionChecker;
//# sourceMappingURL=SpawnConditionChecker.js.map