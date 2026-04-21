/**
 * BettingPoolManager — Handles bet placement, pool aggregation, and claim creation
 *
 * Works with the DuelBettingBridge for market lifecycle and the solanaBets/solanaPayoutJobs
 * tables for persistence. Emits betting:pool:updated events on the World.
 */

import type { World } from "@hyperscape/shared";
import { eq, and, sql } from "drizzle-orm";
import { getDatabase } from "../../database/client.js";
import {
  solanaBets,
  solanaPayoutJobs,
  arenaRounds,
} from "../../database/schema.js";
import { Logger } from "../ServerNetwork/services";
import { randomUUID } from "node:crypto";

export interface BetPlacement {
  roundId: string;
  side: "A" | "B";
  amount: string; // string to preserve precision
  walletAddress: string;
}

export interface PoolState {
  roundId: string;
  sideATotal: string;
  sideBTotal: string;
  sideACount: number;
  sideBCount: number;
}

export interface BetRecord {
  id: string;
  roundId: string;
  side: string;
  amount: string;
  walletAddress: string;
  status: string;
  createdAt: number;
}

const MAX_BETS_BY_WALLET_LIMIT = 100;
const MAX_BETTING_LEADERBOARD_LIMIT = 100;
const MAX_BETS_PER_WALLET_PER_ROUND = 100;

