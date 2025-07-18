/**
 * RPG Query definitions
 * These provide read-only access to game state via the public API
 */
import { Vector3 } from '../types';
/**
 * Player queries
 */
export interface PlayerStats {
    hitpoints: {
        current: number;
        max: number;
    };
    attack: {
        level: number;
        xp: number;
    };
    strength: {
        level: number;
        xp: number;
    };
    defence: {
        level: number;
        xp: number;
    };
    ranged: {
        level: number;
        xp: number;
    };
    magic: {
        level: number;
        xp: number;
    };
    prayer: {
        level: number;
        xp: number;
        points: number;
        maxPoints: number;
    };
    combatLevel: number;
    totalLevel: number;
}
export interface PlayerInfo {
    id: string;
    username: string;
    position: Vector3;
    stats: PlayerStats;
    equipment: Record<string, any>;
    inventory: Array<{
        itemId: number;
        quantity: number;
    }>;
}
/**
 * NPC queries
 */
export interface NPCInfo {
    id: string;
    name: string;
    type: string;
    position: Vector3;
    level: number;
    hitpoints: {
        current: number;
        max: number;
    };
    behavior: string;
    state: string;
}
/**
 * Item queries
 */
export interface ItemInfo {
    id: number;
    name: string;
    examine: string;
    value: number;
    stackable: boolean;
    equipable: boolean;
    tradeable: boolean;
}
/**
 * World queries
 */
export interface WorldInfo {
    time: number;
    entityCount: number;
    playerCount: number;
    regions: string[];
}
export interface RegionInfo {
    id: string;
    name: string;
    type: string;
    level: number;
    bounds: {
        min: Vector3;
        max: Vector3;
    };
}
/**
 * Bank queries
 */
export interface BankInfo {
    items: Array<{
        itemId: number;
        quantity: number;
        tab: number;
    }>;
    capacity: number;
    used: number;
}
/**
 * Shop queries
 */
export interface ShopInfo {
    id: string;
    name: string;
    items: Array<{
        itemId: number;
        stock: number;
        maxStock: number;
        price: number;
    }>;
}
/**
 * Skill queries
 */
export interface SkillInfo {
    name: string;
    level: number;
    experience: number;
    nextLevelXp: number;
    percentToNext: number;
}
//# sourceMappingURL=queries.d.ts.map