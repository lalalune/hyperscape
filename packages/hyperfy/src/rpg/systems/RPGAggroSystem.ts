/**
 * RPG Aggression System
 * Handles mob AI, aggression detection, and chase mechanics per GDD specifications
 * - Mob aggression based on player level and mob type
 * - Detection ranges and line-of-sight
 * - Chase mechanics with leashing
 * - Different mob behaviors (passive, aggressive, special cases)
 */

import { System } from '../../core/systems/System';

export interface AggroTarget {
  playerId: string;
  mobId: string;
  aggroLevel: number; // 0-100
  firstSeen: number; // timestamp
  lastSeen: number; // timestamp
  distance: number;
  inRange: boolean;
  inLineOfSight: boolean;
}

export interface MobAIState {
  mobId: string;
  type: string;
  behavior: 'passive' | 'aggressive' | 'defensive';
  isPatrolling: boolean;
  isChasing: boolean;
  isInCombat: boolean;
  currentTarget: string | null;
  homePosition: { x: number; y: number; z: number };
  currentPosition: { x: number; y: number; z: number };
  detectionRange: number;
  leashRange: number;
  chaseSpeed: number;
  patrolRadius: number;
  lastAction: number;
  aggroTargets: Map<string, AggroTarget>;
}

/**
 * RPG Aggression System - GDD Compliant
 * Implements mob AI and aggression mechanics per GDD specifications:
 * - Level-based aggression (low-level aggressive mobs ignore high-level players)
 * - Special cases (Dark Warriors always aggressive regardless of level)
 * - Detection ranges and chase mechanics
 * - Leashing to prevent mobs from going too far from spawn
 * - Multiple target management
 */
export class RPGAggroSystem extends System {
  private mobStates = new Map<string, MobAIState>();
  private updateInterval: NodeJS.Timeout | null = null;
  
