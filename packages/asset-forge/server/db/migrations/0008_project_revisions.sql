-- Project revision history.
--
-- Phase G1 of the AAA gap audit. Today every patch to a project's
-- typed layers is destructive — the prior state is overwritten in
-- place. This adds an append-only `world_project_revisions` table
-- that captures each prior state before a write, so:
--
--   1. The user can see who changed what (agent vs human, when)
--   2. "Compare two variants" has a substrate to read from
--   3. Accidental overwrites are recoverable (restore endpoint
--      slated for a follow-up cut)
--
-- Columns:
--   id              uuid    PK
--   project_id      uuid    FK -> world_projects(id) ON DELETE CASCADE
--   version         int     project version that THIS revision captures
--                            (matches world_projects.version BEFORE the
--                             write that triggered the snapshot)
--   author          text    'user' | 'agent' | 'system' (agent =
--                            mutations sent through eliza-game-builder
--                            actions; user = direct API calls; system =
--                            migrations / backfills)
--   author_id       uuid    nullable — forge_users.id when author='user'
--   change_reason   text    nullable — short human-readable label
--                            (e.g. "patch worldContent", "PROPOSE_NPC")
--   schema_version  int     snapshot of world_projects.schema_version
--   config          jsonb   nullable, snapshot of world_projects.config
--   plugins         text[]  snapshot of world_projects.plugins
--   world_content   jsonb   snapshot of world_projects.world_content
--   template_id     text    nullable, snapshot of world_projects.template_id
--   created_at      timestamptz
--
-- Indexes:
--   - (project_id, created_at desc) — latest revisions for a project
--   - (project_id, version desc)    — restore-by-version lookups

CREATE TABLE IF NOT EXISTS "world_project_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "world_projects"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "author" text NOT NULL DEFAULT 'system',
  "author_id" uuid REFERENCES "forge_users"("id"),
  "change_reason" text,
  "schema_version" integer NOT NULL DEFAULT 1,
  "config" jsonb,
  "plugins" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "world_content" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "template_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_project_revisions_project_created"
  ON "world_project_revisions" ("project_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_project_revisions_project_version"
  ON "world_project_revisions" ("project_id", "version" DESC);
