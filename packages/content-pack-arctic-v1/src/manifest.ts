/**
 * Typed manifest export for the Arctic content pack.
 *
 * Plain JSON sits at the package root as `pack.json`. This file
 * imports that JSON, parses it through `ContentPackManifestSchema`
 * at module load, and re-exports the frozen typed value.
 *
 * Parsing happens at module load so any manifest regression fails
 * early — ideally during `bun run build` / `bun run test` rather
 * than at install time.
 */

import {
  ContentPackManifestSchema,
  type ContentPackManifest,
} from "@hyperforge/manifest-schema";

import packJson from "../pack.json" with { type: "json" };

export const manifest: ContentPackManifest =
  ContentPackManifestSchema.parse(packJson);
