/**
 * Skill Definitions - RuneScape-like skill system
 * Defines all skills, experience tables, and requirements
 */
export declare enum SkillType {
    ATTACK = "attack",
    STRENGTH = "strength",
    DEFENCE = "defence",
    MAGIC = "magic",
    RANGED = "ranged",
    PRAYER = "prayer",
    WOODCUTTING = "woodcutting",
    MINING = "mining",
    FISHING = "fishing",
    SMITHING = "smithing",
    COOKING = "cooking",
    CRAFTING = "crafting",
    FLETCHING = "fletching",
    AGILITY = "agility",
    THIEVING = "thieving",
    HITPOINTS = "hitpoints",
    FIREMAKING = "firemaking",
    HERBLORE = "herblore",
    CONSTRUCTION = "construction",
    FARMING = "farming",
    HUNTER = "hunter",
    RUNECRAFTING = "runecrafting",
    SLAYER = "slayer"
}
export interface SkillDefinition {
    type: SkillType;
    name: string;
    description: string;
    isCombat: boolean;
    maxLevel: number;
    baseXP: number;
    multiplier: number;
}
export interface SkillAction {
    id: string;
    skillType: SkillType;
    name: string;
    description: string;
    levelRequired: number;
    xpGained: number;
    baseTime: number;
    requirements?: {
        items?: {
            itemId: number;
            quantity: number;
        }[];
        tools?: number[];
    };
    produces?: {
        itemId: number;
        quantity: number;
        chance?: number;
    }[];
}
export declare const XP_TABLE: number[];
export declare const SKILL_DEFINITIONS: Record<SkillType, SkillDefinition>;
export declare function getXPForLevel(level: number): number;
export declare function getLevelForXP(xp: number): number;
export declare function getXPToNextLevel(currentXP: number): number;
export declare function getCombatLevel(skills: Record<SkillType, {
    level: number;
}>): number;
//# sourceMappingURL=SkillDefinitions.d.ts.map