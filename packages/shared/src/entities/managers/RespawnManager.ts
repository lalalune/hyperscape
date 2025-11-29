/**
 * RespawnManager - Manages mob respawn locations and timing (TICK-BASED)
 *
 * Production-quality respawn system:
 * - Mobs spawn in an AREA, not at a single point (RuneScape-style)
 * - Random spawn location within configured radius
 * - Separate initial spawn from respawn locations
 * - Prevents spawn camping and exploitation
 * - TICK-BASED timing for OSRS-accurate respawn mechanics
 *
 * Design:
 * 1. Define spawn area (center point + radius)
 * 2. Generate random spawn point within area
 * 3. Snap to terrain height
 * 4. Use same system for initial spawn AND respawn
 *
 * Timing:
 * - Config accepts milliseconds for backwards compatibility
 * - Internally converts to ticks for OSRS-accurate timing
 * - Respawn timer tracked in ticks (600ms per tick)
 *
 * @see https://oldschool.runescape.wiki/w/Respawn_rate
 */

import type { Position3D } from "../../types";
import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { msToTicks, ticksToMs } from "../../utils/game/CombatCalculations";

export interface RespawnConfig {
  /** Center of the spawn area */
  spawnAreaCenter: Position3D;
  /** Radius of spawn area (meters) - mob can spawn anywhere within this radius */
  spawnAreaRadius: number;
  /** Minimum time before respawn (milliseconds) - converted to ticks internally */
  respawnTimeMin: number;
  /** Maximum time before respawn (milliseconds) - adds randomness, converted to ticks internally */
  respawnTimeMax: number;
}

export class RespawnManager {
  private config: RespawnConfig;
  private currentRespawnPoint: Position3D | null = null;

  // TICK-BASED respawn timing (OSRS-accurate)
  private respawnStartTick: number | null = null;
  private respawnDurationTicks: number = 0;

  // Cached tick values (converted from ms config)
  private respawnTicksMin: number;
  private respawnTicksMax: number;

  // Callback when mob should respawn
  private onRespawnCallback?: (spawnPoint: Position3D) => void;

  constructor(config: RespawnConfig) {
    this.config = {
      ...config,
      // Enforce minimum respawn time (15 seconds = 25 ticks)
      respawnTimeMin: Math.max(config.respawnTimeMin || 15000, 15000),
      respawnTimeMax: Math.max(config.respawnTimeMax || 15000, 15000),
    };

    // Convert ms config to ticks (with minimum of RESPAWN_TICKS_MIN)
    this.respawnTicksMin = msToTicks(
      this.config.respawnTimeMin,
      COMBAT_CONSTANTS.RESPAWN_TICKS_MIN,
    );
    this.respawnTicksMax = msToTicks(
      this.config.respawnTimeMax,
      COMBAT_CONSTANTS.RESPAWN_TICKS_MIN,
    );

    console.log("[RespawnManager] Created with config:", {
      center: `(${config.spawnAreaCenter.x.toFixed(1)}, ${config.spawnAreaCenter.z.toFixed(1)})`,
      radius: `${config.spawnAreaRadius}m`,
      respawnTicks: `${this.respawnTicksMin}-${this.respawnTicksMax} ticks`,
      respawnTime: `${(ticksToMs(this.respawnTicksMin) / 1000).toFixed(1)}-${(ticksToMs(this.respawnTicksMax) / 1000).toFixed(1)}s`,
    });
  }

  /**
   * Generate a random spawn point within the spawn area
   * This is used for both initial spawn AND respawn
   */
  generateSpawnPoint(): Position3D {
    const center = this.config.spawnAreaCenter;
    const radius = this.config.spawnAreaRadius;

    // Random angle (0-360 degrees)
    const angle = Math.random() * Math.PI * 2;

    // Random distance from center (0 to radius)
    // Use sqrt for uniform distribution (otherwise it clusters in center)
    const distance = Math.sqrt(Math.random()) * radius;

    const spawnPoint: Position3D = {
      x: center.x + Math.cos(angle) * distance,
      y: center.y, // Will be snapped to terrain
      z: center.z + Math.sin(angle) * distance,
    };

    console.log("[RespawnManager] Generated spawn point:", {
      point: `(${spawnPoint.x.toFixed(2)}, ${spawnPoint.y.toFixed(2)}, ${spawnPoint.z.toFixed(2)})`,
      distanceFromCenter: distance.toFixed(2),
    });

    return spawnPoint;
  }

  /**
   * Get the current spawn point (for initial spawn or respawn)
   * Generates a new one if needed
   */
  getSpawnPoint(): Position3D {
    if (!this.currentRespawnPoint) {
      this.currentRespawnPoint = this.generateSpawnPoint();
    }
    return this.currentRespawnPoint;
  }

