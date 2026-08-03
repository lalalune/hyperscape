/**
 * WanderBehavior - rules-accurate random walking
 *
 * classic MMORPG NPCs have a probabilistic wandering system:
 * - ~10/1000 chance per CLIENT tick to start wandering
 * - With ~30 client ticks per server tick, this is ~26-30% per server tick
 * - Wander radius is typically 5 tiles from spawn point
 *
 * This replaces the time-based idle system with probabilistic wandering.
 *
 */

import type { TileCoord } from "./TileSystem";

/**
 * Movement type for NPCs
 */
export type MovementType = "wander" | "stationary" | "patrol";

/**
 * Wander configuration
 */
export interface WanderConfig {
  /** Movement type - stationary NPCs don't wander */
  movementType: MovementType;
  /** Wander radius in tiles (default 5) */
  wanderRadius?: number;
  /** Custom wander chance per tick (0-1) */
  wanderChance?: number;
}

/**
 * WanderBehavior - rules-accurate random walking
 *
 * Provides probabilistic wandering behavior matching classic tick-based mechanics.
 * NPCs have a ~26-30% chance per server tick to start a new wander path.
 */
export class WanderBehavior {
  // classic MMORPG probability converted to server tick
  // ~10/1000 per client tick × ~30 client ticks/server tick ≈ 26%
  private static readonly DEFAULT_WANDER_CHANCE = 0.26;
  private static readonly DEFAULT_WANDER_RADIUS = 5;

  // Configuration
  private readonly movementType: MovementType;
  private readonly wanderRadius: number;
  private readonly wanderChance: number;

  // State
  private _currentWanderTarget: TileCoord | null = null;
  private _lastWanderTick: number = -1;

  // Pre-allocated for zero-allocation target generation
  private readonly _tempTarget: TileCoord = { x: 0, z: 0 };

  constructor(config: WanderConfig) {
    this.movementType = config.movementType;
    this.wanderRadius =
      config.wanderRadius ?? WanderBehavior.DEFAULT_WANDER_RADIUS;
    this.wanderChance =
      config.wanderChance ?? WanderBehavior.DEFAULT_WANDER_CHANCE;
  }

  /**
   * Check if NPC should start wandering this tick
   *
   * rules-accurate: ~26-30% chance per tick when idle.
   * Returns false if:
   * - Movement type is stationary
   * - Already has a wander path
   * - Random check fails
   *
   * @param hasTarget - True if NPC has a combat/aggro target
   * @param isInCombat - True if NPC is in combat
   * @param hasWanderPath - True if already wandering
   * @param currentTick - Current server tick
   * @returns True if NPC should start wandering
   */
  shouldStartWander(
    hasTarget: boolean,
    isInCombat: boolean,
    hasWanderPath: boolean,
    currentTick: number,
  ): boolean {
    // Stationary NPCs never wander
    if (this.movementType === "stationary") {
      return false;
    }

    // Already have a target - don't wander
    if (hasTarget) {
      return false;
    }

    // In combat - don't wander
    if (isInCombat) {
      return false;
    }

    // Already wandering - continue existing path
    if (hasWanderPath) {
      return false;
    }

    // Prevent multiple wander checks in same tick
    if (currentTick === this._lastWanderTick) {
      return false;
    }
    this._lastWanderTick = currentTick;

    // Probabilistic check (rules-accurate: ~26% per tick)
    return Math.random() < this.wanderChance;
  }

  /**
   * Generate wander destination (rules-accurate)
   *
   * Random offset -5 to +5 tiles on each axis from spawn.
   * Uses pre-allocated buffer for zero allocation.
   *
   * @param spawnTile - NPC's spawn tile (center of wander area)
   * @returns Wander destination tile
   */
  generateWanderTarget(spawnTile: TileCoord): TileCoord {
    const radius = this.wanderRadius;

    // classic MMORPG: Random offset within [-radius, +radius] from spawn
    // 2 * radius + 1 possible values on each axis
    const range = 2 * radius + 1;
    const offsetX = Math.floor(Math.random() * range) - radius;
    const offsetZ = Math.floor(Math.random() * range) - radius;

    // Update temp target (zero allocation)
    this._tempTarget.x = spawnTile.x + offsetX;
    this._tempTarget.z = spawnTile.z + offsetZ;

    // Store current wander target
    this._currentWanderTarget = { ...this._tempTarget };

    return this._tempTarget;
  }

  /**
   * Check if NPC has an active wander path
   */
  hasWanderPath(): boolean {
    return this._currentWanderTarget !== null;
  }

  /**
   * Get current wander target
   */
  getWanderTarget(): TileCoord | null {
    return this._currentWanderTarget;
  }

  /**
   * Clear current wander path
   * Called when wander is complete or interrupted
   */
  clearWanderPath(): void {
    this._currentWanderTarget = null;
  }

  /**
   * Check if wander is complete (at destination)
   */
  isWanderComplete(currentTile: TileCoord): boolean {
    if (!this._currentWanderTarget) {
      return true;
    }

    return (
      currentTile.x === this._currentWanderTarget.x &&
      currentTile.z === this._currentWanderTarget.z
    );
  }

  /**
   * Update wander state based on current position
   * Clears wander path if destination reached
   */
  updateWanderState(currentTile: TileCoord): void {
    if (this.isWanderComplete(currentTile)) {
      this.clearWanderPath();
    }
  }

  /**
   * Get movement type
   */
  getMovementType(): MovementType {
    return this.movementType;
  }

  /**
   * Get wander radius
   */
  getWanderRadius(): number {
    return this.wanderRadius;
  }

  /**
   * Reset state (for respawn/cleanup)
   */
  reset(): void {
    this._currentWanderTarget = null;
    this._lastWanderTick = -1;
  }
}
