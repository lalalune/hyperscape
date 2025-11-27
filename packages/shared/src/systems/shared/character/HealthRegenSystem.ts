/**
 * HealthRegenSystem - Passive Health Regeneration (RuneScape-style)
 *
 * Server-authoritative system that handles passive health regeneration for all players.
 * Implements RuneScape-like mechanics:
 * - No regeneration while in combat
 * - 10-second cooldown after taking damage before regen starts
 * - Regenerates 1 HP per second when conditions are met
 *
 * Works for both human players and AI agent players automatically.
 *
 * @see {@link CombatSystem} for combat state tracking
 * @see {@link GAME_CONSTANTS.PLAYER} for regen rate configuration
 */

import { SystemBase } from "..";
import type { World } from "../../../core/World";
import { GAME_CONSTANTS } from "../../../constants/GameConstants";
import type { CombatSystem } from "../combat/CombatSystem";
import type { PlayerSystem } from "./PlayerSystem";
import type { Player } from "../../../types/core/core";

// Default constants if not defined in GameConstants
const DEFAULT_REGEN_RATE = 1; // 1 HP per regen tick
const DEFAULT_REGEN_COOLDOWN = 10000; // 10 seconds after combat/damage
const DEFAULT_REGEN_INTERVAL = 60000; // 60 seconds between regen ticks (RuneScape-style)

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

  /** Time accumulator for throttled updates */
  private timeSinceLastRegen: number = 0;

  /** Reference to combat system for checking combat state */
  private combatSystem: CombatSystem | null = null;

  /** Reference to player system for getting players */
  private playerSystem: PlayerSystem | null = null;

  /** Regen configuration */
  private regenRate: number;
  private regenCooldown: number;
  private regenInterval: number;

  constructor(world: World) {
    super(world, {
      name: "health-regen",
      dependencies: {
        optional: ["combat", "player"],
      },
      autoCleanup: true,
    });

    // Load configuration from constants
    this.regenRate =
      GAME_CONSTANTS.PLAYER.HEALTH_REGEN_RATE ?? DEFAULT_REGEN_RATE;
    this.regenCooldown =
      (GAME_CONSTANTS.PLAYER as { HEALTH_REGEN_COOLDOWN?: number })
        .HEALTH_REGEN_COOLDOWN ?? DEFAULT_REGEN_COOLDOWN;
    this.regenInterval =
      (GAME_CONSTANTS.PLAYER as { HEALTH_REGEN_INTERVAL?: number })
        .HEALTH_REGEN_INTERVAL ?? DEFAULT_REGEN_INTERVAL;
  }

  /**
   * Initialize the system
   * Called after all systems are registered
   */
  override async start(): Promise<void> {
    // Get reference to combat system
    this.combatSystem = this.world.getSystem("combat") as CombatSystem | null;
    this.playerSystem = this.world.getSystem("player") as PlayerSystem | null;

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
      `[HealthRegenSystem] Started - Rate: ${this.regenRate} HP/sec, ` +
        `Cooldown: ${this.regenCooldown}ms, Interval: ${this.regenInterval}ms`,
    );
  }

  /**
   * Update loop - called every frame
   * Throttled to only process regen at configured interval
   */
  override update(delta: number): void {
    // Only run on server
    if (!this.world.isServer) return;

    // Need player system to function
    if (!this.playerSystem) return;

    // Accumulate time
    this.timeSinceLastRegen += delta * 1000; // Convert to ms

    // Throttle updates to configured interval (default: every 60 seconds)
    if (this.timeSinceLastRegen < this.regenInterval) {
      return;
    }

    // Reset timer
    this.timeSinceLastRegen = 0;

    // Process all players - heal fixed amount per tick
    this.processPlayerRegen();
  }

  /**
   * Process health regeneration for all players
   */
  private processPlayerRegen(): void {
    if (!this.playerSystem) return;

    const now = Date.now();
    const players = this.playerSystem.getAllPlayers();

    for (const player of players) {
      // Check if player should regenerate
      const regenStatus = this.getRegenStatus(player, now);

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
  private getRegenStatus(
    player: Player,
    now: number,
  ): {
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
    const lastDamageTime = this.getLastDamageTime(playerEntity);
    const cooldownExpired =
      lastDamageTime === null || now - lastDamageTime >= this.regenCooldown;

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
  private applyRegen(player: Player): void {
    if (!this.playerSystem) return;

    const currentHealth = player.health?.current ?? 0;
    const maxHealth = player.health?.max ?? 100;

    // Only apply if there's meaningful healing to do
    if (currentHealth >= maxHealth) return;

    // Use PlayerSystem.healPlayer() - this properly updates health AND emits network events
    // Heal exactly regenRate HP per tick (default: 1 HP every 60 seconds)
    this.playerSystem.healPlayer(player.id, this.regenRate);
  }

  /**
   * Get last damage time from entity
   */
  private getLastDamageTime(entity: unknown): number | null {
    if (!entity || typeof entity !== "object") return null;

    const entityObj = entity as Record<string, unknown>;

    // Try direct property
    if (typeof entityObj.lastDamageTime === "number") {
      return entityObj.lastDamageTime;
    }

    // Try health component data
    if (entityObj.health && typeof entityObj.health === "object") {
      const healthObj = entityObj.health as Record<string, unknown>;
      if (typeof healthObj.lastDamageTime === "number") {
        return healthObj.lastDamageTime;
      }
    }

    // Try components Map/object
    if (entityObj.components && typeof entityObj.components === "object") {
      const components = entityObj.components as Record<string, unknown>;
      const healthComp = components.health as
        | Record<string, unknown>
        | undefined;
      if (healthComp) {
        if (typeof healthComp.lastDamageTime === "number") {
          return healthComp.lastDamageTime;
        }
        // Try data property of component
        const data = healthComp.data as Record<string, unknown> | undefined;
        if (data && typeof data.lastDamageTime === "number") {
          return data.lastDamageTime;
        }
      }
    }

    // Try getComponent method
    if (
      typeof (entityObj as { getComponent?: (name: string) => unknown })
        .getComponent === "function"
    ) {
      const healthComp = (
        entityObj as { getComponent: (name: string) => unknown }
      ).getComponent("health");
      if (healthComp && typeof healthComp === "object") {
        const hc = healthComp as Record<string, unknown>;
        if (typeof hc.lastDamageTime === "number") {
          return hc.lastDamageTime;
        }
        // Try data property
        const data = hc.data as Record<string, unknown> | undefined;
        if (data && typeof data.lastDamageTime === "number") {
          return data.lastDamageTime;
        }
      }
    }

    return null;
  }

  /**
   * Get system statistics for debugging
   */
  getStats(): {
    regenRate: number;
    regenCooldown: number;
    regenInterval: number;
  } {
    return {
      regenRate: this.regenRate,
      regenCooldown: this.regenCooldown,
      regenInterval: this.regenInterval,
    };
  }
}
