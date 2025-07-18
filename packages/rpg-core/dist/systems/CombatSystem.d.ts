import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import { CombatSession, HitResult, CombatComponent, StatsComponent, RPGEntity } from '../types/index';
export declare class CombatSystem extends System {
    name: string;
    enabled: boolean;
    private combatSessions;
    private hitCalculator;
    private damageCalculator;
    private combatAnimations;
    private readonly COMBAT_TICK_RATE;
    private readonly COMBAT_TIMEOUT;
    private readonly MAX_ATTACK_RANGE;
    private lastTickTime;
    constructor(world: World);
    /**
     * Initialize the combat system
     */
    init(_options: any): Promise<void>;
    /**
     * Fixed update for combat ticks
     */
    fixedUpdate(_delta: number): void;
    /**
     * Main update for visual effects
     */
    update(_delta: number): void;
    /**
     * Initiate an attack
     */
    initiateAttack(attackerId: string, targetId: string): boolean;
    /**
     * Process combat tick for all active sessions
     */
    private processCombatTick;
    /**
     * Perform an attack
     */
    private performAttack;
    /**
     * Calculate hit result
     */
    calculateHit(attacker: RPGEntity, target: RPGEntity): HitResult;
    /**
     * Apply damage to target
     */
    applyDamage(target: RPGEntity, damage: number, source: RPGEntity): void;
    /**
     * Handle entity death from event system
     */
    private handleEntityDeath;
    /**
     * Handle entity death (internal combat death)
     */
    private handleDeath;
    /**
     * End combat for an entity
     */
    endCombat(entityId: string): void;
    /**
     * Check if attacker can attack target
     */
    private canAttack;
    /**
     * Check if entity is in a safe zone
     */
    private isInSafeZone;
    /**
     * Check if entity is in wilderness
     */
    private isInWilderness;
    /**
     * Get wilderness level for entity
     */
    private getWildernessLevel;
    /**
     * Check if position is in multi-combat area
     */
    private isInMultiCombat;
    /**
     * Check if position is within a zone
     */
    private isPositionInZone;
    /**
     * Get session where entity is the target
     */
    private getTargetSession;
    /**
     * Create combat session
     */
    private createCombatSession;
    /**
     * Create miss result
     */
    private createMissResult;
    /**
     * Queue hit splat for display
     */
    private queueHitSplat;
    /**
     * Update hit splats
     */
    private updateHitSplats;
    /**
     * Check for combat timeouts
     */
    private checkCombatTimeouts;
    /**
     * Get attack speed in milliseconds
     */
    private getAttackSpeed;
    /**
     * Get attack type based on equipment
     */
    private getAttackType;
    /**
     * Get attack range based on weapon
     */
    private getAttackRange;
    /**
     * Get equipped weapon
     */
    private getEquippedWeapon;
    /**
     * Calculate distance between entities
     */
    private getDistance;
    /**
     * Get entity position from movement component
     */
    private getEntityPosition;
    /**
     * Get entity from world and cast to RPGEntity
     */
    private getEntity;
    /**
     * Safely cast entity to RPGEntity
     */
    private asRPGEntity;
    /**
     * Check if entity is in combat
     */
    isInCombat(entityId: string): boolean;
    /**
     * Get combat session for entity
     */
    getCombatSession(entityId: string): CombatSession | null;
    /**
     * Force end combat (admin command)
     */
    forceEndCombat(entityId: string): void;
    /**
     * Get or create combat component for entity
     */
    getOrCreateCombatComponent(entityId: string): CombatComponent;
    /**
     * Calculate maximum hit damage
     */
    calculateMaxHit(stats: StatsComponent, attackType: string, style: string): number;
    /**
     * Calculate effective level with bonuses
     */
    calculateEffectiveLevel(baseLevel: number, prayerBonus: number, potionBonus: number, style: string): number;
    /**
     * Grant combat XP based on damage and attack type
     */
    grantCombatXP(entityId: string, damage: number, attackType: string): void;
    /**
     * Handle entity death with proper event emission
     */
    handleEntityDeathWithKiller(deadEntityId: string, killerId: string): void;
    /**
     * Regenerate special attack energy
     */
    regenerateSpecialAttack(): void;
    /**
     * Handle attack event
     */
    private handleAttackEvent;
    /**
     * Handle special attack event
     */
    private handleSpecialAttackEvent;
    /**
     * Perform special attack
     */
    private performSpecialAttack;
    /**
     * Calculate special attack hit
     */
    private calculateSpecialHit;
}
//# sourceMappingURL=CombatSystem.d.ts.map