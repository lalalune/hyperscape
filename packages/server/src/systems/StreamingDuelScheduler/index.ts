/**
 * StreamingDuelScheduler - 15-minute duel cycle for streaming mode
 *
 * Thin facade that orchestrates three extracted managers:
 * - MatchmakingManager: agent registration, stats, pair selection, leaderboard
 * - CameraDirector: camera targeting, activity tracking, idle preview
 * - DuelOrchestrator: combat preparation, execution, cleanup, duel flags
 *
 * The facade owns:
 * - Lifecycle (init, destroy, start, stop)
 * - Tick loop and state machine (handleIdleState, tick, phase transitions)
 * - Event subscriptions (subscribeToEvents)
 * - Broadcasting (broadcastState, getStreamingState)
 */

import type { World } from "@hyperscape/shared";
import { EventType, DEFAULT_DUEL_RULES } from "@hyperscape/shared";
import crypto from "node:crypto";

/** Type for network with send method */
interface NetworkWithSend {
  send: <T>(name: string, data: T, ignoreSocketId?: string) => void;
  sendToSpectators?: <T>(name: string, data: T) => void;
}

function redactOracleProofFromStreamingState(
  state: StreamingStateUpdate,
): StreamingStateUpdate {
  return {
    ...state,
    cycle: {
      ...state.cycle,
      duelKeyHex: null,
      duelEndTime: null,
      seed: null,
      replayHash: null,
    },
  };
}

import { Logger } from "../ServerNetwork/services";
import { v4 as uuidv4 } from "uuid";
import { errMsg } from "../../shared/errMsg.js";

/** Log once if agent_mappings.streaming_duel_enabled cannot be read (e.g. migration not applied). */
let streamingDuelPrefReadWarningLogged = false;
import {
  type StreamingDuelCycle,
  type AgentContestant,
  type StreamingStateUpdate,
  type LeaderboardEntry,
  type RecentDuelEntry,
  type StreamingPhase,
  STREAMING_TIMING,
} from "./types.js";
import { MatchmakingManager } from "./managers/MatchmakingManager.js";
import { CameraDirector } from "./managers/CameraDirector.js";
import { DuelOrchestrator } from "./managers/DuelOrchestrator.js";
import { CycleStateMachine } from "./managers/CycleStateMachine.js";

// ============================================================================
// Configuration
// ============================================================================

const config = {
  /** Whether the streaming scheduler is enabled */
  enabled: process.env.STREAMING_DUEL_ENABLED !== "false",

  /** Check if maintenance mode is active (blocks new cycles) */
  isMaintenanceMode: (): boolean =>
    process.env.STREAMING_DUEL_MAINTENANCE_MODE === "true",

  /** Minimum agents required to run duels */
  minAgents: 2,

  /** How long to wait before retrying when insufficient agents (ms) */
  insufficientAgentsRetryInterval: 30_000,

  /** Maximum consecutive insufficient agent warnings before logging at error level */
  maxInsufficientAgentWarnings: 5,

  /** Max duel records to retain in memory for leaderboard/history APIs */
  maxRecentDuels: Math.max(
    20,
    Number.parseInt(process.env.STREAMING_RECENT_DUELS_MAX || "200", 10),
  ),

  /**
   * Persist duel win/loss stats to Postgres.
   * In stream uptime mode (DB_WRITE_ERRORS_NON_FATAL=true), default to disabled
   * to avoid transient DB transport faults taking down the game loop.
   */
  persistStatsToDatabase: (() => {
    const explicit = process.env.STREAMING_PERSIST_STATS;
    if (explicit != null && explicit.trim().length > 0) {
      const normalized = explicit.trim().toLowerCase();
      return !(
        normalized === "0" ||
        normalized === "false" ||
        normalized === "no" ||
        normalized === "off"
      );
    }
    return process.env.DB_WRITE_ERRORS_NON_FATAL !== "true";
  })(),

  /**
   * Max inactive agent stat records to retain in memory.
   * Active agents and current-cycle contestants are never evicted.
   */
  maxAgentStats: Math.max(
    64,
    Number.parseInt(process.env.STREAMING_AGENT_STATS_MAX || "512", 10),
  ),
};

const STREAMING_COMBAT_STALL_NUDGE_MS = Math.max(
  5_000,
  Number.parseInt(process.env.STREAMING_COMBAT_STALL_NUDGE_MS || "15000", 10),
);
const STREAMING_ALLOW_READY_SKIP =
  process.env.STREAMING_ALLOW_READY_SKIP === "true";

const clampNumber = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

// ============================================================================
// StreamingDuelScheduler Class (Thin Facade)
// ============================================================================

export class StreamingDuelScheduler {
  private readonly world: World;

  // ---- Managers ----
  private readonly matchmaking: MatchmakingManager;
  private readonly camera: CameraDirector;
  private readonly orchestrator: DuelOrchestrator;
  private readonly phaseStateMachine = new CycleStateMachine();

  // ---- Facade-owned state ----

  /** Current cycle state */
  private currentCycle: StreamingDuelCycle | null = null;

  /** Tick interval for state updates */
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  /** Broadcast interval for streaming state */
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;

  /** Countdown timeout for starting fight after countdown */
  private countdownTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Event listeners for cleanup */
  private eventListeners: Array<{
    event: string;
    fn: (...args: unknown[]) => void;
  }> = [];

  /** Fast fight broadcast interval (200ms during FIGHTING) (#11) */
  private fightBroadcastInterval: ReturnType<typeof setInterval> | null = null;

  /** Guard against concurrent startCountdown() invocations */
  private _startCountdownInProgress = false;

  /** Guard against concurrent endCycle() invocations (Fix M) */
  private _endCycleInProgress = false;

  /** Scheduler state for state machine */
  private schedulerState: "IDLE" | "WAITING_FOR_AGENTS" | "ACTIVE" = "IDLE";

  /** Whether a graceful restart is pending (waits for current duel to end) */
  private _pendingGracefulRestart = false;

  /** Embedded spar bots created from POST /admin/duels/debug-matchup (spawn mode). */
  private debugSparbotSpawnIds = new Set<string>();

  /** Standalone sparbots added to the matchmaking pool via /admin/sparbots. */
  private standaloneSparbotIds = new Set<string>();
  private standaloneSparbotMeta = new Map<
    string,
    { name: string; style: string; tier: string }
  >();

  // ---- Streaming State Cache (Memory Optimization) ----
  /** Cached streaming state to avoid recreating objects every 500ms */
  private _cachedStreamingState: StreamingStateUpdate | null = null;
  /** Last tick when streaming state was fully regenerated */
  private _lastStreamingStateTick = -1;
  /** Current game tick counter (updated by tick loop) */
  private _currentTick = 0;
  /** Last phase when state was generated (for cache invalidation) */
  private _lastStreamingStatePhase: StreamingPhase | null = null;
  /** Last cycle ID when state was generated */
  private _lastStreamingStateCycleId: string | null = null;
  /** Cached agent objects to avoid recreation (reused in getStreamingState) */
  private _cachedAgent1: StreamingStateUpdate["cycle"]["agent1"] = null;
  private _cachedAgent2: StreamingStateUpdate["cycle"]["agent1"] = null;
  /** Pre-allocated idle cycle object (reused when no active cycle) */
  private readonly _idleCycleObject: StreamingStateUpdate["cycle"] = {
    cycleId: "",
    phase: "IDLE",
    cycleStartTime: 0,
    phaseStartTime: 0,
    phaseEndTime: 0,
    phaseVersion: 0,
    timeRemaining: 0,
    agent1: null,
    agent2: null,
    duelId: null,
    duelKeyHex: null,
    betOpenTime: null,
    betCloseTime: null,
    countdown: null,
    fightStartTime: null,
    duelEndTime: null,
    arenaPositions: null,
    winnerId: null,
    winnerName: null,
    winReason: null,
    seed: null,
    replayHash: null,
  };
  /** Pre-allocated active cycle object (reused during active cycle) */
  private readonly _activeCycleObject: StreamingStateUpdate["cycle"] = {
    cycleId: "",
    phase: "IDLE",
    cycleStartTime: 0,
    phaseStartTime: 0,
    phaseEndTime: 0,
    phaseVersion: 0,
    timeRemaining: 0,
    agent1: null,
    agent2: null,
    duelId: null,
    duelKeyHex: null,
    betOpenTime: null,
    betCloseTime: null,
    countdown: null,
    fightStartTime: null,
    duelEndTime: null,
    arenaPositions: null,
    winnerId: null,
    winnerName: null,
    winReason: null,
    seed: null,
    replayHash: null,
  };
  /** Pre-allocated streaming state return object */
  private readonly _streamingStateObject: StreamingStateUpdate = {
    type: "STREAMING_STATE_UPDATE",
    cycle: this._idleCycleObject,
    leaderboard: [],
    cameraTarget: null,
  };

  constructor(world: World) {
    this.world = world;

    // -- Wire up managers --

    this.matchmaking = new MatchmakingManager(
      world,
      this.getDatabase.bind(this),
      {
        minAgents: config.minAgents,
        maxRecentDuels: config.maxRecentDuels,
        persistStatsToDatabase: config.persistStatsToDatabase,
        maxAgentStats: config.maxAgentStats,
        insufficientAgentsRetryInterval: config.insufficientAgentsRetryInterval,
        maxInsufficientAgentWarnings: config.maxInsufficientAgentWarnings,
      },
    );

    this.camera = new CameraDirector(
      world,
      () => this.matchmaking.availableAgents,
      () => this.currentCycle,
      () => this.matchmaking.nextDuelPair,
      (pair) => {
        this.matchmaking.nextDuelPair = pair;
        if (
          pair === null &&
          this.matchmaking.availableAgents.size >= config.minAgents
        ) {
          this.matchmaking.refreshNextDuelPair(Date.now());
        }
      },
    );

    this.orchestrator = new DuelOrchestrator(
      world,
      () => this.currentCycle,
      (fields) => {
        if (this.currentCycle) {
          if (fields.phase && fields.phase !== this.currentCycle.phase) {
            this.phaseStateMachine.transition(fields.phase as StreamingPhase);
            this.currentCycle.phaseVersion += 1;
          }
          Object.assign(this.currentCycle, fields);
        }
      },
      () => this.matchmaking.agentStats,
      (winnerId, loserId, winReason) =>
        this.handleResolution(winnerId, loserId, winReason),
      () => this.matchmaking.getLeaderboard(),
      () => this.matchmaking.getRecentDuels(),
    );

    // -- Wire matchmaking callbacks --

    this.matchmaking.setCallbacks({
      getCycleContestantIds: () => this.camera.getCycleContestantIds(),
      getCurrentCycleAgentDamage: (characterId: string) => {
        if (!this.currentCycle) return null;
        if (this.currentCycle.agent1?.characterId === characterId) {
          return {
            damageDealtThisFight: this.currentCycle.agent1.damageDealtThisFight,
          };
        }
        if (this.currentCycle.agent2?.characterId === characterId) {
          return {
            damageDealtThisFight: this.currentCycle.agent2.damageDealtThisFight,
          };
        }
        return null;
      },
      onAgentRegistered: (agentId: string, now: number) => {
        this.camera.ensureAgentActivity(agentId, now);
      },
      onAgentUnregistered: (agentId: string) => {
        this.camera.deleteAgentActivity(agentId);

        // Check if this agent is in an active duel - forfeit them
        if (
          this.currentCycle &&
          (this.currentCycle.phase === "FIGHTING" ||
            this.currentCycle.phase === "COUNTDOWN")
        ) {
          const { agent1, agent2 } = this.currentCycle;

          if (agent1?.characterId === agentId) {
            if (agent2) {
              Logger.info(
                "StreamingDuelScheduler",
                `${agent1.name} disconnected, ${agent2.name} wins by forfeit`,
              );
              this.orchestrator.stopCombatLoop();
              this.orchestrator.startResolution(
                agent2.characterId,
                agentId,
                "kill",
              );
            }
          } else if (agent2?.characterId === agentId) {
            if (agent1) {
              Logger.info(
                "StreamingDuelScheduler",
                `${agent2.name} disconnected, ${agent1.name} wins by forfeit`,
              );
              this.orchestrator.stopCombatLoop();
              this.orchestrator.startResolution(
                agent1.characterId,
                agentId,
                "kill",
              );
            }
          }
        }
      },
      onNextDuelPairChanged: (pair) => {
        if (pair) this.notifyOnDeckAgents();
      },
    });
  }

