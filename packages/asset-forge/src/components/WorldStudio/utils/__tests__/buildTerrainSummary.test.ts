/**
 * buildTerrainSummary — unit tests for the agent's terrain
 * awareness payload.
 *
 * The summary lets the agent pick land coordinates + match
 * placements to biomes instead of emitting raw (0,0,0) into
 * ocean. Tests verify:
 *   - null world → null summary (agent skips terrain reasoning)
 *   - Coordinates convert from scene-space (foundation storage)
 *     to game-space (agent convention) by subtracting offset
 *   - All foundation biomes + towns surface
 */

import { describe, expect, it } from "vitest";

import type { WorldData } from "../../../WorldBuilder/types";
import { buildTerrainSummary } from "../buildTerrainSummary";

function makeWorld(overrides?: {
  worldSize?: number;
  tileSize?: number;
  biomes?: Array<{ id: string; type: string; cx: number; cz: number }>;
  towns?: Array<{ id: string; name: string; tx: number; tz: number }>;
}): WorldData {
  return {
    foundation: {
      config: {
        terrain: {
          worldSize: overrides?.worldSize ?? 50,
          tileSize: overrides?.tileSize ?? 100,
        },
      },
      biomes: (overrides?.biomes ?? []).map((b) => ({
        id: b.id,
        type: b.type,
        center: { x: b.cx, y: 0, z: b.cz },
        influenceRadius: 500,
        tileKeys: [],
        color: 0,
      })),
      towns: (overrides?.towns ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        size: "village",
        position: { x: t.tx, y: 0, z: t.tz },
        layoutType: "throughway",
        buildingIds: [],
        entryPoints: [],
        biomeId: "forest",
        safeZoneRadius: 50,
      })),
    },
  } as unknown as WorldData;
}

describe("buildTerrainSummary", () => {
  it("returns null when world is null", () => {
    expect(buildTerrainSummary(null)).toBe(null);
  });

  it("returns null when world has no foundation", () => {
    expect(buildTerrainSummary({} as unknown as WorldData)).toBe(null);
  });

  it("computes worldExtent from worldSize × tileSize / 2", () => {
    const summary = buildTerrainSummary(
      makeWorld({ worldSize: 50, tileSize: 100 }),
    );
    expect(summary?.worldExtent).toBe(2500);
  });

  it("converts biome centers from scene-space to game-space", () => {
    // For a 50×100m world, offset = 2500. Biome at scene (2500, 0, 2500)
    // should appear in summary as game (0, 0).
    const summary = buildTerrainSummary(
      makeWorld({
        biomes: [{ id: "biome-0", type: "forest", cx: 2500, cz: 2500 }],
      }),
    );
    expect(summary?.biomes).toHaveLength(1);
    expect(summary?.biomes[0]?.center).toEqual({ x: 0, z: 0 });
  });

  it("converts town positions from scene-space to game-space", () => {
    const summary = buildTerrainSummary(
      makeWorld({
        towns: [
          { id: "t1", name: "Brookhaven", tx: 2500, tz: 2500 },
          { id: "t2", name: "Stormhaven", tx: 3000, tz: 2000 },
        ],
      }),
    );
    expect(summary?.towns).toHaveLength(2);
    expect(summary?.towns[0]?.position).toEqual({ x: 0, z: 0 });
    expect(summary?.towns[1]?.position).toEqual({ x: 500, z: -500 });
  });

  it("preserves biome type + influence radius for each entry", () => {
    const summary = buildTerrainSummary(
      makeWorld({
        biomes: [
          { id: "biome-0", type: "tundra", cx: 1000, cz: 1500 },
          { id: "biome-1", type: "forest", cx: 3500, cz: 2500 },
          { id: "biome-2", type: "canyon", cx: 4000, cz: 4000 },
        ],
      }),
    );
    expect(summary?.biomes).toHaveLength(3);
    expect(summary?.biomes.map((b) => b.type)).toEqual([
      "tundra",
      "forest",
      "canyon",
    ]);
    expect(summary?.biomes[0]?.influenceRadius).toBe(500);
  });

  it("handles empty biomes/towns arrays", () => {
    const summary = buildTerrainSummary(makeWorld());
    expect(summary?.biomes).toEqual([]);
    expect(summary?.towns).toEqual([]);
  });
});
