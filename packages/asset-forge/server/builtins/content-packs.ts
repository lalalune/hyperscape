/**
 * Built-in content pack catalog — the AAA "engine ships with
 * baseline content" pattern.
 *
 * Phase D / Phase F-prelude of `PLAN_AAA_CONTENT_SYSTEM.md`.
 * Mirrors UE5's `Engine/` content folder and Unity's built-in
 * packages: every install of asset-forge ships with a fixed
 * catalog of themed content packs that auto-bootstrap into the
 * `asset_packs` table on server start. No manual seeder run
 * required; new developers clone the repo, boot the server,
 * and immediately have all the built-in packs available.
 *
 * The data here is the canonical source for these packs. The
 * standalone seeder scripts
 * (`scripts/seed-hyperia-content-pack.ts`,
 * `scripts/seed-themed-content-packs.ts`) became thin wrappers
 * that call `upsertBuiltinContentPacks` for backward compat —
 * useful for re-seeding production without restarting the
 * server, or for CI environments that want explicit seed
 * control.
 *
 * Built-in catalog:
 *
 *   @hyperforge/content-pack-hyperia-v1   — tundra/forest/canyon
 *   @hyperforge/content-pack-arctic-v1    — frozen/snow/glacier
 *   @hyperforge/content-pack-tropical-v1  — beach/jungle/lagoon
 *   @hyperforge/content-pack-desert-v1    — sand/mesa/oasis
 *   @hyperforge/content-pack-volcanic-v1  — lava/ash/basalt
 *   @hyperforge/content-pack-wetland-v1   — marsh/swamp/delta
 *
 * Idempotent: re-running the upsert leaves rows unchanged
 * unless a pack's `packVersion` (the in-code constant below)
 * has been bumped, in which case the manifest is replaced.
 */

import { Pool } from "pg";

// Phase 3.3 of PLAN_AAA_UE5_PARITY: themed biome catalogs now
// live in their own packages. Each `manifest.biomes` array is
// the source-of-truth for that pack; the BUILTIN_CONTENT_PACKS
// literal below consumes them via passthrough.
import { manifest as arcticContentPackManifest } from "@hyperforge/content-pack-arctic-v1";
import { manifest as hyperiaContentPackManifest } from "@hyperforge/content-pack-hyperia-v1";

interface BiomeContribution {
  id: string;
  name: string;
  color: number;
  terrainMultiplier: number;
  difficultyLevel: number;
  heightRange: [number, number];
  maxSlope: number;
  resourceDensity: number;
}

