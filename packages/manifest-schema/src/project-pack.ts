/**
 * Project Pack manifest schema.
 *
 * Phase 1 of `PLAN_PACK_TYPES.md`. A `ProjectPack` is the
 * "fork an entire game" surface: it bundles references to
 * gameplay plugins, asset packs, biome packs, terrain/water/
 * vegetation packs, plus optional snapshots of the project
 * config + authored world content.
 *
 * Forking Hyperia = installing
 * `@hyperforge/project-pack-hyperia-v1`, whose manifest
 * transitively pulls in the Hyperscape plugin set, the
 * Hyperia asset packs, the Hyperia biome pack
 * (tundra/forest/canyon), the Hyperia terrain pack (the
 * current shader), and so on. Phase 5 of
 * `PLAN_PACK_TYPES.md` implements `ProjectPackService.fork`
 * which creates a new project, installs every referenced
 * pack, and applies the optional `initialConfig` +
 * `initialWorldContent` snapshots.
 *
 * The schema lands first (this phase) so tooling can validate
 * authored project packs and CLI scaffolding can exist before
 * the runtime fork plumbing is wired up.
 */

import { z } from "zod";
import { PackHeaderShape, PackIdSchema } from "./pack-header.js";
import {
  ProjectConfigSchema,
  ProjectPluginIdSchema,
  ProjectWorldContentSchema,
} from "./project.js";

/**
 * Reference to a pack the project pack pulls in. The `id` is
 * a plain pack id today; a future supply-chain phase may add
 * `version` (semver-range) here without breaking existing
 * project packs.
 */
const PackRefSchema = z.object({
  id: PackIdSchema,
});
export type PackRef = z.infer<typeof PackRefSchema>;

export const ProjectPackManifestSchema = z.object({
  ...PackHeaderShape,

  /**
   * Gameplay plugins this project pack installs. Mirrors the
   * `plugins` column on `ProjectSchema`; the fork action
   * forwards this list to the plugin install surface.
   */
  pluginIds: z.array(ProjectPluginIdSchema).default([]),

  /** Asset packs (3D models / audio / textures). */
  assetPackIds: z.array(PackIdSchema).default([]),

  /** Biome packs (id/name/color/zoning rules). */
  biomePackIds: z.array(PackIdSchema).default([]),

  /** Terrain packs (shader recipe + heightmap presets). */
  terrainPackIds: z.array(PackIdSchema).default([]),

  /** Water packs (water shader recipe + animation profile). */
  waterPackIds: z.array(PackIdSchema).default([]),

  /** Vegetation packs (species + density rules). */
  vegetationPackIds: z.array(PackIdSchema).default([]),

  /**
   * Optional procgen + project config snapshot applied to the
   * forked project. When absent, the fork uses the defaults
   * from the installed plugin set.
   */
  initialConfig: ProjectConfigSchema.optional(),

  /**
   * Optional authored world-content snapshot — NPCs, mob
   * spawns, zones, quests, UI pack overrides. The fork action
   * merges this into the new project's `worldContent` column
   * after pack installs complete.
   */
  initialWorldContent: ProjectWorldContentSchema.optional(),
});
export type ProjectPackManifest = z.infer<typeof ProjectPackManifestSchema>;

export interface ValidateProjectPackManifestResult {
  ok: boolean;
  manifest?: ProjectPackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

export function validateProjectPackManifest(
  raw: unknown,
): ValidateProjectPackManifestResult {
  const result = ProjectPackManifestSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
      code: i.code,
    })),
  };
}
