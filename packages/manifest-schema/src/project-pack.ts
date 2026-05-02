/**
 * Project Pack manifest schema.
 *
 * Phase A of `PLAN_AAA_CONTENT_SYSTEM.md`. A `ProjectPack` is
 * the "fork an entire game" surface: it bundles references to
 * gameplay plugins + content packs, plus optional snapshots
 * of the project config + authored world content.
 *
 * Forking Hyperia = installing
 * `@hyperforge/project-pack-hyperia-v1`, whose manifest
 * transitively pulls in the Hyperscape gameplay plugin and
 * the Hyperia content pack (which itself carries biomes +
 * terrain/water shader recipes + asset entries + procgen
 * vegetation + density rules). Phase E of
 * `PLAN_AAA_CONTENT_SYSTEM.md` implements
 * `ProjectPackService.fork` which creates a new project,
 * installs every referenced plugin + content pack, and
 * applies the optional `initialConfig` +
 * `initialWorldContent` snapshots.
 *
 * The earlier `PLAN_PACK_TYPES.md` cut split this into 5
 * separate `*PackIds[]` arrays (asset/biome/terrain/water/
 * vegetation). Phase A collapses them into a single
 * `contentPackIds[]` ref array that points at unified
 * `ContentPack`s carrying any combination of sections.
 */

import { z } from "zod";
import { PackHeaderShape, PackIdSchema } from "./pack-header.js";
import {
  ProjectConfigSchema,
  ProjectPluginIdSchema,
  ProjectWorldContentSchema,
} from "./project.js";

export const ProjectPackManifestSchema = z.object({
  ...PackHeaderShape,

  /**
   * Gameplay plugins this project pack installs. Mirrors the
   * `plugins` column on `ProjectSchema`; the fork action
   * forwards this list to the plugin install surface.
   */
  pluginIds: z.array(ProjectPluginIdSchema).default([]),

  /**
   * Content pack ids this project pack installs. Each resolves
   * to a `content_packs.manifest_id`. Content packs carry any
   * combination of asset / biome / terrain shader / water shader
   * / vegetation sections; the fork action installs them by
   * setting the project's `contentPacks` column.
   */
  contentPackIds: z.array(PackIdSchema).default([]),

  /**
   * Optional procgen + project config snapshot applied to the
   * forked project. When absent, the fork uses the defaults
   * from the installed plugin / content pack set.
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