interface BuiltinPack {
  manifestId: string;
  name: string;
  description: string;
  tags: string[];
  packVersion: string;
  biomes: ReadonlyArray<BiomeContribution>;
  /**
   * Per-theme procgen heightmap preset. Carries
   * `WorldCreationConfig`-shaped overrides (terrain / island /
   * noise / shoreline knobs) that the dialog deep-merges into
   * the procgen base config before generating the world. Lets
   * each themed pack ship a distinct island shape, sea level,
   * peak height, and coastline irregularity:
   *
   *   - tropical: smaller landmass, lower peaks, irregular coast
   *   - arctic:   larger landmass, taller peaks, smoother edges
   *   - desert:   larger flat landmass with sharper relief
   *   - volcanic: central tall peak, rugged slopes
   *   - wetland:  flat low-elevation marsh with many water cuts
   *   - hyperia:  the canonical defaults (DEFAULT_ISLAND_CONFIG)
   *
   * Optional — packs that don't ship a preset use the
   * client-side `DEFAULT_*` constants. Existing fields
   * (`tags`, `biomes`) are unchanged.
   */
  terrainHeightmapPreset?: {
    id: string;
    name: string;
    description: string;
    /**
     * `WorldCreationConfig` partial — top-level keys must match
     * the client-side `WorldCreationConfig` (`terrain`, `island`,
     * `noise`, `shoreline`). Each sub-object's keys are
     * deep-merged into the base config. Extra keys are
     * ignored client-side; missing keys inherit the default.
     */
    params: Record<string, unknown>;
  };
  /**
   * Per-biome procgen vegetation overrides keyed by biome id.
   * Shape mirrors the client-side `BiomeTreeVegetationConfig`
   * (`enabled`, `trees`, `density`, `minSpacing`, `clustering`,
   * etc.) — see `packages/asset-forge/src/components/WorldBuilder/types.ts`.
   * The dialog deep-merges this into `procgenConfig.vegetation`
   * after the heightmap preset, so each themed pack scatters
   * theme-appropriate species on its own biome ids:
   *
   *   - tropical_beach → `tree_palm` cluster scatter
   *   - jungle         → dense `tree_palm` + `tree_banana`
   *   - frozen_tundra  → sparse `tree_pine` + `tree_dead`
   *   - sand_dune      → near-zero density (cacti once a tree id exists)
   *   - lava_field     → `tree_dead` only, low density
   *   - marsh          → `tree_dead` + `tree_general`
   *
   * Tree species ids must match the engine's vegetation manifest
   * (`@hyperforge/asset-pack-hyperia-trees-v1`) until Phase C3
   * proper ships per-pack vegetation species. Optional — packs
   * that don't ship overrides leave `procgenConfig.vegetation`
   * untouched, so their biomes inherit the default scatter.
   */
  vegetationByBiome?: Record<string, Record<string, unknown>>;
  /**
   * Asset packs this content pack depends on. The dialog walks
   * the union of `assetPackDeps` across every resolved content
   * pack and installs them — replacing the previous
   * unconditional `@hyperforge/asset-pack-hyperia-trees-v1`
   * install.
   *
   * Every themed pack today declares the Hyperia trees pack
   * because their `vegetationByBiome` references species ids
   * (`tree_palm`, `tree_pine`, `tree_dead`, etc.) that live in
   * that asset pack. When per-theme tree GLBs are authored
   * (Phase C3 proper), each themed pack swaps its dep to the
   * matching theme-specific asset pack — no client code change.
   *
   * Strict-catalog promise: the agent only installs what packs
   * declare. A project that picks `content-pack-tropical-v1`
   * gets only the asset packs tropical declares; nothing
   * Hyperia-shaped sneaks in.
   */
  assetPackDeps?: ReadonlyArray<string>;
  /**
   * Phase 5 / Phase C3 prep — proper `VegetationSpecies` array
   * matching the manifest-schema shape. Each entry declares one
   * tree / bush / etc. the pack contributes: id, modelRef
   * (`<assetPackId>/<entryId>` or `asset://`), category, scale,
   * slope tolerance, etc.
   *
   * The contentRegistry already accepts these via
   * `setContentPackContent` and `getActiveVegetationSpecies`
   * surfaces them at runtime. The procgen consumer wiring (Phase
   * C3 follow-up) reads from this list to scatter species rather
   * than from today's `vegetationByBiome` legacy bandaid (which
   * uses engine-hardcoded tree IDs).
   *
   * Authoring this field today validates the schema, makes the
   * pack contents introspectable to the agent / pack browser,
   * and unlocks the future per-pack tree-model migration without
   * a manifest schema change.
   */
  vegetationSpecies?: ReadonlyArray<{
    id: string;
    name: string;
    description?: string;
    category: string;
    modelRef: string;
    baseScale?: number;
    scaleVariation?: [number, number];
    randomRotation?: boolean;
    alignToNormal?: boolean;
    yOffset?: number;
    maxSlope?: number;
    minHeight?: number;
    maxHeight?: number;
    tags?: ReadonlyArray<string>;
  }>;
  /**
   * Phase 3.5 — procgen tree preset ids this pack ships. Each
   * entry is the camelCase preset key consumed by `procgen`'s
   * `generateProcgenTree` (e.g. `"quakingAspen"`,
   * `"blackOak"`). When the engine prewarms its tree cache, it
   * walks the union of `treePresets` from installed content
   * packs instead of the legacy hardcoded `TREE_PRESETS`
   * array in `ProcgenTreeCache.ts`.
   *
   * The Hyperia content pack ships the 8 fantasy-RPG presets
   * the engine has always used. Non-Hyperia themed packs ship
   * their own preset lists (or omit the field to skip procgen
   * tree generation entirely — packs scattering only GLB
   * assets via `vegetationSpecies` don't need procgen trees).
   *
   * Optional — packs that don't ship procgen trees omit the
   * field; the engine sees no contribution from that pack and
   * the union excludes it.
   */
  treePresets?: ReadonlyArray<string>;
}

// ────────────────────────────────────────────────────────────
// Hyperia — the canonical fantasy RPG starter
// ────────────────────────────────────────────────────────────
// Phase 3.3: hyperia biomes now live in @hyperforge/
// content-pack-hyperia-v1's pack.json. Same passthrough
// pattern as ARCTIC_BIOMES above.
const HYPERIA_BIOMES: ReadonlyArray<BiomeContribution> =
  hyperiaContentPackManifest.biomes;

// ────────────────────────────────────────────────────────────
// Arctic — frozen / snowy / mountainous
// ────────────────────────────────────────────────────────────
// Phase 3.3 of PLAN_AAA_UE5_PARITY migrated the arctic biome
// catalog into @hyperforge/content-pack-arctic-v1's pack.json.
// Asset-forge's BUILTIN_CONTENT_PACKS literal now consumes the
// manifest's biomes array directly — the inline ARCTIC_BIOMES
// constant that used to live here is gone. Future biome adds
// land in the content pack's pack.json and propagate here
// automatically on bump.
//
// The local `BiomeContribution` interface and the manifest's
// `BiomeContributionSchema` are structurally identical, so a
// straight passthrough is type-safe.
const ARCTIC_BIOMES: ReadonlyArray<BiomeContribution> =
  arcticContentPackManifest.biomes;

