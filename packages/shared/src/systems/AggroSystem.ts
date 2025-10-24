
/**
 * Aggression System
 * Handles character AI, aggression detection, and chase mechanics per GDD specifications
 * - Character aggression based on player level and character type
 * - Detection ranges and line-of-sight
 * - Chase mechanics with leashing
 * - Different character behaviors (passive, aggressive, special cases)
 */


import { World } from '../World';
import { EventType } from '../types/events';
import { AGGRO_CONSTANTS } from '../constants/CombatConstants';
import { AggroTarget, Position3D, CharacterAIStateData } from '../types';
import { calculateDistance } from '../utils/EntityUtils';
import { SystemBase } from './SystemBase';

/**
 * Aggression System - GDD Compliant
 * Implements character AI and aggression mechanics per GDD specifications:
 * - Level-based aggression (low-level aggressive characters ignore high-level players)
 * - Special cases (Dark Warriors always aggressive regardless of level)
 * - Detection ranges and chase mechanics
 * - Leashing to prevent characters from going too far from spawn
 * - Multiple target management
 */
export class AggroSystem extends SystemBase {
  private characterStates = new Map<string, CharacterAIStateData>();
  private playerSkills = new Map<string, Record<string, { level: number; xp: number }>>();

  constructor(world: World) {
    super(world, {
      name: 'aggro',
      dependencies: {
        required: [], // Aggro system can work independently
        optional: ['character', 'player', 'combat', 'entity-manager'] // Better with character and player systems
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Set up type-safe event subscriptions for aggro mechanics
    // Unified character events (preferred)
    this.subscribe(EventType.CHARACTER_SPAWNED, (data: { entityId: string; entityType: string; entityData?: { characterId?: string; characterType?: string } }) => {
      // Only register hostile characters (mobs)
      if (data.entityData?.characterType === 'mob') {
        this.registerMob({
          id: data.entityId,
          type: data.entityData?.characterId || 'unknown',
          level: 1,
          position: { x: 0, y: 0, z: 0 } // Position will be updated via MOB_POSITION_UPDATED
        });
      }
    });
    this.subscribe(EventType.CHARACTER_DESPAWNED, (data: { characterId: string }) => {
      this.unregisterMob(data.characterId);
    });

    // Legacy mob events (deprecated - for backward compatibility)
    this.subscribe(EventType.MOB_SPAWNED, (data: { characterId: string; mobType: string; position: { x: number; y: number; z: number } }) => {
      this.registerMob({ id: data.characterId, type: data.mobType, level: 1, position: data.position });
    });
    this.subscribe(EventType.MOB_DESPAWN, (data: { characterId: string }) => {
      this.unregisterMob(data.characterId);
    });
    this.subscribe(EventType.PLAYER_POSITION_UPDATED, (data: { playerId: string; position: Position3D }) => {
      this.updatePlayerPosition({ entityId: data.playerId, position: data.position });
    });
    this.subscribe(EventType.COMBAT_STARTED, (data: { attackerId: string; targetId: string }) => {
      this.onCombatStarted({ attackerId: data.attackerId, targetId: data.targetId });
    });
    this.subscribe(EventType.MOB_POSITION_UPDATED, (data: { characterId: string; position: Position3D }) => {
      this.updateMobPosition({ entityId: data.characterId, position: data.position });
    });
    this.subscribe(
      EventType.PLAYER_LEVEL_CHANGED,
      (data: { playerId: string; skill: 'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking'; newLevel: number; oldLevel: number }) => {
        this.checkAggroUpdates({ playerId: data.playerId, oldLevel: data.oldLevel, newLevel: data.newLevel, skill: data.skill });
      }
    );

    // Listen to skills updates for reactive patterns
    this.subscribe(
      EventType.SKILLS_UPDATED,
      (data: { playerId: string; skills: Record<'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking', { level: number; xp: number }> }) => {
        this.playerSkills.set(data.playerId, data.skills);
      }
    );
    
  }

  start(): void {
    // Start AI update loop with auto-cleanup timer management
    this.createInterval(() => {
      this.updateMobAI();
    }, 500); // Update every 500ms for responsive AI
  }

  private registerMob(mobData: { id: string; type: string; level: number; position: { x: number; y: number; z: number } }): void {
    // Strong type assumption - mobData.position is typed and valid from caller
    // If position is missing, that's a bug in the spawning system
    if (!mobData.position) {
      throw new Error(`[AggroSystem] Missing position for mob ${mobData.id}`);
    }
    
    const mobType = mobData.type.toLowerCase();
    const behavior = AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] || AGGRO_CONSTANTS.MOB_BEHAVIORS.default;
    
    const aiState: CharacterAIStateData = {
      characterId: mobData.id,
      type: mobType,
      state: 'idle',
      behavior: behavior.behavior,
      lastStateChange: Date.now(),
      lastAction: Date.now(),
      isPatrolling: false,
      isChasing: false,
      isInCombat: false,
      currentTarget: null,
      homePosition: { 
        x: mobData.position.x || 0,
        y: mobData.position.y || 0,
        z: mobData.position.z || 0
      },
      currentPosition: { 
        x: mobData.position.x || 0,
        y: mobData.position.y || 0,
        z: mobData.position.z || 0
      },
      detectionRange: behavior.detectionRange,
      leashRange: behavior.leashRange,
      chaseSpeed: 3.0, // Default chase speed
      patrolRadius: 5.0, // Default patrol radius
      aggroTargets: new Map(),
      combatCooldown: 0,
      lastAttack: 0,
      levelIgnore: behavior.levelIgnoreThreshold || 10,
      targetId: null,
      patrolPath: [],
      patrolIndex: 0,
      patrolTarget: null,
      combatTarget: null
    };
    
    this.characterStates.set(mobData.id, aiState);
    
  }

  private unregisterMob(characterId: string): void {
    this.characterStates.delete(characterId);
  }

  private updatePlayerPosition(data: { entityId: string; position: Position3D }): void {
    // Check all mobs for aggro against this player
    for (const [_characterId, characterState] of this.characterStates) {
      if (characterState.behavior === 'passive') continue;
      
      this.checkPlayerAggro(characterState, data.entityId, data.position);
    }
  }

  private updateMobPosition(data: { entityId: string; position: Position3D }): void {
    const characterState = this.characterStates.get(data.entityId);
    if (characterState && data.position) {
      // Strong type assumption - Position3D is always valid with x, y, z numbers
      characterState.currentPosition = { 
        x: data.position.x,
        y: data.position.y,
        z: data.position.z
      };
    }
  }

  private checkPlayerAggro(characterState: CharacterAIStateData, playerId: string, playerPosition: Position3D): void {
    const distance = calculateDistance(characterState.currentPosition, playerPosition);
    
    // Check if player is within detection range
    if (distance > characterState.detectionRange) {
      // Remove from aggro if too far
      if (characterState.aggroTargets.has(playerId)) {
        characterState.aggroTargets.delete(playerId);
      }
      return;
    }

    // Check level-based aggression per GDD
    if (!this.shouldMobAggroPlayer(characterState, playerId)) {
      return;
    }

    // Update or create aggro target
    let aggroTarget = characterState.aggroTargets.get(playerId);
    if (!aggroTarget) {
      aggroTarget = {
        playerId: playerId,
        aggroLevel: 10, // Initial aggro
        lastDamageTime: Date.now(),
        lastSeen: Date.now(),
        distance: distance,
        inRange: true
      };
      
      characterState.aggroTargets.set(playerId, aggroTarget);
      
      
      // Start chasing if not already in combat
      if (!characterState.isInCombat && !characterState.currentTarget) {
        this.startChasing(characterState, playerId);
      }
    } else {
      // Update existing aggro
      aggroTarget.lastSeen = Date.now();
      aggroTarget.distance = distance;
      aggroTarget.inRange = distance <= characterState.detectionRange;
    }
  }

  private shouldMobAggroPlayer(characterState: CharacterAIStateData, playerId: string): boolean {
    // Get player combat level from XP system
    const playerCombatLevel = this.getPlayerCombatLevel(playerId);
    
    // Get mob behavior configuration
    const mobType = characterState.type;
    const behaviorConfig = AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] || AGGRO_CONSTANTS.MOB_BEHAVIORS.default;
    
    // Check level-based aggression per GDD
    if (playerCombatLevel > behaviorConfig.levelIgnoreThreshold && behaviorConfig.levelIgnoreThreshold < 999) {
      // Player is too high level, mob ignores them (except special cases like Dark Warriors)
      return false;
    }
    
    return characterState.behavior === 'aggressive';
  }

  private getPlayerCombatLevel(playerId: string): number {
    // Get player combat level from XP system
    // Combat level is the average of attack, strength, defense, and constitution
    const playerSkills = this.getPlayerSkills(playerId);
    
    const combatLevel = Math.floor((playerSkills.attack + playerSkills.strength + playerSkills.defense + playerSkills.constitution) / 4);
    return Math.max(1, combatLevel); // Minimum level 1
  }

  private getPlayerSkills(playerId: string): { attack: number; strength: number; defense: number; constitution: number } {
    // Use cached skills data (reactive pattern)
    const cachedSkills = this.playerSkills.get(playerId);
    
    if (cachedSkills) {
      return {
        attack: cachedSkills.attack.level,
        strength: cachedSkills.strength.level,
        defense: cachedSkills.defense.level,
        constitution: cachedSkills.constitution.level
      };
    }
    
    return { attack: 1, strength: 1, defense: 1, constitution: 1 };
  }

  private startChasing(characterState: CharacterAIStateData, playerId: string): void {
    characterState.isChasing = true;
    characterState.currentTarget = playerId;
    characterState.isPatrolling = false;
    
    
    // Emit chase event for other systems
    this.emitTypedEvent(EventType.MOB_CHASE_STARTED, {
      characterId: characterState.characterId,
      targetPlayerId: playerId,
      mobPosition: {
        x: characterState.currentPosition.x,
        y: characterState.currentPosition.y,
        z: characterState.currentPosition.z
      }
    });
    
    // Start combat if close enough
    const aggroTarget = characterState.aggroTargets.get(playerId);
    if (aggroTarget && aggroTarget.distance <= 2.0) { // Melee range
      this.startCombatWithPlayer(characterState, playerId);
    }
  }

  private startCombatWithPlayer(characterState: CharacterAIStateData, playerId: string): void {
    characterState.isInCombat = true;
    
    
    // Trigger combat system
    this.emitTypedEvent(EventType.COMBAT_START_ATTACK, {
      attackerId: characterState.characterId,
      targetId: playerId
    });
  }

  private stopChasing(characterState: CharacterAIStateData): void {
    if (!characterState.isChasing) return;
    
    const previousTarget = characterState.currentTarget;
    
    characterState.isChasing = false;
    characterState.currentTarget = null;
    characterState.isPatrolling = true; // Resume patrolling
    
    
    // Emit chase end event
    this.emitTypedEvent(EventType.MOB_CHASE_ENDED, {
      characterId: characterState.characterId,
      targetPlayerId: previousTarget || ''
    });
    
    // Start returning to home position
    this.returnToHome(characterState);
  }

  private returnToHome(_characterState: CharacterAIStateData): void {
    // DISABLED: Return-to-home movement now handled by CharacterEntity behavior trees
    // CharacterEntity automatically returns to spawn when target is lost
    // This system only triggers the state change, not the actual movement
  }

  private updateMobAI(): void {
    const now = Date.now();
    
    for (const [_characterId, characterState] of this.characterStates) {
      // Skip if in combat - combat system handles behavior
      if (characterState.isInCombat) continue;
      
      // Strong type assumption - positions are always valid Position3D objects
      if (!characterState.currentPosition || !characterState.homePosition) {
        console.warn(`[AggroSystem] Missing positions for mob ${characterState.characterId}`);
        continue;
      }
      
      // Check leashing - if too far from home, return
      const homeDistance = calculateDistance(characterState.currentPosition, characterState.homePosition);
      if (homeDistance > characterState.leashRange) {
        if (characterState.isChasing) {
          this.stopChasing(characterState);
        } else {
          this.returnToHome(characterState);
        }
        continue;
      }
      
      // Clean up old aggro targets
      this.cleanupAggroTargets(characterState);
      
      // If chasing, update chase behavior
      if (characterState.isChasing && characterState.currentTarget) {
        this.updateChasing(characterState);
          } else if (characterState.behavior === 'aggressive' && characterState.aggroTargets.size > 0) {
      // Check if we should start chasing someone
      const bestTarget = this.getBestAggroTarget(characterState);
      this.startChasing(characterState, bestTarget.playerId);
      } else if (!characterState.isChasing && (now - characterState.lastAction) > 5000) {
        // Patrol behavior when not chasing
        this.updatePatrol(characterState);
        characterState.lastAction = now;
      }
    }
  }

  private cleanupAggroTargets(characterState: CharacterAIStateData): void {
    const now = Date.now();
    
    for (const [playerId, aggroTarget] of characterState.aggroTargets) {
      // Remove aggro if not seen for 10 seconds
      if (now - aggroTarget.lastSeen > 10000) {
        characterState.aggroTargets.delete(playerId);
      }
    }
  }

  private getBestAggroTarget(characterState: CharacterAIStateData): AggroTarget {
    let bestTarget!: AggroTarget;
    let highestAggro = 0;
    
    for (const [_playerId, aggroTarget] of characterState.aggroTargets) {
      if (aggroTarget.aggroLevel > highestAggro) {
        highestAggro = aggroTarget.aggroLevel;
        bestTarget = aggroTarget;
      }
    }
    
    return bestTarget;
  }

  private updateChasing(characterState: CharacterAIStateData): void {
    // Ensure we have a valid target
    if (!characterState.currentTarget) {
      this.stopChasing(characterState);
      return;
    }
    
    const player = this.world.getPlayer(characterState.currentTarget)!;

    // Strong type assumption - player.node.position is always Vector3
    if (!player.node?.position) {
      console.warn(`[AggroSystem] Player ${player.id} has no node`);
      this.stopChasing(characterState);
      return;
    }

    const distance = calculateDistance(characterState.currentPosition, player.node.position);
    const aggroTarget = characterState.aggroTargets.get(characterState.currentTarget);
    
    if (!aggroTarget || distance > characterState.detectionRange * 1.5) {
      // Lost target or too far
      this.stopChasing(characterState);
      return;
    }
    
    // Update aggro target distance
    aggroTarget.distance = distance;
    aggroTarget.lastSeen = Date.now();
    
    // If close enough, start combat
    if (distance <= 2.0 && !characterState.isInCombat) {
      this.startCombatWithPlayer(characterState, characterState.currentTarget);
    }
    // NOTE: Movement requests removed - CharacterEntity handles all movement via behavior trees
    // BehaviorSystem processes behavior trees and moves character towards target
    // Emitting MOB_MOVE_REQUEST events was redundant and no system handled them
  }

  private updatePatrol(_characterState: CharacterAIStateData): void {
    // DISABLED: Patrol movement now handled by BehaviorSystem
    // CharacterEntity has patrol behavior defined in behavior trees
    // This system only tracks aggro state, not actual movement
  }

  private onCombatStarted(data: { attackerId: string; targetId: string; entityType?: string }): void {
    // Handle combat session started - update mob AI state
    const characterState = this.characterStates.get(data.attackerId) || this.characterStates.get(data.targetId);
    if (characterState) {
      characterState.isInCombat = true;
      characterState.isChasing = false; // Stop chasing when in combat
      
      // If mob is the attacker, set target
      if (characterState.characterId === data.attackerId) {
        characterState.currentTarget = data.targetId;
      }
    }
  }

  private onCombatEnded(data: { attackerId: string; targetId: string; reason?: string }): void {
    // Handle combat session ended - update mob AI state
    const characterState = this.characterStates.get(data.attackerId) || this.characterStates.get(data.targetId);
    if (characterState) {
      characterState.isInCombat = false;
      
      // Clear target if combat ended
      if (data.reason === 'death' || data.reason === 'flee') {
        characterState.currentTarget = null;
        characterState.aggroTargets.clear();
      }
    }
  }

  private shouldIgnorePlayer(characterState: CharacterAIStateData, playerCombatLevel: number): boolean {
    // Check if mob should ignore player based on level (GDD requirement)
    const mobType = characterState.type;
          const behaviorConfig = AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] || AGGRO_CONSTANTS.MOB_BEHAVIORS.default;
    
    // Check level-based aggression per GDD
    if (playerCombatLevel > behaviorConfig.levelIgnoreThreshold) {
      // Player is too high level, mob ignores them (except special cases)
      if (behaviorConfig.levelIgnoreThreshold < 999) { // Special cases like Dark Warriors have levelIgnoreThreshold: 999
        return true; // Should ignore this player
      }
    }
    
    return false; // Should not ignore this player
  }

  private checkAggroUpdates(data: { playerId: string; oldLevel: number; newLevel: number; skill?: string }): void {
    // Handle player level changes - update aggro status for all mobs
    // Per GDD: low-level aggressive mobs should ignore high-level players
    const playerId = data.playerId;
    const newLevel = data.newLevel;

    
    // Check all mobs for aggro changes
    for (const [_characterId, characterState] of this.characterStates) {
      if (characterState.behavior === 'passive') continue;
      
      const aggroTarget = characterState.aggroTargets.get(playerId);
      if (aggroTarget) {
        // Re-evaluate aggro based on new level
        const shouldIgnore = this.shouldIgnorePlayer(characterState, newLevel);
        if (shouldIgnore && characterState.currentTarget === playerId) {
          // Stop targeting this player
          this.stopChasing(characterState);
          characterState.aggroTargets.delete(playerId);
        }
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all mob states and aggro data
    this.characterStates.clear();
    

    
    // Call parent cleanup (automatically handles interval cleanup)
    super.destroy();
  }
}

