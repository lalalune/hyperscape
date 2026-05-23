/**
 * `FullProjectManifest` — the runtime-ready manifest shape produced by
 * exporting a World Studio project for either PIE or Standalone Launch.
 *
 * The persistence shape (`Project` in `project.ts`) describes how authored
 * data is stored in the database. The runtime shape (`FullProjectManifest`,
 * defined here) describes how the game runtime — `packages/server` for
 * Standalone, the PIE loopback server for PIE — actually consumes that data
 * at boot.
 *
 * Decoupling rule (PLAN_AAA_UE5_PARITY Phase 0):
 *   - Editor exports a `FullProjectManifest` JSON to disk.
 *   - Game runtime reads it via `--projectManifest <path>` (Phase 0.2).
 *   - No live state push, no DB read from the runtime side.
 *
 * Hyperia is NOT the default. A manifest with empty `boot.plugins` boots an
 * empty-shell world (terrain only). Hyperia content only appears when the
 * project declares `@hyperforge/content-pack-hyperia-v1` in `boot.contentPacks`
 * and `@hyperforge/hyperscape` in `boot.plugins`.
 *
 * Shape is intentionally hybrid:
 *   - `meta` + `boot` are strict (these gate the runtime — no passthrough).
 *   - `worldConfig`, `content`, `registries` use `.passthrough()` so plugin
 *     contributions and per-game manifests round-trip verbatim without
 *     requiring every shape to be schematized in `manifest-schema` first.
 *
 * The strongly-typed inner shapes (NPCs, mobs, quests, ...) already live in
 * `worldManifestExport.ts:FullGameManifest`. Phase 0.1.2 wires the exporter
 * that builds a `FullProjectManifest` from a `Project` + the legacy
 * `FullGameManifest` payload + the project's `manifestSnapshot`.
 */

import { z } from "zod";

/**
 * Project-level metadata. Every export carries enough provenance to
 * identify which project + when, so logs and crash reports are
 * actionable.
 */
export const FullProjectManifestMetaSchema = z
  .object({
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    /** Bumped on incompatible shape changes. Migrations gate on this. */
    schemaVersion: z.literal(1),
    /** Epoch ms — when `ProjectManifestExporter.export()` produced this. */
    exportedAt: z.number().int().nonnegative(),
    /** Source template, e.g. "hyperia", "arctic-survival", "blank". */
    templateId: z.string().optional(),
  })
  .strict();

export type FullProjectManifestMeta = z.infer<
  typeof FullProjectManifestMetaSchema
>;

/**
 * Boot wiring — which plugins / content packs / asset packs the runtime
 * should load. These three lists are the entire "what game am I" signal
 * the runtime sees. An empty plugin list means a blank-canvas project
 * (terrain only).
 *
 * Order is significant for plugins: load order matches the array order so
 * contribution conflicts resolve via first-seen-wins (matches
 * `gameplay-framework/src/snapshot.ts:aggregateContributions`).
 */
export const FullProjectManifestBootSchema = z
  .object({
    plugins: z.array(z.string().min(1)),
    contentPacks: z.array(z.string().min(1)).default([]),
    assetPacks: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type FullProjectManifestBoot = z.infer<
  typeof FullProjectManifestBootSchema
>;

/**
 * World creation config — terrain seed, biome shape, towns, vegetation.
 * Passthrough so per-theme procgen overrides (heightmap presets,
 * vegetationByBiome) round-trip verbatim. Inner sub-objects are also
 * passthrough; the runtime's terrain pipeline reads only the keys it
 * understands.
 */
export const FullProjectManifestWorldConfigSchema = z
  .object({
    /** Top-level terrain seed; runtime falls back to `TERRAIN_SEED` env. */
    terrainSeed: z.number().int().optional(),
  })
  .passthrough();

export type FullProjectManifestWorldConfig = z.infer<
  typeof FullProjectManifestWorldConfigSchema
>;

/**
 * Authored content layered on top of plugin contributions. Mirrors the
 * existing `FullGameManifest` shape (defined in
 * `worldManifestExport.ts`) but kept passthrough here so we don't have
 * to duplicate the strongly-typed inner shapes. Phase 0.1.2's exporter
 * runs `exportFullGameManifest()` and slots its output into this field.
 */
export const FullProjectManifestContentSchema = z
  .object({
    buildings: z.unknown().optional(),
    npcs: z.unknown().optional(),
    mobs: z.unknown().optional(),
    bosses: z.unknown().optional(),
    quests: z.unknown().optional(),
    difficultyZones: z.unknown().optional(),
    wilderness: z.unknown().optional(),
    biomes: z.unknown().optional(),
  })
  .passthrough();

export type FullProjectManifestContent = z.infer<
  typeof FullProjectManifestContentSchema
>;

/**
 * Per-game manifest registries — the data the server normally reads
 * from static files at `packages/server/world/assets/manifests/`
 * (items, dialogue, stores, gathering, world-areas, etc.). When the
 * project's `manifestSnapshot` column is non-empty, those overrides
 * land here. Passthrough so all ~38 manifest kinds can pass through
 * without each one being modeled here first.
 */
export const FullProjectManifestRegistriesSchema = z
  .object({
    /** Item catalog override — replaces server's `items.json`. */
    items: z.unknown().optional(),
    /** NPC dialogue trees — replaces `dialogue.json`. */
    dialogue: z.unknown().optional(),
    /** Merchant inventories — replaces `stores.json`. */
    stores: z.unknown().optional(),
    /** Gathering tables — replaces `gathering/*.json`. */
    gathering: z.unknown().optional(),
    /** Bounded world areas — replaces `world-areas.json`. */
    worldAreas: z.unknown().optional(),
    /** Biome catalog — replaces `biomes.json`. */
    biomeCatalog: z.unknown().optional(),
  })
  .passthrough();

export type FullProjectManifestRegistries = z.infer<
  typeof FullProjectManifestRegistriesSchema
>;

/**
 * The complete runtime-ready manifest. This is what gets written to
 * disk by `ProjectManifestExporter` and read by the server's
 * `--projectManifest <path>` flag.
 */
export const FullProjectManifestSchema = z
  .object({
    meta: FullProjectManifestMetaSchema,
    boot: FullProjectManifestBootSchema,
    worldConfig: FullProjectManifestWorldConfigSchema,
    content: FullProjectManifestContentSchema,
    registries: FullProjectManifestRegistriesSchema,
  })
  .strict();

export type FullProjectManifest = z.infer<typeof FullProjectManifestSchema>;

/**
 * Successful validation result.
 */
export interface FullProjectManifestValidationOk {
  ok: true;
  manifest: FullProjectManifest;
}

/**
 * Failed validation result. `issues` is human-readable; the dotted
 * `path` localizes the offending field (e.g. `"boot.plugins.0"`).
 */
export interface FullProjectManifestValidationFail {
  ok: false;
  issues: Array<{ path: string; message: string }>;
}

/**
 * Validate an unknown JSON payload as a `FullProjectManifest`. Returns
 * a tagged result so callers can present clear errors at the boot
 * boundary (server CLI) or surface a UI toast (editor).
 *
 * Mirrors the pattern used by `validateProject` and
 * `validateUIPackManifest` — Zod's `safeParse` flattened into a
 * one-line ok/fail union.
 */
export function validateFullProjectManifest(
  input: unknown,
): FullProjectManifestValidationOk | FullProjectManifestValidationFail {
  const parsed = FullProjectManifestSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, manifest: parsed.data };
  }
  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return { ok: false, issues };
}
