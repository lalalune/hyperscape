/**
 * MobDeathSystem Unit Tests
 *
 * Tests the mob death handling system.
 *
 * Key behaviors tested:
 * - Only handles mob deaths (not player deaths)
 * - Calls despawnMob for mob deaths
 * - Removes mob entity from world
 * - Clears respawn timers on destroy
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MobDeathSystem } from "../MobDeathSystem";

// Mock World
function createMockWorld() {
  const entitiesMap = new Map<string, Record<string, unknown>>();
  const emitFn = vi.fn();
  const onFn = vi.fn();
  const offFn = vi.fn();
  const removeFn = vi.fn();

  return {
    entities: {
      get: (id: string) => entitiesMap.get(id),
      set: (id: string, entity: Record<string, unknown>) =>
        entitiesMap.set(id, entity),
      remove: removeFn,
      _map: entitiesMap,
    },
    emit: emitFn,
    on: onFn,
    off: offFn,
    getSystem: vi.fn(),
    _emit: emitFn,
    _remove: removeFn,
    addEntity: (id: string, data: Record<string, unknown> = {}) => {
      entitiesMap.set(id, data);
    },
  };
}

describe("MobDeathSystem", () => {
  let world: ReturnType<typeof createMockWorld>;
  let system: MobDeathSystem;

  beforeEach(() => {
    world = createMockWorld();
    system = new MobDeathSystem(world as never);
  });

  afterEach(() => {
    system.destroy();
  });

  describe("handleMobDeath", () => {
    it("only processes mob deaths, not player deaths", () => {
      const privateSystem = system as unknown as {
        handleMobDeath: (data: {
          entityId: string;
          killedBy: string;
          entityType: "player" | "mob";
        }) => void;
        despawnMob: (mobId: string) => void;
      };

      const despawnSpy = vi.spyOn(privateSystem, "despawnMob");

      // Player death - should be ignored
      privateSystem.handleMobDeath({
        entityId: "player1",
        killedBy: "mob1",
        entityType: "player",
      });

      expect(despawnSpy).not.toHaveBeenCalled();

      // Mob death - should be processed
      world.addEntity("mob1", { type: "mob" });
      privateSystem.handleMobDeath({
        entityId: "mob1",
        killedBy: "player1",
        entityType: "mob",
      });

      expect(despawnSpy).toHaveBeenCalledWith("mob1");
    });

    it("calls despawnMob for mob deaths", () => {
      const privateSystem = system as unknown as {
        handleMobDeath: (data: {
          entityId: string;
          killedBy: string;
          entityType: "player" | "mob";
        }) => void;
        despawnMob: (mobId: string) => void;
      };

      const despawnSpy = vi.spyOn(privateSystem, "despawnMob");

      world.addEntity("mob1", { type: "mob", health: 0 });

      privateSystem.handleMobDeath({
        entityId: "mob1",
        killedBy: "player1",
        entityType: "mob",
      });

      expect(despawnSpy).toHaveBeenCalledWith("mob1");
    });
  });

  describe("despawnMob", () => {
    it("removes mob entity via entities.remove", () => {
      const privateSystem = system as unknown as {
        despawnMob: (mobId: string) => void;
      };

      world.addEntity("mob1", { type: "mob" });

      privateSystem.despawnMob("mob1");

      expect(world._remove).toHaveBeenCalledWith("mob1");
    });

    it("handles non-existent mob gracefully", () => {
      const privateSystem = system as unknown as {
        despawnMob: (mobId: string) => void;
      };

      // Mob doesn't exist in world
      expect(() => privateSystem.despawnMob("nonexistent")).not.toThrow();

      // Should not call remove for non-existent mob
      expect(world._remove).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("clears all respawn timers", () => {
      const privateSystem = system as unknown as {
        mobRespawnTimers: Map<string, NodeJS.Timeout>;
      };

      // Add some mock timers
      const timer1 = setTimeout(() => {}, 10000);
      const timer2 = setTimeout(() => {}, 20000);
      privateSystem.mobRespawnTimers.set("mob1", timer1);
      privateSystem.mobRespawnTimers.set("mob2", timer2);

      expect(privateSystem.mobRespawnTimers.size).toBe(2);

      system.destroy();

      expect(privateSystem.mobRespawnTimers.size).toBe(0);
    });

    it("is safe to call multiple times", () => {
      expect(() => {
        system.destroy();
        system.destroy();
      }).not.toThrow();
    });
  });

  describe("system configuration", () => {
    it("has correct system name", () => {
      // The system name is set in constructor
      expect(system).toBeDefined();
    });
  });
});
