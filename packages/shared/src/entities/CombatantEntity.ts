/**
 * CombatantEntity - Base Combat Entity
 * 
 * Abstract base class for all entities that can engage in combat.
 * Provides combat stats, damage handling, and death/respawn mechanics.
 * 
 * **Extends**: Entity (adds combat functionality)
 * 
 * **Key Features**:
 * 
 * **Combat Statistics**:
 * - Attack power (damage output)
 * - Defense rating (damage reduction)
 * - Attack speed (attacks per second)
 * - Critical hit chance (0.0 to 1.0)
 * - Combat level (for XP calculations)
 * 
 * **Combat State**:
 * - Current target ID
 * - Last attack timestamp
 * - In combat flag
 * - Death state
 * - Aggro/threat management
 * 
 * **Health System**:
 * - Current health
 * - Maximum health
 * - Health regeneration
 * - Damage calculation
 * - Death detection
 * 
 * **Attack Mechanics**:
 * - Attack cooldown based on attack speed
 * - Damage calculation with defense
 * - Critical hit rolls
 * - Attack range checking
 * - Line of sight validation
 * 
 * **Death Handling**:
 * - Death animation
 * - Loot drop creation
 * - Experience reward to killer
 * - Respawn timer
 * - Corpse creation
 * 
 * **Respawn System**:
 * - Configurable respawn time
 * - Return to spawn position
 * - Full health restoration
 * - State reset (clear target, aggro)
 * 
 * **AI Properties**:
 * - Aggro radius (detection range)
 * - Attack range (how close to get)
 * - Spawn position (for respawning)
 * - Patrol/leash distance
 * 
 * **Combat Component**:
 * - Attack bonuses
 * - Defense bonuses
 * - Damage multipliers
 * - Status effects
 * - Combat timers
 * 
 * **Subclasses**:
 * - PlayerEntity: Player characters with full RPG systems
 * - MobEntity: AI-controlled enemies with patrol and aggro
 * 
 * **Runs on**: Server (authoritative), Client (visual only)
 * **Referenced by**: CombatSystem, AggroSystem, DeathSystem
 * 
 * @public
 */

import { Entity } from './Entity';
import type { World } from '../World';
import type { EntityConfig, EntityInteractionData, PlayerEntityProperties } from '../types/entities';
import type { Quaternion } from '../types/base-types';
import type { Position3D } from '../types/core';
import { COMBAT_CONSTANTS } from '../constants/CombatConstants';
import { calculateDamage } from '../utils/CombatCalculations';
import { AttackType } from '../types/core';

export interface CombatantConfig extends EntityConfig<PlayerEntityProperties> {
  rotation: Quaternion;
  combat?: {
    attack?: number;
    defense?: number;
    attackSpeed?: number;
    criticalChance?: number;
    combatLevel?: number;
    respawnTime?: number;
    aggroRadius?: number;
    attackRange?: number;
  };
}

export abstract class CombatantEntity extends Entity {
  // Combat statistics
  protected attackPower: number = 10;
  protected defense: number = 5;
  protected attackSpeed: number = 1.0;
  protected criticalChance: number = 0.05;
  protected combatLevel: number = 1;
  
  // Combat state
  protected deathTime: number = 0;
  protected combatLastAttackTime: number = 0;
  protected targetId: string | null = null;
  
  // AI/Respawn settings
  protected respawnTime: number = 30000; // 30 seconds default
  protected aggroRadius: number = 10;
  protected attackRange: number = 2;
  protected spawnPosition: Position3D;

