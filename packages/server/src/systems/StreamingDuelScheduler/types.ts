/**
 * StreamingDuelScheduler Types
 *
 * Types for the 15-minute duel cycle streaming mode
 */

import type { DuelPreparationStatus } from "./preparation";
import type { CompetitiveSnapshot } from "./competitive-snapshot.js";

export type StreamingPhase =
  "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";

export type StreamingDuelOutcome = "win" | "draw";
export type StreamingDuelHistoryOutcome = StreamingDuelOutcome | "cancelled";
export type StreamingDuelWinReason =
  "kill" | "forfeit" | "hp_advantage" | "damage_advantage" | "draw";

export type SwitchableStreamingCombatRole = "melee" | "ranged" | "mage";
export const MAX_DUEL_PREPARATION_OPPONENT_HISTORY = 8;
export const FROZEN_STREAMING_ARMOR_SLOTS = [
  "helmet",
  "body",
  "legs",
  "boots",
  "gloves",
  "cape",
  "amulet",
  "ring",
] as const;
export type FrozenStreamingArmorSlot =
  (typeof FROZEN_STREAMING_ARMOR_SLOTS)[number];
export type FrozenStreamingArmorIds = Record<
  FrozenStreamingArmorSlot,
  string | null
>;

/** Exact pre-market item/spell allowlist for one switchable combat role. */
export interface FrozenStreamingCombatLoadout {
  role: SwitchableStreamingCombatRole;
  weaponId: string;
  arrowsId: string | null;
  shieldId: string | null;
  spellId: string | null;
  /** Present on schema-v3 snapshots; omitted only for legacy frozen cycles. */
  armorIds?: FrozenStreamingArmorIds;
}

export type FrozenStreamingCombatLoadouts = Partial<
  Record<SwitchableStreamingCombatRole, FrozenStreamingCombatLoadout>
>;

export interface AgentContestant {
  characterId: string;
  name: string;
  provider: string;
  model: string;
  combatLevel: number;
  wins: number;
  losses: number;
  currentHp: number;
  maxHp: number;
  originalPosition: [number, number, number];
  damageDealtThisFight: number;
  highestHit: number;
  attacksLanded: number;
  healsUsed: number;
  equipment: Record<string, string>;
  inventory: Array<{ itemId: string; quantity: number } | null>;
  /** itemId → manifest iconPath; streaming client resolves URLs (may lack local ITEMS). */
  itemIconPaths: Record<string, string>;
  /** Immutable pre-market loadout digest; null only for local diagnostic bots. */
  loadoutFingerprint: string | null;
  /** Combat styles supported by gear and supplies present at market open. */
  availableCombatStyles: Array<"melee" | "ranged" | "mage" | "prayer">;
  /** Exact role-specific gear/spell choices permitted after market open. */
  combatLoadouts: FrozenStreamingCombatLoadouts;
  /** True for conserved competitive custody or an exact local diagnostic switch map. */
  loadoutFrozen: boolean;
  /** Exact fixed-point prayer resource frozen before the market opens. */
  prayerPointUnits: number;
  /** Display prayer points derived from the exact frozen units. */
  prayerPoints: number;
  prayerMaxPoints: number;
  rank: number;
  headToHeadWins: number;
  headToHeadLosses: number;
}

export interface StreamingDuelCycle {
  cycleId: string;
  phase: StreamingPhase;

  // Timing (all in milliseconds)
  cycleStartTime: number;
  phaseStartTime: number;
  phaseVersion: number;

  // Contestants (null during IDLE)
  agent1: AgentContestant | null;
  agent2: AgentContestant | null;

  // Active duel tracking
  duelId: string | null;
  duelKeyHex: string | null;
  competitiveSnapshotVersion: number | null;
  competitiveSnapshotDigest: string | null;
  competitiveSnapshot: CompetitiveSnapshot | null;
  arenaId: number | null;
  betOpenTime: number | null;
  betCloseTime: number | null;
  countdownValue: number | null; // 3, 2, 1, 0
  fightStartTime: number | null;
  firstHitAt?: number | null;
  duelEndTime: number | null;
  arenaPositions: {
    agent1: [number, number, number];
    agent2: [number, number, number];
  } | null;