  /**
   * Start the respawn timer (TICK-BASED)
   * Called when mob dies
   *
   * @param currentTick - Current server tick number
   * @param deathPosition - Where the mob died (for logging only - NOT used for respawn)
   */
  startRespawnTimer(currentTick: number, deathPosition?: Position3D): void {
    // Generate random respawn duration between min and max (in ticks)
    const randomTickRange = this.respawnTicksMax - this.respawnTicksMin;
    this.respawnDurationTicks =
      this.respawnTicksMin + Math.floor(Math.random() * (randomTickRange + 1));

    this.respawnStartTick = currentTick;

    // Generate NEW random spawn point for respawn
    // CRITICAL: This is DIFFERENT from death location!
    this.currentRespawnPoint = this.generateSpawnPoint();

    const durationMs = ticksToMs(this.respawnDurationTicks);
    console.log("[RespawnManager] ⏰ Respawn timer started:", {
      durationTicks: this.respawnDurationTicks,
      durationSeconds: `${(durationMs / 1000).toFixed(1)}s`,
      respawnTick: currentTick + this.respawnDurationTicks,
      deathLocation: deathPosition
        ? `(${deathPosition.x.toFixed(2)}, ${deathPosition.y.toFixed(2)}, ${deathPosition.z.toFixed(2)})`
        : "unknown",
      newRespawnPoint: `(${this.currentRespawnPoint.x.toFixed(2)}, ${this.currentRespawnPoint.y.toFixed(2)}, ${this.currentRespawnPoint.z.toFixed(2)})`,
      distanceFromDeath: deathPosition
        ? this.calculateDistance(
            deathPosition,
            this.currentRespawnPoint,
          ).toFixed(2)
        : "N/A",
    });
  }

  /**
   * Calculate 2D distance between two points
   */
  private calculateDistance(a: Position3D, b: Position3D): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Update respawn timer (TICK-BASED)
   * Call this on each tick to check if respawn time has elapsed
   *
   * @param currentTick - Current server tick number
   */
  update(currentTick: number): void {
    if (this.respawnStartTick === null) return;

    const elapsedTicks = currentTick - this.respawnStartTick;

    if (elapsedTicks >= this.respawnDurationTicks) {
      console.log("[RespawnManager] ⏰ Respawn timer expired:", {
        elapsedTicks,
        thresholdTicks: this.respawnDurationTicks,
        elapsedSeconds: `${(ticksToMs(elapsedTicks) / 1000).toFixed(1)}s`,
      });

      this.triggerRespawn();
    }
  }

  /**
   * Trigger respawn (timer expired)
   */
  private triggerRespawn(): void {
    if (!this.currentRespawnPoint) {
      console.error("[RespawnManager] No respawn point available!");
      return;
    }

    console.log("[RespawnManager] 🔄 Respawning at:", {
      point: `(${this.currentRespawnPoint.x.toFixed(2)}, ${this.currentRespawnPoint.y.toFixed(2)}, ${this.currentRespawnPoint.z.toFixed(2)})`,
    });

    // Reset timer
    this.respawnStartTick = null;
    this.respawnDurationTicks = 0;

    // Call respawn callback with the spawn point
    if (this.onRespawnCallback && this.currentRespawnPoint) {
      this.onRespawnCallback(this.currentRespawnPoint);
    }
  }

  /**
   * Check if respawn timer is active
   */
  isRespawnTimerActive(): boolean {
    return this.respawnStartTick !== null;
  }

  /**
   * Get ticks until respawn (TICK-BASED)
   * Returns -1 if not active
   *
   * @param currentTick - Current server tick number
   */
  getTicksUntilRespawn(currentTick: number): number {
    if (this.respawnStartTick === null) return -1;
    const elapsedTicks = currentTick - this.respawnStartTick;
    return Math.max(0, this.respawnDurationTicks - elapsedTicks);
  }

  /**
   * Get time until respawn in milliseconds (for UI display)
   * Returns -1 if not active
   *
   * @param currentTick - Current server tick number
   */
  getTimeUntilRespawn(currentTick: number): number {
    const ticksRemaining = this.getTicksUntilRespawn(currentTick);
    if (ticksRemaining < 0) return -1;
    return ticksToMs(ticksRemaining);
  }

  /**
   * Force respawn immediately (admin command, etc.)
   */
  forceRespawn(): void {
    if (!this.currentRespawnPoint) {
      this.currentRespawnPoint = this.generateSpawnPoint();
    }
    this.triggerRespawn();
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.respawnStartTick = null;
    this.respawnDurationTicks = 0;
    this.currentRespawnPoint = null;
  }

  /**
   * Register callback for when respawn happens
   */
  onRespawn(callback: (spawnPoint: Position3D) => void): void {
    this.onRespawnCallback = callback;
  }

  /**
   * Get spawn area center (for returning/leashing)
   */
  getSpawnAreaCenter(): Position3D {
    return this.config.spawnAreaCenter;
  }

  /**
   * Get spawn area radius
   */
  getSpawnAreaRadius(): number {
    return this.config.spawnAreaRadius;
  }

  /**
   * Check if a position is within spawn area
   */
  isWithinSpawnArea(position: Position3D): boolean {
    const center = this.config.spawnAreaCenter;
    const dx = position.x - center.x;
    const dz = position.z - center.z;
    const distanceSquared = dx * dx + dz * dz;
    const radiusSquared =
      this.config.spawnAreaRadius * this.config.spawnAreaRadius;
    return distanceSquared <= radiusSquared;
  }
}
