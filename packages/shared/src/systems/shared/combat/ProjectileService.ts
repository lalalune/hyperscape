/**
 * ProjectileService - Manages projectile creation and hit timing
 *
 * Builds on HitDelayCalculator to provide a service layer for
 * tracking active projectiles and processing hits on the correct tick.
 *
 * Responsibilities:
 * - Create projectiles with pre-calculated hit timing
 * - Track active projectiles per target
 * - Process projectile hits on correct game tick
 * - Cancel projectiles when target dies/escapes
 */

import { AttackType } from "../../../types/game/item-types";
import {
  createProjectile as createProjectileData,
  calculateTileDistance,
  type ProjectileData,
  type HitDelayAttackType,
} from "../../../utils/game/HitDelayCalculator";

/**
 * Extended projectile data with additional combat context
 */
export interface CombatProjectile extends ProjectileData {
  /** Spell ID for magic attacks */
  spellId?: string;
  /** Arrow ID for ranged attacks */
  arrowId?: string;
  /** XP to award on hit */
  xpReward?: number;
  /** Whether this projectile has been cancelled */
  cancelled: boolean;
}

/**
 * Parameters for creating a projectile
 */
export interface CreateProjectileParams {
  sourceId: string;
  targetId: string;
  attackType: AttackType;
  damage: number;
  currentTick: number;
  sourcePosition: { x: number; z: number };
  targetPosition: { x: number; z: number };
  spellId?: string;
  arrowId?: string;
  xpReward?: number;
}

/**
 * Projectiles that hit on a given tick
 */
export interface ProcessTickResult {
  /** Projectiles that hit this tick */
  hits: CombatProjectile[];
  /** Remaining active projectiles */
  remaining: number;
}

/** Maximum active projectiles per attacker to prevent abuse */
const MAX_ACTIVE_PROJECTILES_PER_PLAYER = 10;

/** Maximum lifetime for a projectile in ticks before auto-purge (~12 seconds) */
const MAX_PROJECTILE_LIFETIME_TICKS = 20;

/**
 * ProjectileService class for managing combat projectiles
 */
export class ProjectileService {
  /** Active projectiles by projectile ID */
  private activeProjectiles: Map<string, CombatProjectile> = new Map();

  /** Projectiles by target ID for quick cancellation */
  private projectilesByTarget: Map<string, Set<string>> = new Map();

  /** Pre-allocated arrays for processTick (zero-allocation hot path) */
  private readonly _tickHits: CombatProjectile[] = [];
  private readonly _tickToRemove: string[] = [];

  /**
   * Validate the synchronous capacity/position conditions used by
   * createProjectile. Callers that must durably consume ammunition first can
   * fail closed before committing that cost.
   */
  canCreateProjectile(
    sourceId: string,
    sourcePosition: { x: number; z: number },
    targetPosition: { x: number; z: number },
  ): boolean {
    return (
      Number.isFinite(sourcePosition.x) &&
      Number.isFinite(sourcePosition.z) &&
      Number.isFinite(targetPosition.x) &&
      Number.isFinite(targetPosition.z) &&
      this.getActiveCountForAttacker(sourceId) <
        MAX_ACTIVE_PROJECTILES_PER_PLAYER
    );
  }

  /**
   * Create a new projectile
   *
   * @param params - Projectile creation parameters
   * @returns The created projectile, or null if attacker exceeds active projectile limit
   */
  createProjectile(params: CreateProjectileParams): CombatProjectile | null {
    const {
      sourceId,
      targetId,
      attackType,
      damage,
      currentTick,
      sourcePosition,
      targetPosition,
      spellId,
      arrowId,
      xpReward,
    } = params;

    if (!this.canCreateProjectile(sourceId, sourcePosition, targetPosition)) {
      return null;
    }

    // Calculate distance
    const distance = calculateTileDistance(sourcePosition, targetPosition);

    // Convert AttackType to HitDelayAttackType
    const hitDelayType = this.attackTypeToHitDelayType(attackType);

    // Create base projectile data using HitDelayCalculator
    const baseProjectile = createProjectileData(
      sourceId,
      targetId,
      hitDelayType,
      distance,
      damage,
      currentTick,
    );

    // Extend with combat context
    const projectile: CombatProjectile = {
      ...baseProjectile,
      spellId,
      arrowId,
      xpReward,
      cancelled: false,
    };

    // Store in active projectiles
    this.activeProjectiles.set(projectile.id, projectile);

    // Track by target
    let targetProjectiles = this.projectilesByTarget.get(targetId);
    if (!targetProjectiles) {
      targetProjectiles = new Set();
      this.projectilesByTarget.set(targetId, targetProjectiles);
    }
    targetProjectiles.add(projectile.id);

    return projectile;
  }

