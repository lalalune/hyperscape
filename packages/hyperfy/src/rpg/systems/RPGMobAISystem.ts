/**
 * RPG Mob AI System
 * Handles mob artificial intelligence, spawning, and combat behavior
 */

import * as THREE from '../../core/extras/three';
import { System } from '../../core/systems/System';
import { MobEntity } from './RPGWorldContentSystem';
import { MobData, calculateMobCombatLevel } from '../data/mobs';

export interface CombatTarget {
  playerId: string;
  position: THREE.Vector3;
  lastSeen: number;
  threat: number;
}

export interface MobAIState {
  mobId: string;
  state: 'idle' | 'patrol' | 'chase' | 'combat' | 'returning' | 'dead';
  target?: CombatTarget;
  lastStateChange: number;
  patrolTarget?: THREE.Vector3;
  combatCooldown: number;
  lastAttack: number;
}

export class RPGMobAISystem extends System {
  private mobStates: Map<string, MobAIState> = new Map();
  private activeMobs: Map<string, MobEntity> = new Map();
  private combatTargets: Map<string, CombatTarget[]> = new Map(); // mobId -> targets[]
  
  // AI Constants
  private readonly UPDATE_INTERVAL = 1000; // Update AI every second
  private readonly AGGRO_CHECK_INTERVAL = 500; // Check for players every 0.5s
  private readonly ATTACK_COOLDOWN = 3000; // 3 second attack cooldown
  private readonly CHASE_TIMEOUT = 30000; // 30 second chase timeout
  private readonly PATROL_CHANGE_INTERVAL = 10000; // Change patrol direction every 10s
  
  private lastUpdate = 0;
  private lastAggroCheck = 0;

  constructor(world: any) {
    super(world);
    
    // Listen for mob-related events
    this.world.on?.('rpg:mob:spawned', this.handleMobSpawned.bind(this));
    this.world.on?.('rpg:mob:damaged', this.handleMobDamaged.bind(this));
    this.world.on?.('rpg:mob:killed', this.handleMobKilled.bind(this));
    this.world.on?.('rpg:player:attack', this.handlePlayerAttack.bind(this));
    
    console.log('[RPGMobAISystem] Initialized mob AI system');
  }

  /**
   * Handle mob spawning
   */
  private handleMobSpawned(data: { mob: MobEntity }): void {
    const { mob } = data;
    
    this.activeMobs.set(mob.id, mob);
    
    const aiState: MobAIState = {
      mobId: mob.id,
      state: 'idle',
      lastStateChange: Date.now(),
      combatCooldown: 0,
      lastAttack: 0
    };
    
    this.mobStates.set(mob.id, aiState);
    this.combatTargets.set(mob.id, []);
    
    console.log(`[RPGMobAISystem] Mob ${mob.id} spawned with AI state`);
  }

  /**
   * Handle mob taking damage
   */
  private handleMobDamaged(data: { mobId: string, damage: number, attackerId: string }): void {
    const { mobId, damage, attackerId } = data;
    const mob = this.activeMobs.get(mobId);
    const aiState = this.mobStates.get(mobId);
    
    if (!mob || !aiState || !mob.isAlive) return;
    
    // Reduce mob health
    mob.currentHealth = Math.max(0, mob.currentHealth - damage);
    
    // Add attacker as combat target
    this.addCombatTarget(mobId, attackerId, 100); // High threat for attacker
    
    if (mob.currentHealth <= 0) {
      this.killMob(mobId, attackerId);
    } else {
      // Enter combat state if not already
      if (aiState.state !== 'combat') {
        this.setMobState(aiState, 'combat');
      }
    }
    
    console.log(`[RPGMobAISystem] Mob ${mobId} took ${damage} damage from ${attackerId} (${mob.currentHealth}/${mob.mobData.stats.health} HP)`);
  }

  /**
   * Handle mob death
   */
  private handleMobKilled(data: { mobId: string, killerId: string }): void {
    const { mobId, killerId } = data;
    const mob = this.activeMobs.get(mobId);
    const aiState = this.mobStates.get(mobId);
    
    if (!mob || !aiState) return;
    
    this.killMob(mobId, killerId);
  }

  /**
   * Handle player attacking
   */
  private handlePlayerAttack(data: { playerId: string, targetId: string, damage: number }): void {
    const { playerId, targetId, damage } = data;
    
    // If target is a mob, handle damage
    if (this.activeMobs.has(targetId)) {
      this.handleMobDamaged({ mobId: targetId, damage, attackerId: playerId });
    }
  }

