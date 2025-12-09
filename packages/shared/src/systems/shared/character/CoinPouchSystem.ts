/**
 * CoinPouchSystem - Manages player coin balances (OSRS-style Money Pouch)
 *
 * Server-authoritative system that handles all coin operations:
 * - Adding coins (loot, store sales, trades)
 * - Removing coins (purchases, trades)
 * - Querying coin balances
 * - Persisting to database
 *
 * Coins are stored separately from inventory (like OSRS money pouch):
 * - Protected on death (coins stay with player)
 * - No slot usage
 * - Unlimited stacking
 *
 * @see {@link InventorySystem} for item management
 * @see {@link StoreSystem} for purchases
 * @see {@link BankingSystem} for deposits
 */

import { SystemBase } from "..";
import type { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import { Logger } from "../../../utils/Logger";
import {
  createPlayerID,
  isValidPlayerID,
  toPlayerID,
} from "../../../utils/IdentifierUtils";
import type { PlayerID } from "../../../types/core/identifiers";
import type { DatabaseSystem } from "../../../types/systems/system-interfaces";

/** Default starting coins for new players */
const DEFAULT_STARTING_COINS = 100;

/** Maximum coins a player can hold (prevent overflow) */
const MAX_COINS = 2147483647; // Max 32-bit signed integer (OSRS cap)

/**
 * CoinPouchSystem - Manages player coin balances
 *
 * Single Responsibility: Only handles coin state and operations.
 * Does NOT handle items, equipment, or other inventory concerns.
 */
export class CoinPouchSystem extends SystemBase {
  /** Coin balances per player */
  private coinBalances = new Map<PlayerID, number>();

  /** Players currently loading from database (prevents race conditions) */
  private loadingPlayers = new Set<string>();

  /** Players whose coins have been initialized */
  private initializedPlayers = new Set<string>();

  /** Pending persist timers (debounced saves) */
  private persistTimers = new Map<string, NodeJS.Timeout>();

  /** Auto-save interval handle */
  private autoSaveInterval?: NodeJS.Timeout;

  /** Balance verification interval handle */
  private verificationInterval?: NodeJS.Timeout;

  /** Auto-save interval in ms */
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  /** Balance verification interval in ms (5 minutes) */
  private readonly VERIFICATION_INTERVAL = 300000;

  constructor(world: World) {
    super(world, {
      name: "coin-pouch",
      dependencies: {
        required: [],
        optional: ["database"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Subscribe to player lifecycle events
    this.subscribe(
      EventType.PLAYER_REGISTERED,
      async (data: { playerId: string }) => {
        await this.initializePlayerCoins(data.playerId);
      },
    );

    this.subscribe(EventType.PLAYER_CLEANUP, (data: { playerId: string }) => {
      this.cleanupPlayerCoins(data.playerId);
    });

    // Subscribe to coin operation events
    this.subscribe<{ playerId: string; amount: number }>(
      EventType.INVENTORY_ADD_COINS,
      (data) => {
        this.addCoins(data.playerId, data.amount);
      },
    );

    this.subscribe(EventType.INVENTORY_REMOVE_COINS, (data) => {
      this.removeCoins(data.playerId, data.amount);
    });

    this.subscribe(
      EventType.INVENTORY_UPDATE_COINS,
      (data: { playerId: string; coins: number }) => {
        // Update coins sets absolute value (used for sync)
        this.setCoins(data.playerId, data.coins);
      },
    );

    Logger.system("CoinPouchSystem", "Initialized");
  }

  start(): void {
    // Start periodic auto-save and verification on server only
    if (this.world.isServer) {
      this.startAutoSave();
      this.startVerification();
    }
  }

  /**
   * Initialize coins for a player (load from DB or set defaults)
   */
  private async initializePlayerCoins(playerId: string): Promise<void> {
    if (!isValidPlayerID(playerId)) {
      Logger.systemError(
        "CoinPouchSystem",
        `Invalid player ID: "${playerId}"`,
        new Error(`Invalid player ID: "${playerId}"`),
      );
      return;
    }

    // Prevent race conditions during load
    if (this.loadingPlayers.has(playerId)) {
      return;
    }

    this.loadingPlayers.add(playerId);

    try {
      const db = this.getDatabase();
      let coins = DEFAULT_STARTING_COINS;

      if (db) {
        const playerRow = await db.getPlayerAsync(playerId);
        if (playerRow && typeof playerRow.coins === "number") {
          coins = playerRow.coins;
        }
      }

      const playerIdKey = createPlayerID(playerId);
      this.coinBalances.set(playerIdKey, coins);
      this.initializedPlayers.add(playerId);

      // Emit initialized event
      this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
        playerId,
        coins,
      });

      Logger.system(
        "CoinPouchSystem",
        `Initialized coins for ${playerId}: ${coins}`,
      );
    } finally {
      this.loadingPlayers.delete(playerId);
    }
  }

  /**
   * Cleanup coins when player disconnects
   */
  private cleanupPlayerCoins(playerId: string): void {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    // Persist before cleanup if on server
    if (this.world.isServer) {
      this.persistCoinsImmediate(playerId);
    }

    this.coinBalances.delete(playerIdKey);
    this.loadingPlayers.delete(playerId);
    this.initializedPlayers.delete(playerId);

    // Clear any pending persist timer
    const timer = this.persistTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.persistTimers.delete(playerId);
    }
  }

  /**
   * Add coins to a player's balance
   *
   * @param playerId - Player to add coins to
   * @param amount - Amount to add (must be positive)
   * @returns New balance, or -1 if failed
   */
  addCoins(playerId: string, amount: number): number {
    if (!isValidPlayerID(playerId)) {
      Logger.systemError(
        "CoinPouchSystem",
        `Cannot add coins: invalid player ID "${playerId}"`,
        new Error(`Invalid player ID: ${playerId}`),
      );
      return -1;
    }

    if (amount <= 0) {
      Logger.systemError(
        "CoinPouchSystem",
        `Cannot add coins: amount must be positive (got ${amount})`,
        new Error(`Invalid amount: ${amount}`),
      );
      return -1;
    }

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return -1;

    const currentBalance = this.coinBalances.get(playerIdKey) ?? 0;

    // Prevent overflow
    const newBalance = Math.min(currentBalance + amount, MAX_COINS);
    this.coinBalances.set(playerIdKey, newBalance);

    // Emit update event
    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId,
      coins: newBalance,
    });

    // Schedule database persist
    this.schedulePersist(playerId);

    Logger.system(
      "CoinPouchSystem",
      `Added ${amount} coins to ${playerId}: ${currentBalance} → ${newBalance}`,
    );

    return newBalance;
  }

  /**
   * Remove coins from a player's balance
   *
   * @param playerId - Player to remove coins from
   * @param amount - Amount to remove (must be positive)
   * @returns New balance, or -1 if failed (insufficient funds or invalid)
   */
  removeCoins(playerId: string, amount: number): number {
    if (!isValidPlayerID(playerId)) {
      Logger.systemError(
        "CoinPouchSystem",
        `Cannot remove coins: invalid player ID "${playerId}"`,
        new Error(`Invalid player ID: ${playerId}`),
      );
      return -1;
    }

    if (amount <= 0) {
      Logger.systemError(
        "CoinPouchSystem",
        `Cannot remove coins: amount must be positive (got ${amount})`,
        new Error(`Invalid amount: ${amount}`),
      );
      return -1;
    }

    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return -1;

    const currentBalance = this.coinBalances.get(playerIdKey) ?? 0;

    // Check sufficient funds
    if (currentBalance < amount) {
      Logger.system(
        "CoinPouchSystem",
        `Insufficient funds for ${playerId}: has ${currentBalance}, needs ${amount}`,
      );
      return -1;
    }

    const newBalance = currentBalance - amount;
    this.coinBalances.set(playerIdKey, newBalance);

    // Emit update event
    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId,
      coins: newBalance,
    });

    // Schedule database persist
    this.schedulePersist(playerId);

    Logger.system(
      "CoinPouchSystem",
      `Removed ${amount} coins from ${playerId}: ${currentBalance} → ${newBalance}`,
    );

    return newBalance;
  }

  /**
   * Set coins to an absolute value (used for sync/initialization)
   */
  private setCoins(playerId: string, coins: number): void {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return;

    const clampedCoins = Math.max(0, Math.min(coins, MAX_COINS));
    this.coinBalances.set(playerIdKey, clampedCoins);

    this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
      playerId,
      coins: clampedCoins,
    });

    this.schedulePersist(playerId);
  }

  /**
   * Get a player's coin balance
   *
   * @param playerId - Player to check
   * @returns Coin balance, or 0 if not found
   */
  getCoins(playerId: string): number {
    const playerIdKey = toPlayerID(playerId);
    if (!playerIdKey) return 0;
    return this.coinBalances.get(playerIdKey) ?? 0;
  }

  /**
   * Check if a player has at least a certain amount of coins
   *
   * @param playerId - Player to check
   * @param amount - Amount required
   * @returns true if player has sufficient coins
   */
  hasCoins(playerId: string, amount: number): boolean {
    return this.getCoins(playerId) >= amount;
  }

  /**
   * Check if coins are initialized for a player
   */
  isPlayerInitialized(playerId: string): boolean {
    if (this.loadingPlayers.has(playerId)) return false;
    if (this.initializedPlayers.has(playerId)) return true;
    const playerIdKey = toPlayerID(playerId);
    return playerIdKey ? this.coinBalances.has(playerIdKey) : false;
  }

  // === Database Persistence ===

  private getDatabase(): DatabaseSystem | null {
    return this.world.getSystem<DatabaseSystem>("database") || null;
  }

  private schedulePersist(playerId: string): void {
    const db = this.getDatabase();
    if (!db) return;

    // Clear existing timer
    const existing = this.persistTimers.get(playerId);
    if (existing) clearTimeout(existing);

    // Schedule new persist (debounced)
    const timer = setTimeout(() => {
      this.persistCoins(playerId);
    }, 300);

    this.persistTimers.set(playerId, timer);
  }

  private async persistCoins(playerId: string): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;

    try {
      const playerRow = await db.getPlayerAsync(playerId);
      if (!playerRow) return; // Only persist for existing players

      const coins = this.getCoins(playerId);
      db.savePlayer(playerId, { coins });
    } catch {
      // Silent fail for persistence errors
    }
  }

  private persistCoinsImmediate(playerId: string): void {
    const db = this.getDatabase();
    if (!db) return;

    // Clear pending timer
    const existing = this.persistTimers.get(playerId);
    if (existing) {
      clearTimeout(existing);
      this.persistTimers.delete(playerId);
    }

    // Sync persist
    db.getPlayerAsync(playerId)
      .then((row) => {
        if (row) {
          const coins = this.getCoins(playerId);
          db.savePlayer(playerId, { coins });
        }
      })
      .catch(() => {});
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL);
  }

  private async performAutoSave(): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;

    for (const playerId of this.coinBalances.keys()) {
      try {
        const playerRow = await db.getPlayerAsync(playerId);
        if (playerRow) {
          const coins = this.getCoins(playerId);
          db.savePlayer(playerId, { coins });
        }
      } catch {
        // Continue with other players
      }
    }
  }

  // === Balance Verification ===

  /**
   * Start periodic balance verification to detect and correct drift
   */
  private startVerification(): void {
    this.verificationInterval = setInterval(() => {
      this.verifyAllBalances();
    }, this.VERIFICATION_INTERVAL);
  }

  /**
   * Verify all player coin balances against database.
   * Auto-corrects any mismatches using database as source of truth.
   */
  private async verifyAllBalances(): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;

    let verified = 0;
    let corrected = 0;

    for (const [playerIdKey, memoryBalance] of this.coinBalances) {
      try {
        const playerId = playerIdKey as string;
        const playerRow = await db.getPlayerAsync(playerId);
        if (!playerRow) continue;

        const dbBalance = playerRow.coins ?? 0;

        if (memoryBalance !== dbBalance) {
          Logger.system(
            "CoinPouchSystem",
            `Balance mismatch for ${playerId}: memory=${memoryBalance}, db=${dbBalance}. Using DB value.`,
          );

          // Correct memory balance to match database
          this.coinBalances.set(playerIdKey, dbBalance);
          corrected++;

          // Notify player of correction
          this.emitTypedEvent(EventType.INVENTORY_COINS_UPDATED, {
            playerId,
            coins: dbBalance,
          });
        }
        verified++;
      } catch {
        // Continue with other players
      }
    }

    if (corrected > 0) {
      Logger.system(
        "CoinPouchSystem",
        `Verification complete: ${verified} verified, ${corrected} corrected`,
      );
    }
  }

  // === Cleanup ===

  /**
   * Async destroy - properly awaits all database saves before cleanup.
   * Call this for graceful shutdown to prevent data loss.
   */
  async destroyAsync(): Promise<void> {
    // Stop auto-save first
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }

    // Stop verification interval
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
      this.verificationInterval = undefined;
    }

    // Clear pending persist timers
    for (const timer of this.persistTimers.values()) {
      clearTimeout(timer);
    }
    this.persistTimers.clear();

    // Await all final saves before shutdown
    if (this.world.isServer) {
      const db = this.getDatabase();
      if (db) {
        const savePromises: Promise<void>[] = [];

        for (const playerId of this.coinBalances.keys()) {
          const savePromise = (async () => {
            const row = await db.getPlayerAsync(playerId);
            if (row) {
              const coins = this.getCoins(playerId);
              db.savePlayer(playerId, { coins });
            }
          })();

          savePromises.push(savePromise);
        }

        // Wait for all saves to complete (with error handling)
        const results = await Promise.allSettled(savePromises);
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          Logger.systemError(
            "CoinPouchSystem",
            `${failures.length} coin saves failed during shutdown`,
            new Error("Partial save failure on shutdown"),
          );
        }
      }
    }

    this.coinBalances.clear();
    this.loadingPlayers.clear();
    this.initializedPlayers.clear();

    super.destroy();
  }

  destroy(): void {
    // Fire-and-forget async cleanup (best effort for non-async callers)
    this.destroyAsync().catch((err) => {
      Logger.systemError(
        "CoinPouchSystem",
        "Error during async destroy",
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  }
}
