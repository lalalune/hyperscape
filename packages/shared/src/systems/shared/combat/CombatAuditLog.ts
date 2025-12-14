/**
 * CombatAuditLog - Persistent combat event logging
 *
 * Records combat events for post-mortem analysis, exploit investigation,
 * and anti-cheat verification. Events are stored in memory with configurable
 * retention limits.
 *
 * Use Cases:
 * - Investigate reported exploits
 * - Verify anti-cheat alerts
 * - Post-mortem analysis of combat issues
 * - Debug combat system behavior
 */

/**
 * Position interface for combat events
 */
interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Combat audit entry structure
 */
export interface CombatAuditEntry {
  readonly timestamp: number;
  readonly tick: number;
  readonly eventType: CombatAuditEventType;
  readonly attackerId: string;
  readonly attackerType: "player" | "mob";
  readonly targetId: string;
  readonly targetType: "player" | "mob";
  readonly damage?: number;
  readonly attackerPosition?: Position3D;
  readonly targetPosition?: Position3D;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Combat audit event types
 */
export enum CombatAuditEventType {
  ATTACK = "attack",
  COMBAT_START = "combat_start",
  COMBAT_END = "combat_end",
  DEATH = "death",
  DAMAGE_DEALT = "damage_dealt",
  VIOLATION = "violation",
}

/**
 * Configuration for the audit log
 */
export interface CombatAuditConfig {
  maxEntries: number;
  maxEntriesPerPlayer: number;
  retentionMs: number;
}

const DEFAULT_AUDIT_CONFIG: CombatAuditConfig = {
  maxEntries: 10000,
  maxEntriesPerPlayer: 500,
  retentionMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Combat audit log for tracking and analyzing combat events
 */
export class CombatAuditLog {
  private readonly logs: CombatAuditEntry[] = [];
  private readonly playerLogs = new Map<string, CombatAuditEntry[]>();
  private readonly config: CombatAuditConfig;

  constructor(config?: Partial<CombatAuditConfig>) {
    this.config = { ...DEFAULT_AUDIT_CONFIG, ...config };
  }

  /**
   * Log an attack event
   */
  logAttack(data: {
    tick: number;
    attackerId: string;
    attackerType: "player" | "mob";
    targetId: string;
    targetType: "player" | "mob";
    damage: number;
    attackerPosition?: Position3D;
    targetPosition?: Position3D;
    metadata?: Record<string, unknown>;
  }): void {
    const entry: CombatAuditEntry = {
      timestamp: Date.now(),
      tick: data.tick,
      eventType: CombatAuditEventType.ATTACK,
      attackerId: data.attackerId,
      attackerType: data.attackerType,
      targetId: data.targetId,
      targetType: data.targetType,
      damage: data.damage,
      attackerPosition: data.attackerPosition,
      targetPosition: data.targetPosition,
      metadata: data.metadata,
    };

    this.addEntry(entry);
  }

  /**
   * Log combat start event
   */
  logCombatStart(data: {
    tick: number;
    attackerId: string;
    attackerType: "player" | "mob";
    targetId: string;
    targetType: "player" | "mob";
    metadata?: Record<string, unknown>;
  }): void {
    const entry: CombatAuditEntry = {
      timestamp: Date.now(),
      tick: data.tick,
      eventType: CombatAuditEventType.COMBAT_START,
      attackerId: data.attackerId,
      attackerType: data.attackerType,
      targetId: data.targetId,
      targetType: data.targetType,
      metadata: data.metadata,
    };

    this.addEntry(entry);
  }

  /**
   * Log combat end event
   */
  logCombatEnd(data: {
    tick: number;
    attackerId: string;
    attackerType: "player" | "mob";
    targetId: string;
    targetType: "player" | "mob";
    reason?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const entry: CombatAuditEntry = {
      timestamp: Date.now(),
      tick: data.tick,
      eventType: CombatAuditEventType.COMBAT_END,
      attackerId: data.attackerId,
      attackerType: data.attackerType,
      targetId: data.targetId,
      targetType: data.targetType,
      metadata: { ...data.metadata, reason: data.reason },
    };

    this.addEntry(entry);
  }

  /**
   * Log death event
   */
  logDeath(data: {
    tick: number;
    attackerId: string;
    attackerType: "player" | "mob";
    targetId: string;
    targetType: "player" | "mob";
    finalDamage: number;
    metadata?: Record<string, unknown>;
  }): void {
    const entry: CombatAuditEntry = {
      timestamp: Date.now(),
      tick: data.tick,
      eventType: CombatAuditEventType.DEATH,
      attackerId: data.attackerId,
      attackerType: data.attackerType,
      targetId: data.targetId,
      targetType: data.targetType,
      damage: data.finalDamage,
      metadata: data.metadata,
    };

    this.addEntry(entry);
  }

  /**
   * Log a violation event (from anti-cheat)
   */
  logViolation(data: {
    tick: number;
    playerId: string;
    violationType: string;
    severity: string;
    details?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const entry: CombatAuditEntry = {
      timestamp: Date.now(),
      tick: data.tick,
      eventType: CombatAuditEventType.VIOLATION,
      attackerId: data.playerId,
      attackerType: "player",
      targetId: "",
      targetType: "mob",
      metadata: {
        ...data.metadata,
        violationType: data.violationType,
        severity: data.severity,
        details: data.details,
      },
    };

    this.addEntry(entry);
  }

  /**
   * Add entry to both global and per-player logs
   */
  private addEntry(entry: CombatAuditEntry): void {
    // Add to global log
    this.logs.push(entry);
    this.pruneOldEntries();

    // Add to per-player logs for quick lookup
    if (entry.attackerType === "player") {
      this.addToPlayerLog(entry.attackerId, entry);
    }
    if (entry.targetType === "player" && entry.targetId) {
      this.addToPlayerLog(entry.targetId, entry);
    }
  }

  /**
   * Add entry to a specific player's log
   */
  private addToPlayerLog(playerId: string, entry: CombatAuditEntry): void {
    if (!this.playerLogs.has(playerId)) {
      this.playerLogs.set(playerId, []);
    }

    const playerLog = this.playerLogs.get(playerId)!;
    playerLog.push(entry);

    // Prune per-player logs
    if (playerLog.length > this.config.maxEntriesPerPlayer) {
      playerLog.splice(0, playerLog.length - this.config.maxEntriesPerPlayer);
    }
  }

  /**
   * Remove old entries based on retention policy
   */
  private pruneOldEntries(): void {
    const cutoffTime = Date.now() - this.config.retentionMs;

    // Prune global log by time and size
    while (
      this.logs.length > 0 &&
      (this.logs[0].timestamp < cutoffTime ||
        this.logs.length > this.config.maxEntries)
    ) {
      this.logs.shift();
    }
  }

  /**
   * Get all attacks by a specific player since a timestamp
   */
  getAttacksByPlayer(
    playerId: string,
    since: number = 0,
  ): readonly CombatAuditEntry[] {
    const playerLog = this.playerLogs.get(playerId) || [];
    return playerLog.filter((e) => e.timestamp >= since);
  }

  /**
   * Get all attacks in an area (for investigating multi-player incidents)
   */
  getAttacksInArea(
    position: Position3D,
    radius: number,
    since: number = 0,
  ): readonly CombatAuditEntry[] {
    const radiusSq = radius * radius;

    return this.logs.filter((entry) => {
      if (entry.timestamp < since) return false;

      // Check attacker position
      if (entry.attackerPosition) {
        const dx = entry.attackerPosition.x - position.x;
        const dz = entry.attackerPosition.z - position.z;
        if (dx * dx + dz * dz <= radiusSq) return true;
      }

      // Check target position
      if (entry.targetPosition) {
        const dx = entry.targetPosition.x - position.x;
        const dz = entry.targetPosition.z - position.z;
        if (dx * dx + dz * dz <= radiusSq) return true;
      }

      return false;
    });
  }

  /**
   * Get all violations for a player
   */
  getViolationsByPlayer(
    playerId: string,
    since: number = 0,
  ): readonly CombatAuditEntry[] {
    const playerLog = this.playerLogs.get(playerId) || [];
    return playerLog.filter(
      (e) =>
        e.eventType === CombatAuditEventType.VIOLATION && e.timestamp >= since,
    );
  }

  /**
   * Export combat data for a player (JSON format for admin review)
   */
  exportForReview(playerId: string): string {
    const entries = this.getAttacksByPlayer(playerId);
    const violations = this.getViolationsByPlayer(playerId);

    return JSON.stringify(
      {
        playerId,
        exportTime: new Date().toISOString(),
        totalEntries: entries.length,
        totalViolations: violations.length,
        entries: entries.slice(-100), // Last 100 entries
        violations: violations.slice(-50), // Last 50 violations
      },
      null,
      2,
    );
  }

  /**
   * Get summary statistics for the audit log
   */
  getStats(): {
    totalEntries: number;
    trackedPlayers: number;
    entriesByType: Record<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entriesByType: Record<string, number> = {};

    for (const entry of this.logs) {
      entriesByType[entry.eventType] =
        (entriesByType[entry.eventType] || 0) + 1;
    }

    return {
      totalEntries: this.logs.length,
      trackedPlayers: this.playerLogs.size,
      entriesByType,
      oldestEntry: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestEntry:
        this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
    };
  }

  /**
   * Clean up logs for a disconnecting player
   */
  cleanupPlayer(playerId: string): void {
    this.playerLogs.delete(playerId);
  }

  /**
   * Clear all logs (for testing or admin reset)
   */
  clear(): void {
    this.logs.length = 0;
    this.playerLogs.clear();
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CombatAuditConfig> {
    return this.config;
  }
}
