"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CombatAnimationManager = void 0;
const index_1 = require("../../types/index");
class CombatAnimationManager {
    constructor(world) {
        this.activeAnimations = new Map();
        this.animationQueue = [];
        // Animation definitions
        this.animations = {
            // Melee animations
            melee_slash: { duration: 600, file: 'slash.glb' },
            melee_stab: { duration: 600, file: 'stab.glb' },
            melee_crush: { duration: 600, file: 'crush.glb' },
            // Unarmed combat
            punch: { duration: 400, file: 'punch.glb' },
            // Weapon-specific melee animations
            stab: { duration: 600, file: 'stab.glb' },
            stab_aggressive: { duration: 500, file: 'stab_aggressive.glb' },
            slash: { duration: 600, file: 'slash.glb' },
            slash_aggressive: { duration: 500, file: 'slash_aggressive.glb' },
            slash_defensive: { duration: 700, file: 'slash_defensive.glb' },
            crush: { duration: 700, file: 'crush.glb' },
            crush_aggressive: { duration: 600, file: 'crush_aggressive.glb' },
            stab_controlled: { duration: 650, file: 'stab_controlled.glb' },
            stab_2h: { duration: 800, file: 'stab_2h.glb' },
            // Ranged animations
            ranged_bow: { duration: 900, file: 'bow_shoot.glb' },
            ranged_crossbow: { duration: 700, file: 'crossbow_shoot.glb' },
            ranged_thrown: { duration: 600, file: 'throw.glb' },
            bow_shoot: { duration: 900, file: 'bow_shoot.glb' },
            crossbow_shoot: { duration: 700, file: 'crossbow_shoot.glb' },
            // Magic animations
            magic_cast: { duration: 1200, file: 'magic_cast.glb' },
            magic_strike: { duration: 600, file: 'magic_strike.glb' },
            cast_standard: { duration: 1200, file: 'cast_standard.glb' },
            cast_defensive: { duration: 1400, file: 'cast_defensive.glb' },
            // Defense animations
            block: { duration: 400, file: 'block.glb' },
            dodge: { duration: 500, file: 'dodge.glb' },
            // Death animation
            death: { duration: 2000, file: 'death.glb' },
            // Hit reactions
            hit_reaction: { duration: 300, file: 'hit_reaction.glb' },
            // Idle state
            idle: { duration: 0, file: 'idle.glb' },
        };
        this.world = world;
    }
    /**
     * Update animation states
     */
    update(_delta) {
        const now = Date.now();
        const toRemove = [];
        // Check for completed animations
        for (const [entityId, task] of Array.from(this.activeAnimations)) {
            if (now - task.startTime >= task.duration) {
                toRemove.push(entityId);
            }
        }
        // Remove completed animations
        toRemove.forEach(id => {
            const animation = this.activeAnimations.get(id);
            if (animation) {
                this.onAnimationComplete(id, animation);
            }
            this.activeAnimations.delete(id);
        });
    }
    /**
     * Play attack animation based on attack type
     */
    playAttackAnimation(attacker, attackType, style = index_1.CombatStyle.ACCURATE) {
        // Use the determineAnimation method to get the correct animation
        const animationName = this.determineAnimation(attacker, attackType, style);
        this.playAnimation(attacker.id, animationName);
    }
    /**
     * Play block/defense animation
     */
    playDefenseAnimation(defender) {
        this.playAnimation(defender.id, 'block');
    }
    /**
     * Play hit reaction animation
     */
    playHitReaction(entity) {
        this.playAnimation(entity.id, 'hit_reaction');
    }
    /**
     * Play death animation
     */
    playDeathAnimation(entity) {
        this.playAnimation(entity.id, 'death');
    }
    /**
     * Play a specific animation
     */
    playAnimation(entityId, animationName) {
        const animation = this.animations[animationName];
        if (!animation) {
            console.warn(`Unknown animation: ${animationName}`);
            return;
        }
        // Cancel current animation if playing
        if (this.activeAnimations.has(entityId)) {
            this.cancelAnimation(entityId);
        }
        // Create animation task
        const task = {
            id: `anim_${Date.now()}_${Math.random()}`,
            entityId,
            targetId: undefined,
            animationName,
            duration: animation.duration,
            attackType: index_1.AttackType.MELEE, // Default for legacy animations
            style: index_1.CombatStyle.ACCURATE, // Default for legacy animations
            damage: undefined,
            startTime: Date.now(),
            progress: 0,
            cancelled: false,
        };
        this.activeAnimations.set(entityId, task);
        // Broadcast animation to clients
        this.broadcastAnimation(entityId, animationName);
    }
    /**
     * Cancel animation
     */
    cancelAnimation(entityId) {
        const currentAnimation = this.activeAnimations.get(entityId);
        if (!currentAnimation) {
            return;
        }
        // Cancel the animation
        currentAnimation.cancelled = true;
        // Broadcast animation cancellation
        const network = this.world.network;
        if (network) {
            network.broadcast('animation:cancelled', {
                entityId,
                animationId: currentAnimation.id,
                timestamp: Date.now(),
            });
        }
        // Clean up
        this.activeAnimations.delete(entityId);
    }
    /**
     * Handle animation completion
     */
    onAnimationComplete(entityId, animation) {
        // Handle animation completion
        const entity = this.world.entities.get(entityId);
        if (entity) {
            // Reset entity animation state
            const visual = entity.getComponent('visual');
            if (visual) {
                visual.currentAnimation = 'idle';
                visual.animationTime = 0;
            }
        }
        // Use actual network system
        const network = this.world.network;
        if (network) {
            network.broadcast('animation:complete', {
                entityId,
                animationId: animation.id,
                animationType: animation.animationName,
                timestamp: Date.now(),
            });
        }
        // Emit event through world
        this.world.events.emit('animation:complete', {
            entityId,
            animation: animation.animationName,
        });
    }
    /**
     * Broadcast animation to all clients
     */
    broadcastAnimation(entityId, animationName) {
        // Use actual network system
        const network = this.world.network;
        if (network) {
            network.broadcast('animation:play', {
                entityId,
                animationName,
                timestamp: Date.now(),
            });
        }
        else {
            // Fallback to event system
            this.world.events.emit('animation:play', {
                entityId,
                animationName,
                timestamp: Date.now(),
            });
        }
    }
    /**
     * Check if entity is playing an animation
     */
    isAnimating(entityId) {
        return this.activeAnimations.has(entityId);
    }
    /**
     * Get current animation for entity
     */
    getCurrentAnimation(entityId) {
        const task = this.activeAnimations.get(entityId);
        return task ? task.animationName : null;
    }
    /**
     * Determine specific animation based on attack type and weapon
     */
    determineAnimation(entity, attackType, style) {
        switch (attackType) {
            case index_1.AttackType.MELEE:
                // Determine specific melee style based on weapon
                const weapon = this.getEquippedWeapon(entity);
                if (weapon) {
                    const weaponType = weapon.equipment?.weaponType;
                    switch (weaponType) {
                        case index_1.WeaponType.DAGGER:
                            return style === index_1.CombatStyle.AGGRESSIVE ? 'stab_aggressive' : 'stab';
                        case index_1.WeaponType.SWORD:
                        case index_1.WeaponType.SCIMITAR:
                            return style === index_1.CombatStyle.AGGRESSIVE
                                ? 'slash_aggressive'
                                : style === index_1.CombatStyle.DEFENSIVE
                                    ? 'slash_defensive'
                                    : 'slash';
                        case index_1.WeaponType.MACE:
                        case index_1.WeaponType.AXE:
                            return style === index_1.CombatStyle.AGGRESSIVE ? 'crush_aggressive' : 'crush';
                        case index_1.WeaponType.SPEAR:
                        case index_1.WeaponType.HALBERD:
                            return style === index_1.CombatStyle.CONTROLLED ? 'stab_controlled' : 'stab_2h';
                        default:
                            return 'punch';
                    }
                }
                return 'punch'; // Unarmed
            case index_1.AttackType.RANGED:
                // Determine bow vs crossbow based on weapon
                const rangedWeapon = this.getEquippedWeapon(entity);
                if (rangedWeapon) {
                    const weaponType = rangedWeapon.equipment?.weaponType;
                    if (weaponType === index_1.WeaponType.CROSSBOW) {
                        return 'crossbow_shoot';
                    }
                }
                return 'bow_shoot'; // Default to bow
            case index_1.AttackType.MAGIC:
                return style === index_1.CombatStyle.DEFENSIVE ? 'cast_defensive' : 'cast_standard';
            default:
                return 'idle';
        }
    }
    /**
     * Get equipped weapon
     */
    getEquippedWeapon(entity) {
        const inventory = entity.getComponent('inventory');
        if (!inventory) {
            return null;
        }
        return inventory.equipment[index_1.EquipmentSlot.WEAPON];
    }
    /**
     * Queue animation for entity
     */
    queueAnimation(entityId, attackType, style, damage, targetId) {
        const entity = this.world.entities.get(entityId);
        const animationName = entity
            ? this.determineAnimation(entity, attackType, style)
            : this.getDefaultAnimationName(attackType);
        const duration = this.getAnimationDuration(animationName);
        const task = {
            id: `anim_${Date.now()}_${Math.random()}`,
            entityId,
            targetId,
            animationName,
            duration,
            attackType,
            style,
            damage,
            startTime: Date.now(),
            progress: 0,
            cancelled: false,
        };
        this.animationQueue.push(task);
    }
    /**
     * Get default animation name for attack type
     */
    getDefaultAnimationName(attackType) {
        switch (attackType) {
            case index_1.AttackType.MELEE:
                return 'melee_slash';
            case index_1.AttackType.RANGED:
                return 'ranged_bow';
            case index_1.AttackType.MAGIC:
                return 'magic_cast';
            default:
                return 'idle';
        }
    }
    /**
     * Get animation duration
     */
    getAnimationDuration(animationName) {
        const animation = this.animations[animationName];
        return animation ? animation.duration : 600; // Default 600ms for unknown animations
    }
}
exports.CombatAnimationManager = CombatAnimationManager;
//# sourceMappingURL=CombatAnimationManager.js.map