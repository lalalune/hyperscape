/**
 * Project schema — the unit of customization in HyperForge.
 *
 * A project declares its terrain (procgen config), gameplay surface
 * (plugin set), and authored content (NPCs, zones, quests, UI pack).
 * World Studio's PIE plays a project. Production deployments
 * (e.g. `localhost:3333`) are published deploys of one specific
 * project (Hyperia, today).
 *
 * Phase B0'.A of `PLAN_PROJECT_AS_DATA.md`. This is the typed
 * record that replaces the opaque `worldData` jsonb blob in
 * `world_projects` table. After the migration:
 *
 *   - `config` holds procgen knobs (terrain shape, biomes, etc.)
 *   - `plugins` lists the PluginIds installed by PIE on Play
 *   - `worldContent` holds authored content layered on top of the
 *     plugin contributions
 *
 * Templates are saved Project values. Two seeded templates:
 *
 *   - **blank**: `{ config: minimal, plugins: [], worldContent: {} }`
 *     → PIE Play renders terrain only, empty viewport.
 *   - **hyperia**: `{ config: HYPERIA_GAME_WORLD_CONFIG, plugins:
 *     ["@hyperforge/hyperscape"], worldContent: <Hyperia's authored
 *     data> }` → PIE Play matches `localhost:3333`.
 *
 * Note on `config`: the procgen `WorldCreationConfig` lives in
 * `packages/asset-forge` as a TypeScript interface (not a Zod
 * schema). For B0'.A we accept the config shape as a permissive
 * record; the full Zod migration of procgen is a follow-up.
 *
 * Note on `worldContent.uiPack`: `UIPackManifest` lives in
 * `@hyperforge/ui-framework`, not here, so we accept its presence
 * as `unknown` and the host validates with `validateUIPackManifest`.
 */

import { z } from "zod";

import { WorldAreaSchema } from "./world-areas.js";
import { WorldAreaNPCSchema, WorldAreaMobSpawnSchema } from "./world-areas.js";
import { QuestSchema } from "./quests.js";

/** Plugin id — matches an entry in the plugin contribution registry. */
export const ProjectPluginIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^@?[a-z0-9][a-z0-9-_./]*$/i, {
    message: "Plugin id must look like an npm-style package name",
  });
export type ProjectPluginId = z.infer<typeof ProjectPluginIdSchema>;

// ============================================================
// Procgen sub-config schemas (D1 hardening)
//
// These mirror the public shape of `WorldCreationConfig` from
// `packages/asset-forge/src/components/WorldBuilder/types.ts` and
// `BiomeConfig` / `IslandConfig` / `ShorelineConfig` /
// `TerrainNoiseConfig` from `packages/procgen/src/terrain/types.ts`.
//
// Top-level keys are strict so the agent's `PROPOSE_TERRAIN_CONFIG`
// can't invent fields like `terrainStyle` or `biomeMode` that
// procgen would silently drop. Nested objects use `.passthrough()`
// so engine-side knobs the agent doesn't need to know about
// (explicit biome centers, vegetation-zone pre-baked data, etc.)
// continue to round-trip without changes.
// ============================================================

// All sub-fields are optional: procgen fills defaults for missing
// fields, and agent emissions are typically partial ("change the
// seed" / "make biomes denser"). Strictness lives at the schema's
// known-key set — the agent can't introduce new top-level keys
// because the parent shape is closed; per-sub-field type checking
// catches `seed: "42"` (string) instead of number.

const NoiseLayerConfigSchema = z
  .object({
    scale: z.number().optional(),
    weight: z.number().optional(),
    octaves: z.number().int().positive().optional(),
    persistence: z.number().optional(),
    lacunarity: z.number().optional(),
  })
  .passthrough();

const TerrainNoiseConfigSchema = z
  .object({
    continent: NoiseLayerConfigSchema.optional(),
    ridge: NoiseLayerConfigSchema.optional(),
    hill: NoiseLayerConfigSchema.optional(),
    erosion: NoiseLayerConfigSchema.optional(),
    detail: NoiseLayerConfigSchema.optional(),
  })
  .passthrough();

const TerrainSubConfigSchema = z
  .object({
    tileSize: z.number().positive().optional(),
    /**
     * Number of tiles per side. Total tiles = worldSize².
     *
     * Capped at 200 (40,000 tiles). Larger values overwhelm the
     * tile streamer + cause the render loop to thrash, which has
     * been observed to trigger React's "Maximum update depth
     * exceeded" guard. The agent has no built-in sense of scale,
     * so without this cap a careless `worldSize: 512` (262k tiles)
     * lands in the project and the studio becomes unusable.
     *
     * Recommended values: 50 (5km², default sandbox), 100
     * (10km², shipped Hyperia game), 150-200 (large MMO).
     */
    worldSize: z.number().int().positive().max(200).optional(),
    tileResolution: z.number().int().positive().optional(),
    maxHeight: z.number().nonnegative().optional(),
    waterThreshold: z.number().optional(),
  })
  .passthrough();

const BiomeConfigSchema = z
  .object({
    gridSize: z.number().int().positive().optional(),
    jitter: z.number().min(0).max(1).optional(),
    minInfluence: z.number().nonnegative().optional(),
    maxInfluence: z.number().nonnegative().optional(),
    gaussianCoeff: z.number().optional(),
    boundaryNoiseScale: z.number().optional(),
    boundaryNoiseAmount: z.number().optional(),
  })
  .passthrough();

const IslandConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    maxWorldSizeTiles: z.number().int().positive().optional(),
    falloffTiles: z.number().int().nonnegative().optional(),
    edgeNoiseScale: z.number().optional(),
    edgeNoiseStrength: z.number().optional(),
  })
  .passthrough();

const ShorelineConfigSchema = z
  .object({
    waterLevelNormalized: z.number().min(0).max(1).optional(),
    threshold: z.number().min(0).max(1).optional(),
    colorStrength: z.number().min(0).max(1).optional(),
    minSlope: z.number().nonnegative().optional(),
    slopeSampleDistance: z.number().nonnegative().optional(),
    landBand: z.number().nonnegative().optional(),
    landMaxMultiplier: z.number().optional(),
    underwaterBand: z.number().nonnegative().optional(),
    underwaterDepthMultiplier: z.number().optional(),
  })
  .passthrough();

const TownGenerationConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    targetCount: z.number().int().nonnegative().optional(),
    minSpacing: z.number().nonnegative().optional(),
  })
  .passthrough();

const RoadGenerationConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    width: z.number().nonnegative().optional(),
  })
  .passthrough();

/**
 * The procgen config a project declares. Phase D1 hardening — top-
 * level keys are strict so the agent can't hallucinate field
 * names; nested sub-configs use `.passthrough()` so engine-only
 * knobs round-trip. The agent's `PROPOSE_TERRAIN_CONFIG` validates
 * against this; invalid fields are reported back as Zod issues so
 * the agent can fix and resubmit.
 *
 * Source of truth for the underlying types lives in
 * `packages/asset-forge/src/components/WorldBuilder/types.ts`
 * (`WorldCreationConfig`) and `packages/procgen/src/terrain/types.ts`
 * (sub-configs). The fields enumerated here mirror those — when
 * either source adds a new top-level key, this schema must too.
 */
export const ProjectConfigSchema = z
  .object({
    seed: z.number(),
    preset: z.string().nullable().optional(),
    useGamePipeline: z.boolean().optional(),
    terrain: TerrainSubConfigSchema.optional(),
    noise: TerrainNoiseConfigSchema.optional(),
    biomes: BiomeConfigSchema.optional(),
    island: IslandConfigSchema.optional(),
    shoreline: ShorelineConfigSchema.optional(),
    towns: TownGenerationConfigSchema.optional(),
    roads: RoadGenerationConfigSchema.optional(),
    vegetation: z.record(z.string(), z.unknown()).optional(),
  })
  // Strict at the top so the agent gets a Zod error for keys it
  // hallucinated (`terrainStyle` etc.) instead of silently
  // dropping them. Sub-objects are still `passthrough` so engine
  // knobs round-trip.
  .strict();
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Authored content layered on top of the plugin contributions.
 * Every field is optional — a blank project's `worldContent` is
 * `{}`, a Hyperia project's `worldContent` is the full set of
 * Hyperia's authored NPCs/zones/quests imported from
 * `world-areas.json` etc.
 */
export const ProjectWorldContentSchema = z
  .object({
    npcs: z.array(WorldAreaNPCSchema).optional(),
    zones: z.array(WorldAreaSchema).optional(),
    spawns: z.array(WorldAreaMobSpawnSchema).optional(),
    quests: z.array(QuestSchema).optional(),
    /**
     * UI pack — `UIPackManifest` from `@hyperforge/ui-framework`.
     * Validated by host via `validateUIPackManifest`; we accept
     * `unknown` here to avoid pulling ui-framework as a dependency
     * of `manifest-schema`.
     */
    uiPack: z.unknown().optional(),
  })
  .passthrough();
export type ProjectWorldContent = z.infer<typeof ProjectWorldContentSchema>;

/**
 * The full project record. `schemaVersion` lets later migrations
 * detect old shapes; bump on incompatible changes.
 */
export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /**
   * Template the project was created from. Useful for re-imports,
   * "load Hyperia sample" affordances, and provenance. Optional
   * because not every project originates from a template.
   */
  templateId: z.string().min(1).max(100).optional(),
  /**
   * Project-shape schema version. B0'.A introduces v1. Bump on
   * incompatible shape changes; migrations gate on this field.
   */
  schemaVersion: z.literal(1),
  config: ProjectConfigSchema,
  plugins: z.array(ProjectPluginIdSchema),
  /**
   * Asset packs this project has installed (Phase AP1+ of
   * `PLAN_ASSET_PACKS.md`). Each id resolves to an `asset_packs`
   * record. The studio's Asset Library shows the union of these
   * packs' catalogs; nothing here = blank library.
   *
   * Defaulted to empty so existing project rows decode without a
   * backfill. Migration `0009_asset_packs.sql` adds the column.
   */
  assetPacks: z.array(ProjectPluginIdSchema).default([]),
  worldContent: ProjectWorldContentSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

/**
 * Validate an unknown into a Project. Returns `{ ok: true, project }`
 * on success, or `{ ok: false, issues }` with human-readable issue
 * paths on failure. Mirrors the pattern used by
 * `validateUIPackManifest`.
 */
export interface ProjectValidationOk {
  readonly ok: true;
  readonly project: Project;
}
export interface ProjectValidationFail {
  readonly ok: false;
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
}
export function validateProject(
  raw: unknown,
): ProjectValidationOk | ProjectValidationFail {
  const result = ProjectSchema.safeParse(raw);
  if (result.success) return { ok: true, project: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
    })),
  };
}
