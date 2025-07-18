import { World } from '@hyperfy/sdk';
interface Spawner {
    id: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    conditions?: SpawnConditions;
    activationRange: number;
}
interface SpawnConditions {
    timeOfDay?: {
        start: number;
        end: number;
    };
    minPlayers?: number;
    maxPlayers?: number;
    playerLevel?: {
        min: number;
        max: number;
    };
    customCondition?: (spawner: Spawner, world: World) => boolean;
}
/**
 * Checks spawn conditions for spawners
 */
export declare class SpawnConditionChecker {
    /**
     * Check if all conditions are met for spawning
     */
    checkConditions(spawner: Spawner, world: World): boolean;
    /**
     * Get current time of day (0-24)
     */
    private getTimeOfDay;
    /**
     * Get players in range of spawner
     */
    private getPlayersInRange;
    /**
     * Get average level of players
     */
    private getAveragePlayerLevel;
}
export {};
//# sourceMappingURL=SpawnConditionChecker.d.ts.map