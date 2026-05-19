/**
 * HealthRegenSystem - Passive Health Regeneration (tile-based-MMORPG-style)
 *
 * Migrated 2026-04-24 from `packages/shared/src/systems/shared/character/`
 * into `@hyperforge/hyperscape` as the second slice of the
 * Hyperscape→meta-plugin extraction. The 17-tick cooldown / 100-tick
 * regen interval / no-regen-while-in-combat behavior is tile-based-MMORPG-specific
 * Hyperscape gameplay — it belongs in the Hyperscape plugin, not in
 * `@hyperforge/shared`.
 *
 * Server-authoritative system. Implements tile-based-MMORPG-accurate mechanics
 * using game ticks (600ms each):
 * - No regeneration while in combat
 * - 17 tick cooldown (10.2 seconds) after taking damage before regen starts
 * - Regenerates 1 HP every 100 ticks (60 seconds) when conditions are met
 *
 * Works for both human players and AI agent players automatically.
 *
 * @see {@link CombatSystem} for combat state tracking
 * @see {@link getHealthRegenCooldownTicks()} for cooldown (17 ticks)
 * @see {@link getHealthRegenIntervalTicks()} for regen interval (100 ticks)
 */

import {
  getHealthRegenCooldownTicks,
  getHealthRegenIntervalTicks,
  getHealthRegenRate,
  SystemBase,
  type World,
} from "@hyperforge/shared";
import type { PlayerSystem } from "./PlayerSystem.js";
import type { CombatSystem } from "./combat/CombatSystem.js";

/**
 * Minimal player snapshot shape this system needs. Inlined because
 * shared's barrel `Player` aliases to the entity class
 * `PlayerEntity` (via `types/index.ts:133`), not the data interface
 * with `alive` / `health.{current,max}` that lives in
 * `types/entities/player-types.ts`. Both shapes coexist in shared
 * for historical reasons; the data shape is what `getAllPlayers()`
 * actually returns. Until that ambiguity is resolved upstream,
 * declare exactly the fields this system reads.
 */
interface PlayerSnapshot {
  readonly id: string;
  readonly alive?: boolean;
  readonly health?: { readonly current?: number; readonly max?: number };
}

// Default regen rate if not defined in GameConstants
const DEFAULT_REGEN_RATE = 1; // 1 HP per regen tick

/**
 * HealthRegenSystem - Manages passive health regeneration for all players
 *
 * This system runs on the server only and handles:
 * - Checking if players are eligible for regeneration
 * - Applying health regeneration at configured rate
 * - Respecting combat cooldown periods
 */
export class HealthRegenSystem extends SystemBase {
  declare world: World;

  /** Last tick when global regen was processed */
  private lastRegenTick: number = 0;

  /** Reference to combat system for checking combat state */
  private combatSystem: CombatSystem | null = null;

  /** Reference to player system for getting players */
  private playerSystem: PlayerSystem | null = null;

  /** HP amount to regenerate per interval */
  private regenRate: number;

  constructor(world: World) {
    super(world, {
      name: "health-regen",
      dependencies: {
        optional: ["combat", "player"],
      },
      autoCleanup: true,
    });

    // Load regen rate from constants (default: 1 HP per regen tick)
    this.regenRate = getHealthRegenRate() ?? DEFAULT_REGEN_RATE;
  }

  /**
   * Initialize the system
   * Called after all systems are registered
   */
  override async start(): Promise<void> {
    // Get reference to combat system
    this.combatSystem = this.world.getSystem("combat") as CombatSystem | null;
    this.playerSystem = this.world.getSystem("player") as PlayerSystem | null;

    // Initialize lastRegenTick to current tick
    this.lastRegenTick = this.world.currentTick ?? 0;

    if (!this.combatSystem) {
      console.warn(
        "[HealthRegenSystem] CombatSystem not found - combat state checks will be skipped",
      );
    }

    if (!this.playerSystem) {
      console.warn(
        "[HealthRegenSystem] PlayerSystem not found - regen will be disabled",
      );
    }

    console.log(
      `[HealthRegenSystem] Started - Rate: ${this.regenRate} HP, ` +
        `Cooldown: ${getHealthRegenCooldownTicks()} ticks, ` +
        `Interval: ${getHealthRegenIntervalTicks()} ticks`,
    );
  }

