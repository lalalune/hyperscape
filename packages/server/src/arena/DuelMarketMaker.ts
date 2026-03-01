/**
 * DuelMarketMaker - Integrated market maker for streaming duels
 *
 * Runs inside hyperscape server, triggered by duel events.
 *
 * Responsibilities:
 * 1. Create oracle round when duel cycle starts
 * 2. Seed initial liquidity from fee wallet
 * 3. Lock market before fight phase
 * 4. Report outcome and resolve when duel completes
 * 5. Recycle collected fees into next market
 */

import type { World } from "@hyperscape/shared";
import { createHash } from "node:crypto";
import { Logger } from "../systems/ServerNetwork/services/Logger.js";

// ============================================================================
// Types
// ============================================================================

interface SolanaArenaOperatorInterface {
  isEnabled(): boolean;
  getCustodyWallet?(): string | null;
  initRound(
    roundSeedHex: string,
    bettingClosesAtMs: number,
  ): Promise<{
    closeSlot: number;
    initOracleSignature: string | null;
    initMarketSignature: string | null;
  } | null>;
  lockMarket(roundSeedHex: string): Promise<string | null>;
  reportAndResolve(params: {
    roundSeedHex: string;
    winnerSide: "A" | "B";
    resultHashHex: string;
    metadataUri: string;
  }): Promise<{
    reportSignature: string | null;
    resolveSignature: string | null;
  } | null>;
  placeBetFor?(params: {
    roundSeedHex: string;
    bettorWallet: string;
    side: "A" | "B";
    amountGoldBaseUnits: bigint;
  }): Promise<string | null>;
}

interface MarketState {
  cycleId: string;
  roundSeedHex: string;
  agent1Id: string;
  agent2Id: string;
  createdAt: number;
  bettingClosesAt: number;
  status: "betting" | "locked" | "resolved";
  liquiditySeeded: boolean;
}

// ============================================================================
// DuelMarketMaker Class
// ============================================================================

export class DuelMarketMaker {
  private solanaOperator: SolanaArenaOperatorInterface | null = null;
  private readonly seedAmountGold: number;
  private activeMarkets: Map<string, MarketState> = new Map();

  /** Event listeners for cleanup */
  private eventListeners: Array<{
    event: string;
    fn: (...args: unknown[]) => void;
  }> = [];

  constructor(
    private world: World,
    seedAmountGold: number = 10,
  ) {
    this.seedAmountGold = seedAmountGold;
  }

  private toGoldBaseUnits(amountGold: number): bigint {
    if (!Number.isFinite(amountGold) || amountGold <= 0) return 0n;
    return BigInt(Math.max(1, Math.round(amountGold * 1_000_000)));
  }

  /**
   * Initialize the market maker
   */
  async init(): Promise<void> {
    // Get operator from world
    this.solanaOperator =
      (
        this.world as unknown as {
          solanaArenaOperator?: SolanaArenaOperatorInterface;
        }
      ).solanaArenaOperator ?? null;

    if (!this.solanaOperator?.isEnabled()) {
      Logger.info(
        "DuelMarketMaker",
        "Solana operator not available or not enabled, market making disabled",
      );
      return;
    }

    // Listen for streaming duel events
    const onAnnouncementStart = (payload: unknown) => {
      this.onAnnouncementStart(payload).catch((err) => {
        Logger.warn("DuelMarketMaker", `Error in onAnnouncementStart: ${err}`);
      });
    };
    this.world.on("streaming:announcement:start", onAnnouncementStart);
    this.eventListeners.push({
      event: "streaming:announcement:start",
      fn: onAnnouncementStart,
    });

    const onFightStart = (payload: unknown) => {
      this.onFightStart(payload).catch((err) => {
        Logger.warn("DuelMarketMaker", `Error in onFightStart: ${err}`);
      });
    };
    this.world.on("streaming:fight:start", onFightStart);
    this.eventListeners.push({
      event: "streaming:fight:start",
      fn: onFightStart,
    });

    const onResolutionEnd = (payload: unknown) => {
      this.onResolutionEnd(payload).catch((err) => {
        Logger.warn("DuelMarketMaker", `Error in onResolutionEnd: ${err}`);
      });
    };
    this.world.on("streaming:resolution:end", onResolutionEnd);
    this.eventListeners.push({
      event: "streaming:resolution:end",
      fn: onResolutionEnd,
    });

    // Also listen for duel:completed in case resolution happens early
    const onDuelCompleted = (payload: unknown) => {
      this.onDuelCompleted(payload).catch((err) => {
        Logger.warn("DuelMarketMaker", `Error in onDuelCompleted: ${err}`);
      });
    };
    this.world.on("duel:completed", onDuelCompleted);
    this.eventListeners.push({
      event: "duel:completed",
      fn: onDuelCompleted,
    });

    Logger.info(
      "DuelMarketMaker",
      `Initialized with seed amount: ${this.seedAmountGold} GOLD`,
    );
  }

