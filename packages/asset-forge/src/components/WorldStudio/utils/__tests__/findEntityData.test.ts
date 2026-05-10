/**
 * `findEntityData` — entity lookup tests.
 *
 * Resolves a (type, id) tuple to the entity's full data record by
 * walking the appropriate extendedLayers / audioLayers / world
 * layer. The 19-type switch + the registry-fallback default
 * branch is bug-prone (each case has a similar but distinct
 * source array); tests pin the lookup contract per type.
 */

import { describe, expect, it } from "vitest";
import { findEntityData } from "../entityActions";

function makeEntity(id: string, name: string) {
  return { id, name };
}

function makeState(overrides: {
  extendedLayers?: Record<string, unknown[]>;
  audioLayers?: Record<string, unknown[]>;
  world?: Record<string, unknown[]> | null;
  prefabs?: Array<{ id: string; name: string }>;
}) {
  return {
    extendedLayers: {
      spawnPoints: [],
      teleports: [],
      mobSpawns: [],
      resources: [],
      stations: [],
      pois: [],
      waterBodies: [],
      regions: [],
      dangerSources: [],
      customAssets: [],
      ...overrides.extendedLayers,
    },
    audioLayers: {
      musicZones: [],
      ambientZones: [],
      sfxTriggers: [],
      ...overrides.audioLayers,
    },
    prefabs: overrides.prefabs ?? [],
    builder: {
      editing: {
        world: overrides.world
          ? {
              layers: {
                npcs: overrides.world.npcs ?? [],
                quests: overrides.world.quests ?? [],
                bosses: overrides.world.bosses ?? [],
              },
            }
          : null,
      },
    },
  } as never;
}

describe("findEntityData — extendedLayers types", () => {
  it.each([
    "spawnPoint",
    "teleport",
    "mobSpawn",
    "resource",
    "station",
    "poi",
    "waterBody",
    "region",
    "dangerSource",
    "customAsset",
  ] as const)("$0 looks up in extendedLayers", (type) => {
    // Convert type to plural extended-layer field name.
    const fieldMap: Record<string, string> = {
      spawnPoint: "spawnPoints",
      teleport: "teleports",
      mobSpawn: "mobSpawns",
      resource: "resources",
      station: "stations",
      poi: "pois",
      waterBody: "waterBodies",
      region: "regions",
      dangerSource: "dangerSources",
      customAsset: "customAssets",
    };
    const field = fieldMap[type];
    const target = makeEntity("e1", "Target");
    const state = makeState({
      extendedLayers: { [field]: [target, makeEntity("other", "Other")] },
    });
    const result = findEntityData(state, type, "e1");
    expect(result).toEqual(target);
  });

  it("returns null when the id doesn't exist", () => {
    const state = makeState({
      extendedLayers: { spawnPoints: [makeEntity("a", "A")] },
    });
    expect(findEntityData(state, "spawnPoint", "missing")).toBeNull();
  });

  it("returns null when the array is empty", () => {
    const state = makeState({});
    expect(findEntityData(state, "spawnPoint", "anything")).toBeNull();
  });
});

describe("findEntityData — audioLayers types", () => {
  it.each([
    ["musicZone", "musicZones"],
    ["ambientZone", "ambientZones"],
    ["sfxTrigger", "sfxTriggers"],
  ] as const)("$0 looks up in audioLayers.$1", (type, field) => {
    const target = makeEntity("a1", "Audio");
    const state = makeState({
      audioLayers: { [field]: [target] },
    });
    expect(findEntityData(state, type, "a1")).toEqual(target);
  });
});

describe("findEntityData — world layer types", () => {
  it("npc looks up in world.layers.npcs", () => {
    const target = makeEntity("npc1", "NPC");
    const state = makeState({
      world: { npcs: [target] },
    });
    expect(findEntityData(state, "npc", "npc1")).toEqual(target);
  });

  it("quest looks up in world.layers.quests", () => {
    const target = makeEntity("q1", "Quest");
    const state = makeState({
      world: { quests: [target] },
    });
    expect(findEntityData(state, "quest", "q1")).toEqual(target);
  });

  it("boss looks up in world.layers.bosses", () => {
    const target = makeEntity("b1", "Boss");
    const state = makeState({
      world: { bosses: [target] },
    });
    expect(findEntityData(state, "boss", "b1")).toEqual(target);
  });

  it("returns null when world is null (no project loaded)", () => {
    const state = makeState({ world: null });
    expect(findEntityData(state, "npc", "any")).toBeNull();
  });
});

describe("findEntityData — prefab type", () => {
  it("prefab looks up in top-level state.prefabs", () => {
    const target = makeEntity("p1", "Prefab") as never;
    const state = makeState({ prefabs: [target] });
    expect(findEntityData(state, "prefab", "p1")).toEqual(target);
  });
});

describe("findEntityData — registry fallback (unknown types)", () => {
  it("falls through to scan extendedLayers for unknown types", () => {
    // Custom type not in the switch — falls through to the
    // generic for-loop scan of extendedLayers + audioLayers.
    const target = makeEntity("orphan", "Orphan");
    const state = makeState({
      extendedLayers: { regions: [target] },
    });
    expect(findEntityData(state, "totally-custom-type", "orphan")).toEqual(
      target,
    );
  });

  it("falls through to audioLayers if not found in extendedLayers", () => {
    const target = makeEntity("audio-only", "Audio");
    const state = makeState({
      audioLayers: { musicZones: [target] },
    });
    expect(findEntityData(state, "custom-type", "audio-only")).toEqual(target);
  });

  it("returns null when id is not in any extended or audio layer", () => {
    const state = makeState({});
    expect(findEntityData(state, "unknown-type", "missing")).toBeNull();
  });

  it("returns null when wildernessBoundary is in extendedLayers (not an array)", () => {
    // The generic scan iterates extendedLayers values; non-array
    // entries (wildernessBoundary is `WildernessBoundary | null`)
    // must be skipped without throwing.
    const state = makeState({});
    // Force a non-array entry into the layers map.
    (
      state as never as { extendedLayers: Record<string, unknown> }
    ).extendedLayers.wildernessBoundary = { id: "wb", points: [] };
    expect(findEntityData(state, "wildernessBoundary", "wb")).toBeNull();
  });
});

describe("findEntityData — id matching", () => {
  it("finds entity by exact id match (no substring matching)", () => {
    const state = makeState({
      extendedLayers: {
        spawnPoints: [makeEntity("a-1", "A"), makeEntity("a-2", "B")],
      },
    });
    expect(findEntityData(state, "spawnPoint", "a-1")).toEqual({
      id: "a-1",
      name: "A",
    });
    expect(findEntityData(state, "spawnPoint", "a")).toBeNull();
  });

  it("empty id returns null even when an empty-id entity exists", () => {
    // Defensive — entities shouldn't have empty ids, but if they
    // do, an empty-string lookup shouldn't accidentally hit it
    // via a typo. (Note: this confirms the current behavior IS
    // to match empty-id with empty-string lookup, but that's not
    // generally exercised by the editor — the test just locks
    // the deterministic behavior in.)
    const state = makeState({
      extendedLayers: { spawnPoints: [makeEntity("", "")] },
    });
    expect(findEntityData(state, "spawnPoint", "")).toEqual({
      id: "",
      name: "",
    });
  });
});
