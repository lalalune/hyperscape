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

import type { Position3D } from "@hyperforge/shared";
import { MobAIState } from "@hyperforge/shared";
import {
  worldToTileInto,
  tilesEqual,
  tilesWithinMeleeRange,
  tileChebyshevDistance,
  getBestUnoccupiedMeleeTile,
  tileToWorld,
  type TileCoord,
} from "@hyperforge/shared";
import type { IEntityOccupancy } from "@hyperforge/shared";
import type { EntityID } from "@hyperforge/shared";

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

  // Combat (TICK-BASED, tile-based-MMORPG-accurate)
  canAttack(currentTick: number): boolean;
  performAttack(targetId: string, currentTick: number): void;
  onEnterCombatRange(currentTick: number): void; // Sets up first-attack timing (1-tick delay)
  isInCombat(): boolean;
  exitCombat(): void;

  // Spawn & Leashing
  getSpawnPoint(): Position3D;
  getDistanceFromSpawn(): number;
  getWanderRadius(): number; // For wander target generation (5 tiles default)
  getLeashRange(): number; // For chase boundary (10 tiles default, tile-based MMORPG two-tier range)
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

  // Entity Occupancy (tile-based-MMORPG-accurate NPC collision)
  /** Entity ID for occupancy exclusion */
  getEntityId(): EntityID;
  /** Entity occupancy map for collision checks */
  getEntityOccupancy(): IEntityOccupancy;
  /** Check if tile is walkable (terrain-based) */
  isWalkable(tile: TileCoord): boolean;

  // Same-tile step-out (tile-based-MMORPG-accurate)
  /**
   * Attempt to step out to a random cardinal-adjacent tile.
   * Used when NPC is on same tile as target and cannot attack.
   *
   * tile-based MMORPG behavior: pick random N/E/S/W, move if walkable, else do nothing.
   * "In RS, they pick a random cardinal direction and try to move the NPC
   * towards that by 1 tile, if it can. If not, the NPC does nothing that cycle."
   *
   * @returns true if movement was requested (server determines walkability)
   *
   * @see https://osrs-docs.com/docs/mechanics/entity-collision/
   */
  tryStepOutCardinal(): boolean;
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
    // LEASH CHECK: If mob is already beyond leash range, don't aggro - return home first
    // This prevents the "twitch loop" where mob aggros → leashes → aggros → leashes
    const spawnDistance = context.getDistanceFromSpawn();
    const leashRange = context.getLeashRange();
    if (spawnDistance > leashRange) {
      return MobAIState.RETURN;
    }

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

  // Pre-allocated tile buffers (zero-allocation hot path)
  private readonly _currentTile: TileCoord = { x: 0, z: 0 };
  private readonly _targetTile: TileCoord = { x: 0, z: 0 };

  enter(_context: AIStateContext): void {
    //console.log(`[WanderState] Entered`);
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // LEASH CHECK: If mob wandered beyond leash range, return home before aggroing
    const spawnDistance = context.getDistanceFromSpawn();
    const leashRange = context.getLeashRange();
    if (spawnDistance > leashRange) {
      return MobAIState.RETURN;
    }

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
    worldToTileInto(currentPos.x, currentPos.z, this._currentTile);
    worldToTileInto(wanderTarget.x, wanderTarget.z, this._targetTile);

    // Check if we're on the same tile as the target
    if (tilesEqual(this._currentTile, this._targetTile)) {
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
 * tile-based MMORPG-STYLE COMBAT POSITIONING:
 * - Uses manifest combatRange to determine how close mob needs to get
 * - Range 1 (standard melee): Cardinal only (N/S/E/W) - NO diagonal attacks
 * - Range 2+ (halberd, spear): Allows diagonal attacks (Chebyshev distance)
 * - Mob paths to the nearest valid combat tile, not the exact player position
 * - This prevents entities from standing on top of each other
 *
 * IMPORTANT: Must use tilesWithinMeleeRange (not tilesWithinRange) to match
 * CombatSystem's tile-based-MMORPG-accurate range validation. Using the wrong function
 * causes mobs to get stuck when diagonally adjacent to players.
 *
 * @see https://oldschool.runescape.wiki/w/Attack_range
 */
export class ChaseState implements AIState {
  readonly name = MobAIState.CHASE;

  // Pre-allocated tile buffers (zero-allocation hot path)
  private readonly _spawnTile: TileCoord = { x: 0, z: 0 };
  private readonly _playerTile: TileCoord = { x: 0, z: 0 };
  private readonly _currentTile: TileCoord = { x: 0, z: 0 };

  enter(_context: AIStateContext): void {
    // No-op
  }

  update(context: AIStateContext, deltaTime: number): MobAIState | null {
    // Validate target still exists
    const targetId = context.getCurrentTarget();
    if (!targetId) {
      return MobAIState.IDLE;
    }

    const targetPlayer = context.getPlayer(targetId);
    if (!targetPlayer) {
      context.setTarget(null);
      return MobAIState.IDLE;
    }

    // tile-based MMORPG-ACCURATE: Check if PLAYER exceeded aggression range from SPAWN
    // This is the key difference from before: we check PLAYER position, not MOB position
    // Mob movement is capped at leashRange in MobTileMovementManager, so mob lingers at edge
    // Target loss only happens when PLAYER moves beyond aggressionRange (leashRange + combatRange)
    const spawnPoint = context.getSpawnPoint();
    const leashRange = context.getLeashRange();
    const combatRange = context.getCombatRange();
    const aggressionRange = leashRange + combatRange;

    worldToTileInto(spawnPoint.x, spawnPoint.z, this._spawnTile);
    worldToTileInto(
      targetPlayer.position.x,
      targetPlayer.position.z,
      this._playerTile,
    );
    const playerDistFromSpawn = tileChebyshevDistance(
      this._spawnTile,
      this._playerTile,
    );

    if (playerDistFromSpawn > aggressionRange) {
      context.setTarget(null);
      context.exitCombat();
      // RS-accurate: Mob returns to spawn when player exceeds aggression range
      // Prevents ranged farming exploit where mobs stand idle at leash edge
      return MobAIState.RETURN;
    }

    // TILE-BASED COMBAT RANGE CHECK (tile-based-MMORPG-style)
    const currentPos = context.getPosition();
    worldToTileInto(currentPos.x, currentPos.z, this._currentTile);
    const currentTile = this._currentTile;
    const targetTile = this._playerTile; // Reuse already computed tile

    // Check if already in combat range (uses manifest combatRange)
    // tile-based-MMORPG-accurate: Range 1 = cardinal only, Range 2+ = allows diagonal
    const combatRangeTiles = context.getCombatRange();
    const inMeleeRange = tilesWithinMeleeRange(
      currentTile,
      targetTile,
      combatRangeTiles,
    );

    if (inMeleeRange) {
      return MobAIState.ATTACK;
    }

    // If on same tile as target, transition to ATTACK state
    // ATTACK state will handle step-out behavior (tile-based-MMORPG-accurate)
    // This happens when player walks into mob's tile during chase
    if (tilesEqual(currentTile, targetTile)) {
      return MobAIState.ATTACK;
    }

    // PATH TO COMBAT RANGE TILE (considering entity occupancy)
    // Find the best tile within combat range that's:
    // 1. Closest to attacker
    // 2. Not blocked by another entity
    // 3. Terrain-walkable
    const combatTile = getBestUnoccupiedMeleeTile(
      currentTile,
      targetTile,
      context.getEntityOccupancy(),
      context.getEntityId(),
      (tile) => context.isWalkable(tile),
      combatRangeTiles,
    );

    if (combatTile) {
      // Convert combat tile to world position and move towards it
      const combatWorld = tileToWorld(combatTile);
      context.moveTowards(
        { x: combatWorld.x, y: currentPos.y, z: combatWorld.z },
        deltaTime,
      );
    }
    // If no combat tile available, mob waits (all tiles blocked)

    return null; // Stay in CHASE
  }

  exit(_context: AIStateContext): void {
    // Nothing to clean up
  }
}

/**
 * ATTACK State - In melee range, attacking
 *
 * tile-based MMORPG-STYLE MELEE COMBAT:
 * - Stay on current tile (don't move closer)
 * - Range 1 (standard melee): Cardinal only (N/S/E/W) - NO diagonal attacks
 * - Range 2+ (halberd, spear): Allows diagonal attacks (Chebyshev distance)
 * - Switch to CHASE if target moves away (no longer in valid attack range)
 *
 * SAME-TILE HANDLING (tile-based-MMORPG-accurate):
 * - NPC cannot attack from same tile (own tile not in attack range)
 * - Pick random cardinal direction and try to step out
 * - If blocked, do nothing that tick (try again next tick)
 *
 * IMPORTANT: Must use tilesWithinMeleeRange (not tilesWithinRange) to match
 * CombatSystem's tile-based-MMORPG-accurate range validation. Using the wrong function
 * causes mobs to get stuck when diagonally adjacent to players.
 *
 * @see https://oldschool.runescape.wiki/w/Attack_range
 * @see https://osrs-docs.com/docs/mechanics/entity-collision/
 */
export class AttackState implements AIState {
  readonly name = MobAIState.ATTACK;

  // Pre-allocated tile buffers (zero-allocation hot path)
  private readonly _spawnTile: TileCoord = { x: 0, z: 0 };
  private readonly _playerTile: TileCoord = { x: 0, z: 0 };
  private readonly _currentTile: TileCoord = { x: 0, z: 0 };

  enter(context: AIStateContext): void {
    // tile-based-MMORPG-accurate: First attack is delayed 1 tick after entering combat range
    // This sets up _pendingFirstAttack and _firstAttackTick for proper timing
    // Critical for re-entry attacks: resets timing when mob transitions back to ATTACK state
    const currentTick = context.getCurrentTick();
    context.onEnterCombatRange(currentTick);
  }

  update(context: AIStateContext, _deltaTime: number): MobAIState | null {
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

    // tile-based MMORPG-ACCURATE: Check if PLAYER exceeded aggression range from SPAWN
    // This is the key difference from before: we check PLAYER position, not MOB position
    // Mob movement is capped at leashRange in MobTileMovementManager, so mob lingers at edge
    // Target loss only happens when PLAYER moves beyond aggressionRange (leashRange + combatRange)
    const spawnPoint = context.getSpawnPoint();
    const leashRange = context.getLeashRange();
    const combatRangeTiles = context.getCombatRange();
    const aggressionRange = leashRange + combatRangeTiles;

    worldToTileInto(spawnPoint.x, spawnPoint.z, this._spawnTile);
    worldToTileInto(
      targetPlayer.position.x,
      targetPlayer.position.z,
      this._playerTile,
    );
    const playerDistFromSpawn = tileChebyshevDistance(
      this._spawnTile,
      this._playerTile,
    );

    if (playerDistFromSpawn > aggressionRange) {
      context.setTarget(null);
      context.exitCombat();
      // RS-accurate: Mob returns to spawn when player exceeds aggression range
      // Prevents ranged farming exploit where mobs stand idle at leash edge
      return MobAIState.RETURN;
    }

    // TILE-BASED RANGE CHECK (uses manifest combatRange)
    const currentPos = context.getPosition();
    worldToTileInto(currentPos.x, currentPos.z, this._currentTile);
    const currentTile = this._currentTile;
    const targetTile = this._playerTile; // Reuse already computed tile
    const isInRange = tilesWithinMeleeRange(
      currentTile,
      targetTile,
      combatRangeTiles,
    );
    const isSameTile = tilesEqual(currentTile, targetTile);

    // tile-based MMORPG-ACCURATE SAME-TILE HANDLING
    // When on same tile, NPC cannot attack - must step out first
    // "The tile underneath the NPC itself is not part of the attack range"
    if (isSameTile) {
      // Try to step out to a cardinal tile (checks all 4 directions)
      // Returns false if ALL directions are blocked (terrain or entities)
      context.tryStepOutCardinal();
      // Stay in ATTACK state - we're still in combat, just repositioning
      return null;
    }

    // Not in melee range - need to chase
    if (!isInRange) {
      return MobAIState.CHASE;
    }

    // In valid attack range - perform attack if cooldown ready
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
 * RETURN State - Walking back to spawn point
 *
 * Used when:
 * - Mob exceeds leash range while chasing/attacking (RS-accurate)
 * - Mob stuck for too long (production safety)
 * - Low HP retreat behavior (future feature)
 *
 * RS-accurate behavior: When player moves beyond aggression range, mob
 * returns to its spawn point rather than standing idle at the leash edge.
 * This prevents ranged farming exploits where players attack from outside
 * the mob's retaliation range.
 *
 * Per tile-based MMORPG/RS3 Wiki: "Stepping outside of a radius will cause a melee
 * monster to stop attacking you immediately and return to wandering."
 *
 * Uses TILE-BASED distance check for arrival detection.
 * Movement is tile-based (600ms ticks), so we must check if we're on the
 * same tile as spawn, not world-space distance.
 */
export class ReturnState implements AIState {
  readonly name = MobAIState.RETURN;
  private readonly RETURN_TELEPORT_DISTANCE = 50;

  // Pre-allocated tile buffers (zero-allocation hot path)
  private readonly _currentTile: TileCoord = { x: 0, z: 0 };
  private readonly _spawnTile: TileCoord = { x: 0, z: 0 };

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
    worldToTileInto(currentPos.x, currentPos.z, this._currentTile);
    worldToTileInto(spawnPoint.x, spawnPoint.z, this._spawnTile);
    const currentTile = this._currentTile;
    const spawnTile = this._spawnTile;

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
 */
export class AIStateMachine {
  private currentState: AIState;
  private states: Map<MobAIState, AIState>;
  private hasInitialized: boolean = false;

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
    // CRITICAL FIX: Call enter() on initial state on first update
    // The constructor can't call enter() because it doesn't have the context yet.
    // Without this, IdleState's idleStartTime stays at 0, causing instant transition
    // to WANDER because (Date.now() - 0) > 0 is always true.
    if (!this.hasInitialized) {
      this.currentState.enter(context);
      this.hasInitialized = true;
    }

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
    // Mark as initialized since transitionTo calls enter() on the new state
    this.hasInitialized = true;
    this.transitionTo(newState, context);
  }
}
