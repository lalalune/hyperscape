/**
 * `promptContextBuilder` — LLM context-string builder tests.
 *
 * Pure string formatters (no fs, no network). Five exported
 * functions: three builders, one composer, one summary extractor.
 * Tests pin the non-obvious behavior:
 *
 *   - Biome distribution is sorted descending and filters out
 *     <=1% entries.
 *   - Entity counts are sorted descending and 0-count entries are
 *     dropped.
 *   - Named locations are sliced at 20 with a "... and N more" tail.
 *   - `extractEntitySummary` resolves `storage.stateKey → type.id`
 *     (so internal storage keys don't leak through as type ids).
 *   - Module schema formatting respects field min/max + enum
 *     options (capped at 6 with a trailing "..." sentinel).
 */

import { describe, expect, it } from "vitest";
import {
  buildEntityContext,
  buildModuleSchemaContext,
  buildTerrainContext,
  buildWorldContextPrompt,
  extractEntitySummary,
  type EntitySummary,
  type TerrainSummary,
  type WorldContext,
} from "../promptContextBuilder";
import type {
  EntityTypeSchema,
  GameModule,
} from "../../../src/gameModules/GameModule";

function makeEntityType(
  overrides: Partial<EntityTypeSchema>,
): EntityTypeSchema {
  return {
    id: "thing",
    name: "Thing",
    icon: "Square",
    color: "#fff",
    paletteCategory: "default",
    outlinerLayer: "default",
    selectionType: "thing",
    storage: { stateKey: "things", type: "array" },
    spatial: true,
    fields: [],
    defaults: {},
    marker: { type: "shape", shape: "cube", size: 1 } as never,
    ...overrides,
  } as EntityTypeSchema;
}

function makeModule(overrides: Partial<GameModule> = {}): GameModule {
  return {
    id: "test",
    name: "Test Module",
    version: "1.0.0",
    entityTypes: [],
    paletteCategories: [],
    outlinerLayers: [],
    ...overrides,
  } as GameModule;
}

// ----- buildTerrainContext --------------------------------------------------

describe("buildTerrainContext", () => {
  const baseTerrain: TerrainSummary = {
    worldSize: { width: 100, height: 80 },
    tileSize: 16,
    totalArea: 100 * 80 * 16 * 16,
    avgElevation: 12.345,
    elevationRange: { min: -5.67, max: 89.012 },
    biomes: {},
  };

  it("emits the canonical header + size/tile/elevation lines", () => {
    const out = buildTerrainContext(baseTerrain);
    expect(out).toContain("## Terrain");
    expect(out).toContain("100×80 tiles");
    expect(out).toContain("Tile size: 16 units");
    // Average rounded to 1 decimal; range to 1 decimal each side.
    expect(out).toContain("avg 12.3");
    expect(out).toContain("[-5.7, 89.0]");
  });

  it("formats totalArea with locale thousand-separators", () => {
    const out = buildTerrainContext(baseTerrain);
    // 100*80*16*16 = 2,048,000
    expect(out).toContain("2,048,000");
  });

  it("sorts biomes descending and drops entries <=1%", () => {
    const out = buildTerrainContext({
      ...baseTerrain,
      biomes: {
        forest: 40,
        plains: 30,
        desert: 1, // boundary — filtered (`pct > 1`)
        tundra: 0.5,
        mountain: 28.5,
      },
    });
    const lines = out.split("\n");
    const biomeLines = lines.filter((l) => l.startsWith("  - "));
    // Forest first (40), then plains (30), then mountain (28.5).
    expect(biomeLines[0]).toContain("forest");
    expect(biomeLines[1]).toContain("plains");
    expect(biomeLines[2]).toContain("mountain");
    expect(biomeLines).toHaveLength(3);
    // Filtered entries should NOT appear.
    expect(out).not.toContain("desert:");
    expect(out).not.toContain("tundra:");
  });

  it("omits the 'Biome distribution' header entirely when no biome >1%", () => {
    const out = buildTerrainContext({
      ...baseTerrain,
      biomes: { only: 0.5 },
    });
    expect(out).not.toContain("Biome distribution");
  });
});

