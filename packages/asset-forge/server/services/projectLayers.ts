/**
 * Pure helpers for the typed project-layer model. Phase B0'.A of
 * `PLAN_PROJECT_AS_DATA.md`.
 *
 * These live in their own module (not in `WorldProjectService.ts`)
 * so they can be unit-tested without dragging the DB / Drizzle /
 * docker-manager import chain into the test environment.
 *
 * The decode + synth rules here are the single source of truth.
 * `WorldProjectService` re-exports `decodeProjectLayers` and uses
 * `resolveLayersFromCreateInput` + `synthLegacyBlob` internally.
 * The SQL migration (`0007_project_typed_layers.sql`) implements
 * the same decode rules at backfill time.
 */

import type { WorldProject } from "../db/schema/index.js";

/** Current project shape version. */
export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

/**
 * Decoded project layers — the typed shape callers consume.
 * Sourced from the typed columns when populated; falls back to the
 * deprecated `worldData` blob when the row predates the
 * `0007_project_typed_layers` migration's backfill.
 */
export interface ProjectLayers {
  schemaVersion: number;
  config: Record<string, unknown> | null;
  plugins: ReadonlyArray<string>;
  /** AP1: asset packs the project has installed. */
  assetPacks: ReadonlyArray<string>;
  worldContent: Record<string, unknown>;
  templateId: string | null;
}

/**
 * Read-fallback decoder. For a freshly-typed row, just returns the
 * column values. For a legacy row whose typed columns are NULL/empty
 * defaults but `worldData` is populated, decodes the layers from the
 * blob using the same rules the migration applies.
 */
export function decodeProjectLayers(row: WorldProject): ProjectLayers {
  // Typed columns populated by the migration's backfill (the common
  // case after the migration runs).
  if (row.config !== null || row.templateId !== null) {
    return {
      schemaVersion: row.schemaVersion,
      config: (row.config as Record<string, unknown> | null) ?? null,
      plugins: row.plugins ?? [],
      assetPacks:
        (row as { assetPacks?: ReadonlyArray<string> }).assetPacks ?? [],
      worldContent: (row.worldContent as Record<string, unknown>) ?? {},
      templateId: row.templateId,
    };
  }

  // Read-fallback: row predates B0'.A migration backfill. Decode
  // from the deprecated `worldData` blob using the same rules the
  // migration applies.
  const blob = (row.worldData as Record<string, unknown>) ?? {};
  const isPlaceholder = blob._placeholder === true;
  if (isPlaceholder) {
    return {
      schemaVersion: 1,
      config: null,
      plugins: ["@hyperforge/hyperscape"],
      assetPacks: [
        "@hyperforge/asset-pack-hyperia-trees-v1",
        "@hyperforge/asset-pack-hyperia-rocks-v1",
        "@hyperforge/asset-pack-hyperia-npcs-v1",
        "@hyperforge/asset-pack-hyperia-mobs-v1",
        "@hyperforge/asset-pack-hyperia-stations-v1",
      ],
      worldContent: {},
      templateId: "hyperia",
    };
  }
  return {
    schemaVersion: 1,
    config:
      typeof blob.config === "object" && blob.config !== null
        ? (blob.config as Record<string, unknown>)
        : null,
    plugins: [],
    assetPacks: [],
    worldContent: {},
    templateId: "blank",
  };
}

/**
 * Resolve the typed project layers a `create()` call should write.
 * Mirrors the migration's backfill rules so a legacy caller that
 * still passes only `worldData` ends up with the same typed shape
 * the migration would have produced for that row.
 */
export function resolveLayersFromCreateInput(input: {
  config?: Record<string, unknown> | null;
  plugins?: ReadonlyArray<string>;
  assetPacks?: ReadonlyArray<string>;
  worldContent?: Record<string, unknown>;
  templateId?: string;
  worldData?: Record<string, unknown>;
}): ProjectLayers {
  if (
    input.config !== undefined ||
    input.plugins !== undefined ||
    input.assetPacks !== undefined ||
    input.worldContent !== undefined ||
    input.templateId !== undefined
  ) {
    return {
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      config: input.config ?? null,
      plugins: input.plugins ?? [],
      assetPacks: input.assetPacks ?? [],
      worldContent: input.worldContent ?? {},
      templateId: input.templateId ?? "blank",
    };
  }

  if (input.worldData) {
    const blob = input.worldData;
    const isPlaceholder = blob._placeholder === true;
    if (isPlaceholder) {
      return {
        schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
        config: null,
        plugins: ["@hyperforge/hyperscape"],
        assetPacks: [
          "@hyperforge/asset-pack-hyperia-trees-v1",
          "@hyperforge/asset-pack-hyperia-rocks-v1",
          "@hyperforge/asset-pack-hyperia-npcs-v1",
          "@hyperforge/asset-pack-hyperia-mobs-v1",
          "@hyperforge/asset-pack-hyperia-stations-v1",
        ],
        worldContent: {},
        templateId: "hyperia",
      };
    }
    return {
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      config:
        typeof blob.config === "object" && blob.config !== null
          ? (blob.config as Record<string, unknown>)
          : null,
      plugins: [],
      assetPacks: [],
      worldContent: {},
      templateId: "blank",
    };
  }

  // Nothing supplied → blank project.
  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    config: null,
    plugins: [],
    assetPacks: [],
    worldContent: {},
    templateId: "blank",
  };
}

/**
 * Synthesize the deprecated `worldData` blob from typed layers so
 * legacy consumers reading `worldData` see a consistent view of the
 * project until the column is dropped in a follow-up migration.
 *
 * Mirrors the inverse of the migration's decode rules: a
 * Hyperia-template project surfaces `_placeholder: true`; everything
 * else surfaces `{ config }`.
 */
export function synthLegacyBlob(
  layers: ProjectLayers,
): Record<string, unknown> {
  // The `_placeholder: true` sentinel signals "this project
  // needs procgen on first open — no terrain has been generated
  // yet." The loader checks `rawData._placeholder === true` and
  // routes to `generateWorldFromConfig` instead of
  // `deserializeWorld(rawData)` (which would crash on an empty
  // blob).
  //
  // Pre-Phase-E this was just `templateId === "hyperia"` (the
  // only template that ran procgen). Phase E
  // (PLAN_AAA_CONTENT_SYSTEM) introduced project packs whose
  // `templateId` is the manifest id (e.g.
  // `@hyperforge/project-pack-hyperia-v1`). Any project pack
  // fork needs the same first-open procgen behaviour, so the
  // condition widens to recognize the canonical project-pack
  // id prefix.
  const needsFirstOpenProcgen =
    layers.templateId === "hyperia" ||
    (layers.templateId !== null &&
      layers.templateId.startsWith("@hyperforge/project-pack-"));
  if (needsFirstOpenProcgen) {
    return { _placeholder: true };
  }
  return layers.config !== null ? { config: layers.config } : {};
}

/**
 * Merge a `Partial<WorldContent>` patch into an existing
 * `worldContent`. Top-level keys are replaced wholesale; explicit
 * `null` removes the key.
 *
 * Phase B0'.G of `PLAN_PROJECT_AS_DATA.md` — the canonical merge
 * function used by `WorldProjectService.patchWorldContent` (server
 * side) and any future client-side optimistic-update path.
 */
export function mergeWorldContent(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }
  return result;
}