  private deriveStreamingDuelKeyHex(cycleId: string): string {
    return crypto
      .createHash("sha256")
      .update(`hyperscape-streaming-duel:${cycleId}`)
      .digest("hex");
  }

  // ============================================================================
  // Database Access
  // ============================================================================

  /** Get the database connection, or null. */
  private getDatabase():
    | import("drizzle-orm/node-postgres").NodePgDatabase
    | null {
    const databaseSystem = this.world.getSystem("database") as {
      getDb?: () => import("drizzle-orm/node-postgres").NodePgDatabase | null;
    } | null;
    return databaseSystem?.getDb?.() ?? null;
  }

  /**
   * Register for streaming duels only when `agent_mappings.streaming_duel_enabled` is true.
   * Missing DB row defaults to enabled.
   */
  private async registerAgentIfEligible(agentId: string): Promise<void> {
    const db = this.getDatabase();
    let enabled = true;
    if (db) {
      try {
        const { agentMappings } = await import("../../database/schema.js");
        const { eq, or } = await import("drizzle-orm");
        const rows = await db
          .select({ streamingDuelEnabled: agentMappings.streamingDuelEnabled })
          .from(agentMappings)
          .where(
            or(
              eq(agentMappings.characterId, agentId),
              eq(agentMappings.agentId, agentId),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (row && row.streamingDuelEnabled === false) {
          enabled = false;
        }
      } catch (err) {
        if (!streamingDuelPrefReadWarningLogged) {
          streamingDuelPrefReadWarningLogged = true;
          Logger.warn(
            "StreamingDuelScheduler",
            `Could not read agent streaming duel preference (${errMsg(err)}). ` +
              "If the column is missing, run `bun run db:migrate` in packages/server against the same DATABASE_URL as this server. Defaulting to duel-eligible.",
          );
        }
        enabled = true;
      }
    }

    if (!enabled) {
      this.matchmaking.markStreamingDuelOptOut(agentId, true);
      return;
    }

    this.matchmaking.markStreamingDuelOptOut(agentId, false);
    this.matchmaking.registerAgent(agentId);
  }

  /** Agents already in the world when the scheduler starts (same rules as PLAYER_JOINED). */
  private async scanForExistingAgentsWithEligibility(): Promise<void> {
    const entities = this.world.entities as {
      getAllEntities?: () => Map<string, unknown>;
    };

    if (!entities?.getAllEntities) {
      return;
    }

    const allEntities = entities.getAllEntities();
    let agentCount = 0;

    for (const [id, entity] of allEntities) {
      const entityAny = entity as {
        type?: string;
        isAgent?: boolean;
        isEmbeddedAgent?: boolean;
      };

      if (
        entityAny.type === "player" &&
        (entityAny.isAgent === true || entityAny.isEmbeddedAgent === true)
      ) {
        await this.registerAgentIfEligible(id);
        agentCount++;
      }
    }

    if (agentCount > 0) {
      Logger.info(
        "StreamingDuelScheduler",
        `Found ${agentCount} existing agent(s) during initialization`,
      );
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /** Start the streaming duel scheduler (alias for init) */
  start(): void {
    this.init();
  }

  /** Stop the streaming duel scheduler (alias for destroy) */
  stop(): void {
    this.destroy();
  }

  /** Get current cycle (public accessor) */
  getCurrentCycle(): StreamingDuelCycle | null {
    return this.currentCycle;
  }

  /**
   * Request a graceful server restart after the current duel ends.
   * The server will complete the current FIGHTING/RESOLUTION phase,
   * then trigger a SIGTERM to allow PM2 to restart it with new code.
   *
   * @returns Whether the restart was scheduled (false if already pending)
   */
  requestGracefulRestart(): boolean {
    if (this._pendingGracefulRestart) {
      Logger.info("StreamingDuelScheduler", "Graceful restart already pending");
      return false;
    }

    this._pendingGracefulRestart = true;
    const phase = this.currentCycle?.phase ?? "IDLE";

    if (phase === "IDLE" || phase === "ANNOUNCEMENT") {
      // No active duel, restart immediately
      Logger.info(
        "StreamingDuelScheduler",
        "No active duel, triggering immediate graceful restart",
      );
      this.triggerGracefulRestart();
    } else {
      Logger.info(
        "StreamingDuelScheduler",
        `Graceful restart scheduled after current duel (phase: ${phase})`,
      );
    }

    return true;
  }

  /**
   * Check if a graceful restart is pending
   */
  isPendingRestart(): boolean {
    return this._pendingGracefulRestart;
  }

  /**
   * Trigger the actual graceful restart by sending SIGTERM to self.
   * PM2 will handle the restart.
   */
  private triggerGracefulRestart(): void {
    Logger.info(
      "StreamingDuelScheduler",
      "Triggering graceful restart (SIGTERM)",
    );
    // Give a moment for logs to flush
    setTimeout(() => {
      process.kill(process.pid, "SIGTERM");
    }, 500);
  }

  /** Initialize the streaming duel scheduler */
  init(): void {
    if (!config.enabled) {
      Logger.info(
        "StreamingDuelScheduler",
        "Streaming duel scheduler disabled",
      );
      return;
    }

    Logger.info(
      "StreamingDuelScheduler",
      "Initializing streaming duel scheduler",
    );
    if (!config.persistStatsToDatabase) {
      Logger.info(
        "StreamingDuelScheduler",
        "Stats persistence disabled (STREAMING_PERSIST_STATS=false or DB_WRITE_ERRORS_NON_FATAL=true)",
      );
    }

    // Subscribe to player events to track agents
    this.subscribeToEvents();

    // Scan for any agents that were already spawned before we initialized
    void this.scanForExistingAgentsWithEligibility();

    // Start the main tick loop
    this.startTickLoop();

    // Start broadcasting state to viewers
    this.startStateBroadcast();

    Logger.info(
      "StreamingDuelScheduler",
      "Streaming duel scheduler initialized",
    );
  }

  /** Destroy the scheduler and cleanup */
  destroy(): void {
    // Clear duel flags immediately to avoid stale no-respawn states when scheduler stops mid-cycle.
    this.orchestrator.clearDuelFlagsForCycle(this.currentCycle);

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    this.stopFightBroadcast();

    if (this.countdownTimeout) {
      clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;
    }

    // Remove event listeners
    for (const { event, fn } of this.eventListeners) {
      this.world.off(event, fn);
    }
    this.eventListeners = [];

    // Reset facade state
    this._startCountdownInProgress = false;
    this._endCycleInProgress = false;
    this.schedulerState = "IDLE";
    this.currentCycle = null;
    this.phaseStateMachine.forceIdle();
    this.phaseStateMachine.removeAllListeners();

    // Reset managers
    this.orchestrator.reset();
    this.camera.reset();
    this.matchmaking.reset();
    this.debugSparbotSpawnIds.clear();

    Logger.info("StreamingDuelScheduler", "Streaming duel scheduler destroyed");
  }

  // ============================================================================
  // Event Subscriptions
  // ============================================================================

  private subscribeToEvents(): void {
    // Track agent spawns
    const onPlayerJoined = (payload: unknown) => {
      const data = payload as {
        playerId?: string;
        isEmbeddedAgent?: boolean;
        isAgent?: boolean;
      };

      if (data.playerId && (data.isEmbeddedAgent || data.isAgent)) {
        void this.registerAgentIfEligible(data.playerId);
      }
    };
    this.world.on(EventType.PLAYER_JOINED, onPlayerJoined);
    this.eventListeners.push({
      event: EventType.PLAYER_JOINED,
      fn: onPlayerJoined,
    });

    // Track agent leaves
    const onPlayerLeft = (payload: unknown) => {
      const data = payload as { playerId?: string };
      if (data.playerId) {
        this.matchmaking.unregisterAgent(data.playerId);
      }
    };
    this.world.on(EventType.PLAYER_LEFT, onPlayerLeft);
    this.eventListeners.push({
      event: EventType.PLAYER_LEFT,
      fn: onPlayerLeft,
    });

    // Track duel completions
    const onDuelCompleted = (payload: unknown) => {
      this.handleDuelCompleted(payload);
    };
    this.world.on("duel:completed", onDuelCompleted);
    this.eventListeners.push({ event: "duel:completed", fn: onDuelCompleted });

    // Track combat damage for duel stats
    const onCombatDamageDealt = (payload: unknown) => {
      this.handleEntityDamaged(payload);
    };
    this.world.on(EventType.COMBAT_DAMAGE_DEALT, onCombatDamageDealt);
    this.eventListeners.push({
      event: EventType.COMBAT_DAMAGE_DEALT,
      fn: onCombatDamageDealt,
    });

    // Track entity deaths
    const onEntityDeath = (payload: unknown) => {
      this.handleEntityDeath(payload);
    };
    this.world.on(EventType.ENTITY_DEATH, onEntityDeath);
    this.eventListeners.push({
      event: EventType.ENTITY_DEATH,
      fn: onEntityDeath,
    });
  }

  // ============================================================================
  // Public API Delegates
  // ============================================================================

  /**
   * Apply streaming duel participation from persisted preference (or DB PATCH).
   * `agentId` must be the in-world player / character id (same as PLAYER_JOINED `playerId`),
   * not the dashboard `agent_mappings.agent_id` mapping key.
   */
  applyStreamingDuelParticipation(agentId: string, enabled: boolean): void {
    if (!enabled) {
      this.matchmaking.markStreamingDuelOptOut(agentId, true);
      return;
    }
    this.matchmaking.markStreamingDuelOptOut(agentId, false);
    this.matchmaking.registerAgent(agentId);
  }

  /** Register an agent for duel scheduling */
  registerAgent(
    agentId: string,
    options?: { bypassStreamingDuelOptOut?: boolean },
  ): void {
    this.matchmaking.registerAgent(agentId, options);
  }

  /** Unregister an agent from duel scheduling */
  unregisterAgent(agentId: string): void {
    this.matchmaking.unregisterAgent(agentId);
  }

  /** Get leaderboard sorted by win rate */
  getLeaderboard(): LeaderboardEntry[] {
    return this.matchmaking.getLeaderboard();
  }

  /** Get recent duel history */
  getRecentDuels(limit: number = 30): RecentDuelEntry[] {
    return this.matchmaking.getRecentDuels(limit);
  }

  // ============================================================================
  // Main Tick Loop
  // ============================================================================

  private startTickLoop(): void {
    // Run tick every second
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);

    // Run first tick immediately
    this.tick();
  }

  private tick(): void {
    const now = Date.now();
    this.camera.refreshAgentActivity(now);

    // If no active cycle, check if we can start one
    if (!this.currentCycle) {
      this.handleIdleState(now);
      if (!this.currentCycle) {
        this.camera.syncIdlePreviewAndCamera(now);
        return;
      }
    }

    // Fix K — Watchdog for stuck phases. If any phase exceeds its generous
    // grace period, abort to IDLE rather than staying stuck forever.
    const phaseElapsed = now - this.currentCycle.phaseStartTime;
    // Reduced grace periods (10s instead of 30s) to fail faster on stuck phases
    const PHASE_TIMEOUT_MS: Partial<Record<StreamingPhase, number>> = {
      ANNOUNCEMENT: 10_000 + STREAMING_TIMING.ANNOUNCEMENT_DURATION,
      COUNTDOWN: 5_000 + STREAMING_TIMING.COUNTDOWN_DURATION,
      FIGHTING:
        10_000 +
        STREAMING_TIMING.FIGHTING_DURATION +
        STREAMING_TIMING.END_WARNING_DURATION,
      RESOLUTION: 10_000 + STREAMING_TIMING.RESOLUTION_DURATION,
    };
    const maxPhaseMs = PHASE_TIMEOUT_MS[this.currentCycle.phase];
    if (maxPhaseMs !== undefined && phaseElapsed > maxPhaseMs) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Watchdog: phase ${this.currentCycle.phase} stuck for ${Math.round(phaseElapsed / 1000)}s (max ${Math.round(maxPhaseMs / 1000)}s), aborting`,
      );
      this.abortCycleToIdle(
        `watchdog_${this.currentCycle.phase.toLowerCase()}_timeout`,
      );
      return;
    }

    // Process current phase
    switch (this.currentCycle.phase) {
      case "ANNOUNCEMENT":
        this.tickAnnouncement(now);
        break;
      case "COUNTDOWN":
        // Fix N — COUNTDOWN fallback. If fightStartTime has passed by >2s and
        // the countdownTimeout was lost (GC'd, cleared by accident), force-start.
        if (
          this.currentCycle.fightStartTime &&
          now > this.currentCycle.fightStartTime + 2000 &&
          this.countdownTimeout === null
        ) {
          Logger.warn(
            "StreamingDuelScheduler",
            "COUNTDOWN fallback: fightStartTime passed and countdownTimeout lost, force-starting fight",
          );
          this.doStartFight(now);
        }
        break;
      case "FIGHTING":
        this.tickFighting(now);
        break;
      case "RESOLUTION":
        this.tickResolution(now);
        break;
    }

    // Update camera target
    this.camera.updateCameraTarget(now);
  }

  // ============================================================================
  // State Machine Management
  // ============================================================================

  /**
   * Handle idle state - check if we can start a new cycle
   * Implements proper error handling and auto-recovery for insufficient agents
   */
  private handleIdleState(now: number): void {
    // Guard: don't start a new cycle while endCycle cleanup is still in flight
    if (this._endCycleInProgress) return;

    this.orchestrator.clearStaleDuelFlagsForIdleAgents(
      this.matchmaking.availableAgents,
    );

    // Check for maintenance mode - don't start new cycles during deployment
    if (config.isMaintenanceMode()) {
      this.schedulerState = "IDLE";
      return;
    }

    const agentCount = this.matchmaking.availableAgents.size;

    if (agentCount >= config.minAgents) {
      // Reset warning counter on success
      if (this.matchmaking.insufficientAgentWarningCount > 0) {
        Logger.info(
          "StreamingDuelScheduler",
          `Agent availability recovered: ${agentCount} agents now available`,
        );
        this.matchmaking.insufficientAgentWarningCount = 0;
      }

      // Transition to active state
      this.schedulerState = "ACTIVE";
      this.startNewCycle();
      return;
    }

    // Not enough agents - implement auto-recovery with logging
    this.schedulerState = "WAITING_FOR_AGENTS";

    // Throttle logging to avoid spam
    const timeSinceLastLog = now - this.matchmaking.lastInsufficientAgentsLog;
    if (timeSinceLastLog >= config.insufficientAgentsRetryInterval) {
      this.matchmaking.insufficientAgentWarningCount++;
      this.matchmaking.lastInsufficientAgentsLog = now;

      const message =
        `Insufficient agents for duel: ${agentCount}/${config.minAgents}. ` +
        `Waiting for agents to join... (check ${this.matchmaking.insufficientAgentWarningCount})`;

      if (
        this.matchmaking.insufficientAgentWarningCount >=
        config.maxInsufficientAgentWarnings
      ) {
        // Escalate to error after multiple warnings
        Logger.error(
          "StreamingDuelScheduler",
          `${message} Consider spawning more agents or checking agent spawner.`,
        );
      } else {
        Logger.warn("StreamingDuelScheduler", message);
      }

      // Emit event for external monitoring
      this.world.emit("streaming:waiting_for_agents", {
        currentAgents: agentCount,
        requiredAgents: config.minAgents,
        warningCount: this.matchmaking.insufficientAgentWarningCount,
      });
    }
  }

  // ============================================================================
  // Cycle Management
  // ============================================================================

  private startNewCycle(): void {
    // Guard: don't start a new cycle while endCycle cleanup is still in flight
    if (this._endCycleInProgress) {
      Logger.warn(
        "StreamingDuelScheduler",
        "startNewCycle blocked: endCycle cleanup still in progress",
      );
      return;
    }

    const cycleId = uuidv4();
    const now = Date.now();

    const agents = Array.from(this.matchmaking.availableAgents);

    // CRITICAL: Double-check agent count with error handling
    if (agents.length < config.minAgents) {
      Logger.error(
        "StreamingDuelScheduler",
        `startNewCycle called with insufficient agents: ${agents.length}/${config.minAgents}. ` +
          `This indicates a state machine bug.`,
      );
      this.schedulerState = "WAITING_FOR_AGENTS";
      return;
    }

    // Validate all agents still exist in the world before selection
    const validAgents = agents.filter((agentId) => {
      const entity = this.world.entities.get(agentId);
      if (!entity) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Agent ${agentId} no longer exists in world, removing from available list`,
        );
        this.matchmaking.availableAgents.delete(agentId);
        return false;
      }
      return true;
    });