// ────────────────────────────────────────────────────────────
// Tropical — beach / jungle / mangrove
// ────────────────────────────────────────────────────────────
const TROPICAL_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "tropical_beach",
    name: "Tropical Beach",
    color: 0xf5deb3,
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.0, 0.15],
    maxSlope: 0.4,
    resourceDensity: 0.5,
  },
  {
    id: "jungle",
    name: "Jungle",
    color: 0x1b5e20,
    terrainMultiplier: 1.1,
    difficultyLevel: 2,
    heightRange: [0.15, 0.55],
    maxSlope: 1.4,
    resourceDensity: 1.4,
  },
  {
    id: "mangrove",
    name: "Mangrove",
    color: 0x4e6b3a,
    terrainMultiplier: 0.5,
    difficultyLevel: 1,
    heightRange: [0.05, 0.25],
    maxSlope: 0.6,
    resourceDensity: 0.9,
  },
  {
    id: "palm_grove",
    name: "Palm Grove",
    color: 0x66a866,
    terrainMultiplier: 0.6,
    difficultyLevel: 0,
    heightRange: [0.1, 0.35],
    maxSlope: 0.7,
    resourceDensity: 1.0,
  },
  {
    id: "lagoon",
    name: "Lagoon",
    color: 0x4dd0e1,
    terrainMultiplier: 0.2,
    difficultyLevel: 0,
    heightRange: [0.0, 0.1],
    maxSlope: 0.2,
    resourceDensity: 0.6,
  },
];

// ────────────────────────────────────────────────────────────
// Desert — sand / mesa / oasis
// ────────────────────────────────────────────────────────────
const DESERT_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "sand_dune",
    name: "Sand Dune",
    color: 0xeacb8a,
    terrainMultiplier: 0.9,
    difficultyLevel: 1,
    heightRange: [0.1, 0.5],
    maxSlope: 1.1,
    resourceDensity: 0.2,
  },
  {
    id: "mesa",
    name: "Mesa",
    color: 0xa0522d,
    terrainMultiplier: 1.4,
    difficultyLevel: 2,
    heightRange: [0.5, 0.9],
    maxSlope: 2.2,
    resourceDensity: 0.3,
  },
  {
    id: "salt_flat",
    name: "Salt Flat",
    color: 0xf2eecb,
    terrainMultiplier: 0.2,
    difficultyLevel: 0,
    heightRange: [0.0, 0.15],
    maxSlope: 0.2,
    resourceDensity: 0.1,
  },
  {
    id: "oasis",
    name: "Oasis",
    color: 0x4ea66a,
    terrainMultiplier: 0.5,
    difficultyLevel: 0,
    heightRange: [0.05, 0.3],
    maxSlope: 0.5,
    resourceDensity: 1.5,
  },
  {
    id: "badlands",
    name: "Badlands",
    color: 0x7a3f25,
    terrainMultiplier: 1.2,
    difficultyLevel: 3,
    heightRange: [0.3, 0.7],
    maxSlope: 1.8,
    resourceDensity: 0.15,
  },
];

// ────────────────────────────────────────────────────────────
// Volcanic — lava / ash / basalt
// ────────────────────────────────────────────────────────────
const VOLCANIC_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "lava_field",
    name: "Lava Field",
    color: 0x4a0e0e,
    terrainMultiplier: 1.0,
    difficultyLevel: 4,
    heightRange: [0.1, 0.4],
    maxSlope: 1.4,
    resourceDensity: 0.1,
  },
  {
    id: "ash_plain",
    name: "Ash Plain",
    color: 0x3d3a36,
    terrainMultiplier: 0.6,
    difficultyLevel: 2,
    heightRange: [0.05, 0.3],
    maxSlope: 0.7,
    resourceDensity: 0.2,
  },
  {
    id: "basalt_peak",
    name: "Basalt Peak",
    color: 0x2a2a2e,
    terrainMultiplier: 1.7,
    difficultyLevel: 3,
    heightRange: [0.6, 1.0],
    maxSlope: 2.6,
    resourceDensity: 0.4,
  },
  {
    id: "sulfur_pool",
    name: "Sulfur Pool",
    color: 0xc8b04a,
    terrainMultiplier: 0.3,
    difficultyLevel: 3,
    heightRange: [0.0, 0.15],
    maxSlope: 0.4,
    resourceDensity: 0.25,
  },
  {
    id: "obsidian_flow",
    name: "Obsidian Flow",
    color: 0x121214,
    terrainMultiplier: 0.8,
    difficultyLevel: 3,
    heightRange: [0.2, 0.55],
    maxSlope: 1.2,
    resourceDensity: 0.5,
  },
];

