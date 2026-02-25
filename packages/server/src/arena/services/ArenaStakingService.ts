import { desc, eq, sql } from "drizzle-orm";
import * as schema from "../../database/schema.js";
import type { ArenaContext } from "../ArenaContext.js";
import {
  normalizeWallet,
  isLikelySolanaWallet,
  isLikelyDevelopmentRuntime,
  readBooleanEnv,
  readIntegerEnv,
  nowMs,
} from "../arena-utils.js";
import type { GoldPosition } from "../types.js";

const IS_DEVELOPMENT_RUNTIME = isLikelyDevelopmentRuntime();

export class ArenaStakingService {
  // ============================================================================
  // Static Configuration
  // ============================================================================

  static readonly GOLD_TIER_0 = 1_000; // 1x multiplier floor
  static readonly GOLD_TIER_1 = 100_000; // 2x multiplier
  static readonly GOLD_TIER_2 = 1_000_000; // 3x multiplier
  static readonly GOLD_HOLD_DAYS_BONUS = 10; // +1x bonus for 100k+/1m+ tiers
  static readonly GOLD_DECIMALS = 6;
  static readonly STAKING_POINTS_PER_GOLD_PER_DAY = 0.001;
  static readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;

  static readonly STAKING_SWEEP_ENABLED = readBooleanEnv(
    "ARENA_STAKING_SWEEP_ENABLED",
    !IS_DEVELOPMENT_RUNTIME,
  );
  static readonly STAKING_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
  static readonly STAKING_SWEEP_BATCH_SIZE = readIntegerEnv(
    "ARENA_STAKING_SWEEP_BATCH_SIZE",
    100,
    1,
    1_000,
  );
  static readonly HOLD_DAYS_SCAN_ENABLED = readBooleanEnv(
    "ARENA_HOLD_DAYS_SCAN_ENABLED",
    !IS_DEVELOPMENT_RUNTIME,
  );
  static readonly HOLD_DAYS_SCAN_MAX_PAGES = readIntegerEnv(
    "ARENA_HOLD_DAYS_SCAN_MAX_PAGES",
    IS_DEVELOPMENT_RUNTIME ? 0 : 4,
    0,
    50,
  );
  static readonly HOLD_DAYS_SCAN_PAGE_SIZE = readIntegerEnv(
    "ARENA_HOLD_DAYS_SCAN_PAGE_SIZE",
    1_000,
    1,
    1_000,
  );

  private readonly ctx: ArenaContext;
  private readonly listIdentityWallets?: (wallet: string) => Promise<string[]>;

