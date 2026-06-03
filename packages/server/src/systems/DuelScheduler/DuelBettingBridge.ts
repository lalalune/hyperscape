/**
 * DuelBettingBridge - Connects duel results to Solana prediction markets
 *
 * This bridge listens to DuelScheduler events and:
 * 1. Creates oracle rounds and markets when duels are scheduled
 * 2. Reports outcomes when duels complete
 * 3. Tracks betting statistics
 *
 * Integration with Solana Prediction Market:
 * - Uses SolanaArenaOperator for blockchain operations
 * - Agent 1 = Side A, Agent 2 = Side B
 * - Winner's side receives the pool
 *
 * Enable via DUEL_BETTING_ENABLED=true environment variable
 */

import type { World } from "@hyperforge/shared";
import { createHash } from "node:crypto";
import { Logger } from "../ServerNetwork/services";
import { getStreamingDuelScheduler } from "../StreamingDuelScheduler/index.js";

// ============================================================================
// Configuration
// ============================================================================

const config = {
  /** Whether duel betting is enabled */
  enabled: process.env.DUEL_BETTING_ENABLED === "true",

  /** Betting window duration after duel is scheduled (ms) */
  bettingWindowMs: parseInt(process.env.DUEL_BETTING_WINDOW_MS || "30000", 10),

  /** Reconciliation cadence for streaming mode market sync (ms) */
  reconcileIntervalMs: Math.max(
    250,
    parseInt(process.env.DUEL_BETTING_RECONCILE_MS || "1000", 10),
  ),

  /** Delay before on-chain resolution/public market finalization (ms) */
  resolutionDelayMs: Math.max(
    0,
    parseInt(process.env.DUEL_BETTING_RESOLUTION_DELAY_MS || "15000", 10),
  ),

  /** Base URL for duel metadata */
  metadataBaseUrl:
    process.env.DUEL_METADATA_BASE_URL || "https://hyperia.game/api/duels",
};

// ============================================================================
// Types
// ============================================================================

interface DuelMarket {
  duelId: string;
  duelKeyHex: string;
  roundSeedHex: string;
  agent1Id: string;
  agent2Id: string;
  agent1Name: string;
  agent2Name: string;
  createdAt: number;
  bettingClosesAt: number;
  status: "betting" | "locked" | "resolved" | "aborted";
  onChainInitialized: boolean;
  winnerId?: string;
  winnerSide?: "A" | "B";
}

function canCreateMarketForStreamingPhase(phase: unknown): boolean {
  return (
    phase === "ANNOUNCEMENT" || phase === "COUNTDOWN" || phase === "FIGHTING"
  );
}

interface SolanaArenaOperatorInterface {
  isEnabled(): boolean;
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
}

