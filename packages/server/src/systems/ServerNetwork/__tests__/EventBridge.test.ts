import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";
import { EventType } from "@hyperforge/shared";
import { EventBridge } from "../event-bridge";

class MockWorld extends EventEmitter {
  readonly entities = {
    get: vi.fn(),
  };

  getSystem = vi.fn();
}

const createBroadcast = () => ({
  sendToAll: vi.fn(),
  sendToNearby: vi.fn(),
  sendToPlayer: vi.fn(),
  sendToPlayerAndSpectators: vi.fn(),
});

describe("EventBridge", () => {
  it("removes tracked listeners on destroy", () => {
    const world = new MockWorld();
    const bridge = new EventBridge(world as never, createBroadcast() as never);

    bridge.setupEventListeners();

    expect(world.listenerCount(EventType.COMBAT_ENDED)).toBeGreaterThan(0);
    expect(world.listenerCount(EventType.COOKING_COMPLETED)).toBeGreaterThan(0);
    expect(world.listenerCount(EventType.SMELTING_COMPLETE)).toBeGreaterThan(0);
    expect(world.listenerCount(EventType.SMITHING_COMPLETE)).toBeGreaterThan(0);
    expect(world.listenerCount(EventType.CRAFTING_COMPLETE)).toBeGreaterThan(0);
    expect(world.listenerCount(EventType.FLETCHING_COMPLETE)).toBeGreaterThan(
      0,
    );
    expect(world.listenerCount(EventType.TANNING_COMPLETE)).toBeGreaterThan(0);

    bridge.destroy();

    expect(world.listenerCount(EventType.COMBAT_ENDED)).toBe(0);
    expect(world.listenerCount(EventType.COOKING_COMPLETED)).toBe(0);
    expect(world.listenerCount(EventType.SMELTING_COMPLETE)).toBe(0);
    expect(world.listenerCount(EventType.SMITHING_COMPLETE)).toBe(0);
    expect(world.listenerCount(EventType.CRAFTING_COMPLETE)).toBe(0);
    expect(world.listenerCount(EventType.FLETCHING_COMPLETE)).toBe(0);
    expect(world.listenerCount(EventType.TANNING_COMPLETE)).toBe(0);
  });

  it("routes resource lifecycle events through nearby interest management when position is available", () => {
    const world = new MockWorld();
    const broadcast = createBroadcast();
    const bridge = new EventBridge(world as never, broadcast as never);

    bridge.setupEventListeners();

    const spawnedPayload = {
      id: "tree-1",
      type: "tree_oak",
      position: { x: 42, y: 0, z: 84 },
    };

    world.emit(EventType.RESOURCE_SPAWNED, spawnedPayload);

    expect(broadcast.sendToNearby).toHaveBeenCalledWith(
      "resourceSpawned",
      spawnedPayload,
      42,
      84,
    );
    expect(broadcast.sendToAll).not.toHaveBeenCalledWith(
      "resourceSpawned",
      spawnedPayload,
    );
  });

  it("falls back to full broadcast when a resource event has no position", () => {
    const world = new MockWorld();
    const broadcast = createBroadcast();
    const bridge = new EventBridge(world as never, broadcast as never);

    bridge.setupEventListeners();

    const depletedPayload = {
      resourceId: "tree-1",
    };

    world.emit(EventType.RESOURCE_DEPLETED, depletedPayload);

    expect(broadcast.sendToAll).toHaveBeenCalledWith(
      "resourceDepleted",
      depletedPayload,
    );
    expect(broadcast.sendToNearby).not.toHaveBeenCalled();
  });
});
