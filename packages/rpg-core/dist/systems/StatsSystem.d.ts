import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import type { StatsComponent } from '../types/index';
export declare class StatsSystem extends System {
    name: string;
    enabled: boolean;
    private playerStats;
    constructor(world: World);
    /**
     * Get XP required for a specific level (public interface for tests)
     */
    getXPForLevel(level: number): number;
    /**
     * Get level for a specific XP amount (public interface for tests)
     */
    getLevelForXP(xp: number): number;
    /**
     * Grant XP to a player and handle level ups
     */
    grantXP(playerId: string, skill: string, amount: number, source: string): void;
    /**
     * Get player stats from storage
     */
    getPlayerStats(playerId: string): StatsComponent | null;
    /**
     * Set player stats in storage
     */
    setPlayerStats(playerId: string, stats: StatsComponent): void;
    /**
     * Check if player meets skill requirements
     */
    meetsRequirements(playerId: string, requirements: Record<string, number>): boolean;
    /**
     * Calculate total level from all skills
     */
    private calculateTotalLevel;
    /**
     * Handle combat XP distribution (private method for combat system integration)
     */
    private handleCombatXP;
    /**
     * Initialize the stats system
     */
    init(_options: any): Promise<void>;
    /**
     * Create initial stats for a new player
     */
    createInitialStats(): StatsComponent;
    /**
     * Handle XP gain events
     */
    private handleXpGain;
    /**
     * Handle level up events
     */
    private handleLevelUp;
    /**
     * Calculate combat level from stats
     */
    calculateCombatLevel(stats: {
        attack: {
            level: number;
        };
        strength: {
            level: number;
        };
        defence?: {
            level: number;
        };
        defense?: {
            level: number;
        };
        ranged: {
            level: number;
        };
        magic: {
            level: number;
        };
        hitpoints: {
            level: number;
        };
        prayer: {
            level: number;
        };
    }): number;
    /**
     * Convert level to XP using RuneScape formula
     */
    levelToXp(level: number): number;
    /**
     * Convert XP to level
     */
    xpToLevel(xp: number): number;
    /**
     * Add XP to a skill
     */
    addXp(stats: StatsComponent, skill: string, amount: number): {
        leveledUp: boolean;
        newLevel: number;
    };
    /**
     * Update hitpoints
     */
    updateHitpoints(stats: StatsComponent, current: number): void;
    /**
     * Heal hitpoints
     */
    heal(stats: StatsComponent, amount: number): number;
    /**
     * Take damage
     */
    takeDamage(stats: StatsComponent, damage: number): {
        newHp: number;
        isDead: boolean;
    };
}
//# sourceMappingURL=StatsSystem.d.ts.map