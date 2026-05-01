/**
 * useAgentPlacementDispatcher — pure-function unit tests.
 *
 * P0.2 of `PLAN_AGENT_STUDIO_PARITY.md`. The dispatcher hook
 * itself is a React composition (state → derivation → mapper +
 * dispatch) verified by integration in P0.3 (companion / dialog
 * call sites). Here we lock down the pure math so the offset
 * derivation never silently regresses.
 */

import { describe, expect, it } from "vitest";

import type { WorldData } from "../../../WorldBuilder/types";
import { computeWorldCenterOffset } from "../useAgentPlacementDispatcher";

function makeWorld(overrides?: {
  worldSize?: number;
  tileSize?: number;
}): WorldData {
  // Minimal stub with just the foundation.config.terrain shape
  // the offset derivation reads. Cast through unknown so the test
  // doesn't drag in 30+ unrelated WorldData fields.
  return {
    foundation: {
      config: {
        terrain: {
          worldSize: overrides?.worldSize ?? 50,
          tileSize: overrides?.tileSize ?? 100,
        },
      },
    },
  } as unknown as WorldData;
}

describe("computeWorldCenterOffset", () => {
  it("returns 0 when world is null (no generation yet)", () => {
    expect(computeWorldCenterOffset(null)).toBe(0);
  });

  it("returns 0 when world has no foundation", () => {
    expect(computeWorldCenterOffset({} as unknown as WorldData)).toBe(0);
  });

  it("returns 0 when foundation has no config", () => {
    expect(
      computeWorldCenterOffset({
        foundation: {},
      } as unknown as WorldData),
    ).toBe(0);
  });

  it("computes (worldSize * tileSize) / 2 — default 50×100m world = 2500", () => {
    expect(computeWorldCenterOffset(makeWorld())).toBe(2500);
  });

  it("computes correctly for a small world (20 tiles × 50m = 1000m → offset 500)", () => {
    expect(
      computeWorldCenterOffset(makeWorld({ worldSize: 20, tileSize: 50 })),
    ).toBe(500);
  });

  it("computes correctly for a large world (200 tiles × 100m = 20000m → offset 10000)", () => {
    expect(
      computeWorldCenterOffset(makeWorld({ worldSize: 200, tileSize: 100 })),
    ).toBe(10000);
  });

  it("respects the schema cap (worldSize ≤ 200 → offset ≤ 10000)", () => {
    // PLAN_AGENT_STUDIO_PARITY's terrain.worldSize is capped at 200
    // in manifest-schema. Verify the derived offset stays bounded.
    const offset = computeWorldCenterOffset(
      makeWorld({ worldSize: 200, tileSize: 100 }),
    );
    expect(offset).toBeLessThanOrEqual(10000);
  });

  it("handles worldSize=1 and tileSize=1 edge case (offset 0.5)", () => {
    expect(
      computeWorldCenterOffset(makeWorld({ worldSize: 1, tileSize: 1 })),
    ).toBe(0.5);
  });
});