  constructor(
    ctx: ArenaContext,
    listIdentityWallets?: (wallet: string) => Promise<string[]>,
  ) {
    this.ctx = ctx;
    this.listIdentityWallets = listIdentityWallets;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  public async processStakingAccrualSweep(): Promise<void> {
    if (
      !ArenaStakingService.STAKING_SWEEP_ENABLED ||
      this.ctx.stakingAccrualDisabled
    ) {
      return;
    }

    const db = this.ctx.getDb();
    if (!db) return;

    const wallets: string[] = [];
    const seen = new Set<string>();
    const appendWallet = (walletRaw: string | null | undefined): void => {
      if (!walletRaw || !isLikelySolanaWallet(walletRaw)) return;
      const wallet = normalizeWallet(walletRaw);
      if (seen.has(wallet)) return;
      seen.add(wallet);
      wallets.push(wallet);
    };

    try {
      const staleWalletRows = await db
        .select({
          wallet: schema.arenaStakingPoints.wallet,
          latestPeriodEndAt:
            sql<number>`MAX(${schema.arenaStakingPoints.periodEndAt})`.as(
              "latestPeriodEndAt",
            ),
        })
        .from(schema.arenaStakingPoints)
        .groupBy(schema.arenaStakingPoints.wallet)
        .orderBy(
          sql<number>`MAX(${schema.arenaStakingPoints.periodEndAt}) ASC`,
          schema.arenaStakingPoints.wallet,
        )
        .limit(ArenaStakingService.STAKING_SWEEP_BATCH_SIZE);

      for (const row of staleWalletRows) {
        appendWallet(row.wallet);
      }
    } catch (error: unknown) {
      this.ctx.logTableMissingError(error);
    }

    if (wallets.length < ArenaStakingService.STAKING_SWEEP_BATCH_SIZE) {
      try {
        const recentPointsWalletRows = await db
          .select({
            wallet: schema.arenaPoints.wallet,
          })
          .from(schema.arenaPoints)
          .orderBy(desc(schema.arenaPoints.createdAt))
          .limit(ArenaStakingService.STAKING_SWEEP_BATCH_SIZE * 3);

        for (const row of recentPointsWalletRows) {
          appendWallet(row.wallet);
          if (wallets.length >= ArenaStakingService.STAKING_SWEEP_BATCH_SIZE)
            break;
        }
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }
    }

    if (wallets.length < ArenaStakingService.STAKING_SWEEP_BATCH_SIZE) {
      try {
        const recentFeeWalletRows = await db
          .select({
            wallet: schema.arenaFeeShares.bettorWallet,
          })
          .from(schema.arenaFeeShares)
          .orderBy(desc(schema.arenaFeeShares.createdAt))
          .limit(ArenaStakingService.STAKING_SWEEP_BATCH_SIZE * 3);

        for (const row of recentFeeWalletRows) {
          appendWallet(row.wallet);
          if (wallets.length >= ArenaStakingService.STAKING_SWEEP_BATCH_SIZE)
            break;
        }
      } catch (error: unknown) {
        this.ctx.logTableMissingError(error);
      }
    }

    for (const wallet of wallets.slice(
      0,
      ArenaStakingService.STAKING_SWEEP_BATCH_SIZE,
    )) {
      if (this.ctx.stakingAccrualDisabled) break;
      await this.accrueStakingPointsIfDue(wallet);
    }
  }

  public async accrueStakingPointsIfDue(
    walletRaw: string,
    position?: GoldPosition | undefined,
  ): Promise<void> {
    if (this.ctx.stakingAccrualDisabled) return;

    const db = this.ctx.getDb();
    if (!db) return;

    const wallet = normalizeWallet(walletRaw);
    const now = nowMs();
    const currentDayStart =
      Math.floor(now / ArenaStakingService.ONE_DAY_MS) *
      ArenaStakingService.ONE_DAY_MS;

    try {
      const currentPosition =
        position ?? (await this.fetchGoldPositionForWallet(wallet));
      const currentMultiplier = this.computeGoldMultiplier(
        currentPosition.goldBalance,
        currentPosition.goldHoldDays,
      );

      const parseNonNegativeNumber = (value: unknown): number => {
        if (typeof value === "number" && Number.isFinite(value)) {
          return Math.max(0, value);
        }
        if (typeof value === "string" && value.trim()) {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) {
            return Math.max(0, parsed);
          }
        }
        return 0;
      };

      const latest = await db
        .select({
          id: schema.arenaStakingPoints.id,
          createdAt: schema.arenaStakingPoints.createdAt,
          periodEndAt: schema.arenaStakingPoints.periodEndAt,
          multiplier: schema.arenaStakingPoints.multiplier,
          liquidGoldBalance: schema.arenaStakingPoints.liquidGoldBalance,
          stakedGoldBalance: schema.arenaStakingPoints.stakedGoldBalance,
          goldBalance: schema.arenaStakingPoints.goldBalance,
          goldHoldDays: schema.arenaStakingPoints.goldHoldDays,
          source: schema.arenaStakingPoints.source,
        })
        .from(schema.arenaStakingPoints)
        .where(eq(schema.arenaStakingPoints.wallet, wallet))
        .orderBy(
          desc(schema.arenaStakingPoints.periodEndAt),
          desc(schema.arenaStakingPoints.createdAt),
          desc(schema.arenaStakingPoints.id),
        )
        .limit(1);

      const latestRow = latest[0];
      if (latestRow?.periodEndAt) {
        const periodStartAt = latestRow.periodEndAt;
        const elapsedDays = Math.max(
          0,
          Math.floor(
            (currentDayStart - periodStartAt) / ArenaStakingService.ONE_DAY_MS,
          ),
        );

        if (elapsedDays > 0) {
          const snapshotStakedGoldBalance = parseNonNegativeNumber(
            latestRow.stakedGoldBalance,
          );
          const dailyBasePoints = Math.max(
            0,
            Math.round(
              snapshotStakedGoldBalance *
                ArenaStakingService.STAKING_POINTS_PER_GOLD_PER_DAY,
            ),
          );
          const basePoints = dailyBasePoints * elapsedDays;
          const snapshotMultiplier = Math.max(
            0,
            Math.floor(parseNonNegativeNumber(latestRow.multiplier)),
          );
          const totalPoints = basePoints * snapshotMultiplier;

          await db
            .insert(schema.arenaStakingPoints)
            .values({
              wallet,
              basePoints,
              multiplier: snapshotMultiplier,
              totalPoints,
              daysAccrued: elapsedDays,
              liquidGoldBalance: latestRow.liquidGoldBalance,
              stakedGoldBalance: latestRow.stakedGoldBalance,
              goldBalance: latestRow.goldBalance,
              goldHoldDays: latestRow.goldHoldDays,
              periodStartAt,
              periodEndAt: currentDayStart,
              source: latestRow.source,
            })
            .onConflictDoNothing({
              target: [
                schema.arenaStakingPoints.wallet,
                schema.arenaStakingPoints.periodStartAt,
                schema.arenaStakingPoints.periodEndAt,
              ],
            });
        }
      }

      // Anchor today's snapshot so future accruals use current balances/multiplier.
      await db
        .insert(schema.arenaStakingPoints)
        .values({
          wallet,
          basePoints: 0,
          multiplier: currentMultiplier,
          totalPoints: 0,
          daysAccrued: 0,
          liquidGoldBalance: currentPosition.liquidGoldBalance.toString(),
          stakedGoldBalance: currentPosition.stakedGoldBalance.toString(),
          goldBalance: currentPosition.goldBalance.toString(),
          goldHoldDays: currentPosition.goldHoldDays,
          periodStartAt: currentDayStart,
          periodEndAt: currentDayStart,
          source: currentPosition.stakingSource,
        })
        .onConflictDoUpdate({
          target: [
            schema.arenaStakingPoints.wallet,
            schema.arenaStakingPoints.periodStartAt,
            schema.arenaStakingPoints.periodEndAt,
          ],
          set: {
            basePoints: 0,
            multiplier: currentMultiplier,
            totalPoints: 0,
            daysAccrued: 0,
            liquidGoldBalance: currentPosition.liquidGoldBalance.toString(),
            stakedGoldBalance: currentPosition.stakedGoldBalance.toString(),
            goldBalance: currentPosition.goldBalance.toString(),
            goldHoldDays: currentPosition.goldHoldDays,
            source: currentPosition.stakingSource,
          },
        });
    } catch (error: unknown) {
      if (this.ctx.isStakingAccrualConflictError(error)) {
        this.ctx.disableStakingAccrual(
          "Disabling staking accrual: missing unique index for arena_staking_points(wallet, periodStartAt, periodEndAt). Run database migrations.",
          error,
        );
        return;
      }
      this.ctx.logDbWriteError("accrue staking points", error);
    }
  }

