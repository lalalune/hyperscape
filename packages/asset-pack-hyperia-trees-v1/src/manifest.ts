/**
 * Typed manifest export for the Hyperia trees asset pack.
 *
 * Plain JSON sits at the package root as `pack.json`. This file
 * imports that JSON, parses it through `ContentPackManifestSchema`
 * at module load, and re-exports the frozen typed value. Consumers
 * (tests, registries, the editor's Asset Library) can import
 * `manifest` directly without re-parsing.
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
