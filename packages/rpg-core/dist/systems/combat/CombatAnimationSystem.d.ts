/**
 * Combat Animation System - Handles visual combat animations
 * Creates weapon swings, magic particles, and ranged projectiles
 */
import { System } from '@hyperfy/sdk';
import type { World } from '../../../types';
export declare class CombatAnimationSystem extends System {
    private activeAnimations;
    private activeEffects;
    private animationCounter;
    private effectCounter;
    constructor(world: World);
    initialize(): Promise<void>;
    private handleAttackStarted;
    private handleProjectileLaunched;
    private handleMagicCast;
    private handleDamageDealt;
    private handleEntityDied;
    playAnimation(entityId: string, animationId: string, onComplete?: () => void): string;
    private createProjectile;
    private createMagicParticles;
    private createSpellProjectile;
    private createHitSplat;
    private createDeathEffect;
    private getEntityMesh;
    isAnimationPlaying(entityId: string): boolean;
    stopAnimation(entityId: string): void;
    update(deltaTime: number): void;
    private updateAnimationFrame;
    private updateEffect;
    private updateProjectile;
    private updateMagicParticles;
    private updateHitSplat;
    private updateDeathEffect;
    private cleanupEffect;
    serialize(): any;
    deserialize(data: any): void;
}
//# sourceMappingURL=CombatAnimationSystem.d.ts.map