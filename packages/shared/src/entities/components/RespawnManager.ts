/**
 * RespawnManager - Manages mob respawn locations and timing
 *
 * Production-quality respawn system:
 * - Mobs spawn in an AREA, not at a single point (RuneScape-style)
 * - Random spawn location within configured radius
 * - Separate initial spawn from respawn locations
 * - Prevents spawn camping and exploitation
 *
 * Design:
 * 1. Define spawn area (center point + radius)
 * 2. Generate random spawn point within area
 * 3. Snap to terrain height
 * 4. Use same system for initial spawn AND respawn
 */

import type { Position3D } from '../../types';

export interface RespawnConfig {
  /** Center of the spawn area */
  spawnAreaCenter: Position3D;
  /** Radius of spawn area (meters) - mob can spawn anywhere within this radius */
  spawnAreaRadius: number;
  /** Minimum time before respawn (milliseconds) */
  respawnTimeMin: number;
  /** Maximum time before respawn (milliseconds) - adds randomness */
  respawnTimeMax: number;
}

export class RespawnManager {
  private config: RespawnConfig;
  private currentRespawnPoint: Position3D | null = null;
  private respawnTimerStart: number | null = null;
  private respawnDuration: number = 0;

  // Callback when mob should respawn
  private onRespawnCallback?: (spawnPoint: Position3D) => void;

  constructor(config: RespawnConfig) {
    this.config = {
      ...config,
      // Enforce minimum respawn time (15 seconds)
      respawnTimeMin: Math.max(config.respawnTimeMin || 15000, 15000),
      respawnTimeMax: Math.max(config.respawnTimeMax || 15000, 15000)
    };

    console.log('[RespawnManager] Created with config:', {
      center: `(${config.spawnAreaCenter.x.toFixed(1)}, ${config.spawnAreaCenter.z.toFixed(1)})`,
      radius: `${config.spawnAreaRadius}m`,
      respawnTime: `${this.config.respawnTimeMin / 1000}-${this.config.respawnTimeMax / 1000}s`
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
      z: center.z + Math.sin(angle) * distance
    };

    console.log('[RespawnManager] Generated spawn point:', {
      point: `(${spawnPoint.x.toFixed(2)}, ${spawnPoint.y.toFixed(2)}, ${spawnPoint.z.toFixed(2)})`,
      distanceFromCenter: distance.toFixed(2)
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
   * Start the respawn timer
   * Called when mob dies
   *
   * @param currentTime - Current timestamp (Date.now())
   * @param deathPosition - Where the mob died (for logging only - NOT used for respawn)
   */
  startRespawnTimer(currentTime: number, deathPosition?: Position3D): void {
    // Generate random respawn duration between min and max
    const randomRange = this.config.respawnTimeMax - this.config.respawnTimeMin;
    this.respawnDuration = this.config.respawnTimeMin + Math.random() * randomRange;

    this.respawnTimerStart = currentTime;

    // Generate NEW random spawn point for respawn
    // CRITICAL: This is DIFFERENT from death location!
    this.currentRespawnPoint = this.generateSpawnPoint();

    console.log('[RespawnManager] ⏰ Respawn timer started:', {
      duration: `${(this.respawnDuration / 1000).toFixed(1)}s`,
      deathLocation: deathPosition ? `(${deathPosition.x.toFixed(2)}, ${deathPosition.y.toFixed(2)}, ${deathPosition.z.toFixed(2)})` : 'unknown',
      newRespawnPoint: `(${this.currentRespawnPoint.x.toFixed(2)}, ${this.currentRespawnPoint.y.toFixed(2)}, ${this.currentRespawnPoint.z.toFixed(2)})`,
      distanceFromDeath: deathPosition ? this.calculateDistance(deathPosition, this.currentRespawnPoint).toFixed(2) : 'N/A'
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
   * Update respawn timer
   * Call this every frame to check if respawn time has elapsed
   */
  update(currentTime: number): void {
    if (!this.respawnTimerStart) return;

    const elapsed = currentTime - this.respawnTimerStart;

    if (elapsed >= this.respawnDuration) {
      console.log('[RespawnManager] ⏰ Respawn timer expired:', {
        elapsed: `${(elapsed / 1000).toFixed(1)}s`,
        threshold: `${(this.respawnDuration / 1000).toFixed(1)}s`
      });

      this.triggerRespawn();
    }
  }

  /**
   * Trigger respawn (timer expired)
   */
  private triggerRespawn(): void {
    if (!this.currentRespawnPoint) {
      console.error('[RespawnManager] No respawn point available!');
      return;
    }

    console.log('[RespawnManager] 🔄 Respawning at:', {
      point: `(${this.currentRespawnPoint.x.toFixed(2)}, ${this.currentRespawnPoint.y.toFixed(2)}, ${this.currentRespawnPoint.z.toFixed(2)})`
    });

    // Reset timer
    this.respawnTimerStart = null;
    this.respawnDuration = 0;

    // Call respawn callback with the spawn point
    if (this.onRespawnCallback && this.currentRespawnPoint) {
      this.onRespawnCallback(this.currentRespawnPoint);
    }
  }

  /**
   * Check if respawn timer is active
   */
  isRespawnTimerActive(): boolean {
    return this.respawnTimerStart !== null;
  }

  /**
   * Get time until respawn (milliseconds)
   * Returns -1 if not active
   */
  getTimeUntilRespawn(currentTime: number): number {
    if (!this.respawnTimerStart) return -1;
    const elapsed = currentTime - this.respawnTimerStart;
    return Math.max(0, this.respawnDuration - elapsed);
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
    this.respawnTimerStart = null;
    this.respawnDuration = 0;
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
    const radiusSquared = this.config.spawnAreaRadius * this.config.spawnAreaRadius;
    return distanceSquared <= radiusSquared;
  }
}
