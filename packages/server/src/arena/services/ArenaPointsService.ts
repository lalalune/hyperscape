import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import * as schema from "../../database/schema.js";
import type { ArenaContext } from "../ArenaContext.js";
import {
  normalizeWallet,
  normalizeFeeChain,
  isLikelySolanaWallet,
  nowMs,
} from "../arena-utils.js";
import {
  parseDecimalToBaseUnits,
  formatBaseUnitsToDecimal,
} from "../amounts.js";
import type {
  ArenaSide,
  ArenaFeeChain,
  PointsEntry,
  LeaderboardEntry,
  GoldMultiplierInfo,
  LiveArenaRound,
  GoldPosition,
} from "../types.js";
import { EvmTransactionInspector } from "./EvmTransactionInspector.js";

// ---------------------------------------------------------------------------
// Dependency interfaces — use these instead of importing concrete classes to
// avoid circular dependency issues between sub-services.
// ---------------------------------------------------------------------------

interface StakingOps {
  fetchGoldPositionForWallet(wallet: string): Promise<GoldPosition>;
  accrueStakingPointsIfDue(
    wallet: string,
    position?: GoldPosition,
  ): Promise<void>;
  computeGoldMultiplier(goldBalance: number, holdDays: number): number;
}

interface WalletOps {
  listLinkedWallets(wallet: string): Promise<string[]>;
  listIdentityWallets(wallet: string): Promise<string[]>;
  findReferralMappingForWalletNetwork(wallet: string): Promise<{
    id: number;
    inviteCode: string;
    inviterWallet: string;
    invitedWallet: string;
    firstBetId: string | null;
  } | null>;
}

// ---------------------------------------------------------------------------
// ArenaPointsService
// ---------------------------------------------------------------------------

export class ArenaPointsService {
  private readonly ctx: ArenaContext;
  private readonly stakingOps: StakingOps;
  private readonly walletOps: WalletOps;
  private readonly evmInspector: EvmTransactionInspector;

  // ---- Static constants ---------------------------------------------------

  private static readonly GOLD_DECIMALS = 6;
  private static readonly REFERRAL_FEE_POOL_BPS = 100;
  private static readonly REFERRAL_FEE_SHARE_BPS = 1_000;
  private static readonly SIGNUP_BONUS_REFERRER = 50;
  private static readonly SIGNUP_BONUS_REFEREE = 25;
  private static readonly WIN_BONUS_MULTIPLIER = 2;
  private static readonly REFERRAL_WIN_SHARE = 0.1;
  private static readonly SIGNUP_BONUS_PENDING_EXPIRY_MS =
    30 * 24 * 60 * 60 * 1000; // 30 days

  /** GOLD thresholds for multiplier tiers (in human-readable units) */
  private static readonly GOLD_TIER_0 = 1_000;
  private static readonly GOLD_TIER_1 = 100_000;
  private static readonly GOLD_TIER_2 = 1_000_000;
  private static readonly GOLD_HOLD_DAYS_BONUS = 10;

  constructor(
    ctx: ArenaContext,
    stakingOps: StakingOps,
    walletOps: WalletOps,
    evmInspector: EvmTransactionInspector,
  ) {
    this.ctx = ctx;
    this.stakingOps = stakingOps;
    this.walletOps = walletOps;
    this.evmInspector = evmInspector;
  }

  // ==========================================================================
  // Points Award Methods
  // ==========================================================================

