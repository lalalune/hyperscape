/**
 * Trees manifest schema.
 *
 * Source of truth for the tree-type catalog previously hardcoded in
 * `packages/shared/src/constants/TreeTypes.ts`. Extracted as part of Phase A2
 * of `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 *
 * Design notes
 * ------------
 * - **Keyed by subtype** (`oak`, `maple`, …). The full resource ID
 *   (`tree_oak`) is stored explicitly per entry to allow custom IDs per
 *   GameMode without assuming `tree_${subtype}`.
 * - Placement rules live in per-biome configs (TerrainBiomeTypes.ts); this
 *   manifest intentionally stores only the tree catalog + skill requirements.
 */

import { z } from "zod";

/** One entry in the tree catalog. */
export const TreeTypeSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      "Full resource ID used in manifests and entities (e.g., 'tree_oak')",
    ),
  name: z.string().min(1).describe("Display name shown in UI"),
  levelRequired: z
    .number()
    .int()
    .positive()
    .describe("Woodcutting level required to chop"),
});
export type TreeType = z.infer<typeof TreeTypeSchema>;

/** Map of subtype key (e.g., 'oak') → tree definition. */
export const TreeTypeTableSchema = z.record(z.string(), TreeTypeSchema);
export type TreeTypeTable = z.infer<typeof TreeTypeTableSchema>;

/**
 * Full trees manifest. One JSON file per game.
 *
 * Hyperscape ships its own (12 species, tile-based MMORPG-inspired). Alternate GameModes
 * can ship their own catalog — e.g., a sci-fi mode with "crystal tree" entries.
 */
export const TreeManifestSchema = z.object({
  $schema: z
    .literal("hyperforge.trees.v1")
    .describe("Schema version tag — future-proofs migrations"),
  trees: TreeTypeTableSchema,
});
export type TreeManifest = z.infer<typeof TreeManifestSchema>;
