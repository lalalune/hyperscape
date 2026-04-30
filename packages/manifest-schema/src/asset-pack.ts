/**
 * Asset Pack manifest schema.
 *
 * Phase AP1 of `PLAN_ASSET_PACKS.md`. An asset pack is a versioned
 * bundle of 3D assets (characters, creatures, props, weapons, …)
 * that a project can install. The studio's Asset Library reads
 * from the union of installed packs; the agent's `PROPOSE_ASSET`
 * bakes accumulate into the project's user pack.
 *
 * Two layers:
 *
 *   - `AssetPackEntrySchema` — one asset inside a pack
 *   - `AssetPackManifestSchema` — the full pack (manifest +
 *     metadata + entries)
 *
 * Pack manifests are immutable per `version`. A "new cut of the
 * Hyperia art" ships as `@hyperforge/asset-pack-hyperia-v2`, not
 * an edit to v1.
 */

import { z } from "zod";
import { PluginAuthorSchema } from "./plugin.js";

// Local SemVer copy (the one in plugin.ts is module-private). Same
// shape — `1.2.3` plus optional pre-release / build metadata.
const SemVer = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    "Asset pack version must look like '1.2.3' (SemVer)",
  );

const AssetPackIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^@?[a-z0-9][a-z0-9-_./]*$/i, {
    message: "Asset pack id must look like an npm-style package name",
  });

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

export const AssetPackManifestSchema = z.object({
  version: z.literal(1),
  /**
   * Pack id — npm-style or `@scope/name`. Globally unique. Pack
   * versions ship as separate ids (`...-v2`) rather than mutating
   * a single id; see PLAN_ASSET_PACKS.md "Versioning" for rationale.
   */
  id: AssetPackIdSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * Semver of the pack itself (separate from `version: 1` which is
   * the manifest schema version). e.g. "1.0.0".
   */
  packVersion: SemVer,
  author: PluginAuthorSchema,
  /** SPDX or "UNLICENSED". Free-form to avoid pinning the SPDX list. */
  license: z.string().min(1).default("UNLICENSED"),
  /** Free-form tags applied to the whole pack. */
  tags: z.array(z.string()).default([]),
  /** Asset entries this pack contributes. */
  assets: z.array(AssetPackEntrySchema),
});
export type AssetPackManifest = z.infer<typeof AssetPackManifestSchema>;

export interface ValidateAssetPackManifestResult {
  ok: boolean;
  manifest?: AssetPackManifest;
  issues?: ReadonlyArray<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Convenience: parse an unknown payload as an asset pack manifest.
 * Returns a result discriminated on `ok`. The `issues` array is
 * shaped for direct surfacing back to an LLM (or a human via the
 * studio UI) — same pattern as `validateProject` /
 * `validatePluginManifest`.
 */
export function validateAssetPackManifest(
  raw: unknown,
): ValidateAssetPackManifestResult {
  const result = AssetPackManifestSchema.safeParse(raw);
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
