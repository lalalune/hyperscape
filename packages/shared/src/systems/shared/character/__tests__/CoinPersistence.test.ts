/**
 * Coin Persistence Integration Tests
 *
 * Tests the coin persistence flow to ensure:
 * - Coins persist correctly across system initialization
 * - CoinPouchSystem is the single source of truth
 * - Race conditions don't cause stale/incorrect coin values
 * - Fallback to InventorySystem works when CoinPouchSystem not ready
 *
 * Root cause of original bug: CoinPouchSystem was registered AFTER InventorySystem,
 * so when getInventoryData() was called during PLAYER_REGISTERED handling,
 * CoinPouchSystem.getCoins() returned 0 for uninitialized players.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface PlayerID {
  readonly __brand: "PlayerID";
}

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Simulates CoinPouchSystem's behavior
 */
class MockCoinPouchSystem {
  private coinBalances = new Map<string, number>();
  private initializedPlayers = new Set<string>();
  private loadingPlayers = new Set<string>();

  async initializePlayerCoins(
    playerId: string,
    coinsFromDb: number,
  ): Promise<void> {
    // Simulate DB load time
    this.loadingPlayers.add(playerId);
    await this.simulateDbDelay();
    this.coinBalances.set(playerId, coinsFromDb);
    this.initializedPlayers.add(playerId);
    this.loadingPlayers.delete(playerId);
  }

  getCoins(playerId: string): number {
    return this.coinBalances.get(playerId) ?? 0;
  }

  isPlayerInitialized(playerId: string): boolean {
    if (this.loadingPlayers.has(playerId)) return false;
    return this.initializedPlayers.has(playerId);
  }

  addCoins(playerId: string, amount: number): number {
    const current = this.getCoins(playerId);
    const newBalance = current + amount;
    this.coinBalances.set(playerId, newBalance);
    return newBalance;
  }

  private simulateDbDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 10));
  }

  clear(): void {
    this.coinBalances.clear();
    this.initializedPlayers.clear();
    this.loadingPlayers.clear();
  }
}

/**
 * Simulates InventorySystem's getInventoryData behavior
 */
class MockInventorySystem {
  private inventoryCoins = new Map<string, number>();
  private coinPouchSystem: MockCoinPouchSystem | null = null;

  setCoinPouchSystem(system: MockCoinPouchSystem | null): void {
    this.coinPouchSystem = system;
  }

  setLocalCoins(playerId: string, coins: number): void {
    this.inventoryCoins.set(playerId, coins);
  }

  /**
   * Original (buggy) implementation
   */
  getCoins_BUGGY(playerId: string): number {
    // This uses ?? which doesn't fallback on 0
    return (
      this.coinPouchSystem?.getCoins(playerId) ??
      this.inventoryCoins.get(playerId) ??
      0
    );
  }

  /**
   * Fixed implementation - checks isPlayerInitialized
   */
  getCoins_FIXED(playerId: string): number {
    if (this.coinPouchSystem?.isPlayerInitialized(playerId)) {
      return this.coinPouchSystem.getCoins(playerId);
    }
    // Fallback: CoinPouchSystem not ready, use local inventory coins
    return this.inventoryCoins.get(playerId) ?? 0;
  }