  /**
   * Kill a mob
   */
  private killMob(mobId: string, killerId: string): void {
    const mob = this.activeMobs.get(mobId);
    const aiState = this.mobStates.get(mobId);
    
    if (!mob || !aiState) return;
    
    mob.isAlive = false;
    mob.lastRespawn = Date.now();
    
    // Remove from world
    if (mob.mesh) {
      this.world.stage?.scene?.remove(mob.mesh);
    }
    
    // Set AI state to dead
    this.setMobState(aiState, 'dead');
    
    // Clear combat targets
    this.combatTargets.set(mobId, []);
    
    // Emit death event for loot system
    this.world.emit?.('rpg:mob:death', {
      mobId,
      killerId,
      mobData: mob.mobData,
      position: mob.mesh?.position || mob.homePosition,
      xpReward: mob.mobData.xpReward
    });
    
    console.log(`[RPGMobAISystem] Mob ${mobId} killed by ${killerId}`);
  }

  /**
   * Add a combat target for a mob
   */
  private addCombatTarget(mobId: string, playerId: string, threat: number): void {
    const targets = this.combatTargets.get(mobId) || [];
    const player = this.world.getPlayer?.(playerId);
    
    if (!player?.position) return;
    
    // Check if target already exists
    const existingIndex = targets.findIndex(t => t.playerId === playerId);
    
    const targetData: CombatTarget = {
      playerId,
      position: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
      lastSeen: Date.now(),
      threat: existingIndex >= 0 ? targets[existingIndex].threat + threat : threat
    };
    
    if (existingIndex >= 0) {
      targets[existingIndex] = targetData;
    } else {
      targets.push(targetData);
    }
    
    // Sort by threat level (highest first)
    targets.sort((a, b) => b.threat - a.threat);
    
    this.combatTargets.set(mobId, targets);
  }

  /**
   * Set mob AI state
   */
  private setMobState(aiState: MobAIState, newState: MobAIState['state']): void {
    if (aiState.state === newState) return;
    
    const oldState = aiState.state;
    aiState.state = newState;
    aiState.lastStateChange = Date.now();
    
    console.log(`[RPGMobAISystem] Mob ${aiState.mobId} state: ${oldState} -> ${newState}`);
  }

  /**
   * Update mob AI system
   */
  update(deltaTime: number): void {
    const now = Date.now();
    
    // Update AI states
    if (now - this.lastUpdate >= this.UPDATE_INTERVAL) {
      this.updateAIStates(deltaTime);
      this.lastUpdate = now;
    }
    
    // Check for player aggro
    if (now - this.lastAggroCheck >= this.AGGRO_CHECK_INTERVAL) {
      this.checkPlayerAggro();
      this.lastAggroCheck = now;
    }
    
    // Update mob positions and animations
    this.updateMobMovement(deltaTime);
  }

  /**
   * Update AI states for all mobs
   */
  private updateAIStates(deltaTime: number): void {
    const now = Date.now();
    
    for (const [mobId, aiState] of this.mobStates) {
      const mob = this.activeMobs.get(mobId);
      if (!mob || !mob.isAlive) continue;
      
      // Update combat cooldown
      if (aiState.combatCooldown > 0) {
        aiState.combatCooldown -= deltaTime * 1000;
      }
      
      switch (aiState.state) {
        case 'idle':
          this.updateIdleState(mob, aiState);
          break;
        case 'patrol':
          this.updatePatrolState(mob, aiState);
          break;
        case 'chase':
          this.updateChaseState(mob, aiState);
          break;
        case 'combat':
          this.updateCombatState(mob, aiState);
          break;
        case 'returning':
          this.updateReturningState(mob, aiState);
          break;
        case 'dead':
          this.updateDeadState(mob, aiState);
          break;
      }
    }
  }

  /**
   * Update idle state
   */
  private updateIdleState(mob: MobEntity, aiState: MobAIState): void {
    const now = Date.now();
    
    // Check for nearby targets
    const targets = this.combatTargets.get(mob.id) || [];
    if (targets.length > 0) {
      this.setMobState(aiState, 'chase');
      return;
    }
    
    // Enter patrol state after being idle for a while
    if (now - aiState.lastStateChange > 5000) {
      this.setMobState(aiState, 'patrol');
    }
  }

  /**
   * Update patrol state
   */
  private updatePatrolState(mob: MobEntity, aiState: MobAIState): void {
    const now = Date.now();
    
    // Check for nearby targets
    const targets = this.combatTargets.get(mob.id) || [];
    if (targets.length > 0) {
      this.setMobState(aiState, 'chase');
      return;
    }
    
    // Generate new patrol target if needed
    if (!aiState.patrolTarget || now - aiState.lastStateChange > this.PATROL_CHANGE_INTERVAL) {
      this.generatePatrolTarget(mob, aiState);
    }
    
    // Check if reached patrol target
    if (aiState.patrolTarget && mob.mesh) {
      const distance = mob.mesh.position.distanceTo(aiState.patrolTarget);
      if (distance < 1.0) {
        this.setMobState(aiState, 'idle');
      }
    }
  }

