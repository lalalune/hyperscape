/**
 * CombatEventBus Unit Tests
 *
 * Tests for typed combat event emission and subscription:
 * - Event emission and handler invocation
 * - Type-safe subscriptions
 * - Unsubscribe functionality
 * - Event tracing / history
 * - Entity-based queries
 */

import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import {
  CombatEventBus,
  DamageDealtEvent,
  getCombatEventBus,
  resetCombatEventBus,
} from "../CombatEventBus";

describe("CombatEventBus", () => {
  let eventBus: CombatEventBus;

  beforeEach(() => {
    eventBus = new CombatEventBus();
  });

  describe("event emission", () => {
    it("emits combat started event", () => {
      const handler = mock();
      eventBus.onCombatStarted(handler);

      eventBus.emitCombatStarted({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        attackerType: "player",
        targetType: "mob",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe("combat_started");
      expect(handler.mock.calls[0][0].attackerId).toBe("player1");
    });

    it("emits attack started event", () => {
      const handler = mock();
      eventBus.onAttackStarted(handler);

      eventBus.emitAttackStarted({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        attackerType: "player",
        targetType: "mob",
        attackType: "melee",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].attackType).toBe("melee");
    });

    it("emits damage dealt event", () => {
      const handler = mock();
      eventBus.onDamageDealt(handler);

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 15,
        targetType: "mob",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].damage).toBe(15);
    });

    it("emits combat ended event", () => {
      const handler = mock();
      eventBus.onCombatEnded(handler);

      eventBus.emitCombatEnded({
        tick: 200,
        entityId: "player1",
        entityType: "player",
        targetId: "mob1",
        targetType: "mob",
        reason: "target_died",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].reason).toBe("target_died");
    });

    it("emits entity died event", () => {
      const handler = mock();
      eventBus.onEntityDied(handler);

      eventBus.emitEntityDied({
        tick: 150,
        entityId: "mob1",
        entityType: "mob",
        killerId: "player1",
        killerType: "player",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].killerId).toBe("player1");
    });

    it("emits retaliation event", () => {
      const handler = mock();
      eventBus.onRetaliation(handler);

      eventBus.emitRetaliation({
        tick: 100,
        entityId: "mob1",
        entityType: "mob",
        targetId: "player1",
        targetType: "player",
        delayTicks: 3,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].delayTicks).toBe(3);
    });

    it("adds timestamp to emitted events", () => {
      const handler = mock();
      eventBus.onDamageDealt(handler);

      const beforeEmit = Date.now();
      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });
      const afterEmit = Date.now();

      const event = handler.mock.calls[0][0] as DamageDealtEvent;
      expect(event.timestamp).toBeGreaterThanOrEqual(beforeEmit);
      expect(event.timestamp).toBeLessThanOrEqual(afterEmit);
    });
  });

  describe("multiple handlers", () => {
    it("notifies all handlers for an event type", () => {
      const handler1 = mock();
      const handler2 = mock();

      eventBus.onDamageDealt(handler1);
      eventBus.onDamageDealt(handler2);

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("does not notify handlers of other event types", () => {
      const damageHandler = mock();
      const combatEndHandler = mock();

      eventBus.onDamageDealt(damageHandler);
      eventBus.onCombatEnded(combatEndHandler);

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(damageHandler).toHaveBeenCalledTimes(1);
      expect(combatEndHandler).toHaveBeenCalledTimes(0);
    });
  });

  describe("unsubscribe", () => {
    it("stops receiving events after unsubscribe", () => {
      const handler = mock();
      const unsubscribe = eventBus.onDamageDealt(handler);

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emitDamageDealt({
        tick: 101,
        attackerId: "player1",
        targetId: "mob1",
        damage: 15,
        targetType: "mob",
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("only unsubscribes the specific handler", () => {
      const handler1 = mock();
      const handler2 = mock();

      const unsub1 = eventBus.onDamageDealt(handler1);
      eventBus.onDamageDealt(handler2);

      unsub1();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("onAny", () => {
    it("receives all event types", () => {
      const handler = mock();
      eventBus.onAny(handler);

      eventBus.emitCombatStarted({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        attackerType: "player",
        targetType: "mob",
      });

      eventBus.emitDamageDealt({
        tick: 101,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      eventBus.emitCombatEnded({
        tick: 102,
        entityId: "player1",
        entityType: "player",
        targetId: "mob1",
        targetType: "mob",
        reason: "timeout",
      });

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("unsubscribe from onAny stops all events", () => {
      const handler = mock();
      const unsub = eventBus.onAny(handler);

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      eventBus.emitDamageDealt({
        tick: 101,
        attackerId: "player1",
        targetId: "mob1",
        damage: 15,
        targetType: "mob",
      });

      eventBus.emitCombatEnded({
        tick: 102,
        entityId: "player1",
        entityType: "player",
        targetId: "mob1",
        targetType: "mob",
        reason: "timeout",
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("tracing", () => {
    it("does not record events when tracing is disabled", () => {
      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(eventBus.getEventHistory().length).toBe(0);
    });

    it("records events when tracing is enabled", () => {
      eventBus.enableTracing();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(eventBus.getEventHistory().length).toBe(1);
    });

    it("respects maxHistorySize", () => {
      const bus = new CombatEventBus({
        maxHistorySize: 3,
        tracingEnabled: true,
      });

      for (let i = 0; i < 5; i++) {
        bus.emitDamageDealt({
          tick: 100 + i,
          attackerId: "player1",
          targetId: "mob1",
          damage: 10,
          targetType: "mob",
        });
      }

      expect(bus.getEventHistory().length).toBe(3);
      // Should have the last 3 events
      expect(bus.getEventHistory()[0].tick).toBe(102);
    });

    it("clearHistory removes all events", () => {
      eventBus.enableTracing();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(eventBus.getEventHistory().length).toBe(1);

      eventBus.clearHistory();

      expect(eventBus.getEventHistory().length).toBe(0);
    });

    it("disableTracing optionally clears history", () => {
      eventBus.enableTracing();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      eventBus.disableTracing(true);

      expect(eventBus.getEventHistory().length).toBe(0);
    });

    it("isTracingEnabled returns correct state", () => {
      expect(eventBus.isTracingEnabled()).toBe(false);
      eventBus.enableTracing();
      expect(eventBus.isTracingEnabled()).toBe(true);
      eventBus.disableTracing();
      expect(eventBus.isTracingEnabled()).toBe(false);
    });
  });

  describe("history queries", () => {
    beforeEach(() => {
      eventBus.enableTracing();

      // Set up some events
      eventBus.emitCombatStarted({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        attackerType: "player",
        targetType: "mob",
      });

      eventBus.emitDamageDealt({
        tick: 101,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      eventBus.emitDamageDealt({
        tick: 105,
        attackerId: "player2",
        targetId: "mob2",
        damage: 15,
        targetType: "mob",
      });

      eventBus.emitEntityDied({
        tick: 110,
        entityId: "mob1",
        entityType: "mob",
        killerId: "player1",
        killerType: "player",
      });
    });

    it("getEventsByType filters correctly", () => {
      const damageEvents =
        eventBus.getEventsByType<DamageDealtEvent>("damage_dealt");
      expect(damageEvents.length).toBe(2);
      expect(damageEvents.every((e) => e.type === "damage_dealt")).toBe(true);
    });

    it("getEventsForEntity finds all entity events", () => {
      const player1Events = eventBus.getEventsForEntity("player1");
      expect(player1Events.length).toBe(3); // combat_started, damage_dealt, entity_died (as killer)
    });

    it("getEventsForEntity finds entity as target", () => {
      const mob1Events = eventBus.getEventsForEntity("mob1");
      expect(mob1Events.length).toBe(3); // combat_started (target), damage_dealt (target), entity_died
    });

    it("getEventsInTickRange filters by tick", () => {
      const events = eventBus.getEventsInTickRange(100, 105);
      expect(events.length).toBe(3); // ticks 100, 101, 105
    });
  });

  describe("error handling", () => {
    it("continues to next handler if one throws", () => {
      const errorHandler = mock().mockImplementation(() => {
        throw new Error("Handler error");
      });
      const successHandler = mock();

      eventBus.onDamageDealt(errorHandler);
      eventBus.onDamageDealt(successHandler);

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = mock();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(1);

      console.error = originalError;
    });
  });

  describe("getStats", () => {
    it("returns correct handler count", () => {
      eventBus.onDamageDealt(() => {});
      eventBus.onDamageDealt(() => {});
      eventBus.onCombatEnded(() => {});

      const stats = eventBus.getStats();
      expect(stats.handlerCount).toBe(3);
    });

    it("returns correct history size", () => {
      eventBus.enableTracing();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      eventBus.emitDamageDealt({
        tick: 101,
        attackerId: "player1",
        targetId: "mob1",
        damage: 15,
        targetType: "mob",
      });

      const stats = eventBus.getStats();
      expect(stats.historySize).toBe(2);
      expect(stats.tracingEnabled).toBe(true);
    });
  });

  describe("destroy", () => {
    it("removes all handlers and clears history", () => {
      const handler = mock();
      eventBus.onDamageDealt(handler);
      eventBus.enableTracing();

      eventBus.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      eventBus.destroy();

      eventBus.emitDamageDealt({
        tick: 101,
        attackerId: "player1",
        targetId: "mob1",
        damage: 15,
        targetType: "mob",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(eventBus.getEventHistory().length).toBe(0);
      expect(eventBus.isTracingEnabled()).toBe(false);
    });
  });

  describe("global event bus", () => {
    beforeEach(() => {
      resetCombatEventBus();
    });

    it("getCombatEventBus returns singleton", () => {
      const bus1 = getCombatEventBus();
      const bus2 = getCombatEventBus();
      expect(bus1).toBe(bus2);
    });

    it("resetCombatEventBus destroys and resets singleton", () => {
      const bus1 = getCombatEventBus();
      const handler = mock();
      bus1.onDamageDealt(handler);

      resetCombatEventBus();

      const bus2 = getCombatEventBus();
      expect(bus2).not.toBe(bus1);

      bus2.emitDamageDealt({
        tick: 100,
        attackerId: "player1",
        targetId: "mob1",
        damage: 10,
        targetType: "mob",
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