export class BettingPoolManager {
  private readonly world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Place a bet on a duel market.
   */
  async placeBet(
    bet: BetPlacement,
  ): Promise<{ success: boolean; error?: string; betId?: string }> {
    const db = getDatabase();

    // Verify the round exists and is in betting phase
    const bridge = (
      this.world as World & {
        duelBettingBridge?: {
          getMarket(id: string): { status: string } | null;
        };
      }
    ).duelBettingBridge;
    const market = bridge?.getMarket(bet.roundId);

    if (!market) {
      return { success: false, error: "Market not found" };
    }

    if (market.status !== "betting") {
      return {
        success: false,
        error: `Market is ${market.status}, betting is closed`,
      };
    }

    if (!isValidPositiveDecimalAmount(bet.amount)) {
      return { success: false, error: "Invalid bet amount" };
    }

    if (!isValidSolanaWalletAddress(bet.walletAddress)) {
      return { success: false, error: "Invalid wallet address" };
    }

    const betId = randomUUID();
    try {
      const insertResult = await db.transaction(async (tx) => {
        const lockedRounds = await tx.execute<{
          id: string;
          bettingClosesAt: number;
          duelEndsAt: number | null;
          winnerId: string | null;
        }>(
          sql`
            SELECT
              id,
              "bettingClosesAt",
              "duelEndsAt",
              "winnerId"
            FROM arena_rounds
            WHERE id = ${bet.roundId}
            FOR UPDATE
          `,
        );
        const round = lockedRounds.rows[0];
        if (!round) {
          return { success: false, error: "Round not found" } as const;
        }
        if (
          round.bettingClosesAt <= Date.now() ||
          round.duelEndsAt !== null ||
          round.winnerId !== null
        ) {
          return {
            success: false,
            error: "Market is locked, betting is closed",
          } as const;
        }

        // The round row lock above serializes market-close checks for this
        // round. This per-wallet xact lock makes the bet-count invariant
        // explicit too: concurrent requests for the same wallet/round cannot
        // both count N and insert N+1.
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtext(${bet.roundId}),
            hashtext(${bet.walletAddress})
          )
        `);

        const existingBetCountRows = await tx
          .select({
            count: sql<number>`COUNT(*)::INT`,
          })
          .from(solanaBets)
          .where(
            and(
              eq(solanaBets.roundId, bet.roundId),
              eq(solanaBets.bettorWallet, bet.walletAddress),
              eq(solanaBets.status, "CONFIRMED"),
            ),
          );
        const existingBetCount = Number(existingBetCountRows[0]?.count ?? 0);
        if (existingBetCount >= MAX_BETS_PER_WALLET_PER_ROUND) {
          return {
            success: false,
            error: "Too many bets for this wallet on this round",
          } as const;
        }

        await tx.insert(solanaBets).values({
          id: betId,
          roundId: bet.roundId,
          bettorWallet: bet.walletAddress,
          side: bet.side,
          sourceAsset: "GOLD",
          sourceAmount: bet.amount,
          goldAmount: bet.amount,
          status: "CONFIRMED",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return { success: true } as const;
      });
      if (!insertResult.success) {
        return { success: false, error: insertResult.error };
      }
    } catch (err) {
      Logger.error(
        "BettingPoolManager",
        "Failed to insert bet",
        err instanceof Error ? err : null,
        {
          roundId: bet.roundId,
          wallet: redactWalletAddress(bet.walletAddress),
        },
      );
      return { success: false, error: "Database error" };
    }

    // Emit pool update
    const pool = await this.getPool(bet.roundId);
    if (pool) {
      this.world.emit("betting:pool:updated", {
        roundId: bet.roundId,
        sideATotal: pool.sideATotal,
        sideBTotal: pool.sideBTotal,
        sideACount: pool.sideACount,
        sideBCount: pool.sideBCount,
      });
    }

    Logger.info("BettingPoolManager", "Bet placed", {
      betId,
      roundId: bet.roundId,
      side: bet.side,
      amount: bet.amount,
      wallet: redactWalletAddress(bet.walletAddress),
    });

    return { success: true, betId };
  }

  /**
   * Get aggregated pool totals for a round.
   */
  async getPool(roundId: string): Promise<PoolState | null> {
    const db = getDatabase();

    try {
      const result = await db
        .select({
          side: solanaBets.side,
          total: sql<string>`COALESCE(SUM(CAST(${solanaBets.goldAmount} AS NUMERIC)), 0)::TEXT`,
          count: sql<number>`COUNT(*)::INT`,
        })
        .from(solanaBets)
        .where(
          and(
            eq(solanaBets.roundId, roundId),
            eq(solanaBets.status, "CONFIRMED"),
          ),
        )
        .groupBy(solanaBets.side);

      const pool: PoolState = {
        roundId,
        sideATotal: "0",
        sideBTotal: "0",
        sideACount: 0,
        sideBCount: 0,
      };

      for (const row of result) {
        if (row.side === "A") {
          pool.sideATotal = row.total;
          pool.sideACount = row.count;
        } else if (row.side === "B") {
          pool.sideBTotal = row.total;
          pool.sideBCount = row.count;
        }
      }

      return pool;
    } catch (err) {
      Logger.error(
        "BettingPoolManager",
        "Failed to get pool",
        err instanceof Error ? err : null,
        { roundId },
      );
      return null;
    }
  }

  /**
   * Get bet history for a wallet.
   */
  async getBetsByWallet(
    walletAddress: string,
    limit = 50,
  ): Promise<BetRecord[]> {
    const db = getDatabase();
    const boundedLimit = Math.max(
      1,
      Math.min(Math.trunc(limit), MAX_BETS_BY_WALLET_LIMIT),
    );

    try {
      const rows = await db
        .select({
          id: solanaBets.id,
          roundId: solanaBets.roundId,
          side: solanaBets.side,
          amount: solanaBets.goldAmount,
          walletAddress: solanaBets.bettorWallet,
          status: solanaBets.status,
          createdAt: solanaBets.createdAt,
        })
        .from(solanaBets)
        .where(eq(solanaBets.bettorWallet, walletAddress))
        .orderBy(sql`${solanaBets.createdAt} DESC`)
        .limit(boundedLimit);

      return rows;
    } catch (err) {
      Logger.error(
        "BettingPoolManager",
        "Failed to get bets by wallet",
        err instanceof Error ? err : null,
        { wallet: redactWalletAddress(walletAddress) },
      );
      return [];
    }
  }

  /**
   * Create a claim/payout job for a winning bettor.
   */
  async createClaimJob(
    roundId: string,
    walletAddress: string,
  ): Promise<{ success: boolean; error?: string; jobId?: string }> {
    const db = getDatabase();

    const jobId = randomUUID();
    try {
      const result = await db.transaction(async (tx) => {
        // pg_try_advisory_xact_lock returns immediately with false if another
        // transaction holds the lock, instead of blocking. If a concurrent
        // claim for the same (round, wallet) pair hangs mid-transaction, the
        // original pg_advisory_xact_lock would queue everyone behind it —
        // that's an easy DoS vector on the payout path. Returning a conflict
        // error lets the caller retry.
        const lockRows = await tx.execute<{ acquired: boolean }>(sql`
          SELECT pg_try_advisory_xact_lock(
            hashtext(${roundId}),
            hashtext(${walletAddress})
          ) AS acquired
        `);
        if (!lockRows.rows[0]?.acquired) {
          return {
            success: false,
            error: "A concurrent claim is in progress; retry shortly",
          } as const;
        }

        const lockedRounds = await tx.execute<{
          id: string;
          winnerId: string | null;
          agentAId: string;
          agentBId: string;
        }>(
          sql`
            SELECT
              id,
              "winnerId",
              "agentAId",
              "agentBId"
            FROM arena_rounds
            WHERE id = ${roundId}
            FOR UPDATE
          `,
        );
        const round = lockedRounds.rows[0];
        if (!round) {
          return { success: false, error: "Round not found" } as const;
        }
        if (!round.winnerId) {
          return {
            success: false,
            error: "Round has not resolved yet",
          } as const;
        }

        const winningSide =
          round.winnerId === round.agentAId
            ? "A"
            : round.winnerId === round.agentBId
              ? "B"
              : null;
        if (!winningSide) {
          return {
            success: false,
            error: "Round winner does not match either bettor side",
          } as const;
        }

        const bets = await tx
          .select()
          .from(solanaBets)
          .where(
            and(
              eq(solanaBets.roundId, roundId),
              eq(solanaBets.bettorWallet, walletAddress),
              eq(solanaBets.status, "CONFIRMED"),
            ),
          );

        if (bets.length === 0) {
          return {
            success: false,
            error: "No confirmed bet found for this round",
          } as const;
        }

        const hasWinningBet = bets.some((bet) => bet.side === winningSide);
        if (!hasWinningBet) {
          return {
            success: false,
            error: "No winning bet found for this round",
          } as const;
        }

        // Deliberately status-blind: any payout job for this
        // (round, wallet) pair is the idempotency record, including
        // READY_FOR_PAYOUT / FAILED rows. Narrowing this by status would allow
        // duplicate claim jobs unless a database unique constraint is added.
        const existing = await tx
          .select()
          .from(solanaPayoutJobs)
          .where(
            and(
              eq(solanaPayoutJobs.roundId, roundId),
              eq(solanaPayoutJobs.bettorWallet, walletAddress),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          return { success: true, jobId: existing[0].id } as const;
        }

        await tx.insert(solanaPayoutJobs).values({
          id: jobId,
          roundId,
          bettorWallet: walletAddress,
          status: "PENDING",
          attempts: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return { success: true, jobId } as const;
      });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      Logger.info("BettingPoolManager", "Claim job created", {
        jobId: result.jobId,
        roundId,
        wallet: redactWalletAddress(walletAddress),
      });
      return { success: true, jobId: result.jobId };
    } catch (err) {
      Logger.error(
        "BettingPoolManager",
        "Failed to create payout job",
        err instanceof Error ? err : null,
        { roundId, wallet: redactWalletAddress(walletAddress) },
      );
      return { success: false, error: "Database error" };
    }
  }

  /**
   * Get leaderboard — top bettors by total winnings.
   */
  async getLeaderboard(
    limit = 20,
  ): Promise<
    Array<{ wallet: string; totalBets: number; totalWagered: string }>
  > {
    const db = getDatabase();
    const boundedLimit = Math.max(
      1,
      Math.min(Math.trunc(limit), MAX_BETTING_LEADERBOARD_LIMIT),
    );

    try {
      const rows = await db
        .select({
          wallet: solanaBets.bettorWallet,
          totalBets: sql<number>`COUNT(*)::INT`,
          totalWagered: sql<string>`COALESCE(SUM(CAST(${solanaBets.goldAmount} AS NUMERIC)), 0)::TEXT`,
        })
        .from(solanaBets)
        .where(eq(solanaBets.status, "CONFIRMED"))
        .groupBy(solanaBets.bettorWallet)
        .orderBy(sql`SUM(CAST(${solanaBets.goldAmount} AS NUMERIC)) DESC`)
        .limit(boundedLimit);

      return rows;
    } catch (err) {
      Logger.error(
        "BettingPoolManager",
        "Failed to get leaderboard",
        err instanceof Error ? err : null,
      );
      return [];
    }
  }
}

function isValidSolanaWalletAddress(walletAddress: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress.trim());
}

// Integer portion capped at 18 digits (~10^18, covers lamports/gwei scale),
// fractional capped at 8 digits. Unlimited precision previously admitted
// strings like "1.123456789012345678901234567890" that could exacerbate
// rounding errors in NUMERIC SUM aggregation and on-chain serialization.
const BET_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,8})?$/;

function isValidPositiveDecimalAmount(amount: string): boolean {
  const normalized = amount.trim();
  if (!BET_AMOUNT_PATTERN.test(normalized)) {
    return false;
  }
  return !/^0+(?:\.0+)?$/.test(normalized);
}

/** @internal Pure helpers exposed for financial input-validation tests. */
export const __bettingPoolManagerTestInternals = {
  MAX_BETS_PER_WALLET_PER_ROUND,
  isValidPositiveDecimalAmount,
  isValidSolanaWalletAddress,
};

export function redactWalletAddress(walletAddress: string): string {
  const trimmed = walletAddress.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}