  constructor(world: World, config: CombatantConfig, local?: boolean) {
    super(world, config, local);
    
    this.spawnPosition = { ...config.position };
    
    // Initialize combat properties from config
    if (config.combat) {
      this.attackPower = config.combat.attack || this.attackPower;
      this.defense = config.combat.defense || this.defense;
      this.attackSpeed = config.combat.attackSpeed || this.attackSpeed;
      this.criticalChance = config.combat.criticalChance || this.criticalChance;
      this.combatLevel = config.combat.combatLevel || this.combatLevel;
      this.respawnTime = config.combat.respawnTime || this.respawnTime;
      this.aggroRadius = config.combat.aggroRadius || this.aggroRadius;
      this.attackRange = config.combat.attackRange || this.attackRange;
    }
    
    this.initializeCombat();
  }

  /**
   * Override initializeRPGComponents to skip adding the basic combat component
   * since initializeCombat() adds a more comprehensive one
   */
  protected initializeRPGComponents(): void {
    this.addHealthComponent();
    this.addVisualComponent();
    // Skip addCombatComponent() - will be added by initializeCombat()
  }

  protected initializeCombat(): void {
    // Override combat component with enhanced data
    this.addComponent('combat', {
      attack: this.attackPower,
      defense: this.defense,
      attackSpeed: this.attackSpeed,
      criticalChance: this.criticalChance,
      combatLevel: this.combatLevel,
      lastAttackTime: 0,
      targetId: null,
      aggroRadius: this.aggroRadius,
      attackRange: this.attackRange,
      isInCombat: false
    });
    
    // Add AI component for targeting and movement
    this.addComponent('ai', {
      type: 'combatant',
      targetId: null,
      aggroRadius: this.aggroRadius,
      attackRange: this.attackRange,
      state: 'idle', // idle, chasing, attacking, returning
      lastStateChange: Date.now(),
      homePosition: { ...this.spawnPosition }
    });
    
    // Add respawn component
    this.addComponent('respawn', {
      respawnTime: this.respawnTime,
      spawnPosition: { ...this.spawnPosition },
      deathTime: 0,
      canRespawn: true
    });
  }

  // === Combat Methods ===

  /**
   * Calculate damage this entity would deal to a target
   */
  public calculateDamage(target: CombatantEntity): number {
    // Use centralized damage calculation for consistency
    const attackerData = {
      config: { attackPower: this.attackPower }
    };
    
    const targetData = {
      config: { defense: target.getDefense() }
    };
    
    const result = calculateDamage(attackerData, targetData, AttackType.MELEE);
    return result.damage;
  }

  /**
   * Attack another combatant entity
   */
  public attackTarget(target: CombatantEntity): boolean {
    const now = Date.now();
    const timeSinceLastAttack = now - this.combatLastAttackTime;
    
    // Use consistent attack cooldown with CombatSystem
    const attackCooldown = COMBAT_CONSTANTS.ATTACK_COOLDOWN_MS;
    
    // Check attack cooldown
    if (timeSinceLastAttack < attackCooldown) {
      return false;
    }
    
    // Check if target is in range
    const distance = this.getPosition().x !== undefined ? 
      Math.sqrt(
        Math.pow(this.getPosition().x - target.getPosition().x, 2) +
        Math.pow(this.getPosition().z - target.getPosition().z, 2)
      ) : 0;
    
    if (distance > this.attackRange) {
      return false;
    }
    
    // Calculate and apply damage
    const damage = this.calculateDamage(target);
    const killed = target.takeDamage(damage, this.id);
    
    this.combatLastAttackTime = now;
    
    // Update combat component
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.lastAttackTime = now;
      combatComponent.data.isInCombat = true;
    }
    
    // Emit attack event
    this.emit('attack', {
      attackerId: this.id,
      targetId: target.id,
      damage,
      killed,
      position: this.getPosition()
    });
    
