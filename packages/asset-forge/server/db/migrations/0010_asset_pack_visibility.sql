-- Asset pack visibility.
--
-- Phase AP9.1 of `PLAN_ASSET_PACKS.md`. The current scoping
-- convention — `team_id IS NULL` = built-in / installable by
-- everyone — is implicit and brittle. A real marketplace needs
-- three tiers:
--
--   - "private"     → only the owning team sees it (drafts,
--                     in-progress packs)
--   - "team"        → installable by team members (today's
--                     non-null `team_id` default)
--   - "public"      → installable by anyone (built-ins,
--                     marketplace listings)
--
-- Migration is non-breaking:
--   - Adds `visibility` column with backfill (NULL team_id → public,
--     non-null team_id → team)
--   - Adds `published_at` for marketplace publish flow
--   - Adds index for the marketplace browse query
--
-- After this ships, the AP1 convention `team_id IS NULL = built-in`
-- still works, but app code reads `visibility` instead. A follow-up
-- migration once code has switched will (a) point built-ins at a
-- single hyperforge org row instead of NULL team_id, and (b) make
-- team_id NOT NULL — but that's deferred until call sites are clean.

ALTER TABLE "asset_packs"
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'team';

-- Backfill: rows with NULL team_id are "built-in" today → public.
UPDATE "asset_packs"
  SET "visibility" = 'public'
  WHERE "team_id" IS NULL;

-- Validate the enum at the DB layer so an app bug can't write
-- garbage. Using a CHECK constraint instead of pg ENUM type so
-- it's cheap to add new values later.
ALTER TABLE "asset_packs"
  ADD CONSTRAINT "asset_packs_visibility_check"
  CHECK ("visibility" IN ('private', 'team', 'public'));

-- Marketplace publish timestamp. NULL = never published. Set
-- when visibility transitions to "public" through the publish
-- endpoint. Built-in rows are backfilled to their created_at.
ALTER TABLE "asset_packs"
  ADD COLUMN IF NOT EXISTS "published_at" timestamptz;

UPDATE "asset_packs"
  SET "published_at" = "created_at"
  WHERE "team_id" IS NULL;

-- Marketplace browse query: WHERE visibility = 'public' ORDER BY published_at DESC.
CREATE INDEX IF NOT EXISTS "idx_asset_packs_public_published"
  ON "asset_packs" ("visibility", "published_at" DESC)
  WHERE "visibility" = 'public';
