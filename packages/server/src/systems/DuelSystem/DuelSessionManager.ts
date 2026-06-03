/**
 * DuelSessionManager - Session CRUD Operations
 *
 * Single Responsibility: Managing duel session lifecycle
 * - Session creation and deletion
 * - Player-to-session mapping
 * - Session queries
 *
 * Does NOT handle:
 * - State transitions (DuelSystem)
 * - Combat resolution (DuelCombatResolver)
 * - Arena management (ArenaPoolManager)
 */

import type { World } from "@hyperforge/shared";
import type {
  DuelRules,
  StakedItem,
  DuelState,
  EquipmentRestrictions,
} from "@hyperforge/shared";
import {
  DEFAULT_DUEL_RULES,
  DEFAULT_EQUIPMENT_RESTRICTIONS,
} from "@hyperforge/shared";
import { generateDuelId } from "./config";
import {
  type SessionStore,
  InMemorySessionStore,
} from "../../infrastructure/session-store";

// Re-export for consumers that import from this module
export type { EquipmentRestrictions } from "@hyperforge/shared";

/**
 * Server-side duel session structure.
 * Uses a flattened format for efficiency.
 * Named distinctly from the shared DuelSession to avoid confusion.
 */
export interface ServerDuelSession {
  readonly duelId: string;
  state: DuelState;

  // Participants (immutable after creation)
  readonly challengerId: string;
  readonly challengerName: string;
  readonly targetId: string;
  readonly targetName: string;

  // Rules & Restrictions
  rules: DuelRules;
  equipmentRestrictions: EquipmentRestrictions;

  // Stakes
  challengerStakes: StakedItem[];
  targetStakes: StakedItem[];

  // Acceptance state (per screen)
  challengerAccepted: boolean;
  targetAccepted: boolean;

  // Arena
  arenaId: number | null;

  // Timestamps
  readonly createdAt: number;
  countdownStartedAt?: number;
  fightStartedAt?: number;
  finishedAt?: number;

  // Countdown tracking (tick-based, deterministic)
  countdownStartTick?: number;
  lastCountdownTick?: number;

  // Result
  winnerId?: string;
  forfeitedBy?: string;

  // Tick-based scheduling (replaces setTimeout)
  pendingResolution?: {
    winnerId: string;
    loserId: string;
    reason: "death" | "forfeit";
    resolveAtTick: number;
  };
  pendingDisconnect?: {
    playerId: string;
    forfeitAtTick: number;
  };
  pendingSetupDisconnect?: {
    playerId: string;
    cancelAtTick: number;
  };
}

// ============================================================================
// DuelSessionManager Class
// ============================================================================

export class DuelSessionManager {
  /** All active duel sessions by ID — backed by pluggable SessionStore */
  private duelSessions: SessionStore<ServerDuelSession>;

  /** Player ID to their active duel session ID */
  private playerDuels: Map<string, string> = new Map();

  constructor(
    private world: World,
    sessionStore?: SessionStore<ServerDuelSession>,
  ) {
    this.duelSessions = sessionStore ?? new InMemorySessionStore();
  }

  // ==========================================================================
  // Session CRUD
  // ==========================================================================

  /**
   * Create a new duel session
   * @returns The newly created session's duelId
   */
  createSession(
    challengerId: string,
    challengerName: string,
    targetId: string,
    targetName: string,
  ): string {
    const duelId = generateDuelId();

    const session: ServerDuelSession = {
      duelId,
      state: "RULES",
      challengerId,
      challengerName,
      targetId,
      targetName,
      rules: { ...DEFAULT_DUEL_RULES },
      equipmentRestrictions: { ...DEFAULT_EQUIPMENT_RESTRICTIONS },
      challengerStakes: [],
      targetStakes: [],
      challengerAccepted: false,
      targetAccepted: false,
      arenaId: null,
      createdAt: Date.now(),
    };

    this.duelSessions.set(duelId, session);
    this.playerDuels.set(challengerId, duelId);
    this.playerDuels.set(targetId, duelId);

    // Emit session created event
    this.world.emit("duel:session:created", {
      duelId,
      challengerId,
      challengerName,
      targetId,
      targetName,
    });

    return duelId;
  }