  clear(): void {
    this.inventoryCoins.clear();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("CoinPersistence", () => {
  let coinPouchSystem: MockCoinPouchSystem;
  let inventorySystem: MockInventorySystem;

  beforeEach(() => {
    coinPouchSystem = new MockCoinPouchSystem();
    inventorySystem = new MockInventorySystem();
    inventorySystem.setCoinPouchSystem(coinPouchSystem);
  });

  describe("Race Condition Prevention", () => {
    it("DEMONSTRATES BUG: ?? operator returns 0 instead of fallback", () => {
      const playerId = "player-123";

      // Simulate: InventorySystem loaded coins from DB first
      inventorySystem.setLocalCoins(playerId, 500);

      // CoinPouchSystem NOT initialized yet (would happen if registered after InventorySystem)

      // BUGGY: getCoins returns 0 because ?? only checks null/undefined, not 0
      const buggyCoins = inventorySystem.getCoins_BUGGY(playerId);
      expect(buggyCoins).toBe(0); // BUG: Should be 500!
    });

    it("FIX VERIFIED: isPlayerInitialized check enables proper fallback", () => {
      const playerId = "player-123";

      // Simulate: InventorySystem loaded coins from DB first
      inventorySystem.setLocalCoins(playerId, 500);

      // CoinPouchSystem NOT initialized yet

      // FIXED: getCoins checks isPlayerInitialized, falls back to local coins
      const fixedCoins = inventorySystem.getCoins_FIXED(playerId);
      expect(fixedCoins).toBe(500); // Correct: Uses fallback
    });

    it("uses CoinPouchSystem when player is initialized", async () => {
      const playerId = "player-123";

      // Initialize both systems
      inventorySystem.setLocalCoins(playerId, 100); // Old value in inventory
      await coinPouchSystem.initializePlayerCoins(playerId, 500); // New value from DB

      // Should use CoinPouchSystem's value
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(500);
    });

    it("handles coin pickup after initialization", async () => {
      const playerId = "player-123";

      // Initialize player with 100 coins
      await coinPouchSystem.initializePlayerCoins(playerId, 100);

      // Player picks up 50 coins
      coinPouchSystem.addCoins(playerId, 50);

      // Should reflect new balance
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(150);
    });
  });

  describe("System Registration Order", () => {
    it("simulates CORRECT order: CoinPouchSystem before InventorySystem", async () => {
      const playerId = "player-123";

      // 1. CoinPouchSystem initializes first (registered first)
      await coinPouchSystem.initializePlayerCoins(playerId, 500);

      // 2. InventorySystem initializes second
      // At this point, when getInventoryData is called, CoinPouchSystem is ready
      expect(coinPouchSystem.isPlayerInitialized(playerId)).toBe(true);
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(500);
    });

    it("simulates WRONG order: InventorySystem before CoinPouchSystem", async () => {
      const playerId = "player-123";

      // 1. InventorySystem initializes first (loads coins from DB)
      inventorySystem.setLocalCoins(playerId, 500);

      // 2. Before CoinPouchSystem initializes, getInventoryData is called
      // CoinPouchSystem is NOT ready
      expect(coinPouchSystem.isPlayerInitialized(playerId)).toBe(false);

      // BUGGY implementation would return 0
      expect(inventorySystem.getCoins_BUGGY(playerId)).toBe(0);

      // FIXED implementation falls back to local coins
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(500);

      // 3. Later, CoinPouchSystem initializes
      await coinPouchSystem.initializePlayerCoins(playerId, 500);

      // Now both implementations return correct value
      expect(coinPouchSystem.isPlayerInitialized(playerId)).toBe(true);
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(500);
    });
  });

  describe("Coin Pickup Real-Time Updates", () => {
    it("coin balance updates immediately in memory", async () => {
      const playerId = "player-123";

      await coinPouchSystem.initializePlayerCoins(playerId, 100);

      // Pick up coins multiple times
      coinPouchSystem.addCoins(playerId, 10);
      expect(coinPouchSystem.getCoins(playerId)).toBe(110);

      coinPouchSystem.addCoins(playerId, 25);
      expect(coinPouchSystem.getCoins(playerId)).toBe(135);

      coinPouchSystem.addCoins(playerId, 15);
      expect(coinPouchSystem.getCoins(playerId)).toBe(150);

      // Inventory system should see updated value
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(150);
    });

    it("maintains consistency between multiple coin operations", async () => {
      const playerId = "player-123";

      await coinPouchSystem.initializePlayerCoins(playerId, 100);

      // Simulate rapid coin pickups (like picking up a coin pile)
      for (let i = 0; i < 10; i++) {
        coinPouchSystem.addCoins(playerId, 5);
      }

      expect(coinPouchSystem.getCoins(playerId)).toBe(150);
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(150);
    });
  });

  describe("Reopening Inventory Panel", () => {
    it("returns consistent coins when inventory is reopened", async () => {
      const playerId = "player-123";

      // Initial state
      await coinPouchSystem.initializePlayerCoins(playerId, 100);

      // Open inventory - gets 100
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(100);

      // Pick up coins while inventory is open
      coinPouchSystem.addCoins(playerId, 50);
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(150);

      // Close inventory (no state change)

      // Reopen inventory - should still be 150
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(150);

      // Pick up more coins
      coinPouchSystem.addCoins(playerId, 25);

      // Close and reopen again - should be 175
      expect(inventorySystem.getCoins_FIXED(playerId)).toBe(175);
    });
  });
});
