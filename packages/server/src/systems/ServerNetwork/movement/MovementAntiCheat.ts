/**
 * Movement Anti-Cheat Monitor
 *
 * Detects and logs suspicious movement patterns for admin review.
 * This is a MONITORING system, not a blocking system - it logs
 * violations but does not prevent gameplay.
 *
 * The actual blocking is done by the input validator. This system
 * tracks patterns over time to identify potential bad actors.
 *
 * @see MOVEMENT_SYSTEM_HARDENING_PLAN.md for security rationale
 */

import type { TileCoord } from "@hyperscape/shared";
import { MovementViolationSeverity } from "./MovementInputValidator";

/**
 * Record of a single violation
 */
interface ViolationRecord {
  /** Player who committed the violation */
  playerId: string;
  /** Type of violation (e.g., "invalid_move_request", "nan_injection") */
  type: string;
  /** Severity level */
  severity: MovementViolationSeverity;
  /** Human-readable details */
  details: string;
  /** When the violation occurred */
  timestamp: number;
  /** Tile where violation occurred (if applicable) */
  tile?: TileCoord;
}

/**
 * Per-player violation tracking state
 */
interface PlayerViolationState {
  /** Recent violations for this player */
  violations: ViolationRecord[];
  /** Weighted violation score (decays over time) */
  score: number;
  /** Last time we warned admins about this player */
  lastWarningTime: number;
}

/**
 * Weights for different severity levels
 * Higher severity = more points toward threshold
 */
const VIOLATION_WEIGHTS: Record<MovementViolationSeverity, number> = {
  [MovementViolationSeverity.MINOR]: 1,
  [MovementViolationSeverity.MODERATE]: 5,
  [MovementViolationSeverity.MAJOR]: 15,
  [MovementViolationSeverity.CRITICAL]: 50,
};

/** Score decay per minute (rewards good behavior) */
const SCORE_DECAY_PER_MINUTE = 10;

/** Score threshold for logging a warning */
const WARNING_THRESHOLD = 25;

/** Score threshold for logging an alert (requires admin review) */
const ALERT_THRESHOLD = 75;

/** Minimum time between warnings for same player (ms) */
const WARNING_COOLDOWN_MS = 60000;

/** Maximum violations to keep per player */
const MAX_VIOLATIONS_PER_PLAYER = 100;

/**
 * Movement Anti-Cheat Monitor
 *
 * Tracks player violations over time and logs patterns for admin review.
 */
export class MovementAntiCheat {
  private playerStates: Map<string, PlayerViolationState> = new Map();

  /**
   * Record a movement violation
   *
   * @param playerId - Player who committed the violation
   * @param type - Type of violation
   * @param severity - Severity level
   * @param details - Human-readable description
   * @param tile - Tile where violation occurred (optional)
   */
  recordViolation(
    playerId: string,
    type: string,
    severity: MovementViolationSeverity,
    details: string,
    tile?: TileCoord,
  ): void {
    const state = this.getOrCreateState(playerId);

    const violation: ViolationRecord = {
      playerId,
      type,
      severity,
      details,
      timestamp: Date.now(),
      tile,
    };

    // Add violation to history
    state.violations.push(violation);

    // Keep only recent violations
    if (state.violations.length > MAX_VIOLATIONS_PER_PLAYER) {
      state.violations.shift();
    }

    // Update score
    state.score += VIOLATION_WEIGHTS[severity];

    // Log major/critical violations immediately
    if (severity >= MovementViolationSeverity.MAJOR) {
      console.warn(
        `[AntiCheat] ${MovementViolationSeverity[severity]}: player=${playerId} type=${type} "${details}"`,
      );
    }

    // Check thresholds and alert if needed
    this.checkThresholds(playerId, state);
  }

  /**
   * Decay violation scores over time
   * Call this periodically (e.g., every minute)
   */
  decayScores(): void {
    for (const [playerId, state] of this.playerStates) {
      state.score = Math.max(0, state.score - SCORE_DECAY_PER_MINUTE);

      // Clean up players with no recent violations
      if (state.score === 0 && state.violations.length === 0) {
        this.playerStates.delete(playerId);
      }
    }
  }

  /**
   * Get violation report for a player (for admin tools)
   *
   * @param playerId - Player to get report for
   * @returns Report with score and recent violations
   */
  getPlayerReport(playerId: string): {
    score: number;
    recentViolations: ViolationRecord[];
  } {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return { score: 0, recentViolations: [] };
    }

    // Get violations from last 5 minutes
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    const recentViolations = state.violations.filter(
      (v) => v.timestamp > fiveMinutesAgo,
    );

    return { score: state.score, recentViolations };
  }

  /**
   * Get overall stats (for monitoring dashboard)
   */
  getStats(): {
    trackedPlayers: number;
    playersAboveWarning: number;
    playersAboveAlert: number;
  } {
    let playersAboveWarning = 0;
    let playersAboveAlert = 0;

    for (const state of this.playerStates.values()) {
      if (state.score >= ALERT_THRESHOLD) {
        playersAboveAlert++;
      } else if (state.score >= WARNING_THRESHOLD) {
        playersAboveWarning++;
      }
    }

    return {
      trackedPlayers: this.playerStates.size,
      playersAboveWarning,
      playersAboveAlert,
    };
  }

  /**
   * Clean up state for a disconnected player
   *
   * @param playerId - Player to clean up
   */
  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Get or create violation state for a player
   */
  private getOrCreateState(playerId: string): PlayerViolationState {
    let state = this.playerStates.get(playerId);
    if (!state) {
      state = {
        violations: [],
        score: 0,
        lastWarningTime: 0,
      };
      this.playerStates.set(playerId, state);
    }
    return state;
  }

  /**
   * Check if player has exceeded thresholds and log alerts
   */
  private checkThresholds(playerId: string, state: PlayerViolationState): void {
    const now = Date.now();

    // Throttle warnings to prevent log spam
    if (now - state.lastWarningTime < WARNING_COOLDOWN_MS) {
      return;
    }

    if (state.score >= ALERT_THRESHOLD) {
      console.error(
        `[AntiCheat] ALERT: player=${playerId} score=${state.score} - requires admin review`,
      );
      state.lastWarningTime = now;
    } else if (state.score >= WARNING_THRESHOLD) {
      console.warn(
        `[AntiCheat] WARNING: player=${playerId} score=${state.score}`,
      );
      state.lastWarningTime = now;
    }
  }
}
