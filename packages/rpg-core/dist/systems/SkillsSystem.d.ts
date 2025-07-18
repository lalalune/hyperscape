import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import type { SkillType, StatsComponent, Entity, SkillData } from '../types';
interface XPDrop {
    entityId: string;
    skill: SkillType;
    amount: number;
    timestamp: number;
}
export declare class SkillsSystem extends System {
    private static readonly MAX_LEVEL;
    private static readonly MAX_XP;
    private static readonly COMBAT_SKILLS;
    private xpTable;
    private xpDrops;
    private skillMilestones;
    private pendingSaves;
    private saveTimer?;
    constructor(world: World);
    private setupEventListeners;
    private startAutoSave;
    update(_deltaTime: number): void;
    /**
     * Grant XP to a specific skill
     */
    grantXP(entityId: string, skill: SkillType, amount: number): void;
    /**
     * Get the level for a given amount of XP
     */
    getLevelForXP(xp: number): number;
    /**
     * Get the XP required for a specific level
     */
    getXPForLevel(level: number): number;
    /**
     * Get XP remaining to next level
     */
    getXPToNextLevel(skill: SkillData): number;
    /**
     * Get XP progress percentage to next level
     */
    getXPProgress(skill: SkillData): number;
    /**
     * Check if entity meets skill requirements
     */
    meetsRequirements(entity: Entity, requirements: Partial<Record<SkillType, number>>): boolean;
    /**
     * Get combat level for an entity
     */
    getCombatLevel(stats: StatsComponent): number;
    /**
     * Get total level (sum of all skill levels)
     */
    getTotalLevel(stats: StatsComponent): number;
    /**
     * Get total XP across all skills
     */
    getTotalXP(stats: StatsComponent): number;
    /**
     * Reset a skill to level 1
     */
    resetSkill(entityId: string, skill: SkillType): void;
    /**
     * Set skill level directly (for admin commands)
     */
    setSkillLevel(entityId: string, skill: SkillType, level: number): void;
    private generateXPTable;
    private setupSkillMilestones;
    private handleLevelUp;
    private calculateMaxHitpoints;
    private updateCombatLevel;
    private updateTotalLevel;
    private calculateModifiedXP;
    private handleCombatKill;
    private handleSkillAction;
    private handleQuestComplete;
    getXPDrops(): XPDrop[];
    getSkillData(entityId: string, skill: SkillType): SkillData | null;
    /**
     * Load player skills from persistence
     */
    private loadPlayerSkills;
    /**
     * Save player skills to persistence
     */
    private savePlayerSkills;
    /**
     * Save all pending skill updates
     */
    private savePendingSkills;
    /**
     * Handle player connect event
     */
    private handlePlayerConnect;
    /**
     * Handle player disconnect event
     */
    private handlePlayerDisconnect;
}
export {};
//# sourceMappingURL=SkillsSystem.d.ts.map