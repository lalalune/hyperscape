/**
 * Combat Definitions - All combat-related constants and mechanics
 * Implements RuneScape-style combat with triangle advantage system
 */
export declare enum CombatStyle {
    MELEE = "melee",
    RANGED = "ranged",
    MAGIC = "magic"
}
export declare enum AttackStyle {
    ACCURATE = "accurate",// +3 Attack levels, slower
    AGGRESSIVE = "aggressive",// +3 Strength levels, faster
    DEFENSIVE = "defensive",// +3 Defence levels, slower
    CONTROLLED = "controlled",// +1 to all, normal speed
    RAPID = "rapid",// Faster attacks, same accuracy
    LONG_RANGE = "long_range",// +2 range, +3 Defence levels
    SPELL_CASTING = "spell_casting"
}
export declare enum WeaponType {
    SWORD = "sword",
    AXE = "axe",
    MACE = "mace",
    DAGGER = "dagger",
    SPEAR = "spear",
    HALBERD = "halberd",
    WHIP = "whip",
    BOW = "bow",
    CROSSBOW = "crossbow",
    THROWING = "throwing",
    STAFF = "staff",
    WAND = "wand",
    UNARMED = "unarmed"
}
export interface WeaponDefinition {
    id: string;
    name: string;
    type: WeaponType;
    combatStyle: CombatStyle;
    attackSpeed: number;
    attackRange: number;
    requirements: {
        attack?: number;
        ranged?: number;
        magic?: number;
    };
    bonuses: {
        attackBonus: number;
        strengthBonus: number;
        defenceBonus: number;
        rangedBonus?: number;
        magicBonus?: number;
    };
    specialAttack?: {
        energyCost: number;
        damageMultiplier: number;
        accuracy: number;
        effect?: string;
    };
    ammunition?: string;
}
export interface ArmorDefinition {
    id: string;
    name: string;
    slot: ArmorSlot;
    requirements: {
        defence?: number;
        attack?: number;
        ranged?: number;
        magic?: number;
    };
    bonuses: {
        attackBonus: number;
        strengthBonus: number;
        defenceBonus: number;
        rangedDefence: number;
        magicDefence: number;
        prayer?: number;
    };
    weight: number;
}
export declare enum ArmorSlot {
    HELMET = "helmet",
    BODY = "body",
    LEGS = "legs",
    BOOTS = "boots",
    GLOVES = "gloves",
    CAPE = "cape",
    AMULET = "amulet",
    RING = "ring",
    SHIELD = "shield",
    WEAPON = "weapon",
    AMMUNITION = "ammunition"
}
export interface CombatStats {
    attack: number;
    strength: number;
    defence: number;
    ranged: number;
    magic: number;
    hitpoints: number;
    prayer: number;
}
export declare const COMBAT_TRIANGLE: Record<CombatStyle, Record<CombatStyle, number>>;
export declare const WEAPON_DEFINITIONS: Record<string, WeaponDefinition>;
export declare const ARMOR_DEFINITIONS: Record<string, ArmorDefinition>;
export declare function calculateAccuracy(attacker: CombatStats, attackerEquipment: any, defender: CombatStats, defenderEquipment: any, attackStyle: CombatStyle): number;
export declare function calculateMaxDamage(attacker: CombatStats, attackerEquipment: any, attackStyle: CombatStyle): number;
export declare function applyCombatTriangle(damage: number, attackerStyle: CombatStyle, defenderStyle: CombatStyle): number;
export interface AnimationDefinition {
    id: string;
    name: string;
    duration: number;
    frames: AnimationFrame[];
}
export interface AnimationFrame {
    time: number;
    rotation?: {
        x?: number;
        y?: number;
        z?: number;
    };
    position?: {
        x?: number;
        y?: number;
        z?: number;
    };
    scale?: {
        x?: number;
        y?: number;
        z?: number;
    };
}
export declare const COMBAT_ANIMATIONS: Record<string, AnimationDefinition>;
export declare const RESPAWN_LOCATIONS: Record<string, {
    x: number;
    y: number;
    z: number;
}>;
//# sourceMappingURL=CombatDefinitions.d.ts.map