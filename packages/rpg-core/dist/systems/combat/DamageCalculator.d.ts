declare enum CombatStyle {
    ACCURATE = "accurate",
    AGGRESSIVE = "aggressive",
    DEFENSIVE = "defensive",
    CONTROLLED = "controlled",
    RAPID = "rapid",
    LONGRANGE = "longrange"
}
declare enum AttackType {
    MELEE = "melee",
    RANGED = "ranged",
    MAGIC = "magic"
}
interface CombatBonuses {
    attackStab: number;
    attackSlash: number;
    attackCrush: number;
    attackMagic: number;
    attackRanged: number;
    defenseStab: number;
    defenseSlash: number;
    defenseCrush: number;
    defenseMagic: number;
    defenseRanged: number;
    meleeStrength: number;
    rangedStrength: number;
    magicDamage: number;
    prayerBonus: number;
}
interface SkillData {
    level: number;
    xp: number;
    bonus?: number;
    current?: number;
    experience?: number;
    points?: number;
}
interface StatsComponent {
    type: 'stats';
    hitpoints: {
        current: number;
        max: number;
        level: number;
        xp: number;
        experience?: number;
    };
    attack: SkillData;
    strength: SkillData;
    defence?: SkillData;
    defense?: SkillData;
    ranged: SkillData;
    magic: SkillData;
    prayer: {
        level: number;
        xp: number;
        points: number;
        maxPoints: number;
        current?: number;
        experience?: number;
    };
    combatBonuses: CombatBonuses;
    combatLevel: number;
    totalLevel: number;
}
export declare class DamageCalculator {
    /**
     * Calculate maximum hit based on stats and combat style
     */
    calculateMaxHit(attacker: StatsComponent, style: CombatStyle, attackType: AttackType): number;
    /**
     * Roll damage between 0 and max hit
     */
    rollDamage(maxHit: number): number;
    /**
     * Apply damage reductions (protection prayers, etc.)
     */
    applyDamageReductions(damage: number, target: StatsComponent, attackType: AttackType, _attacker?: StatsComponent): number;
    /**
     * Get protection prayer damage multiplier
     */
    private getProtectionPrayerMultiplier;
    /**
     * Calculate defensive damage reduction from equipment
     */
    private getDefensiveDamageReduction;
    /**
     * Get special defensive reductions (e.g., from shields)
     */
    private getSpecialDefensiveReduction;
    /**
     * Calculate melee max hit
     */
    private calculateMeleeMaxHit;
    /**
     * Calculate ranged max hit
     */
    private calculateRangedMaxHit;
    /**
     * Calculate magic max hit
     */
    private calculateMagicMaxHit;
    /**
     * Get base damage for equipped spell
     */
    private getEquippedSpellDamage;
    /**
     * Get melee prayer bonus multiplier
     */
    private getMeleePrayerBonus;
    /**
     * Get ranged prayer bonus multiplier
     */
    private getRangedPrayerBonus;
    /**
     * Get magic prayer bonus multiplier
     */
    private getMagicPrayerBonus;
    /**
     * Get other melee bonuses (void, slayer helm, etc.)
     */
    private getMeleeOtherBonuses;
    /**
     * Get other ranged bonuses
     */
    private getRangedOtherBonuses;
    /**
     * Check if player has void melee set
     */
    private hasVoidMeleeSet;
    /**
     * Check if player has void ranged set
     */
    private hasVoidRangedSet;
    /**
     * Check if player has elite void ranged set
     */
    private hasEliteVoidRangedSet;
    /**
     * Get effective strength level with style bonuses
     */
    private getEffectiveStrengthLevel;
    /**
     * Get effective ranged level with style bonuses
     */
    private getEffectiveRangedLevel;
}
export {};
//# sourceMappingURL=DamageCalculator.d.ts.map