/**
 * RPGCombatSystem - Handles all combat mechanics
 */

import { System } from '../../core/systems/System';

export interface CombatData {
  attackerId: string;
  targetId: string;
  attackerType: 'player' | 'mob';
  targetType: 'player' | 'mob';
  weaponType: 'melee' | 'ranged';
  inCombat: boolean;
  lastAttackTime: number;
}

export class RPGCombatSystem extends System {
  private combatStates = new Map<string, CombatData>();
  private attackCooldowns = new Map<string, number>();
  
  // GDD Constants
  private readonly MELEE_RANGE = 2;
  private readonly RANGED_RANGE = 10;
  private readonly ATTACK_COOLDOWN = 600; // ms
  private readonly COMBAT_TIMEOUT = 10000; // 10 seconds

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGCombatSystem] Initializing combat system...');
    
    // Listen for combat events
    this.world.on('combat:attack', this.handleAttack.bind(this));
    this.world.on('combat:melee', this.handleMeleeAttack.bind(this));
    this.world.on('combat:ranged', this.handleRangedAttack.bind(this));
    this.world.on('mob:attack', this.handleMobAttack.bind(this));
    this.world.on('player:death', this.endCombat.bind(this));
    this.world.on('mob:death', this.endCombat.bind(this));
    
    console.log('[RPGCombatSystem] Combat system initialized');
  }

  private handleAttack(data: { 
    attackerId: string; 
    targetId: string;
    attackerType: 'player' | 'mob';
    targetType: 'player' | 'mob';
    weaponType: 'melee' | 'ranged';
  }): void {
    // Check attack cooldown
    const lastAttack = this.attackCooldowns.get(data.attackerId) || 0;
    const now = Date.now();
    
    if (now - lastAttack < this.ATTACK_COOLDOWN) {
      return; // Still on cooldown
    }
    
    // Update cooldown
    this.attackCooldowns.set(data.attackerId, now);
    
    // Delegate to specific attack type
    if (data.weaponType === 'ranged') {
      this.handleRangedAttack(data);
    } else {
      this.handleMeleeAttack(data);
    }
  }

  private handleMeleeAttack(data: any): void {
    const attacker = this.getEntity(data.attackerId, data.attackerType);
    const target = this.getEntity(data.targetId, data.targetType);
    
    // Check range
    const distance = this.calculateDistance(attacker.position, target.position);
    if (distance > this.MELEE_RANGE) {
      return; // Out of range
    }
    
    // Calculate damage
    const damage = this.calculateMeleeDamage(attacker, target);
    
    // Apply damage
    this.applyDamage(data.targetId, data.targetType, damage, data.attackerId);
    
    // Update combat states
    this.enterCombat(data.attackerId, data.targetId);
    
    // Emit hit event
    this.world.emit('combat:hit', {
      attackerId: data.attackerId,
      targetId: data.targetId,
      damage,
      weaponType: 'melee'
    });
  }

  private handleRangedAttack(data: any): void {
    const attacker = this.getEntity(data.attackerId, data.attackerType);
    const target = this.getEntity(data.targetId, data.targetType);
    
    // Check range
    const distance = this.calculateDistance(attacker.position, target.position);
    if (distance > this.RANGED_RANGE) {
      return; // Out of range
    }
    
    // Check and consume arrow
    if (data.attackerType === 'player') {
      // Get equipment system through the world's RPG systems
      const equipmentSystem = (this.world as any)['rpg-equipment'];
      
      if (!equipmentSystem || !equipmentSystem.consumeArrow) {
        console.warn('[RPGCombatSystem] Equipment system not found for arrow consumption');
        return;
      }
      
      // Check if player has arrows equipped and consume one
      const hasArrow = equipmentSystem.consumeArrow(data.attackerId);
      
      if (!hasArrow) {
        this.world.emit('combat:no_ammo', { playerId: data.attackerId });
        console.log(`[RPGCombatSystem] Player ${data.attackerId} cannot attack - no arrows`);
        return;
      }
    }
    
    // Calculate damage
    const damage = this.calculateRangedDamage(attacker, target);
    
    // Apply damage
    this.applyDamage(data.targetId, data.targetType, damage, data.attackerId);
    
    // Update combat states
    this.enterCombat(data.attackerId, data.targetId);
    
    // Emit hit event
    this.world.emit('combat:hit', {
      attackerId: data.attackerId,
      targetId: data.targetId,
      damage,
      weaponType: 'ranged'
    });
  }

  private handleMobAttack(data: { mobId: string; targetId: string }): void {
    this.handleAttack({
      attackerId: data.mobId,
      targetId: data.targetId,
      attackerType: 'mob',
      targetType: 'player',
      weaponType: 'melee'
    });
  }

  private calculateMeleeDamage(attacker: any, target: any): number {
    // Base damage from strength
    const strengthBonus = attacker.stats.strength;
    const weaponDamage = attacker.equipment?.weapon?.damage || 5;
    
    // Calculate raw damage
    let damage = weaponDamage + strengthBonus;
    
    // Apply defense reduction
    const defenseReduction = target.stats.defense * 0.5;
    damage = Math.max(1, damage - defenseReduction);
    
    // Add some randomness
    damage = Math.floor(damage * (0.8 + Math.random() * 0.4));
    
    return damage;
  }

  private calculateRangedDamage(attacker: any, target: any): number {
    // Base damage from ranged stat
    const rangedBonus = attacker.stats.ranged;
    const weaponDamage = attacker.equipment?.weapon?.damage || 5;
    
    // Calculate raw damage
    let damage = weaponDamage + rangedBonus;
    
    // Apply defense reduction (less effective against ranged)
    const defenseReduction = target.stats.defense * 0.3;
    damage = Math.max(1, damage - defenseReduction);
    
    // Add some randomness
    damage = Math.floor(damage * (0.8 + Math.random() * 0.4));
    
    return damage;
  }

  private applyDamage(targetId: string, targetType: string, damage: number, attackerId: string): void {
    if (targetType === 'player') {
      this.world.emit('player:damage', {
        playerId: targetId,
        damage,
        attackerId,
        sourceType: 'combat'
      });
    } else {
      this.world.emit('mob:damage', {
        mobId: targetId,
        damage,
        attackerId
      });
    }
  }

  private enterCombat(attackerId: string, targetId: string): void {
    const now = Date.now();
    
    // Update attacker combat state
    this.combatStates.set(attackerId, {
      attackerId,
      targetId,
      attackerType: 'player',
      targetType: 'mob',
      weaponType: 'melee',
      inCombat: true,
      lastAttackTime: now
    });
    
    // Update target combat state
    this.combatStates.set(targetId, {
      attackerId: targetId,
      targetId: attackerId,
      attackerType: 'mob',
      targetType: 'player',
      weaponType: 'melee',
      inCombat: true,
      lastAttackTime: now
    });
    
    // Emit combat state changes
    this.world.emit('combat:entered', {
      entityId: attackerId,
      targetId
    });
    
    this.world.emit('combat:entered', {
      entityId: targetId,
      targetId: attackerId
    });
  }

  private endCombat(data: { entityId: string }): void {
    const combatState = this.combatStates.get(data.entityId);
    
    if (combatState) {
      // End combat for both entities
      this.combatStates.delete(data.entityId);
      this.combatStates.delete(combatState.targetId);
      
      this.world.emit('combat:ended', { entityId: data.entityId });
      this.world.emit('combat:ended', { entityId: combatState.targetId });
    }
  }

  private getEntity(entityId: string, entityType: string): any {
    // Use entity manager to get any entity
    const entityManager = (this.world as any).entityManager || (this.world as any).rpgEntityManager;
    if (entityManager) {
      const entity = entityManager.getEntity(entityId);
      if (entity) {
        return entity;
      }
    }
    
    // Fallback to world.getPlayer for player entities
    if (entityType === 'player' && this.world.getPlayer) {
      return this.world.getPlayer(entityId);
    }
    
    // For mobs, try to get from mob system
    const mobSystem = (this.world as any).mobSystem || (this.world as any).rpgMobSystem;
    if (mobSystem && entityType === 'mob') {
      return mobSystem.getMob(entityId);
    }
    
    return null;
  }

  private calculateDistance(pos1: any, pos2: any): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  update(deltaTime: number): void {
    const now = Date.now();
    
    // Check for combat timeouts
    for (const [entityId, state] of this.combatStates) {
      if (now - state.lastAttackTime > this.COMBAT_TIMEOUT) {
        this.endCombat({ entityId });
      }
    }
  }

  // Public API
  isInCombat(entityId: string): boolean {
    return this.combatStates.has(entityId);
  }

  getCombatTarget(entityId: string): string | null {
    const state = this.combatStates.get(entityId);
    return state ? state.targetId : null;
  }

  getCombatState(entityId: string): CombatData | undefined {
    return this.combatStates.get(entityId);
  }

  getAllCombatStates(): Map<string, CombatData> {
    return this.combatStates;
  }

  canAttack(attackerId: string): boolean {
    const lastAttack = this.attackCooldowns.get(attackerId) || 0;
    return Date.now() - lastAttack >= this.ATTACK_COOLDOWN;
  }

  destroy(): void {
    this.combatStates.clear();
    this.attackCooldowns.clear();
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}