  // Result (set during RESOLUTION)
  winnerId: string | null;
  loserId: string | null;
  outcome: StreamingDuelOutcome | null;
  winReason: StreamingDuelWinReason | null;
  seed: string | null;
  replayHash: string | null;

  /** Internal restart-recovery marker; never accepted from public input. */
  recoveredFromPersistence?: boolean;
}

export interface AgentDuelStats {
  characterId: string;
  agentName: string;
  provider: string;
  model: string;
  wins: number;
  losses: number;
  draws: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  killStreak: number;
  currentStreak: number;
  lastDuelAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  characterId: string;
  name: string;
  provider: string;
  model: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  combatLevel: number;
  currentStreak: number;
}

export interface RecentDuelEntry {
  cycleId: string;
  duelId: string | null;
  finishedAt: number;
  outcome: StreamingDuelHistoryOutcome;
  agent1Id: string | null;
  agent1Name: string | null;
  agent1OpeningStyle: SwitchableStreamingCombatRole | null;
  agent2Id: string | null;
  agent2Name: string | null;
  agent2OpeningStyle: SwitchableStreamingCombatRole | null;
  winnerId: string | null;
  winnerName: string | null;
  loserId: string | null;
  loserName: string | null;
  winReason: StreamingDuelWinReason | null;
  cancellationReason: string | null;
  damageAgent1: number;
  damageAgent2: number;
  damageWinner: number | null;
  damageLoser: number | null;
}

/**
 * Bounded, participant-relative history supplied to private duel preparation.
 * It contains only immutable outcome data and frozen opening styles; inventory,
 * equipment identifiers, and private preparation details never cross this
 * scheduler event boundary.
 */
export interface DuelPreparationOpponentHistoryEntry {
  cycleId: string;
  finishedAt: number;
  result: "win" | "loss" | "draw";
  ownOpeningStyle: SwitchableStreamingCombatRole | null;
  opponentOpeningStyle: SwitchableStreamingCombatRole | null;
  ownDamage: number;
  opponentDamage: number;
  winReason: StreamingDuelWinReason;
}

export interface StreamingCombatEngagementMetrics {
  checks: number;
  retries: number;
  recoveries: number;
  failures: number;
  proximityCorrections: number;
  currentRetryCount: number;
}

export interface StreamingDuelOperationalMetrics {
  emittedAt: number;
  historyWindow: {
    size: number;
    maxSize: number;
    wins: number;
    draws: number;
    completed: number;
    cancelled: number;
    terminal: number;
    completionRate: number | null;
    cancellationReasons: Record<string, number>;
  };
  engagement: StreamingCombatEngagementMetrics;
  current: {
    cycleId: string | null;
    phase: StreamingPhase;
    firstHitLatencyMs: number | null;
    recoveryInProgress: boolean;
    schedulerState: "IDLE" | "WAITING_FOR_AGENTS" | "ACTIVE";
    availableAgents: number;
    requiredAgents: number;
    preparation: {
      enabled: boolean;
      gateInFlight: boolean;
      selectionInFlight: boolean;
      status: DuelPreparationStatus | null;
      expiresAt: number | null;
    };
  };
}

export interface StreamingCycleAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  hp: number;
  maxHp: number;
  combatLevel: number;
  wins: number;
  losses: number;
  damageDealtThisFight: number;
  highestHit: number;
  attacksLanded: number;
  healsUsed: number;
  equipment: Record<string, string>;
  inventory: Array<{ itemId: string; quantity: number } | null>;
  itemIconPaths: Record<string, string>;
  loadoutFingerprint: string | null;
  availableCombatStyles: Array<"melee" | "ranged" | "mage" | "prayer">;
  combatLoadouts: FrozenStreamingCombatLoadouts;
  loadoutFrozen: boolean;
  prayerPointUnits: number;
  prayerPoints: number;
  prayerMaxPoints: number;
  rank: number;
  headToHeadWins: number;
  headToHeadLosses: number;
}

