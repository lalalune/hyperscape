"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
class SkillsSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.xpTable = [];
        this.xpDrops = [];
        this.skillMilestones = new Map();
        this.pendingSaves = new Set(); // Track entities with pending saves
        this.generateXPTable();
        this.setupSkillMilestones();
        this.setupEventListeners();
        this.startAutoSave();
    }
    setupEventListeners() {
        // Listen for XP gain events from other systems
        this.world.events.on('combat:kill', this.handleCombatKill.bind(this));
        this.world.events.on('skill:action', this.handleSkillAction.bind(this));
        this.world.events.on('quest:complete', this.handleQuestComplete.bind(this));
        // Listen for player events
        this.world.events.on('player:disconnect', this.handlePlayerDisconnect.bind(this));
        this.world.events.on('player:connect', this.handlePlayerConnect.bind(this));
    }
    startAutoSave() {
        // Save pending skill changes every 10 seconds
        this.saveTimer = setInterval(() => {
            this.savePendingSkills();
        }, 10000);
    }
    update(_deltaTime) {
        // Clean up old XP drops (for UI)
        const currentTime = Date.now();
        this.xpDrops = this.xpDrops.filter(drop => currentTime - drop.timestamp < 3000 // Keep for 3 seconds
        );
    }
    /**
     * Grant XP to a specific skill
     */
    grantXP(entityId, skill, amount) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const stats = entity.getComponent('stats');
        if (!stats) {
            return;
        }
        const skillData = stats[skill];
        if (!skillData) {
            console.warn(`Skill ${skill} not found on entity ${entityId}`);
            return;
        }
        // Apply XP modifiers (e.g., from equipment, prayers, etc.)
        const modifiedAmount = this.calculateModifiedXP(entity, skill, amount);
        // Check XP cap
        const oldXP = skillData.xp;
        const newXP = Math.min(oldXP + modifiedAmount, SkillsSystem.MAX_XP);
        const actualGain = newXP - oldXP;
        if (actualGain <= 0) {
            return;
        }
        // Update XP
        skillData.xp = newXP;
        // Check for level up
        const oldLevel = skillData.level;
        const newLevel = this.getLevelForXP(newXP);
        if (newLevel > oldLevel) {
            this.handleLevelUp(entity, skill, oldLevel, newLevel);
        }
        // Update combat level if it's a combat skill
        if (SkillsSystem.COMBAT_SKILLS.includes(skill)) {
            this.updateCombatLevel(entity, stats);
        }
        // Update total level
        this.updateTotalLevel(entity, stats);
        // Add XP drop for UI
        this.xpDrops.push({
            entityId,
            skill,
            amount: actualGain,
            timestamp: Date.now(),
        });
        // Mark entity for saving
        this.pendingSaves.add(entityId);
        // Emit XP gained event
        this.world.events.emit('xp:gained', {
            entityId,
            skill,
            amount: actualGain,
            totalXP: newXP,
            level: skillData.level,
        });
    }
    /**
     * Get the level for a given amount of XP
     */
    getLevelForXP(xp) {
        for (let level = SkillsSystem.MAX_LEVEL; level >= 1; level--) {
            if (xp >= this.xpTable[level]) {
                return level;
            }
        }
        return 1;
    }
    /**
     * Get the XP required for a specific level
     */
    getXPForLevel(level) {
        if (level < 1) {
            return 0;
        }
        if (level > SkillsSystem.MAX_LEVEL) {
            return this.xpTable[SkillsSystem.MAX_LEVEL];
        }
        return this.xpTable[level];
    }
    /**
     * Get XP remaining to next level
     */
    getXPToNextLevel(skill) {
        if (skill.level >= SkillsSystem.MAX_LEVEL) {
            return 0;
        }
        const nextLevelXP = this.getXPForLevel(skill.level + 1);
        return nextLevelXP - skill.xp;
    }
    /**
     * Get XP progress percentage to next level
     */
    getXPProgress(skill) {
        if (skill.level >= SkillsSystem.MAX_LEVEL) {
            return 100;
        }
        const currentLevelXP = this.getXPForLevel(skill.level);
        const nextLevelXP = this.getXPForLevel(skill.level + 1);
        const progressXP = skill.xp - currentLevelXP;
        const requiredXP = nextLevelXP - currentLevelXP;
        return (progressXP / requiredXP) * 100;
    }
    /**
     * Check if entity meets skill requirements
     */
    meetsRequirements(entity, requirements) {
        const stats = entity.getComponent('stats');
        if (!stats) {
            return false;
        }
        for (const [skill, requiredLevel] of Object.entries(requirements)) {
            const skillData = stats[skill];
            if (!skillData || skillData.level < requiredLevel) {
                return false;
            }
        }
        return true;
    }
    /**
     * Get combat level for an entity
     */
    getCombatLevel(stats) {
        // RuneScape combat level formula
        const base = 0.25 * (stats.defense.level + stats.hitpoints.level + Math.floor(stats.prayer.level / 2));
        const melee = 0.325 * (stats.attack.level + stats.strength.level);
        const ranged = 0.325 * Math.floor(stats.ranged.level * 1.5);
        const magic = 0.325 * Math.floor(stats.magic.level * 1.5);
        return Math.floor(base + Math.max(melee, ranged, magic));
    }
    /**
     * Get total level (sum of all skill levels)
     */
    getTotalLevel(stats) {
        let total = 0;
        // Sum all skill levels
        const skills = [
            'attack',
            'strength',
            'defense',
            'ranged',
            'magic',
            'prayer',
            'hitpoints',
            'mining',
            'smithing',
            'fishing',
            'cooking',
            'woodcutting',
            'firemaking',
            'crafting',
            'herblore',
            'agility',
            'thieving',
            'slayer',
            'farming',
            'runecrafting',
            'hunter',
            'construction',
        ];
        for (const skill of skills) {
            const skillData = stats[skill];
            if (skillData) {
                total += skillData.level;
            }
        }
        return total;
    }
    /**
     * Get total XP across all skills
     */
    getTotalXP(stats) {
        let total = 0;
        const skills = [
            'attack',
            'strength',
            'defense',
            'ranged',
            'magic',
            'prayer',
            'hitpoints',
            'mining',
            'smithing',
            'fishing',
            'cooking',
            'woodcutting',
            'firemaking',
            'crafting',
            'herblore',
            'agility',
            'thieving',
            'slayer',
            'farming',
            'runecrafting',
            'hunter',
            'construction',
        ];
        for (const skill of skills) {
            const skillData = stats[skill];
            if (skillData) {
                total += skillData.xp;
            }
        }
        return total;
    }
    /**
     * Reset a skill to level 1
     */
    resetSkill(entityId, skill) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const stats = entity.getComponent('stats');
        if (!stats) {
            return;
        }
        const skillData = stats[skill];
        if (!skillData) {
            return;
        }
        skillData.level = 1;
        skillData.xp = 0;
        // Update combat level if needed
        if (SkillsSystem.COMBAT_SKILLS.includes(skill)) {
            this.updateCombatLevel(entity, stats);
        }
        this.updateTotalLevel(entity, stats);
        this.world.events.emit('skill:reset', {
            entityId,
            skill,
        });
    }
    /**
     * Set skill level directly (for admin commands)
     */
    setSkillLevel(entityId, skill, level) {
        if (level < 1 || level > SkillsSystem.MAX_LEVEL) {
            console.warn(`Invalid level ${level} for skill ${skill}`);
            return;
        }
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return;
        }
        const stats = entity.getComponent('stats');
        if (!stats) {
            return;
        }
        const skillData = stats[skill];
        if (!skillData) {
            return;
        }
        const oldLevel = skillData.level;
        skillData.level = level;
        skillData.xp = this.getXPForLevel(level);
        if (level > oldLevel) {
            this.handleLevelUp(entity, skill, oldLevel, level);
        }
        // Update combat level if needed
        if (SkillsSystem.COMBAT_SKILLS.includes(skill)) {
            this.updateCombatLevel(entity, stats);
        }
        this.updateTotalLevel(entity, stats);
    }
    generateXPTable() {
        this.xpTable = [0, 0]; // Levels 0 and 1
        for (let level = 2; level <= SkillsSystem.MAX_LEVEL; level++) {
            const xp = Math.floor(level - 1 + 300 * Math.pow(2, (level - 1) / 7)) / 4;
            this.xpTable.push(Math.floor(this.xpTable[level - 1] + xp));
        }
    }
    setupSkillMilestones() {
        // Define special milestones for each skill
        const commonMilestones = [
            { level: 50, name: 'Halfway', message: 'Halfway to mastery!' },
            { level: 92, name: 'Half XP', message: 'Halfway to 99 in XP!' },
            { level: 99, name: 'Mastery', message: 'Skill mastered!' },
        ];
        // Apply common milestones to all skills
        const skills = [
            'attack',
            'strength',
            'defense',
            'ranged',
            'magic',
            'prayer',
            'hitpoints',
            'mining',
            'smithing',
            'fishing',
            'cooking',
            'woodcutting',
            'firemaking',
            'crafting',
            'herblore',
            'agility',
            'thieving',
            'slayer',
            'farming',
            'runecrafting',
            'hunter',
            'construction',
        ];
        for (const skill of skills) {
            this.skillMilestones.set(skill, [...commonMilestones]);
        }
        // Add skill-specific milestones
        const combatMilestones = this.skillMilestones.get('attack');
        combatMilestones.push({ level: 40, name: 'Rune Weapons', message: 'You can now wield rune weapons!' }, { level: 60, name: 'Dragon Weapons', message: 'You can now wield dragon weapons!' });
    }
    handleLevelUp(entity, skill, oldLevel, newLevel) {
        const stats = entity.getComponent('stats');
        if (!stats) {
            return;
        }
        const skillData = stats[skill];
        skillData.level = newLevel;
        // Check for milestones
        const milestones = this.skillMilestones.get(skill) || [];
        for (const milestone of milestones) {
            if (milestone.level > oldLevel && milestone.level <= newLevel) {
                this.world.events.emit('skill:milestone', {
                    entityId: entity.id,
                    skill,
                    milestone,
                });
            }
        }
        // Special handling for HP level up
        if (skill === 'hitpoints') {
            const newMax = this.calculateMaxHitpoints(newLevel);
            stats.hitpoints.max = newMax;
            // Heal to full on HP level up
            stats.hitpoints.current = newMax;
        }
        // Special handling for Prayer level up
        if (skill === 'prayer') {
            const newMax = newLevel;
            stats.prayer.maxPoints = newMax;
        }
        this.world.events.emit('skill:levelup', {
            entityId: entity.id,
            skill,
            oldLevel,
            newLevel,
            totalLevel: stats.totalLevel,
        });
    }
    calculateMaxHitpoints(level) {
        // RuneScape formula: 10 + level
        return 10 + level;
    }
    updateCombatLevel(entity, stats) {
        const oldCombatLevel = stats.combatLevel;
        const newCombatLevel = this.getCombatLevel(stats);
        if (newCombatLevel !== oldCombatLevel) {
            stats.combatLevel = newCombatLevel;
            this.world.events.emit('combat:levelChanged', {
                entityId: entity.id,
                oldLevel: oldCombatLevel,
                newLevel: newCombatLevel,
            });
        }
    }
    updateTotalLevel(entity, stats) {
        const oldTotalLevel = stats.totalLevel;
        const newTotalLevel = this.getTotalLevel(stats);
        if (newTotalLevel !== oldTotalLevel) {
            stats.totalLevel = newTotalLevel;
            this.world.events.emit('total:levelChanged', {
                entityId: entity.id,
                oldLevel: oldTotalLevel,
                newLevel: newTotalLevel,
            });
        }
    }
    calculateModifiedXP(entity, skill, baseXP) {
        let modifier = 1.0;
        // Check for XP-boosting equipment
        const inventory = entity.getComponent('inventory');
        if (inventory && inventory.equipment) {
            // Example: Wisdom amulet gives 5% XP boost
            if (inventory.equipment.amulet?.name === 'wisdom_amulet') {
                modifier += 0.05;
            }
        }
        // Check for active XP events (if events system exists)
        const eventsSystem = this.world.getSystem?.('events');
        if (eventsSystem && typeof eventsSystem.getActiveEvents === 'function') {
            const activeEvents = eventsSystem.getActiveEvents() || [];
            for (const event of activeEvents) {
                if (event.type === 'double_xp') {
                    modifier *= 2;
                }
                else if (event.type === 'bonus_xp' && event.skills?.includes(skill)) {
                    modifier += event.bonusRate || 0.5;
                }
            }
        }
        return Math.floor(baseXP * modifier);
    }
    // Event handlers
    handleCombatKill(data) {
        const { attackerId, targetId, damageDealt, attackStyle } = data;
        const target = this.world.entities.get(targetId);
        if (!target) {
            return;
        }
        const targetStats = target.getComponent('stats');
        if (!targetStats) {
            return;
        }
        // Calculate XP based on target's hitpoints
        const baseXP = targetStats.hitpoints.max * 4; // 4 XP per hitpoint
        // Grant XP based on attack style
        switch (attackStyle) {
            case 'accurate':
                this.grantXP(attackerId, 'attack', baseXP);
                break;
            case 'aggressive':
                this.grantXP(attackerId, 'strength', baseXP);
                break;
            case 'defensive':
                this.grantXP(attackerId, 'defense', baseXP);
                break;
            case 'controlled':
                // Split XP between attack, strength, and defense
                this.grantXP(attackerId, 'attack', baseXP / 3);
                this.grantXP(attackerId, 'strength', baseXP / 3);
                this.grantXP(attackerId, 'defense', baseXP / 3);
                break;
            case 'ranged':
                this.grantXP(attackerId, 'ranged', baseXP);
                break;
            case 'magic':
                this.grantXP(attackerId, 'magic', baseXP);
                break;
        }
        // Always grant HP XP
        this.grantXP(attackerId, 'hitpoints', baseXP / 3);
    }
    handleSkillAction(data) {
        this.grantXP(data.entityId, data.skill, data.xp);
    }
    handleQuestComplete(data) {
        if (!data.rewards.xp) {
            return;
        }
        for (const [skill, xp] of Object.entries(data.rewards.xp)) {
            this.grantXP(data.playerId, skill, xp);
        }
    }
    // Public getters
    getXPDrops() {
        return [...this.xpDrops];
    }
    getSkillData(entityId, skill) {
        const entity = this.world.entities.get(entityId);
        if (!entity) {
            return null;
        }
        const stats = entity.getComponent('stats');
        if (!stats) {
            return null;
        }
        return stats[skill] || null;
    }
    /**
     * Load player skills from persistence
     */
    async loadPlayerSkills(playerId) {
        const persistence = this.world.getSystem('persistence');
        if (!persistence)
            return;
        try {
            const skills = await persistence.loadPlayerSkills(playerId);
            const entity = this.world.entities.get(playerId);
            if (!entity)
                return;
            const stats = entity.getComponent('stats');
            if (!stats)
                return;
            // Apply loaded skills
            for (const skillData of skills) {
                const skill = stats[skillData.type];
                if (skill) {
                    skill.level = skillData.level;
                    skill.xp = skillData.experience;
                }
            }
            // Update derived stats
            this.updateCombatLevel(entity, stats);
            this.updateTotalLevel(entity, stats);
            console.log(`[SkillsSystem] Loaded skills for player ${playerId}`);
        }
        catch (error) {
            console.error(`[SkillsSystem] Failed to load skills for ${playerId}:`, error);
        }
    }
    /**
     * Save player skills to persistence
     */
    async savePlayerSkills(playerId) {
        const persistence = this.world.getSystem('persistence');
        if (!persistence)
            return;
        const entity = this.world.entities.get(playerId);
        if (!entity)
            return;
        const stats = entity.getComponent('stats');
        if (!stats)
            return;
        try {
            const skills = [];
            // Collect all skills
            const skillTypes = [
                'attack', 'strength', 'defense', 'ranged', 'magic', 'prayer', 'hitpoints',
                'mining', 'smithing', 'fishing', 'cooking', 'woodcutting', 'firemaking',
                'crafting', 'herblore', 'agility', 'thieving', 'slayer', 'farming',
                'runecrafting', 'hunter', 'construction'
            ];
            for (const skillType of skillTypes) {
                const skill = stats[skillType];
                if (skill) {
                    skills.push({
                        type: skillType,
                        level: skill.level,
                        experience: skill.xp
                    });
                }
            }
            await persistence.savePlayerSkills(playerId, skills);
            console.log(`[SkillsSystem] Saved skills for player ${playerId}`);
        }
        catch (error) {
            console.error(`[SkillsSystem] Failed to save skills for ${playerId}:`, error);
        }
    }
    /**
     * Save all pending skill updates
     */
    async savePendingSkills() {
        if (this.pendingSaves.size === 0)
            return;
        const persistence = this.world.getSystem('persistence');
        if (!persistence)
            return;
        const toSave = Array.from(this.pendingSaves);
        this.pendingSaves.clear();
        for (const entityId of toSave) {
            // Only save if it's a player entity
            const entity = this.world.entities.get(entityId);
            if (entity && entity.type === 'player') {
                await this.savePlayerSkills(entityId);
            }
        }
    }
    /**
     * Handle player connect event
     */
    async handlePlayerConnect(data) {
        await this.loadPlayerSkills(data.playerId);
    }
    /**
     * Handle player disconnect event
     */
    async handlePlayerDisconnect(data) {
        // Save skills immediately on disconnect
        await this.savePlayerSkills(data.playerId);
        this.pendingSaves.delete(data.playerId);
    }
}
exports.SkillsSystem = SkillsSystem;
SkillsSystem.MAX_LEVEL = 99;
SkillsSystem.MAX_XP = 200000000; // 200M XP cap
SkillsSystem.COMBAT_SKILLS = [
    'attack',
    'strength',
    'defense',
    'ranged',
    'magic',
    'hitpoints',
    'prayer',
];
//# sourceMappingURL=SkillsSystem.js.map