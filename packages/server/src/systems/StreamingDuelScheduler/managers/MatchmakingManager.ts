/**
 * MatchmakingManager - Agent registration, stats, pair selection, and leaderboard logic
 *
 * Extracted from StreamingDuelScheduler to isolate matchmaking concerns.
 */

import type { World } from "@hyperforge/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Logger } from "../../ServerNetwork/services/index.js";
import type { LeaderboardEntry, RecentDuelEntry } from "../types.js";

// ============================================================================
// Types
// ============================================================================

export type NextDuelPair = {
  agent1Id: string;
  agent2Id: string;
  selectedAt: number;
};

export type AgentStatsEntry = {
  characterId: string;
  name: string;
  provider: string;
  model: string;
  wins: number;
  losses: number;
  combatLevel: number;
  currentStreak: number;
};

type MatchmakingConfig = {
  minAgents: number;
  maxRecentDuels: number;
  persistStatsToDatabase: boolean;
  maxAgentStats: number;
  insufficientAgentsRetryInterval: number;
  maxInsufficientAgentWarnings: number;
};

/**
 * Callback interface for the scheduler to provide context-dependent data
 * and handle side effects that live outside the matchmaking domain.
 */
type MatchmakingCallbacks = {
  /** Returns the set of contestant IDs for the current active cycle */
  getCycleContestantIds: () => Set<string>;
  /** Returns the current cycle's agent data for damage stats during persistence */
  getCurrentCycleAgentDamage: (
    characterId: string,
  ) => { damageDealtThisFight: number } | null;
  /** Called when an agent registers so the scheduler can initialize camera activity */
  onAgentRegistered?: (agentId: string, now: number) => void;
  /** Called when an agent unregisters so the scheduler can handle forfeit logic */
  onAgentUnregistered?: (agentId: string) => void;
  /** Called when the pre-selected next duel pair changes (new pair or cleared) */
  onNextDuelPairChanged?: (pair: NextDuelPair | null) => void;
};

// ============================================================================
// MatchmakingManager
// ============================================================================

export class MatchmakingManager {
  /** Available agents for dueling */
  availableAgents: Set<string> = new Set();

  /**
   * Agent IDs opted out of streaming duels (DB `streaming_duel_enabled = false`).
   * Skipped by registerAgent unless bypassStreamingDuelOptOut is set (debug matchups).
   */
  private streamingDuelOptOut: Set<string> = new Set();

  /** Agent stats for leaderboard */
  agentStats: Map<string, AgentStatsEntry> = new Map();

  /** Last-seen timestamps for agent stat pruning */
  agentStatsLastSeenAt: Map<string, number> = new Map();

  /** Recent completed duel history (newest first) */
  recentDuels: RecentDuelEntry[] = [];

  /** Cached leaderboard — only recomputed when stats change */
  cachedLeaderboard: LeaderboardEntry[] = [];
  leaderboardDirty = true;

  /** Preselected pair for the upcoming cycle */
  nextDuelPair: NextDuelPair | null = null;

  /** Track insufficient agent warnings for auto-recovery */
  insufficientAgentWarningCount: number = 0;

  /** Last time we logged insufficient agents warning */
  lastInsufficientAgentsLog: number = 0;

  private callbacks: MatchmakingCallbacks | null = null;

  constructor(
    private readonly world: World,
    private readonly getDatabase: () => NodePgDatabase | null,
    private readonly config: MatchmakingConfig,
  ) {}

  /**
   * Set callback hooks for scheduler integration.
   * Must be called before using methods that depend on scheduler state.
   */
  setCallbacks(callbacks: MatchmakingCallbacks): void {
    this.callbacks = callbacks;
  }

  // ==========================================================================
  // Agent Registration
  // ==========================================================================

  /**
   * Persisted opt-out from streaming duel matchmaking, or clear opt-out before re-registering.
   */
  markStreamingDuelOptOut(agentId: string, optedOut: boolean): void {
    if (optedOut) {
      this.streamingDuelOptOut.add(agentId);
      this.unregisterAgent(agentId);
    } else {
      this.streamingDuelOptOut.delete(agentId);
    }
  }

