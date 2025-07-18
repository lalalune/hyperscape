/**
 * Item Definitions - Comprehensive item system for RuneScape-style RPG
 * Defines all items including weapons, armor, consumables, and materials
 */
import { SkillType } from '../skills/SkillDefinitions';
export declare enum ItemCategory {
    WEAPON = "weapon",
    ARMOR = "armor",
    TOOL = "tool",
    CONSUMABLE = "consumable",
    MATERIAL = "material",
    QUEST = "quest",
    MISC = "misc"
}
export declare enum ItemRarity {
    COMMON = "common",
    UNCOMMON = "uncommon",
    RARE = "rare",
    VERY_RARE = "very_rare",
    ULTRA_RARE = "ultra_rare"
}
export declare enum EquipmentSlot {
    WEAPON = "weapon",
    HELMET = "helmet",
    BODY = "body",
    LEGS = "legs",
    BOOTS = "boots",
    GLOVES = "gloves",
    SHIELD = "shield",
    RING = "ring",
    AMULET = "amulet",
    ARROW = "arrow",
    CAPE = "cape"
}
export interface ItemRequirement {
    skill: SkillType;
    level: number;
}
export interface ItemStats {
    attackBonus?: number;
    strengthBonus?: number;
    defenceBonus?: number;
    rangedBonus?: number;
    rangedDefence?: number;
    magicBonus?: number;
    magicDefence?: number;
    prayer?: number;
    weight?: number;
}
export interface ItemDefinition {
    id: string;
    name: string;
    description: string;
    category: ItemCategory;
    rarity: ItemRarity;
    value: number;
    weight: number;
    stackable: boolean;
    tradeable: boolean;
    equipmentSlot?: EquipmentSlot;
    requirements?: ItemRequirement[];
    stats?: ItemStats;
    consumable?: {
        healAmount?: number;
        effects?: Array<{
            skill: SkillType;
            boost: number;
            duration: number;
        }>;
        consumeTime?: number;
    };
    visual?: {
        color: string;
        model?: string;
        texture?: string;
    };
    production?: {
        skill: SkillType;
        level: number;
        experience: number;
        materials: Array<{
            itemId: string;
            quantity: number;
        }>;
    };
}
export declare const ITEM_DEFINITIONS: Record<string, ItemDefinition>;
export declare function getItemDefinition(itemId: string): ItemDefinition | null;
export declare function getItemsByCategory(category: ItemCategory): ItemDefinition[];
export declare function getItemsByRarity(rarity: ItemRarity): ItemDefinition[];
export declare function getItemsByEquipmentSlot(slot: EquipmentSlot): ItemDefinition[];
export declare function getTradeableItems(): ItemDefinition[];
export declare function getStackableItems(): ItemDefinition[];
export declare function canPlayerEquipItem(playerLevels: Record<SkillType, number>, item: ItemDefinition): boolean;
//# sourceMappingURL=ItemDefinitions.d.ts.map