  /**
   * Destroy the market maker and cleanup
   */
  destroy(): void {
    for (const { event, fn } of this.eventListeners) {
      this.world.off(event, fn);
    }
    this.eventListeners = [];
    this.activeMarkets.clear();
    Logger.info("DuelMarketMaker", "Market maker destroyed");
  }

  /**
   * Handle announcement start - create market
   */
  private async onAnnouncementStart(payload: unknown): Promise<void> {
    if (!this.solanaOperator?.isEnabled()) return;

    const data = payload as {
      cycleId?: string;
      agent1Id?: string;
      agent2Id?: string;
      bettingClosesAt?: number;
      duration?: number;
      startedAt?: number;
      agent1?: { characterId?: string; id?: string };
      agent2?: { characterId?: string; id?: string };
    };

    const cycleId = data.cycleId;
    const agent1Id =
      data.agent1Id ?? data.agent1?.characterId ?? data.agent1?.id;
    const agent2Id =
      data.agent2Id ?? data.agent2?.characterId ?? data.agent2?.id;

    if (!cycleId || !agent1Id || !agent2Id) {
      Logger.warn("DuelMarketMaker", "Invalid announcement payload", data);
      return;
    }

    const roundSeedHex = this.generateRoundSeed(cycleId);
    const safeDurationMs =
      typeof data.duration === "number" && Number.isFinite(data.duration)
        ? Math.max(5_000, data.duration)
        : null;
    const startedAt =
      typeof data.startedAt === "number" && Number.isFinite(data.startedAt)
        ? data.startedAt
        : Date.now();
    const bettingClosesAt =
      data.bettingClosesAt ??
      (safeDurationMs
        ? startedAt + safeDurationMs
        : Date.now() + 5 * 60 * 1000);

    // Create market state
    const marketState: MarketState = {
      cycleId,
      roundSeedHex,
      agent1Id,
      agent2Id,
      createdAt: Date.now(),
      bettingClosesAt,
      status: "betting",
      liquiditySeeded: false,
    };
    this.activeMarkets.set(cycleId, marketState);

    // Create oracle round and market on-chain
    try {
      const result = await this.solanaOperator.initRound(
        roundSeedHex,
        bettingClosesAt,
      );

      if (result) {
        Logger.info("DuelMarketMaker", "Market created for cycle", {
          cycleId,
          closeSlot: result.closeSlot,
          oracleSig: result.initOracleSignature?.slice(0, 16),
          marketSig: result.initMarketSignature?.slice(0, 16),
        });

        // Schedule liquidity seeding after 10 seconds if no bets placed
        setTimeout(() => {
          this.seedLiquidityIfEmpty(cycleId, roundSeedHex).catch((err) => {
            Logger.warn("DuelMarketMaker", `Error seeding liquidity: ${err}`);
          });
        }, 10000);
      } else {
        this.activeMarkets.delete(cycleId);
      }
    } catch (error) {
      Logger.warn(
        "DuelMarketMaker",
        `Failed to create on-chain market: ${error}`,
      );
      this.activeMarkets.delete(cycleId);
    }
  }