  /**
   * Get a duel session by ID
   */
  getSession(duelId: string): ServerDuelSession | undefined {
    return this.duelSessions.get(duelId);
  }

  /**
   * Get the duel session for a player
   */
  getPlayerSession(playerId: string): ServerDuelSession | undefined {
    const duelId = this.playerDuels.get(playerId);
    return duelId ? this.duelSessions.get(duelId) : undefined;
  }

  /**
   * Get the duel ID for a player
   */
  getPlayerDuelId(playerId: string): string | undefined {
    return this.playerDuels.get(playerId);
  }

  /**
   * Check if a player is in any duel
   */
  isPlayerInDuel(playerId: string): boolean {
    return this.playerDuels.has(playerId);
  }

  /**
   * Delete a duel session and clean up player mappings
   * @returns The deleted session, or undefined if not found
   */
  deleteSession(duelId: string): ServerDuelSession | undefined {
    const session = this.duelSessions.get(duelId);
    if (session) {
      this.duelSessions.delete(duelId);
      this.playerDuels.delete(session.challengerId);
      this.playerDuels.delete(session.targetId);
    }
    return session;
  }

  /**
   * Get all active sessions as an iterator
   */
  getAllSessions(): IterableIterator<[string, ServerDuelSession]> {
    return this.duelSessions.entries();
  }

  /**
   * Get the number of active sessions
   */
  get sessionCount(): number {
    return this.duelSessions.size;
  }

  /**
   * Clear all sessions (used during shutdown)
   */
  clearAllSessions(): void {
    this.duelSessions.clear();
    this.playerDuels.clear();
  }

  // ==========================================================================
  // Session State Helpers
  // ==========================================================================

  /**
   * Check if a player is the challenger in their session
   */
  isChallenger(playerId: string): boolean {
    const session = this.getPlayerSession(playerId);
    return session?.challengerId === playerId;
  }

  /**
   * Check if a player is the target in their session
   */
  isTarget(playerId: string): boolean {
    const session = this.getPlayerSession(playerId);
    return session?.targetId === playerId;
  }

  /**
   * Get the opponent's player ID for a given player (performs session lookup)
   */
  getOpponentId(playerId: string): string | undefined {
    const session = this.getPlayerSession(playerId);
    if (!session) return undefined;
    return getSessionOpponentId(session, playerId);
  }

  /**
   * Get the stakes array for a specific player
   */
  getPlayerStakes(
    session: ServerDuelSession,
    playerId: string,
  ): StakedItem[] | undefined {
    if (playerId === session.challengerId) {
      return session.challengerStakes;
    }
    if (playerId === session.targetId) {
      return session.targetStakes;
    }
    return undefined;
  }

  /**
   * Reset acceptance state for both players (called when rules/stakes change)
   */
  resetAcceptance(session: ServerDuelSession): void {
    session.challengerAccepted = false;
    session.targetAccepted = false;
  }

  /**
   * Set acceptance state for a player
   * @returns true if both players have accepted
   */
  setPlayerAcceptance(
    session: ServerDuelSession,
    playerId: string,
    accepted: boolean,
  ): boolean {
    if (playerId === session.challengerId) {
      session.challengerAccepted = accepted;
    } else if (playerId === session.targetId) {
      session.targetAccepted = accepted;
    }
    return session.challengerAccepted && session.targetAccepted;
  }
}

// ============================================================================
// Session Utility Functions (pure, no instance state needed)
// ============================================================================

/**
 * Determine a player's role in a session.
 * Returns null if the player is not a participant.
 */
export function getParticipantRole(
  session: ServerDuelSession,
  playerId: string,
): "challenger" | "target" | null {
  if (playerId === session.challengerId) return "challenger";
  if (playerId === session.targetId) return "target";
  return null;
}

/**
 * Get the opponent's player ID within a session (no lookup needed).
 * Assumes playerId IS a participant — callers must validate first.
 */
export function getSessionOpponentId(
  session: ServerDuelSession,
  playerId: string,
): string {
  return playerId === session.challengerId
    ? session.targetId
    : session.challengerId;
}
