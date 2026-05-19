/**
 * MobHealthBarManager - Manages health bar lifecycle for MobEntity.
 *
 * Extracted from MobEntity to separate health bar concerns from combat and AI logic.
 * Handles health bar creation, updates, positioning, visibility, and destruction
 * using the atlas-based HealthBars system (instanced mesh for performance).
 *
 * **Pattern**: Plain class (not a System subclass).
 * Constructor takes a MobHealthBarContext interface that bridges back to the entity.
 */

import * as THREE from "three";
import type { World } from "@hyperforge/shared";
import type { MobEntityConfig } from "@hyperforge/shared";
// HealthBars migrated to @hyperforge/hyperscape (2026-04-25).
// Duck-typed local shapes (mirrors `nodes/HealthBar.ts` pattern).
interface HealthBarHandle {
  entityId: string;
  move: (newMatrix: THREE.Matrix4) => void;
  setHealth: (current: number, max: number) => void;
  show: (timeoutMs?: number) => void;
  hide: () => void;
  destroy: () => void;
}
interface HealthBarsSystem {
  add: (
    entityId: string,
    health: number,
    maxHealth: number,
  ) => HealthBarHandle | null;
}
import { getCombatTimeoutTicks } from "@hyperforge/shared";
import { ticksToMs } from "@hyperforge/shared";

/**
 * Context interface that MobHealthBarManager uses to interact with MobEntity.
 * Avoids needing direct access to private entity fields.
 */
export interface MobHealthBarContext {
  /** The world instance for accessing systems */
  world: World;
  /** Mob configuration (read-only access to relevant fields) */
  config: MobEntityConfig;
  /** Entity ID */
  id: string;
  /** The entity's scene graph node (for reading matrixWorld for positioning) */
  node: THREE.Object3D;
  /** Get current health */
  getHealth(): number;
  /** Get max health */
  getMaxHealth(): number;
  /** Set health on the entity (for refreshing after respawn) */
  setHealth(health: number): void;
  /** Check if the entity is currently dead (from DeathStateManager) */
  isCurrentlyDead(): boolean;
}

export class MobHealthBarManager {
  private _healthBarHandle: HealthBarHandle | null = null;
  private _healthBarVisibleUntil: number = 0;
  private _lastKnownHealth: number = 0;

  /** Pre-allocated matrix for health bar positioning (avoids per-frame allocation) */
  private readonly _healthBarMatrix = new THREE.Matrix4();

  constructor(private ctx: MobHealthBarContext) {
    this._lastKnownHealth = ctx.config.currentHealth;
  }

  // ─── Public accessors ───────────────────────────────────────────

  /** Get the health bar handle (needed for external visibility checks) */
  getHandle(): HealthBarHandle | null {
    return this._healthBarHandle;
  }

  /** Get the last known health value */
  getLastKnownHealth(): number {
    return this._lastKnownHealth;
  }

  /** Set the last known health (called when health updates arrive) */
  setLastKnownHealth(health: number): void {
    this._lastKnownHealth = health;
  }

  /** Reset health bar visibility timeout (called on respawn) */
  resetVisibilityTimeout(): void {
    this._healthBarVisibleUntil = 0;
  }

  // ─── Initialization ─────────────────────────────────────────────

  /**
   * Register with HealthBars system (client-side only).
   * Uses atlas-based instanced mesh for performance instead of sprite per mob.
   * Health bar starts hidden (tile-based MMORPG pattern: only show during combat).
   */
  init(): void {
    if (this.ctx.world.isServer) return;

    const healthbars = this.ctx.world.getSystem?.("healthbars") as
      | HealthBarsSystem
      | undefined;

    if (healthbars) {
      this._healthBarHandle = healthbars.add(
        this.ctx.id,
        this.ctx.config.currentHealth,
        this.ctx.config.maxHealth,
      );
      // Health bar starts hidden (tile-based MMORPG pattern: only show during combat)
    }

    this._lastKnownHealth = this.ctx.config.currentHealth;
  }

  // ─── Health bar update ──────────────────────────────────────────

  /**
   * Update health bar display value.
   * Shows 0 during death animation regardless of actual health value.
   * This prevents health bar from showing server respawn health during client-side death animation.
   */
  updateHealthBar(): void {
    if (!this._healthBarHandle) {
      return;
    }

    // CRITICAL: Show 0 health during death animation regardless of actual health value
    const displayHealth = this.ctx.isCurrentlyDead() ? 0 : this.ctx.getHealth();
    this._healthBarHandle.setHealth(displayHealth, this.ctx.getMaxHealth());
  }

  // ─── Position update (called every client frame) ────────────────

  /**
   * Update health bar position to float above mob's head.
   * Uses pre-allocated matrix to avoid per-frame allocation.
   */
  updatePosition(): void {
    if (!this._healthBarHandle) return;

    // Position health bar above mob's head using pre-allocated matrix
    this._healthBarMatrix.copyPosition(this.ctx.node.matrixWorld);
    // Offset Y to position above the mob (2.0 units up)
    this._healthBarMatrix.elements[13] += 2.0;
    this._healthBarHandle.move(this._healthBarMatrix);
  }

  // ─── Visibility management ──────────────────────────────────────

  /**
   * Check and hide health bar after combat timeout (tile-based MMORPG pattern: 4.8 seconds).
   * Called every client frame.
   */
  updateVisibilityTimeout(): void {
    if (!this._healthBarHandle || this._healthBarVisibleUntil <= 0) return;

    if (Date.now() >= this._healthBarVisibleUntil) {
      this._healthBarHandle.hide();
      this._healthBarVisibleUntil = 0;
    }
  }

  /**
   * Show health bar when entering combat.
   * Extends visibility timeout on each combat update.
   */
  showForCombat(): void {
    if (!this._healthBarHandle) return;

    this._healthBarHandle.show();
    this._healthBarVisibleUntil =
      Date.now() + ticksToMs(getCombatTimeoutTicks());
  }

  // ─── Death / Respawn lifecycle ──────────────────────────────────

  /**
   * Destroy health bar immediately when mob dies (frees atlas slot).
   */
  destroyOnDeath(): void {
    if (this._healthBarHandle) {
      this._healthBarHandle.destroy();
      this._healthBarHandle = null;
    }
  }

  /**
   * Recreate health bar after respawn (was destroyed on death to free atlas slot).
   * Re-registers with the HealthBars system and refreshes health display.
   */
  recreateOnRespawn(): void {
    if (this._healthBarHandle) return; // Already exists

    const healthbars = this.ctx.world.getSystem?.("healthbars") as
      | HealthBarsSystem
      | undefined;

    if (healthbars) {
      this._healthBarHandle = healthbars.add(
        this.ctx.id,
        this.ctx.config.currentHealth,
        this.ctx.config.maxHealth,
      );
    }

    // Update health bar now that mesh is visible again
    this.ctx.setHealth(this.ctx.config.currentHealth);
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  /**
   * Destroy health bar handle. Called from MobEntity.destroy().
   */
  destroy(): void {
    if (this._healthBarHandle) {
      this._healthBarHandle.destroy();
      this._healthBarHandle = null;
    }
  }
}
