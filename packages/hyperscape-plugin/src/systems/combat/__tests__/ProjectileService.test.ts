/**
 * ProjectileService Unit Tests
 *
 * Tests projectile creation and hit timing:
 * - Create projectiles with hit delay
 * - Process hits on correct tick
 * - Cancel projectiles for target/attacker
 * - Track active projectiles
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ProjectileService } from "../ProjectileService";
import { AttackType } from "@hyperforge/shared";

describe("ProjectileService", () => {
  let service: ProjectileService;

  beforeEach(() => {
    service = new ProjectileService();
  });

  describe("createProjectile", () => {
    it("creates a projectile with correct properties", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
        arrowId: "bronze_arrow",
        xpReward: 15,
      });

      expect(projectile).toBeDefined();
      expect(projectile.attackerId).toBe("player-1");
      expect(projectile.targetId).toBe("mob-1");
      expect(projectile.damage).toBe(10);
      expect(projectile.arrowId).toBe("bronze_arrow");
      expect(projectile.xpReward).toBe(15);
      expect(projectile.cancelled).toBe(false);
      expect(projectile.processed).toBe(false);
    });

    it("creates magic projectile with spell ID", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.MAGIC,
        damage: 8,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
        spellId: "fire_strike",
        xpReward: 11.5,
      });

      expect(projectile.spellId).toBe("fire_strike");
      expect(projectile.arrowId).toBeUndefined();
    });

    it("assigns unique ID to each projectile", () => {
      const p1 = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      const p2 = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2", // Different target
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 101, // Different tick
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      expect(p1.id).not.toBe(p2.id);
    });

    it("calculates hit tick based on distance and type", () => {
      // Close range (1 tile)
      const closeProjectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 1, z: 0 },
      });

      // Far range (10 tiles)
      const farProjectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 10, z: 0 },
      });

      // Far projectile should hit later
      expect(farProjectile.hitsAtTick).toBeGreaterThan(
        closeProjectile.hitsAtTick,
      );
    });

    it("increments active count", () => {
      expect(service.getActiveCount()).toBe(0);

      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      expect(service.getActiveCount()).toBe(1);

      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      expect(service.getActiveCount()).toBe(2);
    });
  });

  describe("processTick", () => {
    it("returns empty hits before projectile hit tick", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      // Process before hit tick
      const result = service.processTick(projectile.hitsAtTick - 1);

      expect(result.hits).toHaveLength(0);
      expect(result.remaining).toBe(1);
    });

    it("returns projectile on hit tick", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      const result = service.processTick(projectile.hitsAtTick);

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].id).toBe(projectile.id);
      expect(result.hits[0].damage).toBe(10);
      expect(result.remaining).toBe(0);
    });

    it("removes projectile after processing", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.processTick(projectile.hitsAtTick);

      // Process again - should be empty
      const result = service.processTick(projectile.hitsAtTick + 1);
      expect(result.hits).toHaveLength(0);
      expect(result.remaining).toBe(0);
    });

    it("processes multiple projectiles hitting same tick", () => {
      // Create two projectiles at same distance
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-2",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 15,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      // Both should hit around same tick
      const result = service.processTick(102);

      expect(result.hits).toHaveLength(2);
      expect(result.remaining).toBe(0);
    });

    it("does not process cancelled projectiles", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.cancelProjectilesForTarget("mob-1");

      const result = service.processTick(projectile.hitsAtTick);

      expect(result.hits).toHaveLength(0);
      expect(result.remaining).toBe(0);
    });
  });

  describe("cancelProjectilesForTarget", () => {
    it("cancels all projectiles for a target", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-2",
        targetId: "mob-1",
        attackType: AttackType.MAGIC,
        damage: 8,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      const cancelled = service.cancelProjectilesForTarget("mob-1");

      expect(cancelled).toBe(2);
    });

    it("returns 0 when no projectiles for target", () => {
      const cancelled = service.cancelProjectilesForTarget("mob-999");

      expect(cancelled).toBe(0);
    });

    it("does not cancel projectiles for other targets", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.cancelProjectilesForTarget("mob-1");

      expect(service.getActiveCount()).toBe(1); // Cancelled projectile removed immediately
      expect(service.getProjectilesForTarget("mob-2")).toHaveLength(1);
    });
  });

  describe("cancelProjectilesFromAttacker", () => {
    it("cancels all projectiles from an attacker", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      const cancelled = service.cancelProjectilesFromAttacker("player-1");

      expect(cancelled).toBe(2);
    });

    it("does not cancel projectiles from other attackers", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-2",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.cancelProjectilesFromAttacker("player-1");

      const remaining = service.getProjectilesForTarget("mob-1");
      expect(remaining).toHaveLength(1);
    });
  });

  describe("getProjectilesForTarget", () => {
    it("returns empty array when no projectiles", () => {
      expect(service.getProjectilesForTarget("mob-1")).toHaveLength(0);
    });

    it("returns active projectiles for target", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-2",
        targetId: "mob-1",
        attackType: AttackType.MAGIC,
        damage: 8,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      const projectiles = service.getProjectilesForTarget("mob-1");

      expect(projectiles).toHaveLength(2);
    });

    it("excludes cancelled projectiles", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.cancelProjectilesForTarget("mob-1");

      expect(service.getProjectilesForTarget("mob-1")).toHaveLength(0);
    });
  });

  describe("getProjectile", () => {
    it("returns projectile by ID", () => {
      const created = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      const retrieved = service.getProjectile(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it("returns undefined for unknown ID", () => {
      expect(service.getProjectile("unknown-id")).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("removes all projectiles", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });

      expect(service.getActiveCount()).toBe(2);

      service.clear();

      expect(service.getActiveCount()).toBe(0);
      expect(service.getProjectilesForTarget("mob-1")).toHaveLength(0);
      expect(service.getProjectilesForTarget("mob-2")).toHaveLength(0);
    });
  });

  describe("hit delay formulas", () => {
    it("melee has immediate hit (same tick)", () => {
      const projectile = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.MELEE,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 1, z: 0 },
      });

      // Melee should hit on same tick (immediate)
      expect(projectile.hitsAtTick).toBe(100);
    });

    it("ranged delay increases with distance", () => {
      const close = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 1, z: 0 },
      });

      const far = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 10,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 10, z: 0 },
      });

      expect(far.hitsAtTick).toBeGreaterThan(close.hitsAtTick);
    });

    it("magic delay increases with distance", () => {
      const close = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.MAGIC,
        damage: 8,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 1, z: 0 },
      });

      const far = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.MAGIC,
        damage: 8,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 10, z: 0 },
      });

      expect(far!.hitsAtTick).toBeGreaterThan(close!.hitsAtTick);
    });
  });

  describe("per-player projectile limit", () => {
    it("returns null when attacker exceeds 10 active projectiles", () => {
      // Create 10 projectiles from same attacker
      for (let i = 0; i < 10; i++) {
        const p = service.createProjectile({
          sourceId: "player-1",
          targetId: `mob-${i}`,
          attackType: AttackType.RANGED,
          damage: 5,
          currentTick: 100,
          sourcePosition: { x: 0, z: 0 },
          targetPosition: { x: 5 + i, z: 0 },
        });
        expect(p).not.toBeNull();
      }

      // 11th should be rejected
      const rejected = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-10",
        attackType: AttackType.RANGED,
        damage: 5,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 15, z: 0 },
      });
      expect(rejected).toBeNull();
    });

    it("allows projectiles from different attackers independently", () => {
      // Fill up player-1
      for (let i = 0; i < 10; i++) {
        service.createProjectile({
          sourceId: "player-1",
          targetId: `mob-${i}`,
          attackType: AttackType.RANGED,
          damage: 5,
          currentTick: 100,
          sourcePosition: { x: 0, z: 0 },
          targetPosition: { x: 5, z: 0 },
        });
      }

      // player-2 should still be allowed
      const p = service.createProjectile({
        sourceId: "player-2",
        targetId: "mob-0",
        attackType: AttackType.RANGED,
        damage: 5,
        currentTick: 100,
        sourcePosition: { x: 10, z: 0 },
        targetPosition: { x: 15, z: 0 },
      });
      expect(p).not.toBeNull();
    });

    it("allows new projectiles after old ones are processed", () => {
      // Create 10 projectiles that hit at tick 102
      for (let i = 0; i < 10; i++) {
        service.createProjectile({
          sourceId: "player-1",
          targetId: `mob-${i}`,
          attackType: AttackType.MELEE,
          damage: 5,
          currentTick: 100,
          sourcePosition: { x: 0, z: 0 },
          targetPosition: { x: 0, z: 0 },
        });
      }

      // Process tick to clear melee projectiles (instant hit)
      service.processTick(100);

      // Should be able to create more now
      const p = service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-0",
        attackType: AttackType.RANGED,
        damage: 5,
        currentTick: 101,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });
      expect(p).not.toBeNull();
    });
  });

  describe("getActiveCountForAttacker", () => {
    it("returns 0 for unknown attacker", () => {
      expect(service.getActiveCountForAttacker("unknown")).toBe(0);
    });

    it("counts only non-cancelled projectiles", () => {
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-1",
        attackType: AttackType.RANGED,
        damage: 5,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 5, z: 0 },
      });
      service.createProjectile({
        sourceId: "player-1",
        targetId: "mob-2",
        attackType: AttackType.RANGED,
        damage: 5,
        currentTick: 100,
        sourcePosition: { x: 0, z: 0 },
        targetPosition: { x: 10, z: 0 },
      });

      expect(service.getActiveCountForAttacker("player-1")).toBe(2);

      // Cancel one target's projectiles
      service.cancelProjectilesForTarget("mob-1");
      expect(service.getActiveCountForAttacker("player-1")).toBe(1);
    });
  });

  describe("stress test", () => {
    it("handles many projectiles across multiple attackers and targets", () => {
      const attackers = 5;
      const targetsPerAttacker = 8;

      for (let a = 0; a < attackers; a++) {
        for (let t = 0; t < targetsPerAttacker; t++) {
          service.createProjectile({
            sourceId: `player-${a}`,
            targetId: `mob-${a}-${t}`,
            attackType: AttackType.RANGED,
            damage: 5,
            currentTick: 100,
            sourcePosition: { x: a * 10, z: 0 },
            targetPosition: { x: a * 10 + 5, z: t * 5 },
          });
        }
      }

      expect(service.getActiveCount()).toBe(attackers * targetsPerAttacker);

      // Cancel all projectiles for one target
      service.cancelProjectilesForTarget("mob-2-3");
      expect(service.getActiveCount()).toBe(attackers * targetsPerAttacker - 1);

      // Cancel all from one attacker
      service.cancelProjectilesFromAttacker("player-0");
      expect(service.getActiveCountForAttacker("player-0")).toBe(0);
    });
  });
});
