/**
 * DeathStateManager - Manages mob death, respawn, and position locking
 *
 * Responsibilities:
 * - Lock position when mob dies (prevent teleporting during death animation)
 * - Track death animation timing (4.5s animation)
 * - Manage respawn timer (15s default)
 * - Control mesh visibility (hide after animation, show on respawn)
 * - Sync death state to network
 *
 * RuneScape-style death flow:
 * 1. die() - Lock position where mob died
 * 2. 0-4.5s - Death animation plays at locked position
 * 3. 4.5s - Hide mesh (corpse disappears)
 * 4. 4.5-15s - Invisible corpse, waiting to respawn
 * 5. 15s - respawn() - Teleport to spawn, show mesh, reset state
 */

import THREE from "../../extras/three/three";
import type { Position3D } from "../../types";

export interface DeathStateConfig {
  /** How long to wait before respawn (ms), default 15000 (15s) */
  respawnTime: number;
  /** Duration of death animation (ms), default 4500 (4.5s) */
  deathAnimationDuration: number;
  /** Spawn point to respawn at */
  spawnPoint: Position3D;
}

export class DeathStateManager {
  private isDead = false;
  private deathTime: number | null = null;
  private deathPosition: THREE.Vector3 | null = null;
  private sentDeathStateToClient = false;
  private config: DeathStateConfig;

  // Callbacks
  private onRespawnCallback?: () => void;
  private onMeshVisibilityCallback?: (visible: boolean) => void;

  constructor(config: DeathStateConfig) {
    this.config = {
      ...config,
      // Enforce defaults
      deathAnimationDuration: config.deathAnimationDuration || 4500, // 4.5 seconds
      // Manifest is source of truth for respawnTime - no minimum enforcement
      respawnTime: config.respawnTime || 15000,
    };
  }

  /**
   * Called when mob dies - locks position and starts death timer
   */
  die(currentPosition: Position3D, currentTime: number): void {
    if (this.isDead) {
      console.warn("[DeathStateManager] die() called but already dead");
      return;
    }

    // Lock position where mob died (prevent any movement during death/respawn)
    this.deathPosition = new THREE.Vector3(
      currentPosition.x,
      currentPosition.y,
      currentPosition.z,
    );
    this.deathTime = currentTime;
    this.isDead = true;
    this.sentDeathStateToClient = false;

    const spawnDist = Math.sqrt(
      Math.pow(currentPosition.x - this.config.spawnPoint.x, 2) +
        Math.pow(currentPosition.z - this.config.spawnPoint.z, 2),
    );

    console.log("[DeathStateManager] 💀 Mob died:");
    console.log(
      `  Death position: (${this.deathPosition.x.toFixed(2)}, ${this.deathPosition.y.toFixed(2)}, ${this.deathPosition.z.toFixed(2)})`,
    );
    console.log(
      `  Spawn position: (${this.config.spawnPoint.x.toFixed(2)}, ${this.config.spawnPoint.y.toFixed(2)}, ${this.config.spawnPoint.z.toFixed(2)})`,
    );
    console.log(`  Distance from spawn: ${spawnDist.toFixed(2)} units`);
    console.log(
      `  Respawn timer: ${this.config.respawnTime}ms (${(this.config.respawnTime / 1000).toFixed(1)}s)`,
    );
    console.log(`  Position LOCKED - will not move until respawn`);
  }

  /**
   * Update death state - handles animation timing
   * Call this every frame when mob is dead
   *
   * NOTE: Respawn triggering is handled by RespawnManager, not here!
   * This only manages death animation and mesh visibility.
   */
  update(_deltaTime: number, currentTime: number): void {
    if (!this.isDead || !this.deathTime) return;

    const timeSinceDeath = currentTime - this.deathTime;

    // Hide mesh after death animation finishes
    if (timeSinceDeath >= this.config.deathAnimationDuration) {
      if (this.onMeshVisibilityCallback) {
        this.onMeshVisibilityCallback(false);
      }
    }

    // REMOVED: Respawn logic - RespawnManager handles this now
    // This prevents race condition where DeathStateManager respawns at ORIGINAL spawn
    // before RespawnManager can respawn at NEW random spawn location
  }

  /**
   * Reset death state and trigger respawn callback
   * NOTE: This is now only called by RespawnManager, which provides the actual spawn point
   */
  private respawn(): void {
    if (!this.isDead) {
      console.warn("[DeathStateManager] respawn() called but not dead");
      return;
    }

    console.log(`[DeathStateManager] 🔄 Resetting death state for respawn`);

    // Reset death state
    this.isDead = false;
    this.deathTime = null;
    this.deathPosition = null;
    this.sentDeathStateToClient = false;

    // Show mesh
    if (this.onMeshVisibilityCallback) {
      this.onMeshVisibilityCallback(true);
    }

    // Notify parent to respawn (actual spawn point provided by RespawnManager)
    if (this.onRespawnCallback) {
      this.onRespawnCallback();
    }
  }

  /**
   * Get locked death position (null if not dead)
   */
  getDeathPosition(): THREE.Vector3 | null {
    return this.deathPosition;
  }

  /**
   * Check if position should be locked (mob is dead)
   */
  shouldLockPosition(): boolean {
    return this.isDead && this.deathPosition !== null;
  }

  /**
   * Get position to lock to (returns death position if dead, null otherwise)
   */
  getLockedPosition(): THREE.Vector3 | null {
    return this.shouldLockPosition() ? this.deathPosition : null;
  }

  /**
   * Check if mob is currently dead
   */
  isCurrentlyDead(): boolean {
    return this.isDead;
  }

  /**
   * Get death time (for network sync)
   */
  getDeathTime(): number | null {
    return this.deathTime;
  }

  /**
   * Set death time (from network sync)
   */
  setDeathTime(time: number | null): void {
    this.deathTime = time;
  }

  /**
   * Mark that we've sent initial death state to client
   */
  markDeathStateSent(): void {
    this.sentDeathStateToClient = true;
  }

  /**
   * Check if we've sent death state to client yet
   */
  hasSentDeathState(): boolean {
    return this.sentDeathStateToClient;
  }

  /**
   * Force respawn (for admin commands, etc.)
   */
  forceRespawn(): void {
    this.respawn();
  }

  /**
   * Register callback for when respawn happens
   */
  onRespawn(callback: () => void): void {
    this.onRespawnCallback = callback;
  }

  /**
   * Register callback for mesh visibility changes
   */
  onMeshVisibilityChange(callback: (visible: boolean) => void): void {
    this.onMeshVisibilityCallback = callback;
  }

  /**
   * Client-side: Apply death position from server
   */
  applyDeathPositionFromServer(position: THREE.Vector3): void {
    if (!this.isDead) {
      console.warn(
        "[DeathStateManager] Received death position but not dead, entering death state",
      );
      this.isDead = true;
    }
    this.deathPosition = position.clone();
  }

  /**
   * Reset to initial state (for cleanup)
   */
  reset(): void {
    this.isDead = false;
    this.deathTime = null;
    this.deathPosition = null;
    this.sentDeathStateToClient = false;
  }
}