// ----- buildEntityContext ---------------------------------------------------

describe("buildEntityContext", () => {
  const npcType = makeEntityType({ id: "npc", name: "NPC" });
  const mobType = makeEntityType({ id: "mob", name: "Mob" });
  const module = makeModule({ entityTypes: [npcType, mobType] });

  it("renders the total in the header", () => {
    const summary: EntitySummary = {
      counts: { npc: 3, mob: 7 },
      total: 10,
      namedLocations: [],
    };
    const out = buildEntityContext(summary, module);
    expect(out).toContain("## Entities (10 total)");
  });

  it("resolves entity-type ids to display names and sorts descending", () => {
    const summary: EntitySummary = {
      counts: { npc: 3, mob: 7 },
      total: 10,
      namedLocations: [],
    };
    const out = buildEntityContext(summary, module);
    const ix = (s: string): number => out.indexOf(s);
    // Mob (7) appears before NPC (3).
    expect(ix("Mob:")).toBeGreaterThanOrEqual(0);
    expect(ix("NPC:")).toBeGreaterThan(ix("Mob:"));
  });

  it("falls back to the raw typeId when the module doesn't declare a name", () => {
    const summary: EntitySummary = {
      counts: { unknown_type: 4 },
      total: 4,
      namedLocations: [],
    };
    const out = buildEntityContext(summary, module);
    expect(out).toContain("unknown_type: 4");
  });

  it("filters out entries with count 0", () => {
    const summary: EntitySummary = {
      counts: { npc: 0, mob: 2 },
      total: 2,
      namedLocations: [],
    };
    const out = buildEntityContext(summary, module);
    expect(out).toContain("Mob: 2");
    expect(out).not.toContain("NPC: 0");
  });

  it("renders named locations with integer-rounded positions", () => {
    const summary: EntitySummary = {
      counts: { npc: 1 },
      total: 1,
      namedLocations: [
        { name: "Foothold", type: "Town", position: { x: 12.7, z: -8.4 } },
      ],
    };
    const out = buildEntityContext(summary, module);
    expect(out).toContain("### Named Locations");
    // toFixed(0) on 12.7 → "13"; on -8.4 → "-8"
    expect(out).toContain("Foothold (Town) at (13, -8)");
  });

  it("emits no position suffix when position is undefined", () => {
    const summary: EntitySummary = {
      counts: {},
      total: 0,
      namedLocations: [{ name: "Limbo", type: "POI" }],
    };
    const out = buildEntityContext(summary, module);
    expect(out).toContain("Limbo (POI)");
    expect(out).not.toContain("Limbo (POI) at");
  });

  it("caps named locations at 20 with a tail summary", () => {
    const namedLocations = Array.from({ length: 25 }, (_, i) => ({
      name: `Loc${i}`,
      type: "Town",
    }));
    const out = buildEntityContext(
      { counts: {}, total: 0, namedLocations },
      module,
    );
    expect(out).toContain("Loc0");
    expect(out).toContain("Loc19");
    expect(out).not.toContain("Loc20");
    expect(out).toContain("... and 5 more");
  });

  it("omits the 'Named Locations' header when none exist", () => {
    const out = buildEntityContext(
      { counts: { npc: 1 }, total: 1, namedLocations: [] },
      module,
    );
    expect(out).not.toContain("Named Locations");
  });
});

// ----- buildModuleSchemaContext ---------------------------------------------