  /**
   * Update chase state
   */
  private updateChaseState(mob: MobEntity, aiState: MobAIState): void {
    const now = Date.now();
    const targets = this.combatTargets.get(mob.id) || [];
    
    // No targets, return to patrol
    if (targets.length === 0) {
      this.setMobState(aiState, 'returning');
      return;
    }
    
    // Chase timeout
    if (now - aiState.lastStateChange > this.CHASE_TIMEOUT) {
      this.combatTargets.set(mob.id, []); // Clear targets
      this.setMobState(aiState, 'returning');
      return;
    }
    
    // Get primary target
    const primaryTarget = targets[0];
    const player = this.world.getPlayer?.(primaryTarget.playerId);
    
    if (!player?.position || !mob.mesh) {
      this.setMobState(aiState, 'returning');
      return;
    }
    
    // Update target position
    primaryTarget.position.set(player.position.x, player.position.y, player.position.z);
    primaryTarget.lastSeen = now;
    
    // Check if close enough for combat
    const distance = mob.mesh.position.distanceTo(primaryTarget.position);
    if (distance <= 2.0) {
      this.setMobState(aiState, 'combat');
      aiState.target = primaryTarget;
    }
    
    // Check if too far from home
    const homeDistance = mob.mesh.position.distanceTo(mob.homePosition);
    if (homeDistance > mob.spawnPoint.spawnRadius * 2) {
      this.combatTargets.set(mob.id, []); // Clear targets
      this.setMobState(aiState, 'returning');
    }
  }

  /**
   * Update combat state
   */
  private updateCombatState(mob: MobEntity, aiState: MobAIState): void {
    const now = Date.now();
    const targets = this.combatTargets.get(mob.id) || [];
    
    if (targets.length === 0 || !aiState.target) {
      this.setMobState(aiState, 'returning');
      return;
    }
    
    const player = this.world.getPlayer?.(aiState.target.playerId);
    if (!player?.position || !mob.mesh) {
      this.setMobState(aiState, 'chase');
      return;
    }
    
    const distance = mob.mesh.position.distanceTo(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
    
    // Too far for combat, chase
    if (distance > 3.0) {
      this.setMobState(aiState, 'chase');
      return;
    }
    
    // Attack if cooldown is ready
    if (aiState.combatCooldown <= 0) {
      this.performMobAttack(mob, aiState, player);
      aiState.combatCooldown = this.ATTACK_COOLDOWN;
      aiState.lastAttack = now;
    }
  }

  /**
   * Update returning state
   */
  private updateReturningState(mob: MobEntity, aiState: MobAIState): void {
    if (!mob.mesh) return;
    
    const distance = mob.mesh.position.distanceTo(mob.homePosition);
    
    // Reached home, return to idle
    if (distance < 1.0) {
      this.setMobState(aiState, 'idle');
    }
  }

  /**
   * Update dead state
   */
  private updateDeadState(mob: MobEntity, aiState: MobAIState): void {
    const now = Date.now();
    
    // Check if ready to respawn
    if (now - mob.lastRespawn >= mob.spawnPoint.respawnTime) {
      this.respawnMob(mob, aiState);
    }
  }

  /**
   * Generate a patrol target within spawn radius
   */
  private generatePatrolTarget(mob: MobEntity, aiState: MobAIState): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mob.spawnPoint.spawnRadius * 0.8;
    
    aiState.patrolTarget = new THREE.Vector3(
      mob.homePosition.x + Math.cos(angle) * distance,
      mob.homePosition.y,
      mob.homePosition.z + Math.sin(angle) * distance
    );
  }

  /**
   * Perform mob attack
   */
  private performMobAttack(mob: MobEntity, aiState: MobAIState, target: any): void {
    const damage = this.calculateMobDamage(mob);
    
    // Emit attack event
    this.world.emit?.('rpg:mob:attack', {
      mobId: mob.id,
      targetId: target.id,
      damage,
      mobData: mob.mobData
    });
    
    console.log(`[RPGMobAISystem] Mob ${mob.id} attacks player ${target.id} for ${damage} damage`);
  }

  /**
   * Calculate mob damage
   */
  private calculateMobDamage(mob: MobEntity): number {
    const stats = mob.mobData.stats;
    const baseDamage = stats.strength;
    const variance = Math.random() * 0.4 + 0.8; // 80-120% of base damage
    
    return Math.floor(baseDamage * variance);
  }

