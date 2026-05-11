/**
 * `manifestCompiler` — JSON manifest compilation tests.
 *
 * Bridges studio in-memory state → on-disk manifest JSON files
 * the runtime reads. Each compile* function is a pure mapping
 * — input shape × output shape. Tests pin down the JSON
 * contract: shape changes that silently rename a field would
 * break the runtime reader.
 *
 * Coverage focuses on the bounded mappers (regions / danger
 * sources / wilderness / music / ambient). Larger compilers
 * (compileWorldJson / compileWorldAreas / compileBuildings)
 * are exercised via integration tests through the studio's
 * Save flow.
 */

import { describe, expect, it } from "vitest";
import {
  compileDangerSources,
  compileMusic,
  compileRegions,
  compileWildernessBoundary,
} from "../manifestCompiler";

const EMPTY_EXTENDED = {
  npcs: [],
  spawnPoints: [],
  teleports: [],
  mobSpawns: [],
  resources: [],
  stations: [],
  pois: [],
  waterBodies: [],
  regions: [],
  dangerSources: [],
  wildernessBoundary: null,
  mines: [],
  customAssets: [],
} as never;

const EMPTY_AUDIO = {
  musicZones: [],
  ambientZones: [],
  sfxTriggers: [],
} as never;

describe("compileRegions", () => {
  it("compiles an empty regions array", () => {
    const result = compileRegions(EMPTY_EXTENDED);
    expect(result).toEqual({ regions: [] });
  });

  it("preserves id, name, description, tileKeys, tags, etc.", () => {
    const result = compileRegions({
      ...EMPTY_EXTENDED,
      regions: [
        {
          id: "north",
          name: "North Wilderness",
          description: "PvP zone",
          tileKeys: ["0,0", "1,0"],
          tags: ["danger"],
          biomeOverride: "tundra",
          musicTrack: "wilderness_battle",
          ambientSound: "wind_cold",
          spawnRules: { mobs: ["wolf"] },
        },
      ] as never,
    });
    const r = (result as { regions: Array<Record<string, unknown>> })
      .regions[0];
    expect(r.id).toBe("north");
    expect(r.name).toBe("North Wilderness");
    expect(r.tileKeys).toEqual(["0,0", "1,0"]);
    expect(r.tags).toEqual(["danger"]);
    expect(r.biomeOverride).toBe("tundra");
    expect(r.musicTrack).toBe("wilderness_battle");
  });

  it("omits autoGenBounds when not set on the region", () => {
    const result = compileRegions({
      ...EMPTY_EXTENDED,
      regions: [
        {
          id: "r1",
          name: "Manual region",
          tileKeys: [],
        },
      ] as never,
    });
    const r = (result as { regions: Array<Record<string, unknown>> })
      .regions[0];
    expect(r).not.toHaveProperty("autoGenBounds");
  });

  it("emits autoGenBounds when set", () => {
    const result = compileRegions({
      ...EMPTY_EXTENDED,
      regions: [
        {
          id: "r1",
          name: "Auto",
          tileKeys: [],
          autoGenBounds: {
            difficultyRange: [0.3, 0.5],
            biomeFilter: ["forest"],
            boundingBox: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
            generationSeed: 42,
            generatedAt: 1234567890,
          },
        },
      ] as never,
    });
    const r = (result as { regions: Array<Record<string, unknown>> })
      .regions[0];
    const bounds = r.autoGenBounds as Record<string, unknown>;
    expect(bounds.difficultyRange).toEqual([0.3, 0.5]);
    expect(bounds.biomeFilter).toEqual(["forest"]);
    expect(bounds.generationSeed).toBe(42);
  });

  it("compiles multiple regions in order", () => {
    const result = compileRegions({
      ...EMPTY_EXTENDED,
      regions: [
        { id: "a", name: "A", tileKeys: [] },
        { id: "b", name: "B", tileKeys: [] },
        { id: "c", name: "C", tileKeys: [] },
      ] as never,
    });
    const regions = (result as { regions: Array<{ id: string }> }).regions;
    expect(regions.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("compileDangerSources", () => {
  it("compiles empty dangerSources to { sources: [] }", () => {
    expect(compileDangerSources(EMPTY_EXTENDED)).toEqual({ sources: [] });
  });

  it("strips position.y (only x, z make it to disk)", () => {
    const result = compileDangerSources({
      ...EMPTY_EXTENDED,
      dangerSources: [
        {
          id: "d1",
          name: "Cursed",
          position: { x: 50, y: 999, z: -30 },
          radius: 40,
          intensity: 2,
          falloffCurve: 1.5,
        },
      ] as never,
    });
    const ds = (result as { sources: Array<Record<string, unknown>> })
      .sources[0];
    const pos = ds.position as Record<string, unknown>;
    expect(pos).toEqual({ x: 50, z: -30 });
    expect(pos).not.toHaveProperty("y");
  });

  it("preserves intensity, falloffCurve, radius", () => {
    const result = compileDangerSources({
      ...EMPTY_EXTENDED,
      dangerSources: [
        {
          id: "d1",
          name: "X",
          position: { x: 0, y: 0, z: 0 },
          radius: 40,
          intensity: 2,
          falloffCurve: 1.5,
        },
      ] as never,
    });
    const ds = (result as { sources: Array<Record<string, unknown>> })
      .sources[0];
    expect(ds.radius).toBe(40);
    expect(ds.intensity).toBe(2);
    expect(ds.falloffCurve).toBe(1.5);
  });
});

describe("compileWildernessBoundary", () => {
  it("returns null when extendedLayers.wildernessBoundary is null", () => {
    expect(compileWildernessBoundary(EMPTY_EXTENDED)).toBeNull();
  });

  it("returns boundary fields when set", () => {
    const result = compileWildernessBoundary({
      ...EMPTY_EXTENDED,
      wildernessBoundary: {
        id: "wilderness",
        points: [
          { x: -200, z: 0 },
          { x: 200, z: 0 },
        ],
        levelScale: 50,
        maxLevel: 55,
      },
    } as never);
    expect(result).toEqual({
      points: [
        { x: -200, z: 0 },
        { x: 200, z: 0 },
      ],
      levelScale: 50,
      maxLevel: 55,
    });
  });

  it("drops the id field on disk (not in the compiled output)", () => {
    const result = compileWildernessBoundary({
      ...EMPTY_EXTENDED,
      wildernessBoundary: {
        id: "custom-id",
        points: [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
        levelScale: 1,
        maxLevel: 1,
      },
    } as never);
    expect(result).not.toHaveProperty("id");
  });
});

describe("compileMusic", () => {
  it("compiles empty audio layers to empty tracks + ambientZones", () => {
    expect(compileMusic(EMPTY_AUDIO)).toEqual({
      tracks: [],
      ambientZones: [],
    });
  });

  it("maps musicZone.trackId → track.id, combatTrackId → combatTrack", () => {
    const result = compileMusic({
      ...EMPTY_AUDIO,
      musicZones: [
        {
          id: "studio-id",
          trackId: "village_lute",
          name: "Village",
          combatTrackId: "village_combat",
          polygon: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
          ],
          priority: 1,
          blendDistance: 8,
        },
      ],
    } as never);
    const track = (result as { tracks: Array<Record<string, unknown>> })
      .tracks[0];
    expect(track.id).toBe("village_lute"); // NOT studio-id
    expect(track.combatTrack).toBe("village_combat");
    const region = track.region as Record<string, unknown>;
    expect(region.priority).toBe(1);
    expect(region.blendDistance).toBe(8);
  });

  it("compiles ambientZones with full shape (type / tracks / polygon / volume)", () => {
    const result = compileMusic({
      ...EMPTY_AUDIO,
      ambientZones: [
        {
          id: "a1",
          name: "Forest",
          ambientType: "forest",
          tracks: ["wind.ogg", "birds.ogg"],
          polygon: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
          ],
          volume: 0.6,
          falloffDistance: 12,
        },
      ],
    } as never);
    const zone = (result as { ambientZones: Array<Record<string, unknown>> })
      .ambientZones[0];
    expect(zone.id).toBe("a1");
    expect(zone.type).toBe("forest"); // ambientType → type
    expect(zone.tracks).toEqual(["wind.ogg", "birds.ogg"]);
    expect(zone.volume).toBe(0.6);
    expect(zone.falloffDistance).toBe(12);
  });
});