  /**
   * Handle fight start - lock market
   */
  private async onFightStart(payload: unknown): Promise<void> {
    if (!this.solanaOperator?.isEnabled()) return;

    const data = payload as { cycleId?: string };
    if (!data.cycleId) return;

    const market = this.activeMarkets.get(data.cycleId);
    if (!market || market.status !== "betting") return;

    market.status = "locked";

    try {
      const sig = await this.solanaOperator.lockMarket(market.roundSeedHex);
      if (sig) {
        Logger.info("DuelMarketMaker", "Market locked for cycle", {
          cycleId: data.cycleId,
          signature: sig.slice(0, 16),
        });
      }
    } catch (error) {
      Logger.warn(
        "DuelMarketMaker",
        `Failed to lock on-chain market: ${error}`,
      );
    }
  }

  /**
   * Handle resolution end - resolve market
   */
  private async onResolutionEnd(payload: unknown): Promise<void> {
    if (!this.solanaOperator?.isEnabled()) return;

    const data = payload as {
      cycleId?: string;
      winnerId?: string;
    };

    if (!data.cycleId || !data.winnerId) return;

    await this.resolveMarket(data.cycleId, data.winnerId);
  }

  /**
   * Handle early duel completion
   */
  private async onDuelCompleted(payload: unknown): Promise<void> {
    if (!this.solanaOperator?.isEnabled()) return;

    const data = payload as {
      winnerId?: string;
      loserId?: string;
    };

    if (!data.winnerId) return;

    // Find the market for this duel
    for (const [cycleId, market] of this.activeMarkets) {
      if (
        (market.agent1Id === data.winnerId ||
          market.agent2Id === data.winnerId) &&
        market.status !== "resolved"
      ) {
        await this.resolveMarket(cycleId, data.winnerId);
        break;
      }
    }
  }

  /**
   * Resolve market with winner
   */
  private async resolveMarket(
    cycleId: string,
    winnerId: string,
  ): Promise<void> {
    const market = this.activeMarkets.get(cycleId);
    if (!market || market.status === "resolved") return;

    market.status = "resolved";

    // Determine winner side (A = agent1, B = agent2)
    const winnerSide: "A" | "B" = winnerId === market.agent1Id ? "A" : "B";

    const resultHashHex = this.generateResultHash(cycleId, winnerId);
    const metadataUri = `https://hyperscape.game/api/duels/${cycleId}`;

    try {
      const result = await this.solanaOperator!.reportAndResolve({
        roundSeedHex: market.roundSeedHex,
        winnerSide,
        resultHashHex,
        metadataUri,
      });

      if (result) {
        Logger.info("DuelMarketMaker", "Market resolved", {
          cycleId,
          winnerSide,
          reportSig: result.reportSignature?.slice(0, 16),
          resolveSig: result.resolveSignature?.slice(0, 16),
        });
      }
    } catch (error) {
      Logger.warn(
        "DuelMarketMaker",
        `Failed to resolve on-chain market: ${error}`,
      );
    }

    // Clean up market state after a short delay (reduced from 60s to 10s
    // to prevent unbounded growth during rapid duel cycles)
    setTimeout(() => {
      this.activeMarkets.delete(cycleId);
    }, 10_000);

    // Safety cap: if too many markets accumulated (e.g. timers delayed by
    // event loop congestion), prune resolved entries immediately.
    if (this.activeMarkets.size > 10) {
      for (const [oldCycleId, oldMarket] of this.activeMarkets) {
        if (oldMarket.status === "resolved" && oldCycleId !== cycleId) {
          this.activeMarkets.delete(oldCycleId);
        }
        if (this.activeMarkets.size <= 10) break;
      }
    }
  }