  // GDD-compliant aggression ranges and behaviors
  private readonly MOB_BEHAVIORS = {
    'goblin': { behavior: 'aggressive' as const, detectionRange: 8, leashRange: 15, levelIgnore: 15 },
    'bandit': { behavior: 'aggressive' as const, detectionRange: 8, leashRange: 15, levelIgnore: 15 },
    'barbarian': { behavior: 'aggressive' as const, detectionRange: 10, leashRange: 20, levelIgnore: 15 },
    'hobgoblin': { behavior: 'aggressive' as const, detectionRange: 12, leashRange: 25, levelIgnore: 25 },
    'guard': { behavior: 'aggressive' as const, detectionRange: 12, leashRange: 25, levelIgnore: 25 },
    'dark_warrior': { behavior: 'aggressive' as const, detectionRange: 15, leashRange: 30, levelIgnore: 999 }, // Always aggressive
    'black_knight': { behavior: 'aggressive' as const, detectionRange: 15, leashRange: 30, levelIgnore: 999 }, // Always aggressive
    'ice_warrior': { behavior: 'aggressive' as const, detectionRange: 12, leashRange: 25, levelIgnore: 35 },
    'dark_ranger': { behavior: 'aggressive' as const, detectionRange: 20, leashRange: 35, levelIgnore: 999 }, // Always aggressive
    'default': { behavior: 'passive' as const, detectionRange: 5, leashRange: 10, levelIgnore: 0 }
  };

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGAggroSystem] Initializing GDD-compliant mob aggression system...');
    
    // Listen for mob registration and player events
    this.world.on('rpg:mob:spawned', this.registerMob.bind(this));
    this.world.on('rpg:mob:despawned', this.unregisterMob.bind(this));
    this.world.on('rpg:player:position:update', this.updatePlayerPosition.bind(this));
    this.world.on('rpg:combat:session:started', this.onCombatStarted.bind(this));
    this.world.on('rpg:combat:session:ended', this.onCombatEnded.bind(this));
    this.world.on('rpg:mob:position:update', this.updateMobPosition.bind(this));
    this.world.on('rpg:player:level:changed', this.checkAggroUpdates.bind(this));
    
    console.log('[RPGAggroSystem] Aggression system initialized with GDD mechanics');
  }

  start(): void {
    console.log('[RPGAggroSystem] Starting mob AI and aggression processing...');
    
    // Start AI update loop
    this.updateInterval = setInterval(() => {
      this.updateMobAI();
    }, 500); // Update every 500ms for responsive AI
    
    console.log('[RPGAggroSystem] Mob AI system started');
  }

  private registerMob(mobData: any): void {
    const mobType = mobData.type?.toLowerCase() || 'default';
    const behavior = this.MOB_BEHAVIORS[mobType] || this.MOB_BEHAVIORS.default;
    
    const aiState: MobAIState = {
      mobId: mobData.id,
      type: mobType,
      behavior: behavior.behavior,
      isPatrolling: false,
      isChasing: false,
      isInCombat: false,
      currentTarget: null,
      homePosition: { ...mobData.position },
      currentPosition: { ...mobData.position },
      detectionRange: behavior.detectionRange,
      leashRange: behavior.leashRange,
      chaseSpeed: 3.0, // Default chase speed
      patrolRadius: 5.0, // Default patrol radius
      lastAction: Date.now(),
      aggroTargets: new Map()
    };
    
    this.mobStates.set(mobData.id, aiState);
    
    console.log(`[RPGAggroSystem] Registered ${mobType} mob: ${mobData.id} (${behavior.behavior}, detection: ${behavior.detectionRange}m)`);
  }

  private unregisterMob(mobId: string): void {
    this.mobStates.delete(mobId);
    console.log(`[RPGAggroSystem] Unregistered mob: ${mobId}`);
  }

  private updatePlayerPosition(data: { entityId: string; position: { x: number; y: number; z: number } }): void {
    // Check all mobs for aggro against this player
    for (const [mobId, mobState] of this.mobStates) {
      if (mobState.behavior === 'passive') continue;
      
      this.checkPlayerAggro(mobState, data.entityId, data.position);
    }
  }

  private updateMobPosition(data: { entityId: string; position: { x: number; y: number; z: number } }): void {
    const mobState = this.mobStates.get(data.entityId);
    if (mobState) {
      mobState.currentPosition = { ...data.position };
    }
  }

  private checkPlayerAggro(mobState: MobAIState, playerId: string, playerPosition: { x: number; y: number; z: number }): void {
    const distance = this.calculateDistance(mobState.currentPosition, playerPosition);
    
    // Check if player is within detection range
    if (distance > mobState.detectionRange) {
      // Remove from aggro if too far
      if (mobState.aggroTargets.has(playerId)) {
        mobState.aggroTargets.delete(playerId);
        console.log(`[RPGAggroSystem] Player ${playerId} left detection range of mob ${mobState.mobId}`);
      }
      return;
    }

    // Check level-based aggression per GDD
    if (!this.shouldMobAggroPlayer(mobState, playerId)) {
      return;
    }

    // Update or create aggro target
    let aggroTarget = mobState.aggroTargets.get(playerId);
    if (!aggroTarget) {
      aggroTarget = {
        playerId: playerId,
        mobId: mobState.mobId,
        aggroLevel: 10, // Initial aggro
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        distance: distance,
        inRange: true,
        inLineOfSight: true // Simplified for MVP
      };
      
      mobState.aggroTargets.set(playerId, aggroTarget);
      
      console.log(`[RPGAggroSystem] Mob ${mobState.mobId} acquired aggro on player ${playerId}`);
      
      // Start chasing if not already in combat
      if (!mobState.isInCombat && !mobState.currentTarget) {
        this.startChasing(mobState, playerId);
      }
    } else {
      // Update existing aggro
      aggroTarget.lastSeen = Date.now();
      aggroTarget.distance = distance;
      aggroTarget.inRange = distance <= mobState.detectionRange;
    }
  }

  private shouldMobAggroPlayer(mobState: MobAIState, playerId: string): boolean {
    // Get player combat level from XP system
    const player = this.world.getPlayer?.(playerId);
    if (!player) return false;

    // Get player level - simplified for MVP, would integrate with XP system
    const playerCombatLevel = this.getPlayerCombatLevel(playerId);
    
    // Get mob behavior configuration
    const mobType = mobState.type;
    const behaviorConfig = this.MOB_BEHAVIORS[mobType] || this.MOB_BEHAVIORS.default;
    
    // Check level-based aggression per GDD
    if (playerCombatLevel > behaviorConfig.levelIgnore) {
      // Player is too high level, mob ignores them (except special cases)
      if (behaviorConfig.levelIgnore < 999) { // Special cases like Dark Warriors have levelIgnore: 999
        return false;
      }
    }
    
    return mobState.behavior === 'aggressive';
  }

  private getPlayerCombatLevel(playerId: string): number {
    // Simplified for MVP - would integrate with RPGXPSystem
    // For now, assume all players are level 1-10 for testing
    return 5; // Default test level
  }

  private startChasing(mobState: MobAIState, playerId: string): void {
    mobState.isChasing = true;
    mobState.currentTarget = playerId;
    mobState.isPatrolling = false;
    
    console.log(`[RPGAggroSystem] Mob ${mobState.mobId} started chasing player ${playerId}`);
    
    // Emit chase event for other systems
    this.world.emit('rpg:mob:chase:started', {
      mobId: mobState.mobId,
      targetPlayerId: playerId,
      mobPosition: mobState.currentPosition
    });
    
    // Start combat if close enough
    const aggroTarget = mobState.aggroTargets.get(playerId);
    if (aggroTarget && aggroTarget.distance <= 2.0) { // Melee range
      this.startCombatWithPlayer(mobState, playerId);
    }
  }

  private startCombatWithPlayer(mobState: MobAIState, playerId: string): void {
    mobState.isInCombat = true;
    
    console.log(`[RPGAggroSystem] Mob ${mobState.mobId} started combat with player ${playerId}`);
    
    // Trigger combat system
    this.world.emit('rpg:combat:start_attack', {
      attackerId: mobState.mobId,
      targetId: playerId,
      attackStyle: 'aggressive'
    });
  }

  private stopChasing(mobState: MobAIState): void {
    if (!mobState.isChasing) return;
    
    const previousTarget = mobState.currentTarget;
    
    mobState.isChasing = false;
    mobState.currentTarget = null;
    mobState.isPatrolling = true; // Resume patrolling
    
    console.log(`[RPGAggroSystem] Mob ${mobState.mobId} stopped chasing ${previousTarget}`);
    
    // Emit chase end event
    this.world.emit('rpg:mob:chase:ended', {
      mobId: mobState.mobId,
      previousTarget: previousTarget
    });
    
    // Start returning to home position
    this.returnToHome(mobState);
  }

  private returnToHome(mobState: MobAIState): void {
    const homeDistance = this.calculateDistance(mobState.currentPosition, mobState.homePosition);
    
    if (homeDistance > 2.0) { // If away from home
      console.log(`[RPGAggroSystem] Mob ${mobState.mobId} returning home (${homeDistance.toFixed(1)}m away)`);
      
      // Emit movement request to return home
      this.world.emit('rpg:mob:move:request', {
        mobId: mobState.mobId,
        targetPosition: mobState.homePosition,
        speed: mobState.chaseSpeed * 0.7, // Slower return speed
        reason: 'returning_home'
      });
    }
  }

  private updateMobAI(): void {
    const now = Date.now();
    
    for (const [mobId, mobState] of this.mobStates) {
      // Skip if in combat - combat system handles behavior
      if (mobState.isInCombat) continue;
      
      // Check leashing - if too far from home, return
      const homeDistance = this.calculateDistance(mobState.currentPosition, mobState.homePosition);
      if (homeDistance > mobState.leashRange) {
        if (mobState.isChasing) {
          this.stopChasing(mobState);
        } else {
          this.returnToHome(mobState);
        }
        continue;
      }
      
      // Clean up old aggro targets
      this.cleanupAggroTargets(mobState);
      
      // If chasing, update chase behavior
      if (mobState.isChasing && mobState.currentTarget) {
        this.updateChasing(mobState);
      } else if (mobState.behavior === 'aggressive' && mobState.aggroTargets.size > 0) {
        // Check if we should start chasing someone
        const bestTarget = this.getBestAggroTarget(mobState);
        if (bestTarget) {
          this.startChasing(mobState, bestTarget.playerId);
        }
      } else if (!mobState.isChasing && (now - mobState.lastAction) > 5000) {
        // Patrol behavior when not chasing
        this.updatePatrol(mobState);
        mobState.lastAction = now;
      }
    }
  }

  private cleanupAggroTargets(mobState: MobAIState): void {
    const now = Date.now();
    
    for (const [playerId, aggroTarget] of mobState.aggroTargets) {
      // Remove aggro if not seen for 10 seconds
      if (now - aggroTarget.lastSeen > 10000) {
        mobState.aggroTargets.delete(playerId);
        console.log(`[RPGAggroSystem] Removed stale aggro target ${playerId} from mob ${mobState.mobId}`);
      }
    }
  }

  private getBestAggroTarget(mobState: MobAIState): AggroTarget | null {
    let bestTarget: AggroTarget | null = null;
    let highestAggro = 0;
    
    for (const [playerId, aggroTarget] of mobState.aggroTargets) {
      if (aggroTarget.aggroLevel > highestAggro) {
        highestAggro = aggroTarget.aggroLevel;
        bestTarget = aggroTarget;
      }
    }
    
    return bestTarget;
  }

  private updateChasing(mobState: MobAIState): void {
    if (!mobState.currentTarget) return;
    
    const player = this.world.getPlayer?.(mobState.currentTarget);
    if (!player) {
      this.stopChasing(mobState);
      return;
    }
    
    const distance = this.calculateDistance(mobState.currentPosition, player.position);
    const aggroTarget = mobState.aggroTargets.get(mobState.currentTarget);
    
    if (!aggroTarget || distance > mobState.detectionRange * 1.5) {
      // Lost target or too far
      this.stopChasing(mobState);
      return;
    }
    
    // Update aggro target distance
    aggroTarget.distance = distance;
    aggroTarget.lastSeen = Date.now();
    
    // If close enough, start combat
    if (distance <= 2.0 && !mobState.isInCombat) {
      this.startCombatWithPlayer(mobState, mobState.currentTarget);
    } else if (distance > 2.5) {
      // Move closer to target
      this.world.emit('rpg:mob:move:request', {
        mobId: mobState.mobId,
        targetPosition: player.position,
        speed: mobState.chaseSpeed,
        reason: 'chasing_player'
      });
    }
  }

  private updatePatrol(mobState: MobAIState): void {
    // Simple patrol behavior - move to random position within patrol radius
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mobState.patrolRadius;
    
    const patrolTarget = {
      x: mobState.homePosition.x + Math.cos(angle) * distance,
      y: mobState.homePosition.y,
      z: mobState.homePosition.z + Math.sin(angle) * distance
    };
    
    this.world.emit('rpg:mob:move:request', {
      mobId: mobState.mobId,
      targetPosition: patrolTarget,
      speed: mobState.chaseSpeed * 0.5, // Slow patrol speed
      reason: 'patrolling'
    });
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Event handlers
  private onCombatStarted(data: { attackerId: string; targetId: string }): void {
    const mobState = this.mobStates.get(data.attackerId);
    if (mobState) {
      mobState.isInCombat = true;
      mobState.isChasing = false; // Stop chasing, now in combat
      console.log(`[RPGAggroSystem] Mob ${data.attackerId} entered combat with ${data.targetId}`);
    }
  }

  private onCombatEnded(data: { attackerId: string }): void {
    const mobState = this.mobStates.get(data.attackerId);
    if (mobState) {
      mobState.isInCombat = false;
      
      // Check if should resume chasing or return home
      if (mobState.aggroTargets.size > 0) {
        const bestTarget = this.getBestAggroTarget(mobState);
        if (bestTarget) {
          this.startChasing(mobState, bestTarget.playerId);
        } else {
          this.returnToHome(mobState);
        }
      } else {
        this.returnToHome(mobState);
      }
      
      console.log(`[RPGAggroSystem] Mob ${data.attackerId} left combat`);
    }
  }

  private checkAggroUpdates(data: { playerId: string; newLevel: number }): void {
    // Re-check aggro for all mobs when player level changes
    for (const [mobId, mobState] of this.mobStates) {
      if (mobState.aggroTargets.has(data.playerId)) {
        if (!this.shouldMobAggroPlayer(mobState, data.playerId)) {
          // Remove aggro due to level change
          mobState.aggroTargets.delete(data.playerId);
          if (mobState.currentTarget === data.playerId) {
            this.stopChasing(mobState);
          }
          console.log(`[RPGAggroSystem] Mob ${mobId} lost aggro on player ${data.playerId} due to level change`);
        }
      }
    }
  }

  // Public API
  getMobState(mobId: string): MobAIState | undefined {
    return this.mobStates.get(mobId);
  }

  getAllMobStates(): Map<string, MobAIState> {
    return new Map(this.mobStates);
  }

  getMobsChasing(playerId: string): MobAIState[] {
    const chasers: MobAIState[] = [];
    for (const [mobId, mobState] of this.mobStates) {
      if (mobState.currentTarget === playerId && mobState.isChasing) {
        chasers.push(mobState);
      }
    }
    return chasers;
  }

  getMobsWithAggro(playerId: string): MobAIState[] {
    const aggroMobs: MobAIState[] = [];
    for (const [mobId, mobState] of this.mobStates) {
      if (mobState.aggroTargets.has(playerId)) {
        aggroMobs.push(mobState);
      }
    }
    return aggroMobs;
  }

  forceAggroOnPlayer(mobId: string, playerId: string): boolean {
    const mobState = this.mobStates.get(mobId);
    if (!mobState) return false;

    const player = this.world.getPlayer?.(playerId);
    if (!player) return false;

    // Force aggro regardless of level
    const aggroTarget: AggroTarget = {
      playerId: playerId,
      mobId: mobId,
      aggroLevel: 100, // Maximum aggro
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      distance: this.calculateDistance(mobState.currentPosition, player.position),
      inRange: true,
      inLineOfSight: true
    };

    mobState.aggroTargets.set(playerId, aggroTarget);
    
    if (!mobState.isInCombat) {
      this.startChasing(mobState, playerId);
    }

    console.log(`[RPGAggroSystem] Forced aggro: mob ${mobId} -> player ${playerId}`);
    return true;
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.mobStates.clear();
    console.log('[RPGAggroSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    // Main update is handled by the interval timer
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}