export interface StreamingTerminalNotice {
  cycleId: string;
  duelId: string | null;
  outcome: "cancelled";
  reason: string;
  occurredAt: number;
  expiresAt: number;
  agent1Id: string | null;
  agent1Name: string | null;
  agent2Id: string | null;
  agent2Name: string | null;
}

export interface StreamingStateUpdate {
  type: "STREAMING_STATE_UPDATE";
  cycle: {
    cycleId: string;
    phase: StreamingPhase;
    cycleStartTime: number;
    phaseStartTime: number;
    phaseEndTime: number;
    phaseVersion: number;
    timeRemaining: number;

    agent1: StreamingCycleAgent | null;
    agent2: StreamingCycleAgent | null;

    duelId: string | null;
    duelKeyHex: string | null;
    competitiveSnapshotVersion: number | null;
    competitiveSnapshotDigest: string | null;
    competitiveSnapshot: CompetitiveSnapshot | null;
    betOpenTime: number | null;
    betCloseTime: number | null;
    countdown: number | null;
    fightStartTime: number | null;
    firstHitAt: number | null;
    duelEndTime: number | null;
    arenaPositions: {
      agent1: [number, number, number];
      agent2: [number, number, number];
    } | null;
    winnerId: string | null;
    winnerName: string | null;
    outcome: StreamingDuelOutcome | null;
    winReason: string | null;
    seed: string | null;
    replayHash: string | null;
  };
  leaderboard: LeaderboardEntry[];
  cameraTarget: string | null;
  terminalNotice: StreamingTerminalNotice | null;
}

const parseDurationEnv = (
  key: string,
  fallbackMs: number,
  minMs: number,
): number => {
  const raw = process.env[key];
  if (!raw) return fallbackMs;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < minMs) {
    return fallbackMs;
  }

  return parsed;
};

const isDevelopment = process.env.NODE_ENV !== "production";
const DEV_ANNOUNCEMENT_MS = 60 * 1000;
const DEV_FIGHTING_MS = 270 * 1000;
const DEV_END_WARNING_MS = 15 * 1000;
const DEV_RESOLUTION_MS = 10 * 1000;

const ANNOUNCEMENT_DURATION = parseDurationEnv(
  "STREAMING_ANNOUNCEMENT_MS",
  DEV_ANNOUNCEMENT_MS,
  1000,
);
const FIGHTING_DURATION = parseDurationEnv(
  "STREAMING_FIGHTING_MS",
  DEV_FIGHTING_MS,
  5000,
);
const END_WARNING_DURATION = parseDurationEnv(
  "STREAMING_END_WARNING_MS",
  DEV_END_WARNING_MS,
  1000,
);
const RESOLUTION_DURATION = parseDurationEnv(
  "STREAMING_RESOLUTION_MS",
  DEV_RESOLUTION_MS,
  1000,
);
const COUNTDOWN_TICKS = parseDurationEnv("STREAMING_COUNTDOWN_TICKS", 3, 1);

// Timing constants (in milliseconds)
export const STREAMING_TIMING = {
  CYCLE_DURATION:
    ANNOUNCEMENT_DURATION +
    FIGHTING_DURATION +
    END_WARNING_DURATION +
    RESOLUTION_DURATION,
  ANNOUNCEMENT_DURATION,
  FIGHTING_DURATION,
  END_WARNING_DURATION,
  RESOLUTION_DURATION,
  COUNTDOWN_TICKS,
  COUNTDOWN_DURATION: (COUNTDOWN_TICKS + 1) * 1000,
  STATE_BROADCAST_INTERVAL: 1000, // Broadcast every 1 second
  FIGHT_BROADCAST_INTERVAL: 200, // Faster updates during fight
  /** Delay between end of one cycle's cleanup and start of the next cycle.
   * Gives spectators a visual reset and prevents stale avatar artifacts. */
  INTER_CYCLE_DELAY_MS: 2000,
} as const;