  /**
   * Register an agent for duel scheduling
   */
  registerAgent(
    agentId: string,
    options?: { bypassStreamingDuelOptOut?: boolean },
  ): void {
    if (
      !options?.bypassStreamingDuelOptOut &&
      this.streamingDuelOptOut.has(agentId)
    ) {
      return;
    }
    const now = Date.now();
    this.availableAgents.add(agentId);
    this.agentStatsLastSeenAt.set(agentId, now);
    this.callbacks?.onAgentRegistered?.(agentId, now);
    if (this.availableAgents.size >= this.config.minAgents) {
      this.refreshNextDuelPair(now);
    }

    // Get agent info from entity
    const entity = this.world.entities.get(agentId);
    if (entity) {
      const data = entity.data as {
        name?: string;
        skills?: Record<string, { level: number }>;
      };

      // Calculate combat level
      const skills = data.skills || {};
      const attack = skills.attack?.level || 1;
      const strength = skills.strength?.level || 1;
      const defense = skills.defense?.level || 1;
      const constitution = skills.constitution?.level || 10;
      const combatLevel = Math.floor(
        (attack + strength + defense + constitution) / 4,
      );

      // Parse provider and model from agent ID (or use character name)
      // Try to get from character data first
      const characterData = data as {
        name?: string;
        agentProvider?: string;
        agentModel?: string;
      };

      let provider = characterData.agentProvider || "unknown";
      let model = characterData.agentModel || "unknown";

      // Fallback: try to parse from agent ID if format is agent-{provider}-{model}
      if (provider === "unknown" && agentId.startsWith("agent-")) {
        const parts = agentId.split("-");
        provider = parts[1] || "unknown";
        model = parts.slice(2).join("-") || "unknown";
      }

      // Initialize stats if not exists
      if (!this.agentStats.has(agentId)) {
        this.agentStats.set(agentId, {
          characterId: agentId,
          name: data.name || agentId,
          provider,
          model,
          wins: 0,
          losses: 0,
          combatLevel,
          currentStreak: 0,
        });

        // Load persisted stats from database asynchronously
        this.loadStatsFromDatabase(agentId).catch((err) => {
          Logger.warn(
            "StreamingDuelScheduler",
            `Failed to load stats for ${agentId}: ${err}`,
          );
        });
      }

      this.pruneInactiveAgentStats(now);

      Logger.info(
        "StreamingDuelScheduler",
        `Agent registered: ${data.name || agentId}`,
      );
    }
  }

  /**
   * Load persisted stats from database for an agent
   */
  private async loadStatsFromDatabase(agentId: string): Promise<void> {
    const db = this.getDatabase();
    if (!db) {
      return;
    }

    try {
      const { playerCombatStats } = await import("../../../database/schema.js");
      const { eq } = await import("drizzle-orm");

      const result = await db
        .select({
          totalDuelWins: playerCombatStats.totalDuelWins,
          totalDuelLosses: playerCombatStats.totalDuelLosses,
        })
        .from(playerCombatStats)
        .where(eq(playerCombatStats.playerId, agentId))
        .limit(1);

      if (result.length > 0) {
        const stats = this.agentStats.get(agentId);
        if (stats) {
          stats.wins = result[0].totalDuelWins;
          stats.losses = result[0].totalDuelLosses;
          this.leaderboardDirty = true;
          Logger.info(
            "StreamingDuelScheduler",
            `Loaded persisted stats for ${agentId}: ${stats.wins}W ${stats.losses}L`,
          );
        }
      }
    } catch (err) {
      Logger.warn(
        "StreamingDuelScheduler",
        `Error loading stats for ${agentId}: ${err}`,
      );
    }
  }

  /**
   * Unregister an agent from duel scheduling.
   * Returns the agentId so the caller can handle forfeit logic.
   */
  unregisterAgent(agentId: string): void {
    const now = Date.now();
    this.agentStatsLastSeenAt.set(agentId, now);
    this.availableAgents.delete(agentId);
    if (
      this.nextDuelPair &&
      (this.nextDuelPair.agent1Id === agentId ||
        this.nextDuelPair.agent2Id === agentId)
    ) {
      this.nextDuelPair = null;
      if (this.availableAgents.size >= this.config.minAgents) {
        this.refreshNextDuelPair(now);
      }
    }
    Logger.info("StreamingDuelScheduler", `Agent unregistered: ${agentId}`);

    // Notify the scheduler so it can handle forfeit + camera cleanup
    this.callbacks?.onAgentUnregistered?.(agentId);

    this.pruneInactiveAgentStats(now);
  }

