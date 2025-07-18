"use strict";
/**
 * Combat Definitions - All combat-related constants and mechanics
 * Implements RuneScape-style combat with triangle advantage system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESPAWN_LOCATIONS = exports.COMBAT_ANIMATIONS = exports.ARMOR_DEFINITIONS = exports.WEAPON_DEFINITIONS = exports.COMBAT_TRIANGLE = exports.ArmorSlot = exports.WeaponType = exports.AttackStyle = exports.CombatStyle = void 0;
exports.calculateAccuracy = calculateAccuracy;
exports.calculateMaxDamage = calculateMaxDamage;
exports.applyCombatTriangle = applyCombatTriangle;
var CombatStyle;
(function (CombatStyle) {
    CombatStyle["MELEE"] = "melee";
    CombatStyle["RANGED"] = "ranged";
    CombatStyle["MAGIC"] = "magic";
})(CombatStyle || (exports.CombatStyle = CombatStyle = {}));
var AttackStyle;
(function (AttackStyle) {
    // Melee styles
    AttackStyle["ACCURATE"] = "accurate";
    AttackStyle["AGGRESSIVE"] = "aggressive";
    AttackStyle["DEFENSIVE"] = "defensive";
    AttackStyle["CONTROLLED"] = "controlled";
    // Ranged styles
    AttackStyle["RAPID"] = "rapid";
    AttackStyle["LONG_RANGE"] = "long_range";
    // Magic styles (auto-determined by spell)
    AttackStyle["SPELL_CASTING"] = "spell_casting";
})(AttackStyle || (exports.AttackStyle = AttackStyle = {}));
var WeaponType;
(function (WeaponType) {
    // Melee weapons
    WeaponType["SWORD"] = "sword";
    WeaponType["AXE"] = "axe";
    WeaponType["MACE"] = "mace";
    WeaponType["DAGGER"] = "dagger";
    WeaponType["SPEAR"] = "spear";
    WeaponType["HALBERD"] = "halberd";
    WeaponType["WHIP"] = "whip";
    // Ranged weapons
    WeaponType["BOW"] = "bow";
    WeaponType["CROSSBOW"] = "crossbow";
    WeaponType["THROWING"] = "throwing";
    // Magic weapons
    WeaponType["STAFF"] = "staff";
    WeaponType["WAND"] = "wand";
    // No weapon
    WeaponType["UNARMED"] = "unarmed";
})(WeaponType || (exports.WeaponType = WeaponType = {}));
var ArmorSlot;
(function (ArmorSlot) {
    ArmorSlot["HELMET"] = "helmet";
    ArmorSlot["BODY"] = "body";
    ArmorSlot["LEGS"] = "legs";
    ArmorSlot["BOOTS"] = "boots";
    ArmorSlot["GLOVES"] = "gloves";
    ArmorSlot["CAPE"] = "cape";
    ArmorSlot["AMULET"] = "amulet";
    ArmorSlot["RING"] = "ring";
    ArmorSlot["SHIELD"] = "shield";
    ArmorSlot["WEAPON"] = "weapon";
    ArmorSlot["AMMUNITION"] = "ammunition";
})(ArmorSlot || (exports.ArmorSlot = ArmorSlot = {}));
// Combat triangle effectiveness
exports.COMBAT_TRIANGLE = {
    [CombatStyle.MELEE]: {
        [CombatStyle.MELEE]: 1.0, // Neutral
        [CombatStyle.RANGED]: 1.25, // Strong against ranged
        [CombatStyle.MAGIC]: 0.75, // Weak against magic
    },
    [CombatStyle.RANGED]: {
        [CombatStyle.MELEE]: 0.75, // Weak against melee
        [CombatStyle.RANGED]: 1.0, // Neutral
        [CombatStyle.MAGIC]: 1.25, // Strong against magic
    },
    [CombatStyle.MAGIC]: {
        [CombatStyle.MELEE]: 1.25, // Strong against melee
        [CombatStyle.RANGED]: 0.75, // Weak against ranged
        [CombatStyle.MAGIC]: 1.0, // Neutral
    },
};
// Base weapon definitions
exports.WEAPON_DEFINITIONS = {
    // Melee weapons
    bronze_sword: {
        id: 'bronze_sword',
        name: 'Bronze Sword',
        type: WeaponType.SWORD,
        combatStyle: CombatStyle.MELEE,
        attackSpeed: 4,
        attackRange: 1,
        requirements: { attack: 1 },
        bonuses: {
            attackBonus: 4,
            strengthBonus: 3,
            defenceBonus: 1,
        },
    },
    iron_sword: {
        id: 'iron_sword',
        name: 'Iron Sword',
        type: WeaponType.SWORD,
        combatStyle: CombatStyle.MELEE,
        attackSpeed: 4,
        attackRange: 1,
        requirements: { attack: 1 },
        bonuses: {
            attackBonus: 10,
            strengthBonus: 8,
            defenceBonus: 2,
        },
    },
    steel_sword: {
        id: 'steel_sword',
        name: 'Steel Sword',
        type: WeaponType.SWORD,
        combatStyle: CombatStyle.MELEE,
        attackSpeed: 4,
        attackRange: 1,
        requirements: { attack: 5 },
        bonuses: {
            attackBonus: 21,
            strengthBonus: 20,
            defenceBonus: 3,
        },
    },
    rune_scimitar: {
        id: 'rune_scimitar',
        name: 'Rune Scimitar',
        type: WeaponType.SWORD,
        combatStyle: CombatStyle.MELEE,
        attackSpeed: 4,
        attackRange: 1,
        requirements: { attack: 40 },
        bonuses: {
            attackBonus: 67,
            strengthBonus: 66,
            defenceBonus: 1,
        },
    },
    dragon_dagger: {
        id: 'dragon_dagger',
        name: 'Dragon Dagger',
        type: WeaponType.DAGGER,
        combatStyle: CombatStyle.MELEE,
        attackSpeed: 4,
        attackRange: 1,
        requirements: { attack: 60 },
        bonuses: {
            attackBonus: 25,
            strengthBonus: 25,
            defenceBonus: 0,
        },
        specialAttack: {
            energyCost: 25,
            damageMultiplier: 1.15,
            accuracy: 1.25,
            effect: 'double_hit',
        },
    },
    // Ranged weapons
    shortbow: {
        id: 'shortbow',
        name: 'Shortbow',
        type: WeaponType.BOW,
        combatStyle: CombatStyle.RANGED,
        attackSpeed: 5,
        attackRange: 7,
        requirements: { ranged: 1 },
        bonuses: {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 0,
            rangedBonus: 8,
        },
        ammunition: 'arrows',
    },
    magic_bow: {
        id: 'magic_bow',
        name: 'Magic Bow',
        type: WeaponType.BOW,
        combatStyle: CombatStyle.RANGED,
        attackSpeed: 5,
        attackRange: 10,
        requirements: { ranged: 50 },
        bonuses: {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 0,
            rangedBonus: 69,
        },
        ammunition: 'arrows',
    },
    rune_crossbow: {
        id: 'rune_crossbow',
        name: 'Rune Crossbow',
        type: WeaponType.CROSSBOW,
        combatStyle: CombatStyle.RANGED,
        attackSpeed: 5,
        attackRange: 8,
        requirements: { ranged: 61 },
        bonuses: {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 0,
            rangedBonus: 90,
        },
        ammunition: 'bolts',
    },
    // Unarmed combat
    unarmed: {
        id: 'unarmed',
        name: 'Unarmed',
        type: WeaponType.UNARMED,
        combatStyle: CombatStyle.MELEE,
        attackSpeed: 4,
        attackRange: 1,
        requirements: {},
        bonuses: {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 0,
        },
    },
    // Magic weapons
    staff_of_air: {
        id: 'staff_of_air',
        name: 'Staff of Air',
        type: WeaponType.STAFF,
        combatStyle: CombatStyle.MAGIC,
        attackSpeed: 5,
        attackRange: 10,
        requirements: { magic: 1 },
        bonuses: {
            attackBonus: 2,
            strengthBonus: 0,
            defenceBonus: 1,
            magicBonus: 10,
        },
    },
    ancient_staff: {
        id: 'ancient_staff',
        name: 'Ancient Staff',
        type: WeaponType.STAFF,
        combatStyle: CombatStyle.MAGIC,
        attackSpeed: 4,
        attackRange: 10,
        requirements: { magic: 50 },
        bonuses: {
            attackBonus: 15,
            strengthBonus: 0,
            defenceBonus: 8,
            magicBonus: 20,
        },
    },
};
// Basic armor sets
exports.ARMOR_DEFINITIONS = {
    bronze_helmet: {
        id: 'bronze_helmet',
        name: 'Bronze Full Helm',
        slot: ArmorSlot.HELMET,
        requirements: { defence: 1 },
        bonuses: {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 6,
            rangedDefence: 4,
            magicDefence: -1,
        },
        weight: 2.0,
    },
    rune_platebody: {
        id: 'rune_platebody',
        name: 'Rune Platebody',
        slot: ArmorSlot.BODY,
        requirements: { defence: 40 },
        bonuses: {
            attackBonus: 0,
            strengthBonus: 0,
            defenceBonus: 70,
            rangedDefence: 68,
            magicDefence: -30,
        },
        weight: 9.5,
    },
    dragon_boots: {
        id: 'dragon_boots',
        name: 'Dragon Boots',
        slot: ArmorSlot.BOOTS,
        requirements: { defence: 60 },
        bonuses: {
            attackBonus: 0,
            strengthBonus: 2,
            defenceBonus: 7,
            rangedDefence: 7,
            magicDefence: -1,
        },
        weight: 0.5,
    },
};
// Combat calculations
function calculateAccuracy(attacker, attackerEquipment, defender, defenderEquipment, attackStyle) {
    let attackLevel = 0;
    let attackBonus = 0;
    let defenceLevel = 0;
    let defenceBonus = 0;
    // Get attack level and bonus based on combat style
    switch (attackStyle) {
        case CombatStyle.MELEE:
            attackLevel = attacker.attack;
            attackBonus = attackerEquipment?.attackBonus || 0;
            defenceLevel = defender.defence;
            defenceBonus = defenderEquipment?.defenceBonus || 0;
            break;
        case CombatStyle.RANGED:
            attackLevel = attacker.ranged;
            attackBonus = attackerEquipment?.rangedBonus || 0;
            defenceLevel = defender.defence;
            defenceBonus = defenderEquipment?.rangedDefence || 0;
            break;
        case CombatStyle.MAGIC:
            attackLevel = attacker.magic;
            attackBonus = attackerEquipment?.magicBonus || 0;
            defenceLevel = defender.magic;
            defenceBonus = defenderEquipment?.magicDefence || 0;
            break;
    }
    // RuneScape accuracy formula
    const effectiveAttackLevel = attackLevel + 8;
    const maxAttackRoll = effectiveAttackLevel * (attackBonus + 64);
    const effectiveDefenceLevel = defenceLevel + 8;
    const maxDefenceRoll = effectiveDefenceLevel * (defenceBonus + 64);
    // Accuracy calculation
    let accuracy = 0;
    if (maxAttackRoll > maxDefenceRoll) {
        accuracy = 1 - (maxDefenceRoll + 2) / (2 * (maxAttackRoll + 1));
    }
    else {
        accuracy = maxAttackRoll / (2 * (maxDefenceRoll + 1));
    }
    return Math.max(0, Math.min(1, accuracy));
}
function calculateMaxDamage(attacker, attackerEquipment, attackStyle) {
    let strengthLevel = 0;
    let strengthBonus = 0;
    switch (attackStyle) {
        case CombatStyle.MELEE:
            strengthLevel = attacker.strength;
            strengthBonus = attackerEquipment?.strengthBonus || 0;
            break;
        case CombatStyle.RANGED:
            strengthLevel = attacker.ranged;
            strengthBonus = attackerEquipment?.rangedBonus || 0;
            break;
        case CombatStyle.MAGIC:
            // Magic damage is spell-based, not equipment-based
            return 0; // Will be overridden by spell damage
    }
    const effectiveStrengthLevel = strengthLevel + 8;
    const maxDamage = Math.floor(0.5 + (effectiveStrengthLevel * (strengthBonus + 64)) / 640);
    return Math.max(1, maxDamage);
}
function applyCombatTriangle(damage, attackerStyle, defenderStyle) {
    const multiplier = exports.COMBAT_TRIANGLE[attackerStyle][defenderStyle];
    return Math.floor(damage * multiplier);
}
exports.COMBAT_ANIMATIONS = {
    melee_swing: {
        id: 'melee_swing',
        name: 'Melee Swing',
        duration: 600,
        frames: [
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
            { time: 200, rotation: { x: -45, y: 0, z: 0 } },
            { time: 400, rotation: { x: 45, y: 0, z: 0 } },
            { time: 600, rotation: { x: 0, y: 0, z: 0 } },
        ],
    },
    ranged_shoot: {
        id: 'ranged_shoot',
        name: 'Ranged Shoot',
        duration: 400,
        frames: [
            { time: 0, rotation: { x: 0, y: 0, z: 0 } },
            { time: 100, rotation: { x: -20, y: 0, z: 0 } },
            { time: 200, rotation: { x: -30, y: 0, z: 0 } },
            { time: 400, rotation: { x: 0, y: 0, z: 0 } },
        ],
    },
    magic_cast: {
        id: 'magic_cast',
        name: 'Magic Cast',
        duration: 800,
        frames: [
            { time: 0, position: { x: 0, y: 0, z: 0 } },
            { time: 200, position: { x: 0, y: 0.5, z: 0 } },
            { time: 400, position: { x: 0, y: 1, z: 0 }, scale: { x: 1.2, y: 1.2, z: 1.2 } },
            { time: 600, position: { x: 0, y: 0.5, z: 0 } },
            { time: 800, position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        ],
    },
};
exports.RESPAWN_LOCATIONS = {
    lumbridge: { x: 0, y: 0, z: 0 },
    falador: { x: -100, y: 0, z: 100 },
    camelot: { x: 200, y: 0, z: 200 },
    wilderness: { x: 150, y: 0, z: 300 }, // Edge of wilderness
};
//# sourceMappingURL=CombatDefinitions.js.map