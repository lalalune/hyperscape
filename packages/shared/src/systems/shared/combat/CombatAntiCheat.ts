/**
 * Combat Anti-Cheat Monitor
 *
 * Detects and logs suspicious combat patterns for admin review.
 * This is a MONITORING system, not a blocking system - it logs
 * violations but does not prevent gameplay.
 *
 * The actual blocking is done by input validators and CombatSystem checks.
 * This system tracks patterns over time to identify potential bad actors.
 *
 * @see COMBAT_SYSTEM_HARDENING_PLAN.md Phase 6: Game Studio Hardening
 */

/**
 * Combat violation severity levels
 * Higher severity = more points toward threshold
 */
export enum CombatViolationSeverity {
  /** Minor issues (e.g., timing slightly off) - 1 point */
  MINOR = 0,
  /** Moderate issues (e.g., slight range violations) - 5 points */
  MODERATE = 1,
  /** Major issues (e.g., attacking dead targets) - 15 points */
  MAJOR = 2,
  /** Critical issues (e.g., impossible attack rates) - 50 points */
  CRITICAL = 3,
}

/**
 * Types of combat violations we track
 */
export enum CombatViolationType {
  /** Attacking entities beyond valid melee range */
  OUT_OF_RANGE_ATTACK = "out_of_range_attack",
  /** Attacking already dead entities */
  DEAD_TARGET_ATTACK = "dead_target_attack",
  /** Attacking invalid entity types */
  INVALID_TARGET_TYPE = "invalid_target_type",
  /** Attacking faster than weapon speed allows */
  ATTACK_RATE_EXCEEDED = "attack_rate_exceeded",
  /** Attacking during loading/protection periods */
  ATTACK_DURING_PROTECTION = "attack_during_protection",
  /** Attempting to attack self */
  SELF_ATTACK = "self_attack",
  /** Attacking entities that don't exist */
  NONEXISTENT_TARGET = "nonexistent_target",
  /** Invalid entity ID format (injection attempt) */
  INVALID_ENTITY_ID = "invalid_entity_id",
  /** Combat action during invalid state */
  INVALID_COMBAT_STATE = "invalid_combat_state",
}

/**
 * Record of a single combat violation
 */
interface CombatViolationRecord {
  /** Player who committed the violation */
  playerId: string;
  /** Type of violation */
  type: CombatViolationType;
  /** Severity level */
  severity: CombatViolationSeverity;
  /** Human-readable details */
  details: string;
  /** When the violation occurred */
  timestamp: number;
  /** Target entity ID (if applicable) */
  targetId?: string;
  /** Current game tick when violation occurred */
  gameTick?: number;
}

/**
 * Per-player violation tracking state
 */
interface PlayerViolationState {
  /** Recent violations for this player */
  violations: CombatViolationRecord[];
  /** Weighted violation score (decays over time) */
  score: number;
  /** Last time we warned admins about this player */
  lastWarningTime: number;
  /** Count of attacks this tick (for rate limiting detection) */
  attacksThisTick: number;
  /** Last tick we counted attacks on */
  lastAttackCountTick: number;
}

/**
 * Weights for different severity levels
 * Higher severity = more points toward threshold
 */
