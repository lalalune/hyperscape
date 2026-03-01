/**
 * Rate Limiter Utility
 *
 * Provides configurable rate limiting for network handlers.
 * Uses a sliding window approach with automatic cleanup.
 *
 * Features:
 * - Per-player rate limiting
 * - Configurable max requests per second
 * - Automatic stale entry cleanup
 * - Memory-efficient with periodic pruning
 *
 * @example
 * const limiter = createRateLimiter({ maxPerSecond: 10, name: 'inventory-move' });
 * if (!limiter.check(playerId)) {
 *   return { error: 'RATE_LIMITED' };
 * }
 */

export interface RateLimiterConfig {
  /** Maximum requests allowed per second */
  maxPerSecond: number;
  /** Name for logging purposes */
  name: string;
  /** Cleanup interval in ms (default: 60000) */
  cleanupInterval?: number;
  /** How long to keep stale entries in ms (default: 60000) */
  staleThreshold?: number;
}

export interface RateLimiterEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiter {
  /**
   * Check if request is allowed and update counter
   * @param playerId - Player making the request
   * @returns true if allowed, false if rate limited
   */
  check(playerId: string): boolean;

  /**
   * Get current count for a player (for debugging/monitoring)
   * @param playerId - Player to check
   * @returns Current request count in window, or 0 if no entry
   */
  getCount(playerId: string): number;

  /**
   * Reset rate limit for a player (e.g., on disconnect)
   * @param playerId - Player to reset
   */
  reset(playerId: string): void;

  /**
   * Clean up all entries and stop cleanup interval
   * Call this when shutting down the server
   */
  destroy(): void;

  /** Number of tracked players (for monitoring) */
  readonly size: number;

  /** Rate limiter name */
  readonly name: string;
}

/**
 * Create a new rate limiter instance
 *
 * @param config - Rate limiter configuration
 * @returns RateLimiter instance
 *
 * @example
 * // Create limiter for inventory moves (10/sec)
 * const moveLimiter = createRateLimiter({
 *   maxPerSecond: 10,
 *   name: 'inventory-move'
 * });
 *
 * // In handler:
 * if (!moveLimiter.check(playerId)) {
 *   return; // Rate limited
 * }
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const {
    maxPerSecond,
    name,
    cleanupInterval = 60000,
    staleThreshold = 60000,
  } = config;

  const entries = new Map<string, RateLimiterEntry>();

  // Periodic cleanup of stale entries to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    const cutoff = now - staleThreshold;

    for (const [playerId, entry] of entries.entries()) {
      if (entry.resetTime < cutoff) {
        entries.delete(playerId);
      }
    }
  }, cleanupInterval);

  // Prevent cleanup timer from keeping process alive
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return {
    check(playerId: string): boolean {
      const now = Date.now();
      const entry = entries.get(playerId);

      if (entry) {
        if (now < entry.resetTime) {
          // Within current window
          if (entry.count >= maxPerSecond) {
            return false; // Rate limited
          }
          entry.count++;
        } else {
          // Window expired, reset
          entry.count = 1;
          entry.resetTime = now + 1000;
        }
      } else {
        // New entry
        entries.set(playerId, {
          count: 1,
          resetTime: now + 1000,
        });
      }

      return true;
    },

    getCount(playerId: string): number {
      const entry = entries.get(playerId);
      if (!entry) return 0;

      const now = Date.now();
      if (now >= entry.resetTime) return 0; // Window expired

      return entry.count;
    },

    reset(playerId: string): void {
      entries.delete(playerId);
    },

    destroy(): void {
      clearInterval(cleanupTimer);
      entries.clear();
    },

    get size(): number {
      return entries.size;
    },

    get name(): string {
      return name;
    },
  };
}

// Pre-configured rate limiters for common operations
// These are singletons to share state across handler calls

let pickupLimiter: RateLimiter | null = null;
let moveLimiter: RateLimiter | null = null;
let dropLimiter: RateLimiter | null = null;
let equipLimiter: RateLimiter | null = null;
let tileMovementLimiter: RateLimiter | null = null;
let pathfindLimiter: RateLimiter | null = null;
let combatLimiter: RateLimiter | null = null;
let followLimiter: RateLimiter | null = null;
let consumeLimiter: RateLimiter | null = null;
let coinPouchLimiter: RateLimiter | null = null;
let prayerLimiter: RateLimiter | null = null;
let questListLimiter: RateLimiter | null = null;
let questDetailLimiter: RateLimiter | null = null;
let questAcceptLimiter: RateLimiter | null = null;
let questAbandonLimiter: RateLimiter | null = null;
let questCompleteLimiter: RateLimiter | null = null;
let globalSocketLimiter: RateLimiter | null = null;
let chatLimiter: RateLimiter | null = null;
let unknownMessageLimiter: RateLimiter | null = null;

/**
 * Get the pickup rate limiter (5/sec)
 * Limits item pickup requests to prevent spam-clicking ground items
 */