describe("buildModuleSchemaContext", () => {
  it("emits header with module name + version", () => {
    const out = buildModuleSchemaContext(
      makeModule({ name: "Hyperia", version: "2.1.0" }),
    );
    expect(out).toContain("## Game Module: Hyperia (v2.1.0)");
    expect(out).toContain("### Entity Types");
  });

  it("formats entity-type metadata and storage location", () => {
    const out = buildModuleSchemaContext(
      makeModule({
        entityTypes: [
          makeEntityType({
            id: "audioZone",
            name: "Audio Zone",
            paletteCategory: "audio",
            spatial: false,
            storage: {
              stateKey: "zones",
              type: "array",
              stateRoot: "audioLayers",
            },
          }),
        ],
      }),
    );
    expect(out).toContain("#### Audio Zone (`audioZone`)");
    expect(out).toContain("Category: audio");
    expect(out).toContain("Spatial: no");
    expect(out).toContain("Storage: audioLayers.zones");
  });

  it("defaults storage stateRoot to 'extendedLayers' when omitted", () => {
    const out = buildModuleSchemaContext(
      makeModule({
        entityTypes: [
          makeEntityType({
            id: "npc",
            name: "NPC",
            storage: { stateKey: "npcs", type: "array" },
          }),
        ],
      }),
    );
    expect(out).toContain("Storage: extendedLayers.npcs");
  });

  it("formats fields: required flag, min/max range, enum options", () => {
    const out = buildModuleSchemaContext(
      makeModule({
        entityTypes: [
          makeEntityType({
            id: "npc",
            name: "NPC",
            fields: [
              {
                key: "name",
                label: "Name",
                type: "string",
                required: true,
              } as never,
              {
                key: "level",
                label: "Level",
                type: "number",
                config: { min: 1, max: 99 },
              } as never,
              {
                key: "race",
                label: "Race",
                type: "select",
                config: {
                  options: [
                    { value: "human" },
                    { value: "elf" },
                    { value: "dwarf" },
                  ],
                },
              } as never,
            ],
          }),
        ],
      }),
    );
    expect(out).toContain("`name`: string (required) — Name");
    expect(out).toContain("`level`: number [1..99] — Level");
    expect(out).toContain("`race`: select {human|elf|dwarf} — Race");
  });

  it("caps select options at 6 and appends a '...' sentinel", () => {
    const out = buildModuleSchemaContext(
      makeModule({
        entityTypes: [
          makeEntityType({
            id: "npc",
            name: "NPC",
            fields: [
              {
                key: "k",
                label: "K",
                type: "select",
                config: {
                  options: Array.from({ length: 9 }, (_, i) => ({
                    value: `v${i}`,
                  })),
                },
              } as never,
            ],
          }),
        ],
      }),
    );
    expect(out).toContain("v0|v1|v2|v3|v4|v5, ...");
    expect(out).not.toContain("v6|");
  });

  it("uses unicode infinity sentinels when one side of the range is open", () => {
    const out = buildModuleSchemaContext(
      makeModule({
        entityTypes: [
          makeEntityType({
            id: "npc",
            name: "NPC",
            fields: [
              {
                key: "hp",
                label: "HP",
                type: "number",
                config: { min: 0 },
              } as never,
              {
                key: "depth",
                label: "Depth",
                type: "number",
                config: { max: 100 },
              } as never,
            ],
          }),
        ],
      }),
    );
    expect(out).toContain("[0..∞]");
    expect(out).toContain("[−∞..100]");
  });

  it("emits a terrain block ONLY when module.terrain.enabled", () => {
    const enabled = buildModuleSchemaContext(
      makeModule({
        terrain: {
          enabled: true,
          tileSize: 32,
          biomes: ["forest", "plains"],
          procgen: true,
        },
      }),
    );
    expect(enabled).toContain("### Terrain");
    expect(enabled).toContain("Tile size: 32");
    expect(enabled).toContain("Biomes: forest, plains");
    expect(enabled).toContain("Procgen: enabled");

    const disabled = buildModuleSchemaContext(
      makeModule({
        terrain: {
          enabled: false,
          tileSize: 32,
          biomes: [],
          procgen: false,
        },
      }),
    );
    expect(disabled).not.toContain("### Terrain");
  });
});

// ----- buildWorldContextPrompt ----------------------------------------------