type DuelBettingBridgeDeps = {
  getStreamingDuelScheduler?: typeof getStreamingDuelScheduler;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function payloadKeys(payload: unknown): string[] {
  return Object.keys(asRecord(payload) ?? {});
}

function warnInvalidBridgePayload(
  eventName: string,
  payload: unknown,
  reason: string,
): void {
  Logger.warn("DuelBettingBridge", `Ignoring malformed ${eventName} payload`, {
    reason,
    keys: payloadKeys(payload),
  });
}

function parseStreamingAgentRef(
  value: unknown,
): { id: string; name: string | null } | null {
  const record = asRecord(value);
  const id = asNonEmptyString(record?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    name: asNonEmptyString(record?.name),
  };
}

function parseDuelScheduledPayload(payload: unknown): {
  duelId: string;
  duelKeyHex: string | undefined;
  agent1Id: string;
  agent2Id: string;
  agent1Name: string;
  agent2Name: string;
} | null {
  const record = asRecord(payload);
  const duelId = asNonEmptyString(record?.duelId);
  const agent1Id = asNonEmptyString(record?.agent1Id);
  const agent2Id = asNonEmptyString(record?.agent2Id);
  if (!duelId || !agent1Id || !agent2Id) {
    return null;
  }
  return {
    duelId,
    duelKeyHex: asNonEmptyString(record?.duelKeyHex) ?? undefined,
    agent1Id,
    agent2Id,
    agent1Name: asNonEmptyString(record?.agent1Name) ?? agent1Id,
    agent2Name: asNonEmptyString(record?.agent2Name) ?? agent2Id,
  };
}

function parseStreamingAnnouncementPayload(payload: unknown): {
  duelId: string;
  duelKeyHex: string;
  betCloseTime: number | undefined;
  agent1: { id: string; name: string | null };
  agent2: { id: string; name: string | null };
} | null {
  const record = asRecord(payload);
  const duelId = asNonEmptyString(record?.duelId);
  const duelKeyHex = asNonEmptyString(record?.duelKeyHex);
  const agent1 = parseStreamingAgentRef(record?.agent1);
  const agent2 = parseStreamingAgentRef(record?.agent2);
  if (!duelId || !duelKeyHex || !agent1 || !agent2) {
    return null;
  }
  return {
    duelId,
    duelKeyHex,
    betCloseTime: asFiniteNumber(record?.betCloseTime),
    agent1,
    agent2,
  };
}

function parseStreamingFightStartPayload(payload: unknown): {
  duelId: string;
  duelKeyHex: string | null;
} | null {
  const record = asRecord(payload);
  const duelId = asNonEmptyString(record?.duelId);
  if (!duelId) {
    return null;
  }
  return {
    duelId,
    duelKeyHex: asNonEmptyString(record?.duelKeyHex),
  };
}

function parseStreamingResolutionPayload(payload: unknown): {
  duelId: string;
  winnerId: string;
  loserId: string;
  winnerName: string | null;
  loserName: string | null;
  duration: number | undefined;
  seed: string | null;
  replayHash: string | null;
} | null {
  const record = asRecord(payload);
  const duelId = asNonEmptyString(record?.duelId);
  const winnerId = asNonEmptyString(record?.winnerId);
  const loserId = asNonEmptyString(record?.loserId);
  if (!duelId || !winnerId || !loserId) {
    return null;
  }
  return {
    duelId,
    winnerId,
    loserId,
    winnerName: asNonEmptyString(record?.winnerName),
    loserName: asNonEmptyString(record?.loserName),
    duration: asFiniteNumber(record?.duration),
    seed: asNonEmptyString(record?.seed),
    replayHash: asNonEmptyString(record?.replayHash),
  };
}

function parseStreamingAbortPayload(payload: unknown): {
  duelId: string;
  reason: string | null;
} | null {
  const record = asRecord(payload);
  const duelId = asNonEmptyString(record?.duelId);
  if (!duelId) {
    return null;
  }
  return {
    duelId,
    reason: asNonEmptyString(record?.reason),
  };
}

function parseDuelResultPayload(payload: unknown): {
  winnerId: string;
  loserId: string;
  winnerName: string | null;
  loserName: string | null;
  duration: number | undefined;
} | null {
  const record = asRecord(payload);
  const winnerId = asNonEmptyString(record?.winnerId);
  const loserId = asNonEmptyString(record?.loserId);
  if (!winnerId || !loserId) {
    return null;
  }
  return {
    winnerId,
    loserId,
    winnerName: asNonEmptyString(record?.winnerName),
    loserName: asNonEmptyString(record?.loserName),
    duration: asFiniteNumber(record?.duration),
  };
}

// ============================================================================
// DuelBettingBridge Class
// ============================================================================

export class DuelBettingBridge {
  private readonly world: World;
  private readonly getStreamingDuelSchedulerFn: typeof getStreamingDuelScheduler;
  private solanaOperator: SolanaArenaOperatorInterface | null = null;

  /** Active duel markets */
  private activeMarkets: Map<string, DuelMarket> = new Map();

  /** Historical markets for stats */
  private marketHistory: DuelMarket[] = [];

  /** Serializes market creation per duel to avoid duplicate initRound calls */
  private readonly createOrSyncInFlight = new Map<string, Promise<void>>();

  /** Registered event listeners */
  private readonly eventListeners: Array<{
    event: string;
    fn: (...args: unknown[]) => void;
  }> = [];

  /** Tracked pending timeouts so they can be cancelled on destroy */
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  /** Reconciliation timer used to keep market state aligned with the live duel */
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;

  /** Prevent overlapping reconcile passes */
  private reconcileInFlight = false;

  /** Set once destroy() starts so delayed callbacks can bail out safely */
  private destroyed = false;

  constructor(world: World, deps: DuelBettingBridgeDeps = {}) {
    this.world = world;
    this.getStreamingDuelSchedulerFn =
      deps.getStreamingDuelScheduler ?? getStreamingDuelScheduler;
  }

  /**
   * Initialize the betting bridge
   */
  async init(): Promise<void> {
    this.destroyed = false;
    if (!config.enabled) {
      Logger.info("DuelBettingBridge", "Duel betting is disabled");
      return;
    }

    // Try to get the Solana operator from the world
    this.solanaOperator =
      (
        this.world as World & {
          solanaArenaOperator?: SolanaArenaOperatorInterface;
        }
      ).solanaArenaOperator ?? null;

    if (!this.solanaOperator || !this.solanaOperator.isEnabled()) {
      Logger.warn(
        "DuelBettingBridge",
        "SolanaArenaOperator not available or not enabled - betting will be tracked locally only",
      );
    }

    Logger.info("DuelBettingBridge", "Initializing duel betting bridge", {
      bettingWindowMs: config.bettingWindowMs,
      solanaEnabled: this.solanaOperator?.isEnabled() ?? false,
    });

    // Listen for duel scheduled events
    const onDuelScheduled = (payload: unknown) => {
      this.handleDuelScheduled(payload);
    };
    this.world.on("duel:scheduled", onDuelScheduled);
    this.eventListeners.push({
      event: "duel:scheduled",
      fn: onDuelScheduled,
    });

    const onStreamingAnnouncement = (payload: unknown) => {
      void this.handleStreamingAnnouncement(payload).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Failed to handle streaming announcement",
          error instanceof Error ? error : null,
        );
      });
    };
    this.world.on("streaming:announcement:start", onStreamingAnnouncement);
    this.eventListeners.push({
      event: "streaming:announcement:start",
      fn: onStreamingAnnouncement,
    });

    const onStreamingFightStart = (payload: unknown) => {
      void this.handleStreamingFightStart(payload).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Failed to handle streaming fight start",
          error instanceof Error ? error : null,
        );
      });
    };
    this.world.on("streaming:fight:start", onStreamingFightStart);
    this.eventListeners.push({
      event: "streaming:fight:start",
      fn: onStreamingFightStart,
    });

    const onStreamingResolution = (payload: unknown) => {
      void this.handleStreamingResolution(payload).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Failed to handle streaming resolution",
          error instanceof Error ? error : null,
        );
      });
    };
    this.world.on("streaming:resolution:start", onStreamingResolution);
    this.eventListeners.push({
      event: "streaming:resolution:start",
      fn: onStreamingResolution,
    });

    const onStreamingAbort = (payload: unknown) => {
      void this.handleStreamingAbort(payload).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Failed to handle streaming abort",
          error instanceof Error ? error : null,
        );
      });
    };
    this.world.on("streaming:cycle:aborted", onStreamingAbort);
    this.eventListeners.push({
      event: "streaming:cycle:aborted",
      fn: onStreamingAbort,
    });

    // Listen for duel result events
    const onDuelResult = (payload: unknown) => {
      void this.handleDuelResult(payload).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Failed to handle duel result",
          error instanceof Error ? error : null,
        );
      });
    };
    this.world.on("duel:result", onDuelResult);
    this.eventListeners.push({
      event: "duel:result",
      fn: onDuelResult,
    });

    // Also listen to direct duel completion events
    const onDuelCompleted = (payload: unknown) => {
      void this.handleDuelResult(payload).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Failed to handle duel completion",
          error instanceof Error ? error : null,
        );
      });
    };
    this.world.on("duel:completed", onDuelCompleted);
    this.eventListeners.push({
      event: "duel:completed",
      fn: onDuelCompleted,
    });

    this.startReconciliationLoop();

    Logger.info("DuelBettingBridge", "Duel betting bridge initialized");
  }

  /**
   * Destroy the bridge and clean up
   */
  destroy(): void {
    this.destroyed = true;
    for (const { event, fn } of this.eventListeners) {
      this.world.off(event, fn);
    }
    this.eventListeners.length = 0;

    // Cancel all pending timeouts (market lock, resolution delay)
    for (const timer of this.pendingTimeouts) {
      clearTimeout(timer);
    }
    this.pendingTimeouts.clear();

    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }

    // Clear retained market data
    this.activeMarkets.clear();
    this.createOrSyncInFlight.clear();

    Logger.info("DuelBettingBridge", "Duel betting bridge destroyed");
  }

  /**
   * Get active markets
   */
  getActiveMarkets(): DuelMarket[] {
    return Array.from(this.activeMarkets.values());
  }

  /**
   * Get market history
   */
  getMarketHistory(): DuelMarket[] {
    return [...this.marketHistory];
  }

  /**
   * Get market by duel ID
   */
  getMarket(duelId: string): DuelMarket | null {
    return this.activeMarkets.get(duelId) ?? null;
  }

  /**
   * Handle duel scheduled event - create betting market
   */
  private async handleDuelScheduled(payload: unknown): Promise<void> {
    const data = parseDuelScheduledPayload(payload);
    if (!data) {
      warnInvalidBridgePayload(
        "duel:scheduled",
        payload,
        "missing_required_fields",
      );
      return;
    }

    await this.createOrSyncMarket({
      duelId: data.duelId,
      duelKeyHex: data.duelKeyHex,
      agent1Id: data.agent1Id,
      agent2Id: data.agent2Id,
      agent1Name: data.agent1Name || data.agent1Id,
      agent2Name: data.agent2Name || data.agent2Id,
      bettingClosesAt: Date.now() + config.bettingWindowMs,
      source: "legacy",
    });
  }

  private async handleStreamingAnnouncement(payload: unknown): Promise<void> {
    const data = parseStreamingAnnouncementPayload(payload);
    if (!data) {
      warnInvalidBridgePayload(
        "streaming:announcement:start",
        payload,
        "missing_required_fields",
      );
      return;
    }

    this.ensureReconciliationLoop();

    await this.createOrSyncMarket({
      duelId: data.duelId,
      duelKeyHex: data.duelKeyHex,
      agent1Id: data.agent1.id,
      agent2Id: data.agent2.id,
      agent1Name: data.agent1.name || data.agent1.id,
      agent2Name: data.agent2.name || data.agent2.id,
      bettingClosesAt: data.betCloseTime ?? Date.now() + config.bettingWindowMs,
      source: "streaming",
    });
  }

  private async handleStreamingFightStart(payload: unknown): Promise<void> {
    const data = parseStreamingFightStartPayload(payload);
    if (!data) {
      warnInvalidBridgePayload(
        "streaming:fight:start",
        payload,
        "missing_required_fields",
      );
      return;
    }

    this.ensureReconciliationLoop();

    const market = this.activeMarkets.get(data.duelId);
    if (!market) {
      await this.reconcileLiveCycleFrom("streaming:fight:start", {
        duelId: data.duelId,
        duelKeyHex: data.duelKeyHex ?? null,
      });
      return;
    }

    if (market.status === "betting") {
      await this.lockMarket(data.duelId);
    }
  }

  private async handleStreamingResolution(payload: unknown): Promise<void> {
    const data = parseStreamingResolutionPayload(payload);
    if (!data) {
      warnInvalidBridgePayload(
        "streaming:resolution:start",
        payload,
        "missing_required_fields",
      );
      return;
    }

    this.ensureReconciliationLoop();

    const resolvedMarket = await this.getResolvableStreamingMarket(data.duelId);
    if (!resolvedMarket) {
      return;
    }

    await this.resolveMarket(resolvedMarket, {
      winnerId: data.winnerId,
      loserId: data.loserId,
      winnerName: data.winnerName || "Unknown",
      loserName: data.loserName || "Unknown",
      duration: data.duration,
      seed: data.seed ?? null,
      replayHash: data.replayHash ?? null,
    });
  }

  private async getResolvableStreamingMarket(
    duelId: string,
  ): Promise<DuelMarket | null> {
    const existing = this.activeMarkets.get(duelId);
    if (existing) {
      return existing;
    }

    const scheduler = this.getStreamingDuelSchedulerFn();
    const cycle = scheduler?.getCurrentCycle();
    if (!cycle || cycle.duelId !== duelId) {
      return null;
    }

    if (!canCreateMarketForStreamingPhase(cycle.phase)) {
      Logger.warn(
        "DuelBettingBridge",
        "Skipping streaming resolution because no active market exists for the resolved duel",
        {
          duelId,
          cycleId: cycle.cycleId ?? null,
          phase: cycle.phase ?? null,
        },
      );
      return null;
    }

    await this.reconcileLiveCycleFrom("streaming:resolution:lookup", {
      duelId,
      cycleId: cycle.cycleId ?? null,
      phase: cycle.phase ?? null,
    });
    return this.activeMarkets.get(duelId) ?? null;
  }

  private async handleStreamingAbort(payload: unknown): Promise<void> {
    const data = parseStreamingAbortPayload(payload);
    if (!data) {
      warnInvalidBridgePayload(
        "streaming:cycle:aborted",
        payload,
        "missing_required_fields",
      );
      return;
    }

    this.ensureReconciliationLoop();

    const market = this.activeMarkets.get(data.duelId);
    if (!market) {
      return;
    }

    Logger.warn("DuelBettingBridge", "Removing aborted betting market", {
      duelId: data.duelId,
      reason: data.reason || "streaming abort",
    });
    if (market.onChainInitialized) {
      Logger.error(
        "DuelBettingBridge",
        "Streaming duel aborted after on-chain market initialization; manual intervention is required because the operator does not yet support cancellation",
        null,
        {
          duelId: data.duelId,
          roundSeedHex: market.roundSeedHex,
          reason: data.reason || "streaming abort",
        },
      );
      this.world.emit("betting:market:orphaned", {
        duelId: data.duelId,
        market,
        roundSeedHex: market.roundSeedHex,
        reason: data.reason || "streaming abort",
        manualInterventionRequired: true,
      });
    }
    const abortedMarket: DuelMarket = {
      ...market,
      status: "aborted",
    };
    this.activeMarkets.delete(data.duelId);
    this.pushMarketHistory(abortedMarket);
    this.world.emit("betting:market:aborted", {
      duelId: data.duelId,
      market: abortedMarket,
      reason: data.reason || "streaming abort",
      onChainInitialized: market.onChainInitialized,
    });
  }

  /**
   * Lock the betting market
   */
  private async lockMarket(duelId: string): Promise<void> {
    const market = this.activeMarkets.get(duelId);
    if (!market || market.status !== "betting") {
      return;
    }

    market.status = "locked";
    Logger.info("DuelBettingBridge", "Locking betting market", {
      duelId,
    });

    // Lock on-chain market
    if (this.solanaOperator?.isEnabled()) {
      try {
        const sig = await this.solanaOperator.lockMarket(market.roundSeedHex);
        if (sig) {
          Logger.info("DuelBettingBridge", "On-chain market locked", {
            duelId,
            signature: sig,
          });
        }
      } catch (error) {
        Logger.error(
          "DuelBettingBridge",
          "Failed to lock on-chain market",
          error instanceof Error ? error : null,
          { duelId },
        );
      }
    }

    // Emit market locked event for UI
    this.world.emit("betting:market:locked", {
      duelId,
      market,
    });
  }

  private async createOrSyncMarket(params: {
    duelId: string;
    duelKeyHex?: string;
    agent1Id: string;
    agent2Id: string;
    agent1Name: string;
    agent2Name: string;
    bettingClosesAt: number;
    source: "legacy" | "streaming";
  }): Promise<void> {
    const prior =
      this.createOrSyncInFlight.get(params.duelId) ?? Promise.resolve();
    let current: Promise<void>;
    current = prior
      .catch(() => {
        // A previous create/sync failure should not block subsequent retries.
      })
      .then(() => this.createOrSyncMarketInternal(params))
      .finally(() => {
        if (this.createOrSyncInFlight.get(params.duelId) === current) {
          this.createOrSyncInFlight.delete(params.duelId);
        }
      });
    this.createOrSyncInFlight.set(params.duelId, current);
    return current;
  }

  private async createOrSyncMarketInternal(params: {
    duelId: string;
    duelKeyHex?: string;
    agent1Id: string;
    agent2Id: string;
    agent1Name: string;
    agent2Name: string;
    bettingClosesAt: number;
    source: "legacy" | "streaming";
  }): Promise<void> {
    if (
      !this.activeMarkets.has(params.duelId) &&
      this.hasTerminalMarket(params.duelId)
    ) {
      Logger.info(
        "DuelBettingBridge",
        "Skipping market recreation for a terminal duel market",
        {
          duelId: params.duelId,
          source: params.source,
        },
      );
      return;
    }

    const roundSeedHex =
      params.duelKeyHex || this.generateRoundSeed(params.duelId);
    const existing = this.activeMarkets.get(params.duelId);
    const createdAt = existing?.createdAt ?? Date.now();
    const market: DuelMarket = existing ?? {
      duelId: params.duelId,
      duelKeyHex: roundSeedHex,
      roundSeedHex,
      agent1Id: params.agent1Id,
      agent2Id: params.agent2Id,
      agent1Name: params.agent1Name || params.agent1Id,
      agent2Name: params.agent2Name || params.agent2Id,
      createdAt,
      bettingClosesAt: params.bettingClosesAt,
      status: "betting",
      onChainInitialized: false,
      winnerId: undefined,
      winnerSide: undefined,
    };

    market.duelKeyHex = roundSeedHex;
    market.roundSeedHex = roundSeedHex;
    market.agent1Id = params.agent1Id;
    market.agent2Id = params.agent2Id;
    market.agent1Name = params.agent1Name || params.agent1Id;
    market.agent2Name = params.agent2Name || params.agent2Id;
    market.bettingClosesAt = params.bettingClosesAt;

    this.activeMarkets.set(params.duelId, market);

    Logger.info(
      "DuelBettingBridge",
      existing
        ? "Synchronizing betting market for duel"
        : "Creating betting market for duel",
      {
        duelId: params.duelId,
        duelKeyHex: market.duelKeyHex,
        agent1: market.agent1Name,
        agent2: market.agent2Name,
        roundSeedHex,
        bettingClosesAt: new Date(params.bettingClosesAt).toISOString(),
        source: params.source,
      },
    );

    if (!existing && this.solanaOperator?.isEnabled()) {
      try {
        const result = await this.solanaOperator.initRound(
          roundSeedHex,
          params.bettingClosesAt,
        );

        if (result) {
          market.onChainInitialized = true;
          Logger.info("DuelBettingBridge", "On-chain market created", {
            duelId: params.duelId,
            closeSlot: result.closeSlot,
            oracleSig: result.initOracleSignature,
            marketSig: result.initMarketSignature,
          });
        }
      } catch (error) {
        Logger.error(
          "DuelBettingBridge",
          "Failed to create on-chain market",
          error instanceof Error ? error : null,
          { duelId: params.duelId },
        );
      }
    }

    if (existing) {
      return;
    }

    this.world.emit("betting:market:created", {
      duelId: params.duelId,
      market,
      source: params.source,
    });

    const remainingMs = Math.max(0, params.bettingClosesAt - Date.now());
    const lockTimer = setTimeout(() => {
      this.pendingTimeouts.delete(lockTimer);
      if (this.destroyed) {
        return;
      }
      void this.lockMarket(params.duelId).catch((error) => {
        Logger.error(
          "DuelBettingBridge",
          "Unexpected error in scheduled market lock",
          error instanceof Error ? error : null,
          { duelId: params.duelId },
        );
      });
    }, remainingMs);
    this.pendingTimeouts.add(lockTimer);
  }

  private async resolveMarket(
    market: DuelMarket,
    outcome: {
      winnerId: string;
      loserId: string;
      winnerName: string;
      loserName: string;
      duration?: number;
      seed: string | null;
      replayHash: string | null;
    },
  ): Promise<void> {
    if (market.status === "resolved" || market.status === "aborted") {
      return;
    }

    const winnerSide: "A" | "B" =
      outcome.winnerId === market.agent1Id ? "A" : "B";

    market.status = "resolved";
    market.winnerId = outcome.winnerId;
    market.winnerSide = winnerSide;

    Logger.info("DuelBettingBridge", "Resolving betting market", {
      duelId: market.duelId,
      duelKeyHex: market.duelKeyHex,
      winnerId: outcome.winnerId,
      winnerSide,
      winnerName: outcome.winnerName,
      loserName: outcome.loserName,
    });

    this.pushMarketHistory({ ...market });
    this.activeMarkets.delete(market.duelId);

    const resolveMarketDuelId = market.duelId;
    const resolveRoundSeedHex = market.roundSeedHex;
    const resolveWinnerId = outcome.winnerId;
    const resolveLoserId = outcome.loserId;
    const resolveWinnerName = outcome.winnerName;
    const resolveLoserName = outcome.loserName;
    const resolveDuration = outcome.duration;

    const resolveTimer = setTimeout(async () => {
      this.pendingTimeouts.delete(resolveTimer);
      if (this.destroyed) {
        return;
      }

      if (this.solanaOperator?.isEnabled()) {
        try {
          const resultHashHex = this.generateResultHash(
            resolveMarketDuelId,
            resolveWinnerId,
            resolveLoserId,
          );

          const metadataUri = `${config.metadataBaseUrl}/${resolveMarketDuelId}`;

          const result = await this.solanaOperator.reportAndResolve({
            roundSeedHex: resolveRoundSeedHex,
            winnerSide,
            resultHashHex,
            metadataUri,
          });

          if (result) {
            Logger.info("DuelBettingBridge", "On-chain market resolved", {
              duelId: resolveMarketDuelId,
              reportSig: result.reportSignature,
              resolveSig: result.resolveSignature,
            });
          }
        } catch (error) {
          Logger.error(
            "DuelBettingBridge",
            "Failed to resolve on-chain market",
            error instanceof Error ? error : null,
            { duelId: resolveMarketDuelId },
          );
        }
      }

      this.world.emit("betting:market:resolved", {
        duelId: resolveMarketDuelId,
        market,
        winnerId: resolveWinnerId,
        winnerSide,
        winnerName: resolveWinnerName,
        loserName: resolveLoserName,
        duration: resolveDuration,
      });
    }, config.resolutionDelayMs);
    this.pendingTimeouts.add(resolveTimer);
  }

  private startReconciliationLoop(): void {
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    this.scheduleNextReconciliation(0);
  }

  private ensureReconciliationLoop(): void {
    if (this.reconcileTimer) {
      return;
    }
    this.scheduleNextReconciliation(0);
  }

  private scheduleNextReconciliation(delayMs: number): void {
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
    }

    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      if (this.destroyed) return;
      void this.runScheduledReconciliation();
    }, delayMs);
  }

  private async runScheduledReconciliation(): Promise<void> {
    let shouldScheduleNext = true;
    let nextDelayMs = Math.max(config.reconcileIntervalMs * 5, 5000);
    try {
      await this.reconcileLiveCycle();
    } catch (error) {
      const scheduler = this.getStreamingDuelSchedulerFn();
      const cycle = scheduler?.getCurrentCycle();
      Logger.error(
        "DuelBettingBridge",
        "Streaming market reconciliation failed",
        error instanceof Error ? error : null,
        {
          duelId: cycle?.duelId ?? null,
          cycleId: cycle?.cycleId ?? null,
          phase: cycle?.phase ?? null,
          activeMarkets: this.activeMarkets.size,
        },
      );
    } finally {
      const scheduler = this.getStreamingDuelSchedulerFn();
      if (!scheduler && this.activeMarkets.size === 0) {
        shouldScheduleNext = false;
      } else {
        nextDelayMs = scheduler
          ? config.reconcileIntervalMs
          : Math.max(config.reconcileIntervalMs * 5, 5000);
      }
    }

    if (!shouldScheduleNext) {
      return;
    }

    this.scheduleNextReconciliation(nextDelayMs);
  }

  private async reconcileLiveCycleFrom(
    source: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.reconcileLiveCycle();
    } catch (error) {
      Logger.error(
        "DuelBettingBridge",
        "Streaming market reconciliation failed outside the scheduled loop",
        error instanceof Error ? error : null,
        {
          source,
          activeMarkets: this.activeMarkets.size,
          ...context,
        },
      );
    }
  }

  private async reconcileLiveCycle(): Promise<void> {
    // Dropping concurrent reconcile calls is safe: each invocation reads the
    // full current cycle state fresh from the scheduler, and the periodic
    // reconcileTimer ensures regular re-checks regardless of dropped
    // event-driven hints from streaming:fight:start or resolution lookups.
    if (this.reconcileInFlight) {
      return;
    }
    this.reconcileInFlight = true;
    try {
      const scheduler = this.getStreamingDuelSchedulerFn();
      const cycle = scheduler?.getCurrentCycle();
      if (!cycle?.duelId || !cycle.agent1 || !cycle.agent2) {
        return;
      }

      const market = this.activeMarkets.get(cycle.duelId);
      if (!market) {
        if (!canCreateMarketForStreamingPhase(cycle.phase)) {
          return;
        }
        await this.createOrSyncMarket({
          duelId: cycle.duelId,
          duelKeyHex: cycle.duelKeyHex ?? undefined,
          agent1Id: cycle.agent1.characterId,
          agent2Id: cycle.agent2.characterId,
          agent1Name: cycle.agent1.name,
          agent2Name: cycle.agent2.name,
          bettingClosesAt: cycle.betCloseTime ?? Date.now(),
          source: "streaming",
        });
        return;
      }

      if (
        (cycle.phase === "COUNTDOWN" || cycle.phase === "FIGHTING") &&
        market.status === "betting"
      ) {
        await this.lockMarket(cycle.duelId);
        return;
      }

      if (
        cycle.phase === "RESOLUTION" &&
        cycle.winnerId &&
        cycle.loserId &&
        market.status !== "resolved"
      ) {
        await this.resolveMarket(market, {
          winnerId: cycle.winnerId,
          loserId: cycle.loserId,
          winnerName:
            cycle.agent1?.characterId === cycle.winnerId
              ? cycle.agent1.name
              : cycle.agent2?.name || "Unknown",
          loserName:
            cycle.agent1?.characterId === cycle.loserId
              ? cycle.agent1.name
              : cycle.agent2?.name || "Unknown",
          duration:
            cycle.duelEndTime && cycle.cycleStartTime
              ? cycle.duelEndTime - cycle.cycleStartTime
              : undefined,
          seed: cycle.seed,
          replayHash: cycle.replayHash,
        });
      }
    } finally {
      this.reconcileInFlight = false;
    }
  }

  /**
   * Handle duel result event - resolve betting market
   */
  private async handleDuelResult(payload: unknown): Promise<void> {
    const data = parseDuelResultPayload(payload);
    if (!data) {
      warnInvalidBridgePayload(
        "duel:result",
        payload,
        "missing_required_fields",
      );
      return;
    }
    const winnerId = data.winnerId;
    const loserId = data.loserId;

    // Find the market by matching winner/loser to agents
    let market: DuelMarket | null = null;

    for (const m of this.activeMarkets.values()) {
      if (
        (m.agent1Id === winnerId && m.agent2Id === loserId) ||
        (m.agent1Id === loserId && m.agent2Id === winnerId)
      ) {
        market = m;
        break;
      }
    }

    if (!market) {
      // No market for this duel - might be a non-scheduled duel
      return;
    }

    await this.resolveMarket(market, {
      winnerId,
      loserId,
      winnerName: data.winnerName || "Unknown",
      loserName: data.loserName || "Unknown",
      duration: data.duration,
      seed: null,
      replayHash: null,
    });
  }

  private pushMarketHistory(market: DuelMarket): void {
    this.marketHistory.push(market);
    if (this.marketHistory.length > 100) {
      this.marketHistory.shift();
    }
  }

  private hasTerminalMarket(duelId: string): boolean {
    return this.marketHistory.some(
      (market) =>
        market.duelId === duelId &&
        (market.status === "resolved" || market.status === "aborted"),
    );
  }

  /**
   * Generate a 32-byte round seed from duel ID
   */
  private generateRoundSeed(duelId: string): string {
    const hash = createHash("sha256").update(`hyperia:duel:${duelId}`).digest();
    return hash.toString("hex");
  }

  /**
   * Generate result hash for on-chain verification
   */
  private generateResultHash(
    duelId: string,
    winnerId: string,
    loserId: string,
  ): string {
    const hash = createHash("sha256")
      .update(`hyperia:result:${duelId}:${winnerId}:${loserId}`)
      .digest();
    return hash.toString("hex");
  }
}

export default DuelBettingBridge;
