/**
 * Aggression System
 * Handles mob AI, aggression detection, and chase mechanics per GDD specifications
 * - Mob aggression based on player level and mob type
 * - Detection ranges and line-of-sight
 * - Chase mechanics with leashing
 * - Different mob behaviors (passive, aggressive, special cases)
 */

import { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import { AGGRO_CONSTANTS } from "../../../constants/CombatConstants";
import { AggroTarget, Position3D, MobAIStateData } from "../../../types";
import { calculateDistance } from "../../../utils/game/EntityUtils";
import { SystemBase } from "..";

/**
 * Aggression System - GDD Compliant
 * Implements mob AI and aggression mechanics per GDD specifications:
 * - Level-based aggression (low-level aggressive mobs ignore high-level players)
 * - Special cases (Dark Warriors always aggressive regardless of level)
 * - Detection ranges and chase mechanics
 * - Leashing to prevent mobs from going too far from spawn
 * - Multiple target management
 */
export class AggroSystem extends SystemBase {
  private mobStates = new Map<string, MobAIStateData>();
  private playerSkills = new Map<
    string,
    Record<string, { level: number; xp: number }>
  >();

  constructor(world: World) {
    super(world, {
      name: "aggro",
      dependencies: {
        required: [], // Aggro system can work independently
        optional: ["mob-npc", "player", "combat", "entity-manager"], // Better with mob NPC and player systems
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Set up type-safe event subscriptions for aggro mechanics
    this.subscribe(
      EventType.MOB_NPC_SPAWNED,
      (data: {
        mobId: string;
        mobType: string;
        position: { x: number; y: number; z: number };
      }) => {
        this.registerMob({
          id: data.mobId,
          type: data.mobType,
          level: 1,
          position: data.position,
        });
      },
    );
    this.subscribe(EventType.MOB_NPC_DESPAWN, (data: { mobId: string }) => {
      this.unregisterMob(data.mobId);
    });
    this.subscribe(
      EventType.PLAYER_POSITION_UPDATED,
      (data: { playerId: string; position: Position3D }) => {
        this.updatePlayerPosition({
          entityId: data.playerId,
          position: data.position,
        });
      },
    );
    this.subscribe(
      EventType.COMBAT_STARTED,
      (data: { attackerId: string; targetId: string }) => {
        this.onCombatStarted({
          attackerId: data.attackerId,
          targetId: data.targetId,
        });
      },
    );
    this.subscribe(
      EventType.MOB_NPC_POSITION_UPDATED,
      (data: { mobId: string; position: Position3D }) => {
        this.updateMobPosition({
          entityId: data.mobId,
          position: data.position,
        });
      },
    );
    this.subscribe(
      EventType.PLAYER_LEVEL_CHANGED,
      (data: {
        playerId: string;
        skill:
          | "attack"
          | "strength"
          | "defense"
          | "constitution"
          | "ranged"
          | "woodcutting"
          | "fishing"
          | "firemaking"
          | "cooking";
        newLevel: number;
        oldLevel: number;
      }) => {
        this.checkAggroUpdates({
          playerId: data.playerId,
          oldLevel: data.oldLevel,
          newLevel: data.newLevel,
          skill: data.skill,
        });
      },
    );

    // Listen to skills updates for reactive patterns
    this.subscribe(
      EventType.SKILLS_UPDATED,
      (data: {
        playerId: string;
        skills: Record<
          | "attack"
          | "strength"
          | "defense"
          | "constitution"
          | "ranged"
          | "woodcutting"
          | "fishing"
          | "firemaking"
          | "cooking",
          { level: number; xp: number }
        >;
      }) => {
        this.playerSkills.set(data.playerId, data.skills);
      },
    );
  }

  start(): void {
    // Start AI update loop with auto-cleanup timer management
    this.createInterval(() => {
      this.updateMobAI();
    }, 500); // Update every 500ms for responsive AI
  }

  private registerMob(mobData: {
    id: string;
    type: string;
    level: number;
    position: { x: number; y: number; z: number };
  }): void {
    // Strong type assumption - mobData.position is typed and valid from caller
    // If position is missing, that's a bug in the spawning system
    if (!mobData.position) {
      throw new Error(`[AggroSystem] Missing position for mob ${mobData.id}`);
    }

    const mobType = mobData.type.toLowerCase();
    const behavior =
      AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] ||
      AGGRO_CONSTANTS.MOB_BEHAVIORS.default;

    const aiState: MobAIStateData = {
      mobId: mobData.id,
      type: mobType,
      state: "idle",
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
        z: mobData.position.z || 0,
      },
      currentPosition: {
        x: mobData.position.x || 0,
        y: mobData.position.y || 0,
        z: mobData.position.z || 0,
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
      combatTarget: null,
    };

    this.mobStates.set(mobData.id, aiState);
  }

  private unregisterMob(mobId: string): void {
    this.mobStates.delete(mobId);
  }

  private updatePlayerPosition(data: {
    entityId: string;
    position: Position3D;
  }): void {
    // Check all mobs for aggro against this player
    for (const [_mobId, mobState] of this.mobStates) {
      if (mobState.behavior === "passive") continue;

      this.checkPlayerAggro(mobState, data.entityId, data.position);
    }
  }

  private updateMobPosition(data: {
    entityId: string;
    position: Position3D;
  }): void {
    const mobState = this.mobStates.get(data.entityId);
    if (mobState && data.position) {
      // Strong type assumption - Position3D is always valid with x, y, z numbers
      mobState.currentPosition = {
        x: data.position.x,
        y: data.position.y,
        z: data.position.z,
      };
    }
  }

  private checkPlayerAggro(
    mobState: MobAIStateData,
    playerId: string,
    playerPosition: Position3D,
  ): void {
    const distance = calculateDistance(
      mobState.currentPosition,
      playerPosition,
    );

    // Check if player is within detection range
    if (distance > mobState.detectionRange) {
      // Remove from aggro if too far
      if (mobState.aggroTargets.has(playerId)) {
        mobState.aggroTargets.delete(playerId);
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
        aggroLevel: 10, // Initial aggro
        lastDamageTime: Date.now(),
        lastSeen: Date.now(),
        distance: distance,
        inRange: true,
      };

      mobState.aggroTargets.set(playerId, aggroTarget);

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

  private shouldMobAggroPlayer(
    mobState: MobAIStateData,
    playerId: string,
  ): boolean {
    // Get player combat level from XP system
    const playerCombatLevel = this.getPlayerCombatLevel(playerId);

    // Get mob behavior configuration
    const mobType = mobState.type;
    const behaviorConfig =
      AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] ||
      AGGRO_CONSTANTS.MOB_BEHAVIORS.default;

    // Check level-based aggression per GDD
    if (
      playerCombatLevel > behaviorConfig.levelIgnoreThreshold &&
      behaviorConfig.levelIgnoreThreshold < 999
    ) {
      // Player is too high level, mob ignores them (except special cases like Dark Warriors)
      return false;
    }

    return mobState.behavior === "aggressive";
  }

  private getPlayerCombatLevel(playerId: string): number {
    // Get player combat level from XP system
    // Combat level is the average of attack, strength, defense, and constitution
    const playerSkills = this.getPlayerSkills(playerId);

    const combatLevel = Math.floor(
      (playerSkills.attack +
        playerSkills.strength +
        playerSkills.defense +
        playerSkills.constitution) /
        4,
    );
    return Math.max(1, combatLevel); // Minimum level 1
  }

  private getPlayerSkills(playerId: string): {
    attack: number;
    strength: number;
    defense: number;
    constitution: number;
  } {
    // Use cached skills data (reactive pattern)
    const cachedSkills = this.playerSkills.get(playerId);

    if (cachedSkills) {
      return {
        attack: cachedSkills.attack.level,
        strength: cachedSkills.strength.level,
        defense: cachedSkills.defense.level,
        constitution: cachedSkills.constitution.level,
      };
    }

    return { attack: 1, strength: 1, defense: 1, constitution: 1 };
  }

  private startChasing(mobState: MobAIStateData, playerId: string): void {
    mobState.isChasing = true;
    mobState.currentTarget = playerId;
    mobState.isPatrolling = false;

    // Emit chase event for other systems
    this.emitTypedEvent(EventType.MOB_NPC_CHASE_STARTED, {
      mobId: mobState.mobId,
      targetPlayerId: playerId,
      mobPosition: {
        x: mobState.currentPosition.x,
        y: mobState.currentPosition.y,
        z: mobState.currentPosition.z,
      },
    });

    // Start combat if close enough
    const aggroTarget = mobState.aggroTargets.get(playerId);
    if (aggroTarget && aggroTarget.distance <= 2.0) {
      // Melee range
      this.startCombatWithPlayer(mobState, playerId);
    }
  }

  private startCombatWithPlayer(
    mobState: MobAIStateData,
    playerId: string,
  ): void {
    mobState.isInCombat = true;

    // Trigger combat system
    this.emitTypedEvent(EventType.COMBAT_START_ATTACK, {
      attackerId: mobState.mobId,
      targetId: playerId,
    });
  }

  private stopChasing(mobState: MobAIStateData): void {
    if (!mobState.isChasing) return;

    const previousTarget = mobState.currentTarget;

    mobState.isChasing = false;
    mobState.currentTarget = null;
    mobState.isPatrolling = true; // Resume patrolling

    // Emit chase end event
    this.emitTypedEvent(EventType.MOB_NPC_CHASE_ENDED, {
      mobId: mobState.mobId,
      targetPlayerId: previousTarget || "",
    });

    // Start returning to home position
    this.returnToHome(mobState);
  }

  private returnToHome(_mobState: MobAIStateData): void {
    // DISABLED: Return-to-home movement now handled by MobEntity.handleFleeState()
    // MobEntity automatically returns to spawn when target is lost
    // This system only triggers the state change, not the actual movement
  }

  private updateMobAI(): void {
    const now = Date.now();

    for (const [_mobId, mobState] of this.mobStates) {
      // Skip if in combat - combat system handles behavior
      if (mobState.isInCombat) continue;

      // Strong type assumption - positions are always valid Position3D objects
      if (!mobState.currentPosition || !mobState.homePosition) {
        console.warn(
          `[AggroSystem] Missing positions for mob ${mobState.mobId}`,
        );
        continue;
      }

      // Check leashing - if too far from home, return
      const homeDistance = calculateDistance(
        mobState.currentPosition,
        mobState.homePosition,
      );
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
      } else if (
        mobState.behavior === "aggressive" &&
        mobState.aggroTargets.size > 0
      ) {
        // Check if we should start chasing someone
        const bestTarget = this.getBestAggroTarget(mobState);
        this.startChasing(mobState, bestTarget.playerId);
      } else if (!mobState.isChasing && now - mobState.lastAction > 5000) {
        // Patrol behavior when not chasing
        this.updatePatrol(mobState);
        mobState.lastAction = now;
      }
    }
  }

  private cleanupAggroTargets(mobState: MobAIStateData): void {
    const now = Date.now();

    for (const [playerId, aggroTarget] of mobState.aggroTargets) {
      // Remove aggro if not seen for 10 seconds
      if (now - aggroTarget.lastSeen > 10000) {
        mobState.aggroTargets.delete(playerId);
      }
    }
  }

  private getBestAggroTarget(mobState: MobAIStateData): AggroTarget {
    let bestTarget!: AggroTarget;
    let highestAggro = 0;

    for (const [_playerId, aggroTarget] of mobState.aggroTargets) {
      if (aggroTarget.aggroLevel > highestAggro) {
        highestAggro = aggroTarget.aggroLevel;
        bestTarget = aggroTarget;
      }
    }

    return bestTarget;
  }

  private updateChasing(mobState: MobAIStateData): void {
    // Ensure we have a valid target
    if (!mobState.currentTarget) {
      this.stopChasing(mobState);
      return;
    }

    const player = this.world.getPlayer(mobState.currentTarget)!;

    // Strong type assumption - player.node.position is always Vector3
    if (!player.node?.position) {
      console.warn(`[AggroSystem] Player ${player.id} has no node`);
      this.stopChasing(mobState);
      return;
    }

    const distance = calculateDistance(
      mobState.currentPosition,
      player.node.position,
    );
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
    }
    // NOTE: Movement requests removed - MobEntity handles all movement via its own AI
    // MobEntity.serverUpdate() detects target and moves towards it
    // Emitting MOB_MOVE_REQUEST events was redundant and no system handled them
  }

  private updatePatrol(_mobState: MobAIStateData): void {
    // DISABLED: Patrol movement now handled by MobEntity.serverUpdate()
    // MobEntity has built-in patrol logic with patrol points
    // This system only tracks aggro state, not actual movement
  }

  private onCombatStarted(data: {
    attackerId: string;
    targetId: string;
    entityType?: string;
  }): void {
    // Handle combat session started - update mob AI state
    const mobState =
      this.mobStates.get(data.attackerId) || this.mobStates.get(data.targetId);
    if (mobState) {
      mobState.isInCombat = true;
      mobState.isChasing = false; // Stop chasing when in combat

      // If mob is the attacker, set target
      if (mobState.mobId === data.attackerId) {
        mobState.currentTarget = data.targetId;
      }
    }
  }

  private onCombatEnded(data: {
    attackerId: string;
    targetId: string;
    reason?: string;
  }): void {
    // Handle combat session ended - update mob AI state
    const mobState =
      this.mobStates.get(data.attackerId) || this.mobStates.get(data.targetId);
    if (mobState) {
      mobState.isInCombat = false;

      // Clear target if combat ended
      if (data.reason === "death" || data.reason === "flee") {
        mobState.currentTarget = null;
        mobState.aggroTargets.clear();
      }
    }
  }

  private shouldIgnorePlayer(
    mobState: MobAIStateData,
    playerCombatLevel: number,
  ): boolean {
    // Check if mob should ignore player based on level (GDD requirement)
    const mobType = mobState.type;
    const behaviorConfig =
      AGGRO_CONSTANTS.MOB_BEHAVIORS[mobType] ||
      AGGRO_CONSTANTS.MOB_BEHAVIORS.default;

    // Check level-based aggression per GDD
    if (playerCombatLevel > behaviorConfig.levelIgnoreThreshold) {
      // Player is too high level, mob ignores them (except special cases)
      if (behaviorConfig.levelIgnoreThreshold < 999) {
        // Special cases like Dark Warriors have levelIgnoreThreshold: 999
        return true; // Should ignore this player
      }
    }

    return false; // Should not ignore this player
  }

  private checkAggroUpdates(data: {
    playerId: string;
    oldLevel: number;
    newLevel: number;
    skill?: string;
  }): void {
    // Handle player level changes - update aggro status for all mobs
    // Per GDD: low-level aggressive mobs should ignore high-level players
    const playerId = data.playerId;
    const newLevel = data.newLevel;

    // Check all mobs for aggro changes
    for (const [_mobId, mobState] of this.mobStates) {
      if (mobState.behavior === "passive") continue;

      const aggroTarget = mobState.aggroTargets.get(playerId);
      if (aggroTarget) {
        // Re-evaluate aggro based on new level
        const shouldIgnore = this.shouldIgnorePlayer(mobState, newLevel);
        if (shouldIgnore && mobState.currentTarget === playerId) {
          // Stop targeting this player
          this.stopChasing(mobState);
          mobState.aggroTargets.delete(playerId);
        }
      }
    }
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all mob states and aggro data
    this.mobStates.clear();

    // Call parent cleanup (automatically handles interval cleanup)
    super.destroy();
  }
}