    return true;
  }

  /**
   * Take damage from another entity
   */
  public takeDamage(damage: number, attackerId?: string): boolean {
    if (this.isDead()) return false;
    
    const actualDamage = Math.max(1, damage - this.defense);
    const killed = this.damage(actualDamage, attackerId);
    
    // Set target if we don't have one and we're being attacked
    if (attackerId && !this.targetId && !killed) {
      this.setTarget(attackerId);
    }
    
    // Update combat state
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.isInCombat = true;
    }
    
    return killed;
  }

  /**
   * Set combat target
   */
  public setTarget(targetId: string | null): void {
    this.targetId = targetId;
    
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.targetId = targetId;
    }
    
    const aiComponent = this.getComponent('ai');
    if (aiComponent) {
      aiComponent.data.targetId = targetId;
      aiComponent.data.state = targetId ? 'chasing' : 'idle';
      aiComponent.data.lastStateChange = Date.now();
    }
  }

  /**
   * Handle death - can be overridden by subclasses
   */
  protected die(): void {
    if (this.isDead()) return;
    
    // Death state is managed by health being 0
    this.deathTime = Date.now();
    this.setHealth(0);
    this.setTarget(null);
    
    // Update respawn component
    const respawnComponent = this.getComponent('respawn');
    if (respawnComponent) {
      respawnComponent.data.deathTime = this.deathTime;
    }
    
    // Clear combat state
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.isInCombat = false;
      combatComponent.data.targetId = null;
    }
    
    // Emit death event
    this.emit('death', {
      entityId: this.id,
      position: this.getPosition(),
      deathTime: this.deathTime
    });
    
    // Handle respawn scheduling
    if (this.respawnTime > 0) {
      setTimeout(() => this.respawn(), this.respawnTime);
    }
  }

  /**
   * Respawn the entity at spawn position
   */
  public respawn(): void {
    if (!this.isDead()) return;
    
    // Alive state managed by health > 0
    this.deathTime = 0;
    this.combatLastAttackTime = 0;
    this.targetId = null;
    
    // Reset health
    this.setHealth(this.getMaxHealth());
    
    // Reset position
    this.setPosition(this.spawnPosition);
    
    // Clear combat state
    const combatComponent = this.getComponent('combat');
    if (combatComponent) {
      combatComponent.data.isInCombat = false;
      combatComponent.data.targetId = null;
      combatComponent.data.lastAttackTime = 0;
    }
    
    // Reset AI state
    const aiComponent = this.getComponent('ai');
    if (aiComponent) {
      aiComponent.data.targetId = null;
      aiComponent.data.state = 'idle';
      aiComponent.data.lastStateChange = Date.now();
    }
    
    // Reset respawn component
    const respawnComponent = this.getComponent('respawn');
    if (respawnComponent) {
      respawnComponent.data.deathTime = 0;
    }
    
    // Emit respawn event
    this.emit('respawn', {
      entityId: this.id,
      position: this.getPosition(),
      health: this.getHealth()
    });
  }

  // === Overrides ===

  public setHealth(newHealth: number): void {
    const wasAlive = this.getHealth() > 0;
    super.setHealth(newHealth);
    
    // Handle death
    if (wasAlive && this.getHealth() <= 0 && !this.isDead) {
      this.die();
    }
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);
    
    // Handle respawn logic if needed
    if (this.isDead() && this.respawnTime > 0) {
      const timeSinceDeath = Date.now() - this.deathTime;
      if (timeSinceDeath >= this.respawnTime) {
        this.respawn();
      }
    }
  }

  // === Getters ===

  public getAttack(): number { return this.attackPower; }
  public getDefense(): number { return this.defense; }
  public getAttackSpeed(): number { return this.attackSpeed; }
  public getCriticalChance(): number { return this.criticalChance; }
  public getCombatLevel(): number { return this.combatLevel; }
  public getTargetId(): string | null { return this.targetId; }
  // isDead() method inherited from Entity
  public getSpawnPosition(): Position3D { return { ...this.spawnPosition }; }
  public getAggroRadius(): number { return this.aggroRadius; }
  public getAttackRange(): number { return this.attackRange; }

  // === Abstract Methods (from Entity) ===
  // Subclasses must implement these
  protected abstract createMesh(): Promise<void>;
  protected abstract onInteract(data: EntityInteractionData): Promise<void>;
}