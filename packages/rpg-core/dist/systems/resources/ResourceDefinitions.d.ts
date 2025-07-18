/**
 * Resource Definitions - All harvestable resources in the world
 * Each resource is represented as a colored cube with specific properties
 */
import { SkillType } from '../skills/SkillDefinitions';
export declare enum ResourceType {
    TREE_NORMAL = "tree_normal",
    TREE_OAK = "tree_oak",
    TREE_WILLOW = "tree_willow",
    TREE_MAPLE = "tree_maple",
    TREE_YEW = "tree_yew",
    TREE_MAGIC = "tree_magic",
    ROCK_CLAY = "rock_clay",
    ROCK_COPPER = "rock_copper",
    ROCK_TIN = "rock_tin",
    ROCK_IRON = "rock_iron",
    ROCK_COAL = "rock_coal",
    ROCK_GOLD = "rock_gold",
    ROCK_MITHRIL = "rock_mithril",
    ROCK_ADAMANT = "rock_adamant",
    ROCK_RUNITE = "rock_runite",
    FISHING_NET = "fishing_net",// Shrimp, anchovies
    FISHING_BAIT = "fishing_bait",// Trout, salmon
    FISHING_CAGE = "fishing_cage",// Lobster
    FISHING_HARPOON = "fishing_harpoon"
}
export interface ResourceVisual {
    color: string;
    scale: number;
    emissive?: string;
    metalness?: number;
    roughness?: number;
}
export interface ResourceDefinition {
    type: ResourceType;
    name: string;
    description: string;
    skill: SkillType;
    levelRequired: number;
    baseHarvestTime: number;
    respawnTime: number;
    visual: ResourceVisual;
    drops: {
        itemId: number;
        name: string;
        quantity: {
            min: number;
            max: number;
        };
        chance: number;
        xp: number;
    }[];
    toolRequired?: number;
    depletes: boolean;
    rarity: 'common' | 'uncommon' | 'rare' | 'very_rare';
}
export declare const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition>;
export declare function getResourcesBySkill(skill: SkillType): ResourceDefinition[];
export declare function getResourcesByRarity(rarity: string): ResourceDefinition[];
export declare function canHarvestResource(resource: ResourceDefinition, playerLevel: number, hasTool: boolean): boolean;
//# sourceMappingURL=ResourceDefinitions.d.ts.map