  /**
   * Award points for a recorded bet. Wrapped in a transaction to ensure
   * arena_points + arena_referral_points + ledger entries are atomic.
   * On failure, enqueues to arena_failed_awards for retry.
   */
  public async awardPoints(params: {
    wallet: string;
    roundId: string | null;
    roundSeedHex: string | null;
    betId: string;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    goldAmount: string;
    txSignature: string | null;
    side: "A" | "B";
    verifiedForPoints: boolean;
    chain?: ArenaFeeChain;
    referral: { inviteCode: string; inviterWallet: string } | null;
  }): Promise<void> {
    const verifiedGoldAmount =
      await this.resolveVerifiedGoldAmountForPoints(params);
    if (!verifiedGoldAmount) {
      console.warn(
        `[ArenaService] Skipping points for bet ${params.betId}: missing verified bet evidence`,
      );
      return;
    }

    const db = this.ctx.getDb();
    if (!db) return;

    const amount = Number(verifiedGoldAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const basePoints = Math.max(1, Math.round(amount * 0.001));

    const position = await this.stakingOps.fetchGoldPositionForWallet(
      params.wallet,
    );
    await this.stakingOps.accrueStakingPointsIfDue(params.wallet, position);

    const multiplier = this.stakingOps.computeGoldMultiplier(
      position.goldBalance,
      position.goldHoldDays,
    );
    const totalPoints = basePoints * multiplier;

    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.arenaPoints).values({
          wallet: params.wallet,
          roundId: params.roundId,
          betId: params.betId,
          side: params.side,
          basePoints,
          multiplier,
          totalPoints,
          goldBalance: position.goldBalance.toString(),
          goldHoldDays: position.goldHoldDays,
        });

        const ledgerKey = `BET_PLACED:${params.betId}:${params.wallet}`;
        await tx
          .insert(schema.arenaPointLedger)
          .values({
            wallet: params.wallet,
            eventType: "BET_PLACED",
            basePoints,
            multiplier,
            totalPoints,
            referenceType: "bet",
            referenceId: params.betId,
            idempotencyKey: ledgerKey,
            metadata: {
              roundId: params.roundId,
              side: params.side,
              goldAmount: verifiedGoldAmount,
            },
          })
          .onConflictDoNothing({
            target: [schema.arenaPointLedger.idempotencyKey],
          });

        if (params.referral) {
          let referrerMultiplier = multiplier;
          try {
            const referrerPosition =
              await this.stakingOps.fetchGoldPositionForWallet(
                params.referral.inviterWallet,
              );
            referrerMultiplier = this.stakingOps.computeGoldMultiplier(
              referrerPosition.goldBalance,
              referrerPosition.goldHoldDays,
            );
          } catch {
            // Fall back to bettor's multiplier if referrer lookup fails
          }
          const diminishingFactor = await this.getReferralDiminishingFactor(
            params.referral.inviterWallet,
          );
          const referralTotalPoints = Math.max(
            1,
            Math.round(basePoints * referrerMultiplier * diminishingFactor),
          );

          await tx.insert(schema.arenaReferralPoints).values({
            roundId: params.roundId,
            betId: params.betId,
            inviteCode: params.referral.inviteCode,
            inviterWallet: params.referral.inviterWallet,
            invitedWallet: params.wallet,
            basePoints,
            multiplier: referrerMultiplier,
            totalPoints: referralTotalPoints,
          });

          const refLedgerKey = `REFERRAL_BET:${params.betId}:${params.referral.inviterWallet}`;
          await tx
            .insert(schema.arenaPointLedger)
            .values({
              wallet: params.referral.inviterWallet,
              eventType: "REFERRAL_BET",
              basePoints,
              multiplier: referrerMultiplier,
              totalPoints: referralTotalPoints,
              referenceType: "bet",
              referenceId: params.betId,
              relatedWallet: params.wallet,
              idempotencyKey: refLedgerKey,
              metadata: {
                roundId: params.roundId,
                inviteCode: params.referral.inviteCode,
              },
            })
            .onConflictDoNothing({
              target: [schema.arenaPointLedger.idempotencyKey],
            });

          await this.confirmPendingSignupBonus(
            tx,
            params.referral.inviterWallet,
            params.wallet,
          );
        }
      });
    } catch (error: unknown) {
      this.ctx.logDbWriteError("award points", error);
      await this.enqueueFailedAward("BET_PLACED", params, error);
    }
  }

  // --------------------------------------------------------------------------
  // resolveVerifiedGoldAmountForPoints
  // --------------------------------------------------------------------------

  private async resolveVerifiedGoldAmountForPoints(params: {
    wallet: string;
    roundId: string | null;
    roundSeedHex: string | null;
    side: "A" | "B";
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    goldAmount: string;
    txSignature: string | null;
    verifiedForPoints: boolean;
    chain?: ArenaFeeChain;
  }): Promise<string | null> {
    if (params.verifiedForPoints) {
      return params.goldAmount;
    }

    if (!params.txSignature) {
      return null;
    }

    let expectedGoldAmount: bigint;
    try {
      expectedGoldAmount = parseDecimalToBaseUnits(
        params.goldAmount,
        ArenaPointsService.GOLD_DECIMALS,
      );
    } catch {
      return null;
    }

    const chain = normalizeFeeChain(params.chain ?? "SOLANA");

    if (chain !== "SOLANA") {
      if (!this.evmInspector.isEnabled(chain)) {
        console.warn(
          `[ArenaPoints] Cannot verify points, EVM inspector disabled for ${chain}`,
        );
        return null;
      }
      const evmTx = await this.evmInspector.inspectMarketBetTransaction(
        params.txSignature,
        chain,
        params.wallet,
      );
      if (evmTx && evmTx.amountBaseUnits === expectedGoldAmount) {
        return evmTx.amountGold;
      }
      return null;
    }

    if (!this.ctx.solanaOperator?.isEnabled()) {
      return null;
    }

    if (params.roundSeedHex) {
      try {
        const marketTx =
          await this.ctx.solanaOperator.inspectMarketBetTransaction(
            params.txSignature,
            params.roundSeedHex,
          );
        if (marketTx) {
          if (
            !marketTx.bettorWallet ||
            marketTx.bettorWallet !== params.wallet
          ) {
            return null;
          }
          if (marketTx.amountBaseUnits !== expectedGoldAmount) {
            return null;
          }
          return marketTx.amountGold;
        }
      } catch {
        // Fall through to inbound transfer inspection if market-tx parsing fails.
      }
    }

    try {
      const inspected =
        await this.ctx.solanaOperator.inspectInboundGoldTransfer(
          params.txSignature,
        );
      if (!inspected?.fromWallet) {
        return null;
      }
      if (inspected.fromWallet !== params.wallet) {
        return null;
      }
      if (inspected.amountBaseUnits !== expectedGoldAmount) {
        return null;
      }

      // For memo-enabled clients, enforce round/side consistency when present.
      const expectedMemo =
        params.roundId !== null
          ? `ARENA:${params.roundId}:${params.side}`
          : null;
      const memoMatches = Boolean(
        expectedMemo &&
        inspected.memo &&
        (inspected.memo === expectedMemo ||
          inspected.memo.includes(expectedMemo)),
      );
      if (params.sourceAsset === "GOLD" && expectedMemo && !memoMatches) {
        return null;
      }
      if (expectedMemo && inspected.memo && !memoMatches) {
        return null;
      }

      return inspected.amountGold;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // recordFeeShare
  // --------------------------------------------------------------------------

  public async recordFeeShare(params: {
    roundId: string | null;
    betId: string;
    bettorWallet: string;
    goldAmount: string;
    feeBps: number;
    chain: ArenaFeeChain;
    referral: { inviteCode: string; inviterWallet: string } | null;
  }): Promise<boolean> {
    const db = this.ctx.getDb();
    if (!db) return false;

    try {
      const feeBps = Math.max(0, Math.floor(params.feeBps));
      const feeSharePoolBps = Math.min(
        feeBps,
        ArenaPointsService.REFERRAL_FEE_POOL_BPS,
      );
      const wagerGoldUnits = parseDecimalToBaseUnits(
        params.goldAmount,
        ArenaPointsService.GOLD_DECIMALS,
      );
      const totalFeeUnits =
        (wagerGoldUnits * BigInt(feeSharePoolBps)) / 10_000n;
      const inviterFeeUnits = params.referral
        ? (totalFeeUnits * BigInt(ArenaPointsService.REFERRAL_FEE_SHARE_BPS)) /
          10_000n
        : 0n;
      const marketMakerFeeUnits = totalFeeUnits - inviterFeeUnits;

      const values = {
        roundId: params.roundId,
        betId: params.betId,
        bettorWallet: params.bettorWallet,
        inviterWallet: params.referral?.inviterWallet ?? null,
        inviteCode: params.referral?.inviteCode ?? null,
        chain: normalizeFeeChain(params.chain),
        feeBps: feeSharePoolBps,
        totalFeeGold: formatBaseUnitsToDecimal(
          totalFeeUnits,
          ArenaPointsService.GOLD_DECIMALS,
        ),
        inviterFeeGold: formatBaseUnitsToDecimal(
          inviterFeeUnits,
          ArenaPointsService.GOLD_DECIMALS,
        ),
        treasuryFeeGold: formatBaseUnitsToDecimal(
          marketMakerFeeUnits,
          ArenaPointsService.GOLD_DECIMALS,
        ),
      };

      type FeeShareInsertResult = {
        returning?: (fields: {
          id: typeof schema.arenaFeeShares.id;
        }) => Promise<Array<{ id: number }>>;
        onConflictDoNothing?: (options: {
          target: Array<typeof schema.arenaFeeShares.betId>;
        }) => FeeShareInsertResult | Promise<unknown>;
      } & PromiseLike<unknown>;

      const insertQuery = db.insert(schema.arenaFeeShares).values(values) as
        | FeeShareInsertResult
        | Promise<unknown>;
      const conflictHandler = (insertQuery as FeeShareInsertResult)
        .onConflictDoNothing;
      const queryWithConflictGuard =
        typeof conflictHandler === "function"
          ? conflictHandler({
              target: [schema.arenaFeeShares.betId],
            })
          : insertQuery;

      const guardedQuery = queryWithConflictGuard as FeeShareInsertResult;
      if (typeof guardedQuery.returning === "function") {
        const inserted = await guardedQuery.returning({
          id: schema.arenaFeeShares.id,
        });
        return inserted.length > 0;
      }

      await queryWithConflictGuard;
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message.toLowerCase()
          : String(error ?? "").toLowerCase();
      if (
        errorMessage.includes("duplicate") ||
        errorMessage.includes("unique")
      ) {
        return false;
      }
      this.ctx.logDbWriteError("record fee share", error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // awardFlatPoints
  // --------------------------------------------------------------------------

  public async awardFlatPoints(params: {
    wallet: string;
    points: number;
    betId: string;
    referral: { inviteCode: string; inviterWallet: string } | null;
  }): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;

    const points = Math.max(0, Math.floor(params.points));
    if (points <= 0) return;

    try {
      await db.insert(schema.arenaPoints).values({
        wallet: params.wallet,
        roundId: null,
        betId: params.betId,
        basePoints: points,
        multiplier: 1,
        totalPoints: points,
        goldBalance: null,
        goldHoldDays: 0,
      });

      if (params.referral) {
        await db.insert(schema.arenaReferralPoints).values({
          roundId: null,
          betId: params.betId,
          inviteCode: params.referral.inviteCode,
          inviterWallet: params.referral.inviterWallet,
          invitedWallet: params.wallet,
          basePoints: points,
          multiplier: 1,
          totalPoints: points,
        });
      }
    } catch (error: unknown) {
      this.ctx.logDbWriteError("award flat points", error);
    }
  }

  // ==========================================================================
  // Signup Bonus
  // ==========================================================================

  public async awardSignupBonusReferee(
    wallet: string,
    inviteCode: string,
    inviterWallet: string,
  ): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;

    const idempKey = `SIGNUP_REFEREE:${inviteCode}:${wallet}`;
    try {
      await db
        .insert(schema.arenaPointLedger)
        .values({
          wallet,
          eventType: "SIGNUP_REFEREE",
          basePoints: ArenaPointsService.SIGNUP_BONUS_REFEREE,
          multiplier: 1,
          totalPoints: ArenaPointsService.SIGNUP_BONUS_REFEREE,
          referenceType: "referral",
          referenceId: inviteCode,
          relatedWallet: inviterWallet,
          idempotencyKey: idempKey,
        })
        .onConflictDoNothing({
          target: [schema.arenaPointLedger.idempotencyKey],
        });

      const betId = `signup-referee:${inviteCode}:${wallet}`;
      await db
        .insert(schema.arenaPoints)
        .values({
          wallet,
          roundId: null,
          betId,
          basePoints: ArenaPointsService.SIGNUP_BONUS_REFEREE,
          multiplier: 1,
          totalPoints: ArenaPointsService.SIGNUP_BONUS_REFEREE,
          goldBalance: null,
          goldHoldDays: 0,
        })
        .onConflictDoNothing({ target: [schema.arenaPoints.betId] });
    } catch (error: unknown) {
      this.ctx.logDbWriteError("award signup bonus (referee)", error);
    }
  }

  public async awardSignupBonusReferrer(
    inviterWallet: string,
    invitedWallet: string,
    inviteCode: string,
  ): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;

    const idempKey = `SIGNUP_REFERRER:${inviteCode}:${invitedWallet}`;
    try {
      await db
        .insert(schema.arenaPointLedger)
        .values({
          wallet: inviterWallet,
          eventType: "SIGNUP_REFERRER",
          status: "PENDING",
          basePoints: ArenaPointsService.SIGNUP_BONUS_REFERRER,
          multiplier: 1,
          totalPoints: ArenaPointsService.SIGNUP_BONUS_REFERRER,
          referenceType: "referral",
          referenceId: inviteCode,
          relatedWallet: invitedWallet,
          idempotencyKey: idempKey,
        })
        .onConflictDoNothing({
          target: [schema.arenaPointLedger.idempotencyKey],
        });
    } catch (error: unknown) {
      this.ctx.logDbWriteError("award signup bonus (referrer pending)", error);
    }
  }

  /**
   * Confirm a PENDING signup bonus for a referrer when the referee places
   * their first bet. Called after the awardPoints transaction completes.
   */
  private async confirmPendingSignupBonus(
    _tx: unknown,
    inviterWallet: string,
    invitedWallet: string,
  ): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;
    try {
      const pending = await db
        .select()
        .from(schema.arenaPointLedger)
        .where(
          and(
            eq(schema.arenaPointLedger.wallet, inviterWallet),
            eq(schema.arenaPointLedger.eventType, "SIGNUP_REFERRER"),
            eq(schema.arenaPointLedger.status, "PENDING"),
            eq(schema.arenaPointLedger.relatedWallet, invitedWallet),
          ),
        )
        .limit(1);

      if (pending.length > 0) {
        const entry = pending[0]!;
        await db
          .update(schema.arenaPointLedger)
          .set({
            status: "CONFIRMED",
            confirmedAt: nowMs(),
          })
          .where(eq(schema.arenaPointLedger.id, entry.id));

        const betId = `signup-referrer:${entry.referenceId}:${invitedWallet}`;
        await db
          .insert(schema.arenaPoints)
          .values({
            wallet: inviterWallet,
            roundId: null,
            betId,
            basePoints: entry.basePoints,
            multiplier: 1,
            totalPoints: entry.totalPoints,
            goldBalance: null,
            goldHoldDays: 0,
          })
          .onConflictDoNothing({ target: [schema.arenaPoints.betId] });
      }
    } catch (error: unknown) {
      this.ctx.logDbWriteError("confirm signup bonus", error);
    }
  }

  // ==========================================================================
  // Win Prediction Points
  // ==========================================================================

  /**
   * Award bonus points to all bettors who predicted correctly,
   * plus referral win bonuses to their referrers.
   */
  public async awardWinPoints(round: LiveArenaRound): Promise<void> {
    if (!round.winnerId || !round.market?.winnerSide) return;
    try {
      await this.processWinPointsForRound(round.id, round.market.winnerSide);
    } catch (error: unknown) {
      this.ctx.logDbWriteError("award win points", error);
      await this.enqueueFailedAward(
        "BET_WON",
        { roundId: round.id, winnerSide: round.market.winnerSide },
        error,
      );
    }
  }

  public async processWinPointsForRound(
    roundId: string,
    winnerSide: "A" | "B",
  ): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;

    const winningBets = await db
      .select()
      .from(schema.arenaPoints)
      .where(
        and(
          eq(schema.arenaPoints.roundId, roundId),
          eq(schema.arenaPoints.side, winnerSide),
          gt(schema.arenaPoints.totalPoints, 0),
        ),
      );

    if (winningBets.length === 0) return;

    await db.transaction(async (tx) => {
      for (const bet of winningBets) {
        const winBonus = Math.round(
          bet.totalPoints * ArenaPointsService.WIN_BONUS_MULTIPLIER,
        );
        if (winBonus <= 0) continue;

        const winKey = `BET_WON:${roundId}:${bet.wallet}:${bet.betId}`;
        await tx
          .insert(schema.arenaPointLedger)
          .values({
            wallet: bet.wallet,
            eventType: "BET_WON",
            basePoints: winBonus,
            multiplier: 1,
            totalPoints: winBonus,
            referenceType: "round",
            referenceId: roundId,
            idempotencyKey: winKey,
            metadata: {
              betId: bet.betId,
              originalPoints: bet.totalPoints,
              side: winnerSide,
            },
          })
          .onConflictDoNothing({
            target: [schema.arenaPointLedger.idempotencyKey],
          });

        const referral =
          await this.walletOps.findReferralMappingForWalletNetwork(bet.wallet);
        if (referral) {
          const refWinBonus = Math.max(
            1,
            Math.round(winBonus * ArenaPointsService.REFERRAL_WIN_SHARE),
          );
          const refWinKey = `REFERRAL_WIN:${roundId}:${bet.wallet}:${referral.inviterWallet}`;
          await tx
            .insert(schema.arenaPointLedger)
            .values({
              wallet: referral.inviterWallet,
              eventType: "REFERRAL_WIN",
              basePoints: refWinBonus,
              multiplier: 1,
              totalPoints: refWinBonus,
              referenceType: "round",
              referenceId: roundId,
              relatedWallet: bet.wallet,
              idempotencyKey: refWinKey,
              metadata: {
                betId: bet.betId,
                bettorWinBonus: winBonus,
                inviteCode: referral.inviteCode,
              },
            })
            .onConflictDoNothing({
              target: [schema.arenaPointLedger.idempotencyKey],
            });
        }
      }
    });
  }

  // ==========================================================================
  // Referral Diminishing Returns
  // ==========================================================================

  /**
   * Compute the referral point multiplier based on diminishing returns.
   * First 20: 100%, 21-50: 50%, 51+: 25%.
   */
  private async getReferralDiminishingFactor(
    inviterWallet: string,
  ): Promise<number> {
    const db = this.ctx.getDb();
    if (!db) return 1;
    try {
      const countRows = await db
        .select({ count: sql<number>`COUNT(*)`.as("count") })
        .from(schema.arenaInvitedWallets)
        .where(eq(schema.arenaInvitedWallets.inviterWallet, inviterWallet));
      const count = Number(countRows[0]?.count ?? 0);
      if (count <= 20) return 1;
      if (count <= 50) return 0.5;
      return 0.25;
    } catch {
      return 1;
    }
  }

  // ==========================================================================
  // Expired Pending Bonuses
  // ==========================================================================

  /**
   * Void expired PENDING signup bonuses (older than 30 days without a bet).
   * Called periodically from the tick loop.
   */
  public async voidExpiredPendingBonuses(): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;
    try {
      const expiryThreshold =
        nowMs() - ArenaPointsService.SIGNUP_BONUS_PENDING_EXPIRY_MS;
      await db
        .update(schema.arenaPointLedger)
        .set({ status: "VOIDED" })
        .where(
          and(
            eq(schema.arenaPointLedger.eventType, "SIGNUP_REFERRER"),
            eq(schema.arenaPointLedger.status, "PENDING"),
            sql`${schema.arenaPointLedger.createdAt} < ${expiryThreshold}`,
          ),
        );
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
    }
  }

  // ==========================================================================
  // Failed Award Queue
  // ==========================================================================

  public async enqueueFailedAward(
    eventType: string,
    payload: Record<string, unknown>,
    error: unknown,
  ): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;
    try {
      await db.insert(schema.arenaFailedAwards).values({
        eventType,
        payload,
        errorMessage:
          error instanceof Error ? error.message : String(error ?? "unknown"),
        nextAttemptAt: nowMs() + 30_000,
      });
    } catch (enqueueErr) {
      console.error(
        "[ArenaService] Failed to enqueue failed award:",
        enqueueErr,
      );
    }
  }

  public async processFailedAwards(): Promise<void> {
    const db = this.ctx.getDb();
    if (!db) return;

    try {
      const now = nowMs();
      const jobs = await db
        .select()
        .from(schema.arenaFailedAwards)
        .where(
          and(
            sql`${schema.arenaFailedAwards.resolvedAt} IS NULL`,
            sql`${schema.arenaFailedAwards.nextAttemptAt} <= ${now}`,
            sql`${schema.arenaFailedAwards.attempts} < ${schema.arenaFailedAwards.maxAttempts}`,
          ),
        )
        .orderBy(asc(schema.arenaFailedAwards.nextAttemptAt))
        .limit(20);

      for (const job of jobs) {
        try {
          const payload = job.payload as Record<string, unknown>;
          if (job.eventType === "BET_PLACED") {
            await this.awardPoints(
              payload as Parameters<typeof this.awardPoints>[0],
            );
          } else if (job.eventType === "BET_WON") {
            await this.processWinPointsForRound(
              payload.roundId as string,
              payload.winnerSide as "A" | "B",
            );
          }
          await db
            .update(schema.arenaFailedAwards)
            .set({ resolvedAt: nowMs() })
            .where(eq(schema.arenaFailedAwards.id, job.id));
        } catch (retryErr) {
          const backoffMs = Math.min(
            300_000,
            30_000 * Math.pow(2, job.attempts),
          );
          await db
            .update(schema.arenaFailedAwards)
            .set({
              attempts: job.attempts + 1,
              nextAttemptAt: nowMs() + backoffMs,
              errorMessage:
                retryErr instanceof Error ? retryErr.message : String(retryErr),
            })
            .where(eq(schema.arenaFailedAwards.id, job.id));
        }
      }
    } catch (error) {
      this.ctx.logTableMissingError(error);
    }
  }

  // ==========================================================================
  // Points Query Methods
  // ==========================================================================

  public async getWalletPoints(
    walletRaw: string,
    options?: { scope?: "wallet" | "linked" },
  ): Promise<PointsEntry> {
    const wallet = normalizeWallet(walletRaw);
    const scope: PointsEntry["pointsScope"] =
      options?.scope === "linked" ? "LINKED" : "WALLET";

    let identityWallets = [wallet];
    if (scope === "LINKED") {
      try {
        const linkedWallets = await this.walletOps.listLinkedWallets(wallet);
        const uniqueWallets = new Set<string>([wallet]);
        for (const linkedWallet of linkedWallets) {
          uniqueWallets.add(linkedWallet);
        }
        identityWallets = [...uniqueWallets].slice(0, 256);
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }
    }

    const buildDefaultEntry = (wallets: string[]): PointsEntry => ({
      wallet,
      pointsScope: scope,
      identityWalletCount: wallets.length,
      identityWallets: wallets,
      totalPoints: 0,
      selfPoints: 0,
      winPoints: 0,
      referralPoints: 0,
      stakingPoints: 0,
      multiplier: 0,
      goldBalance: null,
      liquidGoldBalance: null,
      stakedGoldBalance: null,
      goldHoldDays: 0,
      liquidGoldHoldDays: 0,
      stakedGoldHoldDays: 0,
      invitedWalletCount: 0,
      referredBy: null,
    });

    const db = this.ctx.getDb();
    if (!db) return buildDefaultEntry(identityWallets);

    try {
      const emptyPosition = {
        liquidGoldBalance: 0,
        stakedGoldBalance: 0,
        goldBalance: 0,
        liquidGoldHoldDays: 0,
        stakedGoldHoldDays: 0,
        goldHoldDays: 0,
        stakingSource: "NONE",
      };
      let position = emptyPosition;

      const solanaWallets = identityWallets.filter(isLikelySolanaWallet);
      if (solanaWallets.length > 0) {
        let liquidGoldBalance = 0;
        let stakedGoldBalance = 0;
        let liquidGoldHoldDays = 0;
        let stakedGoldHoldDays = 0;

        for (const candidateWallet of solanaWallets) {
          const candidatePosition =
            await this.stakingOps.fetchGoldPositionForWallet(candidateWallet);
          await this.stakingOps.accrueStakingPointsIfDue(
            candidateWallet,
            candidatePosition,
          );

          liquidGoldBalance += candidatePosition.liquidGoldBalance;
          stakedGoldBalance += candidatePosition.stakedGoldBalance;
          liquidGoldHoldDays = Math.max(
            liquidGoldHoldDays,
            candidatePosition.liquidGoldHoldDays,
          );
          stakedGoldHoldDays = Math.max(
            stakedGoldHoldDays,
            candidatePosition.stakedGoldHoldDays,
          );
        }

        position = {
          liquidGoldBalance,
          stakedGoldBalance,
          goldBalance: liquidGoldBalance + stakedGoldBalance,
          liquidGoldHoldDays,
          stakedGoldHoldDays,
          goldHoldDays: Math.max(liquidGoldHoldDays, stakedGoldHoldDays),
          stakingSource:
            solanaWallets.length > 1 ? "LINKED_AGGREGATE" : "PRIMARY",
        };
      }

      const selfWhere =
        identityWallets.length === 1
          ? eq(schema.arenaPoints.wallet, identityWallets[0]!)
          : inArray(schema.arenaPoints.wallet, identityWallets);
      const referralWhere =
        identityWallets.length === 1
          ? eq(schema.arenaReferralPoints.inviterWallet, identityWallets[0]!)
          : inArray(schema.arenaReferralPoints.inviterWallet, identityWallets);
      const invitedWhere =
        identityWallets.length === 1
          ? eq(schema.arenaInvitedWallets.inviterWallet, identityWallets[0]!)
          : inArray(schema.arenaInvitedWallets.inviterWallet, identityWallets);
      const stakingWhere =
        identityWallets.length === 1
          ? eq(schema.arenaStakingPoints.wallet, identityWallets[0]!)
          : inArray(schema.arenaStakingPoints.wallet, identityWallets);

      const selfRows = await db
        .select({
          totalPoints:
            sql<number>`COALESCE(SUM(${schema.arenaPoints.totalPoints}), 0)`.as(
              "totalPoints",
            ),
        })
        .from(schema.arenaPoints)
        .where(selfWhere);

      const referralRows = await db
        .select({
          totalPoints:
            sql<number>`COALESCE(SUM(${schema.arenaReferralPoints.totalPoints}), 0)`.as(
              "totalPoints",
            ),
        })
        .from(schema.arenaReferralPoints)
        .where(referralWhere);

      const invitedRows = await db
        .select({
          count:
            sql<number>`COUNT(DISTINCT ${schema.arenaInvitedWallets.invitedWallet})`.as(
              "count",
            ),
        })
        .from(schema.arenaInvitedWallets)
        .where(invitedWhere);

      const selfPoints = Number(selfRows[0]?.totalPoints ?? 0);
      const referralPoints = Number(referralRows[0]?.totalPoints ?? 0);
      let stakingPoints = 0;
      try {
        const stakingRows = await db
          .select({
            totalPoints:
              sql<number>`COALESCE(SUM(${schema.arenaStakingPoints.totalPoints}), 0)`.as(
                "totalPoints",
              ),
          })
          .from(schema.arenaStakingPoints)
          .where(stakingWhere);
        stakingPoints = Number(stakingRows[0]?.totalPoints ?? 0);
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }

      let winPoints = 0;
      try {
        const ledgerWhere =
          identityWallets.length === 1
            ? eq(schema.arenaPointLedger.wallet, identityWallets[0]!)
            : inArray(schema.arenaPointLedger.wallet, identityWallets);
        const winRows = await db
          .select({
            totalPoints:
              sql<number>`COALESCE(SUM(${schema.arenaPointLedger.totalPoints}), 0)`.as(
                "totalPoints",
              ),
          })
          .from(schema.arenaPointLedger)
          .where(
            and(
              ledgerWhere,
              eq(schema.arenaPointLedger.eventType, "BET_WON"),
              eq(schema.arenaPointLedger.status, "CONFIRMED"),
            ),
          );
        winPoints = Number(winRows[0]?.totalPoints ?? 0);
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }

      const totalPoints =
        selfPoints + winPoints + referralPoints + stakingPoints;
      const multiplier = this.stakingOps.computeGoldMultiplier(
        position.goldBalance,
        position.goldHoldDays,
      );

      let referredBy: PointsEntry["referredBy"] = null;
      try {
        const referralMapping =
          await this.walletOps.findReferralMappingForWalletNetwork(wallet);
        if (referralMapping) {
          referredBy = {
            wallet: referralMapping.inviterWallet,
            code: referralMapping.inviteCode,
          };
        }
      } catch {
        // Non-critical
      }

      return {
        wallet,
        pointsScope: scope,
        identityWalletCount: identityWallets.length,
        identityWallets,
        totalPoints,
        selfPoints,
        winPoints,
        referralPoints,
        stakingPoints,
        multiplier,
        goldBalance: position.goldBalance.toString(),
        liquidGoldBalance: position.liquidGoldBalance.toString(),
        stakedGoldBalance: position.stakedGoldBalance.toString(),
        goldHoldDays: position.goldHoldDays,
        liquidGoldHoldDays: position.liquidGoldHoldDays,
        stakedGoldHoldDays: position.stakedGoldHoldDays,
        invitedWalletCount: Number(invitedRows[0]?.count ?? 0),
        referredBy,
      };
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
      return buildDefaultEntry(identityWallets);
    }
  }

  /**
   * Get the points leaderboard (top wallets by total points).
   */
  public async getPointsLeaderboard(
    limit = 20,
    options?: {
      scope?: "wallet" | "linked";
      offset?: number;
      timeWindow?: "daily" | "weekly" | "monthly" | "alltime";
    },
  ): Promise<LeaderboardEntry[]> {
    const db = this.ctx.getDb();
    if (!db) return [];

    const scope = options?.scope === "linked" ? "LINKED" : "WALLET";
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const boundedOffset = Math.max(0, options?.offset ?? 0);
    const parsePoints = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      if (typeof value === "bigint") return Number(value);
      return 0;
    };

    const queryLeaderboard = (includeStaking: boolean, applyLimit: boolean) =>
      sql<{
        wallet: string;
        total_points: number | string | bigint;
      }>`
        WITH combined AS (
          SELECT "wallet" AS wallet, ("totalPoints")::bigint AS points FROM "arena_points"
          UNION ALL
          SELECT "inviterWallet" AS wallet, ("totalPoints")::bigint AS points FROM "arena_referral_points"
          ${
            includeStaking
              ? sql`UNION ALL
                  SELECT "wallet" AS wallet, ("totalPoints")::bigint AS points
                  FROM "arena_staking_points"`
              : sql``
          }
          UNION ALL
          SELECT "wallet" AS wallet, ("totalPoints")::bigint AS points
          FROM "arena_point_ledger"
          WHERE "status" = 'CONFIRMED'
          AND "eventType" IN ('BET_WON', 'REFERRAL_WIN', 'SIGNUP_REFERRER', 'SIGNUP_REFEREE')
        )
        SELECT
          wallet,
          SUM(points)::bigint AS total_points
        FROM combined
        GROUP BY wallet
        ORDER BY total_points DESC, wallet ASC
        ${applyLimit ? sql`LIMIT ${boundedLimit}` : sql``}
      `;

    const fetchRows = async (
      includeStaking: boolean,
      applyLimit: boolean,
    ): Promise<
      Array<{ wallet: string; total_points: number | string | bigint }>
    > => {
      const result = await db.execute(
        queryLeaderboard(includeStaking, applyLimit),
      );
      return (result.rows ?? []) as Array<{
        wallet: string;
        total_points: number | string | bigint;
      }>;
    };

    if (scope === "LINKED") {
      let walletRows: Array<{
        wallet: string;
        total_points: number | string | bigint;
      }> = [];
      try {
        walletRows = await fetchRows(true, false);
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }
      if (walletRows.length === 0) {
        try {
          walletRows = await fetchRows(false, false);
        } catch (error: unknown) {
          this.ctx.logTableMissingError(error);
        }
      }
      if (walletRows.length === 0) return [];

      const parent = new Map<string, string>();
      const ensureWallet = (value: string): void => {
        if (!parent.has(value)) parent.set(value, value);
      };
      const findWallet = (value: string): string => {
        const currentParent = parent.get(value);
        if (!currentParent || currentParent === value) {
          parent.set(value, value);
          return value;
        }
        const root = findWallet(currentParent);
        parent.set(value, root);
        return root;
      };
      const unionWallets = (left: string, right: string): void => {
        const leftRoot = findWallet(left);
        const rightRoot = findWallet(right);
        if (leftRoot === rightRoot) return;
        if (leftRoot < rightRoot) {
          parent.set(rightRoot, leftRoot);
        } else {
          parent.set(leftRoot, rightRoot);
        }
      };

      for (const row of walletRows) {
        ensureWallet(row.wallet);
      }

      try {
        let cursorId = 0;
        while (true) {
          const linkRows = await db
            .select({
              id: schema.arenaWalletLinks.id,
              walletA: schema.arenaWalletLinks.walletA,
              walletB: schema.arenaWalletLinks.walletB,
            })
            .from(schema.arenaWalletLinks)
            .where(gt(schema.arenaWalletLinks.id, cursorId))
            .orderBy(asc(schema.arenaWalletLinks.id))
            .limit(5_000);

          if (linkRows.length === 0) break;

          for (const row of linkRows) {
            ensureWallet(row.walletA);
            ensureWallet(row.walletB);
            unionWallets(row.walletA, row.walletB);
          }

          cursorId = linkRows[linkRows.length - 1]?.id ?? cursorId;
          if (linkRows.length < 5_000) break;
        }
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }

      const groupTotals = new Map<string, number>();
      const groupWallets = new Map<string, Set<string>>();
      for (const row of walletRows) {
        const root = findWallet(row.wallet);
        const points = parsePoints(row.total_points);
        groupTotals.set(root, (groupTotals.get(root) ?? 0) + points);
        const wallets = groupWallets.get(root) ?? new Set<string>();
        wallets.add(row.wallet);
        groupWallets.set(root, wallets);
      }

      const collapsed = [...groupTotals.entries()]
        .map(([root, totalPoints]) => {
          const wallets = [
            ...(groupWallets.get(root) ?? new Set([root])),
          ].sort();
          return {
            wallet: wallets[0] ?? root,
            totalPoints,
          };
        })
        .sort(
          (a, b) =>
            b.totalPoints - a.totalPoints || a.wallet.localeCompare(b.wallet),
        )
        .slice(boundedOffset, boundedOffset + boundedLimit);

      return collapsed.map((row, index) => ({
        rank: boundedOffset + index + 1,
        wallet: row.wallet,
        totalPoints: row.totalPoints,
      }));
    }

    try {
      const rows = await fetchRows(true, true);
      return rows.map((row, index) => ({
        rank: boundedOffset + index + 1,
        wallet: row.wallet,
        totalPoints: parsePoints(row.total_points),
      }));
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
    }

    try {
      const rows = await fetchRows(false, true);
      return rows.map((row, index) => ({
        rank: boundedOffset + index + 1,
        wallet: row.wallet,
        totalPoints: parsePoints(row.total_points),
      }));
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
    }

    return [];
  }

  /**
   * Get a specific wallet's rank on the leaderboard.
   */
  public async getWalletRank(
    walletRaw: string,
  ): Promise<{ wallet: string; rank: number; totalPoints: number }> {
    const wallet = normalizeWallet(walletRaw);
    const db = this.ctx.getDb();
    if (!db) return { wallet, rank: 0, totalPoints: 0 };

    try {
      const result = await db.execute(
        sql`
          WITH combined AS (
            SELECT "wallet" AS wallet, ("totalPoints")::bigint AS points FROM "arena_points"
            UNION ALL
            SELECT "inviterWallet" AS wallet, ("totalPoints")::bigint AS points FROM "arena_referral_points"
            UNION ALL
            SELECT "wallet" AS wallet, ("totalPoints")::bigint AS points FROM "arena_staking_points"
            UNION ALL
            SELECT "wallet" AS wallet, ("totalPoints")::bigint AS points
            FROM "arena_point_ledger"
            WHERE "status" = 'CONFIRMED'
            AND "eventType" IN ('BET_WON', 'REFERRAL_WIN', 'SIGNUP_REFERRER', 'SIGNUP_REFEREE')
          ),
          totals AS (
            SELECT wallet, SUM(points)::bigint AS total_points
            FROM combined
            GROUP BY wallet
          ),
          ranked AS (
            SELECT wallet, total_points,
              ROW_NUMBER() OVER (ORDER BY total_points DESC, wallet ASC) AS rank
            FROM totals
          )
          SELECT wallet, total_points, rank
          FROM ranked
          WHERE wallet = ${wallet}
          LIMIT 1
        `,
      );
      const row = (result.rows ?? [])[0] as
        | {
            wallet: string;
            total_points: number | string | bigint;
            rank: number | string | bigint;
          }
        | undefined;
      if (!row) return { wallet, rank: 0, totalPoints: 0 };
      return {
        wallet,
        rank: Number(row.rank),
        totalPoints: Number(row.total_points),
      };
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
      return { wallet, rank: 0, totalPoints: 0 };
    }
  }

  /**
   * Get point mutation history for a wallet from the ledger.
   */
  public async getPointsHistory(
    walletRaw: string,
    options?: { limit?: number; offset?: number; eventType?: string },
  ): Promise<{
    entries: Array<{
      id: number;
      eventType: string;
      status: string;
      totalPoints: number;
      referenceType: string | null;
      referenceId: string | null;
      relatedWallet: string | null;
      createdAt: number;
    }>;
    total: number;
  }> {
    const wallet = normalizeWallet(walletRaw);
    const db = this.ctx.getDb();
    if (!db) return { entries: [], total: 0 };

    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const offset = Math.max(0, options?.offset ?? 0);

    try {
      const conditions = [eq(schema.arenaPointLedger.wallet, wallet)];
      if (options?.eventType) {
        conditions.push(
          eq(schema.arenaPointLedger.eventType, options.eventType),
        );
      }
      const where = and(...conditions);

      const [rows, countRows] = await Promise.all([
        db
          .select({
            id: schema.arenaPointLedger.id,
            eventType: schema.arenaPointLedger.eventType,
            status: schema.arenaPointLedger.status,
            totalPoints: schema.arenaPointLedger.totalPoints,
            referenceType: schema.arenaPointLedger.referenceType,
            referenceId: schema.arenaPointLedger.referenceId,
            relatedWallet: schema.arenaPointLedger.relatedWallet,
            createdAt: schema.arenaPointLedger.createdAt,
          })
          .from(schema.arenaPointLedger)
          .where(where)
          .orderBy(desc(schema.arenaPointLedger.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)`.as("count") })
          .from(schema.arenaPointLedger)
          .where(where),
      ]);

      return {
        entries: rows,
        total: Number(countRows[0]?.count ?? 0),
      };
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
      return { entries: [], total: 0 };
    }
  }

  /**
   * Get the GOLD multiplier info for a wallet (live on-chain check).
   */
  public async getWalletGoldMultiplier(
    wallet: string,
  ): Promise<GoldMultiplierInfo> {
    const position = await this.stakingOps.fetchGoldPositionForWallet(wallet);
    const multiplier = this.stakingOps.computeGoldMultiplier(
      position.goldBalance,
      position.goldHoldDays,
    );

    let tier: GoldMultiplierInfo["tier"] = "NONE";
    let nextTierThreshold: number | null = ArenaPointsService.GOLD_TIER_0;

    if (position.goldBalance >= ArenaPointsService.GOLD_TIER_2) {
      tier =
        position.goldHoldDays >= ArenaPointsService.GOLD_HOLD_DAYS_BONUS
          ? "DIAMOND"
          : "GOLD";
      nextTierThreshold = null;
    } else if (position.goldBalance >= ArenaPointsService.GOLD_TIER_1) {
      tier = "SILVER";
      nextTierThreshold = ArenaPointsService.GOLD_TIER_2;
    } else if (position.goldBalance >= ArenaPointsService.GOLD_TIER_0) {
      tier = "BRONZE";
      nextTierThreshold = ArenaPointsService.GOLD_TIER_1;
    }

    return {
      wallet,
      goldBalance: position.goldBalance.toString(),
      liquidGoldBalance: position.liquidGoldBalance.toString(),
      stakedGoldBalance: position.stakedGoldBalance.toString(),
      goldHoldDays: position.goldHoldDays,
      liquidGoldHoldDays: position.liquidGoldHoldDays,
      stakedGoldHoldDays: position.stakedGoldHoldDays,
      multiplier,
      tier,
      nextTierThreshold,
    };
  }
}