  /**
   * Check for player aggro
   */
  private checkPlayerAggro(): void {
    const players = this.world.getPlayers?.() || [];
    
    for (const [mobId, mob] of this.activeMobs) {
      if (!mob.isAlive || !mob.mesh) continue;
      
      const aiState = this.mobStates.get(mobId);
      if (!aiState || aiState.state === 'dead') continue;
      
      // Skip if mob is not aggressive
      if (!mob.mobData.behavior.aggressive) continue;
      
      for (const player of players) {
        if (!player.position) continue;
        
        const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
        const distance = mob.mesh.position.distanceTo(playerPos);
        
        // Check aggro range
        if (distance <= mob.mobData.behavior.aggroRange) {
          // Check level-based aggro rules
          if (this.shouldMobAttackPlayer(mob, player)) {
            this.addCombatTarget(mobId, player.id, 50);
          }
        }
      }
    }
  }

  /**
   * Check if mob should attack player based on level rules
   */
  private shouldMobAttackPlayer(mob: MobEntity, player: any): boolean {
    const behavior = mob.mobData.behavior;
    
    // Always aggressive mobs attack everyone
    if (!behavior.ignoreLowLevelPlayers) {
      return true;
    }
    
    // Level-sensitive mobs ignore high-level players
    if (behavior.levelThreshold && player.combatLevel > behavior.levelThreshold) {
      return false;
    }
    
    return true;
  }

  /**
   * Respawn a mob
   */
  private respawnMob(mob: MobEntity, aiState: MobAIState): void {
    mob.isAlive = true;
    mob.currentHealth = mob.mobData.stats.health;
    mob.lastRespawn = Date.now();
    
    // Reset position to home
    if (mob.mesh) {
      mob.mesh.position.copy(mob.homePosition);
      this.world.stage?.scene?.add(mob.mesh);
    }
    
    // Reset AI state
    this.setMobState(aiState, 'idle');
    this.combatTargets.set(mob.id, []);
    
    console.log(`[RPGMobAISystem] Mob ${mob.id} respawned`);
  }

  /**
   * Update mob movement and animations
   */
  private updateMobMovement(deltaTime: number): void {
    for (const [mobId, mob] of this.activeMobs) {
      if (!mob.isAlive || !mob.mesh) continue;
      
      const aiState = this.mobStates.get(mobId);
      if (!aiState) continue;
      
      // Move mob based on AI state
      this.moveMobToTarget(mob, aiState, deltaTime);
      
      // Apply bobbing animation
      const time = Date.now() * 0.001;
      const bobOffset = Math.sin(time * 2 + mob.homePosition.x) * 0.02;
      mob.mesh.position.y = mob.homePosition.y + 0.9 + bobOffset;
    }
  }

  /**
   * Move mob towards target based on AI state
   */
  private moveMobToTarget(mob: MobEntity, aiState: MobAIState, deltaTime: number): void {
    if (!mob.mesh) return;
    
    let targetPosition: THREE.Vector3 | null = null;
    
    switch (aiState.state) {
      case 'patrol':
        targetPosition = aiState.patrolTarget || null;
        break;
      case 'chase':
      case 'combat':
        if (aiState.target) {
          targetPosition = aiState.target.position;
        }
        break;
      case 'returning':
        targetPosition = mob.homePosition;
        break;
    }
    
    if (!targetPosition) return;
    
    // Calculate movement
    const direction = new THREE.Vector3().subVectors(targetPosition, mob.mesh.position).normalize();
    const speed = this.getMobMoveSpeed(mob, aiState);
    const movement = direction.multiplyScalar(speed * deltaTime);
    
    // Apply movement (only X and Z axes)
    mob.mesh.position.x += movement.x;
    mob.mesh.position.z += movement.z;
    
    // Rotate to face movement direction
    if (movement.length() > 0) {
      const angle = Math.atan2(movement.x, movement.z);
      mob.mesh.rotation.y = angle;
    }
  }

  /**
   * Get mob movement speed based on state
   */
  private getMobMoveSpeed(mob: MobEntity, aiState: MobAIState): number {
    const baseSpeed = 2.0; // Base movement speed
    
    switch (aiState.state) {
      case 'patrol':
        return baseSpeed * 0.5; // Slow patrol
      case 'chase':
        return baseSpeed * 1.2; // Fast chase
      case 'combat':
        return baseSpeed * 0.3; // Slow combat movement
      case 'returning':
        return baseSpeed * 0.8; // Medium return speed
      default:
        return 0;
    }
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): any {
    const stateDistribution: { [key: string]: number } = {};
    
    for (const aiState of this.mobStates.values()) {
      stateDistribution[aiState.state] = (stateDistribution[aiState.state] || 0) + 1;
    }
    
    return {
      activeMobs: this.activeMobs.size,
      mobStates: this.mobStates.size,
      stateDistribution,
      totalCombatTargets: Array.from(this.combatTargets.values()).reduce((sum, targets) => sum + targets.length, 0)
    };
  }

  // Required System lifecycle methods
  async init(): Promise<void> {
    console.log('[RPGMobAISystem] Mob AI system initialized');
  }

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