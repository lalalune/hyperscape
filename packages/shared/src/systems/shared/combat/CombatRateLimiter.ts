/**
 * CombatRateLimiter - Rate limiting for combat requests
 *
 * Prevents players from sending excessive combat requests that could:
 * - Overwhelm the server with attack processing
 * - Exploit race conditions in combat logic
 * - Create unfair advantages through request flooding
 *
 * This operates at the network layer, BEFORE requests reach CombatSystem.
 * Works in conjunction with CombatAntiCheat which monitors patterns over time.
 *
 * @see COMBAT_SYSTEM_HARDENING_PLAN.md Phase 6: Game Studio Hardening
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum attack requests per tick (default: 3) */
  maxRequestsPerTick: number;
  /** Maximum attack requests per second for burst protection (default: 5) */
  maxRequestsPerSecond: number;
  /** Cooldown ticks after rate limit exceeded (default: 2) */
  cooldownTicks: number;
  /** Whether to log rate limit violations (default: true) */
  logViolations: boolean;
}

/**
 * Per-player rate limiting state
 */
interface PlayerRateState {
  /** Requests in current tick */
  tickRequests: number;
  /** Last tick we counted */
  lastTick: number;
  /** Requests in current second */
  secondRequests: number;
  /** Last second timestamp (floored to second) */
  lastSecond: number;
  /** Tick when cooldown ends (0 = no cooldown) */
  cooldownUntilTick: number;
  /** Total times rate limited */
  totalViolations: number;
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: "tick_limit" | "second_limit" | "cooldown";
  /** Remaining requests in current tick */
  remainingThisTick: number;
  /** When cooldown ends (tick number, 0 if no cooldown) */
  cooldownUntil: number;
}

/**
 * Default rate limiter configuration
 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequestsPerTick: 3,
  maxRequestsPerSecond: 5,
  cooldownTicks: 2,
  logViolations: true,
};

/**
 * Combat Rate Limiter
 *
 * Limits combat request frequency per player to prevent abuse.
 * Uses a two-tier system:
 * 1. Per-tick limit: Prevents multiple attacks in same game tick
 * 2. Per-second limit: Prevents burst attacks across ticks
 *
 * @example
 * ```typescript
 * const rateLimiter = new CombatRateLimiter();
 *
 * // In network handler:
 * socket.on("combat:attack", (data) => {
 *   const result = rateLimiter.checkLimit(data.playerId, currentTick);
 *   if (!result.allowed) {
 *     // Reject the request
 *     socket.emit("combat:rejected", { reason: result.reason });
 *     return;
 *   }
 *   // Process the attack...
 * });
 * ```
 */
export class CombatRateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly playerStates = new Map<string, PlayerRateState>();

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a player's combat request should be allowed
   *
   * @param playerId - Player making the request
   * @param currentTick - Current game tick
   * @returns Rate limit result with allowed status and details
   */
  checkLimit(playerId: string, currentTick: number): RateLimitResult {
    const state = this.getOrCreateState(playerId);
    const currentSecond = Math.floor(Date.now() / 1000);

    // Check if in cooldown
    if (state.cooldownUntilTick > currentTick) {
      return {
        allowed: false,
        reason: "cooldown",
        remainingThisTick: 0,
        cooldownUntil: state.cooldownUntilTick,
      };
    }

    // Reset tick counter if new tick
    if (state.lastTick !== currentTick) {
      state.tickRequests = 0;
      state.lastTick = currentTick;
    }

    // Reset second counter if new second
    if (state.lastSecond !== currentSecond) {
      state.secondRequests = 0;
      state.lastSecond = currentSecond;
    }

    // Check tick limit
    if (state.tickRequests >= this.config.maxRequestsPerTick) {
      this.handleViolation(playerId, state, currentTick, "tick_limit");
      return {
        allowed: false,
        reason: "tick_limit",
        remainingThisTick: 0,
        cooldownUntil: state.cooldownUntilTick,
      };
    }

    // Check second limit
    if (state.secondRequests >= this.config.maxRequestsPerSecond) {
      this.handleViolation(playerId, state, currentTick, "second_limit");
      return {
        allowed: false,
        reason: "second_limit",
        remainingThisTick: 0,
        cooldownUntil: state.cooldownUntilTick,
      };
    }

    // Request allowed - increment counters
    state.tickRequests++;
    state.secondRequests++;

    return {
      allowed: true,
      remainingThisTick: this.config.maxRequestsPerTick - state.tickRequests,
      cooldownUntil: 0,
    };
  }

  /**
   * Check if request is allowed (simple boolean check)
   *
   * @param playerId - Player making the request
   * @param currentTick - Current game tick
   * @returns true if allowed, false if rate limited
   */
  isAllowed(playerId: string, currentTick: number): boolean {
    return this.checkLimit(playerId, currentTick).allowed;
  }

  /**
   * Get rate limit stats for a player (for admin tools)
   *
   * @param playerId - Player to check
   * @returns Player's rate limit state or null if not tracked
   */
  getPlayerStats(playerId: string): {
    tickRequests: number;
    secondRequests: number;
    totalViolations: number;
    inCooldown: boolean;
    cooldownUntil: number;
  } | null {
    const state = this.playerStates.get(playerId);
    if (!state) return null;

    return {
      tickRequests: state.tickRequests,
      secondRequests: state.secondRequests,
      totalViolations: state.totalViolations,
      inCooldown: state.cooldownUntilTick > 0,
      cooldownUntil: state.cooldownUntilTick,
    };
  }

  /**
   * Get overall stats (for monitoring dashboard)
   */
  getStats(): {
    trackedPlayers: number;
    playersInCooldown: number;
    totalViolationsAllTime: number;
  } {
    let playersInCooldown = 0;
    let totalViolationsAllTime = 0;

    for (const state of this.playerStates.values()) {
      if (state.cooldownUntilTick > 0) {
        playersInCooldown++;
      }
      totalViolationsAllTime += state.totalViolations;
    }

    return {
      trackedPlayers: this.playerStates.size,
      playersInCooldown,
      totalViolationsAllTime,
    };
  }

  /**
   * Clean up state for a disconnected player
   *
   * @param playerId - Player to clean up
   */
  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Clear all rate limiting state
   */
  destroy(): void {
    this.playerStates.clear();
  }

  /**
   * Reset a specific player's rate limit (admin action)
   *
   * @param playerId - Player to reset
   */
  resetPlayer(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<RateLimiterConfig> {
    return this.config;
  }

  /**
   * Get or create rate state for a player
   */
  private getOrCreateState(playerId: string): PlayerRateState {
    let state = this.playerStates.get(playerId);
    if (!state) {
      state = {
        tickRequests: 0,
        lastTick: 0,
        secondRequests: 0,
        lastSecond: 0,
        cooldownUntilTick: 0,
        totalViolations: 0,
      };
      this.playerStates.set(playerId, state);
    }
    return state;
  }

  /**
   * Handle a rate limit violation
   */
  private handleViolation(
    playerId: string,
    state: PlayerRateState,
    currentTick: number,
    reason: "tick_limit" | "second_limit",
  ): void {
    state.totalViolations++;
    state.cooldownUntilTick = currentTick + this.config.cooldownTicks;

    if (this.config.logViolations) {
      console.warn(
        `[CombatRateLimiter] Rate limit exceeded: player=${playerId} reason=${reason} violations=${state.totalViolations}`,
      );
    }
  }
}

/**
 * Singleton rate limiter instance for common use cases
 */
export const combatRateLimiter = new CombatRateLimiter();
