import {
  ContentPackManifestSchema,
  type ContentPackManifest,
} from "@hyperforge/manifest-schema";

import packJson from "../pack.json" with { type: "json" };

export const manifest: ContentPackManifest =
  ContentPackManifestSchema.parse(packJson);