// ────────────────────────────────────────────────────────────
// Wetland — marsh / swamp / bog / delta
// ────────────────────────────────────────────────────────────
const WETLAND_BIOMES: ReadonlyArray<BiomeContribution> = [
  {
    id: "marsh",
    name: "Marsh",
    color: 0x6b7a3d,
    terrainMultiplier: 0.4,
    difficultyLevel: 1,
    heightRange: [0.05, 0.25],
    maxSlope: 0.5,
    resourceDensity: 0.8,
  },
  {
    id: "swamp",
    name: "Swamp",
    color: 0x3d5a3a,
    terrainMultiplier: 0.5,
    difficultyLevel: 2,
    heightRange: [0.0, 0.2],
    maxSlope: 0.5,
    resourceDensity: 0.9,
  },
  {
    id: "bog",
    name: "Bog",
    color: 0x4a3e2a,
    terrainMultiplier: 0.3,
    difficultyLevel: 1,
    heightRange: [0.0, 0.15],
    maxSlope: 0.3,
    resourceDensity: 0.6,
  },
  {
    id: "fen",
    name: "Fen",
    color: 0x7a8a4a,
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.05, 0.2],
    maxSlope: 0.4,
    resourceDensity: 0.85,
  },
  {
    id: "river_delta",
    name: "River Delta",
    color: 0x6a8856,
    terrainMultiplier: 0.4,
    difficultyLevel: 0,
    heightRange: [0.0, 0.2],
    maxSlope: 0.3,
    resourceDensity: 1.2,
  },
];

