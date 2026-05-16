/**
 * Plugin manifest schema.
 *
 * Phase I1 / Step 10 of the World Studio AAA plan — declarative plugin
 * metadata that `@hyperforge/gameplay-framework` consumes when loading
 * a `HyperforgePlugin`. The manifest lives alongside the plugin code
 * (`plugin.json`) and describes identity, lifecycle hooks, dependency
 * graph, and the registration surface (systems, entities, widgets,
 * schemas, palette categories, toolbar tools) the plugin contributes.
 *
 * The runtime `PluginLoader` (separate follow-up) validates this
 * manifest, resolves the dependency graph, and calls lifecycle
 * callbacks (onLoad/onEnable/onDisable) against the `PluginContext`
 * object from `@hyperforge/gameplay-framework`.
 *
 * Manifest is explicitly NOT an array — each plugin ships its own
 * `plugin.json`. The registry (per-install list of enabled plugins)
 * is a separate concern, tracked on the project settings side.
 */

import { z } from "zod";

/**
 * Semver-ish version string — conservative regex covering `X.Y.Z`
 * plus optional pre-release and build metadata. Not a full SemVer-2
 * parser because authors rarely need the complex cases and the
 * runtime does a string-compare-to-range using a real library.
 */
const SemVer = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "Plugin version must look like '1.2.3' (SemVer)",
  );

/**
 * Plugin id — reverse-domain-style slug, enforced lowercase +
 * dot-separated. Mirrors the Unreal plugin naming convention.
 */
const PluginId = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/,
    "Plugin id must look like 'com.studio.my-plugin' (reverse-domain slug)",
  );

export const PluginDependencySchema = z.object({
  id: PluginId,
  /** npm-semver range, e.g. `"^1.2.0"`, `">=2 <3"`, `"latest"`. */
  versionRange: z.string().min(1),
  /**
   * Soft dependencies only log a warning when missing; hard deps
   * prevent the plugin from loading. Default is hard.
   */
  optional: z.boolean().default(false),
});
export type PluginDependency = z.infer<typeof PluginDependencySchema>;

/**
 * What surface the plugin contributes. Counts only — the actual
 * registration happens in code via PluginContext. The manifest
 * exists so the editor's Plugin Browser can surface a summary before
 * the plugin is enabled.
 */
/**
 * Layer B of the AI ↔ assets ↔ plugins integration plan.
 * One entry describing a placement type the plugin's runtime
 * actually handles — e.g. the Hyperia plugin contributes a
 * `shopkeeper` NPC type whose `storeId` field its store system
 * reads at click-interact time.
 *
 * The agent's `LIST_ENTITY_TYPES` action surfaces this catalog so
 * the AI can pick a `type` that has gameplay backing it instead
 * of guessing a string. Validators (future) can reject placements
 * whose type isn't supported by any installed plugin.
 */
/**
 * R3.P3 of `PLAN_HYPERIA_DECOUPLING.md` — plugin-contributable
 * biome definition. The asset-forge editor's
 * `GAME_BIOME_DEFINITIONS` was hardcoded to Hyperia's 3 biomes
 * (tundra / forest / canyon); this contribution surface lets a
 * plugin declare additional biomes (desert, jungle, swamp, etc.)
 * that aggregate into the editor's biome registry at project
 * load time.
 *
 * Engine-side `BiomeType` enum at `shared/src/world/world.d.ts`
 * stays as a deprecated alias during the migration window —
 * runtime code that branches on `"forest"` etc. keeps
 * working until a follow-up cut migrates it to a
 * `BiomeId = string` registry lookup.
 */
export const BiomeContributionSchema = z.object({
  /** Stable identifier (e.g. `desert`, `tropical_jungle`). Used
   * as the key in `GAME_BIOME_DEFINITIONS` after aggregation. */
  id: z.string().min(1),
  /** Human-friendly name for editor surfaces. */
  name: z.string().min(1),
  /** Surface color as a 24-bit hex int (e.g. `0xe8e4e0`). The
   * editor uses this for biome painting + terrain coloring. */
  color: z.number().int().min(0).max(0xffffff),
  /** Per-biome height noise multiplier. 1.0 = baseline; >1
   * exaggerates relief, <1 flattens. */
  terrainMultiplier: z.number().default(1),
  /** Difficulty tier surfaced to mob-spawn rules + the agent's
   * placement guidance. 0 = safe, higher = more hostile. */
  difficultyLevel: z.number().int().min(0).default(0),
  /** Allowed normalized height range `[min, max]` — biome only
   * spawns where elevation falls within this band. */
  heightRange: z.tuple([z.number(), z.number()]),
  /** Max slope the biome appears on (steeper terrain remains
   * uncolored / falls back to the default biome). */
  maxSlope: z.number().default(1.5),
  /** Multiplier on procgen resource placement density inside
   * this biome (1 = default). */
  resourceDensity: z.number().default(1),
});
export type BiomeContribution = z.infer<typeof BiomeContributionSchema>;

export const EntityTypeContributionSchema = z.object({
  /**
   * Which world-content schema this contribution applies to.
   * Mirrors the four placement schemas in
   * `@hyperforge/manifest-schema/world-areas`.
   */
  kind: z.enum(["npc", "mobSpawn", "resource", "station"]),
  /**
   * Value of the `type` field on the placement (e.g. `shopkeeper`,
   * `questgiver`, `goblin_aggressive`, `tree`, `anvil`). The
   * placement's `type` is matched against this string.
   */
  type: z.string().min(1),
  /** One-line behavior summary surfaced to the AI + plugin browser. */
  description: z.string().min(1),
  /**
   * Schema-extra fields this entity type expects. Validators
   * surface a warning when a placement of this type omits one of
   * these. Names match the field names on the placement schema
   * (e.g. `["storeId"]` for a shopkeeper).
   */
  requiredFields: z.array(z.string().min(1)).default([]),
  /**
   * Asset pack `type` values this entity type is most-naturally
   * paired with. The agent uses this hint to filter
   * `availableAssets` to plausible candidates. E.g. a `shopkeeper`
   * entity type accepts `["character"]`; a `tree` resource accepts
   * `["prop"]`.
   */
  acceptedAssetTypes: z.array(z.string().min(1)).default([]),
});
export type EntityTypeContribution = z.infer<
  typeof EntityTypeContributionSchema
