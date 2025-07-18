"use strict";
/**
 * Skill Definitions - RuneScape-like skill system
 * Defines all skills, experience tables, and requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_DEFINITIONS = exports.XP_TABLE = exports.SkillType = void 0;
exports.getXPForLevel = getXPForLevel;
exports.getLevelForXP = getLevelForXP;
exports.getXPToNextLevel = getXPToNextLevel;
exports.getCombatLevel = getCombatLevel;
var SkillType;
(function (SkillType) {
    // Combat Skills
    SkillType["ATTACK"] = "attack";
    SkillType["STRENGTH"] = "strength";
    SkillType["DEFENCE"] = "defence";
    SkillType["MAGIC"] = "magic";
    SkillType["RANGED"] = "ranged";
    SkillType["PRAYER"] = "prayer";
    // Gathering Skills
    SkillType["WOODCUTTING"] = "woodcutting";
    SkillType["MINING"] = "mining";
    SkillType["FISHING"] = "fishing";
    // Crafting Skills
    SkillType["SMITHING"] = "smithing";
    SkillType["COOKING"] = "cooking";
    SkillType["CRAFTING"] = "crafting";
    SkillType["FLETCHING"] = "fletching";
    // Other Skills
    SkillType["AGILITY"] = "agility";
    SkillType["THIEVING"] = "thieving";
    SkillType["HITPOINTS"] = "hitpoints";
    SkillType["FIREMAKING"] = "firemaking";
    SkillType["HERBLORE"] = "herblore";
    SkillType["CONSTRUCTION"] = "construction";
    SkillType["FARMING"] = "farming";
    SkillType["HUNTER"] = "hunter";
    SkillType["RUNECRAFTING"] = "runecrafting";
    SkillType["SLAYER"] = "slayer";
})(SkillType || (exports.SkillType = SkillType = {}));
// RuneScape XP Table (levels 1-99)
exports.XP_TABLE = [
    0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470, 5018,
    5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363, 14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408,
    33648, 37224, 41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333, 111945, 123660, 136594, 150872,
    166636, 184040, 203254, 224466, 247886, 273742, 302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032,
    668051, 737627, 814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 1986068, 2192818,
    2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332, 5902831, 6517253, 7195629, 7944614,
    8771558, 9684577, 10692629, 11805606, 13034431,
];
exports.SKILL_DEFINITIONS = {
    [SkillType.ATTACK]: {
        type: SkillType.ATTACK,
        name: 'Attack',
        description: 'Determines which weapons you can wield',
        isCombat: true,
        maxLevel: 99,
        baseXP: 4,
        multiplier: 1,
    },
    [SkillType.STRENGTH]: {
        type: SkillType.STRENGTH,
        name: 'Strength',
        description: 'Increases your melee damage',
        isCombat: true,
        maxLevel: 99,
        baseXP: 4,
        multiplier: 1,
    },
    [SkillType.DEFENCE]: {
        type: SkillType.DEFENCE,
        name: 'Defence',
        description: 'Determines which armor you can wear',
        isCombat: true,
        maxLevel: 99,
        baseXP: 4,
        multiplier: 1,
    },
    [SkillType.MAGIC]: {
        type: SkillType.MAGIC,
        name: 'Magic',
        description: 'Determines which spells you can cast',
        isCombat: true,
        maxLevel: 99,
        baseXP: 2,
        multiplier: 1,
    },
    [SkillType.RANGED]: {
        type: SkillType.RANGED,
        name: 'Ranged',
        description: 'Determines which ranged weapons you can use',
        isCombat: true,
        maxLevel: 99,
        baseXP: 4,
        multiplier: 1,
    },
    [SkillType.PRAYER]: {
        type: SkillType.PRAYER,
        name: 'Prayer',
        description: 'Allows use of prayers for combat bonuses',
        isCombat: true,
        maxLevel: 99,
        baseXP: 5,
        multiplier: 1,
    },
    [SkillType.HITPOINTS]: {
        type: SkillType.HITPOINTS,
        name: 'Hitpoints',
        description: 'Determines your life points',
        isCombat: true,
        maxLevel: 99,
        baseXP: 4,
        multiplier: 1.33,
    },
    [SkillType.WOODCUTTING]: {
        type: SkillType.WOODCUTTING,
        name: 'Woodcutting',
        description: 'Allows you to cut down trees',
        isCombat: false,
        maxLevel: 99,
        baseXP: 25,
        multiplier: 1,
    },
    [SkillType.MINING]: {
        type: SkillType.MINING,
        name: 'Mining',
        description: 'Allows you to mine ores from rocks',
        isCombat: false,
        maxLevel: 99,
        baseXP: 17.5,
        multiplier: 1,
    },
    [SkillType.FISHING]: {
        type: SkillType.FISHING,
        name: 'Fishing',
        description: 'Allows you to catch fish',
        isCombat: false,
        maxLevel: 99,
        baseXP: 10,
        multiplier: 1,
    },
    [SkillType.SMITHING]: {
        type: SkillType.SMITHING,
        name: 'Smithing',
        description: 'Allows you to smelt ores and smith equipment',
        isCombat: false,
        maxLevel: 99,
        baseXP: 12.5,
        multiplier: 1,
    },
    [SkillType.COOKING]: {
        type: SkillType.COOKING,
        name: 'Cooking',
        description: 'Allows you to cook food',
        isCombat: false,
        maxLevel: 99,
        baseXP: 30,
        multiplier: 1,
    },
    [SkillType.CRAFTING]: {
        type: SkillType.CRAFTING,
        name: 'Crafting',
        description: 'Allows you to craft items from materials',
        isCombat: false,
        maxLevel: 99,
        baseXP: 17.5,
        multiplier: 1,
    },
    [SkillType.FLETCHING]: {
        type: SkillType.FLETCHING,
        name: 'Fletching',
        description: 'Allows you to make ranged weapons and ammo',
        isCombat: false,
        maxLevel: 99,
        baseXP: 15,
        multiplier: 1,
    },
    [SkillType.AGILITY]: {
        type: SkillType.AGILITY,
        name: 'Agility',
        description: 'Increases run energy and unlocks shortcuts',
        isCombat: false,
        maxLevel: 99,
        baseXP: 7.5,
        multiplier: 1,
    },
    [SkillType.THIEVING]: {
        type: SkillType.THIEVING,
        name: 'Thieving',
        description: 'Allows you to steal from NPCs and chests',
        isCombat: false,
        maxLevel: 99,
        baseXP: 8.5,
        multiplier: 1,
    },
    [SkillType.FIREMAKING]: {
        type: SkillType.FIREMAKING,
        name: 'Firemaking',
        description: 'Allows you to light fires',
        isCombat: false,
        maxLevel: 99,
        baseXP: 40,
        multiplier: 1,
    },
    [SkillType.HERBLORE]: {
        type: SkillType.HERBLORE,
        name: 'Herblore',
        description: 'Allows you to mix potions',
        isCombat: false,
        maxLevel: 99,
        baseXP: 8,
        multiplier: 1,
    },
    [SkillType.CONSTRUCTION]: {
        type: SkillType.CONSTRUCTION,
        name: 'Construction',
        description: 'Allows you to build houses',
        isCombat: false,
        maxLevel: 99,
        baseXP: 15,
        multiplier: 1,
    },
    [SkillType.FARMING]: {
        type: SkillType.FARMING,
        name: 'Farming',
        description: 'Allows you to grow crops',
        isCombat: false,
        maxLevel: 99,
        baseXP: 10,
        multiplier: 1,
    },
    [SkillType.RUNECRAFTING]: {
        type: SkillType.RUNECRAFTING,
        name: 'Runecrafting',
        description: 'Allows you to craft runes',
        isCombat: false,
        maxLevel: 99,
        baseXP: 5,
        multiplier: 1,
    },
    [SkillType.HUNTER]: {
        type: SkillType.HUNTER,
        name: 'Hunter',
        description: 'Allows you to track and trap animals',
        isCombat: false,
        maxLevel: 99,
        baseXP: 10,
        multiplier: 1,
    },
    [SkillType.SLAYER]: {
        type: SkillType.SLAYER,
        name: 'Slayer',
        description: 'Allows you to kill specific monsters',
        isCombat: false,
        maxLevel: 99,
        baseXP: 15,
        multiplier: 1,
    },
};
// Skill utility functions
function getXPForLevel(level) {
    if (level < 1) {
        return 0;
    }
    if (level > 99) {
        return exports.XP_TABLE[98];
    }
    return exports.XP_TABLE[level - 1];
}
function getLevelForXP(xp) {
    for (let i = 98; i >= 0; i--) {
        if (xp >= exports.XP_TABLE[i]) {
            return i + 1;
        }
    }
    return 1;
}
function getXPToNextLevel(currentXP) {
    const currentLevel = getLevelForXP(currentXP);
    if (currentLevel >= 99) {
        return 0;
    }
    const nextLevelXP = getXPForLevel(currentLevel + 1);
    return nextLevelXP - currentXP;
}
function getCombatLevel(skills) {
    const attack = skills[SkillType.ATTACK]?.level || 1;
    const strength = skills[SkillType.STRENGTH]?.level || 1;
    const defence = skills[SkillType.DEFENCE]?.level || 1;
    const hitpoints = skills[SkillType.HITPOINTS]?.level || 10;
    const prayer = skills[SkillType.PRAYER]?.level || 1;
    const ranged = skills[SkillType.RANGED]?.level || 1;
    const magic = skills[SkillType.MAGIC]?.level || 1;
    const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
    const melee = 0.325 * (attack + strength);
    const range = 0.325 * (ranged + Math.floor(ranged / 2));
    const mage = 0.325 * (magic + Math.floor(magic / 2));
    return Math.floor(base + Math.max(melee, range, mage));
}
//# sourceMappingURL=SkillDefinitions.js.map