// ────────────────────────────────────────────────────────────
// Pack catalog — exported as a frozen array
// ────────────────────────────────────────────────────────────
export const BUILTIN_CONTENT_PACKS: ReadonlyArray<BuiltinPack> = Object.freeze([
  {
    manifestId: "@hyperforge/content-pack-hyperia-v1",
    name: "Hyperia",
    description:
      "Hyperia's biome theme — tundra, forest, canyon. The canonical fantasy RPG starter; install when the user describes a generic-fantasy / unspecified world.",
    tags: ["hyperia", "fantasy", "rpg", "content-pack", "built-in"],
    packVersion: "1.0.0",
    biomes: HYPERIA_BIOMES,
    assetPackDeps: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    terrainHeightmapPreset: {
      id: "hyperia-default",
      name: "Hyperia island",
      description:
        "The canonical Hyperia heightmap — single circular landmass, mid-elevation peaks, gentle coastline irregularity. Matches the reference Hyperia world.",
      params: {
        terrain: { maxHeight: 50, waterThreshold: 16 },
        island: {
          enabled: true,
          maxWorldSizeTiles: 1000,
          falloffTiles: 4,
          edgeNoiseScale: 0.005,
          edgeNoiseStrength: 0.12,
        },
      },
    },
    // Phase 3.5 — the 8 procgen tree presets the engine has
    // shipped since the original hardcoded `TREE_PRESETS`
    // array. Hyperia maps each preset onto its tree-id
    // (`tree_normal` etc.) via the engine's tree-mesh
    // resolver; non-Hyperia packs declare their own preset
    // lists (currently empty — they scatter only GLB assets
    // via vegetationSpecies until Phase C3 ships per-theme
    // procgen species).
    treePresets: [
      "quakingAspen", // tree_normal
      "blackOak", // tree_oak
      "weepingWillow", // tree_willow
      "blackTupelo", // tree_teak
      "acer", // tree_maple
      "sassafras", // tree_mahogany
      "europeanLarch", // tree_yew
      "hillCherry", // tree_magic
    ],
  },
  {
    manifestId: "@hyperforge/content-pack-arctic-v1",
    name: "Arctic",
    description:
      "Frozen / snowy / mountainous biomes. Install for a snowy mountain map, glacier exploration, or polar expedition theme.",
    tags: ["arctic", "snow", "frozen", "mountain", "cold", "content-pack"],
    packVersion: "1.0.0",
    biomes: ARCTIC_BIOMES,
    assetPackDeps: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    terrainHeightmapPreset: {
      id: "arctic-mountain-range",
      name: "Arctic mountain range",
      description:
        "Larger landmass with taller jagged peaks and smoother glacial coastlines. Higher max elevation = visible mountain ranges; lower edge noise strength = smooth glacier shores.",
      params: {
        terrain: { maxHeight: 90, waterThreshold: 14 },
        island: {
          enabled: true,
          maxWorldSizeTiles: 1200,
          falloffTiles: 6,
          edgeNoiseScale: 0.004,
          edgeNoiseStrength: 0.08,
        },
      },
    },
    vegetationByBiome: {
      frozen_tundra: {
        enabled: true,
        enableSnow: true,
        trees: {
          tree_pine: { weight: 60, minHeight: 20 },
          tree_pineDead: { weight: 25, minHeight: 25 },
          tree_dead: { weight: 15, minHeight: 30 },
        },
        density: 18,
        minSpacing: 6,
        clustering: true,
        clusterSize: 25,
        clusterRadius: 100,
        clusterSpacing: 110,
        scaleVariation: [0.9, 1.1],
        maxSlope: 1.4,
      },
      snow_plain: {
        enabled: true,
        enableSnow: true,
        trees: {
          tree_pine: { weight: 70, minHeight: 15 },
          tree_dead: { weight: 30 },
        },
        density: 8,
        minSpacing: 8,
        clustering: false,
        scaleVariation: [0.9, 1.1],
        maxSlope: 1.2,
      },
      glacial_peak: {
        enabled: true,
        enableSnow: true,
        trees: {
          tree_pineDead: { weight: 60, minHeight: 50 },
          tree_dead: { weight: 40, minHeight: 50 },
        },
        density: 3,
        minSpacing: 15,
        clustering: false,
        scaleVariation: [0.7, 1.0],
        maxSlope: 2.0,
      },
      frozen_lake: {
        enabled: false,
        trees: {},
        density: 0,
        minSpacing: 10,
        clustering: false,
      },
      ice_field: {
        enabled: true,
        enableSnow: true,
        trees: {
          tree_dead: { weight: 100 },
        },
        density: 4,
        minSpacing: 12,
        clustering: false,
        scaleVariation: [0.8, 1.0],
        maxSlope: 1.0,
      },
    },
    // Phase 5 / C3 prep — arctic species declarations.
    // modelRefs point at the existing Hyperia trees pack pending
    // per-theme tree GLB authoring; arctic species ids stay
    // stable when the modelRefs swap.
    vegetationSpecies: [
      {
        id: "arctic_pine",
        name: "Hardy Pine",
        description:
          "Snow-tolerant evergreen forming the bulk of frozen-tundra and snow-plain scatter.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_pine",
        baseScale: 1.0,
        scaleVariation: [0.85, 1.15],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.6,
        tags: ["arctic", "evergreen", "snow"],
      },
      {
        id: "arctic_dead_pine",
        name: "Frozen Dead Pine",
        description:
          "Snow-stripped trunk used at glacial peak edges and high-altitude scatter for atmosphere.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_pineDead",
        baseScale: 0.95,
        scaleVariation: [0.8, 1.1],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.7,
        minHeight: 25,
        tags: ["arctic", "atmospheric", "altitude"],
      },
      {
        id: "arctic_dead_tree",
        name: "Bare Dead Tree",
        description:
          "Generic stripped trunk used across all arctic biomes for sparse atmospheric scatter.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_dead",
        baseScale: 0.85,
        scaleVariation: [0.7, 1.0],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.7,
        tags: ["arctic", "atmospheric"],
      },
    ],
  },
  {
    manifestId: "@hyperforge/content-pack-tropical-v1",
    name: "Tropical",
    description:
      "Beach / jungle / mangrove biomes. Install for a tropical island map, jungle exploration, or coastal adventure theme.",
    tags: ["tropical", "jungle", "beach", "warm", "humid", "content-pack"],
    packVersion: "1.0.0",
    biomes: TROPICAL_BIOMES,
    assetPackDeps: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    terrainHeightmapPreset: {
      id: "tropical-atoll",
      name: "Tropical atoll",
      description:
        "Smaller landmass with lower peaks and wildly irregular coastline — atoll-like silhouette with many bays and inlets. Lower max height keeps mountains absent; high edge noise gives the coast its irregular shape.",
      params: {
        terrain: { maxHeight: 30, waterThreshold: 12 },
        island: {
          enabled: true,
          maxWorldSizeTiles: 800,
          falloffTiles: 3,
          edgeNoiseScale: 0.012,
          edgeNoiseStrength: 0.28,
        },
      },
    },
    vegetationByBiome: {
      tropical_beach: {
        enabled: true,
        trees: {
          tree_palm: {
            weight: 80,
            waterAffinity: 0.9,
            waterSearchRadius: 80,
            waterMaxDistance: 60,
          },
          tree_banana: {
            weight: 20,
            waterAffinity: 0.7,
            waterSearchRadius: 100,
            waterMaxDistance: 80,
          },
        },
        density: 25,
        minSpacing: 6,
        clustering: true,
        clusterSize: 15,
        clusterRadius: 60,
        clusterSpacing: 50,
        scaleVariation: [0.9, 1.3],
        maxSlope: 0.8,
      },
      jungle: {
        enabled: true,
        trees: {
          tree_palm: { weight: 35 },
          tree_banana: { weight: 35 },
          tree_general: { weight: 15 },
          tree_eucalyptus: { weight: 15, maxHeight: 50 },
        },
        density: 80,
        minSpacing: 4,
        clustering: true,
        clusterSize: 50,
        clusterRadius: 100,
        clusterSpacing: 60,
        scaleVariation: [1.0, 1.4],
        maxSlope: 1.5,
      },
      mangrove: {
        enabled: true,
        trees: {
          tree_palm: {
            weight: 40,
            waterAffinity: 1.0,
            waterSearchRadius: 60,
            waterMaxDistance: 30,
          },
          tree_banana: {
            weight: 30,
            waterAffinity: 0.9,
            waterSearchRadius: 60,
            waterMaxDistance: 40,
          },
          tree_dead: { weight: 30 },
        },
        density: 45,
        minSpacing: 5,
        clustering: true,
        clusterSize: 25,
        clusterRadius: 70,
        clusterSpacing: 50,
        scaleVariation: [0.9, 1.1],
        maxSlope: 0.5,
      },
      palm_grove: {
        enabled: true,
        trees: {
          tree_palm: { weight: 90 },
          tree_banana: { weight: 10 },
        },
        density: 60,
        minSpacing: 5,
        clustering: true,
        clusterSize: 30,
        clusterRadius: 80,
        clusterSpacing: 60,
        scaleVariation: [1.0, 1.3],
        maxSlope: 1.0,
      },
      lagoon: {
        enabled: true,
        trees: {
          tree_palm: {
            weight: 70,
            waterAffinity: 1.0,
            waterSearchRadius: 50,
            waterMaxDistance: 25,
          },
          tree_banana: {
            weight: 30,
            waterAffinity: 0.8,
            waterSearchRadius: 60,
            waterMaxDistance: 40,
          },
        },
        density: 15,
        minSpacing: 8,
        clustering: false,
        scaleVariation: [0.9, 1.2],
        maxSlope: 0.6,
      },
    },
    // Phase 5 / C3 prep — tropical species declarations. modelRefs
    // point at the existing Hyperia trees pack (the only published
    // tree GLBs today) but the species IDENTITY is tropical. When
    // per-theme tree GLBs ship (a future content authoring
    // session), only the modelRefs change; ids and metadata stay.
    vegetationSpecies: [
      {
        id: "tropical_palm",
        name: "Coconut Palm",
        description:
          "Tall single-trunk palm with arching fronds. Defines the tropical-beach silhouette.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_palm",
        baseScale: 1.1,
        scaleVariation: [0.9, 1.4],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.5,
        tags: ["tropical", "palm", "coastal"],
      },
      {
        id: "tropical_banana",
        name: "Banana Tree",
        description:
          "Short broad-leaved trunk. Clumps near water in jungle and lagoon biomes.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_banana",
        baseScale: 0.9,
        scaleVariation: [0.8, 1.1],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.4,
        tags: ["tropical", "fruit", "humid"],
      },
      {
        id: "tropical_jungle_canopy",
        name: "Jungle Canopy Tree",
        description:
          "Tall broadleaf tree forming dense canopy in jungle and palm-grove biomes.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_general",
        baseScale: 1.2,
        scaleVariation: [1.0, 1.5],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.6,
        tags: ["tropical", "jungle", "canopy"],
      },
      {
        id: "tropical_eucalyptus",
        name: "Tropical Eucalyptus",
        description:
          "Tall slender canopy filler used in jungle and mangrove biomes for vertical variety.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_eucalyptus",
        baseScale: 1.0,
        scaleVariation: [0.9, 1.3],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.5,
        maxHeight: 50,
        tags: ["tropical", "jungle"],
      },
      {
        id: "tropical_dead_mangrove",
        name: "Dead Mangrove Trunk",
        description:
          "Bare trunk used in mangrove + lagoon edges for atmospheric variety.",
        category: "tree",
        modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_dead",
        baseScale: 0.85,
        scaleVariation: [0.7, 1.0],
        randomRotation: true,
        alignToNormal: false,
        yOffset: 0,
        maxSlope: 0.4,
        tags: ["tropical", "mangrove", "atmospheric"],
      },
    ],
  },
  {
    manifestId: "@hyperforge/content-pack-desert-v1",
    name: "Desert",
    description:
      "Sand / mesa / oasis biomes. Install for a desert ruins map, dune crossing, or arid wasteland theme.",
    tags: ["desert", "sand", "arid", "mesa", "warm", "content-pack"],
    packVersion: "1.0.0",
    biomes: DESERT_BIOMES,
    assetPackDeps: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    terrainHeightmapPreset: {
      id: "desert-mesa-flatlands",
      name: "Desert mesa flatlands",
      description:
        "Wide flat landmass with sharp mesa relief — low base elevation but with dramatic mesa peaks. Larger world size; smoother edges (deserts don't have rocky coasts).",
      params: {
        terrain: { maxHeight: 45, waterThreshold: 10 },
        island: {
          enabled: true,
          maxWorldSizeTiles: 1300,
          falloffTiles: 5,
          edgeNoiseScale: 0.006,
          edgeNoiseStrength: 0.1,
        },
      },
    },
    vegetationByBiome: {
      sand_dune: {
        enabled: true,
        trees: {
          tree_dead: { weight: 100 },
        },
        density: 2,
        minSpacing: 20,
        clustering: false,
        scaleVariation: [0.7, 1.0],
        maxSlope: 1.5,
      },
      mesa: {
        enabled: true,
        trees: {
          tree_dead: { weight: 80 },
          tree_general: { weight: 20, maxHeight: 40 },
        },
        density: 4,
        minSpacing: 18,
        clustering: false,
        scaleVariation: [0.8, 1.0],
        maxSlope: 0.8,
      },
      salt_flat: {
        enabled: false,
        trees: {},
        density: 0,
        minSpacing: 25,
        clustering: false,
      },
      oasis: {
        enabled: true,
        trees: {
          tree_palm: {
            weight: 70,
            waterAffinity: 1.0,
            waterSearchRadius: 40,
            waterMaxDistance: 20,
          },
          tree_banana: {
            weight: 30,
            waterAffinity: 0.9,
            waterSearchRadius: 50,
            waterMaxDistance: 30,
          },
        },
        density: 35,
        minSpacing: 5,
        clustering: true,
        clusterSize: 12,
        clusterRadius: 40,
        clusterSpacing: 30,
        scaleVariation: [0.9, 1.2],
        maxSlope: 0.6,
      },
      badlands: {
        enabled: true,
        trees: {
          tree_dead: { weight: 100 },
        },
        density: 5,
        minSpacing: 16,
        clustering: false,
        scaleVariation: [0.7, 1.0],
        maxSlope: 2.0,
      },
    },
  },
  {
    manifestId: "@hyperforge/content-pack-volcanic-v1",
    name: "Volcanic",
    description:
      "Lava / ash / basalt biomes. Install for a volcanic wasteland map, eruption survival, or lava-cavern theme.",
    tags: ["volcanic", "lava", "fire", "ash", "hostile", "content-pack"],
    packVersion: "1.0.0",
    biomes: VOLCANIC_BIOMES,
    assetPackDeps: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    terrainHeightmapPreset: {
      id: "volcanic-rugged-peak",
      name: "Volcanic central peak",
      description:
        "Mid-sized landmass with one dominant tall central peak and rugged slopes. Tall max height (volcano cone); mid-strength edge noise (rocky coasts, lava-cooled flows).",
      params: {
        terrain: { maxHeight: 75, waterThreshold: 14 },
        island: {
          enabled: true,
          maxWorldSizeTiles: 900,
          falloffTiles: 4,
          edgeNoiseScale: 0.007,
          edgeNoiseStrength: 0.18,
        },
      },
    },
    vegetationByBiome: {
      lava_field: {
        enabled: false,
        trees: {},
        density: 0,
        minSpacing: 20,
        clustering: false,
      },
      ash_plain: {
        enabled: true,
        trees: {
          tree_dead: { weight: 100 },
        },
        density: 6,
        minSpacing: 14,
        clustering: false,
        scaleVariation: [0.7, 1.0],
        maxSlope: 1.2,
      },
      basalt_peak: {
        enabled: true,
        trees: {
          tree_dead: { weight: 80, minHeight: 40 },
          tree_pineDead: { weight: 20, minHeight: 50 },
        },
        density: 3,
        minSpacing: 16,
        clustering: false,
        scaleVariation: [0.7, 1.0],
        maxSlope: 2.0,
      },
      sulfur_pool: {
        enabled: false,
        trees: {},
        density: 0,
        minSpacing: 25,
        clustering: false,
      },
      obsidian_flow: {
        enabled: true,
        trees: {
          tree_dead: { weight: 100 },
        },
        density: 4,
        minSpacing: 18,
        clustering: false,
        scaleVariation: [0.7, 0.9],
        maxSlope: 1.6,
      },
    },
  },
  {
    manifestId: "@hyperforge/content-pack-wetland-v1",
    name: "Wetland",
    description:
      "Marsh / swamp / bog / delta biomes. Install for a swamp adventure map, river-delta survival, or wetland exploration theme.",
    tags: ["wetland", "swamp", "marsh", "humid", "content-pack"],
    packVersion: "1.0.0",
    biomes: WETLAND_BIOMES,
    assetPackDeps: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    terrainHeightmapPreset: {
      id: "wetland-low-delta",
      name: "Wetland delta",
      description:
        "Low flat landmass with very high water level and many water cuts — feels like a river delta or expansive marsh. Very low max height; high edge noise strength carves the coast into many fingers.",
      params: {
        terrain: { maxHeight: 22, waterThreshold: 16 },
        island: {
          enabled: true,
          maxWorldSizeTiles: 950,
          falloffTiles: 3,
          edgeNoiseScale: 0.014,
          edgeNoiseStrength: 0.32,
        },
      },
    },
    vegetationByBiome: {
      marsh: {
        enabled: true,
        trees: {
          tree_dead: { weight: 50 },
          tree_general: {
            weight: 30,
            waterAffinity: 0.7,
            waterSearchRadius: 50,
            waterMaxDistance: 30,
          },
          tree_eucalyptus: { weight: 20, maxHeight: 30 },
        },
        density: 30,
        minSpacing: 6,
        clustering: true,
        clusterSize: 18,
        clusterRadius: 70,
        clusterSpacing: 60,
        scaleVariation: [0.9, 1.2],
        maxSlope: 0.4,
      },
      swamp: {
        enabled: true,
        trees: {
          tree_dead: { weight: 60 },
          tree_general: {
            weight: 25,
            waterAffinity: 0.8,
            waterSearchRadius: 40,
            waterMaxDistance: 25,
          },
          tree_eucalyptus: { weight: 15 },
        },
        density: 50,
        minSpacing: 5,
        clustering: true,
        clusterSize: 25,
        clusterRadius: 80,
        clusterSpacing: 60,
        scaleVariation: [0.9, 1.3],
        maxSlope: 0.5,
      },
      bog: {
        enabled: true,
        trees: {
          tree_dead: { weight: 80 },
          tree_general: { weight: 20 },
        },
        density: 20,
        minSpacing: 7,
        clustering: false,
        scaleVariation: [0.8, 1.1],
        maxSlope: 0.4,
      },
      fen: {
        enabled: true,
        trees: {
          tree_dead: { weight: 40 },
          tree_general: { weight: 40 },
          tree_bamboo: { weight: 20 },
        },
        density: 35,
        minSpacing: 5,
        clustering: true,
        clusterSize: 15,
        clusterRadius: 50,
        clusterSpacing: 40,
        scaleVariation: [0.9, 1.2],
        maxSlope: 0.5,
      },
      river_delta: {
        enabled: true,
        trees: {
          tree_palm: {
            weight: 30,
            waterAffinity: 1.0,
            waterSearchRadius: 50,
            waterMaxDistance: 25,
          },
          tree_banana: {
            weight: 20,
            waterAffinity: 0.9,
            waterSearchRadius: 60,
            waterMaxDistance: 35,
          },
          tree_dead: { weight: 30 },
          tree_general: { weight: 20 },
        },
        density: 40,
        minSpacing: 5,
        clustering: true,
        clusterSize: 20,
        clusterRadius: 60,
        clusterSpacing: 45,
        scaleVariation: [0.9, 1.2],
        maxSlope: 0.4,
      },
    },
  },
]);

