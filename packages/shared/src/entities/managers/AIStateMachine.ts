/**
 * AIStateMachine - Clean state machine for mob AI
 *
 * Responsibilities:
 * - Manage AI state transitions (IDLE → WANDER → CHASE → ATTACK → RETURN)
 * - Execute state-specific logic each frame
 * - Provide clean state entry/exit hooks
 * - Isolate state logic from entity class
 *
 * Each state is a separate class implementing AIState interface.
 * States are responsible for their own logic and return the next state to transition to.
 */

import type { Position3D } from "../../types";
import { MobAIState } from "../../types/entities";

export interface AIStateContext {
  // Position & Movement
  getPosition(): Position3D;
  moveTowards(target: Position3D, deltaTime: number): void;
  teleportTo(position: Position3D): void;

  // Targeting
  findNearbyPlayer(): { id: string; position: Position3D } | null;
  getPlayer(playerId: string): { id: string; position: Position3D } | null;
  getCurrentTarget(): string | null;
  setTarget(playerId: string | null): void;

  // Combat
  canAttack(currentTime: number): boolean;
  performAttack(targetId: string, currentTime: number): void;
  isInCombat(): boolean;

  // Spawn & Leashing
  getSpawnPoint(): Position3D;
  getDistanceFromSpawn(): number;
  getWanderRadius(): number;
  getCombatRange(): number;

  // Wander
  getWanderTarget(): Position3D | null;
  setWanderTarget(target: Position3D | null): void;
  generateWanderTarget(): Position3D;

  // Timing
  getTime(): number;

  // State management
  markNetworkDirty(): void;
  emitEvent(eventType: string, data: unknown): void;
}

/**
 * Base AI State interface
 */
export interface AIState {
  readonly name: MobAIState;

  /**
   * Called when entering this state
   */
  enter(context: AIStateContext): void;

  /**
   * Called every frame while in this state
   * Returns next state to transition to, or null to stay in current state
   */
  update(context: AIStateContext, deltaTime: number): MobAIState | null;

  /**
   * Called when exiting this state
   */
  exit(context: AIStateContext): void;
}

/**
 * IDLE State - Standing still, watching for players
 */
export class IdleState implements AIState {
  readonly name = MobAIState.IDLE;

  private idleStartTime = 0;
  private idleDuration = 0;
  private readonly IDLE_MIN_DURATION = 3000; // 3 seconds
  private readonly IDLE_MAX_DURATION = 8000; // 8 seconds

  enter(context: AIStateContext): void {
    this.idleStartTime = context.getTime();
    this.idleDuration =
      this.IDLE_MIN_DURATION +
      Math.random() * (this.IDLE_MAX_DURATION - this.IDLE_MIN_DURATION);
    //console.log(
    //  `[IdleState] Entered, will idle for ${(this.idleDuration / 1000).toFixed(1)}s`,
    //);
  }

  update(context: AIStateContext, _deltaTime: number): MobAIState | null {
    // Check for nearby players (instant aggro)
    const nearbyPlayer = context.findNearbyPlayer();
    if (nearbyPlayer) {
      //console.log(`[IdleState] Detected player, switching to CHASE`);
      context.setTarget(nearbyPlayer.id);
      context.emitEvent("MOB_NPC_AGGRO", {
        mobId: "self",
        targetId: nearbyPlayer.id,
      });
      return MobAIState.CHASE;
    }

    // After idle duration, start wandering
    const now = context.getTime();
    if (now - this.idleStartTime > this.idleDuration) {
      //console.log(`[IdleState] Idle expired, switching to WANDER`);
      return MobAIState.WANDER;
    }

    return null; // Stay in IDLE
  }

  exit(_context: AIStateContext): void {
    this.idleStartTime = 0;
  }
}

/**
 * WANDER State - Random walking within wander radius
 */
export class WanderState implements AIState {
  readonly name = MobAIState.WANDER;

  enter(_context: AIStateContext): void {
    //console.log(`[WanderState] Entered`);
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // Check for nearby players (instant aggro while wandering)
    const nearbyPlayer = context.findNearbyPlayer();
    if (nearbyPlayer) {
      context.setTarget(nearbyPlayer.id);
      return MobAIState.CHASE;
    }

    // Pick a wander target if we don't have one
    let wanderTarget = context.getWanderTarget();
    if (!wanderTarget) {
      wanderTarget = context.generateWanderTarget();
      context.setWanderTarget(wanderTarget);
    }

    // Move towards wander target
    const currentPos = context.getPosition();
    const distanceToTarget = Math.sqrt(
      Math.pow(wanderTarget.x - currentPos.x, 2) +
        Math.pow(wanderTarget.z - currentPos.z, 2),
    );

    if (distanceToTarget < 0.5) {
      // Reached wander target - return to idle
      context.setWanderTarget(null);
      return MobAIState.IDLE;
    }

    // Move towards wander target
    context.moveTowards(wanderTarget, deltaTime);
    return null; // Stay in WANDER
  }

  exit(context: AIStateContext): void {
    context.setWanderTarget(null);
  }
}

/**
 * CHASE State - Pursuing a player
 */
export class ChaseState implements AIState {
  readonly name = MobAIState.CHASE;