>;

export const PluginContributionsSchema = z.object({
  systems: z.array(z.string().min(1)).default([]),
  entities: z.array(z.string().min(1)).default([]),
  widgets: z.array(z.string().min(1)).default([]),
  manifestSchemas: z.array(z.string().min(1)).default([]),
  paletteCategories: z.array(z.string().min(1)).default([]),
  toolbarTools: z.array(z.string().min(1)).default([]),
  commands: z.array(z.string().min(1)).default([]),
  /**
   * Layer B — gameplay-typed entity contributions. Each entry
   * tells the agent that a placement of this `kind` + `type`
   * will be handled by this plugin's runtime systems. Empty by
   * default — old plugins keep working unchanged.
   */
  entityTypes: z.array(EntityTypeContributionSchema).default([]),
  /**
   * R3.P3 — biomes the plugin contributes to the procgen
   * pipeline. Asset-forge aggregates these across active
   * plugins into `GAME_BIOME_DEFINITIONS`. Empty by default;
   * legacy plugins keep working unchanged (engine continues to
   * ship Hyperia's tundra/forest/canyon as the engine-default
   * set until a follow-up cut moves those into the Hyperscape
   * plugin's contributions).
   */
  biomes: z.array(BiomeContributionSchema).default([]),
});
export type PluginContributions = z.infer<typeof PluginContributionsSchema>;

export const PluginAuthorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});
export type PluginAuthor = z.infer<typeof PluginAuthorSchema>;

/**
 * SPDX license identifier or `"UNLICENSED"`. Free-form to avoid
 * pinning the full SPDX list; editor surfaces this verbatim.
 */
const LicenseId = z.string().min(1);

export const PluginManifestSchema = z
  .object({
    id: PluginId,
    name: z.string().min(1),
    version: SemVer,
    description: z.string().default(""),
    /** Module entry point relative to plugin root (e.g. `"./dist/index.js"`). */
    entry: z.string().min(1),
    author: PluginAuthorSchema,
    license: LicenseId.default("UNLICENSED"),
    homepage: z.string().url().optional(),
    repository: z.string().url().optional(),
    /** Plugin-API semver this plugin targets. */
    hyperforgeApi: SemVer,
    /** Required before this plugin activates. */
    dependencies: z.array(PluginDependencySchema).default([]),
    /** Plugins this plugin must load AFTER if both are present. */
    loadAfter: z.array(PluginId).default([]),
    /**
     * Asset pack manifest ids this plugin's content depends on
     * (Phase AP8 of `PLAN_ASSET_PACKS.md`). Each entry is an
     * npm-style pack id (e.g. `"@hyperforge/asset-pack-hyperia-v1"`).
     * The studio surfaces unmet entries when the plugin is
     * installed onto a project, and the agent's
     * `PROPOSE_PLUGIN_SET` warns if a chosen plugin needs packs
     * the project hasn't installed.
     *
     * Empty / omitted = self-contained (the plugin ships its own
     * placeholders or doesn't need 3D content). Multiple entries
     * combine with AND.
     */
    requiresAssetPacks: z.array(z.string().min(1)).default([]),
    /**
     * Enabled-by-default flag the editor respects on first install.
     * Users can toggle it; this is only the factory default.
     */
    enabledByDefault: z.boolean().default(true),
    contributions: PluginContributionsSchema.default({
      systems: [],
      entities: [],
      widgets: [],
      manifestSchemas: [],
      paletteCategories: [],
      toolbarTools: [],
      commands: [],
      entityTypes: [],
      biomes: [],
    }),
    /** Free-form tags for Plugin Browser filtering. */
    tags: z.array(z.string().min(1)).default([]),
  })
  .refine(({ id, dependencies }) => dependencies.every((d) => d.id !== id), {
    message: "plugin cannot declare itself as a dependency",
  })
  .refine(({ id, loadAfter }) => loadAfter.every((lid) => lid !== id), {
    message: "plugin cannot declare itself in `loadAfter`",
  })
  .refine(
    ({ dependencies }) =>
      new Set(dependencies.map((d) => d.id)).size === dependencies.length,
    { message: "dependency ids must be unique" },
  );
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Validate a `plugin.json` blob into a typed manifest. Mirrors the
 * `validateProject` / `validateUIPackManifest` pattern so callers
 * get structured `{ ok, manifest }` / `{ ok: false, issues }`
 * results without needing to handle Zod errors directly.
 *
 * Phase B0'.D of `PLAN_PROJECT_AS_DATA.md` — used by
 * `PluginRegistryService` when scanning workspace + node_modules
 * for plugins.
 */
export interface PluginManifestValidationOk {
  readonly ok: true;
  readonly manifest: PluginManifest;
}
export interface PluginManifestValidationFail {
  readonly ok: false;
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
}
export function validatePluginManifest(
  raw: unknown,
): PluginManifestValidationOk | PluginManifestValidationFail {
  const result = PluginManifestSchema.safeParse(raw);
  if (result.success) return { ok: true, manifest: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
    })),
  };
}