function buildManifest(pack: BuiltinPack): Record<string, unknown> {
  const m: Record<string, unknown> = {
    version: 1,
    id: pack.manifestId,
    name: pack.name,
    description: pack.description,
    packVersion: pack.packVersion,
    author: { name: "HyperForge" },
    license: "UNLICENSED",
    tags: pack.tags,
    biomes: pack.biomes,
  };
  // Themed packs ship a heightmap preset; the dialog reads it
  // when generating procgen config so each theme produces a
  // visibly different island shape (atoll for tropical,
  // mountain range for arctic, etc.).
  if (pack.terrainHeightmapPreset) {
    m.terrainHeightmapPresets = [pack.terrainHeightmapPreset];
  }
  // Per-biome vegetation overrides — keys match the pack's biome
  // ids. The dialog deep-merges these into procgen's vegetation
  // config so themed biomes scatter theme-appropriate species
  // (palms on tropical_beach, pines on frozen_tundra, etc.).
  // Phase C3 of `PLAN_AAA_CONTENT_SYSTEM.md` proper will replace
  // this with content-pack-contributed `vegetationSpecies` +
  // `vegetationDensityRules`; this is the lower-friction first
  // cut that uses today's static vegetation manifest as the
  // species source.
  if (pack.vegetationByBiome) {
    m.vegetationByBiome = pack.vegetationByBiome;
  }
  // Asset packs this content pack needs installed alongside it.
  // Replaces the previous unconditional Hyperia trees install in
  // the dialog — strict-catalog: a project picking
  // `content-pack-tropical-v1` only gets the asset packs
  // tropical declares, nothing Hyperia-shaped sneaks in unless
  // tropical itself depends on it.
  if (pack.assetPackDeps && pack.assetPackDeps.length > 0) {
    m.assetPackDeps = pack.assetPackDeps;
  }
  // Proper `vegetationSpecies` array — manifest-schema shape.
  // The contentRegistry consumer side already exists
  // (`setContentPackContent({ vegetationSpecies: [...] })` + the
  // `getActiveVegetationSpecies` reader). Procgen worker
  // consumer is the Phase C3 follow-up; today this populates
  // the registry so the studio's pack browser + agent's
  // catalog introspection can surface real species data.
  if (pack.vegetationSpecies && pack.vegetationSpecies.length > 0) {
    m.vegetationSpecies = pack.vegetationSpecies;
  }
  return m;
}

