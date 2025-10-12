 
/**
 * Mob AI System
 * Handles mob artificial intelligence, spawning, and combat behavior
 */

import THREE from '../extras/three';
import type { CombatTarget, MobAIStateData, MobAIStateType, Player } from '../types/core';
import * as Payloads from '../types/event-payloads';
import { EventType } from '../types/events';
import type { World } from '../types/index';

import { MobEntity } from '../entities/MobEntity';
import type { MobData } from '../types/core';
import { MobType } from '../types/entities';
import type { MobAISystemInfo as SystemInfo } from '../types/system-types';
import { Logger } from '../utils/Logger';
import type { PlayerSystem } from './PlayerSystem';
import { SystemBase } from './SystemBase';

const _v3_1 = new THREE.Vector3()

// Type for mobs that may come from different sources
type MobReference = MobEntity;

export class MobAISystem extends SystemBase {
  private mobStates: Map<string, MobAIStateData> = new Map();
  private activeMobs: Map<string, MobReference> = new Map(); // Store mob references
  private combatTargets: Map<string, CombatTarget[]> = new Map(); // mobId -> targets[]
  private playerSystem?: PlayerSystem;
  
  // AI Constants
  private readonly UPDATE_INTERVAL = 1000; // Update AI every second
  private readonly AGGRO_CHECK_INTERVAL = 500; // Check for players every 0.5s
  private readonly ATTACK_COOLDOWN = 3000; // 3 second attack cooldown
  private readonly CHASE_TIMEOUT = 30000; // 30 second chase timeout
  private readonly PATROL_CHANGE_INTERVAL = 10000; // Change patrol direction every 10s
  
  private lastUpdate = 0;
  private lastAggroCheck = 0;

