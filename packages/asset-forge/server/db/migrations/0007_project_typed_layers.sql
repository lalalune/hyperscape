-- Project-as-Data: split the opaque `world_data` blob into typed columns.
--
-- Phase B0'.A of `PLAN_PROJECT_AS_DATA.md`. After this migration, a
-- world project is `{ schemaVersion, config, plugins, worldContent }`
-- instead of an opaque `worldData` jsonb. Each layer is independently
-- queryable / patchable / agent-authorable.
--
-- New columns:
--   schema_version   int       — project shape version (B0'.A = 1)
--   config           jsonb     — procgen `WorldCreationConfig` (terrain shape, biomes, etc.)
--   plugins          text[]    — plugin ids installed by PIE on Play
--   world_content    jsonb     — authored content (npcs, zones, quests, uiPack)
--   template_id      text      — template the project was cloned from (e.g. "blank", "hyperia")
--
-- The `world_data` column is preserved (deprecated) for one release
-- as a safety net. Read-fallback decoding lives in
-- `WorldProjectService` until the deprecated column is dropped in a
-- follow-up migration.
--
-- Backfill rules:
--   - Rows with `world_data ->> '_placeholder' = 'true'`
--       → templateId = "hyperia", plugins = ["@hyperforge/hyperscape"],
--         config = NULL (will be re-populated at first PIE Play from
--         HYPERIA_GAME_WORLD_CONFIG by the editor; the placeholder
--         row had no real config to import).
--   - All other rows
--       → templateId = "blank", plugins = [], config = world_data->'config'
--         when present, otherwise NULL.
--   - world_content uniformly = '{}' (existing rows have no
--     agent-authored content yet).

ALTER TABLE "world_projects"
  ADD COLUMN "schema_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN "config" jsonb,
  ADD COLUMN "plugins" text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN "world_content" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "template_id" text;

-- Backfill placeholder rows (auto-created at signup; loaded the
-- Hyperia world on first open).
UPDATE "world_projects"
SET
  template_id = 'hyperia',
  plugins = ARRAY['@hyperforge/hyperscape']::text[],
  config = NULL,
  world_content = '{}'::jsonb
WHERE world_data ->> '_placeholder' = 'true';

-- Backfill non-placeholder rows (real projects with terrain).
-- Pull `config` out of the existing `worldData` blob if present.
UPDATE "world_projects"
SET
  template_id = 'blank',
  plugins = ARRAY[]::text[],
  config = COALESCE(world_data -> 'config', NULL),
  world_content = '{}'::jsonb
WHERE template_id IS NULL;
