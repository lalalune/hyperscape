/**
 * ArenaService — thin facade that delegates to domain sub-services.
 *
 * Preserves the existing public API so that callers (arena-routes, shutdown,
 * DuelCombatAI) continue to work unchanged.
 */
import type { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";
import {
  DEFAULT_ARENA_RUNTIME_CONFIG,
  getSolanaArenaConfig,
} from "./config.js";
import { SolanaArenaOperator } from "./SolanaArenaOperator.js";
import { ArenaContext } from "./ArenaContext.js";
import { nowMs } from "./arena-utils.js";

// Sub-services
import { ArenaRoundService } from "./services/ArenaRoundService.js";
import { ArenaBettingService } from "./services/ArenaBettingService.js";
import { ArenaPayoutService } from "./services/ArenaPayoutService.js";
import { ArenaPointsService } from "./services/ArenaPointsService.js";
import { ArenaStakingService } from "./services/ArenaStakingService.js";
import { ArenaWalletService } from "./services/ArenaWalletService.js";
import { EvmTransactionInspector } from "./services/EvmTransactionInspector.js";

// Re-export types used by callers
import type {
  ArenaRoundSnapshot,
  ArenaWhitelistEntry,
  ArenaWhitelistUpsertInput,
  BetQuoteRequest,
  BetQuoteResponse,
  ClaimBuildRequest,
  ClaimBuildResponse,
  DepositAddressResponse,
  IngestDepositRequest,
  IngestDepositResponse,
  PointsEntry,
  LeaderboardEntry,
  GoldMultiplierInfo,
  InviteSummary,
  InviteRedemptionResult,
  WalletLinkResult,
  ArenaSide,
  ArenaFeeChain,
} from "./types.js";

export class ArenaService {
  // ---------------------------------------------------------------------------
  // Singleton per world
  // ---------------------------------------------------------------------------
  private static instances = new WeakMap<World, ArenaService>();

  public static forWorld(world: World): ArenaService {
    const existing = ArenaService.instances.get(world);
    if (existing) return existing;
    const service = new ArenaService(world);
    ArenaService.instances.set(world, service);
    return service;
  }

  public static tryForWorld(world: World): ArenaService | null {
    return ArenaService.instances.get(world) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------
  private readonly ctx: ArenaContext;
  private readonly rounds: ArenaRoundService;
  private readonly betting: ArenaBettingService;
  private readonly payouts: ArenaPayoutService;
  private readonly points: ArenaPointsService;
  private readonly staking: ArenaStakingService;
  private readonly wallets: ArenaWalletService;

  private started = false;
  private isTicking = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastPayoutProcessAt = 0;
  private lastStakingSweepAt = 0;
  private lastFailedAwardProcessAt = 0;

  // ---------------------------------------------------------------------------
  // Constructor — wires sub-services together
  // ---------------------------------------------------------------------------
  private constructor(world: World) {
    const config = DEFAULT_ARENA_RUNTIME_CONFIG;
    const solanaConfig = getSolanaArenaConfig();
    let solanaOperator: SolanaArenaOperator | null = null;
    try {
      solanaOperator = new SolanaArenaOperator(solanaConfig);
    } catch (error) {
      console.warn(
        "[ArenaService] Solana operator disabled due to invalid config:",
        error,
      );
    }

    this.ctx = new ArenaContext(world, config, solanaConfig, solanaOperator);

    // Stateless sub-services
    this.rounds = new ArenaRoundService(this.ctx);
    this.staking = new ArenaStakingService(this.ctx, async (w) =>
      this.wallets.listIdentityWallets(w),
    );

    // Points needs staking + wallet ops
    this.wallets = new ArenaWalletService(
      this.ctx,
      (params) => this.points.awardFlatPoints(params),
      (wallet, inviteCode, inviterWallet) =>
        this.points.awardSignupBonusReferee(wallet, inviteCode, inviterWallet),
      (inviterWallet, invitedWallet, inviteCode) =>
        this.points.awardSignupBonusReferrer(
          inviterWallet,
          invitedWallet,
          inviteCode,
        ),
    );

    const evmInspector = new EvmTransactionInspector();
    this.points = new ArenaPointsService(
      this.ctx,
      this.staking,
      this.wallets,
      evmInspector,
    );

    this.payouts = new ArenaPayoutService(this.ctx, (eventType, payload) =>
      this.rounds.persistRoundEvent(eventType, payload),
    );

    this.betting = new ArenaBettingService(
      this.ctx,
      this.rounds,
      this.points,
      this.wallets,
    );

    // Deferred deps: round service needs payout + points for resolution
    this.rounds.setDeps(this.payouts, this.points);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public init(): void {
    if (this.started) return;
    this.started = true;

    this.ctx.world.on("duel:completed", this.rounds.onDuelCompleted);
    this.ctx.world.on(EventType.ENTITY_DAMAGED, this.rounds.onEntityDamaged);

    this.tickTimer = setInterval(() => {
      void this.tick();
    }, this.ctx.config.tickIntervalMs);

    void this.tick();
    console.log("[ArenaService] Initialized streamed duel arena loop");
    if (!ArenaStakingService.STAKING_SWEEP_ENABLED) {
      console.log(
        "[ArenaService] Staking accrual sweep disabled (ARENA_STAKING_SWEEP_ENABLED=false)",
      );
    }
    if (
      !ArenaStakingService.HOLD_DAYS_SCAN_ENABLED ||
      ArenaStakingService.HOLD_DAYS_SCAN_MAX_PAGES <= 0
    ) {
      console.log(
        "[ArenaService] HOLD days signature-history scan disabled (ARENA_HOLD_DAYS_SCAN_ENABLED=false or ARENA_HOLD_DAYS_SCAN_MAX_PAGES=0)",
      );
    }
  }

  public destroy(): void {
    if (!this.started) return;
    this.started = false;
    this.ctx.world.off("duel:completed", this.rounds.onDuelCompleted);
    this.ctx.world.off(EventType.ENTITY_DAMAGED, this.rounds.onEntityDamaged);
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Tick loop — orchestrates phase transitions and periodic tasks
  // ---------------------------------------------------------------------------

  private async tick(): Promise<void> {
    if (this.isTicking) return;
    this.isTicking = true;
    try {
      const now = nowMs();

      // Periodic: process payouts every 5s
      if (now - this.lastPayoutProcessAt >= 5_000) {
        this.lastPayoutProcessAt = now;
        await this.payouts.processPayoutJobs();
      }

      // Periodic: staking sweep
      if (
        ArenaStakingService.STAKING_SWEEP_ENABLED &&
        !this.ctx.stakingAccrualDisabled &&
        now - this.lastStakingSweepAt >=
          ArenaStakingService.STAKING_SWEEP_INTERVAL_MS
      ) {
        this.lastStakingSweepAt = now;
        await this.staking.processStakingAccrualSweep();
      }

      // Periodic: process failed awards + void expired bonuses
      if (now - this.lastFailedAwardProcessAt >= 30_000) {
        this.lastFailedAwardProcessAt = now;
        await this.points.processFailedAwards();
        await this.points.voidExpiredPendingBonuses();
      }

      // Round lifecycle
      if (!this.rounds.currentRound) {
        await this.rounds.maybeCreateRound();
        return;
      }

      const round = this.rounds.currentRound;
      switch (round.phase) {
        case "PREVIEW_CAMS":
          if (now >= round.bettingOpensAt) {
            await this.rounds.moveToPhase("BET_OPEN");
          }
          break;
        case "BET_OPEN":
          if (now >= round.bettingClosesAt) {
            const betLockDeadline = now + this.ctx.config.bettingLockBufferMs;
            await this.rounds.moveToPhase("BET_LOCK");
            await this.rounds.setRoundPhaseDeadline(betLockDeadline);
          }
          break;
        case "BET_LOCK":
          if (round.phaseDeadlineMs !== null && now >= round.phaseDeadlineMs) {
            await this.rounds.startRoundDuel();
          }
          break;
        case "DUEL_ACTIVE":
          if (
            round.duelStartsAt !== null &&
            now >= round.duelStartsAt + this.ctx.config.duelMaxDurationMs
          ) {
            await this.rounds.resolveTimeoutDuel();
          } else if (
            round.updatedAt !== null &&
            round.duelStartsAt !== null &&
            now >= round.duelStartsAt + 15_000 &&
            now >= round.updatedAt + 20_000
          ) {
            console.warn(
              `[ArenaService] Resolving stalemated duel ${round.duelId} due to 20s of no damage.`,
            );
            await this.rounds.resolveTimeoutDuel();
          }
          break;
        case "RESULT_SHOW":
          if (round.phaseDeadlineMs !== null && now >= round.phaseDeadlineMs) {
            await this.rounds.moveToPhase("ORACLE_REPORT");
            await this.rounds.publishOracleOutcome();
          }
          break;
        case "ORACLE_REPORT":
          await this.rounds.moveToPhase("MARKET_RESOLVE");
          await this.rounds.resolveMarketSnapshot();
          break;
        case "MARKET_RESOLVE": {
          const restoreDeadline = now + this.ctx.config.restoreDurationMs;
          await this.rounds.moveToPhase("RESTORE");
          await this.rounds.setRoundPhaseDeadline(restoreDeadline);
          break;
        }
        case "RESTORE":
          if (round.phaseDeadlineMs !== null && now >= round.phaseDeadlineMs) {
            await this.rounds.finishCurrentRound();
          }
          break;
        case "COMPLETE":
          await this.rounds.finishCurrentRound();
          break;
      }
    } catch (error) {
      console.error("[ArenaService] Tick error:", error);
    } finally {
      this.isTicking = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API — round queries
  // ---------------------------------------------------------------------------

  public getCurrentRound(): ArenaRoundSnapshot | null {
    return this.rounds.getCurrentRound();
  }

  public getRound(roundId: string): ArenaRoundSnapshot | null {
    return this.rounds.getRound(roundId);
  }

  public listRecentRounds(limit = 20): ArenaRoundSnapshot[] {
    return this.rounds.listRecentRounds(limit);
  }

  public async hydrateRecentRounds(limit = 20): Promise<void> {
    return this.rounds.hydrateRecentRounds(limit);
  }

  // ---------------------------------------------------------------------------
  // Public API — whitelist
  // ---------------------------------------------------------------------------

  public async listWhitelist(limit = 200): Promise<ArenaWhitelistEntry[]> {
    return this.wallets.listWhitelist(limit);
  }

  public async upsertWhitelist(
    input: ArenaWhitelistUpsertInput,
  ): Promise<ArenaWhitelistEntry> {
    return this.wallets.upsertWhitelist(input);
  }

  public async removeWhitelist(characterId: string): Promise<boolean> {
    return this.wallets.removeWhitelist(characterId);
  }

  // ---------------------------------------------------------------------------
  // Public API — betting
  // ---------------------------------------------------------------------------

  public async buildBetQuote(
    request: BetQuoteRequest,
  ): Promise<BetQuoteResponse> {
    return this.betting.buildBetQuote(request);
  }

  public async recordBet(params: {
    roundId: string;
    bettorWallet: string;
    side: ArenaSide;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    sourceAmount: string;
    goldAmount: string;
    txSignature?: string | null;
    quoteJson?: Record<string, unknown> | null;
    skipPoints?: boolean;
    inviteCode?: string | null;
    verifiedForPoints?: boolean;
    chain?: ArenaFeeChain;
  }): Promise<string> {
    return this.betting.recordBet(params);
  }

  public async recordExternalBet(params: {
    bettorWallet: string;
    chain: ArenaFeeChain;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    sourceAmount: string;
    goldAmount: string;
    feeBps: number;
    txSignature?: string | null;
    inviteCode?: string | null;
    externalBetRef?: string | null;
    marketPda?: string | null;
    skipPoints?: boolean;
  }): Promise<string> {
    return this.betting.recordExternalBet(params);
  }

  public buildClaimInfo(request: ClaimBuildRequest): ClaimBuildResponse {
    return this.betting.buildClaimInfo(request);
  }

  public buildDepositAddress(params: {
    roundId: string;
    side: ArenaSide;
  }): DepositAddressResponse {
    return this.betting.buildDepositAddress(params);
  }

  public async ingestDepositBySignature(
    request: IngestDepositRequest,
  ): Promise<IngestDepositResponse> {
    return this.betting.ingestDepositBySignature(request);
  }

  // ---------------------------------------------------------------------------
  // Public API — payouts
  // ---------------------------------------------------------------------------

  public async listPayoutJobs(params?: {
    limit?: number;
    status?: string;
  }): Promise<
    Array<{
      id: string;
      roundId: string;
      bettorWallet: string;
      status: string;
      attempts: number;
      claimSignature: string | null;
      lastError: string | null;
      nextAttemptAt: number | null;
      createdAt: number;
      updatedAt: number;
    }>
  > {
    return this.payouts.listPayoutJobs(params);
  }

  public async markPayoutJobResult(params: {
    id: string;
    status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
    claimSignature?: string | null;
    lastError?: string | null;
    nextAttemptAt?: number | null;
  }): Promise<boolean> {
    return this.payouts.markPayoutJobResult(params);
  }

  // ---------------------------------------------------------------------------
  // Public API — wallet / invite / linking
  // ---------------------------------------------------------------------------

  public async redeemInviteCode(params: {
    wallet: string;
    inviteCode: string;
  }): Promise<InviteRedemptionResult> {
    return this.wallets.redeemInviteCode(params);
  }

  public async linkWallets(params: {
    wallet: string;
    walletPlatform: ArenaFeeChain;
    linkedWallet: string;
    linkedWalletPlatform: ArenaFeeChain;
  }): Promise<WalletLinkResult> {
    return this.wallets.linkWallets(params);
  }

  public async getInviteSummary(
    wallet: string,
    platform?: string | null,
  ): Promise<InviteSummary> {
    return this.wallets.getInviteSummary(wallet, platform);
  }

  // ---------------------------------------------------------------------------
  // Public API — points & leaderboard
  // ---------------------------------------------------------------------------

  public async getWalletPoints(
    wallet: string,
    options?: { scope?: "wallet" | "linked" },
  ): Promise<PointsEntry> {
    return this.points.getWalletPoints(wallet, options);
  }

  public async getPointsLeaderboard(
    limit?: number,
    options?: {
      scope?: "wallet" | "linked";
      offset?: number;
      timeWindow?: "daily" | "weekly" | "monthly" | "alltime";
    },
  ): Promise<LeaderboardEntry[]> {
    return this.points.getPointsLeaderboard(limit, options);
  }

  public async getWalletRank(
    wallet: string,
  ): Promise<{ wallet: string; rank: number; totalPoints: number }> {
    return this.points.getWalletRank(wallet);
  }

  public async getPointsHistory(
    wallet: string,
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
    return this.points.getPointsHistory(wallet, options);
  }

  public async getWalletGoldMultiplier(
    wallet: string,
  ): Promise<GoldMultiplierInfo> {
    return this.points.getWalletGoldMultiplier(wallet);
  }

  // ---------------------------------------------------------------------------
  // Internal methods exposed for testing (allow vi.spyOn)
  // ---------------------------------------------------------------------------

  /** @internal */
  protected getDb() {
    return this.ctx.getDb();
  }

  /** @internal */
  protected async findReferralMappingForWalletNetwork(wallet: string) {
    return this.wallets.findReferralMappingForWalletNetwork(wallet);
  }

  /** @internal */
  protected async listIdentityWallets(wallet: string): Promise<string[]> {
    return this.wallets.listIdentityWallets(wallet);
  }

  /** @internal */
  protected async listLinkedWallets(wallet: string): Promise<string[]> {
    return this.wallets.listLinkedWallets(wallet);
  }

  /** @internal */
  protected async ensureWalletInviteMapping(params: {
    wallet: string;
    inviteCode: string;
    inviterWallet: string;
    firstBetId: string | null;
  }): Promise<void> {
    return this.wallets.ensureWalletInviteMapping(params);
  }

  /** @internal */
  protected async recordFeeShare(params: {
    roundId: string | null;
    betId: string;
    bettorWallet: string;
    goldAmount: string;
    feeBps: number;
    chain: ArenaFeeChain;
    referral: { inviteCode: string; inviterWallet: string } | null;
  }): Promise<boolean> {
    return this.points.recordFeeShare(params);
  }

  /** @internal */
  protected async awardFlatPoints(params: {
    wallet: string;
    points: number;
    betId: string;
    referral: { inviteCode: string; inviterWallet: string } | null;
  }): Promise<void> {
    return this.points.awardFlatPoints(params);
  }

  /** @internal */
  protected async awardPoints(params: {
    wallet: string;
    roundId: string | null;
    roundSeedHex: string | null;
    betId: string;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    goldAmount: string;
    txSignature: string | null;
    side: ArenaSide;
    verifiedForPoints: boolean;
    referral: { inviteCode: string; inviterWallet: string } | null;
  }): Promise<void> {
    return this.points.awardPoints(params);
  }

  /** @internal */
  protected async resolveReferralForWallet(params: {
    wallet: string;
    betId: string;
    inviteCode: string | null;
  }): Promise<{ inviteCode: string; inviterWallet: string } | null> {
    return this.wallets.resolveReferralForWallet(params);
  }

  /** @internal */
  protected async fetchGoldPositionForWallet(wallet: string) {
    return this.staking.fetchGoldPositionForWallet(wallet);
  }

  /** @internal */
  protected async accrueStakingPointsIfDue(
    wallet: string,
    position?: unknown,
  ): Promise<void> {
    return this.staking.accrueStakingPointsIfDue(
      wallet,
      position as Parameters<typeof this.staking.accrueStakingPointsIfDue>[1],
    );
  }

  /** @internal */
  protected computeGoldMultiplier(
    goldBalance: number,
    holdDays: number,
  ): number {
    return this.staking.computeGoldMultiplier(goldBalance, holdDays);
  }

  /** @internal */
  protected async getEligibleAgents() {
    return this.rounds.getEligibleAgents();
  }
}