/**
 * Idempotent UPSERT for one built-in pack. Re-runs replace
 * the manifest if `packVersion` changed; otherwise the row
 * stays. Visibility forced to `public` so every team sees the
 * pack in the marketplace browse.
 */
async function upsertOne(pool: Pool, pack: BuiltinPack): Promise<void> {
  const sql = `
    INSERT INTO asset_packs
      (team_id, manifest_id, manifest, source, version, visibility,
       published_at, created_at, updated_at)
    VALUES
      (NULL, $1, $2::jsonb, 'built-in', $3, 'public', now(), now(), now())
    ON CONFLICT (manifest_id) DO UPDATE SET
      manifest = EXCLUDED.manifest,
      version = EXCLUDED.version,
      visibility = 'public',
      published_at = COALESCE(asset_packs.published_at, EXCLUDED.published_at),
      updated_at = now();
  `;
  await pool.query(sql, [
    pack.manifestId,
    JSON.stringify(buildManifest(pack)),
    pack.packVersion,
  ]);
}

/**
 * Upsert every built-in content pack. Called once on server
 * boot from `api-elysia.ts`; safe to call repeatedly.
 *
 * Soft-fails per-pack so one broken manifest doesn't block the
 * rest. Returns counts so the caller can log a single summary
 * line.
 */
export async function upsertBuiltinContentPacks(
  pool: Pool,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const pack of BUILTIN_CONTENT_PACKS) {
    try {
      await upsertOne(pool, pack);
      ok += 1;
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[builtins/content-packs] upsert failed for ${pack.manifestId}:`,
        err,
      );
    }
  }
  return { ok, failed };
}