  // ==========================================================================
  // Pair Selection
  // ==========================================================================

  /**
   * Choose a random pair of agents from a pool.
   * Uses Fisher-Yates shuffle for unbiased selection.
   */
  chooseRandomPairFromPool(pool: string[], now: number): NextDuelPair | null {
    if (pool.length < this.config.minAgents) {
      return null;
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const agent1Id = shuffled[0];
    const agent2Id = shuffled[1];
    if (!agent1Id || !agent2Id || agent1Id === agent2Id) {
      return null;
    }

    return { agent1Id, agent2Id, selectedAt: now };
  }

  /**
   * Consume the preselected duel pair if both agents are still valid.
   * Clears the stored pair regardless.
   */
  consumePreselectedDuelPair(validAgents: string[]): NextDuelPair | null {
    if (!this.nextDuelPair) {
      return null;
    }

    const preselected = this.nextDuelPair;
    this.nextDuelPair = null;

    const validSet = new Set(validAgents);
    if (
      preselected.agent1Id !== preselected.agent2Id &&
      validSet.has(preselected.agent1Id) &&
      validSet.has(preselected.agent2Id)
    ) {
      return preselected;
    }

    return null;
  }

  /**
   * Refresh the next duel pair from available agents,
   * excluding current cycle contestants when possible.
   */
  refreshNextDuelPair(now: number): void {
    const validAgents = Array.from(this.availableAgents).filter((agentId) =>
      Boolean(this.world.entities.get(agentId)),
    );
    if (validAgents.length < this.config.minAgents) {
      this.nextDuelPair = null;
      return;
    }

    const excluded = this.callbacks?.getCycleContestantIds() ?? new Set();
    let pool = validAgents.filter((agentId) => !excluded.has(agentId));
    if (pool.length < this.config.minAgents) {
      pool = validAgents;
    }

    this.nextDuelPair = this.chooseRandomPairFromPool(pool, now);
    this.callbacks?.onNextDuelPairChanged?.(this.nextDuelPair);
  }

  // ==========================================================================
  // Stats Management
  // ==========================================================================

  /**
   * Prevent unbounded agent stat growth when character IDs churn.
   * Keeps active/current-cycle IDs and evicts oldest inactive records first.
   */
  pruneInactiveAgentStats(now: number): void {
    if (this.agentStats.size <= this.config.maxAgentStats) {
      return;
    }

    const protectedIds = new Set<string>(this.availableAgents);
    const cycleContestants =
      this.callbacks?.getCycleContestantIds() ?? new Set<string>();
    for (const id of cycleContestants) {
      protectedIds.add(id);
    }
    if (this.nextDuelPair?.agent1Id) {
      protectedIds.add(this.nextDuelPair.agent1Id);
    }
    if (this.nextDuelPair?.agent2Id) {
      protectedIds.add(this.nextDuelPair.agent2Id);
    }

    const prunableIds: string[] = [];
    for (const agentId of this.agentStats.keys()) {
      if (!protectedIds.has(agentId)) {
        prunableIds.push(agentId);
      }
    }
    if (prunableIds.length === 0) {
      return;
    }

    prunableIds.sort((a, b) => {
      const aSeen = this.agentStatsLastSeenAt.get(a) ?? now;
      const bSeen = this.agentStatsLastSeenAt.get(b) ?? now;
      return aSeen - bSeen;
    });

    const targetRemovals = Math.min(
      prunableIds.length,
      this.agentStats.size - this.config.maxAgentStats,
    );
    if (targetRemovals <= 0) {
      return;
    }

    for (let i = 0; i < targetRemovals; i++) {
      const agentId = prunableIds[i];
      if (!agentId) continue;
      this.agentStats.delete(agentId);
      this.agentStatsLastSeenAt.delete(agentId);
    }

    this.leaderboardDirty = true;
    Logger.info(
      "StreamingDuelScheduler",
      `Pruned ${targetRemovals} inactive agent stat record(s); retained ${this.agentStats.size} total`,
    );
  }

  /**
   * Update win/loss stats for a completed duel.
   * Marks leaderboard as dirty and optionally persists to database.
   */
  updateStats(winnerId: string, loserId: string): void {
    const winnerStats = this.agentStats.get(winnerId);
    const loserStats = this.agentStats.get(loserId);

    if (winnerStats) {
      winnerStats.wins++;
      winnerStats.currentStreak++;
    }

    if (loserStats) {
      loserStats.losses++;
      loserStats.currentStreak = 0;
    }

    this.leaderboardDirty = true;

    if (!this.config.persistStatsToDatabase) {
      return;
    }

    // Persist to database asynchronously
    this.persistStatsToDatabase(winnerId, loserId).catch((err) => {
      Logger.warn(
        "StreamingDuelScheduler",
        `Failed to persist stats to database: ${err}`,
      );
    });
  }

  /**
   * Persist duel stats to the database
   */
  private async persistStatsToDatabase(
    winnerId: string,
    loserId: string,
  ): Promise<void> {
    const db = this.getDatabase();
    if (!db) {
      Logger.warn(
        "StreamingDuelScheduler",
        "Database not available for stats persistence",
      );
      return;
    }

    try {
      // Import schema dynamically to avoid circular dependencies
      const { playerCombatStats, agentDuelStats } =
        await import("../../../database/schema.js");
      const { sql } = await import("drizzle-orm");

      const now = Date.now();

      // Update winner stats (playerCombatStats)
      await db
        .insert(playerCombatStats)
        .values({
          playerId: winnerId,
          totalDuelWins: 1,
          totalDuelLosses: 0,
        })
        .onConflictDoUpdate({
          target: playerCombatStats.playerId,
          set: {
            totalDuelWins: sql`${playerCombatStats.totalDuelWins} + 1`,
            updatedAt: sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
          },
        });

      // Update loser stats (playerCombatStats)
      await db
        .insert(playerCombatStats)
        .values({
          playerId: loserId,
          totalDuelWins: 0,
          totalDuelLosses: 1,
        })
        .onConflictDoUpdate({
          target: playerCombatStats.playerId,
          set: {
            totalDuelLosses: sql`${playerCombatStats.totalDuelLosses} + 1`,
            updatedAt: sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
          },
        });

      // Persist agent-specific stats (agentDuelStats) for AI model tracking
      const winnerAgentStats = this.agentStats.get(winnerId);
      const loserAgentStats = this.agentStats.get(loserId);

      if (winnerAgentStats) {
        const winner = this.callbacks?.getCurrentCycleAgentDamage(winnerId);
        const damageDealt = winner?.damageDealtThisFight ?? 0;

        await db
          .insert(agentDuelStats)
          .values({
            characterId: winnerId,
            agentName: winnerAgentStats.name,
            provider: winnerAgentStats.provider,
            model: winnerAgentStats.model,
            wins: winnerAgentStats.wins,
            losses: winnerAgentStats.losses,
            draws: 0,
            totalDamageDealt: damageDealt,
            totalDamageTaken: 0,
            killStreak: Math.max(winnerAgentStats.currentStreak, 1),
            currentStreak: winnerAgentStats.currentStreak,
            lastDuelAt: now,
          })
          .onConflictDoUpdate({
            target: agentDuelStats.characterId,
            set: {
              wins: sql`${agentDuelStats.wins} + 1`,
              totalDamageDealt: sql`${agentDuelStats.totalDamageDealt} + ${damageDealt}`,
              killStreak: sql`GREATEST(${agentDuelStats.killStreak}, ${agentDuelStats.currentStreak} + 1)`,
              currentStreak: sql`${agentDuelStats.currentStreak} + 1`,
              lastDuelAt: now,
              updatedAt: sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
            },
          });
      }

      if (loserAgentStats) {
        const loser = this.callbacks?.getCurrentCycleAgentDamage(loserId);
        const damageDealt = loser?.damageDealtThisFight ?? 0;

        await db
          .insert(agentDuelStats)
          .values({
            characterId: loserId,
            agentName: loserAgentStats.name,
            provider: loserAgentStats.provider,
            model: loserAgentStats.model,
            wins: loserAgentStats.wins,
            losses: loserAgentStats.losses,
            draws: 0,
            totalDamageDealt: damageDealt,
            totalDamageTaken: 0,
            killStreak: 0,
            currentStreak: 0,
            lastDuelAt: now,
          })
          .onConflictDoUpdate({
            target: agentDuelStats.characterId,
            set: {
              losses: sql`${agentDuelStats.losses} + 1`,
              totalDamageDealt: sql`${agentDuelStats.totalDamageDealt} + ${damageDealt}`,
              currentStreak: 0,
              lastDuelAt: now,
              updatedAt: sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
            },
          });
      }

      Logger.info(
        "StreamingDuelScheduler",
        `Stats persisted: ${winnerId} won, ${loserId} lost`,
      );
    } catch (err) {
      Logger.warn("StreamingDuelScheduler", `Error persisting stats: ${err}`);
    }
  }

  /**
   * Update stats for a draw outcome (#24).
   * Does not affect win/loss counts or streaks — just marks leaderboard dirty.
   */
  updateDrawStats(_agent1Id: string, _agent2Id: string): void {
    // Draws don't change win/loss/streak — just dirty the leaderboard
    // so any future display reflects the draw was recorded.
    this.leaderboardDirty = true;
  }

  // ==========================================================================
  // Recent Duels
  // ==========================================================================

  /**
   * Record a recently completed duel (newest first, capped to maxRecentDuels).
   * If database persistence is enabled, also writes to streaming_duel_history.
   */
  recordRecentDuel(duel: RecentDuelEntry): void {
    this.recentDuels.unshift(duel);
    if (this.recentDuels.length > this.config.maxRecentDuels) {
      this.recentDuels.length = this.config.maxRecentDuels;
    }

    if (this.config.persistStatsToDatabase) {
      this.persistDuelHistory(duel).catch((err) => {
        Logger.warn(
          "StreamingDuelScheduler",
          `Failed to persist duel history: ${err}`,
        );
      });
    }
  }

  private async persistDuelHistory(duel: RecentDuelEntry): Promise<void> {
    const db = this.getDatabase();
    if (!db) return;

    const { streamingDuelHistory } =
      await import("../../../database/schema.js");

    await db.insert(streamingDuelHistory).values({
      cycleId: duel.cycleId,
      duelId: duel.duelId,
      finishedAt: duel.finishedAt,
      winnerId: duel.winnerId,
      winnerName: duel.winnerName,
      loserId: duel.loserId,
      loserName: duel.loserName,
      winReason: duel.winReason,
      damageWinner: duel.damageWinner,
      damageLoser: duel.damageLoser,
    });
  }

  // ==========================================================================
  // Leaderboard
  // ==========================================================================

  /**
   * Get leaderboard sorted by win rate, then by total wins.
   * Caches result and only recomputes when stats change.
   */
  getLeaderboard(): LeaderboardEntry[] {
    if (!this.leaderboardDirty) {
      return this.cachedLeaderboard;
    }

    const entries: LeaderboardEntry[] = [];

    for (const [characterId, stats] of this.agentStats) {
      const totalGames = stats.wins + stats.losses;
      const winRate = totalGames > 0 ? stats.wins / totalGames : 0;

      entries.push({
        rank: 0, // Will be set after sorting
        characterId,
        name: stats.name,
        provider: stats.provider,
        model: stats.model,
        wins: stats.wins,
        losses: stats.losses,
        winRate,
        combatLevel: stats.combatLevel,
        currentStreak: stats.currentStreak,
      });
    }

    // Sort by win rate, then by total wins
    entries.sort((a, b) => {
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      return b.wins - a.wins;
    });

    // Assign ranks
    for (let i = 0; i < entries.length; i++) {
      entries[i].rank = i + 1;
    }

    this.cachedLeaderboard = entries;
    this.leaderboardDirty = false;
    return entries;
  }

  /**
   * Get recent duel history, capped by the provided limit.
   */
  getRecentDuels(limit: number = 30): RecentDuelEntry[] {
    const safeLimit = Math.max(1, Math.min(limit, this.config.maxRecentDuels));
    return this.recentDuels.slice(0, safeLimit);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Reset all matchmaking state for destroy/cleanup.
   */
  reset(): void {
    this.availableAgents.clear();
    this.streamingDuelOptOut.clear();
    this.agentStats.clear();
    this.agentStatsLastSeenAt.clear();
    this.recentDuels = [];
    this.cachedLeaderboard = [];
    this.leaderboardDirty = true;
    this.nextDuelPair = null;
    this.insufficientAgentWarningCount = 0;
    this.lastInsufficientAgentsLog = 0;
    this.callbacks = null;
  }
}