  /**
   * Process a game tick and return projectiles that should hit
   *
   * @param currentTick - Current game tick
   * @returns Projectiles that hit this tick
   */
  processTick(currentTick: number): ProcessTickResult {
    // Reuse pre-allocated arrays (zero GC per tick)
    this._tickHits.length = 0;
    this._tickToRemove.length = 0;

    for (const [id, projectile] of this.activeProjectiles) {
      // Skip cancelled projectiles
      if (projectile.cancelled) {
        this._tickToRemove.push(id);
        continue;
      }

      // Purge stale projectiles that exceeded their max lifetime
      if (
        currentTick - projectile.firedAtTick >
        MAX_PROJECTILE_LIFETIME_TICKS
      ) {
        projectile.cancelled = true;
        this._tickToRemove.push(id);
        continue;
      }

      // Check if projectile should hit this tick
      if (currentTick >= projectile.hitsAtTick && !projectile.processed) {
        projectile.processed = true;
        this._tickHits.push(projectile);
        this._tickToRemove.push(id);
      }
    }

    for (const id of this._tickToRemove) {
      this.removeProjectile(id);
    }

    return {
      hits: this._tickHits,
      remaining: this.activeProjectiles.size,
    };
  }

  /**
   * Cancel all projectiles targeting a specific entity
   * Used when target dies or escapes combat
   *
   * @param targetId - Target entity ID
   * @returns Number of projectiles cancelled
   */
  cancelProjectilesForTarget(targetId: string): number {
    const targetProjectiles = this.projectilesByTarget.get(targetId);
    if (!targetProjectiles) {
      return 0;
    }

    let cancelled = 0;
    for (const projectileId of targetProjectiles) {
      const projectile = this.activeProjectiles.get(projectileId);
      if (projectile && !projectile.processed) {
        projectile.cancelled = true;
        // Remove from activeProjectiles immediately
        this.activeProjectiles.delete(projectileId);
        cancelled++;
      }
    }

    // Remove the target's Set
    this.projectilesByTarget.delete(targetId);

    return cancelled;
  }

  /**
   * Cancel all projectiles from a specific attacker
   * Used when attacker dies or is stunned
   *
   * @param attackerId - Attacker entity ID
   * @returns Number of projectiles cancelled
   */
  cancelProjectilesFromAttacker(attackerId: string): number {
    // Collect IDs first to avoid modifying Map during iteration
    const toRemove: string[] = [];

    for (const projectile of this.activeProjectiles.values()) {
      if (projectile.attackerId === attackerId && !projectile.processed) {
        projectile.cancelled = true;
        toRemove.push(projectile.id);
      }
    }

    // Remove immediately instead of waiting for next processTick
    for (const id of toRemove) {
      this.removeProjectile(id);
    }

    return toRemove.length;
  }

  /**
   * Cancel every in-flight projectile exchanged by one combat pair.
   *
   * Pair-scoped cancellation is intentionally narrower than cancelling every
   * projectile involving either entity: ending one fight must not discard a
   * third party's valid projectile in multi-combat areas.
   */
  cancelProjectilesBetween(entityAId: string, entityBId: string): number {
    const toRemove: string[] = [];

    for (const projectile of this.activeProjectiles.values()) {
      const belongsToPair =
        (projectile.attackerId === entityAId &&
          projectile.targetId === entityBId) ||
        (projectile.attackerId === entityBId &&
          projectile.targetId === entityAId);
      if (belongsToPair && !projectile.processed) {
        projectile.cancelled = true;
        toRemove.push(projectile.id);
      }
    }

    for (const id of toRemove) {
      this.removeProjectile(id);
    }

    return toRemove.length;
  }

  /**
   * Get all active projectiles for a target
   */
  getProjectilesForTarget(targetId: string): CombatProjectile[] {
    const targetProjectiles = this.projectilesByTarget.get(targetId);
    if (!targetProjectiles) {
      return [];
    }

    const projectiles: CombatProjectile[] = [];
    for (const id of targetProjectiles) {
      const projectile = this.activeProjectiles.get(id);
      if (projectile && !projectile.cancelled && !projectile.processed) {
        projectiles.push(projectile);
      }
    }

    return projectiles;
  }

  /**
   * Get a specific projectile by ID
   */
  getProjectile(projectileId: string): CombatProjectile | undefined {
    return this.activeProjectiles.get(projectileId);
  }

  /**
   * Get total active projectile count
   */
  getActiveCount(): number {
    return this.activeProjectiles.size;
  }

  /**
   * Get active projectile count for a specific attacker
   */
  getActiveCountForAttacker(attackerId: string): number {
    let count = 0;
    for (const projectile of this.activeProjectiles.values()) {
      if (projectile.attackerId === attackerId && !projectile.cancelled) {
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all projectiles (for cleanup)
   */
  clear(): void {
    this.activeProjectiles.clear();
    this.projectilesByTarget.clear();
  }

  /**
   * Remove a projectile from tracking
   */
  private removeProjectile(projectileId: string): void {
    const projectile = this.activeProjectiles.get(projectileId);
    if (projectile) {
      // Remove from target tracking
      const targetProjectiles = this.projectilesByTarget.get(
        projectile.targetId,
      );
      if (targetProjectiles) {
        targetProjectiles.delete(projectileId);
        if (targetProjectiles.size === 0) {
          this.projectilesByTarget.delete(projectile.targetId);
        }
      }

      // Remove from active
      this.activeProjectiles.delete(projectileId);
    }
  }

  /**
   * Convert AttackType enum to HitDelayAttackType
   */
  private attackTypeToHitDelayType(attackType: AttackType): HitDelayAttackType {
    switch (attackType) {
      case AttackType.RANGED:
        return "ranged";
      case AttackType.MAGIC:
        return "magic";
      case AttackType.MELEE:
      default:
        return "melee";
    }
  }
}

// Export singleton instance
export const projectileService = new ProjectileService();