const VIOLATION_WEIGHTS: Record<CombatViolationSeverity, number> = {
  [CombatViolationSeverity.MINOR]: 1,
  [CombatViolationSeverity.MODERATE]: 5,
  [CombatViolationSeverity.MAJOR]: 15,
  [CombatViolationSeverity.CRITICAL]: 50,
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

/** Maximum attacks per tick before flagging (accounting for lag) */
const MAX_ATTACKS_PER_TICK = 3;

/**
 * Combat Anti-Cheat Monitor
 *
 * Tracks player combat violations over time and logs patterns for admin review.
 */
export class CombatAntiCheat {
  private playerStates: Map<string, PlayerViolationState> = new Map();

  /**
   * Record a combat violation
   *
   * @param playerId - Player who committed the violation
   * @param type - Type of violation
   * @param severity - Severity level
   * @param details - Human-readable description
   * @param targetId - Target entity ID (optional)
   * @param gameTick - Current game tick (optional)
   */
  recordViolation(
    playerId: string,
    type: CombatViolationType,
    severity: CombatViolationSeverity,
    details: string,
    targetId?: string,
    gameTick?: number,
  ): void {
    const state = this.getOrCreateState(playerId);

    const violation: CombatViolationRecord = {
      playerId,
      type,
      severity,
      details,
      timestamp: Date.now(),
      targetId,
      gameTick,
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
    if (severity >= CombatViolationSeverity.MAJOR) {
      console.warn(
        `[CombatAntiCheat] ${CombatViolationSeverity[severity]}: player=${playerId} type=${type} "${details}"`,
      );
    }

    // Check thresholds and alert if needed
    this.checkThresholds(playerId, state);
  }

  /**
   * Track attack for rate limiting detection
   *
   * @param playerId - Player attempting attack
   * @param currentTick - Current game tick
   * @returns true if attack rate is suspicious
   */
  trackAttack(playerId: string, currentTick: number): boolean {
    const state = this.getOrCreateState(playerId);

    // Reset count on new tick
    if (state.lastAttackCountTick !== currentTick) {
      state.attacksThisTick = 0;
      state.lastAttackCountTick = currentTick;
    }

    state.attacksThisTick++;

    // Check if exceeding rate
    if (state.attacksThisTick > MAX_ATTACKS_PER_TICK) {
      this.recordViolation(
        playerId,
        CombatViolationType.ATTACK_RATE_EXCEEDED,
        CombatViolationSeverity.MAJOR,
        `${state.attacksThisTick} attacks in tick ${currentTick} (max ${MAX_ATTACKS_PER_TICK})`,
        undefined,
        currentTick,
      );
      return true;
    }

    return false;
  }

  /**
   * Record out-of-range attack attempt
   */
  recordOutOfRangeAttack(
    playerId: string,
    targetId: string,
    distance: number,
    maxRange: number,
    gameTick?: number,
  ): void {
    this.recordViolation(
      playerId,
      CombatViolationType.OUT_OF_RANGE_ATTACK,
      CombatViolationSeverity.MODERATE,
      `Attacked target at distance ${distance.toFixed(1)} tiles (max ${maxRange})`,
      targetId,
      gameTick,
    );
  }

  /**
   * Record attack on dead target
   */
  recordDeadTargetAttack(
    playerId: string,
    targetId: string,
    gameTick?: number,
  ): void {
    this.recordViolation(
      playerId,
      CombatViolationType.DEAD_TARGET_ATTACK,
      CombatViolationSeverity.MAJOR,
      `Attacked dead target ${targetId}`,
      targetId,
      gameTick,
    );
  }

  /**
   * Record attack on nonexistent target
   */
  recordNonexistentTargetAttack(
    playerId: string,
    targetId: string,
    gameTick?: number,
  ): void {
    this.recordViolation(
      playerId,
      CombatViolationType.NONEXISTENT_TARGET,
      CombatViolationSeverity.MAJOR,
      `Attacked nonexistent target ${targetId}`,
      targetId,
      gameTick,
    );
  }

  /**
   * Record invalid entity ID format (potential injection)
   */
  recordInvalidEntityId(playerId: string, invalidId: string): void {
    // Sanitize the ID for logging (truncate, escape)
    const sanitizedId = String(invalidId).slice(0, 64).replace(/[<>&]/g, "_");

    this.recordViolation(
      playerId,
      CombatViolationType.INVALID_ENTITY_ID,
      CombatViolationSeverity.CRITICAL,
      `Invalid entity ID format: "${sanitizedId}"`,
    );
  }

  /**
   * Record self-attack attempt
   */
  recordSelfAttack(playerId: string, gameTick?: number): void {
    this.recordViolation(
      playerId,
      CombatViolationType.SELF_ATTACK,
      CombatViolationSeverity.MODERATE,
      "Attempted to attack self",
      playerId,
      gameTick,
    );
  }

  /**
   * Decay violation scores over time
   * Call this periodically (e.g., every minute)
   */
  decayScores(): void {
    for (const [playerId, state] of this.playerStates) {
      state.score = Math.max(0, state.score - SCORE_DECAY_PER_MINUTE);

      // Clean up players with no recent violations and zero score
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
    recentViolations: CombatViolationRecord[];
    attacksThisTick: number;
  } {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return { score: 0, recentViolations: [], attacksThisTick: 0 };
    }

    // Get violations from last 5 minutes
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    const recentViolations = state.violations.filter(
      (v) => v.timestamp > fiveMinutesAgo,
    );

    return {
      score: state.score,
      recentViolations,
      attacksThisTick: state.attacksThisTick,
    };
  }

  /**
   * Get overall stats (for monitoring dashboard)
   */
  getStats(): {
    trackedPlayers: number;
    playersAboveWarning: number;
    playersAboveAlert: number;
    totalViolationsLast5Min: number;
  } {
    let playersAboveWarning = 0;
    let playersAboveAlert = 0;
    let totalViolationsLast5Min = 0;

    const now = Date.now();
    const fiveMinutesAgo = now - 300000;

    for (const state of this.playerStates.values()) {
      if (state.score >= ALERT_THRESHOLD) {
        playersAboveAlert++;
      } else if (state.score >= WARNING_THRESHOLD) {
        playersAboveWarning++;
      }

      totalViolationsLast5Min += state.violations.filter(
        (v) => v.timestamp > fiveMinutesAgo,
      ).length;
    }

    return {
      trackedPlayers: this.playerStates.size,
      playersAboveWarning,
      playersAboveAlert,
      totalViolationsLast5Min,
    };
  }

  /**
   * Get players requiring admin attention
   */
  getPlayersRequiringReview(): string[] {
    const players: string[] = [];
    for (const [playerId, state] of this.playerStates) {
      if (state.score >= ALERT_THRESHOLD) {
        players.push(playerId);
      }
    }
    return players;
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
   * Clear all tracking data
   */
  destroy(): void {
    this.playerStates.clear();
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
        attacksThisTick: 0,
        lastAttackCountTick: 0,
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
        `[CombatAntiCheat] ALERT: player=${playerId} score=${state.score} - requires admin review`,
      );
      state.lastWarningTime = now;
    } else if (state.score >= WARNING_THRESHOLD) {
      console.warn(
        `[CombatAntiCheat] WARNING: player=${playerId} score=${state.score}`,
      );
      state.lastWarningTime = now;
    }
  }
}
