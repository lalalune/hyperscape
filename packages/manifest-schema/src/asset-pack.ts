/**
 * Asset section schemas — entries that show up in a
 * `ContentPack`'s `assets[]` section.
 *
 * Originally defined as the standalone `AssetPack` schema
 * (Phase AP1 of `PLAN_ASSET_PACKS.md`). Phase A of
 * `PLAN_AAA_CONTENT_SYSTEM.md` collapsed every pack-type
 * wrapper into one `ContentPackManifestSchema`; this file
 * now hosts only the section-level schemas (one asset
 * entry, the asset type enum). The outer wrapper +
 * validators moved to `content-pack.ts`.
 */

import { z } from "zod";

/**
 * Type categories an asset can claim. Aligned with the same
 * enum the agent's `PROPOSE_ASSET` action emits — keeps the
 * one-to-one mapping clean when the agent's bake completes
 * and gets routed into a pack entry.
 */
export const AssetTypeSchema = z.enum([
  "character",
  "creature",
  "prop",
  "weapon",
  "tool",
  "armor",
  "vehicle",
  "misc",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetPackEntrySchema = z.object({
  /**
   * Pack-scoped id (unique within the pack). The runtime resolves
   * a global reference as `<pack_id>/<entry_id>`.
   */
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  type: AssetTypeSchema,
  /** Sub-category specific to type (e.g. "humanoid", "sword"). */
  subtype: z.string().min(1),
  /**
   * URL or `asset://` URI to the GLB/FBX/etc. The studio resolves
   * `asset://...` through the existing asset CDN stack.
   */
  modelUrl: z.string().min(1),
  /** Optional thumbnail image — surfaced in the asset library UI. */
  thumbnailUrl: z.string().optional(),
  /** Meters; only meaningful for character / creature entries. */
  characterHeight: z.number().positive().optional(),
  /** True when the model has a rig the runtime can drive. */
  rigged: z.boolean().optional(),
  /** Free-form tags for filtering / search. */
  tags: z.array(z.string()).default([]),
});
export type AssetPackEntry = z.infer<typeof AssetPackEntrySchema>;