    // Re-check after validation
    if (validAgents.length < config.minAgents) {
      Logger.warn(
        "StreamingDuelScheduler",
        `After validation, only ${validAgents.length} valid agents remain. Waiting for more.`,
      );
      this.schedulerState = "WAITING_FOR_AGENTS";
      return;
    }

    const selectedPair =
      this.matchmaking.consumePreselectedDuelPair(validAgents) ??
      this.matchmaking.chooseRandomPairFromPool(validAgents, now);
    const agent1Id = selectedPair?.agent1Id ?? null;
    const agent2Id = selectedPair?.agent2Id ?? null;

    // Validate: ensure different agents selected (safety check)
    if (!agent1Id || !agent2Id || agent1Id === agent2Id) {
      Logger.error(
        "StreamingDuelScheduler",
        "Could not select two distinct valid agents for a cycle",
      );
      return;
    }

    // Get agent data
    const agent1 = this.orchestrator.createContestant(agent1Id, agent2Id);
    const agent2 = this.orchestrator.createContestant(agent2Id, agent1Id);

    if (!agent1 || !agent2) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to create contestants: agent1=${!!agent1}, agent2=${!!agent2}`,
      );
      // Remove invalid agents from available list
      if (!agent1) this.matchmaking.availableAgents.delete(agent1Id);
      if (!agent2) this.matchmaking.availableAgents.delete(agent2Id);
      return;
    }

    this.phaseStateMachine.transition("ANNOUNCEMENT");
    const duelId = `streaming-${cycleId}`;
    const betOpenTime = now;
    const betCloseTime = now + STREAMING_TIMING.ANNOUNCEMENT_DURATION;
    this.currentCycle = {
      cycleId,
      phase: "ANNOUNCEMENT",
      cycleStartTime: now,
      phaseStartTime: now,
      phaseVersion: 1,
      agent1,
      agent2,
      duelId,
      duelKeyHex: this.deriveStreamingDuelKeyHex(cycleId),
      arenaId: null,
      betOpenTime,
      betCloseTime,
      countdownValue: null,
      fightStartTime: null,
      duelEndTime: null,
      arenaPositions: null,
      winnerId: null,
      loserId: null,
      winReason: null,
      seed: null,
      replayHash: null,
    };
    this.matchmaking.refreshNextDuelPair(now);
    this.notifyOnDeckAgents();

    // Mark agents as in a streaming duel immediately so their autonomous AI
    // won't make them attack each other or wander into combat during announcement.
    this.orchestrator.setDuelFlags(true);

    // Force-end any combat the selected agents are already in.
    this.orchestrator.forceStopAgentCombat(agent1.characterId);
    this.orchestrator.forceStopAgentCombat(agent2.characterId);

    // Restore full health immediately so the first broadcast shows full HP.
    this.orchestrator.restoreHealth(agent1.characterId);
    this.orchestrator.restoreHealth(agent2.characterId);

    // Set initial camera target
    this.camera.setCameraTarget(agent1.characterId, now);

    Logger.info(
      "StreamingDuelScheduler",
      `New cycle started: ${agent1.name} vs ${agent2.name}`,
    );

    // Emit announcement event
    this.world.emit("streaming:cycle:started", {
      cycleId,
      duelId,
      duelKeyHex: this.currentCycle.duelKeyHex,
      betOpenTime,
      betCloseTime,
      agent1: { id: agent1.characterId, name: agent1.name },
      agent2: { id: agent2.characterId, name: agent2.name },
    });

    this.world.emit("streaming:announcement:start", {
      cycleId,
      duelId,
      duelKeyHex: this.currentCycle.duelKeyHex,
      betOpenTime,
      betCloseTime,
      agent1: { id: agent1.characterId, name: agent1.name },
      agent2: { id: agent2.characterId, name: agent2.name },
      duration: STREAMING_TIMING.ANNOUNCEMENT_DURATION,
    });

    // Hyperbet / DuelBettingBridge: same payload shape as legacy DuelScheduler
    this.world.emit("duel:scheduled", {
      duelId,
      agent1Id: agent1.characterId,
      agent2Id: agent2.characterId,
      agent1Name: agent1.name,
      agent2Name: agent2.name,
      startTime: betCloseTime,
    });
  }

  /**
   * Notify on-deck agents that they are next up for a duel so they can prepare
   * (bank items, withdraw food, move to arena lobby).
   */
  private notifyOnDeckAgents(): void {
    const pair = this.matchmaking.nextDuelPair;
    if (!pair) return;

    const agent1Entity = this.world.entities.get(pair.agent1Id);
    const agent2Entity = this.world.entities.get(pair.agent2Id);
    const agent1Name =
      (agent1Entity?.data as { name?: string })?.name ?? "Unknown";
    const agent2Name =
      (agent2Entity?.data as { name?: string })?.name ?? "Unknown";

    this.world.emit("duel:on-deck", {
      agent1Id: pair.agent1Id,
      agent1Name,
      agent2Id: pair.agent2Id,
      agent2Name,
    });

    Logger.info(
      "StreamingDuelScheduler",
      `On-deck notification sent: ${agent1Name} vs ${agent2Name}`,
    );
  }

  // ============================================================================
  // Phase Handlers
  // ============================================================================

  private tickAnnouncement(now: number): void {
    if (!this.currentCycle) return;

    const elapsed = now - this.currentCycle.phaseStartTime;

    // Check if announcement phase is over
    if (elapsed >= STREAMING_TIMING.ANNOUNCEMENT_DURATION) {
      void this.startCountdown();
      return;
    }

    // Early-ready skipping shortens the advertised betting window and breaks
    // immutable oracle timing. Keep it opt-in only.
    if (
      STREAMING_ALLOW_READY_SKIP &&
      elapsed >= STREAMING_TIMING.MIN_ANNOUNCEMENT_DURATION
    ) {
      const { agent1, agent2 } = this.currentCycle;
      if (agent1 && agent2) {
        const entity1 = this.world.entities.get(agent1.characterId);
        const entity2 = this.world.entities.get(agent2.characterId);
        const alive1 =
          entity1 && ((entity1.data as { health?: number }).health ?? 0) > 0;
        const alive2 =
          entity2 && ((entity2.data as { health?: number }).health ?? 0) > 0;
        if (alive1 && alive2) {
          void this.startCountdown();
        }
      }
    }
  }

  private async startCountdown(): Promise<void> {
    if (
      !this.currentCycle ||
      !this.currentCycle.agent1 ||
      !this.currentCycle.agent2
    ) {
      return;
    }

    // Guard against re-entry if phase already changed.
    if (this.currentCycle.phase !== "ANNOUNCEMENT") {
      return;
    }

    // Prevent concurrent invocations from overlapping ticks (Fix A).
    if (this._startCountdownInProgress) return;
    this._startCountdownInProgress = true;
    try {
      Logger.info(
        "StreamingDuelScheduler",
        "Preparing contestants for countdown",
      );

      // Duel flags are already set at ANNOUNCEMENT start (startNewCycle), but
      // re-apply as a safety net in case they were cleared by recovery logic.
      this.orchestrator.setDuelFlags(true);

      // Prepare contestants (fill food, restore HP) but NOT teleport yet.
      // Fix J — timeout wrapper so prep can't block forever.
      const PREP_TIMEOUT_MS = Math.max(
        5_000,
        Number.parseInt(process.env.STREAMING_PREP_TIMEOUT_MS || "30000", 10) ||
          30_000,
      );
      try {
        await Promise.race([
          this.orchestrator.prepareContestantsForDuel(),
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error("Prep timed out")),
              PREP_TIMEOUT_MS,
            ),
          ),
        ]);
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Contestant prep failed: ${errMsg(err)}`,
        );
        this.abortCycleToIdle("contestant_prep_failed");
        return;
      }

      // Scheduler may have advanced/ended while awaiting prep.
      if (!this.currentCycle || this.currentCycle.phase !== "ANNOUNCEMENT") {
        return;
      }

      // Fix I — Re-validate both agents exist and are alive after async prep.
      const postPrepEntity1 = this.currentCycle.agent1
        ? this.world.entities.get(this.currentCycle.agent1.characterId)
        : null;
      const postPrepEntity2 = this.currentCycle.agent2
        ? this.world.entities.get(this.currentCycle.agent2.characterId)
        : null;
      const postPrepAlive1 =
        postPrepEntity1 &&
        ((postPrepEntity1.data as { health?: number }).health ?? 0) > 0;
      const postPrepAlive2 =
        postPrepEntity2 &&
        ((postPrepEntity2.data as { health?: number }).health ?? 0) > 0;

      if (!postPrepAlive1 && !postPrepAlive2) {
        this.abortCycleToIdle("both_agents_lost_during_prep");
        return;
      }
      if (!postPrepAlive1 && this.currentCycle.agent2) {
        this.orchestrator.startResolution(
          this.currentCycle.agent2.characterId,
          this.currentCycle.agent1?.characterId ?? "",
          "kill",
        );
        return;
      }
      if (!postPrepAlive2 && this.currentCycle.agent1) {
        this.orchestrator.startResolution(
          this.currentCycle.agent1.characterId,
          this.currentCycle.agent2?.characterId ?? "",
          "kill",
        );
        return;
      }

      // Teleport agents to arena NOW — right as countdown begins.
      try {
        await this.orchestrator.teleportToArena(
          this.currentCycle.agent1.characterId,
          this.currentCycle.agent2.characterId,
        );
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `Failed to teleport contestants into arena: ${errMsg(err)}`,
        );
        this.abortCycleToIdle("arena_teleport_failed");
        return;
      }

      if (!this.currentCycle || this.currentCycle.phase !== "ANNOUNCEMENT") {
        return;
      }

      // Ensure stale pathing state does not pull contestants away after teleport.
      this.world.emit("player:movement:cancel", {
        playerId: this.currentCycle.agent1.characterId,
      });
      this.world.emit("player:movement:cancel", {
        playerId: this.currentCycle.agent2.characterId,
      });

      // Notify agent plugins that a duel session is starting so they enter duel mode
      // (pause autonomous behavior, save goals, stop movement).
      const streamingDuelId = `streaming-${this.currentCycle.cycleId}`;
      this.world.emit(EventType.DUEL_SESSION_CREATED, {
        duelId: streamingDuelId,
        challengerId: this.currentCycle.agent1.characterId,
        challengerName: this.currentCycle.agent1.name,
        targetId: this.currentCycle.agent2.characterId,
        targetName: this.currentCycle.agent2.name,
      });

      // Transition to COUNTDOWN.
      const now = Date.now();
      const fightStartTime = now + STREAMING_TIMING.COUNTDOWN_DURATION;

      this.phaseStateMachine.transition("COUNTDOWN");
      this.currentCycle.phase = "COUNTDOWN";
      this.currentCycle.phaseStartTime = now;
      this.currentCycle.phaseVersion += 1;
      this.currentCycle.betCloseTime = Math.min(
        this.currentCycle.betCloseTime ?? fightStartTime,
        fightStartTime,
      );
      this.currentCycle.fightStartTime = fightStartTime;
      this.currentCycle.countdownValue = null;
      this.camera.setCameraTarget(
        this.currentCycle.agent1?.characterId ?? null,
        now,
      );

      Logger.info("StreamingDuelScheduler", "Starting countdown");

      // Force immediate broadcast so clients see COUNTDOWN state.
      this.broadcastState();

      // Schedule startFight after the countdown duration.
      if (this.countdownTimeout) {
        clearTimeout(this.countdownTimeout);
      }
      this.countdownTimeout = setTimeout(() => {
        this.countdownTimeout = null;
        this.doStartFight(Date.now());
      }, STREAMING_TIMING.COUNTDOWN_DURATION);
    } finally {
      this._startCountdownInProgress = false;
    }
  }

  /**
   * Wrapper that calls orchestrator.startFight() and handles facade-owned
   * camera logic around the fight start transition.
   */
  private doStartFight(now: number): void {
    if (!this.currentCycle || this.currentCycle.phase !== "COUNTDOWN") {
      return;
    }

    // Both-dead check: abort if neither agent is alive (startFight just returns).
    const { agent1, agent2 } = this.currentCycle;
    const entity1 = agent1 ? this.world.entities.get(agent1.characterId) : null;
    const entity2 = agent2 ? this.world.entities.get(agent2.characterId) : null;
    const alive1 =
      entity1 && ((entity1.data as { health?: number }).health ?? 0) > 0;
    const alive2 =
      entity2 && ((entity2.data as { health?: number }).health ?? 0) > 0;
    if (!alive1 && !alive2) {
      this.abortCycleToIdle("both_agents_missing");
      return;
    }

    // Reset camera cutaway tracking for the new fight phase.
    this.camera.resetFightCutawayTracking();

    // Delegate fight start to orchestrator (handles phase transition, duel flags,
    // health restore, emit, combat initiation, combat AIs).
    this.orchestrator.startFight();

    // If the orchestrator transitioned to FIGHTING, set camera target and start fast broadcast.
    // Re-read cycle since startFight() mutates phase via setCurrentCycleFields.
    const cycleAfterFight = this.currentCycle;
    if (
      cycleAfterFight &&
      (cycleAfterFight.phase as StreamingPhase) === "FIGHTING"
    ) {
      this.camera.setCameraTarget(
        cycleAfterFight.agent1?.characterId ?? null,
        now,
      );
      // Start fast 200ms broadcast for fight phase (#11)
      this.startFightBroadcast();
    }
  }

  private tickFighting(now: number): void {
    if (!this.currentCycle) return;

    const elapsed = now - this.currentCycle.phaseStartTime;
    const totalFightDuration =
      STREAMING_TIMING.FIGHTING_DURATION +
      STREAMING_TIMING.END_WARNING_DURATION;

    // Check for end warning
    if (
      elapsed >= STREAMING_TIMING.FIGHTING_DURATION &&
      elapsed < totalFightDuration
    ) {
      // In end warning phase
      const remaining = totalFightDuration - elapsed;
      if (remaining <= 30000 && remaining > 29000) {
        this.world.emit("streaming:fight:end_warning", {
          cycleId: this.currentCycle.cycleId,
          secondsRemaining: Math.ceil(remaining / 1000),
        });
      }
    }

    // Check if fight time is up
    if (elapsed >= totalFightDuration) {
      this.orchestrator.endFightByTimeout();
    }

    // Update HP from entities and feed damage hits to camera director
    const hpDeltas = this.orchestrator.updateContestantHp();
    if (hpDeltas && this.currentCycle) {
      const { hpLost1, hpLost2, maxHp1, maxHp2 } = hpDeltas;
      if (hpLost1 > 0 && this.currentCycle.agent1) {
        this.camera.onCombatHit(
          this.currentCycle.agent1.characterId,
          hpLost1 / Math.max(1, maxHp1),
          now,
        );
      }
      if (hpLost2 > 0 && this.currentCycle.agent2) {
        this.camera.onCombatHit(
          this.currentCycle.agent2.characterId,
          hpLost2 / Math.max(1, maxHp2),
          now,
        );
      }
    }

    // Fallback: nudge stalled fights so the stream cycle still progresses even
    // when combat start hooks fail in this tick window.
    if (elapsed >= STREAMING_COMBAT_STALL_NUDGE_MS) {
      this.orchestrator.applyCombatStallNudge(now);
    }
  }

  private tickResolution(now: number): void {
    if (!this.currentCycle) return;

    const elapsed = now - this.currentCycle.phaseStartTime;

    // Check if resolution phase is over
    if (elapsed >= STREAMING_TIMING.RESOLUTION_DURATION) {
      this.endCycle();
    }
  }

  // ============================================================================
  // Resolution Handling (callback from DuelOrchestrator)
  // ============================================================================

  private buildOracleProof(
    cycle: StreamingDuelCycle,
    winnerId: string,
    loserId: string,
    winReason: "kill" | "hp_advantage" | "damage_advantage" | "draw",
    finishedAt: number,
  ): { duelKeyHex: string | null; seed: string; replayHash: string } {
    const duelId = cycle.duelId ?? `streaming-${cycle.cycleId}`;
    const fightStartedAt = cycle.fightStartTime ?? cycle.cycleStartTime;
    const duelSeedHex = crypto
      .createHash("sha256")
      .update(`${duelId}-${fightStartedAt}`)
      .digest("hex")
      .slice(0, 16);
    const seed = BigInt(`0x${duelSeedHex}`).toString();
    const replayHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          duelId,
          cycleId: cycle.cycleId,
          winnerId,
          loserId,
          winReason,
          fightStartedAt,
          finishedAt,
          damageWinner:
            cycle.agent1?.characterId === winnerId
              ? cycle.agent1.damageDealtThisFight
              : (cycle.agent2?.damageDealtThisFight ?? 0),
          damageLoser:
            cycle.agent1?.characterId === loserId
              ? cycle.agent1.damageDealtThisFight
              : (cycle.agent2?.damageDealtThisFight ?? 0),
        }),
      )
      .digest("hex");
    // Return the duel key alongside seed + replayHash so the proof is
    // self-contained. Callers that persist the proof must not rely on
    // cycle.duelKeyHex still being populated at write time — the cycle can
    // be cleared by shutdown or phase-reset before persistence completes.
    return { duelKeyHex: cycle.duelKeyHex ?? null, seed, replayHash };
  }

  /**
   * Handle resolution when DuelOrchestrator calls onResolution.
   * This is the facade's responsibility: phase transition, stats, recording, camera.
   */
  private handleResolution(
    winnerId: string,
    loserId: string,
    winReason: "kill" | "hp_advantage" | "damage_advantage" | "draw",
  ): void {
    if (!this.currentCycle) return;

    // Idempotency guard — only transition from FIGHTING or COUNTDOWN (Fix C).
    if (
      this.currentCycle.phase !== "FIGHTING" &&
      this.currentCycle.phase !== "COUNTDOWN"
    ) {
      return;
    }

    // Stop fast fight broadcast (#11)
    this.stopFightBroadcast();

    // Clear countdown timeout if still pending (e.g. forfeit during countdown).
    if (this.countdownTimeout) {
      clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;
    }

    const now = Date.now();
    this.phaseStateMachine.transition("RESOLUTION");
    this.currentCycle.phase = "RESOLUTION";
    this.currentCycle.phaseStartTime = now;
    this.currentCycle.phaseVersion += 1;
    this.currentCycle.duelEndTime = now;
    this.currentCycle.winnerId = winnerId;
    this.currentCycle.loserId = loserId;
    this.currentCycle.winReason = winReason;
    const oracleProof = this.buildOracleProof(
      this.currentCycle,
      winnerId,
      loserId,
      winReason,
      now,
    );
    this.currentCycle.seed = oracleProof.seed;
    this.currentCycle.replayHash = oracleProof.replayHash;
    // If the cycle's duelKeyHex was somehow cleared, recover it from the
    // self-contained proof so persistence below is consistent.
    if (!this.currentCycle.duelKeyHex && oracleProof.duelKeyHex) {
      this.currentCycle.duelKeyHex = oracleProof.duelKeyHex;
    }

    // Update stats — draws don't affect win/loss/streaks (#24)
    if (winReason === "draw") {
      this.matchmaking.updateDrawStats(winnerId, loserId);
    } else {
      this.matchmaking.updateStats(winnerId, loserId);
    }

    // Get winner/loser names
    const winnerName =
      this.currentCycle.agent1?.characterId === winnerId
        ? this.currentCycle.agent1.name
        : this.currentCycle.agent2?.name || "Unknown";
    const loserName =
      this.currentCycle.agent1?.characterId === loserId
        ? this.currentCycle.agent1.name
        : this.currentCycle.agent2?.name || "Unknown";
    this.matchmaking.recordRecentDuel({
      cycleId: this.currentCycle.cycleId,
      duelId: this.currentCycle.duelId,
      finishedAt: now,
      winnerId,
      winnerName,
      loserId,
      loserName,
      winReason,
      damageWinner:
        this.currentCycle.agent1?.characterId === winnerId
          ? this.currentCycle.agent1.damageDealtThisFight
          : (this.currentCycle.agent2?.damageDealtThisFight ?? 0),
      damageLoser:
        this.currentCycle.agent1?.characterId === loserId
          ? this.currentCycle.agent1.damageDealtThisFight
          : (this.currentCycle.agent2?.damageDealtThisFight ?? 0),
      // Oracle proof — needed by the keeper result-catch-up endpoint so a
      // missed onDuelEnd event can still be replayed to resolve the bundle.
      duelKeyHex: this.currentCycle.duelKeyHex ?? null,
      duelEndTime: this.currentCycle.duelEndTime ?? null,
      seed: this.currentCycle.seed ?? null,
      replayHash: this.currentCycle.replayHash ?? null,
    });

    // Pull per-fight AI stats (attacksLanded, healsUsed) captured in stopCombatAIs
    const lastFightStats = this.orchestrator.getLastFightStats();
    if (this.currentCycle.agent1) {
      const s = lastFightStats.get(this.currentCycle.agent1.characterId);
      if (s) {
        this.currentCycle.agent1.attacksLanded = s.attacksLanded;
        this.currentCycle.agent1.healsUsed = s.healsUsed;
      }
    }
    if (this.currentCycle.agent2) {
      const s = lastFightStats.get(this.currentCycle.agent2.characterId);
      if (s) {
        this.currentCycle.agent2.attacksLanded = s.attacksLanded;
        this.currentCycle.agent2.healsUsed = s.healsUsed;
      }
    }

    Logger.info(
      "StreamingDuelScheduler",
      `Fight ended: ${winnerName} wins by ${winReason}`,
    );

    // Emit resolution event (spectator UI)
    this.world.emit("streaming:resolution:start", {
      cycleId: this.currentCycle.cycleId,
      duelId:
        this.currentCycle.duelId ?? `streaming-${this.currentCycle.cycleId}`,
      duelKeyHex: this.currentCycle.duelKeyHex,
      duelEndTime: now,
      winnerId,
      loserId,
      winnerName,
      loserName,
      winReason,
      seed: oracleProof.seed,
      replayHash: oracleProof.replayHash,
    });

    // Emit standard duel completed so agent plugins exit duel mode.
    // The duel-events listener sends duelCompleted to both agent sockets.
    const a1 = this.currentCycle.agent1?.characterId ?? "";
    const a2 = this.currentCycle.agent2?.characterId ?? "";
    this.world.emit(EventType.DUEL_COMPLETED, {
      duelId:
        this.currentCycle.duelId ?? `streaming-${this.currentCycle.cycleId}`,
      winnerId,
      winnerName,
      loserId,
      loserName,
      reason: "death",
      seed: oracleProof.seed,
      replayHash: oracleProof.replayHash,
      forfeit: false,
      winnerReceives: [],
      winnerReceivesValue: 0,
      challengerStakes: [],
      targetStakes: [],
      challengerId: a1,
      opponentId: a2,
      challengerStakeValue: 0,
      opponentStakeValue: 0,
      summary: {
        duration: now - (this.currentCycle.cycleStartTime ?? now),
        rules: DEFAULT_DUEL_RULES,
        challengerStakeValue: 0,
        targetStakeValue: 0,
      },
    });

    // Set camera to winner
    this.camera.finishFightCutawayTracking(now);
    this.camera.setCameraTarget(winnerId, now);

    // NOTE: cleanupAfterDuel() (health restore, food removal, teleport out) is
    // deferred to endCycle() so the death animation plays during the RESOLUTION
    // phase before agents are teleported out of the arena.
  }

  // ============================================================================
  // Cycle End
  // ============================================================================

  private endCycle(): void {
    if (!this.currentCycle) return;

    // Fix M — guard against re-entry
    if (this._endCycleInProgress) return;
    const cycleSnapshot = this.currentCycle;
    this._endCycleInProgress = true;

    try {
      const now = Date.now();
      const winnerId = cycleSnapshot.winnerId;
      const loserId = cycleSnapshot.loserId;
      const cycleAgent1Id = cycleSnapshot.agent1?.characterId ?? null;
      const cycleAgent2Id = cycleSnapshot.agent2?.characterId ?? null;

      // Snapshot duel food slots before clearing
      const duelFoodSlotsMap = this.orchestrator.getDuelFoodSlotsByAgent();
      const duelFoodSlotsSnapshotByAgent = new Map<
        string,
        Array<{ slot: number; itemId: string }>
      >();
      if (cycleAgent1Id) {
        duelFoodSlotsSnapshotByAgent.set(cycleAgent1Id, [
          ...(duelFoodSlotsMap.get(cycleAgent1Id) ?? []),
        ]);
        duelFoodSlotsMap.delete(cycleAgent1Id);
      }
      if (cycleAgent2Id) {
        duelFoodSlotsSnapshotByAgent.set(cycleAgent2Id, [
          ...(duelFoodSlotsMap.get(cycleAgent2Id) ?? []),
        ]);
        duelFoodSlotsMap.delete(cycleAgent2Id);
      }

      Logger.info(
        "StreamingDuelScheduler",
        `Cycle ${cycleSnapshot.cycleId} ended. Winner: ${winnerId || "none"}`,
      );

      // Emit cycle end
      this.world.emit("streaming:resolution:end", {
        cycleId: cycleSnapshot.cycleId,
        duelId: cycleSnapshot.duelId,
        duelKeyHex: cycleSnapshot.duelKeyHex,
        winnerId,
        loserId,
      });
      this.camera.finishFightCutawayTracking(now);

      // NOTE: Duel flags (inStreamingDuel, preventRespawn) are intentionally NOT
      // cleared here. They stay `true` until cleanupAfterDuel() teleports both
      // agents out of the arena and then clears them via microtask. Clearing
      // flags before the cleanup teleport creates a race condition where
      // DuelSystem.ejectNonDuelingPlayersFromCombatArenas() sees the agents
      // still in the arena with inStreamingDuel=false and emits a spurious
      // extra teleport (causing duplicate teleport VFX).

      // Clear current cycle
      this.currentCycle = null;

      // Transition phase state machine back to IDLE
      this.phaseStateMachine.forceIdle();
      this.schedulerState = "IDLE";

      // Await cleanup, then start next cycle after an inter-cycle delay.
      // This prevents stale avatars from lingering in the arena — cleanup
      // must complete before re-selecting agents for the next duel.
      this.orchestrator
        .cleanupAfterDuel(cycleSnapshot, duelFoodSlotsSnapshotByAgent)
        .catch((err) => {
          Logger.warn(
            "StreamingDuelScheduler",
            `cleanupAfterDuel failed: ${err instanceof Error ? err.message : String(err)}. Clearing duel food tracking and flags as fallback.`,
          );
          this.orchestrator.clearDuelFlagsForCycleIfInactive(cycleSnapshot);
        })
        .finally(() => {
          // Wait for inter-cycle delay so spectators see a clean arena reset
          setTimeout(() => {
            this._endCycleInProgress = false;

            // Check for pending graceful restart
            if (this._pendingGracefulRestart) {
              Logger.info(
                "StreamingDuelScheduler",
                "Duel cycle complete, triggering pending graceful restart",
              );
              this.triggerGracefulRestart();
              return;
            }

            // Start new cycle if enough agents are available
            if (this.matchmaking.availableAgents.size >= config.minAgents) {
              this.schedulerState = "ACTIVE";
              this.startNewCycle();
            } else {
              this.schedulerState = "WAITING_FOR_AGENTS";
              Logger.info(
                "StreamingDuelScheduler",
                `Waiting for agents after cycle end: ${this.matchmaking.availableAgents.size}/${config.minAgents}`,
              );
            }
          }, STREAMING_TIMING.INTER_CYCLE_DELAY_MS);
        });
    } catch (err) {
      Logger.error(
        "StreamingDuelScheduler",
        "endCycle failed during synchronous transition",
        err instanceof Error ? err : null,
        {
          cycleId: cycleSnapshot.cycleId,
          duelId: cycleSnapshot.duelId,
        },
      );

      try {
        this.orchestrator.clearDuelFlagsForCycleIfInactive(cycleSnapshot);
      } catch (cleanupErr) {
        Logger.warn(
          "StreamingDuelScheduler",
          `endCycle fallback flag cleanup failed: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
        );
      }

      if (this.currentCycle === cycleSnapshot) {
        this.currentCycle = null;
      }
      try {
        this.phaseStateMachine.forceIdle();
      } catch (phaseErr) {
        Logger.warn(
          "StreamingDuelScheduler",
          `endCycle fallback phase reset failed: ${phaseErr instanceof Error ? phaseErr.message : String(phaseErr)}`,
        );
      }
      this.schedulerState = "IDLE";
      this._endCycleInProgress = false;
    }
  }

  /**
   * Abort the current cycle and return to IDLE state.
   * Used when both agents are missing or an unrecoverable error occurs mid-cycle.
   */
  private abortCycleToIdle(reason: string): void {
    Logger.warn("StreamingDuelScheduler", `Aborting cycle to IDLE: ${reason}`);
    const cycleSnapshot = this.currentCycle;

    this.orchestrator.stopCombatLoop();
    this.orchestrator.clearCombatRetryTimeout();
    this.orchestrator.stopCombatAIs();
    this.stopFightBroadcast();

    if (this.countdownTimeout) {
      clearTimeout(this.countdownTimeout);
      this.countdownTimeout = null;
    }

    if (cycleSnapshot) {
      this.world.emit("streaming:cycle:aborted", {
        cycleId: cycleSnapshot.cycleId,
        duelId: cycleSnapshot.duelId,
        duelKeyHex: cycleSnapshot.duelKeyHex,
        reason,
        agent1Id: cycleSnapshot.agent1?.characterId ?? null,
        agent2Id: cycleSnapshot.agent2?.characterId ?? null,
        agent1Name: cycleSnapshot.agent1?.name ?? null,
        agent2Name: cycleSnapshot.agent2?.name ?? null,
      });

      // Teleport any agents that were already sent to the arena back to their
      // original positions so they don't appear as ghost units in the next cycle.
      for (const agent of [cycleSnapshot.agent1, cycleSnapshot.agent2]) {
        if (!agent) continue;
        const restorePos = this.orchestrator.sanitizeRestorePosition(
          agent.originalPosition,
          agent.characterId,
        );
        this.orchestrator.teleportPlayer(
          agent.characterId,
          restorePos,
          undefined,
          true, // suppressEffect — this is cleanup, not a dramatic teleport
        );
        this.orchestrator.stopCombat(agent.characterId);
      }
    }

    this.orchestrator.clearDuelFlagsForCycle(cycleSnapshot);
    this.orchestrator.getDuelFoodSlotsByAgent().clear();
    this.currentCycle = null;
    this._endCycleInProgress = false;
    this.phaseStateMachine.forceIdle();
    this.schedulerState = "IDLE";
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private handleDuelCompleted(payload: unknown): void {
    const data = payload as {
      duelId?: string;
      winnerId?: string;
      loserId?: string;
    };

    if (!this.currentCycle || this.currentCycle.phase !== "FIGHTING") {
      return;
    }

    // Check if this is our duel
    if (
      data.winnerId === this.currentCycle.agent1?.characterId ||
      data.winnerId === this.currentCycle.agent2?.characterId
    ) {
      const winnerId = data.winnerId!;
      const loserId =
        winnerId === this.currentCycle.agent1?.characterId
          ? this.currentCycle.agent2?.characterId
          : this.currentCycle.agent1?.characterId;

      if (loserId) {
        this.orchestrator.startResolution(winnerId, loserId, "kill");
      }
    }
  }

  private handleEntityDamaged(payload: unknown): void {
    const data = payload as {
      entityId?: string;
      targetId?: string;
      sourceId?: string;
      attackerId?: string;
      damage?: number;
    };

    const attackerId = data.attackerId || data.sourceId;
    const targetId = data.targetId || data.entityId;
    if (!attackerId || !targetId) return;

    const now = Date.now();
    const damage = Number(data.damage);
    const intensity = Number.isFinite(damage)
      ? clampNumber(damage / 6, 0.4, 5.5)
      : 0.8;
    this.camera.markAgentInteresting(attackerId, intensity, now);
    this.camera.markAgentInteresting(targetId, intensity * 0.7, now);

    if (!this.currentCycle || this.currentCycle.phase !== "FIGHTING") {
      return;
    }

    if (!Number.isFinite(damage) || damage <= 0) {
      return;
    }

    // Update damage dealt and highest hit for the attacker
    if (
      attackerId === this.currentCycle.agent1?.characterId &&
      targetId === this.currentCycle.agent2?.characterId
    ) {
      this.currentCycle.agent1.damageDealtThisFight += damage;
      if (damage > this.currentCycle.agent1.highestHit) {
        this.currentCycle.agent1.highestHit = damage;
      }
    } else if (
      attackerId === this.currentCycle.agent2?.characterId &&
      targetId === this.currentCycle.agent1?.characterId
    ) {
      this.currentCycle.agent2.damageDealtThisFight += damage;
      if (damage > this.currentCycle.agent2.highestHit) {
        this.currentCycle.agent2.highestHit = damage;
      }
    }

    // Sync target HP immediately so the next broadcast reflects current health
    // (don't wait for the next tickFighting → updateContestantHp cycle).
    const targetEntity = this.world.entities.get(targetId);
    if (targetEntity) {
      const targetData = targetEntity.data as { health?: number };
      const freshHp = targetData.health;
      if (typeof freshHp === "number" && Number.isFinite(freshHp)) {
        if (this.currentCycle.agent1?.characterId === targetId) {
          this.currentCycle.agent1.currentHp = freshHp;
        } else if (this.currentCycle.agent2?.characterId === targetId) {
          this.currentCycle.agent2.currentHp = freshHp;
        }
      }
    }
  }

  private handleEntityDeath(payload: unknown): void {
    const data = payload as {
      entityId?: string;
      killedBy?: string;
    };

    const now = Date.now();
    if (data.killedBy) {
      this.camera.markAgentInteresting(data.killedBy, 4.2, now);
    }
    if (data.entityId) {
      this.camera.markAgentInteresting(data.entityId, 1.2, now);
    }

    // Handle deaths during both FIGHTING and COUNTDOWN phases (Fix F).
    if (
      !this.currentCycle ||
      (this.currentCycle.phase !== "FIGHTING" &&
        this.currentCycle.phase !== "COUNTDOWN")
    ) {
      return;
    }

    if (!data.entityId) return;

    // Check if one of our contestants died
    if (
      data.entityId === this.currentCycle.agent1?.characterId ||
      data.entityId === this.currentCycle.agent2?.characterId
    ) {
      const loserId = data.entityId;
      const winnerId =
        loserId === this.currentCycle.agent1?.characterId
          ? this.currentCycle.agent2?.characterId
          : this.currentCycle.agent1?.characterId;

      if (winnerId) {
        // Check for simultaneous death (#13): if the "winner" is also dead,
        // resolve by damage comparison or coin flip instead of declaring a kill.
        const winnerEntity = this.world.entities.get(winnerId);
        const winnerHp = winnerEntity
          ? ((winnerEntity.data as { health?: number }).health ?? 0)
          : 0;

        if (winnerHp <= 0) {
          // Both dead — resolve by damage advantage
          const { agent1, agent2 } = this.currentCycle;
          const dmg1 = agent1?.damageDealtThisFight ?? 0;
          const dmg2 = agent2?.damageDealtThisFight ?? 0;

          if (dmg1 !== dmg2) {
            const actualWinner =
              dmg1 > dmg2 ? agent1?.characterId : agent2?.characterId;
            const actualLoser =
              actualWinner === agent1?.characterId
                ? agent2?.characterId
                : agent1?.characterId;
            if (actualWinner && actualLoser) {
              this.orchestrator.startResolution(
                actualWinner,
                actualLoser,
                "damage_advantage",
              );
            }
          } else {
            // True draw — coin flip
            const coinWinner =
              Math.random() > 0.5 ? agent1?.characterId : agent2?.characterId;
            const coinLoser =
              coinWinner === agent1?.characterId
                ? agent2?.characterId
                : agent1?.characterId;
            if (coinWinner && coinLoser) {
              this.orchestrator.startResolution(coinWinner, coinLoser, "draw");
            }
          }
        } else {
          this.orchestrator.startResolution(winnerId, loserId, "kill");
        }
      }
    }
  }

  // ============================================================================
  // State Broadcasting
  // ============================================================================

  private startStateBroadcast(): void {
    // Emit immediately so spectators get a valid first camera target without
    // waiting for the first interval tick.
    this.broadcastState();

    // Broadcast state every second (skip during FIGHTING when fast broadcast is active)
    this.broadcastInterval = setInterval(() => {
      // Skip if fast fight broadcast is handling updates at 200ms (#11)
      if (
        this.fightBroadcastInterval &&
        this.currentCycle?.phase === "FIGHTING"
      )
        return;
      // Ensure HP is fresh before broadcasting (catches food/regen changes
      // that don't fire damage events).
      this.orchestrator.updateContestantHp();
      this.broadcastState();
    }, STREAMING_TIMING.STATE_BROADCAST_INTERVAL);
  }

  /** Start fast 200ms broadcast during FIGHTING phase (#11) */
  private startFightBroadcast(): void {
    this.stopFightBroadcast();
    this.fightBroadcastInterval = setInterval(() => {
      this.orchestrator.updateContestantHp();
      this.broadcastState();
    }, STREAMING_TIMING.FIGHT_BROADCAST_INTERVAL);
  }

  /** Stop fast fight broadcast */
  private stopFightBroadcast(): void {
    if (this.fightBroadcastInterval) {
      clearInterval(this.fightBroadcastInterval);
      this.fightBroadcastInterval = null;
    }
  }

  private broadcastState(): void {
    const state = redactOracleProofFromStreamingState(this.getStreamingState());
    // Broadcast streaming state only to spectator sockets (interest management).
    // Regular gameplay clients don't need streaming duel updates every second.
    const network = this.world.network as NetworkWithSend | undefined;
    if (network?.sendToSpectators) {
      network.sendToSpectators("streamingState", state);
    } else if (network?.send) {
      // Fallback: broadcast to all if sendToSpectators not available
      network.send("streamingState", state);
    }
  }

  /**
   * Get current raw streaming state.
   *
   * This object may contain oracle-proof material (`duelKeyHex`, `seed`,
   * `replayHash`, `duelEndTime`) while a duel is active or freshly resolved.
   * Any public HTTP, SSE, or spectator-socket emission must redact those
   * fields first.
   *
   * MEMORY OPTIMIZATION: Reuses pre-allocated objects to avoid GC pressure.
   * Only creates new contestant objects when agents change.
   */
  getStreamingState(): StreamingStateUpdate {
    const now = Date.now();
    const leaderboard = this.matchmaking.getLeaderboard();

    if (!this.currentCycle) {
      // IDLE state - use pre-allocated idle cycle object
      const previewPair = this.camera.getIdlePreviewPairSnapshot();
      let previewAgent1Id = previewPair?.agent1Id ?? null;
      let previewAgent2Id = previewPair?.agent2Id ?? null;

      if (!previewAgent1Id || !previewAgent2Id) {
        // Collect fallback IDs without allocating if possible
        let fallbackCount = 0;
        let fallback1: string | null = null;
        let fallback2: string | null = null;
        for (const agentId of this.matchmaking.availableAgents) {
          if (!this.camera.isAgentValidCameraCandidate(agentId)) {
            continue;
          }
          if (fallbackCount === 0) {
            fallback1 = agentId;
          } else if (fallbackCount === 1) {
            fallback2 = agentId;
          }
          fallbackCount++;
          if (fallbackCount >= config.minAgents) {
            break;
          }
        }
        previewAgent1Id = previewAgent1Id ?? fallback1;
        previewAgent2Id = previewAgent2Id ?? fallback2;
      }

      // Only create contestant objects if IDs changed (reduces allocations)
      const needAgent1Update =
        this._cachedAgent1 === null ||
        (this._cachedAgent1 as { id?: string })?.id !== previewAgent1Id;
      const needAgent2Update =
        this._cachedAgent2 === null ||
        (this._cachedAgent2 as { id?: string })?.id !== previewAgent2Id;

      if (needAgent1Update && previewAgent1Id) {
        const contestant = this.orchestrator.createContestant(
          previewAgent1Id,
          previewAgent2Id ?? undefined,
        );
        this._cachedAgent1 = this.toStreamingCycleAgentInPlace(
          contestant,
          this._cachedAgent1,
        );
      } else if (!previewAgent1Id) {
        this._cachedAgent1 = null;
      }

      if (needAgent2Update && previewAgent2Id) {
        const contestant = this.orchestrator.createContestant(
          previewAgent2Id,
          previewAgent1Id ?? undefined,
        );
        this._cachedAgent2 = this.toStreamingCycleAgentInPlace(
          contestant,
          this._cachedAgent2,
        );
      } else if (!previewAgent2Id) {
        this._cachedAgent2 = null;
      }

      // Update idle cycle object in place (zero allocation)
      this._idleCycleObject.cycleStartTime = now;
      this._idleCycleObject.phaseStartTime = now;
      this._idleCycleObject.phaseEndTime = now;
      this._idleCycleObject.phaseVersion = 0;
      this._idleCycleObject.agent1 = this._cachedAgent1;
      this._idleCycleObject.agent2 = this._cachedAgent2;

      // Build camera IDs without allocation if possible
      const cameraId1 = this._cachedAgent1
        ? (this._cachedAgent1 as { id?: string }).id
        : null;
      const cameraId2 = this._cachedAgent2
        ? (this._cachedAgent2 as { id?: string }).id
        : null;

      // Use inline array to avoid allocation when possible
      const preferredCameraIds: string[] = [];
      if (cameraId1) preferredCameraIds.push(cameraId1);
      if (cameraId2) preferredCameraIds.push(cameraId2);

      const idleCameraTarget =
        this.camera.getIdleCameraTargetSnapshot(preferredCameraIds);

      // Update return object in place
      this._streamingStateObject.cycle = this._idleCycleObject;
      this._streamingStateObject.leaderboard = leaderboard;
      this._streamingStateObject.cameraTarget = idleCameraTarget;

      return this._streamingStateObject;
    }

    // ACTIVE CYCLE - use pre-allocated active cycle object
    const { agent1, agent2 } = this.currentCycle;
    const phaseEndTime = this.getPhaseEndTime();
    const timeRemaining = Math.max(0, phaseEndTime - now);
    const cameraTarget = this.getCycleCameraTargetSnapshot();

    // Check if we need to update agent objects (only when agent changes or health changes)
    const currentCycleId = this.currentCycle.cycleId;
    const cycleChanged = this._lastStreamingStateCycleId !== currentCycleId;

    if (cycleChanged || this._cachedAgent1 === null) {
      this._cachedAgent1 = this.toStreamingCycleAgentInPlace(
        agent1,
        this._cachedAgent1,
      );
    } else if (agent1) {
      // Update HP in place (most common change during fight)
      this.updateAgentHpInPlace(this._cachedAgent1, agent1);
    }

    if (cycleChanged || this._cachedAgent2 === null) {
      this._cachedAgent2 = this.toStreamingCycleAgentInPlace(
        agent2,
        this._cachedAgent2,
      );
    } else if (agent2) {
      // Update HP in place (most common change during fight)
      this.updateAgentHpInPlace(this._cachedAgent2, agent2);
    }

    this._lastStreamingStateCycleId = currentCycleId;

    // Update active cycle object in place
    this._activeCycleObject.cycleId = currentCycleId;
    this._activeCycleObject.phase = this.currentCycle.phase;
    this._activeCycleObject.cycleStartTime = this.currentCycle.cycleStartTime;
    this._activeCycleObject.phaseStartTime = this.currentCycle.phaseStartTime;
    this._activeCycleObject.phaseEndTime = phaseEndTime;
    this._activeCycleObject.phaseVersion = this.currentCycle.phaseVersion;
    this._activeCycleObject.timeRemaining = timeRemaining;
    this._activeCycleObject.agent1 = this._cachedAgent1;
    this._activeCycleObject.agent2 = this._cachedAgent2;
    this._activeCycleObject.duelId = this.currentCycle.duelId;
    this._activeCycleObject.duelKeyHex = this.currentCycle.duelKeyHex;
    this._activeCycleObject.betOpenTime = this.currentCycle.betOpenTime;
    this._activeCycleObject.betCloseTime = this.currentCycle.betCloseTime;
    this._activeCycleObject.countdown = this.currentCycle.countdownValue;
    this._activeCycleObject.fightStartTime =
      this.currentCycle.fightStartTime ?? null;
    this._activeCycleObject.duelEndTime = this.currentCycle.duelEndTime ?? null;
    this._activeCycleObject.arenaPositions =
      this.currentCycle.arenaPositions ?? null;
    this._activeCycleObject.winnerId = this.currentCycle.winnerId;
    this._activeCycleObject.winnerName = this.currentCycle.winnerId
      ? (this.currentCycle.agent1?.characterId === this.currentCycle.winnerId
          ? this.currentCycle.agent1?.name
          : this.currentCycle.agent2?.name) || null
      : null;
    this._activeCycleObject.winReason = this.currentCycle.winReason;
    this._activeCycleObject.seed = this.currentCycle.seed;
    this._activeCycleObject.replayHash = this.currentCycle.replayHash;

    // Update return object in place
    this._streamingStateObject.cycle = this._activeCycleObject;
    this._streamingStateObject.leaderboard = leaderboard;
    this._streamingStateObject.cameraTarget = cameraTarget;

    return this._streamingStateObject;
  }

  /**
   * Convert AgentContestant to streaming format, reusing existing object if possible.
   * MEMORY OPTIMIZATION: Updates properties in place instead of creating new objects.
   */
  private toStreamingCycleAgentInPlace(
    agent: AgentContestant | null,
    existing: StreamingStateUpdate["cycle"]["agent1"],
  ): StreamingStateUpdate["cycle"]["agent1"] {
    if (!agent) {
      return null;
    }

    // Reuse existing object if available
    if (existing) {
      existing.id = agent.characterId;
      existing.name = agent.name;
      existing.provider = agent.provider;
      existing.model = agent.model;
      existing.hp = agent.currentHp;
      existing.maxHp = agent.maxHp;
      existing.combatLevel = agent.combatLevel;
      existing.wins = agent.wins;
      existing.losses = agent.losses;
      existing.damageDealtThisFight = agent.damageDealtThisFight;
      existing.highestHit = agent.highestHit;
      existing.attacksLanded = agent.attacksLanded;
      existing.healsUsed = agent.healsUsed;
      existing.rank = agent.rank;
      existing.headToHeadWins = agent.headToHeadWins;
      existing.headToHeadLosses = agent.headToHeadLosses;
      // Equipment: update in place by copying properties
      if (agent.equipment) {
        if (!existing.equipment) {
          existing.equipment = {};
        }
        // Clear existing and copy new (avoids creating new object)
        for (const key of Object.keys(
          existing.equipment as Record<string, unknown>,
        )) {
          delete (existing.equipment as Record<string, unknown>)[key];
        }
        Object.assign(existing.equipment, agent.equipment);
      } else {
        existing.equipment = {};
      }
      // Inventory: we must use the reference since inventory items can change
      // But cap at 28 items to match original
      existing.inventory = Array.isArray(agent.inventory)
        ? agent.inventory.slice(0, 28)
        : [];
      if (!existing.itemIconPaths) {
        existing.itemIconPaths = {};
      }
      for (const key of Object.keys(existing.itemIconPaths)) {
        delete (existing.itemIconPaths as Record<string, unknown>)[key];
      }
      Object.assign(existing.itemIconPaths, agent.itemIconPaths ?? {});
      return existing;
    }

    // Create new object (only when no existing object)
    return this.toStreamingCycleAgent(agent);
  }

  /**
   * Update hot combat fields in place during active fights without reallocating
   * the cached streaming state objects.
   */
  private updateAgentHpInPlace(
    cached: StreamingStateUpdate["cycle"]["agent1"],
    agent: AgentContestant,
  ): void {
    if (!cached) return;
    this.orchestrator.refreshContestantLoadout(agent);
    cached.hp = agent.currentHp;
    cached.maxHp = agent.maxHp;
    cached.damageDealtThisFight = agent.damageDealtThisFight;
    cached.wins = agent.wins;
    cached.losses = agent.losses;
    if (!cached.equipment) {
      cached.equipment = {};
    }
    for (const key of Object.keys(
      cached.equipment as Record<string, unknown>,
    )) {
      delete (cached.equipment as Record<string, unknown>)[key];
    }
    Object.assign(cached.equipment, agent.equipment);
    cached.inventory = Array.isArray(agent.inventory)
      ? agent.inventory.slice(0, 28)
      : [];
    if (!cached.itemIconPaths) {
      cached.itemIconPaths = {};
    }
    for (const key of Object.keys(cached.itemIconPaths)) {
      delete (cached.itemIconPaths as Record<string, unknown>)[key];
    }
    Object.assign(cached.itemIconPaths, agent.itemIconPaths ?? {});
  }

  // ============================================================================
  // Helper Methods (owned by facade)
  // ============================================================================

  private getPhaseEndTime(): number {
    if (!this.currentCycle) return Date.now();

    const { phase, phaseStartTime } = this.currentCycle;

    switch (phase) {
      case "ANNOUNCEMENT":
        // Use MIN_ANNOUNCEMENT_DURATION for the timer since the phase
        // early-exits as soon as both agents are alive (which is almost
        // always immediate). ANNOUNCEMENT_DURATION is only a maximum
        // fallback and would make the timer misleadingly long.
        return phaseStartTime + STREAMING_TIMING.MIN_ANNOUNCEMENT_DURATION;
      case "COUNTDOWN":
        return (
          this.currentCycle.fightStartTime ??
          phaseStartTime + STREAMING_TIMING.COUNTDOWN_DURATION
        );
      case "FIGHTING":
        return (
          phaseStartTime +
          STREAMING_TIMING.FIGHTING_DURATION +
          STREAMING_TIMING.END_WARNING_DURATION
        );
      case "RESOLUTION":
        return phaseStartTime + STREAMING_TIMING.RESOLUTION_DURATION;
      default:
        return Date.now();
    }
  }

  private toStreamingCycleAgent(
    agent: AgentContestant | null,
  ): StreamingStateUpdate["cycle"]["agent1"] {
    if (!agent) {
      return null;
    }

    return {
      id: agent.characterId,
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      hp: agent.currentHp,
      maxHp: agent.maxHp,
      combatLevel: agent.combatLevel,
      wins: agent.wins,
      losses: agent.losses,
      damageDealtThisFight: agent.damageDealtThisFight,
      highestHit: agent.highestHit,
      attacksLanded: agent.attacksLanded,
      healsUsed: agent.healsUsed,
      equipment: { ...(agent.equipment ?? {}) },
      inventory: Array.isArray(agent.inventory)
        ? agent.inventory.slice(0, 28)
        : [],
      itemIconPaths: { ...(agent.itemIconPaths ?? {}) },
      rank: agent.rank,
      headToHeadWins: agent.headToHeadWins,
      headToHeadLosses: agent.headToHeadLosses,
    };
  }

  /**
   * Snapshot-based camera target for broadcast (no side-effects like
   * refreshNextDuelPair). Used by getStreamingState for the active-cycle path.
   */
  private getCycleCameraTargetSnapshot(): string | null {
    if (!this.currentCycle) {
      return null;
    }

    const phase = this.currentCycle.phase ?? "IDLE";
    const contestantIds = this.camera.getCycleContestantIds();
    const nextDuelIds = this.getNextDuelAgentIdsSnapshot(contestantIds);
    const currentTarget = this.camera.cameraTarget;
    if (
      typeof currentTarget === "string" &&
      this.camera.isAgentValidCameraCandidate(currentTarget)
    ) {
      const currentIsContestant = contestantIds.has(currentTarget);
      const currentIsNextDuel = nextDuelIds.has(currentTarget);

      if (phase === "ANNOUNCEMENT" || phase === "COUNTDOWN") {
        if (currentIsContestant) {
          return currentTarget;
        }
      } else if (phase === "FIGHTING") {
        if (currentIsContestant || currentIsNextDuel) {
          return currentTarget;
        }
      } else {
        return currentTarget;
      }
    }

    const preferredIds: string[] = [];

    if (phase === "RESOLUTION" && this.currentCycle.winnerId) {
      preferredIds.push(this.currentCycle.winnerId);
    }

    preferredIds.push(...contestantIds, ...nextDuelIds);

    const seen = new Set<string>();
    for (const agentId of preferredIds) {
      if (seen.has(agentId)) {
        continue;
      }
      seen.add(agentId);
      if (this.camera.isAgentValidCameraCandidate(agentId)) {
        return agentId;
      }
    }

    for (const agentId of this.matchmaking.availableAgents) {
      if (this.camera.isAgentValidCameraCandidate(agentId)) {
        return agentId;
      }
    }

    // Final fallback: during an active cycle, prefer to point at a contestant
    // that still has a live world entity, even if they are no longer in the
    // matchmaking `availableAgents` pool. This covers the case where a
    // contestant disconnects mid-fight (PLAYER_LEFT → unregisterAgent) and
    // is therefore no longer a "valid camera candidate" by the matchmaking
    // rule, but their entity is still in the arena and is the thing the
    // viewer actually wants to see. Observed on 2026-04-15 where the state
    // endpoint returned `phase: FIGHTING` with `cameraTarget: null` because
    // both contestants had been unregistered from matchmaking but were still
    // alive in the world.
    const cycleAgent1Id = this.currentCycle.agent1?.characterId;
    if (cycleAgent1Id && this.world.entities.get(cycleAgent1Id)) {
      return cycleAgent1Id;
    }
    const cycleAgent2Id = this.currentCycle.agent2?.characterId;
    if (cycleAgent2Id && this.world.entities.get(cycleAgent2Id)) {
      return cycleAgent2Id;
    }

    return null;
  }

  /**
   * Non-mutating snapshot of next-duel agent IDs for broadcast.
   * Unlike CameraDirector.getNextDuelAgentIds, this does NOT refresh the
   * pair if a member is invalid — it just returns what's available.
   */
  private getNextDuelAgentIdsSnapshot(contestantIds: Set<string>): Set<string> {
    const ids = new Set<string>();
    const nextPair = this.matchmaking.nextDuelPair;
    if (!nextPair) {
      return ids;
    }

    const pairIds = [nextPair.agent1Id, nextPair.agent2Id];
    let validPairMembers = 0;
    for (const agentId of pairIds) {
      if (this.camera.isAgentValidCameraCandidate(agentId)) {
        validPairMembers++;
        if (!contestantIds.has(agentId)) {
          ids.add(agentId);
        }
      }
    }

    if (validPairMembers < config.minAgents) {
      return new Set<string>();
    }

    return ids;
  }

  /** Get scheduler state for monitoring/debugging */
  getSchedulerState(): {
    state: "IDLE" | "WAITING_FOR_AGENTS" | "ACTIVE";
    availableAgents: number;
    requiredAgents: number;
    insufficientWarnings: number;
    currentPhase: StreamingPhase | null;
  } {
    return {
      state: this.schedulerState,
      availableAgents: this.matchmaking.availableAgents.size,
      requiredAgents: config.minAgents,
      insufficientWarnings: this.matchmaking.insufficientAgentWarningCount,
      currentPhase: this.currentCycle?.phase ?? null,
    };
  }

  /**
   * Ensure users + characters rows exist for a freshly spawned embedded sparbot.
   */
  private async ensureEmbeddedCharacterRowForSparbot(
    characterId: string,
    accountId: string,
    name: string,
  ): Promise<void> {
    const db = this.getDatabase();
    if (!db) {
      return;
    }
    const { users, characters } = await import("../../database/schema.js");
    const { eq } = await import("drizzle-orm");

    const existingRows = await db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      return;
    }

    const existingUsers = (await db
      .select()
      .from(users)
      .where(eq(users.id, accountId))) as Array<{ id: string }>;

    if (existingUsers.length === 0) {
      await db.insert(users).values({
        id: accountId,
        name,
        roles: "player",
        createdAt: new Date().toISOString(),
      });
    }

    await db.insert(characters).values({
      id: characterId,
      accountId,
      name,
      isAgent: 1,
      createdAt: Date.now(),
    });
  }

  /**
   * Director/debug: spawn (or reuse) an opponent and pin the next duel pair.
   */
  async queueDebugMatchup(params: {
    targetCharacterId: string;
    opponentCharacterId?: string;
    opponentName?: string;
    spawnOpponent: boolean;
    sparbotCombatStyle?: "auto" | "melee" | "ranged" | "mage" | "prayer";
  }): Promise<{
    mode: "spawned" | "existing";
    opponent: { characterId: string; name: string };
  }> {
    const targetEntity = this.world.entities.get(params.targetCharacterId);
    if (!targetEntity) {
      throw new Error(`Target ${params.targetCharacterId} is not in the world`);
    }

    const { getAgentManager } = await import("../../eliza/index.js");
    const agentManager = getAgentManager();
    if (!agentManager) {
      throw new Error("Agent system not initialized");
    }

    let opponentId: string;
    let opponentName: string;

    if (params.spawnOpponent) {
      opponentId = `sparbot-${uuidv4()}`;
      const accountId = `sparbot-account-${opponentId.slice(-24)}`;
      opponentName =
        params.opponentName?.trim() || `Sparbot ${opponentId.slice(-6)}`;

      await this.ensureEmbeddedCharacterRowForSparbot(
        opponentId,
        accountId,
        opponentName,
      );

      await agentManager.createAgent({
        characterId: opponentId,
        accountId,
        name: opponentName,
        scriptedRole: "combat",
        autoStart: true,
      });

      this.debugSparbotSpawnIds.add(opponentId);

      if (
        params.sparbotCombatStyle === "melee" ||
        params.sparbotCombatStyle === "ranged" ||
        params.sparbotCombatStyle === "mage" ||
        params.sparbotCombatStyle === "prayer"
      ) {
        this.orchestrator.setDebugCombatRoleOverride(
          opponentId,
          params.sparbotCombatStyle,
        );
      }
    } else {
      if (!params.opponentCharacterId) {
        throw new Error(
          "opponentCharacterId is required when reusing an agent",
        );
      }
      opponentId = params.opponentCharacterId;
      const oppEntity = this.world.entities.get(opponentId);
      if (!oppEntity) {
        throw new Error(`Opponent ${opponentId} is not in the world`);
      }
      const data = oppEntity.data as { name?: string };
      opponentName = data.name ?? opponentId;
    }

    this.matchmaking.registerAgent(params.targetCharacterId, {
      bypassStreamingDuelOptOut: true,
    });
    this.matchmaking.registerAgent(opponentId, {
      bypassStreamingDuelOptOut: true,
    });

    this.matchmaking.nextDuelPair = {
      agent1Id: params.targetCharacterId,
      agent2Id: opponentId,
      selectedAt: Date.now(),
    };
    this.notifyOnDeckAgents();

    return {
      mode: params.spawnOpponent ? "spawned" : "existing",
      opponent: { characterId: opponentId, name: opponentName },
    };
  }

  // ============================================================================
  // Standalone Sparbot Management
  // ============================================================================

  private static readonly SPARBOT_NAME_POOL: readonly string[] = [
    "Ashthorn",
    "Bolvarg",
    "Cragfist",
    "Duskmantle",
    "Emberveil",
    "Frostknuckle",
    "Grimshaw",
    "Hollowbane",
    "Ironpelt",
    "Jadecut",
    "Kniveholt",
    "Lordshard",
    "Mireborn",
    "Nightbloom",
    "Oakhaven",
    "Pebblebrow",
    "Quickslag",
    "Ravenmere",
    "Stonescar",
    "Thistlevein",
    "Umbercleft",
    "Vaultbreaker",
    "Whetmark",
    "Xendral",
    "Yarrowcrest",
    "Zinderfall",
    "Axethane",
    "Blazewind",
    "Coppergrip",
    "Dreadclaw",
    "Edgeborn",
    "Flintmoss",
    "Gravelstep",
    "Harrowgate",
    "Ironveil",
    "Jaggrath",
    "Keldrath",
    "Lochfang",
    "Mossback",
    "Needlebrook",
    "Obsidius",
    "Pyrebrand",
    "Quakeshield",
    "Rustmantle",
    "Steelroot",
    "Thornvast",
    "Umbralux",
    "Voidshard",
    "Wraithcroft",
    "Yewmere",
  ];

  private pickSparbotName(): string {
    const used = new Set(
      [...this.standaloneSparbotMeta.values()].map((m) => m.name),
    );
    const available = StreamingDuelScheduler.SPARBOT_NAME_POOL.filter(
      (n) => !used.has(n),
    );
    const pool =
      available.length > 0
        ? available
        : StreamingDuelScheduler.SPARBOT_NAME_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Generate skill levels for a standalone sparbot based on style and tier.
   * Adds variance (±5) so bots of the same tier feel distinct.
   */
  private static sparbotSkills(
    style: "melee" | "ranged" | "mage" | "prayer",
    tier: "novice" | "adept" | "expert",
  ): {
    attackLevel: number;
    strengthLevel: number;
    defenseLevel: number;
    constitutionLevel: number;
    rangedLevel: number;
    magicLevel: number;
    prayerLevel: number;
    combatLevel: number;
  } {
    const base = tier === "novice" ? 35 : tier === "adept" ? 60 : 85;
    const jitter = () => Math.floor(Math.random() * 10) - 5; // ±5

    let atk = 1,
      str = 1,
      def = 1,
      con = 10,
      rng = 1,
      mag = 1,
      pry = 1;

    switch (style) {
      case "melee":
        atk = base + jitter();
        str = base + 5 + jitter();
        def = Math.floor(base * 0.7) + jitter();
        con = base + jitter();
        rng = 1;
        mag = 1;
        pry = Math.floor(base * 0.2);
        break;
      case "ranged":
        rng = base + 5 + jitter();
        def = Math.floor(base * 0.6) + jitter();
        con = base + jitter();
        atk = 1;
        str = 1;
        mag = 1;
        pry = Math.floor(base * 0.2);
        break;
      case "mage":
        mag = base + 5 + jitter();
        def = Math.floor(base * 0.7) + jitter();
        con = base + jitter();
        atk = 1;
        str = 1;
        rng = 1;
        pry = Math.floor(base * 0.75) + jitter();
        break;
      case "prayer":
        pry = base + 5 + jitter();
        str = base + jitter();
        atk = Math.floor(base * 0.8) + jitter();
        def = Math.floor(base * 0.8) + jitter();
        con = base + jitter();
        rng = 1;
        mag = 1;
        break;
    }

    const clamp = (v: number, min = 1, max = 99) =>
      Math.max(min, Math.min(max, v));
    atk = clamp(atk);
    str = clamp(str);
    def = clamp(def);
    con = clamp(con, 10);
    rng = clamp(rng);
    mag = clamp(mag);
    pry = clamp(pry);

    const combatLevel = Math.max(
      3,
      Math.min(126, Math.floor((atk + str + def + con) / 4)),
    );
    return {
      attackLevel: atk,
      strengthLevel: str,
      defenseLevel: def,
      constitutionLevel: con,
      rangedLevel: rng,
      magicLevel: mag,
      prayerLevel: pry,
      combatLevel,
    };
  }

  /** Upsert skill stats into the characters table for a standalone sparbot. */
  private async seedSparbotStats(
    characterId: string,
    skills: ReturnType<typeof StreamingDuelScheduler.sparbotSkills>,
  ): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;
    const { characters } = await import("../../database/schema.js");
    const { eq } = await import("drizzle-orm");
    const pp = Math.min(99, Math.max(1, skills.prayerLevel * 10));
    await db
      .update(characters)
      .set({
        combatLevel: skills.combatLevel,
        attackLevel: skills.attackLevel,
        strengthLevel: skills.strengthLevel,
        defenseLevel: skills.defenseLevel,
        constitutionLevel: skills.constitutionLevel,
        rangedLevel: skills.rangedLevel,
        magicLevel: skills.magicLevel,
        prayerLevel: skills.prayerLevel,
        health: skills.constitutionLevel,
        maxHealth: skills.constitutionLevel,
        prayerPoints: pp,
        prayerMaxPoints: pp,
      })
      .where(eq(characters.id, characterId));
  }

  /** Spawn standalone sparbots and add them to the matchmaking pool. */
  async spawnStandaloneSparbots(
    count: number,
    style: "melee" | "ranged" | "mage" | "prayer",
    tier: "novice" | "adept" | "expert" = "adept",
    customNames?: string[],
  ): Promise<Array<{ characterId: string; name: string; tier: string }>> {
    const { getAgentManager } = await import("../../eliza/index.js");
    const agentManager = getAgentManager();
    if (!agentManager) {
      throw new Error("Agent system not initialized");
    }

    const spawned: Array<{ characterId: string; name: string; tier: string }> =
      [];

    for (let i = 0; i < count; i++) {
      const characterId = `sparbot-standalone-${uuidv4()}`;
      const accountId = `sparbot-account-${characterId.slice(-24)}`;
      const name =
        customNames?.[i]?.trim() ||
        `${this.pickSparbotName()} ${style.charAt(0).toUpperCase() + style.slice(1)}`;

      await this.ensureEmbeddedCharacterRowForSparbot(
        characterId,
        accountId,
        name,
      );

      const skills = StreamingDuelScheduler.sparbotSkills(style, tier);
      await this.seedSparbotStats(characterId, skills);

      await agentManager.createAgent({
        characterId,
        accountId,
        name,
        scriptedRole: "combat",
        autoStart: true,
      });

      this.orchestrator.setDebugCombatRoleOverride(characterId, style);
      this.standaloneSparbotIds.add(characterId);
      this.standaloneSparbotMeta.set(characterId, { name, style, tier });

      this.matchmaking.registerAgent(characterId, {
        bypassStreamingDuelOptOut: true,
      });

      spawned.push({ characterId, name, tier });
    }

    return spawned;
  }

  /** List active standalone sparbots. */
  listStandaloneSparbots(): Array<{
    characterId: string;
    name: string;
    style: string;
    tier: string;
  }> {
    return [...this.standaloneSparbotIds].map((id) => {
      const meta = this.standaloneSparbotMeta.get(id);
      return {
        characterId: id,
        name: meta?.name ?? id,
        style: meta?.style ?? "melee",
        tier: meta?.tier ?? "adept",
      };
    });
  }

  /** Remove standalone sparbots (all if ids omitted). Returns count removed. */
  async removeStandaloneSparbots(ids?: string[]): Promise<number> {
    const { getAgentManager } = await import("../../eliza/index.js");
    const agentManager = getAgentManager();
    const targets = ids
      ? ids.filter((id) => this.standaloneSparbotIds.has(id))
      : [...this.standaloneSparbotIds];

    let removed = 0;
    for (const id of targets) {
      try {
        if (agentManager) {
          await agentManager.removeAgent(id);
        }
        this.matchmaking.unregisterAgent(id);
        this.orchestrator.clearDebugCombatRoleOverride(id);
        this.standaloneSparbotIds.delete(id);
        this.standaloneSparbotMeta.delete(id);
        removed++;
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `removeStandaloneSparbots(${id}): ${errMsg(err)}`,
        );
      }
    }
    return removed;
  }

  /** Remove embedded spar bots spawned via queueDebugMatchup (spawn mode). */
  async cleanupDebugSpawnedSparbots(): Promise<number> {
    const { getAgentManager } = await import("../../eliza/index.js");
    const agentManager = getAgentManager();
    let removed = 0;
    for (const id of [...this.debugSparbotSpawnIds]) {
      try {
        if (agentManager) {
          await agentManager.removeAgent(id);
        }
        this.matchmaking.unregisterAgent(id);
        removed++;
      } catch (err) {
        Logger.warn(
          "StreamingDuelScheduler",
          `cleanupDebugSpawnedSparbots(${id}): ${errMsg(err)}`,
        );
      }
    }
    this.debugSparbotSpawnIds.clear();
    return removed;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let streamingSchedulerInstance: StreamingDuelScheduler | null = null;

/** Initialize the streaming duel scheduler */
export function initStreamingDuelScheduler(
  world: World,
): StreamingDuelScheduler {
  if (streamingSchedulerInstance) {
    streamingSchedulerInstance.destroy();
  }

  streamingSchedulerInstance = new StreamingDuelScheduler(world);
  streamingSchedulerInstance.init();

  return streamingSchedulerInstance;
}

/** Get the streaming duel scheduler instance */
export function getStreamingDuelScheduler(): StreamingDuelScheduler | null {
  return streamingSchedulerInstance;
}
