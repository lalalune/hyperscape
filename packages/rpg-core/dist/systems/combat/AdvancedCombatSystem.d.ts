/**
 * Advanced Combat System - Full RuneScape-style combat mechanics
 * Handles melee, ranged, and magic combat with proper timing, range, and damage
 */
import { System } from '@hyperfy/sdk';
import type { World } from '../../../types';
import { CombatStyle, AttackStyle } from './CombatDefinitions';
interface CombatComponent {
    type: 'combat';
    currentHitpoints: number;
    maxHitpoints: number;
    combatLevel: number;
    attackStyle: AttackStyle;
    autoRetaliate: boolean;
    inCombat: boolean;
    lastAttackTime: number;
    target?: string;
    specialAttackEnergy: number;
    poisoned: boolean;
    stunned: boolean;
    frozen: boolean;
}
interface EquipmentComponent {
    type: 'equipment';
    slots: Record<string, any>;
    totalWeight: number;
    bonuses: {
        attackBonus: number;
        strengthBonus: number;
        defenceBonus: number;
        rangedBonus: number;
        rangedDefence: number;
        magicBonus: number;
        magicDefence: number;
        prayer: number;
    };
}
export declare class AdvancedCombatSystem extends System {
    private activeAttacks;
    private combatQueue;
    private attackCounter;
    private readonly TICK_RATE;
    constructor(world: World);
    initialize(): Promise<void>;
    private handlePlayerJoined;
    createCombatComponent(entityId: string): CombatComponent | null;
    createEquipmentComponent(entityId: string): EquipmentComponent | null;
    equipItem(entityId: string, itemId: string, slot: string): boolean;
    unequipItem(entityId: string, slot: string): boolean;
    private recalculateBonuses;
    private handleAttackInitiated;
    private handleTargetSelected;
    private handleSpecialAttack;
    private handleMagicAttack;
    startAttack(attackerId: string, targetId: string): boolean;
    private getAttackDelay;
    private completeAttack;
    private calculateHitChance;
    private calculateDamage;
    private getCombatStats;
    /**
     * Safely get equipment component from entity
     */
    private getEquipmentComponent;
    /**
     * Safely get movement component from entity
     */
    private getMovementComponent;
    private getDefenderCombatStyle;
    dealDamage(attackerId: string, targetId: string, damage: number, damageType: CombatStyle, source?: string): void;
    private awardCombatExperience;
    private handleDeath;
    private respawnEntity;
    private handleAutoRetaliate;
    private scheduleNextAttack;
    private executeSpecialAttack;
    private getDistance;
    stopCombat(entityId: string): void;
    getCombatComponent(entityId: string): CombatComponent | null;
    update(deltaTime: number): void;
    serialize(): any;
    deserialize(data: any): void;
}
export {};
//# sourceMappingURL=AdvancedCombatSystem.d.ts.map