import { World } from '@hyperfy/sdk';
import { AttackType, RPGEntity, CombatStyle } from '../../types/index';
export declare class CombatAnimationManager {
    private world;
    private activeAnimations;
    private animationQueue;
    private readonly animations;
    constructor(world: World);
    /**
     * Update animation states
     */
    update(_delta: number): void;
    /**
     * Play attack animation based on attack type
     */
    playAttackAnimation(attacker: RPGEntity, attackType: AttackType, style?: CombatStyle): void;
    /**
     * Play block/defense animation
     */
    playDefenseAnimation(defender: RPGEntity): void;
    /**
     * Play hit reaction animation
     */
    playHitReaction(entity: RPGEntity): void;
    /**
     * Play death animation
     */
    playDeathAnimation(entity: RPGEntity): void;
    /**
     * Play a specific animation
     */
    private playAnimation;
    /**
     * Cancel animation
     */
    cancelAnimation(entityId: string): void;
    /**
     * Handle animation completion
     */
    private onAnimationComplete;
    /**
     * Broadcast animation to all clients
     */
    private broadcastAnimation;
    /**
     * Check if entity is playing an animation
     */
    isAnimating(entityId: string): boolean;
    /**
     * Get current animation for entity
     */
    getCurrentAnimation(entityId: string): string | null;
    /**
     * Determine specific animation based on attack type and weapon
     */
    private determineAnimation;
    /**
     * Get equipped weapon
     */
    private getEquippedWeapon;
    /**
     * Queue animation for entity
     */
    queueAnimation(entityId: string, attackType: AttackType, style: CombatStyle, damage?: number, targetId?: string): void;
    /**
     * Get default animation name for attack type
     */
    private getDefaultAnimationName;
    /**
     * Get animation duration
     */
    private getAnimationDuration;
}
//# sourceMappingURL=CombatAnimationManager.d.ts.map