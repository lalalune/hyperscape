/**
 * Zone Definitions - World areas and their properties
 * Based on RuneScape world layout with different regions
 */
import { ResourceType } from '../resources/ResourceDefinitions';
import { SkillType } from '../skills/SkillDefinitions';
export declare enum ZoneType {
    LUMBRIDGE = "lumbridge",
    DRAYNOR = "draynor",
    VARROCK = "varrock",
    FALADOR = "falador",
    BARBARIAN_VILLAGE = "barbarian_village",
    WILDERNESS = "wilderness",
    KARAMJA = "karamja",
    CAMELOT = "camelot",
    RESOURCE_FOREST = "resource_forest",
    MINING_GUILD = "mining_guild",
    FISHING_GUILD = "fishing_guild"
}
export interface ZoneBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY?: number;
    maxY?: number;
}
export interface ResourceDistribution {
    resourceType: ResourceType;
    density: number;
    minLevel: number;
    clusterSize: {
        min: number;
        max: number;
    };
    preferredAreas?: {
        centerX: number;
        centerZ: number;
        radius: number;
        densityMultiplier: number;
    }[];
}
export interface NPCSpawnInfo {
    npcId: number;
    name: string;
    level: number;
    density: number;
    aggressive: boolean;
    maxSpawns: number;
}
export interface ZoneFeatures {
    hasBank: boolean;
    hasShops: boolean;
    hasTeleport: boolean;
    pvpEnabled: boolean;
    safeZone: boolean;
    skillMultipliers?: Partial<Record<SkillType, number>>;
    environmentEffects?: string[];
}
export interface ZoneDefinition {
    type: ZoneType;
    name: string;
    description: string;
    bounds: ZoneBounds;
    theme: 'grassland' | 'forest' | 'desert' | 'swamp' | 'mountain' | 'city' | 'wilderness';
    skyColor: string;
    fogColor: string;
    ambientLight: number;
    features: ZoneFeatures;
    resources: ResourceDistribution[];
    npcs: NPCSpawnInfo[];
    connections: {
        zoneType: ZoneType;
        entryPoint: {
            x: number;
            z: number;
        };
        exitPoint: {
            x: number;
            z: number;
        };
    }[];
    landmarks: {
        name: string;
        x: number;
        z: number;
        type: 'bank' | 'shop' | 'quest' | 'teleport' | 'dungeon' | 'building';
        description: string;
    }[];
}
export declare const ZONE_DEFINITIONS: Record<ZoneType, ZoneDefinition>;
export declare function getZoneAt(x: number, z: number): ZoneDefinition | null;
export declare function getZonesByTheme(theme: string): ZoneDefinition[];
export declare function getConnectedZones(zoneType: ZoneType): ZoneType[];
export declare function isInPvPZone(x: number, z: number): boolean;
export declare function getSkillMultiplier(x: number, z: number, skill: SkillType): number;
//# sourceMappingURL=ZoneDefinitions.d.ts.map