/**
 * StreamingDuelScheduler Types
 *
 * Types for the 15-minute duel cycle streaming mode
 */

export type StreamingPhase =
  "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";

export type StreamingDuelOutcome = "win" | "draw";
export type StreamingDuelWinReason =
  "kill" | "hp_advantage" | "damage_advantage" | "draw";

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
  arenaId: number | null;
  betOpenTime: number | null;
  betCloseTime: number | null;
  countdownValue: number | null; // 3, 2, 1, 0
  fightStartTime: number | null;
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
  winRate: number;
  combatLevel: number;
  currentStreak: number;
}

export interface RecentDuelEntry {
  cycleId: string;
  duelId: string | null;
  finishedAt: number;
  outcome: StreamingDuelOutcome;
  agent1Id: string;
  agent1Name: string;
  agent2Id: string;
  agent2Name: string;
  winnerId: string | null;
  winnerName: string | null;
  loserId: string | null;
  loserName: string | null;
  winReason: StreamingDuelWinReason;
  damageAgent1: number;
  damageAgent2: number;
  damageWinner: number | null;
  damageLoser: number | null;
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
  rank: number;
  headToHeadWins: number;
  headToHeadLosses: number;
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
    betOpenTime: number | null;
    betCloseTime: number | null;
    countdown: number | null;
    fightStartTime: number | null;
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
  /** Minimum announcement time before early-exit is allowed (#21) */
  MIN_ANNOUNCEMENT_DURATION: 10_000,
  /** Delay between end of one cycle's cleanup and start of the next cycle.
   * Gives spectators a visual reset and prevents stale avatar artifacts. */
  INTER_CYCLE_DELAY_MS: 2000,
} as const;
