"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsSystem = void 0;
const sdk_1 = require("@hyperfy/sdk");
class StatsSystem extends sdk_1.System {
    constructor(world) {
        super(world);
        this.name = 'StatsSystem';
        this.enabled = true;
        // Player stats storage
        this.playerStats = new Map();
    }
    /**
     * Get XP required for a specific level (public interface for tests)
     */
    getXPForLevel(level) {
        return this.levelToXp(level);
    }
    /**
     * Get level for a specific XP amount (public interface for tests)
     */
    getLevelForXP(xp) {
        return this.xpToLevel(xp);
    }
    /**
     * Grant XP to a player and handle level ups
     */
    grantXP(playerId, skill, amount, source) {
        let stats = this.getPlayerStats(playerId);
        if (!stats) {
            // Create initial stats for new player
            stats = this.createInitialStats();
            this.setPlayerStats(playerId, stats);
        }
        // Handle defence vs defense naming inconsistency
        // The tests expect 'defence' to be the canonical skill name
        const normalizedSkill = skill === 'defense' ? 'defence' : skill;
        const skillData = stats[normalizedSkill];
        if (!skillData) {
            console.warn(`Unknown skill: ${skill}`);
            return;
        }
        const oldLevel = skillData.level;
        const oldXp = skillData.xp;
        // Add XP
        skillData.xp += amount;
        skillData.experience = skillData.xp;
        // Calculate new level
        const newLevel = this.xpToLevel(skillData.xp);
        skillData.level = newLevel;
        // Special handling for hitpoints - update max and current HP
        if (normalizedSkill === 'hitpoints') {
            const oldMax = stats.hitpoints.max;
            stats.hitpoints.max = newLevel * 10; // 10 HP per level
            // Heal player when leveling hitpoints (RuneScape mechanic - full heal on level up)
            if (newLevel > oldLevel) {
                stats.hitpoints.current = stats.hitpoints.max; // Full heal on HP level up
            }
            // For hitpoints, current represents current HP, not level
            skillData.current = stats.hitpoints.current;
        }
        else {
            // For other skills, current represents current level
            skillData.current = newLevel;
        }
        // Update combat level
        stats.combatLevel = this.calculateCombatLevel({
            attack: stats.attack,
            strength: stats.strength,
            defense: stats.defense, // Use 'defence' as the canonical skill
            ranged: stats.ranged,
            magic: stats.magic,
            hitpoints: stats.hitpoints,
            prayer: stats.prayer,
        });
        // Calculate total level
        stats.totalLevel = this.calculateTotalLevel(stats);
        // Save updated stats
        this.setPlayerStats(playerId, stats);
        // Emit XP gain event
        this.world.events.emit('rpg:xp_gained', {
            playerId,
            skill: normalizedSkill,
            amount,
            source,
            oldXp,
            newXp: skillData.xp,
        });
        // Check for level up
        if (newLevel > oldLevel) {
            this.world.events.emit('rpg:level_up', {
                playerId,
                skill: normalizedSkill,
                oldLevel,
                newLevel,
            });
        }
    }
    /**
     * Get player stats from storage
     */
    getPlayerStats(playerId) {
        const stats = this.playerStats.get(playerId);
        if (stats) {
            return stats;
        }
        // Try to get from world entity
        const entity = this.world.entities.players?.get(playerId);
        if (entity && entity.data) {
            const statsComponent = entity.data.stats;
            if (statsComponent) {
                this.playerStats.set(playerId, statsComponent);
                return statsComponent;
            }
        }
        return null;
    }
    /**
     * Set player stats in storage
     */
    setPlayerStats(playerId, stats) {
        this.playerStats.set(playerId, stats);
        // Also update in world entity if it exists
        const entity = this.world.entities.players?.get(playerId);
        if (entity && entity.data) {
            entity.data.stats = stats;
        }
    }
    /**
     * Check if player meets skill requirements
     */
    meetsRequirements(playerId, requirements) {
        const stats = this.getPlayerStats(playerId);
        if (!stats) {
            return false;
        }
        for (const [skill, requiredLevel] of Object.entries(requirements)) {
            const normalizedSkill = skill === 'defense' ? 'defence' : skill;
            const skillData = stats[normalizedSkill];
            if (!skillData || skillData.level < requiredLevel) {
                return false;
            }
        }
        return true;
    }
    /**
     * Calculate total level from all skills
     */
    calculateTotalLevel(stats) {
        const skills = [
            'attack', 'strength', 'defence', 'hitpoints', 'ranged', 'prayer', 'magic',
            'cooking', 'crafting', 'fletching', 'herblore', 'runecrafting', 'smithing',
            'mining', 'fishing', 'woodcutting', 'agility', 'construction', 'firemaking',
            'slayer', 'thieving', 'farming', 'hunter'
        ];
        return skills.reduce((total, skill) => {
            const skillData = stats[skill];
            return total + (skillData?.level || 1);
        }, 0);
    }
    /**
     * Handle combat XP distribution (private method for combat system integration)
     */
    handleCombatXP(event) {
        const { attackerId, damage, weaponType } = event;
        if (!attackerId || !damage) {
            return;
        }
        const baseXp = damage * 4;
        const hpXp = damage * 1.33;
        switch (weaponType) {
            case 'melee':
                this.grantXP(attackerId, 'attack', baseXp, 'combat');
                this.grantXP(attackerId, 'strength', baseXp, 'combat');
                this.grantXP(attackerId, 'defence', baseXp, 'combat');
                this.grantXP(attackerId, 'hitpoints', hpXp, 'combat');
                break;
            case 'ranged':
                this.grantXP(attackerId, 'ranged', baseXp, 'combat');
                this.grantXP(attackerId, 'defence', baseXp, 'combat');
                this.grantXP(attackerId, 'hitpoints', hpXp, 'combat');
                break;
            case 'magic':
                this.grantXP(attackerId, 'magic', damage * 2, 'combat');
                this.grantXP(attackerId, 'hitpoints', hpXp, 'combat');
                break;
        }
    }
    /**
     * Initialize the stats system
     */
    async init(_options) {
        console.log('[StatsSystem] Initializing...');
        // Register event listeners for XP gains
        this.world.events.on('rpg:xp_gain', this.handleXpGain.bind(this));
        this.world.events.on('rpg:level_up', this.handleLevelUp.bind(this));
        this.world.events.on('rpg:combat_xp', this.handleCombatXP.bind(this));
    }
    /**
     * Create initial stats for a new player
     */
    createInitialStats() {
        const initialCombatBonuses = {
            attackStab: 0,
            attackSlash: 0,
            attackCrush: 0,
            attackMagic: 0,
            attackRanged: 0,
            defenseStab: 0,
            defenseSlash: 0,
            defenseCrush: 0,
            defenseMagic: 0,
            defenseRanged: 0,
            meleeStrength: 0,
            rangedStrength: 0,
            magicDamage: 0,
            prayerBonus: 0,
        };
        const createSkill = (level) => ({
            level,
            xp: this.levelToXp(level),
            current: level,
            experience: this.levelToXp(level),
        });
        const stats = {
            type: 'stats',
            data: {},
            entityId: undefined,
            // Combat skills
            hitpoints: {
                current: 100,
                max: 100,
                level: 10,
                xp: this.levelToXp(10),
                experience: this.levelToXp(10),
            },
            attack: createSkill(1),
            strength: createSkill(1),
            defense: createSkill(1),
            ranged: createSkill(1),
            magic: createSkill(1),
            prayer: {
                level: 1,
                xp: 0,
                points: 1,
                maxPoints: 1,
                current: 1,
                experience: 0,
            },
            // Non-combat skills (all 23 skills from RuneScape)
            mining: createSkill(1),
            fishing: createSkill(1),
            woodcutting: createSkill(1),
            firemaking: createSkill(1),
            smithing: createSkill(1),
            cooking: createSkill(1),
            crafting: createSkill(1),
            fletching: createSkill(1),
            construction: createSkill(1),
            herblore: createSkill(1),
            agility: createSkill(1),
            thieving: createSkill(1),
            slayer: createSkill(1),
            farming: createSkill(1),
            runecrafting: createSkill(1),
            hunter: createSkill(1),
            // Combat bonuses
            combatBonuses: initialCombatBonuses,
            // Computed values (temporarily set to 0, will be calculated below)
            combatLevel: 0,
            totalLevel: 32, // 22 skills at level 1 + hitpoints at level 10 = 32
        };
        // Calculate combat level using the actual stats object
        stats.combatLevel = this.calculateCombatLevel({
            attack: stats.attack,
            strength: stats.strength,
            defense: stats.defense, // Use the actual defence skill we created
            ranged: stats.ranged,
            magic: stats.magic,
            hitpoints: stats.hitpoints,
            prayer: stats.prayer,
        });
        return stats;
    }
    /**
     * Handle XP gain events
     */
    handleXpGain(event) {
        const { playerId, skill, amount, source } = event;
        // This would typically update the player's stats
        // For now, just log the event
        console.log(`[StatsSystem] XP Gain: ${playerId} gained ${amount} ${skill} XP from ${source}`);
    }
    /**
     * Handle level up events
     */
    handleLevelUp(event) {
        const { playerId, skill, newLevel } = event;
        console.log(`[StatsSystem] Level Up: ${playerId} reached level ${newLevel} in ${skill}`);
        // Emit celebration event
        this.world.events.emit('rpg:level_up_celebration', {
            playerId,
            skill,
            level: newLevel,
        });
    }
    /**
     * Calculate combat level from stats
     */
    calculateCombatLevel(stats) {
        const { attack, strength, defence, defense, ranged, magic, hitpoints, prayer } = stats;
        // Use defence if available, otherwise use defense for backward compatibility
        const defenseLevel = defence?.level ?? defense?.level ?? 1;
        // RuneScape combat level formula
        const base = (defenseLevel + hitpoints.level + Math.floor(prayer.level / 2)) * 0.25;
        const melee = (attack.level + strength.level) * 0.325;
        const rangedLevel = Math.floor(ranged.level * 1.5) * 0.325;
        const magicLevel = Math.floor(magic.level * 1.5) * 0.325;
        const highest = Math.max(melee, rangedLevel, magicLevel);
        return Math.floor(base + highest);
    }
    /**
     * Convert level to XP using RuneScape formula
     */
    levelToXp(level) {
        if (level <= 1)
            return 0;
        let xp = 0;
        for (let i = 1; i < level; i++) {
            xp += Math.floor(i + 300 * Math.pow(2, i / 7)) / 4;
        }
        return Math.floor(xp);
    }
    /**
     * Convert XP to level
     */
    xpToLevel(xp) {
        for (let level = 1; level <= 99; level++) {
            if (this.levelToXp(level + 1) > xp) {
                return level;
            }
        }
        return 99;
    }
    /**
     * Add XP to a skill
     */
    addXp(stats, skill, amount) {
        const skillData = stats[skill];
        if (!skillData) {
            return { leveledUp: false, newLevel: 0 };
        }
        const oldLevel = skillData.level;
        skillData.xp += amount;
        skillData.experience = skillData.xp;
        const newLevel = this.xpToLevel(skillData.xp);
        skillData.level = newLevel;
        skillData.current = newLevel;
        // Update combat level
        stats.combatLevel = this.calculateCombatLevel({
            attack: stats.attack,
            strength: stats.strength,
            defense: stats.defense, // Use 'defence' as the canonical skill
            ranged: stats.ranged,
            magic: stats.magic,
            hitpoints: stats.hitpoints,
            prayer: stats.prayer,
        });
        return {
            leveledUp: newLevel > oldLevel,
            newLevel,
        };
    }
    /**
     * Update hitpoints
     */
    updateHitpoints(stats, current) {
        stats.hitpoints.current = Math.max(0, Math.min(current, stats.hitpoints.max));
    }
    /**
     * Heal hitpoints
     */
    heal(stats, amount) {
        const oldHp = stats.hitpoints.current;
        const newHp = Math.min(stats.hitpoints.max, oldHp + amount);
        stats.hitpoints.current = newHp;
        return newHp - oldHp;
    }
    /**
     * Take damage
     */
    takeDamage(stats, damage) {
        const newHp = Math.max(0, stats.hitpoints.current - damage);
        stats.hitpoints.current = newHp;
        return {
            newHp,
            isDead: newHp <= 0,
        };
    }
}
exports.StatsSystem = StatsSystem;
//# sourceMappingURL=StatsSystem.js.map