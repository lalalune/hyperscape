-- Content packs collapse — drop the 4 per-type pack tables
-- and 4 per-type project columns introduced in `0011_pack_types`.
--
-- Phase A of `PLAN_AAA_CONTENT_SYSTEM.md`. After comparing the
-- 5-atomic-pack-types design against UE5 + Unity we converged
-- on a single `ContentPack` delivery unit (one schema, one
-- table, one registry) carrying any combination of typed
-- sections. The 4 per-type tables created in `0011` are
-- redundant — content lives in `asset_packs.manifest` jsonb
-- as a unified `ContentPackManifest` blob with optional
-- `assets` / `biomes` / `terrainShaders` / etc. sections.
--
-- The `asset_packs` table itself is kept for one cut. A future
-- migration may rename it to `content_packs` for semantic
-- alignment; deferred to keep this commit focused.
--
-- Rollback safety: `0011`'s tables and columns had zero rows
-- (they shipped today; no consumers populated them before this
-- migration ran). Dropping them is purely housekeeping.

DROP TABLE IF EXISTS "biome_packs";
DROP TABLE IF EXISTS "terrain_packs";
DROP TABLE IF EXISTS "water_packs";
DROP TABLE IF EXISTS "vegetation_packs";

ALTER TABLE "world_projects" DROP COLUMN IF EXISTS "biome_packs";
ALTER TABLE "world_projects" DROP COLUMN IF EXISTS "terrain_packs";
ALTER TABLE "world_projects" DROP COLUMN IF EXISTS "water_packs";
ALTER TABLE "world_projects" DROP COLUMN IF EXISTS "vegetation_packs";
