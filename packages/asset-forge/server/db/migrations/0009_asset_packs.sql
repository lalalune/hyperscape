-- Asset packs.
--
-- Phase AP1 of `PLAN_ASSET_PACKS.md`. An asset pack is a versioned
-- bundle of 3D meshes (characters, creatures, props, weapons, …)
-- that a project can install. The studio's Asset Library reads
-- from the union of installed packs.
--
-- Adds:
--   - `asset_packs` table — pack metadata + manifest blob
--   - `assets.pack_id` — nullable FK; loose assets stay legacy-shaped
--   - `world_projects.asset_packs` — text[] of installed pack ids
--
-- Backfill: zero rows in `asset_packs` and zero changes to
-- existing `assets` (pack_id null = legacy). Existing projects
-- decode with `asset_packs = []`. AP2 ships the Hyperia bundle
-- seeder which inserts the first row.

CREATE TABLE IF NOT EXISTS "asset_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  /** npm-style id, e.g. "@hyperforge/asset-pack-hyperia-v1" */
  "manifest_id" text NOT NULL UNIQUE,
  /** Validated AssetPackManifestSchema blob (spec). */
  "manifest" jsonb NOT NULL,
  /** "built-in" | "user" | "marketplace" */
  "source" text NOT NULL,
  /** Semver pulled out of the manifest for fast filtering. */
  "version" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_asset_packs_team"
  ON "asset_packs" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_asset_packs_source"
  ON "asset_packs" ("source");

-- Per-asset link to its pack. Loose assets (legacy + agent's
-- one-off bakes that haven't been routed yet) keep pack_id NULL.
ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "pack_id" uuid REFERENCES "asset_packs"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_assets_pack" ON "assets" ("pack_id");

-- Project-level installed-packs surface. Mirrors the existing
-- `plugins` typed column shape.
ALTER TABLE "world_projects"
  ADD COLUMN IF NOT EXISTS "asset_packs" text[] NOT NULL DEFAULT ARRAY[]::text[];