  /**
   * Update loop - called every frame
   * Processes regen every 100 ticks (60 seconds)
   */
  override update(_delta: number): void {
    // Only run on server
    if (!this.world.isServer) return;

    // Need player system to function
    if (!this.playerSystem) return;

    const currentTick = this.world.currentTick ?? 0;

    // Check if 100 ticks have passed since last regen
    if (currentTick - this.lastRegenTick < getHealthRegenIntervalTicks()) {
      return;
    }

    // Update last regen tick
    this.lastRegenTick = currentTick;

    // Process all players - heal fixed amount per regen interval
    this.processPlayerRegen();
  }

  /**
   * Process health regeneration for all players
   */
  private processPlayerRegen(): void {
    if (!this.playerSystem) return;

    // Cast bridges the barrel-export ambiguity around `Player` (see
    // PlayerSnapshot interface above). At runtime `getAllPlayers()`
    // returns objects with the snapshot fields this system reads.
    const players =
      this.playerSystem.getAllPlayers() as unknown as PlayerSnapshot[];

    for (const player of players) {
      // Check if player should regenerate
      const regenStatus = this.getRegenStatus(player);

      if (!regenStatus.shouldRegen) {
        continue;
      }

      // Apply regeneration
      this.applyRegen(player);
    }
  }

  /**
   * Get detailed regen status for debugging
   */
  private getRegenStatus(player: PlayerSnapshot): {
    shouldRegen: boolean;
    alive: boolean;
    healthFull: boolean;
    inCombat: boolean;
    cooldownExpired: boolean;
  } {
    const alive = player.alive !== false;
    const currentHealth = player.health?.current ?? 0;
    const maxHealth = player.health?.max ?? 100;
    const healthFull = currentHealth >= maxHealth;
    const inCombat = this.combatSystem?.isInCombat(player.id) ?? false;

    const playerEntity = this.world.entities?.get(player.id);
    const lastDamageTick = this.getLastDamageTick(playerEntity);
    const currentTick = this.world.currentTick ?? 0;

    // Cooldown: 17 ticks (10.2 seconds) after taking damage
    const cooldownExpired =
      lastDamageTick === null ||
      currentTick - lastDamageTick >= getHealthRegenCooldownTicks();

    return {
      shouldRegen: alive && !healthFull && !inCombat && cooldownExpired,
      alive,
      healthFull,
      inCombat,
      cooldownExpired,
    };
  }

  /**
   * Apply health regeneration to a player
   */
  private applyRegen(player: PlayerSnapshot): void {
    if (!this.playerSystem) return;

    const currentHealth = player.health?.current ?? 0;
    const maxHealth = player.health?.max ?? 100;

    // Only apply if there's meaningful healing to do
    if (currentHealth >= maxHealth) return;

    // Use PlayerSystem.healPlayer() - this properly updates health AND emits network events
    // Heal exactly regenRate HP per interval (default: 1 HP every 100 ticks / 60 seconds)
    this.playerSystem.healPlayer(player.id, this.regenRate);
  }

  /**
   * Get last damage tick from entity (tick-based for tile-based MMORPG accuracy)
   */
  private getLastDamageTick(entity: unknown): number | null {
    if (!entity || typeof entity !== "object") return null;

    const entityObj = entity as Record<string, unknown>;

    // Try direct property (set by PlayerSystem.takeDamage/damagePlayer)
    if (typeof entityObj.lastDamageTick === "number") {
      return entityObj.lastDamageTick;
    }

    return null;
  }

  /**
   * Get system statistics for debugging
   */
  getStats(): {
    regenRate: number;
    regenCooldownTicks: number;
    regenIntervalTicks: number;
    lastRegenTick: number;
  } {
    return {
      regenRate: this.regenRate,
      regenCooldownTicks: getHealthRegenCooldownTicks(),
      regenIntervalTicks: getHealthRegenIntervalTicks(),
      lastRegenTick: this.lastRegenTick,
    };
  }
}
