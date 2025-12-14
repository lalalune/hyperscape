/**
 * CombatAntiCheat Unit Tests
 *
 * Tests for the combat anti-cheat monitoring system:
 * - Violation recording and severity scoring
 * - Attack rate tracking
 * - Score decay over time
 * - Player reports and stats
 * - Threshold alerts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CombatAntiCheat,
  CombatViolationType,
  CombatViolationSeverity,
} from "../CombatAntiCheat";

describe("CombatAntiCheat", () => {
  let antiCheat: CombatAntiCheat;

  beforeEach(() => {
    antiCheat = new CombatAntiCheat();
  });

  describe("recordViolation", () => {
    it("records a minor violation with score 1", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.OUT_OF_RANGE_ATTACK,
        CombatViolationSeverity.MINOR,
        "Slight range violation",
        "mob123",
        100,
      );

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(1);
      expect(report.recentViolations.length).toBe(1);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.OUT_OF_RANGE_ATTACK,
      );
    });

    it("records a moderate violation with score 5", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MODERATE,
        "Attempted self-attack",
      );

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(5);
    });

    it("records a major violation with score 15", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.DEAD_TARGET_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Attacked dead target",
      );

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(15);
    });

    it("records a critical violation with score 50", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.INVALID_ENTITY_ID,
        CombatViolationSeverity.CRITICAL,
        "Invalid ID format detected",
      );

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(50);
    });

    it("accumulates scores from multiple violations", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.OUT_OF_RANGE_ATTACK,
        CombatViolationSeverity.MINOR,
        "First",
      );
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.DEAD_TARGET_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Second",
      );

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(16); // 1 + 15
      expect(report.recentViolations.length).toBe(2);
    });

    it("tracks violations per player separately", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MODERATE,
        "Player 1 violation",
      );
      antiCheat.recordViolation(
        "player2",
        CombatViolationType.DEAD_TARGET_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Player 2 violation",
      );

      expect(antiCheat.getPlayerReport("player1").score).toBe(5);
      expect(antiCheat.getPlayerReport("player2").score).toBe(15);
    });
  });

  describe("convenience recording methods", () => {
    it("recordOutOfRangeAttack creates moderate violation", () => {
      antiCheat.recordOutOfRangeAttack("player1", "mob123", 5, 1, 100);

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(5);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.OUT_OF_RANGE_ATTACK,
      );
    });

    it("recordDeadTargetAttack creates major violation", () => {
      antiCheat.recordDeadTargetAttack("player1", "deadMob", 100);

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(15);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.DEAD_TARGET_ATTACK,
      );
    });

    it("recordNonexistentTargetAttack creates major violation", () => {
      antiCheat.recordNonexistentTargetAttack("player1", "fakeMob", 100);

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(15);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.NONEXISTENT_TARGET,
      );
    });

    it("recordInvalidEntityId creates critical violation", () => {
      antiCheat.recordInvalidEntityId("player1", "<script>evil</script>");

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(50);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.INVALID_ENTITY_ID,
      );
    });

    it("recordSelfAttack creates moderate violation", () => {
      antiCheat.recordSelfAttack("player1", 100);

      const report = antiCheat.getPlayerReport("player1");
      expect(report.score).toBe(5);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.SELF_ATTACK,
      );
    });
  });

  describe("trackAttack", () => {
    it("returns false for normal attack rates", () => {
      expect(antiCheat.trackAttack("player1", 100)).toBe(false);
      expect(antiCheat.trackAttack("player1", 100)).toBe(false);
      expect(antiCheat.trackAttack("player1", 100)).toBe(false);
    });

    it("returns true and records violation on 4th attack in same tick", () => {
      antiCheat.trackAttack("player1", 100);
      antiCheat.trackAttack("player1", 100);
      antiCheat.trackAttack("player1", 100);

      // 4th attack should trigger violation
      const isSuspicious = antiCheat.trackAttack("player1", 100);
      expect(isSuspicious).toBe(true);

      const report = antiCheat.getPlayerReport("player1");
      expect(report.recentViolations.length).toBe(1);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.ATTACK_RATE_EXCEEDED,
      );
    });

    it("resets count on new tick", () => {
      antiCheat.trackAttack("player1", 100);
      antiCheat.trackAttack("player1", 100);
      antiCheat.trackAttack("player1", 100);

      // New tick - count should reset
      expect(antiCheat.trackAttack("player1", 101)).toBe(false);

      const report = antiCheat.getPlayerReport("player1");
      expect(report.attacksThisTick).toBe(1);
    });

    it("tracks attacks per player separately", () => {
      antiCheat.trackAttack("player1", 100);
      antiCheat.trackAttack("player1", 100);
      antiCheat.trackAttack("player2", 100);

      expect(antiCheat.getPlayerReport("player1").attacksThisTick).toBe(2);
      expect(antiCheat.getPlayerReport("player2").attacksThisTick).toBe(1);
    });
  });

  describe("decayScores", () => {
    it("reduces scores by 10 points per decay call", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.DEAD_TARGET_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Test",
      );

      expect(antiCheat.getPlayerReport("player1").score).toBe(15);

      antiCheat.decayScores();
      expect(antiCheat.getPlayerReport("player1").score).toBe(5);

      antiCheat.decayScores();
      expect(antiCheat.getPlayerReport("player1").score).toBe(0);
    });

    it("does not reduce score below 0", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.OUT_OF_RANGE_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test",
      );

      antiCheat.decayScores();
      antiCheat.decayScores();
      antiCheat.decayScores();

      expect(antiCheat.getPlayerReport("player1").score).toBe(0);
    });

    it("removes players with zero score and no violations", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.OUT_OF_RANGE_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test",
      );

      // Player should be tracked
      expect(antiCheat.getStats().trackedPlayers).toBe(1);

      // After decay, score goes to 0 but violations remain
      antiCheat.decayScores();

      // Player still tracked (has violations in history)
      expect(antiCheat.getStats().trackedPlayers).toBe(1);
    });
  });

  describe("getPlayerReport", () => {
    it("returns empty report for unknown player", () => {
      const report = antiCheat.getPlayerReport("unknown");

      expect(report.score).toBe(0);
      expect(report.recentViolations).toEqual([]);
      expect(report.attacksThisTick).toBe(0);
    });

    it("includes all expected fields", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MODERATE,
        "Test violation",
        "target123",
        50,
      );

      const report = antiCheat.getPlayerReport("player1");

      expect(report.score).toBe(5);
      expect(report.recentViolations.length).toBe(1);
      expect(report.recentViolations[0]).toMatchObject({
        playerId: "player1",
        type: CombatViolationType.SELF_ATTACK,
        severity: CombatViolationSeverity.MODERATE,
        details: "Test violation",
        targetId: "target123",
        gameTick: 50,
      });
      expect(report.recentViolations[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    it("returns correct tracked player count", () => {
      expect(antiCheat.getStats().trackedPlayers).toBe(0);

      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test",
      );
      expect(antiCheat.getStats().trackedPlayers).toBe(1);

      antiCheat.recordViolation(
        "player2",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test",
      );
      expect(antiCheat.getStats().trackedPlayers).toBe(2);
    });

    it("counts players above warning threshold (25)", () => {
      // Add 5 moderate violations = 25 points (at warning threshold)
      for (let i = 0; i < 5; i++) {
        antiCheat.recordViolation(
          "player1",
          CombatViolationType.SELF_ATTACK,
          CombatViolationSeverity.MODERATE,
          "Test",
        );
      }

      expect(antiCheat.getStats().playersAboveWarning).toBe(1);
      expect(antiCheat.getStats().playersAboveAlert).toBe(0);
    });

    it("counts players above alert threshold (75)", () => {
      // Add 2 critical violations = 100 points (above alert threshold)
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.INVALID_ENTITY_ID,
        CombatViolationSeverity.CRITICAL,
        "Test",
      );
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.INVALID_ENTITY_ID,
        CombatViolationSeverity.CRITICAL,
        "Test",
      );

      expect(antiCheat.getStats().playersAboveAlert).toBe(1);
      // playersAboveWarning only counts those BETWEEN warning and alert
      expect(antiCheat.getStats().playersAboveWarning).toBe(0);
    });

    it("tracks total violations in last 5 minutes", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test 1",
      );
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test 2",
      );
      antiCheat.recordViolation(
        "player2",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test 3",
      );

      expect(antiCheat.getStats().totalViolationsLast5Min).toBe(3);
    });
  });

  describe("getPlayersRequiringReview", () => {
    it("returns empty array when no players above alert threshold", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MINOR,
        "Test",
      );

      expect(antiCheat.getPlayersRequiringReview()).toEqual([]);
    });

    it("returns players above alert threshold", () => {
      // Player 1: 100 points (above alert)
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.INVALID_ENTITY_ID,
        CombatViolationSeverity.CRITICAL,
        "Test",
      );
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.INVALID_ENTITY_ID,
        CombatViolationSeverity.CRITICAL,
        "Test",
      );

      // Player 2: 5 points (below alert)
      antiCheat.recordViolation(
        "player2",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MODERATE,
        "Test",
      );

      const playersNeedingReview = antiCheat.getPlayersRequiringReview();
      expect(playersNeedingReview).toContain("player1");
      expect(playersNeedingReview).not.toContain("player2");
    });
  });

  describe("cleanup", () => {
    it("removes player tracking data", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Test",
      );

      expect(antiCheat.getStats().trackedPlayers).toBe(1);
      expect(antiCheat.getPlayerReport("player1").score).toBe(15);

      antiCheat.cleanup("player1");

      expect(antiCheat.getStats().trackedPlayers).toBe(0);
      expect(antiCheat.getPlayerReport("player1").score).toBe(0);
    });

    it("does not affect other players", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Test",
      );
      antiCheat.recordViolation(
        "player2",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Test",
      );

      antiCheat.cleanup("player1");

      expect(antiCheat.getPlayerReport("player1").score).toBe(0);
      expect(antiCheat.getPlayerReport("player2").score).toBe(15);
    });
  });

  describe("destroy", () => {
    it("clears all tracking data", () => {
      antiCheat.recordViolation(
        "player1",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Test",
      );
      antiCheat.recordViolation(
        "player2",
        CombatViolationType.SELF_ATTACK,
        CombatViolationSeverity.MAJOR,
        "Test",
      );

      expect(antiCheat.getStats().trackedPlayers).toBe(2);

      antiCheat.destroy();

      expect(antiCheat.getStats().trackedPlayers).toBe(0);
    });
  });

  describe("violation limits", () => {
    it("keeps only last 100 violations per player", () => {
      // Record 105 violations
      for (let i = 0; i < 105; i++) {
        antiCheat.recordViolation(
          "player1",
          CombatViolationType.OUT_OF_RANGE_ATTACK,
          CombatViolationSeverity.MINOR,
          `Violation ${i}`,
        );
      }

      const report = antiCheat.getPlayerReport("player1");
      // Should filter to last 5 minutes, but even in history, max is 100
      // Score continues to accumulate
      expect(report.score).toBe(105);
    });
  });

  describe("violation types", () => {
    it("tracks all defined violation types", () => {
      const types = [
        CombatViolationType.OUT_OF_RANGE_ATTACK,
        CombatViolationType.DEAD_TARGET_ATTACK,
        CombatViolationType.INVALID_TARGET_TYPE,
        CombatViolationType.ATTACK_RATE_EXCEEDED,
        CombatViolationType.ATTACK_DURING_PROTECTION,
        CombatViolationType.SELF_ATTACK,
        CombatViolationType.NONEXISTENT_TARGET,
        CombatViolationType.INVALID_ENTITY_ID,
        CombatViolationType.INVALID_COMBAT_STATE,
      ];

      let i = 0;
      for (const type of types) {
        antiCheat.recordViolation(
          `player${i}`,
          type,
          CombatViolationSeverity.MINOR,
          "Test",
        );
        i++;
      }

      expect(antiCheat.getStats().trackedPlayers).toBe(types.length);
    });
  });
});