  /**
   * Seed liquidity if market has no bets
   *
   * CRITICAL: Ensures markets always have liquidity for betting.
   * Called automatically before locking phase.
   */
  private async seedLiquidityIfEmpty(
    cycleId: string,
    roundSeedHex: string,
  ): Promise<void> {
    const market = this.activeMarkets.get(cycleId);
    if (!market || market.status !== "betting" || market.liquiditySeeded)
      return;

    // Check if Solana operator is available
    if (!this.solanaOperator?.isEnabled()) {
      Logger.warn(
        "DuelMarketMaker",
        `Cannot seed liquidity for ${cycleId}: Solana operator not enabled`,
      );
      return;
    }

    try {
      if (
        !this.solanaOperator.placeBetFor ||
        !this.solanaOperator.getCustodyWallet
      ) {
        Logger.warn(
          "DuelMarketMaker",
          `Cannot seed liquidity: Solana operator missing placeBetFor/getCustodyWallet`,
        );
        return;
      }

      const keeperWallet = this.solanaOperator.getCustodyWallet();
      if (!keeperWallet) {
        Logger.warn(
          "DuelMarketMaker",
          `Cannot seed liquidity: keeper wallet unavailable`,
        );
        return;
      }

      const amountGoldBaseUnits = this.toGoldBaseUnits(this.seedAmountGold);
      if (amountGoldBaseUnits <= 0n) {
        Logger.warn(
          "DuelMarketMaker",
          `Cannot seed liquidity: MARKET_MAKER_SEED_GOLD must be > 0`,
        );
        return;
      }

      // Log liquidity seeding attempt
      Logger.info(
        "DuelMarketMaker",
        `Seeding ${this.seedAmountGold} GOLD on each side for cycle ${cycleId} (market: ${roundSeedHex.slice(0, 16)}...)`,
      );

      const [betASignature, betBSignature] = await Promise.all([
        this.solanaOperator.placeBetFor({
          roundSeedHex,
          bettorWallet: keeperWallet,
          side: "A",
          amountGoldBaseUnits,
        }),
        this.solanaOperator.placeBetFor({
          roundSeedHex,
          bettorWallet: keeperWallet,
          side: "B",
          amountGoldBaseUnits,
        }),
      ]);

      market.liquiditySeeded = true;

      Logger.info("DuelMarketMaker", "Liquidity seeded successfully", {
        cycleId,
        keeperWallet,
        amountGoldBaseUnits: amountGoldBaseUnits.toString(),
        sideASignature: betASignature,
        sideBSignature: betBSignature,
      });
    } catch (err) {
      Logger.error(
        "DuelMarketMaker",
        `Failed to seed liquidity for ${cycleId}: ${err}`,
      );
    }
  }

  /**
   * Generate a 32-byte round seed from cycle ID
   */
  private generateRoundSeed(cycleId: string): string {
    const hash = createHash("sha256")
      .update(`hyperscape:duel:${cycleId}`)
      .digest();
    return hash.toString("hex");
  }

  /**
   * Generate result hash for on-chain verification
   */
  private generateResultHash(cycleId: string, winnerId: string): string {
    const hash = createHash("sha256")
      .update(`hyperscape:result:${cycleId}:${winnerId}`)
      .digest();
    return hash.toString("hex");
  }

  /**
   * Get active markets (for API/debugging)
   */
  getActiveMarkets(): MarketState[] {
    return Array.from(this.activeMarkets.values());
  }
}

// ============================================================================
// Singleton Accessor
// ============================================================================

let marketMakerInstance: DuelMarketMaker | null = null;

/** Store the DuelMarketMaker singleton for shutdown access */
export function setDuelMarketMaker(instance: DuelMarketMaker | null): void {
  marketMakerInstance = instance;
}

/** Get the DuelMarketMaker singleton (may be null if not enabled) */
export function getDuelMarketMaker(): DuelMarketMaker | null {
  return marketMakerInstance;
}

export default DuelMarketMaker;
