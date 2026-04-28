import { describe, expect, it } from "vitest";

import {
  findStreamingTargetEntity,
  isTargetAvatarReady,
} from "../../../src/lib/streamingReadiness";

/**
 * Minimal mock world shaped like the production `Entities` manager. Real
 * `Entities.get(id)` falls back from items to players, so the stub mirrors
 * that to keep the test faithful to runtime behavior.
 */
function mockWorld(
  setup: (players: Map<string, unknown>, items: Map<string, unknown>) => void,
) {
  const players = new Map<string, unknown>();
  const items = new Map<string, unknown>();
  setup(players, items);
  return {
    entities: {
      get: (id: string) => items.get(id) ?? players.get(id) ?? null,
      players,
      items,
    },
  } as unknown as import("@hyperscape/shared").World;
}

describe("isTargetAvatarReady", () => {
  it("returns true when the entity is in players with avatar set", () => {
    const world = mockWorld((players) => {
      players.set("agent-1", { id: "agent-1", avatar: {} });
    });

    expect(isTargetAvatarReady(world, "agent-1")).toBe(true);
  });

  it("returns true when the entity is only in items with a fallback avatar root (regression pin)", () => {
    // Regression pin: the previous implementation walked only
    // world.entities.players and missed entities that the spectator snapshot
    // pipeline routed exclusively through items. Commit 33dab353f stopped
    // masking this with a grace timer, so the capture page sat in degraded
    // state indefinitely. This test fails against that implementation and
    // passes against the unified helper.
    const world = mockWorld((_players, items) => {
      items.set("agent-1", { id: "agent-1", _fallbackAvatarRoot: {} });
    });

    expect(isTargetAvatarReady(world, "agent-1")).toBe(true);
  });

  it("returns true when the entity is in items with a mesh set", () => {
    const world = mockWorld((_players, items) => {
      items.set("agent-1", { id: "agent-1", mesh: {} });
    });

    expect(isTargetAvatarReady(world, "agent-1")).toBe(true);
  });

  it("returns false when the entity is absent from both collections", () => {
    const world = mockWorld(() => {});

    expect(isTargetAvatarReady(world, "agent-1")).toBe(false);
  });

  it("returns false when the entity is present but all avatar fields are null", () => {
    const world = mockWorld((players) => {
      players.set("agent-1", { id: "agent-1" });
    });

    expect(isTargetAvatarReady(world, "agent-1")).toBe(false);
  });
});

describe("findStreamingTargetEntity", () => {
  it("matches by direct map key in the players collection", () => {
    const entity = { id: "agent-1" };
    const world = mockWorld((players) => players.set("agent-1", entity));

    expect(findStreamingTargetEntity(world, "agent-1")).toBe(entity);
  });

  it("matches by direct map key in the items collection", () => {
    const entity = { id: "agent-1" };
    const world = mockWorld((_players, items) => items.set("agent-1", entity));

    expect(findStreamingTargetEntity(world, "agent-1")).toBe(entity);
  });

  it("matches by data.characterId when the map key differs from the target id", () => {
    const entity = {
      id: "namespaced:agent-1",
      data: { characterId: "agent-1" },
    };
    const world = mockWorld((_players, items) =>
      items.set("namespaced:agent-1", entity),
    );

    expect(findStreamingTargetEntity(world, "agent-1")).toBe(entity);
  });

  it("matches by characterId alias on the player instance", () => {
    const entity = { id: "some-guid", characterId: "agent-1" };
    const world = mockWorld((players) => players.set("some-guid", entity));

    expect(findStreamingTargetEntity(world, "agent-1")).toBe(entity);
  });

  it("returns null when no collection contains a matching entity", () => {
    const world = mockWorld(() => {});

    expect(findStreamingTargetEntity(world, "agent-1")).toBe(null);
  });
});