  /**
   * Compute the GOLD multiplier from balance and hold duration.
   */
  public computeGoldMultiplier(goldBalance: number, holdDays: number): number {
    if (goldBalance < ArenaStakingService.GOLD_TIER_0) {
      return 0;
    }

    let multiplier = 1;
    if (goldBalance >= ArenaStakingService.GOLD_TIER_2) {
      multiplier = 3;
    } else if (goldBalance >= ArenaStakingService.GOLD_TIER_1) {
      multiplier = 2;
    }
    if (
      goldBalance >= ArenaStakingService.GOLD_TIER_1 &&
      holdDays >= ArenaStakingService.GOLD_HOLD_DAYS_BONUS
    ) {
      multiplier += 1;
    }
    return multiplier;
  }

  public async fetchGoldPositionForWallet(
    walletRaw: string,
  ): Promise<GoldPosition> {
    const wallet = normalizeWallet(walletRaw);
    let targetWallets = [wallet];
    if (this.listIdentityWallets) {
      targetWallets = await this.listIdentityWallets(wallet);
      if (targetWallets.length === 0) targetWallets = [wallet];
    }

    // Find a solana wallet among targetWallets to fetch hold days and balance from
    const solanaWallet =
      targetWallets.find((w) => isLikelySolanaWallet(w)) || wallet;

    const [liquid, staked] = await Promise.all([
      this.fetchGoldBalanceAndHoldDays(solanaWallet),
      this.fetchStakedGoldBalanceAndHoldDays(solanaWallet),
    ]);

    const liquidGoldBalance = Math.max(0, liquid.balance);
    let stakedGoldBalance = Math.max(0, staked.balance);
    const liquidGoldHoldDays = Math.max(0, Math.floor(liquid.holdDays));
    let stakedGoldHoldDays = Math.max(0, Math.floor(staked.holdDays));

    if (staked.source === "BIRDEYE_TOTAL_BALANCE") {
      stakedGoldBalance = Math.max(0, stakedGoldBalance - liquidGoldBalance);
      stakedGoldHoldDays = 0;
    }

    return {
      liquidGoldBalance,
      stakedGoldBalance,
      goldBalance: liquidGoldBalance + stakedGoldBalance,
      liquidGoldHoldDays,
      stakedGoldHoldDays,
      goldHoldDays: Math.max(liquidGoldHoldDays, stakedGoldHoldDays),
      stakingSource: staked.source,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async fetchStakedGoldBalanceAndHoldDays(wallet: string): Promise<{
    balance: number;
    holdDays: number;
    source: string;
  }> {
    const parseValue = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };

    const asObject = (value: unknown): Record<string, unknown> | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }
      return value as Record<string, unknown>;
    };

