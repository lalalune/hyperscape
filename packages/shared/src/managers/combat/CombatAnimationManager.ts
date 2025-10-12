 
import { getWorldNetwork } from '../../utils/SystemUtils';
import type { World } from '../../types';
import { EventType } from '../../types/events';
import { Entity } from '../../entities/Entity';
import {
  AnimationTask,
  AttackType,
  CombatStyle,
  Item,
  WeaponType
} from '../../types';

export class CombatAnimationManager {
  private world: World;
  private activeAnimations: Map<string, AnimationTask> = new Map();
  private animationQueue: AnimationTask[] = [];
  
  // Animation definitions
  private readonly animations = {
    // Melee animations
    'melee_slash': { duration: 600, file: 'slash.glb' },
    'melee_stab': { duration: 600, file: 'stab.glb' },
    'melee_crush': { duration: 600, file: 'crush.glb' },
    
    // Ranged animations
    'ranged_bow': { duration: 900, file: 'bow_shoot.glb' },
    'ranged_crossbow': { duration: 700, file: 'crossbow_shoot.glb' },
    'ranged_thrown': { duration: 600, file: 'throw.glb' },
    
    // Magic animations
    'magic_cast': { duration: 1200, file: 'magic_cast.glb' },
    'magic_strike': { duration: 600, file: 'magic_strike.glb' },
    
    // Defense animations
    'block': { duration: 400, file: 'block.glb' },
    'dodge': { duration: 500, file: 'dodge.glb' },
    
    // Death animation
    'death': { duration: 2000, file: 'death.glb' },
    
    // Hit reactions
    'hit_reaction': { duration: 300, file: 'hit_reaction.glb' }
  };

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Update animation states
   */
  update(_delta: number): void {
    const now = Date.now();
    const toRemove: string[] = [];
    
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
    
    // Process queued animations
    while (this.animationQueue.length > 0) {
      const task = this.animationQueue.shift()!;
      
      // Check if entity is not already animating
      if (!this.activeAnimations.has(task.entityId)) {
        this.activeAnimations.set(task.entityId, task);
        this.broadcastAnimation(task.entityId, task.animationName);
      }
    }
  }

  /**
   * Play attack animation based on attack type
   */
  playAttackAnimation(attacker: Entity, attackType: AttackType, style: CombatStyle = CombatStyle.ACCURATE): void {
    // Use the determineAnimation method to get the correct animation
    const animationName = this.determineAnimation(attacker, attackType, style);
    this.playAnimation(attacker.data.id, animationName);
  }

  /**
   * Play block/defense animation
   */
  playDefenseAnimation(defender: Entity): void {
    this.playAnimation(defender.data.id, 'block');
  }

  /**
   * Play hit reaction animation
   */
  playHitReaction(entity: Entity): void {
    this.playAnimation(entity.data.id, 'hit_reaction');
  }

  /**
   * Play death animation
   */
  playDeathAnimation(entity: Entity): void {
    this.playAnimation(entity.data.id, 'death');
  }

  /**
   * Play a specific animation
   */
  private playAnimation(entityId: string, animationName: string): void {
    const animation = this.animations[animationName as keyof typeof this.animations];
    if (!animation) {
      console.warn(`Unknown animation: ${animationName}`);
      return;
    }
    
    // Cancel current animation if playing
    if (this.activeAnimations.has(entityId)) {
      this.cancelAnimation(entityId);
    }
    
    // Create animation task
    const task: AnimationTask = {
      id: `anim_${Date.now()}_${Math.random()}`,
      entityId,
      targetId: undefined,
      animationName,
      duration: animation.duration,
      attackType: AttackType.MELEE, // Default for legacy animations
      style: CombatStyle.ACCURATE, // Default for legacy animations
      damage: undefined,
      startTime: Date.now(),
      progress: 0,
      cancelled: false
    };
    
    this.activeAnimations.set(entityId, task);
    
    // Broadcast animation to clients
    this.broadcastAnimation(entityId, animationName);
  }

  /**
   * Cancel animation
   */
  cancelAnimation(entityId: string): void {
    const currentAnimation = this.activeAnimations.get(entityId);
    if (!currentAnimation) return;
    
    // Cancel the animation
    currentAnimation.cancelled = true;
    
    // Broadcast animation cancellation
    const network = getWorldNetwork(this.world);
    if (network) {
      network.send('animation:cancelled', {
        entityId,
        animationId: currentAnimation.id,
        timestamp: Date.now()
      });
    } else {
      // Fallback to event system
              this.world.emit(EventType.ANIMATION_CANCEL, {
        entityId,
        animationId: currentAnimation.id,
        timestamp: Date.now()
      });
    }
    
    // Clean up
    this.activeAnimations.delete(entityId);
  }