describe("buildWorldContextPrompt", () => {
  const npcType = makeEntityType({ id: "npc", name: "NPC" });
  const module = makeModule({ entityTypes: [npcType] });

  it("composes the header + (optional) terrain + entity sections", () => {
    const ctx: WorldContext = {
      terrain: {
        worldSize: { width: 10, height: 10 },
        tileSize: 16,
        totalArea: 25600,
        avgElevation: 0,
        elevationRange: { min: 0, max: 0 },
        biomes: { forest: 100 },
      },
      entities: { counts: { npc: 1 }, total: 1, namedLocations: [] },
      module: { id: "test", name: "Test Module", version: "1.0.0" },
    };
    const out = buildWorldContextPrompt(ctx, module);
    expect(out).toContain("# Current World State");
    expect(out).toContain("Module: Test Module v1.0.0");
    expect(out).toContain("## Terrain");
    expect(out).toContain("## Entities (1 total)");
  });

  it("skips the terrain block when ctx.terrain is null", () => {
    const ctx: WorldContext = {
      terrain: null,
      entities: { counts: {}, total: 0, namedLocations: [] },
      module: { id: "x", name: "X", version: "0.0.1" },
    };
    const out = buildWorldContextPrompt(ctx, module);
    expect(out).not.toContain("## Terrain");
    expect(out).toContain("## Entities (0 total)");
  });
});

// ----- extractEntitySummary -------------------------------------------------

describe("extractEntitySummary", () => {
  const npcType = makeEntityType({
    id: "npc",
    name: "NPC",
    storage: { stateKey: "npcs", type: "array" },
  });
  const ambientType = makeEntityType({
    id: "ambientZone",
    name: "Ambient Zone",
    storage: {
      stateKey: "zones",
      type: "array",
      stateRoot: "audioLayers",
    },
  });
  const entityTypes = [npcType, ambientType];

  it("counts entities across both layer roots and resolves stateKey → typeId", () => {
    const result = extractEntitySummary(
      { npcs: [{}, {}, {}] },
      { zones: [{}, {}] },
      entityTypes,
    );
    expect(result.total).toBe(5);
    // Resolved by storage.stateKey, so the typeId is what's in counts.
    expect(result.counts.npc).toBe(3);
    expect(result.counts.ambientZone).toBe(2);
  });

  it("falls back to using the stateKey as typeId when no entityType matches", () => {
    const result = extractEntitySummary(
      { mysteryThings: [{}, {}] },
      {},
      entityTypes,
    );
    expect(result.counts.mysteryThings).toBe(2);
    expect(result.total).toBe(2);
  });

  it("ignores non-array values in the layer roots", () => {
    const result = extractEntitySummary(
      { npcs: [{}], junk: "not an array", other: 42 } as never,
      {},
      entityTypes,
    );
    expect(result.total).toBe(1);
    expect(result.counts.npc).toBe(1);
    expect(Object.keys(result.counts)).toEqual(["npc"]);
  });

  it("collects named entities into namedLocations with type display name", () => {
    const result = extractEntitySummary(
      {
        npcs: [
          { name: "Tavern Keeper", position: { x: 5, z: 10 } },
          { name: "" }, // empty name → skipped
          {}, // no name → skipped
          { name: "Wanderer" }, // no position
        ],
      },
      {},
      entityTypes,
    );
    expect(result.namedLocations).toEqual([
      {
        name: "Tavern Keeper",
        type: "NPC",
        position: { x: 5, z: 10 },
      },
      {
        name: "Wanderer",
        type: "NPC",
        position: undefined,
      },
    ]);
  });

  it("falls back to the stateKey for the location type when no entityType matches", () => {
    const result = extractEntitySummary(
      { weirdStuff: [{ name: "??" }] } as never,
      {},
      entityTypes,
    );
    expect(result.namedLocations[0].type).toBe("weirdStuff");
  });

  it("drops position when x or z is missing", () => {
    const result = extractEntitySummary(
      {
        npcs: [
          { name: "OnlyX", position: { x: 1 } },
          { name: "OnlyZ", position: { z: 1 } },
        ],
      },
      {},
      entityTypes,
    );
    expect(result.namedLocations[0].position).toBeUndefined();
    expect(result.namedLocations[1].position).toBeUndefined();
  });

  it("returns an empty summary when both layer roots are empty", () => {
    const result = extractEntitySummary({}, {}, entityTypes);
    expect(result).toEqual({ counts: {}, total: 0, namedLocations: [] });
  });
});
