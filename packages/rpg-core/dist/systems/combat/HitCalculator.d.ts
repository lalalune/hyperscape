import { StatsComponent, CombatStyle, AttackType, CombatComponent } from '../types';
export declare class HitCalculator {
    /**
     * Calculate attack roll based on stats and combat style
     */
    calculateAttackRoll(attacker: StatsComponent, style: CombatStyle, attackType: AttackType): number;
    /**
     * Calculate defense roll
     */
    calculateDefenseRoll(defender: StatsComponent, incomingAttackType: AttackType, defenderCombatComponent?: CombatComponent): number;
    /**
     * Calculate hit chance from attack and defense rolls
     */
    calculateHitChance(attackRoll: number, defenseRoll: number): number;
    /**
     * Get effective attack level with style bonuses
     */
    private getEffectiveAttackLevel;
    /**
     * Get effective defense level with style bonuses
     */
    private getEffectiveDefenseLevel;
    /**
     * Get defender style bonus
     */
    private getDefenderStyleBonus;
    /**
     * Get defence prayer bonus multiplier
     */
    private getDefencePrayerBonus;
    /**
     * Get attack bonus based on attack type
     */
    private getAttackBonus;
    /**
     * Get defense bonus against attack type
     */
    private getDefenseBonus;
}
//# sourceMappingURL=HitCalculator.d.ts.map