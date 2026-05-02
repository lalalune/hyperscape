-- Pack types — biome / terrain / water / vegetation packs.
--
-- Phase 2 of `PLAN_PACK_TYPES.md`. Mirrors the existing
-- `asset_packs` infrastructure for the four new orthogonal pack
-- kinds. Each pack is a versioned bundle that a project can
-- install independently of gameplay plugins.
--
-- Adds:
--   - `biome_packs` table       — id/name/color/zoning data
--   - `terrain_packs` table     — shader recipe + heightmap presets
--   - `water_packs` table       — water shader recipe + animation
--   - `vegetation_packs` table  — species + density rules
--   - `world_projects.{biome,terrain,water,vegetation}_packs` — text[] of installed pack ids
--
-- Backfill: zero rows in any new table; existing projects decode
-- with empty pack arrays (default `ARRAY[]::text[]`). Built-in
-- packs land in a follow-up seeder once Phase 3 has runtime
-- consumers that read from these tables.
--
-- All four tables share the same shape as `asset_packs` (per
-- pack-types.schema.ts). Visibility tiers + published_at +
-- per-team scoping mirror AP9.1.

-- ───── biome_packs ─────
CREATE TABLE IF NOT EXISTS "biome_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "manifest_id" text NOT NULL UNIQUE,
  "manifest" jsonb NOT NULL,
  "source" text NOT NULL,
  "version" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'team',
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_biome_packs_team"
  ON "biome_packs" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_biome_packs_source"
  ON "biome_packs" ("source");
CREATE INDEX IF NOT EXISTS "idx_biome_packs_public_published"
  ON "biome_packs" ("visibility", "published_at");

-- ───── terrain_packs ─────
CREATE TABLE IF NOT EXISTS "terrain_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "manifest_id" text NOT NULL UNIQUE,
  "manifest" jsonb NOT NULL,
  "source" text NOT NULL,
  "version" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'team',
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_terrain_packs_team"
  ON "terrain_packs" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_terrain_packs_source"
  ON "terrain_packs" ("source");
CREATE INDEX IF NOT EXISTS "idx_terrain_packs_public_published"
  ON "terrain_packs" ("visibility", "published_at");

-- ───── water_packs ─────
CREATE TABLE IF NOT EXISTS "water_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "manifest_id" text NOT NULL UNIQUE,
  "manifest" jsonb NOT NULL,
  "source" text NOT NULL,
  "version" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'team',
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_water_packs_team"
  ON "water_packs" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_water_packs_source"
  ON "water_packs" ("source");
CREATE INDEX IF NOT EXISTS "idx_water_packs_public_published"
  ON "water_packs" ("visibility", "published_at");

-- ───── vegetation_packs ─────
CREATE TABLE IF NOT EXISTS "vegetation_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "manifest_id" text NOT NULL UNIQUE,
  "manifest" jsonb NOT NULL,
  "source" text NOT NULL,
  "version" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'team',
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vegetation_packs_team"
  ON "vegetation_packs" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_vegetation_packs_source"
  ON "vegetation_packs" ("source");
CREATE INDEX IF NOT EXISTS "idx_vegetation_packs_public_published"
  ON "vegetation_packs" ("visibility", "published_at");

-- ───── world_projects.{biome,terrain,water,vegetation}_packs columns ─────
ALTER TABLE "world_projects"
  ADD COLUMN IF NOT EXISTS "biome_packs" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE "world_projects"
  ADD COLUMN IF NOT EXISTS "terrain_packs" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE "world_projects"
  ADD COLUMN IF NOT EXISTS "water_packs" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE "world_projects"
  ADD COLUMN IF NOT EXISTS "vegetation_packs" text[] NOT NULL DEFAULT ARRAY[]::text[];