export function getPickupRateLimiter(): RateLimiter {
  if (!pickupLimiter) {
    pickupLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "inventory-pickup",
    });
  }
  return pickupLimiter;
}

/**
 * Get the move rate limiter (10/sec)
 * Limits inventory slot swap requests
 */
export function getMoveRateLimiter(): RateLimiter {
  if (!moveLimiter) {
    moveLimiter = createRateLimiter({
      maxPerSecond: 10,
      name: "inventory-move",
    });
  }
  return moveLimiter;
}

/**
 * Get the drop rate limiter (5/sec)
 * Limits item drop requests
 */
export function getDropRateLimiter(): RateLimiter {
  if (!dropLimiter) {
    dropLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "inventory-drop",
    });
  }
  return dropLimiter;
}

/**
 * Get the equip rate limiter (5/sec)
 * Limits equip/unequip requests
 */
export function getEquipRateLimiter(): RateLimiter {
  if (!equipLimiter) {
    equipLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "inventory-equip",
    });
  }
  return equipLimiter;
}

/**
 * Get the consumable rate limiter (3/sec)
 * Limits food/potion use requests - separate from equip to allow
 * OSRS-style PvP where players gear switch AND eat in same tick
 * Game logic already enforces 3-tick (1.8s) eat delay
 */
export function getConsumeRateLimiter(): RateLimiter {
  if (!consumeLimiter) {
    consumeLimiter = createRateLimiter({
      maxPerSecond: 3,
      name: "inventory-consume",
    });
  }
  return consumeLimiter;
}

/**
 * Get the tile movement rate limiter (15/sec)
 * Limits tile movement requests - allows burst clicking (OSRS allows rapid clicks)
 * but prevents spam attacks that could overwhelm the server
 */
export function getTileMovementRateLimiter(): RateLimiter {
  if (!tileMovementLimiter) {
    tileMovementLimiter = createRateLimiter({
      maxPerSecond: 15,
      name: "tile-movement",
    });
  }
  return tileMovementLimiter;
}

/**
 * Get the pathfinding rate limiter (15/sec)
 * Aligned with the tile movement limiter so rapid re-clicks are not silently
 * dropped now that moveRequest is processed immediately (no ActionQueue buffer).
 */
export function getPathfindRateLimiter(): RateLimiter {
  if (!pathfindLimiter) {
    pathfindLimiter = createRateLimiter({
      maxPerSecond: 15,
      name: "pathfinding",
    });
  }
  return pathfindLimiter;
}

/**
 * Get the combat rate limiter (3/sec)
 * Limits attack requests - OSRS tick is 600ms, so ~1.67 attacks/sec max
 * We allow 3/sec to be generous with client click behavior
 */
export function getCombatRateLimiter(): RateLimiter {
  if (!combatLimiter) {
    combatLimiter = createRateLimiter({
      maxPerSecond: 3,
      name: "combat-attack",
    });
  }
  return combatLimiter;
}

/**
 * Get the follow rate limiter (5/sec)
 * Limits follow player requests - more lenient than combat
 * Prevents spam-clicking follow on players
 */
export function getFollowRateLimiter(): RateLimiter {
  if (!followLimiter) {
    followLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "follow",
    });
  }
  return followLimiter;
}

/**
 * Get the coin pouch rate limiter (10/sec)
 * Limits coin pouch withdrawal requests
 */
export function getCoinPouchRateLimiter(): RateLimiter {
  if (!coinPouchLimiter) {
    coinPouchLimiter = createRateLimiter({
      maxPerSecond: 10,
      name: "coin-pouch",
    });
  }
  return coinPouchLimiter;
}

/**
 * Get the prayer rate limiter (5/sec)
 * Limits prayer toggle requests - matches PRAYER_TOGGLE_RATE_LIMIT
 * OSRS allows quick prayer switching but we prevent spam
 */
export function getPrayerRateLimiter(): RateLimiter {
  if (!prayerLimiter) {
    prayerLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "prayer-toggle",
    });
  }
  return prayerLimiter;
}

