/**
 * ProjectManifestExporter — converts a persisted `Project` (the DB-shape
 * authored data) into a `FullProjectManifest` (the runtime-ready shape
 * consumed by the game server's `--projectManifest <path>` flag).
 *
 * Single source of truth for the editor → runtime handoff. Both PIE
 * (in-process) and Standalone Launch (separate process) read the output
 * of this function to boot the user's project.
 *
 * Pure function — no DB access, no IO. The caller (an API route or a
 * launcher service) is responsible for:
 *   1. Reading the project row from `worldProjects`
 *   2. Validating it via `validateProject` from manifest-schema
 *   3. Calling `exportProjectManifest(project, manifestSnapshot)`
 *   4. Writing the result as JSON to disk for the runtime to read
 *
 * Phase 0.1.2 of PLAN_AAA_UE5_PARITY.
 */

import type {
  Project,
  FullProjectManifest,
  FullProjectManifestContent,
  FullProjectManifestRegistries,
  FullProjectManifestWorldConfig,
} from "@hyperforge/manifest-schema";

/**
 * Test seam — lets unit tests pin `exportedAt` to a deterministic value.
 */
export interface ExportProjectManifestOptions {
  /** Override the timestamp generator. Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Content-pack id prefix. Installed packs that match this prefix land in
 * `boot.contentPacks`; everything else lands in `boot.assetPacks` as the
 * permissive catch-all. Mirrors `contentPackConstants.CONTENT_PACK_ID_PREFIX`
 * but inlined here to avoid pulling a client-only module into a server
 * service.
 */
const CONTENT_PACK_ID_PREFIX = "@hyperforge/content-pack-";

/**
 * Convert a persisted `Project` (+ optional registry snapshot) into a
 * runtime-ready `FullProjectManifest`.
 *
 * @param project A validated project row from `worldProjects`.
 * @param manifestSnapshot Optional 38-manifest registry snapshot (from
 *   `worldProjects.manifestSnapshot` JSONB column). When present, the
 *   runtime treats this as registry overrides — replaces the server's
 *   default per-game manifests for items/dialogue/stores/gathering etc.
 *   Pass `undefined` to let the runtime use whatever the loaded content
 *   packs ship.
 * @param options Test seams (deterministic timestamp).
 */
export function exportProjectManifest(
  project: Project,
  manifestSnapshot?: Record<string, unknown>,
  options: ExportProjectManifestOptions = {},
): FullProjectManifest {
  const now = options.now ?? Date.now;

  // Discriminate the project's installed pack list. `project.assetPacks`
  // is the project-row's flat list of pack ids; the runtime needs them
  // bucketed so the plugin loader can boot content packs (which
  // contribute manifests / systems) before asset packs (which contribute
  // models / textures only).
  const contentPacks: string[] = [];
  const assetPacks: string[] = [];
  for (const packId of project.assetPacks) {
    if (packId.startsWith(CONTENT_PACK_ID_PREFIX)) {
      contentPacks.push(packId);
    } else {
      assetPacks.push(packId);
    }
  }

  // Hoist terrain seed to a typed top-level field so the runtime CLI can
  // read it without walking the full passthrough config blob. The
  // original config still passes through verbatim so per-theme
  // procgen overrides (heightmap presets, vegetationByBiome) round-trip.
  const projectConfig = project.config as Record<string, unknown>;
  const terrainSection = projectConfig.terrain as { seed?: number } | undefined;
  const terrainSeed = terrainSection?.seed;

  const worldConfig: FullProjectManifestWorldConfig = {
    ...(terrainSeed !== undefined ? { terrainSeed } : {}),
    ...projectConfig,
  };

  // Authored content layered on top of plugin contributions. Field
  // names align with the runtime's expected shape; passthrough
  // preserves the original structure (zones, uiPack, plus any plugin-
  // contributed kinds that aren't modeled in `Project.worldContent`).
  const worldContent = project.worldContent;
  const content: FullProjectManifestContent = {
    ...(worldContent.npcs !== undefined ? { npcs: worldContent.npcs } : {}),
    // `Project.worldContent.spawns` maps to the runtime's `mobs` slot
    // (mob spawn configs). Renamed at the boundary so the runtime's
    // mob spawner system can read them without translation.
    ...(worldContent.spawns !== undefined ? { mobs: worldContent.spawns } : {}),
    ...(worldContent.quests !== undefined
      ? { quests: worldContent.quests }
      : {}),
    // Zones + uiPack + any other passthrough fields preserved as-is.
    ...(worldContent.zones !== undefined ? { zones: worldContent.zones } : {}),
    ...(worldContent.uiPack !== undefined
      ? { uiPack: worldContent.uiPack }
      : {}),
  };

  // Registries come straight from `manifestSnapshot` if the caller
  // supplied one — schema is passthrough so all ~38 manifest kinds
  // (items, dialogue, stores, gathering, achievements, ...) round-trip
  // verbatim. The runtime reads each registry slot it understands and
  // ignores the rest.
  const registries: FullProjectManifestRegistries = (manifestSnapshot ??
    {}) as FullProjectManifestRegistries;

  return {
    meta: {
      projectId: project.id,
      projectName: project.name,
      schemaVersion: 1,
      exportedAt: now(),
      ...(project.templateId !== undefined
        ? { templateId: project.templateId }
        : {}),
    },
    boot: {
      plugins: [...project.plugins],
      contentPacks,
      assetPacks,
    },
    worldConfig,
    content,
    registries,
  };
}
