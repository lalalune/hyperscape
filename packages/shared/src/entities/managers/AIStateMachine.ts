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
 *
 * IMPORTANT: Uses TILE-BASED distance checks for movement states (WANDER, RETURN)
 * because movement is tile-based (600ms ticks). World-space distance checks cause
 * infinite loops when target is on the same tile but different world position.
 */

import type { Position3D } from "../../types";
import { MobAIState } from "../../types/entities";
import {
  worldToTile,
  tilesEqual,
  tilesWithinRange,
  getBestCombatRangeTile,
  tileToWorld,
} from "../../systems/shared/movement/TileSystem";

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

  // Combat (TICK-BASED, OSRS-accurate)
  canAttack(currentTick: number): boolean;
  performAttack(targetId: string, currentTick: number): void;
  isInCombat(): boolean;
  exitCombat(): void;

  // Spawn & Leashing
  getSpawnPoint(): Position3D;
  getDistanceFromSpawn(): number;
  getWanderRadius(): number;
  getCombatRange(): number;

  // Wander
  getWanderTarget(): Position3D | null;
  setWanderTarget(target: Position3D | null): void;
  generateWanderTarget(): Position3D;

  // Movement type (from manifest)
  getMovementType(): "stationary" | "wander" | "patrol";

  // Timing
  getCurrentTick(): number; // Server tick number for combat timing
  getTime(): number; // Date.now() for non-combat timing (idle duration, etc.)

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
  }

  update(context: AIStateContext, _deltaTime: number): MobAIState | null {
    // Check for nearby players (instant aggro)
    const nearbyPlayer = context.findNearbyPlayer();
    if (nearbyPlayer) {
      context.setTarget(nearbyPlayer.id);
      context.emitEvent("MOB_NPC_AGGRO", {
        mobId: "self",
        targetId: nearbyPlayer.id,
      });
      return MobAIState.CHASE;
    }

    // After idle duration, start wandering (unless stationary)
    const now = context.getTime();
    if (now - this.idleStartTime > this.idleDuration) {
      // Stationary mobs don't wander - reset timer and stay in IDLE
      if (context.getMovementType() === "stationary") {
        this.idleStartTime = now;
        this.idleDuration =
          this.IDLE_MIN_DURATION +
          Math.random() * (this.IDLE_MAX_DURATION - this.IDLE_MIN_DURATION);
        return null; // Stay in IDLE
      }
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
 *
 * IMPORTANT: Uses TILE-BASED distance check for arrival detection.
 * Movement is tile-based (600ms ticks), so we must check if we're on the
 * same tile as the target, not world-space distance. This prevents infinite
 * loops when target is on the same tile but different world position.
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

    // TILE-BASED arrival check: Convert positions to tiles and compare
    // This is critical for tick-based movement - world distance doesn't work
    const currentPos = context.getPosition();
    const currentTile = worldToTile(currentPos.x, currentPos.z);
    const targetTile = worldToTile(wanderTarget.x, wanderTarget.z);

    // Check if we're on the same tile as the target
    if (tilesEqual(currentTile, targetTile)) {
      // Reached wander target (same tile) - return to idle
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
 *
 * OSRS-STYLE COMBAT POSITIONING:
 * - Uses manifest combatRange to determine how close mob needs to get
 * - Mob chases until within combatRange tiles (Chebyshev distance 1-N)
 * - Mob paths to the nearest valid combat tile, not the exact player position
 * - This prevents entities from standing on top of each other
 *
 * @see https://oldschool.runescape.wiki/w/Attack_range
 */
export class ChaseState implements AIState {
  readonly name = MobAIState.CHASE;

  enter(_context: AIStateContext): void {
    // No-op
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // Check wander radius boundary (leashing)
    const spawnDistance = context.getDistanceFromSpawn();
    if (spawnDistance > context.getWanderRadius()) {
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

    // TILE-BASED COMBAT RANGE CHECK (OSRS-style)
    const currentPos = context.getPosition();
    const currentTile = worldToTile(currentPos.x, currentPos.z);
    const targetTile = worldToTile(
      targetPlayer.position.x,
      targetPlayer.position.z,
    );

    // Check if already in combat range (uses manifest combatRange)
    const combatRangeTiles = context.getCombatRange();
    if (tilesWithinRange(currentTile, targetTile, combatRangeTiles)) {
      return MobAIState.ATTACK;
    }

    // If somehow on same tile as target (shouldn't happen), also switch to attack
    // But log a warning as this indicates a positioning bug
    if (tilesEqual(currentTile, targetTile)) {
      console.warn(
        `[ChaseState] On same tile as target! This shouldn't happen. Switching to ATTACK.`,
      );
      return MobAIState.ATTACK;
    }

    // PATH TO COMBAT RANGE TILE (not exact player position)
    // Find the best tile within combat range that's closest to us
    const combatTile = getBestCombatRangeTile(
      targetTile,
      currentTile,
      combatRangeTiles,
    );
    if (combatTile) {
      // Convert combat tile to world position and move towards it
      const combatWorld = tileToWorld(combatTile);
      context.moveTowards(
        { x: combatWorld.x, y: currentPos.y, z: combatWorld.z },
        deltaTime,
      );
    } else {
      // Fallback: no valid combat tile, try moving closer anyway
      // This handles edge cases like all combat tiles being blocked
      context.moveTowards(targetPlayer.position, deltaTime);
    }

    return null; // Stay in CHASE
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * ATTACK State - In melee range, attacking
 *
 * OSRS-STYLE MELEE COMBAT:
 * - Stay on current tile (don't move closer)
 * - Attack when on adjacent tile to target
 * - Switch to CHASE if target moves away (no longer adjacent)
 *
 * @see https://oldschool.runescape.wiki/w/Attack_range
 */
export class AttackState implements AIState {
  readonly name = MobAIState.ATTACK;

  enter(_context: AIStateContext): void {
    // No-op
  }

  update(context: AIStateContext, _deltaTime: number): MobAIState | null {
    // Check wander radius boundary (can leash even while attacking)
    const spawnDistance = context.getDistanceFromSpawn();
    if (spawnDistance > context.getWanderRadius()) {
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

    // TILE-BASED RANGE CHECK (uses manifest combatRange)
    const currentPos = context.getPosition();
    const currentTile = worldToTile(currentPos.x, currentPos.z);
    const targetTile = worldToTile(
      targetPlayer.position.x,
      targetPlayer.position.z,
    );

    // Check if still in combat range
    // Also allow attacking if on same tile (edge case that shouldn't happen)
    const combatRangeTiles = context.getCombatRange();
    const isInRange = tilesWithinRange(
      currentTile,
      targetTile,
      combatRangeTiles,
    );
    const isSameTile = tilesEqual(currentTile, targetTile);

    if (!isInRange && !isSameTile) {
      return MobAIState.CHASE;
    }

    // Perform attack if cooldown ready (TICK-BASED, OSRS-accurate)
    const currentTick = context.getCurrentTick();
    if (context.canAttack(currentTick)) {
      context.performAttack(targetId, currentTick);
    }

    // NOTE: In ATTACK state, we DON'T call moveTowards()
    // The mob stays on its current tile and attacks from there
    // This prevents walking INTO the player's tile

    return null; // Stay in ATTACK
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * RETURN State - Walking back to spawn (leashed)
 *
 * IMPORTANT: Uses TILE-BASED distance check for arrival detection.
 * Movement is tile-based (600ms ticks), so we must check if we're on the
 * same tile as spawn, not world-space distance. This prevents infinite
 * loops when spawn is on the same tile but different world position.
 */
export class ReturnState implements AIState {
  readonly name = MobAIState.RETURN;
  private readonly RETURN_TELEPORT_DISTANCE = 50;

  enter(_context: AIStateContext): void {
    // No-op
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // IGNORE all players while returning (prevents infinite CHASE→RETURN loop)

    const spawnDistance = context.getDistanceFromSpawn();
    const spawnPoint = context.getSpawnPoint();

    // Safety: teleport if extremely far AND not in combat
    if (
      spawnDistance > this.RETURN_TELEPORT_DISTANCE &&
      !context.isInCombat()
    ) {
      context.teleportTo(spawnPoint);
      return MobAIState.IDLE;
    }

    // TILE-BASED arrival check: Convert positions to tiles and compare
    // This is critical for tick-based movement - world distance doesn't work
    const currentPos = context.getPosition();
    const currentTile = worldToTile(currentPos.x, currentPos.z);
    const spawnTile = worldToTile(spawnPoint.x, spawnPoint.z);

    // Check if we're on the same tile as spawn
    if (tilesEqual(currentTile, spawnTile)) {
      // CRITICAL: Reset combat state so mob can attack immediately on re-aggro
      // Without this, nextAttackTick retains its old value and canAttack() returns false
      context.exitCombat();
      return MobAIState.IDLE;
    }

    // Walk back to spawn
    context.moveTowards(spawnPoint, deltaTime);
    return null; // Stay in RETURN
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * AI State Machine - Manages state transitions
 *
 * PERFORMANCE: Uses shared static state instances across all mobs.
 * States are stateless (use context for all data) so they can be shared.
 * This saves memory: 1000 mobs = 1 set of state instances, not 5000.
 */
export class AIStateMachine {
  private currentState: AIState;

  // PERFORMANCE: Shared state instances (singleton pattern)
  // States are stateless - all data is in the context
  // IdleState uses instance data for idle duration, so it gets its own instance per mob
  private static readonly SHARED_WANDER = new WanderState();
  private static readonly SHARED_CHASE = new ChaseState();
  private static readonly SHARED_ATTACK = new AttackState();
  private static readonly SHARED_RETURN = new ReturnState();

  // Per-mob state instances (only for states with instance data)
  private idleState: IdleState;

  private states: Map<MobAIState, AIState>;

  constructor() {
    // Create per-mob IdleState (has instance data for idle duration)
    this.idleState = new IdleState();

    // Map states - use shared instances where possible
    this.states = new Map<MobAIState, AIState>();
    this.states.set(MobAIState.IDLE, this.idleState);
    this.states.set(MobAIState.WANDER, AIStateMachine.SHARED_WANDER);
    this.states.set(MobAIState.CHASE, AIStateMachine.SHARED_CHASE);
    this.states.set(MobAIState.ATTACK, AIStateMachine.SHARED_ATTACK);
    this.states.set(MobAIState.RETURN, AIStateMachine.SHARED_RETURN);

    // Start in IDLE state
    this.currentState = this.idleState;
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