  enter(_context: AIStateContext): void {
    console.log(`[ChaseState] Entered`);
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // Check wander radius boundary (leashing)
    const spawnDistance = context.getDistanceFromSpawn();
    if (spawnDistance > context.getWanderRadius()) {
      console.log(`[ChaseState] Outside wander radius, switching to RETURN`);
      context.setTarget(null);
      return MobAIState.RETURN;
    }

    // Validate target still exists
    const targetId = context.getCurrentTarget();
    if (!targetId) {
      return MobAIState.IDLE;
    }

    const targetPlayer = context.getPlayer(targetId);
    if (!targetPlayer) {
      context.setTarget(null);
      return MobAIState.RETURN;
    }

    // Calculate distance to target
    const currentPos = context.getPosition();
    const dx = targetPlayer.position.x - currentPos.x;
    const dz = targetPlayer.position.z - currentPos.z;
    const distance2D = Math.sqrt(dx * dx + dz * dz);

    // Switch to attack if in range
    if (distance2D <= context.getCombatRange()) {
      console.log(
        `[ChaseState] In combat range (${distance2D.toFixed(2)}), switching to ATTACK`,
      );
      return MobAIState.ATTACK;
    }

    // Chase the player
    context.moveTowards(targetPlayer.position, deltaTime);
    return null; // Stay in CHASE
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * ATTACK State - In melee range, attacking
 */
export class AttackState implements AIState {
  readonly name = MobAIState.ATTACK;

  enter(_context: AIStateContext): void {
    console.log(`[AttackState] Entered`);
  }

  update(context: AIStateContext, _deltaTime: number): MobAIState | null {
    // Check wander radius boundary (can leash even while attacking)
    const spawnDistance = context.getDistanceFromSpawn();
    if (spawnDistance > context.getWanderRadius()) {
      console.log(`[AttackState] Outside wander radius, switching to RETURN`);
      context.setTarget(null);
      return MobAIState.RETURN;
    }

    // Validate target
    const targetId = context.getCurrentTarget();
    if (!targetId) {
      return MobAIState.IDLE;
    }

    const targetPlayer = context.getPlayer(targetId);
    if (!targetPlayer) {
      context.setTarget(null);
      return MobAIState.IDLE;
    }

    // Check if player moved out of range
    const currentPos = context.getPosition();
    const dx = targetPlayer.position.x - currentPos.x;
    const dz = targetPlayer.position.z - currentPos.z;
    const distance2D = Math.sqrt(dx * dx + dz * dz);

    if (distance2D > context.getCombatRange()) {
      console.log(
        `[AttackState] Player out of range (${distance2D.toFixed(2)}), switching to CHASE`,
      );
      return MobAIState.CHASE;
    }

    // Perform attack if cooldown ready
    const currentTime = context.getTime();
    if (context.canAttack(currentTime)) {
      console.log(`[AttackState] ⚔️ Performing attack on ${targetId}`);
      context.performAttack(targetId, currentTime);
    }

    return null; // Stay in ATTACK
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * RETURN State - Walking back to spawn (leashed)
 */
export class ReturnState implements AIState {
  readonly name = MobAIState.RETURN;
  private readonly RETURN_TELEPORT_DISTANCE = 50;

  enter(_context: AIStateContext): void {
    console.log(`[ReturnState] Entered, returning to spawn`);
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // IGNORE all players while returning (prevents infinite CHASE→RETURN loop)

    const spawnDistance = context.getDistanceFromSpawn();

    // Safety: teleport if extremely far AND not in combat
    if (
      spawnDistance > this.RETURN_TELEPORT_DISTANCE &&
      !context.isInCombat()
    ) {
      console.warn(
        `[ReturnState] Too far from spawn (${spawnDistance.toFixed(1)}), teleporting (not in combat)`,
      );
      const spawnPoint = context.getSpawnPoint();
      context.teleportTo(spawnPoint);
      return MobAIState.IDLE;
    } else if (spawnDistance > this.RETURN_TELEPORT_DISTANCE) {
      console.log(
        `[ReturnState] Far from spawn but IN COMBAT, walking back (no teleport)`,
      );
    }

    // Reached spawn - reset to IDLE and heal
    if (spawnDistance < 0.5) {
      console.log(`[ReturnState] Reached spawn, switching to IDLE`);
      return MobAIState.IDLE;
    }

    // Walk back to spawn
    const spawnPoint = context.getSpawnPoint();
    context.moveTowards(spawnPoint, deltaTime);
    return null; // Stay in RETURN
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * AI State Machine - Manages state transitions
 */
export class AIStateMachine {
  private currentState: AIState;
  private states: Map<MobAIState, AIState>;

  constructor() {
    // Create all state instances
    this.states = new Map<MobAIState, AIState>();
    this.states.set(MobAIState.IDLE, new IdleState());
    this.states.set(MobAIState.WANDER, new WanderState());
    this.states.set(MobAIState.CHASE, new ChaseState());
    this.states.set(MobAIState.ATTACK, new AttackState());
    this.states.set(MobAIState.RETURN, new ReturnState());

    // Start in IDLE state
    this.currentState = this.states.get(MobAIState.IDLE)!;
  }

  /**
   * Update current state and handle transitions
   */
  update(context: AIStateContext, deltaTime: number): void {
    const nextState = this.currentState.update(context, deltaTime);

    if (nextState !== null && nextState !== this.currentState.name) {
      this.transitionTo(nextState, context);
    }
  }

  /**
   * Transition to a new state
   */
  transitionTo(newState: MobAIState, context: AIStateContext): void {
    const oldState = this.currentState;
    const nextStateInstance = this.states.get(newState);

    if (!nextStateInstance) {
      //console.error(`[AIStateMachine] Invalid state: ${newState}`);
      return;
    }

    //console.log(`[AIStateMachine] ${oldState.name} → ${newState}`);

    // Exit old state
    oldState.exit(context);

    // Enter new state
    this.currentState = nextStateInstance;
    this.currentState.enter(context);

    context.markNetworkDirty();
  }

  /**
   * Get current state name
   */
  getCurrentState(): MobAIState {
    return this.currentState.name;
  }

  /**
   * Force state change (for external events like death)
   */
  forceState(newState: MobAIState, context: AIStateContext): void {
    this.transitionTo(newState, context);
  }
}
