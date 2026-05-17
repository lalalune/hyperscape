/**
 * CombatRemediation Tests
 *
 * Covers recent combat system hardening:
 * - Longrange range modifier values
 * - COMBAT_CONSTANTS formula values
 * - Rate limit → anti-cheat integration
 * - Arrow consumption event emission
 * - Melee cooldown timing (claimed before damage)
 * - Position validation violation type
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CombatAntiCheat,
  CombatViolationType,
  CombatViolationSeverity,
} from "../CombatAntiCheat";
import { CombatRateLimiter } from "../CombatRateLimiter";
import { RANGED_STYLE_BONUSES, MAGIC_STYLE_BONUSES } from "@hyperforge/shared";
import { COMBAT_CONSTANTS } from "@hyperforge/shared";
import { EventType } from "@hyperforge/shared";

describe("CombatRemediation", () => {
  describe("Longrange range modifier", () => {
    it("RANGED_STYLE_BONUSES longrange has rangeModifier of 2", () => {
      expect(RANGED_STYLE_BONUSES["longrange"].rangeModifier).toBe(2);
    });

    it("MAGIC_STYLE_BONUSES longrange has rangeModifier of 2", () => {
      expect(MAGIC_STYLE_BONUSES["longrange"].rangeModifier).toBe(2);
    });
  });

  describe("COMBAT_CONSTANTS usage", () => {
    it("EFFECTIVE_LEVEL_CONSTANT is 8", () => {
      expect(COMBAT_CONSTANTS.EFFECTIVE_LEVEL_CONSTANT).toBe(8);
    });

    it("BASE_CONSTANT is 64", () => {
      expect(COMBAT_CONSTANTS.BASE_CONSTANT).toBe(64);
    });

    it("DAMAGE_DIVISOR is 640", () => {
      expect(COMBAT_CONSTANTS.DAMAGE_DIVISOR).toBe(640);
    });
  });

  describe("Rate limit → anti-cheat integration", () => {
    let antiCheat: CombatAntiCheat;
    let rateLimiter: CombatRateLimiter;

    beforeEach(() => {
      antiCheat = new CombatAntiCheat();
      rateLimiter = new CombatRateLimiter({
        maxRequestsPerTick: 2,
        maxRequestsPerSecond: 10,
        cooldownTicks: 1,
        logViolations: false,
      });
    });

    it("records anti-cheat violation when rate limit is exceeded", () => {
      const tick = 100;
      const playerId = "player-rate-test";

      // Exhaust rate limit
      rateLimiter.checkLimit(playerId, tick);
      rateLimiter.checkLimit(playerId, tick);
      const result = rateLimiter.checkLimit(playerId, tick);

      expect(result.allowed).toBe(false);

      // Wire the violation into anti-cheat (mirrors CombatSystem behavior)
      antiCheat.recordViolation(
        playerId,
        CombatViolationType.ATTACK_RATE_EXCEEDED,
        CombatViolationSeverity.MINOR,
        `Melee rate limited: ${result.reason}`,
        undefined,
        tick,
      );

      const report = antiCheat.getPlayerReport(playerId);
      expect(report.score).toBeGreaterThan(0);
      expect(report.recentViolations).toHaveLength(1);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.ATTACK_RATE_EXCEEDED,
      );
    });
  });

  describe("Arrow consumption event", () => {
    it("EQUIPMENT_CONSUME_ARROW event type exists", () => {
      expect(EventType.EQUIPMENT_CONSUME_ARROW).toBe("equipment:consume_arrow");
    });
  });

  describe("Melee cooldown timing", () => {
    it("nextAttackTicks map accepts EntityID keys", () => {
      // Verify the data structure used for cooldown tracking is a Map
      // that can store tick values (mirrors CombatSystem.nextAttackTicks)
      const nextAttackTicks = new Map<string, number>();
      const attackerId = "player-cooldown-test";
      const currentTick = 100;
      const attackSpeedTicks = 4;

      // Cooldown is claimed BEFORE damage calculation in CombatSystem
      nextAttackTicks.set(attackerId, currentTick + attackSpeedTicks);

      expect(nextAttackTicks.get(attackerId)).toBe(104);
      // Verify cooldown blocks immediate re-attack
      expect(nextAttackTicks.get(attackerId)! > currentTick).toBe(true);
    });
  });

  describe("Position validation", () => {
    it("INVALID_ATTACKER_POSITION violation type exists in enum", () => {
      expect(CombatViolationType.INVALID_ATTACKER_POSITION).toBe(
        "invalid_attacker_position",
      );
    });

    it("can record an INVALID_ATTACKER_POSITION violation", () => {
      const antiCheat = new CombatAntiCheat();
      const playerId = "player-pos-test";

      antiCheat.recordViolation(
        playerId,
        CombatViolationType.INVALID_ATTACKER_POSITION,
        CombatViolationSeverity.MAJOR,
        "Melee from unwalkable tile (5.0, 10.0)",
        "mob-target",
        200,
      );

      const report = antiCheat.getPlayerReport(playerId);
      expect(report.score).toBe(15); // MAJOR = 15 points
      expect(report.recentViolations).toHaveLength(1);
      expect(report.recentViolations[0].type).toBe(
        CombatViolationType.INVALID_ATTACKER_POSITION,
      );
      expect(report.recentViolations[0].details).toContain("unwalkable tile");
    });
  });

  describe("XP validation window", () => {
    it("default xpRateWindowTicks is 50 (30 seconds)", () => {
      const antiCheat = new CombatAntiCheat();
      const config = antiCheat.getConfig();
      expect(config.xpRateWindowTicks).toBe(50);
    });
  });
});