/**
 * Get the quest list rate limiter (5/sec)
 * Limits quest list fetches to prevent UI spam
 */
export function getQuestListRateLimiter(): RateLimiter {
  if (!questListLimiter) {
    questListLimiter = createRateLimiter({
      maxPerSecond: 5,
      name: "quest-list",
    });
  }
  return questListLimiter;
}

/**
 * Get the quest detail rate limiter (10/sec)
 * Limits quest detail fetches
 */
export function getQuestDetailRateLimiter(): RateLimiter {
  if (!questDetailLimiter) {
    questDetailLimiter = createRateLimiter({
      maxPerSecond: 10,
      name: "quest-detail",
    });
  }
  return questDetailLimiter;
}

/**
 * Get the quest accept rate limiter (3/sec)
 * Limits quest accept requests
 */
export function getQuestAcceptRateLimiter(): RateLimiter {
  if (!questAcceptLimiter) {
    questAcceptLimiter = createRateLimiter({
      maxPerSecond: 3,
      name: "quest-accept",
    });
  }
  return questAcceptLimiter;
}

/**
 * Get the quest abandon rate limiter (2/sec)
 * Limits quest abandon requests
 */
export function getQuestAbandonRateLimiter(): RateLimiter {
  if (!questAbandonLimiter) {
    questAbandonLimiter = createRateLimiter({
      maxPerSecond: 2,
      name: "quest-abandon",
    });
  }
  return questAbandonLimiter;
}

/**
 * Get the quest complete rate limiter (2/sec)
 * Limits quest completion requests
 */
export function getQuestCompleteRateLimiter(): RateLimiter {
  if (!questCompleteLimiter) {
    questCompleteLimiter = createRateLimiter({
      maxPerSecond: 2,
      name: "quest-complete",
    });
  }
  return questCompleteLimiter;
}

/**
 * Get the global socket rate limiter (100/sec)
 * CRITICAL SECURITY: Limits total messages per socket to prevent DoS attacks
 * Applied to ALL incoming WebSocket messages before handler dispatch
 */
export function getGlobalSocketRateLimiter(): RateLimiter {
  if (!globalSocketLimiter) {
    globalSocketLimiter = createRateLimiter({
      maxPerSecond: 100,
      name: "global-socket",
    });
  }
  return globalSocketLimiter;
}

/**
 * Get the chat rate limiter (2/sec)
 * Limits chat messages to prevent spam
 * 1 message per 500ms effectively
 */
export function getChatRateLimiter(): RateLimiter {
  if (!chatLimiter) {
    chatLimiter = createRateLimiter({
      maxPerSecond: 2,
      name: "chat",
    });
  }
  return chatLimiter;
}

/**
 * Get the unknown message rate limiter (10/sec)
 * Limits unhandled/unknown message types per socket to prevent log spam DoS
 */
export function getUnknownMessageRateLimiter(): RateLimiter {
  if (!unknownMessageLimiter) {
    unknownMessageLimiter = createRateLimiter({
      maxPerSecond: 10,
      name: "unknown-message",
    });
  }
  return unknownMessageLimiter;
}

/**
 * Destroy all singleton rate limiters
 * Call this during server shutdown
 */
export function destroyAllRateLimiters(): void {
  pickupLimiter?.destroy();
  moveLimiter?.destroy();
  dropLimiter?.destroy();
  equipLimiter?.destroy();
  consumeLimiter?.destroy();
  tileMovementLimiter?.destroy();
  pathfindLimiter?.destroy();
  combatLimiter?.destroy();
  followLimiter?.destroy();
  coinPouchLimiter?.destroy();
  prayerLimiter?.destroy();
  questListLimiter?.destroy();
  questDetailLimiter?.destroy();
  questAcceptLimiter?.destroy();
  questAbandonLimiter?.destroy();
  questCompleteLimiter?.destroy();
  globalSocketLimiter?.destroy();
  chatLimiter?.destroy();
  unknownMessageLimiter?.destroy();

  pickupLimiter = null;
  moveLimiter = null;
  dropLimiter = null;
  equipLimiter = null;
  consumeLimiter = null;
  tileMovementLimiter = null;
  pathfindLimiter = null;
  combatLimiter = null;
  followLimiter = null;
  coinPouchLimiter = null;
  prayerLimiter = null;
  questListLimiter = null;
  questDetailLimiter = null;
  questAcceptLimiter = null;
  questAbandonLimiter = null;
  questCompleteLimiter = null;
  globalSocketLimiter = null;
  chatLimiter = null;
  unknownMessageLimiter = null;
}