  constructor(world: World) {
    super(world, {
      name: 'mob-ai',
      dependencies: {
        optional: ['player', 'combat', 'world-generation', 'client-graphics']
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    // Get player system reference
    this.playerSystem = this.world.getSystem('player') as PlayerSystem | undefined;
    
    // Subscribe to mob-related events using type-safe event system
    this.subscribe(EventType.MOB_SPAWNED, (data) => this.handleMobSpawned(data));
    // MOB_DAMAGED is now in EventMap, so it receives just the data
    this.subscribe(EventType.MOB_DAMAGED, (data) => this.handleMobDamaged(data));
    // MOB_DIED is in EventMap, so it receives just the data
    this.subscribe(EventType.MOB_DIED, (data) => this.handleMobKilled(data));
  }

  /**
   * Handle mob spawning
   */
  private handleMobSpawned(data: { mobId: string; mobType: string; position: { x: number; y: number; z: number } }): void {
    // Handle the actual event structure from MobSystem
    const mobId = data.mobId;
    
    // Defer the processing to allow EntityManager to create the entity first
    setTimeout(() => {
      const mobEntity = this.world.entities.get(mobId) as MobEntity;
      
      if (!mobEntity) {
                // Try one more time after another delay
        setTimeout(() => {
          const retryEntity = this.world.entities.get(mobId) as MobEntity;
          if (retryEntity) {
            this.registerMobWithAI(mobId, retryEntity);
          } else {
            Logger.systemError('MobAISystem', `Failed to find mob entity ${mobId} after retries`);
          }
        }, 100);
        return;
      }
      
      this.registerMobWithAI(mobId, mobEntity);
    }, 10);
  }
  
  /**
   * Register mob with AI system after entity is confirmed to exist
   */
  private registerMobWithAI(mobId: string, mobEntity: MobEntity): void {
    this.activeMobs.set(mobId, mobEntity);
    
    // Get mob configuration data
    const mobData = this.getMobData(mobEntity);
    const mobType = mobData.type;
    const aggroRange = mobData.behavior.aggroRange;
    
    const aiState: MobAIStateData = {
      mobId: mobId,
      type: mobType,
      state: 'idle',
      behavior: 'aggressive', // Most mobs are aggressive by default
      lastStateChange: Date.now(),
      lastAction: Date.now(),
      isInCombat: false,
      currentTarget: null,
      aggroTargets: new Map(),
      combatCooldown: 0,
      lastAttack: 0,
      homePosition: this.getMobHomePosition(mobEntity),
      currentPosition: this.getMobHomePosition(mobEntity),
      isPatrolling: false,
      isChasing: false,
      detectionRange: aggroRange,
      leashRange: 20,
      chaseSpeed: 3.0,
      patrolRadius: 5.0,
      levelIgnore: 0, // Add missing property - level to ignore aggro from lower level players
      targetId: null,
      patrolPath: [],
      patrolIndex: 0,
      patrolTarget: null,
      combatTarget: null
    };
    
    this.mobStates.set(mobId, aiState);
    this.combatTargets.set(mobId, []);
    
      }

  /**
   * Handle mob taking damage
   */
  private handleMobDamaged(data: { mobId: string; damage: number; attackerId: string }): void {
    const { mobId, damage, attackerId } = data;
    const mob = this.activeMobs.get(mobId);
    const aiState = this.mobStates.get(mobId);
    
    if (!mob || !aiState) return;
    
    // Check if mob is already dead
    const currentHealth = this.getMobCurrentHealth(mob);
    if (currentHealth <= 0) return; // Already dead
    
    // Check if mob has takeDamage method (is a MobEntity instance)
    if (mob instanceof MobEntity) {
      // Use the takeDamage method
      mob.takeDamage(damage, attackerId);
    } else {
      // Handle plain mob objects from WorldContentSystem
      // Apply damage directly to the mob data
      const mobData = this.getMobData(mob);
      const newHealth = Math.max(0, currentHealth - damage);
      mobData.stats.health = newHealth;
      if ('currentHealth' in mob) {
        (mob as { currentHealth: number }).currentHealth = newHealth;
      }
      
      // Emit damage event for visual feedback
      this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
        targetId: mobId,
        damage,
        position: this.getMobHomePosition(mob)
      });
      
      // Check if mob died
      if (newHealth <= 0) {
        this.killMob(mobId, attackerId);
        return;
      }
    }
    
    // Add attacker as combat target  
    this.addCombatTarget(mobId, attackerId, 100); // High threat for attacker
    
    // Enter combat state if not already
    if (aiState.state !== 'combat' && aiState.state !== 'chase') {
      this.setMobState(aiState, 'chase');
    }
  }

  /**
   * Handle mob death
   */
  private handleMobKilled(data: Payloads.MobDiedPayload): void {
    const { mobId, killerId } = data;
    const mob = this.activeMobs.get(mobId);
    const aiState = this.mobStates.get(mobId);
    
    if (!mob || !aiState) return;
    
    this.killMob(mobId, killerId);
  }

  /**
   * Kill a mob
   */
  private killMob(mobId: string, _killerId: string): void {
    const mob = this.activeMobs.get(mobId);
    const aiState = this.mobStates.get(mobId);
    
    if (!mob || !aiState) return;

    // Remove from world
    if (mob.mesh) {
      this.world.stage.scene.remove(mob.mesh);
    }
    
    // Set AI state to dead
    this.setMobState(aiState, 'dead');
    
    // Clear combat targets
    this.combatTargets.set(mobId, []);
    
    // Emit death event for loot system
    // Disabled - MobSystem handles MOB_DIED events
    // this.emitTypedEvent(EventType.MOB_DIED, {
    //   mobId,
    //   killerId,
    //   mobData: mobData,
    //   position: position
    // });
  }

  /**
   * Add a combat target for a mob
   */
  private addCombatTarget(mobId: string, attackerId: string, threat: number): void {
    const targets = this.combatTargets.get(mobId) || [];
    const mob = this.activeMobs.get(mobId);
    
    if (!mob) return;
    
    // Try to get player entity
    let playerEntity: unknown = null;
    try {
      playerEntity = this.world.getPlayer(attackerId);
    } catch (_error) {
      // Handle test scenarios where attacker ID is not a real player
    }
    
    // For test entities or non-player attackers, create a minimal target data
    let position: { x: number; y: number; z: number };
    
        const playerWithNode = playerEntity as { node?: { position: THREE.Vector3 } };
        if (playerEntity && playerWithNode?.node?.position) {
        const playerPos = playerWithNode.node.position;
        position = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    } else {
      // For test entities, use mob's current position as a fallback
      if (!mob.mesh) return; // Can't add target if mob mesh isn't initialized
      position = { x: mob.mesh.position.x, y: mob.mesh.position.y, z: mob.mesh.position.z };
    }
    
    // Check if target already exists
    const existingIndex = targets.findIndex(t => t.playerId === attackerId);
    
    const distance = mob.mesh ? mob.mesh.position.distanceTo(new THREE.Vector3(position.x, position.y, position.z)) : 0;
    
    const targetData: CombatTarget = {
      entityId: attackerId,
      entityType: 'player' as const,
      playerId: attackerId,
      position: position,
              distance: distance,
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
  private setMobState(aiState: MobAIStateData, newState: MobAIStateType): void {
    if (aiState.state === newState) return;
    
    const _oldState = aiState.state;
    aiState.state = newState;
    aiState.lastStateChange = Date.now();
    
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
  private updateAIStates(_deltaTime: number): void {
    const _now = Date.now();
    
    for (const [mobId, aiState] of this.mobStates) {
      const mob = this.activeMobs.get(mobId);
      if (!mob) continue;
      
      if (this.getMobCurrentHealth(mob) <= 0 && aiState.state !== 'dead') {
        this.setMobState(aiState, 'dead');
        continue;
      }
      
      // Update combat cooldown
      if (aiState.combatCooldown > 0) {
        aiState.combatCooldown -= _deltaTime * 1000;
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
  private updateIdleState(mob: MobReference, aiState: MobAIStateData): void {
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
  private updatePatrolState(mob: MobReference, aiState: MobAIStateData): void {
    const now = Date.now();
    
    if (!mob.mesh) return;
    
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
    if (aiState.patrolTarget) {
      const distance = mob.mesh.position.distanceTo(aiState.patrolTarget);
      if (distance < 1.0) {
        this.setMobState(aiState, 'idle');
      }
    }
  }

  /**
   * Update chase state
   */
  private updateChaseState(mob: MobReference, aiState: MobAIStateData): void {
    const _now = Date.now();
    const targets = this.combatTargets.get(mob.id) || [];
    
    if (!mob.mesh) return;
    
    if (targets.length === 0) {
      this.setMobState(aiState, 'returning');
      return;
    }
    
    // Find primary target
    const primaryTarget = targets.reduce((a, b) => a.threat > b.threat ? a : b);
    
    // Try to get player entity (might not exist for test entities)
    let playerEntity: unknown = null;
    try {
      playerEntity = this.world.getPlayer(primaryTarget.playerId);
    } catch (_error) {
      // Test entity - use stored position
    }
    
    // Use player position if available, otherwise use stored position
    const playerWithNode = playerEntity as { node?: { position: THREE.Vector3 } };
    const targetPosition = (playerEntity && playerWithNode?.node?.position) || primaryTarget.position;
    
    if (!targetPosition) {
      this.setMobState(aiState, 'idle');
      return;
    }
    
    const distance = mob.mesh.position.distanceTo(primaryTarget.position);
    
    // Check if we're close enough to attack
    if (distance <= 2.0) { // Attack range
      aiState.combatTarget = primaryTarget;
      this.setMobState(aiState, 'combat');
      return;
    }
    
    // Check if target is too far (leashed)
    const homeDistance = mob.mesh.position.distanceTo(_v3_1.set(
      aiState.homePosition.x,
      aiState.homePosition.y,
      aiState.homePosition.z
    ));
    
    if (homeDistance > 50) { // Max leash distance
      targets.length = 0; // Clear targets
      this.setMobState(aiState, 'returning');
    }
  }

  /**
   * Update combat state
   */
  private updateCombatState(mob: MobReference, aiState: MobAIStateData): void {
    const now = Date.now();
    const targets = this.combatTargets.get(mob.id) || [];
    
    if (!mob.mesh) return;
    
    if (targets.length === 0 || !aiState.combatTarget) {
      this.setMobState(aiState, 'returning');
      return;
    }
    
    // Try to get player entity (might not exist for test entities)
    let playerEntity: unknown = null;
    try {
      playerEntity = this.world.getPlayer(aiState.combatTarget.playerId);
    } catch (_error) {
      // Test entity - use stored position
    }
    
    // Use player position if available, otherwise use stored position
    const playerWithNode = playerEntity as { node?: { position: THREE.Vector3 } };
    const targetPosition: { x: number; y: number; z: number } = playerWithNode?.node?.position || aiState.combatTarget.position || { x: 0, y: 0, z: 0 };
    
    if (!targetPosition) {
      this.setMobState(aiState, 'chase');
      return;
    }
    
    const distance = mob.mesh.position.distanceTo(_v3_1.set(targetPosition.x, targetPosition.y, targetPosition.z));
    
    // Too far for combat, chase
    if (distance > 3.0) {
      this.setMobState(aiState, 'chase');
      return;
    }
    
    // Attack if cooldown is ready
    if (aiState.combatCooldown <= 0) {
      this.performMobAttack(mob, aiState, aiState.combatTarget);
      aiState.combatCooldown = this.ATTACK_COOLDOWN;
      aiState.lastAttack = now;
    }
  }

  /**
   * Update returning state
   */
  private updateReturningState(mob: MobReference, aiState: MobAIStateData): void {

    if (!mob.mesh) return;
    
    const homePos = _v3_1.set(
      aiState.homePosition.x,
      aiState.homePosition.y,
      aiState.homePosition.z
    );
    const distance = mob.mesh.position.distanceTo(homePos);
    
    if (distance < 1.0) {
      this.setMobState(aiState, 'idle');
    }
  }

  /**
   * Update dead state
   */
  private updateDeadState(mob: MobReference, aiState: MobAIStateData): void {
    const now = Date.now();
    
    // Check if ready to respawn (30 second respawn time)
    if (now - aiState.lastStateChange >= 30000) {
      this.respawnMob(mob, aiState);
    }
  }

  /**
   * Generate a patrol target within spawn radius
   */
  private generatePatrolTarget(mob: MobReference, aiState: MobAIStateData): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * aiState.patrolRadius * 0.8;
    
    if (!aiState.patrolTarget) {
      aiState.patrolTarget = { x: 0, y: 0, z: 0 };
    }
    aiState.patrolTarget.x = aiState.homePosition.x + Math.cos(angle) * distance;
    aiState.patrolTarget.y = aiState.homePosition.y;
    aiState.patrolTarget.z = aiState.homePosition.z + Math.sin(angle) * distance;
  }

  /**
   * Perform mob attack
   */
  private performMobAttack(mob: MobReference, aiState: MobAIStateData, target: CombatTarget): void {
    const mobData = this.getMobData(mob);
    const rpgMobData = mobData;
    const stats = rpgMobData.stats || { attack: 1, strength: 1, defense: 1, constitution: 1, ranged: 1 };
    
    // Calculate damage - this is just for logging, actual damage is calculated by CombatSystem
    const _estimatedDamage = Math.floor((stats.attack || 1) * (0.8 + Math.random() * 0.4));
    
    console.log(`[MobAISystem] Mob ${mob.id} attacking player ${target.entityId}`);
    
    // Emit attack event to CombatSystem which will handle damage calculation
    this.emitTypedEvent(EventType.COMBAT_MOB_ATTACK, {
      mobId: mob.id,
      targetId: target.entityId
    });
    
  }

  /**
   * Calculate mob damage
   */
  private calculateMobDamage(mob: MobReference): number {
    const mobData = this.getMobData(mob);
    const baseDamage = mobData.stats?.strength || 1;
    const variance = Math.random() * 0.4 + 0.8; // 80-120% of base damage
    
    return Math.floor(baseDamage * variance);
  }

  /**
   * Check for player aggro
   */
  private checkPlayerAggro(): void {
    const players = this.world.getPlayers() || [];
    
    for (const [mobId, mob] of this.activeMobs) {
      
      
      const aiState = this.mobStates.get(mobId);
      if (!aiState || aiState.state === 'dead') continue;
      
      // Skip if mob mesh is not initialized yet
      if (!mob.mesh) {
        continue;
      }
      
      // Skip if mob is not aggressive
      const mobData = this.getMobData(mob);
      if (!mobData.behavior.aggressive) continue;
      
      for (const player of players) {
        // Ensure player has valid position before calculating distance
        const playerPos = player.node?.position
        if (!playerPos) {
          console.warn(`[MobAISystem] Player ${player.id} has no valid node position`);
          continue;
        }

        const distance = mob.mesh.position.distanceTo(playerPos);

        // Check aggro range
        const mobData = this.getMobData(mob);
        const aggroRange = mobData.behavior.aggroRange || 10;
        if (distance <= aggroRange) {
          // Get player data
          const rpgPlayer = this.playerSystem?.getPlayer(player.id);
          if (rpgPlayer) {
            // Check level-based aggro rules
            const shouldAttack = this.shouldMobAttackPlayer(mob, rpgPlayer);
            if (shouldAttack) {
              this.addCombatTarget(mobId, player.id, 50);
            }
          }
        }
      }
    }
  }

  /**
   * Check if mob should attack player based on level rules
   */
  private shouldMobAttackPlayer(mob: MobReference, _player: Player): boolean {
    // Non-aggressive mobs don't attack
    const mobData = this.getMobData(mob);
    if (!mobData.behavior.aggressive) {
      return false;
    }
    
    // For now, all aggressive mobs attack everyone
    // TODO: Implement level-based aggro rules if needed
    
    return true;
  }

  /**
   * Respawn a mob
   */
  private respawnMob(mob: MobReference, aiState: MobAIStateData): void {
    
    if (!mob.mesh) return;
    
    // Reset mob state
    aiState.state = 'idle';
    aiState.lastStateChange = Date.now();
    
    // Reset position to home
    mob.mesh.position.set(
      aiState.homePosition.x,
      aiState.homePosition.y,
      aiState.homePosition.z
    );
    this.world.stage.scene.add(mob.mesh);
    
    // Clear targets
    this.combatTargets.set(mob.id, []);
    aiState.currentTarget = null;
    aiState.combatTarget = null;
    
  }

  /**
   * Update mob positions and animations
   * NOTE: Movement is now handled by MobEntity.serverUpdate() on server
   * This system only tracks AI state for compatibility
   */
  private updateMobMovement(_deltaTime: number): void {
    // DISABLED: Movement now handled by MobEntity which properly syncs to clients
    // MobEntity.serverUpdate() handles all AI logic and movement
    // Entity.setPosition() → Entity.markNetworkDirty() → EntityManager.sendNetworkUpdates()
    
    // We keep this method for state tracking but don't modify positions
    // Visual animations (if any) can be added here for client-side effects only
  }

  /**
   * Move mob towards target
   * DISABLED: Movement now handled by MobEntity
   */
  private moveMobTowards(_mob: MobReference, _targetPosition: THREE.Vector3, _speed: number): void {
    // DISABLED: MobEntity handles all movement via setPosition()
    // Direct mesh.position modification bypasses network sync!
    // Do not re-enable this method - it causes desync issues
  }

  /**
   * Helper method to get mob data from mob entity
   */
  private getMobData(mob: MobReference): MobData {
    // Handle MobEntity instances
    if (mob instanceof MobEntity) {
      const data = mob.getMobData();
      // Convert MobEntityData to MobData format
      return {
        id: data.id,
        type: data.type as MobData['type'],
        name: data.name,
        description: data.name || 'A creature',
        difficultyLevel: Math.min(3, Math.max(1, data.level)) as 1 | 2 | 3,
        mobType: data.type,
        stats: {
          level: data.level,
          health: data.health,
          attack: Math.floor(data.attackPower / 10),
          strength: Math.floor(data.attackPower / 10),
          defense: Math.floor(data.defense / 10),
          constitution: data.level,
          ranged: 1
        },
        behavior: {
          aggressive: true,
          aggroRange: 10,
          chaseRange: 15,
          returnToSpawn: true,
          ignoreLowLevelPlayers: false,
          levelThreshold: 0
        },
        drops: [],
        spawnBiomes: ['grassland'],
        modelPath: 'models/mobs/goblin.glb',
        animationSet: {
          idle: 'idle',
          walk: 'walk',
          attack: 'attack',
          death: 'death'
        },
        respawnTime: 30000,
        xpReward: data.level * 10,
        
        // Shortcut properties
        health: data.health,
        maxHealth: data.maxHealth || data.health,
        level: data.level
      };
    }
    
    // Handle plain mob objects - return mock data for now
    // This shouldn't happen in normal operation
          Logger.systemWarn('MobAISystem', 'getMobData called with non-MobEntity object');
    return {
      id: 'unknown',
      type: MobType.GOBLIN,
      name: 'Unknown',
      description: 'Unknown creature',
      difficultyLevel: 1 as 1 | 2 | 3,
      mobType: MobType.GOBLIN,
      stats: {
        level: 1,
        health: 0,
        attack: 1,
        strength: 1,
        defense: 1,
        constitution: 1,
        ranged: 1
      },
      behavior: {
        aggressive: false,
        aggroRange: 10,
        chaseRange: 15,
        returnToSpawn: true,
        ignoreLowLevelPlayers: false,
        levelThreshold: 0
      },
      drops: [],
      spawnBiomes: ['grassland'],
      modelPath: 'models/mobs/goblin.glb',
      animationSet: {
        idle: 'idle',
        walk: 'walk',
        attack: 'attack',
        death: 'death'
      },
      respawnTime: 30000,
      xpReward: 10,
      
      // Shortcut properties
      health: 0,
      maxHealth: 1,
      level: 1
    };
  }

  /**
   * Helper method to get current health from mob entity
   */
  private getMobCurrentHealth(mob: MobReference): number {
    if (mob instanceof MobEntity) {
      return mob.getMobData().health;
    }
    Logger.systemWarn('MobAISystem', 'getMobCurrentHealth called with non-MobEntity object');
    return 0;
  }

  /**
   * Helper method to get home position from mob entity
   */
  private getMobHomePosition(mob: MobReference): { x: number; y: number; z: number } {
    const data = mob.getMobData();
    return data.spawnPoint;
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): SystemInfo {
    const stateDistribution: Record<MobAIStateType, number> = {
      idle: 0,
      patrol: 0,
      chase: 0,
      attack: 0,
      flee: 0,
      dead: 0,
      combat: 0,
      returning: 0
    };
    
    for (const aiState of this.mobStates.values()) {
      const state = aiState.state;
      stateDistribution[state] = (stateDistribution[state] || 0) + 1;
    }
    
    return {
      activeMobs: this.activeMobs.size,
      mobStates: this.mobStates.size,
      stateDistribution,
      totalCombatTargets: Array.from(this.combatTargets.values()).reduce((sum, targets) => sum + targets.length, 0)
    };
  }



  destroy(): void {
    // Clear all AI state
    this.mobStates.clear();
    this.activeMobs.clear();
    this.combatTargets.clear();
    
    // Reset timing state
    this.lastUpdate = 0;
    this.lastAggroCheck = 0;
    
    // Call parent cleanup (handles event listeners and managed timers)
    super.destroy();
  }
}