  /**
   * Handle animation completion
   */
  private onAnimationComplete(entityId: string, animation: AnimationTask): void {
    // Handle animation completion
    const entity = this.world.entities.get(entityId);
    if (entity && entity instanceof Entity) {
      // Reset entity animation state
      const visual = entity.getComponent('visual');
      if (visual && visual.data) {
        visual.data.currentAnimation = 'idle';
        visual.data.animationTime = 0;
      }
    }
    
    // Use actual network system
    const network = getWorldNetwork(this.world);
    if (network) {
      network.send('animation:complete', {
        entityId,
        animationId: animation.id,
        animationType: animation.animationName,
        timestamp: Date.now()
      });
    }
    
    // Emit event through world
    this.world.emit(EventType.ANIMATION_COMPLETE, {
      entityId,
      animation: animation.animationName
    });
  }

  /**
   * Broadcast animation to all clients
   */
  private broadcastAnimation(entityId: string, animationName: string): void {
    // Use actual network system
    const network = getWorldNetwork(this.world);
    if (network) {
      network.send('animation:play', {
        entityId,
        animationName,
        timestamp: Date.now()
      });
    } else {
      // Fallback to event system
      this.world.emit(EventType.ANIMATION_PLAY, {
        entityId,
        animationName,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check if entity is playing an animation
   */
  isAnimating(entityId: string): boolean {
    return this.activeAnimations.has(entityId);
  }

  /**
   * Get current animation for entity
   */
  getCurrentAnimation(entityId: string): string | null {
    const task = this.activeAnimations.get(entityId);
    return task ? task.animationName : null;
  }

  /**
   * Determine specific animation based on attack type and weapon
   */
  private determineAnimation(entity: Entity, attackType: AttackType, _style: CombatStyle): string {
    switch (attackType) {
      case AttackType.MELEE: {
        // Determine specific melee style based on weapon
        const weapon = this.getEquippedWeapon(entity);
        if (weapon) {
          const weaponType = weapon.weaponType;
          switch (weaponType) {
            case WeaponType.DAGGER:
              return 'melee_stab';
            case WeaponType.SWORD:
            case WeaponType.SCIMITAR:
              return 'melee_slash';
            case WeaponType.MACE:
            case WeaponType.AXE:
              return 'melee_crush';
            case WeaponType.SPEAR:
            case WeaponType.HALBERD:
              return 'melee_stab';
            default:
              return 'melee_slash';
          }
        }
        return 'melee_slash'; // Unarmed
      }
        
      case AttackType.RANGED: {
        // Determine bow vs crossbow based on weapon
        const rangedWeapon = this.getEquippedWeapon(entity);
        if (rangedWeapon) {
          const weaponType = rangedWeapon.weaponType;
          if (weaponType === WeaponType.CROSSBOW) {
            return 'ranged_crossbow';
          }
        }
        return 'ranged_bow'; // Default to bow
      }
        
      case AttackType.MAGIC:
        return 'magic_cast';
        
      default:
        return 'melee_slash';
    }
  }
  
  /**
   * Get equipped weapon
   */
  private getEquippedWeapon(entity: Entity): Item | null {
    const equipment = entity.getComponent('equipment');
    if (!equipment || !equipment.data || !equipment.data.weapon) return null;
    
    return equipment.data.weapon as Item;
  }

  /**
   * Queue animation for entity
   */
  queueAnimation(
    entityId: string,
    attackType: AttackType,
    style: CombatStyle,
    damage?: number,
    targetId?: string
  ): void {
    const entity = this.world.entities.get(entityId);
    const animationName = entity && entity instanceof Entity ? 
        this.determineAnimation(entity, attackType, style) :
      this.getDefaultAnimationName(attackType);
    const duration = this.getAnimationDuration(animationName);
    
    const task: AnimationTask = {
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
      cancelled: false
    };
    
    this.animationQueue.push(task);
  }

  /**
   * Get default animation name for attack type
   */
  private getDefaultAnimationName(attackType: AttackType): string {
    switch (attackType) {
      case AttackType.MELEE:
        return 'melee_slash';
      case AttackType.RANGED:
        return 'ranged_bow';
      case AttackType.MAGIC:
        return 'magic_cast';
      default:
        return 'idle';
    }
  }
  
  /**
   * Get animation duration
   */
  private getAnimationDuration(animationName: string): number {
    const animation = this.animations[animationName as keyof typeof this.animations];
    if (animation) {
      return animation.duration;
    }
    
    // Check for custom animations
    const customAnimations: Record<string, number> = {
      'stab': 600,
      'stab_aggressive': 500,
      'slash': 600,
      'slash_aggressive': 500,
      'slash_defensive': 700,
      'crush': 700,
      'crush_aggressive': 600,
      'stab_controlled': 650,
      'stab_2h': 800,
      'punch': 400,
      'crossbow_shoot': 700,
      'bow_shoot': 900,
      'cast_standard': 1200,
      'cast_defensive': 1400,
      'idle': 0
    };
    
    return customAnimations[animationName] || 600; // Default 600ms
  }
} 