    const endpoint = this.ctx.solanaConfig.stakingIndexerUrl?.trim();
    if (endpoint) {
      const buildIndexerUrl = (): string => {
        if (endpoint.includes("{wallet}")) {
          return endpoint.replace("{wallet}", encodeURIComponent(wallet));
        }
        const url = new URL(endpoint);
        url.searchParams.set("wallet", wallet);
        return url.toString();
      };

      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
        };
        if (this.ctx.solanaConfig.stakingIndexerAuthHeader?.trim()) {
          headers.Authorization =
            this.ctx.solanaConfig.stakingIndexerAuthHeader;
        }

        const response = await fetch(buildIndexerUrl(), {
          method: "GET",
          headers,
        });
        if (response.ok) {
          const payload = (await response.json()) as Record<string, unknown>;
          const stakedBalance = Math.max(
            0,
            parseValue(
              payload.stakedGoldBalance ??
                payload.stakedBalance ??
                payload.balance ??
                "0",
            ),
          );
          const holdDays = Math.max(
            0,
            Math.floor(
              parseValue(
                payload.stakedGoldHoldDays ??
                  payload.stakedHoldDays ??
                  payload.holdDays ??
                  "0",
              ),
            ),
          );

          return { balance: stakedBalance, holdDays, source: "INDEXER" };
        }
      } catch {
        // Fall through to Birdeye fallback.
      }
    }

    const birdeyeApiKey = this.ctx.solanaConfig.birdeyeApiKey?.trim();
    if (!birdeyeApiKey) {
      return {
        balance: 0,
        holdDays: 0,
        source: endpoint ? "INDEXER_ERROR" : "NONE",
      };
    }

    try {
      const birdeyeBaseUrl =
        this.ctx.solanaConfig.birdeyeBaseUrl?.trim() ||
        "https://public-api.birdeye.so";
      const endpointUrl = new URL(
        "v1/wallet/token_balance",
        birdeyeBaseUrl.endsWith("/") ? birdeyeBaseUrl : `${birdeyeBaseUrl}/`,
      );
      endpointUrl.searchParams.set("wallet", wallet);
      endpointUrl.searchParams.set("address", this.ctx.solanaConfig.goldMint);

      const response = await fetch(endpointUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-KEY": birdeyeApiKey,
          "x-chain": "solana",
        },
      });
      if (!response.ok) {
        return {
          balance: 0,
          holdDays: 0,
          source: endpoint ? "INDEXER_ERROR_BIRDEYE_ERROR" : "BIRDEYE_ERROR",
        };
      }

      const payload = (await response.json()) as unknown;
      const root = asObject(payload) ?? {};
      const data = asObject(root.data) ?? root;

      const stakedBalance = Math.max(
        0,
        parseValue(
          data.stakedGoldBalance ??
            data.stakedBalance ??
            data.stakedAmount ??
            root.stakedGoldBalance ??
            root.stakedBalance ??
            root.stakedAmount ??
            "0",
        ),
      );
      const holdDays = Math.max(
        0,
        Math.floor(
          parseValue(
            data.stakedGoldHoldDays ??
              data.stakedHoldDays ??
              data.holdDays ??
              root.stakedGoldHoldDays ??
              root.stakedHoldDays ??
              root.holdDays ??
              "0",
          ),
        ),
      );

      if (stakedBalance > 0 || holdDays > 0) {
        return { balance: stakedBalance, holdDays, source: "BIRDEYE_STAKED" };
      }

      const totalBalance = Math.max(
        0,
        parseValue(
          data.balance ??
            data.uiAmount ??
            data.ui_amount ??
            data.amount ??
            root.balance ??
            root.uiAmount ??
            root.ui_amount ??
            root.amount ??
            "0",
        ),
      );
      if (totalBalance > 0) {
        // This endpoint can represent total wallet token balance; callers
        // must de-duplicate against liquid wallet balance before using it.
        return {
          balance: totalBalance,
          holdDays: 0,
          source: "BIRDEYE_TOTAL_BALANCE",
        };
      }

      return { balance: 0, holdDays: 0, source: "BIRDEYE" };
    } catch {
      return {
        balance: 0,
        holdDays: 0,
        source: endpoint ? "INDEXER_ERROR_BIRDEYE_ERROR" : "BIRDEYE_ERROR",
      };
    }
  }

  /**
   * Fetch wallet's GOLD balance via Solana RPC (getTokenAccountsByOwner).
   * Also estimates holding duration from the token account data.
   */
  private async fetchGoldBalanceAndHoldDays(
    wallet: string,
  ): Promise<{ balance: number; holdDays: number }> {
    try {
      const goldMint = this.ctx.solanaConfig.goldMint;

      // Use getTokenAccountsByOwner to find all GOLD token accounts
      const data = await this.ctx.fetchSolanaRpcJson<{
        result?: {
          value?: Array<{
            pubkey: string;
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: {
                      uiAmount: number;
                      amount: string;
                    };
                  };
                };
              };
            };
          }>;
        };
      }>({
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [wallet, { mint: goldMint }, { encoding: "jsonParsed" }],
      });
      if (!data) return { balance: 0, holdDays: 0 };

      const accounts = data.result?.value ?? [];
      if (accounts.length === 0) return { balance: 0, holdDays: 0 };

      let totalBalance = 0;
      for (const account of accounts) {
        const uiAmount =
          account.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
        totalBalance += uiAmount;
      }

      if (
        !ArenaStakingService.HOLD_DAYS_SCAN_ENABLED ||
        ArenaStakingService.HOLD_DAYS_SCAN_MAX_PAGES <= 0 ||
        totalBalance <= 0
      ) {
        return { balance: totalBalance, holdDays: 0 };
      }

      // Estimate hold days from the highest-balance token account.
      let holdDays = 0;
      try {
        const sortedAccounts = [...accounts].sort((a, b) => {
          const aAmount =
            a.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          const bAmount =
            b.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          return bAmount - aAmount;
        });
        const candidateAccount = sortedAccounts[0];

        if (candidateAccount) {
          let before: string | undefined;
          let oldestBlockTime: number | null = null;

          for (
            let page = 0;
            page < ArenaStakingService.HOLD_DAYS_SCAN_MAX_PAGES;
            page += 1
          ) {
            const sigData = await this.ctx.fetchSolanaRpcJson<{
              result?: Array<{ signature?: string; blockTime?: number }>;
            }>({
              id: 2 + page,
              method: "getSignaturesForAddress",
              params: [
                candidateAccount.pubkey,
                before
                  ? {
                      limit: ArenaStakingService.HOLD_DAYS_SCAN_PAGE_SIZE,
                      before,
                    }
                  : { limit: ArenaStakingService.HOLD_DAYS_SCAN_PAGE_SIZE },
              ],
            });
            if (!sigData) break;

            const signatures = sigData.result ?? [];
            if (signatures.length === 0) break;

            for (const signature of signatures) {
              if (
                typeof signature.blockTime === "number" &&
                Number.isFinite(signature.blockTime)
              ) {
                if (
                  oldestBlockTime === null ||
                  signature.blockTime < oldestBlockTime
                ) {
                  oldestBlockTime = signature.blockTime;
                }
              }
            }

            if (
              signatures.length < ArenaStakingService.HOLD_DAYS_SCAN_PAGE_SIZE
            )
              break;
            before = signatures[signatures.length - 1]?.signature;
            if (!before) break;
          }

          if (oldestBlockTime) {
            const ageMs = Date.now() - oldestBlockTime * 1000;
            holdDays = Math.max(
              0,
              Math.floor(ageMs / ArenaStakingService.ONE_DAY_MS),
            );
          }
        }
      } catch {
        // Fall back to 0 hold days — don't fail award
      }

      return { balance: totalBalance, holdDays };
    } catch {
      return { balance: 0, holdDays: 0 };
    }
  }
}
