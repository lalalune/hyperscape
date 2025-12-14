/**
 * CombatAuditLog Unit Tests
 *
 * Tests for combat event logging and analysis:
 * - Event logging (attacks, combat start/end, deaths, violations)
 * - Per-player log tracking
 * - Area-based queries
 * - Log retention and pruning
 * - Export functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CombatAuditLog, CombatAuditEventType } from "../CombatAuditLog";

describe("CombatAuditLog", () => {
  let auditLog: CombatAuditLog;

  beforeEach(() => {
    auditLog = new CombatAuditLog();
  });

  describe("logAttack", () => {
    it("logs an attack event", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 15,
      });

      const entries = auditLog.getAttacksByPlayer("player1");
      expect(entries.length).toBe(1);
      expect(entries[0].eventType).toBe(CombatAuditEventType.ATTACK);
      expect(entries[0].damage).toBe(15);
    });

    it("stores positions when provided", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
        attackerPosition: { x: 5, y: 0, z: 10 },
        targetPosition: { x: 6, y: 0, z: 10 },
      });

      const entries = auditLog.getAttacksByPlayer("player1");
      expect(entries[0].attackerPosition).toEqual({ x: 5, y: 0, z: 10 });
      expect(entries[0].targetPosition).toEqual({ x: 6, y: 0, z: 10 });
    });

    it("stores metadata when provided", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
        metadata: { weaponType: "sword", critical: true },
      });

      const entries = auditLog.getAttacksByPlayer("player1");
      expect(entries[0].metadata).toEqual({
        weaponType: "sword",
        critical: true,
      });
    });
  });

  describe("logCombatStart", () => {
    it("logs combat start event", () => {
      auditLog.logCombatStart({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
      });

      const entries = auditLog.getAttacksByPlayer("player1");
      expect(entries.length).toBe(1);
      expect(entries[0].eventType).toBe(CombatAuditEventType.COMBAT_START);
    });
  });

  describe("logCombatEnd", () => {
    it("logs combat end event with reason", () => {
      auditLog.logCombatEnd({
        tick: 150,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        reason: "target_died",
      });

      const entries = auditLog.getAttacksByPlayer("player1");
      expect(entries.length).toBe(1);
      expect(entries[0].eventType).toBe(CombatAuditEventType.COMBAT_END);
      expect(entries[0].metadata?.reason).toBe("target_died");
    });
  });

  describe("logDeath", () => {
    it("logs death event", () => {
      auditLog.logDeath({
        tick: 200,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        finalDamage: 25,
      });

      const entries = auditLog.getAttacksByPlayer("player1");
      expect(entries.length).toBe(1);
      expect(entries[0].eventType).toBe(CombatAuditEventType.DEATH);
      expect(entries[0].damage).toBe(25);
    });
  });

  describe("logViolation", () => {
    it("logs violation event", () => {
      auditLog.logViolation({
        tick: 100,
        playerId: "player1",
        violationType: "attack_rate_exceeded",
        severity: "MAJOR",
        details: "4 attacks in one tick",
      });

      const violations = auditLog.getViolationsByPlayer("player1");
      expect(violations.length).toBe(1);
      expect(violations[0].eventType).toBe(CombatAuditEventType.VIOLATION);
      expect(violations[0].metadata?.violationType).toBe(
        "attack_rate_exceeded",
      );
      expect(violations[0].metadata?.severity).toBe("MAJOR");
    });
  });

  describe("getAttacksByPlayer", () => {
    it("returns empty array for unknown player", () => {
      const entries = auditLog.getAttacksByPlayer("unknown");
      expect(entries.length).toBe(0);
    });

    it("filters by timestamp", () => {
      // Log 3 attacks at different times
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
      });

      const firstTimestamp = Date.now();

      auditLog.logAttack({
        tick: 101,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 12,
      });

      auditLog.logAttack({
        tick: 102,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 8,
      });

      // Get entries since first timestamp (should exclude first entry at the boundary)
      const entries = auditLog.getAttacksByPlayer("player1", firstTimestamp);
      expect(entries.length).toBeGreaterThanOrEqual(2);
    });

    it("tracks both attacker and target player", () => {
      // Player attacks player
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "player2",
        targetType: "player",
        damage: 10,
      });

      const attackerLogs = auditLog.getAttacksByPlayer("player1");
      const targetLogs = auditLog.getAttacksByPlayer("player2");

      expect(attackerLogs.length).toBe(1);
      expect(targetLogs.length).toBe(1);
    });
  });

  describe("getAttacksInArea", () => {
    it("returns attacks within radius", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
        attackerPosition: { x: 10, y: 0, z: 10 },
      });

      auditLog.logAttack({
        tick: 101,
        attackerId: "player2",
        attackerType: "player",
        targetId: "mob2",
        targetType: "mob",
        damage: 12,
        attackerPosition: { x: 100, y: 0, z: 100 },
      });

      // Query around first attack location
      const entries = auditLog.getAttacksInArea({ x: 10, y: 0, z: 10 }, 5);
      expect(entries.length).toBe(1);
      expect(entries[0].attackerId).toBe("player1");
    });

    it("returns empty array for no matches", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
        attackerPosition: { x: 10, y: 0, z: 10 },
      });

      const entries = auditLog.getAttacksInArea({ x: 1000, y: 0, z: 1000 }, 5);
      expect(entries.length).toBe(0);
    });
  });

  describe("getViolationsByPlayer", () => {
    it("returns only violation events", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
      });

      auditLog.logViolation({
        tick: 101,
        playerId: "player1",
        violationType: "out_of_range",
        severity: "MODERATE",
      });

      const violations = auditLog.getViolationsByPlayer("player1");
      expect(violations.length).toBe(1);
      expect(violations[0].eventType).toBe(CombatAuditEventType.VIOLATION);
    });
  });

  describe("exportForReview", () => {
    it("exports JSON with player data", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
      });

      const exportJson = auditLog.exportForReview("player1");
      const data = JSON.parse(exportJson);

      expect(data.playerId).toBe("player1");
      expect(data.totalEntries).toBe(1);
      expect(data.entries.length).toBe(1);
      expect(data.exportTime).toBeDefined();
    });

    it("exports empty data for unknown player", () => {
      const exportJson = auditLog.exportForReview("unknown");
      const data = JSON.parse(exportJson);

      expect(data.playerId).toBe("unknown");
      expect(data.totalEntries).toBe(0);
      expect(data.entries.length).toBe(0);
    });
  });

  describe("getStats", () => {
    it("returns correct statistics", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
      });

      auditLog.logCombatStart({
        tick: 100,
        attackerId: "player2",
        attackerType: "player",
        targetId: "mob2",
        targetType: "mob",
      });

      const stats = auditLog.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.trackedPlayers).toBe(2);
      expect(stats.entriesByType[CombatAuditEventType.ATTACK]).toBe(1);
      expect(stats.entriesByType[CombatAuditEventType.COMBAT_START]).toBe(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it("returns null timestamps for empty log", () => {
      const stats = auditLog.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe("cleanupPlayer", () => {
    it("removes player logs", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
      });

      expect(auditLog.getAttacksByPlayer("player1").length).toBe(1);

      auditLog.cleanupPlayer("player1");

      expect(auditLog.getAttacksByPlayer("player1").length).toBe(0);
    });
  });

  describe("clear", () => {
    it("clears all logs", () => {
      auditLog.logAttack({
        tick: 100,
        attackerId: "player1",
        attackerType: "player",
        targetId: "mob1",
        targetType: "mob",
        damage: 10,
      });

      auditLog.logAttack({
        tick: 101,
        attackerId: "player2",
        attackerType: "player",
        targetId: "mob2",
        targetType: "mob",
        damage: 12,
      });

      expect(auditLog.getStats().totalEntries).toBe(2);

      auditLog.clear();

      expect(auditLog.getStats().totalEntries).toBe(0);
      expect(auditLog.getStats().trackedPlayers).toBe(0);
    });
  });

  describe("log retention", () => {
    it("respects maxEntriesPerPlayer config", () => {
      const smallLog = new CombatAuditLog({ maxEntriesPerPlayer: 3 });

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        smallLog.logAttack({
          tick: 100 + i,
          attackerId: "player1",
          attackerType: "player",
          targetId: "mob1",
          targetType: "mob",
          damage: 10 + i,
        });
      }

      // Should only keep last 3
      const entries = smallLog.getAttacksByPlayer("player1");
      expect(entries.length).toBe(3);
      // Should have the newest entries
      expect(entries[2].damage).toBe(14);
    });

    it("respects maxEntries config", () => {
      const smallLog = new CombatAuditLog({ maxEntries: 5 });

      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        smallLog.logAttack({
          tick: 100 + i,
          attackerId: `player${i}`,
          attackerType: "player",
          targetId: "mob1",
          targetType: "mob",
          damage: 10,
        });
      }

      const stats = smallLog.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(5);
    });
  });

  describe("getConfig", () => {
    it("returns default config", () => {
      const config = auditLog.getConfig();
      expect(config.maxEntries).toBe(10000);
      expect(config.maxEntriesPerPlayer).toBe(500);
      expect(config.retentionMs).toBe(30 * 60 * 1000);
    });

    it("returns custom config", () => {
      const customLog = new CombatAuditLog({
        maxEntries: 5000,
        retentionMs: 60 * 60 * 1000,
      });

      const config = customLog.getConfig();
      expect(config.maxEntries).toBe(5000);
      expect(config.retentionMs).toBe(60 * 60 * 1000);
    });
  });
});
